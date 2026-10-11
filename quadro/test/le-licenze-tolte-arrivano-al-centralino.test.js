/* Le licenze tolte, che il centralino chiede al quadro.
 *
 * Un gettone vale otto giorni, e una licenza tolta apriva il fuori casa fino
 * alla fine del gettone. Il centralino adesso chiede qui l'elenco delle tolte
 * (`GET /v1/licenze/revocate`) e chiude prima — ma solo chi va chiuso:
 *
 *  1. ci va una licenza gdahome di una casa, tolta negli ultimi otto giorni;
 *  2. non ci va se la casa ne ha un'altra buona: non deve restare fuori nelle
 *     ore che le servono a farsi dare il gettone dell'altra;
 *  3. non ci vanno le scadute, ne' quelle dei telefoni, ne' quelle tolte da
 *     piu' di otto giorni;
 *  4. l'elenco e' firmato come un gettone, con `tipo: "revoche"`, e si
 *     verifica con la stessa pubblica;
 *  5. la via risponde senza chiave, e 503 a licenze spente.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createPublicKey, verify } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { alzaIlQuadro } from "../src/index.js";
import { Licenze, OTTO_GIORNI } from "../src/licenze.js";
import { Negozi } from "../src/negozi.js";

/* La coppia **di prova** del contratto. Non va mai in un file di produzione. */
const PUBBLICA = "6P9sdqQtlHcmH7Ve_SgzmyJmxJS28CNORRJJfjI3rnI";
const PRIVATA = "Q2Iu3eKMxw3Y1GS9MypZjXvjPfHB959KImNldY80xr0";

const UNA = "casa_a3f19c74e05b2d8890fa4c1e6b73d052";
const ALTRA = "casa_71cd3a6e884b09f25de4a1c7b3608e14";
const TERZA = "casa_0b1c2d3e4f5a69788796a5b4c3d2e1f0";
const TEL = "tel_00112233445566778899aabbccddeeff";
const GIORNO = 24 * 60 * 60 * 1000;

