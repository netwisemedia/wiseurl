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
