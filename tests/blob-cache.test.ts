import assert from 'node:assert/strict'
import test from 'node:test'

import { CACHE_TTL_MS, createPersistentLinkCache, type BlobLinkRecord, type LinkBlobStore } from '../src/lib/blob-cache.ts'
import { fenceThenMutate } from '../src/lib/cache-mutation.ts'

class FakeStore implements LinkBlobStore {
  record: BlobLinkRecord | null = null
  etag: string | undefined
  writes: Array<{ value: BlobLinkRecord; options?: { onlyIfNew?: boolean; onlyIfMatch?: string } }> = []
  async getWithMetadata() { return this.record ? { data: this.record, etag: this.etag, metadata: {} } : null }
  async setJSON(_key: string, value: BlobLinkRecord, options?: { onlyIfNew?: boolean; onlyIfMatch?: string }) {
    this.writes.push({ value, options })
    if (options?.onlyIfNew && this.record) return { modified: false }
    if (options?.onlyIfMatch && options.onlyIfMatch !== this.etag) return { modified: false }
    this.record = value
    this.etag = `etag-${this.writes.length}`
    return { modified: true, etag: this.etag }
  }
}

test('serves a versioned destination for 30 days and refreshes after expiration', async () => {
  const store = new FakeStore(); const now = 1_000_000
  store.record = { version: 1, kind: 'link', id: 'old', destination_url: 'https://old.example', cachedAt: now }; store.etag = 'old-etag'
  const fresh = createPersistentLinkCache(store, () => now + CACHE_TTL_MS - 1)
  let databaseReads = 0
  assert.deepEqual(await fresh.resolveRedirectLink('offer', async () => { databaseReads++; return { id: 'new', destination_url: 'https://new.example' } }, () => assert.fail()), { id: 'old', destination_url: 'https://old.example' })
  assert.equal(databaseReads, 0)

  const expired = createPersistentLinkCache(store, () => now + CACHE_TTL_MS + 1); const scheduled: Array<() => Promise<void>> = []
  assert.deepEqual(await expired.resolveRedirectLink('offer', async () => { databaseReads++; return { id: 'new', destination_url: 'https://new.example' } }, work => scheduled.push(work)), { id: 'new', destination_url: 'https://new.example' })
  assert.equal(store.writes.length, 0, 'response must not await the cache fill')
  await scheduled[0](); assert.deepEqual(store.writes[0]?.options, { onlyIfMatch: 'old-etag' })
})

test('a tombstone fences edit, deactivate and delete lookups', async () => {
  const store = new FakeStore(); const cache = createPersistentLinkCache(store, () => 10); const fence = await cache.fence('offer'); let scheduled = false
  const result = await cache.resolveRedirectLink('offer', async () => null, () => { scheduled = true })
  assert.ok(fence.etag); assert.equal(store.record?.kind, 'tombstone'); assert.equal(result, null); assert.equal(scheduled, false)
})

test('an in-flight miss cannot overwrite a mutation fence', async () => {
  const store = new FakeStore(); const cache = createPersistentLinkCache(store, () => 10); const scheduled: Array<() => Promise<void>> = []
  await cache.resolveRedirectLink('offer', async () => ({ id: 'old', destination_url: 'https://old.example' }), work => scheduled.push(work))
  await cache.fence('offer'); await scheduled[0]()
  assert.equal(store.record?.kind, 'tombstone'); assert.deepEqual(store.writes[0]?.options, { onlyIfNew: true })
})

test('publishes an edited destination only against its own fence', async () => {
  const store = new FakeStore(); const cache = createPersistentLinkCache(store, () => 10); const fence = await cache.fence('offer')
  assert.equal(await cache.publishAfterFence('offer', { id: 'new', destination_url: 'https://new.example' }, fence), true)
  assert.equal(store.record?.kind, 'link'); assert.deepEqual(store.writes.at(-1)?.options, { onlyIfMatch: fence.etag })
})

test('an idle tombstone can be fenced again for reactivation', async () => {
  const store = new FakeStore(); let now = 10; const cache = createPersistentLinkCache(store, () => now)
  const first = await cache.fence('offer')
  assert.equal(await cache.finishTombstone('offer', first), true)
  now++
  const second = await cache.fence('offer')
  assert.notEqual(second.mutationId, first.mutationId)
})

test('a resolver can conditionally replace an idle delete tombstone after a fresh database read', async () => {
  const store = new FakeStore(); const cache = createPersistentLinkCache(store, () => 10)
  const fence = await cache.fence('offer'); await cache.finishTombstone('offer', fence)
  const scheduled: Array<() => Promise<void>> = []
  assert.deepEqual(await cache.resolveRedirectLink('offer', async () => ({ id: 'recreated', destination_url: 'https://new.example' }), work => scheduled.push(work)), { id: 'recreated', destination_url: 'https://new.example' })
  await scheduled[0]()
  assert.equal(store.record?.kind, 'link')
})

test('an abandoned busy fence becomes retryable after its lease', async () => {
  const store = new FakeStore(); let now = 10; const cache = createPersistentLinkCache(store, () => now)
  await cache.fence('offer')
  await assert.rejects(() => cache.fence('offer'), /already in progress/)
  now += CACHE_TTL_MS
  assert.ok((await cache.fence('offer')).etag)
})

test('an ambiguous mutation failure cannot cache old database state before a late commit', async () => {
  const store = new FakeStore(); const cache = createPersistentLinkCache(store, () => 10)
  let databaseLink = { id: 'link', destination_url: 'https://old.example' }
  await assert.rejects(() => fenceThenMutate(
    () => cache.fence('offer'),
    async () => { throw new Error('network timed out after sending update') },
  ), /network timed out/)

  const scheduled: Array<() => Promise<void>> = []
  assert.deepEqual(await cache.resolveRedirectLink('offer', async () => databaseLink, work => scheduled.push(work)), databaseLink)
  databaseLink = { id: 'link', destination_url: 'https://new.example' }
  assert.deepEqual(await cache.resolveRedirectLink('offer', async () => databaseLink, work => scheduled.push(work)), databaseLink)
  assert.equal(scheduled.length, 0, 'the busy fence must force database reads without cache publication')
  assert.equal(store.record?.kind, 'tombstone')
})
