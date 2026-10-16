/* «Continua a dare problema, esce ancora il —.»
 *
 * Sotto Casa, nella Giornaliera, Cucina e Lavanderia contavano e il cerchio
 * del Locale tecnico restava a «—», sbiadito come un cerchio spento. Ognuna di
 * queste prove e' una configurazione vera che lo produceva:
 *
 *  1. la presa del server misura solo i watt, e il suo sensore non ha
 *     `state_class`: Home Assistant non ne compila le medie orarie, la domanda
 *     torna vuota — e il cerchio restava senza numero per sempre;
 *  2. il contatore di vita (`total_energy_entity`) non ha statistiche a lungo
 *     termine: il paniere del Recorder non lo conosce;
 *  3. il giornaliero e' «unavailable» all'avvio di Home Assistant;
 *  4. l'apparecchio dei modelli vecchi ha solo `energy_entity`, che nessuna
 *     casella del periodo leggeva;
 *  5. il giornaliero conta in Wh: non un trattino, ma mille volte tanto;
 *  6. il numero e' in viaggio (la pagina si e' appena aperta): «…», non «—»;
 *  7. un numero gia' letto oggi resta, anche se il giro dopo non arriva;
 *  8. un cerchio senza nessun sensore resta «—», ma lo dice.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { cerchiDelleStanze } from "../src/core/i-cerchi-delle-stanze.js";
import {
  domandaDellaStoria,
  kwhDallaStoriaDelContatore,
  kwhDallaStoriaDellaPotenza,
} from "../src/core/kwh-dalla-potenza.js";
import { flowStageModel, fonteDiRipiego, haUnSensore } from "../src/core/energy-flow-topology.js";

const ORA = 3600;
/* Oggi alle 15:00, ora di casa. */
const ADESSO = new Date(2026, 9, 13, 15, 0).getTime();
const MEZZANOTTE = new Date(2026, 9, 13, 0, 0).getTime();
const alle = (ore) => MEZZANOTTE / 1000 + ore * ORA;

const STANZE = [
  { id: "cucina", name: "Cucina", icon: "mdi:stove" },
  { id: "locale_tecnico", name: "Locale tecnico", icon: "mdi:wrench" },
];
const FRIGO = {
  id: "frigo",
  name: "Frigo",
  room_id: "cucina",
  power_entity: "sensor.frigo_w",
  daily_energy_entity: "sensor.frigo_oggi",
};

function scena(server, { states = {}, recorderValues = null, ...resto } = {}) {
  const { loads, appliances } = cerchiDelleStanze({
    appliances: [FRIGO, server],
    rooms: STANZE,
  });
  return flowStageModel({
    loads,
    appliances,
    period: "day",
    states: {
      "sensor.frigo_oggi": { state: "0.8", attributes: { unit_of_measurement: "kWh" } },
      ...states,
    },
    recorderValues,
    ...resto,
  });
}
const cerchio = (model, nome) => model.nodes.find((nodo) => nodo.name === nome);

/* ── le regole pure ─────────────────────────────────────────────────────── */

test("la storia della potenza diventa kilowattora: ogni valore vale fino al cambio dopo", () => {
  const risposta = {
    "sensor.server_w": [
      { s: "40", lu: alle(-2) }, // lo stato a mezzanotte, cominciato prima
      { s: "unavailable", lu: alle(6) },
      { s: "60", lu: alle(7) },
    ],
  };
  /* 40 W per 6 ore (da mezzanotte) + niente per un'ora + 60 W per 8 ore. */
  const kwh = kwhDallaStoriaDellaPotenza(risposta, "sensor.server_w", "W", MEZZANOTTE, ADESSO);
  assert.ok(Math.abs(kwh - (0.24 + 0.48)) < 1e-9, String(kwh));
  /* In kW la stessa storia vale mille volte tanto. */
  const inKw = kwhDallaStoriaDellaPotenza(
    { x: [{ s: "0.5", lu: alle(0) }] },
    "x",
    "kW",
    MEZZANOTTE,
    ADESSO,
  );
  assert.equal(inKw, 7.5);
  /* Una potenza ferma a zero tutto il giorno e' zero, non un trattino. */
  assert.equal(
    kwhDallaStoriaDellaPotenza({ x: [{ s: "0", lu: alle(-1) }] }, "x", "W", MEZZANOTTE, ADESSO),
    0,
  );
  /* Niente storia: non si sa. */
  assert.equal(kwhDallaStoriaDellaPotenza({}, "x", "W", MEZZANOTTE, ADESSO), null);
  assert.equal(
    kwhDallaStoriaDellaPotenza(
      { x: [{ s: "unavailable", lu: alle(1) }] },
      "x",
      "W",
      MEZZANOTTE,
      ADESSO,
    ),
    null,
  );
});

