import { and, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { getDatabase } from '../db/client'
import { staff } from '../db/schema'
import { requireSalonRole } from './admin-guard'

// Résout la session courante comme membre de l'équipe : toute adhésion active
// (staff, reception ou owner) passe, et la fiche employée liée est retournée si
// un profil `staff` est rattaché au compte via `staff.userId`.
export async function requireStaffContext(event: H3Event) {
  const { db, user, salonId, role } = await requireSalonRole(event, ['owner', 'reception', 'staff'])
  const [profile] = await db.select().from(staff).where(and(eq(staff.salonId, salonId), eq(staff.userId, user.id))).limit(1)
  return { db, user, salonId, role, staffProfile: profile ?? null }
}
