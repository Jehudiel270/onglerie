import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, setHeader } from 'h3'
import { z } from 'zod'
import { requireCustomer } from '../../../utils/customer-guard'
import { getDatabase } from '../../../db/client'
import { appointmentServices, appointments, appointmentStatusHistory, customerAppointmentRequests, payments, staff } from '../../../db/schema'

export default defineEventHandler(async(event)=>{
  setHeader(event,'Cache-Control','private, no-store, max-age=0')
  const{customer,salonId}=await requireCustomer(event)
  const id=getRouterParam(event,'id')||''
  if(!z.string().uuid().safeParse(id).success)throw createError({statusCode:400,statusMessage:'Identifiant de rendez-vous invalide.'})
  const db=getDatabase()
  const [row]=await db.select({appointment:appointments,staffName:staff.firstName,staffLastName:staff.lastName}).from(appointments)
    .leftJoin(staff,and(eq(appointments.staffId,staff.id),eq(appointments.salonId,staff.salonId)))
    .where(and(eq(appointments.id,id),eq(appointments.salonId,salonId),eq(appointments.customerId,customer.id))).limit(1)
  if(!row)throw createError({statusCode:404,statusMessage:'Rendez-vous introuvable.'})
  const[items,history,requests,paymentRows]=await Promise.all([
    db.select({name:appointmentServices.serviceNameSnapshot,priceXof:appointmentServices.priceSnapshotXof,durationMinutes:appointmentServices.durationSnapshotMinutes}).from(appointmentServices).where(eq(appointmentServices.appointmentId,id)),
    db.select({fromStatus:appointmentStatusHistory.fromStatus,toStatus:appointmentStatusHistory.toStatus,reason:appointmentStatusHistory.reason,createdAt:appointmentStatusHistory.createdAt}).from(appointmentStatusHistory).where(and(eq(appointmentStatusHistory.appointmentId,id),eq(appointmentStatusHistory.salonId,salonId))),
    db.select({type:customerAppointmentRequests.type,requestedFor:customerAppointmentRequests.requestedFor,status:customerAppointmentRequests.status,createdAt:customerAppointmentRequests.createdAt}).from(customerAppointmentRequests).where(and(eq(customerAppointmentRequests.appointmentId,id),eq(customerAppointmentRequests.customerId,customer.id),eq(customerAppointmentRequests.salonId,salonId))),
    db.select({amountXof:payments.amountXof,status:payments.status,currency:payments.currency,paidAt:payments.paidAt}).from(payments).where(and(eq(payments.appointmentId,id),eq(payments.salonId,salonId)))
  ])
  const a=row.appointment
  return{appointment:{id:a.id,reference:a.reference,status:a.status,startsAt:a.startsAt.toISOString(),endsAt:a.endsAt.toISOString(),services:items,staffName:[row.staffName,row.staffLastName].filter(Boolean).join(' ')||'Équipe du salon',totalXof:a.totalXof,depositDueXof:a.depositDueXof,amountPaidXof:a.amountPaidXof,remainingXof:Math.max(0,a.totalXof-a.amountPaidXof),payments:paymentRows,history,requests}}
})
