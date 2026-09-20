import assert from 'node:assert/strict'
import test from 'node:test'

import {
  analyticsSearchParams,
  analyticsDetailHref,
  buildSourceTaggedUrl,
  classifyAnalyticsError,
  comparisonLabel,
  getPresetRange,
  parseAnalyticsAsOf,
  rowsToCsv,
  validateAnalyticsScope,
  type AnalyticsClickRow,
} from '../src/lib/analytics.ts'

test('creates inclusive 7-day and 30-day Bucharest calendar ranges', () => {
  const now = new Date('2026-09-20T12:00:00.000Z')

  assert.deepEqual(getPresetRange(7, now), { from: '2026-09-14', to: '2026-09-20' })
  assert.deepEqual(getPresetRange(30, now), { from: '2026-08-22', to: '2026-09-20' })
})

test('validates custom dates and rejects invalid, reversed, and future ranges', () => {
  assert.deepEqual(validateAnalyticsScope({ from: '2026-09-01', to: '2026-09-20' }, new Date('2026-09-20T12:00:00Z')), {
    from: '2026-09-01', to: '2026-09-20', source: null, linkId: null, groupId: null,
  })
  assert.throws(() => validateAnalyticsScope({ from: '2026-02-30', to: '2026-09-20' }, new Date('2026-09-20T12:00:00Z')), /valid dates/)
  assert.throws(() => validateAnalyticsScope({ from: '2026-09-21', to: '2026-09-20' }, new Date('2026-09-20T12:00:00Z')), /on or before/)
  assert.throws(() => validateAnalyticsScope({ from: '2026-09-01', to: '2026-09-21' }, new Date('2026-09-20T12:00:00Z')), /future/)
})

test('formats zero-baseline comparisons without inventing 100 percent growth', () => {
  assert.equal(comparisonLabel('new', null), 'New')
  assert.equal(comparisonLabel('no_baseline', null), 'No baseline')
  assert.equal(comparisonLabel('increase', 12.34), '+12.3%')
  assert.equal(comparisonLabel('decrease', -100), '-100.0%')
})

test('classifies missing migration separately from ordinary query failures', () => {
  assert.equal(classifyAnalyticsError({ code: 'PGRST202', message: 'function not found' }), 'setup_needed')
  assert.equal(classifyAnalyticsError({ code: '42703', message: 'column missing' }), 'setup_needed')
  assert.equal(classifyAnalyticsError({ code: '42501', message: 'permission denied' }), 'query_failed')
})

test('builds a source-tagged short URL without changing the destination', () => {
  assert.equal(
    buildSourceTaggedUrl('https://wiseurl.net/dashboard', 'meal-plan', 'site-a.example', 'autumn launch'),
    'https://wiseurl.net/meal-plan?utm_source=site-a.example&utm_campaign=autumn+launch',
  )
  assert.throws(() => buildSourceTaggedUrl('https://wiseurl.net', 'meal-plan', '   ', ''), /Source site/)
})

test('serializes the shared scope including a frozen as-of timestamp', () => {
  const query = analyticsSearchParams({
    from: '2026-09-14',
    to: '2026-09-20',
    source: 'site-a.example',
    linkId: '11111111-1111-4111-8111-111111111111',
    groupId: null,
    asOf: '2026-09-20T12:00:00.000Z',
    page: 3,
    pageSize: 50,
  })

  assert.equal(query.get('source'), 'site-a.example')
  assert.equal(query.get('asOf'), '2026-09-20T12:00:00.000Z')
  assert.equal(query.get('page'), '3')
  assert.equal(query.has('group'), false)
})

test('carries the active analytics range, source, and snapshot into link detail', () => {
  assert.equal(
    analyticsDetailHref('11111111-1111-4111-8111-111111111111', {
      from: '2026-09-14',
      to: '2026-09-20',
      source: 'site-a.example',
      linkId: null,
      groupId: '22222222-2222-4222-8222-222222222222',
    }, '2026-09-20T12:00:00.000Z'),
    '/links/11111111-1111-4111-8111-111111111111?from=2026-09-14&to=2026-09-20&source=site-a.example&asOf=2026-09-20T12%3A00%3A00.000Z',
  )
})

test('validates analytics snapshots without truncating PostgreSQL microseconds', () => {
  const value = '2026-09-20T12:00:00.123456+00:00'
  assert.equal(parseAnalyticsAsOf(value, new Date('2026-09-20T13:00:00Z')), value)
  assert.throws(() => parseAnalyticsAsOf('2026-02-30T12:00:00Z'), /valid timestamp/)
  assert.throws(() => parseAnalyticsAsOf('2026-09-20 12:00:00Z'), /valid timestamp/)
  assert.throws(() => parseAnalyticsAsOf('2026-09-20T12:00:00.1234567Z'), /valid timestamp/)
})

test('CSV export escapes fields and neutralizes spreadsheet formulas after control whitespace', () => {
  const row = {
    clicked_at: '2026-09-20T12:00:00Z',
    source: '=HYPERLINK("https://evil")',
    source_kind: 'explicit',
    code: 'offer',
    destination_url: 'https://merchant.example/?a=1,b=2',
    original_referrer: '\t+SUM(1,1)',
    country: 'RO',
    city: 'Bucharest',
    device_type: 'desktop',
    os_name: 'macOS',
    browser_name: 'Safari',
    is_bot: false,
    utm_source: '@command',
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    sub_id1: null,
    sub_id2: null,
    sub_id3: null,
  } as AnalyticsClickRow

  const csv = rowsToCsv([row])

  assert.match(csv, /"'=HYPERLINK\(""https:\/\/evil""\)"/)
  assert.match(csv, /"'\t\+SUM\(1,1\)"/)
  assert.match(csv, /'@command/)
  assert.match(csv, /"https:\/\/merchant\.example\/\?a=1,b=2"/)
})
