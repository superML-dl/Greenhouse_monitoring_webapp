'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getGreenhouses() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('greenhouses')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching greenhouses:', error)
    return []
  }
  return data
}

export async function getGreenhouseById(id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('greenhouses')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching greenhouse:', error)
    return null
  }
  return data
}

export async function createGreenhouse(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const name = formData.get('name') as string
  const code = formData.get('code') as string
  const location = formData.get('location') as string
  const cropType = formData.get('cropType') as string
  const areaSqm = formData.get('areaSqm') as string
  const description = formData.get('description') as string

  if (!name || !code) {
    return { error: 'Name and Code are required.' }
  }

  const { error } = await supabase.from('greenhouses').insert({
    name,
    code,
    location: location || null,
    crop_type: cropType || null,
    area_sqm: areaSqm ? parseFloat(areaSqm) : null,
    description: description || null,
    alert_thresholds: {},
  })

  if (error) {
    console.error('Error creating greenhouse:', error)
    if (error.code === '23505') {
      return { error: 'A greenhouse with this code already exists.' }
    }
    return { error: 'Failed to create greenhouse.' }
  }

  revalidatePath('/dashboard/greenhouses')
  return { success: true }
}

export async function updateGreenhouse(id: string, formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const name = formData.get('name') as string
  const code = formData.get('code') as string
  const location = formData.get('location') as string
  const cropType = formData.get('cropType') as string
  const areaSqm = formData.get('areaSqm') as string
  const description = formData.get('description') as string

  if (!name || !code) {
    return { error: 'Name and Code are required.' }
  }

  const { error } = await supabase
    .from('greenhouses')
    .update({
      name,
      code,
      location: location || null,
      crop_type: cropType || null,
      area_sqm: areaSqm ? parseFloat(areaSqm) : null,
      description: description || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('Error updating greenhouse:', error)
    if (error.code === '23505') {
      return { error: 'A greenhouse with this code already exists.' }
    }
    return { error: 'Failed to update greenhouse.' }
  }

  revalidatePath('/dashboard/greenhouses')
  revalidatePath(`/dashboard/greenhouses/${id}`)
  return { success: true }
}

export async function deleteGreenhouse(id: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('greenhouses')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting greenhouse:', error)
    return { error: 'Failed to delete greenhouse.' }
  }

  revalidatePath('/dashboard/greenhouses')
  return { success: true }
}
