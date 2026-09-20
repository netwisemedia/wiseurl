export const ANALYTICS_TIMEZONE = 'Europe/Bucharest'

export type ChangeState = 'new' | 'no_baseline' | 'increase' | 'decrease' | 'unchanged'
export type AnalyticsErrorKind = 'setup_needed' | 'query_failed'

export interface AnalyticsScope {
  from: string
  to: string
  source: string | null
  linkId: string | null
  groupId: string | null
}

export interface AnalyticsSummary {
  recorded_clicks: number
  recorded_non_bot_clicks: number
  bot_clicks: number
  previous_recorded_clicks: number
  previous_recorded_non_bot_clicks: number
  previous_bot_clicks: number
  change_state: ChangeState
  change_percent: number | null
  timezone: typeof ANALYTICS_TIMEZONE
  from: string
  to: string
  range_start: string
  range_end: string
  previous_range_start: string
  previous_range_end: string
  duration_seconds: number
  previous_duration_seconds: number
  is_partial: boolean
}

export interface SourceAnalyticsRow {
  source: string
  provenance: 'explicit' | 'referrer' | 'unknown' | 'mixed'
  clicks: number
  recorded_non_bot_clicks: number
  bot_clicks: number
  share: number
  previous_clicks: number
  change_state: ChangeState
  change_percent: number | null
  leading_link_code: string | null
  leading_destination: string | null
  latest_click: string | null
}

export interface LinkAnalyticsRow {
  id: string
  code: string
  title: string | null
  latest_destination_url: string
  clicks: number
  recorded_non_bot_clicks: number
  bot_clicks: number
  latest_click: string
}

export interface DestinationAnalyticsRow {
  destination_url: string
  clicks: number
  recorded_non_bot_clicks: number
  bot_clicks: number
  link_count: number
  latest_click: string
}

export interface DailyAnalyticsRow {
  date: string
  clicks: number
  recorded_non_bot_clicks: number
  bot_clicks: number
}

export interface AnalyticsReport {
  summary: AnalyticsSummary
  sources: SourceAnalyticsRow[]
  links: LinkAnalyticsRow[]
  destinations: DestinationAnalyticsRow[]
  daily: DailyAnalyticsRow[]
}

export interface AnalyticsClickRow {
  id: string
  clicked_at: string
  link_id: string
  code: string
  title: string | null
  destination_url: string
  source: string
  source_kind: string
  original_referrer: string | null
  country: string | null
  city: string | null
  device_type: string | null
  os_name: string | null
  browser_name: string | null
  is_bot: boolean
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  sub_id1: string | null
  sub_id2: string | null
  sub_id3: string | null
  total_count?: number
}

export interface AnalyticsResponse {
  report: AnalyticsReport
  rows: AnalyticsClickRow[]
  pagination: { page: number; pageSize: number; total: number; pages: number }
  refreshedAt: string
  asOf: string
}

interface ErrorLike {
  code?: string
  message?: string
}

function bucharestDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: ANALYTICS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

