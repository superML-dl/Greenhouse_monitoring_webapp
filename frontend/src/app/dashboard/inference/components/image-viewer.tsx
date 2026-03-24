'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ZoomIn, ZoomOut, RotateCcw, Eye, EyeOff, Thermometer, Droplets } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/date-format'
import { getTrapImageDetails } from '../actions'
import { useTranslation } from '@/i18n/provider'

interface ImageViewerProps {
  image: any
  onClose: () => void
}

interface Detection {
  id: string
  species_name: string
  confidence: number
  bbox_x: number
  bbox_y: number
  bbox_w: number
  bbox_h: number
}

const SPECIES_COLORS: Record<string, string> = {}
const COLOR_PALETTE = [
  '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#14b8a6',
]

function getSpeciesColor(name: string): string {
  if (!SPECIES_COLORS[name]) {
    const idx = Object.keys(SPECIES_COLORS).length % COLOR_PALETTE.length
    SPECIES_COLORS[name] = COLOR_PALETTE[idx]
  }
  return SPECIES_COLORS[name]
}

export function ImageViewer({ image, onClose }: ImageViewerProps) {
  const { t } = useTranslation()
  const [detections, setDetections] = useState<Detection[]>([])
  const [loading, setLoading] = useState(true)
  const [showBboxes, setShowBboxes] = useState(true)
  const [confidenceThreshold, setConfidenceThreshold] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Load detections
  useEffect(() => {
    async function load() {
      setLoading(true)
      const result = await getTrapImageDetails(image.id)
      setDetections(result.detections || [])
      setLoading(false)
    }
    load()
  }, [image.id])

  // Draw canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !img.complete) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const container = containerRef.current
    if (!container) return

    canvas.width = container.clientWidth
    canvas.height = container.clientHeight

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()

    // Apply zoom and pan
    const scale = zoom
    const imgAspect = img.naturalWidth / img.naturalHeight
    const canvasAspect = canvas.width / canvas.height

    let drawW: number, drawH: number
    if (imgAspect > canvasAspect) {
      drawW = canvas.width * scale
      drawH = (canvas.width / imgAspect) * scale
    } else {
      drawH = canvas.height * scale
      drawW = (canvas.height * imgAspect) * scale
    }

    const drawX = (canvas.width - drawW) / 2 + pan.x
    const drawY = (canvas.height - drawH) / 2 + pan.y

    // Draw image
    ctx.drawImage(img, drawX, drawY, drawW, drawH)

    // Draw bounding boxes
    if (showBboxes) {
      const scaleX = drawW / img.naturalWidth
      const scaleY = drawH / img.naturalHeight

      const filtered = detections.filter((d) => d.confidence >= confidenceThreshold)

      for (const det of filtered) {
        const color = getSpeciesColor(det.species_name)
        const bx = drawX + det.bbox_x * scaleX
        const by = drawY + det.bbox_y * scaleY
        const bw = det.bbox_w * scaleX
        const bh = det.bbox_h * scaleY

        // Box
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.strokeRect(bx, by, bw, bh)

        // Label background
        const label = `${det.species_name} ${(det.confidence * 100).toFixed(0)}%`
        ctx.font = '12px Inter, system-ui, sans-serif'
        const textWidth = ctx.measureText(label).width
        ctx.fillStyle = color
        ctx.fillRect(bx, by - 18, textWidth + 8, 18)

        // Label text
        ctx.fillStyle = '#000'
        ctx.fillText(label, bx + 4, by - 5)
      }
    }

    ctx.restore()
  }, [detections, showBboxes, confidenceThreshold, zoom, pan])

  // Load image and draw
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      drawCanvas()
    }
    img.src = image.image_url
  }, [image.image_url, drawCanvas])

  // Redraw on state changes
  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  // Redraw on resize
  useEffect(() => {
    const handleResize = () => drawCanvas()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [drawCanvas])

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom((prev) => Math.max(0.5, Math.min(5, prev + delta)))
  }

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true)
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
  }
  const handleMouseUp = () => setIsPanning(false)

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const filteredDetections = detections.filter((d) => d.confidence >= confidenceThreshold)

  // Species summary
  const speciesSummary: Record<string, number> = {}
  for (const d of filteredDetections) {
    speciesSummary[d.species_name] = (speciesSummary[d.species_name] || 0) + 1
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex">
      {/* Main canvas area */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="h-14 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between px-4">
          <h3 className="text-sm font-medium text-white truncate max-w-[400px]">{image.name}</h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.min(5, z + 0.25))} title={t('inference.zoom_in')}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <span className="text-xs text-slate-400 min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} title={t('inference.zoom_out')}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={resetView} title={t('inference.reset_view')}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-slate-700 mx-1" />
            <Button
              variant={showBboxes ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setShowBboxes(!showBboxes)}
              className="gap-1.5"
            >
              {showBboxes ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {t('inference.bbox')}
            </Button>
            <div className="w-px h-6 bg-slate-700 mx-1" />
            <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing bg-slate-950"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>
      </div>

      {/* Right sidebar - Details panel */}
      <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col overflow-y-auto">
        {/* Image Info */}
        <div className="p-4 border-b border-slate-800">
          <h4 className="text-sm font-semibold text-white mb-3">{t('inference.details')}</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">{t('inference.greenhouse')}</span>
              <span className="text-white">{image.greenhouses ? `${image.greenhouses.name}` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t('inference.captured')}</span>
              <span className="text-white">{formatDate(image.capture_timestamp)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t('inference.status')}</span>
              <span className={`font-medium ${image.status === 'processed' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {t(`inference.status_${image.status}`)}
              </span>
            </div>
            {image.temperature && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center gap-1"><Thermometer className="h-3 w-3" /> {t('inference.temperature')}</span>
                <span className="text-white">{image.temperature}°C</span>
              </div>
            )}
            {image.humidity && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center gap-1"><Droplets className="h-3 w-3" /> {t('inference.humidity')}</span>
                <span className="text-white">{image.humidity}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Confidence Slider */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-white">{t('inference.confidence_threshold')}</span>
            <span className="text-xs font-mono text-emerald-400">{Math.round(confidenceThreshold * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={confidenceThreshold}
            onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Detection Summary */}
        <div className="p-4 border-b border-slate-800">
          <h4 className="text-sm font-semibold text-white mb-3">
            {t('overview.detections')} ({filteredDetections.length})
          </h4>
          {loading ? (
            <p className="text-sm text-slate-500">{t('common.loading')}</p>
          ) : filteredDetections.length === 0 ? (
            <p className="text-sm text-slate-500">{t('inference.no_detections_threshold')}</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(speciesSummary).map(([species, count]) => (
                <div key={species} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getSpeciesColor(species) }}
                    />
                    <span className="text-sm text-slate-300">{species}</span>
                  </div>
                  <span className="text-sm font-bold text-white">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Individual detections list */}
        {!loading && filteredDetections.length > 0 && (
          <div className="p-4 flex-1 overflow-y-auto">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('inference.all_detections')}</h4>
            <div className="space-y-1.5">
              {filteredDetections.map((det, i) => (
                <div key={det.id || i} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-slate-800/50 text-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getSpeciesColor(det.species_name) }}
                    />
                    <span className="text-slate-300">{det.species_name}</span>
                  </div>
                  <span className="text-slate-500 font-mono">{(det.confidence * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
