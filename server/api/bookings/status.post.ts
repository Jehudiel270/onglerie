import { and, eq, inArray } from 'drizzle-orm'
import { createError, defineEventHandler, readBody, setHeader } from 'h3'
import { z } from 'zod'
import { hashGuestToken } from '../../services/booking'
import { getDatabase, hasNeonDatabase } from '../../db/client'
import { appointmentServices, appointments, customers, payments, salons, services, staff } from '../../db/schema'

export default defineEventHandler(async(event)=>{
  setHeader(event,'Cache-Control','private, no-store, max-age=0')
  if(!hasNeonDatabase())throw createError({statusCode:503,statusMessage:'Le suivi nécessite la base Neon du salon.'})
  const parsed=z.object({token:z.string().min(40).max(100)}).safeParse(await readBody(event))
  if(!parsed.success)throw createError({statusCode:401,statusMessage:'Jeton de réservation invalide.'})
  const db=getDatabase()
  const [row]=await db.select({appointment:appointments,customer:customers,staffName:staff.firstName,salonName:salons.name,phone:salons.phone,whatsapp:salons.whatsapp,email:salons.email})
    .from(appointments).innerJoin(customers,and(eq(appointments.customerId,customers.id),eq(appointments.salonId,customers.salonId)))
    .leftJoin(staff,and(eq(appointments.staffId,staff.id),eq(appointments.salonId,staff.salonId)))
    .innerJoin(salons,eq(appointments.salonId,salons.id))
    .where(eq(appointments.guestAccessTokenHash,hashGuestToken(parsed.data.token))).limit(1)
  if(!row||!row.appointment.guestAccessExpiresAt||row.appointment.guestAccessExpiresAt<=new Date())throw createError({statusCode:404,statusMessage:'Réservation introuvable ou lien expiré.'})
  const appointment=row.appointment
  const [items]=await db.select({ids:appointmentServices.serviceId}).from(appointmentServices).where(eq(appointmentServices.appointmentId,appointment.id)).limit(1)
  const serviceRows=await db.select({name:appointmentServices.serviceNameSnapshot,priceXof:appointmentServices.priceSnapshotXof,durationMinutes:appointmentServices.durationSnapshotMinutes}).from(appointmentServices).where(eq(appointmentServices.appointmentId,appointment.id))
  const paymentRows=await db.select({amountXof:payments.amountXof,status:payments.status,currency:payments.currency,paidAt:payments.paidAt}).from(payments).where(and(eq(payments.appointmentId,appointment.id),eq(payments.salonId,appointment.salonId)))
  const effectiveStatus=appointment.status==='pending_payment'&&appointment.expiresAt&&appointment.expiresAt<=new Date()?'expired':appointment.status
  return{booking:{reference:appointment.reference,status:effectiveStatus,startsAt:appointment.startsAt.toISOString(),endsAt:appointment.endsAt.toISOString(),staffName:row.staffName??'Première professionnelle disponible',services:serviceRows,totalXof:appointment.totalXof,depositDueXof:appointment.depositDueXof,amountPaidXof:appointment.amountPaidXof,remainingXof:Math.max(0,appointment.totalXof-appointment.amountPaidXof),expiresAt:appointment.expiresAt?.toISOString()??null,payments:paymentRows,salon:{name:row.salonName,phone:row.phone,whatsapp:row.whatsapp,email:row.email}}}
})
