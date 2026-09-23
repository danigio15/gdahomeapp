/* Le due mappe chieste al ponte, dove il pannello non c'è.
 *
 * L'avviso dei dispositivi non connessi conta per dispositivo, e per farlo
 * vuole sapere di chi è ogni entità. Quel registro chi disegna non ce l'ha, e
 * chiederlo a Home Assistant è la porta che la #553 ha chiuso: la regola è
 * «non si chiede, si ricorda», e a lasciarlo scritto è chi ce l'ha già.
 *
 * Dentro Home Assistant è il pannello. **Nell'app non era nessuno**: lì
 * l'unico che poteva averlo era il guscio storico, che i registri li carica
 * solo dopo il rilevamento automatico e il nome del dispositivo non lo tiene
 * affatto — `WIZ.devNames` nel guscio non esiste. Quindi sul telefono, a
 * caricamento pulito, l'avviso tornava a contare le entità: quattro «Child
 * lock» al posto di niente.
 *
 * Il ponte i registri ce li ha già in mano, letti per il rapporto al quadro.
 * Qui si difende che glieli si chieda — una volta, e solo dove il ponte c'è —
 * e che una risposta mancata non rompa niente.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { dimenticaIDispositivi } from "../src/core/i-dispositivi-di-home-assistant.js";
import {
  CHIAVE_DELLO_STATO,
  chiediIDispositiviAlPonte,
  IL_COMANDO,
  ilFiloCE,
  ilPonteCE,
  unGiro,
} from "../src/sections/i-dispositivi-dal-ponte-section.js";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

/* Un deposito finto, per non scrivere sul disco di chi prova. */
function deposito() {
  const dentro = new Map();
  return {
    dentro,
    getItem: (chiave) => (dentro.has(chiave) ? dentro.get(chiave) : null),
    setItem: (chiave, valore) => dentro.set(chiave, String(valore)),
  };
}

/* La presa del guscio, come la trova il modulo: `ws`, `pendingWsCallbacks` e
 * `msgId` sono variabili del documento, e da fuori si leggono con `eval`. Qui
 * si mettono su `globalThis`, che è la stessa cosa vista da Node. */
function prestaLaPresa(rispondi) {
  const mandati = [];
  globalThis.pendingWsCallbacks = {};
  globalThis.msgId = 1;
  globalThis.ws = {
    readyState: 1,
    send(testo) {
      const detto = JSON.parse(testo);
      mandati.push(detto);
      /* La risposta torna come torna dal ponte: per il gancio che la aspetta. */
      queueMicrotask(() => globalThis.pendingWsCallbacks[detto.id]?.(rispondi(detto)));
    },
  };
  return mandati;
}

function sparecchia() {
  delete globalThis.ws;
  delete globalThis.pendingWsCallbacks;
  delete globalThis.msgId;
  delete globalThis.__DASHBOARDMODERN_HOSTED__;
  dimenticaIDispositivi();
}

const MAPPE = {
  di: { "lock.asciugatrice_child_lock": "asc1", "switch.presa_giardino": "giard1" },
  nomi: { asc1: "Asciugatrice", giard1: "Presa giardino" },
};

test("dove il ponte non c'è non si chiede niente", async () => {
  sparecchia();
  assert.equal(ilPonteCE(), false);
  const mandati = prestaLaPresa(() => ({ success: true, result: MAPPE }));
  assert.equal(await chiediIDispositiviAlPonte(), false);
  assert.deepEqual(mandati, [], "dentro Home Assistant quel comando non esiste");
  sparecchia();
});

test("dove il ponte c'è si chiede, e le mappe restano scritte", async () => {
  sparecchia();
  globalThis.__DASHBOARDMODERN_HOSTED__ = true;
  const disco = deposito();
  globalThis.localStorage = disco;
  const mandati = prestaLaPresa(() => ({ success: true, result: MAPPE }));
  assert.equal(await chiediIDispositiviAlPonte(), true);
  assert.equal(mandati.length, 1);
  assert.equal(mandati[0].type, IL_COMANDO);
  const scritto = JSON.parse(disco.getItem("dm_dispositivi_di_home_assistant"));
  assert.equal(scritto.di["switch.presa_giardino"], "giard1");
  assert.equal(scritto.nomi.giard1, "Presa giardino");
  delete globalThis.localStorage;
  sparecchia();
});

test("un ponte che non lo sa non rompe niente: si torna a contare le entità", async () => {
  sparecchia();
  globalThis.__DASHBOARDMODERN_HOSTED__ = true;
  globalThis.localStorage = deposito();
  prestaLaPresa(() => ({ success: false, error: { code: "unknown_command" } }));
  assert.equal(await chiediIDispositiviAlPonte(), false);
  delete globalThis.localStorage;
  sparecchia();
});

