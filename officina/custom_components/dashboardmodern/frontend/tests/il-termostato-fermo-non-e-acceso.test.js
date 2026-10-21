/* «Con l'ultimo aggiornamento mi da' ancora il clima acceso. Ma il clima e'
 * spento.» Un Netatmo in «auto», in antigelo a 12 gradi con 23 in casa,
 * `hvac_action: idle`: la plancia lo contava fra le «unita' accese» — la
 * pastiglia, il widget della Home, la pagina Clima — e lo proponeva da
 * spegnere. Un termostato e' acceso quando scalda.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { climaInFunzione, eUnTermostato, termostatoCheScalda } from "../src/core/il-termostato.js";

/* Lo stato vero mandato dal tester, nome della stanza a parte. */
const NETATMO = Object.freeze({
  state: "auto",
  attributes: {
    hvac_modes: ["auto", "heat"],
    min_temp: 7,
    max_temp: 30,
    preset_modes: ["away", "boost", "frost_guard", "schedule"],
    current_temperature: 23.1,
    temperature: 12,
    hvac_action: "idle",
    preset_mode: "frost_guard",
    supported_features: 401,
  },
});

test("il Netatmo in auto fermo in antigelo non e' acceso", () => {
  assert.equal(eUnTermostato(NETATMO), true);
  assert.equal(climaInFunzione(NETATMO), false);
});

test("lo stesso Netatmo quando scalda e' acceso", () => {
  const scalda = { ...NETATMO, attributes: { ...NETATMO.attributes, hvac_action: "heating" } };
  assert.equal(climaInFunzione(scalda), true);
});

test("una valvola senza hvac_action scalda solo sotto l'obiettivo", () => {
  const valvola = {
    state: "heat",
    attributes: { hvac_modes: ["heat", "off"], current_temperature: 19, temperature: 21 },
  };
  assert.equal(termostatoCheScalda(valvola), true);
  assert.equal(
    termostatoCheScalda({
      ...valvola,
      attributes: { ...valvola.attributes, current_temperature: 21 },
    }),
    false,
  );
});

test("un condizionatore acceso resta acceso anche quando e' fermo", () => {
  const condizionatore = {
    state: "cool",
    attributes: { hvac_modes: ["off", "cool", "heat", "dry"], hvac_action: "idle" },
  };
  assert.equal(eUnTermostato(condizionatore), false);
  assert.equal(climaInFunzione(condizionatore), true);
  assert.equal(climaInFunzione({ ...condizionatore, state: "off" }), false);
  assert.equal(climaInFunzione(null), false);
});

test("un'unita' segnata «termosifone» nel Clima e' un termostato anche col freddo", () => {
  const pompa = {
    state: "heat",
    attributes: { hvac_modes: ["heat", "cool"], hvac_action: "idle" },
  };
  assert.equal(climaInFunzione(pompa), true);
  assert.equal(climaInFunzione(pompa, { type: "termo" }), false);
});

test("la Home, la pastiglia e la pagina Clima contano con la stessa regola", () => {
  const casa = readFileSync(
    new URL("../src/sections/home-widgets-section.js", import.meta.url),
    "utf8",
  );
  const pagina = readFileSync(
    new URL("../src/sections/climate-thermal-section.js", import.meta.url),
    "utf8",
  );
  const ponte = readFileSync(
    new URL("../../../../../ponte/src/sentinella.js", import.meta.url),
    "utf8",
  );
  assert.match(
    casa,
    /on: accesoPerIlConsumo\(unit, states\) \?\? climaInFunzione\(current, unit\)/,
  );
  assert.match(pagina, /filter\(\(reading\) => reading\.inFunzione\)/);
  assert.match(ponte, /core\/il-termostato\.js/);
});
