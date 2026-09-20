import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildDestination,
  extractAttribution,
  normalizeReferrerHostname,
  resolveSource,
  validateHttpUrl,
} from '../src/lib/attribution.ts'

test('extracts campaign and common sub-id aliases while keeping extras', () => {
  const params = new URLSearchParams('utm_source=Site+A&utm_medium=post&utm_campaign=launch&utm_content=hero&utm_term=meal&s1=alpha&s2=beta&s3=gamma&coupon=SAVE')

  assert.deepEqual(extractAttribution(params), {
    utm_source: 'Site A',
    utm_medium: 'post',
    utm_campaign: 'launch',
    utm_content: 'hero',
    utm_term: 'meal',
    sub_id1: 'alpha',
    sub_id2: 'beta',
    sub_id3: 'gamma',
    query_params: { coupon: 'SAVE' },
  })
})

test('keeps destination-owned values and omits incoming UTM values from destination', () => {
  const destination = 'https://merchant.example/offer?affiliate=owner&utm_source=merchant'
  const incoming = new URLSearchParams('affiliate=attacker&utm_source=site-a&utm_campaign=autumn&subid=click-7&coupon=SAVE')

  const built = new URL(buildDestination(destination, incoming, { click_id: 'uuid-1' }))

  assert.equal(built.searchParams.get('affiliate'), 'owner')
  assert.equal(built.searchParams.get('utm_source'), 'merchant')
  assert.equal(built.searchParams.has('utm_campaign'), false)
  assert.equal(built.searchParams.get('subid'), 'click-7')
  assert.equal(built.searchParams.get('coupon'), 'SAVE')
})

test('expands known macros and preserves unknown macros', () => {
  const built = buildDestination(
    'https://merchant.example/?subid={click_id}&code={code}&other={unknown}',
    new URLSearchParams(),
    { click_id: 'id with spaces', code: 'meal-plan' },
  )

  assert.equal(built, 'https://merchant.example/?subid=id%20with%20spaces&code=meal-plan&other={unknown}')
})

test('accepts only absolute HTTP and HTTPS URLs without credentials', () => {
  assert.equal(validateHttpUrl('https://example.com/a').toString(), 'https://example.com/a')
  assert.equal(validateHttpUrl('http://example.com').protocol, 'http:')
  assert.throws(() => validateHttpUrl('javascript:alert(1)'), /HTTP or HTTPS/)
  assert.throws(() => validateHttpUrl('/relative'), /absolute HTTP or HTTPS/)
  assert.throws(() => validateHttpUrl('https://user:pass@example.com'), /credentials/)
})

test('normalizes valid referrer hostnames and rejects malformed values', () => {
  assert.equal(normalizeReferrerHostname('HTTPS://WWW.Example.COM./story?id=1'), 'example.com')
  assert.equal(normalizeReferrerHostname('https://sub.example.com/path'), 'sub.example.com')
  assert.equal(normalizeReferrerHostname('mailto:test@example.com'), null)
  assert.equal(normalizeReferrerHostname('https://user:secret@example.com'), null)
  assert.equal(normalizeReferrerHostname('not a url'), null)
  assert.equal(normalizeReferrerHostname(null), null)
})

test('uses explicit source, then referrer hostname, then unknown with provenance', () => {
  assert.deepEqual(resolveSource('  Site A  ', 'https://www.referrer.example/path'), {
    label: 'Site A',
    kind: 'explicit',
  })
  assert.deepEqual(resolveSource('', 'https://WWW.Referrer.Example/path'), {
    label: 'referrer.example',
    kind: 'referrer',
  })
  assert.deepEqual(resolveSource(null, 'garbage'), {
    label: 'Unknown source',
    kind: 'unknown',
  })
})
