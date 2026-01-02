'use client'

export function Skeleton({ className = '' }: { className?: string }) {
    return (
        <div
            className={`animate-pulse bg-[var(--muted)] rounded ${className}`}
        />
    )
}

export function CardSkeleton() {
    return (
        <div className="card p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-2">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-8 w-16 mt-2" />
        </div>
    )
}

export function TableRowSkeleton() {
    return (
        <tr>
            <td><Skeleton className="h-5 w-20" /></td>
            <td><Skeleton className="h-5 w-32" /></td>
            <td><Skeleton className="h-5 w-12" /></td>
            <td className="hidden md:table-cell"><Skeleton className="h-5 w-16" /></td>
            <td><Skeleton className="h-5 w-16" /></td>
        </tr>
    )
}

export function DashboardSkeleton() {
    return (
        <div className="min-h-screen bg-[var(--background)]">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[var(--card)] border-b border-[var(--border)]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <Skeleton className="w-8 h-8 rounded-lg" />
                            <Skeleton className="h-5 w-24 hidden sm:block" />
                        </div>
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-9 w-64 hidden md:block" />
                            <Skeleton className="h-9 w-24" />
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                </div>

                {/* Links Table */}
                <div className="card">
                    <div className="p-4 border-b border-[var(--border)]">
                        <Skeleton className="h-6 w-32" />
                    </div>
                    <table className="table">
                        <thead>
                            <tr>
                                <th><Skeleton className="h-4 w-16" /></th>
                                <th><Skeleton className="h-4 w-24" /></th>
                                <th><Skeleton className="h-4 w-12" /></th>
                                <th className="hidden md:table-cell"><Skeleton className="h-4 w-16" /></th>
                                <th><Skeleton className="h-4 w-16" /></th>
                            </tr>
                        </thead>
                        <tbody>
                            <TableRowSkeleton />
                            <TableRowSkeleton />
                            <TableRowSkeleton />
                            <TableRowSkeleton />
                            <TableRowSkeleton />
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    )
}

export function ChartSkeleton() {
    return (
        <div className="card p-4 sm:p-6">
            <Skeleton className="h-6 w-40 mb-4" />
            <Skeleton className="h-64 w-full" />
        </div>
    )
}
