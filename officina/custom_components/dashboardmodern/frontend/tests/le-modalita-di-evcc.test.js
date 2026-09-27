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
  iValoriDelSempre,
  ilModoAcceso,
  ilSempreEInVigore,
  ilValoreDelSempreAcceso,
  laFilaDelSempreServe,
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
  assert.equal(
    ilModoAcceso({ state: "pv", attributes: { options: ["off", "smart", "now"] } }),
    "smart",
  );
});

test("uno stato che nessun tasto rappresenta non ne accende nessuno", () => {
  /* Accendere quello sbagliato direbbe che la macchina carica in un modo in cui
   * non sta caricando. */
  assert.equal(
    ilModoAcceso({ state: "minpv", attributes: { options: ["off", "smart", "now"] } }),
    "",
  );
  assert.equal(
    ilModoAcceso({ state: "boh", attributes: { options: ["off", "smart", "now"] } }),
    "",
  );
});

test("e un'entita' muta nemmeno", () => {
  for (const muto of ["unavailable", "unknown", "—", "", null, undefined])
    assert.equal(ilModoAcceso({ state: muto }), "", `«${String(muto)}» non e' una modalita'`);
  assert.equal(ilModoAcceso(), "");
});

test("le maiuscole non contano: lo stato arriva come lo scrive l'integrazione", () => {
  assert.equal(
    ilModoAcceso({ state: "SMART", attributes: { options: ["off", "smart", "now"] } }),
    "smart",
  );
});

/* ── com'e' scritta davvero l'entita' di casa ────────────────────────────── */

/* Dalla schermata di Home Assistant: l'entita' si chiama «Modus», la tendina
 * dice Off / Smart / Fast, e lo storico segna «Smart». Con l'iniziale grande. */
const LA_CASA = { state: "Smart", attributes: { options: ["Off", "Smart", "Fast"] } };

test("le maiuscole dell'integrazione non fanno tre tasti grigi", () => {
  /* Una tabella che guarda solo le minuscole non avrebbe riconosciuto nessuna
   * delle tre: tre tasti senza disegno e col nome inglese, invece di tre tasti
   * veri. */
  const modi = iModiDiEvcc(LA_CASA);
  assert.deepEqual(
    modi.map((m) => m.it),
    ["Spento", "Intelligente", "Fast"],
  );
  assert.deepEqual(
    modi.map((m) => m.ignoto),
    [false, false, false],
  );
  assert.equal(ilModoAcceso(LA_CASA), "Smart");
});

test("ma l'id resta quello che l'entita' ha scritto", () => {
  /* E' quello che si rimanda indietro col comando: li' una maiuscola cambiata
   * e' un'opzione che non esiste, e il servizio viene rifiutato. */
  assert.deepEqual(idDi(LA_CASA), ["Off", "Smart", "Fast"]);
});

test("«Fast» si chiama Fast anche in italiano", () => {
  /* Era «Subito», ed era una parola nostra: nella tendina di Home Assistant
   * quella modalita' si chiama Fast, e chiamarla in due modi vuol dire due
   * modalita' per chi legge. `now` e `fast` sono la stessa, e quale delle due
   * arrivi lo decide l'integrazione. */
  const conNow = iModiDiEvcc({ state: "now", attributes: { options: ["off", "smart", "now"] } });
  assert.equal(conNow.at(-1).it, "Fast");
  assert.equal(conNow.at(-1).en, "Fast");
  assert.equal(iModiDiEvcc(LA_CASA).at(-1).it, "Fast");
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

/* ── «Always charge», l'entita' a parte ──────────────────────────────────── */

/* Com'e' fatta davvero, dalla schermata: `select.evcc_lektrico_always_charge`,
 * tendina Off / On / Once, adesso su On. */
const IL_SEMPRE = { state: "On", attributes: { options: ["Off", "On", "Once"] } };

test("le tre scelte del «sempre» si leggono in parole", () => {
  /* «Off/On/Once» non dice cosa fa: queste tre si leggono senza sapere cos'e'
   * evcc. */
  assert.deepEqual(
    iValoriDelSempre(IL_SEMPRE).map((v) => v.it),
    ["Mai", "Sempre", "Solo stavolta"],
  );
  assert.equal(ilValoreDelSempreAcceso(IL_SEMPRE), "On");
});

test("e l'id resta quello scritto, anche qui", () => {
  assert.deepEqual(
    iValoriDelSempre(IL_SEMPRE).map((v) => v.id),
    ["Off", "On", "Once"],
  );
});

test("la fila si vede in tutte le modalita'", () => {
  /* «Devi mettere sempre quel tasto.»
   *
   * Prima si vedeva solo accanto alla modalita' intelligente, ed era un
   * ragionamento che stava in piedi — in `off` non si carica, in «Fast» si
   * carica al massimo comunque — ma faceva sparire un tasto: uno apre la
   * console in Fast e non sa nemmeno che quella cosa esiste. */
  for (const modo of ["Smart", "pv", "Off", "Fast", ""])
    assert.equal(laFilaDelSempreServe(IL_SEMPRE), true, modo);
});

test("ma dice quando fa effetto e quando no", () => {
  /* Non sparisce e non si spegne: si comanda sempre — «Sempre» scelto mentre
   * si carica in Fast e' pronto per quando si torna in Intelligente — e sotto
   * il nome c'e' scritto dove vale. */
  assert.equal(ilSempreEInVigore("Smart"), true);
  assert.equal(ilSempreEInVigore("pv"), true);
  assert.equal(ilSempreEInVigore("Off"), false);
  assert.equal(ilSempreEInVigore("Fast"), false);
  assert.equal(ilSempreEInVigore(""), false);
});

test("e senza l'entita' non si vede per niente", () => {
  /* Chi non ha mappato quella casella non deve trovarsi una fila di tasti che
   * non comandano niente: e' un evcc vecchio, o uno a cui quell'opzione non
   * serve. Questa resta l'unica condizione. */
  assert.equal(laFilaDelSempreServe(undefined), false);
  assert.equal(laFilaDelSempreServe({ state: "On" }), false);
  assert.deepEqual(iValoriDelSempre(), []);
});

test("un'entita' muta non accende nessuna delle tre", () => {
  for (const muto of ["unavailable", "unknown", ""])
    assert.equal(ilValoreDelSempreAcceso({ ...IL_SEMPRE, state: muto }), "");
});
