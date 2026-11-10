import { and, desc, eq, gte, inArray } from 'drizzle-orm'
import { defineEventHandler, setHeader } from 'h3'
import { fromZonedTime } from 'date-fns-tz'
import { SALON_TIMEZONE } from '~~/shared/constants/business'
import { canSeeRevenue } from '~~/shared/constants/rbac'
import { requireSalonRole } from '../../utils/admin-guard'
import { appointmentServices, appointments, customers, payments, services } from '../../db/schema'

const localDateKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: SALON_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)

export default defineEventHandler(async(event)=>{
  setHeader(event,'Cache-Control','private, no-store, max-age=0')
  const{db,salonId,role}=await requireSalonRole(event,['owner','reception'])
  const owner=canSeeRevenue(role)
  const localDate=localDateKey(new Date())
  const start=fromZonedTime(`${localDate}T00:00:00`,SALON_TIMEZONE),end=fromZonedTime(`${localDate}T23:59:59.999`,SALON_TIMEZONE)
  const todayRows=await db.select().from(appointments).where(and(eq(appointments.salonId,salonId),gte(appointments.startsAt,start))).orderBy(appointments.startsAt)
  const allRecent=await db.select().from(appointments).where(and(eq(appointments.salonId,salonId),gte(appointments.createdAt,new Date(Date.now()-30*86400000))))
  const paymentRows=owner?await db.select().from(payments).where(and(eq(payments.salonId,salonId),eq(payments.status,'paid'),eq(payments.reconciled,true),gte(payments.paidAt,new Date(Date.now()-183*86400000)))):[]
  const customerRows=await db.select({createdAt:customers.createdAt}).from(customers).where(eq(customers.salonId,salonId))
  const serviceRows=await db.select({name:appointmentServices.serviceNameSnapshot,price:appointmentServices.priceSnapshotXof}).from(appointmentServices).innerJoin(appointments,eq(appointmentServices.appointmentId,appointments.id)).where(and(eq(appointments.salonId,salonId),inArray(appointments.status,['confirmed','completed'])))
  const popular=new Map<string,{visits:number;revenue:number}>();for(const row of serviceRows){const value=popular.get(row.name)||{visits:0,revenue:0};value.visits++;if(owner)value.revenue+=row.price;popular.set(row.name,value)}
  const counts={today:todayRows.filter((row)=>row.startsAt>=start&&row.startsAt<=end).length,upcoming:todayRows.filter((row)=>row.startsAt>end&&['confirmed','pending_payment'].includes(row.status)).length,pending:allRecent.filter((row)=>row.status==='pending_payment'&&(!row.expiresAt||row.expiresAt>new Date())).length,confirmed:allRecent.filter((row)=>row.status==='confirmed').length,cancelled:allRecent.filter((row)=>row.status==='cancelled').length,newCustomers:customerRows.filter((row)=>row.createdAt>=new Date(Date.now()-30*86400000)).length}
  // CA mensuel sur 6 mois (paiements réconciliés, propriétaire uniquement).
  const monthly=new Map<string,number>()
  for(let offset=5;offset>=0;offset--){const ref=new Date();ref.setUTCDate(1);ref.setUTCMonth(ref.getUTCMonth()-offset);monthly.set(`${ref.getUTCFullYear()}-${String(ref.getUTCMonth()+1).padStart(2,'0')}`,0)}
  for(const row of paymentRows){if(!row.paidAt)continue;const key=`${row.paidAt.getUTCFullYear()}-${String(row.paidAt.getUTCMonth()+1).padStart(2,'0')}`;if(monthly.has(key))monthly.set(key,(monthly.get(key)||0)+row.amountXof)}
  // Charge prévisionnelle : rendez-vous confirmés/attente sur les 7 prochains jours.
  const upcoming=new Map<string,number>()
  for(let offset=0;offset<7;offset++){const day=new Date(start.getTime()+offset*86400000);upcoming.set(localDateKey(day),0)}
  for(const row of todayRows){if(!['confirmed','pending_payment'].includes(row.status))continue;const key=localDateKey(row.startsAt);if(upcoming.has(key))upcoming.set(key,(upcoming.get(key)||0)+1)}
  return{counts,role,...(owner?{receivedLast30Days:paymentRows.filter((row)=>row.paidAt&&row.paidAt>=new Date(Date.now()-30*86400000)).reduce((sum,row)=>sum+row.amountXof,0),awaitingDepositXof:allRecent.filter((row)=>row.status==='pending_payment').reduce((sum,row)=>sum+Math.max(0,row.depositDueXof-row.amountPaidXof),0),revenueMonthly:[...monthly].map(([month,amountXof])=>({month,amountXof}))}:{}),upcomingByDay:[...upcoming].map(([day,count])=>({day,count})),popularServices:[...popular].map(([name,value])=>({name,visits:value.visits,...(owner?{revenue:value.revenue}:{})})).sort((a,b)=>b.visits-a.visits).slice(0,5),recentAppointments:allRecent.sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime()).slice(0,8).map((row)=>({id:row.id,reference:row.reference,status:row.status,startsAt:row.startsAt.toISOString(),...(owner?{totalXof:row.totalXof,amountPaidXof:row.amountPaidXof}:{})}))}
})
