import { createError, defineEventHandler, setHeader } from 'h3'
export default defineEventHandler(async(event)=>{
  setHeader(event,'Cache-Control','private, no-store, max-age=0')
  const session=await serverAuth(event).api.getSession({headers:event.headers})
  if(!session?.user)throw createError({statusCode:401,statusMessage:'Connexion requise.'})
  return{user:{id:session.user.id,name:session.user.name,email:session.user.email,role:session.user.role||'customer'}}
})
