'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

export interface VisualDetection {
  species_name: string
  confidence: number
  bbox_x: number
  bbox_y: number
  bbox_w: number
  bbox_h: number
}

export interface VisualScanStep {
  window_id: number
  bbox_x: number
  bbox_y: number
  bbox_w: number
  bbox_h: number
}

export interface VisualValidSlice {
  slice_id: number
  bbox_x: number
  bbox_y: number
  bbox_w: number
  bbox_h: number
  pseudo_intersection_count: number
  pseudo_inside_count: number
  total_detections: number
  detections: VisualDetection[]
  image_data_url: string
}

export interface VisualSlicingDebug {
  annotation_source?: string
  using_supabase_map?: boolean
  scan_order?: string
  window_size?: number
  window_stride?: number
  annotation_count?: number
  trap_image_id?: string | null
  total_windows?: number
  windows_scanned?: number
  windows_with_intersection?: number
  windows_saved?: number
  total_annotations?: number
  intersection_checks?: number
  intersections_matched?: number
  containment_checks?: number
  fully_contained?: number
  partial_masks_applied?: number
  claimed_annotations?: number
  unclaimed_annotations?: number
  coverage_ratio?: number
  early_stop_all_claimed?: boolean
  unclaimed_indices_sample?: number[]
}

export interface InferenceVisualData {
  originalImageUrl: string
  hsvImageUrl: string | null
  preprocessedImageUrl: string
  maskImageUrl: string | null
  boxedImageUrl: string | null
  originalImageWidth: number
  originalImageHeight: number
  preprocessedImageWidth: number
  preprocessedImageHeight: number
  windowsScanned: number
  patchesProcessed: number
  preprocess: {
    contourFound: boolean
    cropBoxOriginal: {
      x: number
      y: number
      w: number
      h: number
    }
  } | null
  stage1Detections: VisualDetection[]
  stage2DetectionsPreprocessed: VisualDetection[]
  stage2DetectionsOriginal: VisualDetection[]
  stage2ScanPath: VisualScanStep[]
  stage2ValidSlices: VisualValidSlice[]
  stage2SlicingDebug: VisualSlicingDebug | null
}

type VisualizerStatus = 'running' | 'done' | 'error'
type StepId = 'preprocess' | 'pseudo' | 'slicing' | 'results'
type PreprocessPhase = 'original' | 'hsv' | 'mask' | 'contour' | 'crop' | 'done'

type CompletedSteps = {
  preprocess: boolean
  pseudo: boolean
  slicing: boolean
  results: boolean
}

const STEP_ORDER: StepId[] = ['preprocess', 'pseudo', 'slicing', 'results']
const STEP_ADVANCE_DELAY_MS = 1600
const STEP_SCROLL_SETTLE_MS = 650
const PREPROCESS_STAGE_MS = 850
const SLICING_END_HOLD_MS = 1200

interface CanvasPlacement {
  x: number
  y: number
  w: number
  h: number
}

function getSpeciesColor(species: string) {
  const palette = ['#22c55e', '#f59e0b', '#ef4444', '#0ea5e9', '#a855f7', '#f97316', '#14b8a6']
  let hash = 0
  for (let i = 0; i < species.length; i++) {
    hash = (hash << 5) - hash + species.charCodeAt(i)
    hash |= 0
  }
  return palette[Math.abs(hash) % palette.length]
}

function getContainPlacement(canvasW: number, canvasH: number, imageW: number, imageH: number): CanvasPlacement {
  const canvasRatio = canvasW / canvasH
  const imageRatio = imageW / imageH

  if (imageRatio > canvasRatio) {
    const drawW = canvasW
    const drawH = drawW / imageRatio
    return {
      x: 0,
      y: (canvasH - drawH) / 2,
      w: drawW,
      h: drawH,
    }
  }

  const drawH = canvasH
  const drawW = drawH * imageRatio
  return {
    x: (canvasW - drawW) / 2,
    y: 0,
    w: drawW,
    h: drawH,
  }
}

