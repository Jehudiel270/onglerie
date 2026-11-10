import { env } from 'node:process'
import { createError, defineEventHandler, getRequestIP, readBody } from 'h3'
import { bookingRequestSchema } from '~~/shared/schemas/booking'
import { createBooking, releaseBookingHold } from '../services/booking'
import { createDepositCheckout, isFedaPayConfigured } from '../services/fedapay'
import { hasNeonDatabase } from '../db/client'
import { enforceRateLimit } from '../utils/rate-limit'

export default defineEventHandler(async(event)=>{
  await enforceRateLimit(event,'booking',5,60_000)
  const body=await readBody(event)
  if(body&&typeof body==='object'&&typeof body.website==='string'&&body.website)return{ok:true,message:'Demande reçue.'}
  const parsed=bookingRequestSchema.safeParse(body)
  if(!parsed.success)throw createError({statusCode:422,statusMessage:'Vérifiez les informations de réservation.',data:parsed.error.flatten()})
  if(!hasNeonDatabase())throw createError({statusCode:503,statusMessage:'Les réservations restent désactivées tant que la base Neon du salon n’est pas configurée.'})
  const booking=await createBooking(parsed.data,getRequestIP(event,{xForwardedFor:true})||undefined)
  if(booking.depositDueXof===0)return{ok:true,booking:{id:booking.bookingId,reference:booking.reference,status:booking.status,startsAt:booking.startsAt,endsAt:booking.endsAt,staffName:booking.staffName,totalXof:booking.totalXof,depositDueXof:0,amountPaidXof:0,remainingXof:booking.totalXof,guestAccessToken:booking.guestAccessToken}}
  if(!(await isFedaPayConfigured())){
    await releaseBookingHold(booking.bookingId,'FedaPay n’est pas configuré : libération de la retenue sans confirmer la réservation.')
    throw createError({statusCode:503,statusMessage:'Un acompte est requis mais FedaPay n’est pas configuré. La retenue temporaire a été libérée, aucun paiement ni rendez-vous confirmé.'})
  }
  let publicOrigin:string
  try{publicOrigin=new URL(env.PUBLIC_SITE_URL||'').origin}catch{await releaseBookingHold(booking.bookingId,'URL publique manquante pour le retour du paiement.');throw createError({statusCode:503,statusMessage:'Configurez PUBLIC_SITE_URL avant d’activer les paiements.'})}
  if(env.NODE_ENV==='production'&&!publicOrigin.startsWith('https://')){await releaseBookingHold(booking.bookingId,'HTTPS public requis pour le paiement.');throw createError({statusCode:503,statusMessage:'PUBLIC_SITE_URL doit utiliser HTTPS en production.'})}
  try{
    const checkout=await createDepositCheckout({salonId:booking.salonId,bookingId:booking.bookingId,reference:booking.reference,amountXof:booking.depositDueXof,firstName:parsed.data.firstName,lastName:parsed.data.lastName,phone:booking.customerPhone,email:booking.customerEmail,callbackUrl:`${publicOrigin}/reservation/confirmation?provider=fedapay&booking=${encodeURIComponent(booking.bookingId)}`})
    return{ok:true,booking:{id:booking.bookingId,reference:booking.reference,status:booking.status,startsAt:booking.startsAt,endsAt:booking.endsAt,staffName:booking.staffName,totalXof:booking.totalXof,depositDueXof:booking.depositDueXof,amountPaidXof:0,remainingXof:booking.totalXof,guestAccessToken:booking.guestAccessToken},checkoutUrl:checkout.checkoutUrl}
  }catch(error){
    await releaseBookingHold(booking.bookingId,'Création du paiement indisponible : libération de la retenue.')
    if(error&&typeof error==='object'&&'statusCode'in error)throw error
    console.error('[fedapay] Échec de la création du paiement; détails expurgés.')
    throw createError({statusCode:502,statusMessage:'FedaPay n’a pas pu préparer le paiement. Aucun rendez-vous n’est confirmé; réessayez plus tard.'})
  }
})
