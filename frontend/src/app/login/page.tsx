'use client'

import { Leaf } from 'lucide-react'
import { OAuthButtons } from './components/oauth-buttons'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { useTranslation } from '@/i18n/provider'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      {/* Language switcher in top-right */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center mb-2">
            <Leaf size={28} />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            {t('login.title')}
          </h1>
          <p className="text-slate-400 text-sm">
            {t('login.subtitle')}
          </p>
        </div>

        {searchParams?.error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-md text-center">
            {searchParams.error}
          </div>
        )}

        <div className="pt-2">
          <OAuthButtons />
        </div>

        <p className="text-xs text-center text-slate-500 mt-4">
          {t('login.terms')} <br />
          {t('login.restricted')}
        </p>
      </div>
    </div>
  )
}
