import { describe,expect,it } from 'vitest'
import { bookingRequestSchema,contactRequestSchema,normalizeBeninPhone } from '../../shared/schemas/booking'

describe('numéros béninois',()=>{
  it('normalise huit chiffres en E.164',()=>expect(normalizeBeninPhone('97 00 00 00')).toBe('+22997000000'))
  it('ne préfixe pas deux fois un numéro international béninois',()=>expect(normalizeBeninPhone('+229 97-00-00-00')).toBe('+22997000000'))
})
describe('validation des consentements',()=>{
  const booking={serviceIds:['d2e217bb-cadf-4672-bb17-4e09cc2d5058'],staffId:null,startsAt:'2027-01-05T09:00:00+01:00',firstName:'Amina',lastName:'Doe',phone:'97000000',idempotencyKey:'b14dc205-ff2b-46c6-8de0-33101287c8aa',termsAccepted:true}
  it('accepte une réservation invitée bien formée',()=>expect(bookingRequestSchema.safeParse(booking).success).toBe(true))
  it('refuse une réservation sans consentement',()=>expect(bookingRequestSchema.safeParse({...booking,termsAccepted:false}).success).toBe(false))
  it('refuse un numéro béninois trop court',()=>expect(bookingRequestSchema.safeParse({...booking,phone:'123'}).success).toBe(false))
  it('refuse le honeypot rempli du formulaire contact',()=>expect(contactRequestSchema.safeParse({name:'Amina Doe',phone:'97000000',message:'Question sur une prestation ici',privacyAccepted:true,website:'spam'}).success).toBe(false))
})
