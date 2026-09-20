import { NextResponse } from 'next/server'

import { publishRedirectIfEmpty } from '@/lib/blob-cache'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: links, error } = await supabase
    .from('links')
    .select('id, code, destination_url')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let persistentFailures = 0
  for (const link of links || []) {
    if (!await publishRedirectIfEmpty(link.code, { id: link.id, destination_url: link.destination_url })) persistentFailures++
  }

  return NextResponse.json({
    success: true,
    cache_synced: persistentFailures === 0,
    links_loaded: links?.length || 0,
    persistent_failures: persistentFailures,
  })
}
