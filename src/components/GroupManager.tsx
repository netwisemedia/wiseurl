'use client'

import { useState } from 'react'
import { Group } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, X, Loader2, Pencil, Check, Trash2, Palette } from 'lucide-react'
import { toast } from 'react-hot-toast'

const COLORS = [
    { name: 'gray', class: 'bg-gray-500' },
    { name: 'red', class: 'bg-red-500' },
    { name: 'orange', class: 'bg-orange-500' },
    { name: 'yellow', class: 'bg-yellow-500' },
    { name: 'green', class: 'bg-green-500' },
    { name: 'blue', class: 'bg-blue-500' },
    { name: 'purple', class: 'bg-purple-500' },
    { name: 'pink', class: 'bg-pink-500' },
]

interface Props {
    groups: Group[]
}

export default function GroupManager({ groups }: Props) {
    const [isCreating, setIsCreating] = useState(false)
    const [newName, setNewName] = useState('')
    const [newColor, setNewColor] = useState('gray')

    const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [editColor, setEditColor] = useState('gray')

    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleCreate = async () => {
        if (!newName.trim()) return

        if (groups.some(g => g.name.toLowerCase() === newName.trim().toLowerCase())) {
            toast.error('Group already exists')
            return
        }

        setIsLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                toast.error('You must be logged in')
                return
            }

            const { error } = await supabase.from('groups').insert({
                name: newName.trim(),
                color: newColor,
                user_id: user.id,
            })

            if (error) throw error

            setNewName('')
            setNewColor('gray')
            setIsCreating(false)
            router.refresh()
            toast.success('Group created')
        } catch (err: any) {
            console.error(err)
            toast.error(err.message || 'Failed to create group')
        } finally {
            setIsLoading(false)
        }
    }

    const handleEdit = async (groupId: string) => {
        if (!editName.trim()) return

        if (groups.some(g => g.id !== groupId && g.name.toLowerCase() === editName.trim().toLowerCase())) {
            toast.error('Group name taken')
            return
        }

        setIsLoading(true)
        try {
            const { error } = await supabase.from('groups').update({
                name: editName.trim(),
                color: editColor,
            }).eq('id', groupId)

            if (error) throw error

            setEditingGroupId(null)
            router.refresh()
            toast.success('Group updated')
        } catch (err: any) {
            console.error(err)
            toast.error('Failed to update group')
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async (groupId: string) => {
        if (!window.confirm('Are you sure? any links in this group will be ungrouped.')) return

        try {
            // 1. Ungroup links
            await supabase.from('links').update({ group_id: null }).eq('group_id', groupId)

            // 2. Delete group
            const { error } = await supabase.from('groups').delete().eq('id', groupId)

            if (error) throw error

            router.refresh()
            toast.success('Group deleted')
        } catch (err: any) {
            console.error(err)
            toast.error('Failed to delete group')
        }
    }

    const startEdit = (group: Group) => {
        setEditingGroupId(group.id)
        setEditName(group.name)
        setEditColor(group.color)
    }

    const getColorClass = (color: string) => {
        return COLORS.find(c => c.name === color)?.class || 'bg-gray-500'
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Create New Group Card */}
            {isCreating ? (
                <div className="card p-4 border-2 border-[var(--primary)] border-dashed flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                        <span className="text-sm font-semibold text-[var(--primary)]">New Group</span>
                        <button onClick={() => setIsCreating(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Name</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="e.g. Social Media"
                                className="input w-full py-2"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1 block">Color</label>
                            <div className="flex flex-wrap gap-2">
                                {COLORS.map(c => (
                                    <button
                                        key={c.name}
                                        onClick={() => setNewColor(c.name)}
                                        className={`w-5 h-5 rounded-full transition-transform ${c.class} ${newColor === c.name ? 'ring-2 ring-offset-2 ring-[var(--foreground)] scale-110' : 'hover:scale-110'}`}
                                        title={c.name}
                                    />
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleCreate}
                            disabled={isLoading || !newName.trim()}
                            className="btn btn-primary w-full btn-sm mt-2"
                        >
                            {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Plus className="w-3 h-3 mr-2" />}
                            Create Group
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setIsCreating(true)}
                    className="card p-4 border-2 border-[var(--border)] border-dashed hover:border-[var(--primary)] hover:bg-[var(--muted)]/50 transition-all flex flex-col items-center justify-center gap-3 min-h-[160px] group"
                >
                    <div className="w-10 h-10 rounded-full bg-[var(--muted)] group-hover:bg-[var(--primary)] group-hover:text-white flex items-center justify-center transition-colors">
                        <Plus className="w-5 h-5" />
                    </div>
                    <span className="font-medium">Create New Group</span>
                </button>
            )}

            {/* Group Cards */}
            {groups.map(group => (
                <div key={group.id} className="card p-4 relative group hover:shadow-md transition-all">
                    {editingGroupId === group.id ? (
                        /* Edit Mode */
                        <div className="space-y-3">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)]">Editing</span>
                                <button onClick={() => setEditingGroupId(null)} className="p-1 hover:bg-[var(--muted)] rounded">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="input w-full py-1.5"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleEdit(group.id)}
                            />

                            <div className="flex flex-wrap gap-2 py-1">
                                {COLORS.map(c => (
                                    <button
                                        key={c.name}
                                        onClick={() => setEditColor(c.name)}
                                        className={`w-4 h-4 rounded-full ${c.class} ${editColor === c.name ? 'ring-2 ring-offset-2 ring-[var(--foreground)]' : ''}`}
                                    />
                                ))}
                            </div>

                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => handleEdit(group.id)}
                                    disabled={isLoading}
                                    className="btn btn-primary btn-sm flex-1"
                                >
                                    <Check className="w-4 h-4 mr-1" /> Save
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* View Mode */
                        <div className="h-full flex flex-col">
                            <div className="flex items-start justify-between mb-4">
                                <div className={`w-8 h-8 rounded-lg ${getColorClass(group.color)} flex items-center justify-center shadow-sm`}>
                                    <Palette className="w-4 h-4 text-white opacity-80" />
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => startEdit(group)}
                                        className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:bg-[var(--muted)] rounded-md transition-colors"
                                        title="Edit"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(group.id)}
                                        className="p-1.5 text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <h3 className="font-semibold text-lg mb-1 truncate" title={group.name}>
                                {group.name}
                            </h3>
                            <p className="text-xs text-[var(--muted-foreground)]">
                                Group ID: <span className="font-mono opacity-70">{group.id.slice(0, 8)}...</span>
                            </p>
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}

export function getColorClass(color: string): string {
    return COLORS.find(c => c.name === color)?.class || 'bg-gray-500'
}
