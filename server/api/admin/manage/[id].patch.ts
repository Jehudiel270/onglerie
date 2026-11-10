import { and, eq, inArray } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody, setHeader } from 'h3'
import { z } from 'zod'
import { requireSalonRole } from '../../../utils/admin-guard'
import { DEFAULT_SALON_APPEARANCE } from '~~/shared/constants/appearance'
import { auditLogs, categories, contactMessages, customers, notificationOutbox, portfolioItemTags, portfolioItems, portfolioTags, salonSettings, salons, scheduleExceptions, services, siteContent, staff, staffSchedules, staffServices } from '../../../db/schema'
import { getDatabase } from '../../../db/client'

const slugSchema=z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const image=z.string().trim().max(2048).optional().or(z.literal('')).refine((value)=>!value||value.startsWith('/manus-storage/')||value.startsWith('https://res.cloudinary.com/'))
const categorySchema=z.object({name:z.string().trim().min(2).max(80),slug:slugSchema,kind:z.enum(['service','portfolio']),description:z.string().trim().max(1000).optional().or(z.literal('')),imageUrl:image,position:z.number().int().min(0).max(10000),active:z.boolean()}).partial().strict()
const serviceSchema=z.object({name:z.string().trim().min(2).max(100),slug:slugSchema,description:z.string().trim().min(8).max(3000),details:z.string().trim().max(8000).optional().or(z.literal('')),categoryId:z.string().uuid().nullable().optional(),priceXof:z.number().int().min(0).max(10000000),durationMinutes:z.number().int().min(10).max(600),preparationMinutes:z.number().int().min(0).max(180),depositXof:z.number().int().min(0).max(10000000),imageUrl:image,conditions:z.string().trim().max(2000).optional().or(z.literal('')),active:z.boolean(),featured:z.boolean(),position:z.number().int().min(0).max(10000)}).partial().strict()
const portfolioSchema=z.object({title:z.string().trim().min(2).max(150),slug:slugSchema,description:z.string().trim().max(3000).optional().or(z.literal('')),categoryId:z.string().uuid().nullable().optional(),serviceId:z.string().uuid().nullable().optional(),style:z.string().trim().max(100).optional().or(z.literal('')),color:z.string().trim().max(100).optional().or(z.literal('')),shape:z.string().trim().max(100).optional().or(z.literal('')),length:z.string().trim().max(100).optional().or(z.literal('')),technique:z.string().trim().max(150).optional().or(z.literal('')),imageUrls:z.array(z.string().url().max(2048).or(z.string().startsWith('/manus-storage/').max(2048))).max(10),tags:z.array(z.string().trim().min(1).max(60)).max(20),published:z.boolean(),featured:z.boolean(),trend:z.boolean()}).partial().strict()
const staffSchema=z.object({firstName:z.string().trim().min(2).max(80),lastName:z.string().trim().max(80).optional().or(z.literal('')),bio:z.string().trim().max(1200).optional().or(z.literal('')),imageUrl:image,active:z.boolean(),serviceIds:z.array(z.string().uuid()).max(100)}).partial().strict()
const scheduleSchema=z.object({weekday:z.number().int().min(0).max(6),staffId:z.string().uuid().nullable().optional(),opensAt:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),closesAt:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),breakStartsAt:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),breakEndsAt:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),active:z.boolean()}).partial().strict()
const exceptionSchema=z.object({staffId:z.string().uuid().nullable().optional(),startsAt:z.string().datetime({offset:true}),endsAt:z.string().datetime({offset:true}),kind:z.enum(['closed','leave','blocked','holiday','extra_hours']),note:z.string().trim().max(500).optional().or(z.literal(''))}).partial().strict()
const envelope=z.object({resource:z.enum(['categories','services','portfolio','staff','schedules','exceptions','content','settings','salon','notifications','contacts','customers']),data:z.record(z.string(),z.unknown())}).strict()
const makeSlug=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,95)||'tag'
export default defineEventHandler(async(event)=>{
  setHeader(event,'Cache-Control','private, no-store, max-age=0')
  const{db,salonId,user}=await requireSalonRole(event,['owner']),id=getRouterParam(event,'id')||''
  if(!z.string().uuid().safeParse(id).success)throw createError({statusCode:400,statusMessage:'Identifiant invalide.'})
  const parsed=envelope.safeParse(await readBody(event));if(!parsed.success)throw createError({statusCode:422,statusMessage:'Requête invalide.',data:parsed.error.flatten()})
  const{resource,data}=parsed.data
  if(resource==='services'){
    const value=serviceSchema.safeParse(data);if(!value.success||!Object.keys(value.data||{}).length)throw createError({statusCode:422,statusMessage:'Modification de prestation invalide.',data:value.success?undefined:value.error.flatten()})
    const[current]=await db.select().from(services).where(and(eq(services.id,id),eq(services.salonId,salonId))).limit(1);if(!current)throw createError({statusCode:404,statusMessage:'Prestation introuvable.'})
    const merged={...current,...value.data};if(merged.depositXof>merged.priceXof)throw createError({statusCode:422,statusMessage:'L’acompte ne peut pas dépasser le prix.'})
    if(value.data.categoryId){const[cat]=await db.select({id:categories.id}).from(categories).where(and(eq(categories.id,value.data.categoryId),eq(categories.salonId,salonId),eq(categories.kind,'service'))).limit(1);if(!cat)throw createError({statusCode:422,statusMessage:'Catégorie inconnue.'})}
    const[updated]=await db.update(services).set({...value.data,details:value.data.details||null,imageUrl:value.data.imageUrl||null,conditions:value.data.conditions||null,updatedAt:new Date()}).where(and(eq(services.id,id),eq(services.salonId,salonId))).returning();await db.insert(auditLogs).values({salonId,userId:user.id,action:'service_update',entity:'service',entityId:id});return{item:updated}
  }
  if(resource==='categories'){
    const value=categorySchema.safeParse(data);if(!value.success||!Object.keys(value.data||{}).length)throw createError({statusCode:422,statusMessage:'Modification invalide.'})
    const[updated]=await db.update(categories).set({...value.data,description:value.data.description||null,imageUrl:value.data.imageUrl||null,updatedAt:new Date()}).where(and(eq(categories.id,id),eq(categories.salonId,salonId))).returning();if(!updated)throw createError({statusCode:404,statusMessage:'Catégorie introuvable.'});return{item:updated}
  }
  if(resource==='portfolio'){
    const value=portfolioSchema.safeParse(data);if(!value.success||!Object.keys(value.data||{}).length)throw createError({statusCode:422,statusMessage:'Modification de réalisation invalide.'})
    if(value.data.categoryId){const[cat]=await db.select({id:categories.id}).from(categories).where(and(eq(categories.id,value.data.categoryId),eq(categories.salonId,salonId),eq(categories.kind,'portfolio'))).limit(1);if(!cat)throw createError({statusCode:422,statusMessage:'Catégorie portfolio inconnue.'})}
    if(value.data.serviceId){const[service]=await db.select({id:services.id}).from(services).where(and(eq(services.id,value.data.serviceId),eq(services.salonId,salonId))).limit(1);if(!service)throw createError({statusCode:422,statusMessage:'Prestation associée inconnue.'})}
    const{tags,...changes}=value.data
    const updated=await db.transaction(async(tx)=>{const[row]=await tx.update(portfolioItems).set({...changes,...(changes.description!==undefined?{description:changes.description||null}:{}),updatedAt:new Date()}).where(and(eq(portfolioItems.id,id),eq(portfolioItems.salonId,salonId))).returning();if(!row)throw createError({statusCode:404,statusMessage:'Réalisation introuvable.'});if(tags){await tx.delete(portfolioItemTags).where(eq(portfolioItemTags.portfolioItemId,id));for(const tagName of tags){const slug=makeSlug(tagName);const[tag]=await tx.insert(portfolioTags).values({salonId,name:tagName,slug}).onConflictDoUpdate({target:[portfolioTags.salonId,portfolioTags.slug],set:{name:tagName}}).returning();if(!tag)throw createError({statusCode:500,statusMessage:'Un tag n’a pas été enregistré.'});await tx.insert(portfolioItemTags).values({portfolioItemId:id,tagId:tag.id}).onConflictDoNothing()}}return row})
    await db.insert(auditLogs).values({salonId,userId:user.id,action:'portfolio_update',entity:'portfolio_item',entityId:id});return{item:updated}
  }
  if(resource==='staff'){
    const value=staffSchema.safeParse(data);if(!value.success||!Object.keys(value.data||{}).length)throw createError({statusCode:422,statusMessage:'Modification d’équipe invalide.'})
    const{serviceIds,...changes}=value.data
    if(serviceIds){const found=await db.select({id:services.id}).from(services).where(and(eq(services.salonId,salonId),inArray(services.id,serviceIds)));if(found.length!==serviceIds.length)throw createError({statusCode:422,statusMessage:'Une prestation associée est inconnue.'})}
    const updated=await db.transaction(async(tx)=>{const[row]=await tx.update(staff).set({...changes,lastName:changes.lastName||null,bio:changes.bio||null,imageUrl:changes.imageUrl||null,updatedAt:new Date()}).where(and(eq(staff.id,id),eq(staff.salonId,salonId))).returning();if(!row)throw createError({statusCode:404,statusMessage:'Professionnelle introuvable.'});if(serviceIds){await tx.delete(staffServices).where(and(eq(staffServices.staffId,id),eq(staffServices.salonId,salonId)));if(serviceIds.length)await tx.insert(staffServices).values(serviceIds.map((serviceId)=>({salonId,staffId:id,serviceId}))) }return row});return{item:updated}
  }
  if(resource==='schedules'){
    const value=scheduleSchema.safeParse(data);if(!value.success||!Object.keys(value.data||{}).length)throw createError({statusCode:422,statusMessage:'Horaire invalide.'})
    const[current]=await db.select().from(staffSchedules).where(and(eq(staffSchedules.id,id),eq(staffSchedules.salonId,salonId))).limit(1);if(!current)throw createError({statusCode:404,statusMessage:'Horaire introuvable.'})
    const merged={...current,...value.data};if(merged.opensAt>=merged.closesAt||Boolean(merged.breakStartsAt)!==Boolean(merged.breakEndsAt)||merged.breakStartsAt&&merged.breakEndsAt&&(merged.breakStartsAt>=merged.breakEndsAt||merged.breakStartsAt<merged.opensAt||merged.breakEndsAt>merged.closesAt))throw createError({statusCode:422,statusMessage:'Vérifiez les heures d’ouverture, de fermeture et de pause.'})
    const[row]=await db.update(staffSchedules).set({...value.data,staffId:value.data.staffId||null,breakStartsAt:value.data.breakStartsAt||null,breakEndsAt:value.data.breakEndsAt||null}).where(and(eq(staffSchedules.id,id),eq(staffSchedules.salonId,salonId))).returning();return{item:row}
  }
  if(resource==='exceptions'){
    const value=exceptionSchema.safeParse(data);if(!value.success||!Object.keys(value.data||{}).length)throw createError({statusCode:422,statusMessage:'Exception invalide.'})
    const[current]=await db.select().from(scheduleExceptions).where(and(eq(scheduleExceptions.id,id),eq(scheduleExceptions.salonId,salonId))).limit(1);if(!current)throw createError({statusCode:404,statusMessage:'Exception introuvable.'})
    const start=value.data.startsAt?new Date(value.data.startsAt):current.startsAt,end=value.data.endsAt?new Date(value.data.endsAt):current.endsAt;if(end<=start)throw createError({statusCode:422,statusMessage:'La fin doit suivre le début.'})
    const[row]=await db.update(scheduleExceptions).set({...value.data,staffId:value.data.staffId||null,startsAt:start,endsAt:end,note:value.data.note||null}).where(and(eq(scheduleExceptions.id,id),eq(scheduleExceptions.salonId,salonId))).returning();return{item:row}
  }
  if(resource==='content'){
    const value=z.object({contentKey:z.enum(['site','home','about','faq','legal','booking']),content:z.record(z.string(),z.unknown())}).strict().safeParse(data);if(!value.success)throw createError({statusCode:422,statusMessage:'Contenu invalide.'})
    const[row]=await db.insert(siteContent).values({salonId,contentKey:value.data.contentKey,content:value.data.content}).onConflictDoUpdate({target:[siteContent.salonId,siteContent.contentKey],set:{content:value.data.content,updatedAt:new Date()}}).returning();return{item:row}
  }
  if(resource==='settings'){
    const value=z.object({holdMinutes:z.number().int().min(5).max(30),minAdvanceHours:z.number().int().min(0).max(720),maxAdvanceDays:z.number().int().min(1).max(365),depositPercent:z.number().int().min(0).max(100),cancellationPolicy:z.string().trim().max(2000),remindersEnabled:z.boolean(),reminderHours:z.array(z.number().int().min(1).max(168)).max(3),defaultTheme:z.enum(['brand','light','dark']).default(DEFAULT_SALON_APPEARANCE.defaultTheme),buttonStyle:z.enum(['pill','soft','square']).default(DEFAULT_SALON_APPEARANCE.buttonStyle),floatingIconsEnabled:z.boolean().default(DEFAULT_SALON_APPEARANCE.floatingIconsEnabled),floatingIconDensity:z.number().int().min(0).max(12).default(DEFAULT_SALON_APPEARANCE.floatingIconDensity),floatingIconOpacity:z.number().int().min(4).max(24).default(DEFAULT_SALON_APPEARANCE.floatingIconOpacity),glassmorphismEnabled:z.boolean().default(DEFAULT_SALON_APPEARANCE.glassmorphismEnabled),scrollAnimationsEnabled:z.boolean().default(DEFAULT_SALON_APPEARANCE.scrollAnimationsEnabled),nailExperienceEnabled:z.boolean().default(DEFAULT_SALON_APPEARANCE.nailExperienceEnabled),scrollDurationScreens:z.number().int().min(4).max(9).default(DEFAULT_SALON_APPEARANCE.scrollDurationScreens)}).strict().safeParse(data);if(!value.success)throw createError({statusCode:422,statusMessage:'Paramètres invalides.'})
    const[row]=await db.insert(salonSettings).values({salonId,settings:value.data,updatedAt:new Date()}).onConflictDoUpdate({target:salonSettings.salonId,set:{settings:value.data,updatedAt:new Date()}}).returning();return{item:row}
  }
  if(resource==='salon'){
    const value=z.object({name:z.string().trim().min(2).max(120),description:z.string().trim().max(3000).optional().or(z.literal('')),phone:z.string().trim().max(25).optional().or(z.literal('')),whatsapp:z.string().trim().max(25).optional().or(z.literal('')),email:z.string().trim().email().max(254).optional().or(z.literal('')),address:z.string().trim().max(255).optional().or(z.literal('')),city:z.string().trim().max(120).optional().or(z.literal(''))}).strict().safeParse(data);if(!value.success)throw createError({statusCode:422,statusMessage:'Informations salon invalides.'})
    const[row]=await db.update(salons).set({...value.data,description:value.data.description||null,phone:value.data.phone||null,whatsapp:value.data.whatsapp||null,email:value.data.email||null,address:value.data.address||null,city:value.data.city||null,updatedAt:new Date()}).where(eq(salons.id,salonId)).returning();return{item:row}
  }
  if(resource==='customers'){
    const value=z.object({adminNote:z.string().trim().max(1500).optional().or(z.literal(''))}).strict().safeParse(data);if(!value.success)throw createError({statusCode:422,statusMessage:'Note invalide.'})
    const[row]=await db.update(customers).set({adminNote:value.data.adminNote||null,updatedAt:new Date()}).where(and(eq(customers.id,id),eq(customers.salonId,salonId))).returning({id:customers.id,adminNote:customers.adminNote});if(!row)throw createError({statusCode:404,statusMessage:'Cliente introuvable.'});await db.insert(auditLogs).values({salonId,userId:user.id,action:'customer_note_update',entity:'customer',entityId:id});return{item:row}
  }
  if(resource==='contacts'){
    const value=z.object({status:z.enum(['new','read','replied','archived'])}).strict().safeParse(data);if(!value.success)throw createError({statusCode:422,statusMessage:'Statut de message invalide.'})
    const[row]=await db.update(contactMessages).set({status:value.data.status}).where(and(eq(contactMessages.id,id),eq(contactMessages.salonId,salonId))).returning({id:contactMessages.id,status:contactMessages.status});if(!row)throw createError({statusCode:404,statusMessage:'Message introuvable.'});return{item:row}
  }
  if(resource==='notifications'){
    const value=z.object({action:z.literal('retry')}).strict().safeParse(data);if(!value.success)throw createError({statusCode:422,statusMessage:'Action de notification invalide.'})
    const[row]=await db.update(notificationOutbox).set({status:'queued',nextAttemptAt:new Date(),lastError:null,updatedAt:new Date()}).where(and(eq(notificationOutbox.id,id),eq(notificationOutbox.salonId,salonId),inArray(notificationOutbox.status,['failed','retry']))).returning({id:notificationOutbox.id});if(!row)throw createError({statusCode:409,statusMessage:'La notification ne peut pas être relancée dans son état actuel.'});await db.insert(auditLogs).values({salonId,userId:user.id,action:'notification_retry',entity:'notification',entityId:id});return{item:row}
  }
  throw createError({statusCode:404,statusMessage:'Ressource non prise en charge.'})
})
