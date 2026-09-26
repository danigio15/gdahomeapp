/* Le note della release: cosa cambia in quella versione, e non le solite
 * cinque righe uguali per tutte. */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  COME_SI_PRENDE,
  DOVE_STA_IL_CHANGELOG,
  ilCapitolo,
  ilNumero,
  leNote,
  leNoteDelCambiario,
} from "../../strumenti/le-note-della-versione.mjs";

const RADICE = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const FINTO = `# Cosa cambia, giro per giro

Due righe di premessa che non sono di nessuna versione.

## 1.6.11

Quello che cambia nella undici.

Anche su due capoversi.

## 1.6.10

Quello che cambia nella dieci.

## 1.6.9

L'ultima, e finisce col file.
`;

test("la v davanti la mette l'etichetta, non il CHANGELOG", () => {
  assert.equal(ilNumero("v1.6.11"), "1.6.11");
  assert.equal(ilNumero(" 1.6.11 "), "1.6.11");
  assert.equal(ilNumero(""), "");
});

test("il capitolo e' quello della versione, e si ferma al prossimo", () => {
  assert.equal(
    ilCapitolo(FINTO, "1.6.11"),
    "Quello che cambia nella undici.\n\nAnche su due capoversi.",
  );
  assert.equal(ilCapitolo(FINTO, "v1.6.10"), "Quello che cambia nella dieci.");
  /* L'ultimo non ha un `##` dopo: finisce col file, e non si deve perdere. */
  assert.equal(ilCapitolo(FINTO, "1.6.9"), "L'ultima, e finisce col file.");
});

test("la premessa del CHANGELOG non finisce dentro nessuna versione", () => {
  for (const quale of ["1.6.11", "1.6.10", "1.6.9"]) {
    assert.ok(
      !ilCapitolo(FINTO, quale).includes("premessa"),
      "quelle righe non sono di nessuna versione",
    );
  }
});

test("una versione che nel CHANGELOG non c'e' si dice, non si tace", () => {
  /* Il punto di questo programma invece di tre righe di sed: `sed` tornerebbe
   * vuoto e la release nascerebbe senza niente dentro, e nessuno se ne
   * accorgerebbe finche' non la apre qualcuno. */
  assert.throws(() => ilCapitolo(FINTO, "1.7.0"), /non c'e' nessun capitolo «## 1.7.0»/);
  assert.throws(() => ilCapitolo(FINTO, ""), /di quale versione/);
  assert.throws(() => ilCapitolo("## 1.0.0\n\n", "1.0.0"), /e' vuoto/);
});

test("le note sono cosa cambia, e poi come si prende", () => {
  const note = leNote(FINTO, "1.6.11");
  assert.match(note, /^Quello che cambia nella undici\./);
  assert.ok(note.includes(COME_SI_PRENDE), "le righe su add-on e Play Store restano");
  assert.ok(
    note.indexOf("Quello che cambia") < note.indexOf("L'add-on si aggiorna"),
    "prima cosa e' cambiato, poi come si prende: chi apre la pagina cerca la prima",
  );
  /* Il pacchetto non si allega e non si linka: quello firmato da noi e quello
   * firmato da Google non si installano uno sopra l'altro. */
  assert.ok(!/\.apk|\.aab/.test(note), "nessun pacchetto nominato nelle note");
});

test("il CHANGELOG vero ha il capitolo della versione che stiamo per rilasciare", () => {
  /* Questa e' la prova che tiene il giro insieme: la versione che esce dal
   * manifesto deve avere il suo capitolo, se no l'etichetta si mette e la
   * release nasce vuota. */
  const manifesto = readFileSync(join(RADICE, "ponte", "config.yaml"), "utf8");
  const versione = (manifesto.match(/^version: "(.*)"$/m) || [])[1];
  assert.ok(versione, "in ponte/config.yaml c'e' una versione");
  const note = leNoteDelCambiario(versione, { radice: RADICE });
  assert.ok(note.length > COME_SI_PRENDE.length, `la ${versione} ha il suo capitolo nel CHANGELOG`);
  assert.ok(readFileSync(join(RADICE, DOVE_STA_IL_CHANGELOG), "utf8").includes(`## ${versione}`));
});