function shiftDate(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function optional(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed || null
}

function optionalUuid(value: string | null | undefined, label: string): string | null {
  const normalized = optional(value)
  if (normalized && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new Error(`${label} must be a valid UUID`)
  }
  return normalized
}

export function getPresetRange(days: 7 | 30, now = new Date()): Pick<AnalyticsScope, 'from' | 'to'> {
  const to = bucharestDate(now)
  return { from: shiftDate(to, -(days - 1)), to }
}

export function validateAnalyticsScope(
  input: Partial<AnalyticsScope> & Pick<AnalyticsScope, 'from' | 'to'>,
  now = new Date(),
): AnalyticsScope {
  if (!isCalendarDate(input.from) || !isCalendarDate(input.to)) {
    throw new Error('Analytics range must contain valid dates')
  }
  if (input.from > input.to) throw new Error('From date must be on or before to date')
  if (input.to > bucharestDate(now)) throw new Error('Analytics range cannot be in the future')

  return {
    from: input.from,
    to: input.to,
    source: optional(input.source),
    linkId: optionalUuid(input.linkId, 'Link'),
    groupId: optionalUuid(input.groupId, 'Group'),
  }
}

export function comparisonLabel(state: ChangeState, percentage: number | null): string {
  if (state === 'new') return 'New'
  if (state === 'no_baseline') return 'No baseline'
  if (percentage === null) return 'No baseline'
  return `${percentage > 0 ? '+' : ''}${percentage.toFixed(1)}%`
}

export function classifyAnalyticsError(error: ErrorLike): AnalyticsErrorKind {
  if (['PGRST202', 'PGRST204', '42703', '42883'].includes(error.code || '')) return 'setup_needed'
  if (/wiseurl_analytics_|source_label|utm_source/i.test(error.message || '') && /missing|not find|does not exist/i.test(error.message || '')) {
    return 'setup_needed'
  }
  return 'query_failed'
}

export function buildSourceTaggedUrl(origin: string, code: string, source: string, campaign?: string): string {
  const normalizedSource = source.trim()
  if (!normalizedSource) throw new Error('Source site is required')

  const base = new URL(origin)
  const tagged = new URL(`/${encodeURIComponent(code)}`, base.origin)
  tagged.searchParams.set('utm_source', normalizedSource)
  if (campaign?.trim()) tagged.searchParams.set('utm_campaign', campaign.trim())
  return tagged.toString()
}

export function analyticsSearchParams(
  scope: AnalyticsScope & { asOf?: string | null; page?: number; pageSize?: number },
): URLSearchParams {
  const query = new URLSearchParams({ from: scope.from, to: scope.to })
  if (scope.source) query.set('source', scope.source)
  if (scope.linkId) query.set('link', scope.linkId)
  if (scope.groupId) query.set('group', scope.groupId)
  if (scope.asOf) query.set('asOf', scope.asOf)
  if (scope.page) query.set('page', String(scope.page))
  if (scope.pageSize) query.set('pageSize', String(scope.pageSize))
  return query
}

export function analyticsDetailHref(linkId: string, scope: AnalyticsScope, asOf: string): string {
  const query = analyticsSearchParams({
    ...scope,
    linkId: null,
    groupId: null,
    asOf,
  })
  return `/links/${encodeURIComponent(linkId)}?${query.toString()}`
}

export function parseAnalyticsAsOf(value: string | null | undefined, now = new Date()): string | null {
  const timestamp = value?.trim()
  if (!timestamp) return null

  const match = timestamp.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-](\d{2}):(\d{2}))$/)
  const validDate = match ? isCalendarDate(match[1]) : false
  const validTime = match
    ? Number(match[2]) <= 23 && Number(match[3]) <= 59 && Number(match[4]) <= 59
    : false
  const offsetHours = match?.[6] ? Number(match[6]) : 0
  const offsetMinutes = match?.[7] ? Number(match[7]) : 0
  const validOffset = offsetMinutes <= 59 && (offsetHours < 14 || (offsetHours === 14 && offsetMinutes === 0))
  const parsed = new Date(timestamp)

  if (!validDate || !validTime || !validOffset || Number.isNaN(parsed.getTime())) {
    throw new Error('asOf must be a valid timestamp')
  }
  if (parsed.getTime() > now.getTime() + 5_000) throw new Error('asOf cannot be in the future')
  return timestamp
}

const CSV_COLUMNS: Array<keyof AnalyticsClickRow> = [
  'clicked_at', 'source', 'source_kind', 'code', 'destination_url', 'original_referrer',
  'country', 'city', 'device_type', 'os_name', 'browser_name', 'is_bot',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'sub_id1', 'sub_id2', 'sub_id3',
]

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

export function rowsToCsv(rows: AnalyticsClickRow[]): string {
  return [
    CSV_COLUMNS.join(','),
    ...rows.map(row => CSV_COLUMNS.map(column => csvCell(row[column])).join(',')),
  ].join('\r\n')
}
