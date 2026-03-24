'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function saveTrapImage(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const greenhouseId = formData.get('greenhouseId') as string
  const name = formData.get('name') as string
  const captureTimestamp = formData.get('captureTimestamp') as string
  const temperature = formData.get('temperature') as string
  const humidity = formData.get('humidity') as string
  const file = formData.get('file') as File

  if (!greenhouseId || !file) {
    return { error: 'Greenhouse and image file are required.' }
  }

  // Step 1: Upload image to Supabase Storage
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = `${greenhouseId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('trap-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    console.error('Upload error:', JSON.stringify(uploadError))
    return { error: `Upload failed: ${uploadError.message}` }
  }

  const { data: { publicUrl } } = supabase.storage
    .from('trap-images')
    .getPublicUrl(filePath)

  // Step 2: Save the trap image record as 'pending'
  const { data: trapImage, error: insertError } = await supabase
    .from('trap_images')
    .insert({
      greenhouse_id: greenhouseId,
      uploaded_by: user.id,
      name: name || file.name,
      image_url: publicUrl,
      capture_timestamp: captureTimestamp || new Date().toISOString(),
      temperature: temperature ? parseFloat(temperature) : null,
      humidity: humidity ? parseFloat(humidity) : null,
      status: 'pending',
    })
    .select()
    .single()

  if (insertError) {
    console.error('Insert error:', insertError)
    return { error: `DB error: ${insertError.message}` }
  }

  // Step 3: Call FastAPI backend for inference
  try {
    const fileBytes = await file.arrayBuffer()
    const blob = new Blob([fileBytes], { type: file.type })
    const inferenceForm = new FormData()
    inferenceForm.set('file', blob, file.name)

    const resp = await fetch(`${BACKEND_URL}/api/v1/inference/predict`, {
      method: 'POST',
      body: inferenceForm,
    })

    if (resp.ok) {
      const result = await resp.json()

      // Save detections from Stage 2 (final refined results)
      const detections = result.stage2?.detections || []
      if (detections.length > 0) {
        const inserts = detections.map((det: any) => ({
          trap_image_id: trapImage.id,
          species_name: det.species_name,
          confidence: det.confidence,
          bbox_x: det.bbox_x,
          bbox_y: det.bbox_y,
          bbox_w: det.bbox_w,
          bbox_h: det.bbox_h,
        }))

        await supabase.from('insect_detections').insert(inserts)
      }

      // Update trap image status to processed
      await supabase
        .from('trap_images')
        .update({
          status: 'processed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', trapImage.id)
    } else {
      // Inference failed but upload succeeded — mark as pending
      const errText = await resp.text()
      console.error('Inference error:', errText)
      await supabase
        .from('trap_images')
        .update({ status: 'pending' })
        .eq('id', trapImage.id)
    }
  } catch (e) {
    // Backend unreachable — mark as pending for retry
    console.error('Backend unreachable:', e)
    await supabase
      .from('trap_images')
      .update({ status: 'pending' })
      .eq('id', trapImage.id)
  }

  revalidatePath('/dashboard/inference')
  revalidatePath(`/dashboard/greenhouses/${greenhouseId}`)
  return { success: true, trapImageId: trapImage.id }
}

export async function deleteTrapImage(id: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Delete detections first (FK)
  await supabase.from('insect_detections').delete().eq('trap_image_id', id)

  // Delete the trap image record
  const { error } = await supabase.from('trap_images').delete().eq('id', id)
  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/inference')
  return { success: true }
}

export async function getTrapImages(page: number = 1, perPage: number = 10) {
  const supabase = createClient()
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const { data, error, count } = await supabase
    .from('trap_images')
    .select('*, greenhouses(name, code), insect_detections(count)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('Error fetching trap images:', error)
    return { data: [], total: 0 }
  }
  return { data: data || [], total: count || 0 }
}

export async function getTrapImageDetails(id: string) {
  const supabase = createClient()

  const { data: image } = await supabase
    .from('trap_images')
    .select('*, greenhouses(name, code)')
    .eq('id', id)
    .single()

  const { data: detections } = await supabase
    .from('insect_detections')
    .select('*')
    .eq('trap_image_id', id)
    .order('confidence', { ascending: false })

  return { image, detections: detections || [] }
}
