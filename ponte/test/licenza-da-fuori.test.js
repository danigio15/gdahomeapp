/* Da fuori casa si entra con gdahome Premium: la catena intera.
 *
 * Il centralino e' quello vero di `../../centralino`, acceso con la chiave di
 * prova; il ponte e' questo, con le sue licenze e un quadro finto che firma
 * gettoni veri. Il telefono e' un WebSocket vero che bussa al centralino.
 *
 * Si provano le porte del contratto (`docs/LICENZE.md`):
 *
 *   - una casa Base: il telefono da fuori si chiude con `4402`
 *     `premium-richiesto`, e l'abbinamento resta aperto;
 *   - la casa diventa Premium: il gettone arriva al centralino da solo, e il
 *     telefono entra;
 *   - un centralino che non sa niente di licenze (chiave vuota, o vecchio):
 *     la casa non taglia niente — il fuori casa lo chiude solo il centralino;
 *   - chi compra fuori casa: la ricevuta firmata dal telefono passa dal
 *     centralino alla casa, la casa diventa Premium, e il telefono entra.
 *
 * E la console: la scheda «Licenza» legge lo stato e riscatta un codice, e le
 * plance non si limitano: i lucchetti di Base sono dell'app e del browser.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { Case } from "../../centralino/src/case.js";
import { Centralino } from "../../centralino/src/centralino.js";
import { Ricevute } from "../../centralino/src/ricevute.js";
import { costruisciIlServer } from "../../centralino/src/server.js";

import { Abbinamento } from "../src/abbinamento.js";
import { Chiamata } from "../src/chiamata.js";
import { Dispositivi } from "../src/dispositivi.js";
import { Identita } from "../src/identita.js";
import { Licenze } from "../src/licenze.js";
import { Plance } from "../src/plance.js";
import { Ponte } from "../src/ponte.js";
import { Portiere } from "../src/portiere.js";
import { accetta } from "../src/presa.js";
import { firmaDelRegalo, firmaDellaRicevuta, laRicevutaDaFuori } from "../src/ricevuta-da-fuori.js";
import { costruisciLaConsole } from "../src/server.js";
import { telefonoCifrato } from "./telefono-cifrato.js";
import { PUBBLICA_DI_PROVA, unGettone } from "./gettoni-di-prova.js";

const impronta = (cosa) => createHash("sha256").update(cosa).digest("hex");
const SEGNO_DELLA_CASA = "segno-finto-del-supervisor";
const ZITTO = { debug() {}, info() {}, attenzione() {}, errore() {} };

async function attendi(condizione, entro = 5000) {
  const fine = Date.now() + entro;
  while (Date.now() < fine) {
    if (await condizione()) return;
    await new Promise((ok) => setTimeout(ok, 15));
  }
  throw new Error("non e' successo in tempo");
}

async function homeAssistantFinta() {
  const prese = [];
  const server = createServer((_r, risposta) => {
    risposta.writeHead(200, { "content-type": "application/json" });
    risposta.end('{"message":"API running."}');
  });
  server.on("upgrade", (richiesta, socket) => {
    const presa = accetta(richiesta, socket, {
      onMessaggio: (testo) => {
        const detto = JSON.parse(testo);
        if (detto.type === "auth") {
          presa.manda(JSON.stringify({ type: "auth_ok" }));
          return;
        }
        presa.manda(JSON.stringify({ id: detto.id, type: "result", success: true, result: [] }));
      },
    });
    if (!presa) return;
    prese.push(presa);
    presa.manda(JSON.stringify({ type: "auth_required" }));
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    indirizzo: `http://127.0.0.1:${server.address().port}`,
    spegni: async () => {
      for (const presa of prese) presa.chiudi();
      await new Promise((ok) => server.close(ok));
    },
  };
}

/* La catena, montata come la monta `index.js`: le licenze dicono al portiere
 * se tagliare, e alla chiamata cosa dire al centralino. */
