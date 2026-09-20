import { buildDestination, extractAttribution } from './attribution.ts'
import { buildClickPayload, type ClickPayload } from './click-tracking.ts'
import { createHandoffDocument, handoffHeaders } from './redirect-page.ts'
import { parseUserAgent } from './user-agent.ts'

export interface RedirectLink { id: string; destination_url: string }
export type ScheduleWork = (work: () => Promise<void>) => void
export interface RedirectDependencies {
  resolve: (code: string) => Promise<RedirectLink | null>
  record: (payload: ClickPayload) => Promise<void>
  schedule: ScheduleWork
  recordMissing?: (payload: Record<string, unknown>) => Promise<void>
  geo?: { country: string | null; city: string | null }
}

const RESERVED = new Set(['login', 'dashboard', 'settings', 'api', 'auth', 'links', 'admin', '_next', '.netlify'])
export function shortCodeFromPath(path: string): string | null {
  try {
    const code = decodeURIComponent(path.slice(1))
    if (!path.startsWith('/') || !/^[a-zA-Z0-9_-]+$/.test(code) || RESERVED.has(code)) return null
    return code
  } catch { return null }
}

export async function handleRedirect(request: Request, code: string, dependencies: RedirectDependencies): Promise<Response> {
  const started = performance.now()
  const method = request.method
  if (method !== 'GET' && method !== 'HEAD') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })
  const headers = handoffHeaders()
  const originalReferrer = request.headers.get('referer') || null
  const { deviceType, osName, browserName, isBot } = parseUserAgent(request.headers.get('user-agent'))
  const geo = dependencies.geo || {
    country: request.headers.get('x-nf-geo-country-code') || request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry'),
    city: request.headers.get('x-nf-geo-city') || request.headers.get('x-vercel-ip-city') || request.headers.get('cf-ipcity'),
  }
  let link: RedirectLink | null
  try {
    link = await dependencies.resolve(code)
  } catch {
    console.error('Redirect lookup failed')
    return new Response(method === 'HEAD' ? null : 'Temporarily unavailable', { status: 503, headers })
  }
  const lookupMs = performance.now() - started
  if (!link) {
    if (method === 'GET' && dependencies.recordMissing) {
      const payload = { code, original_referrer: originalReferrer, country: geo.country, city: geo.city,
        device_type: deviceType, os_name: osName, browser_name: browserName, is_bot: isBot }
      dependencies.schedule(() => dependencies.recordMissing!(payload))
    }
    return new Response(method === 'HEAD' ? null : '<!doctype html><html lang="en"><head><title>Link Not Found - WiseURL</title></head><body><h1>Link not found</h1><p>This link does not exist or has been deactivated.</p></body></html>', { status: 404, headers })
  }
  const incoming = new URL(request.url).searchParams
  incoming.delete('code')
  const clickId = crypto.randomUUID()
  let destination: string
  try {
    destination = buildDestination(link.destination_url, incoming, { click_id: clickId, code })
  } catch {
    console.error('Unsafe configured destination')
    return new Response(method === 'HEAD' ? null : 'Invalid destination URL', { status: 502, headers })
  }
  if (method === 'GET') {
    const payload = buildClickPayload({ linkId: link.id, code, clickId, destinationSnapshot: link.destination_url,
      originalReferrer, country: geo.country, city: geo.city, deviceType, osName, browserName, isBot }, extractAttribution(incoming))
    payload.clicked_at = new Date().toISOString()
    dependencies.schedule(() => dependencies.record(payload))
  }
  const body = method === 'HEAD' ? null : createHandoffDocument(destination)
  headers['Server-Timing'] = `resolve;dur=${lookupMs.toFixed(1)}, handoff;dur=${(performance.now() - started).toFixed(1)}`
  return new Response(body, { status: 200, headers })
}
