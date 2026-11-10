import { createError, defineEventHandler, readBody, setHeader } from 'h3'
import { z } from 'zod'
import { requireDevUser } from '../../utils/dev-guard'
import { getPlatformSetting, isKnownConfigKey, maskSecret, setPlatformSetting } from '../../services/platform-config'
import { getDatabase } from '../../db/client'
import { auditLogs } from '../../db/schema'

// Enregistrement / suppression d'une clé d'intégration depuis le panneau dev.
// body { key, value } — value null, '' ou 'DELETE' supprime la valeur enregistrée.
const bodySchema = z.object({
  key: z.string().trim().min(1).max(80),
  value: z.string().max(2000).nullable().optional(),
}).strict()

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  const { user } = await requireDevUser(event)
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Requête de configuration invalide.', data: parsed.error.flatten() })
  const { key, value } = parsed.data
  if (!isKnownConfigKey(key)) throw createError({ statusCode: 422, statusMessage: 'Clé de configuration inconnue ; utilisez uniquement les clés listées.' })
  if (value !== undefined && value !== null && value.trim() === '') {
    await setPlatformSetting(key, null)
    await getDatabase().insert(auditLogs).values({ salonId: null, userId: user.id, action: 'platform_config_delete', entity: 'platform_config', entityId: key })
    const setting = await getPlatformSetting(key)
    return { ok: true, key, source: setting.source, configured: Boolean(setting.value), masked: maskSecret(setting.value), guidance: 'Valeur enregistrée supprimée.' }
  }
  if (value === undefined || value === null) throw createError({ statusCode: 422, statusMessage: 'Valeur manquante ; envoyez une valeur ou null pour supprimer.' })
  await setPlatformSetting(key, value)
  await getDatabase().insert(auditLogs).values({ salonId: null, userId: user.id, action: 'platform_config_set', entity: 'platform_config', entityId: key })
  const setting = await getPlatformSetting(key)
  return { ok: true, key, source: setting.source, configured: Boolean(setting.value), masked: maskSecret(setting.value), guidance: setting.source === 'env' ? 'Variable d’environnement identique détectée : elle reste prioritaire jusqu’à son retrait de Vercel.' : 'Valeur enregistrée ; active immédiatement, sans redéploiement.' }
})
