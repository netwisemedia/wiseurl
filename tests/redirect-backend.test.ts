import assert from 'node:assert/strict'
import test from 'node:test'
import { createRedirectBackend } from '../src/lib/redirect-backend.ts'

test('lookup restricts to active code and only requests redirect configuration', async () => {
  let seen: URL | undefined
  const backend = createRedirectBackend('https://db.example', 'public-anon', async input => {
    seen = new URL(String(input))
    return Response.json([{ id: 'id', destination_url: 'https://merchant.example/' }])
  })
  assert.deepEqual(await backend.fetchActiveLink('some&code'), { id: 'id', destination_url: 'https://merchant.example/' })
  assert.equal(seen?.searchParams.get('code'), 'eq.some&code')
  assert.equal(seen?.searchParams.get('is_active'), 'eq.true')
  assert.equal(seen?.searchParams.get('select'), 'id,destination_url')
})

test('backend error is distinct from a missing link', async () => {
  const missing = createRedirectBackend('https://db.example', 'public-anon', async () => Response.json([]))
  assert.equal(await missing.fetchActiveLink('missing'), null)
  const failed = createRedirectBackend('https://db.example', 'public-anon', async () => new Response('Unavailable', { status: 503 }))
  await assert.rejects(() => failed.fetchActiveLink('test'), /503/)
})
