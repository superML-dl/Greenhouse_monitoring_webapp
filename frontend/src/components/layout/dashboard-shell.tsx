'use client'

import Link from 'next/link'
import { Leaf, LayoutDashboard, Sprout, Image as ImageIcon, BookOpen } from 'lucide-react'
import { ProfilePopover } from '@/components/layout/profile-popover'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { useTranslation } from '@/i18n/provider'

interface DashboardShellProps {
  children: React.ReactNode
  profile: {
    fullName: string
    role: string
    email: string
    avatarUrl: string | null
  }
}

export function DashboardShell({ children, profile }: DashboardShellProps) {
  const { t } = useTranslation()

  const navItems = [
    { nameKey: 'nav.overview', href: '/dashboard', icon: LayoutDashboard },
    { nameKey: 'nav.greenhouses', href: '/dashboard/greenhouses', icon: Sprout },
    { nameKey: 'nav.inference', href: '/dashboard/inference', icon: ImageIcon },
    { nameKey: 'nav.handbook', href: '/dashboard/handbook', icon: BookOpen },
  ]

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col fixed inset-y-0 left-0 z-30">
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <Link href="/dashboard" className="flex items-center gap-2 text-emerald-400 font-semibold text-lg hover:text-emerald-300 transition-colors">
            <Leaf className="h-6 w-6" />
            <span className="leading-tight">{t('app_name')}</span>
          </Link>
        </div>

        <nav className="flex-1 py-6 px-4 flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <item.icon className="h-5 w-5 opacity-70" />
              {t(item.nameKey)}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <ProfilePopover profile={profile} />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden ml-64">
        <header className="h-16 border-b border-slate-800 bg-slate-900/20 flex items-center justify-between px-8 sticky top-0 z-20">
          <h2 className="text-sm font-medium text-slate-400">{t('app_name')}</h2>
          <LanguageSwitcher />
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
