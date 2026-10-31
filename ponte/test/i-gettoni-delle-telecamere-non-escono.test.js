/* Lo stato di una telecamera porta il suo gettone, e con quello Home
 * Assistant apre `camera_proxy` a chiunque. Chi una telecamera non la vede —
 * un telefono senza utente, chi non vede la plancia riservata dove sta — non
 * deve trovarselo dentro `get_states` o in un evento. */
import { test } from "node:test";
import assert from "node:assert/strict";

import { TUTTE_CHIUSE } from "../src/commissioni.js";
import { senzaIGettoniDelleTelecamere } from "../src/dogana.js";

const telecamera = (id) => ({
  entity_id: id,
  state: "idle",
  attributes: {
    friendly_name: "Ingresso",
    access_token: "GETTONE-SEGRETO",
    entity_picture: `/api/camera_proxy/${id}?token=GETTONE-SEGRETO`,
  },
});

test("get_states: via il gettone delle telecamere chiuse, il resto resta", () => {
  const testo = JSON.stringify({
    id: 4,
    type: "result",
    success: true,
    result: [
      telecamera("camera.ingresso"),
      telecamera("camera.giardino"),
      { entity_id: "light.cucina", state: "on", attributes: { friendly_name: "Cucina" } },
    ],
  });
  const detto = JSON.parse(senzaIGettoniDelleTelecamere(testo, new Set(["camera.ingresso"])));
  const [ingresso, giardino, luce] = detto.result;
  assert.equal(ingresso.attributes.access_token, undefined);
  assert.equal(ingresso.attributes.entity_picture, "/api/camera_proxy/camera.ingresso");
  assert.equal(ingresso.attributes.friendly_name, "Ingresso");
  assert.equal(giardino.attributes.access_token, "GETTONE-SEGRETO", "quella aperta resta");
  assert.deepEqual(luce, {
    entity_id: "light.cucina",
    state: "on",
    attributes: { friendly_name: "Cucina" },
  });
  const tutte = senzaIGettoniDelleTelecamere(testo, TUTTE_CHIUSE);
  assert.ok(!tutte.includes("GETTONE-SEGRETO"), "senza utente, nessun gettone");
});

test("gli eventi state_changed e la forma corta di subscribe_entities", () => {
  const evento = JSON.stringify({
    id: 7,
    type: "event",
    event: {
      event_type: "state_changed",
      data: {
        entity_id: "camera.ingresso",
        new_state: telecamera("camera.ingresso"),
        old_state: telecamera("camera.ingresso"),
      },
    },
  });
  assert.ok(
    !senzaIGettoniDelleTelecamere(evento, new Set(["camera.ingresso"])).includes("GETTONE"),
  );
  const corta = JSON.stringify({
    id: 8,
    type: "event",
    event: {
      a: { "camera.ingresso": { s: "idle", a: { access_token: "GETTONE-SEGRETO" } } },
      c: {
        "camera.ingresso": {
          "+": {
            a: { access_token: "GETTONE-NUOVO", entity_picture: "/x?token=GETTONE-NUOVO&w=1" },
          },
        },
      },
    },
  });
  const pulita = senzaIGettoniDelleTelecamere(corta, new Set(["camera.ingresso"]));
  assert.ok(!pulita.includes("GETTONE"), pulita);
  assert.ok(pulita.includes("/x?w=1"));
  /* HA a volte manda piu' messaggi in un array. */
  const insieme = JSON.stringify([JSON.parse(evento), JSON.parse(corta)]);
  assert.ok(!senzaIGettoniDelleTelecamere(insieme, TUTTE_CHIUSE).includes("GETTONE"));
});

test("senza telecamere chiuse, o senza gettoni, il messaggio passa uguale", () => {
  const testo = JSON.stringify({ id: 1, type: "result", result: [telecamera("camera.ingresso")] });
  assert.equal(senzaIGettoniDelleTelecamere(testo, new Set()), testo);
  assert.equal(senzaIGettoniDelleTelecamere(testo, null), testo);
  const senza = JSON.stringify({ id: 2, type: "result", result: [] });
  assert.equal(senzaIGettoniDelleTelecamere(senza, TUTTE_CHIUSE), senza);
});
