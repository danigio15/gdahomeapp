/* Uno spostamento parte dall'ordine voluto, non da quello del DOM (#379).
 *
 * Nel video delle novita': in Sicurezza il riquadro del fumo portato sopra
 * l'antifurto tornava sotto appena lo si lasciava, e Salva scriveva `{}`. La
 * griglia sposta la voce mentre si trascina e al rilascio dice «da 1 a 0»;
 * rileggere l'ordine dal DOM — gia' spostato — e rifare lo spostamento lo
 * faceva due volte. Qui il conto puro: l'ordine da cui si parte e' la serie con
 * la scelta sopra, qualunque cosa ci sia adesso nel DOM. */
import assert from "node:assert/strict";
import test from "node:test";

import { ordineDaCuiSiParte } from "../src/core/disposizione.js";

const sposta = (ordine, da, a) => {
  const fila = [...ordine];
  const [presa] = fila.splice(da, 1);
  fila.splice(a, 0, presa);
  return fila;
};

test("senza scelta si parte dalla serie", () => {
  assert.deepEqual(ordineDaCuiSiParte(["antifurto", "fumo", "telecamere"], ["antifurto", "fumo", "telecamere"], {}), [
    "antifurto",
    "fumo",
    "telecamere",
  ]);
});

test("uno spostamento di un posto resta fatto, anche col DOM gia' spostato", () => {
  const serie = ["antifurto", "fumo", "telecamere"];
  /* Il DOM al rilascio: la griglia ha gia' messo il fumo in cima. */
  const nelDom = ["fumo", "antifurto", "telecamere"];
  const partenza = ordineDaCuiSiParte(serie, nelDom, {});
  assert.deepEqual(sposta(partenza, 1, 0), ["fumo", "antifurto", "telecamere"]);
  /* Prima si partiva dal DOM, e lo stesso «da 1 a 0» lo rimetteva sotto. */
  assert.deepEqual(sposta(nelDom, 1, 0), ["antifurto", "fumo", "telecamere"]);
});

test("l'ultimo portato in cima va in cima, non a meta'", () => {
  const serie = ["a", "b", "c", "d"];
  const nelDom = ["d", "a", "b", "c"];
  assert.deepEqual(sposta(ordineDaCuiSiParte(serie, nelDom, {}), 3, 0), ["d", "a", "b", "c"]);
});

test("la bozza di prima conta: il secondo spostamento parte dal primo", () => {
  const serie = ["a", "b", "c"];
  const bozza = { ordine: ["c", "a", "b"], nascosti: [], misure: {} };
  assert.deepEqual(ordineDaCuiSiParte(serie, ["a", "b", "c"], bozza), ["c", "a", "b"]);
});

test("una voce che la serie non conosce ancora sta dove l'ha messa la pagina", () => {
  assert.deepEqual(ordineDaCuiSiParte(["a", "c"], ["a", "b", "c"], {}), ["a", "b", "c"]);
  assert.deepEqual(ordineDaCuiSiParte(undefined, ["x", "y"], {}), ["x", "y"]);
});

test("una voce che non c'e' piu' non entra nell'ordine", () => {
  assert.deepEqual(ordineDaCuiSiParte(["a", "b", "c"], ["a", "c"], {}), ["a", "c"]);
});
