"use client"

import React, { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts'
import { MapPin, ChevronDown, ListFilter, TrendingUp, TrendingDown } from 'lucide-react'
import { useTranslation } from '@/i18n/provider'

const TIME_FILTER_OPTIONS = ['time_today', 'time_this_week', 'time_this_month', 'time_this_year'] as const
type TimeFilter = (typeof TIME_FILTER_OPTIONS)[number]
const ALL_GREENHOUSES_FILTER = 'all_greenhouses'

type DropdownOption = {
  value: string
  label: string
}

function getRangeStart(filter: TimeFilter, now: Date): Date {
  const start = new Date(now)

  if (filter === 'time_today') {
    start.setHours(0, 0, 0, 0)
    return start
  }

  if (filter === 'time_this_week') {
    const day = start.getDay() // 0 = Sunday
    const diffToMonday = day === 0 ? 6 : day - 1
    start.setDate(start.getDate() - diffToMonday)
    start.setHours(0, 0, 0, 0)
    return start
  }

  if (filter === 'time_this_month') {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    return start
  }

  start.setMonth(0, 1)
  start.setHours(0, 0, 0, 0)
  return start
}

// Custom Recharts Tooltip for a polished look
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const visibleItems = payload.filter((entry: any) => Number(entry.value) > 0)
    const total = payload.reduce((sum: number, entry: any) => sum + Number(entry.value || 0), 0)

    return (
      <div className="bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg font-sans">
        <p className="font-semibold text-slate-800 dark:text-slate-100 mb-2">{label}</p>
        <div className="flex flex-col gap-1.5">
          {visibleItems.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center gap-2 text-sm">
              <span 
                className="w-3 h-3 rounded-full shadow-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-slate-600 dark:text-slate-300 capitalize">{entry.name}:</span>
              <span className="font-semibold text-slate-900 dark:text-white ml-auto">{entry.value}</span>
            </div>
          ))}
          {visibleItems.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{payload[0]?.payload?.noDetectionsT || 'No detections'}</p>
          )}
          <div className="pt-1 mt-1 border-t border-slate-200 dark:border-slate-700 text-sm flex items-center justify-between">
            <span className="font-medium text-slate-600 dark:text-slate-300">{payload[0]?.payload?.totalT || 'Total'}</span>
            <span className="font-semibold text-slate-900 dark:text-white">{total}</span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

