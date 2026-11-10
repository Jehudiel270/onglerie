import { createHash,randomUUID } from 'node:crypto'
import { and,eq,gt,inArray,isNull,lt,or,sql } from 'drizzle-orm'
import { createError,defineEventHandler,readBody,setHeader } from 'h3'
import { formatInTimeZone } from 'date-fns-tz'
import { z } from 'zod'
import { SALON_TIMEZONE,SLOT_STEP_MINUTES } from '~~/shared/constants/business'
import { normalizeBeninPhone } from '~~/shared/schemas/booking'
import { requireSalonRole } from '../../utils/admin-guard'
import { appointmentServices,appointmentStatusHistory,appointments,auditLogs,customers,notificationOutbox,scheduleExceptions,services,staff,staffSchedules,staffServices } from '../../db/schema'
import { isWithinCalendar } from '../../services/availability'
import { calculateDeposit,getSalonBookingSettings } from '../../services/salon-settings'

const bodySchema=z.object({serviceIds:z.array(z.string().uuid()).min(1).max(6),staffId:z.string().uuid(),startsAt:z.string().datetime({offset:true}),firstName:z.string().trim().min(2).max(80),lastName:z.string().trim().min(2).max(80),phone:z.string().trim().min(8).max(25),whatsapp:z.string().trim().max(25).optional().or(z.literal('')),email:z.string().trim().email().max(254).optional().or(z.literal('')),note:z.string().trim().max(800).optional().or(z.literal('')),idempotencyKey:z.string().uuid(),reason:z.string().trim().min(4).max(500)}).strict()
export default defineEventHandler(async(event)=>{
  setHeader(event,'Cache-Control','private, no-store, max-age=0')
  const{db,salonId,user}=await requireSalonRole(event,['owner','reception'])
  const parsed=bodySchema.safeParse(await readBody(event));if(!parsed.success)throw createError({statusCode:422,statusMessage:'Informations du rendez-vous invalides.',data:parsed.error.flatten()})
  const input=parsed.data,startsAt=new Date(input.startsAt)
  const bookingSettings=await getSalonBookingSettings(salonId),now=new Date()
  if(startsAt<new Date(now.getTime()+bookingSettings.minAdvanceHours*60*60_000)||startsAt>new Date(now.getTime()+bookingSettings.maxAdvanceDays*24*60*60_000))throw createError({statusCode:400,statusMessage:'Cette date est en dehors de la fenêtre de réservation configurée par le salon.'})
  const selected=await db.select().from(services).where(and(eq(services.salonId,salonId),eq(services.active,true),inArray(services.id,input.serviceIds)))
  if(selected.length!==input.serviceIds.length)throw createError({statusCode:400,statusMessage:'Une prestation n’est plus disponible.'})
  const {totalXof,depositDueXof}=calculateDeposit(selected,bookingSettings.depositPercent),duration=selected.reduce((sum,item)=>sum+item.durationMinutes+item.preparationMinutes,0),endsAt=new Date(startsAt.getTime()+duration*60_000)
  const localDate=formatInTimeZone(startsAt,SALON_TIMEZONE,'yyyy-MM-dd'),weekday=new Date(`${localDate}T12:00:00.000Z`).getUTCDay(),startMinute=Number(formatInTimeZone(startsAt,SALON_TIMEZONE,'HH'))*60+Number(formatInTimeZone(startsAt,SALON_TIMEZONE,'mm'))
  if(startMinute%SLOT_STEP_MINUTES!==0)throw createError({statusCode:400,statusMessage:'Choisissez un créneau proposé par le calendrier du salon.'})
  if(input.serviceIds.length!==new Set(input.serviceIds).size)throw createError({statusCode:422,statusMessage:'Ne sélectionnez pas deux fois la même prestation.'})
  const[person]=await db.select().from(staff).where(and(eq(staff.id,input.staffId),eq(staff.salonId,salonId),eq(staff.active,true))).limit(1)
  if(!person)throw createError({statusCode:422,statusMessage:'Professionnelle inactive ou inconnue.'})
  const assignments=await db.select({serviceId:staffServices.serviceId}).from(staffServices).where(and(eq(staffServices.staffId,person.id),eq(staffServices.salonId,salonId)))
  if(input.serviceIds.some((id)=>!assignments.some((item)=>item.serviceId===id)))throw createError({statusCode:422,statusMessage:'Cette professionnelle n’est pas associée à toutes les prestations sélectionnées.'})
  const result=await db.transaction(async(tx)=>{
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`idempotency:${salonId}`}),hashtext(${input.idempotencyKey}))`)
    const[duplicate]=await tx.select({id:appointments.id}).from(appointments).where(and(eq(appointments.salonId,salonId),eq(appointments.idempotencyKey,input.idempotencyKey))).limit(1)
    if(duplicate)throw createError({statusCode:409,statusMessage:'Cette création a déjà été reçue.'})
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${salonId}:${person.id}:${localDate}`}),0)`)
    const schedules=await tx.select().from(staffSchedules).where(and(eq(staffSchedules.salonId,salonId),eq(staffSchedules.weekday,weekday),eq(staffSchedules.active,true),or(eq(staffSchedules.staffId,person.id),isNull(staffSchedules.staffId))))
    const individual=schedules.filter((item)=>item.staffId===person.id),applicable=individual.length?individual:schedules.filter((item)=>item.staffId===null)
    const exceptions=await tx.select().from(scheduleExceptions).where(and(eq(scheduleExceptions.salonId,salonId),or(eq(scheduleExceptions.staffId,person.id),isNull(scheduleExceptions.staffId)),lt(scheduleExceptions.startsAt,endsAt),gt(scheduleExceptions.endsAt,startsAt)))
    if(!isWithinCalendar(startsAt,endsAt,localDate,applicable,exceptions))throw createError({statusCode:409,statusMessage:'Le créneau ne respecte pas les horaires, pauses ou exceptions configurées.'})
    const[conflict]=await tx.select({id:appointments.id}).from(appointments).where(and(eq(appointments.salonId,salonId),eq(appointments.staffId,person.id),lt(appointments.startsAt,endsAt),gt(appointments.endsAt,startsAt),or(eq(appointments.status,'confirmed'),and(eq(appointments.status,'pending_payment'),or(isNull(appointments.expiresAt),gt(appointments.expiresAt,new Date())))))).limit(1)
    if(conflict)throw createError({statusCode:409,statusMessage:'Ce créneau vient d’être réservé.'})
    const phone=normalizeBeninPhone(input.phone),whatsapp=input.whatsapp?normalizeBeninPhone(input.whatsapp):null
    const[customer]=await tx.insert(customers).values({salonId,firstName:input.firstName,lastName:input.lastName,phone,whatsapp,email:input.email||null}).onConflictDoUpdate({target:[customers.salonId,customers.phone],set:{firstName:input.firstName,lastName:input.lastName,whatsapp,email:input.email||null,updatedAt:new Date()}}).returning()
    if(!customer)throw createError({statusCode:500,statusMessage:'La fiche cliente n’a pas été enregistrée.'})
    const reference=`ON-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${randomUUID().slice(0,6).toUpperCase()}`,status='confirmed'
    const[appointment]=await tx.insert(appointments).values({salonId,customerId:customer.id,staffId:person.id,idempotencyKey:input.idempotencyKey,reference,status,startsAt,endsAt,totalXof,depositDueXof,amountPaidXof:0,customerNote:input.note||null,expiresAt:null}).returning()
    if(!appointment)throw createError({statusCode:500,statusMessage:'Le rendez-vous n’a pas été enregistré.'})
    await tx.insert(appointmentServices).values(selected.map((service)=>({appointmentId:appointment.id,serviceId:service.id,serviceNameSnapshot:service.name,priceSnapshotXof:service.priceXof,durationSnapshotMinutes:service.durationMinutes+service.preparationMinutes})))
    await tx.insert(appointmentStatusHistory).values({salonId,appointmentId:appointment.id,fromStatus:null,toStatus:status,actorUserId:user.id,reason:`Création et confirmation manuelles par l’équipe : ${input.reason}. Aucun paiement n’est présumé.`})
    await tx.insert(auditLogs).values({salonId,userId:user.id,action:'admin_appointment_created',entity:'appointment',entityId:appointment.id,metadata:{reason:input.reason,depositDueXof,amountPaidXof:0}})
    const payload={reference,startsAt:startsAt.toISOString(),totalXof,depositPaidXof:0,remainingXof:totalXof}
    if(customer.phone)await tx.insert(notificationOutbox).values({salonId,dedupeKey:`${appointment.id}:confirmed:whatsapp:customer`,recipient:customer.whatsapp||customer.phone,channel:'whatsapp',templateKey:'booking_confirmed',payload}).onConflictDoNothing()
    if(customer.email)await tx.insert(notificationOutbox).values({salonId,dedupeKey:`${appointment.id}:confirmed:email:customer`,recipient:customer.email,channel:'email',templateKey:'booking_confirmed',payload}).onConflictDoNothing()
    return{appointment,customer,person}
  })
  return{ok:true,appointment:{id:result.appointment.id,reference:result.appointment.reference,status:result.appointment.status,startsAt:result.appointment.startsAt.toISOString(),depositDueXof:result.appointment.depositDueXof,amountPaidXof:0},message:'Rendez-vous confirmé par l’équipe; aucun paiement n’a été enregistré.'}
})
