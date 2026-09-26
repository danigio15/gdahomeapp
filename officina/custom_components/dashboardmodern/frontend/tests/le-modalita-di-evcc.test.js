/* Le modalita' di ricarica di evcc, dopo che evcc le ha rifatte.
 *
 * «Ha cambiato la funzionalità sulle modalità di ricarica: ora si chiama
 * intelligente e poi ha messo always.»
 *
 * `pv` e' diventato `smart`, `minpv` e' sparito, e il guscio accendeva il tasto
 * cercando `m-btn-<stato>`: da quel giorno non si e' acceso piu' niente, mentre
 * il comando partiva lo stesso. Qui si tiene fermo il giudizio — quali tasti si
 * disegnano e quale si accende — che e' l'unica parte che si puo' sbagliare in
 * silenzio.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  MODI_STORICI,
  eIlModoIntelligente,
  iModiDiEvcc,
  ilModoAcceso,
} from "../src/core/le-modalita-di-evcc.js";

/* Un evcc di oggi: tre modalita', e `smart` al posto di `pv`. */
const OGGI = {
  state: "smart",
  attributes: { options: ["off", "smart", "now"] },
};

/* Un evcc di ieri, che non e' stato aggiornato. */
const IERI = {
  state: "pv",
  attributes: { options: ["off", "pv", "minpv", "now"] },
};

const idDi = (stato) => iModiDiEvcc(stato).map((modo) => modo.id);

/* ── quali tasti si disegnano ────────────────────────────────────────────── */

test("i tasti sono quelli che l'entita' dichiara, non quattro scritti a mano", () => {
  assert.deepEqual(idDi(OGGI), ["off", "smart", "now"]);
  assert.deepEqual(idDi(IERI), ["off", "pv", "minpv", "now"]);
});

test("e chi non dichiara niente si tiene i quattro di prima", () => {
  /* Un evcc vecchio, o un template scritto a mano che le `options` non le
   * pubblica: senza saperne abbastanza non si toglie un tasto a nessuno. */
  assert.deepEqual(idDi({ state: "pv" }), [...MODI_STORICI]);
  assert.deepEqual(idDi({ state: "pv", attributes: { options: [] } }), [...MODI_STORICI]);
  assert.deepEqual(idDi(), [...MODI_STORICI]);
});

test("«smart» si chiama Intelligente, e «pv» resta Solar", () => {
  /* La parola segue quello che l'entita' dice davvero: chi ha evcc nuovo legge
   * il nome nuovo, chi ha il vecchio legge quello di sempre. */
  const oggi = iModiDiEvcc(OGGI).find((modo) => modo.id === "smart");
  assert.equal(oggi.it, "Intelligente");
  assert.equal(oggi.en, "Smart");
  const ieri = iModiDiEvcc(IERI).find((modo) => modo.id === "pv");
  assert.equal(ieri.it, "Solar");
});

test("una modalita' che non conosciamo si disegna lo stesso, col nome che ha", () => {
  /* evcc i nomi li ha gia' cambiati una volta. Un tasto che non sappiamo
   * battezzare e' meglio di una modalita' che evcc offre e noi nascondiamo:
   * nascosta, quella modalita' non si puo' scegliere da nessuna parte. */
  const domani = { state: "off", attributes: { options: ["off", "smart", "turbo"] } };
  const nuovo = iModiDiEvcc(domani).find((modo) => modo.id === "turbo");
  assert.ok(nuovo);
  assert.equal(nuovo.it, "turbo");
  assert.equal(nuovo.ignoto, true);
  assert.equal(iModiDiEvcc(OGGI)[0].ignoto, false);
});

/* ── quale tasto si accende ──────────────────────────────────────────────── */

test("il caso della segnalazione: «smart» accende il suo tasto", () => {
  assert.equal(ilModoAcceso(OGGI), "smart");
});

test("e un guscio col tasto vecchio capisce lo stesso un evcc nuovo", () => {
  /* E' il passaggio: i tasti disegnati sono ancora i quattro storici perche'
   * l'entita' non dichiara le options, ma evcc risponde gia' `smart`. Senza
   * questa equivalenza il tasto resterebbe spento — che e' esattamente il
   * difetto da cui si e' partiti. */
  assert.equal(ilModoAcceso({ state: "smart" }), "pv");
  /* E al contrario: tasti nuovi, evcc vecchio. */
  assert.equal(ilModoAcceso({ state: "pv", attributes: { options: ["off", "smart", "now"] } }), "smart");
});

test("uno stato che nessun tasto rappresenta non ne accende nessuno", () => {
  /* Accendere quello sbagliato direbbe che la macchina carica in un modo in cui
   * non sta caricando. */
  assert.equal(ilModoAcceso({ state: "minpv", attributes: { options: ["off", "smart", "now"] } }), "");
  assert.equal(ilModoAcceso({ state: "boh", attributes: { options: ["off", "smart", "now"] } }), "");
});

test("e un'entita' muta nemmeno", () => {
  for (const muto of ["unavailable", "unknown", "—", "", null, undefined])
    assert.equal(ilModoAcceso({ state: muto }), "", `«${String(muto)}» non e' una modalita'`);
  assert.equal(ilModoAcceso(), "");
});

test("le maiuscole non contano: lo stato arriva come lo scrive l'integrazione", () => {
  assert.equal(ilModoAcceso({ state: "SMART", attributes: { options: ["off", "smart", "now"] } }), "smart");
});

/* ── dove sta l'opzione «always» ─────────────────────────────────────────── */

test("«always» si affianca solo alla modalita' intelligente", () => {
  /* «Da sola usa solo surplus; con always si mantiene sempre un minimo al di
   * la' del surplus.» Da spenti non si carica, e «subito» carica al massimo
   * comunque: li' quell'opzione non vuol dire niente e non si mostra. */
  assert.equal(eIlModoIntelligente("smart"), true);
  assert.equal(eIlModoIntelligente("pv"), true);
  assert.equal(eIlModoIntelligente("off"), false);
  assert.equal(eIlModoIntelligente("now"), false);
  assert.equal(eIlModoIntelligente(""), false);
});
