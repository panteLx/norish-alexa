const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.join(__dirname, '..', '..', 'skill-package');
const modelFile = require(path.join(root, 'interactionModels', 'custom', 'de-DE.json'));
const manifest = require(path.join(root, 'skill.json'));
const lang = modelFile.interactionModel.languageModel;
const intent = (name) => lang.intents.find((i) => i.name === name);

test('invocation name is norish liste', () => {
  assert.equal(lang.invocationName, 'norish liste');
});

test('AddItemIntent has the three slots with the right types', () => {
  const slots = Object.fromEntries(intent('AddItemIntent').slots.map((s) => [s.name, s.type]));
  assert.deepEqual(slots, { menge: 'AMAZON.NUMBER', einheit: 'EINHEIT', artikel: 'ARTIKEL' });
});

test('every sample placeholder refers to a declared slot', () => {
  const add = intent('AddItemIntent');
  const declared = new Set(add.slots.map((s) => s.name));
  assert.ok(add.samples.length >= 6);
  for (const sample of add.samples) {
    for (const [, name] of sample.matchAll(/\{(\w+)\}/g)) {
      assert.ok(declared.has(name), `${sample} -> ${name}`);
    }
  }
});

test('artikel is required and has an elicitation prompt', () => {
  const dialog = modelFile.interactionModel.dialog.intents.find((i) => i.name === 'AddItemIntent');
  const slot = dialog.slots.find((s) => s.name === 'artikel');
  assert.equal(slot.elicitationRequired, true);
  const promptId = slot.prompts.elicitation;
  assert.ok(modelFile.interactionModel.prompts.some((p) => p.id === promptId));
});

test('EINHEIT ids are exactly the supported short forms', () => {
  const type = lang.types.find((t) => t.name === 'EINHEIT');
  assert.deepEqual(
    type.values.map((v) => v.id),
    ['g', 'kg', 'ml', 'l', 'EL', 'TL', 'Packung', 'Dose', 'Stück', 'none']
  );
});

test('samples avoid a slot glued to a letter and cover "mal"', () => {
  const samples = intent('AddItemIntent').samples;
  assert.ok(samples.every((x) => !/\}\S/.test(x)), 'slot must be followed by whitespace');
  assert.ok(samples.some((x) => x.includes('{menge} mal {artikel}')));
});

test('fallback and yes intents exist', () => {
  assert.ok(intent('AMAZON.FallbackIntent'));
  assert.ok(intent('AMAZON.YesIntent'));
});

test('built-in help, stop, cancel and no intents exist', () => {
  for (const n of ['AMAZON.HelpIntent', 'AMAZON.StopIntent', 'AMAZON.CancelIntent', 'AMAZON.NoIntent']) {
    assert.ok(intent(n), n);
  }
});

test('manifest is German and custom', () => {
  const m = manifest.manifest;
  assert.ok(m.publishingInformation.locales['de-DE']);
  assert.ok(m.apis.custom);
});
