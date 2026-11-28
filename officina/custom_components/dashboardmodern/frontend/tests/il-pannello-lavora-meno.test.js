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

test("la finestra delle feste si ricorda nello stesso minuto, e cambia a mezzanotte", async () => {
  const { finestraDelleFeste } = await import("../src/core/feste.js");
  const prima = finestraDelleFeste(new Date(2026, 11, 7, 23, 59, 10));
  assert.equal(prima, null);
  assert.equal(finestraDelleFeste(new Date(2026, 11, 7, 23, 59, 50)), null);
  const dopo = finestraDelleFeste(new Date(2026, 11, 8, 0, 0, 5));
  assert.ok(dopo, "l'8 dicembre e' festa");
  assert.equal(finestraDelleFeste(new Date(2026, 11, 8, 0, 0, 40)), dopo);
  assert.equal(finestraDelleFeste(new Date(2027, 0, 7, 0, 0, 1)), null);
});

test("sul pannello a muro il tasto di Assist non c'e'", async () => {
  const assist = await read("../src/sections/assist-section.js");
  const acceso = assist.slice(assist.indexOf("function acceso()"));
  assert.match(acceso.slice(0, 400), /if \(sulPannelloAMuro\(\)\) return false;/);
});

/* «C'e' ancora un piccolo delay su accensione luci»: la card della luce
 * cambia colore al tocco, senza aspettare il disegno di tutto il muro. */
test("al tocco la card della luce cambia subito, e il disegno arriva dopo", async () => {
  const { cambiaLaCartaSubito } = await import("../src/sections/plancia-a-muro-section.js");
  const classi = new Set(["mu-carta", "mu-card", "mu-luce"]);
  const attributi = {};
  const carta = {
    classList: {
      contains: (c) => classi.has(c),
      toggle: (c, si) => (si ? classi.add(c) : classi.delete(c)),
    },
    setAttribute: (k, v) => {
      attributi[k] = v;
    },
  };
  assert.equal(cambiaLaCartaSubito(carta, true), true);
  assert.ok(classi.has("mu-luce-on"));
  assert.equal(attributi["aria-pressed"], "true");
  assert.equal(cambiaLaCartaSubito(carta, false), true);
  assert.ok(!classi.has("mu-luce-on"));
  /* Una card che non e' di una luce non si tocca: la fa il disegno. */
  const altra = { classList: { contains: () => false, toggle: () => assert.fail() } };
  assert.equal(cambiaLaCartaSubito(altra, true), false);
  const muro = await read("../src/sections/plancia-a-muro-section.js");
  assert.match(muro, /alterna\(entita, "light", "toggle", undefined, bersaglio\)/);
  assert.match(muro, /fotogramma\(\(\) => fotogramma\(\(\) => disegna\(\)\)\)/);
});
