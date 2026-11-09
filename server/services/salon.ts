import { asc, eq } from 'drizzle-orm'
import { createError } from 'h3'
import { getDatabase } from '../db/client'
import { salons } from '../db/schema'

export async function findPrimarySalon() {
  const db = getDatabase()
  const [salon] = await db.select().from(salons).where(eq(salons.status, 'active')).orderBy(asc(salons.createdAt)).limit(1)
  return salon ?? null
}

export async function requirePrimarySalon() {
  const salon = await findPrimarySalon()
  if (!salon) {
    throw createError({ statusCode: 503, statusMessage: 'Le salon n’est pas encore configuré.' })
  }
  return salon
}
