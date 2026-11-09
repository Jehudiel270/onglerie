import { and, eq, gt, inArray, isNull, lt, ne, or } from 'drizzle-orm'
import { createError, defineEventHandler, readBody, setHeader } from 'h3'
import { z } from 'zod'
import { requireSalonRole } from '../../utils/admin-guard'
import { appointmentStatusHistory, appointments, auditLogs, categories, customers, notificationOutbox, payments, portfolioItemTags, portfolioItems, portfolioTags, salonSettings, salons, scheduleExceptions, services, siteContent, staff, staffSchedules, staffServices } from '../../db/schema'
import { manualPaymentPreflightReason, shouldConfirmManualPayment } from '../../services/manual-payment'

const slugSchema=z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const image=z.string().trim().max(2048).optional().or(z.literal('')).refine((value)=>!value||value.startsWith('/manus-storage/')||value.startsWith('https://res.cloudinary.com/'),{message:'Utilisez une ressource du stockage projet ou une URL Cloudinary HTTPS.'})
const categorySchema=z.object({name:z.string().trim().min(2).max(80),slug:slugSchema,kind:z.enum(['service','portfolio']),description:z.string().trim().max(1000).optional().or(z.literal('')),imageUrl:image,position:z.number().int().min(0).max(10000).default(0),active:z.boolean().default(true)}).strict()
const serviceSchema=z.object({name:z.string().trim().min(2).max(100),slug:slugSchema,description:z.string().trim().min(8).max(3000),details:z.string().trim().max(8000).optional().or(z.literal('')),categoryId:z.string().uuid().nullable().optional(),priceXof:z.number().int().min(0).max(10000000),durationMinutes:z.number().int().min(10).max(600),preparationMinutes:z.number().int().min(0).max(180).default(0),depositXof:z.number().int().min(0).max(10000000).default(0),imageUrl:image,conditions:z.string().trim().max(2000).optional().or(z.literal('')),active:z.boolean().default(true),featured:z.boolean().default(false),position:z.number().int().min(0).max(10000).default(0)}).strict()
const portfolioSchema=z.object({title:z.string().trim().min(2).max(150),slug:slugSchema,description:z.string().trim().max(3000).optional().or(z.literal('')),categoryId:z.string().uuid().nullable().optional(),serviceId:z.string().uuid().nullable().optional(),style:z.string().trim().max(100).optional().or(z.literal('')),color:z.string().trim().max(100).optional().or(z.literal('')),shape:z.string().trim().max(100).optional().or(z.literal('')),length:z.string().trim().max(100).optional().or(z.literal('')),technique:z.string().trim().max(150).optional().or(z.literal('')),imageUrls:z.array(z.string().url().max(2048).or(z.string().startsWith('/manus-storage/').max(2048))).max(10),tags:z.array(z.string().trim().min(1).max(60)).max(20).default([]),published:z.boolean().default(false),featured:z.boolean().default(false),trend:z.boolean().default(false)}).strict()
const staffSchema=z.object({firstName:z.string().trim().min(2).max(80),lastName:z.string().trim().max(80).optional().or(z.literal('')),bio:z.string().trim().max(1200).optional().or(z.literal('')),imageUrl:image,active:z.boolean().default(true),serviceIds:z.array(z.string().uuid()).max(100).default([])}).strict()
const timeSchema=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const scheduleSchema=z.object({weekday:z.number().int().min(0).max(6),staffId:z.string().uuid().nullable().optional(),opensAt:timeSchema,closesAt:timeSchema,breakStartsAt:timeSchema.nullable().optional(),breakEndsAt:timeSchema.nullable().optional(),active:z.boolean().default(true)}).strict()
const exceptionSchema=z.object({staffId:z.string().uuid().nullable().optional(),startsAt:z.string().datetime({offset:true}),endsAt:z.string().datetime({offset:true}),kind:z.enum(['closed','leave','blocked','holiday','extra_hours']),note:z.string().trim().max(500).optional().or(z.literal(''))}).strict()
const contentSchema=z.object({contentKey:z.enum(['site','home','about','faq','legal','booking']),content:z.record(z.string(),z.unknown())}).strict()
const settingsSchema=z.object({holdMinutes:z.number().int().min(5).max(30),minAdvanceHours:z.number().int().min(0).max(720),maxAdvanceDays:z.number().int().min(1).max(365),depositPercent:z.number().int().min(0).max(100),cancellationPolicy:z.string().trim().max(2000),remindersEnabled:z.boolean(),reminderHours:z.array(z.number().int().min(1).max(168)).max(3)}).strict().refine((value)=>value.reminderHours.every((hours,index)=>value.reminderHours.indexOf(hours)===index),{message:'Chaque délai de rappel doit être unique.'})
const salonSchema=z.object({name:z.string().trim().min(2).max(120),description:z.string().trim().max(3000).optional().or(z.literal('')),phone:z.string().trim().max(25).optional().or(z.literal('')),whatsapp:z.string().trim().max(25).optional().or(z.literal('')),email:z.string().trim().email().max(254).optional().or(z.literal('')),address:z.string().trim().max(255).optional().or(z.literal('')),city:z.string().trim().max(120).optional().or(z.literal(''))}).strict()
const envelope=z.object({resource:z.enum(['categories','services','portfolio','staff','schedules','exceptions','content','settings','salon','payments']),data:z.record(z.string(),z.unknown())}).strict()
const makeSlug=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,95)||'tag'
export default defineEventHandler(async(event)=>{
  setHeader(event,'Cache-Control','private, no-store, max-age=0')
  const {db,salonId,user}=await requireSalonRole(event,['owner','manager'])
  const raw=envelope.safeParse(await readBody(event));if(!raw.success)throw createError({statusCode:422,statusMessage:'Vérifiez la ressource et ses champs.',data:raw.error.flatten()})
  const {resource}=raw.data,data=raw.data.data
  if(resource==='categories'){
    const value=categorySchema.safeParse(data);if(!value.success)throw createError({statusCode:422,statusMessage:'Catégorie invalide.',data:value.error.flatten()})
    const [row]=await db.insert(categories).values({...value.data,salonId,description:value.data.description||null,imageUrl:value.data.imageUrl||null}).returning()
    if(!row)throw createError({statusCode:500,statusMessage:'La catégorie n’a pas été enregistrée.'})
    await db.insert(auditLogs).values({salonId,userId:user.id,action:'category_create',entity:'category',entityId:row.id})
    return{item:row}
  }
  if(resource==='services'){
    const value=serviceSchema.safeParse(data);if(!value.success)throw createError({statusCode:422,statusMessage:'Prestation invalide.',data:value.error.flatten()})
    if(value.data.depositXof>value.data.priceXof)throw createError({statusCode:422,statusMessage:'L’acompte ne peut pas dépasser le prix total.'})
    if(value.data.categoryId){const[category]=await db.select({id:categories.id}).from(categories).where(and(eq(categories.id,value.data.categoryId),eq(categories.salonId,salonId),eq(categories.kind,'service'))).limit(1);if(!category)throw createError({statusCode:422,statusMessage:'Catégorie de service inconnue dans ce salon.'})}
    const [row]=await db.insert(services).values({...value.data,salonId,details:value.data.details||null,imageUrl:value.data.imageUrl||null,conditions:value.data.conditions||null}).returning()
    if(!row)throw createError({statusCode:500,statusMessage:'La prestation n’a pas été enregistrée.'})
    await db.insert(auditLogs).values({salonId,userId:user.id,action:'service_create',entity:'service',entityId:row.id})
    return{item:row}
  }
  if(resource==='portfolio'){
    const value=portfolioSchema.safeParse(data);if(!value.success)throw createError({statusCode:422,statusMessage:'Réalisation invalide.',data:value.error.flatten()})
    if(value.data.categoryId){const[category]=await db.select({id:categories.id}).from(categories).where(and(eq(categories.id,value.data.categoryId),eq(categories.salonId,salonId),eq(categories.kind,'portfolio'))).limit(1);if(!category)throw createError({statusCode:422,statusMessage:'Catégorie portfolio inconnue.'})}
    if(value.data.serviceId){const[service]=await db.select({id:services.id}).from(services).where(and(eq(services.id,value.data.serviceId),eq(services.salonId,salonId))).limit(1);if(!service)throw createError({statusCode:422,statusMessage:'Prestation reliée inconnue.'})}
    const item=await db.transaction(async(tx)=>{
      const [created]=await tx.insert(portfolioItems).values({salonId,title:value.data.title,slug:value.data.slug,description:value.data.description||null,categoryId:value.data.categoryId||null,serviceId:value.data.serviceId||null,style:value.data.style||null,color:value.data.color||null,shape:value.data.shape||null,length:value.data.length||null,technique:value.data.technique||null,imageUrls:value.data.imageUrls,published:value.data.published,featured:value.data.featured,trend:value.data.trend}).returning()
      if(!created)throw createError({statusCode:500,statusMessage:'La réalisation n’a pas été enregistrée.'})
      for(const tagName of value.data.tags){const slug=makeSlug(tagName);const[tag]=await tx.insert(portfolioTags).values({salonId,name:tagName,slug}).onConflictDoUpdate({target:[portfolioTags.salonId,portfolioTags.slug],set:{name:tagName}}).returning();if(!tag)throw createError({statusCode:500,statusMessage:'Un tag n’a pas été enregistré.'});await tx.insert(portfolioItemTags).values({portfolioItemId:created.id,tagId:tag.id}).onConflictDoNothing()}
      return created
    })
    await db.insert(auditLogs).values({salonId,userId:user.id,action:'portfolio_create',entity:'portfolio_item',entityId:item.id})
    return{item}
  }
  if(resource==='staff'){
    const value=staffSchema.safeParse(data);if(!value.success)throw createError({statusCode:422,statusMessage:'Profil d’équipe invalide.',data:value.error.flatten()})
    const selected=value.data.serviceIds.length?await db.select({id:services.id}).from(services).where(and(eq(services.salonId,salonId),inArray(services.id,value.data.serviceIds))):[]
    if(selected.length!==value.data.serviceIds.length)throw createError({statusCode:422,statusMessage:'Une prestation associée n’appartient pas à ce salon.'})
    const person=await db.transaction(async(tx)=>{const [created]=await tx.insert(staff).values({salonId,firstName:value.data.firstName,lastName:value.data.lastName||null,bio:value.data.bio||null,imageUrl:value.data.imageUrl||null,active:value.data.active}).returning();if(!created)throw createError({statusCode:500,statusMessage:'Le profil n’a pas été enregistré.'});if(value.data.serviceIds.length)await tx.insert(staffServices).values(value.data.serviceIds.map((serviceId)=>({salonId,staffId:created.id,serviceId})));return created})
    return{item:person}
  }
  if(resource==='schedules'){
    const value=scheduleSchema.safeParse(data);if(!value.success)throw createError({statusCode:422,statusMessage:'Horaire invalide.',data:value.error.flatten()})
    if(value.data.opensAt>=value.data.closesAt)throw createError({statusCode:422,statusMessage:'L’heure de fermeture doit être après l’ouverture.'})
    if(Boolean(value.data.breakStartsAt)!==Boolean(value.data.breakEndsAt)||value.data.breakStartsAt&&value.data.breakEndsAt&&(value.data.breakStartsAt>=value.data.breakEndsAt||value.data.breakStartsAt<value.data.opensAt||value.data.breakEndsAt>value.data.closesAt))throw createError({statusCode:422,statusMessage:'Vérifiez les heures de pause.'})
    if(value.data.staffId){const[person]=await db.select({id:staff.id}).from(staff).where(and(eq(staff.id,value.data.staffId),eq(staff.salonId,salonId))).limit(1);if(!person)throw createError({statusCode:422,statusMessage:'Professionnelle non autorisée.'})}
    const[row]=await db.insert(staffSchedules).values({salonId,weekday:value.data.weekday,staffId:value.data.staffId||null,opensAt:value.data.opensAt,closesAt:value.data.closesAt,breakStartsAt:value.data.breakStartsAt||null,breakEndsAt:value.data.breakEndsAt||null,active:value.data.active}).returning()
    return{item:row}
  }
  if(resource==='exceptions'){
    const value=exceptionSchema.safeParse(data);if(!value.success)throw createError({statusCode:422,statusMessage:'Exception de calendrier invalide.',data:value.error.flatten()})
    if(new Date(value.data.endsAt)<=new Date(value.data.startsAt))throw createError({statusCode:422,statusMessage:'La fin doit suivre le début.'})
    if(value.data.staffId){const[person]=await db.select({id:staff.id}).from(staff).where(and(eq(staff.id,value.data.staffId),eq(staff.salonId,salonId))).limit(1);if(!person)throw createError({statusCode:422,statusMessage:'Professionnelle non autorisée.'})}
    const[row]=await db.insert(scheduleExceptions).values({salonId,staffId:value.data.staffId||null,startsAt:new Date(value.data.startsAt),endsAt:new Date(value.data.endsAt),kind:value.data.kind,note:value.data.note||null}).returning();return{item:row}
  }
  if(resource==='content'){
    const value=contentSchema.safeParse(data);if(!value.success)throw createError({statusCode:422,statusMessage:'Contenu invalide.',data:value.error.flatten()})
    const[row]=await db.insert(siteContent).values({salonId,contentKey:value.data.contentKey,content:value.data.content}).onConflictDoUpdate({target:[siteContent.salonId,siteContent.contentKey],set:{content:value.data.content,updatedAt:new Date()}}).returning();return{item:row}
  }
  if(resource==='settings'){
    const value=settingsSchema.safeParse(data);if(!value.success)throw createError({statusCode:422,statusMessage:'Paramètres invalides.',data:value.error.flatten()})
    const[row]=await db.insert(salonSettings).values({salonId,settings:value.data,updatedAt:new Date()}).onConflictDoUpdate({target:salonSettings.salonId,set:{settings:value.data,updatedAt:new Date()}}).returning();return{item:row}
  }
  if(resource==='salon'){
    const value=salonSchema.safeParse(data);if(!value.success)throw createError({statusCode:422,statusMessage:'Coordonnées invalides.',data:value.error.flatten()})
    const[row]=await db.update(salons).set({...value.data,description:value.data.description||null,phone:value.data.phone||null,whatsapp:value.data.whatsapp||null,email:value.data.email||null,address:value.data.address||null,city:value.data.city||null,updatedAt:new Date()}).where(eq(salons.id,salonId)).returning();return{item:row}
  }
  if(resource==='payments'){
    const value=z.object({appointmentId:z.string().uuid(),amountXof:z.number().int().positive().max(10000000),method:z.enum(['cash','mobile_money','bank_transfer','other']),reference:z.string().trim().max(120).optional().or(z.literal(''))}).strict().safeParse(data)
    if(!value.success)throw createError({statusCode:422,statusMessage:'Paiement manuel invalide.',data:value.error.flatten()})
    const saved=await db.transaction(async(tx)=>{
      const[appointment]=await tx.select().from(appointments).where(and(eq(appointments.id,value.data.appointmentId),eq(appointments.salonId,salonId))).for('update').limit(1)
      if(!appointment)throw createError({statusCode:404,statusMessage:'Rendez-vous introuvable dans ce salon.'})
      if(value.data.amountXof>Math.max(0,appointment.totalXof-appointment.amountPaidXof))throw createError({statusCode:422,statusMessage:'Le montant dépasse le solde restant.'})
      const now=new Date()
      let reviewReason=manualPaymentPreflightReason({status:appointment.status,startsAt:appointment.startsAt,expiresAt:appointment.expiresAt,staffId:appointment.staffId,now})||''
      if(appointment.status==='pending_payment'&&!reviewReason&&appointment.staffId){
          const[conflict]=await tx.select({id:appointments.id}).from(appointments).where(and(eq(appointments.salonId,salonId),eq(appointments.staffId,appointment.staffId),lt(appointments.startsAt,appointment.endsAt),gt(appointments.endsAt,appointment.startsAt),ne(appointments.id,appointment.id),or(eq(appointments.status,'confirmed'),and(eq(appointments.status,'pending_payment'),or(isNull(appointments.expiresAt),gt(appointments.expiresAt,now)))))).limit(1)
          if(conflict)reviewReason='Une autre réservation occupe déjà ce créneau.'
      }
      if(value.data.reference){const[duplicate]=await tx.select({id:payments.id}).from(payments).where(and(eq(payments.provider,'manual'),eq(payments.providerReference,value.data.reference))).limit(1);if(duplicate)throw createError({statusCode:409,statusMessage:'Cette référence de paiement est déjà enregistrée.'})}
      const [payment]=await tx.insert(payments).values({salonId,appointmentId:appointment.id,provider:'manual',providerReference:value.data.reference||`MAN-${crypto.randomUUID()}`,amountXof:value.data.amountXof,currency:'XOF',method:value.data.method,status:'paid',reconciled:!reviewReason,paidAt:now}).returning()
      if(!payment)throw createError({statusCode:500,statusMessage:'Le paiement n’a pas été enregistré.'})
      const amountPaidXof=reviewReason?appointment.amountPaidXof:appointment.amountPaidXof+value.data.amountXof
      const shouldConfirm=shouldConfirmManualPayment({status:appointment.status,alreadyPaidXof:appointment.amountPaidXof,paymentXof:value.data.amountXof,depositDueXof:appointment.depositDueXof,reviewRequired:Boolean(reviewReason)})
      const releasePending=Boolean(reviewReason)&&appointment.status==='pending_payment'
      await tx.update(appointments).set({amountPaidXof,...(shouldConfirm?{status:'confirmed',expiresAt:null}:releasePending?{status:'expired',expiresAt:now}:{}),updatedAt:now}).where(eq(appointments.id,appointment.id))
      if(shouldConfirm)await tx.insert(appointmentStatusHistory).values({salonId,appointmentId:appointment.id,fromStatus:'pending_payment',toStatus:'confirmed',actorUserId:user.id,reason:'Acompte enregistré et rapproché manuellement.'})
      else if(releasePending)await tx.insert(appointmentStatusHistory).values({salonId,appointmentId:appointment.id,fromStatus:'pending_payment',toStatus:'expired',actorUserId:user.id,reason:`Paiement reçu mais non rapproché; créneau libéré. ${reviewReason}`})
      const[customer]=await tx.select().from(customers).where(and(eq(customers.id,appointment.customerId),eq(customers.salonId,salonId))).limit(1)
      const payload={reference:appointment.reference,startsAt:appointment.startsAt.toISOString(),totalXof:appointment.totalXof,depositPaidXof:amountPaidXof,remainingXof:Math.max(0,appointment.totalXof-amountPaidXof)}
      const templateKey=shouldConfirm?'booking_confirmed':'booking_payment_received',paymentPayload={...payload,paymentXof:value.data.amountXof,paymentMethod:value.data.method}
      if(!reviewReason&&customer?.email)await tx.insert(notificationOutbox).values({salonId,dedupeKey:`payment:${payment.id}:email`,recipient:customer.email,channel:'email',templateKey,payload:paymentPayload}).onConflictDoNothing()
      const contact=customer?.whatsapp||customer?.phone;if(!reviewReason&&contact)await tx.insert(notificationOutbox).values({salonId,dedupeKey:`payment:${payment.id}:whatsapp`,recipient:contact,channel:'whatsapp',templateKey,payload:paymentPayload}).onConflictDoNothing()
      await tx.insert(auditLogs).values({salonId,userId:user.id,action:reviewReason?'manual_payment_review':'manual_payment_recorded',entity:'payment',entityId:payment.id,metadata:{appointmentId:appointment.id,amountXof:value.data.amountXof,method:value.data.method,reviewReason:reviewReason||null,appointmentConfirmed:shouldConfirm}})
      return{payment,reviewReason,shouldConfirm}
    })
    return{item:saved.payment,reviewReason:saved.reviewReason||null,message:saved.reviewReason?'Paiement reçu mais non rapproché. Le rendez-vous n’a pas été confirmé; le paiement demande une vérification manuelle.':saved.shouldConfirm?'Acompte reçu et rapproché; rendez-vous confirmé.':'Paiement manuel enregistré comme reçu; aucun statut confirmé n’a été déduit sans acompte suffisant.'}
  }
  throw createError({statusCode:404,statusMessage:'Ressource non gérée.'})
})
