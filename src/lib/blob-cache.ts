/**
 * Persistent cache for link redirects using Netlify Blobs
 * 
 * Unlike in-memory cache, this persists across ALL Edge Function instances.
 * Free tier: 100GB storage included with Netlify.
 */

import { getStore } from '@netlify/blobs'

interface CachedLink {
    id: string
    destination_url: string
    cachedAt: number
}

// Cache TTL: 1 year (effectively permanent - invalidate on update)
const CACHE_TTL_MS = 365 * 24 * 60 * 60 * 1000

/**
 * Get a link from persistent cache
 */
export async function getCachedLinkPersistent(code: string): Promise<CachedLink | null> {
    try {
        const store = getStore('links')
        const cached = await store.get(code, { type: 'json' }) as CachedLink | null

        if (!cached) {
            return null
        }

        // Check if expired
        if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
            await store.delete(code)
            return null
        }

        return cached
    } catch {
        // Fallback gracefully if Blobs not available (local dev)
        return null
    }
}

/**
 * Store a link in persistent cache
 */
export async function setCachedLinkPersistent(code: string, id: string, destinationUrl: string): Promise<void> {
    try {
        const store = getStore('links')
        await store.setJSON(code, {
            id,
            destination_url: destinationUrl,
            cachedAt: Date.now()
        } satisfies CachedLink)
    } catch {
        // Ignore errors - cache is optional optimization
    }
}

/**
 * Invalidate a specific link from persistent cache
 */
export async function invalidateCachedLinkPersistent(code: string): Promise<boolean> {
    try {
        const store = getStore('links')
        await store.delete(code)
        return true
    } catch {
        return false
    }
}

/**
 * Invalidate all cached links
 */
export async function invalidateAllLinksPersistent(): Promise<void> {
    try {
        const store = getStore('links')
        const { blobs } = await store.list()
        for (const blob of blobs) {
            await store.delete(blob.key)
        }
    } catch {
        // Ignore errors
    }
}
