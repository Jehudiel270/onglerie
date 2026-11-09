import { env } from 'node:process'
import { defineEventHandler, setHeader } from 'h3'
import { requireSalonRole } from '../../utils/admin-guard'

// État de configuration des intégrations, côté serveur uniquement.
// Contrat de sécurité : cette réponse n'expose JAMAIS de valeur de clé, seulement
// les noms de variables et un booléen « configuré ». Les valeurs s'ajoutent
// exclusivement dans le gestionnaire de secrets du projet (variables d'environnement).
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  await requireSalonRole(event, ['owner', 'manager'])

  const read = (name: string): boolean => {
    const value = env[name]
    return typeof value === 'string' && value.trim().length > 0
  }

  const groups = [
    {
      key: 'database',
      label: 'Base de données Neon PostgreSQL',
      description: 'Runtime poolé + connexion directe pour Drizzle Kit et les migrations.',
      vars: ['NEON_DATABASE_URL', 'NEON_DATABASE_URL_UNPOOLED'],
      optional: [] as string[],
      required: true,
    },
    {
      key: 'auth',
      label: 'Authentification Better Auth',
      description: 'Secret de sessions et empreintes HMAC des codes OTP (≥ 32 octets).',
      vars: ['BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'],
      optional: [],
      required: true,
    },
    {
      key: 'payments',
      label: 'Paiements FedaPay',
      description: 'Transactions XOF côté serveur ; commencer en sandbox.',
      vars: ['FEDAPAY_SECRET_KEY', 'FEDAPAY_WEBHOOK_SECRET'],
      optional: ['FEDAPAY_ENV'],
      required: false,
    },
    {
      key: 'media',
      label: 'Médias Cloudinary',
      description: 'Uploads signés serveur pour couverture, services, réalisations et équipe.',
      vars: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'],
      optional: [],
      required: false,
    },
    {
      key: 'scheduled',
      label: 'Tâches planifiées',
      description: 'Expiration des retenues et rappels protégés par CRON_SECRET.',
      vars: ['CRON_SECRET'],
      optional: ['BOOKING_HOLD_MINUTES'],
      required: false,
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp Business Cloud',
      description: 'Modèles approuvés Meta requis ; repli wa.me sans fournisseur.',
      vars: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_BUSINESS_ACCOUNT_ID'],
      optional: ['WHATSAPP_API_VERSION'],
      required: false,
    },
    {
      key: 'email',
      label: 'E-mail transactionnel',
      description: 'Adaptateur HTTP générique (URL, clé, expéditeur).',
      vars: ['EMAIL_API_URL', 'EMAIL_API_KEY', 'EMAIL_FROM'],
      optional: [],
      required: false,
    },
  ]

  const integrations = groups.map((group) => {
    const names = [...group.vars, ...group.optional]
    return {
      key: group.key,
      label: group.label,
      description: group.description,
      required: group.required,
      variables: names.map((name) => ({ name, configured: read(name) })),
      configured: group.vars.every(read),
      missing: names.filter((name) => !read(name)),
    }
  })

  return {
    integrations,
    guidance: 'Les valeurs s’ajoutent uniquement dans le gestionnaire de secrets du projet (entrée « Secrets / Environment variables » du dashboard), jamais dans cette administration. Les valeurs ne sont jamais affichées ni collectées ici.',
  }
})
