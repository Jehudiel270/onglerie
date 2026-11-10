import { and, asc, eq } from 'drizzle-orm'
import { defineEventHandler, setHeader } from 'h3'
import { requireSalonRole } from '../../utils/admin-guard'
import { salons, salonMemberships } from '../../db/schema'
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  const context = await requireSalonRole(event, ['owner', 'reception', 'staff'])
  const [salon] = await context.db.select({ name: salons.name, city: salons.city }).from(salons).where(eq(salons.id, context.salonId)).limit(1)
  // Salons où le compte est actif : alimente le sélecteur « Salon actif »
  // d'une propriétaire multi-salons (succursales). Le développeur, lui,
  // énumère tous les salons via /api/admin/salons.
  const memberships = await context.db.select({ salonId: salonMemberships.salonId, role: salonMemberships.role, name: salons.name, city: salons.city, status: salons.status })
    .from(salonMemberships).innerJoin(salons, eq(salonMemberships.salonId, salons.id))
    .where(and(eq(salonMemberships.userId, context.user.id), eq(salonMemberships.active, true)))
    .orderBy(asc(salonMemberships.createdAt))
  return {
    user: { id: context.user.id, name: context.user.name, email: context.user.email },
    role: context.role, salonId: context.salonId,
    salonName: salon?.name ?? null, salonCity: salon?.city ?? null,
    salons: memberships.map((row) => ({ id: row.salonId, name: row.name, city: row.city, status: row.status, role: row.role })),
  }
})
