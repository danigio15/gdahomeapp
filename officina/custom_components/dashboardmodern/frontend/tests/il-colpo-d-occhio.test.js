/* Il «Colpo d'occhio»: una pagina sola, coi riquadri grandi che aprono il
 * loro popup — il flusso dell'energia, le telecamere, l'antifurto — e il
 * cancello che si apre con un tocco.
 *
 * Qui il modello puro: il config che si pulisce, quello di partenza (dalla
 * plancia principale o da zero) e le letture che la pagina disegna. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  MODI_AL_MASSIMO,
  RIQUADRI_AL_MASSIMO,
  TELECAMERE_AL_MASSIMO,
  flussoDellEnergia,
  modoInserito,
  occhioDiPartenza,
  occhioPulito,
  periodiDellEnergia,
  servizioDelModo,
  servizioPerAprire,
} from "../src/core/colpo-d-occhio.js";

const s = (state, unit) => ({
  state: String(state),
  attributes: unit ? { unit_of_measurement: unit } : {},
});

test("un config rotto, vuoto o scritto a mano diventa sempre un config pulito", () => {
  for (const grezzo of [null, undefined, "", "{non json", [], 42]) {
    const o = occhioPulito(grezzo);
    assert.equal(o.attiva, false);
    assert.deepEqual(o.riquadri, []);
    assert.deepEqual(o.telecamere, []);
    assert.equal(o.antifurto.centrale, "");
  }
  const o = occhioPulito(
    JSON.stringify({
      attiva: true,
      meteo: "sensor.non_meteo",
      riquadri: [{ tipo: "energia" }, { tipo: "astronave" }],
      telecamere: [
        { entity: "camera.uno", stream: "uno; rm -rf", vivo: true },
        { entity: "camera.uno" },
        { entity: "light.non_camera" },
      ],
      antifurto: { centrale: "switch.non_centrale" },
    }),
  );
  assert.equal(o.attiva, true);
  assert.equal(o.meteo, "");
  assert.deepEqual(
    o.riquadri.map((r) => r.tipo),
    ["energia"],
  );
  /* Una telecamera sola, senza stream (il nome non era valido), dal vivo. */
  assert.deepEqual(o.telecamere, [{ entity: "camera.uno", nome: "", stream: "", vivo: true }]);
  assert.equal(o.antifurto.centrale, "");
});

test("i limiti: riquadri, telecamere e modi non crescono all'infinito", () => {
  const o = occhioPulito({
    riquadri: Array.from({ length: 40 }, () => ({ tipo: "apri", entita: "switch.cancello" })),
    telecamere: Array.from({ length: 40 }, (_, i) => ({ entity: `camera.c${i}` })),
    antifurto: {
      modi: Array.from({ length: 20 }, (_, i) => ({ entita: `input_boolean.m${i}` })),
    },
  });
  assert.equal(o.riquadri.length, RIQUADRI_AL_MASSIMO);
  assert.equal(o.telecamere.length, TELECAMERE_AL_MASSIMO);
  assert.equal(o.antifurto.modi.length, MODI_AL_MASSIMO);
  assert.equal(new Set(o.riquadri.map((r) => r.id)).size, o.riquadri.length);
});

test("da zero nascono i quattro riquadri, accesi e vuoti", () => {
  const o = occhioDiPartenza(null);
  assert.equal(o.attiva, true);
  assert.deepEqual(
    o.riquadri.map((r) => r.tipo),
    ["energia", "telecamere", "antifurto", "apri"],
  );
  assert.equal(o.energia.solare, "");
  assert.deepEqual(o.telecamere, []);
});

test("dalla principale: energia, telecamere col «dal vivo», modi su misura e il cancello", () => {
  const o = occhioDiPartenza({
    meteo: "weather.casa",
    energia: {
      solare: "sensor.fv",
      casa: "sensor.casa",
      rete: "sensor.rete",
      reteGirata: true,
      potenzaBatteria: "sensor.batt_w",
      batteria: "sensor.batt_soc",
    },
    telecamere: [
      { entity: "camera.strada", name: "Strada", vivo: "true" },
      { entity: "camera.cortile", name: "Cortile" },
    ],
    antifurto: {
      suMisura: [{ entita: "input_boolean.notte", nome: "Notte", icona: "moon" }],
    },
    centrali: ["alarm_control_panel.casa"],
    azioni: [
      { name: "Apri cancello", entity: "switch.cancello" },
      { name: "Buonanotte", entity: "script.buonanotte" },
    ],
  });
  assert.equal(o.meteo, "weather.casa");
  assert.equal(o.energia.solare, "sensor.fv");
  assert.equal(o.energia.batteria, "sensor.batt_w");
  assert.equal(o.energia.soc, "sensor.batt_soc");
  assert.equal(o.energia.reteGirata, true);
  assert.deepEqual(
    o.telecamere.map((c) => [c.entity, c.nome, c.vivo]),
    [
      ["camera.strada", "Strada", true],
      ["camera.cortile", "Cortile", false],
    ],
  );
  /* I modi su misura vincono sulla centrale. */
  assert.equal(o.antifurto.centrale, "");
  assert.deepEqual(
    o.antifurto.modi.map((m) => [m.entita, m.disegno]),
    [["input_boolean.notte", "moon"]],
  );
  /* Il tasto che apre diventa un riquadro; la buonanotte no. */
  assert.deepEqual(
    o.riquadri.map((r) => [r.tipo, r.entita || ""]),
    [
      ["energia", ""],
      ["telecamere", ""],
      ["antifurto", ""],
      ["apri", "switch.cancello"],
    ],
  );
});

