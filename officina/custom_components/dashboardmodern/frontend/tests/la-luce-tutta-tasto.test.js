/* La luce «tutta tasto» del muro: il dito che scorre su una dimmerabile ne
 * regola la luminosita' partendo da quella che c'e', senza farla saltare dove
 * si e' posato, e senza mai spegnerla (per spegnere c'e' il tocco). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { luminositaDalGesto } from "../src/sections/plancia-a-muro-section.js";

test("il dito parte dalla luminosita' che c'e'", () => {
  assert.equal(luminositaDalGesto({ p0: 40, d: 0, misura: 200 }), 40);
  /* Mezza tessera in su: cinquanta punti in piu'. */
  assert.equal(luminositaDalGesto({ p0: 40, d: 100, misura: 200 }), 90);
  assert.equal(luminositaDalGesto({ p0: 40, d: -50, misura: 200 }), 15);
});

test("non va oltre il cento e non spegne", () => {
  assert.equal(luminositaDalGesto({ p0: 80, d: 400, misura: 200 }), 100);
  assert.equal(luminositaDalGesto({ p0: 20, d: -400, misura: 200 }), 1);
  /* Una luce spenta si accende dal basso. */
  assert.equal(luminositaDalGesto({ p0: 0, d: 30, misura: 300 }), 10);
  assert.equal(luminositaDalGesto({ p0: 50, d: 10, misura: 0 }), 100);
});
