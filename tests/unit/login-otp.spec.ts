import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generateLoginCode, hashLoginCode, verifyLoginCode } from '../../server/services/login-otp'
import { isPrivilegedRole } from '../../shared/constants/rbac'

describe('double vérification (OTP connexion)', () => {
  const originalSecret = process.env.BETTER_AUTH_SECRET
  beforeEach(() => { process.env.BETTER_AUTH_SECRET = 'secret-de-test-long-de-plus-de-32-octets-pour-hmac' })
  afterEach(() => {
    if (originalSecret === undefined) delete process.env.BETTER_AUTH_SECRET
    else process.env.BETTER_AUTH_SECRET = originalSecret
  })

  it('génère un code à six chiffres', () => {
    for (let index = 0; index < 40; index += 1) expect(generateLoginCode()).toMatch(/^\d{6}$/)
  })

  it('accepte le code exact uniquement pour son propre défi', () => {
    const hash = hashLoginCode('defi-a', '482915')
    expect(verifyLoginCode('defi-a', '482915', hash)).toBe(true)
    expect(verifyLoginCode('defi-b', '482915', hash)).toBe(false)
  })

  it('rejette les codes mal formés et les empreintes altérées', () => {
    const hash = hashLoginCode('defi-a', '482915')
    expect(verifyLoginCode('defi-a', '48291', hash)).toBe(false)
    expect(verifyLoginCode('defi-a', '482916', hash)).toBe(false)
    expect(verifyLoginCode('defi-a', '482915', 'empreinte-falsifiée')).toBe(false)
  })

  it('lie l\'empreinte au secret : un autre secret invalide le code', () => {
    const hash = hashLoginCode('defi-a', '482915')
    process.env.BETTER_AUTH_SECRET = 'autre-secret-de-test-long-de-plus-de-32-octets'
    expect(verifyLoginCode('defi-a', '482915', hash)).toBe(false)
  })

  it('concerne uniquement les rôles de gestion, jamais les clientes', () => {
    expect(isPrivilegedRole('dev')).toBe(true)
    expect(isPrivilegedRole('owner')).toBe(true)
    expect(isPrivilegedRole('reception')).toBe(true)
    expect(isPrivilegedRole('staff')).toBe(true)
    expect(isPrivilegedRole('customer')).toBe(false)
    expect(isPrivilegedRole(undefined)).toBe(false)
    expect(isPrivilegedRole(null)).toBe(false)
  })
})
