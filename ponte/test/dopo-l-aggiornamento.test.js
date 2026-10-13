/* Dopo un aggiornamento dell'add-on la casa e' la stessa casa.
 *
 * «Quando aggiorno l'add-on puntualmente devo cancellare la casa sull'app e
 * ricollegarmi.» Un aggiornamento, per il ponte, e' un processo che si spegne
 * e uno nuovo che si accende con la stessa `/data`. Qui lo si fa davvero: la
 * catena intera — il centralino vero, che impone le licenze con la chiave di
 * prova, e il ponte coi suoi pezzi montati come in `index.js` — si spegne e
 * si riaccende sulle stesse cartelle, e si guarda tutto quello su cui il
 * telefono abbinato conta:
 *
 *   - chi e' la casa per il centralino (identificativo e segreto);
 *   - la chiave del filo del telefono, che il ponte tiene in `dispositivi`;
 *   - il gettone gdahome, che il ponte tiene in `licenze.json` e che dice al
 *     centralino gia' nella presentazione, prima di sentire il quadro;
 *   - il legame della stretta di mano (`lega`), che il ponte nuovo ripete
 *     come quello di prima.
 *
 * E il telefono abbinato prima rientra da fuori, legato, senza riabbinarsi,
 * e la licenza che gli si dice e' ancora Premium — anche con il quadro che
 * all'accensione non risponde.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Case } from "../../centralino/src/case.js";
import { Centralino } from "../../centralino/src/centralino.js";
import { Ricevute } from "../../centralino/src/ricevute.js";
import { costruisciIlServer } from "../../centralino/src/server.js";

import { Abbinamento } from "../src/abbinamento.js";
import { Chiamata } from "../src/chiamata.js";
import { Commissioni } from "../src/commissioni.js";
import { Dispositivi } from "../src/dispositivi.js";
import { Identita } from "../src/identita.js";
import { Licenze } from "../src/licenze.js";
import { Ponte } from "../src/ponte.js";
import { Portiere } from "../src/portiere.js";
import { accetta } from "../src/presa.js";
import { telefonoCifrato } from "./telefono-cifrato.js";
import { PUBBLICA_DI_PROVA, unGettone } from "./gettoni-di-prova.js";

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

/* Il centralino vero, che impone le licenze: un telefono da fuori entra solo
 * se la casa gli ha detto un gettone buono. */
