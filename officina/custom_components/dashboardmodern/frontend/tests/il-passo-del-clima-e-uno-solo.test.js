/* Il passo del clima e' uno solo, in tutta la plancia.
 *
 * «Se fai piu' o meno ti cambia la temperatura a un grado e non mezzo;
 * invece se la apri fa i mezzi gradi.» La card della pagina Clima andava al
 * grado intero, il popup della stessa unita' al mezzo grado. Queste prove
 * tengono ferma la regola (`passoDelClima`) e il fatto che tutti i meno e i
 * piu' degli obiettivi del clima la usano: la card, il popup, la Home, il
 * muro, il tasto rapido, l'assistente e le stufe.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { PASSO_DEL_CLIMA, passoDelClima } from "../src/core/scala-clima.js";
import { quickClimateSteps } from "../src/core/quick-climate.js";

const leggi = (percorso) => readFile(new URL(`../src/${percorso}`, import.meta.url), "utf8");

test("mezzo grado per chi non dichiara un passo, come il popup", () => {
  assert.equal(PASSO_DEL_CLIMA, 0.5);
  assert.equal(passoDelClima({}), 0.5);
  assert.equal(passoDelClima(null), 0.5);
  assert.equal(passoDelClima({ target_temp_step: null }), 0.5);
  assert.equal(passoDelClima({ target_temp_step: "" }), 0.5);
  // Un passo scritto male non e' un passo.
  assert.equal(passoDelClima({ target_temp_step: 0 }), 0.5);
  assert.equal(passoDelClima({ target_temp_step: -1 }), 0.5);
});

test("il passo dichiarato vince sempre", () => {
  assert.equal(passoDelClima({ target_temp_step: 1 }), 1);
  assert.equal(passoDelClima({ target_temp_step: 0.1 }), 0.1);
  assert.equal(passoDelClima({ target_temp_step: "0.5" }), 0.5);
  assert.equal(passoDelClima({ target_temp_step: 0.5 }, "°F"), 0.5);
});

test("coi Fahrenheit, senza passo dichiarato, un grado intero", () => {
  assert.equal(passoDelClima({}, "°F"), 1);
  assert.equal(passoDelClima({}, "F"), 1);
  assert.equal(passoDelClima({}, "°C"), 0.5);
});

test("la lettura della card della pagina Clima ha lo stesso passo del popup", async () => {
  const { climateReading } = await import(
    `../src/sections/climate-thermal-section.js?passo=${Date.now()}`
  );
  const states = {
    "climate.sala": { state: "heat", attributes: { temperature: 19, current_temperature: 20 } },
  };
  // Prima qui ripiegava su un grado intero.
  assert.equal(climateReading("climate.sala", states).passo, 0.5);
});

test("il tasto rapido porta i gradi sul passo dell'unita'", () => {
  const coppia = {
    target_temp_low: 18,
    target_temp_high: 26,
    min_temp: 7,
    max_temp: 35,
  };
  const passi = quickClimateSteps({ mode: "heat", temperature: 21.3 }, coppia);
  const gradi = passi.find((passo) => passo.service === "set_temperature");
  assert.equal(gradi.data.target_temp_low, 21.5);
  assert.equal(gradi.data.target_temp_high, 26);
});

test("nessun meno e piu' del clima tiene un passo suo", async () => {
  for (const percorso of [
    "sections/climate-thermal-section.js",
    "sections/home-widgets-section.js",
    "sections/plancia-a-muro-section.js",
    "sections/finestre/impianti.js",
    "core/impianti-termici.js",
    "core/quick-climate.js",
    "core/rispondere-alle-domande.js",
  ]) {
    const testo = await leggi(percorso);
    assert.match(testo, /passoDelClima\(/, `${percorso} usa passoDelClima`);
    // Nessuna copia della regola: il passo dichiarato col suo ripiego scritto
    // accanto («|| 0.5», «?? 1») era il modo in cui le copie divergevano.
    assert.doesNotMatch(
      testo,
      /target_temp_step\)\s*(\|\||\?\?)\s*[\d(]/,
      `${percorso} non tiene un ripiego suo`,
    );
    assert.doesNotMatch(testo, /passoDellUnita\(/, `${percorso} non usa il ripiego di un tempo`);
  }
});
