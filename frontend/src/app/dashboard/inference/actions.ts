'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function getBackendUrl(): string {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL
  if (!url) {
    throw new Error(
      'BACKEND_URL environment variable is not set. ' +
      'Please add BACKEND_URL to your .env.local file (e.g., BACKEND_URL=http://localhost:8000)'
    )
  }
  return url.replace(/\/+$/, '') // Remove trailing slashes
}

const BACKEND_URL = getBackendUrl()

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

  let visual: {
    original_image_width: number
    original_image_height: number
    image_width: number
    image_height: number
    windows_scanned: number
    patches_processed: number
    preprocess: {
      contour_found: boolean
      crop_box_original: {
        x: number
        y: number
        w: number
        h: number
      }
      hsv_image_data_url: string
      processed_image_data_url: string
      mask_image_data_url: string
      boxed_image_data_url: string
    } | null
    stage1_detections: any[]
    stage2_detections: any[]
    stage2_detections_preprocessed: any[]
    stage2_scan_path: any[]
    stage2_valid_slices: any[]
    stage2_slicing_debug: any
  } | null = null
  let inferenceError: string | null = null

  // Step 3: Call FastAPI backend for inference
  try {
    const fileBytes = await file.arrayBuffer()
    const blob = new Blob([fileBytes], { type: file.type })
    const inferenceForm = new FormData()
    inferenceForm.set('file', blob, file.name)

    const predictUrl = `${BACKEND_URL}/api/v1/inference/predict?trap_image_id=${encodeURIComponent(trapImage.id)}`

    // Use AbortController with 120s timeout (Render free tier can be slow on cold start)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120_000)

    console.log(`[Inference] Calling backend: ${predictUrl}`)

    const resp = await fetch(predictUrl, {
      method: 'POST',
      body: inferenceForm,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (resp.ok) {
      const result = await resp.json()

      visual = {
        original_image_width: result.original_image_width || 0,
        original_image_height: result.original_image_height || 0,
        image_width: result.image_width,
        image_height: result.image_height,
        windows_scanned: result.windows_scanned || 0,
        patches_processed: result.patches_processed || 0,
        preprocess: result.preprocess || null,
        stage1_detections: result.stage1?.detections || [],
        stage2_detections: result.stage2?.detections || [],
        stage2_detections_preprocessed: result.stage2?.detections_preprocessed || [],
        stage2_scan_path: result.stage2?.scan_path || [],
        stage2_valid_slices: result.stage2?.valid_slices || [],
        stage2_slicing_debug: result.stage2?.slicing_debug || null,
      }

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

        const { error: detectionInsertError } = await supabase.from('insect_detections').insert(inserts)
        if (detectionInsertError) {
          console.error('Detection insert error:', detectionInsertError)
        }
      }

      // Update trap image status to processed
      const { error: processedStatusError } = await supabase
        .from('trap_images')
        .update({ status: 'processed' })
        .eq('id', trapImage.id)

      if (processedStatusError) {
        console.error('Failed to set trap image status to processed:', processedStatusError)
        inferenceError = 'Inference completed, but status update failed. Please refresh and try again.'
      }
    } else {
      // Inference failed but upload succeeded — mark as failed
      const errText = await resp.text()
      console.error(`[Inference] Backend returned HTTP ${resp.status}:`, errText)
      const { error: failedStatusError } = await supabase
        .from('trap_images')
        .update({ status: 'failed' })
        .eq('id', trapImage.id)

      if (failedStatusError) {
        console.error('Failed to set trap image status to failed:', failedStatusError)
      }

      inferenceError = `Inference failed (HTTP ${resp.status}): ${errText.slice(0, 180)}`
    }
  } catch (e: any) {
    // Backend unreachable or timeout — mark as failed
    const isTimeout = e?.name === 'AbortError'
    console.error(`[Inference] ${isTimeout ? 'Request timed out' : 'Backend unreachable'}:`, e)
    const { error: failedStatusError } = await supabase
      .from('trap_images')
      .update({ status: 'failed' })
      .eq('id', trapImage.id)

    if (failedStatusError) {
      console.error('Failed to set trap image status to failed after exception:', failedStatusError)
    }

    inferenceError = isTimeout
      ? 'Inference timed out. The backend may be starting up (cold start). Please try again in 1-2 minutes.'
      : `Inference service is currently unreachable. Backend URL: ${BACKEND_URL?.slice(0, 40)}`
  }

  revalidatePath('/dashboard/inference')
  revalidatePath(`/dashboard/greenhouses/${greenhouseId}`)

  if (inferenceError) {
    return { error: inferenceError, trapImageId: trapImage.id, visual }
  }

  return { success: true, trapImageId: trapImage.id, visual }
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

  const rows = data || []
  const pendingButDetectedIds = rows
    .filter((img: any) => img.status === 'pending' && (img.insect_detections?.[0]?.count || 0) > 0)
    .map((img: any) => img.id)

  if (pendingButDetectedIds.length > 0) {
    const { error: reconcileError } = await supabase
      .from('trap_images')
      .update({ status: 'processed' })
      .in('id', pendingButDetectedIds)

    if (reconcileError) {
      console.error('Failed to reconcile pending trap image statuses:', reconcileError)
    }
  }

  const pendingIdSet = new Set(pendingButDetectedIds)
  const normalizedRows = rows.map((img: any) => (
    pendingIdSet.has(img.id)
      ? { ...img, status: 'processed' }
      : img
  ))

  return { data: normalizedRows, total: count || 0 }
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
