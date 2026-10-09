/* «Nella card persona esce quella scritta home che non mi piace. E anche
 * quando e' fuori casa esce un'altra scritta: o metti l'indirizzo di dove si
 * trova, ma fatto bene, oppure lo togli.» */
import assert from "node:assert/strict";
import test from "node:test";

import { indirizzoLeggibile, personViewModel } from "../src/core/person-model.js";

const g = (state, attributes = {}, entity_id = "sensor.tel_geocoded_location") => ({
  entity_id,
  state,
  attributes,
});

test("«home», una zona, delle coordinate: non sono un indirizzo, e non si scrivono", () => {
  assert.equal(indirizzoLeggibile(g("home")), "");
  assert.equal(indirizzoLeggibile(g("not_home")), "");
  assert.equal(indirizzoLeggibile(g("Lavoro", {}, "device_tracker.tel")), "");
  assert.equal(indirizzoLeggibile(g("home", {}, "person.giovanni")), "");
  assert.equal(indirizzoLeggibile(g("40.85, 14.26")), "");
  assert.equal(indirizzoLeggibile(g("unavailable")), "");
});

test("un indirizzo vero si accorcia a via, numero e citta'", () => {
  assert.equal(indirizzoLeggibile(g("Via Toledo, 12, 80134 Napoli NA, Italia")), "Via Toledo 12, Napoli");
  assert.equal(
    indirizzoLeggibile(
      g("Via Toledo 12, 80134 Napoli NA, Italy", {
        Thoroughfare: "Via Toledo",
        "Sub Thoroughfare": "12",
        Locality: "Napoli",
        Country: "Italy",
      }),
    ),
    "Via Toledo 12, Napoli",
  );
  assert.equal(indirizzoLeggibile(g("Piazza del Plebiscito, Napoli")), "Piazza del Plebiscito, Napoli");
});

test("sulla card arriva l'indirizzo letto, non lo stato grezzo", () => {
  const persona = { id: "g", name: "Giovanni", entity: "person.giovanni", address: "sensor.tel_geocoded_location" };
  const stati = { "person.giovanni": { state: "home", attributes: {} } };
  stati["sensor.tel_geocoded_location"] = g("home");
  assert.equal(personViewModel(persona, stati, 0).address, "");
  stati["sensor.tel_geocoded_location"] = g("Via Toledo, 12, 80134 Napoli NA, Italia");
  assert.equal(personViewModel(persona, stati, 0).address, "Via Toledo 12, Napoli");
});
