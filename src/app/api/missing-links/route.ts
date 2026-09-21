import { NextRequest, NextResponse } from 'next/server'

import {
  isMissingLinkReportUnavailable,
  missingLinkRequest,
  type MissingLinksReport,
  type MissingLinksResponse,
} from '@/lib/missing-links'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PRIVATE_NO_STORE = { 'Cache-Control': 'private, no-store' }

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_NO_STORE })
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ status: 'unauthorized', error: 'Unauthorized' }, 401)

  try {
    const query = missingLinkRequest(request.nextUrl.searchParams)
    const { data, error } = await supabase.rpc('wiseurl_missing_links_report', {
      p_from: query.from,
      p_to: query.to,
      p_traffic: query.traffic,
      p_as_of: query.asOf,
    })

    if (error) {
      console.error('Missing-link report query failed', {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      })
      if (isMissingLinkReportUnavailable(error)) {
        return json({ status: 'setup_needed', error: 'Missing-link reporting is not available.' }, 503)
      }
      return json({ status: 'query_failed', error: 'Unable to load missing-link reporting.' }, 500)
    }

    const report = data as unknown as MissingLinksReport
    const response: MissingLinksResponse = {
      report,
      asOf: report.summary.range_end,
      refreshedAt: new Date().toISOString(),
    }
    return json(response)
  } catch (error) {
    return json({
      status: 'invalid_request',
      error: error instanceof Error ? error.message : 'Invalid missing-link request',
    }, 400)
  }
}
