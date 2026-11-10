import { and, asc, eq } from 'drizzle-orm'
import { createError, getHeader, getQuery, type H3Event } from 'h3'
import { getDatabase } from '../db/client'
import { salonMemberships, salons } from '../db/schema'
import { type SalonRole } from '../../shared/constants/rbac'

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

  const requestedSalonId = getHeader(event, 'x-salon-id') || String(getQuery(event).salonId || '')
  const db = getDatabase()

  // Rôle plateforme « dev » : identifié au niveau du compte utilisateur
  // (user.role = 'dev') et non par une adhésion salon. Le développeur·se
  // contourne les adhésions et agit sur le salon demandé (en-tête x-salon-id)
  // ou sur le premier salon actif de la plateforme.
  if ((session.user as { role?: string }).role === 'dev') {
    const salonId = await resolveDevSalonId(db, requestedSalonId)
    return { db, user: session.user, salonId, role: 'dev' as SalonRole }
  }

  const memberships = await db.select().from(salonMemberships).where(and(
    eq(salonMemberships.userId, session.user.id),
    eq(salonMemberships.active, true),
    ...(requestedSalonId ? [eq(salonMemberships.salonId, requestedSalonId)] : []),
  ))
  const membership = requestedSalonId ? memberships[0] : memberships.length === 1 ? memberships[0] : undefined

  if (!membership) {
    if (memberships.length > 1) {
      throw createError({ statusCode: 400, statusMessage: 'Précisez le salon autorisé.' })
    }
    throw createError({ statusCode: 403, statusMessage: 'Aucun accès à ce salon.' })
  }
  if (!allowedRoles.includes(membership.role as SalonRole)) {
    throw createError({ statusCode: 403, statusMessage: 'Votre rôle ne permet pas cette action.' })
  }
  return { db, user: session.user, salonId: membership.salonId, role: membership.role as SalonRole }
}
