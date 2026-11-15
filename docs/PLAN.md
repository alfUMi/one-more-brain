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
| Stack | Bun monorepo · Nuxt full-stack web · Nuxt + Ionic + Capacitor mobile · Chrome MV3 extension (Vue) |
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

### Mobile app (Nuxt + Ionic + Capacitor; iOS + Android)
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
- [ ] First deploy to the VPS: server, DNS, `.env`, GitHub deploy variables and secrets (needs the server details).
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

### Phase 2: Browser extension
- WXT + Vue, MV3. Context menus (selection / page / image), hotkey popup, screenshot.
- Auth hand-off from the web app, outbox, push notifications in the extension service worker.
- **Done when:** saving a highlight takes one right-click and shows up in the web Inbox.

### Phase 3: Telegram bot + voice
- grammY webhook on the Nuxt server. Account linking, capture of text/link/voice/photo.
- Voice pipeline: upload audio → speech-to-text → transcript as item body → AI enrichment.
- Web voice recorder in the capture box.
- Reminder + digest delivery to Telegram with inline action buttons.
- **Done when:** I can forward a voice message to the bot from my phone and get reminded later.

### Phase 4: Resurfacing
- Daily digest (per-user time + timezone) across all channels.
- Spaced repetition: "Remember" action, Review screen, review prompts in the digest.
- On-this-day on the Today view and in the digest.
- **Done when:** the morning digest arrives every day and I review old notes from it.

### Phase 5: Mobile app
- Nuxt SPA + `@nuxtjs/ionic` + Capacitor, sharing the `app-layer` (stores, API client, i18n) with web.
- Capture-first home, Inbox swipe triage, Today, Review, Library (cached).
- Local SQLite/Preferences cache + outbox, background sync on resume and on network change.
- FCM/APNs push with action buttons.
- Share sheet: Android intent filter first, then the iOS Share Extension (native target).
- **Done when:** shipped to my own phone (TestFlight / internal track) and used daily.

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
