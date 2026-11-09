import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm'
import { createError, defineEventHandler, readBody, setHeader } from 'h3'
import { z } from 'zod'
import { normalizeBeninPhone } from '../../../../shared/schemas/booking'
import { enforceRateLimit } from '../../../utils/rate-limit'
import { getDatabase, hasNeonDatabase } from '../../../db/client'
import { appointments, auditLogs, customers, guestRecoveryChallenges } from '../../../db/schema'
import { verifyGuestRecoveryCode } from '../../../services/guest-recovery'
import { hashGuestToken } from '../../../services/booking'

const schema = z.object({ reference: z.string().trim().min(8).max(32), phone: z.string().trim().min(8).max(25), code: z.string().trim().regex(/^\d{6}$/) }).strict()
const invalid = () => createError({ statusCode: 401, statusMessage: 'Code invalide ou expiré. Demandez un nouveau code si nécessaire.' })

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  if (!hasNeonDatabase()) throw createError({ statusCode: 503, statusMessage: 'La récupération nécessite la base Neon.' })
  await enforceRateLimit(event, 'guest-recovery-verify-ip', 12, 15 * 60_000)
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw invalid()
  let phone: string
  try { phone = normalizeBeninPhone(parsed.data.phone) } catch { throw invalid() }
  const phoneHash = createHash('sha256').update(phone).digest('hex').slice(0, 24)
  await enforceRateLimit(event, `guest-recovery-verify-phone:${phoneHash}`, 8, 15 * 60_000)
  const db = getDatabase()
  const [booking] = await db.select({ id: appointments.id, salonId: appointments.salonId, reference: appointments.reference })
    .from(appointments).innerJoin(customers, and(eq(appointments.customerId, customers.id), eq(appointments.salonId, customers.salonId)))
    .where(and(eq(appointments.reference, parsed.data.reference.toUpperCase()), or(eq(customers.phone, phone), eq(customers.whatsapp, phone)))).limit(1)
  if (!booking) throw invalid()
  const token = randomBytes(32).toString('base64url'), now = new Date(), guestAccessExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60_000)
  const [activeChallenge] = await db.select({ id: guestRecoveryChallenges.id }).from(guestRecoveryChallenges)
    .where(and(eq(guestRecoveryChallenges.appointmentId, booking.id), eq(guestRecoveryChallenges.salonId, booking.salonId), isNull(guestRecoveryChallenges.consumedAt), gt(guestRecoveryChallenges.expiresAt, now)))
    .orderBy(desc(guestRecoveryChallenges.createdAt)).limit(1)
  if (!activeChallenge) throw invalid()
  await enforceRateLimit(event, `guest-recovery-challenge:${activeChallenge.id}`, 5, 10 * 60_000)

  const recovered = await db.transaction(async (tx) => {
    const [challenge] = await tx.select().from(guestRecoveryChallenges)
      .where(and(eq(guestRecoveryChallenges.id, activeChallenge.id), eq(guestRecoveryChallenges.appointmentId, booking.id), eq(guestRecoveryChallenges.salonId, booking.salonId), isNull(guestRecoveryChallenges.consumedAt), gt(guestRecoveryChallenges.expiresAt, now)))
      .orderBy(desc(guestRecoveryChallenges.createdAt)).limit(1).for('update')
    if (!challenge) return null
    if (!verifyGuestRecoveryCode(challenge.id, parsed.data.code, challenge.codeHash)) {
      const attempts = challenge.attempts + 1
      await tx.update(guestRecoveryChallenges).set({ attempts, ...(attempts >= 5 ? { consumedAt: now } : {}) }).where(eq(guestRecoveryChallenges.id, challenge.id))
      return null
    }
    await tx.update(guestRecoveryChallenges).set({ consumedAt: now, attempts: challenge.attempts + 1 }).where(and(eq(guestRecoveryChallenges.id, challenge.id), isNull(guestRecoveryChallenges.consumedAt)))
    const [updated] = await tx.update(appointments).set({ guestAccessTokenHash: hashGuestToken(token), guestAccessExpiresAt, updatedAt: now }).where(and(eq(appointments.id, booking.id), eq(appointments.salonId, booking.salonId))).returning({ id: appointments.id })
    if (!updated) return null
    await tx.insert(auditLogs).values({ salonId: booking.salonId, action: 'guest_booking_access_recovered', entity: 'appointment', entityId: booking.id, metadata: { method: 'single_use_otp' } })
    return updated
  })
  if (!recovered) throw invalid()
  return { ok: true, bookingId: recovered.id, reference: booking.reference, guestAccessToken: token, guestAccessExpiresAt: guestAccessExpiresAt.toISOString() }
})
