/* «In Salute ci sono distanza, piani, esercizio, ore in piedi e calorie a
 * riposo; nella plancia solo passi, battito e calorie» (Marco, iPhone con
 * Apple Watch, 4 novembre). Il ponte scrive i sensori nuovi, la pagina li
 * riconosce da sola e li mette dove Salute li mette: la strada sotto i
 * passi, l'anello Attivita' in una scheda. */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { MISURE_SALUTE, misuraDelSensore, personeDellaSalute } from "../src/core/salute.js";

const sensore = (valore, nome, unita, classe = "measurement") => ({
  state: String(valore),
  attributes: { friendly_name: nome, unit_of_measurement: unita, state_class: classe },
});

async function statiDalPonte(misure) {
  const { IlCorpoDalTelefono } = await import("../../../../../ponte/src/il-corpo-dal-telefono.js");
  const stati = {};
  const casa = {
    async api(metodo, percorso, corpo) {
      const entity = percorso.replace(/^states\//, "");
      if (metodo === "POST") stati[entity] = { state: corpo.state, attributes: corpo.attributes };
      else delete stati[entity];
    },
  };
  const adesso = Date.parse("2026-11-04T06:53:00Z");
  const corpo = new IlCorpoDalTelefono({
    cartella: mkdtempSync(join(tmpdir(), "corpo-")),
    casa,
    adesso: () => adesso,
  });
  await corpo.rispondi(
    { id: 1, type: "ponte/salute/misure", persona: "Marco", misure },
    { dispositivo: { id: "tel-marco", utente: "marco" } },
  );
  return stati;
}

test("le misure di Salute delle 07:53 arrivano tutte nella pagina, a Marco", async () => {
  const quando = "2026-11-04T06:51:00Z";
  const stati = await statiDalPonte({
    passi: { valore: 278, quando },
    distanza: { valore: 0.19, quando },
    piani: { valore: 0, quando },
    battito: { valore: 84, quando: "2026-11-04T06:44:00Z" },
    calorie: { valore: 4.6, quando },
    calorieRiposo: { valore: 678, quando: "2026-11-04T06:46:00Z" },
    esercizio: { valore: 0, quando },
    inPiedi: { valore: 1, quando: "2026-11-04T06:24:00Z" },
  });
  const [marco] = personeDellaSalute(stati);
  assert.equal(marco.chi, "Marco");
  assert.deepEqual(Object.keys(marco.misure).sort(), [
    "battito",
    "calorie",
    "calorieRiposo",
    "distanza",
    "esercizio",
    "inPiedi",
    "passi",
    "piani",
  ]);
  assert.equal(marco.misure.distanza.valore, 0.19);
  assert.equal(marco.misure.distanza.unita, "km");
  assert.equal(marco.misure.calorie.valore, 4.6);
  assert.equal(marco.misure.calorieRiposo.valore, 678);
  assert.equal(marco.misure.inPiedi.valore, 1);
  assert.equal(marco.misure.battito.quando, "2026-11-04T06:44:00.000Z");
});

test("le calorie a riposo non si scambiano con le attive, ne' col metabolismo", () => {
  assert.equal(
    misuraDelSensore("sensor.x_basal", sensore(678, "Marco Basal energy burned", "kcal", "total_increasing")),
    "calorieRiposo",
  );
  assert.equal(
    misuraDelSensore("sensor.x_attive", sensore(4.6, "Marco Active calories burned", "kcal", "total_increasing")),
    "calorie",
  );
  assert.equal(
    misuraDelSensore("sensor.pixel_bmr", sensore(1650, "Pixel 8 Basal metabolic rate", "kcal/day")),
    "",
  );
  assert.equal(
    misuraDelSensore("sensor.garmin_resting_calories", sensore(1500, "Garmin Resting calories", "kcal")),
    "calorieRiposo",
  );
});

test("la distanza e' quella a piedi, non quella da casa ne' quella dell'auto", () => {
  assert.equal(
    misuraDelSensore("sensor.a", sensore(190, "iPhone Walking distance", "m", "total_increasing")),
    "distanza",
  );
  for (const [entity, nome, unita] of [
    ["sensor.home_nearest_distance", "Home Nearest distance", "m"],
    ["sensor.waze_distance", "Lavoro Distance", "km"],
    ["sensor.tesla_odometer", "Tesla Odometer", "km"],
    ["sensor.roborock_cleaning_distance", "Roborock Cleaning distance", "m"],
    ["sensor.bici_cycling_distance", "Marco Cycling distance", "km"],
  ])
    assert.equal(misuraDelSensore(entity, sensore(4, nome, unita)), "", nome);
});

test("piani, esercizio e ore in piedi si riconoscono, anche dall'app di Home Assistant", () => {
  assert.equal(
    misuraDelSensore("sensor.iphone_floors_ascended", sensore(6, "iPhone di marco Floors ascended", "floors")),
    "piani",
  );
  assert.equal(misuraDelSensore("sensor.x", sensore(6, "Marco Flights climbed", "floors")), "piani");
  assert.equal(misuraDelSensore("sensor.x", sensore(22, "Marco Exercise time", "min")), "esercizio");
  assert.equal(misuraDelSensore("sensor.x", sensore(9, "Marco Stand hours", "h")), "inPiedi");
  /* I passi restano i passi, e i piani non sono passi. */
  assert.equal(misuraDelSensore("sensor.x", sensore(278, "Marco Steps", "steps")), "passi");
  assert.equal(misuraDelSensore("sensor.x", sensore(30, "Marco Exercise goal", "min")), "");
  assert.ok(MISURE_SALUTE.indexOf("calorieRiposo") < MISURE_SALUTE.indexOf("calorie"));
});

test("una distanza in metri o in miglia si legge in chilometri", () => {
  const [persona] = personeDellaSalute({
    "sensor.anna_walking_distance": sensore(1609.344, "Anna Walking distance", "m", "total_increasing"),
  });
  assert.equal(persona.misure.distanza.unita, "km");
  assert.ok(Math.abs(persona.misure.distanza.valore - 1.609344) < 1e-9);
  const [miglia] = personeDellaSalute({
    "sensor.bob_walking_distance": sensore(1, "Bob Walking distance", "mi", "total_increasing"),
  });
  assert.ok(Math.abs(miglia.misure.distanza.valore - 1.609344) < 1e-9);
});
