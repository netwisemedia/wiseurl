'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, Download, Plus, RefreshCw, Search, Pencil } from 'lucide-react'
import { overviewFilters, overviewRange, formatCount, reportTime } from '@/lib/overview'
import { canConfigureCode, opportunityCsv, rankOpportunities, type OpportunityOrder, type OpportunityStatus } from '@/lib/opportunities'
import ReportFilters from './overview/ReportFilters'
import { ChangeBadge } from './overview/LinkRanking'

import type { MissingLinksResponse as ResponseData } from '@/lib/missing-links'

export default function MissingLinkOpportunities({ revision, onCreate, onEdit }: {
  revision: string; onCreate: (code: string) => void; onEdit: (id: string) => void
}) {
  const params = useSearchParams()
  const router = useRouter()
  const reportQuery = new URLSearchParams()
  for (const key of ['from', 'to', 'traffic', 'asOf']) { const value = params.get(key); if (value) reportQuery.set(key, value) }
  const reportKey = reportQuery.toString()
  const parsed = useMemo(() => {
    try { return { filters: overviewFilters(new URLSearchParams(reportKey)), error: null } }
    catch (error) { return { filters: overviewFilters(new URLSearchParams()), error: error instanceof Error ? error.message : 'Invalid filters' } }
  }, [reportKey])
  const filters = parsed.filters
  const [refresh, setRefresh] = useState(0)
  const requestKey = JSON.stringify(filters) + refresh + revision + (parsed.error || '')
  const [result, setResult] = useState<{ key: string; data?: ResponseData; error?: string }>({ key: '' })
  const data = result.key === requestKey ? result.data : undefined
  const error = parsed.error || (result.key === requestKey ? result.error : null)
  const loading = !data && !error
  const [status, setStatus] = useState<OpportunityStatus>('open')
  const [order, setOrder] = useState<OpportunityOrder>('requests')
  const [search, setSearch] = useState('')
  const pageKey = requestKey + status + order + search
  const [pagination, setPagination] = useState({ key: '', page: 1 })
  const rows = useMemo(() => data ? rankOpportunities(data.report.rows, status, order, search) : [], [data, status, order, search])
  const pages = Math.max(1, Math.ceil(rows.length / 15))
  const page = Math.min(pagination.key === pageKey ? pagination.page : 1, pages)
  const setPage = (value: number) => setPagination({ key: pageKey, page: value })
  const update = (values: Record<string, string | null>) => {
    const query = new URLSearchParams(params.toString())
    query.set('view', 'opportunities')
    query.delete('asOf')
    for (const [key, value] of Object.entries(values)) { if (value) query.set(key, value); else query.delete(key) }
    router.replace(`/dashboard?${query}`, { scroll: false })
  }
  const reload = () => { if (filters.asOf) update({ asOf: null }); else setRefresh(value => value + 1) }
  useEffect(() => {
    if (parsed.error) return
    const controller = new AbortController()
    const query = new URLSearchParams({ from: filters.from, to: filters.to, traffic: filters.traffic })
    if (filters.asOf) query.set('asOf', filters.asOf)
    fetch(`/api/missing-links?${query}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(response.status === 401 ? 'Your session expired. Sign in again to view reports.' : body.error || 'Could not load opportunities.')
        if (!controller.signal.aborted) setResult({ key: requestKey, data: body })
      })
      .catch(error => { if (!controller.signal.aborted) setResult({ key: requestKey, error: error instanceof Error ? error.message : 'Could not load opportunities.' }) })
    return () => controller.abort()
  }, [requestKey, filters, parsed.error])
  const exportCsv = () => {
    if (!data) return
    const url = URL.createObjectURL(new Blob(['\uFEFF', opportunityCsv(rows, filters, data.asOf)], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `wiseurl-opportunities-${filters.from}-${filters.to}.csv`; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const open = data?.report.rows.filter(row => row.status !== 'resolved') || []
  const demand = open.reduce((sum, row) => sum + row.requests, 0)
  const previous = open.reduce((sum, row) => sum + row.previous_requests, 0)
  const resolved = data?.report.rows.filter(row => row.status === 'resolved') || []
  return <div className="space-y-5">
    <div className="flex flex-wrap justify-between items-start gap-4"><div><p className="eyebrow">DEMAND WITHOUT AFFILIATE LINKS</p><h1 className="page-title">Affiliate opportunities</h1><p className="page-description">See which missing destinations deserve an affiliate link first.</p></div><div className="flex gap-2"><button className="btn btn-secondary" onClick={reload} disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Refresh</button><button className="btn btn-secondary" onClick={exportCsv} disabled={!data}><Download size={15} />Export</button></div></div>
    <ReportFilters key={reportKey} filters={filters} groups={[]} update={update} opportunities />
    {error && <div role="alert" className="report-panel p-8"><AlertCircle className="mb-3 text-amber-600" /><h2 className="font-semibold">Opportunities unavailable</h2><p className="my-3 text-sm text-[var(--muted-foreground)]">{error}</p><button className="btn btn-secondary" onClick={parsed.error ? () => update({ ...overviewRange('7d'), traffic: null }) : reload}>{parsed.error ? 'Reset filters' : 'Try again'}</button></div>}
    {loading && <div role="status" className="report-panel p-12 text-center animate-pulse">Loading affiliate opportunities…</div>}
    {data && <>
      <p className="text-xs text-[var(--muted-foreground)]">{filters.from} — {filters.to}{data.report.summary.is_partial ? ' · In progress' : ''} · Compared with {reportTime(data.report.summary.previous_range_start)} — {reportTime(data.report.summary.previous_range_end)} · Updated {reportTime(data.refreshedAt)}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <section className="metric-card"><h2>Requests needing a destination</h2><p className="metric-value">{formatCount(demand)}</p><div className="mt-3 flex flex-wrap gap-2 text-xs"><ChangeBadge current={demand} previous={previous} /><span className="text-[var(--muted-foreground)]">vs {formatCount(previous)} previously</span></div></section>
        <section className="metric-card"><h2>Unconfigured links with demand</h2><p className="metric-value">{formatCount(open.filter(row => row.requests > 0).length)}</p><p className="text-xs text-[var(--muted-foreground)] mt-3">Missing or inactive destinations · current period</p></section>
        <section className="metric-card"><h2>Now configured</h2><p className="metric-value">{formatCount(resolved.length)}</p><button className="text-xs text-[var(--primary)] mt-3 hover:underline" onClick={() => { setStatus('resolved'); setOrder('requests'); setSearch('') }}>Review resolved links →</button></section>
      </div>
      <div className="report-panel p-4 text-sm text-[var(--muted-foreground)]">{data.report.summary.sources_configured.length ? <>Source coverage: <strong className="text-[var(--foreground)]">{data.report.summary.sources_configured.join(', ')}</strong>. Requests without an identifiable owned source are excluded.</> : <>No source sites are connected to this account yet. An administrator must verify and connect your source domain before its demand can appear.</>}</div>
      <section className="report-panel" aria-labelledby="opportunities-title">
        <div className="panel-heading"><div><h2 id="opportunities-title">Prioritize your next affiliate links</h2><p>Recorded requests that reached a missing or inactive WiseURL destination.</p></div></div>
        <div className="px-5 pb-4 flex flex-wrap gap-3">
          <label className="relative flex-1 min-w-48"><Search size={15} className="absolute left-3 top-3 text-[var(--muted-foreground)]" /><input className="input pl-9!" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search affiliate opportunities" placeholder="Search company / short code…" /></label>
          <label className="field-label">Status<select className="input" value={status} onChange={e => setStatus(e.target.value as OpportunityStatus)}><option value="open">Needs affiliate link</option><option value="resolved">Now configured</option><option value="all">All recorded codes</option></select></label>
          <label className="field-label">Rank by<select className="input" value={order} onChange={e => setOrder(e.target.value as OpportunityOrder)}><option value="requests">Most demand</option><option value="growth">Growing demand</option><option value="decline">Declining demand</option></select></label>
        </div>
        <div className="overflow-x-auto"><table className="ranking-table"><thead><tr><th>Company / short code</th><th className="numeric">Requests</th><th className="numeric">Previous</th><th>Change</th><th>Top source</th><th>Last request</th><th>Current status</th><th>Action</th></tr></thead><tbody>{rows.slice((page - 1) * 15, page * 15).map(row => <tr key={row.code}>
          <td className="font-semibold break-all min-w-36">/{row.code}</td><td className="numeric font-semibold">{formatCount(row.requests)}</td><td className="numeric text-[var(--muted-foreground)]">{formatCount(row.previous_requests)}</td><td><ChangeBadge current={row.requests} previous={row.previous_requests} /><p className="text-xs text-[var(--muted-foreground)] mt-1">{row.requests - row.previous_requests > 0 ? '+' : ''}{formatCount(row.requests - row.previous_requests)} requests</p></td><td className="text-xs">{row.leading_source || '—'}</td><td className="text-xs whitespace-nowrap">{row.last_seen ? reportTime(row.last_seen) : '—'}</td><td><span className={`badge ${row.status === 'resolved' ? 'text-green-600' : 'text-amber-600'}`}>{row.status === 'resolved' ? 'Configured' : row.status === 'inactive' ? 'Inactive' : 'Not configured'}</span></td>
          <td>{row.link_id ? <button className="btn btn-secondary btn-sm whitespace-nowrap" onClick={() => onEdit(row.link_id!)}><Pencil size={13} />Edit link</button> : canConfigureCode(row.code) ? <button className="btn btn-primary btn-sm whitespace-nowrap" onClick={() => onCreate(row.code)}><Plus size={13} />Add affiliate link</button> : <span className="block min-w-44 max-w-64 text-xs text-[var(--muted-foreground)]">This code is unsupported. Correct the source URL before creating its shortlink.</span>}</td>
        </tr>)}</tbody></table>{rows.length === 0 && <div className="py-12 px-5 text-center"><p className="font-medium">No opportunities match this view</p><p className="text-sm text-[var(--muted-foreground)] mt-2">Try another period, status or company search.</p></div>}</div>
        <div className="panel-footer"><span>{rows.length ? `${(page - 1) * 15 + 1}–${Math.min(page * 15, rows.length)} of ${formatCount(rows.length)} codes` : '0 codes'}</span><div className="flex gap-2"><button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div></div>
      </section>
      <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">Demand means recorded requests to a WiseURL link that could not redirect. It does not confirm a copied or redeemed coupon, a unique visitor, a sale or lost revenue. Bot detection is an estimate. Status reflects your current link setup; configuring a destination preserves this history and future successful clicks appear in Overview.</p>
    </>}
  </div>
}
