# Norish Alexa Skill – Design

> **Hinweis (Stand der Umsetzung):** Dieses Dokument ist der ursprüngliche Entwurf. Die Umsetzung weicht ab: Node 16 statt 18 (https-Fallback statt `fetch`), kein eigenes `skill.json` (Amazon verwaltet das Manifest), Aufrufname `rezept liste`, Deployment über einen Amazon-Klon. Maßgeblich ist die README.

## Ziel und Hintergrund

Der Nutzer betreibt eine selbst gehostete Norish-Instanz (Rezepte-App, über eigene Domain mit HTTPS erreichbar). Er möchte per Sprache Artikel auf die Norish-Einkaufsliste setzen, ohne die App zu öffnen, z. B. in der Küche beim Kochen.

Beispiele (Originalton des Nutzers):

- „Alexa, öffne Norish und füge 2x Milch zur Einkaufsliste hinzu“
- „Alexa, füge Milch zur Einkaufsliste hinzu“ (siehe Einschränkung unten)

Die Artikel landen samt Stückzahl – und optional Einheit – in der Norish-Einkaufsliste.

## Ziele

- Artikel per Sprache zur Norish-Einkaufsliste hinzufügen.
- Menge ist optional (Standard: 1).
- Einheit ist optional (Standard: keine), z. B. „500 Gramm Mehl“, „2 Liter Milch“.
- Alexa bestätigt kurz, was hinzugefügt wurde (z. B. „2 Milch hinzugefügt“).
- Deutsch (de-DE).
- Skill bleibt privat (Entwicklungsmodus, Konto des Nutzers).

## Nicht-Ziele

- Abhaken, Vorlesen, Löschen von Einträgen.
- Mehrere Nutzer, Account-Linking, Veröffentlichung im Skill-Store.
- Andere Sprachen als Deutsch.

## Anti-Ziele

- API-Key oder Norish-URL im Repository oder im Skill-Code festschreiben.
- Ein Skill, der bei unklarem Satz Unsinn auf die Liste schreibt (lieber nachfragen).

## Rahmenbedingungen und Entscheidungen

- **Aufruf:** Ein eigener Skill wird nur über den Aufrufnamen angesprochen („öffne Norish …“, „sag Norish, füge … hinzu“). Der Satz „Alexa, füge Milch zur Einkaufsliste hinzu“ ohne Aufrufnamen wird von Alexas eingebauter Einkaufsliste abgefangen und ist per Skill nicht umleitbar. Der Nutzer wurde darauf hingewiesen. Aufrufname: „norish“ (Annahme des Assistenten).
- **Plattform:** Alexa-hosted Skill (kostenlos, Alexa Developer Console), Node.js mit dem offiziellen Alexa Skills Kit SDK (Wahl des Assistenten, Nutzer überlässt die Sprache). Nutzer hat noch kein Amazon-Developer-Konto und legt es selbst an.
- **Code im Repo:** Backend-Code und Interaktionsmodell liegen versioniert im Repo; Übertragung in die Alexa-hosted Umgebung per `ask-cli` oder manuell.
- **Konfiguration:** Norish-Basis-URL und API-Key als Umgebungsvariablen in der Alexa-hosted Umgebung, nie im Repo.

## Norish-API (laut docs.norish.dev/reference/api, Version 0.26.1-beta)

- Basis: `https://<norish-domain>/api/v1`
- Auth: API-Key (Norish: Einstellungen → Benutzer → API-Schlüssel), Header `x-api-key: <key>` oder `Authorization: Bearer <key>`. Limit 500 Anfragen/Stunde.
- Hinzufügen: `POST /groceries`, Body `{ "name": string|null, "unit": string|null, "amount": number|null }` (alle drei Pflichtfelder, Werte dürfen `null` sein), optional `isDone`, `storeId`. Antwort: Array von Grocery-Objekten (ein Eintrag pro erkanntem Lebensmittel; „zout en peper“ wird zu zwei Einträgen).
- Laut Doku addiert ein bereits vorhandener Name auf den bestehenden Eintrag.

