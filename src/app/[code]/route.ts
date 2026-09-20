import { NextRequest, NextResponse } from 'next/server'

import { buildDestination, extractAttribution } from '@/lib/attribution'
import { getCachedLinkPersistent, setCachedLinkPersistent } from '@/lib/blob-cache'
import { buildClickPayload, persistClickWithFallback } from '@/lib/click-tracking'
import { getCachedLink, setCachedLink } from '@/lib/link-cache'
import { createHandoffDocument, handoffHeaders } from '@/lib/redirect-page'
import { createClient } from '@/lib/supabase/server'
import { parseUserAgent } from '@/lib/user-agent'

export const runtime = 'edge'

interface Params {
  params: Promise<{ code: string }>
}

interface ResolvedLink {
  id: string
  destination_url: string
}

function locationHeaders(request: NextRequest) {
  return {
    country: request.headers.get('x-nf-geo-country-code')
      || request.headers.get('x-vercel-ip-country')
      || request.headers.get('cf-ipcountry')
      || null,
    city: request.headers.get('x-nf-geo-city')
      || request.headers.get('x-vercel-ip-city')
      || request.headers.get('cf-ipcity')
      || null,
  }
}

async function resolveLink(code: string): Promise<ResolvedLink | null> {
  const memory = getCachedLink(code)
  if (memory) return memory

  const persistent = await getCachedLinkPersistent(code)
  if (persistent) {
    setCachedLink(code, persistent.id, persistent.destination_url)
    return persistent
  }

  const supabase = await createClient()
  const { data: link, error } = await supabase
    .from('links')
    .select('id, destination_url')
    .eq('code', code)
    .eq('is_active', true)
    .single()

  if (error || !link) return null

  setCachedLink(code, link.id, link.destination_url)
  await setCachedLinkPersistent(code, link.id, link.destination_url)
  return link
}

async function recordClick(
  request: NextRequest,
  code: string,
  linkId: string,
  clickId: string,
  destinationSnapshot: string,
  incoming: URLSearchParams,
): Promise<void> {
  const supabase = await createClient()
  const originalReferrer = request.headers.get('referer') || null
  const { deviceType, osName, browserName, isBot } = parseUserAgent(request.headers.get('user-agent'))
  const { country, city } = locationHeaders(request)
  const payload = buildClickPayload({
    linkId,
    code,
    clickId,
    destinationSnapshot,
    originalReferrer,
    country,
    city,
    deviceType,
    osName,
    browserName,
    isBot,
  }, extractAttribution(incoming))

  const result = await persistClickWithFallback(payload, async (candidate, signal) => {
    const { error } = await supabase
      .from('clicks')
      .insert(candidate)
      .abortSignal(signal)

    return { error: error ? { code: error.code, message: error.message } : null }
  })

  if (!result.recorded) {
    console.error('Click tracking failed:', result.error?.code, result.error?.message)
  } else if (result.mode === 'legacy') {
    console.warn('Click recorded without attribution columns; run the source analytics migration')
  }
}

async function logMissingLink(request: NextRequest, code: string): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 750)

  try {
    const supabase = await createClient()
    const originalReferrer = request.headers.get('referer') || null
    const { deviceType, osName, browserName, isBot } = parseUserAgent(request.headers.get('user-agent'))
    const { country, city } = locationHeaders(request)

    const { error } = await supabase
      .from('error_404_logs')
      .insert({
        code,
        original_referrer: originalReferrer,
        country,
        city,
        device_type: deviceType,
        os_name: osName,
        browser_name: browserName,
        is_bot: isBot,
      })
      .abortSignal(controller.signal)

    if (error) console.error('404 log error:', error.message)
  } catch (error) {
    console.error('404 log exception:', error)
  } finally {
    clearTimeout(timeout)
  }
}

function notFoundResponse(): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Link Not Found - WiseURL</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; color: white; }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 5rem; font-weight: 800; opacity: 0.3; }
    h2 { font-size: 1.25rem; margin: 1rem 0; }
    p { opacity: 0.7; margin-bottom: 2rem; font-size: 0.875rem; }
    a { display: inline-block; background: #6366f1; color: white; padding: 0.75rem 2rem; border-radius: 0.5rem; text-decoration: none; }
    a:hover { background: #4f46e5; }
  </style>
</head>
<body>
  <div class="container">
    <h1>404</h1>
    <h2>Link Not Found</h2>
    <p>This link doesn't exist or has been deactivated.</p>
    <a href="/">Go Home</a>
  </div>
</body>
</html>`,
    {
      status: 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex',
      },
    },
  )
}

async function handleRequest(request: NextRequest, { params }: Params, shouldTrack: boolean): Promise<NextResponse> {
  const { code } = await params
  const link = await resolveLink(code)

  if (!link) {
    if (request.method !== 'HEAD') await logMissingLink(request, code)
    return notFoundResponse()
  }

  const incoming = new URLSearchParams(request.nextUrl.searchParams)
  incoming.delete('code')
  const clickId = crypto.randomUUID()

  let destination: string
  try {
    destination = buildDestination(link.destination_url, incoming, { click_id: clickId, code })
  } catch (error) {
    console.error('Unsafe configured destination:', error)
    return new NextResponse('Invalid destination URL', {
      status: 502,
      headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' },
    })
  }

  if (shouldTrack) await recordClick(request, code, link.id, clickId, link.destination_url, incoming)

  return new NextResponse(createHandoffDocument(destination), {
    status: 200,
    headers: handoffHeaders(),
  })
}

export async function GET(request: NextRequest, context: Params) {
  return handleRequest(request, context, true)
}

export async function HEAD(request: NextRequest, context: Params) {
  const response = await handleRequest(request, context, false)
  return new NextResponse(null, { status: response.status, headers: response.headers })
}
