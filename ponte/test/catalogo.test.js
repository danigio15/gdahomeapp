/* Le prove del catalogo delle integrazioni: dai registri di Home Assistant al
 * menu, con la stessa forma che dava l'integrazione. */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Catalogo, costruisciIlCatalogo, DISPOSITIVI_MASSIMI } from "../src/catalogo.js";

const dispositivi = [
  {
    id: "d-lav",
    name: "Lavatrice",
    name_by_user: null,
    manufacturer: "Haier",
    model: "HW90",
    model_id: null,
    area_id: "a-bagno",
    config_entries: ["e-hon"],
    primary_config_entry: "e-hon",
    disabled_by: null,
  },
  {
    id: "d-forno",
    name: "Forno",
    name_by_user: "Forno cucina",
    manufacturer: "Bosch",
    model: null,
    model_id: "HBG",
    area_id: null,
    config_entries: ["e-hc", "e-altro"],
    primary_config_entry: null,
    disabled_by: "user",
  },
  { id: "d-vuoto", name: "Senza entita", config_entries: [], disabled_by: null },
  { id: "d-plancia", name: "Plancia", config_entries: ["e-dm"], disabled_by: null },
  {
    id: "d-orfano",
    name: "Orfano",
    config_entries: [],
    primary_config_entry: null,
    disabled_by: null,
  },
];
const entita = [
  {
    entity_id: "sensor.lavatrice_tempo",
    device_id: "d-lav",
    platform: "hon",
    name: null,
    original_name: null,
    translation_key: "remaining_time",
    disabled_by: null,
    hidden_by: null,
    entity_category: null,
  },
  {
    entity_id: "switch.lavatrice_avvio",
    device_id: "d-lav",
    platform: "hon",
    name: "Avvio",
    original_name: "Start",
    disabled_by: null,
    hidden_by: "user",
    entity_category: null,
  },
  {
    entity_id: "sensor.lavatrice_diag",
    device_id: "d-lav",
    platform: "hon",
    name: null,
    original_name: "Diagnostica",
    disabled_by: "integration",
    hidden_by: null,
    entity_category: "diagnostic",
  },
  {
    entity_id: "sensor.forno_temp",
    device_id: "d-forno",
    platform: "home_connect",
    disabled_by: null,
  },
  {
    entity_id: "sensor.plancia_x",
    device_id: "d-plancia",
    platform: "dashboardmodern",
    disabled_by: null,
  },
  { entity_id: "sensor.senza_dispositivo", device_id: null, platform: "hon", disabled_by: null },
  {
    entity_id: "sensor.orfano_1",
    device_id: "d-orfano",
    platform: "sconosciuta",
    disabled_by: null,
  },
];
const aree = [{ area_id: "a-bagno", name: "Bagno" }];
const voci = [
  { entry_id: "e-hon", domain: "hon", title: "hOn", state: "loaded" },
  { entry_id: "e-hc", domain: "home_connect", title: "Home Connect", state: "loaded" },
  { entry_id: "e-altro", domain: "altro", title: "Altro", state: "setup_error" },
  { entry_id: "e-dm", domain: "dashboardmodern", title: "DashboardModern", state: "loaded" },
];
const stati = [
  {
    entity_id: "sensor.lavatrice_tempo",
    state: "45",
    attributes: {
      friendly_name: "Lavatrice Tempo rimanente",
      unit_of_measurement: "min",
      device_class: "duration",
      state_class: "measurement",
    },
  },
  { entity_id: "sensor.forno_temp", state: "180", attributes: { friendly_name: "Temperatura" } },
];
const manifesti = [
  { domain: "hon", name: "hOn", is_built_in: false },
  { domain: "home_connect", name: "Home Connect", is_built_in: true },
  { domain: "altro", name: "Altro", is_built_in: true },
];

const registri = { dispositivi, entita, aree, voci, stati, manifesti };

