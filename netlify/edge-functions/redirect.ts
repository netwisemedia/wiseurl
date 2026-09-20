import { resolveRedirectLink } from '../../src/lib/blob-cache.ts'
import { createRedirectBackend } from '../../src/lib/redirect-backend.ts'
import { handleRedirect, shortCodeFromPath, type ScheduleWork } from '../../src/lib/redirect-handler.ts'

declare const Netlify: { env: { get(name: string): string | undefined } }
interface EdgeContext {
  next(): Promise<Response>
  waitUntil(promise: Promise<unknown>): void
  geo?: { country?: { code?: string }; city?: string }
}

export default async function redirect(request: Request, context: EdgeContext): Promise<Response> {
  const code = shortCodeFromPath(new URL(request.url).pathname)
  if (!code || (request.method !== 'GET' && request.method !== 'HEAD')) return context.next()
  const url = Netlify.env.get('NEXT_PUBLIC_SUPABASE_URL')
  const key = Netlify.env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  // A deploy missing edge-scoped variables can still use the configured Next fallback.
  if (!url || !key) return context.next()
  const backend = createRedirectBackend(url, key)
  const schedule: ScheduleWork = work => context.waitUntil(Promise.resolve().then(work).catch(() => {
    console.error('Redirect background task failed')
  }))
  const response = await handleRedirect(request, code, {
    ...backend, schedule,
    resolve: value => resolveRedirectLink(value, backend.fetchActiveLink, schedule),
    geo: { country: context.geo?.country?.code || null, city: context.geo?.city || null },
  })
  response.headers.set('X-WiseURL-Handler', 'edge-v1')
  return response
}

export const config = {
  path: '/:code',
  excludedPath: ['/login', '/dashboard', '/settings', '/api', '/auth', '/links', '/admin', '/_next', '/.netlify', '/favicon.ico', '/robots.txt', '/sitemap.xml'],
}
