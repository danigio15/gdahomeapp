/* Le prove delle commissioni: i file della plancia vera, e le chiamate REST,
 * chiesti al ponte sul filo.
 *
 * Quello che si prova davvero: che dal telefono si arriva **solo** alle due
 * cartelle che servono alla plancia, che `/api/` porta con se' il segno del
 * Supervisor e `/dashboardmodern_static/` no, e che il testo viaggia
 * compresso.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { accetta } from "../src/presa.js";
import { Casa } from "../src/casa.js";
import { Commissioni, impacchetta, TIPO } from "../src/commissioni.js";
import { Dispositivi } from "../src/dispositivi.js";
import { Ponte } from "../src/ponte.js";

const SEGNO_DEL_SUPERVISOR = "il-segno-del-supervisor";
const ZITTO = { info() {}, attenzione() {}, errore() {} };

function casaDiProva() {
  return new Casa({
    indirizzo: "http://supervisor/core",
    segno: SEGNO_DEL_SUPERVISOR,
    plancia: "http://172.30.32.1:8123",
  });
}

/* Uno `scarica` finto: si ricorda cosa gli si e' chiesto e risponde quello
 * che gli si dice. */
function scaricaFinto(risposta = { stato: 200, tipo: "text/plain", corpo: Buffer.from("ciao") }) {
  const chieste = [];
  const scarica = async (richiesta) => {
    chieste.push(richiesta);
    if (risposta instanceof Error) throw risposta;
    return risposta;
  };
  return { scarica, chieste };
}

/* ─── Le due cartelle ────────────────────────────────────────────────────── */

test("/api/ passa dal Supervisor col segno, /dashboardmodern_static/ va dritto senza", async () => {
  const { scarica, chieste } = scaricaFinto();
  const commissioni = new Commissioni({ casa: casaDiProva(), registro: ZITTO, scarica });

  const api = await commissioni.rispondi({ id: 1, type: TIPO, percorso: "/api/states?x=1" });
  assert.equal(api.success, true);
  assert.equal(chieste[0].url, "http://supervisor/core/api/states?x=1");
  assert.equal(chieste[0].intestazioni.authorization, `Bearer ${SEGNO_DEL_SUPERVISOR}`);
  assert.equal(chieste[0].insicuro, false);

  const file = await commissioni.rispondi({
    id: 2,
    type: TIPO,
    percorso: "/dashboardmodern_static/abc/legacy/dashboard.html",
  });
  assert.equal(file.success, true);
  assert.equal(
    chieste[1].url,
    "http://172.30.32.1:8123/dashboardmodern_static/abc/legacy/dashboard.html",
  );
  assert.equal(chieste[1].intestazioni.authorization, undefined);
  /* Home Assistant non deve comprimere lei: lo fa il ponte, e solo il testo. */
  assert.equal(chieste[1].intestazioni["accept-encoding"], "identity");
});

test("fuori dalle due cartelle non si va, e nemmeno con i trucchi", async () => {
  const { scarica, chieste } = scaricaFinto();
  const commissioni = new Commissioni({ casa: casaDiProva(), registro: ZITTO, scarica });

  for (const percorso of [
    "/",
    "/auth/token",
    "/config/secrets.yaml",
    "/api/../config/secrets.yaml",
    "/dashboardmodern_static/../../etc/passwd",
    "/api/websocket",
    "http://altrove/api/states",
    "/api/states\n",
    "",
    42,
    undefined,
  ]) {
    const risposta = await commissioni.rispondi({ id: 7, type: TIPO, percorso });
    assert.equal(risposta.success, false, `doveva rifiutare ${JSON.stringify(percorso)}`);
    assert.equal(risposta.error.code, "not_allowed");
    assert.equal(risposta.id, 7);
  }
  assert.equal(chieste.length, 0, "non deve nemmeno provarci");
});

test("un metodo strano, un corpo strano, un tipo di messaggio strano", async () => {
  const { scarica, chieste } = scaricaFinto();
  const commissioni = new Commissioni({ casa: casaDiProva(), registro: ZITTO, scarica });

  const metodo = await commissioni.rispondi({
    id: 1,
    type: TIPO,
    metodo: "TRACE",
    percorso: "/api/states",
  });
  assert.equal(metodo.error.code, "not_allowed");

  const corpo = await commissioni.rispondi({
    id: 2,
    type: TIPO,
    metodo: "POST",
    percorso: "/api/states",
    corpo: { non: "una stringa" },
  });
  assert.equal(corpo.error.code, "not_allowed");

  const altro = await commissioni.rispondi({ id: 3, type: "ponte/vola" });
  assert.equal(altro.success, false);
  assert.equal(altro.error.code, "unknown_command");
  assert.equal(chieste.length, 0);
});

