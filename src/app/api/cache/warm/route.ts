import { NextResponse } from 'next/server'

import { setCachedLinkPersistent } from '@/lib/blob-cache'
import { setCachedLink } from '@/lib/link-cache'
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

  for (const link of links || []) {
    setCachedLink(link.code, link.id, link.destination_url)
    await setCachedLinkPersistent(link.code, link.id, link.destination_url)
  }

  return NextResponse.json({ success: true, links_loaded: links?.length || 0 })
}
