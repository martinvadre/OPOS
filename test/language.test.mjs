import test from 'node:test'
import assert from 'node:assert/strict'
import { translate } from '../src/language.ts'

test('Thai UI labels translate without changing customer product names', () => {
  assert.equal(translate('  Settings  '), '  ตั้งค่า  ')
  assert.equal(translate('3 guests'), '3 คน')
  assert.equal(translate('Thai tea'), 'Thai tea')
})
