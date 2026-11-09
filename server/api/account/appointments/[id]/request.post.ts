import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody, setHeader } from 'h3'
import { z } from 'zod'
import { requireCustomer } from '../../../../utils/customer-guard'
import { getDatabase } from '../../../../db/client'
import { appointmentStatusHistory, appointments, customerAppointmentRequests, notificationOutbox, salons } from '../../../../db/schema'
import { enforceRateLimit } from '../../../../utils/rate-limit'

const requestSchema=z.object({type:z.enum(['cancel','reschedule']),requestedFor:z.string().datetime({offset:true}).optional(),message:z.string().trim().max(800).optional().or(z.literal(''))}).strict()
export default defineEventHandler(async(event)=>{
  setHeader(event,'Cache-Control','private, no-store, max-age=0')
  await enforceRateLimit(event,'customer-appointment-request',5,60_000)
  const {customer,salonId}=await requireCustomer(event)
  const appointmentId=getRouterParam(event,'id')||''
  if(!z.string().uuid().safeParse(appointmentId).success)throw createError({statusCode:400,statusMessage:'Identifiant de rendez-vous invalide.'})
  const parsed=requestSchema.safeParse(await readBody(event))
  if(!parsed.success)throw createError({statusCode:422,statusMessage:'Vérifiez votre demande.',data:parsed.error.flatten()})
  if(parsed.data.type==='reschedule'&&(!parsed.data.requestedFor||new Date(parsed.data.requestedFor)<=new Date()))throw createError({statusCode:422,statusMessage:'Choisissez une date future pour demander un report.'})
  const db=getDatabase()
  const result=await db.transaction(async(tx)=>{
    const [appointment]=await tx.select().from(appointments).where(and(eq(appointments.id,appointmentId),eq(appointments.customerId,customer.id),eq(appointments.salonId,salonId))).for('update').limit(1)
    if(!appointment)throw createError({statusCode:404,statusMessage:'Rendez-vous introuvable.'})
    if(!['confirmed','pending_payment'].includes(appointment.status)||appointment.startsAt<=new Date())throw createError({statusCode:409,statusMessage:'Ce rendez-vous ne peut plus être modifié depuis votre espace.'})
    const [existing]=await tx.select({id:customerAppointmentRequests.id}).from(customerAppointmentRequests).where(and(eq(customerAppointmentRequests.appointmentId,appointment.id),eq(customerAppointmentRequests.status,'open'))).limit(1)
    if(existing)throw createError({statusCode:409,statusMessage:'Une demande est déjà en attente pour ce rendez-vous.'})
    const [request]=await tx.insert(customerAppointmentRequests).values({salonId,appointmentId:appointment.id,customerId:customer.id,type:parsed.data.type,requestedFor:parsed.data.requestedFor?new Date(parsed.data.requestedFor):null,message:parsed.data.message||null,status:'open'}).returning({id:customerAppointmentRequests.id})
    await tx.insert(appointmentStatusHistory).values({salonId,appointmentId:appointment.id,fromStatus:appointment.status,toStatus:appointment.status,reason:`Demande cliente en attente : ${parsed.data.type}.`})
    const [salon]=await tx.select({email:salons.email,whatsapp:salons.whatsapp,phone:salons.phone}).from(salons).where(eq(salons.id,salonId)).limit(1)
    const payload={appointmentId:appointment.id,reference:appointment.reference,requestType:parsed.data.type,requestedFor:parsed.data.requestedFor||'',message:parsed.data.message||''}
    if(salon?.email)await tx.insert(notificationOutbox).values({salonId,dedupeKey:`${request?.id}:salon:email`,recipient:salon.email,channel:'email',templateKey:'client_appointment_request',payload}).onConflictDoNothing()
    const contact=salon?.whatsapp||salon?.phone
    if(contact)await tx.insert(notificationOutbox).values({salonId,dedupeKey:`${request?.id}:salon:whatsapp`,recipient:contact,channel:'whatsapp',templateKey:'client_appointment_request',payload}).onConflictDoNothing()
    return request
  })
  return{ok:true,requestId:result?.id,message:'Votre demande est transmise à l’équipe. Le rendez-vous reste inchangé tant qu’elle n’a pas été examinée.'}
})
