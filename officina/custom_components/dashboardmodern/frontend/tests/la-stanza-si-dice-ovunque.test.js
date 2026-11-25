/* Chi la stanza ce l'ha gia' per mestiere non ne riceve una seconda.
 *
 * L'assegnatore mette una tendina sulla riga in cui l'entita' e' scritta, in
 * qualunque scheda. Ma luci, clima, tapparelle, elettrodomestici, telecamere,
 * carichi, robot e zone d'irrigazione la stanza gliela chiede gia' la loro
 * scheda: una seconda tendina sarebbero due padroni della stessa cosa, ed e'
 * il difetto che questo progetto ha gia' pagato abbastanza volte.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  ownedEntities,
  padroniDelleEntita,
  stanzaDaUnAltraScheda,
} from "../src/sections/room-assign-section.js";

const SORGENTI = {
  rooms: [{ id: "room-salone", name: "Salone" }],
  lights: [{ entity: "light.piantana", name: "Piantana", room_id: "room-salone" }],
  covers: [{ id: "cover-1", entity: "cover.salone", room_id: "room-salone" }],
  appliances: [{ id: "app-1", ents: ["sensor.lavatrice_potenza"], room: "Salone" }],
  cameras: [{ cam: "camera.ingresso" }],
  climate: [{ entities: ["climate.salone"] }],
  loads: [],
  robots: [],
  irrigation: [],
  assigned: [{ entity: "sensor.pompa_solare", room_id: "room-salone" }],
};

test("le entita' che una sezione tiene gia' legate a una stanza si riconoscono", () => {
  const suoi = ownedEntities(SORGENTI);
  for (const entity of [
    "light.piantana",
    "cover.salone",
    "sensor.lavatrice_potenza",
    "camera.ingresso",
    "climate.salone",
  ])
    assert.ok(suoi.has(entity), entity);
});

test("quelle assegnate a mano non contano come «gia' di qualcuno»", () => {
  // Altrimenti la tendina sparirebbe subito dopo averla usata, e non ci
  // sarebbe piu' modo di cambiare idea.
  assert.ok(!ownedEntities(SORGENTI).has("sensor.pompa_solare"));
});

test("le stanze non sono entita'", () => {
  assert.ok(!ownedEntities(SORGENTI).has("room-salone"));
});

test("senza sorgenti non si rivendica niente", () => {
  assert.equal(ownedEntities({}).size, 0);
  assert.equal(ownedEntities(null).size, 0);
});

/* «Ho un sensore a cui non riesco ad inserire la relativa stanza.» (#503) La
 * «Batteria Frigo» era anche un'entita' del Frigo negli Elettrodomestici: la
 * tendina spariva senza una parola. Adesso la riga dice la stanza che ha e
 * dove si cambia; e se quella scheda una stanza non gliel'ha data, la tendina
 * torna. */
test("un'entita' di un'altra scheda dice la sua stanza e dove si cambia", () => {
  const sorgenti = {
    rooms: [{ id: "room-cucina", name: "Cucina" }],
    appliances: [
      { id: "app-frigo", name: "Frigo", ents: ["sensor.frigo_batteria"], room_id: "room-cucina" },
      { id: "app-forno", name: "Forno", ents: ["sensor.forno_batteria"] },
    ],
  };
  const padroni = padroniDelleEntita(sorgenti);
  assert.deepEqual(padroni.get("sensor.frigo_batteria"), {
    scheda: "appliances",
    nome: "Frigo",
    stanza: "room-cucina",
  });
  const detto = stanzaDaUnAltraScheda(padroni.get("sensor.frigo_batteria"), sorgenti.rooms);
  assert.equal(detto.stanza, "Cucina");
  assert.match(detto.dove, /Frigo$/);
  assert.equal(detto.chi, "Frigo");
  /* senza stanza nella scheda che la possiede, non c'e' niente da rispettare */
  assert.equal(stanzaDaUnAltraScheda(padroni.get("sensor.forno_batteria"), sorgenti.rooms), null);
  assert.equal(stanzaDaUnAltraScheda(undefined, sorgenti.rooms), null);
  assert.ok(ownedEntities(sorgenti).has("sensor.forno_batteria"));
});