test("una POST porta il corpo e il suo tipo", async () => {
  const { scarica, chieste } = scaricaFinto();
  const commissioni = new Commissioni({ casa: casaDiProva(), registro: ZITTO, scarica });

  await commissioni.rispondi({
    id: 1,
    type: TIPO,
    metodo: "post",
    percorso: "/api/services/light/turn_on",
    tipo: "application/json",
    corpo: Buffer.from('{"entity_id":"light.sala"}').toString("base64"),
  });
  assert.equal(chieste[0].metodo, "POST");
  assert.equal(chieste[0].corpo.toString("utf8"), '{"entity_id":"light.sala"}');
  assert.equal(chieste[0].intestazioni["content-type"], "application/json");
});

test("quando Home Assistant non risponde, la risposta e' un no e non un'eccezione", async () => {
  const { scarica } = scaricaFinto(new Error("ECONNREFUSED"));
  const commissioni = new Commissioni({ casa: casaDiProva(), registro: ZITTO, scarica });
  const risposta = await commissioni.rispondi({ id: 9, type: TIPO, percorso: "/api/states" });
  assert.equal(risposta.success, false);
  assert.equal(risposta.error.code, "ponte_http");
  assert.match(risposta.error.message, /ECONNREFUSED/);
});

test("uno stato che non e' 200 torna com'e': e' la plancia che decide", async () => {
  const { scarica } = scaricaFinto({ stato: 404, tipo: "text/plain", corpo: Buffer.from("no") });
  const commissioni = new Commissioni({ casa: casaDiProva(), registro: ZITTO, scarica });
  const risposta = await commissioni.rispondi({
    id: 1,
    type: TIPO,
    percorso: "/dashboardmodern_static/x/manca.js",
  });
  assert.equal(risposta.success, true);
  assert.equal(risposta.result.stato, 404);
});

/* ─── Il pacchetto ───────────────────────────────────────────────────────── */

test("il testo viaggia compresso, le immagini e le cose piccole no", () => {
  const lungo = Buffer.from("function x(){}\n".repeat(200));
  const testo = impacchetta(200, "text/javascript; charset=utf-8", lungo);
  assert.equal(testo.compresso, "gzip");
  assert.deepEqual(gunzipSync(Buffer.from(testo.corpo, "base64")), lungo);
  assert.ok(testo.corpo.length < lungo.length / 4, "doveva ridursi molto");

  const corto = impacchetta(200, "text/plain", Buffer.from("ciao"));
  assert.equal(corto.compresso, undefined);
  assert.equal(Buffer.from(corto.corpo, "base64").toString(), "ciao");

  const immagine = impacchetta(200, "image/png", Buffer.alloc(4096, 7));
  assert.equal(immagine.compresso, undefined);
  assert.equal(immagine.tipo, "image/png");

  const svg = impacchetta(200, "image/svg+xml", Buffer.from("<svg>".repeat(300)));
  assert.equal(svg.compresso, "gzip");

  const senzaTipo = impacchetta(200, "", Buffer.from("x"));
  assert.equal(senzaTipo.tipo, "application/octet-stream");
});

test("non piu' di tante insieme: le altre aspettano il loro turno", async () => {
  let inCorso = 0;
  let massimo = 0;
  const scarica = async () => {
    inCorso += 1;
    massimo = Math.max(massimo, inCorso);
    await new Promise((ok) => setTimeout(ok, 5));
    inCorso -= 1;
    return { stato: 200, tipo: "text/plain", corpo: Buffer.from("x") };
  };
  const commissioni = new Commissioni({
    casa: casaDiProva(),
    registro: ZITTO,
    scarica,
    insieme: 3,
  });
  const tutte = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      commissioni.rispondi({ id: i, type: TIPO, percorso: `/api/${i}` }),
    ),
  );
  assert.equal(tutte.length, 10);
  assert.ok(tutte.every((una) => una.success));
  assert.equal(massimo, 3);
});

/* ─── Dove sta la plancia ────────────────────────────────────────────────── */

function supervisorFinto(dati, { stato = 200 } = {}) {
  const chieste = [];
  const prendi = async (url, opzioni) => {
    chieste.push({ url, opzioni });
    return { ok: stato === 200, status: stato, json: async () => ({ result: "ok", data: dati }) };
  };
  return { prendi, chieste };
}

