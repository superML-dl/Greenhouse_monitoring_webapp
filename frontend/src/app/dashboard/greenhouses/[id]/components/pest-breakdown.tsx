'use client'

import { useState, useTransition } from 'react'
import { Bug, AlertTriangle, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { updateThresholds } from './threshold-actions'
import { useTranslation } from '@/i18n/provider'

const SPECIES_COLORS = [
  '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#14b8a6',
]

interface PestData {
  species: string
  count: number
  percentage: number
  threshold: number
  isAlert: boolean
}

interface PestBreakdownProps {
  data: PestData[]
  greenhouseId: string
  thresholds: Record<string, number>
}

export function PestBreakdown({ data, greenhouseId, thresholds }: PestBreakdownProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [localThresholds, setLocalThresholds] = useState<Record<string, string>>(
    Object.fromEntries(data.map(d => [d.species, d.threshold ? String(d.threshold) : '']))
  )
  const [hasChanges, setHasChanges] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const handleThresholdChange = (species: string, value: string) => {
    setLocalThresholds(prev => ({ ...prev, [species]: value }))
    setHasChanges(true)
    setMessage(null)
  }

  const handleSave = () => {
    const newThresholds: Record<string, number> = {}
    for (const [species, val] of Object.entries(localThresholds)) {
      const num = parseInt(val)
      if (!isNaN(num) && num > 0) {
        newThresholds[species] = num
      }
    }
    startTransition(async () => {
      try {
        const result = await updateThresholds(greenhouseId, newThresholds)
        if (result.error) {
          setMessage({ text: `${t('greenhouse.save_failed')}: ${result.error}`, type: 'error' })
        } else {
          setMessage({ text: t('greenhouse.saved_success'), type: 'success' })
          setHasChanges(false)
          router.refresh()
        }
      } catch (err: any) {
        setMessage({ text: `${t('greenhouse.unexpected_error')}: ${err?.message || t('greenhouse.unknown_error')}`, type: 'error' })
      }
    })
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Bug className="h-5 w-5 text-emerald-400" />
          {t('greenhouse.pest_breakdown')}
        </h2>
        <div className="flex items-center gap-3">
          {message && (
            <span className={`text-xs font-medium ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
              {message.text}
            </span>
          )}
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {isPending ? t('greenhouse.saving') : t('greenhouse.save_thresholds')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {data.map((pest, idx) => {
          const color = SPECIES_COLORS[idx % SPECIES_COLORS.length]
          const thresholdVal = parseInt(localThresholds[pest.species] || '0')
          const isOverThreshold = thresholdVal > 0 && pest.count > thresholdVal

          return (
            <div
              key={pest.species}
              className={`rounded-lg p-4 border transition-colors ${isOverThreshold
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-slate-800/50 border-slate-700'
                }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-sm font-medium text-white truncate">{pest.species}</span>
                {isOverThreshold && (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0 ml-auto" />
                )}
              </div>

              <p className={`text-2xl font-bold ${isOverThreshold ? 'text-red-400' : ''}`} style={isOverThreshold ? {} : { color }}>
                {pest.count}
              </p>

              {/* Progress bar */}
              <div className="mt-2">
                <div className="w-full bg-slate-700 rounded-full h-1.5">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pest.percentage}%`,
                      backgroundColor: isOverThreshold ? '#ef4444' : color,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">{pest.percentage}% {t('greenhouse.of_total')}</p>
              </div>

              {/* Threshold input */}
              <div className="mt-3 pt-3 border-t border-slate-700/50">
                <label className="text-xs text-slate-400 block mb-1">{t('greenhouse.alert_threshold')}</label>
                <input
                  type="number"
                  min="0"
                  placeholder={t('greenhouse.set_limit')}
                  value={localThresholds[pest.species] || ''}
                  onChange={(e) => handleThresholdChange(pest.species, e.target.value)}
                  className={`w-full bg-slate-950 border text-sm px-2.5 py-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${isOverThreshold
                      ? 'border-red-500/50 text-red-300'
                      : 'border-slate-600 text-white'
                    }`}
                />
                {isOverThreshold && (
                  <p className="text-xs text-red-400 mt-1">
                    ⚠ {t('greenhouse.exceeded')} {pest.count} &gt; {thresholdVal}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
