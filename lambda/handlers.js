const Alexa = require('ask-sdk-core');
const { NorishError } = require('./norish');
const { resolveUnit } = require('./units');
const { normalizeName, confirmation, errorSpeech } = require('./text');

const EXAMPLE = '2 Liter Milch hinzufügen';
const GOODBYE = 'Okay, bis bald.';
const ASK_AGAIN = `Was soll ich hinzufügen? Sag zum Beispiel: ${EXAMPLE}.`;

// Answers to "Sonst noch etwas?" can land in AddItemIntent as the article.
const END_WORDS = new Set(['danke', 'fertig', 'nichts', 'nein', 'nee', 'nein danke', 'das wars', 'das ist alles']);
const AGAIN_WORDS = new Set(['ja', 'ok', 'okay', 'bitte']);
const bare = (s) => s.toLowerCase().replace(/['’.!?,]/g, '').trim();

const isIntent = (input, name) =>
  Alexa.getRequestType(input.requestEnvelope) === 'IntentRequest' &&
  Alexa.getIntentName(input.requestEnvelope) === name;

// Clears the rejected slot value so Alexa's re-ask starts from a clean slot.
function elicit(input, slotName, speech) {
  const intent = JSON.parse(JSON.stringify(input.requestEnvelope.request.intent));
  if (intent.slots && intent.slots[slotName]) {
    delete intent.slots[slotName].value;
    delete intent.slots[slotName].resolutions;
  }
  return input.responseBuilder.speak(speech).reprompt(speech).addElicitSlotDirective(slotName, intent).getResponse();
}

function createHandlers({ getClient }) {
  const launch = {
    canHandle: (i) => Alexa.getRequestType(i.requestEnvelope) === 'LaunchRequest',
    handle: (i) => {
      const speech = `Willkommen bei Norish. Was soll auf die Einkaufsliste? Sag zum Beispiel: ${EXAMPLE}.`;
      return i.responseBuilder.speak(speech).reprompt(speech).getResponse();
    },
  };

  const addItem = {
    canHandle: (i) => isIntent(i, 'AddItemIntent'),
    handle: async (i) => {
      const slotValue = (n) => {
        const s = Alexa.getSlot(i.requestEnvelope, n);
        return s && typeof s.value === 'string' ? s.value : '';
      };

      // "1x" is spoken "einmal" and may land in the article slot.
      const name = normalizeName(slotValue('artikel').replace(/^\s*(einmal|ein mal|1\s?(x|mal))\s+/i, ''));
      if (!name) return elicit(i, 'artikel', 'Was soll ich zur Einkaufsliste hinzufügen?');
      if (END_WORDS.has(bare(name))) return i.responseBuilder.speak(GOODBYE).withShouldEndSession(true).getResponse();
      if (AGAIN_WORDS.has(bare(name))) return elicit(i, 'artikel', 'Was soll ich zur Einkaufsliste hinzufügen?');

      let amount = 1;
      const rawAmount = slotValue('menge').trim();
      if (rawAmount) {
        amount = Number(rawAmount.replace(',', '.'));
        if (!Number.isFinite(amount) || amount <= 0) {
          return elicit(i, 'menge', 'Wie viele sind es? Bitte nenne eine Zahl größer als null.');
        }
      }

      const unit = resolveUnit(Alexa.getSlot(i.requestEnvelope, 'einheit'));
      if (unit.kind === 'unknown') {
        return elicit(i, 'einheit', `Die Einheit ${unit.heard} kenne ich nicht. Welche Einheit meinst du?`);
      }

      try {
        await getClient().addGrocery({ name, amount, unit: unit.kind === 'ok' ? unit.unit : null });
      } catch (e) {
        if (!(e instanceof NorishError)) throw e;
        return i.responseBuilder.speak(errorSpeech(e.kind)).withShouldEndSession(true).getResponse();
      }

      const spoken = confirmation({ amount, spokenUnit: unit.kind === 'ok' ? unit.spoken : null, name });
      return i.responseBuilder
        .speak(`${spoken}. Sonst noch etwas?`)
        .reprompt('Was soll ich noch hinzufügen?')
        .getResponse();
    },
  };

  const askAgain = {
    canHandle: (i) => isIntent(i, 'AMAZON.FallbackIntent') || isIntent(i, 'AMAZON.YesIntent'),
    handle: (i) => i.responseBuilder.speak(ASK_AGAIN).reprompt(ASK_AGAIN).getResponse(),
  };

  const help = {
    canHandle: (i) => isIntent(i, 'AMAZON.HelpIntent'),
    handle: (i) => {
      const speech = `Sag zum Beispiel: ${EXAMPLE}. Die Menge und die Einheit sind optional.`;
      return i.responseBuilder.speak(speech).reprompt(speech).getResponse();
    },
  };

  const stop = {
    canHandle: (i) =>
      ['AMAZON.StopIntent', 'AMAZON.CancelIntent', 'AMAZON.NoIntent'].some((n) => isIntent(i, n)),
    handle: (i) => i.responseBuilder.speak(GOODBYE).withShouldEndSession(true).getResponse(),
  };

  const sessionEnded = {
    canHandle: (i) => Alexa.getRequestType(i.requestEnvelope) === 'SessionEndedRequest',
    handle: (i) => i.responseBuilder.getResponse(),
  };

  return [launch, addItem, askAgain, help, stop, sessionEnded];
}

const errorHandler = {
  canHandle: () => true,
  handle: (i, error) => {
    console.error(error && error.stack ? error.stack : error);
    return i.responseBuilder
      .speak('Da ist etwas schiefgelaufen. Bitte versuche es noch einmal.')
      .withShouldEndSession(true)
      .getResponse();
  },
};

module.exports = { createHandlers, errorHandler };
