/* «Ora clicco per dire che l'ho presa» — e il widget dice ancora che c'è posta.
 *
 * Segnalato con due fotografie una accanto all'altra, che è il modo più chiaro
 * in cui una cosa del genere si vede: nella sezione la riga passa a **VUOTA**,
 * e nella stessa casa, nello stesso momento, la tessera della Home continua a
 * dire «1 · C'è posta in cassetta».
 *
 * La causa: la tessera si rifaceva le letture per conto suo, con due parti su
 * quattro. Le altre due sono le memorie — quando si è detto «l'ho presa»
 * (#536), e quando la posta è stata vista arrivare (#564) — e senza quelle la
 * tessera non poteva sapere niente di nessuno dei due gesti.
 *
 * Due letture dello stesso fatto, e una sola sapeva la verità: è lo stesso
 * errore del cartello della Sicurezza (#547) e dei carichi dell'Energia. La
 * correzione è sempre la stessa: non due letture, una sola — e a farla è chi
 * ha quelle memorie in mano.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CHIAVE_ARRIVO_VISTO,
  CHIAVE_CITOFONO,
  CHIAVE_RITIRO_A_MANO,
  lettureDellIngresso,
  riassuntoDellIngresso,
} from "../src/core/citofono-e-posta.js";

const TESSERE = readFileSync(
  new URL("../src/sections/home-widgets-section.js", import.meta.url),
  "utf8",
);

/* Il minimo perché la tessera possa lavorare fuori da un browser: un disco
 * dove tenere la configurazione e le due memorie. */
class DiscoFinto {
  valori = new Map();
  getItem(chiave) {
    return this.valori.has(chiave) ? this.valori.get(chiave) : null;
  }
  setItem(chiave, valore) {
    this.valori.set(chiave, String(valore));
  }
  removeItem(chiave) {
    this.valori.delete(chiave);
  }
}
const disco = new DiscoFinto();
globalThis.localStorage = disco;

const { citofonoModel } = await import("../src/sections/home-widgets-section.js");
const SEZIONE = readFileSync(
  new URL("../src/sections/citofono-section.js", import.meta.url),
  "utf8",
);

const ORA = Date.parse("2026-09-16T18:37:00Z");
const quandoFa = (minuti) => new Date(ORA - minuti * 60000).toISOString();

/* La casa di chi ha segnalato: un Vallhorn, quindi un PIR che dice se c'è
 * posta e un sensore di luce che dice quando la cassetta è stata aperta. */
const CASA = {
  cassette: [{ id: "c1", nome: "PIR Posta", posta: "binary_sensor.pir_posta" }],
};
const ARRIVATA = { "binary_sensor.pir_posta": { state: "on", last_changed: quandoFa(1) } };

test("col «l'ho presa» la cassetta è vuota, e lo sono tutte e due le letture", () => {
  /* Prima del tocco: c'è posta, e le due letture concordano. */
  const prima = lettureDellIngresso(CASA, ARRIVATA, {}, {});
  assert.equal(prima.cassette[0].ce, true);
  assert.equal(riassuntoDellIngresso(prima).conPosta, 1);

  /* Dopo: «l'ho presa», segnato un minuto fa — dopo l'arrivo. */
  const ritirata = { c1: ORA - 30_000 };
  const dopo = lettureDellIngresso(CASA, ARRIVATA, ritirata, {});
  assert.equal(dopo.cassette[0].ce, false, "la riga della sezione dice vuota");
  assert.equal(dopo.cassette[0].ritiroAMano, true);
  /* Ed è questa la riga che la tessera della Home scriveva sbagliata: il suo
   * numero grande e la sua didascalia vengono da qui. */
  assert.equal(riassuntoDellIngresso(dopo).conPosta, 0, "e la tessera pure");
});

