import { createError, defineEventHandler, setHeader } from 'h3'
import { isPrivilegedRole } from '~~/shared/constants/rbac'
import { createLoginChallenge, isLoginOtpDeliverable, sendLoginOtpEmail } from '../../services/login-otp'
import { auditLogs } from '../../db/schema'
import { getDatabase } from '../../db/client'
import { enforceRateLimit } from '../../utils/rate-limit'

// Envoi d'un nouveau code de double vérification à l'adresse du compte
// connecté. Limité par IP (3 envois/minute, 8/heure) et par compte : chaque
// émission invalide le code précédent.
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  await enforceRateLimit(event, 'auth-otp-request', 3, 60_000)
  await enforceRateLimit(event, 'auth-otp-request-hour', 8, 3_600_000)
  const session = await serverAuth(event).api.getSession({ headers: event.headers })
  if (!session?.user) throw createError({ statusCode: 401, statusMessage: 'Connexion requise.' })
  if (!isPrivilegedRole(session.user.role)) throw createError({ statusCode: 400, statusMessage: 'La double vérification ne concerne que les accès de gestion.' })
  if (!(await isLoginOtpDeliverable())) {
    throw createError({ statusCode: 503, statusMessage: 'Aucun fournisseur e-mail n’est configuré : configurez Brevo (ou EMAIL_API_*) dans le panneau Intégrations pour activer l’envoi des codes.' })
  }
  const challenge = await createLoginChallenge(session.user.id)
  await sendLoginOtpEmail(session.user.email, challenge.code)
  const db = getDatabase()
  await db.insert(auditLogs).values({ salonId: null, userId: session.user.id, action: 'login_otp_sent', entity: 'user', entityId: session.user.id, metadata: { maskedRecipient: `${session.user.email.slice(0, 1)}•••` } })
  return { sent: true, expiresAt: challenge.expiresAt.toISOString(), ttlMinutes: challenge.ttlMinutes }
})
