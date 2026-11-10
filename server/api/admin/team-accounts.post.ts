import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody, setHeader } from 'h3'
import { z } from 'zod'
import { requireSalonRole } from '../../utils/admin-guard'
import { auditLogs, salonMemberships, staff, users } from '../../db/schema'

// Création d'un accès équipe par le propriétaire : compte de connexion
// (Better Auth) + adhésion salon au rôle choisi + rattachement à la fiche
// employée existante. Le mot de passe initial est défini ici ; l'employée
// pourra le modifier via /api/auth/change-password après sa première connexion.
const bodySchema = z.object({
  staffId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(72),
  role: z.enum(['staff', 'reception']),
}).strict()

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  const { db, salonId, user } = await requireSalonRole(event, ['owner'])
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Formulaire d’accès équipe invalide.', data: parsed.error.flatten() })
  const { staffId, email, password, role } = parsed.data

  const [profile] = await db.select().from(staff).where(and(eq(staff.id, staffId), eq(staff.salonId, salonId))).limit(1)
  if (!profile) throw createError({ statusCode: 404, statusMessage: 'Fiche employée introuvable.' })
  if (profile.userId) throw createError({ statusCode: 409, statusMessage: 'Cette fiche employée possède déjà un accès. Désactivez-le d’abord si nécessaire.' })

  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existingUser) throw createError({ statusCode: 409, statusMessage: 'Un compte existe déjà avec cet e-mail ; utilisez-le ou choisissez une autre adresse.' })

  const fallbackName = email.split('@')[0] ?? 'equipe'
  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || fallbackName
  const created = await serverAuth(event).api.signUpEmail({ body: { name: displayName, email, password } })
  if (!created?.user?.id) throw createError({ statusCode: 500, statusMessage: 'La création du compte a échoué.' })

  const now = new Date()
  await db.update(users).set({ role, updatedAt: now }).where(eq(users.id, created.user.id))
  await db.update(staff).set({ userId: created.user.id, updatedAt: now }).where(eq(staff.id, profile.id))
  await db.insert(salonMemberships).values({ salonId, userId: created.user.id, role, active: true })
  await db.insert(auditLogs).values({ salonId, userId: user.id, action: 'team_account_create', entity: 'user', entityId: created.user.id })

  return { item: { staffId: profile.id, userId: created.user.id, email, role }, guidance: 'Communiquez le mot de passe initial par un canal privé, puis demandez à l’employée de le modifier.' }
})
