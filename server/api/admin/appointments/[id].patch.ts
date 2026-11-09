import { and, eq, gt, lt, or, isNull, sql } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody, setHeader } from 'h3'
import { formatInTimeZone } from 'date-fns-tz'
import { z } from 'zod'
import { SALON_TIMEZONE } from '~~/shared/constants/business'
import { isAllowedAppointmentTransition } from '~~/shared/constants/appointment-transitions'
import { requireSalonRole } from '../../../utils/admin-guard'
import { manualPaymentPreflightReason } from '../../../services/manual-payment'
import { appointmentServices, appointmentStatusHistory, appointments, auditLogs, scheduleExceptions, staffSchedules } from '../../../db/schema'
import { isWithinSchedule } from '../../../services/availability'

const patchSchema=z.object({status:z.enum(['confirmed','cancelled','completed','no_show']).optional(),startsAt:z.string().datetime({offset:true}).optional(),reason:z.string().trim().min(4).max(500).optional()}).strict()
const minute=(value:string)=>{const[h='0',m='0']=value.split(':');return Number(h)*60+Number(m)}
export default defineEventHandler(async(event)=>{
  setHeader(event,'Cache-Control','private, no-store, max-age=0')
  const{db,salonId,user}=await requireSalonRole(event,['owner','manager'])
  const id=getRouterParam(event,'id')||'';if(!z.string().uuid().safeParse(id).success)throw createError({statusCode:400,statusMessage:'Identifiant de rendez-vous invalide.'})
  const parsed=patchSchema.safeParse(await readBody(event));if(!parsed.success)throw createError({statusCode:422,statusMessage:'Modification invalide.',data:parsed.error.flatten()})
  if(!parsed.data.status&&!parsed.data.startsAt)throw createError({statusCode:422,statusMessage:'Aucune modification reçue.'})
  await db.transaction(async(tx)=>{
    const[appointment]=await tx.select().from(appointments).where(and(eq(appointments.id,id),eq(appointments.salonId,salonId))).for('update').limit(1)
    if(!appointment)throw createError({statusCode:404,statusMessage:'Rendez-vous introuvable.'})
    const transitionNow=new Date()
    const nextStatus=parsed.data.status||appointment.status
    if(parsed.data.status&&!isAllowedAppointmentTransition(appointment.status,parsed.data.status))throw createError({statusCode:409,statusMessage:'Cette transition de rendez-vous n’est pas autorisée. Créez un nouveau rendez-vous plutôt que de réactiver une réservation terminée ou expirée.'})
    if(parsed.data.status==='confirmed'&&appointment.status==='pending_payment'){
      const holdReason=manualPaymentPreflightReason({status:appointment.status,startsAt:parsed.data.startsAt?new Date(parsed.data.startsAt):appointment.startsAt,expiresAt:appointment.expiresAt,staffId:appointment.staffId,now:transitionNow})
      if(holdReason)throw createError({statusCode:409,statusMessage:`${holdReason} Créez une nouvelle réservation et vérifiez sa disponibilité avant toute confirmation.`})
      if(appointment.amountPaidXof<appointment.depositDueXof)throw createError({statusCode:409,statusMessage:'Le montant de l’acompte n’est pas rapproché. Enregistrez un paiement réel ou modifiez explicitement la règle du salon avant de confirmer.'})
    }
    if(parsed.data.status==='cancelled'&&appointment.amountPaidXof>0&&!parsed.data.reason)throw createError({statusCode:422,statusMessage:'Ajoutez une note de traitement du montant encaissé. Aucun remboursement automatique n’est déclenché.'})
    if(parsed.data.startsAt){
      if(!['confirmed','pending_payment'].includes(appointment.status))throw createError({statusCode:409,statusMessage:'Seul un rendez-vous actif peut être reporté.'})
      const startsAt=new Date(parsed.data.startsAt);if(startsAt<=new Date())throw createError({statusCode:400,statusMessage:'Choisissez une nouvelle heure dans le futur.'})
      if(!appointment.staffId)throw createError({statusCode:409,statusMessage:'Attribuez une professionnelle avant de déplacer le rendez-vous.'})
      const rows=await tx.select({serviceId:appointmentServices.serviceId,duration:appointmentServices.durationSnapshotMinutes}).from(appointmentServices).where(eq(appointmentServices.appointmentId,id))
      const duration=rows.reduce((sum,row)=>sum+row.duration,0),endsAt=new Date(startsAt.getTime()+duration*60_000),localDate=formatInTimeZone(startsAt,SALON_TIMEZONE,'yyyy-MM-dd'),day=new Date(`${localDate}T12:00:00Z`).getUTCDay(),startMinute=minute(formatInTimeZone(startsAt,SALON_TIMEZONE,'HH:mm'))
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${salonId}:${appointment.staffId}:${localDate}`}),0)`)
      const schedules=await tx.select().from(staffSchedules).where(and(eq(staffSchedules.salonId,salonId),eq(staffSchedules.weekday,day),eq(staffSchedules.active,true),or(eq(staffSchedules.staffId,appointment.staffId),isNull(staffSchedules.staffId))))
      const individual=schedules.filter((item)=>item.staffId===appointment.staffId),applicable=individual.length?individual:schedules.filter((item)=>item.staffId===null)
      if(!applicable.some((item)=>isWithinSchedule(startMinute,startMinute+duration,item)))throw createError({statusCode:409,statusMessage:'Le nouveau créneau ne respecte pas le calendrier de l’équipe.'})
      const[exception]=await tx.select({id:scheduleExceptions.id}).from(scheduleExceptions).where(and(eq(scheduleExceptions.salonId,salonId),or(eq(scheduleExceptions.staffId,appointment.staffId),isNull(scheduleExceptions.staffId)),lt(scheduleExceptions.startsAt,endsAt),gt(scheduleExceptions.endsAt,startsAt))).limit(1)
      const[conflict]=await tx.select({id:appointments.id}).from(appointments).where(and(eq(appointments.salonId,salonId),eq(appointments.staffId,appointment.staffId),lt(appointments.startsAt,endsAt),gt(appointments.endsAt,startsAt),sql`${appointments.id} <> ${id}`,or(eq(appointments.status,'confirmed'),and(eq(appointments.status,'pending_payment'),or(isNull(appointments.expiresAt),gt(appointments.expiresAt,new Date())))))).limit(1)
      if(exception||conflict)throw createError({statusCode:409,statusMessage:'Le nouveau créneau est indisponible.'})
      await tx.update(appointments).set({startsAt,endsAt,expiresAt:appointment.expiresAt,updatedAt:new Date()}).where(and(eq(appointments.id,id),eq(appointments.salonId,salonId)))
      await tx.insert(appointmentStatusHistory).values({salonId,appointmentId:id,fromStatus:appointment.status,toStatus:appointment.status,actorUserId:user.id,reason:`Report : ${parsed.data.reason||'date et heure modifiées'}.`})
    }
    if(parsed.data.status&&parsed.data.status!==appointment.status){
      const statusFilter=parsed.data.status==='confirmed'&&appointment.status==='pending_payment'
        ?and(eq(appointments.id,id),eq(appointments.salonId,salonId),gt(appointments.startsAt,transitionNow),gt(appointments.expiresAt,transitionNow))
        :and(eq(appointments.id,id),eq(appointments.salonId,salonId))
      const[updated]=await tx.update(appointments).set({status:nextStatus,expiresAt:nextStatus==='confirmed'||nextStatus==='cancelled'?null:appointment.expiresAt,updatedAt:new Date()}).where(statusFilter).returning({id:appointments.id})
      if(!updated)throw createError({statusCode:409,statusMessage:'La retenue a expiré ou le rendez-vous a déjà commencé. La confirmation a été annulée.'})
      await tx.insert(appointmentStatusHistory).values({salonId,appointmentId:id,fromStatus:appointment.status,toStatus:nextStatus,actorUserId:user.id,reason:parsed.data.reason||'Mise à jour depuis l’administration.'})
    }
    await tx.insert(auditLogs).values({salonId,userId:user.id,action:parsed.data.startsAt?'appointment_reschedule':'appointment_status_change',entity:'appointment',entityId:id,metadata:{status:nextStatus,reason:parsed.data.reason||''}})
  })
  return{ok:true,message:'Le rendez-vous a été mis à jour.'}
})