async function catena({ chiaveDelCentralino = PUBBLICA_DI_PROVA } = {}) {
  const cartelle = [];
  const nuovaCartella = (nome) => {
    const dove = mkdtempSync(join(tmpdir(), `${nome}-`));
    cartelle.push(dove);
    return dove;
  };
  const ha = await homeAssistantFinta();

  const centralino = new Centralino({
    case: new Case({ cartella: nuovaCartella("case") }),
    chiaveLicenze: chiaveDelCentralino,
  });
  const serverDelCentralino = costruisciIlServer({
    centralino,
    ricevute: new Ricevute({ centralino }),
  });
  await new Promise((ok) => serverDelCentralino.listen(0, "127.0.0.1", ok));
  const doveIlCentralino = `ws://127.0.0.1:${serverDelCentralino.address().port}`;
  const httpDelCentralino = `http://127.0.0.1:${serverDelCentralino.address().port}`;

  const { Casa } = await import("../src/casa.js");
  const casa = new Casa({ indirizzo: ha.indirizzo, segno: SEGNO_DELLA_CASA });
  const dispositivi = new Dispositivi({ cartella: nuovaCartella("ponte") });
  const ponte = new Ponte({ casa, dispositivi, registro: null });
  const abbinamento = new Abbinamento({});
  const identita = new Identita({ cartella: nuovaCartella("identita") });

  /* Il quadro finto: risponde il gettone che la prova ha deciso, e una
   * ricevuta del negozio la prende per buona e fa la casa Premium. Un codice
   * regalo lo prende per buono una volta sola, come quello vero. */
  const quadro = { gettoni: {}, ricevute: [], regali: [] };
  const licenze = new Licenze({
    casa: identita.casa,
    segreto: () => "segreto-della-casa-per-il-quadro-0123456789",
    chiave: PUBBLICA_DI_PROVA,
    dove: "https://quadro.prova",
    fetch: async (dove, opzioni) => {
      if (dove.endsWith("/v1/licenze/negozio")) {
        quadro.ricevute.push(JSON.parse(opzioni.body));
        quadro.gettoni = { gdahome: unGettone({ sog: identita.casa, origine: "negozio" }) };
      }
      if (dove.endsWith("/v1/licenze/riscatta")) {
        const { codice } = JSON.parse(opzioni.body);
        if (quadro.regali.includes(codice)) {
          return { ok: false, status: 409, json: async () => ({ errore: "codice-gia-usato" }) };
        }
        quadro.regali.push(codice);
        quadro.gettoni = { gdahome: unGettone({ sog: identita.casa, origine: "regalo" }) };
      }
      return { ok: true, status: 200, json: async () => ({ gettoni: quadro.gettoni }) };
    },
    registro: ZITTO,
  });
  const cartellaDellePlance = nuovaCartella("plance");
  const plance = new Plance({
    cartella: cartellaDellePlance,
    registro: ZITTO,
    limitata: () => licenze.limitata,
  });

  const portiere = new Portiere({
    ponte,
    dispositivi,
    abbinamento,
    registro: null,
    soloInCasa: () => licenze.limitata,
  });
  const chiamata = new Chiamata({ dove: doveIlCentralino, identita, portiere, attesaMassima: 200 });
  portiere.chiamata = chiamata;
  chiamata.diLaLicenza(licenze.gettonePerIlCentralino);
  licenze.on("cambio", () => chiamata.diLaLicenza(licenze.gettonePerIlCentralino));
  chiamata.alRicevere = (corpo) =>
    laRicevutaDaFuori(corpo, { casa: identita.casa, dispositivi, licenze });
  chiamata.avvia();
  await attendi(() => chiamata.dentro);

  return {
    centralino,
    doveIlCentralino,
    httpDelCentralino,
    casa,
    ponte,
    dispositivi,
    abbinamento,
    identita,
    licenze,
    plance,
    chiamata,
    quadro,
    diventaPremium: async () => {
      quadro.gettoni = { gdahome: unGettone({ sog: identita.casa }) };
      await licenze.rinnova();
    },
    spegni: async () => {
      chiamata.spegni();
      ponte.chiudiTutto();
      centralino.chiudiTutto();
      await new Promise((ok) => serverDelCentralino.close(ok));
      await ha.spegni();
      for (const dove of cartelle) rmSync(dove, { recursive: true, force: true });
    },
  };
}

/* Un telefono abbinato che bussa da fuori, e come si e' chiuso. */
function daFuori(c) {
  const { chiave, dispositivo } = c.dispositivi.abbina({ nome: "telefono di fuori" });
  const telefono = telefonoCifrato(`${c.doveIlCentralino}/telefono/${c.identita.casa}`, {
    chi: dispositivo.id,
    chiave,
  });
  const chiusura = new Promise((ok) =>
    telefono.presa.addEventListener("close", (evento) =>
      ok({ codice: evento.code, motivo: evento.reason }),
    ),
  );
  telefono.dentro.catch(() => {});
  return { telefono, chiusura };
}

