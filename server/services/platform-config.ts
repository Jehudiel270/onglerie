import { eq } from 'drizzle-orm'
import { env } from 'node:process'
import { getDatabase, hasNeonDatabase } from '../db/client'
import { platformConfig } from '../db/schema'

// Configuration plateforme des intégrations. Source de vérité double :
// 1) variable d'environnement (Vercel) — prioritaire, non modifiable ici ;
// 2) table platform_config — éditable depuis le panneau développement
//    (/admin/integrations section dev) et appliquée sans redéploiement.
// Aucune valeur n'est jamais renvoyée en clair : l'API admin ne montre que
// « configuré » et les 4 derniers caractères.

export const PLATFORM_CONFIG_KEYS = [
  'BREVO_API_KEY',
  'EMAIL_FROM',
  'EMAIL_FROM_NAME',
  'EMAIL_API_URL',
  'EMAIL_API_KEY',
  'FEDAPAY_ENV',
  'FEDAPAY_SECRET_KEY',
  'FEDAPAY_WEBHOOK_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_API_VERSION',
  'CRON_SECRET',
] as const

export type PlatformConfigKey = (typeof PLATFORM_CONFIG_KEYS)[number]

const KNOWN_KEYS: ReadonlySet<string> = new Set(PLATFORM_CONFIG_KEYS)

export type PlatformSetting = { key: string; value: string; source: 'env' | 'database' | 'none' }

export function isKnownConfigKey(key: string): key is PlatformConfigKey {
  return KNOWN_KEYS.has(key)
}

export async function getPlatformSetting(key: PlatformConfigKey | string): Promise<PlatformSetting> {
  if (!isKnownConfigKey(key)) throw new Error(`Clé de configuration plateforme inconnue : ${key}`)
  const envValue = env[key]
  if (typeof envValue === 'string' && envValue.trim()) return { key, value: envValue, source: 'env' }
  if (!hasNeonDatabase()) return { key, value: '', source: 'none' }
  const db = getDatabase()
  const [row] = await db.select().from(platformConfig).where(eq(platformConfig.key, key)).limit(1)
  if (row?.value) return { key, value: row.value, source: 'database' }
  return { key, value: '', source: 'none' }
}

export async function setPlatformSetting(key: PlatformConfigKey, value: string | null): Promise<void> {
  if (!isKnownConfigKey(key)) throw new Error(`Clé de configuration plateforme inconnue : ${key}`)
  if (!hasNeonDatabase()) throw new Error('La base Neon doit être configurée pour enregistrer une clé.')
  const db = getDatabase()
  const now = new Date()
  if (value === null || !value.trim()) {
    await db.delete(platformConfig).where(eq(platformConfig.key, key))
    return
  }
  await db.insert(platformConfig).values({ key, value: value.trim(), updatedAt: now })
    .onConflictDoUpdate({ target: platformConfig.key, set: { value: value.trim(), updatedAt: now } })
}

// Masquage uniforme : ne révèle jamais plus que les 4 derniers caractères.
export function maskSecret(value: string): string {
  if (!value) return ''
  if (value.length <= 4) return '••••'
  return `••••••••${value.slice(-4)}`
}

// Garde des endpoints cron : le secret peut venir de l'environnement ou du
// panneau dev. La vérification reste bloquante dans tous les cas.
export async function verifyCronToken(providedToken: string): Promise<void> {
  const { value } = await getPlatformSetting('CRON_SECRET')
  if (!value || !providedToken || providedToken !== value) {
    const { createError } = await import('h3')
    throw createError({ statusCode: 401, statusMessage: 'Tâche planifiée non autorisée.' })
  }
}
