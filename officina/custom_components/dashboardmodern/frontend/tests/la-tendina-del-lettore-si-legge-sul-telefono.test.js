/* «Si riesce ad impaginare o per telefono o per tablet? perché oltre che
 * sborda, non scorre per andare a lato.»
 *
 * Dal campo, con lo scatto di una pagina Musica su un telefono. Due guasti in
 * uno, e vanno letti separati perché hanno due cause diverse.
 *
 * Il primo è quello che si vede: «FORMATO DI ING…» e dentro la tendina «No
 * input c…». La riga teneva l'etichetta e la tendina affiancate per forza, e
 * i nomi lì non li sceglie nessuno di qui — li manda l'integrazione, e
 * SmartThings scrive «Formato di ingresso del segnale». Su un telefono
 * quell'etichetta si impilava su tre righe e alla tendina restavano cento
 * pixel: dentro non ci stava «No input connected», e il resto non si poteva
 * andare a prendere, perché una tendina non si scorre di lato.
 *
 * Il secondo è quello che spiega il «sborda», ed è più a monte: la colonna del
 * testo della card era una griglia senza colonne dichiarate. Una griglia così
 * se ne fa una implicita larga quanto il figlio più largo — la tendina col suo
 * «Dolby Digital Plus 5.1», il nome lungo di un'entità — e su uno schermo da
 * 320 px quella colonna veniva 220 dove ce n'erano 162. La card taglia quello
 * che le esce, perché le serve per il fondale sfocato della copertina: il di
 * più spariva, e la pagina non scorre di lato per andarselo a riprendere.
 * Misurato in un browser vero prima e dopo: 340 px di roba in 282, e poi 282
 * in 282.
 *
 * Le due righe di stile qui sotto sono la correzione, e questa prova sta qui
 * perché non tornino indietro senza che nessuno se ne accorga.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("la colonna del testo è dichiarata, così nessun figlio la allarga oltre la card", async () => {
  const sezione = await read("src/sections/media-player-section.js");
  assert.match(sezione, /\.dm-mp-testo\{display:grid;grid-template-columns:minmax\(0,1fr\);/);
  /* La card taglia quello che esce: è la riga che rende invisibile lo
   * sbordamento invece di mostrarlo, ed è il motivo per cui la colonna va
   * tenuta a freno a monte. */
  assert.match(sezione, /\.dm-mp-card\{\n\s*position:relative;overflow:hidden;/);
});

test("le tre righe alte si accorciano invece di allargare la colonna", async () => {
  const sezione = await read("src/sections/media-player-section.js");
  for (const quale of ["dm-mp-dove", "dm-mp-titolo", "dm-mp-sotto"])
    assert.match(
      sezione,
      new RegExp(`\\.${quale}\\{[^}]*text-overflow:ellipsis`),
      `${quale} deve accorciarsi con i puntini`,
    );
});

test("etichetta e tendina vanno a capo quando affiancate non ci stanno", async () => {
  const sezione = await read("src/sections/media-player-section.js");
  assert.match(sezione, /\.dm-mp-sorgente\{\n\s*display:flex;align-items:center;flex-wrap:wrap;/);
  /* La larghezza sotto la quale la tendina preferisce una riga tutta sua.
   * Scritta in pixel e non «auto»: con «auto» il punto in cui va a capo lo
   * decide la lunghezza delle voci dentro, che è proprio quello che cambia da
   * una casa all'altra. */
  assert.match(sezione, /\.dm-mp-sorgente select\{\n\s*flex:1 1 150px;min-width:0;/);
});

test("le tendine dell'integrazione sono la stessa riga della sorgente", async () => {
  const sezione = await read("src/sections/media-player-section.js");
  /* Due punti scrivono quella riga: la sorgente del lettore e le tendine che
   * l'integrazione porta con sé. Sono le seconde ad avere i nomi lunghi, e se
   * un giorno prendessero una classe loro la correzione varrebbe per l'altra
   * metà soltanto. */
  const righe = sezione.match(/<label class="dm-mp-sorgente">/g) || [];
  assert.equal(righe.length, 2, "la sorgente e le tendine accanto, stessa riga");
  assert.match(sezione, /genere === "tendina" && voce\.opzioni\.length/);
});
