import { and, desc, eq } from 'drizzle-orm'
import { defineEventHandler, setHeader } from 'h3'
import { requireCustomer } from '../../utils/customer-guard'
import { getDatabase } from '../../db/client'
import { appointmentServices, appointments } from '../../db/schema'

export default defineEventHandler(async(event)=>{
  setHeader(event,'Cache-Control','private, no-store, max-age=0')
  const{customer,salonId}=await requireCustomer(event),db=getDatabase()
  const rows=await db.select().from(appointments).where(and(eq(appointments.customerId,customer.id),eq(appointments.salonId,salonId))).orderBy(desc(appointments.startsAt))
  const list=[]
  for(const appointment of rows){const services=await db.select({name:appointmentServices.serviceNameSnapshot,priceXof:appointmentServices.priceSnapshotXof}).from(appointmentServices).where(eq(appointmentServices.appointmentId,appointment.id));list.push({id:appointment.id,reference:appointment.reference,status:appointment.status,startsAt:appointment.startsAt.toISOString(),endsAt:appointment.endsAt.toISOString(),totalXof:appointment.totalXof,depositDueXof:appointment.depositDueXof,amountPaidXof:appointment.amountPaidXof,remainingXof:Math.max(0,appointment.totalXof-appointment.amountPaidXof),services})}
  return{profile:{firstName:customer.firstName,lastName:customer.lastName,phone:customer.phone,whatsapp:customer.whatsapp,email:customer.email},appointments:list}
})
