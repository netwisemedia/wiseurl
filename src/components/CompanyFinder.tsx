'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Pencil, Search, X } from 'lucide-react'

import { findCompanyLinks } from '@/lib/company-finder'
import type { Link as LinkType } from '@/lib/types'

interface Props {
  links: LinkType[]
  onClose: () => void
  onEdit: (link: LinkType) => void
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function CompanyFinder({ links, onClose, onEdit }: Props) {
  const [query, setQuery] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const results = useMemo(() => findCompanyLinks(links, query), [links, query])

  useEffect(() => {
    inputRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="company-finder-layer" onMouseDown={event => {
      if (event.currentTarget === event.target) onClose()
    }}>
      <div ref={dialogRef} className="company-finder-dialog" role="dialog" aria-modal="true" aria-labelledby="company-finder-title">
        <div className="company-finder-heading">
          <div>
            <h2 id="company-finder-title">Find a company</h2>
            <p>Search all your links, including inactive ones.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close company finder"><X size={18} /></button>
        </div>

        <label className="company-finder-search">
          <span className="sr-only">Search by company, short code, or destination</span>
          <Search size={17} aria-hidden="true" />
          <input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Try Scala Hosting or scalahosting" autoComplete="off" />
        </label>

        <div className="company-finder-results" aria-live="polite">
          {!query.trim() && <p className="company-finder-empty">Enter a company, short code, or destination.</p>}
          {query.trim() && results.length === 0 && <p className="company-finder-empty">No links match “{query.trim()}”.</p>}
          {results.map(link => (
            <article key={link.id} className="company-finder-result">
              <div className="company-finder-result-copy">
                <div className="company-finder-result-title">
                  <strong>{link.title || `/${link.code}`}</strong>
                  <span className={link.is_active ? 'company-status-active' : 'company-status-inactive'}>{link.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                <p className="font-mono">/{link.code}</p>
                <p className="company-finder-destination">{link.destination_url}</p>
              </div>
              <div className="company-finder-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => onEdit(link)}><Pencil size={14} />Edit destination</button>
                <Link href={`/links/${link.id}`} className="btn btn-secondary btn-sm" onClick={onClose}>Details <ExternalLink size={13} /></Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
