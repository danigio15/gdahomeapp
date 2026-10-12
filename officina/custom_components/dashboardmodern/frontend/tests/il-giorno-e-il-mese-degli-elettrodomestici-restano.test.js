/* Giornaliera e Mensile: il numero di un elettrodomestico non sparisce.
 *
 * Il paniere dei dispositivi teneva i numeri di prima solo quando cadeva
 * TUTTO l'arco. Bastava che il Recorder, per un giro, non avesse righe per
 * quel solo contatore — l'add-on che riparte, il sensore che si ricarica — e
 * il cerchio dell'elettrodomestico nella Giornaliera e nella Mensile perdeva
 * il suo numero fino al giro dopo.
 *
 * Nello stesso giorno, e nello stesso mese, un consumo gia' letto resta vero:
 * si tiene finche' non ne arriva uno nuovo. Su un altro periodo invece no:
 * «per agosto non ho niente» e' una risposta, e i kWh di settembre non si
 * scrivono sotto agosto.
 */
import assert from "node:assert/strict";
import test from "node:test";

const KWH = {
  unit_of_measurement: "kWh",
  device_class: "energy",
  state_class: "total_increasing",
};
const STATI = {
  "sensor.casa_tot": { state: "1234.5", attributes: KWH },
  "sensor.forno_tot": { state: "44.4", attributes: KWH },
};

globalThis.STATES = STATI;
globalThis._RAW_STATES = STATI;
globalThis.DashboardModernModules = {
  data: {
    canonicalReportDevices: (appliances = []) =>
      appliances.map((item) => ({
        ...item,
        entity: item.total_energy_entity,
        history: item.total_energy_entity,
        cumulative: true,
      })),
  },
  store: {
    peekSection: (nome) =>
      ({
        energy: { house: { total_energy: "sensor.casa_tot" } },
        appliances: [
          { id: "forno", name: "Forno", total_energy_entity: "sensor.forno_tot", key: "forno" },
        ],
        loads: [],
        energyLoads: [],
        entityOverrides: {},
      })[nome],
  },
};

const energia = await import("../src/sections/energy-section.js");
const runtime = globalThis.__DASHBOARDMODERN_RUNTIME_ROOT__;
const broker = globalThis.DashboardModernEnergyService.broker;

function recorderFinto({ senzaStatistiche = [] } = {}) {
  broker.cache.clear();
  broker.inflight.clear();
  broker.statistics = async (ids, start, end, period) => {
    const passo =
      period === "5minute" ? 300e3 : period === "hour" ? 3600e3 : period === "day" ? 864e5 : 26e8;
    return Object.fromEntries(
      ids.map((id) => {
        if (senzaStatistiche.includes(id)) return [id, []];
        const righe = [];
        let somma = 1000;
        for (let t = new Date(start).getTime(); t < new Date(end).getTime(); t += passo) {
          righe.push({ start: t, sum: somma });
          somma += 0.5;
        }
        return [id, righe];
      }),
    );
  };
}

const ORA_FERMA = new Date(2026, 8, 6, 14, 30);
const periodo = (data = ORA_FERMA) => ({ year: data.getFullYear(), month: data.getMonth() + 1 });

test("un giro senza righe per il contatore non toglie il numero a Giornaliera e Mensile", async () => {
  runtime.bundle = null;
  recorderFinto();
  const buono = await energia.loadAtomicEnergyBundle(periodo(), () => {}, ORA_FERMA);
  const giorno = buono.deviceDay.values.get("sensor.forno_tot");
  const mese = buono.deviceMonth.values.get("sensor.forno_tot");
  assert.ok(giorno > 0, "il giorno del forno c'e'");
  assert.ok(mese > 0, "il mese del forno c'e'");
  runtime.bundle = buono;

  recorderFinto({ senzaStatistiche: ["sensor.forno_tot"] });
  const dopo = await energia.loadAtomicEnergyBundle(periodo(), () => {}, ORA_FERMA);
  assert.equal(dopo.deviceDay.values.get("sensor.forno_tot"), giorno);
  assert.equal(dopo.deviceMonth.values.get("sensor.forno_tot"), mese);
  /* La casa, che ha risposto, va avanti col numero nuovo. */
  assert.ok(dopo.letti.day);
  runtime.bundle = null;
});

test("un altro giorno non eredita il giorno di ieri, e un altro mese non eredita niente", async () => {
  runtime.bundle = null;
  recorderFinto();
  const ieri = await energia.loadAtomicEnergyBundle(periodo(), () => {}, ORA_FERMA);
  runtime.bundle = ieri;

  recorderFinto({ senzaStatistiche: ["sensor.forno_tot"] });
  const domani = new Date(2026, 8, 7, 9, 30);
  const oggi = await energia.loadAtomicEnergyBundle(periodo(domani), () => {}, domani);
  assert.equal(oggi.deviceDay.values.has("sensor.forno_tot"), false);
  /* Il mese e' lo stesso: quello si tiene. */
  assert.equal(
    oggi.deviceMonth.values.get("sensor.forno_tot"),
    ieri.deviceMonth.values.get("sensor.forno_tot"),
  );

  runtime.bundle = ieri;
  const ottobre = new Date(2026, 9, 1, 9, 30);
  const altroMese = await energia.loadAtomicEnergyBundle(periodo(ottobre), () => {}, ottobre);
  assert.equal(altroMese.deviceMonth.values.has("sensor.forno_tot"), false);
  assert.equal(altroMese.deviceDay.values.has("sensor.forno_tot"), false);
  runtime.bundle = null;
});
