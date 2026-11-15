# One More Brain: Data Model

Related docs: [PLAN.md](./PLAN.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)

Draft Prisma schema. Better Auth generates its own tables (`Session`, `Account`, `Verification`) alongside `User`.

## Conventions
- **Ids:** UUIDv7 (time-ordered). Items, attachments, and reminders get their ids **on the client**, which makes offline capture idempotent.
- **Time:** all timestamps are UTC (`timestamptz`). User-facing schedules also store the IANA `timezone`.
- **Soft delete:** `deletedAt` on syncable entities, so deletions propagate through `/sync` as tombstones.
- **Sync cursor:** `updatedAt` (indexed per user). The server sets it on every write.
- **Tenancy:** every row has `userId`, and every query is filtered by it.

## Entity overview

```
User ─┬─< Item ─┬─< Attachment
      │         ├─< ItemTag >── Tag ──┐
      │         ├─< Reminder >─ Place?│
      │         └── Review (0..1)     │
      ├─< Tag ────────────────────────┘
      ├─< Place
      ├─< Channel ─< Delivery
      └─< Session / Account (Better Auth)
```

## Schema (draft)

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pg_trgm]
}

// ───────────────────────── Users ─────────────────────────

model User {
  id             String   @id @default(uuid(7)) @db.Uuid
  email          String   @unique
  emailVerified  Boolean  @default(false)
  name           String?
  image          String?
  locale         String   @default("en")        // "en" | "ru"
  timezone       String   @default("UTC")       // IANA, e.g. "Europe/Berlin"
  digestTime     String   @default("08:00")     // local HH:mm
  digestEnabled  Boolean  @default(true)
  lastDigestOn   DateTime? @db.Date             // local date of last sent digest
  theme          String   @default("system")    // "light" | "dark" | "system"
  accent         String   @default("teal")      // "teal" | "violet" | "blue" | "rose" | "graphite"
  prefs          Json     @default("{}")        // channel routing per notification type, other UI prefs
  aiTokensMonth  Int      @default(0)           // usage counter, reset monthly
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  items     Item[]
  tags      Tag[]
  places    Place[]
  channels  Channel[]
  // Better Auth relations: sessions, accounts
}

// ───────────────────────── Items ─────────────────────────

enum ItemKind   { TEXT LINK HIGHLIGHT VOICE IMAGE }
enum ItemStatus { INBOX KEPT ARCHIVED DONE }
enum ItemSource { WEB EXTENSION MOBILE SHARE_SHEET TELEGRAM }
enum AiStatus   { PENDING DONE FAILED SKIPPED }

model Item {
  id          String     @id @db.Uuid            // client-generated UUIDv7
  userId      String     @db.Uuid
  kind        ItemKind
  status      ItemStatus @default(INBOX)
  source      ItemSource

  title       String?                            // user or AI
  titleIsAi   Boolean    @default(false)
  body        String?                            // user text / transcript / OCR text
  quote       String?                            // highlighted text (HIGHLIGHT)
  url         String?                            // LINK / HIGHLIGHT / page context
  pageTitle   String?
  favicon     String?
  language    String?                            // detected: "en" | "ru" | …

  aiStatus    AiStatus   @default(PENDING)
  capturedAt  DateTime                           // client clock at capture
  triagedAt   DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  deletedAt   DateTime?

  // search  Unsupported("tsvector")?  -- generated column added via raw SQL migration

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  tags        ItemTag[]
  attachments Attachment[]
  reminders   Reminder[]
  review      Review?

  @@index([userId, status, capturedAt(sort: Desc)])
  @@index([userId, updatedAt])
  @@index([userId, capturedAt])                  // on-this-day lookups
}

enum AttachmentKind { IMAGE SCREENSHOT AUDIO }

model Attachment {
  id          String         @id @db.Uuid        // client-generated
  userId      String         @db.Uuid
  itemId      String         @db.Uuid
  kind        AttachmentKind
  storageKey  String                             // s3 key: {userId}/{itemId}/{id}.{ext}
  mime        String
  sizeBytes   Int
  width       Int?
  height      Int?
  durationSec Float?
  createdAt   DateTime       @default(now())
  deletedAt   DateTime?

  item Item @relation(fields: [itemId], references: [id], onDelete: Cascade)

  @@index([itemId])
}

// ───────────────────────── Tags ─────────────────────────

model Tag {
  id        String   @id @default(uuid(7)) @db.Uuid
  userId    String   @db.Uuid
  name      String                               // lowercase, no '#'
  color     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  user  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  items ItemTag[]

  @@unique([userId, name])
}

model ItemTag {
  itemId    String   @db.Uuid
  tagId     String   @db.Uuid
  suggested Boolean  @default(false)             // AI-suggested, not yet confirmed by user
  createdAt DateTime @default(now())

  item Item @relation(fields: [itemId], references: [id], onDelete: Cascade)
  tag  Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([itemId, tagId])
  @@index([tagId])
}

// ───────────────────────── Reminders ─────────────────────────

enum ReminderKind    { TIME RECURRING LOCATION }
enum ReminderStatus  { ACTIVE FIRED DONE CANCELLED }
enum GeoTrigger      { ENTER EXIT }

