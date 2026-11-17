const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveUnit } = require('../units');

const resolved = (code, values) => ({
  resolutionsPerAuthority: [{ status: { code }, values }],
});

test('missing slot or empty value means no unit', () => {
  assert.deepEqual(resolveUnit(undefined), { kind: 'none' });
  assert.deepEqual(resolveUnit({ name: 'einheit' }), { kind: 'none' });
});

test('matched slot resolves to short form and spoken name', () => {
  const slot = {
    value: 'Gramm',
    resolutions: resolved('ER_SUCCESS_MATCH', [{ value: { id: 'g', name: 'Gramm' } }]),
  };
  assert.deepEqual(resolveUnit(slot), { kind: 'ok', unit: 'g', spoken: 'Gramm' });
});

test('unmatched value is unknown', () => {
  const slot = { value: 'Zentner', resolutions: resolved('ER_SUCCESS_NO_MATCH', []) };
  assert.deepEqual(resolveUnit(slot), { kind: 'unknown', heard: 'Zentner' });
});

test('value without resolutions is unknown', () => {
  assert.deepEqual(resolveUnit({ value: 'Zentner' }), { kind: 'unknown', heard: 'Zentner' });
});

test('the explicit "no unit" value resolves to none', () => {
  const slot = {
    value: 'keine',
    resolutions: resolved('ER_SUCCESS_MATCH', [{ value: { id: 'none', name: 'keine' } }]),
  };
  assert.deepEqual(resolveUnit(slot), { kind: 'none' });
});
