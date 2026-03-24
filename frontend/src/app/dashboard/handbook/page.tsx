import { createClient } from '@/lib/supabase/server'
import { BookOpen } from 'lucide-react'
import { T } from '@/i18n/t'

export default async function HandbookPage() {
  const supabase = createClient()

  const { data: entries } = await supabase
    .from('handbook_entries')
    .select('*')
    .order('species_name')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <T tKey="handbook.title" as="h1" className="text-2xl font-bold tracking-tight text-white" />
        <T tKey="handbook.subtitle" as="p" className="text-slate-400 mt-1" />
      </div>

      {(!entries || entries.length === 0) ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 text-center">
          <BookOpen className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <T tKey="handbook.no_entries" as="h3" className="text-lg font-medium text-slate-300" />
          <p className="text-slate-500 mt-1"><T tKey="handbook.add_entries" /></p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {entries.map((entry: any) => (
            <div
              key={entry.id}
              className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all group"
            >
              {/* Image */}
              <div className="h-48 bg-slate-800 overflow-hidden">
                {entry.image_url ? (
                  <img
                    src={entry.image_url}
                    alt={entry.species_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <BookOpen className="h-12 w-12" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-5">
                <h3 className="text-lg font-semibold text-white mb-1">{entry.species_name}</h3>
                {entry.scientific_name && (
                  <p className="text-sm italic text-emerald-400 mb-3">{entry.scientific_name}</p>
                )}

                {entry.description && (
                  <div className="mb-3">
                    <T tKey="handbook.description" as="h4" className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1" />
                    <p className="text-sm text-slate-300 line-clamp-3">{entry.description}</p>
                  </div>
                )}

                {entry.characteristics && (
                  <div className="mb-3">
                    <T tKey="handbook.characteristics" as="h4" className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1" />
                    <p className="text-sm text-slate-300 line-clamp-3">{entry.characteristics}</p>
                  </div>
                )}

                {entry.prevention_methods && (
                  <div>
                    <T tKey="handbook.prevention" as="h4" className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1" />
                    <p className="text-sm text-slate-300 line-clamp-3">{entry.prevention_methods}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