test("la storia di un contatore e' la sua crescita, anche attraverso l'azzeramento", () => {
  /* Un totale di vita in Wh: da 1.234.000 a 1.235.500 Wh = 1,5 kWh. */
  const totale = {
    "sensor.server_totale": [
      { s: "1234000", lu: alle(0) },
      { s: "unavailable", lu: alle(2) },
      { s: "1234800", lu: alle(3) },
      { s: "1234790", lu: alle(4) }, // un ritocco del sensore, non un consumo
      { s: "1235500", lu: alle(5) },
    ],
  };
  assert.ok(
    Math.abs(kwhDallaStoriaDelContatore(totale, "sensor.server_totale", "Wh") - 1.5) < 1e-9,
  );
  /* Un giornaliero che a mezzanotte e' ancora sul numero di ieri e poi riparte. */
  const giornaliero = {
    "sensor.server_oggi": [
      { s: "5.2", lu: alle(-0.01) },
      { s: "0", lu: alle(0.01) },
      { s: "0.4", lu: alle(4) },
      { s: "1.1", lu: alle(12) },
    ],
  };
  assert.ok(Math.abs(kwhDallaStoriaDelContatore(giornaliero, "sensor.server_oggi") - 1.1) < 1e-9);
  /* Fermo tutto il giorno: zero, che e' un numero vero. */
  assert.equal(kwhDallaStoriaDelContatore({ x: [{ s: "42", lu: alle(-3) }] }, "x"), 0);
  assert.equal(kwhDallaStoriaDelContatore({ x: [] }, "x"), null);
});

test("la domanda della storia parte da mezzanotte e chiede tutti i cambi", () => {
  const domanda = domandaDellaStoria(["sensor.a", "sensor.a", "sensor.b"], "day", ADESSO);
  assert.equal(domanda.type, "history/history_during_period");
  assert.deepEqual(domanda.entity_ids, ["sensor.a", "sensor.b"]);
  assert.equal(domanda.start_time, new Date(MEZZANOTTE).toISOString());
  assert.equal(domanda.include_start_time_state, true);
  assert.equal(domanda.significant_changes_only, false);
});

test("la fonte di ripiego: prima un contatore d'energia, poi la potenza", () => {
  const W = { attributes: { unit_of_measurement: "W" } };
  assert.deepEqual(fonteDiRipiego({ power_entity: "sensor.server_w" }, "day"), {
    kind: "potenza",
    entity: "sensor.server_w",
  });
  assert.deepEqual(
    fonteDiRipiego(
      { power_entity: "sensor.server_w", total_energy_entity: "sensor.server_totale" },
      "day",
    ),
    { kind: "contatore", entity: "sensor.server_totale" },
  );
  assert.deepEqual(fonteDiRipiego({ energy_entity: "sensor.server_kwh" }, "month"), {
    kind: "contatore",
    entity: "sensor.server_kwh",
  });
  /* Una casella d'energia che punta a un sensore in watt: si contano i watt. */
  assert.deepEqual(
    fonteDiRipiego({ daily_energy_entity: "sensor.x_w" }, "day", { "sensor.x_w": W }),
    { kind: "potenza", entity: "sensor.x_w" },
  );
  /* I modelli vecchi con la sola lista di entita'. */
  assert.deepEqual(
    fonteDiRipiego({ entities: ["sensor.x_temp", "sensor.x_w"] }, "day", {
      "sensor.x_temp": { attributes: { unit_of_measurement: "°C" } },
      "sensor.x_w": W,
    }),
    { kind: "potenza", entity: "sensor.x_w" },
  );
  assert.equal(fonteDiRipiego({ name: "Solo un nome" }, "day"), null);
  assert.equal(fonteDiRipiego({ power_entity: "sensor.x" }, "instant"), null);
  assert.equal(haUnSensore({ name: "Solo un nome" }), false);
  assert.equal(haUnSensore({ energy_entity: "sensor.x" }), true);
});

