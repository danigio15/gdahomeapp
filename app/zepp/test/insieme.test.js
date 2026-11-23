/* La prova d'insieme: l'orologio, il centralino e la casa, tutti veri.
 *
 * Non c'e' un Amazfit su cui provare, e allora si prova tutto quello che
 * gli sta intorno. Il centralino e' quello di `centralino/src`, acceso su
 * una porta di questa macchina, con lo sportello del polso; la casa e' il
 * ponte di `ponte/src` — portiere, dispositivi, il polso — che chiama il
 * centralino come fa ogni giorno; dietro il ponte c'e' una Home Assistant
 * finta con tre luci. L'orologio e' il codice del servizio di fianco
 * (`app-side/il-filo.js`), lo stesso che gira nell'app Zepp: qui gli si da'
 * il `fetch` di Node al posto di quello di Zepp, e il caso di Node.
 *
 * Quello che deve succedere, in ordine: la console fa un codice; l'orologio
 * si abbina con quello; chiede la fotografia; accende una luce; la luce e'
 * accesa in Home Assistant e nella fotografia che torna col «Fatto».
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Case } from "../../../centralino/src/case.js";
import { Centralino } from "../../../centralino/src/centralino.js";
import { costruisciIlServer } from "../../../centralino/src/server.js";
import { SportelloDelPolso } from "../../../centralino/src/polso.js";

import { Abbinamento } from "../../../ponte/src/abbinamento.js";
import { Casa } from "../../../ponte/src/casa.js";
import { Chiamata } from "../../../ponte/src/chiamata.js";
import { Dispositivi } from "../../../ponte/src/dispositivi.js";
import { Identita } from "../../../ponte/src/identita.js";
import { IlPolso } from "../../../ponte/src/il-polso.js";
import { Ponte } from "../../../ponte/src/ponte.js";
import { Portiere } from "../../../ponte/src/portiere.js";
import { accetta } from "../../../ponte/src/presa.js";
import { Ritorno } from "../../../ponte/src/ritorno.js";

import { abbina, FiloRotto, IlFilo } from "../app-side/il-filo.js";
import { ilCaso } from "../app-side/caso.js";
import { leggiLaFoto } from "../utils/la-foto.js";

const SEGNO_DELLA_CASA = "segno-finto-del-supervisor";

async function attendi(condizione, entro = 6000) {
  const fine = Date.now() + entro;
  while (!condizione()) {
    if (Date.now() > fine) throw new Error("l'attesa e' scaduta");
    await new Promise((ok) => setTimeout(ok, 10));
  }
}

/* Una Home Assistant con tre luci, una che si abbassa. */
async function homeAssistantFinta() {
  const stati = [
    {
      entity_id: "light.soggiorno",
      state: "off",
      attributes: { supported_color_modes: ["brightness"], friendly_name: "Soggiorno" },
    },
    { entity_id: "light.cucina", state: "on", attributes: { supported_color_modes: ["onoff"] } },
    { entity_id: "script.buonanotte", state: "off", attributes: {} },
  ];
  const chiamati = [];
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
            JSON.stringify({
              type: detto.access_token === SEGNO_DELLA_CASA ? "auth_ok" : "auth_invalid",
            }),
          );
          return;
        }
        let result = null;
        if (detto.type === "get_states") result = stati;
        if (detto.type === "get_config") result = { location_name: "Casa" };
        if (detto.type === "call_service") {
          chiamati.push(detto);
          for (const id of detto.service_data.entity_id) {
            const stato = stati.find((uno) => uno.entity_id === id);
            if (!stato) continue;
            if (detto.service === "toggle") stato.state = stato.state === "on" ? "off" : "on";
            if (detto.service === "turn_on") {
              stato.state = "on";
              const pct = detto.service_data.brightness_pct;
              if (pct)
                stato.attributes = {
                  ...stato.attributes,
                  brightness: Math.round((pct / 100) * 255),
                };
            }
          }
        }
        presa.manda(JSON.stringify({ id: detto.id, type: "result", success: true, result }));
      },
    });
    if (!presa) return;
    prese.push(presa);
    presa.manda(JSON.stringify({ type: "auth_required" }));
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    indirizzo: `http://127.0.0.1:${server.address().port}`,
    stati,
    chiamati,
    spegni: async () => {
      for (const presa of prese) presa.chiudi();
      await new Promise((ok) => server.close(ok));
    },
  };
}

