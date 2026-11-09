import { defineEventHandler, setHeader } from 'h3'
import { requireSalonRole } from '../../utils/admin-guard'
export default defineEventHandler(async(event)=>{setHeader(event,'Cache-Control','private, no-store, max-age=0');const context=await requireSalonRole(event,['owner','manager']);return{user:{id:context.user.id,name:context.user.name,email:context.user.email},role:context.role,salonId:context.salonId}})
