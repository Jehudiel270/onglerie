import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm'
import { createError, defineEventHandler, getQuery, setHeader } from 'h3'
import { z } from 'zod'
import { requireSalonRole } from '../../utils/admin-guard'
import { appointmentServices, appointments, categories, contactMessages, customers, notificationLogs, notificationOutbox, payments, portfolioItemTags, portfolioItems, portfolioTags, salonSettings, salons, scheduleExceptions, services, siteContent, staff, staffSchedules, staffServices } from '../../db/schema'
import { DEFAULT_SALON_APPEARANCE } from '~~/shared/constants/appearance'
import { DEFAULT_SALON_BOOKING_SETTINGS } from '../../services/salon-settings'

const resources=['services','categories','portfolio','staff','schedules','exceptions','customers','payments','notifications','content','settings','salon','contacts'] as const
export default defineEventHandler(async(event)=>{
  setHeader(event,'Cache-Control','private, no-store, max-age=0')
  const {db,salonId}=await requireSalonRole(event,['owner','manager'])
  const query=z.object({resource:z.enum(resources),q:z.string().trim().max(100).optional()}).safeParse(getQuery(event))
  if(!query.success)throw createError({statusCode:400,statusMessage:'Ressource de gestion invalide.'})
  const {resource,q}=query.data
  switch(resource){
    case 'services':{
      const rows=await db.select({service:services,categoryName:categories.name,categorySlug:categories.slug}).from(services).leftJoin(categories,and(eq(services.categoryId,categories.id),eq(services.salonId,categories.salonId))).where(eq(services.salonId,salonId)).orderBy(asc(services.position),asc(services.name))
      return{items:rows.map((row)=>({...row.service,categoryName:row.categoryName,categorySlug:row.categorySlug}))}
    }
    case 'categories':return{items:await db.select().from(categories).where(eq(categories.salonId,salonId)).orderBy(asc(categories.kind),asc(categories.position),asc(categories.name))}
    case 'portfolio':{
      const rows=await db.select({item:portfolioItems,categoryName:categories.name}).from(portfolioItems).leftJoin(categories,and(eq(portfolioItems.categoryId,categories.id),eq(portfolioItems.salonId,categories.salonId))).where(eq(portfolioItems.salonId,salonId)).orderBy(desc(portfolioItems.createdAt)).limit(300)
      const items=[]
      for(const row of rows){const tags=await db.select({name:portfolioTags.name}).from(portfolioItemTags).innerJoin(portfolioTags,eq(portfolioItemTags.tagId,portfolioTags.id)).where(eq(portfolioItemTags.portfolioItemId,row.item.id));items.push({...row.item,categoryName:row.categoryName,tags:tags.map((tag)=>tag.name)})}
      return{items}
    }
    case 'staff':{
      const people=await db.select().from(staff).where(eq(staff.salonId,salonId)).orderBy(asc(staff.firstName))
      const items=[]
      for(const person of people){const assigned=await db.select({id:staffServices.serviceId,name:services.name}).from(staffServices).innerJoin(services,and(eq(staffServices.serviceId,services.id),eq(staffServices.salonId,services.salonId))).where(and(eq(staffServices.staffId,person.id),eq(staffServices.salonId,salonId)));const hours=await db.select().from(staffSchedules).where(and(eq(staffSchedules.salonId,salonId),eq(staffSchedules.staffId,person.id)));items.push({...person,serviceIds:assigned.map((row)=>row.id),services:assigned,schedules:hours})}
      return{items}
    }
    case 'schedules':return{items:await db.select().from(staffSchedules).where(eq(staffSchedules.salonId,salonId)).orderBy(asc(staffSchedules.weekday))}
    case 'exceptions':return{items:await db.select().from(scheduleExceptions).where(eq(scheduleExceptions.salonId,salonId)).orderBy(desc(scheduleExceptions.startsAt)).limit(200)}
    case 'customers':{
      const rows=await db.select().from(customers).where(eq(customers.salonId,salonId)).orderBy(desc(customers.updatedAt)).limit(300)
      const appointmentsForCustomers=rows.length?await db.select().from(appointments).where(and(eq(appointments.salonId,salonId),inArray(appointments.customerId,rows.map((row)=>row.id)))):[]
      const paidRows=rows.length?await db.select({customerId:appointments.customerId,amount:payments.amountXof}).from(payments).innerJoin(appointments,eq(payments.appointmentId,appointments.id)).where(and(eq(payments.salonId,salonId),eq(payments.status,'paid'),eq(payments.reconciled,true),inArray(appointments.customerId,rows.map((row)=>row.id)))):[]
      const qtext=q?.toLocaleLowerCase('fr')
      return{items:rows.filter((row)=>!qtext||`${row.firstName} ${row.lastName} ${row.phone} ${row.email||''}`.toLocaleLowerCase('fr').includes(qtext)).map((row)=>{const history=appointmentsForCustomers.filter((item)=>item.customerId===row.id);return{...row,visitCount:history.filter((item)=>item.status==='completed').length,lastVisit:history.filter((item)=>item.status==='completed').sort((a,b)=>b.startsAt.getTime()-a.startsAt.getTime())[0]?.startsAt.toISOString()||null,paidTotalXof:paidRows.filter((item)=>item.customerId===row.id).reduce((sum,item)=>sum+item.amount,0)}})}
    }
    case 'payments':{
      const rows=await db.select({payment:payments,reference:appointments.reference,startsAt:appointments.startsAt,customerName:customers.firstName,customerLastName:customers.lastName}).from(payments).innerJoin(appointments,and(eq(payments.appointmentId,appointments.id),eq(payments.salonId,appointments.salonId))).innerJoin(customers,and(eq(appointments.customerId,customers.id),eq(appointments.salonId,customers.salonId))).where(eq(payments.salonId,salonId)).orderBy(desc(payments.createdAt)).limit(300)
      return{items:rows.map((row)=>({...row.payment,reference:row.reference,startsAt:row.startsAt.toISOString(),customerName:`${row.customerName} ${row.customerLastName}`}))}
    }
    case 'notifications':{
      const[outbox,logs]=await Promise.all([db.select().from(notificationOutbox).where(eq(notificationOutbox.salonId,salonId)).orderBy(desc(notificationOutbox.createdAt)).limit(150),db.select().from(notificationLogs).where(eq(notificationLogs.salonId,salonId)).orderBy(desc(notificationLogs.attemptedAt)).limit(150)])
      const items=outbox.map((row)=>row.templateKey==='booking_recovery_code'?{...row,recipient:'[masqué]',payload:{reference:row.payload.reference,expiresMinutes:row.payload.expiresMinutes}}:row)
      return{items,logs}
    }
    case 'content':return{items:await db.select().from(siteContent).where(eq(siteContent.salonId,salonId)).orderBy(asc(siteContent.contentKey))}
    case 'settings':{
      const[salon]=await db.select().from(salons).where(eq(salons.id,salonId)).limit(1)
      const[settings]=await db.select().from(salonSettings).where(eq(salonSettings.salonId,salonId)).limit(1)
      const values={...DEFAULT_SALON_BOOKING_SETTINGS,...DEFAULT_SALON_APPEARANCE,...(settings?.settings||{})}
      return{salon,settings:values,items:[{...(settings?{id:settings.id}:{}),...values}]}
    }
    case 'salon':return{items:await db.select().from(salons).where(eq(salons.id,salonId)).limit(1)}
    case 'contacts':return{items:await db.select().from(contactMessages).where(eq(contactMessages.salonId,salonId)).orderBy(desc(contactMessages.createdAt)).limit(200)}
  }
})
