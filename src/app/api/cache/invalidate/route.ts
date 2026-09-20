import { NextRequest, NextResponse } from 'next/server'

import {
  getCacheStats,
  invalidateCachedLink,
  setCachedLink,
} from '@/lib/link-cache'
import {
  invalidateCachedLinkPersistent,
  setCachedLinkPersistent,
} from '@/lib/blob-cache'
import { createClient } from '@/lib/supabase/server'
import { deleteLinkThenInvalidate } from '@/lib/cache-mutation'

export const runtime = 'edge'

interface CacheBody {
  id?: unknown
  code?: unknown
}

async function ownedLink(body: CacheBody) {
  if (typeof body.id !== 'string' || typeof body.code !== 'string') {
    return { response: NextResponse.json({ error: 'Provide { id, code }' }, { status: 400 }) }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: link, error } = await supabase
    .from('links')
    .select('id, code, destination_url, is_active')
    .eq('id', body.id)
    .eq('code', body.code)
    .eq('user_id', user.id)
    .single()

  if (error || !link) {
    return { response: NextResponse.json({ error: 'Link not found' }, { status: 404 }) }
  }

  return { link, supabase, user }
}

async function invalidateEverywhere(code: string): Promise<void> {
  invalidateCachedLink(code)

  for (let attempt = 0; attempt < 3; attempt++) {
    if (await invalidateCachedLinkPersistent(code)) return
  }

  throw new Error('Persistent cache invalidation failed after three attempts')
}

async function parseBody(request: NextRequest): Promise<CacheBody | null> {
  try {
    return await request.json() as CacheBody
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const body = await parseBody(request)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const result = await ownedLink(body)
  if ('response' in result) return result.response

  const deletedL1 = invalidateCachedLink(result.link.code)
  const deletedL2 = await invalidateCachedLinkPersistent(result.link.code)
  return NextResponse.json({ success: true, l1_cleared: deletedL1, l2_cleared: deletedL2 })
}

export async function PUT(request: NextRequest) {
  const body = await parseBody(request)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const result = await ownedLink(body)
  if ('response' in result) return result.response

  invalidateCachedLink(result.link.code)
  await invalidateCachedLinkPersistent(result.link.code)

  if (result.link.is_active) {
    setCachedLink(result.link.code, result.link.id, result.link.destination_url)
    await setCachedLinkPersistent(result.link.code, result.link.id, result.link.destination_url)
  }

  return NextResponse.json({ success: true, warmed: result.link.is_active })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({ l1_size: getCacheStats().size })
}

export async function DELETE(request: NextRequest) {
  const body = await parseBody(request)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const result = await ownedLink(body)
  if ('response' in result) return result.response

  try {
    await deleteLinkThenInvalidate(
      async () => {
        const { error } = await result.supabase
          .from('links')
          .delete()
          .eq('id', result.link.id)
          .eq('user_id', result.user.id)
        if (error) throw new Error(error.message)
      },
      async () => invalidateEverywhere(result.link.code),
    )
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Link deletion failed',
    }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
