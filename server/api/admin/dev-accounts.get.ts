import { asc, desc, eq } from 'drizzle-orm'
import { defineEventHandler, setHeader } from 'h3'
import { requireDevUser } from '../../utils/dev-guard'
import { salonMemberships, salons, staff, users } from '../../db/schema'

// Panneau développement : vue de TOUS les comptes de la plateforme avec leurs
// adhésions salon et leur fiche praticienne éventuelle. Réponse sans aucune
// donnée d'authentification (jamais de hash ni de session).
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  const { db } = await requireDevUser(event)

  const [accountRows, membershipRows, salonRows, staffRows] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email, platformRole: users.role, createdAt: users.createdAt }).from(users).orderBy(desc(users.createdAt)).limit(300),
    db.select({ userId: salonMemberships.userId, salonId: salonMemberships.salonId, role: salonMemberships.role, active: salonMemberships.active }).from(salonMemberships).orderBy(asc(salonMemberships.createdAt)),
    db.select({ id: salons.id, name: salons.name, status: salons.status }).from(salons).orderBy(asc(salons.createdAt)),
    db.select({ id: staff.id, salonId: staff.salonId, userId: staff.userId, firstName: staff.firstName, lastName: staff.lastName }).from(staff).orderBy(asc(staff.firstName)),
  ])

  const salonNames = new Map(salonRows.map((row) => [row.id, row.name]))
  const staffByUser = new Map<string, { id: string; label: string }>()
  for (const row of staffRows) {
    if (!row.userId) continue
    staffByUser.set(row.userId, { id: row.id, label: [row.firstName, row.lastName].filter(Boolean).join(' ') })
  }

  const items = accountRows.map((account) => ({
    id: account.id,
    name: account.name,
    email: account.email,
    platformRole: account.platformRole,
    createdAt: account.createdAt,
    staffProfile: staffByUser.get(account.id) ?? null,
    memberships: membershipRows
      .filter((row) => row.userId === account.id)
      .map((row) => ({ salonId: row.salonId, salonName: salonNames.get(row.salonId) ?? 'Salon supprimé', role: row.role, active: row.active })),
  }))

  return {
    items,
    salons: salonRows.map((row) => ({ id: row.id, name: row.name, status: row.status })),
    unlinkedProfiles: staffRows.filter((row) => !row.userId).map((row) => ({ id: row.id, salonId: row.salonId, label: [row.firstName, row.lastName].filter(Boolean).join(' ') })),
  }
})
