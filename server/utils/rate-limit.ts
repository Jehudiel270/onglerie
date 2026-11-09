import { createHash } from 'node:crypto'
import { env } from 'node:process'
import { eq,sql } from 'drizzle-orm'
import { createError,getRequestIP,setHeader,type H3Event } from 'h3'
import { apiRateLimits } from '../db/schema'
import { getDatabase,hasNeonDatabase } from '../db/client'

type Bucket={count:number;resetAt:number}
const localBuckets=new Map<string,Bucket>()
function reject(event:H3Event,resetAt:number){setHeader(event,'Retry-After',Math.max(1,Math.ceil((resetAt-Date.now())/1000)));throw createError({statusCode:429,statusMessage:'Trop de tentatives. Réessayez un peu plus tard.'})}
function localLimit(event:H3Event,scope:string,ip:string,maximum:number,windowMs:number){
  const key=`${scope}:${ip}`,now=Date.now(),current=localBuckets.get(key)
  if(!current||current.resetAt<=now)localBuckets.set(key,{count:1,resetAt:now+windowMs})
  else if(current.count>=maximum)reject(event,current.resetAt)
  else current.count++
  if(localBuckets.size>2000)for(const[bucketKey,bucket]of localBuckets)if(bucket.resetAt<=now)localBuckets.delete(bucketKey)
}
export async function enforceRateLimit(event:H3Event,scope:string,maximum=8,windowMs=60_000):Promise<void>{
  const ip=getRequestIP(event,{xForwardedFor:true})||'unknown'
  if(!hasNeonDatabase()){localLimit(event,scope,ip,maximum,windowMs);return}
  if(!Number.isInteger(maximum)||maximum<1||!Number.isFinite(windowMs)||windowMs<1000)throw createError({statusCode:500,statusMessage:'Paramétrage de rate limit invalide.'})
  // The IP is never stored: the stable database credential is a pepper and the table contains only a SHA-256 bucket key.
  const bucketKey=createHash('sha256').update(`${env.NEON_DATABASE_URL}\u0000${scope}\u0000${ip}`).digest('hex'),now=new Date()
  const db=getDatabase()
  await db.transaction(async(tx)=>{
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${bucketKey}),0)`)
    const[entry]=await tx.select().from(apiRateLimits).where(eq(apiRateLimits.bucketKey,bucketKey)).for('update').limit(1)
    if(!entry||entry.resetAt<=now){
      await tx.insert(apiRateLimits).values({bucketKey,count:1,resetAt:new Date(now.getTime()+windowMs),updatedAt:now}).onConflictDoUpdate({target:apiRateLimits.bucketKey,set:{count:1,resetAt:new Date(now.getTime()+windowMs),updatedAt:now}})
      return
    }
    if(entry.count>=maximum)reject(event,entry.resetAt.getTime())
    await tx.update(apiRateLimits).set({count:entry.count+1,updatedAt:now}).where(eq(apiRateLimits.bucketKey,bucketKey))
  })
}
