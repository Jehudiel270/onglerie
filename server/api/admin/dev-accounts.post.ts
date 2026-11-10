import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody, setHeader } from 'h3'
import { z } from 'zod'
import { requireDevUser } from '../../utils/dev-guard'
import { auditLogs, salonMemberships, salons, staff, users } from '../../db/schema'

// Panneau développement : gestion complète des comptes. Actions :
// - create         : créer un accès (owner unique par salon, reception±fiche,
//                    staff toujours rattaché à une fiche employée) ;
// - reset_password : changer le mot de passe d'un compte et fermer ses sessions ;
// - change_role    : changer le rôle salon d'une adhésion (garde une-owner) ;
// - set_active     : activer/désactiver une adhésion.
// Aucune action ne crée ni ne modifie un rôle plateforme « dev » : ce niveau
// reste réservé au script serveur bootstrap-dev.ts.
const bodySchema = z.object({
  action: z.enum(['create', 'reset_password', 'change_role', 'set_active']),
  userId: z.string().uuid().optional(),
  salonId: z.string().uuid().optional(),
  email: z.string().trim().toLowerCase().email().max(254).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  password: z.string().min(8).max(72).optional(),
  role: z.enum(['owner', 'reception', 'staff']).optional(),
  staffId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
}).strict()

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  const { db, user, salonId: defaultSalonId } = await requireDevUser(event)
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Requête de gestion des comptes invalide.', data: parsed.error.flatten() })
  const body = parsed.data

  // Aide : le compte cible existe et n'est pas un compte développeur.
  async function loadTargetAccount(): Promise<{ id: string; email: string; platformRole: string }> {
    if (!body.userId) throw createError({ statusCode: 422, statusMessage: 'Compte cible manquant.' })
    const [target] = await db.select({ id: users.id, email: users.email, platformRole: users.role }).from(users).where(eq(users.id, body.userId)).limit(1)
    if (!target) throw createError({ statusCode: 404, statusMessage: 'Compte introuvable.' })
    if (target.platformRole === 'dev') throw createError({ statusCode: 403, statusMessage: 'Un compte développeur n’appartient pas à une équipe salon ; cette action ne s’y applique pas.' })
    return target
  }

  // Garde « une seule gérante » : au plus une adhésion owner active par salon.
  async function assertSingleOwner(salon: string, exceptUserId?: string) {
    const owners = await db.select({ userId: salonMemberships.userId }).from(salonMemberships).where(and(eq(salonMemberships.salonId, salon), eq(salonMemberships.role, 'owner'), eq(salonMemberships.active, true)))
    const others = owners.filter((row) => row.userId !== exceptUserId)
    if (others.length > 0) throw createError({ statusCode: 409, statusMessage: 'Ce salon a déjà une gérante active. Réinitialisez son mot de passe ou désactivez son accès d’abord.' })
  }

  if (body.action === 'create') {
    if (!body.email || !body.password || !body.name || !body.role) throw createError({ statusCode: 422, statusMessage: 'Nom, e-mail, mot de passe et rôle sont requis pour créer un accès.' })
    const salon = body.salonId || defaultSalonId
    if (body.role === 'owner') await assertSingleOwner(salon)
    if (body.role === 'staff' && !body.staffId) throw createError({ statusCode: 422, statusMessage: 'Un accès employée doit être rattaché à une fiche praticienne.' })

    const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1)
    if (existingUser) throw createError({ statusCode: 409, statusMessage: 'Un compte existe déjà avec cet e-mail.' })

    let profile: { id: string; userId: string | null } | null = null
    if (body.staffId) {
      const [row] = await db.select({ id: staff.id, userId: staff.userId }).from(staff).where(and(eq(staff.id, body.staffId), eq(staff.salonId, salon))).limit(1)
      if (!row) throw createError({ statusCode: 404, statusMessage: 'Fiche praticienne introuvable dans ce salon.' })
      if (row.userId) throw createError({ statusCode: 409, statusMessage: 'Cette fiche est déjà liée à un compte.' })
      profile = row
    }

    const auth = serverAuth(event)
    const created = await auth.api.signUpEmail({ body: { name: body.name.trim(), email: body.email, password: body.password } })
    if (!created?.user?.id) throw createError({ statusCode: 500, statusMessage: 'La création du compte a échoué.' })

    const now = new Date()
    await db.update(users).set({ role: body.role, updatedAt: now }).where(eq(users.id, created.user.id))
    await db.insert(salonMemberships).values({ salonId: salon, userId: created.user.id, role: body.role, active: true })
    if (profile) await db.update(staff).set({ userId: created.user.id, updatedAt: now }).where(eq(staff.id, profile.id))
    await db.insert(auditLogs).values({ salonId: salon, userId: user.id, action: 'dev_account_create', entity: 'user', entityId: created.user.id, metadata: { role: body.role, staffId: profile?.id ?? null } })
    return { ok: true, item: { userId: created.user.id, email: body.email, role: body.role, salonId: salon, staffId: profile?.id ?? null }, guidance: 'Communiquez le mot de passe initial par un canal privé.' }
  }

  if (body.action === 'reset_password') {
    const target = await loadTargetAccount()
    if (!body.password) throw createError({ statusCode: 422, statusMessage: 'Nouveau mot de passe manquant.' })
    const auth = serverAuth(event)
    const context = await auth.$context
    const hashed = await context.password.hash(body.password)
    const existing = await context.internalAdapter.findCredentialAccount(target.id)
    if (existing) {
      await context.internalAdapter.updatePassword(target.id, hashed)
    } else {
      await context.internalAdapter.createAccount({ userId: target.id, providerId: 'credential', accountId: target.id, password: hashed })
    }
    await context.internalAdapter.deleteUserSessions(target.id)
    await db.insert(auditLogs).values({ salonId: null, userId: user.id, action: 'dev_password_reset', entity: 'user', entityId: target.id })
    return { ok: true, guidance: 'Mot de passe réinitialisé ; toutes les sessions ouvertes de ce compte ont été fermées.' }
  }

  if (body.action === 'change_role') {
    const target = await loadTargetAccount()
    if (!body.role) throw createError({ statusCode: 422, statusMessage: 'Nouveau rôle manquant.' })
    const salon = body.salonId || defaultSalonId
    const [membership] = await db.select().from(salonMemberships).where(and(eq(salonMemberships.userId, target.id), eq(salonMemberships.salonId, salon))).limit(1)
    if (!membership) throw createError({ statusCode: 404, statusMessage: 'Ce compte n’a pas d’adhésion dans ce salon.' })
    if (body.role === 'owner' && (membership.role !== 'owner' || !membership.active)) await assertSingleOwner(salon, target.id)
    const now = new Date()
    await db.update(salonMemberships).set({ role: body.role, updatedAt: now }).where(eq(salonMemberships.id, membership.id))
    await db.update(users).set({ role: body.role, updatedAt: now }).where(eq(users.id, target.id))
    await db.insert(auditLogs).values({ salonId: salon, userId: user.id, action: 'dev_role_change', entity: 'user', entityId: target.id, metadata: { from: membership.role, to: body.role } })
    return { ok: true, guidance: `Rôle mis à jour : ${body.role}.` }
  }

  // set_active
  const target = await loadTargetAccount()
  if (typeof body.active !== 'boolean') throw createError({ statusCode: 422, statusMessage: 'Statut cible manquant (activer ou désactiver).' })
  const salon = body.salonId || defaultSalonId
  const [membership] = await db.select().from(salonMemberships).where(and(eq(salonMemberships.userId, target.id), eq(salonMemberships.salonId, salon))).limit(1)
  if (!membership) throw createError({ statusCode: 404, statusMessage: 'Ce compte n’a pas d’adhésion dans ce salon.' })
  const now = new Date()
  await db.update(salonMemberships).set({ active: body.active, updatedAt: now }).where(eq(salonMemberships.id, membership.id))
  await db.insert(auditLogs).values({ salonId: salon, userId: user.id, action: body.active ? 'dev_access_enable' : 'dev_access_disable', entity: 'user', entityId: target.id })
  return { ok: true, guidance: body.active ? 'Accès réactivé.' : 'Accès désactivé ; la fiche et l’historique des rendez-vous sont conservés.' }
})
