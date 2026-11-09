import { describe,expect,it } from 'vitest'
import { isWithinCalendar, isWithinSchedule } from '../../server/services/availability'

const schedule={opensAt:'09:00',closesAt:'18:00',breakStartsAt:'12:30',breakEndsAt:'13:30'}
describe('contrôle des horaires',()=>{
  it('accepte un rendez-vous qui termine juste avant la pause',()=>expect(isWithinSchedule(660,750,schedule)).toBe(true))
  it('refuse tout chevauchement de la pause',()=>expect(isWithinSchedule(735,795,schedule)).toBe(false))
  it('accepte un rendez-vous qui commence exactement à la fin de pause',()=>expect(isWithinSchedule(810,870,schedule)).toBe(true))
  it('refuse un rendez-vous qui dépasse la fermeture',()=>expect(isWithinSchedule(1050,1110,schedule)).toBe(false))
  it('refuse un début avant ouverture',()=>expect(isWithinSchedule(525,585,schedule)).toBe(false))
  it('accepte une exception extra_hours hors horaire habituel',()=>expect(isWithinCalendar(new Date('2026-06-02T06:30:00.000Z'),new Date('2026-06-02T07:30:00.000Z'),'2026-06-02',[],[{startsAt:new Date('2026-06-02T06:00:00.000Z'),endsAt:new Date('2026-06-02T08:00:00.000Z'),kind:'extra_hours',staffId:null}])).toBe(true))
  it('ne laisse pas extra_hours contourner une pause',()=>expect(isWithinCalendar(new Date('2026-06-02T11:40:00.000Z'),new Date('2026-06-02T12:00:00.000Z'),'2026-06-02',[schedule],[])).toBe(false))
  it('refuse une fermeture exceptionnelle qui recouvre le créneau',()=>expect(isWithinCalendar(new Date('2026-06-02T08:30:00.000Z'),new Date('2026-06-02T09:30:00.000Z'),'2026-06-02',[schedule],[{startsAt:new Date('2026-06-02T09:00:00.000Z'),endsAt:new Date('2026-06-02T10:00:00.000Z'),kind:'closed',staffId:null}])).toBe(false))
})
