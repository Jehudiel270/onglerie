import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from 'node:process'

function recoveryPepper(): string {
  const secret = env.BETTER_AUTH_SECRET
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('BETTER_AUTH_SECRET doit contenir au moins 32 octets pour protéger les codes de récupération.')
  }
  return secret
}

export function hashGuestRecoveryCode(challengeId: string, code: string): string {
  return createHmac('sha256', recoveryPepper()).update(`${challengeId}:${code}`).digest('hex')
}

export function verifyGuestRecoveryCode(challengeId: string, code: string, expectedHash: string): boolean {
  if (!/^\d{6}$/.test(code) || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false
  const candidate = Buffer.from(hashGuestRecoveryCode(challengeId, code), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}