test("dove sta la plancia lo dice il Supervisor, e lo si tiene a mente", async () => {
  const { prendi, chieste } = supervisorFinto({
    ip_address: "172.30.32.1",
    port: 8123,
    ssl: false,
  });
  let ora = 1000;
  const casa = new Casa({ segno: "s", fetch: prendi, adesso: () => ora });

  assert.equal(await casa.doveStaLaPlancia(), "http://172.30.32.1:8123");
  assert.equal(chieste[0].url, "http://supervisor/core/info");
  assert.equal(chieste[0].opzioni.headers.authorization, "Bearer s");

  ora += 60_000;
  assert.equal(await casa.doveStaLaPlancia(), "http://172.30.32.1:8123");
  assert.equal(chieste.length, 1, "entro cinque minuti non si richiede");

  ora += 6 * 60_000;
  await casa.doveStaLaPlancia();
  assert.equal(chieste.length, 2);
});

test("con il TLS acceso si va in https, e chi scarica lo sa", async () => {
  const { prendi } = supervisorFinto({ ip_address: "172.30.32.1", port: 8123, ssl: true });
  const casa = new Casa({ segno: "s", fetch: prendi });
  assert.equal(await casa.doveStaLaPlancia(), "https://172.30.32.1:8123");

  const { scarica, chieste } = scaricaFinto();
  const commissioni = new Commissioni({ casa, registro: ZITTO, scarica });
  await commissioni.rispondi({ id: 1, type: TIPO, percorso: "/dashboardmodern_static/a.js" });
  assert.equal(chieste[0].insicuro, true);
});

test("se il Supervisor non risponde si va col nome del contenitore", async () => {
  const muto = new Casa({
    segno: "s",
    fetch: async () => {
      throw new Error("no");
    },
  });
  assert.equal(await muto.doveStaLaPlancia(), "http://homeassistant:8123");

  const { prendi } = supervisorFinto({}, { stato: 403 });
  const senzaPermesso = new Casa({ segno: "s", fetch: prendi });
  assert.equal(await senzaPermesso.doveStaLaPlancia(), "http://homeassistant:8123");

  const dettoAMano = new Casa({ segno: "s", fetch: prendi, plancia: "http://192.168.1.5:8123/" });
  assert.equal(await dettoAMano.doveStaLaPlancia(), "http://192.168.1.5:8123");
});

/* ─── Da un capo all'altro, col ponte vero in mezzo ──────────────────────── */

async function casaFinta() {
  const arrivate = [];
  const prese = [];
  const server = createServer((richiesta, risposta) => {
    arrivate.push({ url: richiesta.url, autorizzazione: richiesta.headers.authorization });
    if (richiesta.url === "/dashboardmodern_static/v1/legacy/dashboard.html") {
      risposta.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      risposta.end("<!DOCTYPE html><html><head></head><body>plancia</body></html>".repeat(20));
      return;
    }
    if (richiesta.url === "/api/history/period/x") {
      if (richiesta.headers.authorization !== `Bearer ${SEGNO_DEL_SUPERVISOR}`) {
        risposta.writeHead(401);
        risposta.end();
        return;
      }
      risposta.writeHead(200, { "content-type": "application/json" });
      risposta.end('[{"state":"1"}]');
      return;
    }
    risposta.writeHead(404, { "content-type": "text/plain" });
    risposta.end("qui non c'e' niente");
  });

  server.on("upgrade", (richiesta, socket) => {
    const presa = accetta(richiesta, socket, {
      onMessaggio: (testo) => {
        const detto = JSON.parse(testo);
        if (detto.type === "auth") {
          presa.manda(JSON.stringify({ type: "auth_ok", ha_version: "2025.1.0" }));
          return;
        }
        arrivate.push({ filo: detto });
        presa.manda(JSON.stringify({ id: detto.id, type: "result", success: true, result: null }));
      },
    });
    if (!presa) return;
    prese.push(presa);
    presa.manda(JSON.stringify({ type: "auth_required", ha_version: "2025.1.0" }));
  });

  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    indirizzo: `http://127.0.0.1:${server.address().port}`,
    arrivate,
    spegni: async () => {
      for (const presa of prese) presa.chiudi();
      await new Promise((ok) => server.close(ok));
    },
  };
}

const attendi = (condizione, quanto = 3000) =>
  new Promise((ok, no) => {
    const da = Date.now();
    const giro = () => {
      if (condizione()) return ok();
      if (Date.now() - da > quanto) return no(new Error("aspettato troppo"));
      setTimeout(giro, 10);
    };
    giro();
  });

