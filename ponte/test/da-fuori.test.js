/* Il ponte che chiama fuori, contro il centralino vero.
 *
 * Qui non c'e' niente di finto in mezzo: il centralino e' quello di
 * `../../centralino`, acceso davvero; il ponte e' questo; e il telefono e' un
 * WebSocket cliente vero che bussa **al centralino**, non al ponte.
 *
 * La cosa che si sta provando, e che e' tutto il senso di questa strada:
 * **nessuno si mette in ascolto dalla parte del ponte**. Il telefono non sa
 * dove sia la casa e non potrebbe raggiungerla. Il ponte chiama, e i due si
 * incontrano in mezzo.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

import { Case } from "../../centralino/src/case.js";
import { Centralino } from "../../centralino/src/centralino.js";
import { costruisciIlServer } from "../../centralino/src/server.js";

import { Chiamata } from "../src/chiamata.js";
import { Identita } from "../src/identita.js";
import { Ponte } from "../src/ponte.js";
import { Portiere } from "../src/portiere.js";
import { Dispositivi } from "../src/dispositivi.js";
import { Abbinamento } from "../src/abbinamento.js";
import { accetta } from "../src/presa.js";
import { telefonoCifrato } from "./telefono-cifrato.js";

const impronta = (cosa) => createHash("sha256").update(cosa).digest("hex");
const SEGNO_DELLA_CASA = "segno-finto-del-supervisor";

/* ─── Una Home Assistant finta, dietro al ponte ──────────────────────────── */

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
          presa.manda(
            JSON.stringify(
              detto.access_token === SEGNO_DELLA_CASA
                ? { type: "auth_ok" }
                : { type: "auth_invalid" },
            ),
          );
          return;
        }
        presa.manda(
          JSON.stringify({
            id: detto.id,
            type: "result",
            success: true,
            result: detto.type === "get_states" ? [{ entity_id: "light.x", state: "on" }] : null,
          }),
        );
      },
    });
    if (!presa) return;
    prese.push(presa);
    presa.manda(JSON.stringify({ type: "auth_required" }));
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    indirizzo: `http://127.0.0.1:${server.address().port}`,
    prese,
    spegni: async () => {
      for (const presa of prese) presa.chiudi();
      await new Promise((ok) => server.close(ok));
    },
  };
}

/* ─── Tutta la catena accesa ─────────────────────────────────────────────── */

