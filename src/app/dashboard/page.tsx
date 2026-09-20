import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'
import type { Group, Link } from '@/lib/types'

export const dynamic = 'force-dynamic'

const METADATA_PAGE_SIZE = 1000

export default async function DashboardPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const links: Link[] = []
    for (let offset = 0; ; offset += METADATA_PAGE_SIZE) {
        const { data, error } = await supabase
            .from('links')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + METADATA_PAGE_SIZE - 1)

        if (error) throw new Error(`Could not load dashboard links: ${error.message}`)
        links.push(...((data || []) as Link[]))
        if (!data || data.length < METADATA_PAGE_SIZE) break
    }

    const groups: Group[] = []
    for (let offset = 0; ; offset += METADATA_PAGE_SIZE) {
        const { data, error } = await supabase
            .from('groups')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })
            .range(offset, offset + METADATA_PAGE_SIZE - 1)

        if (error) throw new Error(`Could not load dashboard groups: ${error.message}`)
        groups.push(...((data || []) as Group[]))
        if (!data || data.length < METADATA_PAGE_SIZE) break
    }

    return <DashboardClient
        initialLinks={links}
        initialGroups={groups}
        userEmail={user.email}
    />
}
