import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardUI, SummaryStat, GreenhouseComparisonEvent, GreenhouseNode } from './components/dashboard-ui'

type GreenhouseCoordinateSource = {
  location?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  lat?: number | string | null
  lng?: number | string | null
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return parsed
}

function parseCoordinates(source: GreenhouseCoordinateSource): { latitude: number; longitude: number } | null {
  const directLatitude = toFiniteNumber(source.latitude ?? source.lat)
  const directLongitude = toFiniteNumber(source.longitude ?? source.lng)

  if (directLatitude !== null && directLongitude !== null) {
    if (Math.abs(directLatitude) <= 90 && Math.abs(directLongitude) <= 180) {
      return { latitude: directLatitude, longitude: directLongitude }
    }
    return null
  }

  const location = source.location
  if (!location) {
    return null
  }

  const parts = location.split(',').map((item) => item.trim())
  if (parts.length !== 2) {
    return null
  }

  const latitude = Number(parts[0])
  const longitude = Number(parts[1])

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }

  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null
  }

  return { latitude, longitude }
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch real stats
  const { data: greenhouses } = await supabase.from('greenhouses').select('*')
  const { data: trapImages } = await supabase.from('trap_images').select('id, greenhouse_id, capture_timestamp')
  const { data: detections } = await supabase.from('insect_detections').select('species_name, trap_image_id')

  // Species count breakdown
  const speciesCounts: Record<string, number> = {}
  if (detections) {
    for (const d of detections) {
      speciesCounts[d.species_name] = (speciesCounts[d.species_name] || 0) + 1
    }
  }

  // Build per-greenhouse detection counts & risk levels
  const ghDetectionCounts: Record<string, number> = {}
  if (trapImages && detections) {
    const imageToGh: Record<string, string> = {}
    for (const img of trapImages) {
      imageToGh[img.id] = img.greenhouse_id
    }
    for (const det of detections) {
      const ghId = imageToGh[det.trap_image_id]
      if (ghId) {
        ghDetectionCounts[ghId] = (ghDetectionCounts[ghId] || 0) + 1
      }
    }
  }

  const greenhouseById: Record<string, { name: string | null; code: string | null }> = {}
  if (greenhouses) {
    for (const greenhouse of greenhouses) {
      greenhouseById[greenhouse.id] = {
        name: greenhouse.name || null,
        code: greenhouse.code || null,
      }
    }
  }

  const trapImageMetaById: Record<string, { greenhouseId: string; captureTimestamp: string | null }> = {}
  if (trapImages) {
    for (const image of trapImages) {
      trapImageMetaById[image.id] = {
        greenhouseId: image.greenhouse_id,
        captureTimestamp: image.capture_timestamp || null,
      }
    }
  }

  const greenhouseComparisonEvents: GreenhouseComparisonEvent[] = []
  if (detections) {
    for (const detection of detections) {
      const trapImageMeta = trapImageMetaById[detection.trap_image_id]
      if (!trapImageMeta?.captureTimestamp) {
        continue
      }

      const greenhouseMeta = greenhouseById[trapImageMeta.greenhouseId]

      greenhouseComparisonEvents.push({
        greenhouseId: trapImageMeta.greenhouseId,
        greenhouseName: greenhouseMeta?.name || greenhouseMeta?.code || 'Unknown Greenhouse',
        greenhouseCode: greenhouseMeta?.code || '',
        capturedAt: trapImageMeta.captureTimestamp,
        speciesName: detection.species_name,
      })
    }
  }

  // Check for alert violations
  const greenhouseRisks: GreenhouseNode[] = []

  if (greenhouses) {
    for (const gh of greenhouses) {
      const thresholds = gh.alert_thresholds || {}
      const totalDet = ghDetectionCounts[gh.id] || 0
      let hasAlert = false

      for (const [species, limit] of Object.entries(thresholds) as [string, number][]) {
        if ((speciesCounts[species] || 0) > limit) {
          hasAlert = true
        }
      }

      let riskLevel: 'safe' | 'warning' | 'danger' = 'safe'
      if (hasAlert) {
        riskLevel = 'danger'
      } else if (totalDet > 0) {
        riskLevel = 'warning'
      }

      const coordinates = parseCoordinates(gh)

      greenhouseRisks.push({
        id: gh.id,
        name: gh.name,
        code: gh.code,
        detections: totalDet,
        riskLevel,
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
      })
    }
  }

  const topSpecies = Object.entries(speciesCounts)
    .sort((a, b) => b[1] - a[1])

  // Build Summary Stats out of top 4 species
  const cardColors = ['border-emerald-500', 'border-blue-500', 'border-rose-500', 'border-amber-500']
  const summaryStats: SummaryStat[] = topSpecies.slice(0, 4).map(([species, count], idx) => ({
    label: species.slice(0, 2).toUpperCase(),
    name: species,
    count: count,
    trend: '+0%', // This would ideally compare against past data in real implementation
    color: cardColors[idx % cardColors.length]
  }))

  return (
    <DashboardUI
      summaryStats={summaryStats}
      greenhouseComparisonEvents={greenhouseComparisonEvents}
      greenhouses={greenhouseRisks}
    />
  )
}