function drawBaseImage(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  imageW: number,
  imageH: number,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const rect = canvas.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#020617'
  ctx.fillRect(0, 0, width, height)

  const placement = getContainPlacement(width, height, imageW, imageH)
  ctx.drawImage(image, placement.x, placement.y, placement.w, placement.h)
  return { ctx, placement }
}

function drawDetections(
  ctx: CanvasRenderingContext2D,
  detections: VisualDetection[],
  placement: CanvasPlacement,
  imageW: number,
  imageH: number,
  showLabel: boolean,
) {
  for (const det of detections) {
    const x = placement.x + (det.bbox_x / imageW) * placement.w
    const y = placement.y + (det.bbox_y / imageH) * placement.h
    const w = (det.bbox_w / imageW) * placement.w
    const h = (det.bbox_h / imageH) * placement.h
    const color = getSpeciesColor(det.species_name)

    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, w, h)

    if (showLabel) {
      const label = `${det.species_name} ${(det.confidence * 100).toFixed(0)}%`
      ctx.font = '12px sans-serif'
      const textWidth = ctx.measureText(label).width + 8
      const labelX = x
      const labelY = Math.max(0, y - 18)
      ctx.fillStyle = color
      ctx.fillRect(labelX, labelY, textWidth, 18)
      ctx.fillStyle = '#020617'
      ctx.fillText(label, labelX + 4, labelY + 13)
    }

    ctx.restore()
  }
}

