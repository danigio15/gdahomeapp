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

test("e va piano abbastanza da leggerlo, con la stessa andatura dappertutto", () => {
  /* «Le scritte scorrevoli sotto le card vanno troppo veloci, devono andare
   * lentamente per poterle leggere.»
   *
   * Il conto, prima: `eccesso / 12` secondi, e il nastro percorre la sua
   * distanza fra il 12% e l'88% della durata — il resto sono le due pause ai
   * capi. Quindi 12 / 0,76 ≈ **sedici punti al secondo**: un nome intero
   * passa in un secondo e mezzo, e si fa in tempo a vedere che è passato
   * qualcosa, non a leggerlo.
   *
   * E c'era la seconda metà, peggiore: il tetto a 18 secondi. Oltre i
   * duecento punti di eccesso la durata smetteva di crescere e la velocità
   * ricominciava a salire — cioè andavano più veloci proprio le didascalie
   * più lunghe, che sono quelle che si fa più fatica a leggere.
   *
   * Qui non si guarda un numero scritto a mano: si tira fuori il conto dal
   * codice e si misura la velocità che ne esce, su un eccesso vero e su uno
   * lunghissimo. */
  const conto =
    /const durataDelloScorrimento = \(eccesso\) =>\s*Math\.min\((\d+), Math\.max\((\d+), eccesso \/ (\d+)\)\);/.exec(
      sezione,
    );
  assert.ok(conto, "la durata dello scorrimento si calcola in un posto solo");
  const tetto = Number(conto[1]);
  const pavimento = Number(conto[2]);
  const diviso = Number(conto[3]);
  const durata = (eccesso) => Math.min(tetto, Math.max(pavimento, eccesso / diviso));

  /* Le due pause: dal fotogramma 0 al 12% fermo, dall'88% al 100% fermo. Il
   * viaggio sta in mezzo, ed è su quello che si misura. */
  assert.match(sezione, /0%,12%\{transform:translateX\(0\)\}/);
  assert.match(sezione, /88%,100%\{transform:translateX\(var\(--dm-scroll-x,0\)\)\}/);
  const velocita = (eccesso) => eccesso / (durata(eccesso) * 0.76);

  /* Una didascalia normale — «Asciugatrice Child lock · Boiler Child lock» su
   * una tessera larga mezzo telefono. */
  assert.ok(
    velocita(120) <= 9,
    `troppo veloce: ${velocita(120).toFixed(1)} punti al secondo su un eccesso di 120`,
  );
  /* E una lunghissima non deve tornare a correre per colpa del tetto. */
  assert.ok(
    velocita(600) <= 14,
    `il tetto fa correre le lunghe: ${velocita(600).toFixed(1)} punti al secondo`,
  );

  /* Una sola andatura: i due nastri — la didascalia della tessera e la riga
   * sotto la barra — chiedono la durata alla stessa funzione. Erano due conti
   * quasi uguali, cioè due nastri affiancati a due velocità diverse. */
  const quanti = sezione.match(/\$\{durataDelloScorrimento\(eccesso\)\}s/g) || [];
  assert.equal(quanti.length, 2);
});
