import { defineEventHandler, setHeader } from 'h3'
import { requireStaffContext } from '../../utils/staff-guard'

// Session de l'espace équipe : identité, rôle salon et fiche employée liée.
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  const { user, salonId, role, staffProfile } = await requireStaffContext(event)
  return {
    user: { id: user.id, name: user.name, email: user.email },
    role,
    salonId,
    staffProfile: staffProfile ? { id: staffProfile.id, firstName: staffProfile.firstName, lastName: staffProfile.lastName } : null,
  }
})
