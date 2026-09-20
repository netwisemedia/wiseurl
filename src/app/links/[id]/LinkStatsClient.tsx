'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Copy, ExternalLink } from 'lucide-react'

import SourceAnalytics from '@/components/SourceAnalytics'
import SourceTaggedUrl from '@/components/SourceTaggedUrl'
import type { Link as LinkType } from '@/lib/types'

interface Props {
  link: LinkType
}

export default function LinkStatsClient({ link }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/${link.code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2_000)
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-40 bg-[var(--card)] border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="btn btn-secondary p-2" aria-label="Back to dashboard"><ArrowLeft className="w-4 h-4" /></Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-mono">/{link.code}</h1>
                <button type="button" onClick={copy} className="p-1.5 rounded hover:bg-[var(--muted)]" title="Copy short URL">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              {link.title && <p className="text-sm text-[var(--muted-foreground)]">{link.title}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SourceTaggedUrl code={link.code} />
            <a href={link.destination_url} target="_blank" rel="noreferrer" className="btn btn-secondary text-sm"><ExternalLink className="w-4 h-4" /> Open destination</a>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <SourceAnalytics links={[link]} groups={[]} fixedLinkId={link.id} />
      </main>
    </div>
  )
}
