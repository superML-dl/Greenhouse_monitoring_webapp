'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return
  }

  const fullName = (formData.get('fullName') as string)?.trim()
  const avatarFile = formData.get('avatar')

  if (!fullName) {
    return
  }

  let avatarUrl: string | undefined
  if (avatarFile instanceof File && avatarFile.size > 0) {
    if (!avatarFile.type.startsWith('image/')) {
      return
    }
    if (avatarFile.size > 5 * 1024 * 1024) {
      return
    }

    const extension = avatarFile.name.split('.').pop() || 'jpg'
    const filePath = `${user.id}/avatar.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, avatarFile, {
        upsert: true,
        contentType: avatarFile.type,
        cacheControl: '3600',
      })

    if (uploadError) {
      console.error('Error uploading avatar:', uploadError)
    } else {
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      avatarUrl = publicUrlData.publicUrl
    }
  }

  const payload: {
    id: string
    full_name: string
    updated_at: string
    avatar_url?: string
  } = {
    id: user.id,
    full_name: fullName,
    updated_at: new Date().toISOString(),
  }

  if (avatarUrl) {
    payload.avatar_url = avatarUrl
  }

  const { error } = await supabase
    .from('profiles')
    .upsert(payload)

  if (error) {
    console.error('Error updating profile:', error)
    return
  }

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard')
}
