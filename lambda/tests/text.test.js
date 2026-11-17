const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeName, formatAmount, confirmation, errorSpeech } = require('../text');

test('normalizeName trims and capitalizes', () => {
  assert.equal(normalizeName('  milch '), 'Milch');
  assert.equal(normalizeName('Eier'), 'Eier');
});

test('normalizeName returns empty string for blank or non-string', () => {
  assert.equal(normalizeName('   '), '');
  assert.equal(normalizeName(undefined), '');
});

test('formatAmount uses German decimal comma', () => {
  assert.equal(formatAmount(0.5), '0,5');
  assert.equal(formatAmount(2), '2');
});

test('confirmation without unit', () => {
  assert.equal(confirmation({ amount: 2, spokenUnit: null, name: 'Milch' }), '2 Milch hinzugefügt');
});

test('confirmation with unit', () => {
  assert.equal(confirmation({ amount: 2, spokenUnit: 'Liter', name: 'Milch' }), '2 Liter Milch hinzugefügt');
});

test('confirmation keeps the default amount of 1 audible', () => {
  assert.equal(confirmation({ amount: 1, spokenUnit: null, name: 'Milch' }), '1 Milch hinzugefügt');
});

test('errorSpeech is German, non-empty and never mentions the API key', () => {
  const kinds = ['auth', 'rate_limit', 'network', 'server', 'not_configured', 'invalid_response'];
  for (const kind of kinds) {
    const s = errorSpeech(kind);
    assert.ok(s.length > 0, kind);
    assert.doesNotMatch(s, /api|key/i, kind);
  }
});
