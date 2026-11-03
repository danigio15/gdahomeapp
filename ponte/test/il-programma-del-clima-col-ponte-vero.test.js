/* Il programma del clima salvato col ponte vero e una Home Assistant finta.
 *
 * «Sembra che non salva il programma», «se ricarichi la pagina ti cambia
 * l'orario», «anche il target non cambia». Le prove di `automazioni-ha`
 * guardano `Automazioni` da sola; qui c'e' tutta la strada: il ponte acceso
 * con `alzaIlPonte`, la plancia che gli parla dal suo filo
 * (`/plancia/api/websocket`) come chi amministra, e una Home Assistant che
 * scrive il file subito ma ricarica l'automazione quando le pare:
 *
 *  a) per un po' dopo il salvataggio dice ancora quella di prima;
 *  b) mentre ricarica, «not_found»;
 *  c) non la ricarica mai (nel tempo che il ponte aspetta).
 *
 * In tutti e tre: la risposta dice se Home Assistant l'ha davvero, e
 * `automation.trigger` parte solo quando l'ha. E una seconda plancia (la
 * pagina ricaricata) vede il programma nuovo — la sera dalle 20:00 invece
 * che dalle 17:00, come nel video — con lo stesso id e senza una seconda
 * automazione.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { accetta } from "../src/presa.js";
import { alzaIlPonte } from "../src/index.js";
import { inHomeAssistant } from "../plancia/src/core/automazioni-ha.js";

const SEGNO_DEL_SUPERVISOR = "segno-del-supervisor";
const CHI_AMMINISTRA = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

/* Il programma della sala com'era (sera dalle 17:00) e come lo si salva
 * (sera dalle 20:00). I minuti dalla mezzanotte. */
const CRONO = (sera) => ({
  termostati: ["climate.sala"],
  fuori: 17,
  programma: {
    feriali: [
      { da: 390, a: 510, gradi: 21 },
      { da: sera, a: 1350, gradi: 20.5 },
    ],
    festivi: [{ da: 480, a: 1380, gradi: 20.5 }],
  },
});
const PROGRAMMA = (sera) => ({
  id: "p1",
  nome: "Programma Sala",
  attiva: true,
  tipo: "crono",
  crono: CRONO(sera),
});

const STATI = [
  {
    entity_id: "climate.sala",
    state: "heat",
    attributes: { friendly_name: "Sala", temperature: 20.5, current_temperature: 20 },
    last_changed: "2026-11-03T18:00:00Z",
  },
  {
    entity_id: "automation.programma_sala",
    state: "on",
    attributes: { id: "p1", friendly_name: "Programma Sala" },
    last_changed: "2026-11-03T06:00:00Z",
  },
];

const nonCe = (id) => Object.assign(new Error(`${id} not found`), { code: "not_found" });

/* Home Assistant finta. Il file (`automations.yaml`) cambia appena arriva il
 * POST; quello che ha in memoria — e che dice `automation/config` — lo
 * decide `ricarica(msDalSalvataggio, { vecchia, nuova })`. */
