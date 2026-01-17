/**
 * In-memory cache for link redirects
 * 
 * Eliminates database latency for repeat visitors.
 * Cache entries last 1 year or until manually invalidated via API.
 */

interface CachedLink {
    id: string
    destination_url: string
    cachedAt: number
}

// Global cache - persists across Edge function invocations in same region
const linkCache = new Map<string, CachedLink>()

// Cache TTL: 1 year (effectively permanent - invalidate on update)
const CACHE_TTL = 365 * 24 * 60 * 60 * 1000

/**
 * Get a link from cache if it exists and hasn't expired
 */
export function getCachedLink(code: string): CachedLink | null {
    const cached = linkCache.get(code)

    if (!cached) {
        return null
    }

    // Check if expired (shouldn't happen with 1 year TTL, but safety check)
    if (Date.now() - cached.cachedAt > CACHE_TTL) {
        linkCache.delete(code)
        return null
    }

    return cached
}

/**
 * Store a link in cache
 */
export function setCachedLink(code: string, id: string, destinationUrl: string): void {
    linkCache.set(code, {
        id,
        destination_url: destinationUrl,
        cachedAt: Date.now()
    })
}

/**
 * Invalidate a specific link from cache
 * Call this from your dashboard when a link is updated or deleted
 */
export function invalidateCachedLink(code: string): boolean {
    return linkCache.delete(code)
}

/**
 * Invalidate all cached links
 * Useful after bulk updates or deploys
 */
export function invalidateAllLinks(): void {
    linkCache.clear()
}

/**
 * Get cache stats for debugging
 */
export function getCacheStats(): { size: number; codes: string[] } {
    return {
        size: linkCache.size,
        codes: Array.from(linkCache.keys())
    }
}
