/* Il contatore totale di un elettrodomestico non sparisce.
 *
 * «Controlla bene i dati salvati nella sezione Giornaliera e Mensile degli
 *  elettrodomestici: ho impostato un sensore totale ma all'improvviso il
 *  valore sparisce.»
 *
 * Le strade per cui spariva erano tre, e tutte nascevano dallo stesso errore:
 * prendere il «non lo so» per un «no».
 *
 * — La passata che sistema i contratti degli apparecchi giudicava il
 *   contatore totale dagli attributi del suo stato. Prima che gli stati
 *   arrivino, o mentre il sensore e' irraggiungibile, gli attributi non ci
 *   sono, e un contatore che non si chiama «total» veniva cancellato dalla
 *   configurazione, per sempre.
 * — Il Report e il flusso decidono chi ha un contatore di vita con la stessa
 *   domanda: un attimo senza stato e l'apparecchio restava senza il piano del
 *   giorno e del mese.
 * — Il conto di oggi degli elettrodomestici buttava via il numero buono alla
 *   prima risposta vuota del Recorder.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildApplianceDailyBreakdown,
  applianceDailySource,
  mancaUnGiornalieroCheSiLegge,
} from "../src/sections/appliances-section.js";
import { canonicalReportDevices } from "../src/core/energy-projection.js";

const KWH_TOTALE = {
  unit_of_measurement: "kWh",
  device_class: "energy",
  state_class: "total_increasing",
  friendly_name: "Lavatrice energia",
};

function lavatrice(extra = {}) {
  return {
    id: "lavatrice",
    name: "Lavatrice",
    total_energy_entity: "sensor.lavatrice_energia",
    history_entity: "sensor.lavatrice_energia",
    report_entity: "sensor.lavatrice_energia",
    entities: ["sensor.lavatrice_energia"],
    metadata: {},
    ...extra,
  };
}

async function passataDeiContratti(appliances, stati) {
  const sezioni = { appliances, loads: [], rooms: [] };
  globalThis.STATES = stati;
  globalThis._RAW_STATES = stati;
  globalThis.DashboardModernModules = {
    store: {
      getSection: (nome) => sezioni[nome],
      replaceSection: async (nome, valore) => {
        sezioni[nome] = valore;
        return true;
      },
    },
  };
  const { applyDataContracts } = await import("../src/sections/data-contracts-section.js");
  await applyDataContracts();
  return sezioni.appliances;
}

test("prima che arrivino gli stati il contatore totale resta in configurazione", async () => {
  const [dopo] = await passataDeiContratti([lavatrice()], {});
  assert.equal(dopo.total_energy_entity, "sensor.lavatrice_energia");
  assert.equal(dopo.history_entity, "sensor.lavatrice_energia");
});

test("un contatore irraggiungibile per un momento non viene cancellato", async () => {
  const stati = {
    "sensor.lavatrice_energia": {
      state: "unavailable",
      attributes: { friendly_name: "Lavatrice energia", restored: true },
    },
  };
  const [dopo] = await passataDeiContratti([lavatrice()], stati);
  assert.equal(dopo.total_energy_entity, "sensor.lavatrice_energia");
  assert.equal(dopo.history_entity, "sensor.lavatrice_energia");
});

test("un sensore che SI LEGGE e non e' cumulativo continua a non fare da storico", async () => {
  /* La regola di prima resta dove ha ragione: con lo stato in mano e la
   * state_class che dice «misura», quello non e' un contatore di vita. */
  const stati = {
    "sensor.lavatrice_energia": {
      state: "1.2",
      attributes: { unit_of_measurement: "kWh", state_class: "measurement" },
    },
  };
  const [dopo] = await passataDeiContratti([lavatrice()], stati);
  assert.equal(dopo.total_energy_entity, "");
  assert.equal(dopo.history_entity, "");
});

test("il Report e il flusso tengono il piano del contatore anche senza il suo stato", () => {
  const [senzaStato] = canonicalReportDevices([lavatrice()], [], {});
  assert.equal(senzaStato.history, "sensor.lavatrice_energia");
  assert.equal(senzaStato.entity, "sensor.lavatrice_energia");
  const [irraggiungibile] = canonicalReportDevices([lavatrice()], [], {
    "sensor.lavatrice_energia": { state: "unavailable", attributes: { restored: true } },
  });
  assert.equal(irraggiungibile.history, "sensor.lavatrice_energia");
  const [vivo] = canonicalReportDevices([lavatrice()], [], {
    "sensor.lavatrice_energia": { state: "120.4", attributes: KWH_TOTALE },
  });
  assert.equal(vivo.history, "sensor.lavatrice_energia");
});

const STATI_VIVI = { "sensor.lavatrice_energia": { state: "120.4", attributes: KWH_TOTALE } };
const OGGI = new Date(2026, 9, 12, 15, 0);

function recorder(risposta) {
  return {
    async valuesForPlans(plans) {
      if (risposta instanceof Error) throw risposta;
      return new Map(risposta == null ? [] : [[plans[0].key, risposta]]);
    },
  };
}

