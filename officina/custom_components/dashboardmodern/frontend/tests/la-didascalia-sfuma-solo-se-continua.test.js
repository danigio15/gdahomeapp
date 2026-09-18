/* «Sistema le didascalie tagliate a metà parola.»
 *
 * Prima di toccare: misurato nella pagina vera, su un tablet girato. Le
 * didascalie delle tessere, dieci, con quanto misura il testo e quanto la sua
 * finestra:
 *
 *   Soggiorno · Cucina · Bagno         145 su 124   eccede 21   scorre
 *   Tutte cariche · Batteria di Marco  196 su 135   eccede 61   scorre
 *   potenza di casa · Immissione 8,4   175 su 176   eccede -1   ferma
 *   Termostato                          62 su 114              ferma
 *   …
 *
 * E la risposta: le didascalie **non** erano tagliate a metà parola. Chi non ci
 * sta prende un nastro che scorre avanti e indietro — sei secondi, con una
 * pausa ai due capi — e il bordo sfuma, così si capisce che il testo continua.
 * La fotografia l'aveva preso da fermo, ed è per questo che sembrava un taglio.
 *
 * Un difetto però c'era, e nascosto nella stessa riga: la sfumatura stava su
 * **tutte** le didascalie, anche su quelle che ci stanno. Si mangia l'ultimo
 * sesto della finestra, e una didascalia che finisce dentro quel sesto perdeva
 * la coda per niente — niente da scorrere, quindi nessun modo di rivederla.
 * «potenza di casa · Immissione 8,4» sta in 175 punti dentro una finestra da
 * 176: si leggeva «Immissione 8,» con il resto in dissolvenza. Su un numero la
 * coda è la parte che conta.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const sezione = readFileSync(
  new URL("../src/sections/home-widgets-section.js", import.meta.url),
  "utf8",
);

test("la sfumatura sta solo dove il nastro si muove", () => {
  /* La didascalia da sola non sfuma niente: quello che c'è si legge fino
   * all'ultima lettera. */
  assert.match(
    sezione,
    /\.dm-tile-caption\{\s*\n\s*flex:1;min-width:0;[^}]*white-space:nowrap;overflow:hidden\}/,
    "la didascalia ferma non deve portarsi dietro la maschera",
  );
  /* E la porta quando dentro c'è un nastro che scorre. */
  assert.match(
    sezione,
    /\.dm-tile-caption:has\(>\[data-dm-scroll="true"\]\)\{\s*\n\s*mask-image:linear-gradient\(90deg,#000 84%,transparent\)/,
    "la didascalia che scorre deve sfumare sul bordo",
  );
});

test("e il nastro si arma solo per un eccesso che si vede", () => {
  /* Quattro punti: sotto, e' arrotondamento, non testo nascosto. Armare il
   * nastro per meno di mezza lettera vorrebbe dire una tessera che si muove
   * per niente. */
  assert.match(sezione, /const eccesso = nastro\.scrollWidth - finestra\.clientWidth;/);
  assert.match(sezione, /if \(eccesso > 4\) \{/);
});
