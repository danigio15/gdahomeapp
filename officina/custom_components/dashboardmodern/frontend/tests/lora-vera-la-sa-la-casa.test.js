/* L'ora vera dell'avvio la sa la casa (#143).
 *
 * «Quando guardo la sezione elettrodomestici segna inizio ciclo anche se è
 *  già iniziato da 1 ora.»
 *
 * La #65 aveva insegnato al contatore a DIRE che non sapeva; questa gli
 * insegna a chiederlo. Le prove stanno sui due pezzi puri — la domanda e la
 * lettura della storia — e sulla correzione del contatore, che è l'unico
 * punto in cui la risposta può fare danni.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

const {
  ORE_DI_STORIA,
  PAUSA_DENTRO_UN_CICLO_MS,
  avvioDallaStoria,
  daiWatt,
  dalleParole,
  dallInterruttore,
  domandaDellAvvio,
  finestraDellAvvio,
  righeDellaStoria,
} = await import("../src/core/quando-e-partito.js");
const { createCycleTracker } = await import("../src/core/appliance-cycle-tracker.js");
const { letturaDelloStato, laRegolaDelLavora } = await import("../src/core/appliance-view-model.js");

const ORA = 3600000;
const MINUTO = 60000;
const ADESSO = Date.parse("2026-09-26T14:00:00Z");
const { da: BORDO } = finestraDellAvvio(ADESSO);

const riga = (stato, minutiFa) => ({ stato, quando: ADESSO - minutiFa * MINUTO });
const leggi = (righe, inFunzione) => avvioDallaStoria(righe, { inFunzione, adesso: ADESSO, da: BORDO });

const magazzino = () => {
  const dentro = new Map();
  return {
    getItem: (k) => (dentro.has(k) ? dentro.get(k) : null),
    setItem: (k, v) => dentro.set(k, String(v)),
    removeItem: (k) => dentro.delete(k),
  };
};

/* ── la domanda ───────────────────────────────────────────────────────── */

test("si chiede un giorno di cambi di stato, tutti e senza attributi", () => {
  const domanda = domandaDellAvvio("sensor.lavatrice_stato", ADESSO);
  assert.equal(domanda.type, "history/history_during_period");
  assert.deepEqual(domanda.entity_ids, ["sensor.lavatrice_stato"]);
  assert.equal(domanda.end_time, new Date(ADESSO).toISOString());
  assert.equal(domanda.start_time, new Date(ADESSO - ORE_DI_STORIA * ORA).toISOString());
  assert.equal(domanda.include_start_time_state, true, "senza, una partita ieri sembra ferma");
  assert.equal(
    domanda.significant_changes_only,
    false,
    "il «significativo» salta proprio i passaggi da e verso lo zero",
  );
  assert.equal(domanda.no_attributes, true);
});

test("la risposta si legge in tutti e due i vestiti che Home Assistant usa", () => {
  const stretto = righeDellaStoria(
    { "sensor.x": [{ s: "running", lu: ADESSO / 1000 - 600 }] },
    "sensor.x",
  );
  assert.deepEqual(stretto, [{ stato: "running", quando: ADESSO - 600000 }]);

  const largo = righeDellaStoria(
    { "sensor.x": [{ state: "off", last_changed: new Date(ADESSO - ORA).toISOString() }] },
    "sensor.x",
  );
  assert.deepEqual(largo, [{ stato: "off", quando: ADESSO - ORA }]);

  assert.deepEqual(righeDellaStoria({}, "sensor.x"), []);
  assert.deepEqual(righeDellaStoria({ "sensor.x": [{ s: "on", lu: "boh" }] }, "sensor.x"), []);
});

/* ── la lettura della storia ──────────────────────────────────────────── */

const parole = dalleParole(letturaDelloStato);

test("un'ora fa è un'ora fa, non adesso", () => {
  const trovato = leggi([riga("off", 300), riga("running", 60)], parole);
  assert.equal(trovato.quando, ADESSO - ORA);
  assert.equal(trovato.certo, true);
});

test("le righe sono i cambi, non i campioni: una riga sola tiene tutto il ciclo", () => {
  /* Una lavatrice partita alle 12:30 e ancora in giro: due righe in tutto. */
  const trovato = leggi([riga("ready", 600), riga("washing", 90)], parole);
  assert.equal(trovato.quando, ADESSO - 90 * MINUTO);
});

test("una sosta dentro il ciclo non ne apre un altro", () => {
  /* L'ammollo: dieci minuti a zero watt in mezzo al programma. */
  const trovato = leggi(
    [riga("off", 200), riga("washing", 100), riga("idle", 70), riga("rinse", 60)],
    parole,
  );
  assert.equal(trovato.quando, ADESSO - 100 * MINUTO, "è lo stesso bucato");
});

