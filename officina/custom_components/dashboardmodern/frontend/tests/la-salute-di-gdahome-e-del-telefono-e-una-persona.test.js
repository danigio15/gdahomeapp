/* «Però non vanno nella plancia» (Marco, iPhone, app 1.18.9): le misure di
 * Apple Salute che l'app GdAHome manda alla casa («Marco Steps», «Marco Heart
 * rate»…) e quelle che l'app di Home Assistant scrive dallo stesso iPhone
 * («iPhone di marco Steps», e i sensori con «Health» nel nome) erano tre
 * persone diverse nella pagina Salute. Sono una: Marco, con le misure di
 * GdAHome davanti e il contapassi dietro, per i giorni passati. */
import assert from "node:assert/strict";
import test from "node:test";

import { giorniUniti, padroneDelTelefono, personeDellaSalute } from "../src/core/salute.js";

const sensore = (valore, nome, unita, extra = {}, classe = "measurement") => ({
  state: String(valore),
  attributes: { friendly_name: nome, unit_of_measurement: unita, state_class: classe, ...extra },
  last_updated: "2026-11-03T14:40:00Z",
});
const daGdahome = { gdahome_persona: "Marco", misurato_il: "2026-11-03T14:41:00Z" };

/* Come sono gli stati in casa di Marco: il ponte li scrive via REST, senza
 * registro delle entita' — la pagina legge gli stati, e basta. */
export function statiDiMarco() {
  return {
    "sensor.iphone_di_marco_steps": sensore(
      1949,
      "iPhone di marco Steps",
      "steps",
      {},
      "total_increasing",
    ),
    "sensor.iphone_di_marco_health_heart_rate": sensore(
      69,
      "iPhone di marco Health Heart rate",
      "bpm",
    ),
    "sensor.gdahome_1a2b3c4d_passi": sensore(
      2410,
      "Marco Steps",
      "steps",
      daGdahome,
      "total_increasing",
    ),
    "sensor.gdahome_1a2b3c4d_battito": sensore(72, "Marco Heart rate", "bpm", daGdahome),
    "sensor.gdahome_1a2b3c4d_battito_riposo": sensore(
      69,
      "Marco Resting heart rate",
      "bpm",
      daGdahome,
    ),
    "sensor.gdahome_1a2b3c4d_peso": sensore(81.4, "Marco Weight", "kg", daGdahome),
    "sensor.gdahome_1a2b3c4d_grasso": sensore(19.2, "Marco Body fat", "%", daGdahome),
    "sensor.gdahome_1a2b3c4d_sistolica": sensore(
      124,
      "Marco Blood pressure systolic",
      "mmHg",
      daGdahome,
    ),
    "sensor.gdahome_1a2b3c4d_diastolica": sensore(
      79,
      "Marco Blood pressure diastolic",
      "mmHg",
      daGdahome,
    ),
  };
}

test("Marco e il suo iPhone sono una persona sola, con le misure di GdAHome", () => {
  const persone = personeDellaSalute(statiDiMarco());
  assert.deepEqual(
    persone.map((p) => p.chi),
    ["Marco"],
  );
  const [marco] = persone;
  assert.equal(marco.misure.passi.entity, "sensor.gdahome_1a2b3c4d_passi");
  assert.equal(marco.misure.passi.valore, 2410);
  assert.equal(marco.misure.battito.valore, 72);
  assert.equal(marco.misure.battitoRiposo.valore, 69);
  assert.equal(marco.misure.peso.valore, 81.4);
  assert.equal(marco.misure.grasso.valore, 19.2);
  assert.equal(marco.misure.sistolica.valore, 124);
  assert.equal(marco.misure.diastolica.valore, 79);
  /* Il contapassi dell'iPhone resta dietro, per i giorni passati. */
  assert.deepEqual(
    marco.misure.passi.altre.map((a) => a.entity),
    ["sensor.iphone_di_marco_steps"],
  );
  assert.deepEqual(
    marco.misure.battito.altre.map((a) => a.entity),
    ["sensor.iphone_di_marco_health_heart_rate"],
  );
});

test("le misure che GdAHome non manda arrivano dal telefono", () => {
  const stati = statiDiMarco();
  delete stati["sensor.gdahome_1a2b3c4d_passi"];
  const [marco] = personeDellaSalute(stati);
  assert.equal(marco.chi, "Marco");
  assert.equal(marco.misure.passi.entity, "sensor.iphone_di_marco_steps");
});

test("senza GdAHome il telefono resta com'era, e «Health» non e' un nome", () => {
  const stati = statiDiMarco();
  for (const id of Object.keys(stati)) if (id.startsWith("sensor.gdahome_")) delete stati[id];
  const persone = personeDellaSalute(stati);
  assert.deepEqual(
    persone.map((p) => p.chi),
    ["iPhone di marco"],
  );
  assert.equal(persone[0].misure.passi.valore, 1949);
  assert.equal(persone[0].misure.battito.valore, 69);
});

test("il telefono di un'altra persona non si mescola", () => {
  const stati = {
    ...statiDiMarco(),
    "sensor.iphone_di_giulia_steps": sensore(
      5300,
      "iPhone di Giulia Steps",
      "steps",
      {},
      "total_increasing",
    ),
  };
  assert.deepEqual(
    personeDellaSalute(stati).map((p) => p.chi),
    ["Marco", "iPhone di Giulia"],
  );
});

test("di chi e' un telefono, dal nome", () => {
  assert.equal(padroneDelTelefono("iPhone di marco"), "marco");
  assert.equal(padroneDelTelefono("iPhone 15 Pro di Marco Rossi"), "marco rossi");
  assert.equal(padroneDelTelefono("Marco's iPhone"), "marco");
  assert.equal(padroneDelTelefono("Pixel 8"), "");
});

test("i giorni del sensore nuovo coi giorni passati del contapassi", () => {
  const g = (giorno, valore) => ({ inizio: Date.UTC(2026, 10, giorno), valore });
  /* I passi: il piu' alto del giorno. */
  assert.deepEqual(
    giorniUniti([g(3, 2410)], [[g(1, 6100), g(2, 7400), g(3, 1949)]], "total_increasing"),
    [g(1, 6100), g(2, 7400), g(3, 2410)],
  );
  /* Il peso: quello del principale, gli altri dove lui non c'e'. */
  assert.deepEqual(giorniUniti([g(3, 81.4)], [[g(2, 81.9), g(3, 80)]], "measurement"), [
    g(2, 81.9),
    g(3, 81.4),
  ]);
});
