'use client'

import { useState, useRef, useEffect } from 'react'
import { UserCircle, LogOut, Settings, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from '@/i18n/provider'

interface ProfilePopoverProps {
  profile: {
    fullName: string
    email: string
    avatarUrl: string | null
  }
}

export function ProfilePopover({ profile }: ProfilePopoverProps) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  const initials = profile.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-3 w-full px-2 py-1.5 rounded-xl border border-transparent hover:border-[var(--app-border)] hover:bg-[var(--app-hover)] transition-colors"
      >
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt={t('profile.avatar')} className="w-10 h-10 rounded-full ring-2 ring-[var(--app-border)]" />
        ) : (
          <div className="w-10 h-10 app-panel-2 border rounded-full flex items-center justify-center ring-2 ring-[var(--app-border)] app-text text-xs font-semibold">
            {initials || <UserCircle className="h-6 w-6 app-muted" />}
          </div>
        )}
        <div className="flex flex-col overflow-hidden text-left min-w-0 flex-1">
          <span className="text-sm font-medium app-text truncate">{profile.fullName}</span>
          <span className="text-xs app-muted truncate">{profile.email}</span>
        </div>
        <ChevronDown className={`h-4 w-4 app-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-72 app-panel border app-border rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="px-4 py-3 border-b app-border app-panel">
            <p className="text-sm font-semibold app-text truncate">{profile.fullName}</p>
            <p className="text-xs app-muted truncate mt-0.5">{profile.email}</p>
          </div>
          <div className="p-2">
            <Link
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm app-muted hover:text-[var(--app-text)] hover:bg-[var(--app-hover)] rounded-md transition-colors"
            >
              <Settings className="h-4 w-4 opacity-70" />
              {t('profile.settings')}
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-400/10 rounded-md transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {t('profile.sign_out')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
