const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadConfig } = require('../config');
const { NorishError } = require('../norish');

const tmpFile = (content) => {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-')), 'config.json');
  if (content !== undefined) fs.writeFileSync(p, JSON.stringify(content));
  return p;
};

test('env vars are used', () => {
  const cfg = loadConfig({ NORISH_URL: 'https://a.example', NORISH_API_KEY: 'k1' }, tmpFile());
  assert.deepEqual(cfg, { baseUrl: 'https://a.example', apiKey: 'k1' });
});

test('env vars win over the file', () => {
  const file = tmpFile({ baseUrl: 'https://file.example', apiKey: 'kf' });
  const cfg = loadConfig({ NORISH_URL: 'https://env.example', NORISH_API_KEY: 'ke' }, file);
  assert.deepEqual(cfg, { baseUrl: 'https://env.example', apiKey: 'ke' });
});

test('the file is used when env is empty', () => {
  const file = tmpFile({ baseUrl: 'https://file.example', apiKey: 'kf' });
  assert.deepEqual(loadConfig({}, file), { baseUrl: 'https://file.example', apiKey: 'kf' });
});

test('missing config throws not_configured', () => {
  assert.throws(
    () => loadConfig({}, tmpFile()),
    (e) => e instanceof NorishError && e.kind === 'not_configured'
  );
});
