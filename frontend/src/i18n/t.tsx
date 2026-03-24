'use client'

import { useTranslation } from '@/i18n/provider'

interface TranslatedTextProps {
  tKey: string
  className?: string
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'label'
}

export function T({ tKey, className, as: Component = 'span' }: TranslatedTextProps) {
  const { t } = useTranslation()
  return <Component className={className}>{t(tKey)}</Component>
}

export function useT() {
  const { t } = useTranslation()
  return t
}
