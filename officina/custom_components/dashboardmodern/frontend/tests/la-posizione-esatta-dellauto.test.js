/* «Su gdaauto mi recuperi la posizione attuale del veicolo e non fuori casa:
 * voglio la posizione esatta.»
 *
 * Lo stato del device_tracker dice soltanto `home` o `not_home`; il punto
 * vero sta nei suoi attributi. Qui si prova che si legge, che si scrive bene
 * (l'indirizzo se c'e', se no le coordinate) e che il link apre la mappa. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  coordinateDelLuogo,
  letturaTermica,
  linkDellaMappa,
  posizioneScritta,
} from "../src/core/auto-termica.js";

test("le coordinate vengono dagli attributi del tracker", () => {
  const c = coordinateDelLuogo({ latitude: 45.464211, longitude: 9.190123, gps_accuracy: 12 });
  assert.deepEqual(c, { lat: 45.464211, lon: 9.190123, precisione: 12, indirizzo: "" });
  assert.equal(posizioneScritta(c), "45.46421, 9.19012");
  assert.equal(
    linkDellaMappa(c),
    "https://www.google.com/maps/search/?api=1&query=45.464211,9.190123",
  );
});

test("l'indirizzo, quando l'integrazione lo da', vince sulle coordinate", () => {
  assert.equal(
    posizioneScritta(
      coordinateDelLuogo({ latitude: 45.1, longitude: 9.1, address: "Via Roma 12, Milano" }),
    ),
    "Via Roma 12, Milano",
  );
  assert.equal(
    posizioneScritta(
      coordinateDelLuogo({
        latitude: 45.1,
        longitude: 9.1,
        street: "Via Roma",
        house_number: "12",
        city: "Milano",
      }),
    ),
    "Via Roma 12, Milano",
  );
});

test("senza coordinate buone non si inventa niente", () => {
  assert.equal(coordinateDelLuogo({}), null);
  assert.equal(coordinateDelLuogo({ latitude: 0, longitude: 0 }), null);
  assert.equal(coordinateDelLuogo({ latitude: 120, longitude: 9 }), null);
  assert.equal(coordinateDelLuogo({ latitude: "abc", longitude: 9 }), null);
  assert.equal(posizioneScritta(null), "");
  assert.equal(linkDellaMappa(null), "");
});

test("la lettura dell'auto porta la posizione esatta accanto a «fuori»", () => {
  const lettura = letturaTermica(
    { "dm.ev_posizione": "device_tracker.leapmotor_b10" },
    {
      "device_tracker.leapmotor_b10": {
        state: "not_home",
        attributes: { latitude: 45.4642, longitude: 9.19, gps_accuracy: 5 },
      },
    },
  );
  assert.equal(lettura.posizione, "fuori");
  assert.equal(lettura.coordinate.lat, 45.4642);
  assert.equal(lettura.coordinate.lon, 9.19);
});
