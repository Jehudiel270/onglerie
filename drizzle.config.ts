import { defineConfig } from 'drizzle-kit'
import { env } from 'node:process'

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Empty is intentional for offline `drizzle-kit generate`; migration commands validate their own URL first.
    url: env.NEON_DATABASE_URL_UNPOOLED || env.NEON_DATABASE_URL || '',
  },
  strict: true,
  verbose: true,
})
