import test from 'node:test'
import assert from 'node:assert/strict'
import { overviewRange, overviewFilters, rankLinks, trafficChange, overviewCsv } from '../src/lib/overview.ts'

const now = new Date('2026-09-20T22:30:00Z')
test('overview presets use Bucharest dates and inclusive month boundaries', () => {
  assert.deepEqual(overviewRange('today', now), { from: '2026-09-21', to: '2026-09-21' })
  assert.deepEqual(overviewRange('yesterday', now), { from: '2026-09-20', to: '2026-09-20' })
  assert.deepEqual(overviewRange('7d', now), { from: '2026-09-15', to: '2026-09-21' })
  assert.deepEqual(overviewRange('month', now), { from: '2026-09-01', to: '2026-09-21' })
  assert.deepEqual(overviewRange('last-month', new Date('2024-03-10')), { from: '2024-02-01', to: '2024-02-29' })
  assert.deepEqual(overviewRange('last-month', new Date('2026-01-10')), { from: '2025-12-01', to: '2025-12-31' })
})
test('saved filters default to non-bot seven days and reject invalid or excessive ranges', () => {
  assert.equal(overviewFilters(new URLSearchParams(), now).traffic, 'non_bot')
  assert.equal(overviewFilters(new URLSearchParams(), now).from, '2026-09-15')
  assert.throws(() => overviewFilters(new URLSearchParams('from=2026-02-30&to=2026-03-01'), now))
  assert.throws(() => overviewFilters(new URLSearchParams('from=2020-01-01&to=2026-03-01'), now))
  assert.throws(() => overviewFilters(new URLSearchParams('traffic=fake'), now))
  assert.throws(() => overviewFilters(new URLSearchParams('from=2026-09-21&to=2026-09-21&asOf=2026-09-19T00:00:00Z'), now))
})
const base = { title: null, destination_url: 'https://merchant.test', group_id: null, is_active: true, leading_source: null, latest_click: null }
const rows = [
  { ...base, id: '1', code: 'old', clicks: 0, previous_clicks: 42 },
  { ...base, id: '2', code: 'new', clicks: 20, previous_clicks: 0 },
  { ...base, id: '3', code: 'leader', clicks: 80, previous_clicks: 90 },
  { ...base, id: '4', code: 'quiet', clicks: 0, previous_clicks: 0 },
]
test('rankings retain zero-traffic and prior-only links and rank decline by lost volume', () => {
  assert.deepEqual(rankLinks(rows, 'clicks', '').map(r => r.code), ['leader', 'new', 'old', 'quiet'])
  assert.deepEqual(rankLinks(rows, 'decline', '').map(r => r.code), ['old', 'leader'])
  assert.deepEqual(rankLinks(rows, 'growth', '').map(r => r.code), ['new'])
  assert.deepEqual(rankLinks(rows, 'zero', '').map(r => r.code), ['old', 'quiet'])
  assert.equal(rankLinks(rows, 'clicks', 'merchant.test').length, 4)
  assert.equal(rows[0].code, 'old')
})
test('zero baseline is new or no baseline, never fabricated percentage', () => {
  assert.equal(trafficChange(20, 0), 'New')
  assert.equal(trafficChange(0, 0), 'No baseline')
  assert.equal(trafficChange(0, 42), '−100%')
  assert.equal(trafficChange(110, 100), '+10%')
})
test('ranking CSV preserves full filtered set and neutralizes hostile spreadsheet text', () => {
  const csv = overviewCsv([{ ...rows[0], title: '=HYPERLINK("evil")', leading_source: '\t+unsafe' }], { from: '2026-09-01', to: '2026-09-07', traffic: 'non_bot', source: null, groupId: null, asOf: null }, '2026-09-08T00:00:00Z', 100)
  assert.ok(csv.includes("'=HYPERLINK"))
  assert.ok(csv.includes("'\t+unsafe"))
  assert.ok(csv.includes('previous_clicks'))
  assert.ok(csv.includes('2026-09-01'))
  assert.ok(csv.includes('non_bot'))
})
