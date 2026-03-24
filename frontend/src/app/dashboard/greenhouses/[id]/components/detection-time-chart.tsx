'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from '@/i18n/provider'

interface ChartDataPoint {
  date: string
  detections: number
  name: string
}

interface DetectionTimeChartProps {
  data: ChartDataPoint[]
}

interface TooltipInfo {
  x: number
  y: number
  date: string
  name: string
  detections: number
}

export function DetectionTimeChart({ data }: DetectionTimeChartProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)
  const pointsRef = useRef<{ x: number; y: number; idx: number }[]>([])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const W = container.clientWidth
    const H = 280
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = W + 'px'
    canvas.style.height = H + 'px'
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)

    // Title
    ctx.fillStyle = '#e2e8f0'
    ctx.font = 'bold 13px Inter, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(t('chart.total_detections_time'), 16, 22)

    if (data.length === 0) {
      ctx.fillStyle = '#64748b'
      ctx.font = '14px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(t('chart.no_data'), W / 2, H / 2)
      return
    }

    const padding = { top: 40, right: 20, bottom: 55, left: 50 }
    const chartW = W - padding.left - padding.right
    const chartH = H - padding.top - padding.bottom

    const maxVal = Math.max(...data.map(d => d.detections), 1)
    const yStep = Math.ceil(maxVal / 5)
    const yMax = yStep * 5

    // Grid
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + chartH - (i / 5) * chartH
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(W - padding.right, y)
      ctx.stroke()
      ctx.fillStyle = '#64748b'
      ctx.font = '11px Inter, system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(String(Math.round(yMax * (i / 5))), padding.left - 8, y + 4)
    }

    const gap = data.length > 1 ? chartW / (data.length - 1) : chartW
    const points: { x: number; y: number; idx: number }[] = []

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH)
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)')
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0)')

    ctx.beginPath()
    data.forEach((d, i) => {
      const x = padding.left + (data.length > 1 ? gap * i : chartW / 2)
      const y = padding.top + chartH - (d.detections / yMax) * chartH
      if (i === 0) { ctx.moveTo(x, padding.top + chartH); ctx.lineTo(x, y) }
      else ctx.lineTo(x, y)
    })
    const lastX = padding.left + (data.length > 1 ? gap * (data.length - 1) : chartW / 2)
    ctx.lineTo(lastX, padding.top + chartH)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // Line
    ctx.beginPath()
    ctx.strokeStyle = '#10b981'
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    data.forEach((d, i) => {
      const x = padding.left + (data.length > 1 ? gap * i : chartW / 2)
      const y = padding.top + chartH - (d.detections / yMax) * chartH
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
      points.push({ x, y, idx: i })
    })
    ctx.stroke()

    // Dots + X labels
    data.forEach((d, i) => {
      const x = padding.left + (data.length > 1 ? gap * i : chartW / 2)
      const y = padding.top + chartH - (d.detections / yMax) * chartH

      const isHovered = tooltip?.date === d.date && tooltip?.name === d.name

      ctx.beginPath()
      ctx.arc(x, y, isHovered ? 6 : 4, 0, Math.PI * 2)
      ctx.fillStyle = isHovered ? '#34d399' : '#10b981'
      ctx.fill()
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 2
      ctx.stroke()

      // X label
      ctx.fillStyle = '#64748b'
      ctx.font = '10px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.save()
      ctx.translate(x, padding.top + chartH + 14)
      ctx.rotate(-Math.PI / 6)
      ctx.fillText(d.date, 0, 0)
      ctx.restore()
    })

    pointsRef.current = points
  }, [data, tooltip, t])

  useEffect(() => { draw() }, [draw])
  useEffect(() => {
    const h = () => draw()
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [draw])

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    let closest: { dist: number; idx: number } | null = null
    for (const p of pointsRef.current) {
      const dist = Math.sqrt((p.x - mx) ** 2 + (p.y - my) ** 2)
      if (dist < 30 && (!closest || dist < closest.dist)) {
        closest = { dist, idx: p.idx }
      }
    }

    if (closest) {
      const d = data[closest.idx]
      const p = pointsRef.current[closest.idx]
      setTooltip({ x: p.x, y: p.y, date: d.date, name: d.name, detections: d.detections })
    } else {
      setTooltip(null)
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative">
      <div ref={containerRef} className="relative">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        />
        {tooltip && (
          <div
            className="absolute z-10 pointer-events-none bg-slate-800 border border-slate-600 rounded-lg shadow-xl px-3 py-2 text-xs"
            style={{
              left: Math.min(tooltip.x, (containerRef.current?.clientWidth || 300) - 160),
              top: tooltip.y - 70,
            }}
          >
            <p className="text-white font-semibold">{tooltip.name}</p>
            <p className="text-slate-400">{tooltip.date}</p>
            <p className="text-emerald-400 font-bold mt-0.5">
              {tooltip.detections} {t('overview.detections')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
