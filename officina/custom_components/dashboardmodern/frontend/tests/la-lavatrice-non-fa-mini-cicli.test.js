/* La lavatrice non fa mini cicli (#26).
 *
 * «La mia lavatrice mostra diversi mini cicli durante un lavaggio solo.» La
 * scheda di chi l'ha segnalato: soglia in funzione 0,1 W, soglia standby
 * 0,1 W, ritardo di fine ciclo 5 minuti, comando `switch.lavatrice`. Il
 * lavaggio fa delle pause vere a 0 W — l'ammollo, il carico dell'acqua — piu'
 * lunghe di cinque minuti, e la card ne faceva un ciclo nuovo a ogni ripresa.
 *
 * Qui si fa un bucato intero, campione per campione, con due pause da 8 e 15
 * minuti, e si pretende UN ciclo: dalla card e dal contatore. E si tengono
 * ferme le regole comuni — i valori consigliati, quelli usati per le caselle
 * vuote, l'avviso della scheda.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createApplianceViewModel, resetRunHolds } from "../src/core/appliance-view-model.js";
import { createCycleTracker } from "../src/core/appliance-cycle-tracker.js";
import {
  PAUSA_DENTRO_UN_CICLO_MS,
  VALORI_CONSIGLIATI,
  pausaDentroUnCiclo,
  problemiDelCiclo,
  regoleDelLavoro,
  scritto,
  tipoACiclo,
  trattenutaInMinuti,
  valoriConsigliati,
} from "../src/core/il-ciclo-di-un-elettrodomestico.js";
import { PAUSA_DENTRO_UN_CICLO_MS as DELLA_STORIA } from "../src/core/quando-e-partito.js";

const MINUTO = 60_000;
const INIZIO = Date.UTC(2026, 9, 14, 8, 0, 0);

/* La scheda del tester. */
const LAVATRICE = {
  id: "lavatrice",
  name: "Lavatrice",
  visual_key: "lavatrice",
  device_type: "lavatrice",
  power_entity: "sensor.lavatrice_w",
  control_entity: "switch.lavatrice",
  threshold_run: 0.1,
  threshold_standby: 0.1,
  off_delay_minutes: 5,
};

/* Il bucato: [minuti, watt]. Riscalda, lava, ammollo da 8 minuti a 0 W, lava,
 * pausa da 15 prima della centrifuga, centrifuga, finito. */
const BUCATO = [
  [20, 1900],
  [25, 180],
  [8, 0],
  [20, 160],
  [15, 0],
  [12, 450],
  [45, 0],
];

function memoria() {
  const dati = new Map();
  return {
    getItem: (k) => (dati.has(k) ? dati.get(k) : null),
    setItem: (k, v) => dati.set(k, String(v)),
  };
}

/* Un campione al minuto, come la raffica degli stati, per tutto il bucato. */
function lava(device, programma = BUCATO) {
  resetRunHolds();
  let adesso = INIZIO;
  const holds = new Map();
  const tracker = createCycleTracker({ storage: memoria(), now: () => adesso });
  const modi = [];
  for (const [minuti, watt] of programma) {
    for (let m = 0; m < minuti; m += 1) {
      const states = {
        "sensor.lavatrice_w": {
          state: String(watt),
          attributes: { unit_of_measurement: "W" },
        },
        "switch.lavatrice": { state: "on", attributes: {} },
      };
      const model = createApplianceViewModel(device, states, [], "it", { now: adesso, holds });
      modi.push(model.mode);
      tracker.update([
        {
          id: device.id,
          mode: model.mode,
          watts: model.watts,
          pausaMs: pausaDentroUnCiclo(device),
          fineProbabile: model.fineProbabile,
        },
      ]);
      adesso += MINUTO;
    }
  }
  resetRunHolds();
  return { modi, record: tracker.record(device.id) };
}

/* Quante volte la card passa da «non in funzione» a «in funzione». */
const partenze = (modi) =>
  modi.filter((modo, i) => modo === "running" && modi[i - 1] !== "running").length;

