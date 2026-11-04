/* Riordinare trascinando (#379): i conti che decidono dove cade una riga.
 *
 * «Sarebbe carino se le tessere si potessero spostare con drag & drop.» Il
 * trascinamento vero si prova nel browser; qui si tengono fermi i tre conti
 * che lo governano: dove cade una riga a seconda di dove sta il suo centro,
 * come cambia l'elenco quando cade, e quanto scorre l'elenco vicino ai bordi.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { doveCade, scorrimentoAlBordo, spostaNellaLista } from "../src/sections/trascina-per-riordinare.js";

/* Cinque righe alte 40 con 8 di spazio: centri a 20, 68, 116, 164, 212. */
const centri = [20, 68, 116, 164, 212];

test("ferma dov'era, la riga resta al suo posto", () => {
  assert.equal(doveCade(centri, 2, 116), 2);
  assert.equal(doveCade(centri, 0, 20), 0);
});

test("passato il centro della vicina, prende il suo posto", () => {
  assert.equal(doveCade(centri, 2, 160), 2, "prima del centro della successiva resta");
  assert.equal(doveCade(centri, 2, 170), 3, "oltre il centro della successiva scende");
  assert.equal(doveCade(centri, 2, 70), 2, "sotto il centro della precedente resta");
  assert.equal(doveCade(centri, 2, 66), 1, "sopra il centro della precedente sale");
  assert.equal(doveCade(centri, 4, -50), 0, "in cima a tutte");
  assert.equal(doveCade(centri, 0, 999), 4, "in fondo a tutte");
});

test("l'elenco: la riga presa va nel posto nuovo, le altre scorrono", () => {
  const lista = ["meteo", "luci", "clima", "auto", "energia"];
  assert.deepEqual(spostaNellaLista(lista, 4, 0), ["energia", "meteo", "luci", "clima", "auto"]);
  assert.deepEqual(spostaNellaLista(lista, 0, 2), ["luci", "clima", "meteo", "auto", "energia"]);
  assert.deepEqual(spostaNellaLista(lista, 1, 1), lista);
  assert.deepEqual(spostaNellaLista(lista, 9, 0), lista, "un indice che non c'e' non cambia niente");
  assert.deepEqual(lista, ["meteo", "luci", "clima", "auto", "energia"], "l'originale non si tocca");
});

test("vicino ai bordi l'elenco scorre, piu' in fretta quanto piu' ci si avvicina", () => {
  assert.equal(scorrimentoAlBordo(300, 0, 600), 0, "in mezzo sta fermo");
  assert.ok(scorrimentoAlBordo(40, 0, 600) < 0, "in alto sale");
  assert.ok(scorrimentoAlBordo(570, 0, 600) > 0, "in basso scende");
  assert.ok(Math.abs(scorrimentoAlBordo(2, 0, 600)) > Math.abs(scorrimentoAlBordo(40, 0, 600)));
  assert.equal(scorrimentoAlBordo(-100, 0, 600), -14, "oltre il bordo non supera il massimo");
});
