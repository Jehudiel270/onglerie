import { createError, defineEventHandler, getHeader, setHeader } from 'h3'
import { dispatchNotificationOutbox } from '../../services/notifications'
import { verifyCronToken } from '../../services/platform-config'

export default defineEventHandler(async(event)=>{
  const token=getHeader(event,'authorization')?.replace(/^Bearer\s+/i,'')||getHeader(event,'x-cron-secret')
  await verifyCronToken(token||'')
  setHeader(event,'Cache-Control','private, no-store, max-age=0')
  return{ok:true,...await dispatchNotificationOutbox(20)}
})
