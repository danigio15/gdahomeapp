/* I tubi delle macchine che si spostano (#379): i conti.
 *
 * Scaldabagno, caldaia, stufa e UPS hanno tubi e cavi disegnati a mano su un
 * foglio di 1000 × 600. Quando un pezzo si sposta, il tubo che lo tocca si
 * rifa' con questi conti: qui si tiene fermo che la canna fumaria di una stufa
 * rimasta al suo posto e' quella di sempre, che due pezzi si guardano dal lato
 * giusto, e che l'aria calda va da un punto all'altro senza giri.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  cannaFumaria,
  latiFra,
  soffioFra,
  tuboOrtogonale,
} from "../src/core/posizioni-nei-disegni.js";

test("la canna fumaria della stufa al suo posto e' quella disegnata a mano", () => {
  assert.equal(cannaFumaria([300, 330]), "M 300 300 L 300 92 L 360 62 L 360 -20");
});

test("la canna segue la stufa, e con la stufa in alto piega piu' su", () => {
  assert.equal(cannaFumaria([500, 330]), "M 500 300 L 500 92 L 560 62 L 560 -20");
  const alta = cannaFumaria([300, 100]);
  /* Parte da dietro il corpo (70) e piega sopra di lui (30), mai sotto. */
  assert.equal(alta, "M 300 70 L 300 30 L 360 0 L 360 -20");
});

test("due pezzi si guardano dal lato in cui sono piu' lontani", () => {
  assert.deepEqual(latiFra([100, 300], [800, 320]), ["e", "w"]);
  assert.deepEqual(latiFra([800, 300], [100, 320]), ["w", "e"]);
  assert.deepEqual(latiFra([400, 100], [420, 500]), ["s", "n"]);
  assert.deepEqual(latiFra([400, 500], [420, 100]), ["n", "s"]);
});

test("l'aria calda va dal primo punto al secondo, in una curva sola", () => {
  const d = soffioFra([300, 248], [550, 300]);
  assert.match(d, /^M 300 248 C [\d.]+ 248, [\d.]+ 300, 550 300$/);
});

test("un cavo fra due pezzi spostati e' a tratti diritti, da porta a porta", () => {
  const d = tuboOrtogonale([
    { p: [200, 300], verso: "e" },
    { p: [700, 420], verso: "w" },
  ]);
  assert.match(d, /^M 200 300 /);
  assert.match(d, / L 700 420$/);
});
