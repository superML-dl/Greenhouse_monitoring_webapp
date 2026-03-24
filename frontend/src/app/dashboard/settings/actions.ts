'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return
  }

  const fullName = formData.get('fullName') as string
  const role = formData.get('role') as string

  if (!fullName) {
    return
  }

  // Ensure role is valid
  if (!['Admin', 'Engineer', 'Farmer'].includes(role)) {
    return
  }

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      full_name: fullName,
      role: role,
      updated_at: new Date().toISOString()
    })

  if (error) {
    console.error('Error updating profile:', error)
    return
  }

  revalidatePath('/dashboard/settings')
}
