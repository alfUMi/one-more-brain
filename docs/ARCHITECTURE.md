# One More Brain: Architecture

Related docs: [PLAN.md](./PLAN.md) · [DATA-MODEL.md](./DATA-MODEL.md)

## 1. System overview

```
 ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
 │  Web (Nuxt)  │  │ Extension    │  │ Mobile       │  │  Telegram    │
 │  PWA + SW    │  │ WXT+Vue MV3  │  │ Nuxt+Ionic   │  │  (users)     │
 │  IndexedDB   │  │ chrome.stor. │  │ Capacitor    │  │              │
 └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
        │ cookie          │ bearer          │ bearer          │ webhook
        └─────────────────┴───────┬─────────┴─────────────────┘
                                  ▼
                 ┌─────────────────────────────────┐
                 │  Caddy (TLS, reverse proxy)     │
                 └────────────────┬────────────────┘
                                  ▼
 ┌────────────────────────────────────────────────────────────────┐
 │  apps/web: Nuxt 4 / Nitro (bun preset)                         │
 │  • UI (SSR off for app routes, SPA)  • /api/* REST (zod)       │
 │  • Better Auth  • presigned uploads  • Telegram webhook        │
 │  • enqueues jobs (pg-boss)                                     │
 └───────────┬──────────────────────────────┬─────────────────────┘
             ▼                              ▼
 ┌───────────────────────┐      ┌──────────────────────────────────┐
 │ Postgres 17           │◄────►│ apps/worker (Bun)                │
 │ • app data (Prisma)   │      │ • pg-boss consumers: ai.enrich,  │
 │ • pg-boss queue       │      │   ai.transcribe, ai.ocr          │
 │ • FTS + pg_trgm       │      │ • minute scanner: due reminders, │
 └───────────────────────┘      │   digests, reviews               │
 ┌───────────────────────┐      │ • senders: WebPush, FCM, Telegram│
 │ MinIO (S3 API)        │◄─────┤                                  │
 │ audio, images         │      └───────┬──────────────┬───────────┘
 └───────────────────────┘              ▼              ▼
                                 Claude API      Speech-to-text API
```

**Why this shape**
- **One backend** (Nuxt server) for all clients keeps the API, auth, and validation in one place.
- **A separate worker** for anything slow or scheduled (AI, reminders, digests), so the web process stays fast and
  stateless. It uses the same packages (`db`, `ai`, `shared`).
- **pg-boss** (a Postgres-backed queue) means no Redis, one fewer service on the VPS.
- **MinIO** speaks the S3 API, so moving to Cloudflare R2 / S3 later is a config change.

## 2. Monorepo layout (Bun workspaces)

```
one-more-brain/
├─ apps/
│  ├─ web/            Nuxt 4 full-stack: UI + server/api + Telegram webhook
│  │  ├─ app/         pages, components (Nuxt UI), extends ../../packages/app-layer
│  │  └─ server/      api/, middleware/, utils/ (auth, storage, queue)
│  ├─ mobile/         Nuxt 4 SPA (ssr:false) + @nuxtjs/ionic + Capacitor (ios/, android/)
│  ├─ extension/      WXT + Vue 3: background, popup, content scripts, options
│  └─ worker/         Bun entry: job handlers, scanners, notification senders
├─ packages/
│  ├─ db/             Prisma schema, migrations, generated client, raw-SQL (FTS) migrations
│  ├─ shared/         zod schemas (API contract), types, enums, SR intervals, i18n messages (en, ru),
│  │                  smart-capture parser (chrono-node + #tags), UUIDv7
│  ├─ api-client/     typed ofetch client + outbox/sync engine with storage adapters
│  │                  (IndexedDB · chrome.storage · Capacitor SQLite)
│  ├─ ai/             Claude client, prompts, structured-output schemas, STT adapter (server-only)
│  ├─ notify/         WebPush / FCM / Telegram senders (server-only)
│  └─ app-layer/      Nuxt layer shared by web + mobile: Pinia stores, composables, i18n config
├─ docker/            compose.dev.yml, compose.prod.yml, Caddyfile, Dockerfiles
└─ docs/
```

**Code sharing rules**
- `shared` and `api-client` are framework-agnostic TS and run everywhere (web, extension, mobile, server).
- `app-layer` is a Nuxt layer used only by the two Nuxt apps. UI components differ: Nuxt UI on web, Ionic components on mobile.
- `db`, `ai`, and `notify` are server-only and never imported by clients (enforced by an ESLint boundary rule).

