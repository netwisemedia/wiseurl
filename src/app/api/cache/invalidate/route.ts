import { NextRequest, NextResponse } from 'next/server'
import { invalidateCachedLink, invalidateAllLinks, getCacheStats } from '@/lib/link-cache'

export const runtime = 'edge'

/**
 * API to invalidate link cache
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
            return NextResponse.json({ success: true, message: 'All cache cleared' })
        }

        if (body.code && typeof body.code === 'string') {
            const deleted = invalidateCachedLink(body.code)
            return NextResponse.json({
                success: true,
                message: deleted ? `Cache cleared for /${body.code}` : `/${body.code} was not cached`
            })
        }

        return NextResponse.json({ error: 'Provide { code: "xxx" } or { all: true }' }, { status: 400 })
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
}

export async function GET() {
    const stats = getCacheStats()
    return NextResponse.json(stats)
}
