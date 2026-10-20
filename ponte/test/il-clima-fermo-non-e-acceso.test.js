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
