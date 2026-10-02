'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BarChart3,
  LayoutDashboard,
  FolderOpen,
  ChevronRight,
  Check,
  Copy,
  ExternalLink,
  LinkIcon,
  LogOut,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  User,
} from 'lucide-react'

import CreateLinkModal from '@/components/CreateLinkModal'
import CompanyFinder from '@/components/CompanyFinder'
import DeleteLinkModal from '@/components/DeleteLinkModal'
import EditLinkModal from '@/components/EditLinkModal'
import GroupManager from '@/components/GroupManager'
import SourceAnalytics from '@/components/SourceAnalytics'
import Overview from '@/components/overview/Overview'
import MissingLinkOpportunities from '@/components/MissingLinkOpportunities'
import SourceTaggedUrl from '@/components/SourceTaggedUrl'
import { createClient } from '@/lib/supabase/client'
import type { Group, Link as LinkType } from '@/lib/types'

interface Props {
  initialLinks: LinkType[]
  initialGroups: Group[]
  userEmail?: string
}

type Tab = 'overview' | 'links' | 'groups' | 'analytics' | 'opportunities'

const GROUP_COLORS: Record<string, string> = {
  red: 'bg-red-500', blue: 'bg-blue-500', green: 'bg-green-500', yellow: 'bg-yellow-500',
  orange: 'bg-orange-500', purple: 'bg-purple-500', pink: 'bg-pink-500', gray: 'bg-gray-500',
}

function destinationHost(value: string): string {
  try {
    return new URL(value).hostname
  } catch {
    return value
  }
}