test("i dispositivi: solo quelli con entita', con la loro integrazione e la stanza", () => {
  const { devices } = costruisciIlCatalogo(registri);
  assert.deepEqual(
    devices.map((uno) => uno.id),
    ["d-forno", "d-lav", "d-orfano"],
  );
  const lavatrice = devices.find((uno) => uno.id === "d-lav");
  assert.deepEqual(lavatrice, {
    id: "d-lav",
    name: "Lavatrice",
    manufacturer: "Haier",
    model: "HW90",
    integration: "hon",
    integrations: ["hon"],
    area_id: "a-bagno",
    area: "Bagno",
    entities: 2,
    disabled: false,
  });
  const forno = devices.find((uno) => uno.id === "d-forno");
  assert.equal(forno.name, "Forno cucina", "il nome dato dall'utente vince");
  assert.equal(forno.model, "HBG", "senza modello si prende l'identificativo");
  assert.equal(
    forno.integration,
    "home_connect",
    "senza voce principale, la piattaforma piu' frequente",
  );
  assert.deepEqual(forno.integrations, ["altro", "home_connect"]);
  assert.equal(forno.area, "");
  assert.equal(forno.disabled, true);
  const orfano = devices.find((uno) => uno.id === "d-orfano");
  assert.equal(orfano.integration, "sconosciuta");
});

test("le integrazioni: nome dal manifesto, custom o no, e quanti dispositivi", () => {
  const { integrations } = costruisciIlCatalogo(registri);
  assert.deepEqual(
    integrations.map((una) => una.domain),
    ["altro", "home_connect", "hon", "sconosciuta"],
  );
  const hon = integrations.find((una) => una.domain === "hon");
  assert.deepEqual(hon, {
    domain: "hon",
    name: "hOn",
    custom: true,
    entries: [{ entry_id: "e-hon", title: "hOn", state: "loaded" }],
    devices: 1,
  });
  assert.equal(integrations.find((una) => una.domain === "home_connect").custom, false);
  const sconosciuta = integrations.find((una) => una.domain === "sconosciuta");
  assert.equal(sconosciuta.name, "sconosciuta");
  assert.equal(sconosciuta.custom, null);
  assert.deepEqual(sconosciuta.entries, []);
  assert.equal(integrations.find((una) => una.domain === "altro").devices, 0);
  /* La plancia stessa non compare mai. */
  assert.equal(
    integrations.some((una) => una.domain === "dashboardmodern"),
    false,
  );
});

test("le entita' si chiedono per dispositivo, coi nomi senza il dispositivo davanti", () => {
  const senza = costruisciIlCatalogo(registri);
  assert.deepEqual(senza.entities, []);

  const { entities } = costruisciIlCatalogo({ ...registri, deviceIds: ["d-lav", "d-mai-visto"] });
  assert.deepEqual(
    entities.map((una) => una.entity_id),
    ["sensor.lavatrice_diag", "sensor.lavatrice_tempo", "switch.lavatrice_avvio"],
  );
  const tempo = entities.find((una) => una.entity_id === "sensor.lavatrice_tempo");
  assert.deepEqual(tempo, {
    entity_id: "sensor.lavatrice_tempo",
    device_id: "d-lav",
    platform: "hon",
    name: "Tempo rimanente",
    translation_key: "remaining_time",
    device_class: "duration",
    unit: "min",
    state_class: "measurement",
    category: "",
    disabled: false,
    hidden: false,
  });
  const diag = entities.find((una) => una.entity_id === "sensor.lavatrice_diag");
  assert.equal(diag.name, "Diagnostica");
  assert.equal(diag.disabled, true);
  assert.equal(diag.category, "diagnostic");
  const avvio = entities.find((una) => una.entity_id === "switch.lavatrice_avvio");
  assert.equal(avvio.name, "Avvio");
  assert.equal(avvio.hidden, true);

  /* Senza uno stato e senza un nome, resta l'identificativo leggibile. */
  const forno = costruisciIlCatalogo({ ...registri, stati: [], deviceIds: ["d-forno"] })
    .entities[0];
  assert.equal(forno.name, "forno temp");
  assert.equal(forno.unit, "");
});

test("registri mancanti o strani non fanno cadere niente", () => {
  assert.deepEqual(costruisciIlCatalogo({}), { integrations: [], devices: [], entities: [] });
  assert.deepEqual(costruisciIlCatalogo({ dispositivi: null, entita: "no", deviceIds: ["x"] }), {
    integrations: [],
    devices: [],
    entities: [],
  });
  const tanti = Array.from({ length: DISPOSITIVI_MASSIMI + 50 }, () => "d-lav");
  const { entities } = costruisciIlCatalogo({ ...registri, deviceIds: tanti });
  assert.equal(entities.length, DISPOSITIVI_MASSIMI * 3);
});

