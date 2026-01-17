'use client'

import { useState, useEffect } from 'react'
import { Activity } from 'lucide-react'

interface Props {
    clicks: { clicked_at: string }[]
}

export default function RealTimeCounter({ clicks }: Props) {
    const [recentClicks, setRecentClicks] = useState(0)
    const [lastUpdate, setLastUpdate] = useState(new Date())

    useEffect(() => {
        const calculateRecent = () => {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
            const recent = clicks.filter(c => new Date(c.clicked_at) >= fiveMinutesAgo).length
            setRecentClicks(recent)
            setLastUpdate(new Date())
        }

        calculateRecent()
        const interval = setInterval(calculateRecent, 30000) // Refresh every 30s

        return () => clearInterval(interval)
    }, [clicks])

    return (
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
            {/* Pulsing dot */}
            <div className="relative">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-75" />
            </div>

            <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium text-[var(--foreground)]">
                    <span className="font-bold text-emerald-500">{recentClicks}</span>
                    {' '}click{recentClicks !== 1 ? 's' : ''} in last 5 min
                </span>
            </div>

            <span className="text-xs text-[var(--muted-foreground)] ml-auto hidden sm:block">
                Updated {lastUpdate.toLocaleTimeString()}
            </span>
        </div>
    )
}
