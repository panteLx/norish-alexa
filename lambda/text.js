function normalizeName(raw) {
  if (typeof raw !== 'string') return '';
  const s = raw.trim();
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

function formatAmount(n) {
  return String(n).replace('.', ',');
}

function confirmation({ amount, spokenUnit, name }) {
  const parts = [formatAmount(amount), spokenUnit, name].filter(Boolean);
  return `${parts.join(' ')} hinzugefügt`;
}

const ERRORS = {
  auth: 'Norish hat den Zugriff abgelehnt. Bitte prüfe den Zugangsschlüssel in den Skill-Einstellungen.',
  rate_limit: 'Norish ist gerade ausgelastet. Bitte versuche es später noch einmal.',
  network: 'Ich kann Norish gerade nicht erreichen. Bitte versuche es später noch einmal.',
  server: 'Norish meldet einen Fehler. Bitte versuche es später noch einmal.',
  not_configured: 'Der Skill ist noch nicht eingerichtet. Bitte hinterlege zuerst die Norish-Adresse.',
  invalid_response: 'Norish hat unerwartet geantwortet. Der Artikel wurde möglicherweise nicht hinzugefügt.',
};

function errorSpeech(kind) {
  return ERRORS[kind] || 'Da ist etwas schiefgelaufen. Bitte versuche es noch einmal.';
}

module.exports = { normalizeName, formatAmount, confirmation, errorSpeech };
