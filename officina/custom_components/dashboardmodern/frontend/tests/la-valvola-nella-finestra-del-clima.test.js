/* La valvola nelle righe della finestra del Clima (Home).
 *
 * «Poi qui sarebbe carino avere le % di apertura valvola.» La riga legge la
 * valvola come la card del Clima e il report: la casella «Valvola»
 * dell'unita' vince, se no gli attributi del termostato. In piu' una cosa
 * sola: una casella scelta che adesso non risponde si legge «—», perche' la
 * valvola c'e' anche se non parla.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { valvolaDellUnita } from "../src/sections/home-widgets-section.js";

const stati = {
  "sensor.valvola_soggiorno": { state: "64", attributes: { unit_of_measurement: "%" } },
  "sensor.valvola_bagnetto": { state: "unavailable", attributes: {} },
};

test("la casella «Valvola» dell'unita' dice la percentuale", () => {
  assert.equal(
    valvolaDellUnita(stati, { valvola: "sensor.valvola_soggiorno" }, { pi_heating_demand: 10 }),
    64,
  );
});

test("senza casella, la dice il termostato", () => {
  assert.equal(valvolaDellUnita(stati, {}, { pi_heating_demand: 30 }), 30);
  assert.equal(valvolaDellUnita(stati, {}, { valve_position: "0" }), 0);
});

test("senza valvola, niente", () => {
  assert.equal(valvolaDellUnita(stati, {}, { current_temperature: 20 }), null);
  assert.equal(valvolaDellUnita(stati, {}, {}), null);
});

test("una casella che non risponde si legge «—», non niente", () => {
  assert.equal(valvolaDellUnita(stati, { valvola: "sensor.valvola_bagnetto" }, {}), "—");
  assert.equal(valvolaDellUnita(stati, { valvola: "sensor.non_c_e" }, {}), "—");
  // Ma se il termostato la dice lo stesso, vale quella.
  assert.equal(
    valvolaDellUnita(stati, { valvola: "sensor.valvola_bagnetto" }, { valve_position: 22 }),
    22,
  );
});
