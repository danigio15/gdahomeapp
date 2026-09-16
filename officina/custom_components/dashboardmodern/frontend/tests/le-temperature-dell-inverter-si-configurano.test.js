/* «Manca la parte nel config per configurare le entita' di questa parte, sia
 * le temperature inverter che le ventole.»
 *
 * La scheda Temperature di Energia legge cinque alias — le tre temperature,
 * la potenza e l'interruttore della ventola — che nessuna maschera sapeva
 * riempire: restavano «IN ATTESA...» per sempre, a meno di conoscere il tab
 * Sostituzioni. Adesso il gruppo `cooling` del modello Energia li proietta
 * come tutti gli altri, la normalizzazione se lo porta dietro, e chi li aveva
 * gia' mappati a mano se li ritrova nel modello alla prima migrazione.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { COOLING_SLOT_MAP, projectEnergySlots } from "../src/core/energy-projection.js";
import { migrateEnergy, migrateState } from "../src/core/migrations.js";
import { DashboardStore } from "../src/core/dashboard-store.js";

test("il gruppo cooling si proietta sui cinque alias della scheda Temperature", () => {
  const overrides = projectEnergySlots({
    cooling: {
      inverter_ac_temperature: "sensor.inv_ac",
      inverter_dc_temperature: "sensor.inv_dc",
      battery_temperature: "sensor.bat_temp",
      fan_power: "sensor.fan_w",
      fan_switch: "switch.fan",
    },
  });
  assert.equal(overrides["dm.energy_temperatura_ac_inverter"], "sensor.inv_ac");
  assert.equal(overrides["dm.energy_temperatura_dc_inverter"], "sensor.inv_dc");
  assert.equal(overrides["dm.energy_temperatura_batteria"], "sensor.bat_temp");
  assert.equal(overrides["dm.energy_potenza_ventola_inverter"], "sensor.fan_w");
  assert.equal(overrides["dm.energy_interruttore_ventola_inverter"], "switch.fan");
});

test("svuotare un campo cooling spegne il suo alias", () => {
  const overrides = projectEnergySlots(
    { cooling: { fan_switch: "" } },
    { "dm.energy_interruttore_ventola_inverter": "switch.vecchia" },
  );
  assert.equal(overrides["dm.energy_interruttore_ventola_inverter"], undefined);
});

test("la normalizzazione del modello Energia si porta dietro cooling", () => {
  const uscita = migrateEnergy({
    house: {},
    cooling: { battery_temperature: "sensor.bat_temp" },
  });
  assert.deepEqual(uscita.cooling, { battery_temperature: "sensor.bat_temp" });
  /* E senza gruppo non ne inventa uno vuoto. */
  assert.equal("cooling" in migrateEnergy({ house: {} }), false);
});

test("gli alias mappati a mano dal tab Sostituzioni entrano nel modello, una volta sola", () => {
  const { state } = migrateState({
    schema_version: 4,
    sections: {
      energy: {},
      entityOverrides: {
        "dm.energy_temperatura_ac_inverter": "sensor.gia_mappata",
        "dm.energy_potenza_ventola_inverter": "sensor.fan_gia",
      },
    },
    visibility: {},
  });
  assert.equal(state.sections.energy.cooling.inverter_ac_temperature, "sensor.gia_mappata");
  assert.equal(state.sections.energy.cooling.fan_power, "sensor.fan_gia");
  assert.equal(state.sections.energy.metadata.cooling_migrated, true);

  /* Chi poi svuota il campo apposta non se lo vede riseminare. */
  state.sections.energy.cooling = {};
  const { state: dopo } = migrateState(state);
  assert.deepEqual(dopo.sections.energy.cooling, {});
});

test("ogni alias della scheda Temperature ha il suo campo nel gruppo", () => {
  assert.deepEqual(Object.keys(COOLING_SLOT_MAP).sort(), [
    "cooling.battery_temperature",
    "cooling.fan_power",
    "cooling.fan_switch",
    "cooling.inverter_ac_temperature",
    "cooling.inverter_dc_temperature",
  ]);
});

