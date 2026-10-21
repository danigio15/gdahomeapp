/* «Deve vedere quelle reali impostate come finestre»: la notifica della
 * pioggia diceva «Finestre aperte: Termosifone Bagno Stato finestra», cioe'
 * il rilevamento della finestra aperta di una valvola termostatica. Adesso le
 * finestre sono quelle della plancia: i varchi scritti, i contatti delle
 * Finestre, e nel rilevamento niente sensori che stanno su un termostato. */
import { test } from "node:test";
import assert from "node:assert/strict";

import { Sentinella } from "../src/sentinella.js";

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });
const finestra = (id, state, nome) =>
  stato(id, state, { device_class: "window", friendly_name: nome });

const STATI = [
  finestra("binary_sensor.sala_finestra", "on", "Finestra sala"),
  finestra("binary_sensor.termosifone_bagno_finestra", "on", "Termosifone Bagno Stato finestra"),
  stato("climate.termosifone_bagno", "heat", { hvac_action: "idle" }),
  stato("binary_sensor.porta_ingresso", "on", { device_class: "door", friendly_name: "Ingresso" }),
];

function conLaCasa(valori = {}) {
  const sentinella = new Sentinella({ adesso: () => 0, quando: () => {} });
  sentinella.carica(STATI);
  sentinella.dispositivoDi = {
    "binary_sensor.termosifone_bagno_finestra": "valvola",
    "climate.termosifone_bagno": "valvola",
  };
  sentinella.valori = () => valori;
  return sentinella;
}

test("senza righe scritte: le finestre vere, non la valvola e non la porta", () => {
  assert.deepEqual(conLaCasa()._finestreAperte(), ["Finestra sala"]);
});

test("con le righe scritte nei Varchi valgono solo quelle", () => {
  const varchi = {
    righe: [
      { entity: "binary_sensor.porta_ingresso", name: "Ingresso", tipo: "porta" },
      { entity: "binary_sensor.sala_finestra", name: "Sala" },
    ],
  };
  assert.deepEqual(conLaCasa({ cd_varchi: JSON.stringify(varchi) })._finestreAperte(), ["Sala"]);
});

test("il contatto girato aperto a OFF conta col suo verso", () => {
  const girati = ["binary_sensor.sala_finestra"];
  assert.deepEqual(conLaCasa({ cd_stati_invertiti: girati })._finestreAperte(), []);
});
