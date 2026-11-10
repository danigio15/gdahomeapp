/* «Il sensore che si mette per riattivare lo standby del tablet a volte non
 * risponde e non riattiva lo schermo. Lo fa un po' come gli pare.»
 *
 * Il pannello si svegliava solo all'evento del sensore che diventa «on». Un
 * sensore di presenza resta «on» finche' qualcuno c'e', e il riposo arrivava
 * lo stesso: chi tornava davanti al tablet non faceva un «on» nuovo, e lo
 * schermo restava spento. */
import assert from "node:assert/strict";
import test from "node:test";
import { cambioDelRisveglio, cosaFaIlRisveglio } from "../src/core/plancia-a-muro.js";

const SENSORE = "binary_sensor.presenza_ingresso";
const muro = { risveglio: { attivo: true, entita: SENSORE } };
const stati = (state, last_changed) => ({ [SENSORE]: { state, last_changed } });
const ALLE_10 = "2026-11-09T22:10:00.000+00:00";
const ALLE_12 = "2026-11-09T22:12:00.000+00:00";

test("finche' il sensore dice che c'e' qualcuno il riposo non arriva", () => {
  assert.equal(cosaFaIlRisveglio(muro, stati("on", ALLE_10), { riposo: false }), "resta");
  assert.equal(cosaFaIlRisveglio(muro, stati("off", ALLE_10), { riposo: false }), "");
});

test("a riposo, un «on» nuovo sveglia anche se l'evento non e' arrivato", () => {
  /* A riposo col sensore spento: si ricorda quel cambio. */
  const ricordo = cambioDelRisveglio(muro, stati("off", ALLE_10));
  assert.equal(ricordo, ALLE_10);
  assert.equal(cosaFaIlRisveglio(muro, stati("off", ALLE_10), { riposo: true, cambioAlRiposo: ricordo }), "");
  assert.equal(
    cosaFaIlRisveglio(muro, stati("on", ALLE_12), { riposo: true, cambioAlRiposo: ricordo }),
    "sveglia",
  );
});

test("un riposo chiesto a sensore acceso non si sveglia finche' il sensore non cambia", () => {
  const ricordo = cambioDelRisveglio(muro, stati("on", ALLE_10));
  assert.equal(cosaFaIlRisveglio(muro, stati("on", ALLE_10), { riposo: true, cambioAlRiposo: ricordo }), "");
  assert.equal(
    cosaFaIlRisveglio(muro, stati("on", ALLE_12), { riposo: true, cambioAlRiposo: ricordo }),
    "sveglia",
  );
});

test("senza «Si sveglia da solo» il sensore non conta", () => {
  const spento = { risveglio: { attivo: false, entita: SENSORE } };
  assert.equal(cosaFaIlRisveglio(spento, stati("on", ALLE_12), { riposo: true }), "");
  assert.equal(cosaFaIlRisveglio(spento, stati("on", ALLE_12), { riposo: false }), "");
  assert.equal(cambioDelRisveglio(spento, stati("on", ALLE_12)), "");
  assert.equal(cosaFaIlRisveglio(null, {}, {}), "");
});
