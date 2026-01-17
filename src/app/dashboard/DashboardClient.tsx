'use client'

import { useState, useMemo } from 'react'
import { Link as LinkType, Click, Group, ErrorLog } from '@/lib/types'
import {
    LinkIcon,
    Plus,
    BarChart3,
    MousePointerClick,
    TrendingUp,
    ExternalLink,
    Copy,
    Check,
    Search,
    LogOut,
    Menu,
    X,
    Pencil,
    Trash2,
    Download,
    Settings,
    User,
    AlertTriangle,
    Globe
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import CreateLinkModal from '@/components/CreateLinkModal'
import EditLinkModal from '@/components/EditLinkModal'
import DeleteLinkModal from '@/components/DeleteLinkModal'
import AnalyticsCharts from '@/components/AnalyticsCharts'
import DateRangePicker, { DateRange, getDefaultDateRange } from '@/components/DateRangePicker'
import RealTimeCounter from '@/components/RealTimeCounter'
import PeriodComparison from '@/components/PeriodComparison'
import { exportLinksCSV, exportClicksCSV } from '@/lib/export'
import GroupManager from '@/components/GroupManager'

interface Props {
    initialLinks: LinkType[]
    initialClicks: Click[]
    initialGroups: Group[]
    initialErrorLogs: ErrorLog[]
    userEmail?: string
}

export default function DashboardClient({ initialLinks, initialClicks, initialGroups, initialErrorLogs, userEmail }: Props) {
    const links = initialLinks
    const clicks = initialClicks
    const groups = initialGroups
    const errorLogs = initialErrorLogs
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [editingLink, setEditingLink] = useState<LinkType | null>(null)
    const [deletingLink, setDeletingLink] = useState<LinkType | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [copiedCode, setCopiedCode] = useState<string | null>(null)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'links' | 'groups' | 'analytics' | 'errors'>('links')
    const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange)
    const [showExportMenu, setShowExportMenu] = useState(false)
    const [showUserMenu, setShowUserMenu] = useState(false)
    const [analyticsSubTab, setAnalyticsSubTab] = useState<'performance' | 'traffic' | 'geography'>('performance')
    const router = useRouter()
    const supabase = createClient()

    // Filter clicks by date range
    const filteredClicks = useMemo(() => {
        if (activeTab !== 'analytics') return [] // Optimization
        return clicks.filter(click => {
            const clickDate = new Date(click.clicked_at)
            return clickDate >= dateRange.from && clickDate <= dateRange.to
        })
    }, [clicks, dateRange, activeTab])

    // Filter links by search and group
    const filteredLinks = useMemo(() => {
        let result = links

        // Filter by group
        if (selectedGroupId) {
            result = result.filter(link => link.group_id === selectedGroupId)
        }

        // Filter by search
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            result = result.filter(link =>
                link.code.toLowerCase().includes(query) ||
                link.title?.toLowerCase().includes(query) ||
                link.destination_url.toLowerCase().includes(query)
            )
        }

        // Sort alphabetically by code
        return result.sort((a, b) => a.code.localeCompare(b.code))
    }, [links, searchQuery, selectedGroupId])

    // Pagination
    const LINKS_PER_PAGE = 25
    const [currentPage, setCurrentPage] = useState(1)
    const totalPages = Math.ceil(filteredLinks.length / LINKS_PER_PAGE)

    const paginatedLinks = useMemo(() => {
        const start = (currentPage - 1) * LINKS_PER_PAGE
        return filteredLinks.slice(start, start + LINKS_PER_PAGE)
    }, [filteredLinks, currentPage])

    // Reset to page 1 when filters change
    useMemo(() => {
        setCurrentPage(1)
    }, [searchQuery, selectedGroupId])

    // Calculate stats
    const stats = useMemo(() => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const weekAgo = new Date(today)
        weekAgo.setDate(weekAgo.getDate() - 7)

        return {
            totalClicks: clicks.length,
            todayClicks: clicks.filter(c => new Date(c.clicked_at) >= today).length,
            yesterdayClicks: clicks.filter(c => {
                const d = new Date(c.clicked_at)
                return d >= yesterday && d < today
            }).length,
            weekClicks: clicks.filter(c => new Date(c.clicked_at) >= weekAgo).length,
            totalLinks: links.length,
            activeLinks: links.filter(l => l.is_active).length,
            totalErrors: errorLogs.length
        }
    }, [clicks, links, errorLogs])

    // Calculate top links in selected period
    const topLinksInPeriod = useMemo(() => {
        const clicksByLink: Record<string, number> = {}

        filteredClicks.forEach(click => {
            clicksByLink[click.link_id] = (clicksByLink[click.link_id] || 0) + 1
        })

        return Object.entries(clicksByLink)
            .map(([linkId, count]) => ({
                link: links.find(l => l.id === linkId),
                clicks: count
            }))
            .filter(item => item.link)
            .sort((a, b) => b.clicks - a.clicks)
    }, [filteredClicks, links])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const copyToClipboard = (code: string) => {
        navigator.clipboard.writeText(`${window.location.origin}/${code}`)
        setCopiedCode(code)
        setTimeout(() => setCopiedCode(null), 2000)
    }

    return (
        <div className="min-h-screen bg-[var(--background)]">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[var(--card)] border-b border-[var(--border)]">
                <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Left Side: Logo */}
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                                <LinkIcon className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-lg font-bold">WiseURL</span>
                        </div>

                        {/* Right Side: Actions */}
                        <div className="flex items-center gap-4">
                            {/* Desktop User Menu */}
                            <div className="hidden md:flex items-center gap-3">
                                <div className="relative">
                                    <button
                                        onClick={() => setShowUserMenu(!showUserMenu)}
                                        className="w-9 h-9 rounded-full bg-gradient-to-tr from-[var(--primary)] to-purple-600 flex items-center justify-center text-white font-medium hover:opacity-90 transition-opacity"
                                    >
                                        {userEmail ? userEmail[0].toUpperCase() : <User className="w-5 h-5" />}
                                    </button>

                                    {showUserMenu && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setShowUserMenu(false)}
                                            />
                                            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl z-50 overflow-hidden animation-in fade-in zoom-in-95 duration-200">
                                                {userEmail && (
                                                    <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)]/50">
                                                        <p className="text-xs font-medium text-[var(--muted-foreground)]">Signed in as</p>
                                                        <p className="text-sm font-semibold truncate text-[var(--foreground)]">{userEmail}</p>
                                                    </div>
                                                )}
                                                <div className="p-1">
                                                    <a
                                                        href="/settings"
                                                        className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors"
                                                    >
                                                        <Settings className="w-4 h-4 text-[var(--muted-foreground)]" />
                                                        Settings
                                                    </a>
                                                    <button
                                                        onClick={handleLogout}
                                                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    >
                                                        <LogOut className="w-4 h-4" />
                                                        Log out
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Mobile menu toggle */}
                            <div className="md:hidden">
                                <button
                                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                    className="btn btn-ghost p-2 text-[var(--foreground)]"
                                >
                                    {mobileMenuOpen ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x w-5 h-5" aria-hidden="true">
                                            <path d="M18 6 6 18"></path>
                                            <path d="m6 6 12 12"></path>
                                        </svg>
                                    ) : (
                                        <Menu className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t border-[var(--border)] p-4 space-y-3">
                        <div className="flex gap-2">
                            <a href="/settings" className="btn btn-secondary flex-1" onClick={() => setMobileMenuOpen(false)}>
                                <Settings className="w-4 h-4" />
                                Settings
                            </a>
                            <button onClick={handleLogout} className="btn btn-ghost text-red-500 flex-1">
                                <LogOut className="w-4 h-4" />
                                Logout
                            </button>
                        </div>
                    </div>
                )}
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                    <div className="card p-4 sm:p-6 bg-[var(--card)] border-[var(--border)] border-l-4 border-l-violet-500 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center">
                                <MousePointerClick className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                            </div>
                            <span className="text-[var(--muted-foreground)] text-sm font-medium">Total Clicks</span>
                        </div>
                        <p className="text-3xl font-bold text-[var(--foreground)] tracking-tight">{stats.totalClicks.toLocaleString()}</p>
                    </div>

                    <div className="card p-4 sm:p-6 bg-[var(--card)] border-[var(--border)] border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <span className="text-[var(--muted-foreground)] text-sm font-medium">Today</span>
                        </div>

                        <div className="flex items-end justify-between">
                            <p className="text-3xl font-bold text-[var(--foreground)] tracking-tight">{stats.todayClicks}</p>
                            {stats.yesterdayClicks > 0 && (
                                <p className={`text-sm font-semibold mb-1 ${stats.todayClicks >= stats.yesterdayClicks ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {stats.todayClicks >= stats.yesterdayClicks ? '+' : ''}
                                    {Math.round(((stats.todayClicks - stats.yesterdayClicks) / stats.yesterdayClicks) * 100)}%
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="card p-4 sm:p-6 bg-[var(--card)] border-[var(--border)] border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                                <LinkIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                            </div>
                            <span className="text-[var(--muted-foreground)] text-sm font-medium">Active Links</span>
                        </div>
                        <p className="text-3xl font-bold text-[var(--foreground)] tracking-tight">{stats.activeLinks}</p>
                    </div>

                    <div className="card p-4 sm:p-6 bg-[var(--card)] border-[var(--border)] border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                                <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="text-[var(--muted-foreground)] text-sm font-medium">This Week</span>
                        </div>
                        <p className="text-3xl font-bold text-[var(--foreground)] tracking-tight">{stats.weekClicks}</p>
                    </div>
                </div>

                {/* Tabs and Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div className="flex gap-1 p-1 bg-[var(--muted)] rounded-lg w-full sm:w-fit overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('links')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-md font-medium transition-all whitespace-nowrap ${activeTab === 'links'
                                ? 'bg-[var(--card)] shadow-sm text-[var(--foreground)]'
                                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                                }`}
                        >
                            <LinkIcon className="w-4 h-4 inline mr-2" />
                            Links
                        </button>
                        <button
                            onClick={() => setActiveTab('groups')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-md font-medium transition-all whitespace-nowrap ${activeTab === 'groups'
                                ? 'bg-[var(--card)] shadow-sm text-[var(--foreground)]'
                                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                                }`}
                        >
                            <Settings className="w-4 h-4 inline mr-2" />
                            Groups
                        </button>
                        <button
                            onClick={() => setActiveTab('analytics')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-md font-medium transition-all whitespace-nowrap ${activeTab === 'analytics'
                                ? 'bg-[var(--card)] shadow-sm text-[var(--foreground)]'
                                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                                }`}
                        >
                            <BarChart3 className="w-4 h-4 inline mr-2" />
                            Analytics
                        </button>
                        <button
                            onClick={() => setActiveTab('errors')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-md font-medium transition-all whitespace-nowrap ${activeTab === 'errors'
                                ? 'bg-[var(--card)] shadow-sm text-[var(--foreground)]'
                                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                                }`}
                        >
                            <AlertTriangle className="w-4 h-4 inline mr-2" />
                            Errors
                            {stats.totalErrors > 0 && <span className="ml-2 badge badge-sm badge-destructive">{stats.totalErrors}</span>}
                        </button>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {activeTab === 'links' ? (
                            <>
                                <div className="relative flex-1 sm:block sm:flex-none">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
                                    <input
                                        type="text"
                                        placeholder="Search links..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="input !pl-10 w-full sm:w-64 py-2"
                                    />
                                </div>
                                {/* Group Filter Dropdown */}
                                <select
                                    value={selectedGroupId || ''}
                                    onChange={(e) => setSelectedGroupId(e.target.value || null)}
                                    className="select select-bordered w-full sm:w-auto"
                                >
                                    <option value="">All Groups</option>
                                    {groups.map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                </select>
                                <button onClick={() => setShowCreateModal(true)} className="btn btn-primary whitespace-nowrap">
                                    <Plus className="w-4 h-4" />
                                    <span className="hidden sm:inline ml-1">New Link</span>
                                    <span className="sm:hidden">New</span>
                                </button>
                            </>
                        ) : activeTab === 'groups' ? (
                            <div className="flex-1"></div>
                        ) : (
                            <>
                                <DateRangePicker value={dateRange} onChange={setDateRange} />
                                <div className="relative ml-auto sm:ml-0">
                                    <button
                                        onClick={() => setShowExportMenu(!showExportMenu)}
                                        className="btn btn-secondary text-sm gap-2 whitespace-nowrap"
                                    >
                                        <Download className="w-4 h-4" />
                                        Export
                                    </button>
                                    {showExportMenu && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setShowExportMenu(false)}
                                            />
                                            <div className="absolute right-0 top-full mt-2 z-50 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg py-1 min-w-[140px]">
                                                <button
                                                    onClick={() => { exportLinksCSV(links); setShowExportMenu(false) }}
                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--muted)] transition-colors"
                                                >
                                                    Links CSV
                                                </button>
                                                <button
                                                    onClick={() => { exportClicksCSV(filteredClicks); setShowExportMenu(false) }}
                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--muted)] transition-colors"
                                                >
                                                    Clicks CSV ({filteredClicks.length})
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {activeTab === 'links' ? (
                    /* Links Table */
                    <div>


                        <div className="card overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Link</th>
                                            <th className="hidden sm:table-cell">Destination</th>
                                            <th>Clicks</th>
                                            <th className="hidden md:table-cell">Status</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLinks.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="text-center py-12 text-[var(--muted-foreground)]">
                                                    <LinkIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                                    <p>No links yet. Create your first one!</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedLinks.map(link => {
                                                const linkClicks = clicks.filter(c => c.link_id === link.id).length
                                                return (
                                                    <tr key={link.id} className="group">
                                                        <td>
                                                            <div className="flex items-center gap-2">
                                                                <code className="text-sm font-mono text-[var(--primary)]">/{link.code}</code>
                                                                <button
                                                                    onClick={() => copyToClipboard(link.code)}
                                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--muted)]"
                                                                >
                                                                    {copiedCode === link.code ? (
                                                                        <Check className="w-3.5 h-3.5 text-green-500" />
                                                                    ) : (
                                                                        <Copy className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                                                                    )}
                                                                </button>
                                                            </div>
                                                            {link.title && (
                                                                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{link.title}</p>
                                                            )}
                                                            {link.tags && link.tags.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {link.tags.map((tag: string) => (
                                                                        <span key={tag} className="px-1.5 py-0.5 text-xs rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                                                                            {tag}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {(() => {
                                                                const linkGroup = groups.find(g => g.id === link.group_id)
                                                                if (!linkGroup) return null
                                                                const colorClasses: Record<string, string> = {
                                                                    red: 'bg-red-500',
                                                                    blue: 'bg-blue-500',
                                                                    green: 'bg-green-500',
                                                                    yellow: 'bg-yellow-500',
                                                                    orange: 'bg-orange-500',
                                                                    purple: 'bg-purple-500',
                                                                    pink: 'bg-pink-500',
                                                                    gray: 'bg-gray-500'
                                                                }
                                                                return (
                                                                    <div className="mt-1.5">
                                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)]">
                                                                            <span className={`w-2 h-2 rounded-full ${colorClasses[linkGroup.color] || 'bg-gray-500'}`} />
                                                                            {linkGroup.name}
                                                                        </span>
                                                                    </div>
                                                                )
                                                            })()}
                                                        </td>
                                                        <td className="hidden sm:table-cell">
                                                            <a
                                                                href={link.destination_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1 max-w-xs truncate"
                                                            >
                                                                {new URL(link.destination_url).hostname}
                                                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                                            </a>
                                                        </td>
                                                        <td>
                                                            <span className="font-medium">{linkClicks.toLocaleString()}</span>
                                                        </td>
                                                        <td className="hidden md:table-cell">
                                                            <span className={`badge ${link.is_active ? 'badge-success' : 'badge-destructive'}`}>
                                                                {link.is_active ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="flex items-center gap-1">
                                                                <a
                                                                    href={`/links/${link.id}`}
                                                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--muted)] opacity-0 group-hover:opacity-100 transition-all text-[var(--primary)]"
                                                                    title="View Stats"
                                                                >
                                                                    <BarChart3 className="w-4 h-4" />
                                                                </a>
                                                                <button
                                                                    onClick={() => setEditingLink(link)}
                                                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--muted)] opacity-0 group-hover:opacity-100 transition-all"
                                                                    title="Edit"
                                                                >
                                                                    <Pencil className="w-4 h-4 text-[var(--muted-foreground)]" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setDeletingLink(link)}
                                                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all text-red-500"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                                <a
                                                                    href={`/${link.code}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                                                                    title="Open link"
                                                                >
                                                                    <ExternalLink className="w-4 h-4" />
                                                                </a>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-4 px-2">
                                <p className="text-sm text-[var(--muted-foreground)]">
                                    Showing {((currentPage - 1) * LINKS_PER_PAGE) + 1}-{Math.min(currentPage * LINKS_PER_PAGE, filteredLinks.length)} of {filteredLinks.length} links
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="btn btn-secondary px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm px-3">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="btn btn-secondary px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : activeTab === 'groups' ? (
                    /* Groups Management */
                    <div className="space-y-6">
                        <GroupManager
                            groups={groups}
                        />
                    </div>
                ) : activeTab === 'errors' ? (
                    /* 404 Errors Log */
                    <div className="card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Code</th>
                                        <th>Original Referrer</th>
                                        <th>Location</th>
                                        <th>Device</th>
                                        <th>Time</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {errorLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-12 text-[var(--muted-foreground)]">
                                                <Check className="w-12 h-12 mx-auto mb-4 text-green-500 opacity-20" />
                                                <p>No 404 errors recorded.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        errorLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-[var(--muted)]/50">
                                                <td className="font-mono text-[var(--primary)] font-medium">/{log.code}</td>
                                                <td className="max-w-xs truncate text-[var(--muted-foreground)]" title={log.original_referrer || ''}>
                                                    {log.original_referrer ? (
                                                        <a href={log.original_referrer} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-[var(--foreground)]">
                                                            {log.original_referrer}
                                                        </a>
                                                    ) : '-'}
                                                </td>
                                                <td>
                                                    {log.city && log.country ? (
                                                        <span className="flex items-center gap-1.5">
                                                            <span className="text-lg">{
                                                                // Simple flag approximation or just show code
                                                                log.country
                                                            }</span>
                                                            <span className="text-sm">{log.city}, {log.country}</span>
                                                        </span>
                                                    ) : log.country ? log.country : '-'}
                                                </td>
                                                <td className="text-sm text-[var(--muted-foreground)]">
                                                    {log.device_type} / {log.os_name}
                                                </td>
                                                <td className="text-sm text-[var(--muted-foreground)]">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </td>
                                                <td>
                                                    <button
                                                        onClick={() => {
                                                            setShowCreateModal(true)
                                                            // We can't pre-fill the modal easily without modifying it, 
                                                            // but user can copy the code
                                                            copyToClipboard(log.code)
                                                        }}
                                                        className="btn btn-ghost btn-xs gap-1"
                                                        title="Copy code to create link"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                        Create
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* Analytics View with Sub-tabs */
                    <div className="space-y-6">
                        {/* Real-time Counter */}
                        <RealTimeCounter clicks={clicks} />

                        {/* Period Comparison Stats */}
                        <PeriodComparison clicks={clicks} />

                        {/* Analytics Sub-tabs */}
                        <div className="card overflow-hidden">
                            <div className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                                <div className="flex gap-1 p-1">
                                    {(['performance', 'traffic', 'geography'] as const).map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setAnalyticsSubTab(tab)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${analyticsSubTab === tab
                                                ? 'bg-[var(--card)] shadow-sm text-[var(--foreground)]'
                                                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                                                }`}
                                        >
                                            {tab === 'performance' && <><BarChart3 className="w-4 h-4" /> Link Performance</>}
                                            {tab === 'traffic' && <><TrendingUp className="w-4 h-4" /> Traffic & Devices</>}
                                            {tab === 'geography' && <><Globe className="w-4 h-4" /> Geography & Referrers</>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="p-4 sm:p-6">
                                <AnalyticsCharts
                                    clicks={filteredClicks}
                                    links={links}
                                    activeSubTab={analyticsSubTab}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <footer className="py-6 text-center text-sm text-[var(--muted-foreground)] border-t border-[var(--border)] bg-[var(--card)]/50 backdrop-blur-sm">
                <p>
                    &copy; {new Date().getFullYear()} Crafted by{' '}
                    <a
                        href="https://www.couponswift.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--primary)] hover:underline font-medium"
                    >
                        CouponSwift
                    </a>
                </p>
            </footer>

            {/* Create Link Modal */}
            {showCreateModal && (
                <CreateLinkModal onClose={() => setShowCreateModal(false)} groups={groups} />
            )}

            {/* Edit Link Modal */}
            {editingLink && (
                <EditLinkModal link={editingLink} groups={groups} onClose={() => setEditingLink(null)} />
            )}

            {/* Delete Link Modal */}
            {deletingLink && (
                <DeleteLinkModal link={deletingLink} onClose={() => setDeletingLink(null)} />
            )}
        </div>
    )
}