/* Una casa finta che risponde alle domande del ponte. */
function casaChe(risposte, { fallisci = [] } = {}) {
  const chieste = [];
  return {
    chieste,
    async chiedi(comando) {
      chieste.push(comando.type);
      if (fallisci.includes(comando.type)) throw new Error(`${comando.type} negato`);
      return risposte[comando.type] ?? null;
    },
  };
}

test("il catalogo chiede i registri a Home Assistant e li tiene per un po'", async () => {
  let ora = 0;
  const casa = casaChe(
    {
      "config/device_registry/list": dispositivi,
      "config/entity_registry/list": entita,
      "config/area_registry/list": aree,
      "config_entries/get": voci,
      "manifest/list": manifesti,
      get_states: stati,
    },
    { fallisci: ["config_entries/get"] },
  );
  const catalogo = new Catalogo({ casa, registro: { attenzione() {} }, adesso: () => ora });

  const primo = await catalogo.chiedi();
  assert.equal(primo.devices.length, 3);
  /* Senza le voci di configurazione il catalogo esce lo stesso: il forno va
   * sulla piattaforma piu' frequente e l'integrazione «altro» non compare. */
  assert.equal(primo.devices.find((uno) => uno.id === "d-forno").integration, "home_connect");
  assert.equal(
    primo.integrations.some((una) => una.domain === "altro"),
    false,
  );
  assert.deepEqual(primo.entities, []);
  assert.equal(
    casa.chieste.includes("get_states"),
    false,
    "senza dispositivi chiesti gli stati non servono",
  );
  const quante = casa.chieste.length;

  ora += 10_000;
  const secondo = await catalogo.chiedi({ deviceIds: ["d-lav"] });
  assert.equal(secondo.entities.length, 3);
  assert.deepEqual(casa.chieste.slice(quante), ["get_states"], "i registri erano ancora buoni");

  ora += 60_000;
  await catalogo.chiedi();
  assert.ok(casa.chieste.length > quante + 1, "dopo mezzo minuto si richiedono");
});

test("senza i registri che contano, il catalogo lo dice", async () => {
  const casa = casaChe({}, { fallisci: ["config/device_registry/list"] });
  const catalogo = new Catalogo({ casa, registro: { attenzione() {} } });
  await assert.rejects(() => catalogo.chiedi(), /negato/);
});

/* Per nome (#382): la scheda delle macchine chiede di chi sono i sensori che
 * ha trovato. Torna l'elenco di righe e basta, con la piattaforma; chi non
 * e' nel registro non c'e', e la plancia stessa non risponde per se'. */
test("le entita' chieste per nome dicono di che integrazione sono", () => {
  const risposta = costruisciIlCatalogo({
    ...registri,
    entityIds: [
      "sensor.lavatrice_tempo",
      "sensor.senza_dispositivo",
      "sensor.plancia_x",
      "binary_sensor.inventato",
      "sensor.lavatrice_tempo",
    ],
  });
  assert.deepEqual(Object.keys(risposta), ["entities"]);
  assert.deepEqual(
    risposta.entities.map((riga) => [riga.entity_id, riga.platform, riga.device_id]),
    [
      ["sensor.lavatrice_tempo", "hon", "d-lav"],
      ["sensor.senza_dispositivo", "hon", ""],
    ],
  );
  /* Il nome della riga toglie il dispositivo davanti, come per dispositivo. */
  assert.equal(risposta.entities[0].name, "Tempo rimanente");
});

test("dal filo: entity_ids si controlla e passa al catalogo", async () => {
  const { Commissioni } = await import("../src/commissioni.js");
  const chieste = [];
  const catalogo = {
    async chiedi(cosa) {
      chieste.push(cosa);
      return { entities: [] };
    },
  };
  const commissioni = new Commissioni({ casa: {}, catalogo });
  const bene = await commissioni.rispondi({
    id: 7,
    type: "dashboardmodern/integrations/catalog",
    entity_ids: ["binary_sensor.pve_lxc_101_status"],
  });
  assert.equal(bene.success, true);
  assert.deepEqual(chieste, [{ deviceIds: null, entityIds: ["binary_sensor.pve_lxc_101_status"] }]);
  const male = await commissioni.rispondi({
    id: 8,
    type: "dashboardmodern/integrations/catalog",
    entity_ids: ["x"],
  });
  assert.equal(male.success, false);
  assert.equal(male.error.code, "invalid_format");
});
