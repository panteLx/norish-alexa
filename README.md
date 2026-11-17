# Norish Alexa Skill

Privater deutscher Alexa-Skill: Artikel mit optionaler Menge und Einheit zur Einkaufsliste einer selbst gehosteten [Norish](https://github.com/norish-recipes/norish)-Instanz hinzufügen.

- „Alexa, öffne Norish“ → „2 Liter Milch hinzufügen“
- „Alexa, sag Norish, füge Eier hinzu“

**Einschränkung:** Der Skill wird nur über seinen Aufrufnamen angesprochen. „Alexa, füge Milch zur Einkaufsliste hinzu“ ohne „Norish“ landet in Alexas eingebauter Einkaufsliste.

Mengen werden von Norish addiert, wenn Name **und** Einheit übereinstimmen. Einheiten werden als Kurzform gespeichert: `g`, `kg`, `ml`, `l`, `EL`, `TL`, `Packung`, `Dose`, `Stück`.

## Einrichtung

1. **Norish-API-Key:** In Norish unter Einstellungen → Benutzer → API-Schlüssel einen Key erzeugen.
2. **Amazon-Developer-Konto** (kostenlos) auf developer.amazon.com anlegen, mit demselben Amazon-Konto wie dein Echo.
3. **Skill anlegen:** In der Alexa Developer Console „Create Skill“ → Name „Norish“, Sprache Deutsch (DE), Typ „Custom“, Hosting „Alexa-hosted (Node.js)“.
4. **Interaktionsmodell:** Build → Interaction Model → JSON Editor, Inhalt von `skill-package/interactionModels/custom/de-DE.json` einfügen, „Save“ und „Build Model“.
5. **Code:** Im Tab „Code“ den Inhalt von `lambda/` kopieren (`index.js`, `handlers.js`, `norish.js`, `config.js`, `units.js`, `text.js`) und die Abhängigkeit `ask-sdk-core` in `package.json` belassen.
6. **Zugangsdaten:** Im Code-Editor eine Datei `config.json` anlegen (Vorlage: `lambda/config.example.json`) mit `baseUrl` (nur die Domain, z. B. `https://norish.example.com`) und `apiKey`. Die Datei steht in `.gitignore` und gehört nicht ins Repo. „Deploy“.
7. **Testen:** Im Tab „Test“ (Entwicklung aktivieren) `öffne norish` und `füge 2 Liter Milch hinzu`, danach auf dem Echo.

Der Code braucht Node.js ≥ 18 (globales `fetch`); beim Anlegen des Alexa-hosted Skills die Region EU (Irland) wählen und die Node-Version prüfen.

Falls die gehostete Umgebung `config.json` nicht lesen kann: auf ein selbst bereitgestelltes AWS Lambda wechseln und `NORISH_URL` / `NORISH_API_KEY` als Umgebungsvariablen setzen.

## Entwicklung

```sh
cd lambda && npm install && npm test
NORISH_URL=https://norish.example.com NORISH_API_KEY=... node scripts/smoke.js   # live check, cleans up after itself
```

Den API-Key bei Bedarf in Norish neu erzeugen; er liegt nur in `config.json` bzw. den Umgebungsvariablen.
