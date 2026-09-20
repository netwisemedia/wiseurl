import { NextRequest, NextResponse } from 'next/server'

import { parseAnalyticsAsOf } from '@/lib/analytics'
import type { OverviewReport, OverviewResponse, TrafficMode } from '@/lib/overview-types'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PRIVATE_NO_STORE = { 'Cache-Control': 'private, no-store' }
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TRAFFIC_MODES = new Set<TrafficMode>(['non_bot', 'all', 'bots'])

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_NO_STORE })
}

function bucharestDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function calendarDate(value: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null
  return [year, month, day]
}

function inclusiveDays(from: [number, number, number], to: [number, number, number]): number {
  const fromTime = Date.UTC(from[0], from[1] - 1, from[2])
  const toTime = Date.UTC(to[0], to[1] - 1, to[2])
  return Math.floor((toTime - fromTime) / 86_400_000) + 1
}

function optional(value: string | null): string | null {
  const normalized = value?.trim()
  return normalized || null
}

function missingOverviewFunction(error: { code?: string; message?: string }): boolean {
  return ['PGRST202', '42883'].includes(error.code || '')
    || (/wiseurl_overview_report/i.test(error.message || '') && /not find|does not exist|missing/i.test(error.message || ''))
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ status: 'unauthorized', error: 'Unauthorized' }, 401)

  const from = request.nextUrl.searchParams.get('from') || ''
  const to = request.nextUrl.searchParams.get('to') || ''
  const source = optional(request.nextUrl.searchParams.get('source'))
  const groupId = optional(request.nextUrl.searchParams.get('group'))
  const trafficValue = optional(request.nextUrl.searchParams.get('traffic')) || 'non_bot'

  try {
    const fromParts = calendarDate(from)
    const toParts = calendarDate(to)
    if (!fromParts || !toParts) throw new Error('Overview range must contain valid dates')
    if (from > to) throw new Error('From date must be on or before to date')
    if (to > bucharestDate(new Date())) throw new Error('Overview range cannot be in the future')
    if (inclusiveDays(fromParts, toParts) > 366) throw new Error('Overview range cannot exceed 366 days')
    if (groupId && !UUID_PATTERN.test(groupId)) throw new Error('Group must be a valid UUID')
    if (!TRAFFIC_MODES.has(trafficValue as TrafficMode)) throw new Error('Traffic must be non_bot, all, or bots')

    const asOf = parseAnalyticsAsOf(request.nextUrl.searchParams.get('asOf'))
    if (asOf && bucharestDate(new Date(asOf)) < from) {
      throw new Error('asOf cannot precede the report range')
    }

    const { data, error } = await supabase.rpc('wiseurl_overview_report', {
      p_from: from,
      p_to: to,
      p_source: source,
      p_group_id: groupId,
      p_traffic: trafficValue,
      p_as_of: asOf,
    })

    if (error) {
      console.error('Overview report query failed', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      if (missingOverviewFunction(error)) {
        return json({ status: 'setup_needed', error: 'Overview reporting is not available.' }, 503)
      }
      return json({ status: 'query_failed', error: 'Unable to load overview.' }, 500)
    }

    const report = data as unknown as OverviewReport
    const response: OverviewResponse = {
      report,
      asOf: report.summary.range_end,
      refreshedAt: new Date().toISOString(),
    }
    return json(response)
  } catch (error) {
    return json({
      status: 'invalid_request',
      error: error instanceof Error ? error.message : 'Invalid overview request',
    }, 400)
  }
}
