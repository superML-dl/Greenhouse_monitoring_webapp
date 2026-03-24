'use client'

import { useState, useRef, useEffect } from 'react'
import { UserCircle, LogOut, Settings } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from '@/i18n/provider'

interface ProfilePopoverProps {
  profile: {
    fullName: string
    role: string
    email: string
    avatarUrl: string | null
  }
}

export function ProfilePopover({ profile }: ProfilePopoverProps) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

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
        className="flex items-center gap-3 w-full p-1 rounded-lg hover:bg-slate-800 transition-colors"
      >
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt={t('profile.avatar')} className="w-10 h-10 rounded-full ring-2 ring-slate-700" />
        ) : (
          <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center ring-2 ring-slate-700">
            <UserCircle className="h-6 w-6 text-slate-400" />
          </div>
        )}
        <div className="flex flex-col overflow-hidden text-left">
          <span className="text-sm font-medium text-slate-200 truncate">{profile.fullName}</span>
          <span className="text-xs text-slate-500 truncate capitalize">{profile.role}</span>
        </div>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-sm font-medium text-white truncate">{profile.fullName}</p>
            <p className="text-xs text-slate-400 truncate">{profile.email}</p>
            <span className="inline-block mt-1.5 px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 capitalize">
              {profile.role}
            </span>
          </div>
          <div className="p-2">
            <Link
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
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
