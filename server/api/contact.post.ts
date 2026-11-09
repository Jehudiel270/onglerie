import { createError, defineEventHandler, readBody } from 'h3'
import { contactRequestSchema, normalizeBeninPhone } from '~~/shared/schemas/booking'
import { getDatabase, hasNeonDatabase } from '../db/client'
import { contactMessages, notificationOutbox } from '../db/schema'
import { requirePrimarySalon } from '../services/salon'
import { enforceRateLimit } from '../utils/rate-limit'

export default defineEventHandler(async(event)=>{
  await enforceRateLimit(event,'contact',5,60_000)
  const body=await readBody(event)
  if(body&&typeof body==='object'&&typeof body.website==='string'&&body.website)return{ok:true,message:'Votre message a été reçu.'}
  const parsed=contactRequestSchema.safeParse(body)
  if(!parsed.success)throw createError({statusCode:422,statusMessage:'Vérifiez les informations du formulaire.',data:parsed.error.flatten()})
  if(!hasNeonDatabase())throw createError({statusCode:503,statusMessage:'Le formulaire reste désactivé tant que la base Neon du salon n’est pas configurée.'})
  const salon=await requirePrimarySalon()
  const db=getDatabase()
  const [saved]=await db.transaction(async(tx)=>{
    const [message]=await tx.insert(contactMessages).values({salonId:salon.id,name:parsed.data.name,phone:parsed.data.phone?normalizeBeninPhone(parsed.data.phone):null,email:parsed.data.email||null,message:parsed.data.message}).returning({id:contactMessages.id})
    if(!message)return[undefined]
    const payload={contactMessageId:message.id,name:parsed.data.name,phone:parsed.data.phone||'',email:parsed.data.email||'',message:parsed.data.message}
    if(salon.email)await tx.insert(notificationOutbox).values({salonId:salon.id,dedupeKey:`contact:${message.id}:email`,recipient:salon.email,channel:'email',templateKey:'contact_message',payload}).onConflictDoNothing()
    const whatsapp=salon.whatsapp||salon.phone
    if(whatsapp)await tx.insert(notificationOutbox).values({salonId:salon.id,dedupeKey:`contact:${message.id}:whatsapp`,recipient:whatsapp,channel:'whatsapp',templateKey:'contact_message',payload}).onConflictDoNothing()
    return[message]
  })
  if(!saved)throw createError({statusCode:500,statusMessage:'Le message n’a pas pu être enregistré.'})
  return{ok:true,message:'Votre message est enregistré. Une notification sera envoyée si un canal du salon a été configuré.'}
})
