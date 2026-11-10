import { defineEventHandler, setHeader } from 'h3'
import { isPrivilegedRole } from '~~/shared/constants/rbac'
import { isLoginOtpDeliverable } from '../../services/login-otp'
import { isOtpVerified } from '../../utils/otp-gate'

// État de la double vérification pour la session courante. Consulté par la
// page de connexion (faut-il afficher l'étape du code ?) et par la page de
// vérification (la session est-elle déjà confirmée ?).
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  const session = await serverAuth(event).api.getSession({ headers: event.headers })
  if (!session?.user) return { authenticated: false, required: false, verified: false, bypassed: false, maskedEmail: '' }
  const deliverable = await isLoginOtpDeliverable()
  const required = isPrivilegedRole(session.user.role) && deliverable
  const verified = required ? isOtpVerified(event, session) : true
  const email = session.user.email
  const maskedEmail = email.includes('@') ? `${email.slice(0, 1)}•••@${email.slice(email.indexOf('@') + 1)}` : email
  return { authenticated: true, required, verified, bypassed: !deliverable, maskedEmail }
})
