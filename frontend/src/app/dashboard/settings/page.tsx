import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { updateProfile } from './actions'
import { T } from '@/i18n/t'

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
        <T tKey="settings.title" as="h1" className="text-2xl font-bold tracking-tight text-white mb-2" />
        <T tKey="settings.subtitle" as="p" className="text-slate-400" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-800">
          <T tKey="settings.profile_info" as="h2" className="text-lg font-medium text-white mb-4" />
          <form action={updateProfile} className="space-y-6">
            
            <div className="space-y-2">
              <T tKey="settings.email" as="p" className="text-sm font-medium text-slate-300" />
              <input
                id="email"
                type="email"
                value={user.email}
                disabled
                className="w-full bg-slate-800/50 border border-slate-700 text-slate-300 px-4 py-2 rounded-md focus:outline-none cursor-not-allowed opacity-70"
              />
              <T tKey="settings.email_hint" as="p" className="text-xs text-slate-500" />
            </div>

            <div className="space-y-2">
              <T tKey="settings.full_name" as="p" className="text-sm font-medium text-slate-300" />
              <input
                id="fullName"
                name="fullName"
                type="text"
                defaultValue={profile?.full_name || ''}
                className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-md focus:outline-none focus:border-emerald-500 transition-colors"
                required
              />
            </div>

            <div className="space-y-2">
              <T tKey="settings.role" as="p" className="text-sm font-medium text-slate-300" />
              <select
                id="role"
                name="role"
                defaultValue={profile?.role || 'Farmer'}
                className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-md focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="Admin"><T tKey="settings.role_admin" /></option>
                <option value="Engineer"><T tKey="settings.role_engineer" /></option>
                <option value="Farmer"><T tKey="settings.role_farmer" /></option>
              </select>
              <T tKey="settings.role_hint" as="p" className="text-xs text-slate-500" />
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
