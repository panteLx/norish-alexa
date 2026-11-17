const test = require('node:test');
const assert = require('node:assert/strict');
const { NorishError, createNorishClient } = require('../norish');

const reply = (status, body, headers = {}) => async () =>
  new Response(JSON.stringify(body), { status, headers });

const client = (fetchImpl, baseUrl = 'https://norish.example.com') =>
  createNorishClient({ baseUrl, apiKey: 'test-key', fetchImpl, timeoutMs: 50 });

test('posts the grocery and returns the parsed array', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify([{ id: '1', name: 'Milch' }]), { status: 200 });
  };
  const result = await client(fetchImpl).addGrocery({ name: 'Milch', amount: 2, unit: 'l' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://norish.example.com/api/v1/groceries');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.headers['x-api-key'], 'test-key');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
  assert.equal(calls[0].init.body, '{"name":"Milch","unit":"l","amount":2}');
  assert.deepEqual(result, [{ id: '1', name: 'Milch' }]);
});

test('a trailing slash in baseUrl does not produce a double slash', async () => {
  let seen;
  const fetchImpl = async (url) => {
    seen = url;
    return new Response('[{"id":"1"}]', { status: 200 });
  };
  await client(fetchImpl, 'https://norish.example.com/').addGrocery({ name: 'Milch', amount: 1, unit: null });
  assert.equal(seen, 'https://norish.example.com/api/v1/groceries');
});

const input = { name: 'Milch', amount: 1, unit: null };

async function kindOf(fetchImpl) {
  try {
    await client(fetchImpl).addGrocery(input);
  } catch (e) {
    assert.ok(e instanceof NorishError);
    return e;
  }
  assert.fail('expected NorishError');
}

test('401 and 403 map to auth', async () => {
  assert.equal((await kindOf(reply(401, {}))).kind, 'auth');
  assert.equal((await kindOf(reply(403, {}))).kind, 'auth');
});

test('429 maps to rate_limit and keeps Retry-After', async () => {
  const e = await kindOf(reply(429, {}, { 'Retry-After': '30' }));
  assert.equal(e.kind, 'rate_limit');
  assert.equal(e.retryAfter, 30);
});

test('5xx maps to server', async () => {
  assert.equal((await kindOf(reply(500, {}))).kind, 'server');
});

test('a throwing fetch maps to network', async () => {
  const e = await kindOf(async () => {
    throw new TypeError('fetch failed');
  });
  assert.equal(e.kind, 'network');
});

test('a request that never answers times out as network', async () => {
  const e = await kindOf((_url, init) => new Promise((_res, rej) => {
    init.signal.addEventListener('abort', () => rej(new Error('aborted')));
  }));
  assert.equal(e.kind, 'network');
});

test('empty or non-array body maps to invalid_response', async () => {
  assert.equal((await kindOf(reply(200, []))).kind, 'invalid_response');
  assert.equal((await kindOf(reply(200, { ok: true }))).kind, 'invalid_response');
});
