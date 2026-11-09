import { createError, defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import { getAvailableSlots } from '../../services/availability'
import { hasNeonDatabase } from '../../db/client'

const querySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), services: z.string().min(1), staffId: z.string().uuid().optional() }).strict()

export default defineEventHandler(async (event) => {
  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Date ou sélection de prestations invalide.' })
  if (!hasNeonDatabase()) return { configured: false, demo: true, slots: [] }
  const serviceIds = [...new Set(parsed.data.services.split(',').filter(Boolean))]
  if (!serviceIds.every((id) => z.string().uuid().safeParse(id).success)) throw createError({ statusCode: 400, statusMessage: 'Identifiant de prestation invalide.' })
  const slots = await getAvailableSlots({ date: parsed.data.date, serviceIds, staffId: parsed.data.staffId ?? null })
  return { configured: true, demo: false, slots }
})
