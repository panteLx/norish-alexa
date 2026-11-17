const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandlers, errorHandler } = require('../handlers');
const { NorishError } = require('../norish');
const { errorSpeech } = require('../text');
const { slot, fakeInput, speechOf, elicited } = require('./helpers');

const LITER = { id: 'l', name: 'Liter' };

function setup(addImpl) {
  const calls = [];
  const client = {
    addGrocery: async (args) => {
      calls.push(args);
      return addImpl ? addImpl(args) : [{ id: '1' }];
    },
  };
  const handlers = createHandlers({ getClient: () => client });
  const run = async (input) => {
    const h = handlers.find((x) => x.canHandle(input));
    assert.ok(h, 'no handler matched');
    return h.handle(input);
  };
  return { calls, run };
}

const add = (slots) => fakeInput({ intent: { name: 'AddItemIntent', slots } });

test('adds amount, unit and name and keeps the session open', async () => {
  const { calls, run } = setup();
  const res = await run(add({
    menge: slot('menge', '2'),
    einheit: slot('einheit', 'Liter', LITER),
    artikel: slot('artikel', 'milch'),
  }));
  assert.deepEqual(calls, [{ name: 'Milch', amount: 2, unit: 'l' }]);
  assert.match(speechOf(res), /2 Liter Milch hinzugefügt/);
  assert.notEqual(res.shouldEndSession, true);
});

test('defaults to amount 1 and no unit', async () => {
  const { calls, run } = setup();
  await run(add({ artikel: slot('artikel', 'milch') }));
  assert.deepEqual(calls, [{ name: 'Milch', amount: 1, unit: null }]);
});

test('a leading "einmal" in the article is dropped and amount stays 1', async () => {
  const { calls, run } = setup();
  await run(add({ artikel: slot('artikel', 'einmal spätzle') }));
  assert.deepEqual(calls, [{ name: 'Spätzle', amount: 1, unit: null }]);
});

test('blank article asks for the article', async () => {
  const { calls, run } = setup();
  const res = await run(add({ artikel: slot('artikel', '   ') }));
  assert.equal(calls.length, 0);
  assert.deepEqual(elicited(res), ['artikel']);
});

for (const bad of ['0', '-3', '?']) {
  test(`amount "${bad}" asks for the amount`, async () => {
    const { calls, run } = setup();
    const res = await run(add({ menge: slot('menge', bad), artikel: slot('artikel', 'milch') }));
    assert.equal(calls.length, 0);
    assert.deepEqual(elicited(res), ['menge']);
  });
}

test('unknown unit asks for the unit', async () => {
  const { calls, run } = setup();
  const res = await run(add({
    einheit: slot('einheit', 'Zentner', 'NO_MATCH'),
    artikel: slot('artikel', 'milch'),
  }));
  assert.equal(calls.length, 0);
  assert.deepEqual(elicited(res), ['einheit']);
  assert.match(speechOf(res), /Zentner/);
});

test('fractional amount is sent as a number and spoken with a comma', async () => {
  const { calls, run } = setup();
  const res = await run(add({ menge: slot('menge', '0.5'), artikel: slot('artikel', 'milch') }));
  assert.equal(calls[0].amount, 0.5);
  assert.match(speechOf(res), /0,5/);
});

for (const kind of ['auth', 'rate_limit', 'network']) {
  test(`NorishError ${kind} is spoken and ends the session`, async () => {
    const { run } = setup(() => {
      throw new NorishError(kind);
    });
    const res = await run(add({ artikel: slot('artikel', 'milch') }));
    assert.equal(speechOf(res), errorSpeech(kind));
    assert.equal(res.shouldEndSession, true);
  });
}

test('an unexpected error is rethrown for the error handler', async () => {
  const { run } = setup(() => {
    throw new Error('boom');
  });
  await assert.rejects(run(add({ artikel: slot('artikel', 'milch') })), /boom/);
});

test('error handler speaks a generic German message', async () => {
  const res = await errorHandler.handle(fakeInput(), new Error('boom'));
  assert.match(speechOf(res), /schiefgelaufen/);
});

test('No and Stop end the session', async () => {
  const { run } = setup();
  for (const name of ['AMAZON.NoIntent', 'AMAZON.StopIntent', 'AMAZON.CancelIntent']) {
    const res = await run(fakeInput({ intent: { name } }));
    assert.equal(res.shouldEndSession, true, name);
  }
});

test('Launch and Help keep the session open and give an example', async () => {
  const { run } = setup();
  const launch = await run(fakeInput({ type: 'LaunchRequest' }));
  assert.notEqual(launch.shouldEndSession, true);
  const help = await run(fakeInput({ intent: { name: 'AMAZON.HelpIntent' } }));
  assert.notEqual(help.shouldEndSession, true);
  assert.match(speechOf(help), /2 Liter Milch hinzufügen/);
});

test('a decimal comma in the amount is accepted', async () => {
  const { calls, run } = setup();
  await run(add({ menge: slot('menge', '1,5'), artikel: slot('artikel', 'milch') }));
  assert.equal(calls[0].amount, 1.5);
});

test('the explicit "no unit" answer posts without a unit', async () => {
  const { calls, run } = setup();
  const res = await run(add({
    einheit: slot('einheit', 'keine', { id: 'none', name: 'keine' }),
    artikel: slot('artikel', 'joghurt'),
  }));
  assert.equal(calls[0].unit, null);
  assert.match(speechOf(res), /^1 Joghurt hinzugefügt/);
});

for (const word of ['ja', 'ok', 'bitte']) {
  test(`"${word}" as article asks again instead of posting`, async () => {
    const { calls, run } = setup();
    const res = await run(add({ artikel: slot('artikel', word) }));
    assert.equal(calls.length, 0);
    assert.deepEqual(elicited(res), ['artikel']);
  });
}

for (const word of ['danke', 'fertig', 'nichts', 'nein', 'das wars']) {
  test(`"${word}" as article ends the session instead of posting`, async () => {
    const { calls, run } = setup();
    const res = await run(add({ artikel: slot('artikel', word) }));
    assert.equal(calls.length, 0);
    assert.equal(res.shouldEndSession, true);
  });
}

test('Fallback and Yes keep the session open and ask what to add', async () => {
  const { run } = setup();
  for (const name of ['AMAZON.FallbackIntent', 'AMAZON.YesIntent']) {
    const res = await run(fakeInput({ intent: { name } }));
    assert.notEqual(res.shouldEndSession, true, name);
    assert.match(speechOf(res), /hinzufügen/, name);
  }
});
