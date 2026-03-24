import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function POST(request: Request) {
  const supabase = createClient()
  await supabase.auth.signOut()
  const origin = new URL(request.url).origin
  redirect(`${origin}/login`)
}
