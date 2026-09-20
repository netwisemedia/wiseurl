import assert from 'node:assert/strict'
import test from 'node:test'

import { createHandoffDocument, handoffHeaders } from '../src/lib/redirect-page.ts'

test('creates a script-free zero-delay handoff with a real fallback link', () => {
  const html = createHandoffDocument('https://merchant.example/offer?affiliate=abc&coupon=SAVE')

  assert.match(html, /<!doctype html>/i)
  assert.match(html, /http-equiv="refresh" content="0;url=https:\/\/merchant\.example\/offer\?affiliate=abc&amp;coupon=SAVE"/)
  assert.match(html, /<meta name="referrer" content="origin">/)
  assert.match(html, /href="https:\/\/merchant\.example\/offer\?affiliate=abc&amp;coupon=SAVE"/)
  assert.doesNotMatch(html, /<script/i)
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
  assert.equal(html.includes('a=1&b='), false)
})
