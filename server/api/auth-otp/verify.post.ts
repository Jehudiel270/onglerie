import { createError, defineEventHandler, readBody, setHeader } from 'h3'
import { z } from 'zod'
import { isPrivilegedRole } from '~~/shared/constants/rbac'
import { consumeLoginChallenge } from '../../services/login-otp'
import { auditLogs } from '../../db/schema'
import { getDatabase } from '../../db/client'
import { setOtpCookie } from '../../utils/otp-gate'
import { enforceRateLimit } from '../../utils/rate-limit'

// Confirmation du code de double vérification. Le succès consomme le défi et
// pose un cookie HttpOnly signé, valable pour cette session uniquement et au
// plus douze heures. Les tentatives sont comptées : au-delà de cinq échecs, un
// nouveau code doit être demandé.
const bodySchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Le code comporte six chiffres.') }).strict()

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  await enforceRateLimit(event, 'auth-otp-verify', 10, 60_000)
  const session = await serverAuth(event).api.getSession({ headers: event.headers })
  if (!session?.user) throw createError({ statusCode: 401, statusMessage: 'Connexion requise.' })
  if (!isPrivilegedRole(session.user.role)) throw createError({ statusCode: 400, statusMessage: 'La double vérification ne concerne que les accès de gestion.' })
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Saisissez le code à six chiffres reçu par e-mail.', data: parsed.error.flatten() })

  const db = getDatabase()
  const result = await consumeLoginChallenge(session.user.id, parsed.data.code)
  if (!result.ok) {
    await db.insert(auditLogs).values({ salonId: null, userId: session.user.id, action: 'login_otp_failed', entity: 'user', entityId: session.user.id, metadata: { reason: result.reason } })
    const messages = { missing: 'Aucun code en attente : demandez un nouveau code.', attempts: 'Trop de tentatives : demandez un nouveau code.', expired: 'Code expiré : demandez un nouveau code.', invalid: 'Code incorrect ou déjà utilisé.' } as const
    throw createError({ statusCode: 401, statusMessage: messages[result.reason] })
  }
  setOtpCookie(event, session)
  await db.insert(auditLogs).values({ salonId: null, userId: session.user.id, action: 'login_otp_verified', entity: 'user', entityId: session.user.id })
  return { verified: true, guidance: 'Connexion confirmée ; redirection vers votre espace.' }
})
