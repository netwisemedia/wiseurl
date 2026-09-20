import { NextRequest, NextResponse } from 'next/server'

import { validateHttpUrl } from '@/lib/attribution'
import { fenceRedirectCache, finishRedirectTombstone, publishRedirectAfterFence, publishRedirectIfEmpty } from '@/lib/blob-cache'
import { fenceThenMutate } from '@/lib/cache-mutation'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

interface CacheBody {
  id?: unknown; code?: unknown; destination_url?: unknown; title?: unknown; group_id?: unknown; is_active?: unknown
}

async function parseBody(request: NextRequest): Promise<CacheBody | null> {
  try { return await request.json() as CacheBody } catch { return null }
}

async function ownedLink(body: CacheBody) {
  if (typeof body.id !== 'string' || typeof body.code !== 'string') {
    return { response: NextResponse.json({ error: 'Provide { id, code }' }, { status: 400 }) }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: link, error } = await supabase.from('links').select('id, code, destination_url, is_active, updated_at')
    .eq('id', body.id).eq('code', body.code).eq('user_id', user.id).single()
  if (error || !link) return { response: NextResponse.json({ error: 'Link not found' }, { status: 404 }) }
  return { link, supabase, user }
}

export async function POST(request: NextRequest) {
  const body = await parseBody(request)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  const result = await ownedLink(body)
  if ('response' in result) return result.response
  const cacheSynced = result.link.is_active
    ? await publishRedirectIfEmpty(result.link.code, { id: result.link.id, destination_url: result.link.destination_url })
    : true
  return NextResponse.json({ success: true, cache_synced: cacheSynced })
}

export async function PUT(request: NextRequest) {
  const body = await parseBody(request)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  const result = await ownedLink(body)
  if ('response' in result) return result.response

  if (typeof body.destination_url !== 'string' || typeof body.is_active !== 'boolean' ||
      (body.title !== null && typeof body.title !== 'string') ||
      (body.group_id !== null && typeof body.group_id !== 'string')) {
    return NextResponse.json({ error: 'Invalid link update' }, { status: 400 })
  }
  let destinationUrl: string
  try { validateHttpUrl(body.destination_url.trim()); destinationUrl = body.destination_url.trim() } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid destination URL' }, { status: 400 })
  }
  const title = body.title?.trim() || null
  if (title && title.length > 255) return NextResponse.json({ error: 'Title must be 255 characters or fewer' }, { status: 400 })

  if (body.group_id) {
    const { data: group } = await result.supabase.from('groups').select('id')
      .eq('id', body.group_id).eq('user_id', result.user.id).single()
    if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 400 })
  }

  try {
    const mutation = await fenceThenMutate(
      () => fenceRedirectCache(result.link.code),
      async () => {
        const { data, error } = await result.supabase.from('links').update({
          destination_url: destinationUrl, title, group_id: body.group_id, is_active: body.is_active,
        }).eq('id', result.link.id).eq('user_id', result.user.id)
          .eq('updated_at', result.link.updated_at).select('id').single()
        if (error || !data) throw new Error(error?.message || 'Link update did not modify an owned row')
      },
      body.is_active
        ? async fence => {
            const published = await publishRedirectAfterFence(result.link.code, { id: result.link.id, destination_url: destinationUrl }, fence)
            if (!published) await finishRedirectTombstone(result.link.code, fence)
            return published
          }
        : fence => finishRedirectTombstone(result.link.code, fence),
    )
    return NextResponse.json({ success: true, cache_synced: mutation.cacheSynced })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Link update failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const body = await parseBody(request)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  const result = await ownedLink(body)
  if ('response' in result) return result.response
  try {
    const mutation = await fenceThenMutate(
      () => fenceRedirectCache(result.link.code),
      async () => {
        const { data, error } = await result.supabase.from('links').delete()
          .eq('id', result.link.id).eq('user_id', result.user.id)
          .eq('updated_at', result.link.updated_at).select('id').single()
        if (error || !data) throw new Error(error?.message || 'Link deletion did not remove an owned row')
      },
      fence => finishRedirectTombstone(result.link.code, fence),
    )
    return NextResponse.json({ success: true, deleted: true, cache_synced: mutation.cacheSynced })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Link deletion failed' }, { status: 500 })
  }
}
