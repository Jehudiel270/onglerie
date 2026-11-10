import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { env } from 'node:process'
import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm'
import { getDatabase } from '../db/client'
import { loginChallenges } from '../db/schema'
import { getPlatformSetting } from './platform-config'

// Double vérification par code e-mail pour les connexions de gestion
// (dev, owner, reception, staff). Le code à six chiffres n'est jamais stocké :
// seule son empreinte HMAC (BETTER_AUTH_SECRET en pepper) l'est, sur le même
// modèle que la récupération invitée (server/services/guest-recovery.ts).
const CODE_TTL_MINUTES = 10
export const OTP_ATTEMPTS_MAX = 5

function otpPepper(): string {
  const secret = env.BETTER_AUTH_SECRET
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('BETTER_AUTH_SECRET doit contenir au moins 32 octets pour protéger les codes de connexion.')
  }
  return secret
}

export function generateLoginCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function hashLoginCode(challengeId: string, code: string): string {
  return createHmac('sha256', otpPepper()).update(`${challengeId}:${code}`).digest('hex')
}

export function verifyLoginCode(challengeId: string, code: string, expectedHash: string): boolean {
  if (!/^\d{6}$/.test(code) || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false
  const candidate = Buffer.from(hashLoginCode(challengeId, code), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

// Un fournisseur e-mail (Brevo ou adaptateur HTTP) doit être configuré pour
// livrer les codes : sans canal de livraison, la double vérification est
// neutralisée plutôt que de verrouiller tout le monde dehors.
export async function isLoginOtpDeliverable(): Promise<boolean> {
  const [brevoKey, from, apiUrl, apiKey] = await Promise.all([
    getPlatformSetting('BREVO_API_KEY'), getPlatformSetting('EMAIL_FROM'),
    getPlatformSetting('EMAIL_API_URL'), getPlatformSetting('EMAIL_API_KEY'),
  ])
  if (brevoKey.value && from.value) return true
  return Boolean(apiUrl.value && apiKey.value && from.value)
}

const safe = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character))

export async function sendLoginOtpEmail(recipient: string, code: string): Promise<void> {
  const [brevoKey, from] = await Promise.all([getPlatformSetting('BREVO_API_KEY'), getPlatformSetting('EMAIL_FROM')])
  const subject = 'Code de connexion — Onglerie Carrel'
  const body = `Votre code de connexion est ${code}. Il expire dans ${CODE_TTL_MINUTES} minutes et ne peut être utilisé qu'une seule fois. Ne le communiquez à personne.`
  if (brevoKey.value && from.value) {
    const fromName = (await getPlatformSetting('EMAIL_FROM_NAME')).value || 'Onglerie Carrel'
    const response = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': brevoKey.value, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ sender: { email: from.value, name: fromName }, to: [{ email: recipient }], subject, textContent: body, htmlContent: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#2b2422"><p style="font-size:22px;letter-spacing:6px;font-weight:700">${code}</p>${safe(body)}</div>` }), signal: AbortSignal.timeout(20_000) })
    if (!response.ok) throw new Error(`Brevo a refusé l'e-mail de vérification (HTTP ${response.status}).`)
    return
  }
  const [apiUrl, apiKey] = await Promise.all([getPlatformSetting('EMAIL_API_URL'), getPlatformSetting('EMAIL_API_KEY')])
  if (!apiUrl.value || !apiKey.value || !from.value) throw new Error('Fournisseur e-mail non configuré (BREVO_API_KEY ou EMAIL_API_*).')
  const destination = new URL(apiUrl.value)
  if (destination.protocol !== 'https:' || destination.username || destination.password) throw new Error('EMAIL_API_URL doit être une URL HTTPS sans identifiants intégrés.')
  const response = await fetch(destination, { method: 'POST', headers: { authorization: `Bearer ${apiKey.value}`, 'content-type': 'application/json', 'idempotency-key': `login-otp:${recipient}:${code}` }, body: JSON.stringify({ from: from.value, to: recipient, subject, text: body, html: `<div style="font-family:Arial,sans-serif;font-size:14px"><p style="font-size:22px;letter-spacing:6px;font-weight:700">${code}</p><pre style="white-space:pre-wrap">${safe(body)}</pre></div>` }), signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw new Error(`E-mail de vérification refusé par le fournisseur (HTTP ${response.status}).`)
}

export type LoginChallengeIssued = { id: string; code: string; expiresAt: Date; ttlMinutes: number }

// Invalide les codes en attente du compte, purge les défis périmés puis émet
// un nouveau code. Le dernier code émis est le seul valable.
export async function createLoginChallenge(userId: string): Promise<LoginChallengeIssued> {
  const db = getDatabase(), now = new Date()
  await db.delete(loginChallenges).where(and(eq(loginChallenges.userId, userId), isNull(loginChallenges.consumedAt)))
  await db.delete(loginChallenges).where(lt(loginChallenges.expiresAt, new Date(now.getTime() - 7 * 24 * 60 * 60_000)))
  const id = randomUUID(), code = generateLoginCode(), expiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60_000)
  const [row] = await db.insert(loginChallenges).values({ id, userId, codeHash: hashLoginCode(id, code), expiresAt }).returning()
  if (!row) throw new Error('La création du défi de connexion a échoué.')
  return { id: row.id, code, expiresAt, ttlMinutes: CODE_TTL_MINUTES }
}

export type LoginChallengeResult = { ok: true } | { ok: false; reason: 'missing' | 'attempts' | 'expired' | 'invalid' }

// Vérifie et consomme le code du compte. Chaque essai est compté ; au-delà de
// OTP_ATTEMPTS_MAX le défi est refusé et un nouveau code doit être demandé.
export async function consumeLoginChallenge(userId: string, code: string): Promise<LoginChallengeResult> {
  const db = getDatabase()
  const [row] = await db.select().from(loginChallenges)
    .where(and(eq(loginChallenges.userId, userId), isNull(loginChallenges.consumedAt)))
    .orderBy(desc(loginChallenges.createdAt)).limit(1)
  if (!row) return { ok: false, reason: 'missing' }
  if (row.attempts >= OTP_ATTEMPTS_MAX) return { ok: false, reason: 'attempts' }
  if (row.expiresAt <= new Date()) return { ok: false, reason: 'expired' }
  await db.update(loginChallenges).set({ attempts: sql`${loginChallenges.attempts} + 1` }).where(eq(loginChallenges.id, row.id))
  if (!verifyLoginCode(row.id, code, row.codeHash)) return { ok: false, reason: 'invalid' }
  await db.update(loginChallenges).set({ consumedAt: new Date() }).where(and(eq(loginChallenges.id, row.id), isNull(loginChallenges.consumedAt)))
  return { ok: true }
}
