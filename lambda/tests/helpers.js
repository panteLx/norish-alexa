const { ResponseFactory } = require('ask-sdk-core');

const slot = (name, value, resolved) => {
  const s = { name, value, confirmationStatus: 'NONE' };
  if (resolved === 'NO_MATCH') {
    s.resolutions = { resolutionsPerAuthority: [{ status: { code: 'ER_SUCCESS_NO_MATCH' }, values: [] }] };
  } else if (resolved) {
    s.resolutions = {
      resolutionsPerAuthority: [
        { status: { code: 'ER_SUCCESS_MATCH' }, values: [{ value: { id: resolved.id, name: resolved.name } }] },
      ],
    };
  }
  return s;
};

// intent: {name, slots: {slotName: slotObject}}; omit it for non-intent requests.
function fakeInput({ type = 'IntentRequest', intent } = {}) {
  const request = { type };
  if (intent) request.intent = { name: intent.name, slots: intent.slots || {}, confirmationStatus: 'NONE' };
  return { requestEnvelope: { request, session: { new: false } }, responseBuilder: ResponseFactory.init() };
}

const speechOf = (res) => (res.outputSpeech ? res.outputSpeech.ssml.replace(/<\/?speak>/g, '') : '');
const elicited = (res) => (res.directives || []).filter((d) => d.type === 'Dialog.ElicitSlot').map((d) => d.slotToElicit);

module.exports = { slot, fakeInput, speechOf, elicited };
