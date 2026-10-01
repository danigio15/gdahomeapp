/* Il centralino e le licenze: da fuori casa si entra con gdahome Premium.
 *
 * Il contratto sta in `docs/LICENZE.md`. Qui si prova la parte del
 * centralino, con la casa e il telefono veri — WebSocket clienti di Node — e
 * la chiave **di prova** passata a mano: in `chiave-licenze.js` non ci va.
 *
 *   - la casa dice il gettone (`{t|tipo: "licenza", gettone}`, o dentro il
 *     `sono-io`), il centralino lo verifica e se lo ricorda;
 *   - un telefono verso una casa senza gettone buono si chiude con `4402`
 *     `premium-richiesto` — o con `4426` `aggiorna-add-on`, se la casa la
 *     licenza non l'ha mai detta; l'abbinamento resta aperto a tutti;
 *   - la ricevuta di chi compra fuori casa (`POST /licenza/<casa>`) arriva
 *     alla casa sul suo filo, e torna la sua risposta;
 *   - con la chiave vuota il controllo e' spento: entrano tutti, come ieri.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";

import { Case } from "../src/case.js";
import { ADDON_DA_AGGIORNARE, Centralino, PREMIUM_RICHIESTO } from "../src/centralino.js";
import { Freno } from "../src/freno.js";
import { Ricevute } from "../src/ricevute.js";
import { costruisciIlServer } from "../src/server.js";
import { PUBBLICA_DI_PROVA, unGettone } from "../../ponte/test/gettoni-di-prova.js";

const impronta = (cosa) => createHash("sha256").update(cosa).digest("hex");
const unaCasaNuova = () => `casa_${randomBytes(16).toString("hex")}`;
const unSegreto = () => randomBytes(32).toString("hex");

async function attendi(condizione, entro = 3000) {
  const fine = Date.now() + entro;
  while (Date.now() < fine) {
    if (condizione()) return;
    await new Promise((ok) => setTimeout(ok, 10));
  }
  throw new Error("non e' successo in tempo");
}

async function banco({
  chiaveLicenze = PUBBLICA_DI_PROVA,
  attesaDellaRicevuta,
  freno,
  adesso,
} = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "centralino-licenza-"));
  const centralino = new Centralino({
    case: new Case({ cartella }),
    chiaveLicenze,
    ...(attesaDellaRicevuta ? { attesaDellaRicevuta } : {}),
    ...(adesso ? { adesso } : {}),
  });
  const ricevute = new Ricevute({ centralino, ...(freno ? { freno } : {}) });
  const server = costruisciIlServer({ centralino, ricevute });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    centralino,
    dove: `ws://127.0.0.1:${server.address().port}`,
    http: `http://127.0.0.1:${server.address().port}`,
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
  /* Come risponde alle ricevute: `null` non risponde affatto. */
  let risponde = null;
  presa.addEventListener("message", (evento) => {
    const detto = JSON.parse(evento.data);
    detti.push(detto);
    if (detto.t === "ricevuta" && risponde) {
      presa.send(JSON.stringify({ t: "ricevuta", n: detto.n, ...risponde(detto) }));
    }
  });
  const aperta = new Promise((ok) => presa.addEventListener("open", ok));
  return {
    id,
    detti,
    ricevute: () => detti.filter((uno) => uno.t === "ricevuta"),
    rispondiAlleRicevute: (come) => {
      risponde = come;
    },
    manda: (cosa) => presa.send(JSON.stringify(cosa)),
    canali: () => detti.filter((uno) => uno.t === "apri"),
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
  const chiusa = new Promise((ok) =>
    presa.addEventListener("close", (evento) => ok({ codice: evento.code, motivo: evento.reason })),
  );
  presa.addEventListener("error", () => {});
  return { presa, aperta, chiusa, chiudi: () => presa.close() };
}

/* La ricevuta come la manda l'app: al centralino non importa cosa c'e'
 * dentro, la firma la guarda la casa. */
const UNA_RICEVUTA = Object.freeze({
  v: 1,
  chi: "dm_telefono",
  quando: 1_760_000_000_000,
  app: "gdahome",
  piattaforma: "ios",
  prodotto: "gdahome_premium_mensile",
  ricevuta: "2000000123456789",
  firma: "firma-del-telefono",
});

