import { after, type NextRequest } from 'next/server'
import { resolveRedirectLink } from '@/lib/blob-cache'
import { createRedirectBackend } from '@/lib/redirect-backend'
import { handleRedirect, type ScheduleWork } from '@/lib/redirect-handler'

export const runtime = 'edge'
interface Params { params: Promise<{ code: string }> }

/** Fallback for local development and hosts without the native Netlify edge handler. */
async function handle(request: NextRequest, context: Params) {
  const { code } = await context.params
  const backend = createRedirectBackend(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
  const schedule: ScheduleWork = work => after(async () => {
    try { await work() } catch { console.error('Redirect background task failed') }
  })
  return handleRedirect(request, code, {
    ...backend, schedule,
    resolve: value => resolveRedirectLink(value, backend.fetchActiveLink, schedule),
  })
}
export const GET = handle
export const HEAD = handle
