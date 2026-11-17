const http = require('http');
const https = require('https');

// Minimal fetch replacement for runtimes without global fetch (Node 16).
function httpsFetch(url, { method = 'GET', headers = {}, body, signal } = {}) {
  return new Promise((resolve, reject) => {
    const mod = new URL(url).protocol === 'http:' ? http : https;
    const req = mod.request(url, { method, headers, signal }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          headers: { get: (n) => (res.headers[String(n).toLowerCase()] !== undefined ? res.headers[String(n).toLowerCase()] : null) },
          json: async () => JSON.parse(text),
        });
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

class NorishError extends Error {
  constructor(kind, message, retryAfter) {
    super(message || kind);
    this.name = 'NorishError';
    this.kind = kind;
    if (retryAfter !== undefined) this.retryAfter = retryAfter;
  }
}

function createNorishClient({ baseUrl, apiKey, fetchImpl = globalThis.fetch || httpsFetch, timeoutMs = 4000 }) {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/v1/groceries`;

  async function addGrocery({ name, amount, unit }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, unit, amount }),
        redirect: 'error', // a followed redirect would turn the POST into a GET and fake a success
        signal: controller.signal,
      });
    } catch (e) {
      throw new NorishError('network', e.message);
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 401 || res.status === 403) throw new NorishError('auth');
    if (res.status === 429) {
      const retry = Number(res.headers.get('Retry-After'));
      throw new NorishError('rate_limit', undefined, Number.isFinite(retry) ? retry : undefined);
    }
    if (!res.ok) throw new NorishError('server', `HTTP ${res.status}`);

    let body;
    try {
      body = await res.json();
    } catch (e) {
      throw new NorishError('invalid_response');
    }
    if (!Array.isArray(body) || body.length === 0) throw new NorishError('invalid_response');
    return body;
  }

  return { addGrocery };
}

module.exports = { NorishError, createNorishClient, httpsFetch };