test("il conto di oggi tiene il numero buono quando il Recorder non risponde", async () => {
  const primo = await buildApplianceDailyBreakdown([lavatrice()], STATI_VIVI, recorder(1.25), OGGI);
  assert.equal(primo.total, 1.25);

  const caduto = await buildApplianceDailyBreakdown(
    [lavatrice()],
    STATI_VIVI,
    recorder(new Error("Home Assistant response timeout")),
    OGGI,
    primo,
  );
  assert.equal(caduto.total, 1.25, "una domanda caduta non azzera il giorno");

  const vuoto = await buildApplianceDailyBreakdown(
    [lavatrice()],
    STATI_VIVI,
    recorder(null),
    OGGI,
    caduto,
  );
  assert.equal(vuoto.total, 1.25, "una risposta vuota non azzera il giorno");

  const senzaStato = await buildApplianceDailyBreakdown(
    [lavatrice()],
    {},
    recorder(null),
    OGGI,
    vuoto,
  );
  assert.equal(senzaStato.total, 1.25, "un sensore sparito per un attimo non azzera il giorno");

  /* Quando il Recorder torna, comanda lui. */
  const tornato = await buildApplianceDailyBreakdown(
    [lavatrice()],
    STATI_VIVI,
    recorder(1.4),
    OGGI,
    senzaStato,
  );
  assert.equal(tornato.total, 1.4);
});

test("uno zero vero resta zero, e il giorno dopo non eredita niente", async () => {
  const primo = await buildApplianceDailyBreakdown([lavatrice()], STATI_VIVI, recorder(1.25), OGGI);
  const zero = await buildApplianceDailyBreakdown(
    [lavatrice()],
    STATI_VIVI,
    recorder(0),
    OGGI,
    primo,
  );
  assert.equal(zero.total, 0, "lo zero che arriva dal Recorder e' una risposta");

  const domani = new Date(2026, 9, 13, 0, 3);
  const nuovoGiorno = await buildApplianceDailyBreakdown(
    [lavatrice()],
    STATI_VIVI,
    recorder(null),
    domani,
    primo,
  );
  assert.equal(nuovoGiorno.total, 0, "i kWh di ieri non diventano quelli di oggi");
});

test("il sensore giornaliero irraggiungibile tiene l'ultimo numero di oggi", async () => {
  const frigo = {
    id: "frigo",
    name: "Frigorifero",
    daily_energy_entity: "sensor.frigo_oggi",
    metadata: {},
  };
  const oggi = (stato) => ({
    "sensor.frigo_oggi": {
      state: stato,
      attributes: { unit_of_measurement: "Wh", state_class: "total_increasing" },
    },
  });
  const primo = await buildApplianceDailyBreakdown([frigo], oggi("810"), null, OGGI);
  assert.equal(primo.total, 0.81);
  const buco = await buildApplianceDailyBreakdown([frigo], oggi("unavailable"), null, OGGI, primo);
  assert.equal(buco.total, 0.81);
  /* L'azzeramento del contatore giornaliero e' un numero vero: si mostra. */
  const azzerato = await buildApplianceDailyBreakdown([frigo], oggi("0"), null, OGGI, buco);
  assert.equal(azzerato.total, 0);
});

test("un sensore giornaliero arrivato dopo il primo conto non aspetta il minuto di riposo", async () => {
  const frigo = { id: "frigo", name: "Frigorifero", daily_energy_entity: "sensor.frigo_oggi" };
  const stati = {
    "sensor.frigo_oggi": { state: "0.81", attributes: { unit_of_measurement: "kWh" } },
  };
  /* Il primo conto, fatto prima che arrivassero gli stati. */
  const presto = await buildApplianceDailyBreakdown([frigo], {}, null, OGGI);
  assert.equal(mancaUnGiornalieroCheSiLegge(presto, [frigo], {}), false);
  assert.equal(mancaUnGiornalieroCheSiLegge(presto, [frigo], stati), true);
  const rifatto = await buildApplianceDailyBreakdown([frigo], stati, null, OGGI, presto);
  assert.equal(rifatto.total, 0.81);
  assert.equal(mancaUnGiornalieroCheSiLegge(rifatto, [frigo], stati), false);
  /* Chi passa dal Recorder tiene il suo passo: non rifa' il conto a ogni giro. */
  assert.equal(mancaUnGiornalieroCheSiLegge(presto, [lavatrice()], STATI_VIVI), false);
});

test("il giornaliero finito nel report non diventa il contatore di vita", async () => {
  const stati = {
    "sensor.fridge_today": {
      state: "0.81",
      attributes: { unit_of_measurement: "kWh", state_class: "total_increasing" },
    },
    "sensor.fridge_total": {
      state: "120.4",
      attributes: { unit_of_measurement: "kWh", state_class: "total_increasing" },
    },
  };
  const frigo = {
    id: "fridge",
    name: "Frigorifero",
    daily_energy_entity: "sensor.fridge_today",
    total_energy_entity: "sensor.fridge_total",
    entities: ["sensor.fridge_today", "sensor.fridge_total"],
    metadata: {},
  };
  /* La passata dei contratti non scrive piu' il giornaliero nel report... */
  const [dopo] = await passataDeiContratti([frigo], stati);
  assert.notEqual(dopo.report_entity, "sensor.fridge_today");
  /* ...e chi ce l'ha gia' scritto da una versione di prima tiene il suo
   * giornaliero: il contatore di vita sta nella sua casella ed e' un altro. */
  const source = applianceDailySource({ ...frigo, report_entity: "sensor.fridge_today" }, stati);
  assert.equal(source.direct, true);
  assert.equal(source.entity, "sensor.fridge_today");
});
