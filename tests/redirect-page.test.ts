import assert from 'node:assert/strict'
import test from 'node:test'

import { createHandoffDocument, handoffHeaders } from '../src/lib/redirect-page.ts'

test('creates an empty handoff with immediate navigation and refresh fallback', () => {
  const html = createHandoffDocument('https://merchant.example/offer?affiliate=abc&coupon=SAVE')

  assert.match(html, /<!doctype html>/i)
  assert.match(html, /http-equiv="refresh" content="0;url=https:\/\/merchant\.example\/offer\?affiliate=abc&amp;coupon=SAVE"/)
  assert.match(html, /<meta name="referrer" content="origin">/)
  assert.match(html, /<body>\s*<\/body>/)
  assert.doesNotMatch(html, /Continue|Opening destination|<a\b/i)
  assert.match(html, /<script>location.replace\(/)
  assert.doesNotMatch(html, /setTimeout|DOMContentLoaded|onload/)
})

test('returns origin referrer, no-store, noindex, and HTML headers', () => {
  assert.deepEqual(handoffHeaders(), {
    'Content-Type': 'text/html; charset=utf-8',
    'Referrer-Policy': 'origin',
    'X-Robots-Tag': 'noindex',
    'Cache-Control': 'private, no-store',
  })
})

test('rejects unsafe destinations before HTML generation', () => {
  assert.throws(() => createHandoffDocument('javascript:alert(1)'), /HTTP or HTTPS/)
  assert.throws(() => createHandoffDocument('https://user:pass@example.com'), /credentials/)
})

test('escapes HTML-significant URL characters in every interpolation', () => {
  const html = createHandoffDocument('https://merchant.example/?a=1&b=%3Ctag%3E')

  assert.equal(html.includes('a=1&amp;b=%3Ctag%3E'), true)
  assert.equal(html.includes('a=1\\u0026b='), true)
})

 test('script destination cannot terminate script or inject markup', () => {
  const html = createHandoffDocument('https://merchant.example/?value=</script><script>alert(1)</script>&x=\"');
  assert.equal((html.match(/<script>/g) || []).length, 1)
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1]
  assert.doesNotMatch(script, /[<>]/)
  const encoded = script.match(/^location\.replace\(([\s\S]*)\);$/)![1]
  assert.equal(JSON.parse(encoded), new URL('https://merchant.example/?value=</script><script>alert(1)</script>&x=\"').toString())
})