/* ── e la semina sopravvive all'avvio ───────────────────────────────────────
 *
 * All'avvio la plancia riconcilia le sezioni dalle chiavi legacy DOPO le
 * migrazioni, e lo faceva sostituendo la sezione intera: il gruppo `cooling`
 * appena seminato e il segno `cooling_migrated` finivano nel cestino insieme
 * al resto, e un attimo dopo `persist()` proiettava il modello ormai vuoto —
 * cancellando dal disco l'alias che era l'unica copia rimasta.
 *
 * Chi aveva mappato a mano le temperature dell'inverter se le ritrovava
 * perse, e la migrazione che doveva salvarle si rifaceva a ogni avvio senza
 * mai attecchire. Preesistente, identico almeno dalla 1.4.27.
 */

class DiscoFinto {
  constructor() {
    this.values = new Map();
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
}

const AC = "sensor.inverter_ac";

test("il cooling seminato sopravvive alle chiavi legacy dell'avvio", () => {
  const storage = new DiscoFinto();
  /* L'alias c'è, mappato a mano dal tab Sostituzioni. */
  storage.setItem(
    "cd_entity_overrides",
    JSON.stringify({ "dm.energy_temperatura_ac_inverter": AC }),
  );
  /* E la chiave legacy è quella di PRIMA della migrazione: niente `cooling`,
   * e soprattutto nessun segno. Non ha un'opinione sul raffreddamento —
   * quando è stata scritta quel campo nel modello non esisteva. */
  storage.setItem("cd_energy_model", JSON.stringify({ house: { power: "sensor.casa" } }));
  storage.setItem(
    "dm_dashboard_state",
    JSON.stringify({ schema_version: 4, sections: { energy: { house: { power: "sensor.casa" } } } }),
  );

  const store = new DashboardStore({ storage, sync: async () => {} });
  store.migrate();

  const energia = store.getState().sections.energy;
  assert.equal(energia.cooling?.inverter_ac_temperature, AC, "la semina è stata buttata via");
  assert.equal(energia.metadata?.cooling_migrated, true, "il segno non è arrivato in fondo");

  /* E soprattutto: l'alias è ancora sul disco. Era l'unica copia, e a
   * cancellarlo era il `persist()` che proietta il modello vuoto. */
  const overrides = JSON.parse(storage.getItem("cd_entity_overrides"));
  assert.equal(overrides["dm.energy_temperatura_ac_inverter"], AC, "l'alias è stato cancellato");
});

test("ma un campo svuotato dopo la migrazione resta svuotato", () => {
  /* L'altra metà, ed è quella su cui la 1.4.28 è scivolata: una lista vuota è
   * una SCELTA, non un'assenza. Chi dopo la migrazione toglie la temperatura
   * dell'inverter deve restare senza, anche se l'alias vecchio è ancora lì. */
  const storage = new DiscoFinto();
  storage.setItem(
    "cd_entity_overrides",
    JSON.stringify({ "dm.energy_temperatura_ac_inverter": AC }),
  );
  /* Il segno c'è: questa copia è stata scritta DOPO la migrazione, quindi
   * quello che dice sul raffreddamento vale. */
  storage.setItem(
    "cd_energy_model",
    JSON.stringify({
      house: { power: "sensor.casa" },
      cooling: { inverter_ac_temperature: "" },
      metadata: { cooling_migrated: true },
    }),
  );
  storage.setItem(
    "dm_dashboard_state",
    JSON.stringify({ schema_version: 4, sections: { energy: { house: { power: "sensor.casa" } } } }),
  );

  const store = new DashboardStore({ storage, sync: async () => {} });
  store.migrate();

  const energia = store.getState().sections.energy;
  assert.equal(
    String(energia.cooling?.inverter_ac_temperature || ""),
    "",
    "una scelta dell'utente è stata scavalcata dalla semina",
  );
});