test("una casa Base: il telefono da fuori si chiude con 4402 premium-richiesto", async () => {
  const c = await catena();
  try {
    assert.equal(c.licenze.premium, false);
    const { chiusura } = daFuori(c);
    assert.deepEqual(await chiusura, { codice: 4402, motivo: "premium-richiesto" });
    /* Il filo della casa resta su: e' da li' che passa l'abbinamento. */
    assert.equal(c.chiamata.dentro, true);
  } finally {
    await c.spegni();
  }
});

test("una casa Base si abbina da fuori lo stesso", async () => {
  const c = await catena();
  try {
    const { codice } = c.abbinamento.nuovo();
    c.chiamata.apriLAbbinamento(impronta(codice));
    await attendi(() => c.centralino.abbinamenti.size === 1);
    const telefono = telefonoCifrato(`${c.doveIlCentralino}/abbinamento/${impronta(codice)}`, {
      codice,
    });
    await telefono.dentro;
    telefono.conferma({ nome: "iPhone di Anna", sistema: "ios" });
    const ecco = await telefono.aspetta("ecco");
    assert.match(ecco.segno, /^[0-9a-f]{64}$/);
    telefono.chiudi();
  } finally {
    await c.spegni();
  }
});

test("la casa diventa Premium: il gettone arriva al centralino, e il telefono entra", async () => {
  const c = await catena();
  try {
    assert.equal(c.centralino.ePremium(c.identita.casa), false);
    await c.diventaPremium();
    assert.equal(c.licenze.premium, true);
    await attendi(() => c.centralino.ePremium(c.identita.casa));

    const { telefono } = daFuori(c);
    await telefono.dentro;
    assert.equal((await telefono.aspetta("auth_required")).type, "auth_required");
    telefono.chiudi();
  } finally {
    await c.spegni();
  }
});

test("il gettone si ridice a ogni rientro: un centralino riavviato non se lo scorda", async () => {
  const c = await catena();
  try {
    await c.diventaPremium();
    await attendi(() => c.centralino.ePremium(c.identita.casa));
    /* Il centralino dimentica tutto (un riavvio), e la casa ricade e rientra. */
    c.centralino.premiumFino.clear();
    c.centralino.collegate.get(c.identita.casa).chiudi("prova");
    await attendi(() => !c.chiamata.dentro);
    await attendi(() => c.chiamata.dentro, 8000);
    await attendi(() => c.centralino.ePremium(c.identita.casa));
  } finally {
    await c.spegni();
  }
});

test("un centralino che non guarda le licenze: la casa Base non taglia niente", async () => {
  /* Chiave vuota al centralino — com'e' un centralino di ieri — e casa Base:
   * il telefono passa il centralino e passa anche il portiere. Il fuori casa
   * lo chiude il centralino e basta: la casa non limita niente, e i lucchetti
   * di Base li mette l'app. */
  const c = await catena({ chiaveDelCentralino: "" });
  try {
    assert.equal(c.licenze.premium, false);
    const { telefono } = daFuori(c);
    await telefono.dentro;
    assert.equal((await telefono.aspetta("auth_required")).type, "auth_required");
    assert.equal(
      telefono.inChiaro.some((uno) => uno.no),
      false,
      "nessun no della casa",
    );
    telefono.chiudi();
  } finally {
    await c.spegni();
  }
});

/* ─── Chi compra fuori casa ──────────────────────────────────────────────── */

/* La ricevuta come la manda l'app: firmata con la chiave del filo. */
function unaRicevuta(c, { chi, chiave }, altro = {}) {
  const campi = {
    chi,
    quando: Date.now(),
    app: "gdahome",
    piattaforma: "ios",
    prodotto: "gdahome_premium_mensile",
    ricevuta: "2000000123456789",
    ...altro,
  };
  return {
    v: 1,
    ...campi,
    firma: firmaDellaRicevuta({ chiaveDelFilo: chiave, casa: c.identita.casa, ...campi }),
  };
}

