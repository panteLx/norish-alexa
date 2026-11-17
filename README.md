# Norish Alexa Skill

Privater deutscher Alexa-Skill: Artikel mit optionaler Menge und Einheit zur Einkaufsliste einer selbst gehosteten [Norish](https://github.com/norish-recipes/norish)-Instanz hinzufügen.

- „Alexa, öffne Norish“ → „2 Liter Milch hinzufügen“
- „Alexa, sag Norish, füge Eier hinzu“

**Einschränkung:** Der Skill wird nur über seinen Aufrufnamen angesprochen. Sätze mit „Einkaufsliste“ („füge Milch zur Einkaufsliste hinzu“) fängt Alexas eingebaute Liste ab.

Mengen werden von Norish addiert, wenn Name **und** Einheit übereinstimmen. Einheiten werden als Kurzform gespeichert: `g`, `kg`, `ml`, `l`, `EL`, `TL`, `Packung`, `Dose`, `Stück`.

## Aufbau

```
lambda/                                  Skill-Code (Node.js 16), Tests in lambda/tests
skill-package/interactionModels/custom/  Interaktionsmodell (de-DE)
scripts/smoke.js                         Live-Check gegen eine echte Norish-Instanz
scripts/deploy-hosted.sh                 Kopiert den Stand in den Amazon-Klon und pusht
docs/superpowers/                        Entwurf und Umsetzungsplan
```

Das Manifest (`skill.json`) liegt bewusst **nicht** in diesem Repo. Bei Alexa-hosted Skills verwaltet Amazon es selbst, ein eigenes überschreibt den Endpoint und trennt den Skill vom gehosteten Lambda.

## Einrichtung

1. **Norish-API-Key** unter Einstellungen → Benutzer → API-Schlüssel erzeugen.
2. **Skill anlegen:** In der Alexa Developer Console (kostenloses Developer-Konto) „Create Skill“ → Deutsch (DE), Custom, Hosting „Alexa-hosted (Node.js)“. Aufrufname im Tab Build: `norish`.
3. **Amazon-Klon holen** (einmalig, neben diesem Repo): `ask configure` (AWS-Verknüpfung mit „No“ beantworten), dann `ask init --hosted-skill-id <Skill-ID>`, Ordnername z. B. `norish-alexa-hosted`.
4. **Zugangsdaten:** Im Klon `lambda/config.json` anlegen (Vorlage: `lambda/config.example.json`) mit `baseUrl` (nur die Domain) und `apiKey`. Die Datei bleibt im Amazon-Repo und kommt nie nach GitHub (`.gitignore`).
5. **Deployen:** `scripts/deploy-hosted.sh ../norish-alexa-hosted --push`. Das kopiert `lambda/` und das Modell, lässt `config.json` und das Manifest unberührt und pusht. Danach im Build-Tab prüfen, dass das Modell gebaut wurde (sonst „Build Model“).
6. **Testen:** Im Test-Tab (Entwicklung aktivieren) `öffne norish`, dann `füge 2 Liter Milch hinzu`.

Die Runtime ist Node 16 und hat kein globales `fetch`, der Client nutzt dann `https`. Der Konsolen-Editor prüft mit einem älteren Parser, deshalb im Lambda-Code kein `??`, `?.` oder `catch {`.

## Entwicklung

```sh
cd lambda && npm install && npm test
NORISH_URL=https://norish.example.com NORISH_API_KEY=... node scripts/smoke.js   # räumt hinterher auf
```

Den API-Key bei Bedarf in Norish neu erzeugen. Er liegt nur in `config.json` im Amazon-Klon bzw. in Umgebungsvariablen.
