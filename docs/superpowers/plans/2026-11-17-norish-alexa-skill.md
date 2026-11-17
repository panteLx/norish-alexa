# Norish Alexa Skill Implementation Plan

> **Hinweis (Stand der Umsetzung):** Dieses Dokument ist der ursprüngliche Entwurf. Die Umsetzung weicht ab: Node 16 statt 18 (https-Fallback statt `fetch`), kein eigenes `skill.json` (Amazon verwaltet das Manifest), Aufrufname `schmecki liste`, Deployment über einen Amazon-Klon. Maßgeblich ist die README.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A private German Alexa skill ("norish") that adds items with optional amount and unit to a self-hosted Norish shopping list.

**Architecture:** Alexa-hosted Node.js skill. A custom intent `AddItemIntent` (slots `menge`, `einheit`, `artikel`) is handled by a thin handler that validates input, calls a small Norish HTTP client (`POST /api/v1/groceries`) and speaks a confirmation. The unit mapping (spoken form → short form) lives in the interaction model as slot-value ids and is read via entity resolution.

**Tech Stack:** Node.js 18+ (global `fetch`), `ask-sdk-core`, built-in `node:test` (no test dependencies).

**Spec:** `docs/superpowers/specs/2026-11-17-norish-alexa-skill-design.md`

## Global Constraints

- Locale `de-DE`, invocation name `norish`. All spoken strings German; code comments English, 1–2 lines, only where a reader would otherwise break something.
- Amount defaults to `1`, unit defaults to `null`. Request body to Norish always contains `name`, `unit`, `amount`.
- Units are sent as exactly one of: `g`, `kg`, `ml`, `l`, `EL`, `TL`, `Packung`, `Dose`, `Stück`. Free-text units are never forwarded.
- Name is trimmed and gets an uppercase first letter; otherwise unchanged.
- Alexa asks back only when: article missing/blank, amount ≤ 0 or not a number, unit unknown. Confirmation echoes what the user said, not the API response.
- Norish base URL and API key never appear in the repo (no code, no tests, no docs with real values). They come from env vars `NORISH_URL` / `NORISH_API_KEY` or the gitignored `lambda/config.json` (`{"baseUrl": "...", "apiKey": "..."}`). `baseUrl` is the bare domain (e.g. `https://norish.example.com`); the client appends `/api/v1/groceries`.
- Auth header: `x-api-key`. Per-request timeout 4 s (Alexa allows ~8 s).
- Commits only when the user asks; no Claude attribution in commits or PR text; PR title/body in English, title as `type(scope): summary`.

## Review Focus

- Amount `0`, negative, or non-numeric (`"?"`): Alexa asks for the amount again; nothing is posted.
- Unit not in the list (`ER_SUCCESS_NO_MATCH`): Alexa asks for the unit again; nothing is posted.
- Norish answers 401/403, 429, 5xx, times out, or returns `[]`: a short German error is spoken, the session does not crash, the API key is never spoken.
- `NORISH_URL` with a trailing slash: request goes to a single-slash URL.
- Article is whitespace only, lowercase (`milch`), or padded: blank counts as missing; otherwise `Milch` is sent.
- Fractional amount (`0.5`): spoken as `0,5`, sent as `0.5`.

---

## File Structure

```
lambda/
  package.json            # deps: ask-sdk-core; script: "test": "node --test tests/"
  index.js                # wires handlers into SkillBuilders.custom().lambda()
  handlers.js             # request handlers + error handler
  norish.js               # NorishError, createNorishClient
  config.js               # loadConfig
  units.js                # resolveUnit
  text.js                 # normalizeName, formatAmount, confirmation, errorSpeech
  config.example.json     # placeholder values only
  tests/                  # *.test.js, helpers.js
skill-package/
  skill.json
  interactionModels/custom/de-DE.json
scripts/smoke.js          # live check against a real Norish instance
README.md                 # setup + deployment
.gitignore                # node_modules, lambda/config.json
```

---