## 3. Tech choices

| Concern | Choice | Notes |
|---|---|---|
| Runtime / PM | Bun | workspaces, `bun test` optional (Vitest is the primary runner) |
| Web | Nuxt 4, Nuxt UI, Pinia, @nuxtjs/i18n, @vite-pwa/nuxt | Nitro `bun` preset |
| Mobile | Nuxt 4 SPA, @nuxtjs/ionic, Capacitor 7 | shares `app-layer` |
| Extension | WXT + Vue 3 (MV3) | Nuxt is a poor fit for MV3; WXT gives similar DX |
| Validation | zod | schemas in `shared`, used by server handlers and clients |
| ORM / DB | Prisma + Postgres 17 | `pg_trgm`, generated `tsvector` column via raw SQL |
| Auth | Better Auth | magic link, Google OAuth, Prisma adapter, bearer plugin |
| Queue | pg-boss | AI jobs, retries, backoff |
| Files | MinIO (S3) | presigned PUT/GET, private bucket |
| AI | Claude API: `claude-haiku-5-5` | titles, tags, intent/date fallback, OCR via vision |
| Speech-to-text | Hosted STT API behind an `Stt` interface | e.g. Whisper-class API; self-hosted faster-whisper later |
| Dates / recurrence | chrono-node (en, ru), rrule, Temporal polyfill or date-fns-tz | all stored in UTC + IANA tz |
| Push | web-push (VAPID), firebase-admin (FCM for Android + iOS) | |
| Telegram | grammY (webhook) | |
| Email | Resend / SMTP (magic links only) | Mailpit in dev |
| Observability | pino logs, Sentry, Uptime Kuma | |
| Tests | Vitest (units, API), Playwright (web e2e) | |

## 4. Auth across clients

- **Web:** Better Auth session cookie (httpOnly, SameSite=Lax).
- **Extension:** user clicks "Sign in" → opens `https://app/auth/extension` → after sign-in the page calls
  `chrome.runtime.sendMessage(EXT_ID, { token })` (allowed by `externally_connectable`) → the extension stores the
  bearer token in `chrome.storage.local`.
- **Mobile:** in-app browser (Capacitor Browser) → magic link / Google → deep link `onemorebrain://auth?token=…`
  → token stored in Secure Storage.
- **Telegram:** one-time link token (10 min TTL) from Settings → `/start <token>` → `Channel(kind=TELEGRAM, chatId)`.
- Bearer tokens are per-device sessions, listed and revocable in Settings → Devices.

## 5. API surface (REST, `/api/v1`, zod-validated)

| Method & path | Purpose |
|---|---|
| `POST /items` | Create item (client-supplied UUIDv7 `id` makes it idempotent; retries are safe) |
| `PATCH /items/:id` | Edit body/title, change status, set tags |
| `DELETE /items/:id` | Soft delete (`deletedAt`) |
| `GET /items?status&tag&kind&q&cursor` | List/search (cursor pagination) |
| `GET /sync?since=<cursor>` | Delta pull: items, tags, reminders, reviews changed since cursor (incl. tombstones) |
| `POST /uploads` | Get presigned PUT URL for an attachment → client uploads → `POST /items/:id/attachments` |
| `POST /items/:id/reminders` · `PATCH /reminders/:id` · `POST /reminders/:id/snooze` | Reminders |
| `POST /items/:id/review` · `POST /reviews/:id/answer {gotIt}` | Spaced repetition |
| `GET /today` | Due reminders, reviews due, on-this-day |
| `POST /parse` | Server-side smart-capture preview (AI fallback), used when the local parser is unsure |
| `GET/POST/DELETE /channels` | Push subscriptions, FCM tokens, Telegram link token |
| `GET/PATCH /me` | Profile: locale, timezone, digest time, channel prefs |
| `GET /export` | JSON/Markdown export (Phase 7) |
| `POST /telegram/webhook` | Telegram updates (secret-token header verified) |

## 6. Offline & sync

```
 capture ──► local outbox (persisted) ──► flush when online ──► POST /items (idempotent)
                     │                                             │
                     └──► shown immediately in Inbox (optimistic) ◄┘ server echo replaces local copy

 app open / resume / online ──► GET /sync?since=cursor ──► upsert local cache ──► new cursor
```
- **Ids:** UUIDv7 generated on the client, so offline items are referentially stable (attachments, reminders).
- **Outbox:** ordered queue of mutations `{op, entity, payload, attempt}`. It retries with backoff and drops items only on 4xx validation errors (shown to the user).
- **Attachments offline:** blob stored locally. Upload happens on flush, before the item mutation that references it.
- **Conflicts:** last-write-wins using server `updatedAt`. Acceptable for a personal app; revisit if collaboration is added.
- **Cache:** web (IndexedDB via Dexie), extension (only the outbox + last 20 items), mobile (Capacitor SQLite).

