import { config } from 'dotenv'
import { defineConfig, env } from 'prisma/config'

// One .env at the repo root serves every app and package.
config({ path: new URL('../../.env', import.meta.url).pathname, quiet: true })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
})
