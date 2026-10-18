/* I «Dispositivi» della Home arrivano con la configurazione condivisa.
 *
 * Il guscio disegna le card dei Dispositivi solo all'avvio (DOMContentLoaded),
 * da quello che il deposito del browser ha in quel momento. Al primo avvio su
 * un telefono nuovo, o dopo averli aggiunti da un altro, la configurazione
 * arriva dal ponte DOPO: la rilettura rifaceva le tessere, il clima, la
 * barra — non i Dispositivi, e la Home restava senza finche' non si
 * ricaricava. Visto rifacendo le fotografie della plancia completa con la
 * casa demo: quindici dispositivi configurati, nessuna card. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const leggi = (nome) => readFileSync(new URL(`../${nome}`, import.meta.url), "utf8");

test("la configurazione condivisa, quando arriva, rifa' anche i Dispositivi della Home", () => {
  const sezione = leggi("src/sections/config-persistence-section.js");
  const corpo = sezione.slice(sezione.indexOf("function refreshRuntimeAfterRestore"));
  const passi = corpo.slice(corpo.indexOf("runSteps("), corpo.indexOf("stepReporter("));
  assert.match(passi, /\["buildDeviceCards", \(\) => root\.buildDeviceCards\?\.\(\)\]/);
  /* Prima del disegno, che e' l'ultimo passo. */
  assert.ok(passi.indexOf('"buildDeviceCards"') < passi.indexOf('["render"'));
});

for (const runtime of ["dashboard-runtime-it.js", "dashboard-runtime-en.js"]) {
  test(`${runtime}: buildDeviceCards e' della finestra, e la rilettura la trova`, () => {
    const sorgente = leggi(`legacy/${runtime}`);
    /* Una funzione dichiarata in cima allo script classico: sta su window. */
    assert.match(sorgente, /\nfunction buildDeviceCards\(\) \{/);
  });
}
