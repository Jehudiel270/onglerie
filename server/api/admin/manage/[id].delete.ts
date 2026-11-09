import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getQuery, getRouterParam, setHeader } from 'h3'
import { z } from 'zod'
import { requireSalonRole } from '../../../utils/admin-guard'
import { auditLogs, categories, portfolioItems, scheduleExceptions, services, staff, staffSchedules } from '../../../db/schema'

export default defineEventHandler(async(event)=>{
  setHeader(event,'Cache-Control','private, no-store, max-age=0')
  const{db,salonId,user}=await requireSalonRole(event,['owner','manager'])
  const id=getRouterParam(event,'id')||'',query=z.object({resource:z.enum(['categories','services','portfolio','staff','schedules','exceptions'])}).safeParse(getQuery(event))
  if(!z.string().uuid().safeParse(id).success||!query.success)throw createError({statusCode:400,statusMessage:'Identifiant ou ressource invalide.'})
  let changed=false
  if(query.data.resource==='categories'){const result=await db.delete(categories).where(and(eq(categories.id,id),eq(categories.salonId,salonId))).returning({id:categories.id});changed=result.length>0}
  if(query.data.resource==='services'){const result=await db.update(services).set({active:false,updatedAt:new Date()}).where(and(eq(services.id,id),eq(services.salonId,salonId))).returning({id:services.id});changed=result.length>0}
  if(query.data.resource==='portfolio'){const result=await db.update(portfolioItems).set({published:false,updatedAt:new Date()}).where(and(eq(portfolioItems.id,id),eq(portfolioItems.salonId,salonId))).returning({id:portfolioItems.id});changed=result.length>0}
  if(query.data.resource==='staff'){const result=await db.update(staff).set({active:false,updatedAt:new Date()}).where(and(eq(staff.id,id),eq(staff.salonId,salonId))).returning({id:staff.id});changed=result.length>0}
  if(query.data.resource==='schedules'){const result=await db.delete(staffSchedules).where(and(eq(staffSchedules.id,id),eq(staffSchedules.salonId,salonId))).returning({id:staffSchedules.id});changed=result.length>0}
  if(query.data.resource==='exceptions'){const result=await db.delete(scheduleExceptions).where(and(eq(scheduleExceptions.id,id),eq(scheduleExceptions.salonId,salonId))).returning({id:scheduleExceptions.id});changed=result.length>0}
  if(!changed)throw createError({statusCode:404,statusMessage:'Élément introuvable dans ce salon.'})
  await db.insert(auditLogs).values({salonId,userId:user.id,action:`${query.data.resource}_deactivate`,entity:query.data.resource,entityId:id})
  return{ok:true,message:query.data.resource==='categories'?'Catégorie supprimée.':query.data.resource==='services'?'Prestation désactivée.':query.data.resource==='portfolio'?'Réalisation dépubliée; les images du fournisseur externe sont conservées.':query.data.resource==='staff'?'Profil d’équipe désactivé.':'Entrée de calendrier supprimée.'}
})
