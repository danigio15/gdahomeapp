/* Le frasi che cambiano col numero, e che col numero devono concordare.
 *
 * `plurale()` fa concordare **la parola che conta** — «1 impianto», «3
 * impianti» — e non la frase intorno. Il resto della riga resta scritto una
 * volta sola, e quasi sempre va bene; ma dove la frase parla di quella cosa —
 * «che li guardi», «i loro rapporti» — con uno solo diventa sgrammaticata, e
 * si legge come un guasto anche quando non lo e'.
 *
 * E' successo davvero: tolto l'unico installatore, la gestione diceva
 *
 *     1 impianto senza piu' nessuno che li guardi.
 *     Sono impianti di installatori che hai tolto: continuano a mandare le
 *     loro rapporti…
 *
 * Tre concordanze sbagliate in due righe — e un «le rapporti» che fa dubitare
 * di tutto il resto della pagina.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const qua = (...pezzi) => readFileSync(join(QUI, "..", ...pezzi), "utf8");
const PAGINE = [
  ["console/index.html", qua("console", "index.html")],
  ["gestore/index.html", qua("gestore", "index.html")],
];

test("«rapporto» è maschile in tutte e due le pagine", () => {
  /* Il nome ha cambiato genere strada facendo, e in giro erano rimasti dei
   * femminili: «la rapporto», «le loro rapporti», «una rapporto». */
  for (const [quale, pagina] of PAGINE) {
    for (const storta of [
      /\bla rapporto\b/i,
      /\ble rapporti\b/i,
      /\ble loro rapporti\b/i,
      /\ble sue rapporti\b/i,
      /\buna rapporto\b/i,
      /\bquesta rapporto\b/i,
      /\brapporta\b/i,
    ]) {
      assert.ok(!storta.test(pagina), `«${quale}» ha ancora ${storta} — «rapporto» è maschile`);
    }
  }
});

test("l'avviso degli impianti rimasti soli concorda col loro numero", () => {
  /* Con uno solo la frase va al singolare tutta quanta, non solo il nome. */
  const pagina = qua("gestore", "index.html");
  assert.match(pagina, /ORFANE === 1 \? "lo guardi" : "li guardi"/);
  assert.match(pagina, /È l'impianto di un installatore che hai tolto/);
  assert.match(pagina, /Sono impianti di installatori che hai tolto/);
});

test("l'avviso non promette che un installatore riaggiunto si riprenda i suoi impianti", () => {
  /* Provato, e non succede: `Installatori.fai` da' una matricola nuova ogni
   * volta, e la casa punta ancora a quella di prima. La riga lo diceva, e una
   * pagina che promette una cosa che non fa e' peggio di una che non dice
   * niente — chi la legge aspetta un giorno che non arriva. */
  const pagina = qua("gestore", "index.html");
  assert.ok(
    !/tornano? a qualcuno il giorno che/.test(pagina),
    "la pagina promette di nuovo che gli impianti rimasti soli tornino da soli",
  );
  assert.match(pagina, /prende una matricola nuova/);
});