export default function DashboardClient({ initialLinks, initialGroups, userEmail }: Props) {
  const links = initialLinks
  const groups = initialGroups
  const searchParams = useSearchParams()
  const requestedView = searchParams.get('view')
  const activeTab: Tab = requestedView === 'links' || requestedView === 'groups' || requestedView === 'analytics' || requestedView === 'opportunities' ? requestedView : 'overview'
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createCode, setCreateCode] = useState('')
  const [showCompanyFinder, setShowCompanyFinder] = useState(false)
  const [editingLink, setEditingLink] = useState<LinkType | null>(null)
  const [deletingLink, setDeletingLink] = useState<LinkType | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const companyFinderButtonRef = useRef<HTMLButtonElement>(null)
  const editReturnFocusRef = useRef<HTMLElement | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const setActiveTab = (tab: Tab) => {
    const query = new URLSearchParams(searchParams.toString())
    query.set('view', tab)
    router.replace(`/dashboard?${query}`, { scroll: false })
  }
  const navigation = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'links' as const, label: 'Links', icon: LinkIcon },
    { id: 'opportunities' as const, label: 'Affiliate opportunities', icon: BarChart3 },
    { id: 'analytics' as const, label: 'Source reports', icon: BarChart3 },
    { id: 'groups' as const, label: 'Groups', icon: FolderOpen },
  ]

  const filteredLinks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return [...links]
      .filter(link => !selectedGroupId || link.group_id === selectedGroupId)
      .filter(link => !query
        || link.code.toLowerCase().includes(query)
        || link.title?.toLowerCase().includes(query)
        || link.destination_url.toLowerCase().includes(query))
      .sort((first, second) => first.code.localeCompare(second.code))
  }, [links, searchQuery, selectedGroupId])

  const pageSize = 25
  const pageCount = Math.max(1, Math.ceil(filteredLinks.length / pageSize))
  const safePage = Math.min(currentPage, pageCount)
  const pagedLinks = filteredLinks.slice((safePage - 1) * pageSize, safePage * pageSize)

  const changeSearch = (value: string) => {
    setSearchQuery(value)
    setCurrentPage(1)
  }

  const changeGroup = (value: string | null) => {
    setSelectedGroupId(value)
    setCurrentPage(1)
  }

  const copyShortLink = async (code: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/${code}`)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2_000)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const closeCompanyFinder = () => {
    setShowCompanyFinder(false)
    requestAnimationFrame(() => companyFinderButtonRef.current?.focus())
  }

  const openLinkEditor = (link: LinkType) => {
    editReturnFocusRef.current = document.activeElement as HTMLElement | null
    setEditingLink(link)
  }

  const closeLinkEditor = () => {
    setEditingLink(null)
    requestAnimationFrame(() => {
      const target = editReturnFocusRef.current
      if (target?.isConnected) target.focus()
      else companyFinderButtonRef.current?.focus()
    })
  }

  const editFromCompanyFinder = (link: LinkType) => {
    editReturnFocusRef.current = companyFinderButtonRef.current
    setShowCompanyFinder(false)
    setEditingLink(link)
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <button type="button" onClick={() => setActiveTab('overview')} className="brand-button" aria-label="WiseURL overview"><span className="brand-mark"><LinkIcon size={21} /></span><span>wiseurl<span className="text-[var(--primary)]">.</span></span></button>
        <p className="sidebar-caption">WORKSPACE</p>
        <nav className="admin-nav" aria-label="Main navigation">{navigation.map(item => <button key={item.id} type="button" onClick={() => setActiveTab(item.id)} aria-current={activeTab === item.id ? 'page' : undefined} className={activeTab === item.id ? 'active' : ''}><item.icon size={18} /><span>{item.label}</span>{item.id === 'links' && <span className="nav-count">{links.length}</span>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="workspace-note"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-2" />{links.filter(link => link.is_active).length} active links<p>Your links. Your traffic.</p></div><Link href="/settings" className="sidebar-settings"><Settings size={17} />Settings</Link></div>
      </aside>
      <div className="admin-content">
        <header className="admin-topbar"><div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]"><span className="hidden sm:inline">Workspace</span><ChevronRight size={13} className="hidden sm:block" /><span className="font-medium text-[var(--foreground)]">{navigation.find(item => item.id === activeTab)?.label}</span></div><div className="flex items-center gap-2 sm:gap-3"><button ref={companyFinderButtonRef} type="button" className="btn btn-secondary btn-sm topbar-company-finder" aria-haspopup="dialog" aria-expanded={showCompanyFinder} onClick={() => setShowCompanyFinder(true)}><Search size={15} /><span>Find company</span></button><button type="button" className="btn btn-primary btn-sm" aria-label="New link" onClick={() => setShowCreateModal(true)}><Plus size={15} /><span className="topbar-new-link-label">New link</span></button><div className="relative"><button type="button" aria-label="Account menu" aria-expanded={showUserMenu} onClick={() => setShowUserMenu(open => !open)} className="account-avatar">{userEmail?.[0]?.toUpperCase() || <User size={16} />}</button>{showUserMenu && <div className="absolute right-0 top-12 w-60 card p-2 shadow-xl z-50">{userEmail && <p className="px-3 py-2 text-sm truncate text-[var(--muted-foreground)]">{userEmail}</p>}<Link href="/settings" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--muted)]"><Settings size={16} />Settings</Link><button type="button" onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-500 hover:bg-red-500/10"><LogOut size={16} />Log out</button></div>}</div></div></header>
        <main className="admin-main">
        {activeTab === 'overview' && <Overview groups={groups} revision={links.map(link => `${link.id}:${link.updated_at}`).join(',')} onCreate={() => setShowCreateModal(true)} />}
        {activeTab === 'opportunities' && <MissingLinkOpportunities revision={links.map(link => `${link.id}:${link.updated_at}`).join(',')} onCreate={code => { setCreateCode(code); setShowCreateModal(true) }} onEdit={id => { const link = links.find(link => link.id === id); if (link) openLinkEditor(link) }} />}
        {activeTab !== 'overview' && activeTab !== 'opportunities' && <div className="mb-6"><p className="eyebrow">YOUR AFFILIATE WORKSPACE</p><h1 className="page-title">{activeTab === 'links' ? 'Your links' : activeTab === 'groups' ? 'Link groups' : 'Source reports'}</h1><p className="page-description">{activeTab === 'links' ? 'Manage your destinations, copy publishing URLs and explore each link.' : activeTab === 'groups' ? 'Organize links by company, campaign or channel.' : 'Explore attribution, destinations and individual click events.'}</p></div>}

        {activeTab === 'links' && (
          <div className="space-y-4">
            <div className="card p-4 flex flex-col md:flex-row gap-3">
              <label className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <input value={searchQuery} onChange={event => changeSearch(event.target.value)} className="input pl-9!" aria-label="Search links" placeholder="Search links, titles, or destinations" />
              </label>
              <select aria-label="Filter links by group" value={selectedGroupId || ''} onChange={event => changeGroup(event.target.value || null)} className="input md:w-56">
                <option value="">All groups</option>
                {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Short link</th><th>Destination</th><th>Group</th><th>Status</th><th>Publishing URL</th><th>Actions</th></tr></thead>
                  <tbody>
                    {pagedLinks.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-[var(--muted-foreground)]">No links match these filters.</td></tr>
                    ) : pagedLinks.map(link => {
                      const group = groups.find(item => item.id === link.group_id)
                      return (
                        <tr key={link.id}>
                          <td>
                            <div className="flex items-center gap-2">
                              <Link href={`/links/${link.id}`} className="font-mono font-semibold text-[var(--primary)]">/{link.code}</Link>
                              <button type="button" onClick={() => void copyShortLink(link.code)} className="p-1 rounded hover:bg-[var(--muted)]" title="Copy short URL" aria-label={`Copy /${link.code}`}>
                                {copiedCode === link.code ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            {link.title && <p className="text-sm text-[var(--muted-foreground)] mt-1">{link.title}</p>}
                          </td>
                          <td className="max-w-[260px]">
                            <a href={link.destination_url} target="_blank" rel="noreferrer" className="text-sm inline-flex items-center gap-1 hover:text-[var(--primary)] max-w-full">
                              <span className="truncate">{destinationHost(link.destination_url)}</span><ExternalLink className="w-3 h-3 flex-none" />
                            </a>
                          </td>
                          <td>{group ? <span className="inline-flex items-center gap-2 text-sm"><span className={`w-2 h-2 rounded-full ${GROUP_COLORS[group.color] || 'bg-gray-500'}`} />{group.name}</span> : '—'}</td>
                          <td><span className={`badge ${link.is_active ? 'text-green-600' : 'text-red-500'}`}>{link.is_active ? 'Active' : 'Inactive'}</span></td>
                          <td><SourceTaggedUrl code={link.code} /></td>
                          <td>
                            <div className="flex gap-1">
                              <Link href={`/links/${link.id}`} className="p-2 rounded hover:bg-[var(--muted)] text-[var(--primary)]" title="View analytics"><BarChart3 className="w-4 h-4" /></Link>
                              <button type="button" onClick={() => openLinkEditor(link)} className="p-2 rounded hover:bg-[var(--muted)]" title="Edit" aria-label={`Edit /${link.code}`}><Pencil className="w-4 h-4" /></button>
                              <button type="button" onClick={() => setDeletingLink(link)} className="p-2 rounded hover:bg-red-500/10 text-red-500" title="Delete" aria-label={`Delete /${link.code}`}><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {pageCount > 1 && (
                <div className="p-4 border-t border-[var(--border)] flex items-center justify-between">
                  <p className="text-sm text-[var(--muted-foreground)]">Page {safePage} of {pageCount}</p>
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-secondary text-sm" disabled={safePage === 1} onClick={() => setCurrentPage(page => Math.max(1, page - 1))}>Previous</button>
                    <button type="button" className="btn btn-secondary text-sm" disabled={safePage === pageCount} onClick={() => setCurrentPage(page => Math.min(pageCount, page + 1))}>Next</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'groups' && <GroupManager groups={groups} />}
        {activeTab === 'analytics' && <SourceAnalytics links={links} groups={groups} />}
      </main>
      </div>

      {showCreateModal && <CreateLinkModal groups={groups} initialCode={createCode} onClose={() => { setShowCreateModal(false); setCreateCode('') }} />}
      {showCompanyFinder && <CompanyFinder links={links} onClose={closeCompanyFinder} onEdit={editFromCompanyFinder} />}
      {editingLink && <EditLinkModal link={editingLink} groups={groups} onClose={closeLinkEditor} />}
      {deletingLink && <DeleteLinkModal link={deletingLink} onClose={() => setDeletingLink(null)} />}
    </div>
  )
}