/* ── il cerchio del Locale tecnico ──────────────────────────────────────── */

test("1. solo la potenza, senza medie orarie: il numero ricavato dalla storia arriva al cerchio", () => {
  const server = {
    id: "server",
    name: "Server",
    room_id: "locale_tecnico",
    power_entity: "sensor.server_w",
  };
  /* Prima: nessun numero dal Recorder, ed era il trattino. */
  const prima = scena(server);
  assert.equal(cerchio(prima, "Cucina").text, "0,8 kWh");
  assert.equal(cerchio(prima, "Locale tecnico").text, "—");
  /* Dopo: i kilowattora contati dalla storia arrivano per id dell'apparecchio. */
  const dopo = scena(server, { recorderValues: { server: 0.72 } });
  assert.equal(cerchio(dopo, "Locale tecnico").text, "0,7 kWh");
  assert.equal(cerchio(dopo, "Locale tecnico").value, 0.72);
});

test("5. il giornaliero in Wh si legge in kWh, non mille volte tanto", () => {
  const server = {
    id: "server",
    name: "Server",
    room_id: "locale_tecnico",
    daily_energy_entity: "sensor.server_oggi_wh",
  };
  const model = scena(server, {
    states: {
      "sensor.server_oggi_wh": { state: "1100", attributes: { unit_of_measurement: "Wh" } },
    },
  });
  assert.equal(cerchio(model, "Locale tecnico").text, "1,1 kWh");
});

test("6. mentre il numero e' in viaggio il cerchio dice «…», non «—»", () => {
  const server = {
    id: "server",
    name: "Server",
    room_id: "locale_tecnico",
    power_entity: "sensor.server_w",
  };
  const model = scena(server, { inAttesa: new Set(["server"]) });
  const nodo = cerchio(model, "Locale tecnico");
  assert.equal(nodo.text, "…");
  assert.equal(nodo.waiting, true);
  assert.equal(nodo.value, null);
  /* Nell'istantanea non si aspetta niente: i watt sono gli stati vivi. */
  const istante = flowStageModel({
    loads: [{ id: "x", name: "X", power_entity: "sensor.x_w" }],
    period: "instant",
    inAttesa: new Set(["x"]),
  });
  assert.equal(istante.nodes[0].text, "—");
});

test("7. un numero gia' letto oggi resta finche' non ne arriva uno nuovo", () => {
  const server = {
    id: "server",
    name: "Server",
    room_id: "locale_tecnico",
    daily_energy_entity: "sensor.server_oggi",
  };
  /* Home Assistant riparte: il giornaliero e' «unavailable». */
  const states = { "sensor.server_oggi": { state: "unavailable" } };
  const ricordati = { "stanza-locale_tecnico": 1.1 };
  const model = scena(server, { states, ricordati });
  assert.equal(cerchio(model, "Locale tecnico").text, "1,1 kWh");
  /* Il numero nuovo vince su quello ricordato. */
  const nuovo = scena(server, {
    states: { "sensor.server_oggi": { state: "1.3" } },
    ricordati,
  });
  assert.equal(cerchio(nuovo, "Locale tecnico").text, "1,3 kWh");
});

