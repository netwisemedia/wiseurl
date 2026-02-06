import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { setCachedLink, getCacheStats } from '@/lib/link-cache'
import { setCachedLinkPersistent } from '@/lib/blob-cache'

export const runtime = 'edge'

/**
 * Warm the cache by loading all active links from database
 * 
 * GET /api/cache/warm
 * 
 * Call this after deploy to pre-populate both L1 (in-memory) and L2 (persistent) cache.
 */

export async function GET() {
    const startTime = Date.now()

    try {
        const supabase = await createClient()

        // Fetch all active links
        const { data: links, error } = await supabase
            .from('links')
            .select('id, code, destination_url')
            .eq('is_active', true)

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 })
        }

        // Populate both L1 and L2 cache
        let cached = 0
        for (const link of links || []) {
            setCachedLink(link.code, link.id, link.destination_url)
            await setCachedLinkPersistent(link.code, link.id, link.destination_url)
            cached++
        }

        const stats = getCacheStats()
        const duration = Date.now() - startTime

        return NextResponse.json({
            success: true,
            message: `Cache warmed with ${cached} links (L1 + L2)`,
            duration_ms: duration,
            l1_cache_size: stats.size,
            links_loaded: cached,
            timestamp: new Date().toISOString()
        })
    } catch (err) {
        return NextResponse.json({
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
        }, { status: 500 })
    }
}