### Task 1: Scaffold and speech text helpers

**Files:**
- Create: `lambda/package.json`, `.gitignore`, `lambda/text.js`
- Test: `lambda/tests/text.test.js`

**Interfaces:**
- Produces:
  - `normalizeName(raw: string): string` — trim, uppercase first character; `""` for blank/non-string.
  - `formatAmount(n: number): string` — German decimal comma (`0.5` → `"0,5"`, `2` → `"2"`).
  - `confirmation({amount: number, spokenUnit: string|null, name: string}): string`
  - `errorSpeech(kind: 'auth'|'rate_limit'|'network'|'server'|'not_configured'|'invalid_response'): string`

- [ ] **Step 1: Scaffold.** `lambda/package.json` (`"private": true`, dependency `ask-sdk-core`, script `test` = `node --test tests/`); `.gitignore` with `node_modules/` and `lambda/config.json`. Run `npm install` in `lambda/`.
- [ ] **Step 2: Write failing tests** in `text.test.js`:
  - `normalizeName("  milch ")` → `"Milch"`; `normalizeName("   ")` → `""`; `normalizeName("Eier")` → `"Eier"`.
  - `formatAmount(0.5)` → `"0,5"`; `formatAmount(2)` → `"2"`.
  - `confirmation({amount: 2, spokenUnit: null, name: "Milch"})` → `"2 Milch hinzugefügt"`; with `amount: 2, spokenUnit: "Liter"` → `"2 Liter Milch hinzugefügt"`; `amount: 1` still says `"1 Milch hinzugefügt"`.
  - `errorSpeech` returns a non-empty German string for every kind, and none contains `"api"` or `"key"` (case-insensitive).
- [ ] **Step 3: Run** `cd lambda && npm test` — expect FAIL (module missing).
- [ ] **Step 4: Implement `text.js`** with the signatures above. Error texts: short, no technical details; `rate_limit` says to try again later, `not_configured` says the skill is not set up yet.
- [ ] **Step 5: Run** `npm test` — expect PASS.

### Task 2: Unit resolution

**Files:**
- Create: `lambda/units.js`
- Test: `lambda/tests/units.test.js`

**Interfaces:**
- Produces: `resolveUnit(slot: object|undefined): {kind: 'none'} | {kind: 'ok', unit: string, spoken: string} | {kind: 'unknown', heard: string}`
  - `slot` is the Alexa slot object (`{name, value, resolutions: {resolutionsPerAuthority: [...]}}`).
  - `ok.unit` = resolved value `id` (the short form), `ok.spoken` = resolved value `name`.

- [ ] **Step 1: Write failing tests:**
  - `undefined` slot and slot without `value` → `{kind: 'none'}`.
  - Slot `{value: "Gramm", resolutions: [{status: {code: "ER_SUCCESS_MATCH"}, values: [{value: {id: "g", name: "Gramm"}}]}]}` → `{kind: 'ok', unit: 'g', spoken: 'Gramm'}`.
  - Same with `ER_SUCCESS_NO_MATCH` and value `"Zentner"` → `{kind: 'unknown', heard: 'Zentner'}`.
  - Slot with a value but no resolutions block → `unknown`.
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement `resolveUnit`** in `units.js`; look through all `resolutionsPerAuthority` entries for the first `ER_SUCCESS_MATCH`.
- [ ] **Step 4: Run** — expect PASS.

### Task 3: Norish client and config

**Files:**
- Create: `lambda/norish.js`, `lambda/config.js`, `lambda/config.example.json`
- Test: `lambda/tests/norish.test.js`, `lambda/tests/config.test.js`

**Interfaces:**
- Produces:
  - `class NorishError extends Error { kind: 'auth'|'rate_limit'|'network'|'server'|'not_configured'|'invalid_response'; retryAfter?: number }`
  - `createNorishClient({baseUrl: string, apiKey: string, fetchImpl?: typeof fetch, timeoutMs?: number}): { addGrocery({name: string, amount: number, unit: string|null}): Promise<object[]> }`
  - `loadConfig(env?: object, filePath?: string): {baseUrl: string, apiKey: string}` — env vars win over file; throws `NorishError('not_configured')` if either value is missing.

