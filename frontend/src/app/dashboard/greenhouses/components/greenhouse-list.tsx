'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { GreenhouseForm } from './greenhouse-form'
import { createGreenhouse, updateGreenhouse, deleteGreenhouse } from '../actions'
import { Plus, Pencil, Trash2, Sprout, MapPin, Ruler, Leaf } from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from '@/i18n/provider'

interface Greenhouse {
  id: string
  code: string
  name: string
  location: string | null
  crop_type: string | null
  area_sqm: number | null
  description: string | null
  alert_thresholds: Record<string, number> | null
  created_at: string
  updated_at: string
}

interface GreenhouseListProps {
  greenhouses: Greenhouse[]
}

export function GreenhouseList({ greenhouses }: GreenhouseListProps) {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [editingGreenhouse, setEditingGreenhouse] = useState<Greenhouse | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleCreate = async (formData: FormData) => {
    const result = await createGreenhouse(formData)
    if (result.success) {
      setShowForm(false)
    }
    return result
  }

  const handleUpdate = async (formData: FormData) => {
    if (!editingGreenhouse) return { error: 'No greenhouse selected' }
    const result = await updateGreenhouse(editingGreenhouse.id, formData)
    if (result.success) {
      setEditingGreenhouse(null)
    }
    return result
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('greenhouse.confirm_delete'))) {
      return
    }
    setDeletingId(id)
    await deleteGreenhouse(id)
    setDeletingId(null)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{t('greenhouse.title')}</h1>
          <p className="text-slate-400 mt-1">{t('greenhouse.subtitle')}</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('greenhouse.create')}
        </Button>
      </div>

      {/* Grid */}
      {greenhouses.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center">
          <Sprout className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-300">{t('greenhouse.no_greenhouses')}</h3>
          <p className="text-slate-500 mt-1 mb-6">{t('greenhouse.no_greenhouses')}</p>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('greenhouse.create')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {greenhouses.map((gh) => (
            <div
              key={gh.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all group relative"
            >
              {/* Action Buttons */}
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setEditingGreenhouse(gh)}
                  className="p-1.5 rounded-md bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors"
                  title={t('greenhouse.edit')}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(gh.id)}
                  disabled={deletingId === gh.id}
                  className="p-1.5 rounded-md bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
                  title={t('greenhouse.delete')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <Link href={`/dashboard/greenhouses/${gh.id}`} className="block">
                {/* Badge */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">
                    {gh.code}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-base font-semibold text-white mb-2 group-hover:text-emerald-400 transition-colors">
                  {gh.name}
                </h3>

                {/* Meta */}
                <div className="space-y-1.5 text-sm text-slate-400">
                  {gh.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-500" />
                      <span className="truncate">{gh.location}</span>
                    </div>
                  )}
                  {gh.crop_type && (
                    <div className="flex items-center gap-2">
                      <Leaf className="h-3.5 w-3.5 text-slate-500" />
                      <span>{gh.crop_type}</span>
                    </div>
                  )}
                  {gh.area_sqm && (
                    <div className="flex items-center gap-2">
                      <Ruler className="h-3.5 w-3.5 text-slate-500" />
                      <span>{gh.area_sqm} m²</span>
                    </div>
                  )}
                </div>

                {gh.description && (
                  <p className="mt-3 text-xs text-slate-500 line-clamp-2">{gh.description}</p>
                )}
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <GreenhouseForm
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Edit Modal */}
      {editingGreenhouse && (
        <GreenhouseForm
          greenhouse={editingGreenhouse}
          onSubmit={handleUpdate}
          onClose={() => setEditingGreenhouse(null)}
        />
      )}
    </div>
  )
}
