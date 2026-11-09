import 'dotenv/config'
import { env } from 'node:process'
import { Pool } from '@neondatabase/serverless'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-serverless'
import * as schema from '../server/db/schema.js'

const databaseUrl=env.NEON_DATABASE_URL_UNPOOLED||env.NEON_DATABASE_URL
const required={name:env.BOOTSTRAP_OWNER_NAME,email:env.BOOTSTRAP_OWNER_EMAIL,password:env.BOOTSTRAP_OWNER_PASSWORD,salon:env.BOOTSTRAP_SALON_NAME,slug:env.BOOTSTRAP_SALON_SLUG}
if(env.ALLOW_OWNER_BOOTSTRAP!=='YES_CREATE_FIRST_OWNER')throw new Error('Opération bloquée. Pour autoriser explicitement la première création, définissez ALLOW_OWNER_BOOTSTRAP=YES_CREATE_FIRST_OWNER pour cette commande uniquement.')
if(!databaseUrl||!env.BETTER_AUTH_SECRET||Object.values(required).some((value)=>!value))throw new Error('Renseignez NEON_DATABASE_URL, BETTER_AUTH_SECRET et BOOTSTRAP_OWNER_NAME/EMAIL/PASSWORD/SALON_NAME/SLUG dans l’environnement pour cette exécution.')
if(required.password!.length<14||!/[a-z]/.test(required.password!)||!/[A-Z]/.test(required.password!)||!/[0-9]/.test(required.password!))throw new Error('Le mot de passe initial doit faire au moins 14 caractères et inclure une minuscule, une majuscule et un chiffre.')
if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(required.slug!))throw new Error('BOOTSTRAP_SALON_SLUG doit utiliser des lettres minuscules, des chiffres et des tirets.')
const ownerEmail=required.email!.trim().toLowerCase()
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail))throw new Error('Adresse e-mail du propriétaire invalide.')
const pool=new Pool({connectionString:databaseUrl})
const db=drizzle(pool,{schema})
const auth=betterAuth({baseURL:env.BETTER_AUTH_URL||'http://localhost:3000',secret:env.BETTER_AUTH_SECRET,database:drizzleAdapter(db,{provider:'pg',schema:{user:schema.users,session:schema.sessions,account:schema.accounts,verification:schema.verifications}}),emailAndPassword:{enabled:true},user:{additionalFields:{role:{type:'string',defaultValue:'customer',input:false}}}})
try{
  const[activeOwner]=await db.select({id:schema.salonMemberships.id}).from(schema.salonMemberships).where(eq(schema.salonMemberships.role,'owner')).limit(1)
  if(activeOwner)throw new Error('Un compte propriétaire est déjà enregistré. Le script est réservé au premier propriétaire.')
  let userId:string
  const[existing]=await db.select({id:schema.users.id}).from(schema.users).where(eq(schema.users.email,ownerEmail)).limit(1)
  if(existing){
    const verified=await auth.api.signInEmail({body:{email:ownerEmail,password:required.password!}})
    userId=verified.user.id
  }else{
    const created=await auth.api.signUpEmail({body:{name:required.name!.trim(),email:ownerEmail,password:required.password!}})
    userId=created.user.id
  }
  await db.transaction(async(tx)=>{
    const[existingMembership]=await tx.select({id:schema.salonMemberships.id}).from(schema.salonMemberships).where(eq(schema.salonMemberships.userId,userId)).limit(1)
    if(existingMembership)throw new Error('Ce compte appartient déjà à un salon ; le bootstrap ne le reconfigure pas.')
    const[salon]=await tx.insert(schema.salons).values({name:required.salon!.trim(),slug:required.slug!,city:env.BOOTSTRAP_SALON_CITY?.trim()||null,status:'active',timezone:'Africa/Porto-Novo',currency:'XOF',country:'BJ'}).returning({id:schema.salons.id})
    if(!salon)throw new Error('Le salon n’a pas été créé.')
    await tx.update(schema.users).set({role:'owner',updatedAt:new Date()}).where(eq(schema.users.id,userId))
    await tx.insert(schema.salonMemberships).values({salonId:salon.id,userId,role:'owner',active:true})
    await tx.insert(schema.salonSettings).values({salonId:salon.id,settings:{holdMinutes:10,minAdvanceHours:2,maxAdvanceDays:60,depositPercent:0,cancellationPolicy:'',remindersEnabled:true,reminderHours:[24,2]}})
  })
  console.log(`Premier propriétaire configuré pour ${ownerEmail}. Les services, horaires et tarifs restent à saisir dans l’administration.`)
  console.log('Le mot de passe n’a pas été affiché. Retirez immédiatement les variables temporaires de votre shell.')
}finally{await pool.end()}
