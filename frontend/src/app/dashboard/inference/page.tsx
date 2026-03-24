import { createClient } from '@/lib/supabase/server'
import { UploadForm } from './components/upload-form'
import { getTrapImages } from './actions'
import { RecentUploadsTable } from './components/recent-uploads-table'
import { CalendarDays } from 'lucide-react'
import { T } from '@/i18n/t'

export default async function InferencePage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const supabase = createClient()

  // Get greenhouses for dropdown
  const { data: greenhouses } = await supabase
    .from('greenhouses')
    .select('id, name, code')
    .order('name')

  // Pagination
  const page = Math.max(1, parseInt(searchParams?.page || '1', 10))
  const perPage = 10 // 5 per row x 2 rows
  const { data: trapImages, total } = await getTrapImages(page, perPage)
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <T tKey="inference.title" as="h1" className="text-2xl font-bold tracking-tight text-white" />
        <T tKey="inference.subtitle" as="p" className="text-slate-400 mt-1" />
      </div>

      <UploadForm greenhouses={greenhouses || []} />

      {/* Recent Uploads */}
      <div>
        <T tKey="inference.recent_uploads" as="h2" className="text-lg font-semibold text-white mb-4" />
        {trapImages.length === 0 && page === 1 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
            <CalendarDays className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <T tKey="inference.no_uploads" as="p" className="text-slate-400 text-sm" />
          </div>
        ) : (
          <RecentUploadsTable
            images={trapImages}
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
          />
        )}
      </div>
    </div>
  )
}
