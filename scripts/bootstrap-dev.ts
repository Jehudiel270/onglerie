import 'dotenv/config'
import { env } from 'node:process'
import { Pool } from '@neondatabase/serverless'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-serverless'
import * as schema from '../server/db/schema.js'

// Création (ou promotion) d'un compte DÉVELOPPEUR plateforme (user.role='dev').
// Ce compte n'appartient à aucun salon : le garde serveur le reconnaît et lui
// donne accès à tous les salons avec toutes les permissions, sans adhésion.
// Le compte développeur du client ne passe JAMAIS par l'interface web : ce
// script exige un accès direct à la base, réservé à l'équipe technique.
//
// Usage (une seule commande) :
//   ALLOW_DEV_BOOTSTRAP=YES_CREATE_FIRST_DEV \
//   NEON_DATABASE_URL_UNPOOLED=... \
//   BOOTSTRAP_DEV_NAME="Votre Nom" \
//   BOOTSTRAP_DEV_EMAIL=dev@exemple.com \
//   BOOTSTRAP_DEV_PASSWORD="MotDePasseTresSolide14" \
//   pnpm bootstrap:dev
// Si l'e-mail existe déjà, le mot de passe est vérifié avant la promotion.

const databaseUrl=env.NEON_DATABASE_URL_UNPOOLED||env.NEON_DATABASE_URL
if(env.ALLOW_DEV_BOOTSTRAP!=='YES_CREATE_FIRST_DEV')throw new Error('Opération bloquée. Pour autoriser explicitement la création, définissez ALLOW_DEV_BOOTSTRAP=YES_CREATE_FIRST_DEV pour cette commande uniquement.')
if(!databaseUrl)throw new Error('Renseignez NEON_DATABASE_URL_UNPOOLED (connexion directe Neon) pour cette exécution.')
if(!env.BOOTSTRAP_DEV_NAME||!env.BOOTSTRAP_DEV_EMAIL||!env.BOOTSTRAP_DEV_PASSWORD)throw new Error('Renseignez BOOTSTRAP_DEV_NAME, BOOTSTRAP_DEV_EMAIL et BOOTSTRAP_DEV_PASSWORD dans l’environnement pour cette exécution.')
if(env.BOOTSTRAP_DEV_PASSWORD.length<14||!/[a-z]/.test(env.BOOTSTRAP_DEV_PASSWORD)||!/[A-Z]/.test(env.BOOTSTRAP_DEV_PASSWORD)||!/[0-9]/.test(env.BOOTSTRAP_DEV_PASSWORD))throw new Error('Le mot de passe du compte développement doit faire au moins 14 caractères et inclure une minuscule, une majuscule et un chiffre.')
const devEmail=env.BOOTSTRAP_DEV_EMAIL.trim().toLowerCase()
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(devEmail))throw new Error('Adresse e-mail du développeur invalide.')
const pool=new Pool({connectionString:databaseUrl})
const db=drizzle(pool,{schema})
const auth=betterAuth({baseURL:env.BETTER_AUTH_URL||'http://localhost:3000',secret:env.BETTER_AUTH_SECRET||'bootstrap-only-secret-not-used-for-password-hashing',database:drizzleAdapter(db,{provider:'pg',schema:{user:schema.users,session:schema.sessions,account:schema.accounts,verification:schema.verifications}}),emailAndPassword:{enabled:true},user:{additionalFields:{role:{type:'string',defaultValue:'customer',input:false}}}})
try{
  let userId:string
  const[existing]=await db.select({id:schema.users.id,role:schema.users.role}).from(schema.users).where(eq(schema.users.email,devEmail)).limit(1)
  if(existing){
    // Promotion d'un compte existant : le mot de passe fourni doit correspondre.
    const verified=await auth.api.signInEmail({body:{email:devEmail,password:env.BOOTSTRAP_DEV_PASSWORD}})
    userId=verified.user.id
    if(existing.role==='dev')console.log('Ce compte est déjà développeur ; rien à faire.')
  }else{
    const created=await auth.api.signUpEmail({body:{name:env.BOOTSTRAP_DEV_NAME.trim(),email:devEmail,password:env.BOOTSTRAP_DEV_PASSWORD}})
    userId=created.user.id
  }
  const[membership]=await db.select({id:schema.salonMemberships.id}).from(schema.salonMemberships).where(eq(schema.salonMemberships.userId,userId)).limit(1)
  await db.transaction(async(tx)=>{
    await tx.update(schema.users).set({role:'dev',updatedAt:new Date()}).where(eq(schema.users.id,userId))
    // Un compte développeur ne doit pas porter d'adhésion salon : les droits
    // viennent du rôle plateforme, pas d'une équipe.
    if(membership)await tx.update(schema.salonMemberships).set({active:false,updatedAt:new Date()}).where(eq(schema.salonMemberships.id,membership.id))
  })
  if(membership)console.log('Une adhésion salon existante a été désactivée pour ce compte (le rôle dev s’applique à toute la plateforme).')
  console.log(`Compte développeur prêt pour ${devEmail}. Connexion : /connexion puis /admin (tous les salons, toutes les fonctions).`)
  console.log('Le mot de passe n’a pas été affiché. Retirez immédiatement les variables temporaires de votre shell.')
}finally{await pool.end()}
