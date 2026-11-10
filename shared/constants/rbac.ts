// Matrice des rôles salon — source unique partagée par le serveur (garde API)
// et le client (navigation admin). Rôles salon : owner (propriétaire = la
// cliente du salon), reception (réception), staff (employé·e) et dev
// (développeur·se de la plateforme). La cliente connectée n'est pas un rôle
// salon : elle dispose de son espace /mon-compte côté « customer ».
//
// Le rôle dev n'est PAS une adhésion salon : il est attribué au niveau du
// compte utilisateur (user.role = 'dev', voir scripts/bootstrap-dev.ts). Le
// garde serveur (server/utils/admin-guard.ts) détecte ce rôle et contourne les
// adhésions : le développeur·se voit tous les salons avec toutes les
// permissions, sans jamais apparaître dans l'équipe du salon.

export const SALON_ROLES = ['owner', 'reception', 'staff', 'dev'] as const
export type SalonRole = (typeof SALON_ROLES)[number]

export const ROLE_LABELS: Record<SalonRole, string> = {
  owner: 'Propriétaire',
  reception: 'Réception',
  staff: 'Employé·e',
  dev: 'Développeur',
}

// Ressources du CRUD générique (/api/admin/manage).
export type ManageResource =
  | 'services' | 'categories' | 'portfolio' | 'staff'
  | 'schedules' | 'exceptions' | 'customers' | 'payments'
  | 'notifications' | 'content' | 'settings' | 'salon' | 'contacts'

// Lecture : le propriétaire et le développement lisent tout ; la réception
// consulte le catalogue, la clientèle, les paiements/messages/notifications
// et les plannings.
export const RECEPTION_READABLE: readonly ManageResource[] = [
  'services', 'categories', 'customers', 'payments',
  'notifications', 'contacts', 'schedules', 'exceptions',
]

// Écriture : la réception encaisse les paiements manuels uniquement.
// Toute modification de catalogue, de planning ou de paramètres reste au propriétaire.
export const RECEPTION_WRITABLE: readonly ManageResource[] = ['payments']

const includes = (list: readonly string[], value: string) => list.includes(value)

export function canReadResource(role: SalonRole, resource: ManageResource): boolean {
  if (role === 'owner' || role === 'dev') return true
  if (role === 'reception') return includes(RECEPTION_READABLE, resource)
  return false
}

export function canWriteResource(role: SalonRole, resource: ManageResource): boolean {
  if (role === 'owner' || role === 'dev') return true
  if (role === 'reception') return includes(RECEPTION_WRITABLE, resource)
  return false
}

// Transitions de statut autorisées à une employée sur SES rendez-vous :
// marquer une cliente venue (terminé) ou absente, jamais annuler ni reprogrammer.
export const STAFF_ALLOWED_TRANSITIONS: readonly string[] = ['completed', 'no_show']

// Chiffre d'affaires et agrégats financiers : propriétaire et développement.
export function canSeeRevenue(role: SalonRole): boolean {
  return role === 'owner' || role === 'dev'
}
