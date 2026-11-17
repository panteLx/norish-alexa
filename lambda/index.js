const Alexa = require('ask-sdk-core');
const { createHandlers, errorHandler } = require('./handlers');
const { createNorishClient } = require('./norish');
const { loadConfig } = require('./config');

const handlers = createHandlers({ getClient: () => createNorishClient(loadConfig()) });

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(...handlers)
  .addErrorHandlers(errorHandler)
  .lambda();
