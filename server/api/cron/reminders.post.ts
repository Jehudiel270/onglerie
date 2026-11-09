import { env } from 'node:process'
import { and, eq, gte, lt } from 'drizzle-orm'
import { createError, defineEventHandler, getHeader } from 'h3'
import { formatInTimeZone } from 'date-fns-tz'
import { getDatabase } from '../../db/client'
import { appointments, customers, notificationOutbox, salons } from '../../db/schema'
import { getSalonBookingSettings } from '../../services/salon-settings'

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '') || getHeader(event, 'x-cron-secret')
  if (!env.CRON_SECRET || token !== env.CRON_SECRET) throw createError({ statusCode: 401, statusMessage: 'Tâche planifiée non autorisée.' })

  const db = getDatabase()
  const current = new Date()
  const salonRows = await db.select({ id: salons.id, timezone: salons.timezone }).from(salons).where(eq(salons.status, 'active'))
  let queued = 0
  for (const salon of salonRows) {
    const settings = await getSalonBookingSettings(salon.id)
    if (!settings.remindersEnabled) continue
    let timezone = salon.timezone || 'Africa/Porto-Novo'
    try { new Intl.DateTimeFormat('fr-BJ', { timeZone: timezone }).format(current) } catch { timezone = 'Africa/Porto-Novo' }
    for (const hours of [...new Set(settings.reminderHours)].slice(0, 3)) {
      const from = new Date(current.getTime() + (hours - 1) * 3_600_000)
      const to = new Date(current.getTime() + hours * 3_600_000)
      const upcoming = await db.select({ appointment: appointments, customer: customers }).from(appointments)
        .innerJoin(customers, and(eq(appointments.customerId, customers.id), eq(appointments.salonId, customers.salonId)))
        .where(and(eq(appointments.salonId, salon.id), eq(appointments.status, 'confirmed'), gte(appointments.startsAt, from), lt(appointments.startsAt, to)))
      for (const row of upcoming) {
        const payload = {
          reference: row.appointment.reference,
          startsAt: formatInTimeZone(row.appointment.startsAt, timezone, "EEEE d MMMM 'à' HH:mm"),
          totalXof: row.appointment.totalXof,
          depositPaidXof: row.appointment.amountPaidXof,
          remainingXof: Math.max(0, row.appointment.totalXof - row.appointment.amountPaidXof),
          reminderHours: hours,
        }
        const channels: Array<[string, string]> = []
        if (row.customer.whatsapp || row.customer.phone) channels.push(['whatsapp', row.customer.whatsapp || row.customer.phone!])
        if (row.customer.email) channels.push(['email', row.customer.email])
        for (const [channel, recipient] of channels) {
          const result = await db.insert(notificationOutbox).values({
            salonId: salon.id,
            dedupeKey: `${row.appointment.id}:reminder-${hours}:${channel}:${recipient}`,
            recipient,
            channel,
            templateKey: 'booking_reminder',
            payload,
          }).onConflictDoNothing().returning({ id: notificationOutbox.id })
          if (result.length) queued++
        }
      }
    }
  }
  return { ok: true, queued }
})
