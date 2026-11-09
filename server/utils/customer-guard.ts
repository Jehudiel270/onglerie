import { and, eq } from 'drizzle-orm'
import { createError, type H3Event } from 'h3'
import { getDatabase } from '../db/client'
import { customers } from '../db/schema'
import { requirePrimarySalon } from '../services/salon'

export async function requireCustomer(event:H3Event){
  const auth=serverAuth(event)
  const session=await auth.api.getSession({headers:event.headers})
  if(!session?.user)throw createError({statusCode:401,statusMessage:'Connexion requise.'})
  const salon=await requirePrimarySalon()
  const [customer]=await getDatabase().select().from(customers).where(and(eq(customers.userId,session.user.id),eq(customers.salonId,salon.id))).limit(1)
  if(!customer)throw createError({statusCode:404,statusMessage:'Aucun profil cliente n’est associé à ce compte. Reliez une réservation invitée avec son lien sécurisé.'})
  return{user:session.user,customer,salonId:salon.id}
}
