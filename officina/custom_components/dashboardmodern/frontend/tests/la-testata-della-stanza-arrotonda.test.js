/* «Stanze: informazioni in alto, il testo non si adatta, si attacca tutto.»
 *
 * La testata scriveva lo stato grezzo del sensore — «24.03°» e «61.77%» — e
 * i due numeri si accavallavano nelle loro colonne. I gradi hanno un decimale
 * e la virgola, l'umidita' nessuno, come nel resto della plancia.
 */
import assert from "node:assert/strict";
import test from "node:test";

const memoria = new Map();
globalThis.localStorage = {
  getItem: (chiave) => (memoria.has(chiave) ? memoria.get(chiave) : null),
  setItem: (chiave, valore) => memoria.set(chiave, String(valore)),
  removeItem: (chiave) => memoria.delete(chiave),
};
globalThis.document = undefined;
const { letturaScritta } = await import("../src/sections/rooms-page-section.js");

test("i gradi con un decimale, l'umidita' senza", () => {
  assert.match(letturaScritta("24.03", "°"), /^24[,.]0°$/);
  assert.equal(letturaScritta("61.77", "%"), "62%");
});

test("quello che non e' un numero resta com'e', e il silenzio e' un trattino", () => {
  assert.equal(letturaScritta("alta", "%"), "alta%");
  assert.equal(letturaScritta("unavailable", "°"), "—");
  assert.equal(letturaScritta("", "°"), "—");
});
