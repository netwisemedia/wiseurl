import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import LinkStatsClient from './LinkStatsClient'

export const dynamic = 'force-dynamic'

interface Props {
    params: Promise<{ id: string }>
}

export default async function LinkStatsPage({ params }: Props) {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // Get link
    const { data: link, error: linkError } = await supabase
        .from('links')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()

    if (linkError || !link) notFound()

    return <LinkStatsClient link={link} />
}
