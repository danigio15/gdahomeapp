/* «Card temperatura, perché riporta quel nome "Salown" invece di "Salone"?»
 *
 * Nel Salone di quella casa la card dei sensori si intitolava «Salown». Non e'
 * un nome che arriva da Home Assistant — li' la sonda si chiama Salone — ma il
 * contenuto della casella «nome della sonda» dell'editor della stanza, dove un
 * refuso e' entrato una volta e da allora sta li'.
 *
 * Il nome della sonda serve, e per una ragione buona: una stanza puo' averne
 * tre — il comodino, il termostato a muro, la veranda — e tre card intitolate
 * «Salone» non direbbero quale sta dicendo cosa.
 *
 * Ma con UNA sonda sola non c'e' niente da distinguere, e quella card parla
 * della stanza. Allora porta il nome della stanza, che e' quello che chi guarda
 * ha scritto e riconosce; il nome della sonda torna a comandare da due in su,
 * dove distingue davvero.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { readingMarkup } from "../src/sections/rooms-page-section.js";

const STATI = {
  "sensor.salone_temp": { state: "23.1" },
  "sensor.salone_hum": { state: "37.25" },
  "sensor.comodino_temp": { state: "19.4" },
};

test("con una sonda sola la card porta il nome della stanza, non quello della sonda", () => {
  const markup = readingMarkup(
    { name: "Salone", temp: "sensor.salone_temp", hum: "sensor.salone_hum", temp_name: "Salown" },
    STATI,
  );
  assert.match(markup, /<b>Salone<\/b>/);
  assert.ok(!markup.includes("Salown"), "il refuso della casella non deve intitolare la card");
});

test("senza il nome della stanza resta quello della sonda: meglio di niente", () => {
  const markup = readingMarkup(
    { name: "", temp: "sensor.salone_temp", temp_name: "Comodino" },
    STATI,
  );
  assert.match(markup, /<b>Comodino<\/b>/);
});

test("con due sonde ognuna torna a portare il suo nome, che li distingue", () => {
  const markup = readingMarkup(
    {
      name: "Salone",
      temp: "sensor.salone_temp",
      temp_name: "Termostato",
      metadata: {
        temperature_entries: [
          { id: "t2", name: "Comodino", temp: "sensor.comodino_temp" },
        ],
      },
    },
    STATI,
  );
  assert.match(markup, /<b>Termostato<\/b>/);
  assert.match(markup, /<b>Comodino<\/b>/);
});
