'use client'

import { useState } from 'react'
import { CalendarDays, SlidersHorizontal, X } from 'lucide-react'
import { PERIODS, overviewRange, type OverviewFilters } from '@/lib/overview'
import type { Group } from '@/lib/types'

export default function ReportFilters({ filters, groups, update, opportunities = false }: {
  opportunities?: boolean
  filters: OverviewFilters
  groups: Group[]
  update: (values: Record<string, string | null>) => void
}) {
  const [from, setFrom] = useState(filters.from)
  const [to, setTo] = useState(filters.to)
  const [source, setSource] = useState(filters.source || '')
  const [custom, setCustom] = useState(false)
  const today = overviewRange('today').to
  return <section className="report-filters" aria-label="Report filters">
    <div className="flex flex-wrap items-center gap-2">
      <CalendarDays size={16} className="text-[var(--muted-foreground)] mr-1" aria-hidden="true" />
      {PERIODS.map(period => {
        const range = overviewRange(period.value)
        const active = filters.from === range.from && filters.to === range.to
        return <button key={period.value} type="button" className={`period-button ${active ? 'selected' : ''}`} aria-pressed={active} onClick={() => { setCustom(false); update({ ...range }) }}>{period.label}</button>
      })}
      <button type="button" className={`period-button ${custom ? 'selected' : ''}`} aria-expanded={custom} onClick={() => setCustom(!custom)}>Custom dates</button>
      <span className="hidden 2xl:block flex-1" />
      <span className="text-xs text-[var(--muted-foreground)]">Europe/Bucharest</span>
    </div>
    {custom && <form className="flex flex-wrap items-end gap-3 pt-4" onSubmit={e => { e.preventDefault(); update({ from, to }) }}>
      <label className="field-label">From<input type="date" required className="input" value={from} max={today} onChange={e => setFrom(e.target.value)} /></label>
      <label className="field-label">To<input type="date" required className="input" value={to} min={from} max={today} onChange={e => setTo(e.target.value)} /></label>
      <button type="submit" className="btn btn-primary">Apply dates</button><span className="text-xs text-[var(--muted-foreground)] pb-3">Up to 366 days</span>
    </form>}
    <div className="flex flex-wrap gap-3 items-end mt-4 pt-4 border-t border-[var(--border)]">
      <SlidersHorizontal size={16} aria-hidden="true" className="hidden sm:block self-center text-[var(--muted-foreground)]" />
      <label className="field-label flex-1 min-w-40">Traffic<select className="input" value={filters.traffic} onChange={e => update({ traffic: e.target.value })}>
        <option value="non_bot">Exclude detected bots</option><option value="all">{opportunities ? 'All recorded requests' : 'All recorded clicks'}</option><option value="bots">Detected bots only</option>
      </select></label>
      {!opportunities && <><label className="field-label flex-1 min-w-40">Link group<select className="input" value={filters.groupId || ''} onChange={e => update({ group: e.target.value || null })}>
        <option value="">All groups</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
      </select></label>
      <form className="flex items-end gap-2 flex-[1.5] min-w-56" onSubmit={e => { e.preventDefault(); update({ source: source.trim() || null }) }}>
        <label className="field-label flex-1 min-w-0">Source site or label<input className="input" placeholder="All sources" maxLength={255} value={source} onChange={e => setSource(e.target.value)} /></label>
        <button type="submit" className="btn btn-secondary">Filter</button>
      </form>
      </>}
      {(filters.source || filters.groupId || filters.traffic !== 'non_bot') && <button type="button" className="btn btn-ghost" onClick={() => update({ source: null, group: null, traffic: null })}><X size={14} />Clear filters</button>}
    </div>
    {filters.source && <div className="mt-3"><button type="button" className="filter-chip" onClick={() => update({ source: null })}>Source: {filters.source}<X size={13} aria-label="Clear source" /></button></div>}
  </section>
}
