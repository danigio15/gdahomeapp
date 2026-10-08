/* «Da app gdahome, quando clicco sulla persona e premo Apri in mappa, apri la
 * posizione su gdanav direttamente.» Dentro l'app la persona va al
 * navigatore; fuori, o senza un punto, resta la mappa di casa. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  CANALE_DEL_NAVIGATORE,
  laPersonaPerIlNavigatore,
  mandaLaPersonaAlNavigatore,
} from "../src/core/la-persona-nel-navigatore.js";

const view = { entity: "person.giovanni", name: "Giovanni", address: "Via Toledo, Napoli" };
const states = {
  "person.giovanni": { state: "not_home", attributes: { latitude: 40.8466, longitude: 14.2497 } },
};

test("la persona col suo punto, il nome e l'indirizzo", () => {
  assert.deepEqual(laPersonaPerIlNavigatore(view, states), {
    nome: "Giovanni",
    lat: 40.8466,
    lon: 14.2497,
    indirizzo: "Via Toledo, Napoli",
  });
});

test("senza coordinate non c'è niente da mandare", () => {
  assert.equal(laPersonaPerIlNavigatore(view, { "person.giovanni": { attributes: {} } }), null);
  assert.equal(
    laPersonaPerIlNavigatore(view, { "person.giovanni": { attributes: { latitude: 99, longitude: 14 } } }),
    null,
  );
});

test("dentro l'app la manda al canale; fuori dall'app non fa niente", () => {
  const mandati = [];
  const app = { [CANALE_DEL_NAVIGATORE]: { postMessage: (m) => mandati.push(JSON.parse(m)) } };
  assert.equal(mandaLaPersonaAlNavigatore(view, states, app), true);
  assert.equal(mandati[0].nome, "Giovanni");
  assert.equal(mandaLaPersonaAlNavigatore(view, states, {}), false, "nel browser il canale non c'è");
  assert.equal(mandaLaPersonaAlNavigatore(view, {}, app), false, "senza punto resta la mappa");
});

test("il tocco su «Apri in mappa» prova prima il navigatore", async () => {
  const sezione = await readFile(new URL("../src/sections/people-section.js", import.meta.url), "utf8");
  const tocco = sezione.slice(sezione.indexOf('closest?.("[data-person-mappa]")'));
  assert.ok(
    tocco.indexOf("allaPersonaNelNavigatore") < tocco.indexOf("apriLaMappaDiCasa"),
    "prima il navigatore dell'app, poi la mappa di casa",
  );
});
