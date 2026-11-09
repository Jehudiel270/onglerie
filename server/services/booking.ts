import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { env } from 'node:process'
import { and, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { formatInTimeZone } from 'date-fns-tz'
import { createError } from 'h3'
import { SALON_TIMEZONE } from '~~/shared/constants/business'
import { normalizeBeninPhone, type BookingRequest } from '~~/shared/schemas/booking'
import { getDatabase } from '../db/client'
import { appointmentServices, appointmentStatusHistory, appointments, customers, notificationOutbox, portfolioItems, scheduleExceptions, services, staff, staffSchedules, staffServices } from '../db/schema'
import { isWithinCalendar } from './availability'
import { requirePrimarySalon } from './salon'
import { calculateDeposit, getSalonBookingSettings } from './salon-settings'

const statesBlocking = ['confirmed', 'pending_payment'] as const
export function hashGuestToken(token: string): string { return createHash('sha256').update(token).digest('hex') }

export async function getBookingQuote(serviceIds: string[]) {
  const salon = await requirePrimarySalon()
  const selected = await getDatabase().select({ id: services.id, priceXof: services.priceXof, durationMinutes: services.durationMinutes, preparationMinutes: services.preparationMinutes, depositXof: services.depositXof })
    .from(services).where(and(eq(services.salonId, salon.id), eq(services.active, true), inArray(services.id, serviceIds)))
  if (selected.length !== new Set(serviceIds).size || selected.length !== serviceIds.length) throw createError({statusCode:400,statusMessage:'Une prestation sélectionnée n’est plus disponible.'})
  const settings=await getSalonBookingSettings(salon.id)
  return { ...calculateDeposit(selected,settings.depositPercent), durationMinutes:selected.reduce((sum,item)=>sum+item.durationMinutes+item.preparationMinutes,0) }
}

export async function createBooking(input: BookingRequest, requestIp?: string) {
  const db = getDatabase()
  const salon = await requirePrimarySalon()
  const startsAt = new Date(input.startsAt)
  const bookingSettings=await getSalonBookingSettings(salon.id)
  const now=new Date(),earliest=new Date(now.getTime()+bookingSettings.minAdvanceHours*60*60_000),latest=new Date(now.getTime()+bookingSettings.maxAdvanceDays*24*60*60_000)
  if (Number.isNaN(startsAt.valueOf()) || startsAt < earliest || startsAt > latest) throw createError({ statusCode: 400, statusMessage: 'Cette date est en dehors de la fenêtre de réservation configurée par le salon.' })
  const selected = await db.select().from(services).where(and(eq(services.salonId, salon.id), eq(services.active, true), inArray(services.id, input.serviceIds)))
  if (selected.length !== new Set(input.serviceIds).size || selected.length !== input.serviceIds.length) throw createError({ statusCode: 400, statusMessage: 'Une prestation sélectionnée n’est plus disponible.' })
  const duration = selected.reduce((sum, item) => sum + item.durationMinutes + item.preparationMinutes, 0)
  const {totalXof,depositDueXof}=calculateDeposit(selected,bookingSettings.depositPercent)
  const endsAt = new Date(startsAt.getTime() + duration * 60_000)
  const localDate = formatInTimeZone(startsAt, SALON_TIMEZONE, 'yyyy-MM-dd')
  const weekday = new Date(`${localDate}T12:00:00.000Z`).getUTCDay()
  const candidateLists = await Promise.all(selected.map((item) => db.select({ staffId: staffServices.staffId }).from(staffServices).where(and(eq(staffServices.salonId, salon.id), eq(staffServices.serviceId, item.id)))))
  const eligible = candidateLists.map((rows) => new Set(rows.map((row) => row.staffId))).reduce((left, right) => new Set([...left].filter((id) => right.has(id))))
  const candidates = input.staffId ? [...eligible].filter((id) => id === input.staffId) : [...eligible]
  if (!candidates.length) throw createError({ statusCode: 409, statusMessage: 'Aucune professionnelle n’est configurée pour toutes ces prestations.' })
  if (input.portfolioItemId) {
    const [look] = await db.select({ id: portfolioItems.id }).from(portfolioItems).where(and(eq(portfolioItems.id, input.portfolioItemId), eq(portfolioItems.salonId, salon.id), eq(portfolioItems.published, true))).limit(1)
    if (!look) throw createError({ statusCode: 400, statusMessage: 'Cette référence n’est plus publiée.' })
  }
  const guestToken = randomBytes(32).toString('base64url')
  const guestAccessTokenHash = hashGuestToken(guestToken)
  const hasDeposit = depositDueXof > 0
  const holdMinutes = bookingSettings.holdMinutes
  const expiresAt = hasDeposit ? new Date(Date.now() + holdMinutes * 60_000) : null
  const created = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`idempotency:${salon.id}`}), hashtext(${input.idempotencyKey}))`)
    const [duplicate] = await tx.select({ id: appointments.id }).from(appointments).where(and(eq(appointments.salonId, salon.id), eq(appointments.idempotencyKey, input.idempotencyKey))).limit(1)
    if (duplicate) throw createError({statusCode:409,statusMessage:'Cette demande a déjà été reçue. Consultez le statut ou recommencez un nouveau parcours.'})
    let chosen: { id: string; firstName: string; lastName: string | null } | undefined
    for (const candidateId of candidates) {
      // Lock the whole staff/day, not only this start time: adjacent overlapping durations must serialize too.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${salon.id}:${candidateId}:${localDate}`}), 0)`)
      const [person] = await tx.select({ id: staff.id, firstName: staff.firstName, lastName: staff.lastName }).from(staff).where(and(eq(staff.id, candidateId), eq(staff.salonId, salon.id), eq(staff.active, true))).limit(1)
      if (!person) continue
      const schedules = await tx.select().from(staffSchedules).where(and(eq(staffSchedules.salonId, salon.id), eq(staffSchedules.weekday, weekday), eq(staffSchedules.active, true), or(eq(staffSchedules.staffId, person.id), isNull(staffSchedules.staffId))))
      const individual = schedules.filter((row) => row.staffId === person.id)
      const applicable = individual.length ? individual : schedules.filter((row) => row.staffId === null)
      const exceptions = await tx.select().from(scheduleExceptions).where(and(eq(scheduleExceptions.salonId, salon.id), or(eq(scheduleExceptions.staffId, person.id), isNull(scheduleExceptions.staffId)), lt(scheduleExceptions.startsAt, endsAt), gt(scheduleExceptions.endsAt, startsAt)))
      if (!isWithinCalendar(startsAt,endsAt,localDate,applicable,exceptions)) continue
      const [conflict] = await tx.select({ id: appointments.id }).from(appointments).where(and(eq(appointments.salonId, salon.id), eq(appointments.staffId, person.id), lt(appointments.startsAt, endsAt), gt(appointments.endsAt, startsAt), or(eq(appointments.status, statesBlocking[0]), and(eq(appointments.status, statesBlocking[1]), or(isNull(appointments.expiresAt),gt(appointments.expiresAt, new Date())))))).limit(1)
      if (!conflict) { chosen = person; break }
    }
    if (!chosen) throw createError({ statusCode: 409, statusMessage: 'Ce créneau n’est pas disponible ou vient d’être pris.' })
    const phone = normalizeBeninPhone(input.phone)
    const whatsapp = input.whatsapp ? normalizeBeninPhone(input.whatsapp) : null
    const [customer] = await tx.insert(customers).values({ salonId: salon.id, firstName: input.firstName, lastName: input.lastName, phone, whatsapp, email: input.email || null })
      .onConflictDoUpdate({ target: [customers.salonId, customers.phone], set: { firstName: input.firstName, lastName: input.lastName, whatsapp, email: input.email || null, updatedAt: new Date() } }).returning()
    if (!customer) throw createError({ statusCode: 500, statusMessage: 'Impossible d’enregistrer les informations cliente.' })
    const reference = `ON-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${randomUUID().slice(0,6).toUpperCase()}`
    const status = hasDeposit ? 'pending_payment' : 'confirmed'
    const [appointment] = await tx.insert(appointments).values({
      salonId: salon.id, customerId: customer.id, staffId: chosen.id, referencePortfolioId: input.portfolioItemId ?? null,
      idempotencyKey:input.idempotencyKey, reference, guestAccessTokenHash, guestAccessExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000), status,
      startsAt, endsAt, expiresAt, totalXof, depositDueXof, customerNote: input.note || null,
    }).returning()
    if (!appointment) throw createError({ statusCode: 500, statusMessage: 'Impossible de créer la réservation.' })
    await tx.insert(appointmentServices).values(selected.map((item) => ({ appointmentId: appointment.id, serviceId: item.id, serviceNameSnapshot: item.name, priceSnapshotXof: item.priceXof, durationSnapshotMinutes: item.durationMinutes + item.preparationMinutes })))
    await tx.insert(appointmentStatusHistory).values({ salonId: salon.id, appointmentId: appointment.id, fromStatus: null, toStatus: status, reason: hasDeposit ? 'Retenue temporaire en attente de paiement.' : 'Aucun acompte configuré pour ces prestations.' })
    if(!hasDeposit){
      const summary={appointmentId:appointment.id,reference,startsAt:startsAt.toISOString(),totalXof,depositPaidXof:0,remainingXof:totalXof}
      if(customer.phone)await tx.insert(notificationOutbox).values({salonId:salon.id,dedupeKey:`${appointment.id}:confirmed:whatsapp:customer`,recipient:customer.phone,channel:'whatsapp',templateKey:'booking_confirmed',payload:summary}).onConflictDoNothing()
      if(customer.email)await tx.insert(notificationOutbox).values({salonId:salon.id,dedupeKey:`${appointment.id}:confirmed:email:customer`,recipient:customer.email,channel:'email',templateKey:'booking_confirmed',payload:summary}).onConflictDoNothing()
    }
    return { appointment, customer, staff: chosen }
  })
  return {
    bookingId: created.appointment.id, salonId: created.appointment.salonId, reference: created.appointment.reference, status: created.appointment.status,
    expiresAt: created.appointment.expiresAt?.toISOString() ?? null, startsAt: created.appointment.startsAt.toISOString(), endsAt: created.appointment.endsAt.toISOString(),
    staffName: [created.staff.firstName, created.staff.lastName].filter(Boolean).join(' '), customerPhone: created.customer.phone, customerEmail: created.customer.email,
    totalXof: created.appointment.totalXof, depositDueXof: created.appointment.depositDueXof, amountPaidXof: created.appointment.amountPaidXof,
    guestAccessToken: guestToken, requestIpRecorded: Boolean(requestIp),
  }
}

export async function releaseBookingHold(bookingId: string, reason: string) {
  const db = getDatabase()
  return db.transaction(async (tx) => {
    const [appointment] = await tx.select().from(appointments).where(eq(appointments.id, bookingId)).for('update').limit(1)
    if (!appointment || appointment.status !== 'pending_payment') return false
    await tx.update(appointments).set({ status: 'payment_failed', expiresAt: new Date(), updatedAt: new Date() }).where(eq(appointments.id, bookingId))
    await tx.insert(appointmentStatusHistory).values({ salonId: appointment.salonId, appointmentId: appointment.id, fromStatus: appointment.status, toStatus: 'payment_failed', reason })
    return true
  })
}
