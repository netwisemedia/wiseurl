import assert from 'node:assert/strict'
import test from 'node:test'
import { handleRedirect, shortCodeFromPath } from '../src/lib/redirect-handler.ts'
import type { ClickPayload } from '../src/lib/click-tracking.ts'

const link = { id: 'test-id', destination_url: 'https://merchant.example/offer?aff=123&click={click_id}' }

test('returns a silent redirect while analytics remains pending, retaining source only internally', async () => {
  const jobs: Array<() => Promise<void>> = []
  let release!: () => void
  let payload: ClickPayload | undefined
  const response = await handleRedirect(new Request('https://wiseurl.net/test?utm_source=couponswift&coupon=SAVE', { headers: { referer: 'https://www.couponswift.com/' } }), 'test', {
    resolve: async () => link,
    record: async (value) => { payload = value; await new Promise<void>(resolve => { release = resolve }) },
    schedule: job => jobs.push(job),
  })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Referrer-Policy'), 'origin')
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.match(response.headers.get('Server-Timing') || '', /resolve;dur=/)
  const html = await response.text()
  assert.match(html, /location.replace/)
  assert.match(html, /coupon=SAVE/)
  assert.doesNotMatch(html, /couponswift|utm_source|Continue/)
  assert.equal(jobs.length, 1)
  const pending = jobs[0]()
  assert.equal(payload?.source_label, 'couponswift')
  assert.equal(payload?.original_referrer, 'https://www.couponswift.com/')
  assert.ok(payload?.click_id)
  assert.equal(typeof payload?.clicked_at, 'string')
  assert.equal(payload?.created_at, undefined, 'clicks schema uses clicked_at, not created_at')
  assert.ok(html.includes(payload!.click_id))
  release()
  await pending
})

test('HEAD resolves destination but has no body or analytics job', async () => {
  let jobs = 0
  const response = await handleRedirect(new Request('https://wiseurl.net/test', { method: 'HEAD' }), 'test', {
    resolve: async () => link, record: async () => { throw Error('must not track HEAD') }, schedule: () => { jobs++ },
  })
  assert.equal(response.status, 200)
  assert.equal(await response.text(), '')
  assert.equal(jobs, 0)
})

test('missing links return 404 and backend failures return 503, not a false 404', async () => {
  const deps = { record: async () => {}, schedule: () => {} }
  const missing = await handleRedirect(new Request('https://wiseurl.net/missing'), 'missing', { ...deps, resolve: async () => null })
  assert.equal(missing.status, 404)
  const failed = await handleRedirect(new Request('https://wiseurl.net/test'), 'test', { ...deps, resolve: async () => { throw Error('backend unavailable') } })
  assert.equal(failed.status, 503)
})

test('independent visitors get different click IDs even when using the same cached configuration', async () => {
  const deps = { resolve: async () => link, record: async () => {}, schedule: () => {} }
  const first = await handleRedirect(new Request('https://wiseurl.net/test'), 'test', deps)
  const second = await handleRedirect(new Request('https://wiseurl.net/test'), 'test', deps)
  assert.notEqual(await first.text(), await second.text())
})

test('public edge routing excludes application, assets and nested paths', () => {
  for (const path of ['/', '/login', '/dashboard', '/settings', '/api', '/auth', '/links', '/admin', '/_next', '/favicon.ico', '/robots.txt', '/api/cache/warm', '/test/nested', '/%2Ftest', '/%ZZ']) {
    assert.equal(shortCodeFromPath(path), null, path)
  }
  assert.equal(shortCodeFromPath('/altushost'), 'altushost')
  assert.equal(shortCodeFromPath('/my-Link_2'), 'my-Link_2')
})

test('missing-code logging stores the resolved source and the 404 response stays identical', async () => {
  const logged: Record<string, unknown>[] = []
  const deps = { resolve: async () => null, record: async () => {}, schedule: (work: () => Promise<void>) => { void work() }, recordMissing: async (p: Record<string, unknown>) => { logged.push(p) } }
  const bare = await handleRedirect(new Request('https://wiseurl.net/missing'), 'missing', { ...deps, recordMissing: undefined })
  const tagged = await handleRedirect(new Request('https://wiseurl.net/missing?utm_source=%20CouponSwift.com%20'), 'missing', deps as never)
  assert.equal(tagged.status, 404)
  assert.equal(await tagged.text(), await bare.text())
  assert.deepEqual([...tagged.headers].sort(), [...bare.headers].sort())
  assert.equal(logged[0].source_label, 'CouponSwift.com')
  assert.equal(logged[0].source_kind, 'explicit')
  await handleRedirect(new Request('https://wiseurl.net/missing', { headers: { referer: 'https://www.Example.org/page' } }), 'missing', deps as never)
  assert.deepEqual([logged[1].source_label, logged[1].source_kind], ['example.org', 'referrer'])
  await handleRedirect(new Request('https://wiseurl.net/missing'), 'missing', deps as never)
  assert.deepEqual([logged[2].source_label, logged[2].source_kind], ['Unknown source', 'unknown'])
  const long = 'a'.repeat(400)
  await handleRedirect(new Request(`https://wiseurl.net/missing?utm_source=${long}`), 'missing', deps as never)
  assert.equal((logged[3].source_label as string).length, 255)
})
