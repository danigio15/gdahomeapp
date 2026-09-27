/* Le prove delle licenze, col quadro vero acceso.
 *
 * Il contratto e' `docs/LICENZE.md`, e queste prove lo tengono fermo dalla
 * parte del quadro:
 *
 *  1. **il gettone e' quello del contratto**, firmato con la coppia di prova
 *     e verificato con la sua pubblica, con `fino` al massimo otto giorni e
 *     mai oltre la scadenza;
 *  2. **chi si presenta per primo tiene il posto**: la seconda volta entra
 *     solo lo stesso segreto;
 *  3. **un codice regalo vale una volta**;
 *  4. **il pacchetto e' un limite**, durata per durata: finito, il server dice
 *     di no; tolta una licenza, il posto torna nel suo mucchio;
 *  5. **un installatore regala solo alle sue case**;
 *  6. **il negozio lo dice il negozio**: le risposte di Google e di Apple,
 *     finte ma nella loro forma, e le ricevute che non valgono;
 *  7. senza chiavi, 503 — e non un gettone che nessuno sa verificare.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { alzaIlQuadro } from "../src/index.js";
import {
  Licenze,
  OTTO_GIORNI,
  codiceRegaloPulito,
  firmaIlGettone,
  mesiDopo,
  verificaIlGettone,
} from "../src/licenze.js";
import { Negozi, laAppDel } from "../src/negozi.js";

/* La coppia **di prova** del contratto. Non va mai in un file di produzione. */
const PUBBLICA = "6P9sdqQtlHcmH7Ve_SgzmyJmxJS28CNORRJJfjI3rnI";
const PRIVATA = "Q2Iu3eKMxw3Y1GS9MypZjXvjPfHB959KImNldY80xr0";

const CHIAVE_DEL_GESTORE = "una-chiave-lunga-abbastanza-per-il-gestore";
const UNA = "casa_a3f19c74e05b2d8890fa4c1e6b73d052";
const ALTRA = "casa_71cd3a6e884b09f25de4a1c7b3608e14";
const TERZA = "casa_0b1c2d3e4f5a69788796a5b4c3d2e1f0";
const TEL = "tel_00112233445566778899aabbccddeeff";
const SEGRETO = "un-segreto-lungo-della-casa-0001";
const GIORNO = 24 * 60 * 60 * 1000;

const RAPPORTO = {
  quando: new Date().toISOString(),
  ogni: 15,
  ponte: "1.4.32.15",
  plance: { quante: 1, configurate: 1 },
  telefoni: { abbinati: 1, visti7gg: 1 },
  fuori: { acceso: true, filo: true },
  entita: { totali: 120, sparite: 0, impronte: [] },
};

/* Ogni richiesta «da fuori» arriva da un indirizzo suo: il freno delle
 * licenze conta per indirizzo, e qui si prova altro. */
let indirizzo = 0;
const unIndirizzo = () => {
  indirizzo += 1;
  return `203.0.${Math.floor(indirizzo / 250) % 250}.${(indirizzo % 250) + 1}`;
};