export function InferenceVisualizer({
  data,
  status,
}: {
  data: InferenceVisualData | null
  status: VisualizerStatus
}) {
  const [activeStep, setActiveStep] = useState<StepId>('preprocess')
  const [completed, setCompleted] = useState<CompletedSteps>({
    preprocess: false,
    pseudo: false,
    slicing: false,
    results: false,
  })

  const [slicingWindowIndex, setSlicingWindowIndex] = useState(0)
  const [slicingPlaybackDone, setSlicingPlaybackDone] = useState(false)
  const [visibleResultDetections, setVisibleResultDetections] = useState(0)

  const [originalLoaded, setOriginalLoaded] = useState(false)
  const [preprocessedLoaded, setPreprocessedLoaded] = useState(false)
  const [preprocessPhase, setPreprocessPhase] = useState<PreprocessPhase>('original')
  const [pseudoRendered, setPseudoRendered] = useState(false)
  const [resultsRendered, setResultsRendered] = useState(false)
  const [revealedSteps, setRevealedSteps] = useState<CompletedSteps>({
    preprocess: true,
    pseudo: false,
    slicing: false,
    results: false,
  })

  const [revealedSlices, setRevealedSlices] = useState<VisualValidSlice[]>([])

  const originalImageRef = useRef<HTMLImageElement | null>(null)
  const preprocessedImageRef = useRef<HTMLImageElement | null>(null)
  const appendedSliceIdsRef = useRef<Set<number>>(new Set())

  const pseudoCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const slicingCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const resultCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const stepRefs = useRef(new Map<StepId, HTMLElement>())
  const [imageTick, setImageTick] = useState(0)

  const slidingWindows = useMemo(() => {
    if (!data) return [] as VisualScanStep[]
    return data.stage2ScanPath || []
  }, [data])

  const validSliceByCoord = useMemo(() => {
    const byCoord = new Map<string, VisualValidSlice>()
    for (const valid of data?.stage2ValidSlices || []) {
      byCoord.set(`${Math.round(valid.bbox_x)}:${Math.round(valid.bbox_y)}`, valid)
    }
    return byCoord
  }, [data])

  const currentWindow = useMemo(() => {
    if (slidingWindows.length === 0) return null
    const idx = Math.min(slicingWindowIndex, slidingWindows.length - 1)
    return slidingWindows[idx]
  }, [slidingWindows, slicingWindowIndex])

  const slicingDurationMs = useMemo(() => {
    const total = Math.max(1, slidingWindows.length)
    return Math.min(90000, Math.max(18000, total * 260))
  }, [slidingWindows.length])

  const backendReady = Boolean(data?.preprocess)
  const preprocessReady = backendReady && preprocessedLoaded
  const pseudoReady = backendReady && preprocessedLoaded
  const slicingReady = backendReady && preprocessedLoaded
  const resultsReady = backendReady && originalLoaded
  const activeStepRevealed = revealedSteps[activeStep]

  const preprocessRendered = preprocessReady && preprocessPhase === 'done'
  const slicingRendered = slicingPlaybackDone

  const hasEntered = useCallback((step: StepId) => {
    const activeIndex = STEP_ORDER.indexOf(activeStep)
    const stepIndex = STEP_ORDER.indexOf(step)
    return activeIndex >= stepIndex || completed[step]
  }, [activeStep, completed])

  useEffect(() => {
    if (!data) return

    let alive = true
    let loaded = 0

    setOriginalLoaded(false)
    setPreprocessedLoaded(false)

    const originalImg = new Image()
    const preprocessImg = new Image()

    const markLoaded = () => {
      loaded += 1
      if (loaded === 2 && alive) {
        originalImageRef.current = originalImg
        preprocessedImageRef.current = preprocessImg
        setOriginalLoaded(true)
        setPreprocessedLoaded(true)
        setImageTick((v) => v + 1)
      }
    }

    originalImg.onload = markLoaded
    preprocessImg.onload = markLoaded

    originalImg.src = data.originalImageUrl
    preprocessImg.src = data.preprocessedImageUrl || data.originalImageUrl

    return () => {
      alive = false
    }
  }, [data?.originalImageUrl, data?.preprocessedImageUrl, data])

  useEffect(() => {
    if (!data) return
    setActiveStep('preprocess')
    setCompleted({
      preprocess: false,
      pseudo: false,
      slicing: false,
      results: false,
    })
    setSlicingWindowIndex(0)
    setSlicingPlaybackDone(false)
    setVisibleResultDetections(0)
    setPreprocessPhase('original')
    setPseudoRendered(false)
    setResultsRendered(false)
    setRevealedSteps({
      preprocess: true,
      pseudo: false,
      slicing: false,
      results: false,
    })
    setRevealedSlices([])
    appendedSliceIdsRef.current = new Set()
  }, [data])

  useEffect(() => {
    const el = stepRefs.current.get(activeStep)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeStep])

  useEffect(() => {
    if (activeStepRevealed) return

    const timer = window.setTimeout(() => {
      setRevealedSteps((prev) => ({ ...prev, [activeStep]: true }))
    }, STEP_SCROLL_SETTLE_MS)

    return () => clearTimeout(timer)
  }, [activeStep, activeStepRevealed])

  useEffect(() => {
    if (activeStep !== 'preprocess' || !revealedSteps.preprocess) return
    if (!preprocessReady) return

    setPreprocessPhase('original')

    const hsvTimer = window.setTimeout(() => {
      setPreprocessPhase('hsv')
    }, PREPROCESS_STAGE_MS)

    const maskTimer = window.setTimeout(() => {
      setPreprocessPhase('mask')
    }, PREPROCESS_STAGE_MS * 2)

    const contourTimer = window.setTimeout(() => {
      setPreprocessPhase('contour')
    }, PREPROCESS_STAGE_MS * 3)

    const cropTimer = window.setTimeout(() => {
      setPreprocessPhase('crop')
    }, PREPROCESS_STAGE_MS * 4)

    const doneTimer = window.setTimeout(() => {
      setPreprocessPhase('done')
    }, PREPROCESS_STAGE_MS * 5)

    return () => {
      clearTimeout(hsvTimer)
      clearTimeout(maskTimer)
      clearTimeout(contourTimer)
      clearTimeout(cropTimer)
      clearTimeout(doneTimer)
    }
  }, [activeStep, preprocessReady, revealedSteps.preprocess])

  useEffect(() => {
    if (activeStep !== 'preprocess' || completed.preprocess) return
    if (!preprocessRendered || !revealedSteps.preprocess) return

    const timer = window.setTimeout(() => {
      setCompleted((prev) => ({ ...prev, preprocess: true }))
      setRevealedSteps((prev) => ({ ...prev, pseudo: false }))
      setActiveStep('pseudo')
    }, STEP_ADVANCE_DELAY_MS)

    return () => clearTimeout(timer)
  }, [activeStep, completed.preprocess, preprocessRendered, revealedSteps.preprocess])

  useEffect(() => {
    if (activeStep !== 'pseudo' || completed.pseudo) return
    if (!pseudoReady || !pseudoRendered || !revealedSteps.pseudo) return

    const timer = window.setTimeout(() => {
      setCompleted((prev) => ({ ...prev, pseudo: true }))
      setRevealedSteps((prev) => ({ ...prev, slicing: false }))
      setActiveStep('slicing')
    }, STEP_ADVANCE_DELAY_MS)

    return () => clearTimeout(timer)
  }, [activeStep, completed.pseudo, pseudoReady, pseudoRendered, revealedSteps.pseudo])

  useEffect(() => {
    if (activeStep !== 'slicing' || completed.slicing) return
    if (!slicingReady || !slicingRendered || !revealedSteps.slicing) return

    const timer = window.setTimeout(() => {
      setCompleted((prev) => ({ ...prev, slicing: true }))
      setRevealedSteps((prev) => ({ ...prev, results: false }))
      setActiveStep('results')
    }, STEP_ADVANCE_DELAY_MS)

    return () => clearTimeout(timer)
  }, [activeStep, completed.slicing, slicingReady, slicingRendered, revealedSteps.slicing])

  useEffect(() => {
    if (activeStep !== 'results' || completed.results) return
    if (!resultsReady || !resultsRendered || !revealedSteps.results) return

    const timer = window.setTimeout(() => {
      setCompleted((prev) => ({ ...prev, results: true }))
    }, 900)

    return () => clearTimeout(timer)
  }, [activeStep, completed.results, resultsReady, resultsRendered, revealedSteps.results])

  useEffect(() => {
    const pseudoCanvas = pseudoCanvasRef.current
    const preImg = preprocessedImageRef.current
    if (!pseudoCanvas || !preImg || !data) return
    if (!hasEntered('pseudo') || !revealedSteps.pseudo || !pseudoReady) return

    const imageW = data.preprocessedImageWidth || preImg.naturalWidth
    const imageH = data.preprocessedImageHeight || preImg.naturalHeight
    const drawn = drawBaseImage(pseudoCanvas, preImg, imageW, imageH)
    if (!drawn) return

    drawDetections(drawn.ctx, data.stage1Detections, drawn.placement, imageW, imageH, true)
    setPseudoRendered(true)
  }, [data, imageTick, pseudoReady, revealedSteps.pseudo, hasEntered])

  useEffect(() => {
    if (activeStep !== 'slicing' || !slicingReady || !revealedSteps.slicing) return

    appendedSliceIdsRef.current = new Set()
    setRevealedSlices([])
    setSlicingWindowIndex(0)
    setSlicingPlaybackDone(false)

    if (slidingWindows.length === 0) {
      setSlicingPlaybackDone(true)
      return
    }

    const stepMs = Math.max(220, Math.floor(slicingDurationMs / slidingWindows.length))

    const timer = window.setInterval(() => {
      setSlicingWindowIndex((prev) => {
        const next = prev + 1
        if (next >= slidingWindows.length) {
          clearInterval(timer)
          window.setTimeout(() => setSlicingPlaybackDone(true), SLICING_END_HOLD_MS)
          return slidingWindows.length - 1
        }
        return next
      })
    }, stepMs)

    return () => clearInterval(timer)
  }, [activeStep, slicingReady, slicingDurationMs, slidingWindows.length, revealedSteps.slicing])

  useEffect(() => {
    const slicingCanvas = slicingCanvasRef.current
    const preImg = preprocessedImageRef.current
    if (!slicingCanvas || !preImg || !data) return
    if (!hasEntered('slicing') || !slicingReady || !revealedSteps.slicing) return

    const imageW = data.preprocessedImageWidth || preImg.naturalWidth
    const imageH = data.preprocessedImageHeight || preImg.naturalHeight
    const drawn = drawBaseImage(slicingCanvas, preImg, imageW, imageH)
    if (!drawn) return

    if (!currentWindow) return

    const x = drawn.placement.x + (currentWindow.bbox_x / imageW) * drawn.placement.w
    const y = drawn.placement.y + (currentWindow.bbox_y / imageH) * drawn.placement.h
    const w = (currentWindow.bbox_w / imageW) * drawn.placement.w
    const h = (currentWindow.bbox_h / imageH) * drawn.placement.h

    drawn.ctx.save()
    drawn.ctx.strokeStyle = '#22d3ee'
    drawn.ctx.lineWidth = 2
    drawn.ctx.strokeRect(x, y, w, h)
    drawn.ctx.fillStyle = 'rgba(34, 211, 238, 0.15)'
    drawn.ctx.fillRect(x, y, w, h)
    drawn.ctx.restore()
  }, [data, imageTick, currentWindow, slicingReady, revealedSteps.slicing, hasEntered])

  useEffect(() => {
    if (activeStep !== 'slicing' || !revealedSteps.slicing || !slicingReady) return
    if (!currentWindow) return

    const coordKey = `${Math.round(currentWindow.bbox_x)}:${Math.round(currentWindow.bbox_y)}`
    const backendSlice = validSliceByCoord.get(coordKey)
    if (!backendSlice) return
    if (appendedSliceIdsRef.current.has(backendSlice.slice_id)) return

    appendedSliceIdsRef.current.add(backendSlice.slice_id)
    setRevealedSlices((prev) => [...prev, backendSlice])
  }, [activeStep, revealedSteps.slicing, slicingReady, currentWindow, validSliceByCoord])

  useEffect(() => {
    if (activeStep !== 'results' || !resultsReady || !revealedSteps.results) return

    const detections = data?.stage2DetectionsOriginal || []
    setVisibleResultDetections(0)
    setResultsRendered(false)

    if (detections.length === 0) {
      setResultsRendered(true)
      return
    }

    const stepMs = Math.max(70, Math.floor(1400 / detections.length))
    const timer = window.setInterval(() => {
      setVisibleResultDetections((prev) => {
        const next = prev + 1
        if (next >= detections.length) {
          clearInterval(timer)
          setResultsRendered(true)
          return detections.length
        }
        return next
      })
    }, stepMs)

    return () => clearInterval(timer)
  }, [activeStep, resultsReady, data, revealedSteps.results])

  useEffect(() => {
    const resultCanvas = resultCanvasRef.current
    const orgImg = originalImageRef.current
    if (!resultCanvas || !orgImg || !data) return
    if (!hasEntered('results') || !resultsReady || !revealedSteps.results) return

    const imageW = data.originalImageWidth || orgImg.naturalWidth
    const imageH = data.originalImageHeight || orgImg.naturalHeight
    const drawn = drawBaseImage(resultCanvas, orgImg, imageW, imageH)
    if (!drawn) return

    const visible = data.stage2DetectionsOriginal.slice(0, visibleResultDetections)
    drawDetections(drawn.ctx, visible, drawn.placement, imageW, imageH, true)
  }, [data, imageTick, visibleResultDetections, resultsReady, revealedSteps.results, hasEntered])

  useEffect(() => {
    const onResize = () => setImageTick((v) => v + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (!data) return null

  const stepWidth = Math.max(360, data.originalImageWidth || 960)
  const stepStyle = { width: `${stepWidth}px`, maxWidth: '100%' }
  const preprocessOriginalUrl = data.originalImageUrl
  const preprocessHsvUrl = data.hsvImageUrl || data.originalImageUrl
  const preprocessMaskUrl = data.maskImageUrl || data.preprocessedImageUrl || data.originalImageUrl
  const preprocessBoxedUrl = data.boxedImageUrl || data.originalImageUrl
  const preprocessCropUrl = data.preprocessedImageUrl || data.originalImageUrl
  const preprocessSequence: Array<{ id: Exclude<PreprocessPhase, 'done'>; title: string; url: string }> = [
    { id: 'original', title: '1) Original Image (RGB/BGR)', url: preprocessOriginalUrl },
    { id: 'hsv', title: '2) HSV Color Space Conversion', url: preprocessHsvUrl },
    { id: 'mask', title: '3) Binary Mask (Yellow Threshold)', url: preprocessMaskUrl },
    { id: 'contour', title: '4) Largest Contour Selection', url: preprocessBoxedUrl },
    { id: 'crop', title: '5) Final Cropped Image', url: preprocessCropUrl },
  ]
  const preprocessOrder: PreprocessPhase[] = ['original', 'hsv', 'mask', 'contour', 'crop', 'done']
  const preprocessStageIndex = preprocessOrder.indexOf(preprocessPhase)
  const slicingDebug = data.stage2SlicingDebug
  const coveragePercent = typeof slicingDebug?.coverage_ratio === 'number'
    ? `${(slicingDebug.coverage_ratio * 100).toFixed(1)}%`
    : 'n/a'
  const claimedCount = slicingDebug?.claimed_annotations ?? 0
  const totalAnnotations = slicingDebug?.total_annotations ?? 0
  const unclaimedCount = slicingDebug?.unclaimed_annotations ?? 0
  const annotationSource = slicingDebug?.annotation_source || 'n/a'

  const setStepRef = (step: StepId, node: HTMLElement | null) => {
    if (node) {
      stepRefs.current.set(step, node)
    } else {
      stepRefs.current.delete(step)
    }
  }

  const getStepBadge = (step: StepId, ready: boolean, rendered: boolean) => {
    if (step === 'results' && status === 'error') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-300">
          <AlertCircle className="h-3.5 w-3.5" /> Error
        </span>
      )
    }

    if (completed[step]) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" /> Complete
        </span>
      )
    }

    if (activeStep === step) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 text-xs text-amber-600 dark:text-amber-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {ready && rendered ? 'Finalizing...' : 'Waiting...'}
        </span>
      )
    }

    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-2.5 py-1 text-xs text-slate-500 dark:text-slate-300">
        Waiting
      </span>
    )
  }

  return (
    <div className="space-y-8">
      <section
        ref={(n) => setStepRef('preprocess', n)}
        style={stepStyle}
        className="mx-auto h-screen rounded-xl border border-slate-200 dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] p-4 shadow-sm"
      >
        <div className="h-full overflow-hidden">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Step 1: Preprocessing</h3>
            {getStepBadge('preprocess', preprocessReady, preprocessRendered)}
          </div>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Render the full preprocessing chain: RGB/BGR {'->'} HSV {'->'} binary mask {'->'} largest contour {'->'} final crop.
          </p>

          <div className="h-[calc(100%-88px)] overflow-y-auto rounded-lg border border-slate-200 dark:border-[var(--app-border)] bg-slate-50 dark:bg-black p-2">
            {!preprocessReady ? (
              <div className="flex h-full items-center justify-center text-amber-600 dark:text-amber-300">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Waiting for preprocessing data...
              </div>
            ) : (
              <div className="grid h-full grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
                {preprocessSequence.map((stage, idx) => {
                  const stageVisible = preprocessStageIndex >= idx
                  const stageActive = preprocessPhase === stage.id
                  return (
                    <div
                      key={stage.id}
                      className={`overflow-hidden rounded-md border bg-white dark:bg-slate-950 transition-opacity ${stageActive
                        ? 'border-cyan-400/60 shadow-md'
                        : stageVisible
                          ? 'border-emerald-500/40'
                          : 'border-slate-200 dark:border-slate-700 opacity-55'
                        }`}
                    >
                      <p className="border-b border-slate-100 dark:border-slate-700 px-2 py-1 text-xs text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-transparent">{stage.title}</p>
                      <div className="h-[190px] w-full bg-slate-100/50 dark:bg-transparent">
                        {stageVisible ? (
                          <img src={stage.url} alt={stage.title} className="h-full w-full object-contain" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-slate-400">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Waiting for stage playback...
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 p-2 text-xs text-slate-600 dark:text-slate-300 lg:col-span-2 xl:col-span-3">
                  Current stage: {preprocessPhase === 'done' ? 'completed' : preprocessPhase}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        ref={(n) => setStepRef('pseudo', n)}
        style={stepStyle}
        className="mx-auto h-screen rounded-xl border border-slate-200 dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] p-4 shadow-sm"
      >
        <div className="h-full overflow-hidden">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Step 2: Model Inference (running best_full.pt to generate pseudo-labels)
            </h3>
            {getStepBadge('pseudo', pseudoReady, pseudoRendered)}
          </div>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Render pseudo-label detections only after stage data is available.
          </p>
          <div className="h-[calc(100%-110px)] overflow-hidden rounded-lg border border-slate-200 dark:border-[var(--app-border)] bg-slate-50 dark:bg-black">
            {!revealedSteps.pseudo ? (
              <div className="flex h-full items-center justify-center text-slate-300">
                Waiting for step transition playback...
              </div>
            ) : !pseudoReady ? (
              <div className="flex h-full items-center justify-center text-amber-600 dark:text-amber-300">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Waiting for pseudo-label data...
              </div>
            ) : (
              <canvas ref={pseudoCanvasRef} className="h-full w-full" />
            )}
          </div>
        </div>
      </section>

      <section
        ref={(n) => setStepRef('slicing', n)}
        style={stepStyle}
        className="mx-auto min-h-screen rounded-xl border border-slate-200 dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] p-4 shadow-sm"
      >
        <div className="space-y-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Step 3: Window Slider Algorithm</h3>
            {getStepBadge('slicing', slicingReady, slicingRendered)}
          </div>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Animate a full 300x300 row-by-row grid traversal (including empty spaces) and reveal only backend-generated valid 640x640 slices when coordinates match.
          </p>

          {slicingDebug && (
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 dark:border-[var(--app-border)] bg-slate-50 dark:bg-[var(--app-surface-2)] p-3 text-xs text-slate-500 dark:text-slate-400 md:grid-cols-3">
              <div>Source: <span className="font-semibold text-slate-900 dark:text-white">{annotationSource}</span></div>
              <div>Supabase map: <span className="font-semibold text-slate-900 dark:text-white">{slicingDebug.using_supabase_map ? 'yes' : 'no'}</span></div>
              <div>Coverage: <span className="font-semibold text-slate-900 dark:text-white">{coveragePercent}</span> ({claimedCount}/{totalAnnotations})</div>
              <div>Unclaimed: <span className="font-semibold text-slate-900 dark:text-white">{unclaimedCount}</span></div>
              <div>Window: <span className="font-semibold text-slate-900 dark:text-white">{slicingDebug.window_size ?? 300}px</span></div>
              <div>Stride: <span className="font-semibold text-slate-900 dark:text-white">{slicingDebug.window_stride ?? 'n/a'}</span></div>
              <div>Intersections: <span className="font-semibold text-slate-900 dark:text-white">{slicingDebug.intersections_matched ?? 0}</span></div>
              <div>Fully-contained: <span className="font-semibold text-slate-900 dark:text-white">{slicingDebug.fully_contained ?? 0}</span></div>
              <div>Partial masks: <span className="font-semibold text-slate-900 dark:text-white">{slicingDebug.partial_masks_applied ?? 0}</span></div>
              <div>Early-stop: <span className="font-semibold text-slate-900 dark:text-white">{slicingDebug.early_stop_all_claimed ? 'yes' : 'no'}</span></div>
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-[var(--app-border)] bg-slate-50 dark:bg-black h-[calc(100vh-170px)]">
            {!revealedSteps.slicing ? (
              <div className="flex h-full items-center justify-center text-slate-400 dark:text-slate-300">
                Waiting for step transition playback...
              </div>
            ) : !slicingReady ? (
              <div className="flex h-full items-center justify-center text-amber-600 dark:text-amber-300">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Waiting for slicing data...
              </div>
            ) : (
              <canvas ref={slicingCanvasRef} className="h-full w-full" />
            )}
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-[var(--app-border)] bg-slate-50 dark:bg-[var(--app-surface-2)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Insect-containing slices only ({revealedSlices.length})
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Window {Math.min(slicingWindowIndex + 1, Math.max(1, slidingWindows.length))}/{Math.max(1, slidingWindows.length)}
              </p>
            </div>

            <div className="h-[42vh] overflow-y-auto pr-1">
              {!revealedSteps.slicing ? (
                <div className="flex h-full items-center justify-center rounded-md border border-dashed border-slate-300 dark:border-slate-600 text-sm text-slate-500 dark:text-slate-300">
                  Waiting for step transition playback...
                </div>
              ) : !slicingReady ? (
                <div className="flex h-full items-center justify-center rounded-md border border-dashed border-slate-300 dark:border-slate-600 text-amber-600 dark:text-amber-300">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Waiting for slicing data...
                </div>
              ) : revealedSlices.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 dark:border-slate-600 p-4 text-sm text-slate-500 dark:text-slate-400">
                  {slicingPlaybackDone ? (
                    'No insect-containing slices were found.'
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Revealing backend slices as scanner traverses the full grid...
                    </span>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {revealedSlices.map((slice) => (
                    <div key={slice.slice_id} className="rounded-md border border-slate-200 dark:border-[var(--app-border)] bg-slate-100/80 dark:bg-slate-900/80 p-1.5">
                      <img src={slice.image_data_url} alt={`Slice ${slice.slice_id}`} className="aspect-square w-full rounded object-cover" />
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Slice #{slice.slice_id} @ ({Math.round(slice.bbox_x)}, {Math.round(slice.bbox_y)}) • {slice.total_detections} det
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section
        ref={(n) => setStepRef('results', n)}
        style={stepStyle}
        className="mx-auto h-screen rounded-xl border border-slate-200 dark:border-[var(--app-border)] bg-white dark:bg-[var(--app-surface)] p-4 shadow-sm"
      >
        <div className="h-full overflow-hidden">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Step 4: Results</h3>
            {getStepBadge('results', resultsReady, resultsRendered)}
          </div>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Final merged detections. Spinner stops when rendering is complete.
          </p>

          <div className="h-[calc(100%-110px)] overflow-hidden rounded-lg border border-slate-200 dark:border-[var(--app-border)] bg-slate-50 dark:bg-black">
            {!revealedSteps.results ? (
              <div className="flex h-full items-center justify-center text-slate-400 dark:text-slate-300">
                Waiting for step transition playback...
              </div>
            ) : !resultsReady ? (
              <div className="flex h-full items-center justify-center text-amber-600 dark:text-amber-300">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Waiting for final result data...
              </div>
            ) : (
              <canvas ref={resultCanvasRef} className="h-full w-full" />
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
