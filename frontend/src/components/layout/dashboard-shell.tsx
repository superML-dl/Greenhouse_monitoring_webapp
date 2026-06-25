'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Sprout, Image as ImageIcon, BookOpen } from 'lucide-react'
import { ProfilePopover } from '@/components/layout/profile-popover'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { useTranslation } from '@/i18n/provider'

interface DashboardShellProps {
  children: React.ReactNode
  profile: {
    fullName: string
    email: string
    avatarUrl: string | null
  }
}

export function DashboardShell({ children, profile }: DashboardShellProps) {
  const { t } = useTranslation()
  const pathname = usePathname()

  const navItems = [
    { nameKey: 'nav.overview', href: '/dashboard', icon: LayoutDashboard },
    { nameKey: 'nav.greenhouses', href: '/dashboard/greenhouses', icon: Sprout },
    { nameKey: 'nav.inference', href: '/dashboard/inference', icon: ImageIcon },
    { nameKey: 'nav.handbook', href: '/dashboard/handbook', icon: BookOpen },
  ]

  const headerTitleItems = [
    ...navItems,
    { nameKey: 'settings.title', href: '/dashboard/settings' },
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const currentTabTitle = (() => {
    const matchedItem = headerTitleItems
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) => isActive(item.href))

    if (matchedItem) {
      return t(matchedItem.nameKey)
    }

    const fallbackSegment = pathname.split('/').filter(Boolean).pop()
    if (!fallbackSegment) {
      return t('nav.overview')
    }

    return fallbackSegment
      .split('-')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ')
  })()

  return (
    <div className="flex min-h-screen app-shell-bg">
      {/* Sidebar */}
      <aside className="w-64 border-r app-border app-panel flex flex-col fixed inset-y-0 left-0 z-30">
        <div className="h-16 flex items-center px-6 border-b app-border">
          <Link href="/dashboard" className="w-full min-w-0 text-emerald-400 font-semibold text-lg hover:text-emerald-300 transition-colors">
            <div className="flex w-full min-w-0 items-center gap-3">
              <div className="flex shrink-0 items-center gap-1.5">
                <img
                  src="/assets/logotruong.png"
                  alt="University logo"
                  className="h-7 w-7 object-contain rounded-md bg-slate-100 p-0.5"
                />
                <img
                  src="/assets/logokhoa.png"
                  alt="Faculty logo"
                  className="h-7 w-7 object-contain rounded-md bg-slate-100 p-0.5"
                />
              </div>
              <span className="min-w-0 truncate leading-tight">{t('app_name')}</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 py-6 px-4 flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md border transition-all ${
                isActive(item.href)
                  ? 'text-[var(--app-nav-active-text)] bg-[var(--app-nav-active)] border-[var(--app-border)] shadow-sm'
                  : 'text-[var(--app-muted)] border-transparent hover:text-[var(--app-text)] hover:bg-[var(--app-hover)] hover:border-[var(--app-border)]'
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive(item.href) ? 'opacity-100 text-emerald-400' : 'opacity-70'}`} />
              {t(item.nameKey)}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t app-border">
          <ProfilePopover profile={profile} />
          <p className="mt-3 text-[11px] app-muted text-center">
            Made with love by Van Quyet Nguyen
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden ml-64">
        <header className="h-16 shrink-0 border-b app-border app-panel flex items-center gap-3 px-4 sm:px-8 sticky top-0 z-20">
          <div className="min-w-0 flex flex-1 items-center max-w-3xl">
            <h2 className="min-w-0 truncate text-sm font-medium app-muted">{currentTabTitle}</h2>
          </div>
          <div className="shrink-0 ml-auto">
            <LanguageSwitcher />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          <div key={pathname} className="route-content-enter">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
