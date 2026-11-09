import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody, setHeader } from 'h3'
import { z } from 'zod'
import { normalizeBeninPhone } from '~~/shared/schemas/booking'
import { requireCustomer } from '../../utils/customer-guard'
import { getDatabase } from '../../db/client'
import { customers } from '../../db/schema'

const profileSchema=z.object({firstName:z.string().trim().min(2).max(80),lastName:z.string().trim().min(2).max(80),phone:z.string().trim().min(8).max(20),whatsapp:z.string().trim().max(20).optional().or(z.literal('')),email:z.string().trim().email().max(254).optional().or(z.literal(''))}).strict()
export default defineEventHandler(async(event)=>{
  setHeader(event,'Cache-Control','private, no-store, max-age=0')
  const {customer,salonId}=await requireCustomer(event),parsed=profileSchema.safeParse(await readBody(event))
  if(!parsed.success)throw createError({statusCode:422,statusMessage:'Vérifiez les informations du profil.',data:parsed.error.flatten()})
  if(!/^\+229\d{8}$/.test(normalizeBeninPhone(parsed.data.phone)))throw createError({statusCode:422,statusMessage:'Numéro béninois invalide.'})
  const [updated]=await getDatabase().update(customers).set({firstName:parsed.data.firstName,lastName:parsed.data.lastName,phone:normalizeBeninPhone(parsed.data.phone),whatsapp:parsed.data.whatsapp?normalizeBeninPhone(parsed.data.whatsapp):null,email:parsed.data.email||null,updatedAt:new Date()}).where(and(eq(customers.id,customer.id),eq(customers.salonId,salonId))).returning()
  if(!updated)throw createError({statusCode:404,statusMessage:'Profil introuvable.'})
  return{ok:true,profile:{firstName:updated.firstName,lastName:updated.lastName,phone:updated.phone,whatsapp:updated.whatsapp,email:updated.email}}
})
