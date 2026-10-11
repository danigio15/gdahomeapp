/* Il modo delle licenze, la porta dell'abbinamento e le licenze tolte.
 *
 * Tre cose, e la prima e' la piu' importante: **oggi non cambia niente per
 * nessuno**. La chiave e' vuota, il modo e' `spento`, e da fuori entrano
 * tutti. Poi:
 *
 *  1. `MODO_LICENZE` — `spento`, `registra`, `impone` — e il modo di serie:
 *     scrivere la chiave comincia a contare, non chiude; e non si impone mai
 *     con una chiave vuota o storta;
 *  2. con `registra` si verifica e si conta chi resterebbe fuori, e lo si
 *     legge in `/salute`, ma entrano tutti;
 *  3. la porta dell'abbinamento serve ad abbinarsi: un canale da li' vive
 *     qualche minuto, sempre; con `impone` chi non si abbina si chiude, e le
 *     case di prova e gli abbinamenti insieme hanno un tetto;
 *  4. le licenze tolte, chieste al quadro: un elenco firmato, che si tiene
 *     solo se e' buono e recente, e che chiude solo il gettone di quella
 *     licenza.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPrivateKey, randomBytes, sign } from "node:crypto";

import { Case } from "../src/case.js";
import {
  ABBINAMENTI_INSIEME_PER_CASA,
  Centralino,
  PREMIUM_RICHIESTO,
  PROVE_IN_TUTTO,
  PROVE_NUOVE_PER_CASA_AL_GIORNO,
  PROVE_PER_INDIRIZZO,
  SOLO_PER_ABBINARSI,
  VITA_DEL_CANALE_DI_ABBINAMENTO,
} from "../src/centralino.js";
import { CHIAVE_PUBBLICA_LICENZE } from "../src/chiave-licenze.js";
import { alzaIlCentralino } from "../src/index.js";
import { ilModoDelleLicenze } from "../src/modo-delle-licenze.js";
import { ELENCO_VECCHIO, Revoche, leggiLElenco } from "../src/revoche.js";
import { costruisciIlServer } from "../src/server.js";
import { PUBBLICA_DI_PROVA, unGettone } from "../../ponte/test/gettoni-di-prova.js";

/* La privata della coppia **di prova** del contratto (`docs/LICENZE.md`):
 * serve a firmare gli elenchi delle licenze tolte come li firma il quadro. */
const PRIVATA_DI_PROVA = createPrivateKey({
  key: {
    kty: "OKP",
    crv: "Ed25519",
    x: PUBBLICA_DI_PROVA,
    d: "Q2Iu3eKMxw3Y1GS9MypZjXvjPfHB959KImNldY80xr0",
  },
  format: "jwk",
});

const unaCasaNuova = () => `casa_${randomBytes(16).toString("hex")}`;
const unSegreto = () => randomBytes(32).toString("hex");
const unaImpronta = () => randomBytes(32).toString("hex");
const UNA_LICENZA = "lic_0123456789abcdef";
const UN_ALTRA = "lic_fedcba9876543210";

function unElenco(dentro = {}, { privata = PRIVATA_DI_PROVA } = {}) {
  const detto = { v: 1, tipo: "revoche", emesso: Date.now(), lic: [], ...dentro };
  const primo = Buffer.from(JSON.stringify(detto), "utf8").toString("base64url");
  return `${primo}.${sign(null, Buffer.from(primo, "ascii"), privata).toString("base64url")}`;
}

/* Un registro che si ricorda quello che gli si dice. */
function unRegistro() {
  const righe = [];
  return {
    righe,
    info: (riga) => righe.push(["info", riga]),
    attenzione: (riga) => righe.push(["attenzione", riga]),
    errore: (riga) => righe.push(["errore", riga]),
  };
}

async function attendi(condizione, entro = 3000) {
  const fine = Date.now() + entro;
  while (Date.now() < fine) {
    if (condizione()) return;
    await new Promise((ok) => setTimeout(ok, 10));
  }
  throw new Error("non e' successo in tempo");
}

