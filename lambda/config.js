const fs = require('fs');
const path = require('path');
const { NorishError } = require('./norish');

function readFileConfig(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return {};
  }
}

// Env vars win; config.json is the fallback because Alexa-hosted has no env var UI.
function loadConfig(env = process.env, filePath = path.join(__dirname, 'config.json')) {
  const file = readFileConfig(filePath);
  const baseUrl = env.NORISH_URL || file.baseUrl;
  const apiKey = env.NORISH_API_KEY || file.apiKey;
  if (!baseUrl || !apiKey) throw new NorishError('not_configured');
  return { baseUrl, apiKey };
}

module.exports = { loadConfig };
