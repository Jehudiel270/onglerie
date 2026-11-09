import { asc, and, eq, inArray } from 'drizzle-orm'
import { createError, defineEventHandler, getQuery, setHeader } from 'h3'
import { z } from 'zod'
import { getDatabase, hasNeonDatabase } from '../../db/client'
import { salons, staff, staffServices } from '../../db/schema'

export default defineEventHandler(async(event)=>{
  setHeader(event,'Cache-Control','public, max-age=30, stale-while-revalidate=60')
  if(!hasNeonDatabase())return{configured:false,staff:[]}
  const query=z.object({services:z.string().optional()}).safeParse(getQuery(event))
  if(!query.success)throw createError({statusCode:400,statusMessage:'Liste de prestations invalide.'})
  const serviceIds=[...new Set((query.data.services||'').split(',').filter(Boolean))]
  if(serviceIds.length>6||!serviceIds.every((id)=>z.string().uuid().safeParse(id).success))throw createError({statusCode:400,statusMessage:'Identifiant de prestation invalide.'})
  const db=getDatabase()
  const [salon]=await db.select({id:salons.id}).from(salons).where(eq(salons.status,'active')).orderBy(asc(salons.createdAt)).limit(1)
  if(!salon)return{configured:true,staff:[]}
  const people=await db.select({id:staff.id,firstName:staff.firstName,lastName:staff.lastName,bio:staff.bio,imageUrl:staff.imageUrl}).from(staff).where(and(eq(staff.salonId,salon.id),eq(staff.active,true))).orderBy(asc(staff.firstName))
  if(!serviceIds.length)return{configured:true,staff:people}
  const assignments=await db.select({staffId:staffServices.staffId,serviceId:staffServices.serviceId}).from(staffServices).where(and(eq(staffServices.salonId,salon.id),inArray(staffServices.serviceId,serviceIds)))
  const assignmentsByStaff=new Map<string,Set<string>>()
  for(const item of assignments){const set=assignmentsByStaff.get(item.staffId)??new Set<string>();set.add(item.serviceId);assignmentsByStaff.set(item.staffId,set)}
  return{configured:true,staff:people.filter((person)=>serviceIds.every((id)=>assignmentsByStaff.get(person.id)?.has(id)))}
})
