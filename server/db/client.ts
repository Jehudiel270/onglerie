import { Pool } from '@neondatabase/serverless'
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless'
import { createError } from 'h3'
import { env } from 'node:process'
import { schema } from './schema'

export type Database = NeonDatabase<typeof schema>
let pool: Pool | undefined
let database: Database | undefined

export function hasNeonDatabase(): boolean {
  return Boolean(env.NEON_DATABASE_URL)
}

export function getDatabase(): Database {
  if (!env.NEON_DATABASE_URL) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Base Neon non configurée',
      data: { code: 'DATABASE_NOT_CONFIGURED' },
    })
  }
  if (!pool) {
    pool = new Pool({ connectionString: env.NEON_DATABASE_URL, max: 5 })
  }
  if (!database) database = drizzle({ client: pool, schema })
  return database
}

export async function closeDatabasePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = undefined
    database = undefined
  }
}
