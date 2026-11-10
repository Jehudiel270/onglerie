import { createError, getHeader, type H3Event } from 'h3'
import { getDatabase } from '../db/client'
import { requireSalonRole, resolveDevSalonId } from './admin-guard'

// Garde strict du panneau développement : exige user.role = 'dev'. Ce rôle
// n'est attribué que hors interface (scripts/bootstrap-dev.ts) ; une adhésion
// salon, même « owner », ne donne JAMAIS accès à ces endpoints.
export async function requireDevUser(event: H3Event) {
  const { db, user, salonId } = await requireSalonRole(event)
  if ((user as { role?: string }).role !== 'dev') {
    throw createError({ statusCode: 403, statusMessage: 'Section réservée au rôle développeur.' })
  }
  const requestedSalonId = getHeader(event, 'x-salon-id') || ''
  const resolved = requestedSalonId ? await resolveDevSalonId(db, requestedSalonId) : salonId
  return { db, user, salonId: resolved }
}