- [ ] **Step 1: Write failing tests** with a fake `fetchImpl`:
  - Success: asserts one call to `https://norish.example.com/api/v1/groceries`, method `POST`, header `x-api-key`, `Content-Type: application/json`, body `{"name":"Milch","unit":"l","amount":2}`; returns the parsed array.
  - `baseUrl: "https://norish.example.com/"` (trailing slash) → URL has no double slash.
  - 401 and 403 → `kind 'auth'`; 429 with `Retry-After: 30` → `kind 'rate_limit'`, `retryAfter 30`; 500 → `'server'`; `fetchImpl` throws or aborts → `'network'`; 200 with `[]` or non-array → `'invalid_response'`.
  - Timeout: `fetchImpl` that never resolves with `timeoutMs: 20` → `'network'`.
  - Config: env values used; file used when env empty; neither → `not_configured`. Use temp files, placeholder values only.
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement** both modules. Timeout via `AbortController`. `config.example.json` holds placeholders.
- [ ] **Step 4: Run** — expect PASS.

### Task 4: Intent handlers

**Files:**
- Create: `lambda/handlers.js`, `lambda/index.js`
- Test: `lambda/tests/handlers.test.js`, `lambda/tests/helpers.js`

**Interfaces:**
- Consumes: `normalizeName`, `formatAmount`, `confirmation`, `errorSpeech` (Task 1); `resolveUnit` (Task 2); `NorishError`, `createNorishClient`, `loadConfig` (Task 3).
- Produces: `createHandlers({getClient: () => {addGrocery}}): RequestHandler[]` covering `LaunchRequest`, `AddItemIntent`, `AMAZON.HelpIntent`, `AMAZON.StopIntent`/`CancelIntent`/`NoIntent`, `SessionEndedRequest`; `errorHandler`. `index.js` wires them with `getClient = () => createNorishClient(loadConfig())`.
- `helpers.js`: `fakeInput({type, intent?: {name, slots}})` → handlerInput with `requestEnvelope` and a `responseBuilder` from `ResponseFactory.init()` (ask-sdk-core); slots are built like Alexa's (`{name, value, resolutions?}`).

AddItemIntent behaviour (in this order):
1. Article blank → elicit `artikel` (German prompt).
2. `menge` present and not a finite number > 0 → elicit `menge`. Absent → `1`.
3. `resolveUnit`: `unknown` → elicit `einheit` ("Die Einheit … kenne ich nicht" style prompt naming the heard word); `none` → `null`.
4. `client.addGrocery({name: normalizeName(artikel), amount, unit})`; on success speak `confirmation(...)` + a short "Sonst noch etwas?" with a reprompt, session stays open. On `NorishError` speak `errorSpeech(kind)` and end the session.

- [ ] **Step 1: Write failing tests** (fake client records calls):
  - Slots `menge 2`, `einheit` resolved `l`/`Liter`, `artikel milch` → one call `{name: "Milch", amount: 2, unit: "l"}`; speech contains `"2 Liter Milch hinzugefügt"`; session not ended.
  - Only `artikel` → call `{name: "Milch", amount: 1, unit: null}`.
  - `artikel "   "` → no call; response contains an ElicitSlot directive for `artikel`.
  - `menge "0"`, `"-3"`, `"?"` → no call; ElicitSlot for `menge`.
  - Unit `NO_MATCH` → no call; ElicitSlot for `einheit`.
  - `menge "0.5"` → call with `amount: 0.5`; speech contains `"0,5"`.
  - Client throws `NorishError('auth')`, `('rate_limit')`, `('network')` → speech equals `errorSpeech(kind)`, `shouldEndSession` true; a non-`NorishError` is rethrown to `errorHandler`, which speaks a generic German error.
  - `NoIntent` and `StopIntent` end the session; `LaunchRequest` and `HelpIntent` keep it open and give a usage example ("2 Liter Milch hinzufügen").
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement `handlers.js` and `index.js`.**
- [ ] **Step 4: Run** `npm test` — expect all PASS.

