/* L'orologio del codice di abbinamento dice le ore.
 *
 * Il codice e' passato da un quarto d'ora a **un giorno** — il perche' sta in
 * cima a `src/chiavi.js` — e l'orologio della console e' rimasto quello di
 * prima: minuti e secondi, e basta. Cosi' un codice appena fatto si presentava
 * come
 *
 *     scade fra 1439:59
 *
 * che e' giusto e non si legge: per sapere se si fa in tempo ad arrivare dal
 * cliente bisogna dividere per sessanta. Nessuna prova se n'era accorta perche'
 * il conto era giusto; sbagliato era il modo di scriverlo.
 *
 * Il programma di quella pagina sta dentro un `<script>` e nessuno lo importa:
 * si prende la funzione dal file e la si compila, come fa `si-legge.test.js`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const PAGINA = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");

/** La funzione della pagina, presa dal file e compilata per davvero. */
function quantoResta() {
  const scritta = /\n {6}function quantoResta\(secondi\) \{[\s\S]*?\n {6}\}/.exec(PAGINA);
  assert.ok(scritta, "«quantoResta» non sta piu' nella console: l'orologio e' cambiato posto");
  return new Function(`${scritta[0]}; return quantoResta;`)();
}

test("un codice appena fatto dice le ore, non millequattrocento minuti", () => {
  const quanto = quantoResta();
  assert.equal(quanto(24 * 60 * 60), "24:00:00");
  assert.equal(quanto(23 * 60 * 60 + 59 * 60 + 59), "23:59:59");
  assert.equal(quanto(60 * 60), "1:00:00");
});

test("sotto l'ora restano minuti e secondi, che e' quello che serve li'", () => {
  const quanto = quantoResta();
  assert.equal(quanto(59 * 60 + 59), "59:59");
  assert.equal(quanto(61), "01:01");
  assert.equal(quanto(9), "00:09");
});

test("e quando e' finito lo dice con una parola", () => {
  const quanto = quantoResta();
  assert.equal(quanto(0), "scaduto");
  assert.equal(quanto(-3), "scaduto");
});