async function unCentralino() {
  const cartella = mkdtempSync(join(tmpdir(), "case-"));
  const centralino = new Centralino({
    case: new Case({ cartella }),
    chiaveLicenze: PUBBLICA_DI_PROVA,
  });
  const server = costruisciIlServer({ centralino, ricevute: new Ricevute({ centralino }) });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    centralino,
    cartella,
    dove: `ws://127.0.0.1:${server.address().port}`,
    spegni: async () => {
      centralino.chiudiTutto();
      await new Promise((ok) => server.close(ok));
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

/* Il ponte, montato come in `index.js`, sulla sua `/data`. `quadro` decide
 * cosa risponde il quadro delle licenze: di serie non risponde affatto, come
 * un quadro irraggiungibile all'accensione. */
async function unPonte({ data, centralino, ha, quadro = null }) {
  const { Casa } = await import("../src/casa.js");
  const casa = new Casa({ indirizzo: ha.indirizzo, segno: SEGNO_DELLA_CASA });
  const identita = new Identita({ cartella: data });
  const dispositivi = new Dispositivi({ cartella: data });
  const licenze = new Licenze({
    casa: identita.casa,
    cartella: data,
    segreto: () => "segreto-della-casa-per-il-quadro-0123456789",
    chiave: PUBBLICA_DI_PROVA,
    dove: "https://quadro.prova",
    fetch: async () => {
      if (!quadro) throw new Error("ECONNREFUSED");
      return { ok: true, status: 200, json: async () => ({ gettoni: quadro() }) };
    },
    registro: ZITTO,
  });
  const commissioni = new Commissioni({ casa, licenze, registro: ZITTO });
  const ponte = new Ponte({ casa, dispositivi, registro: null, commissioni });
  const portiere = new Portiere({
    ponte,
    dispositivi,
    abbinamento: new Abbinamento({}),
    registro: null,
    soloInCasa: () => licenze.limitata,
  });
  const chiamata = new Chiamata({ dove: centralino.dove, identita, portiere, attesaMassima: 200 });
  portiere.chiamata = chiamata;
  /* L'ordine di `index.js`: il gettone di `/data` alla chiamata, e poi il
   * quadro. */
  chiamata.diLaLicenza(licenze.gettonePerIlCentralino);
  licenze.on("cambio", () => chiamata.diLaLicenza(licenze.gettonePerIlCentralino));
  chiamata.avvia();
  licenze.parti();
  await attendi(() => chiamata.dentro);
  return {
    identita,
    dispositivi,
    licenze,
    chiamata,
    /* Come `abbassa` in `index.js`. */
    abbassa: () => {
      chiamata.spegni();
      licenze.ferma();
      ponte.chiudiTutto();
    },
  };
}

/* Un telefono abbinato che bussa da fuori, con l'app di adesso (legata). */
function daFuori(centralino, casa, { chi, chiave }) {
  const telefono = telefonoCifrato(`${centralino.dove}/telefono/${casa}`, {
    chi,
    chiave,
    lega: true,
  });
  const chiusura = new Promise((ok) =>
    telefono.presa.addEventListener("close", (evento) =>
      ok({ codice: evento.code, motivo: evento.reason }),
    ),
  );
  telefono.dentro.catch(() => {});
  return { telefono, chiusura };
}

async function entraEChiedeLaLicenza(telefono, segno) {
  await telefono.dentro;
  await telefono.aspetta("auth_required");
  telefono.manda({ type: "auth", access_token: segno });
  await telefono.aspetta("auth_ok");
  telefono.manda({ id: 7, type: "ponte/licenza/stato" });
  return telefono.aspetta((uno) => uno.id === 7);
}

test("dopo un aggiornamento la casa e' la stessa: il telefono abbinato rientra da fuori, Premium, senza riabbinarsi", async () => {
  const data = mkdtempSync(join(tmpdir(), "data-"));
  const ha = await homeAssistantFinta();
  const centralino = await unCentralino();
  let gettone = "";
  try {
    /* ─── Prima dell'aggiornamento ─── */
    /* Il quadro risponde il gettone che c'e': all'accensione nessuno, poi
     * un regalo per sempre, come quello della casa che si e' lamentata. */
    const prima = await unPonte({
      data,
      centralino,
      ha,
      quadro: () => (gettone ? { gdahome: gettone } : {}),
    });
    gettone = unGettone({ sog: prima.identita.casa, origine: "regalo", scade: null });
    await prima.licenze.rinnova();
    assert.equal(prima.licenze.premium, true);
    await attendi(() => centralino.centralino.ePremium(prima.identita.casa));

    const { chiave, segno, dispositivo } = prima.dispositivi.abbina({ nome: "iPhone" });
    const casa = prima.identita.casa;
    const segretoDiPrima = prima.identita.segreto;

    const uno = daFuori(centralino, casa, { chi: dispositivo.id, chiave });
    const licenzaDiPrima = await entraEChiedeLaLicenza(uno.telefono, segno);
    assert.equal(uno.telefono.legata, true);
    assert.equal(licenzaDiPrima.result.gdahome.attiva, true);

    /* ─── L'aggiornamento: il processo vecchio se ne va ─── */
    prima.abbassa();
    const comeSiEChiuso = await uno.chiusura;
    assert.notEqual(comeSiEChiuso.codice, 4402, "un aggiornamento non e' un no del Premium");
    await attendi(() => !centralino.centralino.collegate.has(casa));

    /* Quello che resta su `/data` e' tutto quello che serve. */
    const scritto = JSON.parse(readFileSync(join(data, "licenze.json"), "utf8"));
    assert.equal(scritto.gettoni.gdahome, gettone);

    /* ─── Il processo nuovo, con lo stesso `/data` e il quadro che tace ─── */
    const dopo = await unPonte({ data, centralino, ha, quadro: null });
    try {
      assert.equal(dopo.identita.casa, casa, "l'identificativo della casa non cambia");
      assert.equal(dopo.identita.segreto, segretoDiPrima, "il segreto della casa non cambia");
      assert.equal(dopo.dispositivi.chiaveDi(dispositivo.id), chiave, "la chiave del filo resta");
      assert.equal(dopo.licenze.premium, true, "Premium, prima ancora di sentire il quadro");
      assert.equal(dopo.licenze.gettonePerIlCentralino, gettone);
      await attendi(() => centralino.centralino.ePremium(casa));

      /* Il telefono di prima rientra da fuori come prima: legato, e la
       * licenza e' ancora quella. */
      const due = daFuori(centralino, casa, { chi: dispositivo.id, chiave });
      const licenzaDopo = await entraEChiedeLaLicenza(due.telefono, segno);
      assert.equal(due.telefono.legata, true, "il ponte nuovo ripete il legame");
      assert.equal(licenzaDopo.result.gdahome.attiva, true);
      assert.equal(licenzaDopo.result.gettoni.gdahome, gettone);
      due.telefono.chiudi();
    } finally {
      dopo.abbassa();
    }
  } finally {
    await centralino.spegni();
    await ha.spegni();
    rmSync(data, { recursive: true, force: true });
  }
});

test("dopo un aggiornamento il centralino riconosce la casa al primo colpo, e non la tratta come nuova", async () => {
  const data = mkdtempSync(join(tmpdir(), "data-"));
  const ha = await homeAssistantFinta();
  const centralino = await unCentralino();
  try {
    const prima = await unPonte({ data, centralino, ha });
    const casa = prima.identita.casa;
    prima.abbassa();
    await attendi(() => !centralino.centralino.collegate.has(casa));
    const quanteCase = centralino.centralino.case.quante();

    const dopo = await unPonte({ data, centralino, ha });
    try {
      assert.equal(dopo.chiamata.rifiutata, null, "il centralino non la rifiuta");
      assert.equal(centralino.centralino.collegate.has(casa), true);
      assert.equal(centralino.centralino.case.quante(), quanteCase, "nessuna casa nuova");
    } finally {
      dopo.abbassa();
    }
  } finally {
    await centralino.spegni();
    await ha.spegni();
    rmSync(data, { recursive: true, force: true });
  }
});
