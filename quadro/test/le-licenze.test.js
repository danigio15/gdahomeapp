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
 *  4. **il pacchetto e' un limite**: finito, il server dice di no; tolta una
 *     licenza, il posto torna;
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

async function banco({ chiave = PRIVATA, negozi, installatori = [] } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "quadro-licenze-"));
  const acceso = await alzaIlQuadro({
    porta: 0,
    cartella,
    livello: "errore",
    chiaveDelGestore: CHIAVE_DEL_GESTORE,
    chiaveDelleLicenze: chiave,
    negozi: negozi ?? new Negozi({ ambiente: {} }),
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
    assert.deepEqual(sue, [{ lic: una.lic, app: "gdahome", origine: "regalo", scade: una.scade }]);

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
    installatori: [{ pacchetto: { gdahome: 2, gdanav: 1 }, case: [UNA, ALTRA] }],
  });
  try {
    const chiave = b.iscritti[0].chiave;
    let letto = await b.retro(chiave, "/licenze");
    assert.equal(letto.stato, 200);
    assert.deepEqual(letto.detto.pacchetto, {
      gdahome: { totali: 2, usate: 0 },
      gdanav: { totali: 1, usate: 0 },
    });

    const data = await b.retro(chiave, "/licenze", {
      metodo: "POST",
      corpo: { app: "gdahome", casa: UNA, mesi: 12 },
    });
    assert.equal(data.stato, 200);
    assert.equal(data.detto.pacchetto.gdahome.usate, 1);

    const codice = await b.retro(chiave, "/codici", { metodo: "POST", corpo: { app: "gdahome", mesi: null } });
    assert.equal(codice.stato, 200);
    assert.match(codice.detto.codice, /^GDA-/);
    assert.equal(codice.detto.pacchetto.gdahome.usate, 2);

    /* Finito: ne' licenze ne' codici. */
    const troppo = await b.retro(chiave, "/licenze", {
      metodo: "POST",
      corpo: { app: "gdahome", casa: ALTRA, mesi: 12 },
    });
    assert.equal(troppo.stato, 409);
    assert.equal(troppo.detto.errore, "pacchetto-esaurito");
    assert.equal(
      (await b.retro(chiave, "/codici", { metodo: "POST", corpo: { app: "gdahome" } })).stato,
      409,
    );

    /* Il codice riscattato diventa una licenza, e continua a contare uno. */
    const riscattato = await b.fuori("riscatta", { codice: codice.detto.codice, casa: TERZA, segreto: SEGRETO });
    assert.equal(riscattato.stato, 200);
    assert.equal(verificaIlGettone(riscattato.detto.gettoni.gdahome, PUBBLICA).origine, "installatore");
    letto = await b.retro(chiave, "/licenze");
    assert.equal(letto.detto.pacchetto.gdahome.usate, 2);
    assert.equal(letto.detto.licenze.length, 2);
    assert.equal(letto.detto.codici.length, 0);

    /* La casa vede la licenza dell'installatore. */
    const casa = await b.fuori("casa", { casa: UNA, segreto: SEGRETO });
    assert.equal(verificaIlGettone(casa.detto.gettoni.gdahome, PUBBLICA, { sog: UNA }).origine, "installatore");

    /* Tolta, torna nel pacchetto, e se ne da' un'altra. */
    const tolta = await b.retro(chiave, `/licenze/${data.detto.licenza}`, { metodo: "DELETE" });
    assert.equal(tolta.stato, 200);
    assert.equal(tolta.detto.pacchetto.gdahome.usate, 1);
    assert.deepEqual((await b.fuori("casa", { casa: UNA, segreto: SEGRETO })).detto.gettoni, {});
    assert.equal(
      (await b.retro(chiave, "/licenze", { metodo: "POST", corpo: { app: "gdahome", casa: ALTRA, mesi: null } }))
        .stato,
      200,
    );

    /* Un codice non usato si annulla, e il posto torna anche cosi'. */
    const nav = await b.retro(chiave, "/codici", { metodo: "POST", corpo: { app: "gdanav", mesi: 6 } });
    assert.equal(nav.detto.pacchetto.gdanav.usate, 1);
    const via = await b.retro(chiave, `/codici/${nav.detto.codice}`, { metodo: "DELETE" });
    assert.equal(via.detto.pacchetto.gdanav.usate, 0);

    /* Il gestore vede il pacchetto, e lo cambia. */
    const quadro = await b.gestore("/installatori");
    assert.deepEqual(quadro.detto.installatori[0].pacchetto, {
      gdahome: { totali: 2, usate: 2 },
      gdanav: { totali: 1, usate: 0 },
    });
    const cambiato = await b.gestore(`/installatori/${b.iscritti[0].chi}`, {
      metodo: "PATCH",
      corpo: { pacchetto: { gdahome: 5 } },
    });
    assert.equal(cambiato.stato, 200);
    assert.deepEqual(cambiato.detto.installatori[0].pacchetto, {
      gdahome: { totali: 5, usate: 2 },
      gdanav: { totali: 1, usate: 0 },
    });
    /* E la via di sempre, al singolare, fa lo stesso. */
    const col = await b.gestore(`/installatore/${b.iscritti[0].chi}`, {
      metodo: "PUT",
      corpo: { pacchetto: { gdanav: 3 } },
    });
    assert.equal(col.detto.installatori[0].pacchetto.gdanav.totali, 3);
  } finally {
    await b.chiudi();
  }
});

test("un installatore regala solo alle sue case, e toglie solo le sue licenze", async () => {
  const b = await banco({
    installatori: [
      { pacchetto: { gdahome: 5, gdanav: 5 }, case: [UNA] },
      { pacchetto: { gdahome: 5, gdanav: 5 }, case: [ALTRA] },
    ],
  });
  try {
    const [rossi, bianchi] = b.iscritti;
    /* La casa di Bianchi, dalla chiave di Rossi: no, e senza dire che esiste. */
    const suaNo = await b.retro(rossi.chiave, "/licenze", {
      metodo: "POST",
      corpo: { app: "gdahome", casa: ALTRA, mesi: 12 },
    });
    assert.equal(suaNo.stato, 404);
    const nessuna = await b.retro(rossi.chiave, "/licenze", {
      metodo: "POST",
      corpo: { app: "gdahome", casa: TERZA, mesi: 12 },
    });
    assert.equal(nessuna.stato, 404);
    assert.equal(suaNo.detto.errore, nessuna.detto.errore);
    assert.equal((await b.retro(rossi.chiave, "/licenze")).detto.pacchetto.gdahome.usate, 0);

    /* Quella di Bianchi non la toglie Rossi, e nemmeno quella del gestore. */
    const diBianchi = await b.retro(bianchi.chiave, "/licenze", {
      metodo: "POST",
      corpo: { app: "gdahome", casa: ALTRA, mesi: null },
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
    const codice = await b.retro(bianchi.chiave, "/codici", { metodo: "POST", corpo: { app: "gdanav" } });
    assert.equal((await b.retro(rossi.chiave, `/codici/${codice.detto.codice}`, { metodo: "DELETE" })).stato, 404);

    /* Senza pacchetto, niente. */
    const { detto: senza } = await b.gestore("/installatori", { metodo: "POST", corpo: { nome: "Verdi" } });
    const niente = await b.retro(senza.chiave, "/codici", { metodo: "POST", corpo: { app: "gdahome" } });
    assert.equal(niente.stato, 409);
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
function unAppleFinto(transazioni, { radice = RADICE_DI_PROVA } = {}) {
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