function conLeLicenze(fai) {
  const cartella = mkdtempSync(join(tmpdir(), "licenze-tolte-"));
  const orologio = { ora: Date.parse("2026-10-01T10:00:00Z") };
  try {
    const licenze = new Licenze({ cartella, chiave: PRIVATA, adesso: () => orologio.ora });
    fai(licenze, orologio);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
}

/* Il primo pezzo, letto, e la firma verificata a mano con la pubblica: come
 * fa il centralino. */
function apri(firmato) {
  const [primo, firma] = firmato.split(".");
  const pubblica = createPublicKey({
    key: { kty: "OKP", crv: "Ed25519", x: PUBBLICA },
    format: "jwk",
  });
  assert.ok(verify(null, Buffer.from(primo, "ascii"), pubblica, Buffer.from(firma, "base64url")));
  return JSON.parse(Buffer.from(primo, "base64url").toString("utf8"));
}

test("una licenza tolta a una casa che non ne ha altre va nell'elenco", () => {
  conLeLicenze((licenze) => {
    const una = licenze.regala({ app: "gdahome", casa: UNA, mesi: 12 });
    assert.deepEqual(licenze.tolte(), [], "una licenza buona non e' tolta");
    licenze.togli(una.lic);
    assert.deepEqual(licenze.tolte(), [una.lic]);
  });
});

test("se la casa ne ha un'altra buona, la tolta non ci va: niente ore fuori per chi ha diritto", () => {
  conLeLicenze((licenze) => {
    const prima = licenze.regala({ app: "gdahome", casa: UNA, mesi: 1 });
    licenze.regala({ app: "gdahome", casa: UNA, mesi: null });
    licenze.togli(prima.lic);
    assert.deepEqual(licenze.tolte(), []);
  });
});

test("ridata dopo, la casa esce dall'elenco", () => {
  conLeLicenze((licenze) => {
    const prima = licenze.regala({ app: "gdahome", casa: UNA, mesi: 1 });
    licenze.togli(prima.lic);
    assert.deepEqual(licenze.tolte(), [prima.lic]);
    licenze.regala({ app: "gdahome", casa: UNA, mesi: 1 });
    assert.deepEqual(licenze.tolte(), []);
  });
});

test("dopo otto giorni non serve piu': ogni suo gettone e' gia' scaduto da se'", () => {
  conLeLicenze((licenze, orologio) => {
    const una = licenze.regala({ app: "gdahome", casa: UNA, mesi: 12 });
    licenze.togli(una.lic);
    orologio.ora += OTTO_GIORNI - 1;
    assert.deepEqual(licenze.tolte(), [una.lic]);
    orologio.ora += 1;
    assert.deepEqual(licenze.tolte(), []);
  });
});

test("le scadute, i telefoni e gdanav non ci vanno", () => {
  conLeLicenze((licenze, orologio) => {
    /* Scaduta e basta: il suo gettone porta gia' la scadenza. */
    licenze.regala({ app: "gdahome", casa: ALTRA, mesi: 1 });
    orologio.ora += 40 * GIORNO;
    /* gdanav di una casa, tolta: al centralino non serve. */
    const nav = licenze.regala({ app: "gdanav", casa: TERZA, mesi: 1 });
    licenze.togli(nav.lic);
    /* E una licenza di un telefono, tolta a mano. */
    const delTelefono = licenze._nuova({
      app: "gdahome",
      sog: TEL,
      origine: "regalo",
      scade: null,
    });
    licenze.togli(delTelefono.lic);
    assert.deepEqual(licenze.tolte(), []);
  });
});

test("l'elenco e' firmato come un gettone, e non si confonde con un gettone", () => {
  conLeLicenze((licenze, orologio) => {
    const una = licenze.regala({ app: "gdahome", casa: UNA, mesi: 12 });
    licenze.togli(una.lic);
    const detto = apri(licenze.elencoDelleTolte());
    assert.deepEqual(detto, { v: 1, tipo: "revoche", emesso: orologio.ora, lic: [una.lic] });
    /* Niente `sog` e niente `fino`: nessuno lo puo' prendere per un gettone. */
    assert.equal(detto.sog, undefined);
    assert.equal(detto.fino, undefined);
  });
});

test("senza la privata l'elenco non si firma", () => {
  const cartella = mkdtempSync(join(tmpdir(), "licenze-tolte-"));
  try {
    const licenze = new Licenze({ cartella, chiave: "" });
    assert.throws(() => licenze.elencoDelleTolte(), { stato: 503 });
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("la via: GET /v1/licenze/revocate risponde senza chiave, e 503 a licenze spente", async () => {
  for (const chiave of [PRIVATA, ""]) {
    const cartella = mkdtempSync(join(tmpdir(), "quadro-tolte-"));
    const acceso = await alzaIlQuadro({
      porta: 0,
      cartella,
      livello: "errore",
      chiaveDelGestore: "una-chiave-lunga-abbastanza-per-il-gestore",
      chiaveDelleLicenze: chiave,
      negozi: new Negozi({ ambiente: {} }),
    });
    try {
      const risposta = await fetch(`http://127.0.0.1:${acceso.porta}/v1/licenze/revocate`, {
        headers: { "x-forwarded-for": "203.0.113.7" },
      });
      const detto = await risposta.json();
      if (chiave) {
        assert.equal(risposta.status, 200);
        assert.deepEqual(apri(detto.elenco).lic, []);
        assert.equal(apri(detto.elenco).tipo, "revoche");
      } else {
        assert.equal(risposta.status, 503);
        assert.equal(detto.errore, "licenze-non-configurate");
      }
      /* Le altre vie delle licenze restano POST e basta. */
      const sbagliata = await fetch(`http://127.0.0.1:${acceso.porta}/v1/licenze/revocate`, {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.8" },
      });
      assert.notEqual(sbagliata.status, 200);
      await sbagliata.body?.cancel();
    } finally {
      await acceso.spegni();
      rmSync(cartella, { recursive: true, force: true });
    }
  }
});

test("la via dice le tolte vere, quelle del gestore", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "quadro-tolte-"));
  const CHIAVE = "una-chiave-lunga-abbastanza-per-il-gestore";
  const acceso = await alzaIlQuadro({
    porta: 0,
    cartella,
    livello: "errore",
    chiaveDelGestore: CHIAVE,
    chiaveDelleLicenze: PRIVATA,
    negozi: new Negozi({ ambiente: {} }),
  });
  const dove = `http://127.0.0.1:${acceso.porta}`;
  const gestore = async (via, metodo = "GET", corpo) => {
    const risposta = await fetch(`${dove}/gestore${via}`, {
      method: metodo,
      headers: { authorization: `Bearer ${CHIAVE}`, "content-type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    return { stato: risposta.status, detto: await risposta.json() };
  };
  try {
    const data = await gestore("/licenze", "POST", { app: "gdahome", casa: UNA, mesi: 12 });
    assert.equal(data.stato, 200);
    const lic = data.detto.licenza;
    assert.match(String(lic), /^lic_[0-9a-f]{16}$/);
    assert.equal((await gestore(`/licenze/${lic}`, "DELETE")).stato, 200);
    const risposta = await fetch(`${dove}/v1/licenze/revocate`, {
      headers: { "x-forwarded-for": "203.0.113.9" },
    });
    assert.deepEqual(apri((await risposta.json()).elenco).lic, [lic]);
  } finally {
    await acceso.spegni();
    rmSync(cartella, { recursive: true, force: true });
  }
});
