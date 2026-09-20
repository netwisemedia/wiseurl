import assert from 'node:assert/strict'
import test from 'node:test'

import { deleteLinkThenInvalidate } from '../src/lib/cache-mutation.ts'

test('deletes the verified database row before invalidating retained cache keys', async () => {
  const events: string[] = []

  await deleteLinkThenInvalidate(
    async () => { events.push('delete') },
    async () => { events.push('invalidate') },
  )

  assert.deepEqual(events, ['delete', 'invalidate'])
})

test('does not invalidate when the database delete fails', async () => {
  const events: string[] = []

  await assert.rejects(() => deleteLinkThenInvalidate(
    async () => {
      events.push('delete')
      throw new Error('delete failed')
    },
    async () => { events.push('invalidate') },
  ), /delete failed/)

  assert.deepEqual(events, ['delete'])
})