## 7. Background processing (apps/worker)

**Jobs (pg-boss)**
| Job | Trigger | Work |
|---|---|---|
| `ai.enrich` | item created/edited | Claude → `{title, tags[], language, reminderSuggestion?}`; reuses the user's existing tags |
| `ai.ocr` | image attachment uploaded | Claude vision → extracted text + 1-line description → item body |
| `ai.transcribe` | audio attachment uploaded | STT → transcript → item body → chains `ai.enrich` |
| `notify.send` | scanner | deliver to a channel, write a `Delivery` row, retry with backoff |

**Scanners (every minute, `SELECT … FOR UPDATE SKIP LOCKED`)**
- **Reminders:** `status=ACTIVE AND fireAt <= now()` → enqueue `notify.send` for each enabled channel. Recurring reminders
  get their next `fireAt` from the RRULE (in the user's timezone); one-off reminders become `FIRED`.
- **Digest:** users whose local time has passed `digestTime` and whose `lastDigestOn < today(local)` → build digest → send.
- **Scanning beats per-job delays** because reminders stay editable and snoozable without cancelling queued jobs, and
  the scanner recovers after downtime by firing anything overdue.

**AI guardrails**
- Structured output via tool schema. Validate with zod and discard invalid output.
- Input includes `now` and the user's timezone and locale, so relative dates resolve correctly.
- Per-user monthly token budget. When exceeded, enrichment is skipped and the item stays usable.
- Prompts and responses are not logged in production (privacy). Only the job status is logged.

## 8. Notifications

| Channel | Client | Mechanism |
|---|---|---|
| `WEB_PUSH` | Web PWA | VAPID Web Push → service worker → `showNotification` with actions |
| `EXTENSION_PUSH` | Extension | Push in MV3 service worker → `chrome.notifications` with buttons |
| `FCM` | Android + iOS | firebase-admin → APNs/FCM. Actions handled via Capacitor push-notifications |
| `TELEGRAM` | Bot chat | `sendMessage` with inline keyboard (Done / Snooze / Archive) |
| Local (geofence) | Mobile | fired on device by the OS geofence callback, no server involved |

Notification actions call `POST /reminders/:id/snooze` or `PATCH /items/:id` with the device token.

## 9. Search
- `Item.search` is a generated `tsvector` built from title, body, quote, pageTitle, and url, using the `simple` config
  (language-agnostic, works for en + ru), plus a `pg_trgm` index on title/body for fuzzy and prefix matches.
- Ranking: `ts_rank` + recency boost.
- Later: `pgvector` embeddings for semantic search and "ask your brain".

## 10. Deployment (VPS)

```
docker compose (prod)
├─ caddy      :80/:443 → web:3000          (auto TLS)
├─ web        Nuxt/Nitro on Bun             (stateless, can scale ×N)
├─ worker     Bun                           (1 replica; scanners use SKIP LOCKED so ×N is safe)
├─ postgres   17 + volume
├─ minio      + volume
└─ backup     cron: pg_dump + mc mirror → off-site bucket (nightly), keep 14 dailies / 8 weeklies
```
- CI (GitHub Actions): lint → typecheck → test → build images → push to GHCR → SSH deploy (`compose pull && up -d`).
- Migrations: `prisma migrate deploy` runs as a one-shot service before `web`/`worker` start.
- Secrets in `.env` on the server (not in the repo). A 4 GB VPS is plenty for personal use.
- Extension: zipped by CI, uploaded to the Chrome Web Store manually.
  Mobile: Fastlane / EAS-like CI later. Manual TestFlight / internal track at first.

## 11. Security & privacy
- Every query is scoped by `userId` (a Prisma extension enforces it), so multi-tenancy is in place from day one.
- Attachments live in a private bucket, served only through short-lived presigned GET URLs.
- Rate limits on auth, capture, and AI endpoints. CSP on the web app. Telegram webhook secret verified.
- Bearer tokens are stored hashed. Devices are revocable.
- Export + delete account (Phase 7). The privacy policy discloses AI and STT processors.
