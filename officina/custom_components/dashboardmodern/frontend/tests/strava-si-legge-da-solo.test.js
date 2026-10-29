/* «Un widget con relativa pagina dedicata con grafici e storico per Strava»
 * (#344): le entita' di `ha_strava` si riconoscono da sole. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  attivitaDiStrava,
  durataStrava,
  famigliaDelloSport,
  settimaneDalleStatistiche,
  statisticheDiStrava,
  vistaDiStrava,
} from "../src/core/strava.js";
import { settimaneDellaCorsa, statiStrava } from "../e2e/helpers/strava-finto.js";

test("le attivita': una volta sola, dalla piu' nuova, con le misure", () => {
  const elenco = attivitaDiStrava(statiStrava());
  assert.deepEqual(
    elenco.map((a) => a.titolo),
    ["Corsa del mattino al parco", "Giro del lago con la squadra", "Vasche in piscina"],
  );
  const [corsa, giro] = elenco;
  assert.equal(corsa.url, "https://www.strava.com/activities/16234567890");
  assert.equal(corsa.famiglia, "run");
  assert.equal(corsa.misure.distanza.valore, 10.42);
  assert.equal(corsa.misure.tempo.testo, "52:05");
  assert.equal(corsa.misure.passo.testo, "5:00 /km");
  assert.equal(corsa.misure.battito.valore, 148);
  assert.equal(corsa.misure.battitoMax.valore, 171);
  assert.equal(corsa.misure.calorie.valore, 712);
  assert.equal(giro.misure.potenza.valore, 212);
  assert.equal(giro.famiglia, "ride");
});

test("un indirizzo che non e' di Strava non e' un'attivita'", () => {
  const stati = statiStrava();
  stati["sensor.run"].attributes.activity_url = "https://esempio.it/activities/1";
  stati["sensor.recent_activity"].attributes.activity_url = "javascript:alert(1)";
  assert.ok(!attivitaDiStrava(stati).some((a) => a.titolo === "Corsa del mattino al parco"));
});

test("le statistiche: sport, periodi, record", () => {
  const s = statisticheDiStrava(statiStrava());
  assert.equal(s.sport.run.weekly.distanza.valore, 31.6);
  assert.equal(s.sport.run.ytd.quante.valore, 162);
  assert.equal(s.sport.ride.all.dislivello.valore, 221300);
  assert.equal(s.sport.swim.recent.tempo.unita, "s");
  assert.equal(s.lunghe.giro.valore, 184.2);
  assert.equal(s.lunghe.salita.valore, 1890);
});

test("senza Strava non c'e' niente; lo sport principale e' quello piu' fatto", () => {
  assert.equal(vistaDiStrava({ "sensor.x": { state: "1", attributes: {} } }), null);
  assert.equal(vistaDiStrava(statiStrava()).principale, "run");
});

test("gli sport di Strava", () => {
  assert.equal(famigliaDelloSport("TrailRun"), "run");
  assert.equal(famigliaDelloSport("GravelRide"), "ride");
  assert.equal(famigliaDelloSport("EBikeRide"), "ride");
  assert.equal(famigliaDelloSport("Swim"), "swim");
  assert.equal(famigliaDelloSport("Yoga"), "");
});

test("le settimane dal totale di sempre", () => {
  const righe = settimaneDellaCorsa();
  assert.deepEqual(
    settimaneDalleStatistiche(righe).map((s) => s.valore),
    righe.map((r) => r.change),
  );
  /* Senza `change` si fa la differenza degli stati. */
  const senza = righe.map(({ start, state }) => ({ start, state }));
  const fatte = settimaneDalleStatistiche(senza).map((s) => Math.round(s.valore * 10) / 10);
  assert.deepEqual(
    fatte.slice(1),
    righe.slice(1).map((r) => r.change),
  );
  assert.equal(durataStrava(3125), "52 min");
  assert.equal(durataStrava(11040), "3 h 04");
});
