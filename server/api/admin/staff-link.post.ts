import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody, setHeader } from 'h3'
import { z } from 'zod'
import { requireSalonRole } from '../../utils/admin-guard'
import { auditLogs, staff } from '../../db/schema'

// Liaison « C'est moi » : rattache le compte connecté (gérante ou réception)
// à UNE fiche praticienne du salon. Effets : la personne devient réservable
// sous sa fiche (déjà le cas pour toute fiche active) et retrouve son agenda
// personnel dans l'espace /staff. Réversible par déliaison.
const bodySchema = z.object({ action: z.enum(['link', 'unlink']), staffId: z.string().uuid().optional() }).strict()

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  const { db, salonId, user, role } = await requireSalonRole(event, ['owner', 'reception'])
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Requête de liaison invalide.', data: parsed.error.flatten() })
  const { action, staffId } = parsed.data
  const now = new Date()

  if (action === 'link') {
    if (!staffId) throw createError({ statusCode: 422, statusMessage: 'Choisissez la fiche praticienne à lier à votre compte.' })
    const [mine] = await db.select({ id: staff.id }).from(staff).where(and(eq(staff.salonId, salonId), eq(staff.userId, user.id))).limit(1)
    if (mine) {
      if (mine.id === staffId) return { ok: true, guidance: 'Votre compte est déjà lié à cette fiche.' }
      throw createError({ statusCode: 409, statusMessage: 'Votre compte est déjà lié à une autre fiche. Déliez-la d’abord.' })
    }
    const [profile] = await db.select({ id: staff.id, userId: staff.userId }).from(staff).where(and(eq(staff.id, staffId), eq(staff.salonId, salonId))).limit(1)
    if (!profile) throw createError({ statusCode: 404, statusMessage: 'Fiche praticienne introuvable dans ce salon.' })
    if (profile.userId) throw createError({ statusCode: 409, statusMessage: 'Cette fiche est déjà liée à un autre compte de connexion.' })
    await db.update(staff).set({ userId: user.id, updatedAt: now }).where(eq(staff.id, profile.id))
    await db.insert(auditLogs).values({ salonId, userId: user.id, action: 'staff_profile_link', entity: 'staff', entityId: profile.id, metadata: { actorRole: role } })
    return { ok: true, guidance: 'Fiche liée à votre compte : votre agenda personnel est disponible sur /staff et la fiche reste réservable par les clientes.' }
  }

  // unlink : délier MA fiche (le staffId fourni est ignoré pour éviter les
  // déliaisons croisées entre comptes).
  const [mine] = await db.select({ id: staff.id }).from(staff).where(and(eq(staff.salonId, salonId), eq(staff.userId, user.id))).limit(1)
  if (!mine) throw createError({ statusCode: 404, statusMessage: 'Votre compte n’est lié à aucune fiche praticienne.' })
  await db.update(staff).set({ userId: null, updatedAt: now }).where(eq(staff.id, mine.id))
  await db.insert(auditLogs).values({ salonId, userId: user.id, action: 'staff_profile_unlink', entity: 'staff', entityId: mine.id, metadata: { actorRole: role } })
  return { ok: true, guidance: 'Fiche déliée. Elle reste réservable par les clientes ; seule la connexion à l’agenda personnel /staff est retirée.' }
})
