'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowDownRight, ArrowUpRight, Download, Globe2, Link2, MousePointerClick, RefreshCw, SearchX, TrendingUp } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { overviewCsv, overviewFilters, overviewRange, rankLinks, formatCount, reportTime, TRAFFIC_LABELS, type RankingMode } from '@/lib/overview'
import type { OverviewResponse } from '@/lib/overview-types'
import type { Group } from '@/lib/types'
import ReportFilters from './ReportFilters'
import LinkRanking, { ChangeBadge } from './LinkRanking'

export default function Overview({ groups, onCreate, revision }: { groups: Group[]; onCreate: () => void; revision: string }) {
  const params = useSearchParams()
  const router = useRouter()
  const queryString = params.toString()
  const reportQuery = new URLSearchParams()
  for (const key of ['from', 'to', 'source', 'group', 'traffic', 'asOf']) { const value = params.get(key); if (value) reportQuery.set(key, value) }
  const reportKey = reportQuery.toString()
  const parsed = useMemo(() => {
    try { return { filters: overviewFilters(new URLSearchParams(reportKey)), error: null } }
    catch (error) { return { filters: overviewFilters(new URLSearchParams()), error: error instanceof Error ? error.message : 'Invalid filters' } }
  }, [reportKey])
  const filters = parsed.filters
  const [refresh, setRefresh] = useState(0)
  const requestKey = JSON.stringify(filters) + refresh + (parsed.error || '') + revision
  const [result, setResult] = useState<{ key: string; data?: OverviewResponse; error?: string }>({ key: '' })
  const [showAllSources, setShowAllSources] = useState(false)
  const data = result.key === requestKey ? result.data : undefined
  const error = parsed.error || (result.key === requestKey ? result.error : null)
  const loading = !data && !error
  const rank = params.get('rank')
  const mode: RankingMode = rank === 'growth' || rank === 'decline' || rank === 'zero' ? rank : 'clicks'
  const search = params.get('q') || ''

  const update = (values: Record<string, string | null>) => {
    const query = new URLSearchParams(queryString)
    query.set('view', 'overview')
    if (Object.keys(values).some(key => ['from', 'to', 'source', 'group', 'traffic'].includes(key))) query.delete('asOf')
    for (const [key, value] of Object.entries(values)) { if (value) query.set(key, value); else query.delete(key) }
    router.replace(`/dashboard?${query}`, { scroll: false })
  }
  useEffect(() => {
    if (parsed.error) return
    const controller = new AbortController()
    const query = new URLSearchParams({ from: filters.from, to: filters.to, traffic: filters.traffic })
    if (filters.groupId) query.set('group', filters.groupId)
    if (filters.source) query.set('source', filters.source)
    if (filters.asOf) query.set('asOf', filters.asOf)
    fetch(`/api/overview?${query}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(response.status === 401 ? 'Your session expired. Sign in again to view your reports.' : body.error || 'Could not load your report. Please retry.')
        if (!controller.signal.aborted) setResult({ key: requestKey, data: body as OverviewResponse })
      })
      .catch(error => { if (!controller.signal.aborted) setResult({ key: requestKey, error: error instanceof Error ? error.message : 'Could not load report.' }) })
    return () => controller.abort()
  }, [requestKey, filters, parsed.error])

  const rows = useMemo(() => data ? rankLinks(data.report.links, mode, search) : [], [data, mode, search])
  const exportCsv = () => {
    if (!data) return
    const url = URL.createObjectURL(new Blob(['\uFEFF', overviewCsv(rows, filters, data.asOf, data.report.summary.clicks)], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `wiseurl-${mode}-${filters.from}-${filters.to}.csv`; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const reload = () => { if (filters.asOf) update({ asOf: null }); else setRefresh(value => value + 1) }
  const summary = data?.report.summary
  const topDrop = data ? rankLinks(data.report.links, 'decline', '')[0] : undefined
  const topGain = data ? rankLinks(data.report.links, 'growth', '')[0] : undefined
  const sources = data?.report.sources || []

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="eyebrow">YOUR AFFILIATE WORKSPACE</p><h1 className="page-title">Performance overview</h1><p className="page-description">See what brings clicks. Spot what needs attention.</p></div>
      <div className="flex gap-2"><button type="button" className="btn btn-secondary" onClick={reload} disabled={loading} aria-label="Refresh report"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Refresh</button><button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={!data}><Download size={15} />Export ranking</button></div>
    </div>
    <ReportFilters key={reportKey} filters={filters} groups={groups} update={update} />
    {error && <div role="alert" className="report-panel p-8"><AlertCircle className="text-amber-600 mb-3" /><h2 className="font-semibold">Report unavailable</h2><p className="text-sm text-[var(--muted-foreground)] mt-2 mb-4">{error}</p>{parsed.error ? <button className="btn btn-secondary" onClick={() => update({ ...overviewRange('7d'), traffic: null, group: null, source: null, asOf: null })}>Reset report filters</button> : <button className="btn btn-secondary" onClick={reload}>Try again</button>}</div>}
    {loading && <div role="status" aria-label="Loading performance report" className="space-y-5"><div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="report-panel p-6 h-36 animate-pulse"><div className="h-3 w-24 bg-[var(--muted)] rounded" /><div className="mt-5 h-9 w-32 bg-[var(--muted)] rounded" /></div>)}</div><div className="report-panel h-72 animate-pulse bg-[var(--muted)]" /><span className="sr-only">Loading your report…</span></div>}
    {data && summary && <>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-[var(--muted-foreground)]">
        <span>{filters.from} — {filters.to}{summary.is_partial ? ' · In progress' : ''} · Compared with {reportTime(summary.previous_range_start)} — {reportTime(summary.previous_range_end)}</span>
        <span>Updated {reportTime(data.refreshedAt)}</span>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Metric label={TRAFFIC_LABELS[filters.traffic]} value={summary.clicks} icon={<MousePointerClick size={18} />}><ChangeBadge current={summary.clicks} previous={summary.previous_clicks} /><span>vs {formatCount(summary.previous_clicks)} previously</span></Metric>
        <Metric label="Links receiving clicks" value={summary.links_with_clicks} icon={<Link2 size={18} />}><span>of {formatCount(summary.total_links)} links in scope</span></Metric>
        <Metric label="Identified traffic sources" value={summary.source_count} icon={<Globe2 size={18} />}><span>{formatCount(summary.unknown_clicks)} clicks with unknown source</span></Metric>
        <Metric label="Links without clicks" value={summary.total_links - summary.links_with_clicks} icon={<SearchX size={18} />}><button className="text-[var(--primary)] hover:underline" onClick={() => update({ rank: 'zero', q: null })}>Review quiet links →</button></Metric>
      </div>
      {summary.total_links === 0 && <div className="report-panel p-8 text-center"><Link2 className="mx-auto text-[var(--primary)] mb-3" /><h2 className="text-lg font-semibold">Your next campaign starts with a link</h2><p className="text-sm text-[var(--muted-foreground)] my-3">Create a shortlink or choose another group to see its performance here.</p><button className="btn btn-primary" onClick={onCreate}>Create a shortlink</button></div>}
      <div className="grid lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)] gap-5">
        <section className="report-panel min-w-0" aria-labelledby="traffic-title"><div className="panel-heading"><div><h2 id="traffic-title">Traffic over time</h2><p>{TRAFFIC_LABELS[filters.traffic]} · daily totals</p></div><span className="chart-legend"><span />Clicks</span></div>
          <div className="h-60 px-3 pb-3" role="img" aria-label={`Daily traffic chart. ${formatCount(summary.clicks)} clicks from ${filters.from} to ${filters.to}.`}>
            <ResponsiveContainer width="100%" height="100%"><AreaChart data={data.report.daily} margin={{ top: 10, right: 16, bottom: 0, left: -15 }}><defs><linearGradient id="click-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c3aed" stopOpacity={0.2} /><stop offset="100%" stopColor="#7c3aed" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" /><XAxis dataKey="date" tickFormatter={value => String(value).slice(5)} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={30} /><YAxis allowDecimals={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontSize: 12 }} /><Area type="monotone" dataKey="clicks" name="Clicks" stroke="#7c3aed" fill="url(#click-fill)" strokeWidth={2.5} dot={data.report.daily.length === 1} isAnimationActive={false} /></AreaChart></ResponsiveContainer>
          </div>
          <details className="px-5 pb-4 text-xs text-[var(--muted-foreground)]"><summary className="cursor-pointer">View daily values</summary><div className="mt-2 max-h-40 overflow-auto"><table className="w-full text-left"><thead><tr><th>Date</th><th>Clicks</th></tr></thead><tbody>{data.report.daily.map(day => <tr key={day.date}><td className="py-1">{day.date}</td><td>{formatCount(day.clicks)}</td></tr>)}</tbody></table></div></details>
        </section>
        <section className="report-panel" aria-labelledby="attention-title"><div className="panel-heading"><div><h2 id="attention-title">On your radar</h2><p>Changes worth a closer look</p></div><TrendingUp size={17} className="text-[var(--muted-foreground)]" /></div>
          <div className="px-5 pb-5 space-y-3">
            {topDrop ? <button className="insight-card" onClick={() => update({ rank: 'decline', q: null })}><span className="insight-icon negative"><ArrowDownRight size={18} /></span><span className="min-w-0"><span className="insight-label">BIGGEST DROP</span><strong className="block truncate">{topDrop.title || topDrop.code}</strong><span className="block text-xs mt-1 text-[var(--muted-foreground)]">{formatCount(topDrop.previous_clicks - topDrop.clicks)} fewer clicks · {formatCount(topDrop.previous_clicks)} → {formatCount(topDrop.clicks)}</span></span><span className="ml-auto"><ChangeBadge current={topDrop.clicks} previous={topDrop.previous_clicks} /></span></button> : <p className="insight-empty">No links declined in this comparison.</p>}
            {topGain ? <button className="insight-card" onClick={() => update({ rank: 'growth', q: null })}><span className="insight-icon positive"><ArrowUpRight size={18} /></span><span className="min-w-0"><span className="insight-label">BIGGEST GAIN</span><strong className="block truncate">{topGain.title || topGain.code}</strong><span className="block text-xs mt-1 text-[var(--muted-foreground)]">{formatCount(topGain.clicks - topGain.previous_clicks)} more clicks · {formatCount(topGain.previous_clicks)} → {formatCount(topGain.clicks)}</span></span><span className="ml-auto"><ChangeBadge current={topGain.clicks} previous={topGain.previous_clicks} /></span></button> : <p className="insight-empty">No links grew in this comparison yet.</p>}
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)] pt-1">Changes are ranked by click volume. Small totals can fluctuate; compare longer periods before making campaign decisions.</p>
          </div>
        </section>
      </div>
      <div className="flex flex-wrap items-center gap-2" aria-label="Quick performance views"><span className="text-xs font-medium text-[var(--muted-foreground)] mr-1">EXPLORE</span>{([{ key: 'clicks', label: 'Top performers' }, { key: 'growth', label: 'Gaining traffic' }, { key: 'decline', label: 'Losing traffic' }, { key: 'zero', label: 'No clicks' }] as const).map(item => <button type="button" key={item.key} aria-pressed={mode === item.key} className={`period-button ${mode === item.key ? 'selected' : ''}`} onClick={() => update({ rank: item.key, q: null })}>{item.label}</button>)}</div>
      <LinkRanking key={`${data.asOf}:${mode}`} rows={rows} total={summary.clicks} filters={filters} asOf={data.asOf} groups={groups} mode={mode} search={search} update={update} onSource={source => update({ source })} />
      <section className="report-panel" aria-labelledby="sources-title"><div className="panel-heading"><div><h2 id="sources-title">Where your traffic comes from</h2><p>Select a source to see the shortlinks it sends traffic to.</p></div><Globe2 size={18} className="text-[var(--muted-foreground)]" /></div>
        <div className="overflow-x-auto"><table className="ranking-table source-table"><thead><tr><th>Source site / label</th><th>Attribution</th><th className="numeric">Clicks</th><th className="numeric">Previous</th><th>Change</th><th>Share</th><th>Leading link</th></tr></thead><tbody>{sources.slice(0, showAllSources ? undefined : 8).map(source => <tr key={source.source}><td><button className="font-medium text-[var(--primary)] hover:underline text-left break-all" onClick={() => update({ source: source.source })}>{source.source}</button></td><td><span className="text-xs text-[var(--muted-foreground)]">{source.provenance === 'explicit' ? 'Source tag' : source.provenance === 'referrer' ? 'Referrer' : source.provenance === 'mixed' ? 'Mixed' : 'Unavailable'}</span></td><td className="numeric font-semibold">{formatCount(source.clicks)}</td><td className="numeric text-[var(--muted-foreground)]">{formatCount(source.previous_clicks)}</td><td><ChangeBadge current={source.clicks} previous={source.previous_clicks} /></td><td className="text-xs tabular-nums">{summary.clicks ? (source.clicks / summary.clicks * 100).toFixed(1) : '0.0'}%</td><td className="text-xs">{source.leading_link_code ? `/${source.leading_link_code}` : '—'}</td></tr>)}</tbody></table>{sources.length === 0 && <p className="py-10 px-5 text-center text-sm text-[var(--muted-foreground)]">No source traffic recorded in these periods.</p>}</div>
        <div className="panel-footer"><span>Source tags take priority over referrers. Unknown means no source was available.</span>{sources.length > 8 && <button className="text-[var(--primary)] shrink-0" onClick={() => setShowAllSources(!showAllSources)}>{showAllSources ? 'Show less' : `View all ${sources.length} sources`}</button>}</div>
      </section>
      <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">Reports show recorded click events, not unique visitors, sales or commissions. Bot detection is an estimate. Historical clicks remain available; source information is shown only when it was recorded. Link destinations and groups reflect your current setup.</p>
    </>}
  </div>
}
function Metric({ label, value, icon, children }: { label: string; value: number; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="metric-card"><div className="flex items-start justify-between gap-2"><h2>{label}</h2><span className="metric-icon">{icon}</span></div><p className="metric-value">{formatCount(value)}</p><div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)] mt-3">{children}</div></section>
}
