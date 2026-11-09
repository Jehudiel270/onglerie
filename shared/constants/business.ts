export const SALON_TIMEZONE = 'Africa/Porto-Novo'
export const DEFAULT_CURRENCY = 'XOF'
export const DEFAULT_HOLD_MINUTES = 10
export const SLOT_STEP_MINUTES = 15
export const ACTIVE_APPOINTMENT_STATES = ['pending_payment', 'confirmed'] as const

export function formatXof(amount: number, locale = 'fr-BJ'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(amount)
}

export function formatDateTime(value: string | Date, locale = 'fr-BJ'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: SALON_TIMEZONE,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(value))
}
