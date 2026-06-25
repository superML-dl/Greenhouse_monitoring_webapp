'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from '@/i18n/provider'
import {
  applyThemePreference,
  getStoredThemePreference,
  setStoredThemePreference,
  ThemePreference,
} from '@/lib/theme'

interface ThemeOption {
  value: ThemePreference
  label: string
  icon: ReactNode
}

export function ThemeSwitcher() {
  const { t } = useTranslation()
  const [theme, setTheme] = useState<ThemePreference>('system')

  useEffect(() => {
    const saved = getStoredThemePreference()
    setTheme(saved)
    applyThemePreference(saved)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        applyThemePreference('system')
      }
    }

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange)
      return () => media.removeEventListener('change', handleChange)
    }

    media.addListener(handleChange)
    return () => media.removeListener(handleChange)
  }, [theme])

  const options = useMemo<ThemeOption[]>(() => {
    return [
      {
        value: 'system',
        label: t('settings.theme_system'),
        icon: <Monitor className="h-4 w-4" />,
      },
      {
        value: 'light',
        label: t('settings.theme_light'),
        icon: <Sun className="h-4 w-4" />,
      },
      {
        value: 'dark',
        label: t('settings.theme_dark'),
        icon: <Moon className="h-4 w-4" />,
      },
    ]
  }, [t])

  const handleSelect = (nextTheme: ThemePreference) => {
    setTheme(nextTheme)
    setStoredThemePreference(nextTheme)
    applyThemePreference(nextTheme)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {options.map((option) => {
        const active = option.value === theme
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleSelect(option.value)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
              active
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                : 'border-[var(--app-border)] bg-[var(--app-surface-2)] text-[var(--app-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover)]'
            }`}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
