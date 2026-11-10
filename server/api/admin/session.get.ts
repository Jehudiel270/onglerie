import { eq } from 'drizzle-orm'
import { defineEventHandler, setHeader } from 'h3'
import { requireSalonRole } from '../../utils/admin-guard'
import { salons } from '../../db/schema'
export default defineEventHandler(async(event)=>{setHeader(event,'Cache-Control','private, no-store, max-age=0');const context=await requireSalonRole(event,['owner','reception','staff']);const[salon]=await context.db.select({name:salons.name}).from(salons).where(eq(salons.id,context.salonId)).limit(1);return{user:{id:context.user.id,name:context.user.name,email:context.user.email},role:context.role,salonId:context.salonId,salonName:salon?.name??null}})
