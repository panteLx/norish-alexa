const test = require('node:test');
const assert = require('node:assert/strict');
const pkg = require('../package.json');

// The hosted builder may skip peer dependencies, so ask-sdk-model must be listed explicitly.
test('package.json lists ask-sdk-core and its peer ask-sdk-model', () => {
  assert.ok(pkg.dependencies['ask-sdk-core']);
  assert.ok(pkg.dependencies['ask-sdk-model']);
});