test("una sosta più lunga della tolleranza chiude il ciclo di prima", () => {
  const trovato = leggi(
    [riga("washing", 300), riga("ready", 240), riga("washing", 45)],
    parole,
  );
  assert.equal(trovato.quando, ADESSO - 45 * MINUTO, "il bucato di stamattina non è questo");
});

test("la tolleranza è scritta con lo stesso numero nei due moduli", () => {
  /* I due non si conoscono — uno legge la storia, l'altro guarda gli stati di
   * adesso — e il numero è lo stesso apposta (#26). Se uno dei due lo cambia
   * da solo, la storia dice un ciclo e il contatore ne dice due. */
  const contatore = readFileSync(join(SRC, "core", "appliance-cycle-tracker.js"), "utf8");
  const scritto = contatore.match(/const PAUSA_DENTRO_UN_CICLO_MS = (\d+) \* 60 \* 1000;/);
  assert.ok(scritto, "il contatore dei cicli non ha più quella costante, o è scritta altrimenti");
  assert.equal(Number(scritto[1]) * 60 * 1000, PAUSA_DENTRO_UN_CICLO_MS);
});

test("una sosta dentro la tolleranza tiene il ciclo, una più lunga lo chiude", () => {
  const dentro = PAUSA_DENTRO_UN_CICLO_MS / MINUTO - 1;
  const fuori = PAUSA_DENTRO_UN_CICLO_MS / MINUTO + 1;
  const conSosta = (minuti) =>
    leggi([riga("washing", 300), riga("ready", 100), riga("rinse", 100 - minuti)], parole).quando;
  assert.equal(conSosta(dentro), ADESSO - 300 * MINUTO);
  assert.equal(conSosta(fuori), ADESSO - (100 - fuori) * MINUTO);
});

test("se la corsa tocca il bordo della finestra l'ora resta un «da prima di»", () => {
  const trovato = leggi([{ stato: "washing", quando: BORDO }], parole);
  assert.equal(trovato.quando, BORDO);
  assert.equal(trovato.certo, false, "è partita prima di quanto si è chiesto");
});

test("se adesso non risulta in funzione non c'è nessun avvio da trovare", () => {
  assert.equal(leggi([riga("washing", 300), riga("ready", 30)], parole), null);
  assert.equal(leggi([], parole), null);
});

test("i watt si leggono con la soglia e con la scala del contatore", () => {
  const inWatt = daiWatt(5, 1);
  assert.equal(leggi([riga("0", 200), riga("1180", 75)], inWatt).quando, ADESSO - 75 * MINUTO);
  /* Un contatore in kW: 0,9 kW sono 900 W, e senza il fattore sarebbero sotto
   * soglia — cioè una lavatrice in funzione letta come spenta. */
  const inKilowatt = daiWatt(5, 1000);
  assert.equal(leggi([riga("0", 200), riga("0.9", 75)], inKilowatt).quando, ADESSO - 75 * MINUTO);
  assert.equal(leggi([riga("0", 200), riga("0.9", 75)], daiWatt(5, 1)), null);
});

test("l'interruttore di attività parla per acceso e spento", () => {
  const acceso = dallInterruttore();
  assert.equal(leggi([riga("off", 200), riga("on", 50)], acceso).quando, ADESSO - 50 * MINUTO);
  assert.equal(leggi([riga("on", 200), riga("off", 50)], acceso), null);
});

/* ── da dove si legge «sta lavorando» ─────────────────────────────────── */

test("la regola del «sta lavorando» è la stessa scala della card", () => {
  assert.deepEqual(
    laRegolaDelLavora({
      stateEntity: "binary_sensor.lavatrice_running",
      activityBinary: true,
      powerEntity: "sensor.lavatrice_potenza",
    }),
    { entita: "binary_sensor.lavatrice_running", come: "acceso" },
  );
  assert.deepEqual(
    laRegolaDelLavora({
      stateEntity: "sensor.lavatrice_stato",
      dettoDalloStato: "running",
      powerEntity: "sensor.lavatrice_potenza",
    }),
    { entita: "sensor.lavatrice_stato", come: "parole" },
  );
  /* Una parola che il vocabolario non conosce non fa da stato: si torna ai
   * watt, che è quello che ha deciso anche la card. */
  assert.deepEqual(
    laRegolaDelLavora({
      stateEntity: "sensor.lavatrice_stato",
      dettoDalloStato: "",
      powerEntity: "sensor.lavatrice_potenza",
      soglia: 5,
      fattore: 1000,
    }),
    { entita: "sensor.lavatrice_potenza", come: "watt", soglia: 5, fattore: 1000 },
  );
  /* Un lettore resta fuori: la sua TV accesa non è un programma partito. */
  assert.equal(
    laRegolaDelLavora({ stateEntity: "media_player.tv", dettoDalloStato: "running" }),
    null,
  );
  assert.equal(laRegolaDelLavora({}), null);
});

