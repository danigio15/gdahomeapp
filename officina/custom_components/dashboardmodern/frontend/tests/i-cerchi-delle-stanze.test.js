/* I cerchi del flusso Energia per stanza: la Wallbox fuori, una stanza per
 * cerchio con dentro i suoi elettrodomestici, «Altro» per chi non ha stanza,
 * niente contato due volte. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CERCHIO_ALTRO,
  CERCHI_AL_MASSIMO,
  cerchiDelleStanze,
} from "../src/core/i-cerchi-delle-stanze.js";
import { flowStageLoads, subloadsOf } from "../src/core/energy-flow-topology.js";

const STANZE = [
  { id: "cucina", name: "Cucina", icon: "mdi:stove" },
  { id: "lav", name: "Lavanderia" },
  { id: "salotto", name: "Salotto" },
];

const WALLBOX = { id: "load-wallbox", name: "Wallbox", power_entity: "sensor.wb_w", order: 0 };
const BOILER = { id: "boiler", name: "Boiler", power_entity: "sensor.boiler_w", order: 1 };
const APPARECCHI = [
  { id: "forno", name: "Forno", room_id: "cucina", power_entity: "sensor.forno_w" },
  { id: "frigo", name: "Frigo", room_id: "cucina", power_entity: "sensor.frigo_w" },
  { id: "lavatrice", name: "Lavatrice", room: "Lavanderia", power_entity: "sensor.lav_w" },
  { id: "tv", name: "TV", power_entity: "sensor.tv_w" },
];

test("senza elettrodomestici il flusso resta quello dei carichi", () => {
  const fuori = cerchiDelleStanze({ loads: [WALLBOX, BOILER], appliances: [], rooms: STANZE });
  assert.equal(fuori.perStanza, false);
  assert.deepEqual(fuori.loads, [WALLBOX, BOILER]);
  /* E nemmeno se nessun elettrodomestico ha una stanza: non c'e' niente per
   * cui raggrupparli. */
  const senzaStanze = cerchiDelleStanze({
    loads: [WALLBOX, BOILER],
    appliances: [APPARECCHI[3]],
    rooms: STANZE,
  });
  assert.equal(senzaStanze.perStanza, false);
});

test("la Wallbox resta sola, e ogni stanza e' un cerchio coi suoi elettrodomestici", () => {
  const { loads, appliances, perStanza } = cerchiDelleStanze({
    loads: [WALLBOX, BOILER],
    appliances: APPARECCHI,
    rooms: STANZE,
  });
  assert.equal(perStanza, true);
  const cerchi = flowStageLoads(loads);
  assert.deepEqual(
    cerchi.map((cerchio) => cerchio.name),
    ["Wallbox", "Cucina", "Lavanderia", "Altro"],
  );
  const figli = (nome) =>
    subloadsOf(
      cerchi.find((cerchio) => cerchio.name === nome),
      loads,
      appliances,
    ).map((voce) => voce.name);
  assert.deepEqual(figli("Cucina"), ["Forno", "Frigo"]);
  assert.deepEqual(figli("Lavanderia"), ["Lavatrice"]);
  /* Il Boiler non ha stanza: va in «Altro», con la TV. */
  assert.deepEqual(figli("Altro").sort(), ["Boiler", "TV"]);
  assert.equal(cerchi.at(-1).id, CERCHIO_ALTRO);
  /* La Wallbox non si tocca, e non ha figli nuovi. */
  assert.deepEqual(figli("Wallbox"), []);
  /* La configurazione non si scrive: gli oggetti ricevuti restano com'erano. */
  assert.equal(APPARECCHI[0].metadata, undefined);
});

test("un carico-gruppo non si conta due volte: entrano i suoi dispositivi", () => {
  const gruppo = { id: "cucina-linea", name: "Linea cucina", power_entity: "sensor.linea_w" };
  const figlio = {
    id: "piano",
    name: "Piano cottura",
    room_id: "cucina",
    power_entity: "sensor.piano_w",
    show_in_dashboard: false,
    metadata: { beta27_subload_group: "cucina-linea" },
  };
  const { loads, appliances } = cerchiDelleStanze({
    loads: [gruppo, figlio],
    appliances: [APPARECCHI[0]],
    rooms: STANZE,
  });
  const cerchi = flowStageLoads(loads);
  assert.deepEqual(
    cerchi.map((cerchio) => cerchio.name),
    ["Cucina"],
  );
  assert.deepEqual(
    subloadsOf(cerchi[0], loads, appliances)
      .map((voce) => voce.name)
      .sort(),
    ["Forno", "Piano cottura"],
  );
});

test("lo stesso apparecchio scritto come carico e come elettrodomestico vale una volta", () => {
  const doppio = { id: "forno-carico", name: "Forno", power_entity: "sensor.forno_w" };
  const { loads, appliances } = cerchiDelleStanze({
    loads: [doppio],
    appliances: [APPARECCHI[0]],
    rooms: STANZE,
  });
  const cerchi = flowStageLoads(loads);
  assert.deepEqual(
    cerchi.map((cerchio) => cerchio.name),
    ["Cucina"],
  );
  assert.deepEqual(
    subloadsOf(cerchi[0], loads, appliances).map((voce) => voce.id),
    ["forno"],
  );
});

test("le stanze in piu' dei cerchi finiscono in «Altro»", () => {
  const stanze = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, name: `Stanza ${i}` }));
  const apparecchi = stanze.map((stanza, i) => ({
    id: `a${i}`,
    name: `App ${i}`,
    room_id: stanza.id,
    power_entity: `sensor.a${i}`,
  }));
  const { loads, appliances } = cerchiDelleStanze({
    loads: [WALLBOX],
    appliances: apparecchi,
    rooms: stanze,
  });
  const cerchi = flowStageLoads(loads);
  assert.equal(cerchi.length, CERCHI_AL_MASSIMO);
  assert.equal(cerchi[0].name, "Wallbox");
  assert.equal(cerchi.at(-1).id, CERCHIO_ALTRO);
  /* Nessun elettrodomestico si perde. */
  const contati = cerchi.flatMap((cerchio) => subloadsOf(cerchio, loads, appliances));
  assert.equal(contati.length, apparecchi.length);
});

test("una stanza con tutto fermo dice zero, non un trattino", async () => {
  const { readingFor } = await import("../src/core/energy-flow-topology.js");
  const { loads, appliances } = cerchiDelleStanze({
    loads: [WALLBOX, BOILER],
    appliances: APPARECCHI,
    rooms: STANZE,
  });
  const altro = flowStageLoads(loads).find((cerchio) => cerchio.id === CERCHIO_ALTRO);
  const stati = {
    "sensor.boiler_w": { state: "0", attributes: { unit_of_measurement: "W" } },
    "sensor.tv_w": { state: "0", attributes: { unit_of_measurement: "W" } },
  };
  const lettura = readingFor(altro, subloadsOf(altro, loads, appliances), "instant", stati, null);
  assert.equal(lettura.value, 0);
});
