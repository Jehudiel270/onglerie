import { and,eq,gt,inArray,isNull,lt,or } from 'drizzle-orm'
import { formatInTimeZone,fromZonedTime } from 'date-fns-tz'
import { ACTIVE_APPOINTMENT_STATES,SALON_TIMEZONE,SLOT_STEP_MINUTES } from '~~/shared/constants/business'
import type { AvailabilitySlot } from '~~/shared/types/catalog'
import { getDatabase } from '../db/client'
import { appointments,scheduleExceptions,services,staff,staffSchedules,staffServices } from '../db/schema'
import { getSalonBookingSettings } from './salon-settings'
import { findPrimarySalon } from './salon'

type ScheduleWindow={opensAt:string;closesAt:string;breakStartsAt:string|null;breakEndsAt:string|null}
type CalendarException={startsAt:Date;endsAt:Date;kind:string;staffId:string|null}
function minutes(value:string){const[hours='0',mins='0']=value.split(':');return Number(hours)*60+Number(mins)}
function weekdayFor(date:string){const[year='0',month='1',day='1']=date.split('-');return new Date(Date.UTC(Number(year),Number(month)-1,Number(day),12)).getUTCDay()}
export function isWithinSchedule(startMinute:number,endMinute:number,schedule:ScheduleWindow){
  if(startMinute<minutes(schedule.opensAt)||endMinute>minutes(schedule.closesAt))return false
  if(schedule.breakStartsAt&&schedule.breakEndsAt){const breakStart=minutes(schedule.breakStartsAt),breakEnd=minutes(schedule.breakEndsAt);if(startMinute<breakEnd&&endMinute>breakStart)return false}
  return true
}
function extraWindow(date:string,exception:CalendarException):{start:number;end:number}|null{
  const startDate=formatInTimeZone(exception.startsAt,SALON_TIMEZONE,'yyyy-MM-dd'),endDate=formatInTimeZone(exception.endsAt,SALON_TIMEZONE,'yyyy-MM-dd')
  if(startDate>date||endDate<date)return null
  const start=startDate===date?minutes(formatInTimeZone(exception.startsAt,SALON_TIMEZONE,'HH:mm')):0
  const end=endDate===date?minutes(formatInTimeZone(exception.endsAt,SALON_TIMEZONE,'HH:mm')):1440
  return end>start?{start,end}:null
}
export function isWithinCalendar(startAt:Date,endAt:Date,date:string,schedules:ScheduleWindow[],exceptions:CalendarException[]){
  if(formatInTimeZone(startAt,SALON_TIMEZONE,'yyyy-MM-dd')!==date||formatInTimeZone(endAt,SALON_TIMEZONE,'yyyy-MM-dd')!==date)return false
  const start=minutes(formatInTimeZone(startAt,SALON_TIMEZONE,'HH:mm')),end=minutes(formatInTimeZone(endAt,SALON_TIMEZONE,'HH:mm'))
  if(end<=start)return false
  const blocked=exceptions.some((item)=>item.kind!=='extra_hours'&&item.startsAt<endAt&&item.endsAt>startAt)
  if(blocked)return false
  const breakBlocked=schedules.some((item)=>item.breakStartsAt&&item.breakEndsAt&&start<minutes(item.breakEndsAt)&&end>minutes(item.breakStartsAt))
  if(breakBlocked)return false
  const ordinary=schedules.some((item)=>isWithinSchedule(start,end,item))
  const extended=exceptions.some((item)=>item.kind==='extra_hours'&&(()=>{const range=extraWindow(date,item);return range!==null&&start>=range.start&&end<=range.end})())
  return ordinary||extended
}

