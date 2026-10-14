/* Accanto alle persone non resta un buco (#175).
 *
 * «Sul computer e sul tablet a destra delle card delle persone resta uno
 * spazio vuoto.» Era la corsia della card del flusso dell'energia, tolta nella
 * 1.4.20. Adesso ci va l'assistente di casa — di serie — o niente, come si
 * sceglie in Config › Persone.
 *
 * Qui si tiene fermo il nucleo del posto: la scelta, quando la card sta
 * accanto e quanto e' larga, e quando va sotto.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCANTO_DI_SERIE,
  CHIAVE_ACCANTO,
  COSE_ACCANTO,
  normalizzaAccanto,
  postoAccanto,
} from "../src/core/accanto-alle-persone.js";
import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";

test("di serie l'assistente, e le scelte di prima ci tornano", () => {
  assert.deepEqual(COSE_ACCANTO, ["assistente", "niente"]);
  assert.equal(ACCANTO_DI_SERIE, "assistente");
  assert.deepEqual(normalizzaAccanto(undefined), { mostra: "assistente" });
  assert.deepEqual(normalizzaAccanto({ mostra: " niente " }), { mostra: "niente" });
  /* Chi aveva scelto il riepilogo o gli eventi si ritrova l'assistente: una
   * scelta che non esiste piu' non deve lasciare il buco. */
  assert.deepEqual(normalizzaAccanto({ mostra: "riepilogo" }), { mostra: "assistente" });
  assert.deepEqual(normalizzaAccanto({ mostra: "eventi" }), { mostra: "assistente" });
  assert.deepEqual(normalizzaAccanto(["niente"]), { mostra: "assistente" });
  /* E' della casa: viaggia fra i dispositivi come il resto della Home. */
  assert.ok(CONFIG_KEYS.includes(CHIAVE_ACCANTO));
});

test("accanto dove c'e' il buco, larga quanto il buco", () => {
  /* Un computer: sei corsie, due persone. La card ne prende due. */
  assert.deepEqual(postoAccanto({ colonne: 6, persone: 2 }), {
    accanto: true,
    sotto: false,
    persone: 2,
    larghezza: 2,
  });
  /* Una corsia libera sola: la card ne prende una. */
  assert.deepEqual(postoAccanto({ colonne: 4, persone: 3 }), {
    accanto: true,
    sotto: false,
    persone: 3,
    larghezza: 1,
  });
});

test("senza buco va sotto, e sul telefono sempre sotto", () => {
  /* Le persone riempiono la riga: nessuna va a capo per far posto, e
   * l'assistente scende sotto la fila invece di sparire. */
  assert.deepEqual(postoAccanto({ colonne: 4, persone: 4 }), {
    accanto: false,
    sotto: true,
    persone: 4,
  });
  assert.equal(postoAccanto({ colonne: 4, persone: 7 }).sotto, true);
  /* Sul telefono sotto, a tutta larghezza, anche con una persona sola. */
  assert.deepEqual(postoAccanto({ colonne: 2, persone: 1, telefono: true }), {
    accanto: false,
    sotto: true,
    persone: 1,
  });
  /* Senza persone non c'e' fila, e niente accanto. */
  assert.deepEqual(postoAccanto({ colonne: 6, persone: 0 }), {
    accanto: false,
    sotto: false,
    persone: 0,
  });
  /* Le colonne non lette (la griglia non c'e' ancora) non sono un buco. */
  assert.equal(postoAccanto({ persone: 2 }).accanto, false);
});
