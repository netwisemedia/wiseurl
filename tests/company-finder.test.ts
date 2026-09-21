import test from 'node:test'
import assert from 'node:assert/strict'
import { findCompanyLinks, normalizeCompanySearch } from '../src/lib/company-finder.ts'

const links = [
  {
    id: '1',
    code: 'scala-hosting',
    title: 'Scala Hosting',
    destination_url: 'https://www.scalahosting.com/aff/partner?campaign=main',
    is_active: false,
  },
  {
    id: '2',
    code: 'other',
    title: 'Another merchant',
    destination_url: 'https://merchant.example/path',
    is_active: true,
  },
]

test('normalizes spaces, punctuation, and case for company lookup', () => {
  assert.equal(normalizeCompanySearch('  Scala-Hosting!  '), 'scalahosting')
})

test('finds links across code, title, and full destination', () => {
  assert.deepEqual(findCompanyLinks(links, 'Scala Hosting').map(link => link.id), ['1'])
  assert.deepEqual(findCompanyLinks(links, 'campaign main').map(link => link.id), ['1'])
  assert.deepEqual(findCompanyLinks(links, 'merchant.example').map(link => link.id), ['2'])
})

test('includes inactive links and returns no results before a query', () => {
  assert.equal(findCompanyLinks(links, 'scalahosting')[0]?.is_active, false)
  assert.deepEqual(findCompanyLinks(links, '   '), [])
})
