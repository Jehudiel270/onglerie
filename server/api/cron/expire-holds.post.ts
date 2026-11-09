import { env } from 'node:process'
import { and, eq, lte } from 'drizzle-orm'
import { createError, defineEventHandler, getHeader } from 'h3'
import { getDatabase } from '../../db/client'
import { appointmentStatusHistory, appointments, payments } from '../../db/schema'

export default defineEventHandler(async(event)=>{
  const token=getHeader(event,'authorization')?.replace(/^Bearer\s+/i,'')||getHeader(event,'x-cron-secret')
  if(!env.CRON_SECRET||token!==env.CRON_SECRET)throw createError({statusCode:401,statusMessage:'Tâche planifiée non autorisée.'})
  const db=getDatabase()
  const expired=await db.transaction(async(tx)=>{
    const rows=await tx.select().from(appointments).where(and(eq(appointments.status,'pending_payment'),lte(appointments.expiresAt,new Date()))).for('update')
    for(const row of rows){
      await tx.update(appointments).set({status:'expired',updatedAt:new Date()}).where(eq(appointments.id,row.id))
      await tx.insert(appointmentStatusHistory).values({salonId:row.salonId,appointmentId:row.id,fromStatus:'pending_payment',toStatus:'expired',reason:'Retenue de créneau arrivée à expiration.'})
      await tx.update(payments).set({status:'expired',updatedAt:new Date()}).where(and(eq(payments.appointmentId,row.id),eq(payments.status,'pending')))
    }
    return rows.length
  })
  return{ok:true,expired}
})