const portaLaRicevuta = (c, corpo) =>
  fetch(`${c.httpDelCentralino}/licenza/${c.identita.casa}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });

test("chi compra fuori casa: la ricevuta passa dal centralino, la casa diventa Premium, e il telefono entra", async () => {
  const c = await catena();
  try {
    /* Fuori casa, con la casa Base: il telefono resta fuori. */
    const { chiave, dispositivo } = c.dispositivi.abbina({ nome: "iPhone di chi compra" });
    const prima = telefonoCifrato(`${c.doveIlCentralino}/telefono/${c.identita.casa}`, {
      chi: dispositivo.id,
      chiave,
    });
    prima.dentro.catch(() => {});
    const chiusa = new Promise((ok) =>
      prima.presa.addEventListener("close", (evento) => ok(evento.code)),
    );
    assert.equal(await chiusa, 4402);

    /* Compra, e la ricevuta la consegna al centralino. */
    const risposta = await portaLaRicevuta(c, unaRicevuta(c, { chi: dispositivo.id, chiave }));
    assert.equal(risposta.status, 200);
    const detto = await risposta.json();
    assert.equal(detto.gdahome.attiva, true);
    assert.equal(typeof detto.gettoni.gdahome, "string");
    assert.equal(c.quadro.ricevute.length, 1);
    assert.equal(c.quadro.ricevute[0].ricevuta, "2000000123456789");
    assert.equal(c.licenze.premium, true);
    await attendi(() => c.centralino.ePremium(c.identita.casa));

    /* E adesso entra. */
    const dopo = telefonoCifrato(`${c.doveIlCentralino}/telefono/${c.identita.casa}`, {
      chi: dispositivo.id,
      chiave,
    });
    await dopo.dentro;
    assert.equal((await dopo.aspetta("auth_required")).type, "auth_required");
    dopo.chiudi();
  } finally {
    await c.spegni();
  }
});

test("una ricevuta che non ha firmato un telefono della casa non arriva al quadro", async () => {
  const c = await catena();
  try {
    const { chiave, dispositivo } = c.dispositivi.abbina({ nome: "un telefono" });
    /* Firmata con un'altra chiave: chi bussa non e' un telefono di qui. */
    const storta = unaRicevuta(c, { chi: dispositivo.id, chiave: "ab".repeat(32) });
    const risposta = await portaLaRicevuta(c, storta);
    assert.equal(risposta.status, 403);
    assert.deepEqual(await risposta.json(), { errore: "firma-sbagliata" });
    /* E un telefono che la casa ha staccato non passa piu'. */
    const buona = unaRicevuta(c, { chi: dispositivo.id, chiave });
    c.dispositivi.stacca(dispositivo.id);
    const staccato = await portaLaRicevuta(c, buona);
    assert.equal(staccato.status, 403);
    assert.equal(c.quadro.ricevute.length, 0);
    assert.equal(c.centralino.ePremium(c.identita.casa), false);
  } finally {
    await c.spegni();
  }
});

/* Un codice regalo portato da fuori: lo stesso giro, con `regalo` al posto
 * della ricevuta e la firma sua. */
function unRegalo(c, { chi, chiave }, regalo = "GDA-ABCD-EFGH-JKMN") {
  const quando = Date.now();
  return {
    v: 1,
    chi,
    quando,
    regalo,
    firma: firmaDelRegalo({ chiaveDelFilo: chiave, casa: c.identita.casa, chi, quando, regalo }),
  };
}

test("chi ha un codice regalo fuori casa: passa dal centralino, la casa diventa Premium, e il telefono entra", async () => {
  /* «Ho provato a generare un codice ma non funziona»: da fuori, con la casa
   * Base, il filo non c'e', e il regalo si fermava li'. */
  const c = await catena();
  try {
    const { chiave, dispositivo } = c.dispositivi.abbina({ nome: "Android di chi ha il regalo" });
    const risposta = await portaLaRicevuta(c, unRegalo(c, { chi: dispositivo.id, chiave }));
    assert.equal(risposta.status, 200);
    const detto = await risposta.json();
    assert.equal(detto.gdahome.attiva, true);
    assert.equal(detto.gdahome.origine, "regalo");
    assert.equal(typeof detto.gettoni.gdahome, "string");
    assert.deepEqual(c.quadro.regali, ["GDA-ABCD-EFGH-JKMN"]);
    assert.equal(c.quadro.ricevute.length, 0, "non e' una ricevuta");
    await attendi(() => c.centralino.ePremium(c.identita.casa));

    const dopo = telefonoCifrato(`${c.doveIlCentralino}/telefono/${c.identita.casa}`, {
      chi: dispositivo.id,
      chiave,
    });
    await dopo.dentro;
    assert.equal((await dopo.aspetta("auth_required")).type, "auth_required");
    dopo.chiudi();

    /* Lo stesso codice un'altra volta: il quadro dice che e' gia' usato, e
     * da fuori si sente dire lo stesso. */
    const ancora = await portaLaRicevuta(c, unRegalo(c, { chi: dispositivo.id, chiave }));
    assert.equal(ancora.status, 409);
    assert.deepEqual(await ancora.json(), { errore: "codice-gia-usato" });
  } finally {
    await c.spegni();
  }
});

test("un codice regalo che non ha firmato un telefono della casa non arriva al quadro", async () => {
  const c = await catena();
  try {
    const { chiave, dispositivo } = c.dispositivi.abbina({ nome: "un telefono" });
    /* Firmato con un'altra chiave. */
    const storto = await portaLaRicevuta(
      c,
      unRegalo(c, { chi: dispositivo.id, chiave: "ab".repeat(32) }),
    );
    assert.equal(storto.status, 403);
    assert.deepEqual(await storto.json(), { errore: "firma-sbagliata" });
    /* Con la firma di una ricevuta: le etichette sono due apposta. */
    const giusto = unRegalo(c, { chi: dispositivo.id, chiave });
    const conLaFirmaSbagliata = {
      ...giusto,
      firma: firmaDellaRicevuta({
        chiaveDelFilo: chiave,
        casa: c.identita.casa,
        chi: dispositivo.id,
        quando: giusto.quando,
        app: "gdahome",
        piattaforma: "android",
        prodotto: "gdahome_premium",
        ricevuta: giusto.regalo,
      }),
    };
    assert.equal((await portaLaRicevuta(c, conLaFirmaSbagliata)).status, 403);
    /* Vecchio di un'ora: non vale. */
    const vecchio = { ...giusto, quando: giusto.quando - 60 * 60 * 1000 };
    vecchio.firma = firmaDelRegalo({
      chiaveDelFilo: chiave,
      casa: c.identita.casa,
      chi: dispositivo.id,
      quando: vecchio.quando,
      regalo: vecchio.regalo,
    });
    assert.equal((await portaLaRicevuta(c, vecchio)).status, 403);
    /* Storto: niente codice, o un codice che non e' testo. */
    assert.equal((await portaLaRicevuta(c, { ...giusto, regalo: 42 })).status, 400);
    assert.deepEqual(c.quadro.regali, []);
    assert.equal(c.centralino.ePremium(c.identita.casa), false);
  } finally {
    await c.spegni();
  }
});

/* ─── La console ─────────────────────────────────────────────────────────── */

async function laConsole(c) {
  const console_ = costruisciLaConsole({
    ponte: c.ponte,
    casa: c.casa,
    dispositivi: c.dispositivi,
    abbinamento: c.abbinamento,
    opzioni: { portaDellApp: 8098, dispositiviMassimi: 10 },
    registro: null,
    chiamata: c.chiamata,
    identita: c.identita,
    plance: c.plance,
    licenze: c.licenze,
    cartellaDellaConsole: fileURLToPath(new URL("../console", import.meta.url)),
    proxyDellIngress: ["127.0.0.1"],
    utenti: { amministratore: async (chi) => chi === "chi-amministra" },
  });
  await new Promise((ok) => console_.listen(0, "127.0.0.1", ok));
  const dove = `http://127.0.0.1:${console_.address().port}`;
  const chiedi = async (via, opzioni = {}) => {
    const risposta = await fetch(`${dove}${via}`, {
      ...opzioni,
      headers: { "x-remote-user-id": "chi-amministra", "content-type": "application/json" },
    });
    return { stato: risposta.status, detto: await risposta.json() };
  };
  return { chiedi, chiudi: () => new Promise((ok) => console_.close(ok)) };
}

