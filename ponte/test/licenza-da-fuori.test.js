/* Da fuori casa si entra con gdahome Premium: la catena intera.
 *
 * Il centralino e' quello vero di `../../centralino`, acceso con la chiave di
 * prova; il ponte e' questo, con le sue licenze e un quadro finto che firma
 * gettoni veri. Il telefono e' un WebSocket vero che bussa al centralino.
 *
 * Si provano le tre porte del contratto (`docs/LICENZE.md`):
 *
 *   - una casa Base: il telefono da fuori si chiude con `4402`
 *     `premium-richiesto`, e l'abbinamento resta aperto;
 *   - la casa diventa Premium: il gettone arriva al centralino da solo, e il
 *     telefono entra;
 *   - un centralino che non sa niente di licenze (chiave vuota, o vecchio):
 *     il ponte taglia da se', alla prima parola.
 *
 * E la console: la scheda «Licenza» legge lo stato e riscatta un codice, e il
 * tasto «Aggiungi» delle plance si sente dire 402.
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
  const serverDelCentralino = costruisciIlServer({ centralino });
  await new Promise((ok) => serverDelCentralino.listen(0, "127.0.0.1", ok));
  const doveIlCentralino = `ws://127.0.0.1:${serverDelCentralino.address().port}`;

  const { Casa } = await import("../src/casa.js");
  const casa = new Casa({ indirizzo: ha.indirizzo, segno: SEGNO_DELLA_CASA });
  const dispositivi = new Dispositivi({ cartella: nuovaCartella("ponte") });
  const ponte = new Ponte({ casa, dispositivi, registro: null });
  const abbinamento = new Abbinamento({});
  const identita = new Identita({ cartella: nuovaCartella("identita") });

  /* Il quadro finto: risponde il gettone che la prova ha deciso. */
  const quadro = { gettoni: {} };
  const licenze = new Licenze({
    casa: identita.casa,
    segreto: () => "segreto-della-casa-per-il-quadro-0123456789",
    chiave: PUBBLICA_DI_PROVA,
    dove: "https://quadro.prova",
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ gettoni: quadro.gettoni }) }),
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
  chiamata.avvia();
  await attendi(() => chiamata.dentro);

  return {
    centralino,
    doveIlCentralino,
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
    assert.equal(c.licenze.limitata, true);
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

test("un centralino che non guarda le licenze: taglia il ponte, alla prima parola", async () => {
  /* Chiave vuota al centralino — com'e' un centralino di ieri — e casa Base:
   * il telefono passa il centralino, e si ferma al portiere con un no che
   * l'app sa leggere. */
  const c = await catena({ chiaveDelCentralino: "" });
  try {
    const { telefono } = daFuori(c);
    await assert.rejects(telefono.dentro);
    const no = telefono.inChiaro.find((uno) => uno.no);
    assert.equal(no.motivo, "premium-richiesto");
    assert.equal(c.chiamata.dentro, true);

    /* Premium: passa. */
    await c.diventaPremium();
    const secondo = daFuori(c);
    await secondo.telefono.dentro;
    secondo.telefono.chiudi();
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

test("la console: lo stato della licenza, il codice regalo, e la plancia in piu' che costa", async () => {
  const c = await catena();
  const console_ = await laConsole(c);
  try {
    const prima = await console_.chiedi("/api/licenza");
    assert.equal(prima.stato, 200);
    assert.equal(prima.detto.attive, true);
    assert.equal(prima.detto.gdahome.attiva, false);
    assert.equal("gettoni" in prima.detto, false, "i gettoni alla pagina non servono");

    const plance = await console_.chiedi("/api/plance");
    assert.equal(plance.detto.limitata, true);
    const aggiunta = await console_.chiedi("/api/plance", {
      method: "POST",
      body: JSON.stringify({ titolo: "Mare" }),
    });
    assert.equal(aggiunta.stato, 402);
    assert.equal(aggiunta.detto.errore, "premium-richiesto");

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

    const dopo = await console_.chiedi("/api/plance", {
      method: "POST",
      body: JSON.stringify({ titolo: "Mare" }),
    });
    assert.equal(dopo.stato, 201);
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
  } finally {
    await console_.chiudi();
    await c.spegni();
  }
});