async function banco({ chiave = PRIVATA, negozi, installatori = [], attesaDelNegozio } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "quadro-licenze-"));
  const acceso = await alzaIlQuadro({
    porta: 0,
    cartella,
    livello: "errore",
    chiaveDelGestore: CHIAVE_DEL_GESTORE,
    chiaveDelleLicenze: chiave,
    negozi: negozi ?? new Negozi({ ambiente: {} }),
    attesaDelNegozio,
  });
  const dove = `http://127.0.0.1:${acceso.porta}`;
  const gestore = async (via, { metodo = "GET", corpo } = {}) => {
    const risposta = await fetch(`${dove}/gestore${via}`, {
      method: metodo,
      headers: { authorization: `Bearer ${CHIAVE_DEL_GESTORE}`, "content-type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    return { stato: risposta.status, detto: await risposta.json() };
  };
  const retro = async (chiaveSua, via, { metodo = "GET", corpo } = {}) => {
    const risposta = await fetch(`${dove}/console${via}`, {
      method: metodo,
      headers: { authorization: `Bearer ${chiaveSua}`, "content-type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    return { stato: risposta.status, detto: await risposta.json() };
  };
  const fuori = async (via, corpo) => {
    const risposta = await fetch(`${dove}/v1/licenze/${via}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": unIndirizzo() },
      body: JSON.stringify(corpo),
    });
    return { stato: risposta.status, detto: await risposta.json() };
  };
  /* Gli installatori, ognuno con le sue case gia' abbinate. */
  const iscritti = [];
  for (const { pacchetto, case: sue = [] } of installatori) {
    const { detto } = await gestore("/installatori", {
      metodo: "POST",
      corpo: { nome: `Installatore ${iscritti.length + 1}`, soglia: 0, pacchetto },
    });
    for (const casa of sue) {
      const invito = await retro(detto.chiave, "/inviti", { metodo: "POST", corpo: {} });
      const deposito = await fetch(`${dove}/rapporto`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${invito.detto.codice}`,
          "content-type": "application/json",
          "x-casa": casa,
          "x-casa-segreto": `il-segreto-di-${casa}`,
        },
        body: JSON.stringify(RAPPORTO),
      });
      assert.equal(deposito.status, 200);
    }
    iscritti.push(detto);
  }
  return {
    ...acceso,
    gestore,
    retro,
    fuori,
    iscritti,
    chiudi: async () => {
      await acceso.spegni();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

/* ─── 1. Il gettone ──────────────────────────────────────────────────────── */

test("il gettone e' quello del contratto, e si verifica con la pubblica di prova", () => {
  const cartella = mkdtempSync(join(tmpdir(), "licenze-"));
  let ora = Date.parse("2026-09-27T10:00:00Z");
  try {
    const licenze = new Licenze({ cartella, chiave: PRIVATA, adesso: () => ora });
    assert.equal(licenze.pubblica, PUBBLICA, "la pubblica della privata di prova e' quella del contratto");

    const una = licenze.regala({ app: "gdahome", casa: UNA, mesi: 1, nota: "prova" });
    assert.equal(una.scade, Date.parse("2026-10-27T10:00:00Z"));
    const { gettoni, licenze: sue } = licenze.perIlSoggetto(UNA);
    assert.deepEqual(Object.keys(gettoni), ["gdahome"], "una licenza gdahome da' il gettone gdahome e basta");
    assert.deepEqual(sue, [{ lic: una.lic, app: "gdahome", origine: "regalo", scade: una.scade, prova: false }]);

    const [primo, firma] = gettoni.gdahome.split(".");
    assert.doesNotMatch(gettoni.gdahome, /=/, "base64url senza `=`");
    const detto = JSON.parse(Buffer.from(primo, "base64url").toString("utf8"));
    assert.deepEqual(Object.keys(detto), ["v", "app", "sog", "lic", "origine", "scade", "fino", "emesso"]);
    assert.deepEqual(detto, {
      v: 1,
      app: "gdahome",
      sog: UNA,
      lic: una.lic,
      origine: "regalo",
      scade: una.scade,
      fino: ora + OTTO_GIORNI,
      emesso: ora,
    });
    /* La firma, a mano, come la fanno gli altri: Ed25519 sui byte ASCII del
     * primo pezzo, con la pubblica grezza del contratto. */
    const pubblica = createPublicKey({
      key: { kty: "OKP", crv: "Ed25519", x: PUBBLICA },
      format: "jwk",
    });
    assert.ok(verify(null, Buffer.from(primo, "ascii"), pubblica, Buffer.from(firma, "base64url")));
    assert.ok(verificaIlGettone(gettoni.gdahome, PUBBLICA, { sog: UNA, adesso: ora }));
    assert.equal(verificaIlGettone(gettoni.gdahome, PUBBLICA, { sog: ALTRA, adesso: ora }), null);
    assert.equal(
      verificaIlGettone(gettoni.gdahome, PUBBLICA, { sog: UNA, adesso: ora + OTTO_GIORNI + 1 }),
      null,
      "dopo otto giorni quel gettone non vale piu'",
    );
    /* Un carattere cambiato nel payload, e la firma non torna. */
    const storto = `${Buffer.from(JSON.stringify({ ...detto, scade: null })).toString("base64url")}.${firma}`;
    assert.equal(verificaIlGettone(storto, PUBBLICA, { sog: UNA, adesso: ora }), null);

    /* A due giorni dalla scadenza, il gettone finisce con la licenza. */
    ora = una.scade - 2 * GIORNO;
    const vicino = licenze.perIlSoggetto(UNA).gettoni.gdahome;
    assert.equal(verificaIlGettone(vicino, PUBBLICA, { adesso: ora }).fino, una.scade);

    /* Scaduta: niente gettone. */
    ora = una.scade + 1;
    assert.deepEqual(licenze.perIlSoggetto(UNA), { gettoni: {}, licenze: [] });
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("fra piu' licenze si firma quella che dura di piu', e «per sempre» vince", () => {
  const cartella = mkdtempSync(join(tmpdir(), "licenze-"));
  try {
    const licenze = new Licenze({ cartella, chiave: PRIVATA });
    licenze.regala({ app: "gdahome", casa: UNA, mesi: 12 });
    const sempre = licenze.regala({ app: "gdahome", casa: UNA, mesi: null });
    licenze.regala({ app: "gdahome", casa: UNA, mesi: 3 });
    const nav = licenze.regala({ app: "gdanav", casa: UNA, mesi: 1 });
    const { gettoni, licenze: sue } = licenze.perIlSoggetto(UNA);
    assert.equal(sue.length, 4);
    assert.equal(verificaIlGettone(gettoni.gdahome, PUBBLICA).lic, sempre.lic);
    assert.equal(verificaIlGettone(gettoni.gdahome, PUBBLICA).scade, null);
    assert.equal(verificaIlGettone(gettoni.gdanav, PUBBLICA).lic, nav.lic);
    /* Tolta quella per sempre, vince quella di dodici mesi. */
    licenze.togli(sempre.lic);
    assert.notEqual(verificaIlGettone(licenze.perIlSoggetto(UNA).gettoni.gdahome, PUBBLICA).scade, null);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("i mesi si contano sul calendario, e i codici si leggono come li batte chiunque", () => {
  assert.equal(mesiDopo(Date.parse("2026-01-31T12:00:00Z"), 1), Date.parse("2026-02-28T12:00:00Z"));
  assert.equal(mesiDopo(Date.parse("2026-09-27T12:00:00Z"), 12), Date.parse("2027-09-27T12:00:00Z"));
  assert.equal(mesiDopo(Date.now(), null), null);
  assert.equal(codiceRegaloPulito("gda-abcd-efgh-jkmn"), "GDA-ABCD-EFGH-JKMN");
  assert.equal(codiceRegaloPulito(" abcd efgh jkmn "), "GDA-ABCD-EFGH-JKMN");
  assert.equal(codiceRegaloPulito("GDA-ABCD-EFGH-JKM0"), "", "lo zero nell'alfabeto non c'e'");
  assert.equal(laAppDel("gdahome_premium"), "gdahome");
  assert.equal(laAppDel("gdahome_premium_annuale"), "gdahome");
  assert.equal(laAppDel("gdanav_premium_mensile"), "gdanav");
  assert.equal(laAppDel("gdahome_premiumissimo"), null);
  assert.equal(laAppDel("altro"), null);
});

/* ─── 2. Chi si presenta per primo ───────────────────────────────────────── */

test("la prima volta resta l'impronta del segreto, e dopo entra solo quello", async () => {
  const b = await banco();
  try {
    const prima = await b.fuori("casa", { casa: UNA, segreto: SEGRETO });
    assert.equal(prima.stato, 200);
    assert.deepEqual(prima.detto, { gettoni: {}, licenze: [] });

    const altro = await b.fuori("casa", { casa: UNA, segreto: "un-altro-segreto-lungo-abbastanza" });
    assert.equal(altro.stato, 403);
    assert.equal(altro.detto.errore, "segreto-sbagliato");

    assert.equal((await b.fuori("casa", { casa: UNA, segreto: SEGRETO })).stato, 200);

    /* Nel file c'e' l'impronta, non il segreto. */
    const scritto = JSON.stringify(b.licenze.archivio.dati);
    assert.ok(!scritto.includes(SEGRETO));

    /* Il telefono, uguale. */
    assert.equal((await b.fuori("telefono", { telefono: TEL, segreto: SEGRETO })).stato, 200);
    assert.equal((await b.fuori("telefono", { telefono: TEL, segreto: `${SEGRETO}x` })).stato, 403);

    /* E le forme sbagliate si rifiutano prima di tenere qualcosa. */
    assert.equal((await b.fuori("casa", { casa: "casa_123", segreto: SEGRETO })).stato, 400);
    assert.equal((await b.fuori("casa", { casa: ALTRA, segreto: "corto" })).stato, 400);
    assert.equal((await b.fuori("telefono", { telefono: UNA, segreto: SEGRETO })).stato, 400);
  } finally {
    await b.chiudi();
  }
});

test("una casa riceve il regalo del gestore alla prima richiesta, e la revoca lo toglie", async () => {
  const b = await banco();
  try {
    const regalo = await b.gestore("/licenze", {
      metodo: "POST",
      corpo: { app: "gdahome", casa: UNA, mesi: null, nota: "cliente storico" },
    });
    assert.equal(regalo.stato, 200);
    const lic = regalo.detto.licenza;
    assert.match(lic, /^lic_[0-9a-f]{16}$/);

    const { detto } = await b.fuori("casa", { casa: UNA, segreto: SEGRETO });
    const letto = verificaIlGettone(detto.gettoni.gdahome, PUBBLICA, { sog: UNA });
    assert.equal(letto.origine, "regalo");
    assert.equal(letto.scade, null);
    assert.equal(detto.gettoni.gdanav, undefined);

    assert.equal((await b.gestore(`/licenze/${lic}`, { metodo: "DELETE" })).stato, 200);
    assert.deepEqual((await b.fuori("casa", { casa: UNA, segreto: SEGRETO })).detto.gettoni, {});
    assert.equal((await b.gestore(`/licenze/${lic}`, { metodo: "DELETE" })).stato, 404);

    const elenco = await b.gestore("/licenze");
    assert.equal(elenco.detto.licenze[0].revocata > 0, true);

    /* Quello che non e' una casa, una app o un numero di mesi non passa. */
    for (const corpo of [
      { app: "gdahome", casa: "casa_x", mesi: 1 },
      { app: "gdaboh", casa: UNA, mesi: 1 },
      { app: "gdahome", casa: UNA, mesi: 0 },
      { app: "gdahome", casa: UNA, mesi: 1.5 },
    ])
      assert.equal((await b.gestore("/licenze", { metodo: "POST", corpo })).stato, 400);
  } finally {
    await b.chiudi();
  }
});

/* ─── 3. I codici regalo ─────────────────────────────────────────────────── */

test("un codice regalo si riscatta una volta sola, e dall'app giusta", async () => {
  const b = await banco();
  try {
    const fatti = await b.gestore("/codici", {
      metodo: "POST",
      corpo: { app: "gdahome", quanti: 3, mesi: 12, nota: "fiera" },
    });
    assert.equal(fatti.stato, 200);
    assert.equal(fatti.detto.nuovi.length, 3);
    for (const codice of fatti.detto.nuovi)
      assert.match(codice, /^GDA-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}(-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}){2}$/);
    const [codice] = fatti.detto.nuovi;

    /* Battuto a mano, minuscolo e senza trattini. */
    const scritto = codice.toLowerCase().replace(/-/g, " ");
    const preso = await b.fuori("riscatta", { codice: scritto, casa: UNA, segreto: SEGRETO });
    assert.equal(preso.stato, 200);
    const letto = verificaIlGettone(preso.detto.gettoni.gdahome, PUBBLICA, { sog: UNA });
    assert.ok(letto.scade > Date.now() + 360 * GIORNO);

    /* La stessa casa che riprova: la stessa risposta, non un errore. */
    const ancora = await b.fuori("riscatta", { codice, casa: UNA, segreto: SEGRETO });
    assert.equal(ancora.stato, 200);
    assert.equal(ancora.detto.licenze.length, 1);

    /* Un'altra casa: gia' usato. */
    const altra = await b.fuori("riscatta", { codice, casa: ALTRA, segreto: SEGRETO });
    assert.equal(altra.stato, 409);
    assert.equal(altra.detto.errore, "codice-gia-usato");

    /* Uno che non c'e'. */
    const niente = await b.fuori("riscatta", { codice: "GDA-AAAA-BBBB-CCCC", casa: ALTRA, segreto: SEGRETO });
    assert.equal(niente.stato, 404);

    /* Un codice gdahome da gdanav no, e non si brucia. */
    const [secondo] = fatti.detto.nuovi.slice(1);
    const dalTelefono = await b.fuori("riscatta", { codice: secondo, telefono: TEL, segreto: SEGRETO });
    assert.equal(dalTelefono.stato, 400);
    assert.equal((await b.fuori("riscatta", { codice: secondo, casa: ALTRA, segreto: SEGRETO })).stato, 200);

    /* Un codice gdanav va al telefono, per sempre. */
    const nav = await b.gestore("/codici", { metodo: "POST", corpo: { app: "gdanav", quanti: 1, mesi: null } });
    const perIlTelefono = await b.fuori("riscatta", {
      codice: nav.detto.nuovi[0],
      telefono: TEL,
      segreto: SEGRETO,
    });
    assert.equal(perIlTelefono.stato, 200);
    const suo = verificaIlGettone(perIlTelefono.detto.gettoni.gdanav, PUBBLICA, { sog: TEL });
    assert.equal(suo.app, "gdanav");
    assert.equal(suo.scade, null);

    /* Il segreto sbagliato non riscatta niente, e non brucia il codice. */
    const terzo = fatti.detto.nuovi[2];
    assert.equal((await b.fuori("riscatta", { codice: terzo, casa: UNA, segreto: "sbagliato-ma-lungo-abbastanza" })).stato, 403);
    const elenco = await b.gestore("/licenze");
    assert.equal(elenco.detto.codici.find((uno) => uno.codice === terzo).usatoDa, null);
    assert.equal(elenco.detto.codici.find((uno) => uno.codice === codice).usatoDa, UNA);

    /* Annullato, non si riscatta piu'. */
    assert.equal((await b.gestore(`/codici/${terzo}`, { metodo: "DELETE" })).stato, 200);
    assert.equal((await b.fuori("riscatta", { codice: terzo, casa: TERZA, segreto: SEGRETO })).stato, 404);
  } finally {
    await b.chiudi();
  }
});

/* ─── 4 e 5. Il pacchetto dell'installatore ──────────────────────────────── */

test("il pacchetto si consuma, finisce, e tolta una licenza il posto torna", async () => {
  const b = await banco({
    installatori: [{ pacchetto: { gdahome: { "12": 2 }, gdanav: { "6": 1 } }, case: [UNA, ALTRA] }],
  });
  try {
    const chiave = b.iscritti[0].chiave;
    let letto = await b.retro(chiave, "/licenze");
    assert.equal(letto.stato, 200);
    assert.deepEqual(letto.detto.pacchetto, {
      gdahome: [{ durata: "12", totali: 2, usate: 0 }],
      gdanav: [{ durata: "6", totali: 1, usate: 0 }],
    });

    const data = await b.retro(chiave, "/licenze", {
      metodo: "POST",
      corpo: { app: "gdahome", casa: UNA, durata: "12" },
    });
    assert.equal(data.stato, 200);
    assert.equal(data.detto.pacchetto.gdahome[0].usate, 1);
    assert.equal(data.detto.licenze[0].taglio, "12");

    /* Il vecchio `mesi` si legge ancora: 12 e' lo stesso mucchio. */
    const codice = await b.retro(chiave, "/codici", { metodo: "POST", corpo: { app: "gdahome", mesi: 12 } });
    assert.equal(codice.stato, 200);
    assert.match(codice.detto.codice, /^GDA-/);
    assert.equal(codice.detto.pacchetto.gdahome[0].usate, 2);
    assert.equal(codice.detto.codici[0].mesi, 12);
    assert.equal(codice.detto.codici[0].taglio, "12");

    /* Finito: ne' licenze ne' codici. */
    const troppo = await b.retro(chiave, "/licenze", {
      metodo: "POST",
      corpo: { app: "gdahome", casa: ALTRA, durata: "12" },
    });
    assert.equal(troppo.stato, 409);
    assert.equal(troppo.detto.errore, "pacchetto-esaurito");
    assert.equal(
      (await b.retro(chiave, "/codici", { metodo: "POST", corpo: { app: "gdahome", durata: "12" } })).stato,
      409,
    );

    /* Il codice riscattato diventa una licenza, e continua a contare uno. */
    const riscattato = await b.fuori("riscatta", { codice: codice.detto.codice, casa: TERZA, segreto: SEGRETO });
    assert.equal(riscattato.stato, 200);
    assert.equal(verificaIlGettone(riscattato.detto.gettoni.gdahome, PUBBLICA).origine, "installatore");
    letto = await b.retro(chiave, "/licenze");
    assert.equal(letto.detto.pacchetto.gdahome[0].usate, 2);
    assert.equal(letto.detto.licenze.length, 2);
    assert.ok(letto.detto.licenze.every((una) => una.taglio === "12"));
    assert.equal(letto.detto.codici.length, 0);

    /* La casa vede la licenza dell'installatore. */
    const casa = await b.fuori("casa", { casa: UNA, segreto: SEGRETO });
    assert.equal(verificaIlGettone(casa.detto.gettoni.gdahome, PUBBLICA, { sog: UNA }).origine, "installatore");

    /* Tolta, torna nel pacchetto, e se ne da' un'altra. */
    const tolta = await b.retro(chiave, `/licenze/${data.detto.licenza}`, { metodo: "DELETE" });
    assert.equal(tolta.stato, 200);
    assert.equal(tolta.detto.pacchetto.gdahome[0].usate, 1);
    assert.deepEqual((await b.fuori("casa", { casa: UNA, segreto: SEGRETO })).detto.gettoni, {});
    assert.equal(
      (await b.retro(chiave, "/licenze", { metodo: "POST", corpo: { app: "gdahome", casa: ALTRA, durata: "12" } }))
        .stato,
      200,
    );

    /* Un codice non usato si annulla, e il posto torna anche cosi'. */
    const nav = await b.retro(chiave, "/codici", { metodo: "POST", corpo: { app: "gdanav", durata: "6" } });
    assert.equal(nav.detto.pacchetto.gdanav[0].usate, 1);
    const via = await b.retro(chiave, `/codici/${nav.detto.codice}`, { metodo: "DELETE" });
    assert.equal(via.detto.pacchetto.gdanav[0].usate, 0);

    /* Il gestore vede il pacchetto, e lo cambia: una app nominata prende i
     * conti detti, quella non nominata resta com'era. */
    const quadro = await b.gestore("/installatori");
    assert.deepEqual(quadro.detto.installatori[0].pacchetto, {
      gdahome: [{ durata: "12", totali: 2, usate: 2 }],
      gdanav: [{ durata: "6", totali: 1, usate: 0 }],
    });
    const cambiato = await b.gestore(`/installatori/${b.iscritti[0].chi}`, {
      metodo: "PATCH",
      corpo: { pacchetto: { gdahome: { "1": 10, "12": 5 } } },
    });
    assert.equal(cambiato.stato, 200);
    assert.deepEqual(cambiato.detto.installatori[0].pacchetto, {
      gdahome: [
        { durata: "1", totali: 10, usate: 0 },
        { durata: "12", totali: 5, usate: 2 },
      ],
      gdanav: [{ durata: "6", totali: 1, usate: 0 }],
    });
    /* E la via di sempre, al singolare, fa lo stesso; anche con l'elenco del GET. */
    const col = await b.gestore(`/installatore/${b.iscritti[0].chi}`, {
      metodo: "PUT",
      corpo: { pacchetto: { gdanav: [{ durata: "sempre", totali: 3 }] } },
    });
    assert.deepEqual(col.detto.installatori[0].pacchetto.gdanav, [{ durata: "sempre", totali: 3, usate: 0 }]);
  } finally {
    await b.chiudi();
  }
});

test("ogni durata del pacchetto e' un mucchio suo: si consuma, finisce e si riempie da solo", async () => {
  const b = await banco({
    installatori: [{ pacchetto: { gdahome: { "1": 1, "12": 1 }, gdanav: { sempre: 1 } }, case: [UNA, ALTRA, TERZA] }],
  });
  try {
    const chiave = b.iscritti[0].chiave;
    const prima = Date.now();

    /* Un mese: scade fra un mese, da adesso. */
    const mese = await b.retro(chiave, "/licenze", {
      metodo: "POST",
      corpo: { app: "gdahome", casa: UNA, durata: "1" },
    });
    assert.equal(mese.stato, 200);
    const laMese = mese.detto.licenze.find((una) => una.lic === mese.detto.licenza);
    assert.equal(laMese.taglio, "1");
    assert.ok(laMese.scade >= mesiDopo(prima, 1) && laMese.scade <= mesiDopo(Date.now(), 1));
    assert.deepEqual(mese.detto.pacchetto.gdahome, [
      { durata: "1", totali: 1, usate: 1 },
      { durata: "12", totali: 1, usate: 0 },
    ]);

    /* Il mese e' finito, l'anno no: un altro mese e' un no, un anno si'. */
    const altroMese = await b.retro(chiave, "/licenze", {
      metodo: "POST",
      corpo: { app: "gdahome", casa: ALTRA, durata: 1 },
    });
    assert.equal(altroMese.stato, 409);
    assert.equal(altroMese.detto.errore, "pacchetto-esaurito");
    const anno = await b.retro(chiave, "/codici", { metodo: "POST", corpo: { app: "gdahome", durata: "12" } });
    assert.equal(anno.stato, 200);
    assert.equal(anno.detto.codici[0].mesi, 12);

    /* Una durata che il pacchetto non ha: 400, e non si prende niente. */
    for (const durata of ["3", "sempre", null]) {
      const no = await b.retro(chiave, "/licenze", { metodo: "POST", corpo: { app: "gdahome", casa: TERZA, durata } });
      assert.equal(no.stato, 400, `durata ${durata}`);
      assert.equal(no.detto.errore, "durata-non-nel-pacchetto");
    }
    /* Una che non e' una durata, e nessuna durata. */
    for (const durata of ["mai", 0, 121, 1.5]) {
      const no = await b.retro(chiave, "/codici", { metodo: "POST", corpo: { app: "gdahome", durata } });
      assert.equal(no.stato, 400);
      assert.equal(no.detto.errore, "durata-non-valida");
    }
    const senza = await b.retro(chiave, "/codici", { metodo: "POST", corpo: { app: "gdahome" } });
    assert.equal(senza.stato, 400);
    assert.equal(senza.detto.errore, "durata-mancante");

    /* gdanav per sempre: scade mai. */
    const sempre = await b.retro(chiave, "/licenze", {
      metodo: "POST",
      corpo: { app: "gdanav", casa: UNA, durata: "sempre" },
    });
    assert.equal(sempre.stato, 200);
    assert.equal(sempre.detto.licenze.find((una) => una.lic === sempre.detto.licenza).scade, null);

    let letto = await b.retro(chiave, "/licenze");
    assert.deepEqual(letto.detto.pacchetto, {
      gdahome: [
        { durata: "1", totali: 1, usate: 1 },
        { durata: "12", totali: 1, usate: 1 },
      ],
      gdanav: [{ durata: "sempre", totali: 1, usate: 1 }],
    });

    /* Tolta la licenza di un mese, torna nel mucchio del mese (non in quello dell'anno). */
    const tolta = await b.retro(chiave, `/licenze/${mese.detto.licenza}`, { metodo: "DELETE" });
    assert.deepEqual(tolta.detto.pacchetto.gdahome, [
      { durata: "1", totali: 1, usate: 0 },
      { durata: "12", totali: 1, usate: 1 },
    ]);
    /* Il codice di un anno riscattato comincia adesso, e resta nel mucchio dell'anno. */
    const riscattato = await b.fuori("riscatta", { codice: anno.detto.codice, casa: TERZA, segreto: SEGRETO });
    assert.equal(riscattato.stato, 200);
    letto = await b.retro(chiave, "/licenze");
    const dalCodice = letto.detto.licenze.find((una) => una.codice === anno.detto.codice);
    assert.equal(dalCodice.taglio, "12");
    assert.ok(dalCodice.scade >= mesiDopo(prima, 12));
    assert.deepEqual(letto.detto.pacchetto.gdahome[1], { durata: "12", totali: 1, usate: 1 });

    /* Il gestore toglie l'anno: la licenza data resta, e il mucchio si vede con zero totali. */
    const tolto = await b.gestore(`/installatori/${b.iscritti[0].chi}`, {
      metodo: "PATCH",
      corpo: { pacchetto: { gdahome: { "1": 1 } } },
    });
    assert.deepEqual(tolto.detto.installatori[0].pacchetto.gdahome, [
      { durata: "1", totali: 1, usate: 0 },
      { durata: "12", totali: 0, usate: 1 },
    ]);

    /* Un pacchetto storto e' un 400, e non tocca niente. */
    for (const pacchetto of [{ gdahome: { "0": 3 } }, { gdahome: { mai: 1 } }, [1, 2], "tanti"]) {
      const storto = await b.gestore(`/installatori/${b.iscritti[0].chi}`, { metodo: "PATCH", corpo: { pacchetto } });
      assert.equal(storto.stato, 400, JSON.stringify(pacchetto));
    }
    const fatto = await b.gestore("/installatori", {
      metodo: "POST",
      corpo: { nome: "Storto", pacchetto: { gdanav: { "13 mesi": 1 } } },
    });
    assert.equal(fatto.stato, 400);
    assert.equal(fatto.detto.errore, "durata-non-valida");
    assert.ok(!(await b.gestore("/installatori")).detto.installatori.some((uno) => uno.nome === "Storto"));
  } finally {
    await b.chiudi();
  }
});

test("un pacchetto scritto come prima, un numero per app, vale tante licenze di dodici mesi", async () => {
  const b = await banco({ installatori: [{ pacchetto: { gdahome: 2, gdanav: 0 }, case: [UNA] }] });
  try {
    const { chi, chiave } = b.iscritti[0];
    const letto = await b.retro(chiave, "/licenze");
    assert.deepEqual(letto.detto.pacchetto, { gdahome: [{ durata: "12", totali: 2, usate: 0 }], gdanav: [] });
    assert.equal(
      (await b.retro(chiave, "/licenze", { metodo: "POST", corpo: { app: "gdahome", casa: UNA, durata: "12" } })).stato,
      200,
    );
  } finally {
    await b.chiudi();
  }

  /* E dall'archivio: un pacchetto numerico, e una licenza e un codice senza `taglio`. */
  const cartella = mkdtempSync(join(tmpdir(), "quadro-licenze-prima-"));
  try {
    writeFileSync(
      join(cartella, "licenze.json"),
      JSON.stringify({
        licenze: [
          { lic: "lic_0011223344556677", app: "gdahome", sog: UNA, origine: "installatore", installatore: "ins_x", scade: null, creata: 1, revocata: null },
        ],
        codici: [
          { codice: "GDA-AAAA-BBBB-CCCC", app: "gdahome", mesi: null, origine: "installatore", installatore: "ins_x", creato: 1, usatoDa: null, usatoIl: null, lic: null, annullato: null },
        ],
        soggetti: {},
        pacchetti: { ins_x: { gdahome: 5, gdanav: 1 } },
      }),
    );
    const licenze = new Licenze({ cartella, chiave: PRIVATA });
    assert.deepEqual(licenze.pacchetto("ins_x"), {
      gdahome: [
        { durata: "12", totali: 5, usate: 1 },
        { durata: "sempre", totali: 0, usate: 1 },
      ],
      gdanav: [{ durata: "12", totali: 1, usate: 0 }],
    });
    /* Cambiato gdanav, gdahome resta: letto come prima e scritto nella forma nuova. */
    licenze.mettiIlPacchetto("ins_x", { gdanav: { "3": 4 } });
    assert.deepEqual(licenze.pacchettoDato("ins_x"), { gdahome: { "12": 5 }, gdanav: { "3": 4 } });
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("un installatore regala solo alle sue case, e toglie solo le sue licenze", async () => {
  const b = await banco({
    installatori: [
      { pacchetto: { gdahome: { "12": 5, sempre: 5 }, gdanav: { "12": 5 } }, case: [UNA] },
      { pacchetto: { gdahome: { "12": 5, sempre: 5 }, gdanav: { "12": 5 } }, case: [ALTRA] },
    ],
  });
  try {
    const [rossi, bianchi] = b.iscritti;
    /* La casa di Bianchi, dalla chiave di Rossi: no, e senza dire che esiste. */
    const suaNo = await b.retro(rossi.chiave, "/licenze", {
      metodo: "POST",
      corpo: { app: "gdahome", casa: ALTRA, durata: "12" },
    });
    assert.equal(suaNo.stato, 404);
    const nessuna = await b.retro(rossi.chiave, "/licenze", {
      metodo: "POST",
      corpo: { app: "gdahome", casa: TERZA, durata: "12" },
    });
    assert.equal(nessuna.stato, 404);
    assert.equal(suaNo.detto.errore, nessuna.detto.errore);
    assert.ok((await b.retro(rossi.chiave, "/licenze")).detto.pacchetto.gdahome.every((uno) => uno.usate === 0));

    /* Quella di Bianchi non la toglie Rossi, e nemmeno quella del gestore. */
    const diBianchi = await b.retro(bianchi.chiave, "/licenze", {
      metodo: "POST",
      corpo: { app: "gdahome", casa: ALTRA, durata: "sempre" },
    });
    assert.equal(diBianchi.stato, 200);
    assert.equal(
      (await b.retro(rossi.chiave, `/licenze/${diBianchi.detto.licenza}`, { metodo: "DELETE" })).stato,
      404,
    );
    const delGestore = await b.gestore("/licenze", { metodo: "POST", corpo: { app: "gdahome", casa: UNA } });
    assert.equal(
      (await b.retro(rossi.chiave, `/licenze/${delGestore.detto.licenza}`, { metodo: "DELETE" })).stato,
      404,
    );

    /* E nell'elenco di Rossi non c'e' niente di Bianchi. */
    const suo = await b.retro(rossi.chiave, "/licenze");
    assert.equal(suo.detto.licenze.length, 0);
    assert.ok(!JSON.stringify(suo.detto).includes(ALTRA));

    /* Il codice di Bianchi non lo annulla Rossi. */
    const codice = await b.retro(bianchi.chiave, "/codici", { metodo: "POST", corpo: { app: "gdanav", durata: "12" } });
    assert.equal((await b.retro(rossi.chiave, `/codici/${codice.detto.codice}`, { metodo: "DELETE" })).stato, 404);

    /* Senza pacchetto, niente: qualunque durata chieda, e' esaurito. */
    const { detto: senza } = await b.gestore("/installatori", { metodo: "POST", corpo: { nome: "Verdi" } });
    assert.deepEqual(senza.installatori.find((uno) => uno.chi === senza.chi).pacchetto, { gdahome: [], gdanav: [] });
    const niente = await b.retro(senza.chiave, "/codici", { metodo: "POST", corpo: { app: "gdahome", durata: "12" } });
    assert.equal(niente.stato, 409);
    assert.equal(niente.detto.errore, "pacchetto-esaurito");
  } finally {
    await b.chiudi();
  }
});

/* ─── 7. Senza chiavi ────────────────────────────────────────────────────── */

test("senza la chiave privata le licenze rispondono 503, e senza i negozi anche la ricevuta", async () => {
  const spento = await banco({ chiave: "" });
  try {
    for (const via of ["casa", "negozio", "riscatta", "telefono"]) {
      const { stato, detto } = await spento.fuori(via, { casa: UNA, segreto: SEGRETO });
      assert.equal(stato, 503);
      assert.equal(detto.errore, "licenze-non-configurate");
    }
    /* Il gestore vede che sono spente. */
    assert.equal((await spento.gestore("/licenze")).detto.accese, false);
  } finally {
    await spento.chiudi();
  }
  const storto = await banco({ chiave: "non-e-una-chiave" });
  try {
    assert.equal((await storto.fuori("casa", { casa: UNA, segreto: SEGRETO })).stato, 503);
  } finally {
    await storto.chiudi();
  }
  const senzaNegozi = await banco();
  try {
    for (const piattaforma of ["android", "ios"]) {
      const { stato, detto } = await senzaNegozi.fuori("negozio", {
        casa: UNA,
        segreto: SEGRETO,
        app: "gdahome",
        piattaforma,
        prodotto: "gdahome_premium",
        ricevuta: "1234567890",
      });
      assert.equal(stato, 503);
      assert.equal(detto.errore, "verifica-non-configurata");
    }
    /* I regali invece funzionano lo stesso. */
    await senzaNegozi.gestore("/licenze", { metodo: "POST", corpo: { app: "gdahome", casa: UNA } });
    assert.ok((await senzaNegozi.fuori("casa", { casa: UNA, segreto: SEGRETO })).detto.gettoni.gdahome);
  } finally {
    await senzaNegozi.chiudi();
  }
});

/* ─── 6. Il negozio ──────────────────────────────────────────────────────── */

/* Un Google finto, nella forma di quello vero: il gettone d'accesso, poi
 * `subscriptionsv2.get`, poi il riconoscimento. Si segna tutto quello che
 * gli si chiede. */
function unGoogleFinto(abbonamenti) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const conto = {
    type: "service_account",
    client_email: "quadro@gdahome-prova.iam.gserviceaccount.com",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
    token_uri: "https://oauth2.googleapis.com/token",
  };
  const chiesti = [];
  const fetch = async (dove, opzioni = {}) => {
    chiesti.push({ dove, opzioni });
    const rispondi = (stato, corpo) => new Response(JSON.stringify(corpo), { status: stato });
    if (dove === conto.token_uri) {
      const detto = new URLSearchParams(opzioni.body);
      assert.equal(detto.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
      const [testa, corpo, firma] = detto.get("assertion").split(".");
      assert.ok(verify("sha256", Buffer.from(`${testa}.${corpo}`), publicKey, Buffer.from(firma, "base64url")));
      const letto = JSON.parse(Buffer.from(corpo, "base64url").toString());
      assert.equal(letto.iss, conto.client_email);
      assert.equal(letto.scope, "https://www.googleapis.com/auth/androidpublisher");
      return rispondi(200, { access_token: "gettone-google", expires_in: 3599 });
    }
    assert.equal(opzioni.headers.authorization, "Bearer gettone-google");
    const acquisto = /\/applications\/com\.gdahome\.gdahome\/purchases\/subscriptionsv2\/tokens\/([^/]+)$/.exec(dove);
    if (acquisto) {
      const uno = abbonamenti[decodeURIComponent(acquisto[1])];
      return uno ? rispondi(200, uno) : rispondi(404, { error: { code: 404 } });
    }
    if (/:acknowledge$/.test(dove)) return rispondi(200, {});
    return rispondi(500, {});
  };
  return {
    chiesti,
    negozi: new Negozi({ ambiente: { QUADRO_GOOGLE_SERVICE_ACCOUNT: JSON.stringify(conto) }, fetch }),
  };
}

const TOKEN_BUONO = "token-google-buono-0123456789";
const TOKEN_NUOVO = "token-google-nuovo-0123456789";
const TOKEN_SCADUTO = "token-google-scaduto-012345678";

test("una ricevuta di Google Play diventa una licenza fino alla scadenza, una sola per acquisto", async () => {
  const fra30 = new Date(Date.now() + 30 * GIORNO).toISOString();
  const fra60 = new Date(Date.now() + 60 * GIORNO).toISOString();
  const { negozi, chiesti } = unGoogleFinto({
    [TOKEN_BUONO]: {
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
      lineItems: [{ productId: "gdahome_premium", expiryTime: fra30 }],
    },
    /* Un cambio di piano: token nuovo, che dice qual era quello di prima. */
    [TOKEN_NUOVO]: {
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
      linkedPurchaseToken: TOKEN_BUONO,
      lineItems: [{ productId: "gdahome_premium", expiryTime: fra60 }],
    },
    [TOKEN_SCADUTO]: {
      subscriptionState: "SUBSCRIPTION_STATE_EXPIRED",
      lineItems: [{ productId: "gdahome_premium", expiryTime: new Date(Date.now() - GIORNO).toISOString() }],
    },
  });
  const b = await banco({ negozi });
  try {
    const ricevuta = (token, altro = {}) =>
      b.fuori("negozio", {
        casa: UNA,
        segreto: SEGRETO,
        app: "gdahome",
        piattaforma: "android",
        prodotto: "gdahome_premium",
        ricevuta: token,
        ...altro,
      });
    const presa = await ricevuta(TOKEN_BUONO);
    assert.equal(presa.stato, 200);
    const letto = verificaIlGettone(presa.detto.gettoni.gdahome, PUBBLICA, { sog: UNA });
    assert.equal(letto.origine, "negozio");
    assert.equal(letto.scade, Date.parse(fra30));
    assert.ok(chiesti.some((uno) => /gdahome_premium\/tokens\/.+:acknowledge$/.test(uno.dove)), "riconosciuto");

    /* La stessa ricevuta di nuovo, e poi il piano cambiato: la stessa licenza. */
    assert.equal((await ricevuta(TOKEN_BUONO)).stato, 200);
    const nuova = await ricevuta(TOKEN_NUOVO);
    assert.equal(nuova.detto.licenze.length, 1);
    assert.equal(nuova.detto.licenze[0].lic, letto.lic);
    assert.equal(nuova.detto.licenze[0].scade, Date.parse(fra60));
    /* Il gettone d'accesso si e' chiesto una volta sola. */
    assert.equal(chiesti.filter((uno) => uno.dove.endsWith("/token")).length, 1);

    /* Scaduta, sconosciuta, o di un'altra app: 402. */
    assert.equal((await ricevuta(TOKEN_SCADUTO)).stato, 402);
    const sconosciuta = await ricevuta("token-che-google-non-conosce");
    assert.equal(sconosciuta.stato, 402);
    assert.equal(sconosciuta.detto.errore, "ricevuta-sconosciuta");
    const altraApp = await ricevuta(TOKEN_BUONO, { app: "gdanav", prodotto: "gdanav_premium" });
    assert.equal(altraApp.stato, 402);

    /* Lo stesso acquisto da un'altra casa: la licenza si sposta. */
    const spostata = await b.fuori("negozio", {
      casa: ALTRA,
      segreto: SEGRETO,
      app: "gdahome",
      piattaforma: "android",
      prodotto: "gdahome_premium",
      ricevuta: TOKEN_NUOVO,
    });
    assert.equal(spostata.detto.licenze[0].lic, letto.lic);
    assert.deepEqual((await b.fuori("casa", { casa: UNA, segreto: SEGRETO })).detto.gettoni, {});
  } finally {
    await b.chiudi();
  }
});

/* Un Apple finto: la produzione non conosce la transazione, il sandbox si',
 * e la risponde firmata con una catena di prova. */
function unAppleFinto(transazioni, { radice = RADICE_DI_PROVA, stati = {} } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const foglia = createPrivateKey(CHIAVE_DELLA_FOGLIA);
  const firmata = (corpo) => {
    const testa = Buffer.from(
      JSON.stringify({ alg: "ES256", x5c: [CERT_FOGLIA, CERT_MEZZO, CERT_RADICE] }),
    ).toString("base64url");
    const pezzo = Buffer.from(JSON.stringify(corpo)).toString("base64url");
    const firma = sign("sha256", Buffer.from(`${testa}.${pezzo}`), { key: foglia, dsaEncoding: "ieee-p1363" });
    return `${testa}.${pezzo}.${firma.toString("base64url")}`;
  };
  const chiesti = [];
  const fetch = async (dove, opzioni = {}) => {
    chiesti.push(dove);
    const [testa, corpo, firma] = opzioni.headers.authorization.replace("Bearer ", "").split(".");
    assert.deepEqual(JSON.parse(Buffer.from(testa, "base64url")), { alg: "ES256", kid: "CHIAVE1234", typ: "JWT" });
    assert.ok(
      verify("sha256", Buffer.from(`${testa}.${corpo}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(firma, "base64url")),
    );
    const letto = JSON.parse(Buffer.from(corpo, "base64url"));
    assert.equal(letto.aud, "appstoreconnect-v1");
    assert.equal(letto.bid, "com.gdahome.gdahome");
    /* «Get All Subscription Statuses»: l'ultima transazione di ogni gruppo. */
    const originale = /\/inApps\/v1\/subscriptions\/(\d+)$/.exec(dove)?.[1];
    if (originale) {
      if (dove.startsWith("https://api.storekit.itunes.apple.com/") || !stati[originale])
        return new Response(JSON.stringify({ errorCode: 4040005 }), { status: 404 });
      return new Response(
        JSON.stringify({
          environment: "Sandbox",
          bundleId: "com.gdahome.gdahome",
          data: [
            {
              subscriptionGroupIdentifier: "21000001",
              lastTransactions: [
                { originalTransactionId: "1999999999999999", status: 1, signedTransactionInfo: "non-e-questa" },
                {
                  originalTransactionId: originale,
                  status: 1,
                  signedTransactionInfo: firmata(stati[originale]),
                  signedRenewalInfo: "",
                },
              ],
            },
          ],
        }),
        { status: 200 },
      );
    }
    const id = /\/inApps\/v1\/transactions\/(\d+)$/.exec(dove)?.[1];
    if (dove.startsWith("https://api.storekit.itunes.apple.com/") || !transazioni[id])
      return new Response(JSON.stringify({ errorCode: 4040010 }), { status: 404 });
    return new Response(JSON.stringify({ signedTransactionInfo: firmata(transazioni[id]) }), { status: 200 });
  };
  return {
    chiesti,
    negozi: new Negozi({
      ambiente: {
        QUADRO_APPLE_CHIAVE: privateKey.export({ type: "pkcs8", format: "pem" }),
        QUADRO_APPLE_KEY_ID: "CHIAVE1234",
        QUADRO_APPLE_ISSUER: "57246542-96fe-1a63-e053-0824d011072a",
        QUADRO_APPLE_BUNDLE: "com.gdahome.gdahome",
        ...(radice ? { QUADRO_APPLE_RADICE: radice } : {}),
      },
      fetch,
    }),
  };
}

test("una transazione dell'App Store si chiede ad Apple, prima in produzione e poi nel sandbox", async () => {
  const scade = Date.now() + 31 * GIORNO;
  const transazione = {
    transactionId: "2000000123456789",
    originalTransactionId: "2000000100000000",
    bundleId: "com.gdahome.gdahome",
    productId: "gdahome_premium_annuale",
    type: "Auto-Renewable Subscription",
    expiresDate: scade,
  };
  const { negozi, chiesti } = unAppleFinto({
    "2000000123456789": transazione,
    "2000000123456790": { ...transazione, transactionId: "2000000123456790", revocationDate: Date.now() },
    "2000000123456791": { ...transazione, transactionId: "2000000123456791", bundleId: "com.altri.app" },
    "2000000123456792": { ...transazione, transactionId: "2000000123456792", expiresDate: Date.now() - GIORNO },
  });
  const b = await banco({ negozi });
  try {
    const ricevuta = (id) =>
      b.fuori("negozio", {
        casa: UNA,
        segreto: SEGRETO,
        app: "gdahome",
        piattaforma: "ios",
        prodotto: "gdahome_premium_annuale",
        ricevuta: id,
      });
    const presa = await ricevuta("2000000123456789");
    assert.equal(presa.stato, 200);
    const letto = verificaIlGettone(presa.detto.gettoni.gdahome, PUBBLICA, { sog: UNA });
    assert.equal(letto.scade, scade);
    assert.equal(letto.origine, "negozio");
    assert.deepEqual(chiesti.slice(0, 2), [
      "https://api.storekit.itunes.apple.com/inApps/v1/transactions/2000000123456789",
      "https://api.storekit-sandbox.itunes.apple.com/inApps/v1/transactions/2000000123456789",
    ]);

    /* La JWS che StoreKit 2 da' all'app: se ne prende l'identificativo. */
    const jws = `e30.${Buffer.from(JSON.stringify({ transactionId: "2000000123456789" })).toString("base64url")}.x`;
    const dallaJws = await ricevuta(jws);
    assert.equal(dallaJws.stato, 200);
    assert.equal(dallaJws.detto.licenze.length, 1, "la stessa transazione originale, la stessa licenza");

    for (const [id, errore] of [
      ["2000000123456790", "acquisto-rimborsato"],
      ["2000000123456791", "ricevuta-di-un-altra-app"],
      ["2000000123456792", "abbonamento-scaduto"],
      ["2000000999999999", "ricevuta-sconosciuta"],
      ["non-e-un-numero", "ricevuta-illeggibile"],
    ]) {
      const { stato, detto } = await ricevuta(id);
      assert.equal(stato, 402, id);
      assert.equal(detto.errore, errore);
    }
  } finally {
    await b.chiudi();
  }
});

test("una risposta di Apple firmata da una radice che non e' quella di Apple non vale", async () => {
  const { negozi } = unAppleFinto(
    {
      "2000000123456789": {
        transactionId: "2000000123456789",
        originalTransactionId: "2000000123456789",
        bundleId: "com.gdahome.gdahome",
        productId: "gdahome_premium_mensile",
        expiresDate: Date.now() + GIORNO,
      },
    },
    { radice: null },
  );
  const b = await banco({ negozi });
  try {
    const { stato, detto } = await b.fuori("negozio", {
      casa: UNA,
      segreto: SEGRETO,
      app: "gdahome",
      piattaforma: "ios",
      prodotto: "gdahome_premium_mensile",
      ricevuta: "2000000123456789",
    });
    assert.equal(stato, 402);
    assert.equal(detto.errore, "risposta-apple-radice-sconosciuta");
  } finally {
    await b.chiudi();
  }
});

/* ─── I rinnovi e la prova gratuita ──────────────────────────────────────── */

const ORA = 60 * 60 * 1000;
const TOKEN_PROVA = "token-google-in-prova-0123456789";

/* Il payload di un gettone, senza verificarlo: quello si fa a parte. */
const ilPayload = (gettone) => JSON.parse(Buffer.from(gettone.split(".")[0], "base64url").toString("utf8"));

test("la prova gratuita di Google finisce, l'abbonamento si rinnova, e il quadro lo richiede da se'", async () => {
  const abbonamenti = {
    [TOKEN_PROVA]: {
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
      lineItems: [
        {
          productId: "gdahome_premium",
          expiryTime: new Date(Date.now() + 2 * ORA).toISOString(),
          offerDetails: { basePlanId: "mensile", offerId: "prova-14-giorni" },
          offerPhase: { freeTrial: {} },
        },
      ],
    },
  };
  const { negozi, chiesti } = unGoogleFinto(abbonamenti);
  const b = await banco({ negozi });
  const aGoogle = () => chiesti.filter((uno) => uno.dove.includes("/subscriptionsv2/tokens/")).length;
  try {
    const presa = await b.fuori("negozio", {
      casa: UNA,
      segreto: SEGRETO,
      app: "gdahome",
      piattaforma: "android",
      prodotto: "gdahome_premium",
      ricevuta: TOKEN_PROVA,
    });
    assert.equal(presa.stato, 200);
    const primo = verificaIlGettone(presa.detto.gettoni.gdahome, PUBBLICA, { sog: UNA });
    assert.equal(primo.prova, true, "in prova gratuita, il gettone lo dice");
    assert.equal(presa.detto.licenze[0].prova, true);
    const una = b.licenze.quella(primo.lic);
    assert.deepEqual(una.negozio.ricevuta, { token: TOKEN_PROVA, prodotto: "gdahome_premium" });
    assert.equal((await b.gestore("/licenze")).detto.licenze[0].prova, true, "e il gestore lo vede");

    /* Appena controllata: per un'ora non si richiede, anche se scade presto. */
    const prima = aGoogle();
    assert.equal((await b.fuori("casa", { casa: UNA, segreto: SEGRETO })).stato, 200);
    assert.equal(aGoogle(), prima, "una volta l'ora al massimo");

    /* La prova finisce, Google rinnova per un mese: la casa chiede i gettoni
     * e il quadro lo scopre da se', senza che l'app mandi niente. */
    const fra30 = new Date(Date.now() + 30 * GIORNO).toISOString();
    abbonamenti[TOKEN_PROVA] = {
      ...abbonamenti[TOKEN_PROVA],
      lineItems: [
        {
          productId: "gdahome_premium",
          expiryTime: fra30,
          offerDetails: { basePlanId: "mensile", offerId: "prova-14-giorni" },
          offerPhase: { basePrice: {} },
        },
      ],
    };
    una.ricontrollata = Date.now() - 2 * ORA;
    const dopo = await b.fuori("casa", { casa: UNA, segreto: SEGRETO });
    assert.equal(dopo.stato, 200);
    assert.equal(aGoogle(), prima + 1);
    const rinnovato = verificaIlGettone(dopo.detto.gettoni.gdahome, PUBBLICA, { sog: UNA });
    assert.equal(rinnovato.lic, primo.lic, "la stessa licenza");
    assert.equal(rinnovato.scade, Date.parse(fra30), "la scadenza va avanti");
    assert.ok(rinnovato.emesso >= primo.emesso);
    assert.equal("prova" in ilPayload(dopo.detto.gettoni.gdahome), false, "finita la prova, il campo non c'e'");
    assert.equal(dopo.detto.licenze[0].prova, false);

    /* Adesso scade fra un mese: non si richiede piu', anche passata l'ora. */
    una.ricontrollata = Date.now() - 2 * ORA;
    await b.fuori("casa", { casa: UNA, segreto: SEGRETO });
    assert.equal(aGoogle(), prima + 1);
  } finally {
    await b.chiudi();
  }
});

test("senza la fase dell'offerta, la prova si riconosce dal tag dell'offerta di Google", async () => {
  const token = "token-google-col-tag-0123456789";
  const { negozi } = unGoogleFinto({
    [token]: {
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
      lineItems: [
        {
          productId: "gdanav_premium",
          expiryTime: new Date(Date.now() + 14 * GIORNO).toISOString(),
          offerDetails: { basePlanId: "annuale", offerId: "benvenuto", offerTags: ["trial"] },
        },
      ],
    },
  });
  const esito = await negozi.controlla({ piattaforma: "android", prodotto: "gdanav_premium", ricevuta: token });
  assert.equal(esito.app, "gdanav");
  assert.equal(esito.prova, true);
});

test("se il negozio non risponde si tiene quello che si sapeva, e i gettoni arrivano lo stesso", async () => {
  const token = "token-google-negozio-giu-01234567";
  const scade = Date.now() + 3 * ORA;
  const { negozi, chiesti } = unGoogleFinto({
    [token]: {
      subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
      lineItems: [{ productId: "gdahome_premium", expiryTime: new Date(scade).toISOString() }],
    },
  });
  const b = await banco({ negozi, attesaDelNegozio: 100 });
  try {
    const presa = await b.fuori("negozio", {
      casa: UNA,
      segreto: SEGRETO,
      app: "gdahome",
      piattaforma: "android",
      prodotto: "gdahome_premium",
      ricevuta: token,
    });
    const una = b.licenze.quella(presa.detto.licenze[0].lic);
    assert.equal(una.prova, false);
    assert.equal("prova" in ilPayload(presa.detto.gettoni.gdahome), false);

    /* Google risponde 503. */
    const vero = negozi.chiama;
    negozi.chiama = async (dove, opzioni) =>
      dove.includes("/subscriptionsv2/") ? new Response("{}", { status: 503 }) : vero(dove, opzioni);
    una.ricontrollata = Date.now() - 2 * ORA;
    const giu = await b.fuori("casa", { casa: UNA, segreto: SEGRETO });
    assert.equal(giu.stato, 200);
    assert.equal(verificaIlGettone(giu.detto.gettoni.gdahome, PUBBLICA, { sog: UNA }).scade, scade);
    assert.equal(una.scade, scade, "la scadenza resta quella");
    assert.ok(Date.now() - una.ricontrollata < ORA, "e si riprova fra un'ora, non alla prossima richiesta");

    /* Google non risponde proprio: si aspetta poco, e si risponde lo stesso. */
    let appese = 0;
    negozi.chiama = async (dove, opzioni) => {
      if (!dove.includes("/subscriptionsv2/")) return vero(dove, opzioni);
      appese += 1;
      return new Promise(() => {});
    };
    una.ricontrollata = Date.now() - 2 * ORA;
    const partito = Date.now();
    const muto = await b.fuori("casa", { casa: UNA, segreto: SEGRETO });
    assert.equal(muto.stato, 200);
    assert.equal(appese, 1);
    assert.ok(Date.now() - partito < 2000, "non si aspetta il negozio per sempre");
    assert.equal(verificaIlGettone(muto.detto.gettoni.gdahome, PUBBLICA, { sog: UNA }).scade, scade);
    negozi.chiama = vero;
  } finally {
    await b.chiudi();
  }
});

test("Apple: la prova, il rinnovo chiesto con la transazione originale, e un rimborso che non allunga", async () => {
  const originale = "2000000500000000";
  const base = {
    originalTransactionId: originale,
    bundleId: "com.gdahome.gdahome",
    productId: "gdahome_premium_mensile",
    type: "Auto-Renewable Subscription",
  };
  const inProva = {
    ...base,
    transactionId: originale,
    expiresDate: Date.now() + 5 * ORA,
    offerType: 1,
    offerDiscountType: "FREE_TRIAL",
  };
  const stati = {};
  const { negozi, chiesti } = unAppleFinto({ [originale]: inProva }, { stati });
  const b = await banco({ negozi });
  try {
    const presa = await b.fuori("negozio", {
      casa: UNA,
      segreto: SEGRETO,
      app: "gdahome",
      piattaforma: "ios",
      prodotto: "gdahome_premium_mensile",
      ricevuta: originale,
    });
    assert.equal(presa.stato, 200);
    assert.equal(verificaIlGettone(presa.detto.gettoni.gdahome, PUBBLICA, { sog: UNA }).prova, true);
    const una = b.licenze.quella(presa.detto.licenze[0].lic);
    assert.deepEqual(una.negozio.ricevuta, { originale });

    /* Il rinnovo: il giro di ogni ora lo trova, anche se nessuno chiede. */
    const fra30 = Date.now() + 30 * GIORNO;
    stati[originale] = { ...base, transactionId: "2000000500000001", expiresDate: fra30 };
    una.ricontrollata = Date.now() - 2 * ORA;
    assert.equal(await b.licenze.rinnova(b.negozi), 1);
    assert.deepEqual(chiesti.filter((uno) => uno.includes("/subscriptions/")), [
      `https://api.storekit.itunes.apple.com/inApps/v1/subscriptions/${originale}`,
      `https://api.storekit-sandbox.itunes.apple.com/inApps/v1/subscriptions/${originale}`,
    ]);
    assert.equal(una.scade, fra30);
    assert.equal(una.prova, false);
    const dopo = await b.fuori("casa", { casa: UNA, segreto: SEGRETO });
    assert.equal(verificaIlGettone(dopo.detto.gettoni.gdahome, PUBBLICA, { sog: UNA }).scade, fra30);
    assert.equal("prova" in ilPayload(dopo.detto.gettoni.gdahome), false);

    /* Scaduta da poco, e intanto rimborsata: non si allunga, e resta scaduta. */
    una.scade = Date.now() - GIORNO;
    una.ricontrollata = Date.now() - 2 * ORA;
    stati[originale] = {
      ...base,
      transactionId: "2000000500000002",
      expiresDate: Date.now() + 29 * GIORNO,
      revocationDate: Date.now() - ORA,
    };
    const rimborsata = await b.fuori("casa", { casa: UNA, segreto: SEGRETO });
    assert.equal(rimborsata.stato, 200);
    assert.deepEqual(rimborsata.detto.gettoni, {});
    assert.equal(una.scade < Date.now(), true, "rimborsato: non si allunga");

    /* Scaduta da piu' di trentacinque giorni non si chiede piu'. */
    const quante = chiesti.length;
    una.scade = Date.now() - 36 * GIORNO;
    una.ricontrollata = Date.now() - 2 * ORA;
    assert.equal(await b.licenze.rinnova(b.negozi), 0);
    assert.equal(chiesti.length, quante);
  } finally {
    await b.chiudi();
  }
});

test("il freno dei codici ferma chi prova a raffica", async () => {
  const b = await banco();
  try {
    let ultimo;
    for (let i = 0; i < 10; i += 1) {
      ultimo = await b.fuori("riscatta", { codice: "GDA-AAAA-BBBB-CCCC", casa: UNA, segreto: SEGRETO });
    }
    assert.equal(ultimo.stato, 429, "dalla stessa casa, anche cambiando indirizzo");
  } finally {
    await b.chiudi();
  }
});

test("un gettone firmato a mano con una chiave che non e' quella non passa", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const falso = firmaIlGettone(privateKey, {
    v: 1,
    app: "gdahome",
    sog: UNA,
    lic: "lic_0000000000000000",
    origine: "regalo",
    scade: null,
    fino: Date.now() + GIORNO,
    emesso: Date.now(),
  });
  assert.equal(verificaIlGettone(falso, PUBBLICA, { sog: UNA }), null);
});

/* ─── Lo strumento che scrive la pubblica ─────────────────────────────────── */

test("strumenti/chiave-licenze.mjs scrive la stessa pubblica dappertutto, e stampa la privata giusta", () => {
  const radice = mkdtempSync(join(tmpdir(), "chiave-licenze-"));
  const strumento = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "strumenti", "chiave-licenze.mjs");
  try {
    mkdirSync(join(radice, "ponte", "src"), { recursive: true });
    writeFileSync(
      join(radice, "ponte", "src", "chiave-licenze.js"),
      '/* com\'era */\nexport const CHIAVE_PUBBLICA_LICENZE = "";\nexport const ALTRO = 1;\n',
    );
    mkdirSync(join(radice, "gdanav", "packages"), { recursive: true });
    const detto = execFileSync(
      process.execPath,
      [strumento, "--radice", radice, "--gdanav", join(radice, "gdanav")],
      { encoding: "utf8" },
    );
    const privata = /QUADRO_LICENZE_CHIAVE=([A-Za-z0-9_-]{43})/.exec(detto)[1];
    const pubblica = new Licenze({ cartella: radice, chiave: privata }).pubblica;
    const js = (via) => readFileSync(join(radice, via), "utf8");
    for (const via of ["ponte/src/chiave-licenze.js", "centralino/src/chiave-licenze.js", "nuvola/src/chiave-licenze.js"])
      assert.match(js(via), new RegExp(`export const CHIAVE_PUBBLICA_LICENZE = "${pubblica}";`), via);
    assert.match(js("ponte/src/chiave-licenze.js"), /export const ALTRO = 1;/, "il resto del file resta com'era");
    for (const via of ["app/lib/licenza/chiave.dart", "gdanav/packages/gdanav_app/lib/stato/chiave_licenze.dart"])
      assert.match(js(via), new RegExp(`const chiavePubblicaLicenze = '${pubblica}';`), via);

    /* Con --pubblica non si fabbrica niente, e non si stampa nessuna privata. */
    const solo = execFileSync(process.execPath, [strumento, "--radice", radice, "--pubblica", PUBBLICA], {
      encoding: "utf8",
    });
    assert.doesNotMatch(solo, /QUADRO_LICENZE_CHIAVE=/);
    assert.match(js("nuvola/src/chiave-licenze.js"), new RegExp(PUBBLICA));
    assert.match(js("app/lib/licenza/chiave.dart"), new RegExp(PUBBLICA));
  } finally {
    rmSync(radice, { recursive: true, force: true });
  }
});

/* ─── La catena di prova ─────────────────────────────────────────────────
 *
 * Tre certificati EC fatti con openssl per queste prove: una radice, un
 * intermedio e una foglia, come la catena che Apple mette nelle sue JWS.
 * La chiave della foglia firma le transazioni finte. Non valgono niente
 * fuori da qui: il quadro vero guarda l'impronta della radice di Apple. */

const RADICE_DI_PROVA = "92F386727F0A03FAFA8E6034D22FCE1512B17B767A5CA3AB4A8E9C32F8362398";

const CERT_RADICE =
  "MIIBmDCCAT+gAwIBAgIUTWcSJLFgTL6pMqJYXULezfzqHHMwCgYIKoZIzj0EAwIwGjEYMBYGA1UEAwwPUmFkaWNlIG" +
  "RpIHByb3ZhMB4XDTI2MDkyNzA3MTAxNVoXDTQ2MDkyMjA3MTAxNVowGjEYMBYGA1UEAwwPUmFkaWNlIGRpIHByb3Zh" +
  "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAED2HJnkZHaQ7Kol8huB67Pxe7bMxqrgt5UUuH7GpwYZnh1DmbSID4gH" +
  "ShEwEINPMLgSGVyrypcOJXsdrePYttIaNjMGEwHQYDVR0OBBYEFM2qZBaw/+7O+j9ycVOU/nJGFvNOMB8GA1UdIwQY" +
  "MBaAFM2qZBaw/+7O+j9ycVOU/nJGFvNOMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BA" +
  "MCA0cAMEQCIEIiKenH6r4rc5XJCZL/kSq3eVfWVypJ7P80ofKYL8QeAiAAueB89eGgaO7ckihqE6rf/NwU+tEmORZK" +
  "qnyW+B5zKw==";

const CERT_MEZZO =
  "MIIBnDCCAUOgAwIBAgIUUtZnf9KS/xOW0CUzzEIVERk5x8cwCgYIKoZIzj0EAwIwGjEYMBYGA1UEAwwPUmFkaWNlIG" +
  "RpIHByb3ZhMB4XDTI2MDkyNzA3MTAxNVoXDTQ2MDkyMjA3MTAxNVowHjEcMBoGA1UEAwwTSW50ZXJtZWRpbyBkaSBw" +
  "cm92YTBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABCWSyzmjYix0Zqze7SRT7JXMIyMjTKCvYv5Heaj+zYT3OgB7qu" +
  "jAPV+SrwrhAr7TNGoMsOiw+CYu/ocqYJgTA4ijYzBhMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMB0G" +
  "A1UdDgQWBBRXXlP8pdvw7pnf7coG/ApPA13NeTAfBgNVHSMEGDAWgBTNqmQWsP/uzvo/cnFTlP5yRhbzTjAKBggqhk" +
  "jOPQQDAgNHADBEAiAQ/CkT92Nsc2a1dxNYBgYp5FYGKdDF+yU5apIRSIswmQIgLhBt/pyWSxJewp4VB0RGocys+49h" +
  "Ns7jW0KiIaAaFJI=";

const CERT_FOGLIA =
  "MIIBMzCB2QIUR7usSTUmAczq6Psi6MNpEdoncw4wCgYIKoZIzj0EAwIwHjEcMBoGA1UEAwwTSW50ZXJtZWRpbyBkaS" +
  "Bwcm92YTAeFw0yNjA5MjcwNzEwMTZaFw00NjA5MjIwNzEwMTZaMBoxGDAWBgNVBAMMD0ZvZ2xpYSBkaSBwcm92YTBZ" +
  "MBMGByqGSM49AgEGCCqGSM49AwEHA0IABOmNv9+VbILMRJpYgFyHU07tbZjuuFfP40f29PK2CKtM3qV392HNdjhSnR" +
  "8KodWSNKfZ6uHy/WOIwZkd5ukOJ5UwCgYIKoZIzj0EAwIDSQAwRgIhAOGstE60ksOcee7+JOXUWVsK3UW0frgW6EzE" +
  "Y8C6tlvDAiEAqY8HKi+qklHouliecB9rGxGUtpIP8OgITmTFeqiY6p0=";

const CHIAVE_DELLA_FOGLIA = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgtCX5yXHn28oNzb7h
tdKCCLRlrtR80maKJoJVBmgA1vyhRANCAATpjb/flWyCzESaWIBch1NO7W2Y7rhX
z+NH9vTytgirTN6ld/dhzXY4Up0fCqHVkjSn2erh8v1jiMGZHebpDieV
-----END PRIVATE KEY-----`;
