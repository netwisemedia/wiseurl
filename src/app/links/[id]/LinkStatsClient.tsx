'use client'

import { useMemo, useState } from 'react'
import { Link as LinkType, Click } from '@/lib/types'
import { ArrowLeft, ExternalLink, Copy, Check, TrendingUp, Globe, Smartphone, Monitor, Calendar } from 'lucide-react'
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar
} from 'recharts'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface Props {
    link: LinkType
    clicks: Click[]
}

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308']

export default function LinkStatsClient({ link, clicks }: Props) {
    const [copiedCode, setCopiedCode] = useState(false)

    const copyLink = async () => {
        const url = `${window.location.origin}/${link.code}`
        await navigator.clipboard.writeText(url)
        setCopiedCode(true)
        toast.success('Link copied!')
        setTimeout(() => setCopiedCode(false), 2000)
    }

    // Stats
    const stats = useMemo(() => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const week = new Date(today)
        week.setDate(week.getDate() - 7)
        const month = new Date(today)
        month.setDate(month.getDate() - 30)

        return {
            total: clicks.length,
            today: clicks.filter(c => new Date(c.clicked_at) >= today).length,
            week: clicks.filter(c => new Date(c.clicked_at) >= week).length,
            month: clicks.filter(c => new Date(c.clicked_at) >= month).length,
        }
    }, [clicks])

    // Daily trend (last 30 days)
    const dailyData = useMemo(() => {
        const days: Record<string, number> = {}
        const now = new Date()

        for (let i = 29; i >= 0; i--) {
            const date = new Date(now)
            date.setDate(date.getDate() - i)
            const key = date.toISOString().split('T')[0]
            days[key] = 0
        }

        clicks.forEach(click => {
            const date = new Date(click.clicked_at).toISOString().split('T')[0]
            if (days[date] !== undefined) days[date]++
        })

        return Object.entries(days).map(([date, count]) => ({
            date: new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
            clicks: count
        }))
    }, [clicks])

    // Device stats
    const deviceData = useMemo(() => {
        const counts: Record<string, number> = {}
        clicks.forEach(c => {
            const device = c.device_type || 'unknown'
            counts[device] = (counts[device] || 0) + 1
        })
        return Object.entries(counts).map(([name, value]) => ({ name, value }))
    }, [clicks])

    // Country stats
    const countryData = useMemo(() => {
        const counts: Record<string, number> = {}
        clicks.forEach(c => {
            const country = c.country || 'Unknown'
            counts[country] = (counts[country] || 0) + 1
        })
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10)
    }, [clicks])

    // Referrer stats
    const referrerData = useMemo(() => {
        const counts: Record<string, number> = {}
        clicks.forEach(c => {
            let ref = 'Direct'
            if (c.original_referrer) {
                try { ref = new URL(c.original_referrer).hostname }
                catch { ref = c.original_referrer }
            }
            counts[ref] = (counts[ref] || 0) + 1
        })
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5)
    }, [clicks])

    return (
        <div className="min-h-screen bg-[var(--background)]">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[var(--card)] border-b border-[var(--border)]">
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard" className="btn btn-ghost p-2">
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold flex items-center gap-2">
                                    /{link.code}
                                    <button onClick={copyLink} className="btn btn-ghost p-1">
                                        {copiedCode ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </h1>
                                {link.title && <p className="text-sm text-[var(--muted-foreground)]">{link.title}</p>}
                            </div>
                        </div>
                        <a
                            href={link.destination_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Open Destination
                        </a>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="card p-4">
                        <div className="flex items-center gap-2 text-[var(--muted-foreground)] mb-1">
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-sm">Total Clicks</span>
                        </div>
                        <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
                    </div>
                    <div className="card p-4">
                        <div className="flex items-center gap-2 text-[var(--muted-foreground)] mb-1">
                            <Calendar className="w-4 h-4" />
                            <span className="text-sm">Today</span>
                        </div>
                        <p className="text-2xl font-bold">{stats.today}</p>
                    </div>
                    <div className="card p-4">
                        <div className="flex items-center gap-2 text-[var(--muted-foreground)] mb-1">
                            <Calendar className="w-4 h-4" />
                            <span className="text-sm">Last 7 Days</span>
                        </div>
                        <p className="text-2xl font-bold">{stats.week}</p>
                    </div>
                    <div className="card p-4">
                        <div className="flex items-center gap-2 text-[var(--muted-foreground)] mb-1">
                            <Calendar className="w-4 h-4" />
                            <span className="text-sm">Last 30 Days</span>
                        </div>
                        <p className="text-2xl font-bold">{stats.month}</p>
                    </div>
                </div>

                {/* Clicks Over Time Chart */}
                <div className="card p-6">
                    <h2 className="text-lg font-semibold mb-4">Clicks Over Time (30 Days)</h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dailyData}>
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
                                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                <Line type="monotone" dataKey="clicks" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Grid: Devices, Countries, Referrers */}
                <div className="grid md:grid-cols-3 gap-6">
                    {/* Devices */}
                    <div className="card p-6">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <Monitor className="w-4 h-4 text-[var(--primary)]" />
                            Devices
                        </h3>
                        {deviceData.length > 0 ? (
                            <div className="h-40">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={deviceData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={2}>
                                            {deviceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <p className="text-[var(--muted-foreground)] text-sm">No data yet</p>
                        )}
                        <div className="mt-2 space-y-1">
                            {deviceData.map((d, i) => (
                                <div key={d.name} className="flex justify-between text-sm">
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                                        {d.name}
                                    </span>
                                    <span className="font-medium">{d.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Countries */}
                    <div className="card p-6">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <Globe className="w-4 h-4 text-[var(--primary)]" />
                            Top Countries
                        </h3>
                        {countryData.length > 0 ? (
                            <div className="space-y-2">
                                {countryData.slice(0, 6).map((c, i) => (
                                    <div key={c.name} className="flex items-center gap-2">
                                        <span className="text-xs w-4 text-[var(--muted-foreground)]">{i + 1}</span>
                                        <div className="flex-1">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span>{c.name}</span>
                                                <span className="text-[var(--muted-foreground)]">{c.value}</span>
                                            </div>
                                            <div className="h-1 bg-[var(--muted)] rounded-full">
                                                <div className="h-1 bg-[var(--primary)] rounded-full" style={{ width: `${(c.value / countryData[0].value) * 100}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[var(--muted-foreground)] text-sm">No data yet</p>
                        )}
                    </div>

                    {/* Referrers */}
                    <div className="card p-6">
                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                            <ExternalLink className="w-4 h-4 text-[var(--primary)]" />
                            Top Referrers
                        </h3>
                        {referrerData.length > 0 ? (
                            <div className="space-y-3">
                                {referrerData.map((r, i) => (
                                    <div key={r.name} className="flex justify-between text-sm">
                                        <span className="truncate flex-1">{r.name}</span>
                                        <span className="font-medium ml-2">{r.value}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[var(--muted-foreground)] text-sm">No data yet</p>
                        )}
                    </div>
                </div>

                {/* Recent Clicks Table */}
                <div className="card">
                    <h3 className="font-semibold p-4 border-b border-[var(--border)]">Recent Clicks</h3>
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Country</th>
                                    <th>Device</th>
                                    <th>Referrer</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clicks.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-[var(--muted-foreground)]">
                                            No clicks yet
                                        </td>
                                    </tr>
                                ) : (
                                    clicks.slice(0, 15).map((click) => (
                                        <tr key={click.id}>
                                            <td className="text-sm">
                                                {new Date(click.clicked_at).toLocaleString('en', {
                                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                })}
                                            </td>
                                            <td>{click.country || '-'}</td>
                                            <td className="flex items-center gap-1">
                                                {click.device_type === 'mobile' ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                                                <span className="text-sm">{click.device_type || '-'}</span>
                                            </td>
                                            <td className="text-sm truncate max-w-[150px]">
                                                {click.original_referrer ? new URL(click.original_referrer).hostname : 'Direct'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    )
}