export async function getAvailableSlots(input:{date:string;serviceIds:string[];staffId?:string|null;salonId?:string}):Promise<AvailabilitySlot[]>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||input.serviceIds.length===0||input.serviceIds.length>6||input.serviceIds.length!==new Set(input.serviceIds).size)return[]
  const db=getDatabase(),salon=input.salonId?null:await findPrimarySalon(),salonId=input.salonId??salon?.id
  if(!salonId)return[]
  const settings=await getSalonBookingSettings(salonId),now=new Date(),earliest=new Date(now.getTime()+settings.minAdvanceHours*60*60_000),latest=new Date(now.getTime()+settings.maxAdvanceDays*24*60*60_000)
  const dayStart=fromZonedTime(`${input.date}T00:00:00`,SALON_TIMEZONE),dayEnd=fromZonedTime(`${input.date}T23:59:59.999`,SALON_TIMEZONE)
  if(dayEnd<earliest||dayStart>latest)return[]
  const selectedServices=await db.select().from(services).where(and(eq(services.salonId,salonId),eq(services.active,true),inArray(services.id,input.serviceIds)))
  if(selectedServices.length!==input.serviceIds.length)return[]
  const totalMinutes=selectedServices.reduce((sum,item)=>sum+item.durationMinutes+item.preparationMinutes,0)
  const blockedAppointments=await db.select({staffId:appointments.staffId,startsAt:appointments.startsAt,endsAt:appointments.endsAt}).from(appointments).where(and(eq(appointments.salonId,salonId),lt(appointments.startsAt,dayEnd),gt(appointments.endsAt,dayStart),or(eq(appointments.status,ACTIVE_APPOINTMENT_STATES[1]),and(eq(appointments.status,ACTIVE_APPOINTMENT_STATES[0]),or(isNull(appointments.expiresAt),gt(appointments.expiresAt,now))))))
  const dayExceptions=await db.select().from(scheduleExceptions).where(and(eq(scheduleExceptions.salonId,salonId),lt(scheduleExceptions.startsAt,dayEnd),gt(scheduleExceptions.endsAt,dayStart)))
  const eligibleRows=await Promise.all(selectedServices.map((item)=>db.select({staffId:staffServices.staffId}).from(staffServices).where(and(eq(staffServices.salonId,salonId),eq(staffServices.serviceId,item.id)))))
  let eligibleIds=eligibleRows.map((rows)=>new Set(rows.map((row)=>row.staffId))).reduce((left,right)=>new Set([...left].filter((id)=>right.has(id))))
  if(input.staffId)eligibleIds=new Set([...eligibleIds].filter((id)=>id===input.staffId))
  if(!eligibleIds.size)return[]
  const professionals=await db.select({id:staff.id,firstName:staff.firstName,lastName:staff.lastName}).from(staff).where(and(eq(staff.salonId,salonId),eq(staff.active,true),inArray(staff.id,[...eligibleIds])))
  const weekday=weekdayFor(input.date),slots:AvailabilitySlot[]=[],seen=new Set<string>()
  for(const professional of professionals){
    const schedules=await db.select().from(staffSchedules).where(and(eq(staffSchedules.salonId,salonId),eq(staffSchedules.weekday,weekday),eq(staffSchedules.active,true),or(eq(staffSchedules.staffId,professional.id),isNull(staffSchedules.staffId))))
    const individual=schedules.filter((item)=>item.staffId===professional.id),applicable=(individual.length?individual:schedules.filter((item)=>item.staffId===null)) as ScheduleWindow[]
    const relevantExceptions=dayExceptions.filter((item)=>!item.staffId||item.staffId===professional.id) as CalendarException[]
    const busy=blockedAppointments.filter((item)=>item.staffId===professional.id)
    const windows=applicable.map((schedule)=>({start:minutes(schedule.opensAt),end:minutes(schedule.closesAt)}))
    for(const exception of relevantExceptions){if(exception.kind==='extra_hours'){const range=extraWindow(input.date,exception);if(range)windows.push(range)}}
    for(const window of windows){
      const firstStart=Math.ceil(window.start/SLOT_STEP_MINUTES)*SLOT_STEP_MINUTES
      for(let start=firstStart;start+totalMinutes<=window.end;start+=SLOT_STEP_MINUTES){
        const localStart=`${input.date}T${String(Math.floor(start/60)).padStart(2,'0')}:${String(start%60).padStart(2,'0')}:00`,endMinute=start+totalMinutes
        const localEnd=`${input.date}T${String(Math.floor(endMinute/60)).padStart(2,'0')}:${String(endMinute%60).padStart(2,'0')}:00`,startsAt=fromZonedTime(localStart,SALON_TIMEZONE),endsAt=fromZonedTime(localEnd,SALON_TIMEZONE)
        if(startsAt<earliest||startsAt>latest||startsAt<=now||!isWithinCalendar(startsAt,endsAt,input.date,applicable,relevantExceptions))continue
        if(busy.some((appointment)=>appointment.startsAt<endsAt&&appointment.endsAt>startsAt))continue
        const key=`${professional.id}:${startsAt.toISOString()}`;if(seen.has(key))continue;seen.add(key)
        slots.push({startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString(),staffId:professional.id,staffName:[professional.firstName,professional.lastName].filter(Boolean).join(' ')})
      }
    }
  }
  return slots.sort((a,b)=>a.startsAt.localeCompare(b.startsAt))
}
