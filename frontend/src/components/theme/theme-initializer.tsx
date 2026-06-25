'use client'

import { useEffect } from 'react'
import { applyThemePreference, getStoredThemePreference } from '@/lib/theme'

export function ThemeInitializer() {
  useEffect(() => {
    applyThemePreference(getStoredThemePreference())
  }, [])

  return null
}
