import assert from 'node:assert/strict'
import test from 'node:test'

import { memoryCacheExpiresAt } from '../src/lib/link-cache.ts'

test('L1 promotion never outlives the remaining persistent-cache lifetime', () => {
  const now = 1_000_000

  assert.equal(memoryCacheExpiresAt(now), now + 30_000)
  assert.equal(memoryCacheExpiresAt(now, now + 120_000), now + 30_000)
  assert.equal(memoryCacheExpiresAt(now, now + 1_000), now + 1_000)
})
