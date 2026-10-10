/* I kilowattora di oggi e del mese, dalle medie orarie della potenza. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  domandaDeiKwhDallaPotenza,
  inizioDelPeriodo,
  kwhDallaPotenza,
} from "../src/core/kwh-dalla-potenza.js";

test("la domanda parte da mezzanotte, o dal primo del mese, e chiede le medie orarie", () => {
  const adesso = new Date(2026, 9, 10, 15, 30).getTime();
  const giorno = domandaDeiKwhDallaPotenza(["sensor.forno_w", "sensor.forno_w"], "day", adesso);
  assert.equal(giorno.type, "recorder/statistics_during_period");
  assert.deepEqual(giorno.statistic_ids, ["sensor.forno_w"]);
  assert.equal(giorno.period, "hour");
  assert.deepEqual(giorno.types, ["mean"]);
  assert.equal(giorno.start_time, new Date(2026, 9, 10, 0, 0).toISOString());
  assert.equal(inizioDelPeriodo("month", adesso).getTime(), new Date(2026, 9, 1).getTime());
});

test("un'ora a 1000 W di media e' un kilowattora", () => {
  const risposta = {
    "sensor.forno_w": [{ mean: 1000 }, { mean: 500 }, { mean: null }, { mean: -20 }],
  };
  assert.equal(kwhDallaPotenza(risposta, "sensor.forno_w"), 1.5);
  /* In kW la stessa ora vale mille volte tanto. */
  assert.equal(kwhDallaPotenza({ "sensor.x": [{ mean: 2 }] }, "sensor.x", "kW"), 2);
  /* Niente dal Recorder: non si sa, e non e' zero. */
  assert.equal(kwhDallaPotenza({}, "sensor.forno_w"), null);
});
