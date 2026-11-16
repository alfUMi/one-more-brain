# One More Brain: Product Plan

> A second brain you **dump things into** and that **brings them back** to you.
> It is not a note-taking app. There are no folders, no blank pages, no "where do I put this?".

Related docs: [ARCHITECTURE.md](./ARCHITECTURE.md) · [DATA-MODEL.md](./DATA-MODEL.md)

---

## 1. Problem & principles

**Problem:** I forget things. Ordinary note apps don't help, because capturing takes too much effort and notes,
once written, are never seen again.

**Principles**

1. **Capture in under 3 seconds** from anywhere: browser, phone share sheet, Telegram, hotkey.
2. **Zero decisions at capture time.** Everything lands in the **Inbox**, and AI adds a title and tags.
3. **The app remembers for you.** Reminders, a daily digest, spaced repetition, "on this day".
4. **Triage, don't organize.** Inbox → Keep / Archive / Done / Remind / Remember. Tags only, never folders.
5. **Capture works offline.** It never fails. Viewing uses cached data when offline.
6. **Built for me first, ready for the public later.** Multi-user data model, real auth, no single-user shortcuts.

## 2. Decisions from the Q&A

| Topic | Decision |
|---|---|
| Core idea | Capture-first inbox + resurfacing + reminders built in |
| Audience | Me first, public later |
| Content | Short text, web highlights & links, voice notes, images/screenshots |
| Reminders | Specific time, recurring, location-based (mobile), context = daily digest |
| Organization | Inbox → triage, tags only (AI-suggested) |
| Resurfacing | Daily digest, spaced repetition, on this day |
| Stack | Bun monorepo · Nuxt full-stack web · Vue + Ionic + Capacitor mobile · Chrome MV3 extension (Vue) |
| Backend | Nuxt (Nitro) server + Prisma + Postgres |
| AI | Light: tags/titles, reminder parsing, OCR (Claude), voice transcription (speech-to-text API) |
| Offline | Capture offline, sync later; read from cache |
| Hosting | VPS + Docker Compose |
| Delivery | Mobile push, web/desktop push, Telegram bot (which also captures) |
| Auth | Email magic link + Google |
| Languages | English, Russian (UI + date parsing) |
| Build order | Web → Extension → Telegram → Resurfacing → Mobile → Location |
| Look | Neutral UI, Inter + Space Grotesk. Light, dark, or system theme |
| Accent | **Teal** by default (`#0F766E` light / `#4FD1C5` dark). User can switch to violet, blue, rose, or graphite |

## 2a. Visual design

Mockups: https://claude.ai/artifact/Q8emX9hqdvXmZaHrf8TFHL

- **Theme:** light / dark / system, set in Settings → Appearance and synced across devices.
- **Accent:** one color for buttons, focus, selection, and the active menu item. Default teal. Options:

  | Name | Light | Dark |
  |---|---|---|
  | Teal (default) | `#0F766E` | `#4FD1C5` |
  | Violet | `#6D4AE0` | `#B79CFF` |
  | Blue | `#2F5BEA` | `#7C98FF` |
  | Rose | `#C0365A` | `#FF8FAB` |
  | Graphite | `#15171C` | `#E8EAEE` |

- **Colors that never change with the accent:** amber = reminders, green = Keep, a dashed outline = AI suggestion.
  Each note type also has its own tint: yellow = highlight, green = voice, violet = image, blue = link.
- **Implementation:** colors are CSS variables (`--accent`, `--accent-soft`, `--on-accent`, …) with a
  `data-theme` / `data-accent` attribute on `<html>`, shared by web, extension, and mobile through `packages/shared`.
  The extension popup and mobile app follow the same setting.

## 3. Core concepts

### Item
Everything you capture is one **Item**. Its kind is `text`, `link`, `highlight`, `voice`, or `image`.
An item has optional tags, attachments, reminders, and a spaced-repetition review.

### Item lifecycle
```
                   ┌──────────► KEPT ──────┐
 capture ─► INBOX ─┼──────────► ARCHIVED   ├─► (searchable forever)
                   └──────────► DONE ──────┘
          (+ reminder / + remember can be attached at any state)
```
- **Inbox:** new and untriaged. The goal is inbox zero, and the digest nags when the inbox grows.
- **Kept:** worth keeping. AI-suggested tags become confirmed.
- **Archived:** out of sight, still searchable.
- **Done:** for task-like items that are finished.

