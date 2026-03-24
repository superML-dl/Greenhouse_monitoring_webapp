import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/layout/dashboard-shell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile from public.profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profileData = {
    fullName: profile?.full_name || user.email || 'User',
    role: profile?.role || 'User',
    email: user.email || '',
    avatarUrl: profile?.avatar_url || null,
  }

  return <DashboardShell profile={profileData}>{children}</DashboardShell>
}