test("senza le memorie la lettura non può sapere del tocco: erano quelle a mancare", () => {
  /* La chiamata che la tessera faceva — due parti su quattro — sulla stessa
   * casa e con lo stesso «l'ho presa» già scritto sul disco. */
  const cieca = lettureDellIngresso(CASA, ARRIVATA);
  assert.equal(cieca.cassette[0].ce, true);
  assert.equal(riassuntoDellIngresso(cieca).conPosta, 1);
  /* È esattamente la fotografia: sezione vuota, tessera «1 · C'è posta in
   * cassetta». Il difetto non era nel conto, era in cosa gli si dava da
   * contare. */
});

test("la tessera della Home chiede le letture alla sezione, non se le rifà", () => {
  /* La correzione, e la cosa da non lasciarsi riprendere: una lettura sola, e a
   * farla è chi ha le due memorie in mano. */
  assert.match(TESSERE, /const letture = ingressoInPlancia\(states\);/);
  assert.match(TESSERE, /import \{ ingressoInPlancia \} from "\.\/citofono-section\.js";/);
  /* E non se le rifà più: la chiamata cieca non deve tornare. */
  const tessera = TESSERE.slice(
    TESSERE.indexOf("function citofonoModel(states)"),
    TESSERE.indexOf("/* Le stampanti:"),
  );
  assert.ok(tessera, "citofonoModel non si trova più dove questa prova lo cerca");
  /* I commenti si tolgono prima di guardare: lì dentro la chiamata di prima si
   * NOMINA apposta, per spiegare cosa è stato tolto e perché. */
  const codice = tessera.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(codice, /lettureDellIngresso\(/);
});

test("le memorie hanno un padrone solo, e le legge chi fa la lettura", () => {
  /* Tre chiavi, tre cose diverse: la configurazione, il «l'ho presa» e
   * l'arrivo visto. Le ultime due le legge la sezione e le passa alla lettura;
   * se la tessera se le rileggesse per conto suo saremmo daccapo, con due
   * padroni per la stessa memoria. */
  assert.equal(CHIAVE_CITOFONO, "cd_citofono");
  assert.equal(CHIAVE_RITIRO_A_MANO, "cd_posta_ritirata");
  assert.equal(CHIAVE_ARRIVO_VISTO, "cd_posta_arrivata");
  assert.match(SEZIONE, /lettureDellIngresso\(conf, states, ritiriAMano\(\), arriviVisti\(\)\)/);
  for (const chiave of ["CHIAVE_RITIRO_A_MANO", "CHIAVE_ARRIVO_VISTO"])
    assert.doesNotMatch(TESSERE, new RegExp(chiave), `${chiave}: la legge la sezione`);
});

test("la tessera e la sezione dicono la stessa cosa, lo stesso minuto", () => {
  /* È la fotografia della segnalazione, rifatta qui: la stessa casa, lo stesso
   * momento, le due letture una accanto all'altra. */
  disco.valori.clear();
  disco.setItem(CHIAVE_CITOFONO, JSON.stringify(CASA));

  /* Prima del tocco: c'è posta, e le due concordano. */
  assert.equal(citofonoModel(ARRIVATA).value, "1");
  assert.equal(lettureDellIngresso(CASA, ARRIVATA, {}, {}).cassette[0].ce, true);

  /* «Ora clicco per dire che l'ho presa»: è quello che scrive il tasto. */
  disco.setItem(CHIAVE_RITIRO_A_MANO, JSON.stringify({ c1: ORA - 30_000 }));

  /* La sezione dice vuota... */
  const sezione = lettureDellIngresso(
    CASA,
    ARRIVATA,
    JSON.parse(disco.getItem(CHIAVE_RITIRO_A_MANO)),
    {},
  );
  assert.equal(sezione.cassette[0].ce, false);
  /* ...e adesso la tessera pure. Prima diceva ancora «1 · C'è posta in
   * cassetta», ed è tutta la segnalazione. */
  const tessera = citofonoModel(ARRIVATA);
  assert.equal(tessera.value, "0");
  assert.notEqual(tessera.caption, "C'è posta in cassetta");
  assert.equal(tessera.rows[0].value, "Vuota");
});
