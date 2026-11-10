import { createError, defineEventHandler, getHeader, readRawBody } from 'h3'
import { reconcileFedaPayWebhook, verifyFedaPayWebhook } from '../../../services/fedapay'

export default defineEventHandler(async(event)=>{
  const rawBody=await readRawBody(event,'utf8')
  if(!rawBody)throw createError({statusCode:400,statusMessage:'Corps de webhook vide.'})
  const signature=getHeader(event,'x-fedapay-signature')||null
  const payload=await verifyFedaPayWebhook(rawBody,signature)
  return reconcileFedaPayWebhook(payload,rawBody)
})
