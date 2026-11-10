import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from 'node:process'
import { createError, getCookie, setCookie, type H3Event } from 'h3'
import { isLoginOtpDeliverable } from '../services/login-otp'

// Garde de double vérification pour les connexions de gestion. Après la
// connexion Better Auth classique, un compte privilégié (dev, owner,
// reception, staff) doit confirmer un code e-mail : tant que ce code n'est pas
// confirmé, toute API de gestion renvoie 403 { code: 'OTP_REQUIRED' } et le
// navigateur est renvoyé vers /connexion/verification.
//
// La confirmation est matérialisée par un cookie HttpOnly signé (HMAC du
// triplet userId | sessionId | expiration) : il ne vaut que pour cette
// session précise, expire au plus tard douze heures après la connexion et ne
// peut pas être réutilisé depuis un autre compte ou navigateur.
import { isPrivilegedRole } from '~~/shared/constants/rbac'

export const OTP_COOKIE = 'onglerie_otp'
export const OTP_REQUIRED_CODE = 'OTP_REQUIRED'
const OTP_MAX_AGE_SECONDS = 12 * 3600

type GateSession = { session: { id: string; expiresAt: Date | string }; user: { id: string; role?: string | null } }

function otpPepper(): string {
  const secret = env.BETTER_AUTH_SECRET
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('BETTER_AUTH_SECRET doit contenir au moins 32 octets pour signer la double vérification.')
  }
  return secret
}

function signOtpToken(userId: string, sessionId: string, expiresIso: string): string {
  return createHmac('sha256', otpPepper()).update(`${userId}|${sessionId}|${expiresIso}`).digest('hex')
}

function sessionExpiry(session: GateSession): Date {
  const expiry = new Date(session.session.expiresAt)
  const capped = Date.now() + OTP_MAX_AGE_SECONDS * 1000
  const time = Number.isNaN(expiry.getTime()) ? capped : Math.min(expiry.getTime(), capped)
  return new Date(time)
}

export function setOtpCookie(event: H3Event, session: GateSession): void {
  const expiry = sessionExpiry(session)
  const expiresIso = expiry.toISOString()
  const token = `${session.user.id}|${expiresIso}|${signOtpToken(session.user.id, session.session.id, expiresIso)}`
  setCookie(event, OTP_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/',
    secure: env.NODE_ENV === 'production',
    expires: expiry, maxAge: Math.max(1, Math.floor((expiry.getTime() - Date.now()) / 1000)),
  })
}

export function isOtpVerified(event: H3Event, session: GateSession): boolean {
  const raw = getCookie(event, OTP_COOKIE)
  if (!raw) return false
  const [userId, expiresIso, signature] = raw.split('|')
  if (!userId || !expiresIso || !signature) return false
  if (userId !== session.user.id) return false
  if (new Date(expiresIso).getTime() <= Date.now()) return false
  const candidate = Buffer.from(signature, 'hex')
  const expected = Buffer.from(signOtpToken(session.user.id, session.session.id, expiresIso), 'hex')
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

// Rejette les comptes de gestion non encore vérifiés, uniquement quand un
// fournisseur e-mail peut livrer le code. Les clientes (« customer ») ne sont
// jamais concernées, tout comme les comptes invités du parcours public.
export async function assertOtpVerified(event: H3Event, session: GateSession): Promise<void> {
  if (!isPrivilegedRole(session.user.role)) return
  if (!(await isLoginOtpDeliverable())) return
  if (isOtpVerified(event, session)) return
  throw createError({ statusCode: 403, statusMessage: 'Code de vérification requis.', data: { code: OTP_REQUIRED_CODE } })
}
