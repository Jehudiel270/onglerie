import { env } from 'node:process'
import { defineEventHandler, setHeader } from 'h3'
import { requireSalonRole } from '../../utils/admin-guard'
import { getPlatformSetting, isKnownConfigKey } from '../../services/platform-config'

// État de configuration des intégrations, côté serveur uniquement.
// Contrat de sécurité : cette réponse n'expose JAMAIS de valeur de clé, seulement
// les noms de variables et un booléen « configuré ». Les valeurs viennent de
// l'environnement (Vercel, prioritaire) ou de la table platform_config (panneau
// développement, repli sans redéploiement).
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  await requireSalonRole(event, ['owner'])

  const read = async (name: string): Promise<boolean> => {
    if (isKnownConfigKey(name)) return Boolean((await getPlatformSetting(name)).value)
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
      label: 'Tâches planifiées (cron-job.org)',
      description: 'Expiration des retenues et rappels appelés par cron-job.org avec CRON_SECRET.',
      vars: ['CRON_SECRET'],
      optional: [],
      required: false,
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp Business Cloud (optionnel)',
      description: 'Sans compte Meta, les rappels manuels wa.me restent disponibles côté administration.',
      vars: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'],
      optional: ['WHATSAPP_API_VERSION'],
      required: false,
    },
    {
      key: 'email',
      label: 'E-mail transactionnel Brevo',
      description: 'Clé API Brevo + expéditeur validé chez Brevo ; repli générique EMAIL_API_*.',
      vars: ['BREVO_API_KEY', 'EMAIL_FROM'],
      optional: ['EMAIL_FROM_NAME', 'EMAIL_API_URL', 'EMAIL_API_KEY'],
      required: false,
    },
  ]

  const integrations = await Promise.all(groups.map(async (group) => {
    const names = [...group.vars, ...group.optional]
    const states = await Promise.all(names.map(async (name) => ({ name, configured: await read(name) })))
    const configuredByName = new Map(states.map((state) => [state.name, state.configured]))
    return {
      key: group.key,
      label: group.label,
      description: group.description,
      required: group.required,
      variables: states,
      configured: group.vars.every((name) => configuredByName.get(name) === true),
      missing: names.filter((name) => !configuredByName.get(name)),
    }
  }))

  return {
    integrations,
    guidance: 'Les valeurs s’ajoutent dans le gestionnaire de secrets Vercel (variables d’environnement, prioritaires) ou, pour le rôle développement, dans la section dédiée plus bas (repli immédiat sans redéploiement). Les valeurs ne sont jamais affichées ni collectées ici.',
  }
})
