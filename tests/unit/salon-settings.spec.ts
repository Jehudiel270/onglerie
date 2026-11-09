import { describe, expect, it } from 'vitest'
import { normalizeSalonAppearance } from '../../shared/constants/appearance'
import { calculateDeposit } from '../../server/services/salon-settings'

describe('calcul de l’acompte salon', () => {
  it('privilégie le dépôt fixe et applique le pourcentage aux services sans montant fixe', () => {
    expect(calculateDeposit([{ priceXof: 10000, depositXof: 2500 }, { priceXof: 5000, depositXof: 0 }], 20)).toEqual({ totalXof: 15000, depositDueXof: 3500 })
  })
  it('plafonne un acompte fixe au montant total', () => {
    expect(calculateDeposit([{ priceXof: 1000, depositXof: 2500 }], 0)).toEqual({ totalXof: 1000, depositDueXof: 1000 })
  })
  it('autorise un acompte nul uniquement si le salon ne le configure pas', () => {
    expect(calculateDeposit([{ priceXof: 10000, depositXof: 0 }], 0)).toEqual({ totalXof: 10000, depositDueXof: 0 })
  })
})

describe('normalisation de l’apparence salon', () => {
  it('conserve seulement les styles de boutons autorisés', () => {
    expect(normalizeSalonAppearance({ buttonStyle: 'square' }).buttonStyle).toBe('square')
    expect(normalizeSalonAppearance({ buttonStyle: 'pill' }).buttonStyle).toBe('pill')
    expect(normalizeSalonAppearance({ buttonStyle: 'invalid' }).buttonStyle).toBe('pill')
    expect(normalizeSalonAppearance(undefined).buttonStyle).toBe('pill')
  })
})
