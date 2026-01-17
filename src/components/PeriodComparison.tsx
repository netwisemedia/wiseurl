'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, Calendar, CalendarDays, CalendarRange } from 'lucide-react'

interface Props {
    clicks: { clicked_at: string }[]
}

export default function PeriodComparison({ clicks }: Props) {
    const comparisons = useMemo(() => {
        const now = new Date()

        // Today
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const yesterdayStart = new Date(todayStart)
        yesterdayStart.setDate(yesterdayStart.getDate() - 1)

        // This week (Mon-Sun)
        const thisWeekStart = new Date(todayStart)
        thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay() + 1)
        const lastWeekStart = new Date(thisWeekStart)
        lastWeekStart.setDate(lastWeekStart.getDate() - 7)
        const lastWeekEnd = new Date(thisWeekStart)
        lastWeekEnd.setMilliseconds(-1)

        // This month
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastMonthEnd = new Date(thisMonthStart)
        lastMonthEnd.setMilliseconds(-1)

        // Count clicks
        const todayClicks = clicks.filter(c => new Date(c.clicked_at) >= todayStart).length
        const yesterdayClicks = clicks.filter(c => {
            const d = new Date(c.clicked_at)
            return d >= yesterdayStart && d < todayStart
        }).length

        const thisWeekClicks = clicks.filter(c => new Date(c.clicked_at) >= thisWeekStart).length
        const lastWeekClicks = clicks.filter(c => {
            const d = new Date(c.clicked_at)
            return d >= lastWeekStart && d < thisWeekStart
        }).length

        const thisMonthClicks = clicks.filter(c => new Date(c.clicked_at) >= thisMonthStart).length
        const lastMonthClicks = clicks.filter(c => {
            const d = new Date(c.clicked_at)
            return d >= lastMonthStart && d < thisMonthStart
        }).length

        // Calculate percentages
        const calcChange = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? 100 : 0
            return Math.round(((current - previous) / previous) * 100)
        }

        return [
            {
                label: 'Today',
                sublabel: 'vs Yesterday',
                current: todayClicks,
                previous: yesterdayClicks,
                change: calcChange(todayClicks, yesterdayClicks),
                icon: Calendar
            },
            {
                label: 'This Week',
                sublabel: 'vs Last Week',
                current: thisWeekClicks,
                previous: lastWeekClicks,
                change: calcChange(thisWeekClicks, lastWeekClicks),
                icon: CalendarDays
            },
            {
                label: 'This Month',
                sublabel: 'vs Last Month',
                current: thisMonthClicks,
                previous: lastMonthClicks,
                change: calcChange(thisMonthClicks, lastMonthClicks),
                icon: CalendarRange
            }
        ]
    }, [clicks])

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {comparisons.map((item) => {
                const Icon = item.icon
                const isPositive = item.change > 0
                const isNegative = item.change < 0
                const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus

                return (
                    <div
                        key={item.label}
                        className="card p-4 bg-[var(--card)] border border-[var(--border)]"
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center">
                                <Icon className="w-5 h-5 text-[var(--primary)]" />
                            </div>
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${isPositive ? 'bg-emerald-500/10 text-emerald-500' :
                                    isNegative ? 'bg-rose-500/10 text-rose-500' :
                                        'bg-gray-500/10 text-gray-500'
                                }`}>
                                <TrendIcon className="w-3 h-3" />
                                {isPositive ? '+' : ''}{item.change}%
                            </div>
                        </div>

                        <p className="text-2xl font-bold text-[var(--foreground)]">
                            {item.current.toLocaleString()}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)] mt-1">
                            {item.label} • <span className="opacity-70">{item.sublabel}: {item.previous}</span>
                        </p>
                    </div>
                )
            })}
        </div>
    )
}
