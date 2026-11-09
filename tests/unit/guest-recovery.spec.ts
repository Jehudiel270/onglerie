import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hashGuestRecoveryCode, verifyGuestRecoveryCode } from '../../server/services/guest-recovery'

describe('récupération OTP invité', () => {
  const originalSecret = process.env.BETTER_AUTH_SECRET
  beforeEach(() => { process.env.BETTER_AUTH_SECRET = 'secret-de-test-long-de-plus-de-32-octets-pour-hmac' })
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.BETTER_AUTH_SECRET
    else process.env.BETTER_AUTH_SECRET = originalSecret
  })

  it('accepte le code exact uniquement pour son identifiant de challenge', () => {
    const hash = hashGuestRecoveryCode('challenge-a', '184205')
    expect(verifyGuestRecoveryCode('challenge-a', '184205', hash)).toBe(true)
    expect(verifyGuestRecoveryCode('challenge-b', '184205', hash)).toBe(false)
  })
  it('rejette les codes mal formés et les empreintes altérées', () => {
    const hash = hashGuestRecoveryCode('challenge-a', '184205')
    expect(verifyGuestRecoveryCode('challenge-a', '18420', hash)).toBe(false)
    expect(verifyGuestRecoveryCode('challenge-a', '184206', hash)).toBe(false)
    expect(verifyGuestRecoveryCode('challenge-a', '184205', 'not-a-hash')).toBe(false)
  })
})
