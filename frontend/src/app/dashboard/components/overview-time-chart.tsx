'use client'

import { useEffect, useRef } from 'react'
import { useTranslation } from '@/i18n/provider'

interface ChartDataPoint {
  date: string
  detections: number
}

interface OverviewTimeChartProps {
  data: ChartDataPoint[]
}

export function OverviewTimeChart({ data }: OverviewTimeChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { t } = useTranslation()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    const W = rect.width
    const H = rect.height

    ctx.clearRect(0, 0, W, H)

    // Title
    ctx.fillStyle = '#e2e8f0'
    ctx.font = 'bold 14px Inter, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(t('chart.detection_trend'), 16, 22)

    if (data.length === 0) {
      ctx.fillStyle = '#64748b'
      ctx.font = '14px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(t('chart.no_data'), W / 2, H / 2)
      return
    }

    const padding = { top: 40, right: 20, bottom: 50, left: 50 }
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

    const gap = chartW / data.length
    const barWidth = Math.min(50, gap * 0.5)

    // Gradient
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH)
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)')
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0)')

    // Area fill
    ctx.beginPath()
    ctx.moveTo(padding.left + gap * 0.5, padding.top + chartH)
    data.forEach((d, i) => {
      const x = padding.left + gap * i + gap * 0.5
      const y = padding.top + chartH - (d.detections / yMax) * chartH
      ctx.lineTo(x, y)
    })
    ctx.lineTo(padding.left + gap * (data.length - 1) + gap * 0.5, padding.top + chartH)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // Line
    ctx.beginPath()
    ctx.strokeStyle = '#10b981'
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    data.forEach((d, i) => {
      const x = padding.left + gap * i + gap * 0.5
      const y = padding.top + chartH - (d.detections / yMax) * chartH
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Bars + dots + labels
    data.forEach((d, i) => {
      const x = padding.left + gap * i + gap * 0.5
      const y = padding.top + chartH - (d.detections / yMax) * chartH
      const barH = (d.detections / yMax) * chartH

      // Bar
      ctx.fillStyle = 'rgba(16, 185, 129, 0.12)'
      ctx.fillRect(x - barWidth / 2, padding.top + chartH - barH, barWidth, barH)

      // Dot
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#10b981'
      ctx.fill()
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 2
      ctx.stroke()

      // Value
      ctx.fillStyle = '#e2e8f0'
      ctx.font = 'bold 11px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(String(d.detections), x, y - 12)

      // X label
      ctx.fillStyle = '#64748b'
      ctx.font = '10px Inter, system-ui, sans-serif'
      ctx.save()
      ctx.translate(x, padding.top + chartH + 14)
      ctx.rotate(-Math.PI / 6)
      ctx.fillText(d.date, 0, 0)
      ctx.restore()
    })

  }, [data, t])

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: '320px' }}
      />
    </div>
  )
}
