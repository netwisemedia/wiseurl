import { NextRequest, NextResponse } from 'next/server'

import {
  classifyAnalyticsError,
  rowsToCsv,
  validateAnalyticsScope,
  type AnalyticsClickRow,
  type AnalyticsReport,
} from '@/lib/analytics'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function positiveInteger(value: string | null, fallback: number, maximum: number): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return Math.min(parsed, maximum)
}

function parseAsOf(value: string | null): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new Error('asOf must be a valid timestamp')
  if (parsed.getTime() > Date.now() + 5_000) throw new Error('asOf cannot be in the future')
  return parsed.toISOString()
}

function errorResponse(error: { code?: string; message: string }) {
  const kind = classifyAnalyticsError(error)
  return NextResponse.json({
    status: kind,
    error: kind === 'setup_needed'
      ? 'Source analytics is not set up. Run supabase/migrations/0001_source_analytics.sql.'
      : error.message,
  }, {
    status: kind === 'setup_needed' ? 503 : 500,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ status: 'unauthorized', error: 'Unauthorized' }, { status: 401 })
  }

  let scope
  let asOf: string | null
  try {
    scope = validateAnalyticsScope({
      from: request.nextUrl.searchParams.get('from') || '',
      to: request.nextUrl.searchParams.get('to') || '',
      source: request.nextUrl.searchParams.get('source'),
      linkId: request.nextUrl.searchParams.get('link'),
      groupId: request.nextUrl.searchParams.get('group'),
    })
    asOf = parseAsOf(request.nextUrl.searchParams.get('asOf'))
  } catch (error) {
    return NextResponse.json({
      status: 'invalid_request',
      error: error instanceof Error ? error.message : 'Invalid analytics request',
    }, { status: 400 })
  }

  const reportParams = {
    p_from: scope.from,
    p_to: scope.to,
    p_source: scope.source,
    p_link_id: scope.linkId,
    p_group_id: scope.groupId,
    p_as_of: asOf,
  }
  const { data: reportData, error: reportError } = await supabase.rpc('wiseurl_analytics_report', reportParams)
  if (reportError) return errorResponse(reportError)

  const report = reportData as unknown as AnalyticsReport
  const frozenAsOf = report.summary.range_end
  const rawBase = {
    ...reportParams,
    p_as_of: frozenAsOf,
  }

  if (request.nextUrl.searchParams.get('format') === 'csv') {
    const rows: AnalyticsClickRow[] = []
    const pageSize = 500
    const total = report.summary.recorded_clicks

    for (let offset = 0; offset < total; offset += pageSize) {
      const { data, error } = await supabase.rpc('wiseurl_analytics_clicks', {
        ...rawBase,
        p_offset: offset,
        p_limit: pageSize,
      })
      if (error) return errorResponse(error)
      rows.push(...((data || []) as AnalyticsClickRow[]))
      if (!data || data.length < pageSize) break
    }

    return new NextResponse(rowsToCsv(rows), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="wiseurl-clicks-${scope.from}-to-${scope.to}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    })
  }

  const page = positiveInteger(request.nextUrl.searchParams.get('page'), 1, 1_000_000)
  const pageSize = positiveInteger(request.nextUrl.searchParams.get('pageSize'), 50, 100)
  const { data: rowsData, error: rowsError } = await supabase.rpc('wiseurl_analytics_clicks', {
    ...rawBase,
    p_offset: (page - 1) * pageSize,
    p_limit: pageSize,
  })
  if (rowsError) return errorResponse(rowsError)

  const total = report.summary.recorded_clicks
  return NextResponse.json({
    report,
    rows: rowsData || [],
    pagination: {
      page,
      pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    },
    asOf: frozenAsOf,
    refreshedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