/* La plancia della casa, com'e' scritta nella sua configurazione. */
const VALORI = {
  cd_luci: JSON.stringify({ "light.soggiorno": "Faretti soggiorno", "light.cucina": "Cucina" }),
  cd_quick_actions: JSON.stringify([
    { name: "Buonanotte", type: "script", entity: "script.buonanotte" },
  ]),
};

async function laCatena() {
  const cartelle = [];
  const nuova = (nome) => {
    const dove = mkdtempSync(join(tmpdir(), `${nome}-`));
    cartelle.push(dove);
    return dove;
  };
  const ha = await homeAssistantFinta();

  const centralino = new Centralino({
    case: new Case({ cartella: nuova("case") }),
    chiaveLicenze: "",
  });
  const polso = new SportelloDelPolso({
    centralino,
    attesaDellaRisposta: 3000,
    codaDellaRisposta: 30,
  });
  const server = costruisciIlServer({ centralino, polso });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const porta = server.address().port;
  const ws = `ws://127.0.0.1:${porta}`;

  const casa = new Casa({ indirizzo: ha.indirizzo, segno: SEGNO_DELLA_CASA });
  const dispositivi = new Dispositivi({ cartella: nuova("ponte") });
  const ponte = new Ponte({ casa, dispositivi, registro: null });
  ponte.polso = new IlPolso({
    casa,
    configurazione: { leggi: () => ({ snapshot: { values: VALORI } }) },
    dispositivi,
    attesaDopoIlComando: 50,
  });
  const abbinamento = new Abbinamento({});
  const identita = new Identita({ cartella: nuova("identita") });
  const ritorno = new Ritorno({ identita, centralino: ws, porta: 8098, segno: "", fetch: null });
  const portiere = new Portiere({ ponte, dispositivi, abbinamento, registro: null, ritorno });
  const chiamata = new Chiamata({ dove: ws, identita, portiere, attesaMassima: 200 });
  portiere.chiamata = chiamata;
  chiamata.avvia();
  await attendi(() => chiamata.dentro);

  return {
    ha,
    centralino,
    polso,
    dispositivi,
    abbinamento,
    chiamata,
    identita,
    http: `http://127.0.0.1:${porta}`,
    spegni: async () => {
      chiamata.spegni();
      ponte.chiudiTutto();
      polso.chiudiTutto();
      centralino.chiudiTutto();
      await new Promise((ok) => server.close(ok));
      await ha.spegni();
      for (const dove of cartelle) rmSync(dove, { recursive: true, force: true });
    },
  };
}

/* La posta del servizio di fianco: in Zepp e' il suo `fetch`, qui quello di
 * Node. Si segna tutto quello che passa, per guardarlo dopo. */
function unaPosta() {
  const passato = [];
  const posta = async (url, corpo) => {
    const testo = JSON.stringify(corpo);
    passato.push(testo);
    const risposta = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: testo,
    });
    const letto = await risposta.json().catch(() => null);
    passato.push(JSON.stringify(letto));
    return { stato: risposta.status, corpo: letto };
  };
  return { posta, passato };
}

