import { and, eq } from 'drizzle-orm'
import { createError, getHeader, getQuery, type H3Event } from 'h3'
import { getDatabase } from '../db/client'
import { salonMemberships } from '../db/schema'

export type SalonRole = 'owner' | 'manager' | 'staff'

export async function requireSalonRole(event: H3Event, allowedRoles: SalonRole[] = ['owner', 'manager']) {
  const auth = serverAuth(event)
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: 'Connexion requise.' })
  }

  const requestedSalonId = getHeader(event, 'x-salon-id') || String(getQuery(event).salonId || '')
  const db = getDatabase()
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
