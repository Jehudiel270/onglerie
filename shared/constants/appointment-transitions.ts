const allowedTransitions: Record<string, readonly string[]> = {
  pending_payment: ['confirmed', 'cancelled'],
  confirmed: ['cancelled', 'completed', 'no_show'],
  cancelled: [],
  expired: [],
  completed: [],
  no_show: [],
}

export function isAllowedAppointmentTransition(current: string, next: string): boolean {
  return current === next || (allowedTransitions[current]?.includes(next) ?? false)
}
