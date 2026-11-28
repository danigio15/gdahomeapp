/* Dal microscopio sul pannello a muro (NSPanel, quattro core lenti): le
 * funzioni piu' care della plancia erano lavoro che nessuno guardava. Queste
 * prove tengono ferme le tre correzioni. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sensoriDellaBolletta } from "../src/core/le-bollette.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const salute = await read("../src/sections/salute-section.js");
const muro = await read("../src/sections/plancia-a-muro-section.js");

test("la Salute a pagina non vista si rifa' al piu' ogni dieci secondi, aperta subito", () => {
  assert.match(salute, /export const SALUTE_NON_VISTA_MS = 10_000;/);
  assert.match(
    salute,
    /if \(!vista && state\.ultimoGiro && adesso - state\.ultimoGiro < SALUTE_NON_VISTA_MS\)/,
  );
  /* Aperta, il giro rimandato si annulla e si dipinge come prima. */
  assert.match(salute, /root\.clearTimeout\?\.\(state\.dopo\)/);
});

test("il riposo del muro si rimisura solo se qualcosa e' cambiato, o lo schermo", () => {
  assert.match(muro, /const cambiato = rattoppaSeCambia\(/);
  assert.match(muro, /if \(cambiato \|\| state\.riposoMisurato !== schermo\)/);
});

test("i sensori delle bollette: lo stesso risultato, il primo in ordine fra quelli giusti", () => {
  const states = {
    "sensor.z_ultima_bolletta": { state: "1", attributes: {} },
    "sensor.a_ultima_bolletta": { state: "2", attributes: {} },
    "sensor.importo_da_pagare": { state: "3", attributes: {} },
    "light.ultima_bolletta": { state: "on", attributes: {} },
  };
  const trovati = sensoriDellaBolletta(states, {}, 1000);
  assert.equal(trovati.ultima, "sensor.a_ultima_bolletta");
  /* Sullo stesso registro, poco dopo, si ricorda; un sensore tolto rifa'. */
  assert.deepEqual(sensoriDellaBolletta(states, {}, 2000), trovati);
  delete states["sensor.a_ultima_bolletta"];
  assert.equal(sensoriDellaBolletta(states, {}, 2500).ultima, "sensor.z_ultima_bolletta");
});

test("dentro GdAHome Muro la Salute e Strava non ci sono, e non si cercano", async () => {
  const { vistaSalute } = await import("../src/sections/salute-section.js");
  const { vistaStrava } = await import("../src/sections/strava-pezzi.js");
  const states = {
    "sensor.passi_di_oggi": {
      state: "4200",
      attributes: { unit_of_measurement: "steps", friendly_name: "Passi" },
    },
  };
  globalThis.__GDAHOME_MURO__ = true;
  try {
    assert.equal(vistaSalute(states), null);
    assert.equal(vistaStrava(states), null);
  } finally {
    delete globalThis.__GDAHOME_MURO__;
  }
});
