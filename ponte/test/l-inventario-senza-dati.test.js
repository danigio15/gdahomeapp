/* L'inventario che parte verso il cruscotto dice cosa c'e' in casa, mai cosa
 * succede: stati ciechi, capacita' si', seriali e indirizzi no. */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ATTRIBUTI_CHE_VIAGGIANO,
  eUnInventario,
  inventarioSenzaDati,
  STATO_CIECO,
  statoCieco,
} from "../src/inventario.js";

const STATI = [
  {
    entity_id: "binary_sensor.porta_ingresso",
    state: "on",
    last_changed: "2026-09-20T10:00:00+00:00",
    attributes: { friendly_name: "Porta ingresso", device_class: "door", icon: "mdi:door" },
  },
  {
    entity_id: "camera.ingresso",
    state: "streaming",
    attributes: {
      friendly_name: "Ingresso",
      entity_picture: "/api/camera_proxy/camera.ingresso?token=abc",
      access_token: "abc",
      frontend_stream_type: "hls",
      brand: "Reolink",
    },
  },
  {
    entity_id: "climate.soggiorno",
    state: "heat",
    attributes: {
      friendly_name: "Soggiorno",
      current_temperature: 21.4,
      temperature: 22,
      hvac_modes: ["off", "heat", "cool"],
      min_temp: 7,
      max_temp: 30,
      supported_features: 401,
    },
  },
  {
    entity_id: "person.anna",
    state: "home",
    attributes: { friendly_name: "Anna", latitude: 45.1 },
  },
  { entity_id: "non un id", state: "x", attributes: {} },
];

test("gli stati escono ciechi: l'id e le capacita', mai il valore ne' un indirizzo", () => {
  const { stati } = inventarioSenzaDati({ stati: STATI });
  assert.equal(stati.length, 4, "un id che non e' un id non passa");
  for (const uno of stati) assert.equal(uno.state, STATO_CIECO);
  const porta = stati.find((uno) => uno.entity_id === "binary_sensor.porta_ingresso");
  assert.deepEqual(porta.attributes, {
    friendly_name: "Porta ingresso",
    device_class: "door",
    icon: "mdi:door",
  });
  const camera = stati.find((uno) => uno.entity_id === "camera.ingresso");
  assert.deepEqual(camera.attributes, {
    friendly_name: "Ingresso",
    frontend_stream_type: "hls",
    brand: "Reolink",
  });
  const clima = stati.find((uno) => uno.entity_id === "climate.soggiorno");
  assert.deepEqual(clima.attributes, {
    friendly_name: "Soggiorno",
    hvac_modes: ["off", "heat", "cool"],
    min_temp: 7,
    max_temp: 30,
    supported_features: 401,
  });
  const anna = stati.find((uno) => uno.entity_id === "person.anna");
  assert.deepEqual(anna.attributes, { friendly_name: "Anna" });
  const scritto = JSON.stringify(stati);
  for (const segreto of ["on", "streaming", "token=abc", "21.4", "home", "45.1", "last_changed"])
    assert.ok(!scritto.includes(`"${segreto}"`), `«${segreto}» non deve partire`);
  /* La lista e' chiusa, e non porta niente che sia un dato. */
  for (const dato of ["state", "entity_picture", "access_token", "current_temperature", "latitude"])
    assert.ok(!ATTRIBUTI_CHE_VIAGGIANO.includes(dato));
});

test("dei registri restano nomi, stanze e collegamenti: non seriali, indirizzi di rete o versioni", () => {
  const inventario = inventarioSenzaDati({
    entita: [
      {
        entity_id: "light.cucina",
        device_id: "d1",
        area_id: null,
        name: null,
        original_name: "Luce",
        platform: "hue",
        unique_id: "00:17:88:01:ab:cd",
        options: { conversation: { should_expose: true } },
        labels: ["cucina"],
      },
    ],
    dispositivi: [
      {
        id: "d1",
        name: "Hue bulb",
        name_by_user: "Lampada cucina",
        area_id: "cucina",
        manufacturer: "Signify",
        model: "LCT015",
        identifiers: [["hue", "abc123"]],
        connections: [["mac", "00:17:88:01:ab:cd"]],
        sw_version: "1.104.2",
        config_entries: ["ce1"],
        primary_config_entry: "ce1",
      },
    ],
    stanze: [
      { area_id: "cucina", name: "Cucina", floor_id: "terra", picture: "/local/cucina.jpg" },
    ],
    piani: [{ floor_id: "terra", name: "Piano terra", level: 0 }],
  });
  assert.deepEqual(inventario.entita, [
    {
      entity_id: "light.cucina",
      device_id: "d1",
      original_name: "Luce",
      platform: "hue",
      labels: ["cucina"],
    },
  ]);
  assert.deepEqual(inventario.dispositivi, [
    {
      id: "d1",
      name: "Hue bulb",
      name_by_user: "Lampada cucina",
      area_id: "cucina",
      manufacturer: "Signify",
      model: "LCT015",
      config_entries: ["ce1"],
      primary_config_entry: "ce1",
    },
  ]);
  assert.deepEqual(inventario.stanze, [{ area_id: "cucina", name: "Cucina", floor_id: "terra" }]);
  assert.deepEqual(inventario.piani, [{ floor_id: "terra", name: "Piano terra", level: 0 }]);
  assert.ok(eUnInventario(inventario));
  assert.equal(eUnInventario({ stati: [] }), false);
  assert.equal(eUnInventario(null), false);
});

test("quello che manca e' una lista vuota, e uno stato senza id non e' uno stato", () => {
  assert.deepEqual(inventarioSenzaDati({}), {
    stati: [],
    entita: [],
    dispositivi: [],
    stanze: [],
    piani: [],
  });
  assert.equal(statoCieco({ attributes: { friendly_name: "x" } }), null);
  assert.equal(statoCieco(null), null);
});