const DynamicMap = dynamic(
  () => import('./greenhouse-map').then((mod) => mod.GreenhouseMap),
  { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800/20 rounded-xl animate-pulse"><div className="text-slate-400">Loading Leaflet Map...</div></div> }
)

const FilterDropdown = ({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (val: string) => void
  options: readonly DropdownOption[]
  placeholder?: string
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const selectedOption = options.find((option) => option.value === value)
  const buttonLabel = selectedOption?.label || placeholder || value

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 transition-colors focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
      >
        <ListFilter className="w-4 h-4" />
        <span className="max-w-40 truncate">{buttonLabel}</span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 max-h-72 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-20 top-full overflow-hidden">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  value === opt.value 
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-medium' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export interface SummaryStat {
  label: string;
  name: string;
  count: number;
  trend: string;
  color: string;
}

export interface GreenhouseComparisonEvent {
  greenhouseId: string;
  greenhouseName: string;
  greenhouseCode: string;
  capturedAt: string;
  speciesName: string;
}

export interface GreenhouseNode {
  id: string;
  name: string;
  code: string;
  detections: number;
  riskLevel: 'safe' | 'warning' | 'danger';
  latitude: number | null;
  longitude: number | null;
}

interface DashboardUIProps {
  summaryStats: SummaryStat[];
  greenhouseComparisonEvents: GreenhouseComparisonEvent[];
  greenhouses: GreenhouseNode[];
}

export function DashboardUI({ summaryStats, greenhouseComparisonEvents, greenhouses }: DashboardUIProps) {
  const { t } = useTranslation()
  const [chartFilter, setChartFilter] = useState<TimeFilter>('time_this_month')
  const [selectedGreenhouseId, setSelectedGreenhouseId] = useState<string>(ALL_GREENHOUSES_FILTER)

  const chartColors = ['#10b981', '#3b82f6', '#f97316', '#f43f5e', '#14b8a6', '#8b5cf6']

  const timeFilterOptions = useMemo<DropdownOption[]>(
    () => TIME_FILTER_OPTIONS.map((opt) => ({ value: opt, label: t(`overview.${opt}`) })),
    [t],
  )

  const greenhouseFilterOptions = useMemo<DropdownOption[]>(
    () => [
      { value: ALL_GREENHOUSES_FILTER, label: t('overview.all_greenhouses') },
      ...greenhouses.map((greenhouse) => ({
        value: greenhouse.id,
        label: greenhouse.name || greenhouse.code || greenhouse.id,
      })),
    ],
    [greenhouses, t],
  )

  const speciesKeys = useMemo(() => {
    const counts: Record<string, number> = {}

    for (const event of greenhouseComparisonEvents) {
      counts[event.speciesName] = (counts[event.speciesName] || 0) + 1
    }

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([species]) => species)
  }, [greenhouseComparisonEvents])

  const comparisonChartData = useMemo(() => {
    const now = new Date()
    const start = getRangeStart(chartFilter, now)

    const rowsByGreenhouse: Record<string, Record<string, string | number>> = {}

    const greenhouseLabel =
      selectedGreenhouseId === ALL_GREENHOUSES_FILTER
        ? t('overview.all_greenhouses')
        : greenhouseFilterOptions.find((option) => option.value === selectedGreenhouseId)?.label || t('overview.all_greenhouses')

    rowsByGreenhouse[ALL_GREENHOUSES_FILTER] = {
      greenhouse: greenhouseLabel,
      total: 0,
      noDetectionsT: t('overview.no_detections_timeframe'),
      totalT: t('overview.total'),
    }

    for (const species of speciesKeys) {
      rowsByGreenhouse[ALL_GREENHOUSES_FILTER][species] = 0
    }

    for (const event of greenhouseComparisonEvents) {
      const capturedAt = new Date(event.capturedAt)
      if (Number.isNaN(capturedAt.getTime())) {
        continue
      }

      if (capturedAt < start || capturedAt > now) {
        continue
      }

      if (selectedGreenhouseId !== ALL_GREENHOUSES_FILTER && event.greenhouseId !== selectedGreenhouseId) {
        continue
      }

      const targetRow = rowsByGreenhouse[ALL_GREENHOUSES_FILTER]
      if (typeof targetRow[event.speciesName] !== 'number') {
        targetRow[event.speciesName] = 0
      }

      targetRow[event.speciesName] = Number(targetRow[event.speciesName]) + 1
      targetRow.total = Number(targetRow.total) + 1
    }

    return Object.values(rowsByGreenhouse)
  }, [chartFilter, greenhouseComparisonEvents, greenhouseFilterOptions, selectedGreenhouseId, speciesKeys, t])

  const hasComparisonData = comparisonChartData.some((item) => Number(item.total) > 0)

  return (
    <div className="w-full font-sans">
      
      {/* 1. TOP SECTION: SUMMARY WIDGETS */}
      <section className="mb-8 relative z-10">
        <div className="mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {t('overview.insect_detections')}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('overview.insect_detections_desc')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {summaryStats.map((stat) => (
            <div 
              key={stat.name}
              className={`group bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 transition-all hover:shadow-md border-b-4 ${stat.color} hover:-translate-y-1 duration-300`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 tracking-wider">
                      {stat.label}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                      {stat.name}
                    </span>
                  </div>
                  <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                    {stat.count.toLocaleString()}
                  </h3>
                </div>
                
                <div className={`flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full ${
                  stat.trend.startsWith('+') 
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' 
                    : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                }`}>
                  {stat.trend.startsWith('+') ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {stat.trend}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. MAIN SECTION: 2-COLUMN GRID */}
      <section className="grid grid-cols-1 lg:grid-cols-10 gap-6 lg:gap-8 relative z-0">
        
        {/* LEFT COLUMN: BAR CHART (60-70%) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col h-[500px] transition-all hover:shadow-md">
          {/* Chart Header */}
          <div className="p-6 pb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800/60">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{t('overview.greenhouse_comparison')}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('overview.greenhouse_comparison_desc')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <FilterDropdown
                value={chartFilter}
                onChange={(value) => {
                  const optKey = TIME_FILTER_OPTIONS.find((opt) => opt === value)
                  if (optKey) setChartFilter(optKey)
                }}
                options={timeFilterOptions}
                placeholder={t('overview.time_filter')}
              />
              <FilterDropdown
                value={selectedGreenhouseId}
                onChange={setSelectedGreenhouseId}
                options={greenhouseFilterOptions}
                placeholder={t('overview.all_greenhouses')}
              />
            </div>
          </div>
          
          {/* Chart Area */}
          <div className="p-6 flex-1 min-h-0 w-full relative">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={comparisonChartData} margin={{ top: 10, right: 10, left: -8, bottom: 8 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                 <XAxis 
                   dataKey="greenhouse" 
                   axisLine={false} 
                   tickLine={false} 
                   tick={{ fill: '#64748b', fontSize: 13, fontWeight: 500 }}
                   dy={8}
                   minTickGap={20}
                 />
                 <YAxis 
                   axisLine={false} 
                   tickLine={false}
                   allowDecimals={false}
                   tick={{ fill: '#64748b', fontSize: 13, fontWeight: 500 }}
                 />
                 <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.05)' }} />
                 <Legend 
                    wrapperStyle={{ paddingTop: '20px' }} 
                    iconType="circle"
                 />
                 
                 {/* Stacked bars by insect species */}
                 {speciesKeys.map((species, idx) => (
                   <Bar 
                     key={species} 
                     dataKey={species} 
                     name={species} 
                     stackId="insects" 
                     fill={chartColors[idx % chartColors.length]} 
                     radius={idx === speciesKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                     barSize={36} 
                     animationDuration={1500} 
                   />
                 ))}
               </BarChart>
             </ResponsiveContainer>

            {!hasComparisonData && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="rounded-lg border border-slate-300/60 dark:border-slate-700/70 bg-white/90 dark:bg-slate-900/90 px-4 py-2 text-sm text-slate-600 dark:text-slate-300">
                  {t('overview.no_detections_timeframe')}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: MAP COMPONENT (30-40%) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col h-[500px] overflow-hidden transition-all hover:shadow-md">
          <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{t('overview.active_greenhouses')}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('overview.active_greenhouses_desc')}</p>
            </div>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
          
          {/* Map Area */}
          <div className="flex-1 p-4 relative flex flex-col">
            
            <div className="relative w-full h-full rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner overflow-hidden z-0">
               <DynamicMap greenhouses={greenhouses} />
            </div>

            {/* Map Legend */}
            <div className="mt-4 flex flex-wrap gap-3 xl:gap-5 text-xs font-medium text-slate-600 dark:text-slate-300 justify-center">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" /> 
                {t('overview.safe')}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm" /> 
                {t('overview.alert')}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" /> 
                {t('overview.warning')}
              </div>
            </div>
            
          </div>
        </div>

      </section>
    </div>
  )
}
