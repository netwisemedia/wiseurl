import { NextRequest, NextResponse } from 'next/server'
import { invalidateCachedLink, invalidateAllLinks, getCacheStats, setCachedLink } from '@/lib/link-cache'
import { invalidateCachedLinkPersistent, invalidateAllLinksPersistent, setCachedLinkPersistent } from '@/lib/blob-cache'

export const runtime = 'edge'

/**
 * API to invalidate link cache (both L1 in-memory and L2 persistent)
 * 
 * POST /api/cache/invalidate
 * Body: { code: "linkcode" } - invalidate specific link
 * Body: { all: true } - invalidate all links
 * 
 * GET /api/cache/invalidate - get cache stats
 */

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        if (body.all === true) {
            invalidateAllLinks()
            await invalidateAllLinksPersistent()
            return NextResponse.json({ success: true, message: 'All cache cleared (L1 + L2)' })
        }

        if (body.code && typeof body.code === 'string') {
            const deletedL1 = invalidateCachedLink(body.code)
            const deletedL2 = await invalidateCachedLinkPersistent(body.code)
            return NextResponse.json({
                success: true,
                message: `Cache cleared for /${body.code}`,
                l1_cleared: deletedL1,
                l2_cleared: deletedL2
            })
        }

        return NextResponse.json({ error: 'Provide { code: "xxx" } or { all: true }' }, { status: 400 })
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
}

export async function GET() {
    const stats = getCacheStats()
    return NextResponse.json({
        l1_memory: stats,
        note: 'L2 persistent cache (Netlify Blobs) does not have stats endpoint'
    })
}

/**
 * Update cache with new link data (invalidate + warm in one call)
 * 
 * PUT /api/cache/invalidate
 * Body: { code: "xxx", id: "uuid", destination_url: "https://..." }
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()

        if (!body.code || !body.id || !body.destination_url) {
            return NextResponse.json(
                { error: 'Provide { code, id, destination_url }' },
                { status: 400 }
            )
        }

        // Invalidate old entry
        invalidateCachedLink(body.code)
        await invalidateCachedLinkPersistent(body.code)

        // Set new entry
        setCachedLink(body.code, body.id, body.destination_url)
        await setCachedLinkPersistent(body.code, body.id, body.destination_url)

        return NextResponse.json({
            success: true,
            message: `Cache updated for /${body.code}`,
            destination_url: body.destination_url
        })
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
}