const portaLaRicevuta = (b, casa, corpo = UNA_RICEVUTA, altro = {}) =>
  fetch(`${b.http}/licenza/${casa}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
    ...altro,
  });

test("una casa Base col suo add-on nuovo: il telefono si chiude con 4402 premium-richiesto", async () => {
  const b = await banco();
  try {
    /* L'add-on nuovo dice la licenza gia' nella presentazione, anche vuota. */
    const casa = unaCasa(b.dove);
    await casa.entra({ gettone: "" });
    const telefono = unTelefono(b.dove, `/telefono/${casa.id}`);
    assert.deepEqual(await telefono.chiusa, {
      codice: PREMIUM_RICHIESTO.codice,
      motivo: PREMIUM_RICHIESTO.motivo,
    });
    assert.deepEqual(PREMIUM_RICHIESTO, { codice: 4402, motivo: "premium-richiesto" });
    /* Alla casa non e' arrivato nessun canale: il telefono non e' entrato. */
    assert.equal(casa.canali().length, 0);
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("una casa con l'add-on di prima, che la licenza non la dice mai: 4426 aggiorna-add-on", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    const telefono = unTelefono(b.dove, `/telefono/${casa.id}`);
    assert.deepEqual(await telefono.chiusa, {
      codice: ADDON_DA_AGGIORNARE.codice,
      motivo: ADDON_DA_AGGIORNARE.motivo,
    });
    assert.deepEqual(ADDON_DA_AGGIORNARE, { codice: 4426, motivo: "aggiorna-add-on" });
    assert.equal(casa.canali().length, 0);

    /* La casa si aggiorna e la licenza la dice: da li' il no e' quello di
     * Base, perche' adesso Premium si puo' comprare. */
    casa.manda({ t: "licenza", tipo: "licenza", gettone: "" });
    await attendi(() => b.centralino.collegate.get(casa.id)?.dicelaLicenza === true);
    const dopo = unTelefono(b.dove, `/telefono/${casa.id}`);
    assert.deepEqual(await dopo.chiusa, { codice: 4402, motivo: "premium-richiesto" });
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("la licenza detta nella presentazione vale da subito, anche vuota", async () => {
  /* Nessun millisecondo in cui una casa aggiornata sembri vecchia: il no
   * giusto arriva anche al telefono che bussa appena la casa e' entrata. */
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra({ gettone: "" });
    assert.equal(b.centralino.collegate.get(casa.id).dicelaLicenza, true);
    assert.equal(b.centralino.quantePronteAllaLicenza(), 1);
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("il gettone detto dalla casa apre la porta ai suoi telefoni", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    casa.manda({ t: "licenza", tipo: "licenza", gettone: unGettone({ sog: casa.id }) });
    await attendi(() => b.centralino.ePremium(casa.id));

    const telefono = unTelefono(b.dove, `/telefono/${casa.id}`);
    await telefono.aperta;
    await attendi(() => casa.canali().length === 1);
    assert.equal(casa.canali()[0].via, "telefono");
    telefono.chiudi();
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("il messaggio del contratto, con `tipo` e basta, si capisce lo stesso", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    casa.manda({ tipo: "licenza", gettone: unGettone({ sog: casa.id }) });
    await attendi(() => b.centralino.ePremium(casa.id));
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("il gettone puo' arrivare anche dentro la presentazione", async () => {
  const b = await banco();
  try {
    const id = unaCasaNuova();
    const casa = unaCasa(b.dove, { id });
    await casa.entra({ gettone: unGettone({ sog: id }) });
    assert.equal(b.centralino.ePremium(id), true);
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("un gettone storto non apre niente: di un'altra casa, scaduto, firmato da altri, gdanav", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    const storti = [
      unGettone({ sog: unaCasaNuova() }),
      unGettone({ sog: casa.id, fino: Date.now() - 1 }),
      unGettone({ sog: casa.id, scade: Date.now() - 1 }),
      unGettone({ sog: casa.id }, { firmatoDa: "estraneo" }),
      /* gdanav da solo non e' gdahome: da fuori casa non si entra. */
      unGettone({ sog: casa.id, app: "gdanav" }),
      "niente",
    ];
    for (const gettone of storti) {
      casa.manda({ t: "licenza", tipo: "licenza", gettone });
      casa.manda({ t: "battito" });
      await attendi(() => casa.detti.filter((uno) => uno.t === "battito").length > 0);
      casa.detti.length = 0;
      assert.equal(b.centralino.ePremium(casa.id), false);
    }
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("un gettone che scade chiude i telefoni gia' aperti al giro di controllo, ma non l'abbinamento", async () => {
  let ora = 0;
  const b = await banco({ adesso: () => ora });
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    casa.manda({
      t: "licenza",
      tipo: "licenza",
      gettone: unGettone({ sog: casa.id, fino: 1_000, emesso: 0 }, { adesso: 0 }),
    });
    await attendi(() => b.centralino.ePremium(casa.id));

    const daFuori = unTelefono(b.dove, "/telefono/"+casa.id);
    await daFuori.aperta;
    const codice = randomBytes(10).toString("hex");
    casa.manda({ t: "apri-abbinamento", impronta: impronta(codice) });
    await attendi(() => b.centralino.abbinamenti.size === 1);
    const siAbbina = unTelefono(b.dove, "/abbinamento/"+impronta(codice));
    await siAbbina.aperta;
    await attendi(() => casa.canali().length === 2);

    ora = 1_001;
    b.centralino._giroDiControllo();

    assert.deepEqual(await daFuori.chiusa, {
      codice: PREMIUM_RICHIESTO.codice,
      motivo: PREMIUM_RICHIESTO.motivo,
    });
    assert.equal(b.centralino.ePremium(casa.id), false);
    assert.equal(casa.chiusi().length, 1);
    assert.equal(siAbbina.presa.readyState, WebSocket.OPEN);

    siAbbina.chiudi();
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("la casa che non e' piu' Premium: escono i telefoni da fuori, non chi si abbina", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    casa.manda({ t: "licenza", tipo: "licenza", gettone: unGettone({ sog: casa.id }) });
    await attendi(() => b.centralino.ePremium(casa.id));

    const daFuori = unTelefono(b.dove, `/telefono/${casa.id}`);
    await daFuori.aperta;
    const codice = randomBytes(10).toString("hex");
    casa.manda({ t: "apri-abbinamento", impronta: impronta(codice) });
    await attendi(() => b.centralino.abbinamenti.size === 1);
    const siAbbina = unTelefono(b.dove, `/abbinamento/${impronta(codice)}`);
    await siAbbina.aperta;
    await attendi(() => casa.canali().length === 2);

    /* Il quadro non la rinnova piu': la casa lo dice con un gettone vuoto. */
    casa.manda({ t: "licenza", tipo: "licenza", gettone: "" });
    assert.deepEqual(await daFuori.chiusa, { codice: 4402, motivo: "premium-richiesto" });
    assert.equal(b.centralino.ePremium(casa.id), false);
    await attendi(() => casa.chiusi().length === 1);
    /* Quello che si abbina e' ancora li'. */
    assert.equal(siAbbina.presa.readyState, WebSocket.OPEN);
    siAbbina.chiudi();
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("l'abbinamento resta aperto anche a una casa Base", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    const codice = randomBytes(10).toString("hex");
    casa.manda({ t: "apri-abbinamento", impronta: impronta(codice) });
    await attendi(() => b.centralino.abbinamenti.size === 1);
    const telefono = unTelefono(b.dove, `/abbinamento/${impronta(codice)}`);
    await telefono.aperta;
    await attendi(() => casa.canali().length === 1);
    assert.equal(casa.canali()[0].via, "abbinamento");
    telefono.chiudi();
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("una casa che non c'e' resta «casa non collegata», Premium o no", async () => {
  const b = await banco();
  try {
    const telefono = unTelefono(b.dove, `/telefono/${unaCasaNuova()}`);
    const { codice, motivo } = await telefono.chiusa;
    assert.equal(codice, 1000);
    assert.equal(motivo, "casa non collegata");
  } finally {
    await b.spegni();
  }
});

test("con la chiave vuota il controllo e' spento: entrano tutti, come prima", async () => {
  const b = await banco({ chiaveLicenze: "" });
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    /* Un gettone detto a un centralino senza chiave non cambia niente. */
    casa.manda({ t: "licenza", tipo: "licenza", gettone: "" });
    const telefono = unTelefono(b.dove, `/telefono/${casa.id}`);
    await telefono.aperta;
    await attendi(() => casa.canali().length === 1);
    telefono.chiudi();
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

/* ─── La ricevuta di chi compra fuori casa ─────────────────────────────── */

test("la ricevuta di chi compra fuori casa arriva alla casa, e torna la sua risposta", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra({ gettone: "" });
    casa.rispondiAlleRicevute((detto) => ({
      stato: 200,
      corpo: { presa: detto.corpo, gdahome: { attiva: true } },
    }));
    const risposta = await portaLaRicevuta(b, casa.id);
    assert.equal(risposta.status, 200);
    const detto = await risposta.json();
    /* Alla casa arriva cosi' com'e': il centralino dentro non guarda. */
    assert.deepEqual(detto.presa, UNA_RICEVUTA);
    assert.equal(detto.gdahome.attiva, true);
    assert.equal(casa.ricevute().length, 1);
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("i no della casa tornano al telefono cosi' come sono", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra({ gettone: "" });
    casa.rispondiAlleRicevute(() => ({ stato: 402, corpo: { errore: "ricevuta-non-valida" } }));
    const risposta = await portaLaRicevuta(b, casa.id);
    assert.equal(risposta.status, 402);
    assert.deepEqual(await risposta.json(), { errore: "ricevuta-non-valida" });

    /* E una risposta storta non passa per buona. */
    casa.rispondiAlleRicevute(() => ({ stato: "boh", corpo: [1, 2] }));
    const storta = await portaLaRicevuta(b, casa.id);
    assert.equal(storta.status, 502);
    assert.deepEqual(await storta.json(), {});
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("a una casa con l'add-on di prima la ricevuta non si gira: 426 subito", async () => {
  const b = await banco();
  try {
    const casa = unaCasa(b.dove);
    await casa.entra();
    const risposta = await portaLaRicevuta(b, casa.id);
    assert.equal(risposta.status, 426);
    assert.deepEqual(await risposta.json(), { errore: "aggiorna-add-on" });
    assert.equal(casa.ricevute().length, 0, "alla casa non e' arrivato niente");
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});

test("a una casa che non c'e' la ricevuta resta al telefono: 503", async () => {
  const b = await banco();
  try {
    const risposta = await portaLaRicevuta(b, unaCasaNuova());
    assert.equal(risposta.status, 503);
    assert.deepEqual(await risposta.json(), { errore: "casa-non-collegata" });
  } finally {
    await b.spegni();
  }
});

test("una casa che non risponde, o che se ne va, non tiene il telefono appeso", async () => {
  const b = await banco({ attesaDellaRicevuta: 150 });
  try {
    const muta = unaCasa(b.dove);
    await muta.entra({ gettone: "" });
    const risposta = await portaLaRicevuta(b, muta.id);
    assert.equal(risposta.status, 504);
    assert.deepEqual(await risposta.json(), { errore: "la-casa-non-risponde" });
    muta.chiudi();
  } finally {
    await b.spegni();
  }
  const c = await banco();
  try {
    const casa = unaCasa(c.dove);
    await casa.entra({ gettone: "" });
    const inViaggio = portaLaRicevuta(c, casa.id);
    await attendi(() => casa.ricevute().length === 1);
    casa.chiudi();
    const risposta = await inViaggio;
    assert.equal(risposta.status, 503);
  } finally {
    await c.spegni();
  }
});

test("la porta delle ricevute: solo POST, solo JSON, non oltre 16 KB, e non all'infinito", async () => {
  const b = await banco({ freno: new Freno({ perChi: 4 }) });
  try {
    const casa = unaCasa(b.dove);
    await casa.entra({ gettone: "" });
    casa.rispondiAlleRicevute(() => ({ stato: 200, corpo: {} }));
    assert.equal((await fetch(`${b.http}/licenza/${casa.id}`)).status, 405);
    assert.equal((await portaLaRicevuta(b, "casa_corta")).status, 400);
    assert.equal((await portaLaRicevuta(b, casa.id, "non e' json")).status, 400);
    assert.equal((await portaLaRicevuta(b, casa.id, "[1,2]")).status, 400);
    const grande = await portaLaRicevuta(b, casa.id, {
      ...UNA_RICEVUTA,
      ricevuta: "x".repeat(17 * 1024),
    });
    assert.equal(grande.status, 413);
    assert.equal((await portaLaRicevuta(b, casa.id)).status, 200);
    /* Il freno conta quelle arrivate fin qui — non il GET e non la casa
     * storta, fermati prima — e oltre le quattro di un'ora si aspetta. */
    const troppe = await portaLaRicevuta(b, casa.id);
    assert.equal(troppe.status, 429);
    assert.ok(Number(troppe.headers.get("retry-after")) > 0);
    casa.chiudi();
  } finally {
    await b.spegni();
  }
});
