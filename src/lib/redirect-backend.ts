import { persistClickWithFallback, type ClickPayload } from './click-tracking.ts'
import type { RedirectLink } from './redirect-handler.ts'

/** Public redirect access uses the existing anon RLS policies, never admin credentials or visitor sessions. */
export function createRedirectBackend(url: string, anonKey: string, fetcher: typeof fetch = fetch) {
  if (!url || !anonKey) throw new Error('Redirect backend is not configured')
  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' }
  async function insert(table: string, payload: Record<string, unknown>, signal: AbortSignal) {
    const response = await fetcher(`${url}/rest/v1/${table}`, {
      method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(payload), signal,
    })
    if (response.ok) return { error: null }
    const error = await response.json().catch(() => null) as { code?: string; message?: string } | null
    return { error: { code: error?.code || String(response.status), message: error?.message || 'Insert failed' } }
  }
  return {
    async fetchActiveLink(code: string): Promise<RedirectLink | null> {
      const params = new URLSearchParams({ select: 'id,destination_url', code: `eq.${code}`, is_active: 'eq.true', limit: '1' })
      const response = await fetcher(`${url}/rest/v1/links?${params}`, { headers, signal: AbortSignal.timeout(3_000), cache: 'no-store' })
      if (!response.ok) throw new Error(`Link lookup failed (${response.status})`)
      const rows = await response.json() as RedirectLink[]
      return rows[0] || null
    },
    async record(payload: ClickPayload): Promise<void> {
      const result = await persistClickWithFallback(payload, (candidate, signal) => insert('clicks', candidate, signal))
      if (!result.recorded) console.error('Click tracking failed:', result.error?.code)
      else if (result.mode === 'legacy') console.warn('Click attribution columns unavailable')
    },
    async recordMissing(payload: Record<string, unknown>): Promise<void> {
      const result = await insert('error_404_logs', payload, AbortSignal.timeout(750))
      if (result.error) console.error('Missing link logging failed:', result.error.code)
    },
  }
}