test("un bucato con pause da 8 e 15 minuti e' UN ciclo, per la card e per il contatore", () => {
  const { modi, record } = lava(LAVATRICE);
  assert.equal(partenze(modi), 1, "la card non deve ripartire dopo le pause");
  /* Il contatore ha chiuso un ciclo solo, dall'inizio alla centrifuga. */
  assert.ok(record?.last, "il ciclo e' stato registrato");
  assert.equal(record.last.startMs, INIZIO);
  assert.equal(record.active, undefined, "e' finito");
  /* Finisce all'ultimo lavoro vero piu' il ritardo scritto (5 minuti), non
   * alla fine dell'attesa di prudenza: 20+25+8+20+15+12 = 100 minuti. */
  assert.equal(record.last.durationMinutes, 100 + 5 - 1);
});

test("lo stesso bucato con le caselle vuote usa i valori consigliati, ed e' un ciclo", () => {
  const vuota = { ...LAVATRICE };
  delete vuota.threshold_run;
  delete vuota.threshold_standby;
  delete vuota.off_delay_minutes;
  const { modi, record } = lava(vuota);
  assert.equal(partenze(modi), 1);
  assert.equal(record.last.startMs, INIZIO);
  /* Senza ritardo scritto il ciclo finisce col lavoro. */
  assert.equal(record.last.durationMinutes, 100 - 1);
});

test("una pausa piu' lunga della sosta chiude il ciclo: due bucati veri restano due", () => {
  const dueBucati = [
    [30, 1900],
    [40, 0],
    [30, 1900],
    [30, 0],
  ];
  const { modi } = lava(LAVATRICE, dueBucati);
  assert.equal(partenze(modi), 2);
});

test("la card non trattiene mai meno della sosta del contatore, per una macchina a ciclo a watt", () => {
  const sosta = PAUSA_DENTRO_UN_CICLO_MS / MINUTO;
  assert.equal(trattenutaInMinuti(LAVATRICE), sosta, "5 minuti scritti diventano 20");
  assert.equal(trattenutaInMinuti({ ...LAVATRICE, off_delay_minutes: 45 }), 45);
  /* Quando a dire «lavora» e' la parola dello stato, vale il ritardo scritto. */
  assert.equal(trattenutaInMinuti(LAVATRICE, { daiWatt: false }), 5);
  /* Chi non e' a ciclo resta com'era. */
  assert.equal(trattenutaInMinuti({ visual_key: "forno", off_delay_minutes: 5 }), 5);
  assert.equal(trattenutaInMinuti({ visual_key: "forno" }), 0);
  /* E il contatore usa il ritardo scritto quando e' piu' lungo. */
  assert.equal(pausaDentroUnCiclo(LAVATRICE), PAUSA_DENTRO_UN_CICLO_MS);
  assert.equal(
    pausaDentroUnCiclo({ visual_key: "lavastoviglie", off_delay_minutes: 40 }),
    40 * MINUTO,
  );
  /* Lo stesso numero della storia. */
  assert.equal(PAUSA_DENTRO_UN_CICLO_MS, DELLA_STORIA);
});

test("il contatore tiene insieme una pausa lunga quanto il ritardo scritto", () => {
  let adesso = INIZIO;
  const tracker = createCycleTracker({ storage: memoria(), now: () => adesso });
  const passo = (mode, minuti, pausaMs) => {
    for (let m = 0; m < minuti; m += 1) {
      tracker.update([{ id: "lsv", mode, watts: mode === "running" ? 2000 : 0, pausaMs }]);
      adesso += MINUTO;
    }
  };
  /* La lavastoviglie che asciuga 28 minuti a 0 W: oltre i 20 di tutti, dentro
   * i 30 che chi configura ha scritto. */
  passo("running", 40, 30 * MINUTO);
  passo("standby", 28, 30 * MINUTO);
  passo("running", 10, 30 * MINUTO);
  passo("off", 2, 30 * MINUTO);
  assert.equal(tracker.record("lsv").last.startMs, INIZIO, "e' lo stesso lavaggio");
});

