/* «Quando va sulle luci rgb per impostare i colori non si riesce più a
 * cliccare chiudi per tornare indietro: bisogna chiudere gda e riaprirlo»
 * (#215), e «quando ritorni nella schermata principale dopo aver aperto delle
 * schede spariscono i tasti» (#214). Tutt'e due da un iPhone, dentro l'app di
 * Home Assistant: la scheda della luce, a tutto schermo, aveva la sua riga
 * con «✕ CHIUDI» disegnata sotto l'orologio e la batteria, e la fascia della
 * Home ci finiva sotto col menu e il nome della casa.
 *
 * Il numero che manca e' quello della fascia che il sistema si tiene in cima.
 * Dentro la cornice `env(safe-area-inset-top)` risponde zero; lo si va a
 * prendere nel documento in cima, togliendo quello che l'ospite lascia gia'
 * libero sopra la cornice. Qui c'e' il conto, e la promessa che i fogli lo
 * usano davvero.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { CIMA_MASSIMA, cimaDiSistema } from "../src/core/fondo-di-sistema.js";

const leggi = (percorso) => readFileSync(new URL(percorso, import.meta.url), "utf8");

test("dove sopra non c'e' niente la finestra resta dov'era", () => {
  assert.equal(cimaDiSistema(0, 0), 0);
  assert.equal(cimaDiSistema(null, undefined), 0);
  assert.equal(cimaDiSistema("ciao", NaN), 0);
  assert.equal(cimaDiSistema(-20, 0), 0, "una misura negativa non e' una fascia");
});

test("col chiosco la cornice parte dal bordo del vetro e la fascia e' tutta nostra", () => {
  /* L'iPhone con la tacca: la cornice comincia a zero, sotto l'orologio. */
  assert.equal(cimaDiSistema(0, 59, 0), 59);
  /* Fuori dalla cornice — l'app gdahome, un Safari a tutto schermo — vale
   * il proprio. */
  assert.equal(cimaDiSistema(47, 0), 47);
  assert.equal(cimaDiSistema(47, 59, 0), 59, "il piu' grande, non la somma");
});

test("quello che Home Assistant lascia gia' libero sopra non si scansa due volte", () => {
  /* Senza chiosco la cornice sta sotto la barra di Home Assistant, che la
   * fascia l'ha gia' scansata: qui non si aggiunge niente. */
  assert.equal(cimaDiSistema(0, 59, 59 + 56), 0);
  assert.equal(cimaDiSistema(0, 59, 20), 39);
});

test("una lettura presa a pagina che si impagina non spinge giu' mezza finestra", () => {
  assert.equal(cimaDiSistema(0, 400, 0), CIMA_MASSIMA);
});

test("la scheda della luce e le altre finestre cominciano sotto la fascia", () => {
  const navigazione = leggi("../src/sections/navigation-section.js");
  /* La variabile esiste, misurata, e parte da quello che dice il dispositivo. */
  assert.match(navigazione, /--dm-cima-di-sistema:env\(safe-area-inset-top,0px\)/);
  assert.match(
    navigazione,
    /--dm-cima-libera:max\(var\(--dm-cima-di-sistema,0px\),var\(--gdahome-alto,0px\)\)/,
  );
  assert.match(navigazione, /export function misuraLaCimaDiSistema/);
  /* La finestra delle sezioni — quella della luce — sul telefono. */
  assert.match(
    navigazione,
    /html body \.dm-section-modal\{padding-top:var\(--dm-cima-libera\)!important\}/,
  );
  assert.match(
    navigazione,
    /html body \.dm-section-modal \.dm-section-dialog\{height:100%!important;max-height:100%!important\}/,
  );
  /* Quelle del guscio, su WebKit, dove il guscio le inchiodava a otto pixel. */
  assert.match(
    navigazione,
    /@supports \(-webkit-touch-callout:none\)\{\s*html body \.modal-wrapper:not\(#editor-modal\)\{padding-top:max\(8px,var\(--dm-cima-libera\)\)!important\}/,
  );
});

test("col chiosco la fascia della Home comincia sotto l'orologio, anche ferma", () => {
  const chiosco = leggi("../src/sections/beta12-room-color-lock-section.js");
  assert.match(
    chiosco,
    /padding-top:max\(env\(safe-area-inset-top,0px\),var\(--dm-cima-di-sistema,0px\),var\(--gdahome-alto,0px\)\)!important/,
  );
  /* Ferma, resta dove il corpo l'ha messa: il corpo e' quello che scorre, e la
   * fascia l'ha gia' lasciata fuori col margine qui sopra. Dirla di nuovo
   * alla testa ferma la spingeva giu' una seconda volta, sopra la riga sotto
   * il meteo (la-testa-fissa-non-copre-la-riga.spec.js). */
  const testaFissa = leggi("../src/sections/testa-fissa-section.js");
  assert.match(testaFissa, /position:sticky;top:0;/);
  assert.doesNotMatch(testaFissa, /top:var\(--dm-cima-libera/);
});

test("Esc chiude la scheda della luce anche col fuoco altrove", () => {
  const luci = leggi("../src/sections/lights-scene-section.js");
  assert.match(luci, /doc\.addEventListener\("keydown", onKey, true\)/);
  assert.match(luci, /doc\.removeEventListener\("keydown", onKey, true\)/);
});