### Smart capture
Type naturally, and the app extracts structure.
- `call mom tomorrow 18:00` → reminder chip **⏰ Tomorrow 18:00**, shown inline with undo.
- `pay rent every month on the 1st` → recurring reminder.
- `позвонить маме завтра в 6` → same as above, in Russian.
- `#book Thinking Fast and Slow` → explicit tag.
- `!remember` or a "Remember" toggle → adds the item to spaced repetition.

Date parsing is **deterministic first** (`chrono-node`, en + ru), with an **AI fallback** for fuzzy or recurring phrases.
Explicit dates are applied automatically. Dates guessed by AI appear as a suggestion chip to accept.

### Triage
- **Web:** card list with keyboard shortcuts (`k` keep · `a` archive · `d` done · `r` remind · `m` remember · `e` edit · `#` tag).
- **Mobile:** swipe gestures (right = keep, left = archive, long-press = actions).
- AI-suggested tags are shown dimmed. Keeping the item confirms them.

## 4. Features by surface

### Web app (Nuxt, installable PWA)
- Capture box always on top (focus with `/` or `c`). Paste images, drop files, record voice.
- Inbox triage view, then **Library** (all items, filter by tag/kind/status, full-text search).
- **Today**: due reminders, reviews due, on-this-day.
- **Review**: spaced-repetition session (Got it / Forgot).
- Settings: appearance (theme + accent color), language, timezone, digest time, channels (push, Telegram link), connected devices, export.
- Web Push notifications. Offline capture via IndexedDB outbox + service worker.

### Browser extension (Chrome MV3)
- **Highlight + right-click → "Save to Brain"**: stores the quote, URL, page title, and favicon.
- **Right-click a page → "Save page"** (read-later link). **Right-click an image → "Save image"**.
- **Hotkey quick capture** (`Ctrl/Cmd+Shift+K`): small popup with smart-capture parsing and an optional "attach this page" toggle.
- **Screenshot** of the visible area (`captureVisibleTab`), optionally cropped.
- Desktop notifications for reminders. Offline outbox in `chrome.storage.local`.
- Sign-in hand-off from the web app (no separate login form).

### Telegram bot
- Link your account via deep link (`t.me/<bot>?start=<one-time-token>`) from Settings.
- **Capture**: send text, links, voice, or photos to the bot. Each lands in the Inbox (voice → transcribed, photo → OCR).
- **Delivery**: reminders and the daily digest, with inline buttons (✅ Done · ⏰ Snooze 1h / Tomorrow · 🗂 Archive).

### Mobile app (Vue + Ionic + Capacitor; iOS + Android)
- Opens straight into **capture** (type / voice / camera), with Inbox and Today one tap away.
- **Share sheet**: share links, text, and images from any app into the Inbox.
- Push notifications (FCM/APNs) with actions. Local cache for offline viewing and an outbox for offline capture.
- **Location reminders** ("when I get home") via native geofencing (Phase 6).

## 5. Reminders & resurfacing

| Mechanism | Rule | Channels |
|---|---|---|
| Time reminder | Fires at `fireAt` (user timezone) | Push (web/ext/mobile) + Telegram |
| Recurring | RRULE (`every Monday`, `monthly on 1st`); the next occurrence is computed after each fire | same |
| Location | Device geofence enter/exit; fired **locally on device** | Mobile local notification |
| Snooze | 10m / 1h / tonight / tomorrow / custom | from any notification |
| Daily digest | At the user's chosen time: due today, inbox count + top 3, reviews due, 1–3 random kept notes, on-this-day | Push + Telegram |
| Spaced repetition | Steps: 1d → 3d → 7d → 14d → 30d → 90d → 180d. "Forgot" resets to 1d. | Digest + Review screen |
| On this day | Items captured 1 week / 1 month / 1 year ago | Digest + Today |

Users choose channels per type in Settings (e.g. reminders → push + Telegram, digest → Telegram only).

## 6. Roadmap

Each phase ends with something usable every day. Checked items are done (with the commit that did them); ✅ = phase complete, 🚧 = in progress.

### Phase 0: Foundations ✅
- [x] Bun workspace monorepo, TypeScript strict, ESLint + Prettier, Vitest, GitHub Actions (lint, typecheck, test).
- [x] `docker compose` for dev: Postgres, S3 storage (RustFS), Mailpit.
- [x] `packages/db` (Prisma schema + first migration), `packages/shared` (zod contracts, i18n).
- [x] Auth: Better Auth with email magic link + Google, a session cookie for web, and bearer tokens for extension/mobile.
- [x] **Done when:** I can sign in on the local web app and see an empty Inbox.

