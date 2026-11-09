type ManualPaymentPreflight = {
  status: string
  startsAt: Date
  expiresAt: Date | null
  staffId: string | null
  now: Date
}

export function manualPaymentPreflightReason(input: ManualPaymentPreflight): string | null {
  if (['cancelled', 'expired', 'payment_failed'].includes(input.status)) {
    return `Le rendez-vous est déjà ${input.status}.`
  }
  if (input.startsAt <= input.now) return 'La date du rendez-vous est passée.'
  if (input.status === 'pending_payment') {
    if (!input.expiresAt || input.expiresAt <= input.now) return 'La retenue du créneau a expiré.'
    if (!input.staffId) return 'Aucune professionnelle n’est attribuée.'
  }
  return null
}

export function shouldConfirmManualPayment(input: { status: string; alreadyPaidXof: number; paymentXof: number; depositDueXof: number; reviewRequired: boolean }): boolean {
  return input.status === 'pending_payment' && !input.reviewRequired && input.alreadyPaidXof + input.paymentXof >= input.depositDueXof
}
