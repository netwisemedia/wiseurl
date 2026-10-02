import test from 'node:test'
import assert from 'node:assert/strict'
import { filterProgramLinks, programForCode, parseCookieDays } from '../src/lib/programs.ts'

const links = [
  { code: 'Scala.Hosting', title: 'Scala Hosting', destination_url: 'https://scala.example/affiliate', is_active: true },
  { code: 'scala.hosting', title: 'Other', destination_url: 'https://other.example', is_active: false },
]

const programs = [
  { code: 'Scala.Hosting', network: 'Impact', access: 'approved' as const },
]

test('matches program rows by exact link code', () => {
  assert.equal(programForCode(programs, 'Scala.Hosting')?.network, 'Impact')
  assert.equal(programForCode(programs, 'scala.hosting'), undefined)
})

test('filters by recorded access without treating a missing row as not applied', () => {
  assert.deepEqual(filterProgramLinks(links, programs, '', 'approved').map(link => link.code), ['Scala.Hosting'])
  assert.deepEqual(filterProgramLinks(links, programs, '', 'unknown').map(link => link.code), ['scala.hosting'])
  assert.deepEqual(filterProgramLinks(links, programs, '', 'not_applied'), [])
})

test('searches code, title, destination, and network', () => {
  assert.deepEqual(filterProgramLinks(links, programs, 'impact', 'all').map(link => link.code), ['Scala.Hosting'])
  assert.deepEqual(filterProgramLinks(links, programs, 'other.example', 'all').map(link => link.code), ['scala.hosting'])
})

test('cookie days accepts zero and rejects invalid values', () => {
  assert.equal(parseCookieDays(''), null)
  assert.equal(parseCookieDays('0'), 0)
  assert.equal(parseCookieDays('30'), 30)
  assert.throws(() => parseCookieDays('-1'))
  assert.throws(() => parseCookieDays('1.5'))
})
