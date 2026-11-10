import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm'
import { fromZonedTime } from 'date-fns-tz'
import { defineEventHandler, setHeader } from 'h3'
import { SALON_TIMEZONE } from '~~/shared/constants/business'
import { requireSalonRole } from '../../utils/admin-guard'
import { appointmentServices, appointments, customers, salons } from '../../db/schema'

// Relances WhatsApp manuelles : liens wa.me pré-remplis pour les rendez-vous
// confirmés des 2 prochains jours. Aucune API Meta requise — le personnel ouvre
// le lien et envoie le message depuis son propre WhatsApp. Les numéros restent
// côté serveur ; la page n'expose que le lien construit.
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  const { db, salonId } = await requireSalonRole(event, ['owner', 'reception'])

  const [salon] = await db.select({ name: salons.name }).from(salons).where(eq(salons.id, salonId)).limit(1)
  const salonName = salon?.name || 'votre salon'

  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: SALON_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const start = fromZonedTime(`${localDate}T00:00:00`, SALON_TIMEZONE)
  const end = fromZonedTime(`${localDate}T23:59:59.999`, SALON_TIMEZONE)
  const horizon = new Date(end.getTime() + 2 * 86_400_000)

  const rows = await db.select({
    id: appointments.id, reference: appointments.reference, startsAt: appointments.startsAt,
    firstName: customers.firstName, lastName: customers.lastName, phone: customers.phone,
  }).from(appointments).innerJoin(customers, eq(appointments.customerId, customers.id)).where(and(
    eq(appointments.salonId, salonId),
    gte(appointments.startsAt, start),
    lte(appointments.startsAt, horizon),
    inArray(appointments.status, ['confirmed']),
  )).orderBy(asc(appointments.startsAt)).limit(60)

  const ids = rows.map((row) => row.id)
  const serviceRows = ids.length ? await db.select({ appointmentId: appointmentServices.appointmentId, name: appointmentServices.serviceNameSnapshot }).from(appointmentServices).where(inArray(appointmentServices.appointmentId, ids)) : []
  const servicesByAppointment = new Map<string, string[]>()
  for (const row of serviceRows) {
    const list = servicesByAppointment.get(row.appointmentId) || []
    list.push(row.name)
    servicesByAppointment.set(row.appointmentId, list)
  }

  const dayFormatter = new Intl.DateTimeFormat('fr-BJ', { timeZone: SALON_TIMEZONE, weekday: 'long', day: 'numeric', month: 'long' })
  const timeFormatter = new Intl.DateTimeFormat('fr-BJ', { timeZone: SALON_TIMEZONE, hour: '2-digit', minute: '2-digit' })

  const items = rows.map((row) => {
    const when = `${dayFormatter.format(row.startsAt)} à ${timeFormatter.format(row.startsAt)}`
    const services = (servicesByAppointment.get(row.id) || []).join(', ') || 'prestation prévue'
    const message = `Bonjour ${row.firstName}, petit rappel de votre rendez-vous chez ${salonName} : ${when} (${services}). Répondez à ce message en cas d’empêchement. À très vite !`
    const digits = row.phone.replace(/\D/g, '')
    return {
      id: row.id,
      reference: row.reference,
      startsAt: row.startsAt.toISOString(),
      day: dayFormatter.format(row.startsAt),
      time: timeFormatter.format(row.startsAt),
      customer: `${row.firstName} ${row.lastName}`.trim(),
      services,
      waLink: `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
    }
  })

  return { items, guidance: 'Ouvrez le lien : WhatsApp s’ouvre avec le message pré-rempli, depuis votre propre numéro. Aucun envoi automatique.' }
})
