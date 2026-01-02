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
    Line,
    Legend
} from 'recharts'
import { Globe, Monitor, Smartphone, Tablet, ExternalLink } from 'lucide-react'

interface Props {
    clicks: Click[]
}

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308']

export default function AnalyticsCharts({ clicks }: Props) {
    // Device stats
    const deviceData = useMemo(() => {
        const counts: Record<string, number> = {}
        clicks.forEach(click => {
            const device = click.device_type || 'unknown'
            counts[device] = (counts[device] || 0) + 1
        })
        return Object.entries(counts).map(([name, value]) => ({ name, value }))
    }, [clicks])

    // Country stats
    const countryData = useMemo(() => {
        const counts: Record<string, number> = {}
        clicks.forEach(click => {
            const country = click.country || 'Unknown'
            counts[country] = (counts[country] || 0) + 1
        })
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10)
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
            .slice(0, 6)
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
            .slice(0, 6)
    }, [clicks])

    // Referrer stats
    const referrerData = useMemo(() => {
        const counts: Record<string, number> = {}
        clicks.forEach(click => {
            let referrer = 'Direct'
            if (click.original_referrer) {
                try {
                    referrer = new URL(click.original_referrer).hostname
                } catch {
                    referrer = click.original_referrer
                }
            }
            counts[referrer] = (counts[referrer] || 0) + 1
        })
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10)
    }, [clicks])

    // Daily trend (last 14 days)
    const dailyData = useMemo(() => {
        const days: Record<string, number> = {}
        const now = new Date()

        // Initialize last 14 days
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
            <div className="card p-12 text-center">
                <Globe className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium mb-2">No Analytics Data Yet</h3>
                <p className="text-[var(--muted-foreground)]">
                    Start sharing your links to see visitor statistics here.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Daily Trend */}
            <div className="card p-4 sm:p-6">
                <h3 className="text-lg font-semibold mb-4">Clicks Over Time</h3>
                <div className="h-64 sm:h-80">
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

            {/* Stats Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Devices */}
                <div className="card p-4 sm:p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-[var(--primary)]" />
                        Devices
                    </h3>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={deviceData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={70}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {deviceData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2">
                        {deviceData.map((item, idx) => (
                            <div key={item.name} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                                    />
                                    <span className="flex items-center gap-1">
                                        {getDeviceIcon(item.name)}
                                        {item.name}
                                    </span>
                                </div>
                                <span className="font-medium">{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Countries */}
                <div className="card p-4 sm:p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Globe className="w-5 h-5 text-[var(--primary)]" />
                        Top Countries
                    </h3>
                    <div className="space-y-3">
                        {countryData.slice(0, 8).map((item, idx) => (
                            <div key={item.name} className="flex items-center gap-3">
                                <span className="text-sm w-6 text-[var(--muted-foreground)]">{idx + 1}</span>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium">{item.name}</span>
                                        <span className="text-sm text-[var(--muted-foreground)]">{item.value}</span>
                                    </div>
                                    <div className="h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-[var(--primary)] to-purple-500 rounded-full"
                                            style={{ width: `${(item.value / countryData[0].value) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Browsers */}
                <div className="card p-4 sm:p-6">
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
            <div className="card p-4 sm:p-6">
                <h3 className="text-lg font-semibold mb-4">Operating Systems</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {osData.map((item, idx) => (
                        <div key={item.name} className="text-center p-3 rounded-lg bg-[var(--muted)]">
                            <p className="text-lg font-bold" style={{ color: COLORS[idx % COLORS.length] }}>
                                {item.value}
                            </p>
                            <p className="text-sm text-[var(--muted-foreground)] truncate">{item.name}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Referrers */}
            <div className="card p-4 sm:p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <ExternalLink className="w-5 h-5 text-[var(--primary)]" />
                    Top Referrers
                </h3>
                <div className="overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Source</th>
                                <th>Clicks</th>
                                <th>Share</th>
                            </tr>
                        </thead>
                        <tbody>
                            {referrerData.map((item, idx) => (
                                <tr key={item.name}>
                                    <td className="text-[var(--muted-foreground)]">{idx + 1}</td>
                                    <td className="font-medium">{item.name}</td>
                                    <td>{item.value.toLocaleString()}</td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-[var(--primary)] rounded-full"
                                                    style={{ width: `${(item.value / clicks.length) * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-sm text-[var(--muted-foreground)]">
                                                {((item.value / clicks.length) * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