test("8. un cerchio senza nessun sensore resta «—», e lo dice", () => {
  const model = flowStageModel({
    loads: [
      { id: "a", name: "A", power_entity: "sensor.a_w", order: 0 },
      { id: "b", name: "Solo un nome", order: 1 },
    ],
    period: "day",
    inAttesa: new Set(["b"]),
  });
  assert.equal(model.nodes[1].text, "—");
  assert.equal(model.nodes[1].sensore, false);
  assert.equal(model.nodes[1].waiting, false);
  assert.equal(model.nodes[0].sensore, true);
});

/* ── la sezione: chi chiede cosa al Recorder ─────────────────────────────── */

globalThis.localStorage = {
  valori: new Map(),
  getItem(chiave) {
    return this.valori.has(chiave) ? this.valori.get(chiave) : null;
  },
  setItem(chiave, valore) {
    this.valori.set(chiave, String(valore));
  },
  removeItem(chiave) {
    this.valori.delete(chiave);
  },
};
const sezione = await import("../src/sections/energy-flow-section.js");

/* Un Recorder di prova: le medie orarie solo per chi le ha, la storia per
 * tutti. Tiene le domande, per vedere chi e' stato chiesto. */
function recorderDiProva({ medie = {}, storia = {} }) {
  const domande = [];
  globalThis.DashboardModernEnergyService = {
    broker: {
      request(domanda) {
        domande.push(domanda);
        if (domanda.type === "recorder/statistics_during_period")
          return Promise.resolve(
            Object.fromEntries(
              domanda.statistic_ids.filter((id) => medie[id]).map((id) => [id, medie[id]]),
            ),
          );
        if (domanda.type === "history/history_during_period")
          return Promise.resolve(
            Object.fromEntries(
              domanda.entity_ids.filter((id) => storia[id]).map((id) => [id, storia[id]]),
            ),
          );
        return Promise.reject(new Error("domanda inattesa"));
      },
    },
  };
  return domande;
}
const unGiro = () => new Promise((fatto) => setTimeout(fatto, 0));
/* Una storia che dice 100 W da mezzanotte: a qualunque ora, piu' di zero. */
const CENTO_WATT = [{ s: "100", lu: Date.now() / 1000 - 30 * 24 * ORA }];

test("la sezione: senza medie orarie la potenza si conta dalla storia (1)", async () => {
  globalThis.__HASS__ = {
    states: { "sensor.lt_server_w": { state: "100", attributes: { unit_of_measurement: "W" } } },
  };
  const domande = recorderDiProva({ storia: { "sensor.lt_server_w": CENTO_WATT } });
  const server = { id: "lt_server", name: "Server", power_entity: "sensor.lt_server_w" };
  sezione.kwhDelPeriodo([server], "day");
  await unGiro();
  await unGiro();
  const valori = sezione.kwhDelPeriodo([server], "day");
  assert.ok(valori.lt_server > 0, JSON.stringify(valori));
  assert.deepEqual(
    domande.map((domanda) => domanda.type),
    ["recorder/statistics_during_period", "history/history_during_period"],
  );
});

test("la sezione: il totale senza statistiche si conta dalla sua crescita (2)", async () => {
  globalThis.__HASS__ = {
    states: {
      "sensor.lt_ups_totale": {
        state: "820.5",
        attributes: { unit_of_measurement: "kWh", state_class: "total_increasing" },
      },
    },
  };
  /* Il primo paniere del Recorder e' arrivato, ma di questo contatore non sa niente. */
  globalThis.dispatchEvent?.(new CustomEvent("dashboardmodern:period-bundle", { detail: {} }));
  const domande = recorderDiProva({
    storia: {
      "sensor.lt_ups_totale": [
        { s: "819.2", lu: Date.now() / 1000 - 3 * ORA },
        { s: "820.5", lu: Date.now() / 1000 - 60 },
      ],
    },
  });
  const ups = {
    id: "lt_ups",
    name: "UPS",
    power_entity: "sensor.lt_ups_w",
    total_energy_entity: "sensor.lt_ups_totale",
  };
  sezione.kwhDelPeriodo([ups], "month");
  await unGiro();
  await unGiro();
  const valori = sezione.kwhDelPeriodo([ups], "month");
  assert.ok(Math.abs(valori.lt_ups - 1.3) < 1e-9, JSON.stringify(valori));
  assert.deepEqual(
    domande.map((domanda) => domanda.type),
    ["history/history_during_period"],
  );
});

