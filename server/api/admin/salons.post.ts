import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody, setHeader } from 'h3'
import { z } from 'zod'
import { requireSalonRole } from '../../utils/admin-guard'
import { auditLogs, salonMemberships, salons } from '../../db/schema'

// Création d'une succursale. C'est le propriétaire qui décide : la personne
// titulaire du salon crée elle-même ses succursales (et reçoit automatiquement
// l'adhésion « owner » sur la nouvelle entité). Le rôle développeur garde cet
// outil uniquement comme filet de dépannage. La succursale naît au statut
// « setup » ; elle passe « active » quand ses coordonnées et son équipe sont
// prêtes.
const bodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().max(120).optional().or(z.literal('')),
  description: z.string().trim().max(500).optional().or(z.literal('')),
}).strict()

const makeSlug = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 95) || 'salon'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  const { db, user, role } = await requireSalonRole(event, ['owner'])
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Vérifiez le nom de la succursale (2 à 120 caractères).', data: parsed.error.flatten() })
  const slug = makeSlug(parsed.data.name)
  const [conflict] = await db.select({ id: salons.id }).from(salons).where(eq(salons.slug, slug)).limit(1)
  if (conflict) throw createError({ statusCode: 409, statusMessage: 'Un salon utilise déjà ce nom (slug identique). Choisissez un nom distinct.' })

  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(salons).values({
      name: parsed.data.name, slug,
      city: parsed.data.city || null, description: parsed.data.description || null,
    }).returning()
    if (!row) throw createError({ statusCode: 500, statusMessage: 'La succursale n’a pas été enregistrée.' })
    // Le propriétaire titulaire contrôle directement sa succursale : adhésion
    // owner active dès la création. Le développeur, lui, ne reçoit jamais
    // d'adhésion (son rôle plateforme couvre déjà tous les salons).
    if (role === 'owner') {
      await tx.insert(salonMemberships).values({ salonId: row.id, userId: user.id, role: 'owner', active: true })
    }
    return row
  })
  await db.insert(auditLogs).values({ salonId: created.id, userId: user.id, action: 'salon_create', entity: 'salon', entityId: created.id, metadata: { name: created.name, slug: created.slug, creatorRole: role } })
  return {
    item: { id: created.id, name: created.name, slug: created.slug, city: created.city, status: created.status },
    guidance: 'Succursale créée. Sélectionnez-la via « Salon actif » en haut du panneau pour compléter ses coordonnées, ses prestations et ses horaires, puis créez les accès de son équipe.',
  }
})
