/* «Una sezione salute che importa i dati da una app della persona: peso,
 * passi, frequenza cardiaca, pressione, sonno» (#227), con Strava dentro
 * (#344). I sensori si riconoscono da soli, per persona. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  candidatiSalute,
  configurazioneSalute,
  durataSonno,
  fasciaPressione,
  giorniDalleStatistiche,
  misuraDelSensore,
  personeDellaSalute,
} from "../src/core/salute.js";
import { passiDellaSettimana, pesoDelMese, statiSalute } from "../e2e/helpers/salute-finto.js";
import { statiStrava } from "../e2e/helpers/strava-finto.js";

test("le misure di Health Connect e di Withings, per persona", () => {
  const persone = personeDellaSalute(statiSalute());
  assert.deepEqual(
    persone.map((p) => p.chi),
    ["Pixel 8", "Giulia"],
  );
  const [marco, giulia] = persone;
  assert.equal(personeDellaSalute(statiSalute(), { nomi: { "Pixel 8": "Marco" } })[0].nome, "Marco");
  assert.equal(marco.misure.passi.valore, 7842);
  assert.equal(marco.misure.battito.entity, "sensor.pixel_8_heart_rate");
  assert.equal(marco.misure.battitoRiposo.valore, 58);
  assert.equal(marco.misure.peso.valore, 78.4);
  assert.equal(marco.misure.sonno.valore, 452);
  assert.equal(marco.misure.ossigeno.valore, 97);
  assert.equal(marco.misure.calorie.valore, 386);
  assert.equal(marco.misure.sistolica.valore, 124);
  assert.equal(marco.misure.diastolica.valore, 81);
  assert.equal(giulia.misure.peso.valore, 61.2);
  assert.equal(giulia.misure.grasso.valore, 24.8);
  assert.equal(giulia.misure.battito.valore, 66);
  assert.equal(giulia.misure.sistolica.valore, 142);
});

test("quello che il corpo non e' resta fuori: obiettivi, stanze, pellet, Strava", () => {
  const stati = { ...statiSalute(), ...statiStrava() };
  assert.equal(misuraDelSensore("sensor.pixel_8_steps_goal", stati["sensor.pixel_8_steps_goal"]), "");
  assert.equal(misuraDelSensore("sensor.soggiorno_temperatura", stati["sensor.soggiorno_temperatura"]), "");
  assert.equal(misuraDelSensore("sensor.stufa_pellet_weight", stati["sensor.stufa_pellet_weight"]), "");
  assert.equal(misuraDelSensore("sensor.run_average_heartrate", stati["sensor.run_average_heartrate"]), "");
  assert.equal(misuraDelSensore("sensor.run_calories", stati["sensor.run_calories"]), "");
  const persone = personeDellaSalute(stati);
  assert.deepEqual(
    persone.map((p) => p.chi),
    ["Pixel 8", "Giulia"],
  );
});

test("i passi del motorino delle valvole non sono i passi di una persona", () => {
  const valvola = (nome) => ({ state: "459", attributes: { friendly_name: nome } });
  const stati = {
    "sensor.valvola_bagno_closing_steps": valvola("Valvola Bagno Closing steps"),
    "sensor.valvola_bagno_idle_steps": valvola("Valvola Bagno Idle steps"),
    "sensor.trv_cucina_opening_steps": valvola("TRV Cucina Opening steps"),
    "sensor.termostato_studio_valve_steps": valvola("Termostato Studio Valve steps"),
  };
  for (const [entity, stato] of Object.entries(stati)) assert.equal(misuraDelSensore(entity, stato), "", entity);
  assert.deepEqual(personeDellaSalute(stati), []);
  // I passi veri, senza unita', restano.
  assert.equal(
    misuraDelSensore("sensor.pixel_8_steps", { state: "459", attributes: { friendly_name: "Pixel 8 Steps" } }),
    "passi",
  );
});

test("il sonno si legge in minuti, da ore o da secondi", () => {
  const ore = { state: "7.5", attributes: { friendly_name: "Garmin Sleep duration", unit_of_measurement: "h" } };
  const secondi = { state: "27000", attributes: { friendly_name: "Fitbit Sleep time", unit_of_measurement: "s" } };
  assert.equal(personeDellaSalute({ "sensor.a_sleep_duration": ore })[0].misure.sonno.valore, 450);
  assert.equal(personeDellaSalute({ "sensor.b_sleep_time": secondi })[0].misure.sonno.valore, 450);
  assert.equal(durataSonno(452), "7 h 32");
  assert.equal(durataSonno(45), "45 min");
});

test("le scelte del Config vincono: un sensore scelto entra, «-» toglie la misura", () => {
  const stati = {
    ...statiSalute(),
    "sensor.bilancia_bagno": { state: "79.1", attributes: { friendly_name: "Bilancia bagno", unit_of_measurement: "kg" } },
  };
  const persone = personeDellaSalute(stati, { scelte: { peso: "sensor.bilancia_bagno", sonno: "-" } });
  const pesi = persone.map((p) => p.misure.peso?.entity).filter(Boolean);
  assert.deepEqual(pesi, ["sensor.bilancia_bagno"]);
  assert.ok(persone.every((p) => !p.misure.sonno));
  const candidati = candidatiSalute(stati);
  assert.deepEqual(
    candidati.peso.map((c) => c.entity),
    ["sensor.pixel_8_weight", "sensor.giulia_weight"],
  );
});

test("la configurazione e' sempre intera e senza sorprese", () => {
  assert.deepEqual(configurazioneSalute(null), { obiettivoPassi: 10000, scelte: {}, nomi: {} });
  assert.deepEqual(configurazioneSalute({ nomi: { "Pixel 8": " Marco ", x: "" } }).nomi, { "Pixel 8": "Marco" });
  assert.deepEqual(configurazioneSalute({ obiettivoPassi: "8000", scelte: { peso: "javascript:x", sonno: "-" } }), {
    obiettivoPassi: 8000,
    scelte: { sonno: "-" },
    nomi: {},
  });
  assert.equal(configurazioneSalute({ obiettivoPassi: 5 }).obiettivoPassi, 10000);
});

test("la pressione e la sua fascia", () => {
  assert.equal(fasciaPressione(124, 81), "ottimale");
  assert.equal(fasciaPressione(132, 80), "normale-alta");
  assert.equal(fasciaPressione(142, 88), "alta");
  assert.equal(fasciaPressione(85, 55), "bassa");
});

test("i giorni dalle statistiche: i passi sommati, il peso in media", () => {
  assert.deepEqual(
    giorniDalleStatistiche(passiDellaSettimana(), "total").map((g) => g.valore),
    [9120, 11480, 6305, 12940, 8770, 10215, 7842],
  );
  const peso = giorniDalleStatistiche(pesoDelMese(), "measurement");
  assert.equal(peso.length, 30);
  assert.equal(peso.at(-1).valore, 78.4);
});

test("i sensori che il ponte scrive dal telefono si leggono col nome della persona", async () => {
  const { IlCorpoDalTelefono } = await import("../../../../../ponte/src/il-corpo-dal-telefono.js");
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const stati = {};
  const casa = {
    async api(metodo, percorso, corpo) {
      const entity = percorso.replace(/^states\//, "");
      if (metodo === "POST") stati[entity] = { state: corpo.state, attributes: corpo.attributes };
      else delete stati[entity];
    },
  };
  const adesso = Date.parse("2026-10-29T10:00:00Z");
  const corpo = new IlCorpoDalTelefono({
    cartella: mkdtempSync(join(tmpdir(), "corpo-")),
    casa,
    adesso: () => adesso,
  });
  await corpo.rispondi(
    {
      id: 1,
      type: "ponte/salute/misure",
      persona: "Anna",
      misure: {
        passi: { valore: 5230, quando: "2026-10-29T09:55:00Z" },
        battito: { valore: 68, quando: "2026-10-29T09:50:00Z" },
        battitoRiposo: { valore: 55, quando: "2026-10-29T06:00:00Z" },
        peso: { valore: 64.3, quando: "2026-10-28T07:00:00Z" },
        grasso: { valore: 23.1, quando: "2026-10-28T07:00:00Z" },
        sistolica: { valore: 118, quando: "2026-10-28T21:00:00Z" },
        diastolica: { valore: 76, quando: "2026-10-28T21:00:00Z" },
        ossigeno: { valore: 98, quando: "2026-10-29T06:00:00Z" },
        sonno: { valore: 431, quando: "2026-10-29T06:40:00Z" },
        calorie: { valore: 290, quando: "2026-10-29T09:55:00Z" },
      },
    },
    { dispositivo: { id: "tel-anna", utente: "anna" } },
  );
  const [anna] = personeDellaSalute(stati);
  assert.equal(anna.chi, "Anna");
  assert.deepEqual(Object.keys(anna.misure).sort(), [
    "battito",
    "battitoRiposo",
    "calorie",
    "diastolica",
    "grasso",
    "ossigeno",
    "passi",
    "peso",
    "sistolica",
    "sonno",
  ]);
  assert.equal(anna.misure.passi.valore, 5230);
  assert.equal(anna.misure.sonno.valore, 431);
  assert.equal(anna.misure.peso.quando, "2026-10-28T07:00:00.000Z");
  assert.equal(anna.misure.passi.classe, "total_increasing");
});
