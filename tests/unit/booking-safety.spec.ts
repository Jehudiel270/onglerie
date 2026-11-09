import { describe, expect, it } from 'vitest'
import { isAllowedAppointmentTransition } from '../../shared/constants/appointment-transitions'
import { totalScheduledDurationMinutes } from '../../shared/utils/service-duration'

describe('durée réellement occupée', () => {
  it('inclut la préparation de chaque prestation sélectionnée', () => {
    expect(totalScheduledDurationMinutes([
      { durationMinutes: 45, preparationMinutes: 10 },
      { durationMinutes: 30, preparationMinutes: 5 },
    ])).toBe(90)
  })

  it('accepte les prestations de démonstration sans temps de préparation explicite', () => {
    expect(totalScheduledDurationMinutes([{ durationMinutes: 35 }])).toBe(35)
  })
})

describe('transitions rendez-vous', () => {
  it('autorise confirmation/annulation d’une réservation en attente et clôture d’un rendez-vous confirmé', () => {
    expect(isAllowedAppointmentTransition('pending_payment', 'confirmed')).toBe(true)
    expect(isAllowedAppointmentTransition('pending_payment', 'cancelled')).toBe(true)
    expect(isAllowedAppointmentTransition('confirmed', 'completed')).toBe(true)
  })

  it('interdit de réactiver une réservation annulée, expirée, terminée ou sans présentation', () => {
    for (const terminal of ['cancelled', 'expired', 'completed', 'no_show']) {
      expect(isAllowedAppointmentTransition(terminal, 'confirmed')).toBe(false)
    }
  })
})
