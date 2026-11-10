import { and,desc,eq } from 'drizzle-orm'
import { createError,defineEventHandler,getRouterParam,setHeader } from 'h3'
import { z } from 'zod'
import { requireSalonRole } from '../../../utils/admin-guard'
import { appointmentServices,appointmentStatusHistory,appointments,customers,payments,staff } from '../../../db/schema'
export default defineEventHandler(async(event)=>{
  setHeader(event,'Cache-Control','private, no-store, max-age=0')
  const{db,salonId}=await requireSalonRole(event,['owner','reception']),id=getRouterParam(event,'id')||''
  if(!z.string().uuid().safeParse(id).success)throw createError({statusCode:400,statusMessage:'Identifiant de rendez-vous invalide.'})
  const[appointment]=await db.select({appointment:appointments,customer:customers,staffFirst:staff.firstName,staffLast:staff.lastName}).from(appointments).innerJoin(customers,and(eq(appointments.customerId,customers.id),eq(appointments.salonId,customers.salonId))).leftJoin(staff,and(eq(appointments.staffId,staff.id),eq(appointments.salonId,staff.salonId))).where(and(eq(appointments.id,id),eq(appointments.salonId,salonId))).limit(1)
  if(!appointment)throw createError({statusCode:404,statusMessage:'Rendez-vous introuvable.'})
  const[servicesList,paymentList,history]=await Promise.all([
    db.select({name:appointmentServices.serviceNameSnapshot,priceXof:appointmentServices.priceSnapshotXof,durationMinutes:appointmentServices.durationSnapshotMinutes}).from(appointmentServices).where(eq(appointmentServices.appointmentId,id)),
    db.select({id:payments.id,provider:payments.provider,reference:payments.providerReference,amountXof:payments.amountXof,currency:payments.currency,method:payments.method,status:payments.status,reconciled:payments.reconciled,paidAt:payments.paidAt}).from(payments).where(and(eq(payments.appointmentId,id),eq(payments.salonId,salonId))).orderBy(desc(payments.createdAt)),
    db.select({fromStatus:appointmentStatusHistory.fromStatus,toStatus:appointmentStatusHistory.toStatus,reason:appointmentStatusHistory.reason,createdAt:appointmentStatusHistory.createdAt}).from(appointmentStatusHistory).where(and(eq(appointmentStatusHistory.appointmentId,id),eq(appointmentStatusHistory.salonId,salonId))).orderBy(desc(appointmentStatusHistory.createdAt)),
  ])
  return{appointment:{id,reference:appointment.appointment.reference,status:appointment.appointment.status,startsAt:appointment.appointment.startsAt.toISOString(),endsAt:appointment.appointment.endsAt.toISOString(),expiresAt:appointment.appointment.expiresAt?.toISOString()??null,customer:{id:appointment.customer.id,name:`${appointment.customer.firstName} ${appointment.customer.lastName}`,phone:appointment.customer.phone,whatsapp:appointment.customer.whatsapp,email:appointment.customer.email},staffName:[appointment.staffFirst,appointment.staffLast].filter(Boolean).join(' '),services:servicesList,totalXof:appointment.appointment.totalXof,depositDueXof:appointment.appointment.depositDueXof,amountPaidXof:appointment.appointment.amountPaidXof,remainingXof:Math.max(0,appointment.appointment.totalXof-appointment.appointment.amountPaidXof),note:appointment.appointment.customerNote,payments:paymentList.map((payment)=>({...payment,paidAt:payment.paidAt?.toISOString()??null})),history:history.map((row)=>({...row,createdAt:row.createdAt.toISOString()}))}}
})
