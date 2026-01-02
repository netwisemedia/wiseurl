import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Fetch links
    const { data: links } = await supabase
        .from('links')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    // Fetch clicks for stats
    const { data: clicks } = await supabase
        .from('clicks')
        .select('*')
        .in('link_id', links?.map((l: { id: string }) => l.id) || [])
        .eq('is_bot', false)
        .order('clicked_at', { ascending: false })

    // Fetch groups
    const { data: groups } = await supabase
        .from('groups')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

    return <DashboardClient
        initialLinks={links || []}
        initialClicks={clicks || []}
        initialGroups={groups || []}
        userEmail={user.email}
    />
}
