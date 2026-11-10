import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { createError, defineEventHandler, getQuery, setHeader } from 'h3'
import { z } from 'zod'
import { requireSalonRole } from '../../utils/admin-guard'
import { appointmentServices, appointments, customers, staff } from '../../db/schema'

export default defineEventHandler(async(event)=>{
  setHeader(event,'Cache-Control','private, no-store, max-age=0')
  const{db,salonId}=await requireSalonRole(event,['owner','reception'])
  const query=z.object({status:z.string().optional(),from:z.string().datetime({offset:true}).optional(),to:z.string().datetime({offset:true}).optional(),q:z.string().trim().max(100).optional()}).safeParse(getQuery(event))
  if(!query.success)throw createError({statusCode:400,statusMessage:'Filtres invalides.'})
  const statuses=query.data.status?query.data.status.split(',').filter(Boolean):[]
  const clauses=[eq(appointments.salonId,salonId)]
  if(statuses.length)clauses.push(inArray(appointments.status,statuses))
  if(query.data.from)clauses.push(gte(appointments.startsAt,new Date(query.data.from)))
  if(query.data.to)clauses.push(lte(appointments.startsAt,new Date(query.data.to)))
  const rows=await db.select({appointment:appointments,customer:customers,staffFirst:staff.firstName,staffLast:staff.lastName}).from(appointments)
    .innerJoin(customers,and(eq(appointments.customerId,customers.id),eq(appointments.salonId,customers.salonId)))
    .leftJoin(staff,and(eq(appointments.staffId,staff.id),eq(appointments.salonId,staff.salonId)))
    .where(and(...clauses)).orderBy(desc(appointments.startsAt)).limit(250)
  const queryText=query.data.q?.toLocaleLowerCase('fr')
  const filtered=queryText?rows.filter((row)=>[row.appointment.reference,row.customer.firstName,row.customer.lastName,row.customer.phone].join(' ').toLocaleLowerCase('fr').includes(queryText)):rows
  const result=[]
  for(const row of filtered){const items=await db.select({name:appointmentServices.serviceNameSnapshot}).from(appointmentServices).where(eq(appointmentServices.appointmentId,row.appointment.id));result.push({id:row.appointment.id,reference:row.appointment.reference,status:row.appointment.status,startsAt:row.appointment.startsAt.toISOString(),endsAt:row.appointment.endsAt.toISOString(),customer:{id:row.customer.id,name:`${row.customer.firstName} ${row.customer.lastName}`,phone:row.customer.phone,email:row.customer.email},staffName:[row.staffFirst,row.staffLast].filter(Boolean).join(' '),services:items.map((item)=>item.name),totalXof:row.appointment.totalXof,depositDueXof:row.appointment.depositDueXof,amountPaidXof:row.appointment.amountPaidXof,remainingXof:Math.max(0,row.appointment.totalXof-row.appointment.amountPaidXof)})}
  return{appointments:result}
})
