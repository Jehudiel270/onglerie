import { computed, onMounted, watch } from 'vue'
import { normalizeSalonAppearance, type SalonAppearance, type ThemeMode } from '~~/shared/constants/appearance'

const THEME_STORAGE_KEY = 'onglerie:theme:v1'

export function useSiteAppearance() {
  const appearance = useState<SalonAppearance>('salon-appearance', () => normalizeSalonAppearance(undefined))
  const themeChoice = useState<ThemeMode | null>('salon-theme-choice', () => null)
  const preferenceLoaded = useState<boolean>('salon-theme-preference-loaded', () => false)
  const selectedTheme = computed<ThemeMode>(() => themeChoice.value ?? appearance.value.defaultTheme)

  if (import.meta.client) {
    onMounted(() => {
      if (!preferenceLoaded.value) {
        try {
          const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
          if (saved === 'brand' || saved === 'light' || saved === 'dark') themeChoice.value = saved
        } catch {
          // Le stockage local peut être bloqué ; le thème par défaut du salon reste disponible.
        }
        preferenceLoaded.value = true
      }
      document.documentElement.classList.add('theme-ready')
    })
    watch(themeChoice, (value) => {
      if (!preferenceLoaded.value) return
      try {
        if (value) window.localStorage.setItem(THEME_STORAGE_KEY, value)
        else window.localStorage.removeItem(THEME_STORAGE_KEY)
      } catch { /* préférence locale facultative */ }
    })
    watch([selectedTheme, () => appearance.value.glassmorphismEnabled], ([theme, glass]) => {
      document.documentElement.dataset.theme = theme
      document.documentElement.dataset.glass = glass ? 'true' : 'false'
    }, { immediate: true })
  }

  useHead(() => ({
    htmlAttrs: { 'data-theme': selectedTheme.value, 'data-glass': appearance.value.glassmorphismEnabled ? 'true' : 'false' },
    meta: [{ name: 'theme-color', content: selectedTheme.value === 'dark' ? '#171214' : selectedTheme.value === 'light' ? '#fcfbf9' : '#f5f0e9' }],
  }))

  function selectTheme(theme: ThemeMode) { themeChoice.value = theme }
  return { appearance, themeChoice, selectedTheme, selectTheme }
}
