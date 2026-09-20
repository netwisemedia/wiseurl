'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
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
import DeleteLinkModal from '@/components/DeleteLinkModal'
import EditLinkModal from '@/components/EditLinkModal'
import GroupManager from '@/components/GroupManager'
import SourceAnalytics from '@/components/SourceAnalytics'
import SourceTaggedUrl from '@/components/SourceTaggedUrl'
import { createClient } from '@/lib/supabase/client'
import type { Group, Link as LinkType } from '@/lib/types'

interface Props {
  initialLinks: LinkType[]
  initialGroups: Group[]
  userEmail?: string
}

type Tab = 'links' | 'groups' | 'analytics'

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
  const [activeTab, setActiveTab] = useState<Tab>('links')
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingLink, setEditingLink] = useState<LinkType | null>(null)
  const [deletingLink, setDeletingLink] = useState<LinkType | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const router = useRouter()
  const supabase = createClient()

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

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-40 bg-[var(--card)] border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button type="button" onClick={() => setActiveTab('links')} className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center"><LinkIcon className="w-5 h-5 text-white" /></span>
            <span className="text-lg font-bold">WiseURL</span>
          </button>
          <div className="relative">
            <button type="button" onClick={() => setShowUserMenu(open => !open)} className="w-9 h-9 rounded-full bg-gradient-primary text-white flex items-center justify-center font-semibold">
              {userEmail?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-12 w-60 card p-2 shadow-xl z-50">
                {userEmail && <p className="px-3 py-2 text-sm truncate text-[var(--muted-foreground)]">{userEmail}</p>}
                <Link href="/settings" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--muted)]"><Settings className="w-4 h-4" /> Settings</Link>
                <button type="button" onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-500 hover:bg-red-500/10"><LogOut className="w-4 h-4" /> Log out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="card p-5"><p className="text-sm text-[var(--muted-foreground)]">Links</p><p className="text-3xl font-bold mt-2">{links.length}</p></div>
          <div className="card p-5"><p className="text-sm text-[var(--muted-foreground)]">Active links</p><p className="text-3xl font-bold mt-2">{links.filter(link => link.is_active).length}</p></div>
          <div className="card p-5"><p className="text-sm text-[var(--muted-foreground)]">Groups</p><p className="text-3xl font-bold mt-2">{groups.length}</p></div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex gap-1 p-1 bg-[var(--muted)] rounded-lg overflow-x-auto">
            <button type="button" onClick={() => setActiveTab('links')} className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'links' ? 'bg-[var(--card)] shadow-sm' : 'text-[var(--muted-foreground)]'}`}><LinkIcon className="w-4 h-4 inline mr-2" />Links</button>
            <button type="button" onClick={() => setActiveTab('groups')} className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'groups' ? 'bg-[var(--card)] shadow-sm' : 'text-[var(--muted-foreground)]'}`}><Settings className="w-4 h-4 inline mr-2" />Groups</button>
            <button type="button" onClick={() => setActiveTab('analytics')} className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'analytics' ? 'bg-[var(--card)] shadow-sm' : 'text-[var(--muted-foreground)]'}`}><BarChart3 className="w-4 h-4 inline mr-2" />Analytics</button>
          </div>
          {activeTab === 'links' && (
            <button type="button" className="btn btn-primary" onClick={() => setShowCreateModal(true)}><Plus className="w-4 h-4" /> New link</button>
          )}
        </div>

        {activeTab === 'links' && (
          <div className="space-y-4">
            <div className="card p-4 flex flex-col md:flex-row gap-3">
              <label className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <input value={searchQuery} onChange={event => changeSearch(event.target.value)} className="input pl-9" placeholder="Search links, titles, or destinations" />
              </label>
              <select value={selectedGroupId || ''} onChange={event => changeGroup(event.target.value || null)} className="input md:w-56">
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
                              <button type="button" onClick={() => void copyShortLink(link.code)} className="p-1 rounded hover:bg-[var(--muted)]" title="Copy short URL">
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
                              <button type="button" onClick={() => setEditingLink(link)} className="p-2 rounded hover:bg-[var(--muted)]" title="Edit"><Pencil className="w-4 h-4" /></button>
                              <button type="button" onClick={() => setDeletingLink(link)} className="p-2 rounded hover:bg-red-500/10 text-red-500" title="Delete"><Trash2 className="w-4 h-4" /></button>
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

      {showCreateModal && <CreateLinkModal groups={groups} onClose={() => setShowCreateModal(false)} />}
      {editingLink && <EditLinkModal link={editingLink} groups={groups} onClose={() => setEditingLink(null)} />}
      {deletingLink && <DeleteLinkModal link={deletingLink} onClose={() => setDeletingLink(null)} />}
    </div>
  )
}
