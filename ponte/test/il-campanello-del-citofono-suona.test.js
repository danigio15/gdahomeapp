/* Il campanello scelto nel Citofono della plancia fa suonare il telefono.
 *
 * Dal campo: «non riesco ancora a far suonare il telefono con il
 * campanello». Il campanello era scelto nel Citofono della plancia
 * (`cd_citofono`), ma il ponte lo riconosceva solo dal nome o dalla classe:
 * un `binary_sensor.xyz_visitor` senza classe non suonava mai. */
import { test } from "node:test";
import assert from "node:assert/strict";

import { Sentinella, suonaIlCitofono } from "../src/sentinella.js";

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });
const mezzogiorno = Date.parse("2026-10-20T12:00:00Z");

function colCitofono(stati, citofoni) {
  const dette = [];
  const sentinella = new Sentinella({ adesso: () => mezzogiorno, quando: (e) => dette.push(e) });
  sentinella.carica(stati);
  sentinella.valori = () => ({ cd_citofono: JSON.stringify({ citofoni }) });
  return { sentinella, dette };
}

test("un sensore qualunque, scelto come campanello, suona come una chiamata", () => {
  const { sentinella, dette } = colCitofono(
    [
      stato("binary_sensor.xyz_visitor", "off"),
      stato("camera.ingresso", "idle"),
      stato("camera.giardino", "idle"),
      stato("lock.portoncino", "locked"),
    ],
    [
      {
        nome: "Ingresso",
        campanello: "binary_sensor.xyz_visitor",
        telecamera: "camera.giardino",
        apri: "lock.portoncino",
      },
    ],
  );
  sentinella.cambia("binary_sensor.xyz_visitor", stato("binary_sensor.xyz_visitor", "on"));
  assert.equal(dette.length, 1);
  const [campanello] = dette;
  assert.equal(campanello.tipo, "campanello");
  assert.equal(campanello.chiamata, true);
  assert.equal(campanello.camera, "camera.giardino", "la telecamera scelta nel Citofono");
  assert.deepEqual(campanello.azioni[0].servizio, {
    dominio: "lock",
    servizio: "unlock",
    entita: ["lock.portoncino"],
  });
  /* Si spegne: non e' un altro squillo. */
  sentinella.cambia("binary_sensor.xyz_visitor", stato("binary_sensor.xyz_visitor", "off"));
  assert.equal(dette.length, 1);
});

test("un evento scelto come campanello suona a ogni pressione, mai dal non disponibile", () => {
  const { sentinella, dette } = colCitofono(
    [stato("event.portone_pressione", "unavailable")],
    [{ campanello: "event.portone_pressione" }],
  );
  sentinella.cambia(
    "event.portone_pressione",
    stato("event.portone_pressione", "2026-10-20T11:59:00Z"),
  );
  assert.equal(dette.length, 0, "tornare disponibile non e' suonare");
  sentinella.cambia(
    "event.portone_pressione",
    stato("event.portone_pressione", "2026-10-20T12:00:00Z"),
  );
  assert.equal(dette.length, 1);
  assert.equal(dette[0].tipo, "campanello");
});

test("senza Citofono si va coi nomi: anche «visitor»", () => {
  const { sentinella, dette } = colCitofono([stato("binary_sensor.reolink_visitor", "off")], []);
  sentinella.cambia("binary_sensor.reolink_visitor", stato("binary_sensor.reolink_visitor", "on"));
  assert.deepEqual(
    dette.map((e) => e.tipo),
    ["campanello"],
  );
});

test("suonaIlCitofono: quando un cambio e' uno squillo", () => {
  assert.equal(suonaIlCitofono("binary_sensor", "off", "on"), true);
  assert.equal(suonaIlCitofono("binary_sensor", "on", "off"), false);
  assert.equal(suonaIlCitofono("binary_sensor", "unavailable", "on"), false);
  assert.equal(suonaIlCitofono("button", "2026-10-20T11:00:00Z", "2026-10-20T12:00:00Z"), true);
  assert.equal(suonaIlCitofono("event", "a", "unavailable"), false);
  assert.equal(suonaIlCitofono("sensor", "idle", "ring"), true);
  assert.equal(suonaIlCitofono("sensor", "ring", "idle"), false);
});
