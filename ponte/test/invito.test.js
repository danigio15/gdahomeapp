/* Le prove dell'invito.
 *
 * Questo formato ha due meta' che vivono in due mondi diversi: qui lo scrive
 * il ponte, in `app/lib/ponte/invito.dart` lo legge il telefono. Non c'e'
 * nessun compilatore che le tenga insieme — l'unica cosa che le tiene insieme
 * sono **queste righe**, ricopiate identiche di la'. Se un giorno divergono,
 * una delle due prove diventa rossa prima che qualcuno inquadri un quadretto
 * che non si apre.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { invito, leggiLInvito, InvitoIllegibile, InvitoTroppoNuovo } from "../src/invito.js";

/* Gli stessi che stanno nelle prove in Dart. Non si toccano da una parte
 * sola. */
const VETTORI = [
  {
    come: "tutto quello che c'e' da dire",
    pezzi: {
      codice: "ABCD2345EFGH6789",
      centralino: "wss://centralino.esempio.dev",
      indirizzi: ["192.168.1.50:8098", "10.0.0.4:8098"],
    },
    scritto:
      "gdahome|1|ABCD2345EFGH6789|wss://centralino.esempio.dev|192.168.1.50:8098,10.0.0.4:8098",
  },
  {
    come: "una casa senza centralino: si entra solo da dentro",
    pezzi: { codice: "ABCD2345EFGH6789", centralino: "", indirizzi: ["192.168.1.50:8098"] },
    scritto: "gdahome|1|ABCD2345EFGH6789||192.168.1.50:8098",
  },
  {
    come: "una casa di cui non si sanno gli indirizzi",
    pezzi: {
      codice: "ABCD2345EFGH6789",
      centralino: "wss://centralino.esempio.dev",
      indirizzi: [],
    },
    scritto: "gdahome|1|ABCD2345EFGH6789|wss://centralino.esempio.dev|",
  },
  {
    come: "il codice e basta",
    pezzi: { codice: "ABCD2345EFGH6789", centralino: "", indirizzi: [] },
    scritto: "gdahome|1|ABCD2345EFGH6789||",
  },
];

test("scrive quello che le prove in Dart si aspettano di leggere", () => {
  for (const uno of VETTORI) {
    assert.equal(invito(uno.pezzi), uno.scritto, uno.come);
  }
});

test("e rilegge quello che ha scritto", () => {
  for (const uno of VETTORI) {
    assert.deepEqual(leggiLInvito(uno.scritto), uno.pezzi, uno.come);
  }
});

test("perdona quello che ci mette in mezzo chi legge i quadretti", () => {
  /* Un lettore di QR restituisce quello che trova, e ogni tanto ci lascia
   * attaccato un a capo. Non e' un motivo per dire di no a un codice buono. */
  const letto = leggiLInvito("  gdahome|1|ABCD2345EFGH6789||192.168.1.50:8098 \n");
  assert.equal(letto.codice, "ABCD2345EFGH6789");
  assert.deepEqual(letto.indirizzi, ["192.168.1.50:8098"]);

  assert.equal(leggiLInvito("GDAHOME|1|ABCD||").codice, "ABCD");
});

test("un campo in piu' non rompe le app di oggi", () => {
  /* E' il motivo per cui i campi stanno in coda e non in mezzo: quello che
   * arrivera' domani, un'app di oggi lo salta e va avanti. */
  const letto = leggiLInvito("gdahome|1|ABCD||192.168.1.50:8098|qualcosa|che|verra'|dopo");
  assert.equal(letto.codice, "ABCD");
  assert.deepEqual(letto.indirizzi, ["192.168.1.50:8098"]);
});

test("un invito di domani si riconosce come tale, e lo si dice", () => {
  /* La differenza che conta: «non ti capisco» manda a controllare il codice,
   * «sei vecchio» manda ad aggiornare. Sono due strade diverse, e indovinare
   * quale sia tocca a noi, non all'utente. */
  assert.throws(() => leggiLInvito("gdahome|2|ABCD||"), InvitoTroppoNuovo);
});

test("quello che non e' un invito lo dice, invece di leggerlo a meta'", () => {
  for (const roba of [
    "",
    "   ",
    "ciao",
    "https://www.esempio.it/",
    "gdahome",
    "gdahome|1",
    "gdahome|1|",
    "gdahome|1||",
    "gdahome|x|ABCD||",
    "altracosa|1|ABCD||",
  ]) {
    assert.throws(() => leggiLInvito(roba), InvitoIllegibile, `«${roba}» non e' un invito`);
  }
});

test("un invito senza codice non si scrive nemmeno", () => {
  assert.throws(() => invito({ codice: "" }), InvitoIllegibile);
  assert.throws(() => invito({}), InvitoIllegibile);
});

test("gli spazi intorno ai pezzi si tolgono da soli", () => {
  assert.equal(
    invito({ codice: " ABCD ", centralino: " wss://c ", indirizzi: [" 10.0.0.1:8098 ", ""] }),
    "gdahome|1|ABCD|wss://c|10.0.0.1:8098",
  );
});
