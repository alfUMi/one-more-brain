# One More Brain

A second brain you dump things into and that brings them back to you: capture-first inbox, reminders, and resurfacing.
Web app, browser extension, Telegram bot and mobile app.

- Product plan: [docs/PLAN.md](docs/PLAN.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Data model: [docs/DATA-MODEL.md](docs/DATA-MODEL.md)

## Development

Requirements: [Bun](https://bun.sh) 1.4+, Docker.

```sh
cp .env.example .env        # then set BETTER_AUTH_SECRET (e.g. `openssl rand -hex 32`)
bun install                 # also generates the Prisma client
bun run db:up               # Postgres, S3 storage (RustFS) and Mailpit
bun run db:migrate          # apply migrations
bun run dev                 # http://localhost:3000
```

Sign in with any email: the magic link lands in Mailpit at http://localhost:58025.

| Service            | URL                                           |
| ------------------ | --------------------------------------------- |
| Web app            | http://localhost:3000                         |
| Postgres           | `localhost:55432` (user/password/db: `omb`)   |
| Mailpit            | http://localhost:58025                        |
| S3 storage console | http://localhost:59001 (`omb` / `omb-secret`) |

Host ports are in the 5xxxx range so they don't clash with other local projects.

## Scripts

| Command                           | What it does                  |
| --------------------------------- | ----------------------------- |
| `bun run lint` / `lint:fix`       | ESLint                        |
| `bun run format` / `format:check` | Prettier                      |
| `bun run typecheck`               | TypeScript in every workspace |
| `bun run test`                    | Vitest                        |
| `bun run db:studio`               | Prisma Studio                 |

## Layout

```
apps/web          Nuxt 4 full-stack app: UI + /api (Better Auth, REST)
packages/db       Prisma schema, migrations and client
packages/shared   zod contracts, enums, i18n (en, ru), spaced-repetition logic
docker/           compose files
```
