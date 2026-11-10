import { describe, expect, it } from 'vitest'
import { canReadResource, canSeeRevenue, canWriteResource, RECEPTION_READABLE, SALON_ROLES, STAFF_ALLOWED_TRANSITIONS, type ManageResource, type SalonRole } from '../../shared/constants/rbac'

const ALL_RESOURCES: ManageResource[] = ['services', 'categories', 'portfolio', 'staff', 'schedules', 'exceptions', 'customers', 'payments', 'notifications', 'content', 'settings', 'salon', 'contacts']

describe('matrice RBAC', () => {
  it('couvre exactement les trois rôles salon', () => {
    expect(SALON_ROLES).toEqual(['owner', 'reception', 'staff'])
  })

  it('le propriétaire lit et écrit toutes les ressources', () => {
    for (const resource of ALL_RESOURCES) {
      expect(canReadResource('owner', resource)).toBe(true)
      expect(canWriteResource('owner', resource)).toBe(true)
    }
  })

  it('la réception lit un périmètre quotidien précis', () => {
    for (const resource of RECEPTION_READABLE) expect(canReadResource('reception', resource)).toBe(true)
    expect(canReadResource('reception', 'portfolio')).toBe(false)
    expect(canReadResource('reception', 'staff')).toBe(false)
    expect(canReadResource('reception', 'content')).toBe(false)
    expect(canReadResource('reception', 'settings')).toBe(false)
    expect(canReadResource('reception', 'salon')).toBe(false)
  })

  it('la réception ne peut encaisser que des paiements', () => {
    expect(canWriteResource('reception', 'payments')).toBe(true)
    for (const resource of ALL_RESOURCES.filter((item) => item !== 'payments')) {
      expect(canWriteResource('reception', resource)).toBe(false)
    }
  })

  it("l'employée ne consulte ni n'écrit via le CRUD générique", () => {
    for (const resource of ALL_RESOURCES) {
      expect(canReadResource('staff' as SalonRole, resource)).toBe(false)
      expect(canWriteResource('staff' as SalonRole, resource)).toBe(false)
    }
  })

  it('le chiffre d’affaires est réservé au propriétaire', () => {
    expect(canSeeRevenue('owner')).toBe(true)
    expect(canSeeRevenue('reception')).toBe(false)
    expect(canSeeRevenue('staff' as SalonRole)).toBe(false)
  })

  it('une employée ne peut que marquer venue ou absente', () => {
    expect(STAFF_ALLOWED_TRANSITIONS).toEqual(['completed', 'no_show'])
    expect(STAFF_ALLOWED_TRANSITIONS).not.toContain('cancelled')
    expect(STAFF_ALLOWED_TRANSITIONS).not.toContain('confirmed')
  })
})