### Phase 1: Web MVP (capture, inbox, reminders) 🚧
- [x] Smart-capture parser: `#tags`, `!remember`, links, one-off dates (chrono-node en/ru) and recurring phrases → RRULE, all in the user's time zone. `18f3bdd`
- [x] Items API: create (client UUIDv7, idempotent), get, edit, soft delete, keyset paging, kind counts, tags list. `2ac13e7`
- [x] Search: Postgres FTS prefix match + trigram substring, ranked with a recency boost. `2ac13e7`
- [x] Reminder API: add, move, accept AI suggestion, cancel. "Remember" adds a review. `30ee310`
- [x] Capture box with live reminder/tag chips; Inbox triage cards, remind popover, inline edit/tag, keyboard shortcuts, undo. `30ee310`
- [x] Browser time zone saved to the profile on first sign-in. `30ee310`
- [x] Library page (all items, filter by status/tag/kind, search) and tags in the sidebar. `c9a3000`
- [x] Attachments: pasted/dropped images, presigned upload to S3 storage, image cards. `d2d2461`
- [x] Worker (`apps/worker`) with pg-boss and the minute reminder scanner (one-off + recurring). `dfc567c`
- [x] Web Push delivery (VAPID), notification actions, snooze. `91a7af3` (server path tested with a fake push service; first real notification in a browser still to confirm)
- [x] Today view: missed, later today and next 7 days, with done and snooze (reviews and on-this-day come in Phase 4). `aa66c9b`
- [x] AI enrichment job: title, tags, reminder-intent fallback, OCR for images (Claude Haiku 5.5, per-user monthly token budget). `8265a69`
- [x] PWA + IndexedDB outbox (offline capture): manifest + icons, offline app shell, outbox in `packages/api-client` (text and images), inbox readable offline. `2aefed2`
- [x] Settings page: appearance, language, time zone, notifications on this device. `9d965f9`
- [x] Deploy setup: app image, `compose.prod.yml` (Caddy TLS, migrate, web, worker, Postgres, RustFS), nightly backup with retention + off-site mirror, GHCR build + SSH rollout workflow, runbook in [DEPLOY.md](./DEPLOY.md). `35a219a`
- [x] First deploy to the VPS: done by hand by the owner, following [DEPLOY.md](./DEPLOY.md).
- [x] **Match the web mockups** ([mockups](https://claude.ai/artifact/Q8emX9hqdvXmZaHrf8TFHL); they are the spec for layout):
  - [x] Inbox: right column with "Up next today", "Remember" (reviews due + Start review) and "On this day". `1b6c675`
  - [x] Inbox: image cards with the thumbnail beside the text, not above it. `1b6c675`
  - [x] Sidebar: counts on Today and Review; Review enabled. `1b6c675`
  - [x] Today: panels Reminders (today's list with done rows struck through, the next one highlighted with "in 25 min", Snooze and Done), On this day, Inbox summary ("7 waiting", oldest age, Go to Inbox). `1b6c675` Decision 2026-11-15: no Review panel on Today; reviewing lives only in the Review tab (sidebar badge shows cards due).
  - [x] Review page (sidebar link) with the same review card. `1b6c675`
  - [x] Settings: own layout with "Back to Inbox" and section tabs: Account, Appearance, Language & region, Reminders & digest, Notifications, Telegram, Devices, Export & data. `114d802`
  - [x] Settings › Appearance: live preview column; "More" with Show keyboard hints and Compact cards. `114d802`
  - [x] Sections whose features come in later phases (Telegram: Phase 3, Export: Phase 7, voice button: Phase 3) keep their place with a "coming in phase N" state. `114d802`
- [ ] **Done when:** I use it daily on my computer for a week.

### Phase 2: Browser extension ✅
- [x] Sign-in hand-off: `/auth/extension` in the web app issues a per-device bearer session and sends it to an allow-listed extension id (no login form in the extension); it shows up in Settings › Devices. `22f2d04`
- [x] `apps/extension`: WXT + Vue 3, MV3, stable dev id, theme and accent from the profile. `ef8817f`
- [x] Quick capture popup (`Ctrl/Cmd+Shift+K`) as in the [mockup](https://claude.ai/artifact/Q8emX9hqdvXmZaHrf8TFHL): smart-capture chips, "Attach this page", screenshot button, Save ⏎. `ef8817f`
- [x] Context menus: Save highlight, Save page, Save image, Screenshot to Brain (quote, URL, page title, favicon). Images a site won't let us download are saved as a link. `ef8817f`
- [x] In-page "Saved to Inbox" toast with Add note and Undo. `ef8817f`
- [x] Offline outbox in the extension service worker (IndexedDB, retried on an alarm). `ef8817f`
- [x] Reminder notifications in the extension (Web Push to its service worker, Done / Snooze buttons). `ef8817f` (subscription registers; first real reminder in the extension still to confirm)
- [x] CI builds and zips the extension (artifact on each run; install steps in [DEPLOY.md](./DEPLOY.md) §6). `ef8817f`
- [x] **Done when:** saving a highlight takes one right-click and shows up in the web Inbox. Tested by the owner 2026-11-16.

### Phase 3: Telegram bot + voice ⏸
Postponed by the owner on 2026-11-16; Phases 4 and 5 go first.
Spec: the "Telegram bot" artboard and the voice card + mic button in "Main" ([mockups](https://claude.ai/artifact/Q8emX9hqdvXmZaHrf8TFHL)). The morning digest in the bot artboard is Phase 4.
- [ ] Bot plumbing: grammY bot in `apps/web`, webhook `POST /api/v1/telegram/webhook` (secret-token header), long polling in dev, Telegram sender in `packages/notify`.
- [ ] Account linking: one-time token (10 min) → `t.me/<bot>?start=<token>` → `Channel(kind=TELEGRAM)`. Settings › Telegram: Connect, connected chat, Disconnect, send a test message.
- [ ] Capture text and links from the bot: smart-capture parsing, reply "Saved to Inbox" with reminder/tag chips and Edit / Undo buttons.
- [ ] Capture photos from the bot: image attachment → existing OCR enrichment.
- [ ] Voice pipeline: speech-to-text adapter in `packages/ai`, `ai.transcribe` job (audio → transcript as body → reminders parsed → `ai.enrich`). Voice messages from the bot land as VOICE items.
- [ ] Voice card in the web Inbox/Library: play button, waveform, duration, transcript, "Transcribed · Telegram".
- [ ] Web voice recorder in the capture box (mic button; works offline through the outbox).
- [ ] Reminder delivery to Telegram with Done / +1 hour / Tomorrow buttons; Delivery records like Web Push.
- [ ] Deploy: env vars, webhook registered on rollout, [DEPLOY.md](./DEPLOY.md) steps (BotFather, STT key).
- [ ] **Done when:** I can forward a voice message to the bot from my phone and get reminded later.

### Phase 4: Resurfacing ✅
Telegram is postponed (Phase 3), so the digest goes out as a push notification for now; Telegram delivery is added with Phase 3.
- [x] Spaced repetition: "Remember" action, review steps, Review page and sidebar count. `30ee310` `1b6c675`
- [x] On this day on the Inbox side column and the Today view. `1b6c675`
- [x] Digest scanner in the worker: every minute, users whose local time has passed their digest time and who haven't had today's digest get one job (claimed via `lastDigestOn`, so it's sent once a day). `b3e2175`
- [x] Digest content: today's reminders, inbox count + oldest age, reviews due, one random kept note ("Remember this?"), on this day. Skipped when there is nothing to say. `b3e2175`
- [x] Digest delivery to Web Push and extension push: one notification that opens Today, with Got it / Forgot buttons for the review card it shows; Delivery records with type DIGEST. `b3e2175`
- [x] Settings › Reminders & digest: drop the "phase 4" note, add "Send a test digest now". `b3e2175`
- [x] **Done when:** the morning digest arrives every day and I review old notes from it. Closed by the owner 2026-11-16.

### Phase 5: Mobile app 🚧
Started 2026-11-16, ahead of Phase 3. Spec: the "Mobile · Capture" and "Mobile · Inbox swipe triage" artboards (light + dark) and the new mobile artboards below ([mockups](https://claude.ai/artifact/Q8emX9hqdvXmZaHrf8TFHL)).
- [ ] Mockups for the mobile screens that had no artboard: Inbox list view, Hold for more, Remind sheet, Today, Review, Library, Settings, Sign in, Share sheet. Approved by the owner before building.
- [ ] `packages/app-layer`: Nuxt layer with the composables both apps need (items API, outbox, profile, appearance, format, item actions), moved out of `apps/web`; web keeps working.
- [ ] `apps/mobile`: Nuxt 4 SPA + `@nuxtjs/ionic` + Capacitor, iOS and Android projects, app id, icons + splash, theme and accent from the profile.
- [ ] Sign in: Sign in screen → in-app browser → `/auth/mobile` issues a per-device bearer session → deep link `onemorebrain://auth?token=…` → secure storage. Shows up in Settings › Devices.
- [ ] Capture tab: capture box with live chips, Save to Inbox, Photo (camera / gallery), Paste link, "Just captured" with the sync state. "Hold to talk" keeps its place with a "Phase 3" state; the location chip comes in Phase 6.
- [ ] Inbox tab: swipe card stack (right = keep, left = archive, hold = more), Archive / Remind / Remember / Keep row, "3 of 7" progress, List view, Remind sheet, Hold for more actions.
- [ ] Today tab and Review screen.
- [ ] Library tab: search, status / kind filters, tags.
- [ ] Settings screen (opened from the gear on Capture).
- [ ] Offline: local cache for Inbox, Today and Library, outbox through `packages/api-client`, sync on resume and when the network comes back.
- [ ] Push: FCM sender in `packages/notify` (Android, and iOS through APNs), reminders and the digest with Done / Snooze / Got it / Forgot actions, Delivery records.
- [ ] Share sheet: Android intent filter (text, links, images) first, then the iOS Share Extension (native target, App Group hand-off).
- [ ] CI builds an Android debug APK; install steps in [DEPLOY.md](./DEPLOY.md).
- [ ] **Done when:** shipped to my own phone (TestFlight / internal track) and used daily.

### Phase 6: Location reminders
- Small custom Capacitor plugin: iOS `CLLocationManager` region monitoring, Android `GeofencingClient`.
- Saved places ("Home", "Office", "Store"), with reminders attached to a place and enter/exit triggers.
- Respect OS limits (iOS: 20 regions per app, Android: 100), so the app registers only the nearest/active ones.
- **Done when:** "buy milk when I'm at the store" fires on arrival.

### Phase 7: Public readiness
- Onboarding, empty states, landing page.
- Export (JSON + Markdown zip), import, account deletion (GDPR).
- Rate limits, per-user AI quotas, abuse protection, Sentry + uptime monitoring.
- Privacy policy (including AI-provider data handling), Terms. Billing (Stripe) if needed.
- Chrome Web Store, App Store, and Play Store listings.

### Later / ideas backlog
- Semantic search + "ask your brain" (pgvector embeddings).
- Website-aware context: show related notes when revisiting a site, and persistent on-page highlights.
- Home-screen widgets, Siri / App Intents, Android quick-settings tile.
- Firefox / Safari extensions. Email-in capture (`me@in.onemorebrain…`).
- End-to-end encryption mode (conflicts with server-side AI, so it would be opt-in per item).

## 7. Risks & open questions

| Risk / question | Mitigation |
|---|---|
| **Nuxt does not fit MV3 extensions well** (multiple entrypoints, strict CSP, no SSR) | Use **WXT + Vue 3** (Nuxt-like DX: file-based entrypoints, auto-imports) and share `packages/shared` + `api-client`. **Confirm.** |
| iOS Share Extension and geofencing need native code | Keep it small and isolated. Android first, then iOS. Budget time for it. |
| Location reminders drain battery / need "Always" permission | Region monitoring only (no continuous GPS), explained in a pre-permission screen |
| AI cost / latency | Deterministic parsing first, Haiku-class model, async jobs, per-user monthly quota |
| AI suggestions might be wrong | Never apply silently: AI tags are dimmed until kept, AI reminders appear as an accept chip |
| Offline sync conflicts | Client-generated ids + append-mostly data. Last-write-wins on edits (single-user scale). |
| Notifications not delivered (iOS web push, Doze) | Multiple channels. Telegram is a reliable fallback. Delivery log + retries. |
| Data loss on a single VPS | Nightly `pg_dump` + object-storage sync to off-site object storage, with a monthly restore test |
| Apple Developer account ($99/yr) needed for iOS push & TestFlight | Required before Phase 5 iOS work |
