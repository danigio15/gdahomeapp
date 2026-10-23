/* «I dispositivi non connessi non escono tutti, non c'è possibilità di
 * inserimento e di ricerca, inoltre mi devi mettere che dispositivo è.»
 *
 * L'elenco guardava solo le entità scritte nella configurazione della plancia:
 * un dispositivo che la plancia non mostra non c'era. Adesso ci sono tutti i
 * dispositivi di Home Assistant (aiutanti, automazioni e script restano fuori
 * come prima), e di ognuno si dice il tipo e marca e modello. */
import assert from "node:assert/strict";
import test from "node:test";

import { iDispositiviScollegati, mettiDaParte } from "../src/core/i-dispositivi-scollegati.js";
import {
  dispositiviDaiRegistri,
  marcaEModello,
} from "../src/core/i-dispositivi-di-home-assistant.js";

const muto = (nome, attributi = {}) => ({
  state: "unavailable",
  attributes: { friendly_name: nome, ...attributi },
  last_changed: "2026-10-23T08:00:00Z",
});
const vivo = (nome, attributi = {}) => ({
  state: "on",
  attributes: { friendly_name: nome, ...attributi },
});

const STATI = {
  "climate.camera_da_letto": muto("Camera da Letto"),
  "switch.presa_cantina": muto("Presa cantina"),
  "binary_sensor.finestra_bagno": muto("Finestra bagno", { device_class: "window" }),
  "sensor.finestra_bagno_batteria": muto("Finestra bagno batteria", { device_class: "battery" }),
  "light.salotto": vivo("Salotto"),
  "input_boolean.vacanze": muto("Vacanze"),
};
const DI = {
  "climate.camera_da_letto": "d-clima",
  "switch.presa_cantina": "d-presa",
  "binary_sensor.finestra_bagno": "d-finestra",
  "sensor.finestra_bagno_batteria": "d-finestra",
  "light.salotto": "d-luce",
};
const NOMI = {
  "d-clima": "Camera da Letto",
  "d-presa": "Presa cantina",
  "d-finestra": "Finestra bagno",
};
const MODELLI = { "d-clima": "Daikin FTXM25R", "d-presa": "Shelly Plug S" };

test("ci sono tutti i dispositivi della casa, anche quelli che la plancia non mostra", () => {
  const { adesso } = iDispositiviScollegati({
    /* La configurazione parla solo del clima. */
    configurate: ["climate.camera_da_letto"],
    states: STATI,
    di: DI,
    nomi: NOMI,
    modelli: MODELLI,
  });
  assert.deepEqual(
    adesso.map((una) => una.nome),
    ["Camera da Letto", "Finestra bagno", "Presa cantina"],
  );
  /* L'aiutante non e' un dispositivo, e la luce risponde. */
  assert.equal(
    adesso.some((una) => una.entita.includes("input_boolean.vacanze")),
    false,
  );
});

test("di ognuno si dice che cos'e': il tipo e marca e modello", () => {
  const { adesso } = iDispositiviScollegati({
    states: STATI,
    di: DI,
    nomi: NOMI,
    modelli: MODELLI,
  });
  const per = Object.fromEntries(adesso.map((una) => [una.nome, una]));
  assert.equal(per["Camera da Letto"].tipo.tipo, "clima");
  assert.equal(per["Camera da Letto"].modello, "Daikin FTXM25R");
  assert.equal(per["Presa cantina"].tipo.tipo, "presa");
  assert.equal(per["Presa cantina"].modello, "Shelly Plug S");
  /* Fra il contatto e la pila vince il contatto: e' una finestra. */
  assert.equal(per["Finestra bagno"].tipo.tipo, "finestra");
  assert.equal(per["Finestra bagno"].modello, "");
});

test("quelli tolti dall'avviso hanno anche loro tipo e modello", () => {
  const escluse = mettiDaParte([], ["switch.presa_cantina"]);
  const { adesso, messiDaParte } = iDispositiviScollegati({
    states: STATI,
    escluse,
    di: DI,
    nomi: NOMI,
    modelli: MODELLI,
  });
  assert.equal(
    adesso.some((una) => una.nome === "Presa cantina"),
    false,
  );
  assert.equal(messiDaParte[0].nome, "Presa cantina");
  assert.equal(messiDaParte[0].tipo.tipo, "presa");
  assert.equal(messiDaParte[0].modello, "Shelly Plug S");
});

test("marca e modello dal registro dei dispositivi, senza ripetere la marca", () => {
  assert.equal(marcaEModello({ manufacturer: "Daikin", model: "FTXM25R" }), "Daikin FTXM25R");
  assert.equal(marcaEModello({ manufacturer: "Shelly", model: "Shelly Plug S" }), "Shelly Plug S");
  assert.equal(marcaEModello({ manufacturer: "Xiaomi" }), "Xiaomi");
  assert.equal(marcaEModello({}), "");
  const { modelli } = dispositiviDaiRegistri({
    dispositivi: [{ id: "d1", name: "Clima", manufacturer: "Daikin", model: "FTXM25R" }],
    entita: [{ entity_id: "climate.x", device_id: "d1" }],
  });
  assert.deepEqual(modelli, { d1: "Daikin FTXM25R" });
});
