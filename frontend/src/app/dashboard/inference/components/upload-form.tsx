'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { saveTrapImage } from '../actions'
import { Upload, X, Loader2, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/i18n/provider'

interface Greenhouse {
  id: string
  name: string
  code: string
}

interface UploadFormProps {
  greenhouses: Greenhouse[]
}

interface FilePreview {
  file: File
  preview: string
  status: 'pending' | 'uploading' | 'inferencing' | 'done' | 'error'
  error?: string
}

export function UploadForm({ greenhouses }: UploadFormProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [files, setFiles] = useState<FilePreview[]>([])
  const [selectedGreenhouse, setSelectedGreenhouse] = useState('')
  const [temperature, setTemperature] = useState('')
  const [humidity, setHumidity] = useState('')
  const [captureTimestamp, setCaptureTimestamp] = useState(
    new Date().toISOString().slice(0, 16)
  )
  const [isUploading, setIsUploading] = useState(false)
  const [currentStep, setCurrentStep] = useState('')
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const imageFiles = Array.from(newFiles).filter((f) =>
      f.type.startsWith('image/')
    )
    const previews: FilePreview[] = imageFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const,
    }))
    setFiles((prev) => [...prev, ...previews])
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer.files) {
        addFiles(e.dataTransfer.files)
      }
    },
    [addFiles]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const updated = [...prev]
      URL.revokeObjectURL(updated[index].preview)
      updated.splice(index, 1)
      return updated
    })
  }

  const handleUploadAll = async () => {
    if (!selectedGreenhouse) {
      alert(t('inference.select_greenhouse'))
      return
    }
    if (files.length === 0) return

    setIsUploading(true)
    const pendingIndices = files.map((f, i) => f.status !== 'done' ? i : -1).filter(i => i >= 0)
    const totalCount = pendingIndices.length
    setUploadProgress({ current: 0, total: totalCount })

    for (let idx = 0; idx < pendingIndices.length; idx++) {
      const i = pendingIndices[idx]

      // Phase 1: Uploading
      setCurrentStep(
        t('inference.uploading_image')
          .replace('{current}', String(idx + 1))
          .replace('{total}', String(totalCount))
      )
      setFiles((prev) => {
        const updated = [...prev]
        updated[i] = { ...updated[i], status: 'uploading' }
        return updated
      })

      const formData = new FormData()
      formData.set('file', files[i].file)
      formData.set('greenhouseId', selectedGreenhouse)
      formData.set('name', files[i].file.name)
      formData.set('captureTimestamp', captureTimestamp)
      if (temperature) formData.set('temperature', temperature)
      if (humidity) formData.set('humidity', humidity)

      // Phase 2: Inferencing (saveTrapImage does upload + inference)
      setFiles((prev) => {
        const updated = [...prev]
        updated[i] = { ...updated[i], status: 'inferencing' }
        return updated
      })
      setCurrentStep(
        t('inference.processing_image')
          .replace('{current}', String(idx + 1))
          .replace('{total}', String(totalCount))
      )

      const result = await saveTrapImage(formData)

      setFiles((prev) => {
        const updated = [...prev]
        updated[i] = {
          ...updated[i],
          status: result.success ? 'done' : 'error',
          error: result.error,
        }
        return updated
      })

      // Update progress AFTER each image is done
      setUploadProgress({ current: idx + 1, total: totalCount })
    }

    setCurrentStep(t('common.success'))
    setIsUploading(false)
    router.refresh()
  }

  const pendingFiles = files.filter((f) => f.status !== 'done')
  const doneFiles = files.filter((f) => f.status === 'done')
  const progressPercent = uploadProgress.total > 0
    ? Math.round((uploadProgress.current / uploadProgress.total) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Greenhouse Selection + Meta */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">{t('inference.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">{t('inference.greenhouse')} *</label>
            <select
              value={selectedGreenhouse}
              onChange={(e) => setSelectedGreenhouse(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            >
              <option value="">{t('inference.select_greenhouse')}...</option>
              {greenhouses.map((gh) => (
                <option key={gh.id} value={gh.id}>
                  [{gh.code}] {gh.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">{t('inference.capture_time')}</label>
            <input
              type="datetime-local"
              value={captureTimestamp}
              onChange={(e) => setCaptureTimestamp(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">{t('inference.temperature')} (°C)</label>
            <input
              type="number" step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              placeholder={t('inference.temperature_placeholder')}
              className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">{t('inference.humidity')} (%)</label>
            <input
              type="number" step="0.1"
              value={humidity}
              onChange={(e) => setHumidity(e.target.value)}
              placeholder={t('inference.humidity_placeholder')}
              className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${dragOver
            ? 'border-emerald-500 bg-emerald-500/5'
            : 'border-slate-700 hover:border-slate-600 bg-slate-900/50'
          }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <Upload className={`h-10 w-10 mx-auto mb-3 ${dragOver ? 'text-emerald-400' : 'text-slate-500'}`} />
        <p className="text-white font-medium">
          {t('inference.drop_images')}
        </p>
        <p className="text-slate-500 text-sm mt-1">
          {t('inference.subtitle')}
        </p>
      </div>

      {/* Progress Bar - shown during upload */}
      {isUploading && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              <span className="text-sm font-medium text-white">{currentStep}</span>
            </div>
            <span className="text-sm font-bold text-emerald-400">{progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {t('inference.completed_remaining')
              .replace('{completed}', String(doneFiles.length))
              .replace('{remaining}', String(pendingFiles.length))}
          </p>
        </div>
      )}

      {/* File Preview Grid */}
      {files.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-300">
              {t('inference.images_selected').replace('{count}', String(files.length))}
              {doneFiles.length > 0 && ` • ${t('inference.uploaded_count').replace('{count}', String(doneFiles.length))}`}
            </h3>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  files.forEach((f) => URL.revokeObjectURL(f.preview))
                  setFiles([])
                }}
                disabled={isUploading}
              >
                {t('common.reset')}
              </Button>
              <Button
                size="sm"
                onClick={handleUploadAll}
                disabled={isUploading || pendingFiles.length === 0 || !selectedGreenhouse}
                className="gap-1.5"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('inference.uploading')}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {t('inference.upload_infer')} {pendingFiles.length > 0 ? `(${pendingFiles.length})` : ''}
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {files.map((fp, index) => (
              <div
                key={index}
                className="relative group aspect-square bg-slate-800 rounded-lg overflow-hidden border border-slate-700"
              >
                <img
                  src={fp.preview}
                  alt={fp.file.name}
                  className="w-full h-full object-cover"
                />

                {/* Status Overlay */}
                {fp.status === 'uploading' && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
                    <span className="text-xs text-blue-300">{t('inference.uploading')}</span>
                  </div>
                )}
                {fp.status === 'inferencing' && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 text-amber-400 animate-spin" />
                    <span className="text-xs text-amber-300">{t('inference.inferencing')}</span>
                  </div>
                )}
                {fp.status === 'done' && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                  </div>
                )}
                {fp.status === 'error' && (
                  <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center p-2">
                    <p className="text-xs text-red-300 text-center">{fp.error}</p>
                  </div>
                )}

                {/* Remove X Button */}
                {(fp.status === 'pending' || fp.status === 'error') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(index)
                    }}
                    className="absolute top-1.5 right-1.5 p-1.5 bg-black/70 hover:bg-red-600 rounded-full text-white transition-colors opacity-0 group-hover:opacity-100"
                    title={t('inference.delete_image')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}

                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-xs text-white truncate">{fp.file.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