test("e nemmeno una risposta storta: mappe vuote non si scrivono", async () => {
  sparecchia();
  globalThis.__DASHBOARDMODERN_HOSTED__ = true;
  const disco = deposito();
  globalThis.localStorage = disco;
  prestaLaPresa(() => ({ success: true, result: { di: null, nomi: "boh" } }));
  assert.equal(await chiediIDispositiviAlPonte(), false);
  assert.equal(disco.getItem("dm_dispositivi_di_home_assistant"), null);
  delete globalThis.localStorage;
  sparecchia();
});

test("col filo giù non si cade: si riprova al caricamento dopo", async () => {
  sparecchia();
  globalThis.__DASHBOARDMODERN_HOSTED__ = true;
  globalThis.localStorage = deposito();
  globalThis.ws = { readyState: 3, send() {} };
  globalThis.pendingWsCallbacks = {};
  assert.equal(await chiediIDispositiviAlPonte(), false);
  delete globalThis.localStorage;
  sparecchia();
});

test("il comando è del ponte, e a Home Assistant non si chiede il registro", async () => {
  const sezione = await read("src/sections/i-dispositivi-dal-ponte-section.js");
  assert.match(sezione, /"ponte\/registri"/, "comincia per «ponte/»: la fa il ponte");
  /* La porta che la #553 ha chiuso resta chiusa: da qui quel comando non
   * parte, né quello delle entità né quello dei dispositivi. */
  for (const proibito of ["config/entity_registry/list", "config/device_registry/list"])
    assert.ok(!sezione.includes(proibito), `${proibito} non deve stare in questo file`);
});

test("il ponte risponde con le stesse due chiavi che la plancia legge", async () => {
  /* Le due metà si parlano con una forma sola. Il giorno che una delle due la
   * cambia senza l'altra, la risposta arriva e non serve a niente — e non se
   * ne accorge nessuno, perché non è un errore: è una mappa vuota. */
  const ilPonte = await readFile(new URL("../../../../../ponte/src/registri.js", import.meta.url), "utf8");
  assert.match(ilPonte, /return \{ di, nomi \};/);
  const laPlancia = await read("src/core/i-dispositivi-di-home-assistant.js");
  assert.match(laPlancia, /return \{ di, nomi \};/);
});

test("la sezione la installa il guscio, come tutte le altre", async () => {
  const runtime = await read("src/sections/section-runtime.js");
  assert.match(runtime, /installIDispositiviDalPonte\(\)/);
});

/* ── E il tentativo che non si deve bruciare ───────────────────────────────
 *
 * Trovato aprendo la pagina vera, non a tavolino. La sezione si installava, il
 * suo segno diceva «gia' chiesto», e sul filo non era passato niente: al primo
 * istante la presa verso il ponte non c'e' ancora, e il segno di «fatto» era
 * messo PRIMA di provare. Cosi' il primo tentativo a vuoto era anche
 * l'ultimo.
 */

function loStato() {
  return globalThis[CHIAVE_DELLO_STATO];
}

function azzera() {
  const stato = loStato();
  if (stato) {
    stato.fatto = false;
    stato.prove = 0;
  }
}

test("col filo ancora giù il tentativo non si brucia: si riprova", async () => {
  sparecchia();
  globalThis.__DASHBOARDMODERN_HOSTED__ = true;
  globalThis.localStorage = deposito();
  azzera();
  /* Nessuna presa: e' l'istante in cui la pagina si e' appena aperta. */
  assert.equal(ilFiloCE(), false);
  await unGiro();
  assert.equal(loStato().fatto, false, "non si segna fatto quello che non e' partito");
  assert.equal(loStato().prove, 1, "una prova spesa, e ne restano");

  /* Adesso il filo c'e': il giro dopo chiede davvero, e questa volta basta. */
  const mandati = prestaLaPresa(() => ({ success: true, result: MAPPE }));
  assert.equal(ilFiloCE(), true);
  await unGiro();
  assert.deepEqual(
    mandati.map((una) => una.type),
    [IL_COMANDO],
  );
  assert.equal(loStato().fatto, true);
  delete globalThis.localStorage;
  sparecchia();
});

test("una volta andata non si richiede: la risposta e' gia' sul tavolo", async () => {
  sparecchia();
  globalThis.__DASHBOARDMODERN_HOSTED__ = true;
  globalThis.localStorage = deposito();
  azzera();
  const mandati = prestaLaPresa(() => ({ success: true, result: MAPPE }));
  await unGiro();
  assert.equal(mandati.length, 1);
  await unGiro();
  await unGiro();
  assert.equal(mandati.length, 1, "chiesta una volta per caricamento, non tre");
  delete globalThis.localStorage;
  sparecchia();
});

test("e non si prova all'infinito: un ponte che non lo sa non lo sapra' mai", async () => {
  sparecchia();
  globalThis.__DASHBOARDMODERN_HOSTED__ = true;
  globalThis.localStorage = deposito();
  azzera();
  const mandati = prestaLaPresa(() => ({ success: false, error: { code: "unknown_command" } }));
  for (let giro = 0; giro < 10; giro += 1) await unGiro();
  assert.equal(mandati.length, 3, "tre prove e poi basta");
  assert.equal(loStato().fatto, false);
  delete globalThis.localStorage;
  sparecchia();
});
