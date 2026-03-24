import en from './locales/en.json'
import vi from './locales/vi.json'
import zh from './locales/zh.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import th from './locales/th.json'

export const locales = { en, vi, zh, ja, ko, th } as const

export type Locale = keyof typeof locales

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  th: 'ไทย',
}

export const LOCALE_FLAGS: Record<Locale, string> = {
  en: '🇬🇧',
  vi: '🇻🇳',
  zh: '🇨🇳',
  ja: '🇯🇵',
  ko: '🇰🇷',
  th: '🇹🇭',
}

export const DEFAULT_LOCALE: Locale = 'en'

type NestedKeyOf<T> = T extends object
  ? { [K in keyof T & string]: T[K] extends object ? `${K}.${NestedKeyOf<T[K]>}` : K }[keyof T & string]
  : never

export type TranslationKey = NestedKeyOf<typeof en>

export function getTranslation(locale: Locale, key: string): string {
  const keys = key.split('.')
  let value: any = locales[locale]
  for (const k of keys) {
    value = value?.[k]
  }
  if (typeof value === 'string') return value
  // Fallback to English
  value = locales.en
  for (const k of keys) {
    value = value?.[k]
  }
  return typeof value === 'string' ? value : key
}
