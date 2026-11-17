// The spoken-form -> short-form mapping lives in the interaction model (slot value ids).
function resolveUnit(slot) {
  if (!slot || !slot.value) return { kind: 'none' };
  const authorities = (slot.resolutions && slot.resolutions.resolutionsPerAuthority) || [];
  for (const a of authorities) {
    if (a.status && a.status.code === 'ER_SUCCESS_MATCH' && a.values && a.values[0]) {
      const { id, name } = a.values[0].value;
      if (id === 'none') return { kind: 'none' };
      return { kind: 'ok', unit: id, spoken: name };
    }
  }
  return { kind: 'unknown', heard: slot.value };
}

module.exports = { resolveUnit };
