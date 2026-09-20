'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, ArrowRight, Check, Copy, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { analyticsDetailHref } from '@/lib/analytics'
import { destinationHost, formatCount, reportTime, trafficChange, type OverviewFilters, type RankingMode } from '@/lib/overview'
import type { OverviewLink } from '@/lib/overview-types'
import type { Group } from '@/lib/types'

export function ChangeBadge({ current, previous }: { current: number; previous: number }) {
  const delta = current - previous
  return <span className={`change-badge ${delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral'}`}>
    {delta > 0 ? <ArrowUpRight size={13} /> : delta < 0 ? <ArrowDownRight size={13} /> : null}{trafficChange(current, previous)}
  </span>
}
export default function LinkRanking({ rows, total, filters, asOf, groups, mode, search, update, onSource }: {
  rows: OverviewLink[]; total: number; filters: OverviewFilters; asOf: string; groups: Group[]; mode: RankingMode; search: string
  update: (values: Record<string, string | null>) => void; onSource: (source: string) => void
}) {
  const [pagination, setPagination] = useState({ search, page: 1 })
  const page = pagination.search === search ? pagination.page : 1
  const setPage = (value: number) => setPagination({ search, page: value })
  const [copied, setCopied] = useState<string | null>(null)
  const pages = Math.max(1, Math.ceil(rows.length / 10))
  const safePage = Math.min(page, pages)
  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/${code}`); setCopied(code); toast.success('Short link copied') }
    catch { toast.error('Could not copy. Open the link details to copy the URL.') }
  }
  return <section className="report-panel" aria-labelledby="ranking-title">
    <div className="panel-heading flex-wrap gap-4">
      <div><h2 id="ranking-title">Link performance</h2><p>Your shortlinks, ranked for the selected period.</p></div>
      <label className="sr-only" htmlFor="ranking-order">Rank links by</label>
      <select id="ranking-order" value={mode} onChange={e => update({ rank: e.target.value })} className="input w-auto!">
        <option value="clicks">Most clicks</option><option value="growth">Biggest gains</option><option value="decline">Biggest drops</option><option value="zero">No clicks</option>
      </select>
    </div>
    <div className="px-5 pb-4 flex flex-wrap items-center justify-between gap-3">
      <form className="flex gap-2 w-full sm:w-96" onSubmit={event => { event.preventDefault(); const query = String(new FormData(event.currentTarget).get('query') || ''); update({ q: query || null }) }}><label className="relative flex-1 min-w-0"><Search size={15} className="absolute left-3 top-3 text-[var(--muted-foreground)]" aria-hidden="true" /><input key={search} name="query" className="input pl-9!" aria-label="Search ranked links" placeholder="Search shortlinks or destinations…" defaultValue={search} /></label><button type="submit" className="btn btn-secondary">Search</button>{search && <button type="button" className="btn btn-ghost" onClick={() => update({ q: null })}>Clear</button>}</form>
      <span className="text-xs text-[var(--muted-foreground)]">{formatCount(rows.length)} links · {mode === 'growth' || mode === 'decline' ? 'ranked by change in clicks' : 'share of filtered traffic'}</span>
    </div>
    <div className="overflow-x-auto">
      <table className="ranking-table">
        <thead><tr><th>#</th><th>Shortlink / destination</th><th className="numeric">Clicks</th><th className="numeric">Previous</th><th>Change</th><th>Share</th><th>Top source</th><th>Last click</th><th><span className="sr-only">Details</span></th></tr></thead>
        <tbody>{rows.slice((safePage - 1) * 10, safePage * 10).map((row, index) => {
          const href = analyticsDetailHref(row.id, { ...filters, linkId: null }, asOf)
          const group = groups.find(g => g.id === row.group_id)
          const share = total ? row.clicks / total * 100 : 0
          return <tr key={row.id}>
            <td className="text-[var(--muted-foreground)] tabular-nums">{(safePage - 1) * 10 + index + 1}</td>
            <td className="min-w-48 max-w-72"><div className="flex items-center gap-2"><Link href={href} className="font-semibold hover:text-[var(--primary)]">/{row.code}</Link><button type="button" title={`Copy /${row.code}`} aria-label={`Copy /${row.code}`} onClick={() => void copy(row.code)} className="icon-button">{copied === row.code ? <Check size={13} /> : <Copy size={13} />}</button>{!row.is_active && <span className="status-inactive">Inactive</span>}</div><p className="truncate text-xs text-[var(--muted-foreground)] mt-1" title={row.destination_url}>{row.title || destinationHost(row.destination_url)}{group ? ` · ${group.name}` : ''}</p></td>
            <td className="numeric font-semibold">{formatCount(row.clicks)}</td><td className="numeric text-[var(--muted-foreground)]">{formatCount(row.previous_clicks)}</td>
            <td><ChangeBadge current={row.clicks} previous={row.previous_clicks} /><div className="text-[10px] text-[var(--muted-foreground)] mt-1 tabular-nums">{row.clicks - row.previous_clicks > 0 ? '+' : ''}{formatCount(row.clicks - row.previous_clicks)} clicks</div></td>
            <td><div className="w-16 text-xs tabular-nums">{share.toFixed(1)}%<div className="share-track"><span style={{ width: `${share}%` }} /></div></div></td>
            <td className="max-w-44">{row.leading_source ? <button type="button" className="text-[var(--primary)] truncate max-w-full text-xs hover:underline" title={`Filter by ${row.leading_source}`} onClick={() => onSource(row.leading_source!)}>{row.leading_source}</button> : <span className="text-[var(--muted-foreground)]">—</span>}</td>
            <td className="whitespace-nowrap text-xs text-[var(--muted-foreground)]">{reportTime(row.latest_click)}</td>
            <td><Link className="icon-button" href={href} aria-label={`View /${row.code} details`}><ArrowRight size={16} /></Link></td>
          </tr>
        })}</tbody>
      </table>
      {rows.length === 0 && <div className="text-center py-14 px-5"><p className="font-medium">No links match this view</p><p className="text-sm text-[var(--muted-foreground)] mt-2">Try a different ranking or clear your search.</p></div>}
    </div>
    <div className="panel-footer"><span>{rows.length ? `${(safePage - 1) * 10 + 1}–${Math.min(safePage * 10, rows.length)} of ${formatCount(rows.length)}` : '0 links'}</span><div className="flex gap-2"><button className="btn btn-secondary btn-sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Previous</button><button className="btn btn-secondary btn-sm" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>Next</button></div></div>
  </section>
}
