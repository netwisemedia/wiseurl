import assert from 'node:assert/strict'
import test from 'node:test'

import { buildDestination, extractAttribution } from '../src/lib/attribution.ts'
import {
  buildClickPayload,
  persistClickWithFallback,
  toLegacyClickPayload,
  type ClickInsertError,
} from '../src/lib/click-tracking.ts'

const baseClick = {
  linkId: '00000000-0000-4000-8000-000000000001',
  code: 'offer',
  clickId: '00000000-0000-4000-8000-000000000099',
  originalReferrer: 'https://www.publisher.example/story',
  country: 'RO',
  city: 'Bucharest',
  deviceType: 'mobile',
  osName: 'iOS',
  browserName: 'Safari',
  isBot: false,
}

test('stores source UTM internally while destination does not receive incoming UTM values', () => {
  const incoming = new URLSearchParams('utm_source=publisher-site&utm_campaign=fall&subid=reader-4')
  const payload = buildClickPayload(baseClick, extractAttribution(incoming))
  const destination = new URL(buildDestination('https://merchant.example/?affiliate=abc', incoming))

  assert.equal(payload.utm_source, 'publisher-site')
  assert.equal(payload.utm_campaign, 'fall')
  assert.equal(payload.source_label, 'publisher-site')
  assert.equal(payload.source_kind, 'explicit')
  assert.equal(payload.sub_id1, 'reader-4')
  assert.equal(destination.searchParams.has('utm_source'), false)
  assert.equal(destination.searchParams.has('utm_campaign'), false)
  assert.equal(destination.searchParams.get('subid'), 'reader-4')
})

test('falls back to normalized referrer provenance when explicit source is absent', () => {
  const payload = buildClickPayload(baseClick, extractAttribution(new URLSearchParams()))

  assert.equal(payload.source_label, 'publisher.example')
  assert.equal(payload.source_kind, 'referrer')
})

test('legacy payload removes only fields unavailable before the migration', () => {
  const payload = buildClickPayload(baseClick, extractAttribution(new URLSearchParams('utm_source=publisher')))

  assert.deepEqual(toLegacyClickPayload(payload), {
    link_id: baseClick.linkId,
    code: 'offer',
    original_referrer: baseClick.originalReferrer,
    country: 'RO',
    city: 'Bucharest',
    device_type: 'mobile',
    os_name: 'iOS',
    browser_name: 'Safari',
    is_bot: false,
  })
})

test('retries with the legacy payload when the schema cache lacks attribution columns', async () => {
  const payload = buildClickPayload(baseClick, extractAttribution(new URLSearchParams('utm_source=publisher')))
  const received: Record<string, unknown>[] = []
  const missingColumn: ClickInsertError = { code: 'PGRST204', message: "Could not find the 'utm_source' column" }

  const result = await persistClickWithFallback(payload, async (candidate) => {
    received.push(candidate)
    return { error: received.length === 1 ? missingColumn : null }
  }, 100)

  assert.deepEqual(result, { recorded: true, mode: 'legacy', error: null })
  assert.equal(received.length, 2)
  assert.equal('utm_source' in received[0], true)
  assert.equal('utm_source' in received[1], false)
})

test('aborts a click insert that exceeds the tracking bound', async () => {
  const payload = buildClickPayload(baseClick, extractAttribution(new URLSearchParams()))

  const result = await persistClickWithFallback(payload, (_candidate, signal) => new Promise((resolve) => {
    signal.addEventListener('abort', () => resolve({
      error: { code: 'ABORTED', message: 'request aborted' },
    }), { once: true })
  }), 10)

  assert.equal(result.recorded, false)
  assert.equal(result.mode, 'failed')
  assert.equal(result.error?.code, 'TIMEOUT')
})
