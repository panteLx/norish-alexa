// Live check against a real Norish instance: NORISH_URL=... NORISH_API_KEY=... node scripts/smoke.js
const { createNorishClient } = require('../lambda/norish');

const baseUrl = process.env.NORISH_URL;
const apiKey = process.env.NORISH_API_KEY;
if (!baseUrl || !apiKey) {
  console.error('Set NORISH_URL and NORISH_API_KEY first.');
  process.exit(2);
}

const client = createNorishClient({ baseUrl, apiKey });
const created = new Map(); // id -> latest known version
let failed = false;

function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` (${detail})`}`);
  if (!ok) failed = true;
}

async function add(input) {
  const [g] = await client.addGrocery(input);
  created.set(g.id, g.version);
  return g;
}

// A merge bumps the version more than the POST response shows; re-read it, and honor "stale".
async function cleanup() {
  const base = `${baseUrl.replace(/\/+$/, '')}/api/v1/groceries`;
  const headers = { 'x-api-key': apiKey };
  const list = await (await fetch(base, { headers })).json();
  for (const id of created.keys()) {
    const current = list.find((g) => g.id === id);
    if (!current) continue;
    const res = await fetch(`${base}/${id}?version=${current.version}`, { method: 'DELETE', headers });
    const body = await res.json().catch(() => ({}));
    const ok = res.ok && body.success && !body.stale;
    console.log(`${ok ? 'cleaned' : 'CLEANUP FAILED'}  ${id}`);
    if (!ok) failed = true;
  }
}

(async () => {
  const name = 'Alexa-Smoke-Test';
  try {
    const first = await add({ name, amount: 2, unit: null });
    check('first add returns amount 2', first.amount === 2, `got ${first.amount}`);
    const second = await add({ name, amount: 1, unit: null });
    check('same name and unit merges to 3', second.id === first.id && second.amount === 3, JSON.stringify(second));
    const withUnit = await add({ name, amount: 1, unit: 'l' });
    check('different unit creates a separate entry', withUnit.id !== first.id, `same id ${withUnit.id}`);
  } catch (e) {
    check('requests succeed', false, e.message);
  } finally {
    await cleanup();
  }
  process.exit(failed ? 1 : 0);
})();
