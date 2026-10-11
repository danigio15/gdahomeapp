/* Il segno di un sensore viene dal suo tipo, non dal dominio; il boiler e' un
 * boiler, non un bidone.
 *
 * «Simbolo temperatura su un sensore che è finestra, che c'entra?» — la
 * finestra dei non connessi metteva 🌡️ su ogni `sensor` e 📟 su ogni
 * `binary_sensor`, e il contatto della finestra del cucinino usciva col
 * termometro. «Idem batteria: mostra icone, non solo testo.» «Icona boiler:
 * che c'entra con il bidone?» Qui si tiene ferma la regola
 * (`core/il-tipo-del-sensore.js`), il disegno nuovo del catalogo, e che le
 * tre finestre li usino davvero.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  classeDalNome,
  tipoDelDispositivo,
  tipoDelSensore,
  tipoFraLeEntita,
} from "../src/core/il-tipo-del-sensore.js";
import { chiaveDelDisegno, disegnoDelCatalogo } from "../src/core/catalogo-disegni.js";
import { applianceGlyph } from "../src/core/appliance-artwork.js";
import { finestraDi } from "../src/sections/finestre-dei-widget.js";
import { tonoDellaPila } from "../src/sections/finestre/sicurezza.js";
import { PRESSIONE_NORMA, comeStaLaPressione } from "../src/sections/finestre/proposti.js";

test("la device_class decide il disegno, per binary_sensor e per sensor", () => {
  const casi = [
    ["binary_sensor.x", "window", "window", "finestra"],
    ["binary_sensor.x", "door", "door", "porta"],
    ["binary_sensor.x", "garage_door", "door", "porta"],
    ["binary_sensor.x", "opening", "door", "porta"],
    ["binary_sensor.x", "motion", "motion", "movimento"],
    ["binary_sensor.x", "occupancy", "motion", "movimento"],
    ["binary_sensor.x", "presence", "motion", "movimento"],
    ["binary_sensor.x", "smoke", "smoke", "fumo"],
    ["binary_sensor.x", "moisture", "humidity", "perdita"],
    ["sensor.x", "temperature", "thermometer", "temperatura"],
    ["sensor.x", "humidity", "humidity", "umidita"],
    ["sensor.x", "power", "power", "potenza"],
    ["sensor.x", "energy", "power", "potenza"],
    ["sensor.x", "battery", "battery", "batteria"],
  ];
  for (const [entity, classe, disegno, tipo] of casi) {
    assert.deepEqual(tipoDelSensore({ entity, classe }), { disegno, tipo }, `${entity} ${classe}`);
    // Ogni disegno che la regola chiede il catalogo lo sa fare.
    assert.ok(chiaveDelDisegno(disegno), disegno);
  }
});

test("un sensor senza classe non e' un termometro: e' un sensore, o quello che dice il nome", () => {
  assert.deepEqual(tipoDelSensore({ entity: "sensor.qualcosa" }), {
    disegno: "radar",
    tipo: "sensore",
  });
  assert.equal(tipoDelSensore({ entity: "sensor.x", nome: "Finestra Cucinino" }).disegno, "window");
  assert.equal(tipoDelSensore({ entity: "switch.pompa", nome: "Pompa piscina" }).disegno, "socket");
  assert.equal(tipoDelSensore({ entity: "light.salotto" }).disegno, "lights");
  assert.equal(tipoDelSensore({ entity: "water_heater.acs" }).disegno, "boiler");
  assert.equal(classeDalNome("Sensore porta ingresso"), "door");
  assert.equal(classeDalNome("Portafinestra salone"), "window");
  assert.equal(classeDalNome("Termostato bagno"), "temperature");
  assert.equal(classeDalNome("Pompa piscina"), "");
});

test("un dispositivo fatto di piu' entita' prende il segno della piu' parlante", () => {
  const states = {
    "sensor.cucinino_battery": { attributes: { device_class: "battery" } },
    "sensor.cucinino_temperature": { attributes: { device_class: "temperature" } },
    "binary_sensor.cucinino_contact": { attributes: { device_class: "window" } },
  };
  assert.equal(tipoFraLeEntita(Object.keys(states), { states }).disegno, "window");
  // La pila prende il disegno di cio' che alimenta, dai fratelli.
  const di = Object.fromEntries(Object.keys(states).map((id) => [id, "dev1"]));
  assert.equal(tipoDelDispositivo("sensor.cucinino_battery", { states, di }).tipo, "finestra");
  // Senza fratelli noti, il nome; senza nome che parli, la pila.
  assert.equal(
    tipoDelDispositivo("sensor.b", { nome: "Sensore corridoio movimento" }).tipo,
    "movimento",
  );
  assert.equal(
    tipoDelDispositivo("sensor.b", {
      states: { "sensor.b": { attributes: { device_class: "battery" } } },
      nome: "Telecomando",
    }).disegno,
    "battery",
  );
});

test("il boiler e' un disegno del catalogo, nella stessa famiglia, e non un bidone", () => {
  const boiler = disegnoDelCatalogo("boiler", 40);
  assert.match(boiler, /data-dm-art="boiler"/);
  assert.match(boiler, /class="dm-art-panel"/);
  assert.match(boiler, /fill="#0f2942"/);
  assert.equal(chiaveDelDisegno("accumulo"), "boiler");
  assert.equal(chiaveDelDisegno("solare"), "solar");
  assert.doesNotMatch(applianceGlyph("storage-boiler"), /🛢/);
});

test("non connessi: il contatto della finestra ha la finestra, non il termometro", () => {
  const markup = finestraDi("nonrisponde").disegna(
    {
      key: "nonrisponde",
      rows: [
        {
          name: "Finestra Cucinino",
          entity: "dispositivo:abc",
          entita: ["sensor.cucinino_battery", "binary_sensor.cucinino_contact"],
          da: Date.now() - 2 * 24 * 3600 * 1000,
        },
      ],
    },
    {
      "sensor.cucinino_battery": { state: "unavailable", attributes: { device_class: "battery" } },
      "binary_sensor.cucinino_contact": {
        state: "unavailable",
        attributes: { device_class: "window" },
      },
    },
  );
  assert.match(markup, /data-dm-art="window"/);
  assert.doesNotMatch(markup, /🌡|📟|data-dm-art="thermometer"/);
  assert.match(markup, /Sensore finestra/);
  assert.match(markup, /Ultimo segnale 2 giorni fa/);
  assert.match(markup, /dm-f-nonrisponde-bollino/);
});

test("batterie: pile disegnate nell'eroe, il disegno del dispositivo e la barra a pila", () => {
  const markup = finestraDi("batterie").disegna(
    {
      key: "batterie",
      soglia: 20,
      rows: [
        { entity: "sensor.corridoio", name: "Sensore corridoio movimento", level: 38 },
        { entity: "sensor.porta", name: "Porta ingresso", level: 100 },
        { entity: "sensor.telecomando", name: "Telecomando", level: 6 },
      ],
    },
    {},
  );
  assert.equal((markup.match(/class="dm-f-batterie-inpiedi"/g) || []).length, 3);
  assert.match(markup, /data-dm-art="motion"/);
  assert.match(markup, /data-dm-art="door"/);
  assert.match(markup, /data-tono="critica" data-giu="true"/);
  assert.match(markup, /Dalla più scarica/);
  assert.equal(tonoDellaPila(6, 20), "critica");
  assert.equal(tonoDellaPila(15, 20), "giu");
  assert.equal(tonoDellaPila(38, 20), "prossima");
  assert.equal(tonoDellaPila(80, 20), "carica");
});

test("solare: boiler e pannello disegnati, manometro con la norma, resistenza spiegata", () => {
  const markup = finestraDi("solare").disegna(
    {
      key: "solare",
      rows: [
        { ref: "dm.boiler_sonda_temperatura_1", raw: 71.5, value: "71,5°" },
        { ref: "dm.boiler_sonda_temperatura_3", raw: 60.5, value: "60,5°" },
        { ref: "dm.boiler_pressione_acqua", raw: 3.5, value: "3,5 bar", entity: "sensor.p" },
        { ref: "dm.boiler_potenza_resistenza_boiler", raw: 0, value: "0 W" },
        { ref: "dm.boiler_stato_pompa_solare", on: true, value: "Acceso" },
      ],
    },
    {},
  );
  assert.match(markup, /data-dm-art="boiler"/);
  assert.match(markup, /data-dm-art="solar"/);
  assert.doesNotMatch(markup, /🛢/);
  assert.match(markup, /class="dm-f-solare-manometro"/);
  assert.match(markup, /nella norma/);
  assert.match(markup, /Spenta: ci pensa il sole\./);
  // Lo storico non c'e' ancora: il manometro si', la linea no.
  assert.doesNotMatch(markup, /dm-f-solare-linea/);
  assert.equal(comeStaLaPressione(3.5), "norma");
  assert.equal(comeStaLaPressione(PRESSIONE_NORMA.min - 0.1), "bassa");
  assert.equal(comeStaLaPressione(5), "alta");
  assert.equal(comeStaLaPressione(null), "");
});
