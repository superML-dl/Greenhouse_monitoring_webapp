'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { getExportData } from '../export-actions'
import { useTranslation } from '@/i18n/provider'

interface ExportButtonProps {
  greenhouseId: string
}

export function ExportButton({ greenhouseId }: ExportButtonProps) {
  const { t } = useTranslation()
  const [isExporting, setIsExporting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  )
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const result = await getExportData(greenhouseId, startDate, `${endDate}T23:59:59`)

      if (result.error || !result.data) {
        alert(t('greenhouse.export_failed'))
        return
      }

      // Convert to CSV
      if (result.data.length === 0) {
        alert(t('greenhouse.export_no_data'))
        return
      }

      const headers = Object.keys(result.data[0])
      const csvRows = [
        headers.join(','),
        ...result.data.map((row: any) =>
          headers.map((h) => {
            const val = row[h]
            // Escape commas and quotes
            if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
              return `"${val.replace(/"/g, '""')}"`
            }
            return val ?? ''
          }).join(',')
        ),
      ]
      const csvContent = csvRows.join('\n')

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `trap_data_${startDate}_${endDate}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setShowModal(false)
    } catch (e) {
      console.error(e)
      alert(t('greenhouse.export_failed'))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowModal(true)}>
        <Download className="h-4 w-4" />
        {t('greenhouse.export')}
      </Button>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('greenhouse.export_data')}</h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">{t('greenhouse.start_date')}</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">{t('greenhouse.end_date')}</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setShowModal(false)}>{t('greenhouse.cancel')}</Button>
              <Button onClick={handleExport} disabled={isExporting} className="gap-1.5">
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('greenhouse.exporting')}
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    {t('greenhouse.download_csv')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
