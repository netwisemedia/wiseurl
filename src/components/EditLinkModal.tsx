'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Link as LinkType, Group } from '@/lib/types'
import { X, LinkIcon, Loader2, Save } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
    link: LinkType
    groups: Group[]
    onClose: () => void
}

export default function EditLinkModal({ link, groups, onClose }: Props) {
    const [destinationUrl, setDestinationUrl] = useState(link.destination_url)
    const [title, setTitle] = useState(link.title || '')
    const [groupId, setGroupId] = useState<string | null>(link.group_id)
    const [isActive, setIsActive] = useState(link.is_active)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const router = useRouter()
    const supabase = createClient()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')

        try {
            new URL(destinationUrl)

            const { error: updateError } = await supabase
                .from('links')
                .update({
                    destination_url: destinationUrl.trim(),
                    title: title.trim() || null,
                    group_id: groupId,
                    is_active: isActive,
                })
                .eq('id', link.id)

            if (updateError) throw updateError

            // Invalidate cache for this link
            fetch('/api/cache/invalidate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: link.code })
            }).catch(() => { }) // fire-and-forget

            router.refresh()
            toast.success('Link updated!')
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update link')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md card bg-[var(--card)] p-6 animate-fadeIn">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                            <LinkIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">Edit Link</h2>
                            <p className="text-sm text-[var(--muted-foreground)]">/{link.code}</p>
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

                    {/* Code (readonly) */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Short Code</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">/</span>
                            <input
                                type="text"
                                value={link.code}
                                disabled
                                className="input pl-7 bg-[var(--muted)] cursor-not-allowed opacity-60"
                            />
                        </div>
                    </div>

                    {/* Destination URL */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Destination URL</label>
                        <input
                            type="url"
                            value={destinationUrl}
                            onChange={(e) => setDestinationUrl(e.target.value)}
                            className="input"
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

                    {/* Active Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--muted)]">
                        <div>
                            <p className="font-medium">Active</p>
                            <p className="text-sm text-[var(--muted-foreground)]">Inactive links return 404</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsActive(!isActive)}
                            className={`relative w-12 h-6 rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-400'}`}
                        >
                            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isActive ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
                            Cancel
                        </button>
                        <button type="submit" disabled={isLoading || !destinationUrl} className="btn btn-primary flex-1">
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
