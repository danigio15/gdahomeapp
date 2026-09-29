/* Il contatore di sempre non è il consumo di oggi (#130).
 *
 * «Quando importo la lavatrice tramite l'integrazione Haier acquisisce
 *  correttamente tutti i dati. Tuttavia, nella sezione dei consumi giornalieri
 *  degli elettrodomestici, per la lavatrice viene visualizzato il consumo
 *  totale cumulativo invece del consumo effettuato durante la singola
 *  giornata. Se accedo alla configurazione della scheda della lavatrice e
 *  rimuovo il contatore del consumo totale della lavatrice, al momento del
 *  salvataggio questo viene aggiunto nuovamente automaticamente.»
 *
 * Il pezzo delicato è il confine: un `utility_meter` giornaliero — quello
 * buono, che a mezzanotte si azzera — Home Assistant lo marca
 * `total_increasing` come il contatore di sempre. Metà di queste prove sta lì
 * a tenere che quello NON sparisca.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  CASELLE_DEL_TOTALE,
  dailyEnergyKwh,
  eIlTotaleTravestito,
} from "../src/core/appliance-card-view-model.js";
import {
  applianceDailySource,
  buildApplianceDailyBreakdown,
} from "../src/sections/appliances-section.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

/* Una lavatrice Haier: un contatore che parte dall'installazione, e basta.
 * Chi l'ha collegata ha riempito tre caselle con lo stesso sensore, e una
 * quarta — il giornaliero — se l'è ritrovata con dentro lo stesso. */
const LAVATRICE = {
  id: "lavatrice",
  name: "Lavatrice",
  daily_energy_entity: "sensor.lavatrice_energia",
  total_energy_entity: "sensor.lavatrice_energia",
  history_entity: "sensor.lavatrice_energia",
  report_entity: "sensor.lavatrice_energia",
  entities: ["sensor.lavatrice_energia"],
};

/* Un frigo fatto come si deve: un giornaliero vero e un totale a parte. */
const FRIGO = {
  id: "frigo",
  name: "Frigorifero",
  daily_energy_entity: "sensor.frigo_oggi",
  total_energy_entity: "sensor.frigo_totale",
  entities: ["sensor.frigo_oggi", "sensor.frigo_totale"],
};

const STATI = {
  "sensor.lavatrice_energia": {
    state: "214.6",
    attributes: { unit_of_measurement: "kWh", state_class: "total_increasing" },
  },
  "sensor.frigo_oggi": {
    /* Anche il giornaliero buono è `total_increasing`: è così che Home
     * Assistant marca un utility_meter. È tutto il punto di questa storia. */
    state: "0.81",
    attributes: { unit_of_measurement: "kWh", state_class: "total_increasing" },
  },
  "sensor.frigo_totale": {
    state: "980.2",
    attributes: { unit_of_measurement: "kWh", state_class: "total_increasing" },
  },
};

/* ── riconoscerlo ─────────────────────────────────────────────────────── */

test("lo stesso sensore in due caselle è una misura sola, copiata", () => {
  assert.equal(eIlTotaleTravestito(LAVATRICE, LAVATRICE.daily_energy_entity), true);
  assert.equal(eIlTotaleTravestito(FRIGO, FRIGO.daily_energy_entity), false);
  assert.equal(eIlTotaleTravestito(FRIGO, ""), false);
  assert.equal(eIlTotaleTravestito({}, "sensor.qualunque"), false);
});

test("basta una delle tre caselle del totale, non tutte e tre", () => {
  for (const casella of CASELLE_DEL_TOTALE) {
    const device = { daily_energy_entity: "sensor.x", [casella]: "sensor.x" };
    assert.equal(eIlTotaleTravestito(device, "sensor.x"), true, casella);
  }
});

test("l'alias si riconosce anche quando una delle due è un nome di casa", () => {
  const device = { daily_energy_entity: "dm.energia", total_energy_entity: "sensor.energia" };
  const risolvi = (valore) => (valore === "dm.energia" ? "sensor.energia" : valore);
  assert.equal(eIlTotaleTravestito(device, "dm.energia"), false, "senza risolvere non si vede");
  assert.equal(eIlTotaleTravestito(device, "dm.energia", risolvi), true);
});

/* ── cosa se ne fa la scheda ──────────────────────────────────────────── */

test("la scheda non spaccia il totale per il consumo di oggi", () => {
  assert.equal(dailyEnergyKwh(LAVATRICE, STATI), null, "meglio niente che 214 kWh «di oggi»");
  assert.equal(dailyEnergyKwh(FRIGO, STATI), 0.81, "il giornaliero vero resta");
});

test("un giornaliero vero passa anche se sta anche in una casella qualunque", () => {
  /* `energy_entity` la riempie chi collega, e non è una casella del totale:
   * un sensore che sta lì e nel giornaliero è comunque un giornaliero. */
  const device = { ...FRIGO, energy_entity: "sensor.frigo_oggi" };
  assert.equal(dailyEnergyKwh(device, STATI), 0.81);
});

/* ── cosa se ne fa l'elenco dei consumi giornalieri ───────────────────── */

test("il totale travestito scende fra i cumulativi, e non sparisce", () => {
  const scelta = applianceDailySource(LAVATRICE, STATI);
  assert.equal(scelta.direct, false, "non si legge com'è");
  assert.equal(scelta.reason, "cumulative-recorder");
  assert.equal(scelta.entity, "sensor.lavatrice_energia", "ma è ancora lui a rispondere");
  const buono = applianceDailySource(FRIGO, STATI);
  assert.equal(buono.direct, true);
  assert.equal(buono.entity, "sensor.frigo_oggi");
});

test("nell'elenco la lavatrice porta il delta del giorno, non i kWh di sempre", async () => {
  let piani = [];
  const broker = {
    async valuesForPlans(plans) {
      piani = plans;
      return new Map(plans.map((piano) => [piano.key, 1.24]));
    },
  };
  const conto = await buildApplianceDailyBreakdown([LAVATRICE, FRIGO], STATI, broker, new Date());
  assert.equal(piani.length, 1, "una domanda sola al Recorder: quella della lavatrice");
  assert.equal(piani[0].entity, "sensor.lavatrice_energia");
  assert.equal(piani[0].kind, "day");

  const lavatrice = conto.rows.find((riga) => riga.name === "Lavatrice");
  assert.equal(lavatrice.value, 1.24, "il bucato di oggi");
  assert.notEqual(lavatrice.value, 214.6, "non quello di tre anni");
  assert.equal(conto.rows.find((riga) => riga.name === "Frigorifero").value, 0.81);
  assert.equal(conto.total, 2.05);
});

/* ── le tre caselle sono le stesse da tutte e due le parti ────────────── */

test("le caselle del totale sono quelle da cui la maschera ripesca il contatore", () => {
  /* La maschera dell'apparecchio, aprendosi, ripesca «il contatore del consumo
   * totale» da tre caselle. Se le due liste si scollassero, un contatore
   * mostrato come totale nella maschera potrebbe essere letto come giornaliero
   * dalla scheda — che è esattamente il difetto di questa issue, scritto
   * un'altra volta. */
  const maschera = readFileSync(join(SRC, "sections", "appliance-editor-section.js"), "utf8");
  const scritto = maschera.match(/const dovePescare = [^;]+;/s);
  assert.ok(scritto, "la maschera non ripesca più da un elenco scritto così");
  for (const casella of CASELLE_DEL_TOTALE)
    assert.ok(scritto[0].includes(`device.${casella}`), `la maschera non guarda ${casella}`);
});
