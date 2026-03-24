import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sprout } from 'lucide-react'
import { formatDateShort } from '@/lib/date-format'
import { OverviewTimeChart } from './components/overview-time-chart'
import { T } from '@/i18n/t'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch real stats
  const { data: greenhouses } = await supabase.from('greenhouses').select('id, name, code, alert_thresholds')
  const { data: trapImages } = await supabase.from('trap_images').select('id, greenhouse_id, capture_timestamp')
  const { data: detections } = await supabase.from('insect_detections').select('species_name, trap_image_id')

  const totalGreenhouses = greenhouses?.length || 0
  const totalImages = trapImages?.length || 0
  const totalDetections = detections?.length || 0

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

  // Check for alert violations
  let alertCount = 0
  const greenhouseRisks: { id: string; name: string; code: string; detections: number; riskLevel: 'safe' | 'warning' | 'danger' }[] = []

  if (greenhouses) {
    for (const gh of greenhouses) {
      const thresholds = gh.alert_thresholds || {}
      const totalDet = ghDetectionCounts[gh.id] || 0
      let hasAlert = false

      for (const [species, limit] of Object.entries(thresholds) as [string, number][]) {
        if ((speciesCounts[species] || 0) > limit) {
          alertCount++
          hasAlert = true
        }
      }

      let riskLevel: 'safe' | 'warning' | 'danger' = 'safe'
      if (hasAlert) {
        riskLevel = 'danger'
      } else if (totalDet > 0) {
        riskLevel = 'warning'
      }

      greenhouseRisks.push({ id: gh.id, name: gh.name, code: gh.code, detections: totalDet, riskLevel })
    }
  }

  const stats = [
    { nameKey: 'overview.total_greenhouses', value: String(totalGreenhouses), color: 'text-white' },
    { nameKey: 'overview.images_processed', value: String(totalImages), color: 'text-white' },
    { nameKey: 'overview.insects_detected', value: String(totalDetections), color: 'text-emerald-400' },
    { nameKey: 'overview.critical_alerts', value: String(alertCount), color: alertCount > 0 ? 'text-red-400' : 'text-white' },
  ]

  const topSpecies = Object.entries(speciesCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  // Build time-series data: detections per date (grouped by capture date)
  const dateDetectionMap: Record<string, number> = {}
  if (trapImages && detections) {
    const imageIdToDate: Record<string, string> = {}
    for (const img of trapImages) {
      imageIdToDate[img.id] = formatDateShort(img.capture_timestamp)
    }
    for (const det of detections) {
      const date = imageIdToDate[det.trap_image_id]
      if (date) {
        dateDetectionMap[date] = (dateDetectionMap[date] || 0) + 1
      }
    }
  }
  const timeSeriesData = Object.entries(dateDetectionMap)
    .sort((a, b) => {
      const [dA, mA, yA] = a[0].split('/').map(Number)
      const [dB, mB, yB] = b[0].split('/').map(Number)
      return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime()
    })
    .map(([date, count]) => ({ date, detections: count }))

  const riskColors = {
    safe: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-400', labelKey: 'overview.safe' },
    warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-400', labelKey: 'overview.warning' },
    danger: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-400', labelKey: 'overview.alert' },
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <T tKey="overview.title" as="h1" className="text-3xl font-bold tracking-tight text-white" />
        <T tKey="overview.welcome" as="p" className="text-slate-400 mt-1" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.nameKey} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
            <T tKey={stat.nameKey} as="h3" className="text-sm font-medium text-slate-400" />
            <p className={`text-3xl font-bold mt-2 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Greenhouse Risk Overview */}
      {greenhouseRisks.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <T tKey="overview.greenhouse_status" as="h2" className="text-lg font-semibold text-white mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {greenhouseRisks.map((gh) => {
              const colors = riskColors[gh.riskLevel]
              return (
                <div
                  key={gh.id}
                  className={`${colors.bg} border ${colors.border} rounded-xl p-4 select-none`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold ${colors.text} uppercase tracking-wide`}>{gh.code}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${colors.dot} animate-pulse`} />
                      <T tKey={colors.labelKey} as="span" className={`text-xs font-medium ${colors.text}`} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sprout className={`h-4 w-4 ${colors.text} opacity-60`} />
                    <p className="text-sm font-medium text-white truncate">{gh.name}</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {gh.detections} detection{gh.detections !== 1 ? 's' : ''}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Species Breakdown */}
      {topSpecies.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <T tKey="overview.species_breakdown" as="h2" className="text-lg font-semibold text-white mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {topSpecies.map(([species, count]) => (
              <div key={species} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">{count}</p>
                <p className="text-xs text-slate-400 mt-1 truncate" title={species}>{species}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time-Series Chart */}
      <OverviewTimeChart data={timeSeriesData} />
    </div>
  )
}
