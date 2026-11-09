import { eq } from 'drizzle-orm'
import { env } from 'node:process'
import { defineEventHandler,setHeader } from 'h3'
import { getDatabase,hasNeonDatabase } from '../db/client'
import { salons } from '../db/schema'
function publicOrigin(){try{const url=new URL(env.NUXT_PUBLIC_SITE_URL||'');return url.protocol==='https:'&&!url.username&&!url.password?url.origin:''}catch{return''}}
export default defineEventHandler(async(event)=>{
  setHeader(event,'Content-Type','text/plain; charset=utf-8')
  setHeader(event,'Cache-Control','public, max-age=300')
  let ready=env.NUXT_PUBLIC_DEMO_MODE==='false'&&hasNeonDatabase()
  if(ready){try{const[active]=await getDatabase().select({id:salons.id}).from(salons).where(eq(salons.status,'active')).limit(1);ready=Boolean(active)}catch{ready=false}}
  if(!ready)return'User-agent: *\nDisallow: /\n'
  const origin=publicOrigin()
  return`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /mon-compte\nDisallow: /connexion\nDisallow: /inscription\n${origin?`Sitemap: ${origin}/sitemap.xml\n`:''}`
})
