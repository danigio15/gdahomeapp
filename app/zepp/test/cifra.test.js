/* La cifratura dell'orologio e' quella della casa, byte per byte: le buste
 * chiuse qui si aprono con `ponte/src/cifra.js`, e il contrario. E i testi
 * diventano byte come li fa Node, senza `TextEncoder`. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import * as casa from "../../../ponte/src/cifra.js";
import {
  Busta,
  chiaveDiSessione,
  coppiaEffimera,
  daBase64,
  daByte,
  improntaDellaStretta,
  inBase64,
  inByte,
} from "../app-side/cifra.js";

const caso = (n) => new Uint8Array(randomBytes(n));

test("i testi diventano byte e base64 come in Node", () => {
  for (const testo of ["", "a", "Più luce · 75 %", "🏠 casa", "x".repeat(1000)]) {
    assert.deepEqual(Buffer.from(inByte(testo)), Buffer.from(testo, "utf8"));
    assert.equal(daByte(inByte(testo)), testo);
  }
  for (let n = 0; n < 40; n += 1) {
    const byte = caso(n);
    assert.equal(inBase64(byte), Buffer.from(byte).toString("base64"));
    assert.deepEqual(Buffer.from(daBase64(inBase64(byte))), Buffer.from(byte));
  }
});

test("la chiave di sessione e le buste coincidono con quelle della casa", () => {
  const orologio = coppiaEffimera(caso);
  const dellaCasa = casa.coppiaEffimera();
  const apertura = caso(16);
  const chiaveDelFilo = casa.chiaveDelFiloNuova();
  const stretta = improntaDellaStretta('{"ciao":1}', '{"pronto":true}');
  assert.deepEqual(
    Buffer.from(stretta),
    casa.improntaDellaStretta('{"ciao":1}', '{"pronto":true}'),
  );

  const qui = chiaveDiSessione({
    miaSegreta: orologio.segreta,
    suaPubblica: dellaCasa.pubblica.toString("base64"),
    delTelefono: orologio.pubblica,
    dellaCasa: dellaCasa.pubblica.toString("base64"),
    apertura,
    chiaveDelFilo,
    stretta,
  });
  const la = casa.chiaveDiSessione({
    miaPrivata: dellaCasa.privata,
    suaPubblica: Buffer.from(orologio.pubblica).toString("base64"),
    delTelefono: Buffer.from(orologio.pubblica),
    dellaCasa: dellaCasa.pubblica,
    apertura: Buffer.from(apertura),
    chiaveDelFilo,
    stretta: Buffer.from(stretta),
  });
  assert.deepEqual(Buffer.from(qui), la);

  const mia = new Busta(qui);
  const sua = new casa.Busta(la, { io: "casa" });
  assert.equal(sua.apri(mia.chiudi("accendi la luce")), "accendi la luce");
  assert.equal(mia.apri(sua.chiudi("Fatto ✓")), "Fatto ✓");
  assert.throws(() => mia.apri(sua.chiudi("uno")) && mia.apri(mia.chiudi("dalla parte sbagliata")));
});

test("col codice la chiave e' quella dell'abbinamento della casa", () => {
  const orologio = coppiaEffimera(caso);
  const dellaCasa = casa.coppiaEffimera();
  const apertura = caso(16);
  const qui = chiaveDiSessione({
    miaSegreta: orologio.segreta,
    suaPubblica: dellaCasa.pubblica.toString("base64"),
    delTelefono: orologio.pubblica,
    dellaCasa: dellaCasa.pubblica,
    apertura,
    codice: "abcd-efgh-2345-6789",
  });
  const la = casa.chiaveDiSessione({
    miaPrivata: dellaCasa.privata,
    suaPubblica: Buffer.from(orologio.pubblica).toString("base64"),
    delTelefono: Buffer.from(orologio.pubblica),
    dellaCasa: dellaCasa.pubblica,
    apertura: Buffer.from(apertura),
    codice: "ABCDEFGH23456789",
  });
  assert.deepEqual(Buffer.from(qui), la);
});
