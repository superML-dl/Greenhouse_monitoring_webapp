import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { updateProfile } from './actions'
import { T } from '@/i18n/t'
import { UserCircle } from 'lucide-react'
import { ThemeSwitcher } from './components/theme-switcher'

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch existing profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <T tKey="settings.title" as="h1" className="text-2xl font-bold tracking-tight app-text mb-2" />
        <T tKey="settings.subtitle" as="p" className="app-muted" />
      </div>

      <div className="app-panel border rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b app-border">
          <T tKey="settings.theme" as="h2" className="text-lg font-medium app-text mb-2" />
          <T tKey="settings.theme_hint" as="p" className="text-sm app-muted mb-4" />
          <ThemeSwitcher />
        </div>

        <div className="p-6 border-b app-border">
          <T tKey="settings.profile_info" as="h2" className="text-lg font-medium app-text mb-4" />
          <form action={updateProfile} className="space-y-6" encType="multipart/form-data">

            <div className="space-y-2">
              <T tKey="settings.avatar" as="p" className="text-sm font-medium app-muted" />
              <div className="flex items-center gap-4">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="h-16 w-16 rounded-full object-cover ring-2 ring-[var(--app-border)]"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full app-panel-2 border ring-2 ring-[var(--app-border)] flex items-center justify-center">
                    <UserCircle className="h-9 w-9 app-muted" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    id="avatar"
                    name="avatar"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="w-full text-sm app-muted file:mr-4 file:rounded-md file:border-0 file:bg-[var(--app-surface-2)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--app-text)] hover:file:bg-[var(--app-hover)]"
                  />
                  <T tKey="settings.avatar_hint" as="p" className="text-xs app-muted mt-2" />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <T tKey="settings.email" as="p" className="text-sm font-medium app-muted" />
              <input
                id="email"
                type="email"
                value={user.email}
                disabled
                className="w-full app-panel-2 border app-border app-muted px-4 py-2 rounded-md focus:outline-none cursor-not-allowed opacity-80"
              />
              <T tKey="settings.email_hint" as="p" className="text-xs app-muted" />
            </div>

            <div className="space-y-2">
              <T tKey="settings.full_name" as="p" className="text-sm font-medium app-muted" />
              <input
                id="fullName"
                name="fullName"
                type="text"
                defaultValue={profile?.full_name || ''}
                className="w-full app-input border px-4 py-2 rounded-md focus:outline-none focus:border-emerald-500 transition-colors"
                required
              />
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit"><T tKey="settings.save" /></Button>
            </div>
            
          </form>
        </div>
      </div>
    </div>
  )
}
