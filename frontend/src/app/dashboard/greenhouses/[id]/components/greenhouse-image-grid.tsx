'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDateShort } from '@/lib/date-format'
import { ImageViewer } from '@/app/dashboard/inference/components/image-viewer'
import { useTranslation } from '@/i18n/provider'

const PER_PAGE = 6

interface GreenhouseImageGridProps {
  images: any[]
}

export function GreenhouseImageGrid({ images }: GreenhouseImageGridProps) {
  const { t } = useTranslation()
  const [viewingImage, setViewingImage] = useState<any>(null)
  const [page, setPage] = useState(1)

  const totalPages = Math.ceil(images.length / PER_PAGE)
  const start = (page - 1) * PER_PAGE
  const pageImages = images.slice(start, start + PER_PAGE)

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pageImages.map((img: any) => (
          <button
            key={img.id}
            onClick={() => setViewingImage(img)}
            className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all text-left group"
          >
            <div className="h-40 bg-slate-800 flex items-center justify-center relative overflow-hidden">
              {img.image_url ? (
                <img src={img.image_url} alt={img.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <span className="text-slate-500 text-sm">{t('inference.no_uploads')}</span>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 px-3 py-1.5 rounded-full">
                  {t('greenhouse.view_detections')}
                </span>
              </div>
            </div>
            <div className="p-4">
              <h4 className="text-sm font-medium text-white truncate">{img.name || t('inference.untitled')}</h4>
              <div className="flex justify-between mt-2 text-xs text-slate-400">
                <span>{formatDateShort(img.capture_timestamp)}</span>
                <span className={`font-medium ${(img.insect_detections?.[0]?.count || 0) > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {img.insect_detections?.[0]?.count || 0} {t('overview.detections')}
                </span>
              </div>
              {(img.temperature || img.humidity) && (
                <div className="flex gap-3 mt-1.5 text-xs text-slate-500">
                  {img.temperature && <span>🌡 {img.temperature}°C</span>}
                  {img.humidity && <span>💧 {img.humidity}%</span>}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-slate-500">
            {t('inference.showing')} {start + 1}–{Math.min(start + PER_PAGE, images.length)} {t('inference.of')} {images.length} {t('inference.images')}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={`p-1.5 rounded-md transition-colors ${page > 1 ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-600 cursor-not-allowed'}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`min-w-[32px] h-8 flex items-center justify-center rounded-md text-xs font-medium transition-colors ${p === page
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={`p-1.5 rounded-md transition-colors ${page < totalPages ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-600 cursor-not-allowed'}`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Image Viewer with Bounding Boxes */}
      {viewingImage && (
        <ImageViewer
          image={viewingImage}
          onClose={() => setViewingImage(null)}
        />
      )}
    </>
  )
}
