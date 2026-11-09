import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody, setHeader } from 'h3'
import { z } from 'zod'
import { hashGuestToken } from '../../services/booking'
import { getDatabase, hasNeonDatabase } from '../../db/client'
import { appointments, customers } from '../../db/schema'

export default defineEventHandler(async(event)=>{
  setHeader(event,'Cache-Control','private, no-store, max-age=0')
  const auth=serverAuth(event),session=await auth.api.getSession({headers:event.headers})
  if(!session?.user)throw createError({statusCode:401,statusMessage:'Connectez-vous avant de lier une réservation.'})
  if(!hasNeonDatabase())throw createError({statusCode:503,statusMessage:'La base du salon n’est pas configurée.'})
  const parsed=z.object({token:z.string().min(40).max(100)}).safeParse(await readBody(event))
  if(!parsed.success)throw createError({statusCode:422,statusMessage:'Lien de réservation invalide.'})
  const db=getDatabase()
  const result=await db.transaction(async(tx)=>{
    const [appointment]=await tx.select().from(appointments).where(eq(appointments.guestAccessTokenHash,hashGuestToken(parsed.data.token))).for('update').limit(1)
    if(!appointment||!appointment.guestAccessExpiresAt||appointment.guestAccessExpiresAt<=new Date())throw createError({statusCode:404,statusMessage:'Réservation introuvable ou lien expiré.'})
    const [customer]=await tx.select().from(customers).where(and(eq(customers.id,appointment.customerId),eq(customers.salonId,appointment.salonId))).for('update').limit(1)
    if(!customer)throw createError({statusCode:404,statusMessage:'Profil cliente introuvable.'})
    if(customer.userId&&customer.userId!==session.user.id)throw createError({statusCode:403,statusMessage:'Cette réservation est déjà liée à un autre compte.'})
    await tx.update(customers).set({userId:session.user.id,updatedAt:new Date()}).where(eq(customers.id,customer.id))
    await tx.update(appointments).set({guestAccessTokenHash:null,guestAccessExpiresAt:null,updatedAt:new Date()}).where(eq(appointments.id,appointment.id))
    return{reference:appointment.reference}
  })
  return{ok:true,reference:result.reference,message:'Réservation liée à votre compte.'}
})