/* ── la correzione del contatore ──────────────────────────────────────── */

function contatoreConUnCicloSupposto() {
  const storage = magazzino();
  let orologio = ADESSO;
  const cycles = createCycleTracker({ storage, now: () => orologio });
  /* Trovata già in giro: nessuno la stava guardando, e l'avvio è una
   * supposizione — è il caso della #65. */
  cycles.update([{ id: "lavatrice", mode: "running", watts: 1180 }]);
  const attivo = cycles.record("lavatrice").active;
  assert.equal(attivo.avvioIncerto, true, "senza questo la prova non sta provando niente");
  assert.equal(attivo.startMs, ADESSO);
  return { cycles, storage, avanti: (ms) => (orologio += ms) };
}

test("l'ora trovata nella storia prende il posto della supposizione", () => {
  const { cycles } = contatoreConUnCicloSupposto();
  assert.equal(cycles.correggiLAvvio("lavatrice", ADESSO - ORA), true);
  const attivo = cycles.record("lavatrice").active;
  assert.equal(attivo.startMs, ADESSO - ORA);
  assert.equal(attivo.avvioIncerto, undefined, "adesso si sa, e non è più una supposizione");
});

test("un'ora migliore ma non sicura resta un «da prima di»", () => {
  const { cycles } = contatoreConUnCicloSupposto();
  cycles.correggiLAvvio("lavatrice", ADESSO - 12 * ORA, { certo: false });
  const attivo = cycles.record("lavatrice").active;
  assert.equal(attivo.startMs, ADESSO - 12 * ORA, "dodici ore fa è meglio di adesso");
  assert.equal(attivo.avvioIncerto, true, "ma di quanto prima non si sa");
});

test("la correzione va solo all'indietro, e non oltre un giorno", () => {
  const { cycles } = contatoreConUnCicloSupposto();
  assert.equal(cycles.correggiLAvvio("lavatrice", ADESSO + MINUTO), false, "non può essere dopo");
  assert.equal(cycles.correggiLAvvio("lavatrice", ADESSO - 30 * ORA), false, "non è questo ciclo");
  assert.equal(cycles.correggiLAvvio("lavatrice", "boh"), false);
  assert.equal(cycles.record("lavatrice").active.startMs, ADESSO, "e intanto non si tocca niente");
});

test("un avvio che si sa non si corregge: solo le supposizioni si correggono", () => {
  const storage = magazzino();
  const cycles = createCycleTracker({ storage, now: () => ADESSO });
  /* La casa lo dichiara: `binary_sensor.…_running` acceso da un'ora. */
  cycles.update([
    { id: "lavatrice", mode: "running", watts: 1180, iniziatoIl: ADESSO - ORA },
  ]);
  assert.equal(cycles.record("lavatrice").active.avvioIncerto, undefined);
  assert.equal(cycles.correggiLAvvio("lavatrice", ADESSO - 3 * ORA), false);
  assert.equal(cycles.record("lavatrice").active.startMs, ADESSO - ORA);
  assert.equal(cycles.correggiLAvvio("non-c-e", ADESSO - ORA), false);
});

test("l'ora corretta resta scritta, anche per chi riapre la plancia", () => {
  const { cycles, storage } = contatoreConUnCicloSupposto();
  cycles.correggiLAvvio("lavatrice", ADESSO - ORA);
  const riaperta = createCycleTracker({ storage, now: () => ADESSO + MINUTO });
  assert.equal(riaperta.record("lavatrice").active.startMs, ADESSO - ORA);
});

test("l'ora corretta è quella che finisce nel ciclo chiuso", () => {
  const { cycles, avanti } = contatoreConUnCicloSupposto();
  cycles.correggiLAvvio("lavatrice", ADESSO - ORA);
  avanti(MINUTO);
  cycles.update([{ id: "lavatrice", mode: "off", watts: 0 }]);
  const ultimo = cycles.record("lavatrice").last;
  assert.equal(ultimo.startMs, ADESSO - ORA);
  assert.equal(ultimo.durationMinutes, 61, "un'ora e un minuto, non un minuto");
  assert.equal(ultimo.avvioIncerto, undefined);
});
