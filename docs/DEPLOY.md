# Deploying One More Brain

Related docs: [ARCHITECTURE.md](./ARCHITECTURE.md) (section 10) · [PLAN.md](./PLAN.md)

One VPS runs everything with Docker Compose: Caddy (TLS), the web app, the worker, Postgres, RustFS
(object storage) and a nightly backup job. The stack lives in `docker/`; CI builds the app image.

```
caddy :443 ── brain.example.com ──────► web:3000      (Nuxt/Nitro)
          └── files.brain.example.com ─► s3:9000       (presigned uploads/downloads)
migrate (one-shot) → web, worker → postgres, s3
backup: 03:00 UTC pg_dump → /backups (14 daily + 8 weekly) → rclone → off-site bucket
```

## 1. One-time server setup

1. A VPS with 2+ GB RAM (4 GB comfortable), Docker Engine and the compose plugin.
2. DNS: `A`/`AAAA` records for `DOMAIN` and `files.DOMAIN` pointing at the server. Open ports 80 and 443.
3. A deploy user that may run Docker, and the stack directory:
   ```sh
   sudo useradd -m -G docker deploy && sudo install -d -o deploy /opt/omb
   ```
4. Copy `docker/.env.prod.example` to `/opt/omb/.env` and fill it in (`chmod 600`). Generate secrets with
   `openssl rand -hex 32`, VAPID keys with the command in the file.
5. If the GitHub package is private, let the server pull it: `docker login ghcr.io` as the deploy user with a
   token that has `read:packages`.

## 2. Wire up GitHub Actions

Repository → Settings:

| Kind | Name | Value |
|---|---|---|
| Variable | `DEPLOY_HOST` | server hostname or IP (setting it turns on automatic rollout) |
| Variable | `DEPLOY_USER` | `deploy` (default) |
| Variable | `DEPLOY_DIR` | `/opt/omb` (default) |
| Variable | `APP_URL` | `https://DOMAIN`, baked into the browser extension build |
| Secret | `DEPLOY_SSH_KEY` | private key whose public half is in `~deploy/.ssh/authorized_keys` |
| Secret | `DEPLOY_KNOWN_HOSTS` | output of `ssh-keyscan -H <host>` |

Every push to `main` that passes CI builds `ghcr.io/<owner>/one-more-brain:<sha>`, copies the stack files to the
server and runs `docker compose up -d`. Migrations run first (`migrate` service); web and worker start only if
they succeed. Run it by hand from the Actions tab ("Deploy" → Run workflow).

## 3. First start (manual alternative)

```sh
cd /opt/omb   # with compose.prod.yml, Caddyfile, backup.Dockerfile, backup.sh and .env
docker compose -f compose.prod.yml up -d
docker compose -f compose.prod.yml logs -f web worker
```

Then open `https://DOMAIN`, sign in with a magic link, and check Settings → Notifications on each device.

## 4. Backups and the monthly restore test

- Nightly at 03:00 UTC: `pg_dump` into the `backups` volume, 14 daily + 8 Sunday dumps kept. With
  `OFFSITE_BUCKET` set, the dumps and the file bucket are mirrored off-site (`rclone sync`).
- Run one now: `docker compose -f compose.prod.yml exec backup backup.sh`
- Restore test (monthly, on a scratch database):
  ```sh
  docker compose -f compose.prod.yml exec postgres createdb -U omb restore_test
  docker compose -f compose.prod.yml exec backup sh -c \
    'pg_restore --no-owner -d "${DATABASE_URL%/omb}/restore_test" /backups/db-$(date -u +%F).dump'
  docker compose -f compose.prod.yml exec postgres psql -U omb -d restore_test -c 'select count(*) from "Item"'
  docker compose -f compose.prod.yml exec postgres dropdb -U omb restore_test
  ```

## 5. Everyday operations

| Task | Command (in `/opt/omb`) |
|---|---|
| Status | `docker compose -f compose.prod.yml ps` |
| Logs | `docker compose -f compose.prod.yml logs -f --tail 100 web worker` |
| Roll back | set `APP_IMAGE=…:<older sha>` in `.env`, then `docker compose -f compose.prod.yml up -d` |
| Postgres shell | `docker compose -f compose.prod.yml exec postgres psql -U omb` |

Rolling back the image does not undo migrations; they are written to be additive.

## 6. Browser extension

CI builds the extension for the domain in the `APP_URL` repository variable (e.g. `https://brain.example.com`)
and attaches `one-more-brain-extension-*.zip` to the run (Actions → CI → Artifacts).

1. Set the `APP_URL` variable, and `NUXT_PUBLIC_EXTENSION_IDS` in the server `.env` (see `.env.prod.example`).
2. Unzip the artifact, open `chrome://extensions`, turn on Developer mode, "Load unpacked" → the folder.
   Builds keep a fixed id (`ealahabaammegndodbgendfkinpnflae`), so the allow-list above matches.
3. Click the toolbar icon → Sign in. The web app asks to connect the extension; after that it saves to your
   account and shows reminders. Disconnect it in Settings → Devices.

Local development: `bun run --cwd apps/extension dev` (talks to `http://localhost:3000`; set `WXT_APP_URL` to
change it).

## 7. Mobile app (Android, iOS)

The app (`apps/mobile`, Ionic + Vue + Capacitor) talks to the server in `VITE_APP_URL`, set at build time.
CI builds an Android debug APK for the `APP_URL` repository variable and attaches
`one-more-brain-android-debug` to the run (Actions → CI → Artifacts).

**Install on an Android phone:** download the artifact, copy `app-debug.apk` to the phone, open it and allow
installs from that source. Open the app → enter your email → open the link from the email **on the phone** →
it comes back to the app signed in (or use Google, if the server has it). The phone shows up in Settings → Devices.

**Push notifications (optional, needs a Firebase project):**
1. Firebase console → add a project → add an Android app with id `app.onemorebrain.mobile` (and an iOS app with
   the same bundle id). Download `google-services.json` / `GoogleService-Info.plist`.
2. Android: store `google-services.json` as the `GOOGLE_SERVICES_JSON` repository secret (CI writes it into the
   build), or put it in `apps/mobile/android/app/` for local builds. iOS: add `GoogleService-Info.plist` to
   `apps/mobile/ios/App/App/` in Xcode, enable the Push Notifications capability, and upload your APNs key in
   Firebase → Project settings → Cloud Messaging.
3. Server: Firebase → Project settings → Service accounts → Generate new private key. Put the JSON (one line or
   base64) in `FIREBASE_SERVICE_ACCOUNT` in the server `.env`, restart `web` and `worker`.
4. In the app: Settings → Notifications → turn on. Reminders and the digest then arrive on the phone; on iOS they
   carry Done / Snooze / Tomorrow and Got it / Forgot buttons.

Without these files the app works normally and Settings → Notifications says push isn't set up.

**iOS / TestFlight:** needs an Apple Developer account. `bun run --cwd apps/mobile ios` builds and opens Xcode;
pick your team under Signing, then Product → Archive → Distribute → TestFlight.

**Local development**
- Browser: `bun run --cwd apps/mobile dev` → http://localhost:5174 (talks to `http://localhost:3000`).
- Android emulator: `adb reverse tcp:3000 tcp:3000`, then
  `VITE_APP_URL=http://localhost:3000 bun run --cwd apps/mobile android` (builds, syncs, opens Android Studio).
- iOS simulator: `VITE_APP_URL=http://localhost:3000 bun run --cwd apps/mobile ios`.
- The share sheet (Android) and sign-in deep link (`onemorebrain://auth?code=…`) only work in the native app.