## Ablauf

1. Nutzer spricht den Skill an und nennt Artikel, optional Menge und Einheit.
2. Der Intent „Artikel hinzufügen“ liefert die Slots `menge` (Zahl, optional), `einheit` (optional), `artikel` (Freitext, Pflicht).
3. Backend ruft `POST /groceries` mit `name = artikel`, `amount = menge ?? 1`, `unit = einheit ?? null`.
4. Alexa bestätigt kurz („2 Liter Milch hinzugefügt“). Bei Fehlern (Norish nicht erreichbar, Key ungültig, 429) gibt es eine verständliche deutsche Fehlermeldung, ohne technische Details vorzulesen.
5. Fehlt der Artikel, fragt Alexa nach.

## Offene Punkte (beim Bauen gegen die echte Instanz klären)

- **Einheiten-Strings (getestet am 2026-11-17 gegen die Dev-Instanz):** `unit` ist Freitext und wird unverändert gespeichert. „g“ und „Gramm“ werden nicht zusammengeführt. Der Skill muss daher jede gesprochene Einheit auf genau eine feste Schreibweise abbilden (Vorschlag: `g`, `kg`, `ml`, `l`, `EL`, `TL`, `Packung`, `Dose`, `Stück`; Alexa-Slot-Werte mit Synonymen wie „Gramm“). Entscheidung des Nutzers: Kurzformen in Norish.
- **Addieren (getestet):** Bei gleichem Namen **und** gleicher Einheit (auch beide leer) werden Mengen addiert (2 + 1 Milch = 3). Bei abweichender Einheit entsteht ein eigener Eintrag (3 Milch + 1 Liter Milch).
- **Löschen/Korrigieren:** Die Doku nennt keinen Endpunkt zum Ändern von Name, Unit oder Amount. Bei Versprechern bleibt der Eintrag also bis zum manuellen Löschen in Norish.
- **Mehrere Artikel in einem Satz** („Milch und Eier“): `POST /groceries` splittet Namen ggf. selbst; ob das Alexa-Slot-Parsing das mitmacht, ist offen. Zunächst nicht zugesagt.

## Entscheidungen des Assistenten (vom Nutzer nicht explizit besprochen)

- **Slot-Typen:** `menge` = `AMAZON.NUMBER`, `einheit` = eigener Slot-Typ mit den üblichen Einheiten, `artikel` = eigener Slot-Typ mit Beispielwerten (Alexa erzwingt bei Custom-Slots keine feste Werteliste). Funktioniert das Parsen von „2 Liter Milch“ in einem Satz nicht zuverlässig, ist der Fallback eine Rückfrage pro fehlendem Slot (Dialog).
- **Konfiguration unter Alexa-hosted:** Nach meinem Kenntnisstand bietet Alexa-hosted keine Umgebungsvariablen in der Konsole. Norish-URL und API-Key kommen deshalb in eine Konfigurationsdatei, die in `.gitignore` steht und nur in die Alexa-hosted Umgebung hochgeladen wird (nicht ins GitHub-Repo). Beim Bauen prüfen; geht das nicht, ist Plan B ein eigenes AWS Lambda.
- **Rückfragen:** Alexa fragt nur nach, wenn der Artikel fehlt oder die Menge ≤ 0 ist. Eine unbekannte Einheit wird nicht stillschweigend verworfen, sondern Alexa fragt nach.
- **Bestätigung:** Alexa wiederholt, was der Nutzer gesagt hat (nicht die Antwort der API), damit Verhörer sofort auffallen. Eine leere oder fehlgeschlagene API-Antwort wird als Fehler gesprochen.
- **Namensnormalisierung:** Name wird getrimmt und mit großem Anfangsbuchstaben gesendet; sonst unverändert.

## Dem Builder überlassen

Projektstruktur, Tests, Beispiel-Äußerungen (Utterances), genaue Bestätigungs- und Fehlertexte, Zuordnungstabelle der Einheiten, Deployment-Skript.
