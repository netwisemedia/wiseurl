import test from 'node:test'
import assert from 'node:assert/strict'
import { canConfigureCode, opportunityCsv, rankOpportunities } from '../src/lib/opportunities.ts'
const rows = [
  { code: 'new', requests: 30, previous_requests: 10, status: 'missing', leading_source: 'couponswift.com', last_seen: null, link_id: null },
  { code: 'quiet', requests: 0, previous_requests: 50, status: 'inactive', leading_source: 'couponswift.com', last_seen: null, link_id: 'id' },
  { code: 'fixed', requests: 100, previous_requests: 0, status: 'resolved', leading_source: 'couponswift.com', last_seen: null, link_id: 'id2' },
] as const

test('demand ranking keeps previous-only opportunities, separates resolved links, searches all rows', () => {
  assert.deepEqual(rankOpportunities([...rows], 'open', 'requests', '').map(r => r.code), ['new', 'quiet'])
  assert.deepEqual(rankOpportunities([...rows], 'open', 'decline', '').map(r => r.code), ['quiet'])
  assert.deepEqual(rankOpportunities([...rows], 'all', 'growth', '').map(r => r.code), ['fixed', 'new'])
  assert.equal(rankOpportunities([...rows], 'resolved', 'requests', ' FIX ')[0].code, 'fixed')
})
test('only exact routable creation codes are offered; no silent lowercasing or reserved routes', () => {
  for (const code of ['scalahosting', 'test-123', 'test_123']) assert.equal(canConfigureCode(code), true)
  for (const code of ['ScalaHosting', 'leonardo.ai', 'api', 'dashboard', '_next', 'a'.repeat(51), '', '../login']) assert.equal(canConfigureCode(code), false, code)
})
test('CSV includes previous volume and snapshot metadata, protects spreadsheet formula text', () => {
  const csv = opportunityCsv([{ ...rows[0], code: '=HYPERLINK("evil")' }], { from: '2026-09-01', to: '2026-09-07', traffic: 'non_bot' }, '2026-09-08T00:00:00Z')
  assert.match(csv, /previous_requests/)
  assert.match(csv, /"'=HYPERLINK\(""evil""\)"/)
  assert.match(csv, /2026-09-01,2026-09-07,non_bot,2026-09-08T00:00:00Z/)
})

const periodRows = [
  { ...rows[0], code: 'a', requests: 5, today_requests: 1, yesterday_requests: 9, last_7d_requests: 20, last_30d_requests: 40 },
  { ...rows[0], code: 'b', requests: 9, today_requests: 4, yesterday_requests: 0, last_7d_requests: 10, last_30d_requests: 90 },
  { ...rows[0], code: 'legacy', requests: 7 },
]
test('rows rank by each period column; rows without the new fields (old SQL function) count as zero', () => {
  const rank = (order: 'today' | 'yesterday' | 'last_7d' | 'last_30d') => rankOpportunities(periodRows as never, 'open', order, '').map(r => r.code)
  assert.deepEqual(rank('today'), ['b', 'a', 'legacy'])
  assert.deepEqual(rank('yesterday'), ['a', 'b', 'legacy'])
  assert.deepEqual(rank('last_7d'), ['a', 'b', 'legacy'])
  assert.deepEqual(rank('last_30d'), ['b', 'a', 'legacy'])
})
test('CSV exports the period columns and leaves them empty for rows without them', () => {
  const csv = opportunityCsv(periodRows as never, { from: '2026-09-01', to: '2026-09-07', traffic: 'non_bot' }, 'x').split('\r\n')
  assert.match(csv[0], /,change,today,yesterday,last_7_days,last_30_days,leading_source,/)
  assert.match(csv[1], /^a,missing,5,10,[^,]+,1,9,20,40,couponswift\.com,/)
  assert.match(csv[3], /^legacy,missing,7,10,[^,]+,,,,,couponswift\.com,/)
})

import { NON_STORE_CODES, isShortCodeCandidate } from '../src/lib/opportunities.ts'
test('scanner noise is not a short-code candidate; real store codes are', () => {
  for (const code of ['robots.txt', 'redirect.php', '.env', 'Register', ...NON_STORE_CODES]) assert.equal(isShortCodeCandidate(code), false, code)
  for (const code of ['hostinger', 'nord-vpn', 'scala_hosting', 'a1']) assert.equal(isShortCodeCandidate(code), true, code)
})
test('blocklist entries are unique and lowercase, and include the key generic paths', () => {
  assert.equal(new Set(NON_STORE_CODES).size, NON_STORE_CODES.length)
  for (const code of NON_STORE_CODES) assert.equal(code, code.toLowerCase())
  for (const code of ['register', 'wp-admin', 'cgi-bin', 'sitemap']) assert.ok(NON_STORE_CODES.includes(code))
})
