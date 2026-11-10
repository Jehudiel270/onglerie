import { defineEventHandler, setHeader } from 'h3'
import { requireDevUser } from '../../utils/dev-guard'
import { getPlatformSetting, maskSecret, PLATFORM_CONFIG_KEYS, type PlatformConfigKey } from '../../services/platform-config'

// État des clés d'intégration pour le panneau développement. Aucune valeur
// complète n'est renvoyée : uniquement « source » (env / database / none) et
// les 4 derniers caractères, pour reconnaître une clé sans la révéler.
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store, max-age=0')
  await requireDevUser(event)

  const items = await Promise.all(PLATFORM_CONFIG_KEYS.map(async (key: PlatformConfigKey) => {
    const setting = await getPlatformSetting(key)
    return { key, source: setting.source, configured: Boolean(setting.value), masked: maskSecret(setting.value) }
  }))

  return {
    items,
    guidance: 'Priorité : variable d’environnement (Vercel) puis valeur enregistrée ici. Enregistrer ou vider une valeur prend effet immédiatement, sans redéploiement. Les valeurs complètes ne sont jamais réaffichées.',
  }
})
