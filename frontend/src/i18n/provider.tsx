'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Locale, DEFAULT_LOCALE, getTranslation } from '@/i18n'

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextType>({
  locale: DEFAULT_LOCALE,
  setLocale: () => { },
  t: (key) => key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  // Load saved locale from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('locale') as Locale | null
    if (saved && ['en', 'vi', 'zh', 'ja', 'ko', 'th'].includes(saved)) {
      setLocaleState(saved)
    }
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('locale', newLocale)
  }

  const t = (key: string) => getTranslation(locale, key)

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  return useContext(I18nContext)
}
