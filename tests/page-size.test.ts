import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, parsePageSize } from '../src/lib/page-size.ts'

test('rows per page accepts only the offered sizes and defaults to 50', () => {
  assert.deepEqual([...PAGE_SIZE_OPTIONS], [20, 50, 100])
  assert.equal(DEFAULT_PAGE_SIZE, 50)
  for (const value of ['20', '50', '100']) assert.equal(parsePageSize(value), Number(value))
  for (const value of [null, undefined, '', '10', '25', '1000', 'abc', '-20', '50.5']) assert.equal(parsePageSize(value), 50)
})