model Reminder {
  id          String         @id @db.Uuid        // client-generated
  userId      String         @db.Uuid
  itemId      String         @db.Uuid
  kind        ReminderKind
  status      ReminderStatus @default(ACTIVE)

  fireAt      DateTime?                          // next fire time (UTC); snooze moves it
  rrule       String?                            // RFC 5545, for RECURRING
  timezone    String                             // IANA, evaluated for RRULE + display
  untilAt     DateTime?

  placeId     String?        @db.Uuid            // for LOCATION
  geoTrigger  GeoTrigger?

  isAiSuggested Boolean      @default(false)     // shown as accept-chip until confirmed
  lastFiredAt DateTime?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  deletedAt   DateTime?

  item  Item   @relation(fields: [itemId], references: [id], onDelete: Cascade)
  place Place? @relation(fields: [placeId], references: [id])
  deliveries Delivery[]

  @@index([status, fireAt])                      // minute scanner
  @@index([userId, updatedAt])
}

model Place {
  id        String   @id @default(uuid(7)) @db.Uuid
  userId    String   @db.Uuid
  label     String                               // "Home", "Store"
  latitude  Float
  longitude Float
  radiusM   Int      @default(150)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  reminders Reminder[]
}

// ───────────────────────── Spaced repetition ─────────────────────────

model Review {
  itemId         String    @id @db.Uuid
  userId         String    @db.Uuid
  step           Int       @default(0)           // index into [1,3,7,14,30,90,180] days
  nextAt         DateTime
  lastReviewedAt DateTime?
  lapses         Int       @default(0)
  graduatedAt    DateTime?                       // after the final step
  updatedAt      DateTime  @updatedAt

  item Item @relation(fields: [itemId], references: [id], onDelete: Cascade)

  @@index([userId, nextAt])
}

// ───────────────────────── Delivery channels ─────────────────────────

enum ChannelKind { WEB_PUSH EXTENSION_PUSH FCM TELEGRAM }

model Channel {
  id         String      @id @default(uuid(7)) @db.Uuid
  userId     String      @db.Uuid
  kind       ChannelKind
  address    String                              // push endpoint / FCM token / Telegram chatId
  keys       Json?                               // web push p256dh + auth
  label      String?                             // "Chrome on MacBook", "Pixel 9"
  enabled    Boolean     @default(true)
  lastSeenAt DateTime?
  createdAt  DateTime    @default(now())

  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  deliveries Delivery[]

  @@unique([kind, address])
}

enum DeliveryType   { REMINDER DIGEST REVIEW }
enum DeliveryStatus { SENT FAILED EXPIRED }   // EXPIRED → channel disabled (410 Gone etc.)

model Delivery {
  id         String         @id @default(uuid(7)) @db.Uuid
  userId     String         @db.Uuid
  channelId  String         @db.Uuid
  reminderId String?        @db.Uuid
  type       DeliveryType
  status     DeliveryStatus
  error      String?
  sentAt     DateTime       @default(now())

  channel  Channel   @relation(fields: [channelId], references: [id], onDelete: Cascade)
  reminder Reminder? @relation(fields: [reminderId], references: [id], onDelete: SetNull)

  @@index([reminderId])
  @@index([userId, sentAt])
}
```

## Raw-SQL migration (search)

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "Item" ADD COLUMN search tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce(title, '')),     'A') ||
  setweight(to_tsvector('simple', coalesce(quote, '')),     'B') ||
  setweight(to_tsvector('simple', coalesce(body, '')),      'B') ||
  setweight(to_tsvector('simple', coalesce("pageTitle", '')), 'C') ||
  setweight(to_tsvector('simple', coalesce(url, '')),       'D')
) STORED;

CREATE INDEX item_search_idx ON "Item" USING GIN (search);
CREATE INDEX item_title_trgm ON "Item" USING GIN (title gin_trgm_ops);
CREATE INDEX item_body_trgm  ON "Item" USING GIN (body  gin_trgm_ops);
```

## Key flows against the model

| Flow | Writes |
|---|---|
| Capture highlight (extension) | `Item(kind=HIGHLIGHT, source=EXTENSION, quote, url, pageTitle)` → job `ai.enrich` |
| "call mom tomorrow 18:00" | `Item(TEXT)` + `Reminder(TIME, fireAt, timezone)` (deterministic parse, auto-applied) |
| AI finds a vague date | `Reminder(isAiSuggested=true, status=ACTIVE)`, which does not fire until the user accepts the chip. Until then the scanner skips rows where `isAiSuggested` is true. |
| Triage "Keep" | `Item.status=KEPT, triagedAt`, `ItemTag.suggested=false` for that item |
| "Remember" | `Review(step=0, nextAt=now+1d)` |
| Review answer "Got it" | `step++`, `nextAt=now+intervals[step]`, `graduatedAt` after the last step |
| Review answer "Forgot" | `step=0`, `lapses++`, `nextAt=now+1d` |
| Reminder fires | `Delivery` rows per channel. One-off → `status=FIRED`. Recurring → `fireAt=next(rrule)` |
| Snooze | `fireAt = now + snooze`, `status=ACTIVE` |
| Telegram voice | `Item(VOICE, source=TELEGRAM)` + `Attachment(AUDIO)` → `ai.transcribe` → `ai.enrich` |
