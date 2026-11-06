/* La griglia del muro per quanti riquadri ci sono davvero.
 *
 * «In questa paginetta ho lasciato solo il predefinito dell'antifurto, ma pur
 * togliendo tutto rimane piccolo e non si espande pur essendoci spazio.» La
 * griglia scelta nel config e' il tetto, non la misura di ogni casella:
 * queste prove tengono ferme le forme che prende con meno riquadri.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { GRIGLIE, grigliaPerQuanti } from "../src/core/plancia-a-muro.js";

const sezione = await readFile(
  new URL("../src/sections/plancia-a-muro-section.js", import.meta.url),
  "utf8",
);
const forma = (quanti, griglia) => {
  const { colonne, righe, larga, adatta } = grigliaPerQuanti(quanti, griglia);
  return [colonne, righe, larga, adatta];
};
const SEI = { colonne: 3, righe: 2 };

test("uno prende tutto, due a meta', tre e quattro in quattro caselle", () => {
  assert.deepEqual(forma(1, SEI), [1, 1, 1, true]);
  assert.deepEqual(forma(2, SEI), [2, 1, 1, true]);
  // Tre: due sopra e l'ultimo largo sotto, non tre e un buco.
  assert.deepEqual(forma(3, SEI), [2, 2, 2, true]);
  assert.deepEqual(forma(4, SEI), [2, 2, 1, true]);
  assert.deepEqual(forma(5, SEI), [3, 2, 2, true]);
});

test("con tanti riquadri quanti i posti, o nessuno, la griglia resta quella scelta", () => {
  assert.deepEqual(forma(6, SEI), [3, 2, 1, false]);
  assert.deepEqual(forma(9, SEI), [3, 2, 1, false]);
  assert.deepEqual(forma(0, SEI), [3, 2, 1, false]);
  assert.deepEqual(forma(undefined, SEI), [3, 2, 1, false]);
});

test("la griglia scelta e' il tetto: mai piu' colonne o righe di quelle", () => {
  for (const [posti, g] of Object.entries(GRIGLIE)) {
    for (const verso of ["orizzontale", "verticale"]) {
      const griglia = verso === "verticale" ? { colonne: g.righe, righe: g.colonne } : { ...g };
      for (let n = 1; n < Number(posti); n++) {
        const f = grigliaPerQuanti(n, griglia);
        assert.ok(f.adatta, `${posti} ${verso} ${n}`);
        assert.ok(f.colonne <= griglia.colonne && f.righe <= griglia.righe, `${posti} ${n}`);
        // Ci stanno tutti, e la riga corta si chiude con l'ultimo largo.
        assert.ok(f.colonne * f.righe >= n);
        assert.equal(
          f.colonne * (f.righe - 1) + ((n - 1) % f.colonne) + f.larga,
          f.colonne * f.righe,
        );
      }
    }
  }
});

test("in verticale colonne e righe si scambiano", () => {
  const verticale = { colonne: 2, righe: 3 };
  assert.deepEqual(forma(1, verticale), [1, 1, 1, true]);
  assert.deepEqual(forma(2, verticale), [1, 2, 1, true]);
  assert.deepEqual(forma(3, verticale), [2, 2, 2, true]);
  assert.deepEqual(forma(5, verticale), [2, 3, 2, true]);
});

test("otto e dodici posti: le forme piu' piccole che li contengono", () => {
  assert.deepEqual(forma(4, { colonne: 4, righe: 2 }), [2, 2, 1, true]);
  assert.deepEqual(forma(7, { colonne: 4, righe: 2 }), [4, 2, 2, true]);
  assert.deepEqual(forma(7, { colonne: 4, righe: 3 }), [4, 2, 2, true]);
  assert.deepEqual(forma(9, { colonne: 4, righe: 3 }), [3, 3, 1, true]);
  assert.deepEqual(forma(10, { colonne: 4, righe: 3 }), [4, 3, 3, true]);
  // Nove posti (3x3): sette riquadri non diventano quattro colonne.
  assert.deepEqual(forma(7, { colonne: 3, righe: 3 }), [3, 3, 3, true]);
});

test("il tablet disegna solo i riquadri che ci sono, e l'antifurto da solo e' grande", () => {
  assert.match(sezione, /grigliaPerQuanti\(quante, scelta\)/);
  assert.match(sezione, /\.mu-g6\.mu-adatta>:last-child\{grid-column:span var\(--mu-larga,1\)\}/);
  assert.match(sezione, /state\.compatto && !soloLAntifurto\(pagina\)/);
  // Il pannello piccolo con uno o due riquadri non spegne i loro tasti.
  assert.match(sezione, /:not\(\.mu-ampia\)>\.mu-card \.mu-seg/);
});