test("dal telefono al file e ritorno, passando dal ponte", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "ponte-commissioni-"));
  const ha = await casaFinta();
  const casa = new Casa({
    indirizzo: ha.indirizzo,
    segno: SEGNO_DEL_SUPERVISOR,
    plancia: ha.indirizzo,
  });
  const dispositivi = new Dispositivi({ cartella });
  const { segno } = dispositivi.abbina({ nome: "Prova" });
  const commissioni = new Commissioni({ casa, registro: ZITTO });
  const ponte = new Ponte({ casa, dispositivi, registro: ZITTO, commissioni });

  const server = createServer((_r, risposta) => risposta.end());
  server.on("upgrade", (richiesta, socket) => {
    const presa = accetta(richiesta, socket, {});
    if (presa) ponte.accogli(presa, { da: "prova" });
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));

  const telefono = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
  const detti = [];
  telefono.addEventListener("message", (evento) => detti.push(JSON.parse(evento.data)));
  await new Promise((ok) => telefono.addEventListener("open", ok));
  await attendi(() => detti.some((uno) => uno.type === "auth_required"));
  telefono.send(JSON.stringify({ type: "auth", access_token: segno }));
  await attendi(() => detti.some((uno) => uno.type === "auth_ok"));

  telefono.send(
    JSON.stringify({
      id: 1,
      type: TIPO,
      percorso: "/dashboardmodern_static/v1/legacy/dashboard.html",
    }),
  );
  telefono.send(JSON.stringify({ id: 2, type: TIPO, percorso: "/api/history/period/x" }));
  telefono.send(JSON.stringify({ id: 3, type: "get_states" }));
  telefono.send(JSON.stringify({ id: 4, type: TIPO, percorso: "/dashboardmodern_static/manca" }));
  await attendi(() => detti.filter((uno) => uno.type === "result").length === 4);

  const pagina = detti.find((uno) => uno.id === 1);
  assert.equal(pagina.success, true);
  assert.equal(pagina.result.stato, 200);
  assert.equal(pagina.result.compresso, "gzip");
  assert.match(gunzipSync(Buffer.from(pagina.result.corpo, "base64")).toString(), /plancia/);

  const storico = detti.find((uno) => uno.id === 2);
  assert.equal(storico.result.stato, 200);
  assert.equal(Buffer.from(storico.result.corpo, "base64").toString(), '[{"state":"1"}]');

  /* Il comando normale e' andato in Home Assistant come sempre; le
   * commissioni no. */
  assert.deepEqual(
    ha.arrivate.filter((una) => una.filo).map((una) => una.filo.type),
    ["get_states"],
  );
  assert.equal(
    ha.arrivate.find((una) => una.url === "/api/history/period/x").autorizzazione,
    `Bearer ${SEGNO_DEL_SUPERVISOR}`,
  );
  assert.equal(
    ha.arrivate.find((una) => una.url?.startsWith("/dashboardmodern_static/v1")).autorizzazione,
    undefined,
  );

  const mancante = detti.find((uno) => uno.id === 4);
  assert.equal(mancante.success, true);
  assert.equal(mancante.result.stato, 404);

  telefono.close();
  ponte.chiudiTutto();
  await new Promise((ok) => server.close(ok));
  await ha.spegni();
  rmSync(cartella, { recursive: true, force: true });
});

test("un ponte senza commissioni dice di no, invece di girarlo a Home Assistant", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "ponte-commissioni-"));
  const ha = await casaFinta();
  const casa = new Casa({ indirizzo: ha.indirizzo, segno: SEGNO_DEL_SUPERVISOR });
  const dispositivi = new Dispositivi({ cartella });
  const { segno } = dispositivi.abbina({ nome: "Prova" });
  const ponte = new Ponte({ casa, dispositivi, registro: ZITTO });

  const server = createServer((_r, risposta) => risposta.end());
  server.on("upgrade", (richiesta, socket) => {
    const presa = accetta(richiesta, socket, {});
    if (presa) ponte.accogli(presa, { da: "prova" });
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));

  const telefono = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
  const detti = [];
  telefono.addEventListener("message", (evento) => detti.push(JSON.parse(evento.data)));
  await new Promise((ok) => telefono.addEventListener("open", ok));
  await attendi(() => detti.some((uno) => uno.type === "auth_required"));
  telefono.send(JSON.stringify({ type: "auth", access_token: segno }));
  await attendi(() => detti.some((uno) => uno.type === "auth_ok"));
  telefono.send(JSON.stringify({ id: 1, type: TIPO, percorso: "/api/states" }));
  await attendi(() => detti.some((uno) => uno.id === 1));

  assert.equal(detti.find((uno) => uno.id === 1).error.code, "unknown_command");
  assert.equal(ha.arrivate.filter((una) => una.filo).length, 0);

  telefono.close();
  ponte.chiudiTutto();
  await new Promise((ok) => server.close(ok));
  await ha.spegni();
  rmSync(cartella, { recursive: true, force: true });
});
