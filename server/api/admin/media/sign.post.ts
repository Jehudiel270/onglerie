import { createHmac,randomUUID } from 'node:crypto'
import { createError,defineEventHandler,setHeader } from 'h3'
import { requireSalonRole } from '../../../utils/admin-guard'
import { getPlatformSetting } from '../../../services/platform-config'

export default defineEventHandler(async(event)=>{
  setHeader(event,'Cache-Control','private, no-store, max-age=0')
  const{salonId}=await requireSalonRole(event,['owner'])
  const cloudName=(await getPlatformSetting('CLOUDINARY_CLOUD_NAME')).value
  const apiKey=(await getPlatformSetting('CLOUDINARY_API_KEY')).value
  const apiSecret=(await getPlatformSetting('CLOUDINARY_API_SECRET')).value
  if(!cloudName||!apiKey||!apiSecret)throw createError({statusCode:503,statusMessage:'Cloudinary n’est pas configuré pour ce projet.',data:{code:'CLOUDINARY_NOT_CONFIGURED'}})
  const timestamp=Math.floor(Date.now()/1000),folder=`salons/${salonId}/assets`,publicId=`${Date.now()}-${randomUUID()}`
  const parameters=`folder=${folder}&public_id=${publicId}&timestamp=${timestamp}`
  const signature=createHmac('sha1',apiSecret).update(parameters).digest('hex')
  return{cloudName,apiKey,timestamp,folder,publicId,signature}
})
