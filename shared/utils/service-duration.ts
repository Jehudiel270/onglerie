export type ServiceDuration = {
  durationMinutes: number
  preparationMinutes?: number | null
}

export function totalScheduledDurationMinutes(services: readonly ServiceDuration[]): number {
  return services.reduce((total, service) => {
    const duration = Number.isFinite(service.durationMinutes)
      ? Math.max(0, Math.trunc(service.durationMinutes))
      : 0
    const preparation = Number.isFinite(service.preparationMinutes)
      ? Math.max(0, Math.trunc(service.preparationMinutes ?? 0))
      : 0
    return total + duration + preparation
  }, 0)
}
