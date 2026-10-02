'use client'

import { useMemo, useState } from 'react'
import { Pencil, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { validateHttpUrl } from '@/lib/attribution'
import { filterProgramLinks, parseCookieDays, programForCode, type AccessFilter } from '@/lib/programs'
import { createClient } from '@/lib/supabase/client'
import type { Link, Program, ProgramAccess } from '@/lib/types'

interface Props {
  links: Link[]
  initialPrograms: Program[]
  userId: string
}

const accessOptions: Array<{ value: ProgramAccess | ''; label: string }> = [
  { value: '', label: 'Unknown' },
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'not_applied', label: 'Not applied' },
]

type Draft = {
  network: string
  program_url: string
  signup_url: string
  commission: string
  cookie_days: string
  access: ProgramAccess | ''
  notes: string
}

function draftFrom(program?: Program): Draft {
  return {
    network: program?.network ?? '',
    program_url: program?.program_url ?? '',
    signup_url: program?.signup_url ?? '',
    commission: program?.commission ?? '',
    cookie_days: program?.cookie_days?.toString() ?? '',
    access: program?.access ?? '',
    notes: program?.notes ?? '',
  }
}

function optionalText(value: string): string | null {
  return value.trim() || null
}

export default function Programs({ links, initialPrograms, userId }: Props) {
  const [programs, setPrograms] = useState(initialPrograms)
  const [search, setSearch] = useState('')
  const [accessFilter, setAccessFilter] = useState<AccessFilter>('all')
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(draftFrom())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const visibleLinks = useMemo(
    () => filterProgramLinks(links, programs, search, accessFilter),
    [links, programs, search, accessFilter],
  )

  const beginEdit = (code: string) => {
    setEditingCode(code)
    setDraft(draftFrom(programForCode(programs, code)))
    setError('')
  }

  const save = async (code: string) => {
    setSaving(true)
    setError('')
    try {
      const programUrl = optionalText(draft.program_url)
      const signupUrl = optionalText(draft.signup_url)
      if (programUrl) validateHttpUrl(programUrl)
      if (signupUrl) validateHttpUrl(signupUrl)
      const payload = {
        user_id: userId,
        code, // Exact link code, including dots and case.
        network: optionalText(draft.network),
        program_url: programUrl,
        signup_url: signupUrl,
        commission: optionalText(draft.commission),
        cookie_days: parseCookieDays(draft.cookie_days),
        access: draft.access || null,
        notes: optionalText(draft.notes),
      }
      const { data, error: saveError } = await createClient()
        .from('programs')
        .upsert(payload, { onConflict: 'user_id,code' })
        .select('*')
        .single()
      if (saveError) throw saveError
      const saved = data as Program
      setPrograms(current => [...current.filter(program => program.code !== code), saved])
      setEditingCode(null)
      toast.success(`Program saved for /${code}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save program')
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof Draft, type = 'text') => (
    <label className="block text-sm font-medium">
      {label}
      <input
        className="input mt-1"
        type={type}
        value={draft[key]}
        min={type === 'number' ? 0 : undefined}
        onChange={event => setDraft(current => ({ ...current, [key]: event.target.value }))}
      />
    </label>
  )

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-col md:flex-row gap-3">
        <label className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input className="input pl-9!" aria-label="Search programs" placeholder="Search codes, titles, destinations, or networks" value={search} onChange={event => setSearch(event.target.value)} />
        </label>
        <select className="input md:w-56" aria-label="Filter programs by access" value={accessFilter} onChange={event => setAccessFilter(event.target.value as AccessFilter)}>
          <option value="all">All access states</option>
          {accessOptions.map(option => <option key={option.value || 'unknown'} value={option.value || 'unknown'}>{option.label}</option>)}
        </select>
      </div>
      {visibleLinks.length === 0 && <div className="card p-8 text-center text-[var(--muted-foreground)]">No links match these filters.</div>}
      {visibleLinks.map(link => {
        const program = programForCode(programs, link.code)
        const editing = editingCode === link.code
        return (
          <section key={link.id} className="card p-4 space-y-3" aria-label={`Program for /${link.code}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold break-all">/{link.code}</span>
                  <span className="badge">{accessOptions.find(option => option.value === (program?.access ?? ''))?.label}</span>
                  {!link.is_active && <span className="badge">Inactive link</span>}
                </div>
                <p className="text-sm text-[var(--muted-foreground)] truncate">{link.title || link.destination_url}</p>
                {!editing && program?.network && <p className="text-sm mt-1">{program.network}{program.commission ? ` · ${program.commission}` : ''}</p>}
              </div>
              {!editing && <button type="button" className="btn btn-secondary btn-sm" onClick={() => beginEdit(link.code)}><Pencil size={14} /> Edit</button>}
            </div>
            {editing && (
              <form className="space-y-3 border-t border-[var(--border)] pt-4" onSubmit={event => { event.preventDefault(); void save(link.code) }}>
                <div className="grid gap-3 md:grid-cols-2">
                  {field('Network', 'network')}
                  {field('Program URL', 'program_url', 'url')}
                  {field('Signup URL', 'signup_url', 'url')}
                  {field('Commission', 'commission')}
                  {field('Cookie days', 'cookie_days', 'number')}
                  <label className="block text-sm font-medium">Access
                    <select className="input mt-1" value={draft.access} onChange={event => setDraft(current => ({ ...current, access: event.target.value as Draft['access'] }))}>
                      {accessOptions.map(option => <option key={option.value || 'unknown'} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
                <label className="block text-sm font-medium">Private notes
                  <textarea className="input mt-1 min-h-24" value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} />
                </label>
                {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
                <div className="flex gap-2">
                  <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save program'}</button>
                  <button className="btn btn-secondary btn-sm" type="button" disabled={saving} onClick={() => setEditingCode(null)}>Cancel</button>
                </div>
              </form>
            )}
          </section>
        )
      })}
    </div>
  )
}
