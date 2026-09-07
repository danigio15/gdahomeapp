/* Le prove della cifratura.
 *
 * Quello che si prova non e' «che cifri»: e' che **rifiuti** tutto quello che
 * va rifiutato. Una cifratura che apre buste altrui, buste toccate o buste
 * rigiocate non e' una cifratura, e' un rituale.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  aperturaNuova,
  Busta,
  BustaGuasta,
  chiaveDelFiloNuova,
  chiaveDiSessione,
  coppiaEffimera,
} from "../src/cifra.js";

/* Una stretta di mano intera, come succede a ogni collegamento. */
function unaStretta({ chiaveDelFilo = null, apertura = aperturaNuova() } = {}) {
  const telefono = coppiaEffimera();
  const casa = coppiaEffimera();
  const comune = {
    delTelefono: telefono.pubblica,
    dellaCasa: casa.pubblica,
    apertura,
    chiaveDelFilo,
  };
  return {
    telefono,
    casa,
    apertura,
    daDentroIlTelefono: chiaveDiSessione({
      ...comune,
      miaPrivata: telefono.privata,
      suaPubblica: casa.pubblica,
    }),
    daDentroLaCasa: chiaveDiSessione({
      ...comune,
      miaPrivata: casa.privata,
      suaPubblica: telefono.pubblica,
    }),
  };
}

function dueBuste(chiave) {
  return {
    telefono: new Busta(chiave, { io: "telefono" }),
    casa: new Busta(chiave, { io: "casa" }),
  };
}

/* ─── Le chiavi ──────────────────────────────────────────────────────────── */

test("le due punte arrivano alla stessa chiave senza mai mandarsela", () => {
  const stretta = unaStretta({ chiaveDelFilo: chiaveDelFiloNuova() });
  assert.deepEqual(stretta.daDentroIlTelefono, stretta.daDentroLaCasa);
  assert.equal(stretta.daDentroIlTelefono.length, 32);
});

test("funziona anche senza la chiave del filo, che e' il caso dell'abbinamento", () => {
  const stretta = unaStretta();
  assert.deepEqual(stretta.daDentroIlTelefono, stretta.daDentroLaCasa);
});

test("chi ha visto passare le due chiavi pubbliche non ricava niente", () => {
  /* E' quello che vede il centralino: due chiavi pubbliche e l'apertura. Con
   * quelle sole non si arriva alla chiave comune. */
  const stretta = unaStretta();
  const chiGuarda = coppiaEffimera();
  const indovinata = chiaveDiSessione({
    miaPrivata: chiGuarda.privata,
    suaPubblica: stretta.casa.pubblica,
    delTelefono: stretta.telefono.pubblica,
    dellaCasa: stretta.casa.pubblica,
    apertura: stretta.apertura,
  });
  assert.notDeepEqual(stretta.daDentroLaCasa, indovinata);
});

test("chi si mettesse in mezzo per davvero non passa, se c'e' la chiave del filo", () => {
  /* E' la differenza fra un centralino che guarda e uno riscritto per
   * attaccare. Con la chiave del filo, lo scambio effimero da solo non basta:
   * chi non ce l'ha arriva a un'altra chiave. */
  const stretta = unaStretta({ chiaveDelFilo: chiaveDelFiloNuova() });
  const inMezzo = coppiaEffimera();
  const suo = chiaveDiSessione({
    miaPrivata: inMezzo.privata,
    suaPubblica: stretta.casa.pubblica,
    delTelefono: stretta.telefono.pubblica,
    dellaCasa: stretta.casa.pubblica,
    apertura: stretta.apertura,
    chiaveDelFilo: chiaveDelFiloNuova(),
  });
  assert.notDeepEqual(stretta.daDentroLaCasa, suo);
});