test("la console: lo stato della licenza e il codice regalo; le plance non si limitano", async () => {
  const c = await catena();
  const console_ = await laConsole(c);
  try {
    const prima = await console_.chiedi("/api/licenza");
    assert.equal(prima.stato, 200);
    assert.equal(prima.detto.attive, true);
    assert.equal(prima.detto.gdahome.attiva, false);
    assert.equal("gettoni" in prima.detto, false, "i gettoni alla pagina non servono");

    /* Base, e in Home Assistant le plance si aggiungono lo stesso: la casa
     * non limita niente. La plancia sola di Base e' dell'app e del browser. */
    const plance = await console_.chiedi("/api/plance");
    assert.equal(plance.detto.limitata, false);
    const aggiunta = await console_.chiedi("/api/plance", {
      method: "POST",
      body: JSON.stringify({ titolo: "Mare" }),
    });
    assert.equal(aggiunta.stato, 201);

    /* Un codice storto non va nemmeno al quadro. */
    const storto = await console_.chiedi("/api/licenza/riscatta", {
      method: "POST",
      body: JSON.stringify({ codice: "ciao" }),
    });
    assert.equal(storto.stato, 400);
    assert.equal(storto.detto.errore, "codice-storto");

    c.quadro.gettoni = { gdahome: unGettone({ sog: c.identita.casa, origine: "regalo" }) };
    const riscatto = await console_.chiedi("/api/licenza/riscatta", {
      method: "POST",
      body: JSON.stringify({ codice: "gda-abcd-efgh-jkmn" }),
    });
    assert.equal(riscatto.stato, 200);
    assert.equal(riscatto.detto.gdahome.attiva, true);
    assert.equal(riscatto.detto.gdahome.origine, "regalo");
  } finally {
    await console_.chiudi();
    await c.spegni();
  }
});

