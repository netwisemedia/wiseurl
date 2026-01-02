'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Group } from '@/lib/types'
import { X, LinkIcon, Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
    onClose: () => void
    groups: Group[]
}

export default function CreateLinkModal({ onClose, groups }: Props) {
    const [code, setCode] = useState('')
    const [destinationUrl, setDestinationUrl] = useState('')
    const [title, setTitle] = useState('')
    const [tags, setTags] = useState('')
    const [groupId, setGroupId] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    // UTM Parameters
    const [showUtm, setShowUtm] = useState(false)
    const [utmSource, setUtmSource] = useState('')
    const [utmMedium, setUtmMedium] = useState('')
    const [utmCampaign, setUtmCampaign] = useState('')
    const [utmContent, setUtmContent] = useState('')
    const [utmTerm, setUtmTerm] = useState('')

    const router = useRouter()
    const supabase = createClient()

    // Build final URL with UTM parameters
    const finalUrl = useMemo(() => {
        if (!destinationUrl) return ''
        try {
            const url = new URL(destinationUrl)
            if (utmSource) url.searchParams.set('utm_source', utmSource)
            if (utmMedium) url.searchParams.set('utm_medium', utmMedium)
            if (utmCampaign) url.searchParams.set('utm_campaign', utmCampaign)
            if (utmContent) url.searchParams.set('utm_content', utmContent)
            if (utmTerm) url.searchParams.set('utm_term', utmTerm)
            return url.toString()
        } catch {
            return destinationUrl
        }
    }, [destinationUrl, utmSource, utmMedium, utmCampaign, utmContent, utmTerm])

    // Generate random code
    const generateCode = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
        let result = ''
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        setCode(result)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')

        try {
            // Validate URL
            new URL(finalUrl || destinationUrl)

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            const { error: insertError } = await supabase
                .from('links')
                .insert({
                    code: code.toLowerCase().trim(),
                    destination_url: finalUrl || destinationUrl.trim(),
                    title: title.trim() || null,
                    user_id: user.id,
                    is_active: true,
                    tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                    group_id: groupId,
                })

            if (insertError) {
                if (insertError.code === '23505') {
                    throw new Error('This code is already taken. Please choose another.')
                }
                throw insertError
            }

            router.refresh()
            toast.success('Link created successfully!')
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create link')
        } finally {
            setIsLoading(false)
        }
    }

    const hasUtmParams = utmSource || utmMedium || utmCampaign || utmContent || utmTerm

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md card bg-[var(--card)] p-6 animate-fadeIn max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                            <LinkIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">Create New Link</h2>
                            <p className="text-sm text-[var(--muted-foreground)]">Add a new link</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost p-2">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Code */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Short Code
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">/</span>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ''))}
                                    className="input pl-7"
                                    placeholder="hostgator"
                                    required
                                    pattern="[a-zA-Z0-9-_]+"
                                    maxLength={50}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={generateCode}
                                className="btn btn-secondary"
                                title="Generate random code"
                            >
                                <Sparkles className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Destination URL */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Destination URL
                        </label>
                        <input
                            type="url"
                            value={destinationUrl}
                            onChange={(e) => setDestinationUrl(e.target.value)}
                            className="input"
                            placeholder="https://www.hostgator.com/affiliate?id=123"
                            required
                        />
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Title <span className="text-[var(--muted-foreground)] font-normal">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="input"
                            placeholder="HostGator Affiliate Link"
                            maxLength={255}
                        />
                    </div>

                    {/* Group */}
                    {groups.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Group <span className="text-[var(--muted-foreground)] font-normal">(optional)</span>
                            </label>
                            <select
                                value={groupId || ''}
                                onChange={(e) => setGroupId(e.target.value || null)}
                                className="input"
                            >
                                <option value="">No group</option>
                                {groups.map(g => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Tags */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Tags <span className="text-[var(--muted-foreground)] font-normal">(optional, comma-separated)</span>
                        </label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            className="input"
                            placeholder="hosting, vpn, deals"
                        />
                    </div>

                    {/* UTM Builder */}
                    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setShowUtm(!showUtm)}
                            className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium hover:bg-[var(--muted)] transition-colors"
                        >
                            <span className="flex items-center gap-2">
                                UTM Parameters
                                {hasUtmParams && (
                                    <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--primary)] text-white">
                                        {[utmSource, utmMedium, utmCampaign, utmContent, utmTerm].filter(Boolean).length}
                                    </span>
                                )}
                            </span>
                            {showUtm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {showUtm && (
                            <div className="p-4 border-t border-[var(--border)] space-y-3 bg-[var(--muted)]/30">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-[var(--muted-foreground)] mb-1">Source</label>
                                        <input
                                            type="text"
                                            value={utmSource}
                                            onChange={(e) => setUtmSource(e.target.value)}
                                            className="input text-sm py-2"
                                            placeholder="google"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-[var(--muted-foreground)] mb-1">Medium</label>
                                        <input
                                            type="text"
                                            value={utmMedium}
                                            onChange={(e) => setUtmMedium(e.target.value)}
                                            className="input text-sm py-2"
                                            placeholder="cpc"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-[var(--muted-foreground)] mb-1">Campaign</label>
                                    <input
                                        type="text"
                                        value={utmCampaign}
                                        onChange={(e) => setUtmCampaign(e.target.value)}
                                        className="input text-sm py-2"
                                        placeholder="summer_sale"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-[var(--muted-foreground)] mb-1">Content</label>
                                        <input
                                            type="text"
                                            value={utmContent}
                                            onChange={(e) => setUtmContent(e.target.value)}
                                            className="input text-sm py-2"
                                            placeholder="banner"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-[var(--muted-foreground)] mb-1">Term</label>
                                        <input
                                            type="text"
                                            value={utmTerm}
                                            onChange={(e) => setUtmTerm(e.target.value)}
                                            className="input text-sm py-2"
                                            placeholder="hosting"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Preview */}
                    {code && (
                        <div className="p-3 rounded-lg bg-[var(--muted)] text-sm">
                            <p className="text-[var(--muted-foreground)] mb-1">Your link will be:</p>
                            <code className="text-[var(--primary)] font-mono">
                                {typeof window !== 'undefined' ? window.location.origin : 'https://wiseurl.net'}/{code}
                            </code>
                            {hasUtmParams && (
                                <p className="text-xs text-[var(--muted-foreground)] mt-2 break-all">
                                    → {finalUrl}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary flex-1"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !code || !destinationUrl}
                            className="btn btn-primary flex-1"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                'Create Link'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
