import assert from 'node:assert/strict'
import test from 'node:test'

import { fenceThenMutate } from '../src/lib/cache-mutation.ts'

test('writes a fence before an edit and publishes only after the database mutation', async () => {
  const events: string[] = []
  const result = await fenceThenMutate(
    async () => { events.push('fence'); return { etag: 'fence-etag', mutationId: 'mutation' } },
    async () => { events.push('database') },
    async fence => { events.push(`publish:${fence.etag}`); return true },
  )
  assert.deepEqual(events, ['fence', 'database', 'publish:fence-etag'])
  assert.deepEqual(result, { mutated: true, cacheSynced: true })
})

test('does not mutate the database when fencing fails', async () => {
  const events: string[] = []
  await assert.rejects(() => fenceThenMutate(
    async () => { throw new Error('fence unavailable') },
    async () => { events.push('database') },
  ), /fence unavailable/)
  assert.deepEqual(events, [])
})

test('leaves the fence in place when the database mutation fails', async () => {
  const events: string[] = []
  await assert.rejects(() => fenceThenMutate(
    async () => { events.push('fence'); return { etag: 'fence-etag', mutationId: 'mutation' } },
    async () => { events.push('database'); throw new Error('update failed') },
    async () => { events.push('publish'); return true },
  ), /update failed/)
  assert.deepEqual(events, ['fence', 'database'])
})

test('keeps the busy fence when a database failure may still commit', async () => {
  await assert.rejects(() => fenceThenMutate(
    async () => ({ etag: 'fence-etag', mutationId: 'mutation' }),
    async () => { throw new Error('update failed') },
  ), /update failed/)
})

test('reports a safe cache fallback if publication fails after an edit', async () => {
  const result = await fenceThenMutate(
    async () => ({ etag: 'fence-etag', mutationId: 'mutation' }),
    async () => undefined,
    async () => false,
  )
  assert.deepEqual(result, { mutated: true, cacheSynced: false })
})

test('delete finalizes its tombstone fence instead of publishing a link', async () => {
  const events: string[] = []
  const result = await fenceThenMutate(
    async () => { events.push('fence'); return { etag: 'fence-etag', mutationId: 'mutation' } },
    async () => { events.push('delete') },
    async () => { events.push('finish-tombstone'); return true },
  )
  assert.deepEqual(events, ['fence', 'delete', 'finish-tombstone'])
  assert.deepEqual(result, { mutated: true, cacheSynced: true })
})
