/* «Ho creato una plancia e mi da' errore 401.»
 *
 * Il tasto «Apri» della console apriva l'indirizzo dell'ingress in una scheda
 * nuova: nell'app di Home Assistant sul telefono una scheda nuova e' il
 * browser, senza la sessione dell'ingress, e Home Assistant risponde 401.
 * Adesso «Apri» va alla voce della plancia fra le «Plance» di Home Assistant,
 * nella stessa finestra: e' la voce che la sessione se la chiede da se'. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DAVANTI } from "../src/plance-in-casa.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const console_ = readFileSync(join(QUI, "..", "console", "console.js"), "utf8");

test("«Apri» porta alla voce di Home Assistant, nella stessa finestra", () => {
  const pezzo = console_.slice(
    console_.indexOf('due("Apri", "Open")') - 200,
    console_.indexOf('due("Apri", "Open")') + 300,
  );
  assert.match(pezzo, /apri\.target = "_top"/);
  assert.doesNotMatch(pezzo, /_blank/);
  assert.match(
    pezzo,
    new RegExp(`apri\\.href = "/${DAVANTI}" \\+ encodeURIComponent\\(una\\.profilo\\)`),
  );
  // Non l'indirizzo dell'ingress, che fuori dalla pagina di Home Assistant non ha sessione.
  assert.doesNotMatch(pezzo, /apri\.href = una\.primaria \? "plancia\/"/);
});
