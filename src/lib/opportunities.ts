import { trafficChange } from './overview.ts'

export type { MissingLinkRow as Opportunity } from './missing-links.ts'
import type { MissingLinkRow as Opportunity } from './missing-links.ts'
export type OpportunityStatus = 'open' | 'all' | 'resolved'
export type OpportunityOrder = 'requests' | 'growth' | 'decline'
const RESERVED = new Set(['login', 'dashboard', 'settings', 'api', 'auth', 'links', 'admin', '_next', '.netlify'])
export function canConfigureCode(code: string): boolean {
  // Creation lowercases codes and the current redirect only accepts this alphabet.
  return /^[a-z0-9_-]{1,50}$/.test(code) && !RESERVED.has(code)
}
export function rankOpportunities(rows: Opportunity[], status: OpportunityStatus, order: OpportunityOrder, search: string): Opportunity[] {
  const query = search.trim().toLowerCase()
  const delta = (row: Opportunity) => row.requests - row.previous_requests
  return rows.filter(row => status === 'all' || (status === 'resolved' ? row.status === 'resolved' : row.status !== 'resolved'))
    .filter(row => !query || row.code.toLowerCase().includes(query))
    .filter(row => order === 'growth' ? delta(row) > 0 : order === 'decline' ? delta(row) < 0 : true)
    .sort((a, b) => (order === 'growth' ? delta(b) - delta(a) : order === 'decline' ? delta(a) - delta(b) : b.requests - a.requests)
      || b.previous_requests - a.previous_requests || a.code.localeCompare(b.code))
}
function cell(value: unknown): string {
  let text = value == null ? '' : String(value)
  if (typeof value === 'string' && /^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
export function opportunityCsv(rows: Opportunity[], filters: { from: string; to: string; traffic: string }, asOf: string): string {
  return [['code', 'current_status', 'requests', 'previous_requests', 'change', 'leading_source', 'last_request', 'from', 'to', 'traffic', 'as_of'],
    ...rows.map(row => [row.code, row.status, row.requests, row.previous_requests, trafficChange(row.requests, row.previous_requests), row.leading_source, row.last_seen, filters.from, filters.to, filters.traffic, asOf])]
    .map(row => row.map(cell).join(',')).join('\r\n')
}
