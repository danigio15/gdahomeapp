/* Il taglio che non spezza un emoji.
 *
 * Sembra un dettaglio e non lo e': il limite si tocca davvero — quattromila
 * caratteri li scrive chi incolla un pezzo di configurazione — e quando lo si
 * tocca con `slice` il testo non si accorcia, si **rompe**. Mezza coppia
 * UTF-16, scritta come UTF-8, diventa il rombo col punto di domanda, e resta
 * scritta cosi' nell'archivio di chi risponde.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { tagliaBene } from "../src/testo.js";

/* Quello che compare quando mezza coppia viene scritta come UTF-8. */
const ROTTO = "�";

/* Scrivere un testo come UTF-8 e rileggerlo: e' quello che fa l'archivio, e
 * quello che fa uno schermo.
 *
 * Il JSON non basta a scoprire il difetto, e vale la pena saperlo: mezza
 * coppia dentro un JSON viene scappata — `\ud83d` — e torna indietro identica.
 * Sopravvive al viaggio, e si rompe all'arrivo: appena quel testo viene
 * scritto come UTF-8, dove va scritto per davvero, diventa il rombo. */
const comeUtf8 = (testo) => Buffer.from(testo, "utf8").toString("utf8");

test("quello che ci sta non lo tocca nessuno", () => {
  assert.equal(tagliaBene("ciao", 10), "ciao");
  assert.equal(tagliaBene("ciao", 4), "ciao");
  assert.equal(tagliaBene("", 4), "");
  assert.equal(tagliaBene(null, 4), "");
});

test("un emoji sul limite resta fuori intero", () => {
  /* Un emoji occupa due unita': con un tetto di 5 su «abcd🙏» ne entrerebbe
   * meta'. */
  const tagliato = tagliaBene("abcd🙏", 5);
  assert.equal(tagliato, "abcd");
  assert.ok(!comeUtf8(tagliato).includes(ROTTO));

  /* Con sei ci sta tutto. */
  assert.equal(tagliaBene("abcd🙏", 6), "abcd🙏");
});

test("`slice` invece lo spezzava, e questa e' la prova", () => {
  /* La riga che c'era prima, con lo stesso caso. Non e' una prova su di noi:
   * e' il promemoria di cosa si rompeva, cosi' se qualcuno rimette `slice` sa
   * cosa sta rimettendo. */
  const allaVecchia = "abcd🙏".slice(0, 5);
  assert.equal(allaVecchia.length, 5);
  assert.ok(comeUtf8(allaVecchia).includes(ROTTO), "mezza coppia doveva rompersi");
  /* E non si vede guardando il JSON, che la scappa e la riporta identica:
   * ecco perche' un difetto cosi' si scopre in archivio e non in rete. */
  assert.equal(JSON.parse(JSON.stringify(allaVecchia)), allaVecchia);
});

test("le giunture invisibili non si tagliano", () => {
  /* Una bandiera e' due lettere speciali; una famiglia e' quattro faccine
   * tenute insieme da tre giunture. Tagliare in mezzo non rompe niente — sono
   * caratteri veri — ma fa comparire pezzi che nessuno ha scritto: mezza
   * famiglia, o due lettere al posto di una bandiera. */
  const famiglia = "👨‍👩‍👧‍👦";
  /* Undici unita': con dieci non ci sta, e allora non ne passa un pezzo. */
  assert.equal(tagliaBene(famiglia, famiglia.length - 1), "");
  assert.equal(tagliaBene(famiglia, famiglia.length), famiglia);

  const bandiera = "🇮🇹";
  assert.equal(tagliaBene(`ok ${bandiera}`, 4), "ok ");
  assert.equal(tagliaBene(`ok ${bandiera}`, 3 + bandiera.length), `ok ${bandiera}`);
});

test("un pollice col colore della pelle non cambia colore per strada", () => {
  /* `👍🏽` e' il pollice piu' il tono: tagliare in mezzo lascerebbe il pollice
   * giallo, che non e' quello che la persona ha scritto. */
  const pollice = "👍🏽";
  assert.equal(tagliaBene(`bravo ${pollice}`, 6 + 2), "bravo ");
  assert.equal(tagliaBene(`bravo ${pollice}`, 6 + pollice.length), `bravo ${pollice}`);
});

test("quattromila caratteri di emoji non sfondano il tetto", () => {
  const tanti = "🙏".repeat(3000);
  const tagliato = tagliaBene(tanti, 4000);
  assert.ok(tagliato.length <= 4000);
  /* E non uno in meno del possibile: 4000 unita' sono 2000 emoji esatti. */
  assert.equal(tagliato.length, 4000);
  assert.ok(!comeUtf8(tagliato).includes(ROTTO));
});
