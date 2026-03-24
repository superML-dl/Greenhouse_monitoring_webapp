'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from '@/i18n/provider'

const SPECIES_COLORS = [
  '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#14b8a6',
]

interface SpeciesLine {
  name: string
  data: number[]
}

interface SpeciesTimeChartProps {
  data: {
    dates: string[]
    species: SpeciesLine[]
  }
}

interface TooltipInfo {
  x: number
  y: number
  date: string
  species: string
  count: number
  color: string
}

export function SpeciesTimeChart({ data }: SpeciesTimeChartProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredSpecies, setHoveredSpecies] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null)
  const pointsRef = useRef<{ x: number; y: number; species: string; dateIdx: number; color: string }[]>([])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const W = container.clientWidth
    const H = 320
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = W + 'px'
    canvas.style.height = H + 'px'
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)

    const { dates, species } = data

    if (dates.length === 0 || species.length === 0) {
      ctx.fillStyle = '#64748b'
      ctx.font = '14px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(t('chart.no_species_data'), W / 2, H / 2)
      return
    }

    const padding = { top: 40, right: 20, bottom: 55, left: 50 }
    const chartW = W - padding.left - padding.right
    const chartH = H - padding.top - padding.bottom

    const allValues = species.flatMap(s => s.data)
    const maxVal = Math.max(...allValues, 1)
    const yStep = Math.ceil(maxVal / 5)
    const yMax = yStep * 5

    // Title
    ctx.fillStyle = '#e2e8f0'
    ctx.font = 'bold 13px Inter, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(t('chart.species_detections_time'), padding.left, 22)

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

    // X labels
    const gap = dates.length > 1 ? chartW / (dates.length - 1) : chartW
    dates.forEach((date, i) => {
      const x = padding.left + (dates.length > 1 ? gap * i : chartW / 2)
      ctx.fillStyle = '#64748b'
      ctx.font = '10px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.save()
      ctx.translate(x, padding.top + chartH + 14)
      ctx.rotate(-Math.PI / 6)
      ctx.fillText(date, 0, 0)
      ctx.restore()
    })

    // Store all points for hover
    const allPoints: typeof pointsRef.current = []

    // Draw lines
    species.forEach((sp, spIdx) => {
      const color = SPECIES_COLORS[spIdx % SPECIES_COLORS.length]
      const isHovered = hoveredSpecies === sp.name
      const isDimmed = hoveredSpecies !== null && !isHovered

      ctx.beginPath()
      ctx.strokeStyle = isDimmed ? color + '30' : color
      ctx.lineWidth = isHovered ? 3 : 2
      ctx.lineJoin = 'round'

      sp.data.forEach((val, i) => {
        const x = padding.left + (dates.length > 1 ? gap * i : chartW / 2)
        const y = padding.top + chartH - (val / yMax) * chartH
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)

        allPoints.push({ x, y, species: sp.name, dateIdx: i, color })
      })
      ctx.stroke()

      // Dots
      sp.data.forEach((val, i) => {
        const x = padding.left + (dates.length > 1 ? gap * i : chartW / 2)
        const y = padding.top + chartH - (val / yMax) * chartH

        const isThisHovered = tooltip?.species === sp.name && tooltip?.date === dates[i]

        ctx.beginPath()
        ctx.arc(x, y, isThisHovered ? 6 : isHovered ? 4.5 : 3.5, 0, Math.PI * 2)
        ctx.fillStyle = isDimmed ? color + '30' : color
        ctx.fill()
        ctx.strokeStyle = '#0f172a'
        ctx.lineWidth = 1.5
        ctx.stroke()
      })
    })

    pointsRef.current = allPoints
  }, [data, hoveredSpecies, tooltip, t])

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

    let closest: { dist: number; point: typeof pointsRef.current[0] } | null = null
    for (const p of pointsRef.current) {
      const dist = Math.sqrt((p.x - mx) ** 2 + (p.y - my) ** 2)
      if (dist < 25 && (!closest || dist < closest.dist)) {
        closest = { dist, point: p }
      }
    }

    if (closest) {
      const p = closest.point
      const sp = data.species.find(s => s.name === p.species)
      const count = sp ? sp.data[p.dateIdx] : 0
      setTooltip({
        x: p.x,
        y: p.y,
        date: data.dates[p.dateIdx],
        species: p.species,
        count,
        color: p.color,
      })
    } else {
      setTooltip(null)
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      {/* Legend */}
      {data.species.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4 ml-12">
          {data.species.map((sp, idx) => (
            <button
              key={sp.name}
              onMouseEnter={() => setHoveredSpecies(sp.name)}
              onMouseLeave={() => setHoveredSpecies(null)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                hoveredSpecies === sp.name
                  ? 'bg-slate-700 text-white'
                  : hoveredSpecies !== null
                    ? 'opacity-40 text-slate-400'
                    : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: SPECIES_COLORS[idx % SPECIES_COLORS.length] }}
              />
              {sp.name}
            </button>
          ))}
        </div>
      )}

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
              top: tooltip.y - 75,
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tooltip.color }} />
              <span className="text-white font-semibold">{tooltip.species}</span>
            </div>
            <p className="text-slate-400">{tooltip.date}</p>
            <p className="font-bold mt-0.5" style={{ color: tooltip.color }}>
              {tooltip.count} {t('overview.detections')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
