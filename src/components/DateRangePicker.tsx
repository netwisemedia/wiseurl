'use client'

import { useState } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'

export type DateRange = {
    label: string
    from: Date
    to: Date
}

const presets: { label: string; getDates: () => { from: Date; to: Date } }[] = [
    {
        label: 'Today',
        getDates: () => {
            const now = new Date()
            const from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            return { from, to: now }
        }
    },
    {
        label: 'Yesterday',
        getDates: () => {
            const now = new Date()
            const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
            const to = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            to.setMilliseconds(-1)
            return { from, to }
        }
    },
    {
        label: 'Last 7 days',
        getDates: () => {
            const now = new Date()
            const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
            return { from, to: now }
        }
    },
    {
        label: 'Last 30 days',
        getDates: () => {
            const now = new Date()
            const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)
            return { from, to: now }
        }
    },
    {
        label: 'This month',
        getDates: () => {
            const now = new Date()
            const from = new Date(now.getFullYear(), now.getMonth(), 1)
            return { from, to: now }
        }
    },
    {
        label: 'Last month',
        getDates: () => {
            const now = new Date()
            const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
            return { from, to }
        }
    },
    {
        label: 'All time',
        getDates: () => {
            const from = new Date(2020, 0, 1)
            const to = new Date()
            return { from, to }
        }
    }
]

interface Props {
    value: DateRange
    onChange: (range: DateRange) => void
}

export default function DateRangePicker({ value, onChange }: Props) {
    const [open, setOpen] = useState(false)

    const handleSelect = (preset: typeof presets[0]) => {
        const dates = preset.getDates()
        onChange({ label: preset.label, ...dates })
        setOpen(false)
    }

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="btn btn-secondary text-sm gap-2"
            >
                <Calendar className="w-4 h-4" />
                {value.label}
                <ChevronDown className="w-4 h-4" />
            </button>

            {open && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 z-50 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg py-1 min-w-[150px]">
                        {presets.map(preset => (
                            <button
                                key={preset.label}
                                onClick={() => handleSelect(preset)}
                                className={`w-full px-4 py-2 text-left text-sm hover:bg-[var(--muted)] transition-colors ${value.label === preset.label ? 'text-[var(--primary)] font-medium' : ''
                                    }`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

export function getDefaultDateRange(): DateRange {
    const preset = presets.find(p => p.label === 'Last 7 days')!
    const dates = preset.getDates()
    return { label: preset.label, ...dates }
}
