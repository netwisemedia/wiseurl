'use client'

import { useMemo, useState } from 'react'
import { Check, Copy, Tag } from 'lucide-react'

import { buildSourceTaggedUrl } from '@/lib/analytics'

interface Props {
  code: string
}

export default function SourceTaggedUrl({ code }: Props) {
  const [source, setSource] = useState('')
  const [campaign, setCampaign] = useState('')
  const [copied, setCopied] = useState(false)

  const relativeUrl = useMemo(() => {
    if (!source.trim()) return ''
    const full = buildSourceTaggedUrl('https://wiseurl.invalid', code, source, campaign)
    return full.replace('https://wiseurl.invalid', '')
  }, [campaign, code, source])

  const copy = async () => {
    if (!relativeUrl) return
    await navigator.clipboard.writeText(`${window.location.origin}${relativeUrl}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2_000)
  }

  return (
    <details className="group/tag">
      <summary className="cursor-pointer list-none text-xs font-medium text-[var(--primary)] inline-flex items-center gap-1">
        <Tag className="w-3 h-3" /> Source-tagged URL
      </summary>
      <div className="mt-2 p-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 space-y-2 min-w-[280px]">
        <div className="grid grid-cols-2 gap-2">
          <input
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="input text-xs py-1.5"
            placeholder="Source site (required)"
            aria-label="Source site label"
          />
          <input
            value={campaign}
            onChange={(event) => setCampaign(event.target.value)}
            className="input text-xs py-1.5"
            placeholder="Campaign (optional)"
            aria-label="Campaign label"
          />
        </div>
        {relativeUrl ? (
          <div className="flex items-center gap-2">
            <code className="text-xs break-all flex-1">{relativeUrl}</code>
            <button type="button" onClick={copy} className="btn btn-secondary p-2" title="Copy tagged URL">
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        ) : (
          <p className="text-xs text-[var(--muted-foreground)]">Enter the affiliate site that will publish this short URL.</p>
        )}
        <p className="text-[11px] text-[var(--muted-foreground)]">
          The label stays with this URL if it is copied elsewhere. It is recorded inside WiseURL and is not added to the merchant URL.
        </p>
      </div>
    </details>
  )
}