### Task 5: Interaction model and manifest

**Files:**
- Create: `skill-package/skill.json`, `skill-package/interactionModels/custom/de-DE.json`
- Test: `lambda/tests/model.test.js`

**Interfaces:**
- Consumes: slot names `menge`, `einheit`, `artikel` and intent name `AddItemIntent` (Task 4).

Model content: invocation name `norish`; intent `AddItemIntent` with slots `menge: AMAZON.NUMBER`, `einheit: EINHEIT`, `artikel: ARTIKEL`; `artikel` required with elicitation prompt (dialog model); samples covering: with amount+unit+article, with amount+article, article only, each with and without "zur Einkaufsliste", plus "{menge}x {artikel}"; built-in Help/Stop/Cancel/No intents. Slot type `EINHEIT` values (id → name + synonyms): `g` Gramm, `kg` Kilogramm (Kilo), `ml` Milliliter, `l` Liter, `EL` Esslöffel, `TL` Teelöffel, `Packung` Packung (Packungen, Päckchen), `Dose` Dose (Dosen), `Stück` Stück. Slot type `ARTIKEL`: 20–30 common German grocery items as samples (Milch, Eier, Butter, Mehl, Zucker, …). `skill.json` declares locale `de-DE`, a custom API and a private (non-public) distribution.

- [ ] **Step 1: Write failing test** `model.test.js` that loads the JSON and asserts: invocationName `norish`; every `{placeholder}` in every sample refers to a declared slot of that intent; `AddItemIntent` has all three slots with the right types; `artikel` is required with a prompt; `EINHEIT` ids equal exactly `["g","kg","ml","l","EL","TL","Packung","Dose","Stück"]`; Help/Stop/Cancel/No intents present; `skill.json` locale `de-DE`.
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Write both JSON files.**
- [ ] **Step 4: Run** `npm test` — expect PASS.

### Task 6: Smoke script, deployment docs

**Files:**
- Create: `scripts/smoke.js`, `README.md`

- [ ] **Step 1: Write `scripts/smoke.js`.** Reads `NORISH_URL` and `NORISH_API_KEY` from the environment and exits with a clear message if missing. Using `createNorishClient`: posts `{name: "Alexa-Smoke-Test", amount: 2, unit: null}` then `{..., amount: 1}` and checks the second response's `amount` is `3` (merge), then posts the same name with unit `"l"` and checks a different `id`. Cleans up by `DELETE /api/v1/groceries/{id}?version={version}` for every id it created. Prints PASS/FAIL per check.
- [ ] **Step 2: Run it** against the dev instance with the key provided in the shell environment: `NORISH_URL=… NORISH_API_KEY=… node scripts/smoke.js` — expect all checks PASS and the test items gone from the list. (The user supplied a dev instance and key for this in the conversation; never write them to a file.)
- [ ] **Step 3: Write `README.md`** (English or German, short): what the skill does and the invocation limits (needs the invocation name; plain "füge Milch zur Einkaufsliste hinzu" goes to Alexa's built-in list); creating the Amazon developer account; creating an Alexa-hosted Node.js skill in the developer console (language German, de-DE); pasting `skill-package/interactionModels/custom/de-DE.json` into the JSON editor and building the model; copying `lambda/*.js` and `package.json` into the console code editor and adding `config.json` (from `config.example.json`) there, then Deploy; creating the Norish API key (Settings → User → API keys); testing in the Test tab and on the Echo; rotating the key. Includes the fallback: if the hosted environment cannot read `config.json`, switch to a self-provisioned AWS Lambda with env vars `NORISH_URL`/`NORISH_API_KEY`.
- [ ] **Step 4: Run** `cd lambda && npm test` once more — expect all PASS.
