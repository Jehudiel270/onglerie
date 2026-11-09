import { createHash, randomInt, randomUUID } from 'node:crypto'
import { env } from 'node:process'
import { and, eq, isNull, or } from 'drizzle-orm'
import { createError, defineEventHandler, readBody, setHeader, setResponseStatus } from 'h3'
import { z } from 'zod'
import { normalizeBeninPhone } from '../../../../shared/schemas/booking'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { getDatabase, hasNeonDatabase } from '../../../db/client'
import { appointments, customers, guestRecoveryChallenges, notificationOutbox } from '../../../db/schema'
import { hashGuestRecoveryCode } from '../../../services/guest-recovery'

const generic = { ok: true, message: 'Si la référence et le numéro correspondent à une réservation, un code valable dix minutes est envoyé à un contact enregistré.' }
const schema = z.object({ reference: z.string().trim().min(8).max(32), phone: z.string().trim().min(8).max(25) }).strict()

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  if (!hasNeonDatabase()) throw createError({ statusCode: 503, statusMessage: 'La récupération nécessite la base Neon.' })
  await enforceRateLimit(event, 'guest-recovery-request-ip', 8, 15 * 60_000)
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) return generic
  let phone: string
  try { phone = normalizeBeninPhone(parsed.data.phone) } catch { return generic }
  const phoneHash = createHash('sha256').update(phone).digest('hex').slice(0, 24)
  await enforceRateLimit(event, `guest-recovery-request-phone:${phoneHash}`, 3, 15 * 60_000)
  const db = getDatabase()
  const [booking] = await db.select({ id: appointments.id, salonId: appointments.salonId, reference: appointments.reference, phone: customers.phone, whatsapp: customers.whatsapp, email: customers.email })
    .from(appointments).innerJoin(customers, and(eq(appointments.customerId, customers.id), eq(appointments.salonId, customers.salonId)))
    .where(and(eq(appointments.reference, parsed.data.reference.toUpperCase()), or(eq(customers.phone, phone), eq(customers.whatsapp, phone)))).limit(1)
  if (!booking) { setResponseStatus(event, 202); return generic }

  const emailReady = Boolean(booking.email && env.EMAIL_API_URL && env.EMAIL_API_KEY && env.EMAIL_FROM)
  const whatsappReady = Boolean((booking.whatsapp || booking.phone) && env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_TEMPLATE_BOOKING_RECOVERY)
  const channel = emailReady ? 'email' : whatsappReady ? 'whatsapp' : null
  if (!channel) { setResponseStatus(event, 202); return generic }
  const recipient = channel === 'email' ? booking.email! : booking.whatsapp || booking.phone
  const id = randomUUID(), code = String(randomInt(100_000, 1_000_000)), now = new Date(), expiresAt = new Date(now.getTime() + 10 * 60_000)
  await db.transaction(async (tx) => {
    await tx.update(guestRecoveryChallenges).set({ consumedAt: now }).where(and(eq(guestRecoveryChallenges.appointmentId, booking.id), isNull(guestRecoveryChallenges.consumedAt)))
    await tx.insert(guestRecoveryChallenges).values({ id, salonId: booking.salonId, appointmentId: booking.id, codeHash: hashGuestRecoveryCode(id, code), attempts: 0, expiresAt })
    await tx.insert(notificationOutbox).values({
      salonId: booking.salonId,
      dedupeKey: `booking-recovery:${id}:${channel}`,
      recipient,
      channel,
      templateKey: 'booking_recovery_code',
      payload: { reference: booking.reference, code, expiresMinutes: 10 },
    })
  })
  setResponseStatus(event, 202)
  return generic
})