test("lo stesso telefono ha una chiave diversa a ogni collegamento", () => {
  /* Senza, due collegamenti riuserebbero gli stessi nonce con la stessa
   * chiave — e in GCM quello non indebolisce: rompe. */
  const chiaveDelFilo = chiaveDelFiloNuova();
  const una = unaStretta({ chiaveDelFilo });
  const altra = unaStretta({ chiaveDelFilo });
  assert.notDeepEqual(una.daDentroLaCasa, altra.daDentroLaCasa);
});

test("due abbinamenti non danno mai la stessa chiave", () => {
  const chiavi = new Set();
  for (let i = 0; i < 20; i += 1) {
    chiavi.add(unaStretta().daDentroLaCasa.toString("hex"));
  }
  assert.equal(chiavi.size, 20);
});

/* ─── Le buste ───────────────────────────────────────────────────────────── */

test("quello che si chiude da una parte si apre dall'altra", () => {
  const { telefono, casa } = dueBuste(unaStretta().daDentroLaCasa);
  const detto = JSON.stringify({ type: "auth", access_token: "il-mio-segno" });

  const busta = telefono.chiudi(detto);
  assert.notEqual(busta, detto);
  assert.equal(busta.includes("access_token"), false, "in chiaro non si legge niente");
  assert.equal(casa.apri(busta), detto);
});

test("si parla nei due sensi, e i due versi non si mescolano", () => {
  const { telefono, casa } = dueBuste(unaStretta().daDentroLaCasa);
  assert.equal(casa.apri(telefono.chiudi("uno")), "uno");
  assert.equal(telefono.apri(casa.chiudi("due")), "due");
  assert.equal(casa.apri(telefono.chiudi("tre")), "tre");
});

test("una busta mandata da me non la posso aprire io", () => {
  const { telefono } = dueBuste(unaStretta().daDentroLaCasa);
  assert.throws(() => telefono.apri(telefono.chiudi("parlo da solo")), BustaGuasta);
});

test("una busta toccata anche di un byte non si apre", () => {
  const { telefono, casa } = dueBuste(unaStretta().daDentroLaCasa);
  const busta = Buffer.from(telefono.chiudi("non toccarmi"), "base64");
  for (const dove of [0, 13, busta.length - 1]) {
    const rovinata = Buffer.from(busta);
    rovinata[dove] ^= 0x01;
    assert.throws(() => casa.apri(rovinata.toString("base64")), BustaGuasta, `byte ${dove}`);
  }
});

test("una busta rigiocata non passa due volte", () => {
  const { telefono, casa } = dueBuste(unaStretta().daDentroLaCasa);
  const busta = telefono.chiudi("accendi tutto");
  assert.equal(casa.apri(busta), "accendi tutto");
  /* Chi sta in mezzo ha registrato quella busta e la rimanda. */
  assert.throws(() => casa.apri(busta), BustaGuasta);
});

test("le buste fuori ordine si rifiutano", () => {
  const { telefono, casa } = dueBuste(unaStretta().daDentroLaCasa);
  const prima = telefono.chiudi("prima");
  const seconda = telefono.chiudi("seconda");
  assert.throws(() => casa.apri(seconda), BustaGuasta, "non si salta avanti");
  assert.equal(casa.apri(prima), "prima");
  assert.equal(casa.apri(seconda), "seconda");
});

test("una busta di un altro filo non si apre", () => {
  const uno = dueBuste(unaStretta().daDentroLaCasa);
  const due = dueBuste(unaStretta().daDentroLaCasa);
  assert.throws(() => due.casa.apri(uno.telefono.chiudi("ciao")), BustaGuasta);
});

test("una busta storta non fa esplodere niente, dice solo di no", () => {
  const { casa } = dueBuste(unaStretta().daDentroLaCasa);
  for (const roba of ["", "non base64!!!", "AAAA", Buffer.alloc(27).toString("base64")]) {
    assert.throws(() => casa.apri(roba), BustaGuasta, `«${roba}»`);
  }
});
