/* Il QR per riabbinare un telefono gia' abbinato.
 *
 * «Dai la possibilita' di rigenerare il QR vicino al dispositivo, nel caso si
 * cancella e reinstalla l'app.» Un'app rimessa ha perso il suo segno, e col
 * QR di tutti i giorni rientrava come un telefono nuovo: nome nuovo, un posto
 * in piu' (con Base, al tetto, non entrava) e i sensori della Salute da capo.
 * Col QR di quel telefono riprende il suo posto.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Abbinamento } from "../src/abbinamento.js";
import { Dispositivi } from "../src/dispositivi.js";

function cartella() {
  const dove = mkdtempSync(join(tmpdir(), "riabbina-"));
  return { dove, via: () => rmSync(dove, { recursive: true, force: true }) };
}

const UTENTE = "0f9e8d7c6b5a49382716f5e4d3c2b1a0";

test("il codice per un telefono dice quale, e si spende una volta", () => {
  const a = new Abbinamento();
  const { codice, perIl } = a.nuovo(UTENTE, { perIl: "dm_abc" });
  assert.equal(perIl, "dm_abc");
  assert.equal(a.vivo().perIl, "dm_abc");
  assert.deepEqual(a.consuma(codice), { utente: UTENTE, perIl: "dm_abc" });
  /* Il codice di tutti i giorni resta com'era. */
  const altro = a.nuovo(UTENTE);
  assert.equal(altro.perIl, undefined);
  assert.deepEqual(a.consuma(altro.codice), { utente: UTENTE });
});

test("riabbinato, il telefono resta lui: stesso id, nome e persona, segno nuovo", () => {
  const c = cartella();
  try {
    const d = new Dispositivi({ cartella: c.dove, massimi: 1 });
    const prima = d.abbina({ nome: "Pixel", sistema: "android", utente: UTENTE });
    d.rinomina(prima.dispositivo.id, "Il telefono in cucina");
    /* Al tetto: un telefono nuovo non entrerebbe, lui si'. */
    const dopo = d.abbina({
      nome: "Pixel",
      sistema: "android",
      utente: UTENTE,
      sostituisce: prima.dispositivo.id,
    });
    assert.equal(dopo.riabbinato, true);
    assert.equal(dopo.dispositivo.id, prima.dispositivo.id);
    assert.equal(dopo.dispositivo.nome, "Il telefono in cucina");
    assert.equal(dopo.dispositivo.utente, UTENTE);
    assert.equal(d.elenco().length, 1);
    /* Il segno di prima non apre piu'; quello nuovo si'. */
    assert.equal(d.riconosci(prima.segno), null);
    assert.equal(d.riconosci(dopo.segno).id, prima.dispositivo.id);
    assert.notEqual(dopo.chiave, prima.chiave);
  } finally {
    c.via();
  }
});

test("un telefono che non c'e' piu' non si riabbina: entra come nuovo", () => {
  const c = cartella();
  try {
    const d = new Dispositivi({ cartella: c.dove });
    const nuovo = d.abbina({ nome: "Pixel", sostituisce: "dm_che_non_ce" });
    assert.equal(nuovo.riabbinato, undefined);
    assert.notEqual(nuovo.dispositivo.id, "dm_che_non_ce");
  } finally {
    c.via();
  }
});
