import { trafficChange } from './overview.ts'

export type { MissingLinkRow as Opportunity } from './missing-links.ts'
import type { MissingLinkRow as Opportunity } from './missing-links.ts'
export type OpportunityStatus = 'open' | 'all' | 'resolved'
export type OpportunityOrder = 'requests' | 'growth' | 'decline' | 'today' | 'yesterday' | 'last_7d' | 'last_30d'
export const PERIOD_ORDERS = {
  today: 'today_requests', yesterday: 'yesterday_requests', last_7d: 'last_7d_requests', last_30d: 'last_30d_requests',
} as const
const RESERVED = new Set(['login', 'dashboard', 'settings', 'api', 'auth', 'links', 'admin', '_next', '.netlify'])
export function canConfigureCode(code: string): boolean {
  // Creation lowercases codes and the current redirect only accepts this alphabet.
  return /^[a-z0-9_-]{1,50}$/.test(code) && !RESERVED.has(code)
}
// Generic paths that satisfy canConfigureCode but are never store short codes (scanner and bot noise).
export const NON_STORE_CODES: readonly string[] = [
  'register', 'login', 'logout', 'admin', 'administrator', 'wp-admin', 'wp-login', 'wp-content', 'wp-includes', 'api', 'dashboard',
  'signup', 'signin', 'sign-in', 'sign-up', 'index', 'home', 'favicon', 'sitemap', 'feed', 'test', 'config', 'backup', 'phpmyadmin',
  'cgi-bin', 'vendor', 'static', 'assets',
]
const NON_STORE = new Set(NON_STORE_CODES)
// True when the code could be a store short code: routable alphabet, not reserved, not generic scanner noise.
export function isShortCodeCandidate(code: string): boolean {
  return canConfigureCode(code) && !NON_STORE.has(code)
}
export function periodValue(row: Opportunity, order: keyof typeof PERIOD_ORDERS): number {
  return row[PERIOD_ORDERS[order]] ?? 0
}
export function rankOpportunities(rows: Opportunity[], status: OpportunityStatus, order: OpportunityOrder, search: string): Opportunity[] {
  const query = search.trim().toLowerCase()
  const delta = (row: Opportunity) => row.requests - row.previous_requests
  const period = order in PERIOD_ORDERS ? order as keyof typeof PERIOD_ORDERS : null
  return rows.filter(row => status === 'all' || (status === 'resolved' ? row.status === 'resolved' : row.status !== 'resolved'))
    .filter(row => !query || row.code.toLowerCase().includes(query))
    .filter(row => order === 'growth' ? delta(row) > 0 : order === 'decline' ? delta(row) < 0 : true)
    .sort((a, b) => (period ? periodValue(b, period) - periodValue(a, period) || b.requests - a.requests
      : order === 'growth' ? delta(b) - delta(a) : order === 'decline' ? delta(a) - delta(b) : b.requests - a.requests)
      || b.previous_requests - a.previous_requests || a.code.localeCompare(b.code))
}
function cell(value: unknown): string {
  let text = value == null ? '' : String(value)
  if (typeof value === 'string' && /^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
export function opportunityCsv(rows: Opportunity[], filters: { from: string; to: string; traffic: string }, asOf: string): string {
  return [['code', 'current_status', 'requests', 'previous_requests', 'change', 'today', 'yesterday', 'last_7_days', 'last_30_days', 'leading_source', 'last_request', 'from', 'to', 'traffic', 'as_of'],
    ...rows.map(row => [row.code, row.status, row.requests, row.previous_requests, trafficChange(row.requests, row.previous_requests), row.today_requests, row.yesterday_requests, row.last_7d_requests, row.last_30d_requests, row.leading_source, row.last_seen, filters.from, filters.to, filters.traffic, asOf])]
    .map(row => row.map(cell).join(',')).join('\r\n')
}