test("la sezione: il giornaliero «unavailable» all'avvio si legge dalla storia (3)", async () => {
  globalThis.__HASS__ = { states: { "sensor.lt_nas_oggi": { state: "unavailable" } } };
  recorderDiProva({
    storia: {
      "sensor.lt_nas_oggi": [
        { s: "0", lu: Date.now() / 1000 - 2 * ORA },
        { s: "0.6", lu: Date.now() / 1000 - ORA },
        { s: "unavailable", lu: Date.now() / 1000 - 10 },
      ],
    },
  });
  const nas = { id: "lt_nas", name: "NAS", daily_energy_entity: "sensor.lt_nas_oggi" };
  sezione.kwhDelPeriodo([nas], "day");
  await unGiro();
  await unGiro();
  assert.ok(Math.abs(sezione.kwhDelPeriodo([nas], "day").lt_nas - 0.6) < 1e-9);
});

test("la sezione: la sola `energy_entity` dei modelli vecchi conta anche lei (4)", async () => {
  globalThis.__HASS__ = {
    states: {
      "sensor.lt_router_kwh": { state: "3.4", attributes: { unit_of_measurement: "kWh" } },
    },
  };
  recorderDiProva({
    storia: {
      "sensor.lt_router_kwh": [
        { s: "3.0", lu: Date.now() / 1000 - 2 * ORA },
        { s: "3.4", lu: Date.now() / 1000 - 60 },
      ],
    },
  });
  const router = { id: "lt_router", name: "Router", energy_entity: "sensor.lt_router_kwh" };
  sezione.kwhDelPeriodo([router], "day");
  await unGiro();
  await unGiro();
  assert.ok(Math.abs(sezione.kwhDelPeriodo([router], "day").lt_router - 0.4) < 1e-9);
});

test("la sezione: chi ha un contatore che risponde non fa domande in piu'", async () => {
  globalThis.__HASS__ = {
    states: {
      "sensor.lt_frigo_oggi": { state: "0.8", attributes: { unit_of_measurement: "kWh" } },
    },
  };
  const domande = recorderDiProva({});
  const frigo = {
    id: "lt_frigo",
    name: "Frigo",
    power_entity: "sensor.lt_frigo_w",
    daily_energy_entity: "sensor.lt_frigo_oggi",
  };
  sezione.kwhDelPeriodo([frigo], "day");
  await unGiro();
  assert.deepEqual(domande, []);
});

test("la sezione: una storia che non arriva non butta via le medie gia' arrivate", async () => {
  globalThis.__HASS__ = { states: {} };
  globalThis.DashboardModernEnergyService = {
    broker: {
      request(domanda) {
        if (domanda.type === "recorder/statistics_during_period")
          return Promise.resolve({ "sensor.lt_forno_w": [{ mean: 1000 }] });
        return Promise.reject(new Error("Home Assistant response timeout"));
      },
    },
  };
  const forno = { id: "lt_forno", power_entity: "sensor.lt_forno_w" };
  const boiler = { id: "lt_boiler", power_entity: "sensor.lt_boiler_w" };
  sezione.kwhDelPeriodo([forno, boiler], "day");
  await unGiro();
  await unGiro();
  assert.deepEqual(sezione.kwhDelPeriodo([forno, boiler], "day"), { lt_forno: 1 });
});
