import { and,asc,eq } from 'drizzle-orm'
import { env } from 'node:process'
import { defineEventHandler,setHeader } from 'h3'
import { getDatabase,hasNeonDatabase } from '../db/client'
import { portfolioItems,salons,services,siteContent } from '../db/schema'
function publicOrigin(){try{const url=new URL(env.NUXT_PUBLIC_SITE_URL||'');return url.protocol==='https:'&&!url.username&&!url.password?url.origin:''}catch{return''}}
function escapeXml(value:string){return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;')}
function xmlUrl(loc:string,lastmod?:Date){return`<url><loc>${escapeXml(loc)}</loc>${lastmod?`<lastmod>${lastmod.toISOString().slice(0,10)}</lastmod>`:''}</url>`}
function emptySitemap(){return'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'}
export default defineEventHandler(async(event)=>{
  setHeader(event,'Content-Type','application/xml; charset=utf-8')
  setHeader(event,'Cache-Control','public, max-age=300, stale-while-revalidate=600')
  const origin=publicOrigin()
  if(env.NUXT_PUBLIC_DEMO_MODE!=='false'||!hasNeonDatabase()||!origin)return emptySitemap()
  const db=getDatabase(),[salon]=await db.select().from(salons).where(eq(salons.status,'active')).orderBy(asc(salons.createdAt)).limit(1)
  if(!salon)return emptySitemap()
  const[serviceRows,portfolioRows,contentRows]=await Promise.all([
    db.select({slug:services.slug,updatedAt:services.updatedAt}).from(services).where(and(eq(services.salonId,salon.id),eq(services.active,true))),
    db.select({slug:portfolioItems.slug,updatedAt:portfolioItems.updatedAt}).from(portfolioItems).where(and(eq(portfolioItems.salonId,salon.id),eq(portfolioItems.published,true))),
    db.select().from(siteContent).where(eq(siteContent.salonId,salon.id)),
  ])
  const paths=['/']
  if(serviceRows.length)paths.push('/prestations','/reservation')
  if(portfolioRows.length)paths.push('/realisations')
  const content=new Map(contentRows.map((row)=>[row.contentKey,row.content]))
  const about=content.get('about'),faq=content.get('faq'),contact=content.get('contact')
  if((typeof about?.intro==='string'&&about.intro.trim())||(typeof about?.story==='string'&&about.story.trim())||salon.description)paths.push('/a-propos')
  if(Array.isArray(faq?.items)&&faq.items.length)paths.push('/faq')
  if(salon.phone||salon.whatsapp||salon.email||salon.address||salon.city||Object.keys(contact||{}).length)paths.push('/contact')
  const records=[...paths.map((path)=>xmlUrl(new URL(path,origin).toString(),salon.updatedAt)),...serviceRows.map((item)=>xmlUrl(new URL(`/prestations/${encodeURIComponent(item.slug)}`,origin).toString(),item.updatedAt)),...portfolioRows.map((item)=>xmlUrl(new URL(`/realisations/${encodeURIComponent(item.slug)}`,origin).toString(),item.updatedAt))]
  return`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${records.join('')}</urlset>`
})
