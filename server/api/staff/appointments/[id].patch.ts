import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody, setHeader } from 'h3'
import { z } from 'zod'
import { STAFF_ALLOWED_TRANSITIONS } from '~~/shared/constants/rbac'
import { isAllowedAppointmentTransition } from '~~/shared/constants/appointment-transitions'
import { requireStaffContext } from '../../../utils/staff-guard'
import { appointmentStatusHistory, appointments, auditLogs } from '../../../db/schema'

// Une employée ne peut que marquer sa cliente « venue » (completed) ou
// « absente » (no_show) sur SES rendez-vous confirmés. Annulation, report et
// création restent réservés à la réception et au propriétaire.
const bodySchema = z.object({ status: z.enum(['completed', 'no_show']), note: z.string().trim().max(500).optional().or(z.literal('')) }).strict()

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  const { db, user, salonId, staffProfile } = await requireStaffContext(event)
  if (!staffProfile) throw createError({ statusCode: 403, statusMessage: 'Aucune fiche employée n’est rattachée à ce compte.' })
  const id = getRouterParam(event, 'id') || ''
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Statut invalide.', data: parsed.error.flatten() })
  const { status, note } = parsed.data
  if (!STAFF_ALLOWED_TRANSITIONS.includes(status)) throw createError({ statusCode: 403, statusMessage: 'Transition non autorisée pour ce rôle.' })

  const [appointment] = await db.select().from(appointments).where(and(eq(appointments.id, id), eq(appointments.salonId, salonId))).limit(1)
  if (!appointment || appointment.staffId !== staffProfile.id) throw createError({ statusCode: 404, statusMessage: 'Rendez-vous introuvable dans votre agenda.' })
  if (!isAllowedAppointmentTransition(appointment.status, status)) throw createError({ statusCode: 409, statusMessage: `Passage de « ${appointment.status} » à « ${status} » non autorisé.` })

  const [updated] = await db.update(appointments).set({ status, updatedAt: new Date() }).where(and(eq(appointments.id, id), eq(appointments.salonId, salonId))).returning({ id: appointments.id, status: appointments.status })
  await db.insert(appointmentStatusHistory).values({ salonId, appointmentId: id, fromStatus: appointment.status, toStatus: status, actorUserId: user.id, reason: note || `Mise à jour par l’équipe (${status}).` })
  await db.insert(auditLogs).values({ salonId, userId: user.id, action: 'staff_appointment_status', entity: 'appointment', entityId: id })
  return { item: updated }
})