async function banco(opzioni = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "centralino-modo-"));
  const centralino = new Centralino({
    case: new Case({ cartella }),
    chiaveLicenze: PUBBLICA_DI_PROVA,
    ...opzioni,
  });
  const server = costruisciIlServer({ centralino });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const porta = server.address().port;
  return {
    centralino,
    dove: `ws://127.0.0.1:${porta}`,
    http: `http://127.0.0.1:${porta}`,
    spegni: async () => {
      centralino.chiudiTutto();
      await new Promise((ok) => server.close(ok));
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

function unaCasa(dove, { id = unaCasaNuova(), segreto = unSegreto() } = {}) {
  const presa = new WebSocket(`${dove}/casa`);
  const detti = [];
  presa.addEventListener("message", (evento) => detti.push(JSON.parse(evento.data)));
  const aperta = new Promise((ok) => presa.addEventListener("open", ok));
  return {
    id,
    detti,
    manda: (cosa) => presa.send(JSON.stringify(cosa)),
    canali: () => detti.filter((uno) => uno.t === "apri"),
    arrivati: () => detti.filter((uno) => uno.t === "d"),
    chiusi: () => detti.filter((uno) => uno.t === "chiudi"),
    chiudi: () => presa.close(),
    entra: async (altro = {}) => {
      await aperta;
      presa.send(JSON.stringify({ t: "sono-io", casa: id, segreto, ...altro }));
      await attendi(() => detti.some((uno) => uno.t === "bene" || uno.t === "no"));
    },
  };
}

function unTelefono(dove, via) {
  const presa = new WebSocket(`${dove}${via}`);
  const aperta = new Promise((ok) => presa.addEventListener("open", ok));
  let finita = null;
  const chiusa = new Promise((ok) =>
    presa.addEventListener("close", (evento) => {
      finita = { codice: evento.code, motivo: evento.reason };
      ok(finita);
    }),
  );
  presa.addEventListener("error", () => {});
  return {
    presa,
    aperta,
    chiusa,
    eChiuso: () => finita !== null,
    dice: async (cosa) => {
      await aperta;
      presa.send(typeof cosa === "string" ? cosa : JSON.stringify(cosa));
    },
    chiudi: () => presa.close(),
  };
}

/* La prima parola di chi si abbina e di chi e' gia' abbinato, come le manda
 * l'app (`app/lib/ponte/stretta.dart`). */
const SI_ABBINA = { v: 1, abbina: 2, apertura: "AAAAAAAAAAAAAAAAAAAAAA==", mia: "x" };
const GIA_ABBINATO = { v: 1, chi: "dm_telefono", apertura: "AAAAAAAAAAAAAAAAAAAAAA==", mia: "x" };

/* ─── 1. Il modo ──────────────────────────────────────────────────────── */

test("oggi: la chiave e' vuota, e il modo di serie e' spento", () => {
  /* E' la riga che dice che non cambia niente per nessuno. */
  assert.equal(CHIAVE_PUBBLICA_LICENZE, "");
  assert.equal(ilModoDelleLicenze(undefined, { chiave: CHIAVE_PUBBLICA_LICENZE }), "spento");
  assert.equal(ilModoDelleLicenze("", { chiave: CHIAVE_PUBBLICA_LICENZE }), "spento");
});

test("con la chiave scritta e nessun modo detto si registra, non si impone", () => {
  assert.equal(ilModoDelleLicenze("", { chiave: PUBBLICA_DI_PROVA }), "registra");
  assert.equal(ilModoDelleLicenze(undefined, { chiave: PUBBLICA_DI_PROVA }), "registra");
});

test("i tre modi, detti come si vuole, con una chiave buona", () => {
  for (const [detto, modo] of [
    ["spento", "spento"],
    ["registra", "registra"],
    ["impone", "impone"],
    [" IMPONE \n", "impone"],
    ["Registra", "registra"],
  ]) {
    assert.equal(ilModoDelleLicenze(detto, { chiave: PUBBLICA_DI_PROVA }), modo, detto);
  }
});

test("non si impone mai con la chiave vuota o storta: lo si dice forte, e si resta spenti", () => {
  for (const chiave of ["", "xy", "non una chiave!", "A".repeat(42)]) {
    for (const chiesto of ["impone", "registra"]) {
      const registro = unRegistro();
      assert.equal(ilModoDelleLicenze(chiesto, { chiave, registro }), "spento", chiave);
      const [[livello, riga]] = registro.righe;
      assert.equal(livello, "errore");
      assert.match(riga, /!!!/);
      assert.match(riga, new RegExp(`MODO_LICENZE=${chiesto}`));
    }
  }
});

test("una parola che non si conosce non chiude niente", () => {
  for (const chiave of ["", PUBBLICA_DI_PROVA]) {
    const registro = unRegistro();
    const modo = ilModoDelleLicenze("imponi", { chiave, registro });
    assert.equal(modo, chiave ? "registra" : "spento");
    assert.equal(registro.righe[0][0], "errore");
  }
});

test("la classe, senza modo detto, fa quello che faceva: con la chiave impone, senza no", () => {
  const senza = new Centralino({ case: null, chiaveLicenze: "" });
  const con = new Centralino({ case: null, chiaveLicenze: PUBBLICA_DI_PROVA });
  try {
    assert.equal(senza.modoLicenze, "spento");
    assert.equal(con.modoLicenze, "impone");
    /* E un modo detto passa sempre dal controllo della chiave. */
    const storta = new Centralino({ case: null, chiaveLicenze: "", modoLicenze: "impone" });
    assert.equal(storta.modoLicenze, "spento");
    storta.chiudiTutto();
  } finally {
    senza.chiudiTutto();
    con.chiudiTutto();
  }
});

test("il centralino vero, acceso come in produzione: spento di serie, e impone solo con la chiave", async () => {
  for (const [opzioni, atteso] of [
    [{}, "spento"],
    [{ modoLicenze: "impone" }, "spento"],
    [{ modoLicenze: "registra" }, "spento"],
    [{ chiaveLicenze: PUBBLICA_DI_PROVA }, "registra"],
    [{ chiaveLicenze: PUBBLICA_DI_PROVA, modoLicenze: "impone" }, "impone"],
    [{ chiaveLicenze: PUBBLICA_DI_PROVA, modoLicenze: "spento" }, "spento"],
  ]) {
    const cartella = mkdtempSync(join(tmpdir(), "centralino-modo-vero-"));
    const acceso = await alzaIlCentralino({
      porta: 0,
      cartella,
      livello: "errore",
      ...opzioni,
    });
    try {
      assert.equal(acceso.centralino.modoLicenze, atteso, JSON.stringify(opzioni));
      const salute = await (
        await fetch(`http://127.0.0.1:${acceso.server.address().port}/salute`)
      ).json();
      assert.equal(salute.licenze.modo, atteso);
      assert.equal(typeof salute.pronte_alla_licenza, "number");
    } finally {
      await acceso.abbassa();
      rmSync(cartella, { recursive: true, force: true });
    }
  }
});

/* ─── 2. Registra: si conta, ed entrano tutti ────────────────────────── */

test("spento: entrano tutti, e chi sarebbe senza Premium non si sa", async () => {
  const b = await banco({ chiaveLicenze: "", modoLicenze: "spento" });
  try {
    const casa = unaCasa(b.dove);
    await casa.entra({ gettone: "" });
    const telefono = unTelefono(b.dove, `/telefono/${casa.id}`);
    await attendi(() => casa.canali().length === 1);
    assert.deepEqual(b.centralino.statoDelleLicenze(), {
      modo: "spento",
      senza_premium: null,
      da_aggiornare: 0,
      telefoni_senza_licenza: 0,
      non_abbinamenti: 0,
      abbinamenti_di_troppo: 0,
      prove_rifiutate: 0,
      licenze_tolte: null,
    });
    telefono.chiudi();
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("registra: la casa Base e quella vecchia restano aperte, e si contano", async () => {
  const b = await banco({ modoLicenze: "registra" });
  try {
    const base = unaCasa(b.dove);
    await base.entra({ gettone: "" });
    const vecchia = unaCasa(b.dove);
    await vecchia.entra();
    const premium = unaCasa(b.dove);
    await premium.entra({ gettone: unGettone({ sog: premium.id }) });

    for (const casa of [base, vecchia, premium]) {
      const telefono = unTelefono(b.dove, `/telefono/${casa.id}`);
      await attendi(() => casa.canali().length === 1);
      await telefono.dice("ciao");
      await attendi(() => casa.arrivati().length === 1);
      assert.equal(telefono.eChiuso(), false);
    }

    const stato = b.centralino.statoDelleLicenze();
    assert.equal(stato.modo, "registra");
    assert.equal(stato.senza_premium, 1, "la casa Base, che con impone sentirebbe 4402");
    assert.equal(stato.da_aggiornare, 1, "quella vecchia, che sentirebbe 4426");
    assert.equal(stato.telefoni_senza_licenza, 2);

    /* Ed e' quello che si legge da dentro, accanto a pronte_alla_licenza. */
    const salute = await (await fetch(`${b.http}/salute`)).json();
    assert.equal(salute.pronte_alla_licenza, 2);
    assert.deepEqual(salute.licenze, stato);

    /* Un gettone vuoto detto dopo non chiude nessuno. */
    premium.manda({ t: "licenza", gettone: "" });
    await attendi(() => b.centralino.quanteSenzaPremium() === 2);
    assert.equal(premium.chiusi().length, 0);
    for (const casa of [base, vecchia, premium]) casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("registra: il giro non chiude i telefoni di una casa il cui gettone e' scaduto", async () => {
  let ora = Date.now();
  const b = await banco({ modoLicenze: "registra", adesso: () => ora });
  try {
    const casa = unaCasa(b.dove);
    await casa.entra({ gettone: unGettone({ sog: casa.id, fino: ora + 1000 }) });
    const telefono = unTelefono(b.dove, `/telefono/${casa.id}`);
    await attendi(() => casa.canali().length === 1);
    ora += 2000;
    b.centralino._giroDiControllo();
    await new Promise((ok) => setTimeout(ok, 50));
    assert.equal(telefono.eChiuso(), false);
    assert.equal(b.centralino.ePremium(casa.id), false);
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

/* ─── 3. La porta dell'abbinamento ────────────────────────────────────── */

test("impone: dalla porta dell'abbinamento chi non si abbina si chiude", async () => {
  const b = await banco({ modoLicenze: "impone" });
  try {
    const casa = unaCasa(b.dove);
    await casa.entra({ gettone: "" });
    const impronta = unaImpronta();
    casa.manda({ t: "apri-prova", impronta, vale: 60_000 });
    await attendi(() => b.centralino.abbinamenti.has(impronta));

    const furbo = unTelefono(b.dove, `/abbinamento/${impronta}`);
    await furbo.dice(GIA_ABBINATO);
    assert.deepEqual(await furbo.chiusa, SOLO_PER_ABBINARSI);
    /* Alla casa non e' arrivata nessuna parola sua. */
    assert.equal(casa.arrivati().length, 0);
    assert.equal(b.centralino.statoDelleLicenze().non_abbinamenti, 1);

    /* Chi si abbina passa, anche se la casa e' Base: l'abbinamento resta
     * aperto a tutti. */
    const vero = unTelefono(b.dove, `/abbinamento/${impronta}`);
    await vero.dice(SI_ABBINA);
    await attendi(() => casa.arrivati().length === 1);
    assert.deepEqual(JSON.parse(casa.arrivati()[0].m), SI_ABBINA);
    assert.equal(vero.eChiuso(), false);
    /* Anche l'app di prima, che si abbinava con `abbina: true`. */
    const vecchia = unTelefono(b.dove, `/abbinamento/${impronta}`);
    await vecchia.dice({ ...SI_ABBINA, abbina: true });
    await attendi(() => casa.arrivati().length === 2);
    vero.chiudi();
    vecchia.chiudi();
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("registra e spento: chi non si abbina passa, e si conta", async () => {
  for (const modo of ["registra", "spento"]) {
    const b = await banco({ modoLicenze: modo });
    try {
      const casa = unaCasa(b.dove);
      await casa.entra({ gettone: "" });
      const impronta = unaImpronta();
      casa.manda({ t: "apri-abbinamento", impronta });
      await attendi(() => b.centralino.abbinamenti.has(impronta));
      const furbo = unTelefono(b.dove, `/abbinamento/${impronta}`);
      await furbo.dice(GIA_ABBINATO);
      await attendi(() => casa.arrivati().length === 1);
      assert.equal(b.centralino.statoDelleLicenze().non_abbinamenti, 1, modo);
      furbo.chiudi();
      casa.chiudi();
    } finally {
      await b.spegni();
    }
  }
});

test("un canale dalla porta dell'abbinamento vive poco, sempre; quello del telefono no", async () => {
  assert.equal(VITA_DEL_CANALE_DI_ABBINAMENTO, 10 * 60 * 1000);
  const b = await banco({ chiaveLicenze: "", vitaDelCanaleDiAbbinamento: 150 });
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    const impronta = unaImpronta();
    casa.manda({ t: "apri-abbinamento", impronta });
    await attendi(() => b.centralino.abbinamenti.has(impronta));

    const daCasa = unTelefono(b.dove, `/telefono/${casa.id}`);
    const inAbbinamento = unTelefono(b.dove, `/abbinamento/${impronta}`);
    await inAbbinamento.dice(SI_ABBINA);
    await daCasa.dice("ciao");
    const fine = await inAbbinamento.chiusa;
    assert.equal(fine.codice, 1000);
    assert.equal(fine.motivo, "l'abbinamento dura poco");
    /* La casa lo sa: il canale le si chiude come sempre. */
    await attendi(() => casa.chiusi().length === 1);
    await new Promise((ok) => setTimeout(ok, 200));
    assert.equal(daCasa.eChiuso(), false);
    daCasa.chiudi();
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("un canale di abbinamento chiuso prima non lascia niente dietro", async () => {
  const b = await banco({ chiaveLicenze: "", vitaDelCanaleDiAbbinamento: 100 });
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    const impronta = unaImpronta();
    casa.manda({ t: "apri-abbinamento", impronta });
    await attendi(() => b.centralino.abbinamenti.has(impronta));
    const telefono = unTelefono(b.dove, `/abbinamento/${impronta}`);
    await telefono.dice(SI_ABBINA);
    await attendi(() => casa.canali().length === 1);
    /* La casa chiude, come fa dopo «abbinato». */
    casa.manda({ c: casa.canali()[0].c, t: "chiudi" });
    await telefono.chiusa;
    await new Promise((ok) => setTimeout(ok, 200));
    assert.equal(casa.chiusi().length, 0, "nessun chiudi in piu' per un canale gia' andato");
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("impone: troppi abbinamenti insieme su una casa sola, e il di piu' riprova dopo", async () => {
  const b = await banco({ modoLicenze: "impone" });
  try {
    const casa = unaCasa(b.dove);
    await casa.entra({ gettone: "" });
    const impronta = unaImpronta();
    casa.manda({ t: "apri-prova", impronta, vale: 60_000 });
    await attendi(() => b.centralino.abbinamenti.has(impronta));
    const dentro = [];
    for (let i = 0; i < ABBINAMENTI_INSIEME_PER_CASA; i += 1) {
      dentro.push(unTelefono(b.dove, `/abbinamento/${impronta}`));
      await attendi(() => casa.canali().length === i + 1);
    }
    const uno = unTelefono(b.dove, `/abbinamento/${impronta}`);
    const fine = await uno.chiusa;
    assert.equal(fine.codice, 1013);
    assert.equal(b.centralino.statoDelleLicenze().abbinamenti_di_troppo, 1);
    for (const t of dentro) t.chiudi();
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("registra: gli abbinamenti di troppo passano, e si contano", async () => {
  const b = await banco({ modoLicenze: "registra" });
  try {
    const casa = unaCasa(b.dove);
    await casa.entra({ gettone: "" });
    const impronta = unaImpronta();
    casa.manda({ t: "apri-prova", impronta, vale: 60_000 });
    await attendi(() => b.centralino.abbinamenti.has(impronta));
    const dentro = [];
    for (let i = 0; i <= ABBINAMENTI_INSIEME_PER_CASA; i += 1) {
      dentro.push(unTelefono(b.dove, `/abbinamento/${impronta}`));
      await attendi(() => casa.canali().length === i + 1);
    }
    assert.equal(b.centralino.statoDelleLicenze().abbinamenti_di_troppo, 1);
    for (const t of dentro) t.chiudi();
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("impone: una casa non apre impronte di prova nuove senza fine; la stessa ridetta si'", async () => {
  const b = await banco({ modoLicenze: "impone" });
  try {
    const casa = unaCasa(b.dove);
    await casa.entra({ gettone: "" });
    let ultima = null;
    for (let i = 0; i < PROVE_NUOVE_PER_CASA_AL_GIORNO; i += 1) {
      ultima = unaImpronta();
      casa.manda({ t: "apri-prova", impronta: ultima, vale: 60_000 });
      await attendi(() => b.centralino.abbinamenti.has(ultima));
    }
    const di_troppo = unaImpronta();
    casa.manda({ t: "apri-prova", impronta: di_troppo, vale: 60_000 });
    /* La stessa ridetta — come fa il ponte a ogni filo nuovo — passa. */
    casa.manda({ t: "apri-prova", impronta: ultima, vale: 60_000 });
    await attendi(() => b.centralino.statoDelleLicenze().prove_rifiutate === 1);
    await new Promise((ok) => setTimeout(ok, 50));
    assert.equal(b.centralino.abbinamenti.has(di_troppo), false);
    assert.equal(b.centralino.abbinamenti.has(ultima), true);
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("impone: poche case di prova insieme dallo stesso indirizzo", async () => {
  const b = await banco({ modoLicenze: "impone" });
  try {
    const case_ = [];
    for (let i = 0; i <= PROVE_PER_INDIRIZZO; i += 1) {
      const casa = unaCasa(b.dove);
      await casa.entra({ gettone: "" });
      case_.push({ casa, impronta: unaImpronta() });
    }
    for (const [i, { casa, impronta }] of case_.entries()) {
      casa.manda({ t: "apri-prova", impronta, vale: 60_000 });
      if (i < PROVE_PER_INDIRIZZO) await attendi(() => b.centralino.abbinamenti.has(impronta));
    }
    await attendi(() => b.centralino.statoDelleLicenze().prove_rifiutate === 1);
    assert.equal(b.centralino.abbinamenti.has(case_.at(-1).impronta), false);
    for (const { casa } of case_) casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("registra: le case di prova oltre i tetti passano, e si contano", async () => {
  const b = await banco({ modoLicenze: "registra" });
  try {
    const case_ = [];
    for (let i = 0; i <= PROVE_PER_INDIRIZZO; i += 1) {
      const casa = unaCasa(b.dove);
      await casa.entra({ gettone: "" });
      const impronta = unaImpronta();
      casa.manda({ t: "apri-prova", impronta, vale: 60_000 });
      await attendi(() => b.centralino.abbinamenti.has(impronta));
      case_.push(casa);
    }
    assert.equal(b.centralino.statoDelleLicenze().prove_rifiutate, 1);
    for (const casa of case_) casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("il tetto delle case di prova in tutto vale sempre, anche spento", async () => {
  const b = await banco({ chiaveLicenze: "" });
  try {
    for (let i = 0; i < PROVE_IN_TUTTO; i += 1) {
      b.centralino.abbinamenti.set(unaImpronta(), {
        casa: unaCasaNuova(),
        scadeIl: Date.now() + 60_000,
        prova: true,
      });
    }
    const casa = unaCasa(b.dove);
    await casa.entra();
    const impronta = unaImpronta();
    casa.manda({ t: "apri-prova", impronta, vale: 60_000 });
    await attendi(() => b.centralino.statoDelleLicenze().prove_rifiutate === 1);
    assert.equal(b.centralino.abbinamenti.has(impronta), false);
    /* Il codice di tutti i giorni non c'entra. */
    const tutti = unaImpronta();
    casa.manda({ t: "apri-abbinamento", impronta: tutti });
    await attendi(() => b.centralino.abbinamenti.has(tutti));
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("il giro dimentica le impronte di prova di piu' di un giorno fa", () => {
  let ora = Date.now();
  const centralino = new Centralino({ case: null, chiaveLicenze: "", adesso: () => ora });
  try {
    centralino.proveDelGiorno.set("casa_x", new Map([["a", ora]]));
    ora += 24 * 60 * 60 * 1000 + 1;
    centralino._giroDiControllo();
    assert.equal(centralino.proveDelGiorno.size, 0);
  } finally {
    centralino.chiudiTutto();
  }
});

/* ─── 4. Le licenze tolte ─────────────────────────────────────────────── */

test("l'elenco si legge solo con la firma giusta e la forma giusta", () => {
  const buono = unElenco({ lic: [UNA_LICENZA, "non-una-licenza"] });
  assert.deepEqual(leggiLElenco(buono, PUBBLICA_DI_PROVA).lic, [UNA_LICENZA]);
  /* Con una chiave vuota non si legge niente. */
  assert.equal(leggiLElenco(buono, ""), null);
  /* Firmato da qualcun altro. */
  const estranea = createPrivateKey({
    key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), randomBytes(32)]),
    format: "der",
    type: "pkcs8",
  });
  assert.equal(leggiLElenco(unElenco({}, { privata: estranea }), PUBBLICA_DI_PROVA), null);
  /* Un gettone non e' un elenco, ne' un elenco un gettone. */
  assert.equal(leggiLElenco(unGettone(), PUBBLICA_DI_PROVA), null);
  assert.equal(leggiLElenco(unElenco({ tipo: "altro" }), PUBBLICA_DI_PROVA), null);
  assert.equal(leggiLElenco("roba", PUBBLICA_DI_PROVA), null);
});

test("un elenco vecchio, del futuro, o piu' vecchio di quello che c'e' non si tiene", () => {
  let ora = Date.now();
  const revoche = new Revoche({ dove: "x", chiave: PUBBLICA_DI_PROVA, adesso: () => ora });
  assert.equal(revoche.tieni(unElenco({ emesso: ora - ELENCO_VECCHIO - 1 })), false);
  assert.equal(revoche.tieni(unElenco({ emesso: ora + 60 * 60 * 1000 })), false);
  assert.equal(revoche.tieni(unElenco({ emesso: ora, lic: [UNA_LICENZA] })), true);
  assert.equal(revoche.tolta(UNA_LICENZA), true);
  /* Chi sta in mezzo rimanda quello di prima, senza la licenza: no. */
  assert.equal(revoche.tieni(unElenco({ emesso: ora - 1000, lic: [] })), false);
  assert.equal(revoche.tolta(UNA_LICENZA), true);
  /* E dopo un giorno senza elenchi nuovi non vale piu' niente: si torna al
   * gettone, come prima. */
  ora += ELENCO_VECCHIO + 1;
  assert.equal(revoche.tolta(UNA_LICENZA), false);
  assert.equal(revoche.quante(), 0);
});

test("il quadro che non risponde non cambia niente, e senza indirizzo non si chiede", async () => {
  let chiesto = 0;
  const elenco = unElenco({ lic: [UNA_LICENZA] });
  let risponde = true;
  const revoche = new Revoche({
    dove: "https://quadro.esempio/v1/licenze/revocate",
    chiave: PUBBLICA_DI_PROVA,
    prendi: async () => {
      chiesto += 1;
      if (!risponde) throw new Error("giu'");
      return new Response(JSON.stringify({ elenco }), { status: 200 });
    },
  });
  assert.equal(await revoche.aggiorna(), true);
  assert.equal(revoche.tolta(UNA_LICENZA), true);
  risponde = false;
  assert.equal(await revoche.aggiorna(), false);
  assert.equal(revoche.tolta(UNA_LICENZA), true, "si tiene l'ultimo buono");
  assert.equal(chiesto, 2);

  const senza = new Revoche({
    dove: "",
    chiave: PUBBLICA_DI_PROVA,
    prendi: async () => assert.fail(),
  });
  assert.equal(senza.accese, false);
  assert.equal(await senza.aggiorna(), false);
  senza.avvia();
  senza.ferma();
  const senzaChiave = new Revoche({
    dove: "https://x",
    chiave: "",
    prendi: async () => assert.fail(),
  });
  assert.equal(await senzaChiave.aggiorna(), false);
});

test("impone: il gettone di una licenza tolta non apre, quello di un'altra si'", async () => {
  const revoche = new Revoche({ dove: "x", chiave: PUBBLICA_DI_PROVA });
  revoche.tieni(unElenco({ lic: [UNA_LICENZA] }));
  const b = await banco({ modoLicenze: "impone", revoche });
  try {
    const tolta = unaCasa(b.dove);
    await tolta.entra({ gettone: unGettone({ sog: tolta.id, lic: UNA_LICENZA }) });
    assert.equal(b.centralino.ePremium(tolta.id), false);
    const telefono = unTelefono(b.dove, `/telefono/${tolta.id}`);
    assert.deepEqual(await telefono.chiusa, PREMIUM_RICHIESTO);

    /* Ridata: un gettone di un'altra licenza, che nell'elenco non c'e'. */
    tolta.manda({ t: "licenza", gettone: unGettone({ sog: tolta.id, lic: UN_ALTRA }) });
    await attendi(() => b.centralino.ePremium(tolta.id));
    const dopo = unTelefono(b.dove, `/telefono/${tolta.id}`);
    await attendi(() => tolta.canali().length === 1);
    assert.equal(dopo.eChiuso(), false);
    assert.equal(b.centralino.statoDelleLicenze().licenze_tolte, 1);
    dopo.chiudi();
    tolta.chiudi();
  } finally {
    await b.spegni();
  }
});

test("impone: una licenza tolta mentre il telefono e' dentro esce al giro dopo", async () => {
  const revoche = new Revoche({ dove: "x", chiave: PUBBLICA_DI_PROVA });
  const b = await banco({ modoLicenze: "impone", revoche });
  try {
    const casa = unaCasa(b.dove);
    await casa.entra({ gettone: unGettone({ sog: casa.id, lic: UNA_LICENZA }) });
    const telefono = unTelefono(b.dove, `/telefono/${casa.id}`);
    await attendi(() => casa.canali().length === 1);

    revoche.tieni(unElenco({ lic: [UNA_LICENZA] }));
    b.centralino._giroDiControllo();
    assert.deepEqual(await telefono.chiusa, PREMIUM_RICHIESTO);
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("registra: una licenza tolta si conta e non chiude", async () => {
  const revoche = new Revoche({ dove: "x", chiave: PUBBLICA_DI_PROVA });
  revoche.tieni(unElenco({ lic: [UNA_LICENZA] }));
  const b = await banco({ modoLicenze: "registra", revoche });
  try {
    const casa = unaCasa(b.dove);
    await casa.entra({ gettone: unGettone({ sog: casa.id, lic: UNA_LICENZA }) });
    const telefono = unTelefono(b.dove, `/telefono/${casa.id}`);
    await attendi(() => casa.canali().length === 1);
    b.centralino._giroDiControllo();
    await new Promise((ok) => setTimeout(ok, 50));
    assert.equal(telefono.eChiuso(), false);
    assert.equal(b.centralino.statoDelleLicenze().senza_premium, 1);
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});