async function casaFinta({ ricarica }) {
  const stati = structuredClone(STATI);
  const vecchia = inHomeAssistant(PROGRAMMA(1020), {
    stati: Object.fromEntries(stati.map((s) => [s.entity_id, s])),
  });
  const file = { p1: structuredClone(vecchia) };
  let salvataIl = null;
  const servizi = [];
  const scritture = [];
  const prese = [];
  const inMemoria = () => {
    if (salvataIl === null) return structuredClone(vecchia);
    const quale = ricarica(Date.now() - salvataIl, { vecchia, nuova: file.p1 });
    if (quale instanceof Error) throw quale;
    return structuredClone(quale);
  };
  const risposta = (presa, id, result) =>
    presa.manda(JSON.stringify({ id, type: "result", success: true, result }));
  const errore = (presa, id, e) =>
    presa.manda(
      JSON.stringify({
        id,
        type: "result",
        success: false,
        error: { code: e.code || "unknown_error", message: e.message },
      }),
    );

  const server = createServer(async (richiesta, uscita) => {
    const corpo = await new Promise((ok) => {
      let testo = "";
      richiesta.on("data", (pezzo) => (testo += pezzo));
      richiesta.on("end", () => ok(testo));
    });
    const via = /^\/api\/config\/automation\/config\/([^/?]+)$/.exec(richiesta.url || "");
    uscita.setHeader("content-type", "application/json");
    if (via) {
      const id = decodeURIComponent(via[1]);
      if (richiesta.method === "GET") {
        if (!file[id]) {
          uscita.writeHead(404);
          uscita.end('{"message":"Resource not found"}');
          return;
        }
        uscita.end(JSON.stringify(file[id]));
        return;
      }
      if (richiesta.method === "POST") {
        file[id] = JSON.parse(corpo);
        scritture.push(id);
        salvataIl = Date.now();
        uscita.end('{"result":"ok"}');
        return;
      }
    }
    uscita.end('{"message":"API running."}');
  });
  server.on("upgrade", (richiesta, socket) => {
    const presa = accetta(richiesta, socket, {
      onMessaggio: (testo) => {
        const detto = JSON.parse(testo);
        if (detto.type === "auth") {
          presa.manda(
            JSON.stringify(
              detto.access_token === SEGNO_DEL_SUPERVISOR
                ? { type: "auth_ok", ha_version: "2025.10.0" }
                : { type: "auth_invalid" },
            ),
          );
          return;
        }
        switch (detto.type) {
          case "get_states":
            return risposta(presa, detto.id, stati);
          case "get_config":
            return risposta(presa, detto.id, { time_zone: "Europe/Rome", version: "2025.10.0" });
          case "config/auth/list":
            return risposta(presa, detto.id, [
              {
                id: CHI_AMMINISTRA,
                name: "Persona 1",
                is_owner: true,
                is_active: true,
                system_generated: false,
                group_ids: ["system-admin"],
              },
            ]);
          case "automation/config": {
            if (detto.entity_id !== "automation.programma_sala")
              return errore(presa, detto.id, nonCe(detto.entity_id));
            try {
              return risposta(presa, detto.id, { config: inMemoria() });
            } catch (e) {
              return errore(presa, detto.id, e);
            }
          }
          case "call_service":
            servizi.push(detto);
            return risposta(presa, detto.id, { context: { id: "c" } });
          default:
            /* I registri e il resto: vuoti. */
            return risposta(presa, detto.id, /\/list$/.test(detto.type) ? [] : null);
        }
      },
    });
    if (!presa) return;
    prese.push(presa);
    presa.manda(JSON.stringify({ type: "auth_required", ha_version: "2025.10.0" }));
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    indirizzo: `http://127.0.0.1:${server.address().port}`,
    servizi,
    scritture,
    file,
    spegni: async () => {
      for (const presa of prese) presa.chiudi();
      await new Promise((ok) => server.close(ok));
    },
  };
}

async function banco(ricarica) {
  const cartella = mkdtempSync(join(tmpdir(), "programma-col-ponte-"));
  const ha = await casaFinta({ ricarica });
  const prima = {
    casa: process.env.PONTE_CASA,
    segno: process.env.SUPERVISOR_TOKEN,
    supervisor: process.env.PONTE_SUPERVISOR,
    quadro: process.env.PONTE_QUADRO_DOVE,
  };
  process.env.PONTE_CASA = ha.indirizzo;
  process.env.PONTE_SUPERVISOR = ha.indirizzo;
  process.env.SUPERVISOR_TOKEN = SEGNO_DEL_SUPERVISOR;
  /* Al quadro vero non si bussa mai: qui una porta chiusa. */
  process.env.PONTE_QUADRO_DOVE = "http://127.0.0.1:9";
  const avviato = await alzaIlPonte({
    cartella,
    portaDellApp: 0,
    portaDellaConsole: 0,
    dispositiviMassimi: 3,
    minutiDelCodice: 5,
    giorniDiSilenzio: 90,
    registro: "errore",
    console: fileURLToPath(new URL("../console", import.meta.url)),
    proxyDellIngress: ["127.0.0.1"],
  });
  /* Premium non e' quello che si prova qui: questa casa ce l'ha. */
  avviato.automazioni.licenze = { attive: true, premium: true };
  const consolle = `http://127.0.0.1:${avviato.console.address().port}`;
  return {
    ...avviato,
    ha,
    filo: `${consolle.replace("http", "ws")}/plancia/api/websocket`,
    spegni: async () => {
      await avviato.abbassa();
      await ha.spegni();
      rmSync(cartella, { recursive: true, force: true });
      for (const [chiave, valore] of [
        ["PONTE_CASA", prima.casa],
        ["SUPERVISOR_TOKEN", prima.segno],
        ["PONTE_SUPERVISOR", prima.supervisor],
        ["PONTE_QUADRO_DOVE", prima.quadro],
      ]) {
        if (valore === undefined) delete process.env[chiave];
        else process.env[chiave] = valore;
      }
    },
  };
}

/* Una plancia, quel tanto che basta: il filo del ponte, come chi amministra
 * (la riga che l'ingress di Home Assistant aggiunge). */
async function unaPlancia(dove) {
  const presa = new WebSocket(dove, { headers: { "x-remote-user-id": CHI_AMMINISTRA } });
  const arrivati = [];
  const attese = [];
  presa.addEventListener("message", (evento) => {
    const detto = JSON.parse(String(evento.data));
    arrivati.push(detto);
    for (let i = attese.length - 1; i >= 0; i -= 1)
      if (attese[i].quando(detto)) {
        attese[i].ok(detto);
        attese.splice(i, 1);
      }
  });
  await new Promise((ok, no) => {
    presa.addEventListener("open", ok);
    presa.addEventListener("error", () => no(new Error("il filo della plancia non si apre")));
  });
  let numero = 100;
  const chiedi = (cosa, entro = 15_000) => {
    numero += 1;
    const id = numero;
    return new Promise((ok, no) => {
      const scadenza = setTimeout(() => no(new Error(`${cosa.type}: nessuna risposta`)), entro);
      attese.push({
        quando: (d) => d.id === id && d.type === "result",
        ok: (d) => {
          clearTimeout(scadenza);
          ok(d);
        },
      });
      presa.send(JSON.stringify({ ...cosa, id }));
    });
  };
  return { chiedi, chiudi: () => presa.close() };
}

/* Quello che la plancia legge aprendo la finestra del programma. Il ponte
 * vede le entita' appena le chiede a Home Assistant: si riprova un attimo. */
async function ilProgramma(plancia) {
  for (let volta = 0; volta < 40; volta += 1) {
    const stato = await plancia.chiedi({ type: "ponte/automazioni/stato" });
    assert.equal(stato.success, true, JSON.stringify(stato.error));
    const voci = stato.result.automazioni.filter(
      (v) =>
        v.climi?.includes("climate.sala") || v.modello?.crono?.termostati?.includes("climate.sala"),
    );
    if (voci.length) return { stato: stato.result, voci };
    await new Promise((ok) => setTimeout(ok, 100));
  }
  throw new Error("il programma della sala non si vede");
}

const salva = (plancia) =>
  plancia.chiedi({
    type: "ponte/automazioni/salva",
    automazione_id: "p1",
    automazione: PROGRAMMA(1200),
  });

const trigger = (ha) =>
  ha.servizi.filter((s) => s.domain === "automation" && s.service === "trigger");

async function laPaginaRicaricata(b) {
  const di_nuovo = await unaPlancia(b.filo);
  try {
    const { stato, voci } = await ilProgramma(di_nuovo);
    assert.equal(stato.fuso, "Europe/Rome");
    assert.equal(voci.length, 1, "una sola automazione per la sala: nessun doppione");
    assert.equal(voci[0].id, "p1", "lo stesso id");
    assert.equal(
      voci[0].entity_id ?? voci[0].entita ?? "automation.programma_sala",
      "automation.programma_sala",
    );
    const sera = voci[0].modello?.crono?.programma?.feriali?.[1];
    assert.equal(sera?.da, 1200, "la sera parte alle 20:00, non alle 17:00 di prima");
    assert.equal(sera?.gradi, 20.5);
  } finally {
    di_nuovo.chiudi();
  }
}

test("a) per un attimo Home Assistant dice ancora quella di prima: si aspetta, poi si applica", async () => {
  const b = await banco((ms, { vecchia, nuova }) => (ms < 800 ? vecchia : nuova));
  const plancia = await unaPlancia(b.filo);
  try {
    const { voci } = await ilProgramma(plancia);
    assert.equal(voci[0].modello.crono.programma.feriali[1].da, 1020, "prima: dalle 17:00");
    const fatto = await salva(plancia);
    assert.equal(fatto.success, true, JSON.stringify(fatto.error));
    assert.equal(fatto.result.id, "p1");
    assert.equal(fatto.result.confermata, true);
    assert.equal(fatto.result.applicato, true);
    assert.deepEqual(b.ha.scritture, ["p1"], "scritta una volta, sopra quella che c'era");
    assert.deepEqual(
      trigger(b.ha).map((s) => [s.target.entity_id, s.service_data?.skip_condition]),
      [["automation.programma_sala", true]],
    );
    await laPaginaRicaricata(b);
  } finally {
    plancia.chiudi();
    await b.spegni();
  }
});

test("b) mentre ricarica Home Assistant dice «not_found»: si aspetta, poi si applica", async () => {
  const b = await banco((ms, { nuova }) => (ms < 600 ? nonCe("automation.programma_sala") : nuova));
  const plancia = await unaPlancia(b.filo);
  try {
    await ilProgramma(plancia);
    const fatto = await salva(plancia);
    assert.equal(fatto.success, true, JSON.stringify(fatto.error));
    assert.equal(fatto.result.confermata, true);
    assert.equal(fatto.result.applicato, true);
    assert.equal(trigger(b.ha).length, 1);
    await laPaginaRicaricata(b);
  } finally {
    plancia.chiudi();
    await b.spegni();
  }
});

test("c) Home Assistant non la ricarica mai: salvata, non confermata, e niente scatta", async () => {
  const b = await banco((_ms, { vecchia }) => vecchia);
  const plancia = await unaPlancia(b.filo);
  try {
    await ilProgramma(plancia);
    const fatto = await salva(plancia);
    assert.equal(fatto.success, true, JSON.stringify(fatto.error));
    assert.equal(fatto.result.id, "p1");
    assert.equal(fatto.result.confermata, false);
    assert.equal(fatto.result.applicato, false);
    assert.deepEqual(
      trigger(b.ha),
      [],
      "far scattare quella vecchia rimetterebbe i gradi di prima",
    );
    /* Il file pero' e' quello nuovo: quando Home Assistant ricarica, e' lui. */
    assert.equal(b.ha.file.p1.variables.gdahome_crono.programma.feriali[1].da, 1200);
  } finally {
    plancia.chiudi();
    await b.spegni();
  }
});
