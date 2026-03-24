import { getGreenhouseById } from '../actions'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, Leaf, Ruler, CalendarDays } from 'lucide-react'
import { ExportButton } from './components/export-button'
import { formatDateShort } from '@/lib/date-format'
import { GreenhouseImageGrid } from './components/greenhouse-image-grid'
import { SpeciesTimeChart } from './components/species-time-chart'
import { DetectionTimeChart } from './components/detection-time-chart'
import { PestBreakdown } from './components/pest-breakdown'
import { T } from '@/i18n/t'

export default async function GreenhouseDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const greenhouse = await getGreenhouseById(params.id)

  if (!greenhouse) {
    notFound()
  }

  const supabase = createClient()

  // Auto-fix stuck 'uploading' status records
  await supabase
    .from('trap_images')
    .update({ status: 'pending' })
    .eq('status', 'uploading')
    .eq('greenhouse_id', params.id)

  // Fetch trap images
  const { data: trapImages } = await supabase
    .from('trap_images')
    .select('*, insect_detections(count)')
    .eq('greenhouse_id', params.id)
    .order('capture_timestamp', { ascending: false })

  // Fetch ALL detections with species breakdown per image
  const imageIds = (trapImages || []).map((img: any) => img.id)

  const { data: allDetections } = imageIds.length > 0
    ? await supabase
      .from('insect_detections')
      .select('species_name, confidence, trap_image_id')
      .in('trap_image_id', imageIds)
    : { data: [] }

  // Aggregate species counts
  const speciesCounts: Record<string, number> = {}
  if (allDetections) {
    for (const d of allDetections) {
      speciesCounts[d.species_name] = (speciesCounts[d.species_name] || 0) + 1
    }
  }

  const totalDetections = allDetections?.length || 0
  const totalImages = trapImages?.length || 0

  // Sort images by capture time (used by both charts)
  const sortedImages = (trapImages || [])
    .slice()
    .sort((a: any, b: any) => new Date(a.capture_timestamp).getTime() - new Date(b.capture_timestamp).getTime())

  // Build total detection time-series (for DetectionTimeChart)
  const timeSeriesData = sortedImages.map((img: any) => ({
    date: formatDateShort(img.capture_timestamp),
    detections: img.insect_detections?.[0]?.count || 0,
    name: img.name,
  }))

  // Build per-species time-series
  const imageIdToDate: Record<string, string> = {}
  for (const img of sortedImages) {
    imageIdToDate[img.id] = formatDateShort(img.capture_timestamp)
  }

  // Group detections: { date -> { species -> count } }
  const dateSpeciesMap: Record<string, Record<string, number>> = {}
  if (allDetections) {
    for (const d of allDetections) {
      const date = imageIdToDate[d.trap_image_id]
      if (!date) continue
      if (!dateSpeciesMap[date]) dateSpeciesMap[date] = {}
      dateSpeciesMap[date][d.species_name] = (dateSpeciesMap[date][d.species_name] || 0) + 1
    }
  }

  // Collect unique dates and species
  const dates = [...new Set(sortedImages.map((img: any) => formatDateShort(img.capture_timestamp)))]
  const speciesNames = Object.keys(speciesCounts)
    .sort((a, b) => (speciesCounts[b] || 0) - (speciesCounts[a] || 0))

  const speciesChartData = {
    dates,
    species: speciesNames.map((name, idx) => ({
      name,
      data: dates.map(date => (dateSpeciesMap[date] || {})[name] || 0),
    })),
  }

  // Alert thresholds
  const thresholds: Record<string, number> = greenhouse.alert_thresholds || {}

  // Prepare pest breakdown data
  const pestData = Object.entries(speciesCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([species, count]) => ({
      species,
      count,
      percentage: totalDetections > 0 ? Math.round((count / totalDetections) * 100) : 0,
      threshold: thresholds[species] || 0,
      isAlert: thresholds[species] ? count > thresholds[species] : false,
    }))

  return (
    <div className="flex flex-col gap-6">
      {/* Back Link + Title */}
      <div>
        <Link
          href="/dashboard/greenhouses"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-emerald-400 mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <T tKey="greenhouse.back" />
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">{greenhouse.name}</h1>
              <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">
                {greenhouse.code}
              </span>
            </div>
            {greenhouse.description && (
              <p className="text-slate-400 text-sm mt-1">{greenhouse.description}</p>
            )}
          </div>
          <ExportButton greenhouseId={params.id} />
        </div>
      </div>

      {/* Meta Info Row */}
      <div className="flex flex-wrap gap-6 text-sm text-slate-400">
        {greenhouse.location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-slate-500" />
            {greenhouse.location}
          </div>
        )}
        {greenhouse.crop_type && (
          <div className="flex items-center gap-1.5">
            <Leaf className="h-4 w-4 text-slate-500" />
            {greenhouse.crop_type}
          </div>
        )}
        {greenhouse.area_sqm && (
          <div className="flex items-center gap-1.5">
            <Ruler className="h-4 w-4 text-slate-500" />
            {greenhouse.area_sqm} m²
          </div>
        )}
      </div>

      {/* Stats Widgets — Only Total Images + Total Detections */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <T tKey="greenhouse.total_images" as="h3" className="text-sm font-medium text-slate-400" />
          <p className="text-3xl font-bold text-white mt-1">{totalImages}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <T tKey="greenhouse.total_detections" as="h3" className="text-sm font-medium text-slate-400" />
          <p className="text-3xl font-bold text-white mt-1">{totalDetections}</p>
        </div>
      </div>

      {/* Pest Detection Breakdown with Thresholds */}
      {pestData.length > 0 && (
        <PestBreakdown
          data={pestData}
          greenhouseId={params.id}
          thresholds={thresholds}
        />
      )}

      {/* Total Detection Time-Series Chart */}
      <DetectionTimeChart data={timeSeriesData} />

      {/* Per-Species Time-Series Chart */}
      <SpeciesTimeChart data={speciesChartData} />

      {/* Trap Images with Viewer */}
      <div>
        <T tKey="greenhouse.trap_images" as="h2" className="text-lg font-semibold text-white mb-4" />
        {totalImages === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
            <CalendarDays className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <T tKey="greenhouse.no_images" as="p" className="text-slate-400" />
            <T tKey="greenhouse.go_inference" as="p" className="text-slate-500 text-sm mt-1" />
          </div>
        ) : (
          <GreenhouseImageGrid images={trapImages || []} />
        )}
      </div>
    </div>
  )
}
