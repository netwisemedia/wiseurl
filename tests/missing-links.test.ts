import test from 'node:test'
import assert from 'node:assert/strict'

import { missingLinkRequest, isMissingLinkReportUnavailable } from '../src/lib/missing-links.ts'

const now = new Date('2026-09-20T22:30:00Z')

test('missing-link request defaults to non-bot traffic and accepts a frozen as-of time', () => {
  assert.deepEqual(missingLinkRequest(new URLSearchParams('from=2026-09-01&to=2026-09-21&asOf=2026-09-20T20%3A00%3A00Z'), now), {
    from: '2026-09-01',
    to: '2026-09-21',
    traffic: 'non_bot',
    asOf: '2026-09-20T20:00:00Z',
  })
})

test('missing-link request rejects invalid, future, oversized, and pre-range dates', () => {
  assert.throws(() => missingLinkRequest(new URLSearchParams('from=2026-02-30&to=2026-03-01'), now), /valid dates/)
  assert.throws(() => missingLinkRequest(new URLSearchParams('from=2026-09-21&to=2026-09-22'), now), /future/)
  assert.throws(() => missingLinkRequest(new URLSearchParams('from=2025-01-01&to=2026-09-21'), now), /366 days/)
  assert.throws(() => missingLinkRequest(new URLSearchParams('from=2026-09-20&to=2026-09-21&asOf=2026-09-19T00%3A00%3A00Z'), now), /precede/)
  assert.throws(() => missingLinkRequest(new URLSearchParams('from=2026-09-20&to=2026-09-21&traffic=people'), now), /non_bot, all, or bots/)
})

test('missing RPC detection is narrow', () => {
  assert.equal(isMissingLinkReportUnavailable({ code: 'PGRST202' }), true)
  assert.equal(isMissingLinkReportUnavailable({ code: '42883' }), true)
  assert.equal(isMissingLinkReportUnavailable({ message: 'Could not find wiseurl_missing_links_report in schema cache' }), true)
  assert.equal(isMissingLinkReportUnavailable({ code: '42501', message: 'permission denied' }), false)
})
