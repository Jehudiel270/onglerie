import { createHmac,randomUUID } from 'node:crypto'
import { env } from 'node:process'
import { createError,defineEventHandler,setHeader } from 'h3'
import { requireSalonRole } from '../../../utils/admin-guard'

export default defineEventHandler(async(event)=>{
  setHeader(event,'Cache-Control','private, no-store, max-age=0')
  const{salonId}=await requireSalonRole(event,['owner','manager'])
  if(!env.CLOUDINARY_CLOUD_NAME||!env.CLOUDINARY_API_KEY||!env.CLOUDINARY_API_SECRET)throw createError({statusCode:503,statusMessage:'Cloudinary n’est pas configuré pour ce projet.',data:{code:'CLOUDINARY_NOT_CONFIGURED'}})
  const timestamp=Math.floor(Date.now()/1000),folder=`salons/${salonId}/assets`,publicId=`${Date.now()}-${randomUUID()}`
  const parameters=`folder=${folder}&public_id=${publicId}&timestamp=${timestamp}`
  const signature=createHmac('sha1',env.CLOUDINARY_API_SECRET).update(parameters).digest('hex')
  return{cloudName:env.CLOUDINARY_CLOUD_NAME,apiKey:env.CLOUDINARY_API_KEY,timestamp,folder,publicId,signature}
})
