'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X, MapPin, Crosshair } from 'lucide-react'
import { useTranslation } from '@/i18n/provider'

interface GreenhouseFormProps {
  greenhouse?: {
    id: string
    name: string
    code: string
    location: string | null
    crop_type: string | null
    area_sqm: number | null
    description: string | null
  }
  onSubmit: (formData: FormData) => Promise<{ error?: string; success?: boolean }>
  onClose: () => void
}

export function GreenhouseForm({ greenhouse, onSubmit, onClose }: GreenhouseFormProps) {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [locationText, setLocationText] = useState(greenhouse?.location || '')
  const isEditing = !!greenhouse

  // Parse existing location if editing
  useEffect(() => {
    if (greenhouse?.location) {
      const parts = greenhouse.location.split(',').map((s) => s.trim())
      if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
        setLatitude(parts[0])
        setLongitude(parts[1])
      }
      setLocationText(greenhouse.location)
    }
  }, [greenhouse?.location])

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError(t('greenhouse.geolocation_unsupported'))
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6)
        const lng = position.coords.longitude.toFixed(6)
        setLatitude(lat)
        setLongitude(lng)
        setLocationText(`${lat}, ${lng}`)
        setLocating(false)
      },
      (err) => {
        setError(`${t('greenhouse.location_error')}: ${err.message}`)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    // Override location with structured lat/lng value
    formData.set('location', locationText || `${latitude}, ${longitude}`)

    const result = await onSubmit(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  const mapSrc = latitude && longitude
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(longitude) - 0.005},${parseFloat(latitude) - 0.003},${parseFloat(longitude) + 0.005},${parseFloat(latitude) + 0.003}&layer=mapnik&marker=${latitude},${longitude}`
    : null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <h2 className="text-lg font-semibold text-white">
            {isEditing ? t('greenhouse.edit') : t('greenhouse.create')}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium text-slate-300">{t('greenhouse.name')} *</label>
              <input
                id="name" name="name" type="text" required
                defaultValue={greenhouse?.name || ''}
                placeholder={t('greenhouse.name_placeholder')}
                className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="code" className="text-sm font-medium text-slate-300">{t('greenhouse.code')} *</label>
              <input
                id="code" name="code" type="text" required
                defaultValue={greenhouse?.code || ''}
                placeholder={t('greenhouse.code_placeholder')}
                className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Location with Map */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-emerald-400" />
              {t('greenhouse.location')}
            </label>
            <div className="flex gap-2">
              <input
                id="location" name="location" type="text"
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
                placeholder={t('greenhouse.location_placeholder')}
                className="flex-1 bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGetLocation}
                disabled={locating}
                className="gap-1.5 whitespace-nowrap"
              >
                <Crosshair className={`h-4 w-4 ${locating ? 'animate-pulse' : ''}`} />
                {locating ? t('common.loading') : t('greenhouse.detect_location')}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">{t('greenhouse.latitude')}</label>
                <input
                  type="text"
                  value={latitude}
                  onChange={(e) => {
                    setLatitude(e.target.value)
                    if (e.target.value && longitude) setLocationText(`${e.target.value}, ${longitude}`)
                  }}
                  placeholder={t('greenhouse.latitude_placeholder')}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">{t('greenhouse.longitude')}</label>
                <input
                  type="text"
                  value={longitude}
                  onChange={(e) => {
                    setLongitude(e.target.value)
                    if (latitude && e.target.value) setLocationText(`${latitude}, ${e.target.value}`)
                  }}
                  placeholder={t('greenhouse.longitude_placeholder')}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Map Preview */}
            {mapSrc && (
              <div className="rounded-lg overflow-hidden border border-slate-700 mt-1">
                <iframe
                  src={mapSrc}
                  width="100%"
                  height="180"
                  style={{ border: 0 }}
                  loading="lazy"
                  className="opacity-90"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="cropType" className="text-sm font-medium text-slate-300">{t('greenhouse.crop_type')}</label>
              <input
                id="cropType" name="cropType" type="text"
                defaultValue={greenhouse?.crop_type || ''}
                placeholder={t('greenhouse.crop_type_placeholder')}
                className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="areaSqm" className="text-sm font-medium text-slate-300">{t('greenhouse.area')} (m²)</label>
              <input
                id="areaSqm" name="areaSqm" type="number" step="0.1"
                defaultValue={greenhouse?.area_sqm ?? ''}
                placeholder={t('greenhouse.area_placeholder')}
                className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="description" className="text-sm font-medium text-slate-300">{t('greenhouse.description')}</label>
            <textarea
              id="description" name="description" rows={3}
              defaultValue={greenhouse?.description || ''}
              placeholder={t('greenhouse.description_placeholder')}
              className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>{t('greenhouse.cancel')}</Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('greenhouse.saving') : isEditing ? t('greenhouse.edit') : t('greenhouse.create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
