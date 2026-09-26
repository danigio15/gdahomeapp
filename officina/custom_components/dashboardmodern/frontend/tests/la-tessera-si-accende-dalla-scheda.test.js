/* «Manca il toggle per aggiungere la sezione nei widget» (#114).
 *
 * Non mancava: sta in Configurazione → Widget. Mancava il cartello — e chi ha
 * scritto la segnalazione è chi ha scritto la plancia: se non l'ha trovato
 * lui, non lo trova nessuno.
 *
 * Questa prova difende la cosa che rende la riga sicura: che sia LO STESSO
 * interruttore. Due interruttori che scrivono due cose sarebbero il modo di
 * avere una tessera accesa da una parte e spenta dall'altra.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const sorgente = await readFile(
  new URL("../src/sections/la-tessera-si-accende-dalla-scheda-section.js", import.meta.url),
  "utf8",
);
const elenco = await readFile(
  new URL("../src/sections/todo-editor-section.js", import.meta.url),
  "utf8",
);

test("è lo stesso interruttore: stessa chiave, stesso campo", () => {
  assert.match(sorgente, /WIDGETS_CONFIG_KEY/);
  assert.match(sorgente, /widgetPreferences\(\)\.hidden/);
  assert.match(sorgente, /writeJsonIfChanged\(WIDGETS_CONFIG_KEY, \{ \.\.\.base, hidden: \[\.\.\.nascoste\] \}\)/);
  /* E l'elenco del Widget scrive nella stessa: se un giorno cambia posto, qui
   * si deve cambiare insieme. */
  assert.match(elenco, /writeJsonIfChanged\(WIDGETS_CONFIG_KEY/);
});

test("non azzera il resto di cd_widgets", () => {
  /* La chiave porta anche l'ordine, le esclusioni per entità e la modalità
   * compatta: un interruttore che le buttasse via sarebbe una riga che, per
   * accendere una tessera, disfa la configurazione di tutte le altre. */
  assert.match(sorgente, /const base = stored && typeof stored === "object"/);
  assert.match(sorgente, /\{ \.\.\.base, hidden/);
});

test("la riga sta solo nella scheda da cui è partita la segnalazione", () => {
  /* Il legame scheda→tessera oggi non è scritto da nessuna parte: la scheda si
   * chiama `sez6`, la sezione `server` e la tessera `minipc`. Una tabella di
   * venti coppie inventata qui sarebbe un secondo posto che dice a cosa
   * appartiene una tessera, e si scosterebbe dal primo. */
  assert.match(sorgente, /const SCHEDA = "sez6";/);
  assert.match(sorgente, /const TESSERA = "minipc";/);
  assert.match(sorgente, /\.ed-tab\.active"\)\?\.dataset\?\.tab\) === SCHEDA/);
});

test("la tessera del MiniPC esiste davvero nel catalogo", () => {
  /* Una riga che accende una tessera che non c'è sarebbe un interruttore che
   * non fa niente — cioè il difetto che questa segnalazione credeva di avere. */
  assert.match(elenco, /\["minipc", "🖥️", t\("MiniPC", "MiniPC"\)\]/);
});
