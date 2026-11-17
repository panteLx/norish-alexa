class NorishError extends Error {
  constructor(kind, message, retryAfter) {
    super(message || kind);
    this.name = 'NorishError';
    this.kind = kind;
    if (retryAfter !== undefined) this.retryAfter = retryAfter;
  }
}

function createNorishClient({ baseUrl, apiKey, fetchImpl = fetch, timeoutMs = 4000 }) {
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
    } catch {
      throw new NorishError('invalid_response');
    }
    if (!Array.isArray(body) || body.length === 0) throw new NorishError('invalid_response');
    return body;
  }

  return { addGrocery };
}

module.exports = { NorishError, createNorishClient };
