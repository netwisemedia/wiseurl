'use client'

import { useMemo } from 'react'
import { Click } from '@/lib/types'
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line
} from 'recharts'
import { Globe, Monitor, Smartphone, Tablet, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
    clicks: Click[]
    links?: { id: string; code: string; title: string | null; created_at: string }[]
    activeSubTab?: 'performance' | 'traffic' | 'geography'
}

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308']

// Country code to flag emoji
const getCountryFlag = (countryCode: string): string => {
    if (!countryCode || countryCode === 'Unknown' || countryCode.length !== 2) return '🌐'
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0))
    return String.fromCodePoint(...codePoints)
}

// Get favicon URL for a domain
const getFaviconUrl = (domain: string): string => {
    if (domain === 'Direct') return ''
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
}

export default function AnalyticsCharts({ clicks, links = [], activeSubTab = 'performance' }: Props) {
    // Device stats
    const deviceData = useMemo(() => {
        const counts: Record<string, number> = {}
        clicks.forEach(click => {
            const device = click.device_type || 'unknown'
            counts[device] = (counts[device] || 0) + 1
        })
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value, percentage: Math.round((value / clicks.length) * 100) }))
            .sort((a, b) => b.value - a.value)
    }, [clicks])

    // Country stats with flags
    const countryData = useMemo(() => {
        const counts: Record<string, number> = {}
        clicks.forEach(click => {
            const country = click.country || 'Unknown'
            counts[country] = (counts[country] || 0) + 1
        })
        return Object.entries(counts)
            .map(([code, value]) => ({
                code,
                flag: getCountryFlag(code),
                value,
                percentage: Math.round((value / clicks.length) * 100)
            }))
            .sort((a, b) => b.value - a.value)
    }, [clicks])

    // Browser stats
    const browserData = useMemo(() => {
        const counts: Record<string, number> = {}
        clicks.forEach(click => {
            const browser = click.browser_name || 'Unknown'
            counts[browser] = (counts[browser] || 0) + 1
        })
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8)
    }, [clicks])

    // OS stats
    const osData = useMemo(() => {
        const counts: Record<string, number> = {}
        clicks.forEach(click => {
            const os = click.os_name || 'Unknown'
            counts[os] = (counts[os] || 0) + 1
        })
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8)
    }, [clicks])

    // Referrer stats with favicons
    const referrerData = useMemo(() => {
        const counts: Record<string, { count: number; fullUrl: string }> = {}
        clicks.forEach(click => {
            let referrer = 'Direct'
            let fullUrl = ''
            if (click.original_referrer) {
                try {
                    const url = new URL(click.original_referrer)
                    referrer = url.hostname
                    fullUrl = url.origin
                } catch {
                    referrer = click.original_referrer
                    fullUrl = click.original_referrer
                }
            }
            if (!counts[referrer]) {
                counts[referrer] = { count: 0, fullUrl }
            }
            counts[referrer].count++
        })
        return Object.entries(counts)
            .map(([name, data]) => ({
                name,
                value: data.count,
                fullUrl: data.fullUrl,
                favicon: getFaviconUrl(name)
            }))
            .sort((a, b) => b.value - a.value)
    }, [clicks])

    // Daily trend (last 14 days)
    const dailyData = useMemo(() => {
        const days: Record<string, number> = {}
        const now = new Date()

        for (let i = 13; i >= 0; i--) {
            const date = new Date(now)
            date.setDate(date.getDate() - i)
            const key = date.toISOString().split('T')[0]
            days[key] = 0
        }

        clicks.forEach(click => {
            const date = new Date(click.clicked_at).toISOString().split('T')[0]
            if (days[date] !== undefined) {
                days[date]++
            }
        })

        return Object.entries(days).map(([date, clicks]) => ({
            date: new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
            clicks
        }))
    }, [clicks])

    // Click rate per link - ONLY links with clicks in selected period
    const linkPerformance = useMemo(() => {
        if (!links.length || !clicks.length) return []

        // Count clicks per link from filtered clicks (already filtered by date range)
        const clicksByLink: Record<string, number> = {}
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const yesterdayStart = new Date(todayStart)
        yesterdayStart.setDate(yesterdayStart.getDate() - 1)

        const todayClicksByLink: Record<string, number> = {}
        const yesterdayClicksByLink: Record<string, number> = {}

        clicks.forEach(click => {
            clicksByLink[click.link_id] = (clicksByLink[click.link_id] || 0) + 1
            const clickDate = new Date(click.clicked_at)
            if (clickDate >= todayStart) {
                todayClicksByLink[click.link_id] = (todayClicksByLink[click.link_id] || 0) + 1
            } else if (clickDate >= yesterdayStart && clickDate < todayStart) {
                yesterdayClicksByLink[click.link_id] = (yesterdayClicksByLink[click.link_id] || 0) + 1
            }
        })

        // Only include links that have clicks in the period
        const linksWithClicks = Object.keys(clicksByLink)

        return links
            .filter(link => linksWithClicks.includes(link.id))
            .map(link => {
                const totalClicks = clicksByLink[link.id] || 0
                const daysActive = Math.max(1, Math.ceil((Date.now() - new Date(link.created_at).getTime()) / (1000 * 60 * 60 * 24)))
                const clicksPerDay = Math.round((totalClicks / daysActive) * 10) / 10
                const todayClicks = todayClicksByLink[link.id] || 0
                const yesterdayClicks = yesterdayClicksByLink[link.id] || 0
                const trend = todayClicks - yesterdayClicks

                return {
                    id: link.id,
                    code: link.code,
                    title: link.title,
                    totalClicks,
                    clicksPerDay,
                    todayClicks,
                    trend
                }
            })
            .sort((a, b) => b.totalClicks - a.totalClicks)
    }, [clicks, links])

    // Device icon
    const getDeviceIcon = (device: string) => {
        switch (device.toLowerCase()) {
            case 'mobile': return <Smartphone className="w-4 h-4" />
            case 'tablet': return <Tablet className="w-4 h-4" />
            default: return <Monitor className="w-4 h-4" />
        }
    }

    if (clicks.length === 0) {
        return (
            <div className="p-12 text-center">
                <Globe className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium mb-2">No Analytics Data Yet</h3>
                <p className="text-[var(--muted-foreground)]">
                    Start sharing your links to see visitor statistics here.
                </p>
            </div>
        )
    }

    // PERFORMANCE TAB - Link Performance with ALL links
    if (activeSubTab === 'performance') {
        return (
            <div className="space-y-6">
                {/* Summary */}
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-[var(--primary)]" />
                        Link Performance
                    </h3>
                    <span className="text-sm text-[var(--muted-foreground)]">
                        {linkPerformance.length} links • {clicks.length} clicks
                    </span>
                </div>

                {/* Link Performance Table - ALL LINKS */}
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="table">
                        <thead className="sticky top-0 bg-[var(--card)] z-10">
                            <tr>
                                <th className="w-12">#</th>
                                <th>Link</th>
                                <th className="text-right">Total</th>
                                <th className="text-right">Today</th>
                                <th className="text-right">Clicks/Day</th>
                                <th className="text-right">Trend</th>
                            </tr>
                        </thead>
                        <tbody>
                            {linkPerformance.map((link, idx) => (
                                <tr key={link.id} className="hover:bg-[var(--muted)]/50">
                                    <td className="text-[var(--muted-foreground)]">{idx + 1}</td>
                                    <td>
                                        <div>
                                            <a
                                                href={`/links/${link.id}`}
                                                className="text-sm font-bold text-[var(--primary)] hover:underline"
                                            >
                                                /{link.code}
                                            </a>
                                            {link.title && (
                                                <p className="text-xs text-[var(--muted-foreground)] truncate max-w-[300px]">
                                                    {link.title}
                                                </p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="text-right font-semibold">{link.totalClicks}</td>
                                    <td className="text-right">{link.todayClicks}</td>
                                    <td className="text-right">
                                        <span className="px-2 py-0.5 rounded bg-[var(--muted)] text-sm font-medium">
                                            {link.clicksPerDay}
                                        </span>
                                    </td>
                                    <td className="text-right">
                                        {link.trend > 0 ? (
                                            <span className="inline-flex items-center gap-1 text-emerald-500 text-sm font-medium">
                                                <TrendingUp className="w-3.5 h-3.5" />
                                                +{link.trend}
                                            </span>
                                        ) : link.trend < 0 ? (
                                            <span className="inline-flex items-center gap-1 text-rose-500 text-sm font-medium">
                                                <TrendingDown className="w-3.5 h-3.5" />
                                                {link.trend}
                                            </span>
                                        ) : (
                                            <span className="text-[var(--muted-foreground)] text-sm">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )
    }

    // TRAFFIC TAB - Charts & Devices
    if (activeSubTab === 'traffic') {
        return (
            <div className="space-y-6">
                {/* Daily Trend */}
                <div>
                    <h3 className="text-lg font-semibold mb-4">Clicks Over Time</h3>
                    <div className="h-64 sm:h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dailyData}>
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--card)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="clicks"
                                    stroke="#6366f1"
                                    strokeWidth={2}
                                    dot={{ fill: '#6366f1', strokeWidth: 0, r: 4 }}
                                    activeDot={{ r: 6, fill: '#6366f1' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Device & Browser Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Devices */}
                    <div className="p-4 rounded-lg border border-[var(--border)]">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Monitor className="w-5 h-5 text-[var(--primary)]" />
                            Devices
                        </h3>
                        <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={deviceData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={35}
                                        outerRadius={60}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {deviceData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-3 space-y-2">
                            {deviceData.map((item, idx) => (
                                <div key={item.name} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-2.5 h-2.5 rounded-full"
                                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                                        />
                                        <span className="flex items-center gap-1.5">
                                            {getDeviceIcon(item.name)}
                                            {item.name}
                                        </span>
                                    </div>
                                    <span className="font-medium">
                                        {item.value} <span className="text-[var(--muted-foreground)]">({item.percentage}%)</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Browsers */}
                    <div className="p-4 rounded-lg border border-[var(--border)]">
                        <h3 className="text-lg font-semibold mb-4">Browsers</h3>
                        <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={browserData} layout="vertical">
                                    <XAxis type="number" hide />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        tick={{ fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                        width={80}
                                    />
                                    <Tooltip />
                                    <Bar
                                        dataKey="value"
                                        fill="#6366f1"
                                        radius={[0, 4, 4, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* OS Stats */}
                <div className="p-4 rounded-lg border border-[var(--border)]">
                    <h3 className="text-lg font-semibold mb-4">Operating Systems</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
                        {osData.map((item, idx) => (
                            <div key={item.name} className="text-center p-3 rounded-lg bg-[var(--muted)]">
                                <p className="text-lg font-bold" style={{ color: COLORS[idx % COLORS.length] }}>
                                    {item.value}
                                </p>
                                <p className="text-xs text-[var(--muted-foreground)] truncate">{item.name}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    // GEOGRAPHY TAB - Countries & Referrers
    return (
        <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
                {/* Countries with Flags */}
                <div className="p-4 rounded-lg border border-[var(--border)]">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Globe className="w-5 h-5 text-[var(--primary)]" />
                        Countries
                    </h3>
                    <div className="space-y-2.5 max-h-[400px] overflow-y-auto">
                        {countryData.map((item, idx) => (
                            <div key={item.code} className="flex items-center gap-3">
                                <span className="text-xs w-5 text-[var(--muted-foreground)]">{idx + 1}</span>
                                <span className="text-xl">{item.flag}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-sm font-medium truncate">{item.code}</span>
                                        <span className="text-sm text-[var(--muted-foreground)]">
                                            {item.value} ({item.percentage}%)
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-[var(--primary)] to-purple-500 rounded-full transition-all"
                                            style={{ width: `${(item.value / countryData[0].value) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Referrers */}
                <div className="p-4 rounded-lg border border-[var(--border)]">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <ExternalLink className="w-5 h-5 text-[var(--primary)]" />
                        Top Referrers
                    </h3>
                    <div className="space-y-2.5 max-h-[400px] overflow-y-auto">
                        {referrerData.map((item, idx) => (
                            <div key={item.name} className="flex items-center gap-3">
                                <span className="text-xs w-5 text-[var(--muted-foreground)]">{idx + 1}</span>
                                {item.favicon && (
                                    <img
                                        src={item.favicon}
                                        alt=""
                                        className="w-4 h-4 rounded"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                    />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        {item.fullUrl ? (
                                            <a
                                                href={item.fullUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm font-medium text-[var(--primary)] hover:underline truncate"
                                            >
                                                {item.name}
                                            </a>
                                        ) : (
                                            <span className="text-sm font-medium truncate">{item.name}</span>
                                        )}
                                        <span className="text-sm text-[var(--muted-foreground)] ml-2">
                                            {item.value} ({((item.value / clicks.length) * 100).toFixed(1)}%)
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[var(--primary)] rounded-full transition-all"
                                            style={{ width: `${(item.value / referrerData[0].value) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
