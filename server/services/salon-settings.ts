import { eq } from 'drizzle-orm'
import { DEFAULT_HOLD_MINUTES } from '~~/shared/constants/business'
import { normalizeSalonAppearance, type SalonAppearance } from '~~/shared/constants/appearance'
import { getDatabase } from '../db/client'
import { salonSettings } from '../db/schema'

export type SalonBookingSettings={holdMinutes:number;minAdvanceHours:number;maxAdvanceDays:number;depositPercent:number;cancellationPolicy:string;remindersEnabled:boolean;reminderHours:number[]}
export const DEFAULT_SALON_BOOKING_SETTINGS:SalonBookingSettings={holdMinutes:DEFAULT_HOLD_MINUTES,minAdvanceHours:2,maxAdvanceDays:60,depositPercent:0,cancellationPolicy:'',remindersEnabled:true,reminderHours:[24,2]}
function boundedNumber(value:unknown,fallback:number,min:number,max:number){return typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,Math.trunc(value))):fallback}
export async function getSalonBookingSettings(salonId:string):Promise<SalonBookingSettings>{
  const[record]=await getDatabase().select({settings:salonSettings.settings}).from(salonSettings).where(eq(salonSettings.salonId,salonId)).limit(1)
  const raw=record?.settings??{}
  const reminders=Array.isArray(raw.reminderHours)?raw.reminderHours.filter((value):value is number=>typeof value==='number'&&Number.isInteger(value)&&value>=1&&value<=168).slice(0,3):DEFAULT_SALON_BOOKING_SETTINGS.reminderHours
  return{holdMinutes:boundedNumber(raw.holdMinutes,DEFAULT_SALON_BOOKING_SETTINGS.holdMinutes,5,30),minAdvanceHours:boundedNumber(raw.minAdvanceHours,DEFAULT_SALON_BOOKING_SETTINGS.minAdvanceHours,0,720),maxAdvanceDays:boundedNumber(raw.maxAdvanceDays,DEFAULT_SALON_BOOKING_SETTINGS.maxAdvanceDays,1,365),depositPercent:boundedNumber(raw.depositPercent,DEFAULT_SALON_BOOKING_SETTINGS.depositPercent,0,100),cancellationPolicy:typeof raw.cancellationPolicy==='string'?raw.cancellationPolicy.slice(0,2000):'',remindersEnabled:typeof raw.remindersEnabled==='boolean'?raw.remindersEnabled:DEFAULT_SALON_BOOKING_SETTINGS.remindersEnabled,reminderHours:reminders}
}
export async function getSalonAppearanceSettings(salonId:string):Promise<SalonAppearance>{
  const[record]=await getDatabase().select({settings:salonSettings.settings}).from(salonSettings).where(eq(salonSettings.salonId,salonId)).limit(1)
  return normalizeSalonAppearance(record?.settings)
}
export function calculateDeposit(items:ReadonlyArray<{priceXof:number;depositXof:number}>,depositPercent:number){
  const totalXof=items.reduce((sum,item)=>sum+item.priceXof,0)
  const due=items.reduce((sum,item)=>sum+(item.depositXof>0?item.depositXof:Math.round(item.priceXof*depositPercent/100)),0)
  return{totalXof,depositDueXof:Math.min(totalXof,due)}
}
