import { parseAnalyticsAsOf } from './analytics.ts'

export type MissingLinkTrafficMode = 'non_bot' | 'all' | 'bots'
export type MissingLinkStatus = 'missing' | 'inactive' | 'resolved'

export type MissingLinkRow = {
  code: string
  requests: number
  previous_requests: number
  last_seen: string | null
  leading_source: string | null
  status: MissingLinkStatus
  link_id: string | null
}

export type MissingLinksReport = {
  summary: {
    requests: number
    previous_requests: number
    range_start: string
    range_end: string
    previous_range_start: string
    previous_range_end: string
    is_partial: boolean
    traffic: MissingLinkTrafficMode
    sources_configured: string[]
  }
  rows: MissingLinkRow[]
}

export type MissingLinksResponse = {
  report: MissingLinksReport
  asOf: string
  refreshedAt: string
}

type ErrorLike = { code?: string; message?: string }

function bucharestDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

function calendarDate(value: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const parts: [number, number, number] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const parsed = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
  return parsed.getUTCFullYear() === parts[0] && parsed.getUTCMonth() === parts[1] - 1 && parsed.getUTCDate() === parts[2]
    ? parts : null
}

function inclusiveDays(from: [number, number, number], to: [number, number, number]): number {
  return Math.floor((Date.UTC(to[0], to[1] - 1, to[2]) - Date.UTC(from[0], from[1] - 1, from[2])) / 86_400_000) + 1
}

export function missingLinkRequest(params: URLSearchParams, now = new Date()) {
  const from = params.get('from') || ''
  const to = params.get('to') || ''
  const traffic = (params.get('traffic')?.trim() || 'non_bot') as MissingLinkTrafficMode
  const fromParts = calendarDate(from)
  const toParts = calendarDate(to)
  if (!fromParts || !toParts) throw new Error('Missing-link range must contain valid dates')
  if (from > to) throw new Error('From date must be on or before to date')
  if (to > bucharestDate(now)) throw new Error('Missing-link range cannot be in the future')
  if (inclusiveDays(fromParts, toParts) > 366) throw new Error('Missing-link range cannot exceed 366 days')
  if (!(['non_bot', 'all', 'bots'] as string[]).includes(traffic)) throw new Error('Traffic must be non_bot, all, or bots')
  const asOf = parseAnalyticsAsOf(params.get('asOf'), now)
  if (asOf && bucharestDate(new Date(asOf)) < from) throw new Error('asOf cannot precede the report range')
  return { from, to, traffic, asOf }
}

export function isMissingLinkReportUnavailable(error: ErrorLike): boolean {
  return ['PGRST202', '42883'].includes(error.code || '')
    || (/wiseurl_missing_links_report/i.test(error.message || '') && /not find|does not exist|missing/i.test(error.message || ''))
}
