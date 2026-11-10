import { asc } from 'drizzle-orm'
import { defineEventHandler, setHeader } from 'h3'
import { requireDevUser } from '../../utils/dev-guard'
import { salons } from '../../db/schema'

// Liste des salons de la plateforme — réservée au rôle développeur. Alimente
// le sélecteur « Salon actif » du panneau et la carte « Salons & succursales ».
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  const { db } = await requireDevUser(event)
  const items = await db.select({ id: salons.id, name: salons.name, slug: salons.slug, city: salons.city, status: salons.status, createdAt: salons.createdAt }).from(salons).orderBy(asc(salons.createdAt))
  return { items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })) }
})
