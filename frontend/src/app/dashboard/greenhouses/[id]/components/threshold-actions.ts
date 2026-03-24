'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateThresholds(greenhouseId: string, thresholds: Record<string, number>) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('greenhouses')
    .update({
      alert_thresholds: thresholds,
      updated_at: new Date().toISOString(),
    })
    .eq('id', greenhouseId)

  if (error) {
    console.error('Error updating thresholds:', error)
    return { error: error.message }
  }

  revalidatePath(`/dashboard/greenhouses/${greenhouseId}`)
  return { success: true }
}