test("la console: «Ricontrolla adesso» fa vedere subito un regalo fatto dalla Gestione", async () => {
  const c = await catena();
  const console_ = await laConsole(c);
  try {
    let bussate = 0;
    const prendi = c.licenze.prendi;
    c.licenze.prendi = (dove, opzioni) => {
      if (dove.endsWith("/v1/licenze/casa")) bussate += 1;
      return prendi(dove, opzioni);
    };
    /* Il regalo nasce nella Gestione: il quadro lo sa, la casa non ancora. */
    c.quadro.gettoni = { gdahome: unGettone({ sog: c.identita.casa, origine: "regalo" }) };
    assert.equal((await console_.chiedi("/api/licenza")).detto.gdahome.attiva, false);

    const dopo = await console_.chiedi("/api/licenza/ricontrolla", { method: "POST" });
    assert.equal(dopo.stato, 200);
    assert.equal(dopo.detto.gdahome.attiva, true);
    assert.equal(dopo.detto.gdahome.origine, "regalo");
    assert.equal(dopo.detto.gdahome.scade, null, "per sempre");
    assert.equal(dopo.detto.ultima.andata, true);
    assert.equal("gettoni" in dopo.detto, false, "i gettoni alla pagina non servono");
    assert.equal(bussate, 1);

    /* Premuto di nuovo subito: la risposta e' la stessa, e al quadro non si
     * bussa un'altra volta. */
    const ancora = await console_.chiedi("/api/licenza/ricontrolla", { method: "POST" });
    assert.equal(ancora.stato, 200);
    assert.equal(ancora.detto.gdahome.origine, "regalo");
    assert.equal(bussate, 1);
  } finally {
    await console_.chiudi();
    await c.spegni();
  }
});

test("la console senza licenze: la scheda non c'e', e le plance sono quelle di sempre", async () => {
  const c = await catena();
  c.licenze.chiave = "";
  const console_ = await laConsole(c);
  try {
    assert.deepEqual((await console_.chiedi("/api/licenza")).detto.attive, false);
    const plance = await console_.chiedi("/api/plance");
    assert.equal(plance.detto.limitata, false);
    const aggiunta = await console_.chiedi("/api/plance", {
      method: "POST",
      body: JSON.stringify({ titolo: "Mare" }),
    });
    assert.equal(aggiunta.stato, 201);
    const riscatto = await console_.chiedi("/api/licenza/riscatta", {
      method: "POST",
      body: JSON.stringify({ codice: "GDA-ABCD-EFGH-JKMN" }),
    });
    assert.equal(riscatto.stato, 409);
    const ricontrolla = await console_.chiedi("/api/licenza/ricontrolla", { method: "POST" });
    assert.equal(ricontrolla.stato, 409);
    assert.equal(ricontrolla.detto.errore, "licenze-spente");
  } finally {
    await console_.chiudi();
    await c.spegni();
  }
});
