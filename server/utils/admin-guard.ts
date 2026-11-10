import { and, asc, eq } from 'drizzle-orm'
import { createError, getCookie, getHeader, getQuery, type H3Event } from 'h3'
import { getDatabase } from '../db/client'
import { salonMemberships, salons } from '../db/schema'
import { type SalonRole } from '../../shared/constants/rbac'
import { assertOtpVerified } from './otp-gate'

export type { SalonRole }

// Résout le salon cible d'un compte développeur : salon demandé via l'en-tête
// x-salon-id, sinon premier salon actif, sinon premier salon tout statut.
export async function resolveDevSalonId(db: ReturnType<typeof getDatabase>, requestedSalonId: string): Promise<string> {
  if (requestedSalonId) {
    const [requested] = await db.select({ id: salons.id }).from(salons).where(eq(salons.id, requestedSalonId)).limit(1)
    if (!requested) throw createError({ statusCode: 404, statusMessage: 'Salon demandé introuvable.' })
    return requested.id
  }
  const [active] = await db.select({ id: salons.id }).from(salons).where(eq(salons.status, 'active')).orderBy(asc(salons.createdAt)).limit(1)
  if (active) return active.id
  const [any] = await db.select({ id: salons.id }).from(salons).orderBy(asc(salons.createdAt)).limit(1)
  if (!any) throw createError({ statusCode: 404, statusMessage: 'Aucun salon enregistré sur la plateforme.' })
  return any.id
}

export async function requireSalonRole(event: H3Event, allowedRoles: SalonRole[] = ['owner', 'reception']) {
  const auth = serverAuth(event)
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Connexion requise.' })
  }

  // Double vérification (code e-mail) obligatoire pour les accès de gestion :
  // sans elle, aucune API de gestion ne répond (403 OTP_REQUIRED).
  await assertOtpVerified(event, session)

  // Salon demandé : en-tête x-salon-id, paramètre salonId, ou cookie de
  // sélection « Salon actif » (poseur par le sélecteur du panneau, dev comme
  // propriétaire multi-salons).
  const requestedSalonId = getHeader(event, 'x-salon-id') || String(getQuery(event).salonId || '') || getCookie(event, 'salon_actif') || ''
  const db = getDatabase()

  // Rôle plateforme « dev » : identifié au niveau du compte utilisateur
  // (user.role = 'dev') et non par une adhésion salon. Le développeur
  // contourne les adhésions et agit sur le salon demandé ou sur le premier
  // salon actif de la plateforme.
  if ((session.user as { role?: string }).role === 'dev') {
    const salonId = await resolveDevSalonId(db, requestedSalonId)
    return { db, user: session.user, salonId, role: 'dev' as SalonRole }
  }

  // Adhésions actives du compte, du plus ancien au plus récent : une
  // propriétaire qui crée des succursales en possède plusieurs et choisit le
  // salon via « Salon actif » ; sans sélection, le salon principal s'applique.
  const memberships = await db.select().from(salonMemberships).where(and(
    eq(salonMemberships.userId, session.user.id),
    eq(salonMemberships.active, true),
  )).orderBy(asc(salonMemberships.createdAt))
  const membership = requestedSalonId
    ? memberships.find((row) => row.salonId === requestedSalonId)
    : memberships[0]

  if (!membership) {
    throw createError({ statusCode: 403, statusMessage: 'Aucun accès à ce salon.' })
  }
  if (!allowedRoles.includes(membership.role as SalonRole)) {
    throw createError({ statusCode: 403, statusMessage: 'Votre rôle ne permet pas cette action.' })
  }
  return { db, user: session.user, salonId: membership.salonId, role: membership.role as SalonRole }
}