test("l'orologio si abbina attraverso il centralino, legge la casa e accende una luce", async () => {
  const c = await laCatena();
  try {
    /* La console fa un codice, e la casa lo dice al centralino. */
    const { codice } = c.abbinamento.nuovo();
    c.chiamata.apriLAbbinamento(createHash("sha256").update(codice).digest("hex"));
    await attendi(() => c.centralino.abbinamenti.size === 1);

    const { posta, passato } = unaPosta();
    const { caso } = ilCaso();
    const legame = await abbina({
      codice: codice.replace(/(.{4})(?=.)/g, "$1-").toLowerCase(),
      centralino: c.http,
      posta,
      caso,
    });
    assert.match(legame.id, /^dm_/);
    assert.equal(legame.chiave.length, 64);
    assert.equal(legame.casa, c.identita.casa);
    assert.equal(c.dispositivi.polsoDi(legame.id), "zepp");
    assert.equal(c.abbinamento.vivo(), null, "il codice si e' speso");

    const filo = new IlFilo({ legame: { ...legame, centralino: c.http }, posta, caso });
    const prima = await filo.chiedi({ t: "foto" });
    assert.equal(prima.ok, true);
    const foto = leggiLaFoto(prima.foto);
    assert.equal(foto.casa, "Casa");
    const soggiorno = foto.dispositivi.find((uno) => uno.id === "light.soggiorno");
    assert.equal(soggiorno.acceso, false);
    assert.equal(soggiorno.luminosita, 0, "la luce che si abbassa ha il dimmer");
    assert.equal(foto.azioni[0].nome, "Buonanotte");

    const fatto = await filo.chiedi({ t: "comando", id: "light.soggiorno", cosa: "gira" });
    assert.equal(fatto.ok, true);
    assert.equal(fatto.testo, "Fatto");
    assert.equal(c.ha.stati[0].state, "on", "la luce e' accesa in Home Assistant");
    assert.equal(
      leggiLaFoto(fatto.foto).dispositivi.find((uno) => uno.id === "light.soggiorno").acceso,
      true,
    );

    const meta = await filo.chiedi({
      t: "comando",
      id: "light.soggiorno",
      cosa: "luminosita",
      valore: 40,
    });
    assert.equal(meta.ok, true);
    assert.equal(
      leggiLaFoto(meta.foto).dispositivi.find((uno) => uno.id === "light.soggiorno").luminosita,
      40,
    );

    const no = await filo.chiedi({ t: "comando", id: "light.inventata", cosa: "gira" });
    assert.equal(no.ok, false, "Non è partito");

    /* Per strada non e' passato niente in chiaro: ne' il codice, ne' la
     * chiave, ne' i nomi della casa. */
    const strada = passato.join("\n");
    assert.equal(strada.includes(codice), false);
    assert.equal(strada.includes(legame.chiave), false);
    assert.equal(strada.includes("Faretti soggiorno"), false);
    assert.equal(strada.includes("light.soggiorno"), false);

    /* La sessione si ricomincia da sola, se il centralino l'ha chiusa. */
    for (const sessione of c.polso.sessioni.values()) sessione.presa.chiudi(1000, "prova");
    assert.equal((await filo.chiedi({ t: "foto" })).ok, true);

    /* Staccato dalla console: l'orologio lo sa, e lo dice. */
    c.dispositivi.stacca(legame.id);
    for (const sessione of c.polso.sessioni.values()) sessione.presa.chiudi(1000, "prova");
    await assert.rejects(
      filo.chiedi({ t: "foto" }),
      (errore) => errore instanceof FiloRotto && errore.staccato,
    );
  } finally {
    await c.spegni();
  }
});

test("un codice sbagliato non abbina niente, e l'orologio lo dice a parole", async () => {
  const c = await laCatena();
  try {
    const { codice } = c.abbinamento.nuovo();
    c.chiamata.apriLAbbinamento(createHash("sha256").update(codice).digest("hex"));
    await attendi(() => c.centralino.abbinamenti.size === 1);
    const { posta } = unaPosta();
    const { caso } = ilCaso();
    await assert.rejects(
      abbina({ codice: "A".repeat(16), centralino: c.http, posta, caso }),
      (errore) => errore instanceof FiloRotto && /scaduto|giusto/.test(errore.message),
    );
    assert.equal(c.dispositivi.elenco().length, 0);
  } finally {
    await c.spegni();
  }
});

test("senza il caso del sistema l'orologio si abbina col ripiego", async () => {
  const c = await laCatena();
  try {
    const { codice } = c.abbinamento.nuovo();
    c.chiamata.apriLAbbinamento(createHash("sha256").update(codice).digest("hex"));
    await attendi(() => c.centralino.abbinamenti.size === 1);
    const { posta } = unaPosta();
    const ripiego = ilCaso({ segreto: new TextEncoder().encode(codice), sistema: null });
    assert.equal(ripiego.daDove, "ripiego");
    const legame = await abbina({ codice, centralino: c.http, posta, caso: ripiego.caso });
    const filo = new IlFilo({
      legame: { ...legame, centralino: c.http },
      posta,
      caso: ripiego.caso,
    });
    assert.equal((await filo.chiedi({ t: "foto" })).ok, true);
  } finally {
    await c.spegni();
  }
});
