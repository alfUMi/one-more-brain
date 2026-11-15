# One image for every server process: web (Nuxt/Nitro), worker (pg-boss) and migrations (Prisma).
# docker build -f docker/app.Dockerfile -t omb-app .
FROM oven/bun:1.4.4 AS build
WORKDIR /app

# Prisma only needs a syntactically valid URL to generate the client; nothing connects at build time.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build

# Manifests first so dependency installs are cached between code changes.
COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/ai/package.json packages/ai/
COPY packages/api-client/package.json packages/api-client/
COPY packages/db/package.json packages/db/prisma.config.ts packages/db/
COPY packages/db/prisma packages/db/prisma
COPY packages/notify/package.json packages/notify/
COPY packages/shared/package.json packages/shared/
COPY packages/storage/package.json packages/storage/
RUN bun install --frozen-lockfile --ignore-scripts

COPY . .
RUN bun run db:generate && bun run --cwd apps/web postinstall && bun run build

FROM oven/bun:1.4.4-slim
WORKDIR /app
ENV NODE_ENV=production
# Owned by the runtime user: some sources may arrive without group/other read bits.
COPY --from=build --chown=bun:bun /app /app
USER bun
EXPOSE 3000
# The web server by default; compose overrides the command for the worker and migrations.
CMD ["bun", "apps/web/.output/server/index.mjs"]
