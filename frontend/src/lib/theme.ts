export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'theme-preference'

const isBrowser = typeof window !== 'undefined'

function getSystemTheme(): ResolvedTheme {
  if (!isBrowser) return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return getSystemTheme()
  }
  return preference
}

export function getStoredThemePreference(): ThemePreference {
  if (!isBrowser) return 'system'
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (saved === 'light' || saved === 'dark' || saved === 'system') {
    return saved
  }
  return 'system'
}

export function setStoredThemePreference(preference: ThemePreference) {
  if (!isBrowser) return
  window.localStorage.setItem(THEME_STORAGE_KEY, preference)
}

export function applyThemePreference(preference: ThemePreference) {
  if (!isBrowser) return
  const resolved = resolveTheme(preference)
  document.documentElement.setAttribute('data-theme', resolved)
  document.documentElement.setAttribute('data-theme-preference', preference)
}