test("i tipi a ciclo e i loro valori consigliati", () => {
  assert.equal(tipoACiclo({ visual_key: "lavatrice" }), "lavatrice");
  assert.equal(tipoACiclo({ device_type: "dishwasher" }), "lavastoviglie");
  assert.equal(tipoACiclo({ visual_key: "asciugatrice" }), "asciugatrice");
  assert.equal(tipoACiclo({ visual_key: "lavatrice", name: "Lavasciuga bagno" }), "lavasciuga");
  assert.equal(tipoACiclo({ visual_key: "forno" }), "");
  assert.deepEqual(valoriConsigliati("lavatrice"), { inFunzione: 10, standby: 2, ritardo: 20 });
  assert.deepEqual(valoriConsigliati("lavastoviglie"), { inFunzione: 10, standby: 2, ritardo: 30 });
  assert.deepEqual(valoriConsigliati("asciugatrice"), { inFunzione: 10, standby: 2, ritardo: 15 });
  assert.deepEqual(valoriConsigliati("lavasciuga"), { inFunzione: 10, standby: 2, ritardo: 30 });
  assert.equal(valoriConsigliati("forno"), null);
  assert.equal(Object.keys(VALORI_CONSIGLIATI).length, 4);
});

test("le caselle vuote usano i consigliati, quelle scritte non si toccano mai", () => {
  assert.equal(scritto(""), null);
  assert.equal(scritto(" "), null);
  assert.equal(scritto("0"), 0, "zero scritto e' una scelta");
  assert.equal(scritto("0,5"), 0.5);
  assert.deepEqual(regoleDelLavoro({ visual_key: "lavatrice" }), {
    inFunzione: 10,
    standby: 2,
    ritardo: 20,
    tipo: "lavatrice",
  });
  assert.deepEqual(regoleDelLavoro(LAVATRICE), {
    inFunzione: 0.1,
    standby: 0.1,
    ritardo: 5,
    tipo: "lavatrice",
  });
  /* Chi non e' a ciclo: i 5 W e 1 W di sempre, e nessun ritardo. */
  assert.deepEqual(regoleDelLavoro({ visual_key: "forno" }), {
    inFunzione: 5,
    standby: 1,
    ritardo: 0,
    tipo: "",
  });
  /* Una casella salvata vuota (stringa) non diventa zero. */
  assert.equal(regoleDelLavoro({ visual_key: "tv", threshold_run: "" }).inFunzione, 5);
});

test("0,1 W / 0,1 W / 5 minuti: la scheda avvisa di tutti e tre", () => {
  assert.deepEqual(
    problemiDelCiclo("lavatrice", {
      threshold_run: "0.1",
      threshold_standby: "0.1",
      off_delay_minutes: "5",
    }),
    ["ritardo", "inFunzione", "standby"],
  );
  /* I valori consigliati non avvisano. */
  const { inFunzione, standby, ritardo } = valoriConsigliati("lavatrice");
  assert.deepEqual(
    problemiDelCiclo("lavatrice", {
      threshold_run: String(inFunzione),
      threshold_standby: String(standby),
      off_delay_minutes: String(ritardo),
    }),
    [],
  );
  /* Le caselle vuote nemmeno: li' valgono i consigliati. */
  assert.deepEqual(problemiDelCiclo("lavatrice", {}), []);
  /* La lavastoviglie vuole trenta minuti. */
  assert.deepEqual(problemiDelCiclo("lavastoviglie", { off_delay_minutes: "25" }), ["ritardo"]);
  /* Lo standby che non sta sotto la soglia in funzione. */
  assert.deepEqual(
    problemiDelCiclo("lavatrice", { threshold_run: "10", threshold_standby: "10" }),
    ["standby"],
  );
  /* Chi non e' a ciclo non riceve avvisi. */
  assert.deepEqual(problemiDelCiclo("", { threshold_run: "0.1", off_delay_minutes: "1" }), []);
});
