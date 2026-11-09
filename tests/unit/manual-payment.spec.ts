import { describe, expect, it } from 'vitest'
import { manualPaymentPreflightReason, shouldConfirmManualPayment } from '../../server/services/manual-payment'
const now = new Date('2026-11-08T12:00:00.000Z')

describe('rapprochement manuel d’acompte', () => {
  it('refuse toute confirmation après expiration, sans staff ou après le début', () => {
    expect(manualPaymentPreflightReason({ status: 'pending_payment', startsAt: new Date('2026-11-09T12:00:00.000Z'), expiresAt: new Date('2026-11-08T11:59:00.000Z'), staffId: 'staff', now })).toMatch(/expiré/)
    expect(manualPaymentPreflightReason({ status: 'pending_payment', startsAt: new Date('2026-11-09T12:00:00.000Z'), expiresAt: new Date('2026-11-08T12:10:00.000Z'), staffId: null, now })).toMatch(/attribuée/)
    expect(manualPaymentPreflightReason({ status: 'pending_payment', startsAt: new Date('2026-11-08T11:59:00.000Z'), expiresAt: new Date('2026-11-08T12:10:00.000Z'), staffId: 'staff', now })).toMatch(/passée/)
  })
  it('met aussi en revue les paiements d’un rendez-vous confirmé ou terminé après son début', () => {
    for (const status of ['confirmed', 'completed']) {
      expect(manualPaymentPreflightReason({ status, startsAt: new Date('2026-11-08T11:59:00.000Z'), expiresAt: null, staffId: 'staff', now })).toMatch(/passée/)
    }
  })
  it('ne marque un paiement à rapprocher que lorsqu’il couvre l’acompte d’une retenue valide', () => {
    expect(shouldConfirmManualPayment({ status: 'pending_payment', alreadyPaidXof: 1000, paymentXof: 4000, depositDueXof: 5000, reviewRequired: false })).toBe(true)
    expect(shouldConfirmManualPayment({ status: 'pending_payment', alreadyPaidXof: 1000, paymentXof: 3999, depositDueXof: 5000, reviewRequired: false })).toBe(false)
    expect(shouldConfirmManualPayment({ status: 'pending_payment', alreadyPaidXof: 5000, paymentXof: 100, depositDueXof: 5000, reviewRequired: true })).toBe(false)
    expect(shouldConfirmManualPayment({ status: 'expired', alreadyPaidXof: 0, paymentXof: 5000, depositDueXof: 5000, reviewRequired: false })).toBe(false)
  })
})
