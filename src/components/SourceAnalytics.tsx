'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Bot,
  CalendarDays,
  Download,
  ExternalLink,
  Loader2,
  MousePointerClick,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import {
  ANALYTICS_TIMEZONE,
  analyticsSearchParams,
  comparisonLabel,
  getPresetRange,
  type AnalyticsResponse,
  type AnalyticsScope,
} from '@/lib/analytics'
import type { Group, Link as LinkType } from '@/lib/types'

interface Props {
  links: LinkType[]
  groups: Group[]
  fixedLinkId?: string
}

interface ApiErrorBody {
  status?: string
  error?: string
}

function localTime(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ANALYTICS_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function shortDestination(value: string | null): string {
  if (!value) return '—'
  try {
    const url = new URL(value)
    return `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`
  } catch {
    return value
  }
}

export default function SourceAnalytics({ links, groups, fixedLinkId }: Props) {
  const initialRange = useMemo(() => getPresetRange(30), [])
  const [scope, setScope] = useState<AnalyticsScope>({
    ...initialRange,
    source: null,
    linkId: fixedLinkId || null,
    groupId: null,
  })
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [asOf, setAsOf] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)
  const activeRequest = useRef<AbortController | null>(null)
  const requestSequence = useRef(0)

  const requestData = useCallback(async (
    requestedPage: number,
    snapshot: string | null,
    updateRefreshTime: boolean,
  ) => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    const requestId = ++requestSequence.current

    setLoading(true)
    setError(null)
    setSetupNeeded(false)
    setData(null)

    try {
      const query = analyticsSearchParams({
        ...scope,
        asOf: snapshot,
        page: requestedPage,
        pageSize: 50,
      })
      const response = await fetch(`/api/analytics?${query.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      const body = await response.json() as AnalyticsResponse | ApiErrorBody
      if (requestId !== requestSequence.current) return
      if (!response.ok) {
        const problem = body as ApiErrorBody
        setSetupNeeded(problem.status === 'setup_needed')
        throw new Error(problem.error || 'Analytics request failed')
      }

      const result = body as AnalyticsResponse
      setData(result)
      setAsOf(result.asOf)
      setPage(result.pagination.page)
      if (updateRefreshTime) setRefreshedAt(result.refreshedAt)
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return
      if (requestId !== requestSequence.current) return
      setData(null)
      setAsOf(null)
      setError(requestError instanceof Error ? requestError.message : 'Analytics request failed')
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false)
        activeRequest.current = null
      }
    }
  }, [scope])

  useEffect(() => {
    void requestData(1, null, true)
    return () => {
      activeRequest.current?.abort()
      requestSequence.current += 1
    }
  }, [requestData])

  const changeScope = (changes: Partial<AnalyticsScope>) => {
    activeRequest.current?.abort()
    requestSequence.current += 1
    setData(null)
    setAsOf(null)
    setPage(1)
    setError(null)
    setSetupNeeded(false)
    setScope(current => ({
      ...current,
      ...changes,
      linkId: fixedLinkId ?? (Object.hasOwn(changes, 'linkId') ? changes.linkId || null : current.linkId),
    }))
  }

  const applyPreset = (days: 7 | 30) => changeScope({ ...getPresetRange(days), source: null })

  const exportUrl = useMemo(() => {
    if (!data || !asOf) return '#'
    const query = analyticsSearchParams({ ...scope, asOf })
    query.set('format', 'csv')
    return `/api/analytics?${query.toString()}`
  }, [asOf, data, scope])

  return (
    <div className="space-y-6">
      <div className="card p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Source-site analytics</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Source → short link → configured destination · {ANALYTICS_TIMEZONE}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary text-sm" onClick={() => applyPreset(7)}>Last 7 days</button>
            <button type="button" className="btn btn-secondary text-sm" onClick={() => applyPreset(30)}>Last 30 days</button>
            <button type="button" className="btn btn-secondary text-sm" onClick={() => void requestData(1, null, true)} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <a href={exportUrl} aria-disabled={!data || loading} className={`btn btn-secondary text-sm ${!data || loading ? 'pointer-events-none opacity-50' : ''}`}>
              <Download className="w-4 h-4" /> CSV
            </a>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <label className="text-xs text-[var(--muted-foreground)]">
            From
            <input type="date" className="input mt-1 text-sm" value={scope.from} max={scope.to} onChange={event => changeScope({ from: event.target.value, source: null })} />
          </label>
          <label className="text-xs text-[var(--muted-foreground)]">
            To
            <input type="date" className="input mt-1 text-sm" value={scope.to} min={scope.from} max={getPresetRange(7).to} onChange={event => changeScope({ to: event.target.value, source: null })} />
          </label>
          {!fixedLinkId && (
            <label className="text-xs text-[var(--muted-foreground)]">
              Short link
              <select className="input mt-1 text-sm" value={scope.linkId || ''} onChange={event => changeScope({ linkId: event.target.value || null, source: null })}>
                <option value="">All links</option>
                {links.map(link => <option key={link.id} value={link.id}>/{link.code}</option>)}
              </select>
            </label>
          )}
          {!fixedLinkId && (
            <label className="text-xs text-[var(--muted-foreground)]">
              Group
              <select className="input mt-1 text-sm" value={scope.groupId || ''} onChange={event => changeScope({ groupId: event.target.value || null, source: null })}>
                <option value="">All groups</option>
                {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </label>
          )}
          <div className="flex items-end">
            {scope.source ? (
              <button type="button" className="btn btn-secondary text-sm w-full" onClick={() => changeScope({ source: null })}>
                <RotateCcw className="w-4 h-4" /> Clear source: {scope.source}
              </button>
            ) : (
              <div className="text-xs text-[var(--muted-foreground)] pb-3">Select a source row to drill down.</div>
            )}
          </div>
        </div>

        {refreshedAt && (
          <p className="text-xs text-[var(--muted-foreground)]">Last successful refresh: {localTime(refreshedAt)}</p>
        )}
      </div>

      {error && (
        <div className={`card p-5 border ${setupNeeded ? 'border-amber-400' : 'border-red-400'}`}>
          <div className="flex gap-3">
            <AlertCircle className={`w-5 h-5 flex-none ${setupNeeded ? 'text-amber-500' : 'text-red-500'}`} />
            <div>
              <p className="font-semibold">{setupNeeded ? 'Analytics setup needed' : 'Analytics could not load'}</p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">{error}</p>
              <button type="button" className="btn btn-secondary text-sm mt-3" onClick={() => void requestData(1, null, true)}>Try again</button>
            </div>
          </div>
        </div>
      )}

      {!data && loading && (
        <div className="card p-12 flex items-center justify-center gap-3 text-[var(--muted-foreground)]">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading analytics…
        </div>
      )}

      {data && (
        <>
          {data.report.summary.is_partial && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm">
              This range includes today. The comparison uses the same elapsed duration immediately before the selected range.
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5">
              <p className="text-sm text-[var(--muted-foreground)] flex items-center gap-2"><MousePointerClick className="w-4 h-4" /> Recorded clicks</p>
              <p className="text-3xl font-bold mt-2">{data.report.summary.recorded_clicks.toLocaleString()}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">{comparisonLabel(data.report.summary.change_state, data.report.summary.change_percent)} vs equal preceding period</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-[var(--muted-foreground)]">Recorded non-bot clicks</p>
              <p className="text-3xl font-bold mt-2">{data.report.summary.recorded_non_bot_clicks.toLocaleString()}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-[var(--muted-foreground)] flex items-center gap-2"><Bot className="w-4 h-4" /> Recorded bot clicks</p>
              <p className="text-3xl font-bold mt-2">{data.report.summary.bot_clicks.toLocaleString()}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-[var(--muted-foreground)] flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Snapshot</p>
              <p className="text-sm font-semibold mt-2">{localTime(data.asOf)}</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">Held steady across pages and CSV</p>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold mb-4">Daily recorded clicks</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.report.daily}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="clicks" stroke="var(--primary)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="bot_clicks" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="p-4 border-b border-[var(--border)]">
              <h3 className="font-semibold">Source sites</h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">Explicit URL labels take priority; otherwise WiseURL uses a normalized referrer hostname.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Source</th><th>Clicks</th><th>Share</th><th>Change</th><th>Leading link</th><th>Leading destination</th><th>Latest</th></tr></thead>
                <tbody>
                  {data.report.sources.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-[var(--muted-foreground)]">No recorded clicks in this scope.</td></tr>
                  ) : data.report.sources.map(source => (
                    <tr key={`${source.source}-${source.provenance}`} className="cursor-pointer" onClick={() => changeScope({ source: source.source })}>
                      <td><p className="font-medium">{source.source}</p><p className="text-xs text-[var(--muted-foreground)]">{source.provenance}</p></td>
                      <td>{source.clicks.toLocaleString()} <span className="text-xs text-[var(--muted-foreground)]">({source.bot_clicks} bot)</span></td>
                      <td>{source.share.toFixed(1)}%</td>
                      <td>{comparisonLabel(source.change_state, source.change_percent)}</td>
                      <td>{source.leading_link_code ? `/${source.leading_link_code}` : '—'}</td>
                      <td className="max-w-[240px] truncate" title={source.leading_destination || ''}>{shortDestination(source.leading_destination)}</td>
                      <td>{localTime(source.latest_click)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid xl:grid-cols-2 gap-6">
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-[var(--border)]"><h3 className="font-semibold">Short links in scope</h3></div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Link</th><th>Clicks</th><th>Latest destination</th></tr></thead>
                  <tbody>{data.report.links.map(link => (
                    <tr key={link.id}>
                      <td><a className="text-[var(--primary)] font-medium" href={`/links/${link.id}`}>/{link.code}</a></td>
                      <td>{link.clicks.toLocaleString()} <span className="text-xs text-[var(--muted-foreground)]">({link.bot_clicks} bot)</span></td>
                      <td className="max-w-[260px] truncate" title={link.latest_destination_url}>{shortDestination(link.latest_destination_url)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="p-4 border-b border-[var(--border)]">
                <h3 className="font-semibold">Destinations in scope</h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">New clicks use the configured destination at click time. Historical clicks without a snapshot use the current configured destination.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Destination</th><th>Clicks</th><th>Links</th></tr></thead>
                  <tbody>{data.report.destinations.map(destination => (
                    <tr key={destination.destination_url}>
                      <td className="max-w-[300px] truncate" title={destination.destination_url}>
                        <a href={destination.destination_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-[var(--primary)]">
                          {shortDestination(destination.destination_url)} <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td>{destination.clicks.toLocaleString()} <span className="text-xs text-[var(--muted-foreground)]">({destination.bot_clicks} bot)</span></td>
                      <td>{destination.link_count}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="p-4 border-b border-[var(--border)]"><h3 className="font-semibold">Recorded click rows</h3></div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Time</th><th>Source</th><th>Link</th><th>Destination</th><th>Location</th><th>Device</th><th>Type</th></tr></thead>
                <tbody>{data.rows.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-[var(--muted-foreground)]">No rows in this page.</td></tr>
                ) : data.rows.map(row => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap">{localTime(row.clicked_at)}</td>
                    <td><p>{row.source}</p><p className="text-xs text-[var(--muted-foreground)]">{row.source_kind}</p></td>
                    <td>/{row.code}</td>
                    <td className="max-w-[220px] truncate" title={row.destination_url}>{shortDestination(row.destination_url)}</td>
                    <td>{[row.city, row.country].filter(Boolean).join(', ') || '—'}</td>
                    <td>{[row.device_type, row.browser_name].filter(Boolean).join(' · ') || '—'}</td>
                    <td>{row.is_bot ? <span className="badge">Bot</span> : <span className="text-sm">Non-bot</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="p-4 border-t border-[var(--border)] flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--muted-foreground)]">Page {page} of {data.pagination.pages} · {data.pagination.total.toLocaleString()} rows</p>
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary text-sm" disabled={page <= 1 || loading} onClick={() => void requestData(page - 1, asOf, false)}>Previous</button>
                <button type="button" className="btn btn-secondary text-sm" disabled={page >= data.pagination.pages || loading} onClick={() => void requestData(page + 1, asOf, false)}>Next</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
