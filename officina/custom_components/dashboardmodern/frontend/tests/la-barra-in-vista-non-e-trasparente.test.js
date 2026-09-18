/* «Sistema la barra che sta sopra le tessere.»
 *
 * Da una fotografia su un tablet girato: sotto la barra delle sezioni si
 * leggevano i titoli delle tessere che le passavano dietro — «TEMPERATURA»,
 * «AUTO», «BATTERIE», «ARIA» — in filigrana sopra i nomi della barra stessa.
 * Non sembrava una barra di vetro, sembrava un disegno doppio.
 *
 * Da dove veniva, misurato nel browser e non indovinato: il fondo della barra
 * col tema chiaro stava a `rgba(255,255,255,.92)` e il vetro smerigliato era
 * **spento**. Spento per una buona ragione — una sfocatura a schermo intero il
 * browser la ricompone a ogni scorrimento, e la plancia se l'e' levata di
 * mezzo (#beta5) — ma senza vetro quell'otto per cento di trasparenza non e'
 * una macchia: e' testo nitido.
 *
 * La cura e' il fondo **pieno**, non il vetro riacceso: dietro non passa piu'
 * niente da sfocare, e il risparmio resta dov'era. Dal fondo della pagina la
 * barra la staccano l'ombra e il suo bordo, che c'erano gia'.
 *
 * E lo spazio in fondo alla pagina non c'entrava: misurato, in fondo l'ultima
 * tessera si porta sopra la barra (la barra comincia a 723, l'ultima tessera
 * finisce a 654). Quello che si vedeva a mezza pagina e' una barra che
 * galleggia, ed e' quello che fa una barra che galleggia.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const barra = readFileSync(
  new URL("../src/sections/navigation-section.js", import.meta.url),
  "utf8",
);
const risparmio = readFileSync(
  new URL("../src/sections/beta4-mobile-polish-section.js", import.meta.url),
  "utf8",
);

test("la barra in vista ha il fondo pieno, nei due temi", () => {
  /* Tirata fuori, o tenuta ferma da chi l'ha scelta cosi' nella Config: sono
   * i due modi in cui una barra sta sullo schermo. */
  assert.match(
    barra,
    /nav\.tabs\.bottom-nav-bar\.visible,\s*\n\s*body\.cd-nav-fixed nav\.tabs\.bottom-nav-bar\{background:#fff!important\}/,
    "col tema chiaro il fondo non e' pieno",
  );
  assert.match(
    barra,
    /body\.dark\.cd-nav-fixed nav\.tabs\.bottom-nav-bar\{background:#131c30!important\}/,
    "col tema scuro il fondo non e' pieno",
  );
});

test("e il vetro resta spento: pieno piu' sfocato sarebbe lavoro per niente", () => {
  /* Il risparmio di beta5 non si tocca. Una barra ritirata non sfoca niente, e
   * una in vista non ha niente dietro da sfocare. */
  assert.match(
    risparmio,
    /nav\.tabs\.bottom-nav-bar:not\(\.visible\)\{backdrop-filter:none!important/,
    "la regola che spegne il vetro non c'e' piu'",
  );
});
