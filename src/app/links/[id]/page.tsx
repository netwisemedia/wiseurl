import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import LinkStatsClient from './LinkStatsClient'
import { getPresetRange, parseAnalyticsAsOf, validateAnalyticsScope } from '@/lib/analytics'

export const dynamic = 'force-dynamic'

interface Props {
    params: Promise<{ id: string }>
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value
}

export default async function LinkStatsPage({ params, searchParams }: Props) {
    const { id } = await params
    const query = await searchParams
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

    if (linkError?.code === 'PGRST116') notFound()
    if (linkError) throw new Error(`Could not load link: ${linkError.message}`)
    if (!link) notFound()

    const preset = getPresetRange(30)
    let initialScope
    let asOf: string | null = null
    try {
        initialScope = validateAnalyticsScope({
            from: first(query.from) || preset.from,
            to: first(query.to) || preset.to,
            source: first(query.source),
            linkId: id,
            groupId: null,
        })
        asOf = parseAnalyticsAsOf(first(query.asOf))
    } catch {
        initialScope = validateAnalyticsScope({ ...preset, linkId: id })
    }

    return <LinkStatsClient link={link} initialScope={{ ...initialScope, asOf }} />
}