async function catena() {
  const cartelle = [];
  const nuovaCartella = (nome) => {
    const dove = mkdtempSync(join(tmpdir(), `${nome}-`));
    cartelle.push(dove);
    return dove;
  };

  const ha = await homeAssistantFinta();

  const centralino = new Centralino({ case: new Case({ cartella: nuovaCartella("case") }) });
  const serverDelCentralino = costruisciIlServer({ centralino });
  await new Promise((ok) => serverDelCentralino.listen(0, "127.0.0.1", ok));
  const doveIlCentralino = `ws://127.0.0.1:${serverDelCentralino.address().port}`;

  const { Casa } = await import("../src/casa.js");
  const casa = new Casa({ indirizzo: ha.indirizzo, segno: SEGNO_DELLA_CASA });
  const dispositivi = new Dispositivi({ cartella: nuovaCartella("ponte") });
  const ponte = new Ponte({ casa, dispositivi, registro: null });
  const abbinamento = new Abbinamento({});
  const portiere = new Portiere({ ponte, dispositivi, abbinamento, registro: null });
  const identita = new Identita({ cartella: nuovaCartella("identita") });
  const chiamata = new Chiamata({
    dove: doveIlCentralino,
    identita,
    portiere,
    attesaMassima: 200,
  });
  portiere.chiamata = chiamata;
  chiamata.avvia();
  await attendi(() => chiamata.dentro);

  return {
    ha,
    centralino,
    doveIlCentralino,
    casa,
    dispositivi,
    ponte,
    portiere,
    abbinamento,
    identita,
    chiamata,
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

/* Un telefono che bussa al centralino. Dietro c'e' il portiere, quindi si
 * parla cifrato: `telefono-cifrato.js` fa la stretta di mano e poi imbusta. */
const unTelefono = (dove, via, chiavi) => telefonoCifrato(`${dove}${via}`, chiavi);

/* ─── Le prove ───────────────────────────────────────────────────────────── */

test("il ponte chiama fuori e il centralino lo riconosce", async () => {
  const c = await catena();
  try {
    assert.equal(c.chiamata.dentro, true);
    assert.equal(c.centralino.quanteCase(), 1);
    assert.match(c.identita.casa, /^casa_[0-9a-f]{32}$/);
  } finally {
    await c.spegni();
  }
});

test("l'identita' della casa resta la stessa dopo un riavvio del ponte", async () => {
  const dove = mkdtempSync(join(tmpdir(), "identita-"));
  try {
    const prima = new Identita({ cartella: dove });
    const dopo = new Identita({ cartella: dove });
    assert.equal(prima.casa, dopo.casa);
    assert.equal(prima.segreto, dopo.segreto);
    assert.equal(prima.toString().includes(prima.segreto), false);
  } finally {
    rmSync(dove, { recursive: true, force: true });
  }
});

test("un telefono abbinato entra dal centralino e legge la casa", async () => {
  const c = await catena();
  try {
    const { segno, chiave, dispositivo } = c.dispositivi.abbina({
      nome: "telefono di fuori",
      sistema: "ios",
    });

    const telefono = unTelefono(c.doveIlCentralino, `/telefono/${c.identita.casa}`, {
      chi: dispositivo.id,
      chiave,
    });
    await telefono.dentro;
    /* Da qui in poi e' il protocollo di Home Assistant, identico a quello che
     * si parla dentro casa: il centralino e il canale non si vedono. */
    assert.equal((await telefono.aspetta("auth_required")).type, "auth_required");

    telefono.manda({ type: "auth", access_token: segno });
    assert.equal((await telefono.aspetta("auth_ok")).type, "auth_ok");

    telefono.manda({ id: 1, type: "get_states" });
    await attendi(() => telefono.detti.some((uno) => uno.id === 1));
    const risposta = telefono.detti.find((uno) => uno.id === 1);
    assert.equal(risposta.success, true);
    assert.equal(risposta.result[0].entity_id, "light.x");

    /* Il segno del Supervisor non e' mai uscito da casa. */
    assert.equal(JSON.stringify(telefono.detti).includes(SEGNO_DELLA_CASA), false);
    telefono.chiudi();
  } finally {
    await c.spegni();
  }
});

test("un segno inventato viene rifiutato anche passando dal centralino", async () => {
  const c = await catena();
  try {
    const { chiave, dispositivo } = c.dispositivi.abbina({ nome: "telefono" });
    const telefono = unTelefono(c.doveIlCentralino, `/telefono/${c.identita.casa}`, {
      chi: dispositivo.id,
      chiave,
    });
    await telefono.dentro;
    await telefono.aspetta("auth_required");
    telefono.manda({ type: "auth", access_token: "me lo sono inventato" });
    assert.equal((await telefono.aspetta("auth_invalid")).type, "auth_invalid");
    await telefono.chiusa;
    assert.equal(c.ha.prese.length, 0, "Home Assistant non e' stata nemmeno disturbata");
  } finally {
    await c.spegni();
  }
});

test("l'abbinamento passa dal centralino, che il codice non lo vede mai", async () => {
  const c = await catena();
  try {
    const codice = "ABCD2345";
    c.chiamata.apriLAbbinamento(impronta(codice));
    await attendi(() => c.centralino.abbinamenti.size === 1);

    /* Al centralino c'e' l'impronta, non il codice. */
    assert.equal([...c.centralino.abbinamenti.keys()][0], impronta(codice));

    const telefono = unTelefono(c.doveIlCentralino, `/abbinamento/${impronta(codice)}`, {
      abbina: true,
    });
    /* La stretta di mano riesce: il telefono e' arrivato alla casa giusta. */
    await telefono.dentro;
    telefono.chiudi();
  } finally {
    await c.spegni();
  }
});

test("due telefoni dal centralino sono due fili distinti verso Home Assistant", async () => {
  const c = await catena();
  try {
    const uno = c.dispositivi.abbina({ nome: "uno" });
    const due = c.dispositivi.abbina({ nome: "due" });

    const ta = unTelefono(c.doveIlCentralino, `/telefono/${c.identita.casa}`, {
      chi: uno.dispositivo.id,
      chiave: uno.chiave,
    });
    const tb = unTelefono(c.doveIlCentralino, `/telefono/${c.identita.casa}`, {
      chi: due.dispositivo.id,
      chiave: due.chiave,
    });
    await Promise.all([ta.dentro, tb.dentro]);
    await Promise.all([ta.aspetta("auth_required"), tb.aspetta("auth_required")]);

    ta.manda({ type: "auth", access_token: uno.segno });
    tb.manda({ type: "auth", access_token: due.segno });
    await Promise.all([ta.aspetta("auth_ok"), tb.aspetta("auth_ok")]);

    assert.equal(c.chiamata.quantiCanali(), 2);
    assert.equal(c.ha.prese.length, 2, "un filo verso Home Assistant per telefono");
    ta.chiudi();
    tb.chiudi();
  } finally {
    await c.spegni();
  }
});

test("se il telefono se ne va, il suo filo verso Home Assistant si chiude", async () => {
  const c = await catena();
  try {
    const { segno, chiave, dispositivo } = c.dispositivi.abbina({ nome: "passeggero" });
    const telefono = unTelefono(c.doveIlCentralino, `/telefono/${c.identita.casa}`, {
      chi: dispositivo.id,
      chiave,
    });
    await telefono.dentro;
    await telefono.aspetta("auth_required");
    telefono.manda({ type: "auth", access_token: segno });
    await telefono.aspetta("auth_ok");
    assert.equal(c.ha.prese.length, 1);

    telefono.chiudi();
    await attendi(() => c.chiamata.quantiCanali() === 0);
    await attendi(() => c.ha.prese[0].viva === false);
  } finally {
    await c.spegni();
  }
});

test("il ponte si riaggancia da solo quando il centralino torna", async () => {
  const c = await catena();
  try {
    /* Il centralino butta giu' la casa: e' il suo riavvio, visto da qui. */
    for (const casa of [...c.centralino.collegate.values()]) casa.chiudi("prova");
    await attendi(() => !c.chiamata.dentro);

    await attendi(() => c.chiamata.dentro, 8000);
    assert.equal(c.centralino.quanteCase(), 1);
  } finally {
    await c.spegni();
  }
});

test("un rifiuto del centralino non si riprova all'infinito", async () => {
  const c = await catena();
  try {
    /* Un secondo ponte che si spaccia per la stessa casa con un altro
     * segreto: il centralino lo rifiuta, e lui deve smettere. */
    const dove = mkdtempSync(join(tmpdir(), "impostore-"));
    const impostore = new Identita({ cartella: dove });
    impostore.archivio.dati.casa = c.identita.casa;
    impostore.archivio.dati.segreto = "un segreto tutto mio che non e' quello";

    const finto = new Chiamata({
      dove: c.doveIlCentralino,
      identita: impostore,
      portiere: c.portiere,
      attesaMassima: 100,
    });
    try {
      finto.avvia();
      await attendi(() => finto.rifiutata !== null);

      assert.match(finto.rifiutata, /non ti riconosco/);
      assert.equal(finto.dentro, false);
      assert.equal(finto.accesa, false, "ha smesso: un rifiuto non passa col tempo");

      /* E la casa vera e' ancora dentro. */
      assert.equal(c.chiamata.dentro, true);
    } finally {
      finto.spegni();
      rmSync(dove, { recursive: true, force: true });
    }
  } finally {
    await c.spegni();
  }
});

test("senza centralino configurato il ponte non prova nemmeno", async () => {
  const dove = mkdtempSync(join(tmpdir(), "senza-"));
  try {
    const chiamata = new Chiamata({
      dove: "",
      identita: new Identita({ cartella: dove }),
      portiere: null,
    });
    chiamata.avvia();
    assert.equal(chiamata.accesa, false);
    assert.equal(chiamata.dentro, false);
    chiamata.spegni();
  } finally {
    rmSync(dove, { recursive: true, force: true });
  }
});

const nuovoGiro = (millesimi = 5) => new Promise((ok) => setTimeout(ok, millesimi));

async function attendi(condizione, entro = 6000) {
  const fine = Date.now() + entro;
  while (Date.now() < fine) {
    if (condizione()) return;
    await nuovoGiro();
  }
  throw new Error("l'attesa e' scaduta");
}
