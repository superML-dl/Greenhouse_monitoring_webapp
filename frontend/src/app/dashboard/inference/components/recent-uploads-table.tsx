'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Info, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/date-format'
import { deleteTrapImage } from '../actions'
import { useTranslation } from '@/i18n/provider'

interface RecentUploadsTableProps {
  images: any[]
  currentPage: number
  totalPages: number
  totalItems: number
}

export function RecentUploadsTable({ images, currentPage, totalPages, totalItems }: RecentUploadsTableProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [localImages, setLocalImages] = useState<any[]>(images)
  const [localTotalItems, setLocalTotalItems] = useState(totalItems)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [infoImage, setInfoImage] = useState<any>(null)

  useEffect(() => {
    setLocalImages(images)
    setLocalTotalItems(totalItems)
  }, [images, totalItems])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`${t('inference.confirm_delete').replace('{name}', name)}`)) return
    setDeletingId(id)
    setLocalImages((prev) => prev.filter((img) => img.id !== id))
    setLocalTotalItems((prev) => Math.max(0, prev - 1))
    if (infoImage?.id === id) {
      setInfoImage(null)
    }
    const result = await deleteTrapImage(id)
    if (result?.error) {
      setLocalImages(images)
      setLocalTotalItems(totalItems)
      alert(result.error)
    }
    setDeletingId(null)
    router.refresh()
  }

  const detectionCount = (img: any) => {
    return img.insect_detections?.[0]?.count || 0
  }

  const statusLabel = (status: string) => {
    if (status === 'processed') return t('inference.status_completed')
    if (status === 'failed') return t('inference.status_failed')
    return t(`inference.status_${status}`)
  }

  const statusClass = (status: string) => {
    if (status === 'processed') {
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
    }
    if (status === 'failed') {
      return 'bg-red-500/10 text-red-400 border border-red-500/20'
    }
    return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
  }

  return (
    <>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-left">
              <th className="px-4 py-3 text-slate-400 font-medium">{t('inference.image')}</th>
              <th className="px-4 py-3 text-slate-400 font-medium">{t('inference.greenhouse')}</th>
              <th className="px-4 py-3 text-slate-400 font-medium">{t('inference.capture_date')}</th>
              <th className="px-4 py-3 text-slate-400 font-medium">{t('overview.detections')}</th>
              <th className="px-4 py-3 text-slate-400 font-medium">{t('inference.status')}</th>
              <th className="px-4 py-3 text-slate-400 font-medium text-right">{t('inference.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {localImages.map((img: any) => (
              <tr key={img.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-md overflow-hidden flex-shrink-0">
                      {img.image_url && (
                        <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <span className="text-slate-900 dark:text-white truncate max-w-[200px]">{img.name || '—'}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                  {img.greenhouses ? `[${img.greenhouses.code}] ${img.greenhouses.name}` : '—'}
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                  {formatDate(img.capture_timestamp)}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm font-medium ${detectionCount(img) > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {detectionCount(img)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${statusClass(img.status)}`}>
                    {statusLabel(img.status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {/* Info */}
                    <button
                      onClick={() => setInfoImage(img)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                      title={t('inference.view_details')}
                    >
                      <Info className="h-4 w-4" />
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(img.id, img.name)}
                      disabled={deletingId === img.id}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                      title={t('inference.delete_image')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('inference.showing')} {localTotalItems === 0 ? 0 : Math.min((currentPage - 1) * 10 + 1, localTotalItems)}–{Math.min(currentPage * 10, localTotalItems)} {t('inference.of')} {localTotalItems} {t('inference.images')}
          </p>

          <div className="flex items-center gap-1">
            <Link
              href={currentPage > 1 ? `/dashboard/inference?page=${currentPage - 1}` : '#'}
              className={`p-1.5 rounded-md transition-colors ${currentPage > 1
                  ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  : 'text-slate-300 dark:text-slate-600 pointer-events-none'
                }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/dashboard/inference?page=${p}`}
                className={`min-w-[32px] h-8 flex items-center justify-center rounded-md text-xs font-medium transition-colors ${p === currentPage
                    ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
              >
                {p}
              </Link>
            ))}

            <Link
              href={currentPage < totalPages ? `/dashboard/inference?page=${currentPage + 1}` : '#'}
              className={`p-1.5 rounded-md transition-colors ${currentPage < totalPages
                  ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  : 'text-slate-300 dark:text-slate-600 pointer-events-none'
                }`}
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Info Modal */}
      {infoImage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setInfoImage(null)}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t('inference.details')}</h3>
              <button onClick={() => setInfoImage(null)} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors text-xl">×</button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              {infoImage.image_url && (
                <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 mb-4">
                  <img src={infoImage.image_url} alt="" className="w-full h-48 object-cover" />
                </div>
              )}
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t('inference.name')}</span><span className="text-slate-900 dark:text-white">{infoImage.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t('inference.greenhouse')}</span><span className="text-slate-900 dark:text-white">{infoImage.greenhouses ? `${infoImage.greenhouses.name}` : '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t('inference.captured')}</span><span className="text-slate-900 dark:text-white">{formatDate(infoImage.capture_timestamp)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t('inference.status')}</span><span className={`font-medium ${infoImage.status === 'processed' ? 'text-emerald-500 dark:text-emerald-400' : infoImage.status === 'failed' ? 'text-red-500 dark:text-red-400' : 'text-yellow-500 dark:text-yellow-400'}`}>{statusLabel(infoImage.status)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t('overview.detections')}</span><span className="text-emerald-600 dark:text-emerald-400 font-medium">{detectionCount(infoImage)}</span></div>
              {infoImage.temperature && <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t('inference.temperature')}</span><span className="text-slate-900 dark:text-white">{infoImage.temperature}°C</span></div>}
              {infoImage.humidity && <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">{t('inference.humidity')}</span><span className="text-slate-900 dark:text-white">{infoImage.humidity}%</span></div>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
