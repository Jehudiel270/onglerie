export type ThemeMode = 'brand' | 'light' | 'dark'
export type ButtonStyle = 'pill' | 'soft' | 'square'

export type SalonAppearance = {
  defaultTheme: ThemeMode
  buttonStyle: ButtonStyle
  floatingIconsEnabled: boolean
  floatingIconDensity: number
  floatingIconOpacity: number
  glassmorphismEnabled: boolean
  scrollAnimationsEnabled: boolean
  nailExperienceEnabled: boolean
  scrollDurationScreens: number
}

export const DEFAULT_SALON_APPEARANCE: SalonAppearance = {
  defaultTheme: 'brand',
  buttonStyle: 'pill',
  floatingIconsEnabled: true,
  floatingIconDensity: 7,
  floatingIconOpacity: 12,
  glassmorphismEnabled: true,
  scrollAnimationsEnabled: true,
  nailExperienceEnabled: true,
  scrollDurationScreens: 6,
}

export function normalizeSalonAppearance(raw: unknown): SalonAppearance {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_SALON_APPEARANCE }
  const value = raw as Record<string, unknown>
  const theme = value.defaultTheme
  const buttonStyle = value.buttonStyle
  return {
    defaultTheme: theme === 'light' || theme === 'dark' || theme === 'brand' ? theme : DEFAULT_SALON_APPEARANCE.defaultTheme,
    buttonStyle: buttonStyle === 'soft' || buttonStyle === 'square' || buttonStyle === 'pill' ? buttonStyle : DEFAULT_SALON_APPEARANCE.buttonStyle,
    floatingIconsEnabled: typeof value.floatingIconsEnabled === 'boolean' ? value.floatingIconsEnabled : DEFAULT_SALON_APPEARANCE.floatingIconsEnabled,
    floatingIconDensity: typeof value.floatingIconDensity === 'number' && Number.isFinite(value.floatingIconDensity)
      ? Math.max(0, Math.min(12, Math.trunc(value.floatingIconDensity)))
      : DEFAULT_SALON_APPEARANCE.floatingIconDensity,
    floatingIconOpacity: typeof value.floatingIconOpacity === 'number' && Number.isFinite(value.floatingIconOpacity)
      ? Math.max(4, Math.min(24, Math.trunc(value.floatingIconOpacity)))
      : DEFAULT_SALON_APPEARANCE.floatingIconOpacity,
    glassmorphismEnabled: typeof value.glassmorphismEnabled === 'boolean' ? value.glassmorphismEnabled : DEFAULT_SALON_APPEARANCE.glassmorphismEnabled,
    scrollAnimationsEnabled: typeof value.scrollAnimationsEnabled === 'boolean' ? value.scrollAnimationsEnabled : DEFAULT_SALON_APPEARANCE.scrollAnimationsEnabled,
    nailExperienceEnabled: typeof value.nailExperienceEnabled === 'boolean' ? value.nailExperienceEnabled : DEFAULT_SALON_APPEARANCE.nailExperienceEnabled,
    scrollDurationScreens: typeof value.scrollDurationScreens === 'number' && Number.isFinite(value.scrollDurationScreens)
      ? Math.max(4, Math.min(9, Math.trunc(value.scrollDurationScreens)))
      : DEFAULT_SALON_APPEARANCE.scrollDurationScreens,
  }
}