test("il flusso di adesso: il sole va in casa, in rete e in batteria", () => {
  const config = {
    energia: {
      solare: "sensor.fv",
      casa: "sensor.casa",
      rete: "sensor.rete",
      batteria: "sensor.batt",
      soc: "sensor.soc",
    },
  };
  const states = {
    "sensor.fv": s(3.42, "kW"),
    "sensor.casa": s(1180, "W"),
    "sensor.rete": s(-1540, "W"),
    "sensor.batt": s(-700, "W"),
    "sensor.soc": s(78, "%"),
  };
  const f = flussoDellEnergia(config, states, "adesso");
  assert.equal(f.unita, "W");
  assert.equal(f.nodi.solare, 3420);
  assert.equal(f.nodi.venduta, 1540);
  assert.equal(f.nodi.comprata, 0);
  assert.equal(f.nodi.carica, 700);
  assert.equal(f.soc, 78);
  assert.deepEqual(f.linee, {
    soleCasa: true,
    soleRete: true,
    soleBatteria: true,
    reteCasa: false,
    batteriaCasa: false,
  });
  /* Il segno girato: la stessa rete diventa un prelievo. */
  const girata = flussoDellEnergia(
    { energia: { ...config.energia, reteGirata: true } },
    states,
    "adesso",
  );
  assert.equal(girata.nodi.comprata, 1540);
  assert.equal(girata.linee.reteCasa, true);
});

test("il flusso di notte non si accende per tre watt, e chi non risponde e' «non si sa»", () => {
  const f = flussoDellEnergia(
    { energia: { solare: "sensor.fv", casa: "sensor.casa" } },
    { "sensor.fv": s(3, "W"), "sensor.casa": s("unavailable") },
    "adesso",
  );
  assert.equal(f.nodi.solare, 3);
  assert.equal(f.nodi.casa, null);
  assert.equal(f.linee.soleCasa, false);
});

test("oggi e il mese in kWh, e le linguette solo per i periodi configurati", () => {
  const config = {
    energia: {
      solare: "sensor.fv",
      giorno: { solare: "sensor.fv_oggi", casa: "sensor.casa_oggi", venduta: "sensor.venduta" },
    },
  };
  const f = flussoDellEnergia(
    config,
    {
      "sensor.fv_oggi": s(14800, "Wh"),
      "sensor.casa_oggi": s(9.3, "kWh"),
      "sensor.venduta": s(4.6, "kWh"),
    },
    "giorno",
  );
  assert.equal(f.unita, "kWh");
  assert.equal(f.nodi.solare, 14.8);
  assert.equal(f.linee.soleRete, true);
  assert.equal(f.linee.batteriaCasa, false);
  assert.deepEqual(periodiDellEnergia(config), ["adesso", "giorno"]);
  assert.deepEqual(periodiDellEnergia({}), []);
});

test("aprire e i modi: il servizio giusto per ogni dominio, e niente per quelli sconosciuti", () => {
  assert.deepEqual(servizioPerAprire("switch.cancello"), { domain: "switch", service: "turn_on" });
  assert.deepEqual(servizioPerAprire("button.porta"), { domain: "button", service: "press" });
  assert.deepEqual(servizioPerAprire("lock.porta"), { domain: "lock", service: "unlock" });
  assert.deepEqual(servizioPerAprire("cover.garage"), { domain: "cover", service: "open_cover" });
  assert.equal(servizioPerAprire("sensor.porta"), null);

  const notte = { entita: "input_boolean.notte" };
  assert.deepEqual(servizioDelModo(notte, false), { domain: "input_boolean", service: "turn_on" });
  assert.deepEqual(servizioDelModo(notte, true), { domain: "input_boolean", service: "turn_off" });
  assert.equal(servizioDelModo({ entita: "sensor.x" }, false), null);

  assert.equal(modoInserito(notte, { "input_boolean.notte": s("on") }), true);
  assert.equal(modoInserito(notte, { "input_boolean.notte": s("off") }), false);
  assert.equal(
    modoInserito(
      { entita: "script.inserisci", stato: "alarm_control_panel.casa" },
      { "alarm_control_panel.casa": s("armed_night") },
    ),
    true,
  );
});
