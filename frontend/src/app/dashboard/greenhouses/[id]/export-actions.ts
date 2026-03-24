'use server'

import { createClient } from '@/lib/supabase/server'

export async function getExportData(greenhouseId: string, startDate: string, endDate: string) {
  const supabase = createClient()

  // Fetch trap images in date range
  let query = supabase
    .from('trap_images')
    .select('id, name, capture_timestamp, temperature, humidity, greenhouses(name, code)')
    .gte('capture_timestamp', startDate)
    .lte('capture_timestamp', endDate)
    .order('capture_timestamp', { ascending: true })

  if (greenhouseId && greenhouseId !== 'all') {
    query = query.eq('greenhouse_id', greenhouseId)
  }

  const { data: images, error } = await query

  if (error || !images) {
    return { error: 'Failed to fetch data' }
  }

  // Get detections for all these images
  const imageIds = images.map((img: any) => img.id)
  const { data: detections } = await supabase
    .from('insect_detections')
    .select('trap_image_id, species_name, confidence')
    .in('trap_image_id', imageIds)

  // Build export rows
  const rows = images.map((img: any) => {
    const imgDetections = (detections || []).filter((d: any) => d.trap_image_id === img.id)
    const speciesCounts: Record<string, number> = {}
    for (const d of imgDetections) {
      speciesCounts[d.species_name] = (speciesCounts[d.species_name] || 0) + 1
    }

    return {
      image_name: img.name,
      greenhouse: img.greenhouses ? `[${img.greenhouses.code}] ${img.greenhouses.name}` : 'N/A',
      capture_date: img.capture_timestamp,
      temperature: img.temperature,
      humidity: img.humidity,
      total_detections: imgDetections.length,
      species_breakdown: JSON.stringify(speciesCounts),
    }
  })

  return { data: rows }
}
