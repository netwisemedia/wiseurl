/**
 * In-memory cache for link redirects
 * 
 * Eliminates database latency for repeat visitors.
 * Cache entries last 30 seconds or until manually invalidated via API.
 * The short TTL bounds stale redirects across edge instances that do not share L1 memory.
 */

interface CachedLink {
    id: string
    destination_url: string
    cachedAt: number
}

// Global cache - persists across Edge function invocations in same region
const linkCache = new Map<string, CachedLink>()

const CACHE_TTL = 30 * 1000

/**
 * Get a link from cache if it exists and hasn't expired
 */
export function getCachedLink(code: string): CachedLink | null {
    const cached = linkCache.get(code)

    if (!cached) {
        return null
    }

    // Cross-instance invalidation cannot reach every in-memory map, so expiry is required.
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
