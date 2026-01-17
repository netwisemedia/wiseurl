'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Link as LinkType } from '@/lib/types'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
    link: LinkType
    onClose: () => void
}

export default function DeleteLinkModal({ link, onClose }: Props) {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const router = useRouter()
    const supabase = createClient()

    const handleDelete = async () => {
        setIsLoading(true)
        setError('')

        try {
            const { error: deleteError } = await supabase
                .from('links')
                .delete()
                .eq('id', link.id)

            if (deleteError) throw deleteError

            // Invalidate cache for this link
            fetch('/api/cache/invalidate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: link.code })
            }).catch(() => { }) // fire-and-forget

            router.refresh()
            toast.success('Link deleted!')
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete link')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-sm card bg-[var(--card)] p-6 animate-fadeIn">
                <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                    </div>

                    <h2 className="text-lg font-semibold mb-2">Delete Link?</h2>
                    <p className="text-[var(--muted-foreground)] mb-1">
                        Are you sure you want to delete
                    </p>
                    <code className="text-[var(--primary)] font-mono">/{link.code}</code>
                    <p className="text-sm text-[var(--muted-foreground)] mt-3">
                        This will permanently delete the link and all its click history.
                        This action cannot be undone.
                    </p>
                </div>

                {error && (
                    <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
                        {error}
                    </div>
                )}

                <div className="flex gap-3 mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn btn-secondary flex-1"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isLoading}
                        className="btn flex-1 bg-red-500 hover:bg-red-600 text-white"
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
