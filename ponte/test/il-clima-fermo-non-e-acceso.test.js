/* Il clima fermo non e' acceso.
 *
 * Dal campo: «mi arriva sempre la notifica del clima acceso, ma e' tutto
 * spento». Un termostato col programma resta in «heat» o «auto» tutto il
 * giorno: acceso per la notifica, spento per la plancia, che guarda cosa fa
 * adesso (`hvac_action`). Adesso guarda quello anche il ponte. */
import { test } from "node:test";
import assert from "node:assert/strict";

import { climaCheLavora } from "../src/sentinella.js";

const clima = (state, attributes = {}) => ({ state, attributes });

test("in «heat» ma fermo, o spento: non lavora", () => {
  assert.equal(climaCheLavora(clima("heat", { hvac_action: "idle" })), false);
  assert.equal(climaCheLavora(clima("auto", { hvac_action: "off" })), false);
  assert.equal(climaCheLavora(clima("off")), false);
  assert.equal(climaCheLavora(clima("unavailable")), false);
});

test("scalda o raffresca: lavora; senza hvac_action vale il modo", () => {
  assert.equal(climaCheLavora(clima("heat", { hvac_action: "heating" })), true);
  assert.equal(climaCheLavora(clima("cool", { hvac_action: "cooling" })), true);
  assert.equal(climaCheLavora(clima("cool")), true);
});

/* «Per il clima pero' lo da' ancora acceso»: un condizionatore spento col
 * telecomando resta in «cool» per Home Assistant. Chi ha messo la presa con
 * la soglia nella plancia lo vede spento, e adesso lo vede spento anche il
 * ponte. */
import { climaAcceso, unitaDelClima } from "../src/sentinella.js";
import { finestraClima } from "../src/l-assistente-al-telefono.js";

const UNITA = [{ entity: "climate.sala", consumo: "sensor.presa_sala", soglia_consumo: 30 }];
const watt = (n) => ({ state: String(n), attributes: { unit_of_measurement: "W" } });

test("con la presa decidono i watt, sopra o sotto la soglia", () => {
  const stati = { "sensor.presa_sala": watt(4) };
  assert.equal(
    climaAcceso("climate.sala", clima("cool"), UNITA, (id) => stati[id]),
    false,
  );
  stati["sensor.presa_sala"] = watt(850);
  assert.equal(
    climaAcceso("climate.sala", clima("cool"), UNITA, (id) => stati[id]),
    true,
  );
  /* La presa che non risponde: si torna al modo e a hvac_action. */
  stati["sensor.presa_sala"] = { state: "unavailable", attributes: {} };
  assert.equal(
    climaAcceso("climate.sala", clima("cool"), UNITA, (id) => stati[id]),
    true,
  );
  /* Senza presa, come prima. */
  assert.equal(climaAcceso("climate.altro", clima("heat", { hvac_action: "idle" }), UNITA), false);
});

test("le unita' si leggono anche scritte come testo", () => {
  assert.deepEqual(unitaDelClima({ cd_clima_units: JSON.stringify(UNITA) }), UNITA);
  assert.deepEqual(unitaDelClima({ cd_clima_units: "{rotto" }), []);
  assert.deepEqual(unitaDelClima({}), []);
});

test("finestra aperta: un termostato in «heat» ma fermo non e' un clima acceso", () => {
  const ora = 10 * 60 * 60 * 1000;
  const stati = new Map([
    [
      "binary_sensor.finestra_sala",
      { state: "on", dal: 0, attributes: { device_class: "window" } },
    ],
    ["climate.sala", { state: "heat", dal: 0, attributes: { hvac_action: "idle" } }],
  ]);
  const aree = new Map([
    ["binary_sensor.finestra_sala", "Sala"],
    ["climate.sala", "Sala"],
  ]);
  const vista = {
    ora,
    data: new Date(ora),
    stati,
    aree,
    dispositivoDi: {},
    nomiDeiDispositivi: {},
    valori: {},
    memoria: new Map(),
  };
  assert.deepEqual(finestraClima(vista), []);
  stati.set("climate.sala", { state: "heat", dal: 0, attributes: { hvac_action: "heating" } });
  assert.equal(finestraClima(vista).length, 1);
});

/* «Sul clima devi vedere il discorso termostato, e' questo il problema
 * reale.» Una valvola o un cronotermostato stanno in «heat» tutto l'inverno:
 * non e' un clima lasciato acceso. */
import { Sentinella, eUnTermostato, termostatoCheScalda } from "../src/sentinella.js";

const VALVOLA = { hvac_modes: ["off", "heat"], current_temperature: 21, temperature: 21 };

test("la valvola del termosifone e' un termostato; il condizionatore no", () => {
  assert.equal(eUnTermostato(clima("heat", VALVOLA)), true);
  assert.equal(eUnTermostato(clima("cool", { hvac_modes: ["off", "cool", "heat", "dry"] })), false);
  assert.equal(
    eUnTermostato(clima("heat", { hvac_modes: ["off", "heat", "cool"] }), { type: "termo" }),
    true,
  );
});

test("un termostato scalda solo se lo dice, o se la stanza e' sotto l'obiettivo", () => {
  assert.equal(termostatoCheScalda(clima("heat", VALVOLA)), false);
  assert.equal(termostatoCheScalda(clima("heat", { ...VALVOLA, current_temperature: 19 })), true);
  assert.equal(termostatoCheScalda(clima("heat", { ...VALVOLA, hvac_action: "heating" })), true);
  assert.equal(
    termostatoCheScalda(
      clima("heat", { ...VALVOLA, hvac_action: "idle", current_temperature: 18 }),
    ),
    false,
  );
  /* Per la regola generale una valvola in «heat» senza hvac_action era accesa. */
  assert.equal(climaAcceso("climate.valvola", clima("heat", VALVOLA)), false);
});

test("con la casa vuota la valvola che scalda non e' «clima acceso»", () => {
  const dette = [];
  const zero = Date.parse("2026-10-21T08:00:00Z");
  let ora = zero;
  const sentinella = new Sentinella({ adesso: () => ora, quando: (e) => dette.push(e) });
  sentinella.carica([
    {
      entity_id: "climate.valvola_bagno",
      state: "heat",
      attributes: { ...VALVOLA, hvac_action: "heating" },
    },
    { entity_id: "person.persona_1", state: "not_home", attributes: {} },
  ]);
  sentinella.casaVuota = () => true;
  ora = zero + 3 * 60 * 60 * 1000;
  sentinella._durate();
  assert.equal(dette.filter((e) => /clima/i.test(JSON.stringify(e))).length, 0);
});

test("il condizionatore lasciato acceso a casa vuota invece si dice", () => {
  const dette = [];
  const zero = Date.parse("2026-10-21T08:00:00Z");
  let ora = zero;
  const sentinella = new Sentinella({ adesso: () => ora, quando: (e) => dette.push(e) });
  sentinella.carica([
    {
      entity_id: "climate.sala",
      state: "cool",
      attributes: { hvac_modes: ["off", "cool", "heat"], hvac_action: "cooling" },
    },
    { entity_id: "person.persona_1", state: "not_home", attributes: {} },
  ]);
  sentinella.casaVuota = () => true;
  ora = zero + 3 * 60 * 60 * 1000;
  sentinella._durate();
  assert.ok(dette.some((e) => /clima/i.test(JSON.stringify(e))));
});
