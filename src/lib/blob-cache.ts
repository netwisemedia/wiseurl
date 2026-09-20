import { getStore } from '@netlify/blobs'

export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const CACHE_READ_TIMEOUT_MS = 500
const FENCE_LEASE_MS = 5 * 60_000
const STORE_NAME = 'redirect-config-v1'

export interface RedirectLink { id: string; destination_url: string }
interface LinkRecord extends RedirectLink { version: 1; kind: 'link'; cachedAt: number }
interface TombstoneRecord { version: 1; kind: 'tombstone'; cachedAt: number; mutationId: string; busyUntil: number | null }
export type BlobLinkRecord = LinkRecord | TombstoneRecord
export interface CacheFence { etag: string; mutationId: string }
export type ScheduleWork = (work: () => Promise<void>) => void
interface WriteOptions { onlyIfNew?: boolean; onlyIfMatch?: string }
interface WriteResult { modified: boolean; etag?: string }

export interface LinkBlobStore {
  getWithMetadata(key: string, options?: { type: 'json'; consistency?: 'strong' }): Promise<{
    data: BlobLinkRecord; etag?: string; metadata: Record<string, unknown>
  } | null>
  setJSON(key: string, value: BlobLinkRecord, options?: WriteOptions): Promise<WriteResult>
}

function isRecord(value: unknown): value is BlobLinkRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<BlobLinkRecord>
  return record.version === 1 && typeof record.cachedAt === 'number' && (
    (record.kind === 'tombstone' && typeof record.mutationId === 'string' &&
      (record.busyUntil === null || typeof record.busyUntil === 'number')) ||
    (record.kind === 'link' && typeof record.id === 'string' && typeof record.destination_url === 'string')
  )
}

async function bounded<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Persistent cache read timed out')), milliseconds)
    })])
  } finally { if (timeout) clearTimeout(timeout) }
}

export function createPersistentLinkCache(store: LinkBlobStore, now: () => number = Date.now, readTimeoutMs = CACHE_READ_TIMEOUT_MS) {
  const read = (code: string) => bounded(store.getWithMetadata(code, { type: 'json', consistency: 'strong' }), readTimeoutMs)

  async function resolveRedirectLink(code: string, fetchActiveLink: (code: string) => Promise<RedirectLink | null>, schedule: ScheduleWork): Promise<RedirectLink | null> {
    let cached: Awaited<ReturnType<typeof read>> = null
    try { cached = await read(code) } catch { /* The database remains authoritative. */ }
    const record = cached?.data
    if (isRecord(record) && record.kind === 'link' && now() - record.cachedAt <= CACHE_TTL_MS) {
      return { id: record.id, destination_url: record.destination_url }
    }
    const link = await fetchActiveLink(code)
    if (!link) return null
    if (isRecord(record) && record.kind === 'tombstone') {
      if (record.busyUntil !== null || !cached?.etag) return link
      const value: LinkRecord = { version: 1, kind: 'link', ...link, cachedAt: now() }
      schedule(async () => { try { await store.setJSON(code, value, { onlyIfMatch: cached.etag }) } catch { /* best effort */ } })
      return link
    }
    const value: LinkRecord = { version: 1, kind: 'link', ...link, cachedAt: now() }
    const condition = cached?.etag ? { onlyIfMatch: cached.etag } : { onlyIfNew: true }
    schedule(async () => { try { await store.setJSON(code, value, condition) } catch { /* best effort */ } })
    return link
  }

  async function fence(code: string): Promise<CacheFence> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await read(code)
      if (isRecord(current?.data) && current.data.kind === 'tombstone' &&
          current.data.busyUntil !== null && current.data.busyUntil > now()) {
        throw new Error('Another link update is already in progress')
      }
      const mutationId = crypto.randomUUID()
      const value: TombstoneRecord = { version: 1, kind: 'tombstone', cachedAt: now(), mutationId, busyUntil: now() + FENCE_LEASE_MS }
      const condition = current?.etag ? { onlyIfMatch: current.etag } : { onlyIfNew: true }
      const result = await store.setJSON(code, value, condition)
      if (result.modified && result.etag) return { etag: result.etag, mutationId }
    }
    throw new Error('Could not fence the redirect cache after concurrent updates')
  }

  async function publishAfterFence(code: string, link: RedirectLink, fence: CacheFence): Promise<boolean> {
    const value: LinkRecord = { version: 1, kind: 'link', ...link, cachedAt: now() }
    try { return (await store.setJSON(code, value, { onlyIfMatch: fence.etag })).modified } catch { return false }
  }

  async function finishTombstone(code: string, fence: CacheFence): Promise<boolean> {
    const value: TombstoneRecord = { version: 1, kind: 'tombstone', cachedAt: now(), mutationId: fence.mutationId, busyUntil: null }
    try { return (await store.setJSON(code, value, { onlyIfMatch: fence.etag })).modified } catch { return false }
  }

  async function publishIfEmpty(code: string, link: RedirectLink): Promise<boolean> {
    const value: LinkRecord = { version: 1, kind: 'link', ...link, cachedAt: now() }
    try {
      const current = await read(code)
      if (isRecord(current?.data) && current.data.kind === 'link' &&
          current.data.id === link.id && current.data.destination_url === link.destination_url) {
        if (now() - current.data.cachedAt <= CACHE_TTL_MS) return true
        return current.etag ? (await store.setJSON(code, value, { onlyIfMatch: current.etag })).modified : false
      }
      if (current) return false
      return (await store.setJSON(code, value, { onlyIfNew: true })).modified
    } catch { return false }
  }
  return { resolveRedirectLink, fence, publishAfterFence, finishTombstone, publishIfEmpty }
}

function persistentCache() { return createPersistentLinkCache(getStore(STORE_NAME, { consistency: 'strong' }) as LinkBlobStore) }

export async function resolveRedirectLink(code: string, fetchActiveLink: (code: string) => Promise<RedirectLink | null>, schedule: ScheduleWork) {
  let cache: ReturnType<typeof persistentCache>
  try { cache = persistentCache() } catch { return fetchActiveLink(code) }
  return cache.resolveRedirectLink(code, fetchActiveLink, schedule)
}
export async function fenceRedirectCache(code: string) { return persistentCache().fence(code) }
export async function publishRedirectAfterFence(code: string, link: RedirectLink, fence: CacheFence) { return persistentCache().publishAfterFence(code, link, fence) }
export async function finishRedirectTombstone(code: string, fence: CacheFence) { return persistentCache().finishTombstone(code, fence) }
export async function publishRedirectIfEmpty(code: string, link: RedirectLink) { return persistentCache().publishIfEmpty(code, link) }
