import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm'
import { fromZonedTime } from 'date-fns-tz'
import { defineEventHandler, setHeader } from 'h3'
import { SALON_TIMEZONE } from '~~/shared/constants/business'
import { requireStaffContext } from '../../utils/staff-guard'
import { appointmentServices, appointments, customers } from '../../db/schema'

// Agenda de l'employée connectée : journée en cours, à venir et 7 derniers
// jours. Les montants ne sont jamais exposés (réservés au propriétaire et à
// la réception) ; les coordonnées clientes sont limitées à l'utile sur place.
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  const { db, salonId, staffProfile } = await requireStaffContext(event)
  if (!staffProfile) return { staffProfile: null, today: [], upcoming: [], past: [] }

  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: SALON_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const dayStart = fromZonedTime(`${localDate}T00:00:00`, SALON_TIMEZONE)
  const dayEnd = fromZonedTime(`${localDate}T23:59:59.999`, SALON_TIMEZONE)
  const weekAgo = new Date(dayStart.getTime() - 7 * 86_400_000)

  const rows = await db.select({
    id: appointments.id, reference: appointments.reference, status: appointments.status,
    startsAt: appointments.startsAt, endsAt: appointments.endsAt,
    firstName: customers.firstName, lastName: customers.lastName, phone: customers.phone,
  }).from(appointments).innerJoin(customers, eq(appointments.customerId, customers.id)).where(and(
    eq(appointments.salonId, salonId),
    eq(appointments.staffId, staffProfile.id),
    gte(appointments.startsAt, weekAgo),
    lte(appointments.startsAt, new Date(Date.now() + 60 * 86_400_000)),
    inArray(appointments.status, ['confirmed', 'completed', 'no_show']),
  )).orderBy(asc(appointments.startsAt))

  const ids = rows.map((row) => row.id)
  const serviceRows = ids.length ? await db.select({
    appointmentId: appointmentServices.appointmentId,
    name: appointmentServices.serviceNameSnapshot,
    durationMinutes: appointmentServices.durationSnapshotMinutes,
  }).from(appointmentServices).where(inArray(appointmentServices.appointmentId, ids)) : []
  const servicesByAppointment = new Map<string, Array<{ name: string; durationMinutes: number }>>()
  for (const row of serviceRows) {
    const list = servicesByAppointment.get(row.appointmentId) || []
    list.push({ name: row.name, durationMinutes: row.durationMinutes })
    servicesByAppointment.set(row.appointmentId, list)
  }

  const shape = (row: (typeof rows)[number]) => ({
    id: row.id,
    reference: row.reference,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    customer: `${row.firstName} ${row.lastName}`.trim(),
    phone: row.phone,
    services: servicesByAppointment.get(row.id) || [],
  })

  return {
    staffProfile: { id: staffProfile.id, firstName: staffProfile.firstName, lastName: staffProfile.lastName },
    today: rows.filter((row) => row.startsAt >= dayStart && row.startsAt <= dayEnd).map(shape),
    upcoming: rows.filter((row) => row.startsAt > dayEnd).map(shape),
    past: rows.filter((row) => row.startsAt < dayStart && row.startsAt >= weekAgo).map(shape),
  }
})
