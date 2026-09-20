import { ANALYTICS_TIMEZONE, getPresetRange, parseAnalyticsAsOf, validateAnalyticsScope } from './analytics.ts'
import type { OverviewLink, TrafficMode } from './overview-types.ts'

export type PeriodPreset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'last-month'
export type RankingMode = 'clicks' | 'growth' | 'decline' | 'zero'
export interface OverviewFilters {
  from: string
  to: string
  traffic: TrafficMode
  source: string | null
  groupId: string | null
  asOf: string | null
}
export const PERIODS: { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' }, { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' }, { value: 'last-month', label: 'Last month' },
]
export const TRAFFIC_LABELS: Record<TrafficMode, string> = {
  non_bot: 'Non-bot clicks', all: 'All recorded clicks', bots: 'Detected bot clicks',
}
export function overviewRange(preset: PeriodPreset, now = new Date()): { from: string; to: string } {
  const today = getPresetRange(7, now).to
  const [year, month, day] = today.split('-').map(Number)
  const date = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10)
  if (preset === 'today') return { from: today, to: today }
  if (preset === 'yesterday') return { from: date(year, month, day - 1), to: date(year, month, day - 1) }
  if (preset === 'month') return { from: date(year, month, 1), to: today }
  if (preset === 'last-month') return { from: date(year, month - 1, 1), to: date(year, month, 0) }
  return getPresetRange(preset === '30d' ? 30 : 7, now)
}
export function overviewFilters(params: URLSearchParams, now = new Date()): OverviewFilters {
  const fallback = overviewRange('7d', now)
  const scope = validateAnalyticsScope({ from: params.get('from') || fallback.from, to: params.get('to') || fallback.to, source: params.get('source'), groupId: params.get('group') }, now)
  if ((Date.parse(scope.to) - Date.parse(scope.from)) / 86400000 + 1 > 366) throw new Error('Choose a range of up to 366 days.')
  const traffic = params.get('traffic') || 'non_bot'
  if (!['non_bot', 'all', 'bots'].includes(traffic)) throw new Error('Choose a valid traffic filter.')
  const asOf = parseAnalyticsAsOf(params.get('asOf'), now)
  if (asOf) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: ANALYTICS_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(asOf))
    const part = (key: string) => parts.find(p => p.type === key)?.value
    if (`${part('year')}-${part('month')}-${part('day')}` < scope.from) throw new Error('The saved snapshot is before this date range. Refresh the report.')
  }
  return { from: scope.from, to: scope.to, source: scope.source, groupId: scope.groupId, traffic: traffic as TrafficMode, asOf }
}
export function trafficChange(current: number, previous: number): string {
  if (!previous) return current ? 'New' : 'No baseline'
  const percentage = ((current - previous) / previous) * 100
  return `${percentage > 0 ? '+' : percentage < 0 ? '−' : ''}${Number(Math.abs(percentage).toFixed(1))}%`
}
export function rankLinks(links: OverviewLink[], mode: RankingMode, search: string): OverviewLink[] {
  const query = search.trim().toLowerCase()
  const delta = (link: OverviewLink) => link.clicks - link.previous_clicks
  return links.filter(link => !query || [link.code, link.title, link.destination_url].some(value => value?.toLowerCase().includes(query)))
    .filter(link => mode === 'zero' ? link.clicks === 0 : mode === 'growth' ? delta(link) > 0 : mode === 'decline' ? delta(link) < 0 : true)
    .sort((a, b) => (mode === 'growth' ? delta(b) - delta(a) : mode === 'decline' ? delta(a) - delta(b) : b.clicks - a.clicks) || b.previous_clicks - a.previous_clicks || a.code.localeCompare(b.code))
}
function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value)
  if (typeof value === 'string' && /^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
export function overviewCsv(links: OverviewLink[], filters: OverviewFilters, asOf: string, total: number): string {
  return [['rank', 'code', 'title', 'destination', 'status', 'clicks', 'previous_clicks', 'change', 'share_percent', 'leading_source', 'last_click', 'from', 'to', 'traffic', 'source_filter', 'group_filter', 'as_of'],
    ...links.map((link, i) => [i + 1, link.code, link.title, link.destination_url, link.is_active ? 'Active' : 'Inactive', link.clicks, link.previous_clicks, trafficChange(link.clicks, link.previous_clicks), total ? Number((link.clicks / total * 100).toFixed(2)) : 0, link.leading_source, link.latest_click, filters.from, filters.to, filters.traffic, filters.source, filters.groupId, asOf]),
  ].map(row => row.map(csvCell).join(',')).join('\r\n')
}
export function formatCount(value: number): string { return new Intl.NumberFormat('en-GB').format(value) }
export function destinationHost(value: string): string { try { return new URL(value).hostname } catch { return value } }
export function reportTime(value: string | null): string {
  return value ? new Intl.DateTimeFormat('en-GB', { timeZone: ANALYTICS_TIMEZONE, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : 'No clicks in period'
}
