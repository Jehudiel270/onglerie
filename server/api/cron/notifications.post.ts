import { env } from 'node:process'
import { createError, defineEventHandler, getHeader, setHeader } from 'h3'
import { dispatchNotificationOutbox } from '../../services/notifications'

export default defineEventHandler(async(event)=>{
  const token=getHeader(event,'authorization')?.replace(/^Bearer\s+/i,'')||getHeader(event,'x-cron-secret')
  if(!env.CRON_SECRET||token!==env.CRON_SECRET)throw createError({statusCode:401,statusMessage:'Tâche planifiée non autorisée.'})
  setHeader(event,'Cache-Control','private, no-store, max-age=0')
  return{ok:true,...await dispatchNotificationOutbox(20)}
})
