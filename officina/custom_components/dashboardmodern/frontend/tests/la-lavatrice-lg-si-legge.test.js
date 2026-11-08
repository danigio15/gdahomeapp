/* «Devi rivedere le grafiche delle informazioni degli elettrodomestici, non
 * si capisce nulla.»
 *
 * La finestra di una lavatrice LG ThinQ diceva, sotto «Dall'integrazione»:
 * «LGE Y_V8_Y___W.B32QEUK (DEVICE_WASHER)», «Stato attuale spinning», sei
 * caselle tutte col grafico 📈 e la parola in maiuscoletto tagliata
 * («ENERGY_MESE_LAV…», «TOTAL TIME»), «Delayed end 0», «Operation start», e
 * accanto a «Power» un tasto «ON» che voleva dire «accendi» e si leggeva
 * «acceso». E l'ultimo ciclo, che la card in cima racconta gia', ripetuto in
 * quattro caselle sotto.
 *
 * Adesso: le parole delle integrazioni in italiano, lo stato come fase, le
 * date come si dicono, un glifo per genere di lettura, l'interruttore che
 * dice com'e', e l'unita' accanto ai numeri.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { sceltaInParole, statoInParole } from "../src/sections/appliance-detail-popup-section.js";

const FINESTRA = readFileSync(
  new URL("../src/sections/appliance-detail-popup-section.js", import.meta.url),
  "utf8",
);

test("le scelte dei menu sono verbi: «start» e' Avvia, «power_off» e' Spegni", () => {
  assert.equal(sceltaInParole("start"), "Avvia");
  assert.equal(sceltaInParole("stop"), "Ferma");
  assert.equal(sceltaInParole("power_off"), "Spegni");
  assert.equal(sceltaInParole("wake_up"), "Risveglia");
  /* Un programma scritto da persone resta com'e'. */
  assert.equal(sceltaInParole("Cotone eco"), "Cotone eco");
});

test("lo stato si dice come fase, e la data come la si dice", () => {
  assert.equal(statoInParole("spinning", "spinning"), "Centrifuga");
  assert.equal(statoInParole("rinsing", "rinsing"), "Risciacquo");
  assert.equal(statoInParole("on", "Acceso"), "Acceso");
  const quando = statoInParole("2026-09-08T01:40:51.764Z", "x");
  assert.doesNotMatch(quando, /T01:40|764Z/, "non l'ISO di Home Assistant");
  assert.match(quando, /set|sep/i);
});

test("le parole delle integrazioni hanno la loro traduzione", () => {
  for (const [chiave, parola] of [
    ["totaltime", "Durata totale"],
    ["delayedend", "Fine programmata"],
    ["operation", "Comando"],
    ["power", "Accensione"],
    ["currentstatus", "Stato attuale"],
  ])
    assert.match(FINESTRA, new RegExp(`"${chiave}"[^\\]]*\\], "${parola}"`), chiave);
});

test("ogni lettura col suo glifo: tempi, cicli, costi; non piu' il grafico per tutte", () => {
  assert.doesNotMatch(
    FINESTRA,
    /casella-ic" aria-hidden="true">📈<\/span>/,
    "nessuna casella col grafico scritto a mano",
  );
  assert.match(FINESTRA, /return "⏱️";/);
  assert.match(FINESTRA, /return "🔁";/);
  /* E la parola si legge: niente maiuscoletto da otto pixel. */
  assert.match(FINESTRA, /\.dm-apde-casella-nome\{[^}]*-webkit-line-clamp:2/);
});

test("l'interruttore dice com'e', non cosa fa", () => {
  assert.doesNotMatch(FINESTRA, /tasto\.textContent = controllo\.on \? "OFF" : "ON"/);
  assert.match(FINESTRA, /setAttribute\("role", "switch"\)/);
  assert.match(FINESTRA, /aria-checked/);
});

test("l'ultimo ciclo della card non si ripete fra le letture", () => {
  for (const casella of [
    "last_start_entity",
    "last_duration_entity",
    "last_energy_entity",
    "last_cost_entity",
  ])
    assert.match(FINESTRA, new RegExp(`"${casella}",`), casella);
});

test("il marchio e il modello senza la sigla del protocollo", () => {
  assert.match(FINESTRA, /\["lge", "LG"\]/);
  assert.match(FINESTRA, /\(\?:DEVICE_\)\?/);
});
