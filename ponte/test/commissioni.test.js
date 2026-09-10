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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { accetta } from "../src/presa.js";
import { Casa, RispostaNegativa } from "../src/casa.js";
import {
  Commissioni,
  eUnaCommissione,
  impacchetta,
  TIPO,
  TIPO_PLANCIA,
} from "../src/commissioni.js";
import { Configurazione } from "../src/configurazione.js";
import { BASE_DELLE_FOTO, BASE_DI_CASA, Foto } from "../src/foto.js";
import { Dispositivi } from "../src/dispositivi.js";
import { Plancia } from "../src/plancia.js";
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

async function casaFinta({ risposte = {} } = {}) {
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
        const canned = risposte[detto.type];
        if (canned instanceof Error) {
          presa.manda(
            JSON.stringify({
              id: detto.id,
              type: "result",
              success: false,
              error: { code: canned.code || "unknown_error", message: canned.message },
            }),
          );
          return;
        }
        presa.manda(
          JSON.stringify({ id: detto.id, type: "result", success: true, result: canned ?? null }),
        );
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
    prese,
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

/* ─── La plancia dentro l'add-on, e la sua configurazione ─────────────────── */

test("si riconosce cosa fa il ponte e cosa va in Home Assistant", () => {
  const cartella = mkdtempSync(join(tmpdir(), "commissioni-"));
  const con = new Commissioni({
    casa: casaDiProva(),
    registro: ZITTO,
    plancia: new Plancia(),
    configurazione: new Configurazione({ cartella }),
  });
  for (const tipo of [
    TIPO,
    TIPO_PLANCIA,
    "ponte/altro",
    "dashboardmodern/config/get",
    "dashboardmodern/config/set",
    "dashboardmodern/config/restore",
  ]) {
    assert.equal(con.riconosce({ type: tipo }), true, tipo);
  }
  /* La copia vecchia per utente si ferma qui; le altre chiavi vanno in casa. */
  assert.equal(
    con.riconosce({
      id: 12,
      type: "frontend/get_user_data",
      key: "dashboardmodern_integration_config",
    }),
    true,
  );
  assert.equal(
    con.riconosce({
      id: 700001,
      type: "frontend/get_user_data",
      key: "dashboardmodern_integration_config",
    }),
    false,
  );
  assert.equal(con.riconosce({ id: 12, type: "frontend/set_user_data", key: "altro" }), false);
  /* Senza il catalogo e le foto, quelli vanno in casa; le segnalazioni e la
   * chat invece si fermano sempre qui, per dire dove stanno. */
  for (const tipo of ["get_states", "dashboardmodern/www/list", "call_service"]) {
    assert.equal(con.riconosce({ type: tipo }), false, tipo);
  }
  assert.equal(con.riconosce({ type: "dashboardmodern/tickets/list" }), true);
  assert.equal(con.riconosce({}), false);

  /* Senza configurazione, la configurazione non e' cosa sua. */
  const senza = new Commissioni({ casa: casaDiProva(), registro: ZITTO });
  assert.equal(senza.riconosce({ type: "dashboardmodern/config/get" }), false);
  assert.equal(senza.riconosce({ type: TIPO }), true);

  assert.equal(eUnaCommissione('{"id":1,"type":"dashboardmodern/config/get"}'), true);
  assert.equal(eUnaCommissione('{"id":1,"type":"frontend/get_user_data","key":"x"}'), true);
  assert.equal(eUnaCommissione('{"id":1,"type":"get_states"}'), false);
  rmSync(cartella, { recursive: true, force: true });
});

test("i file della plancia vengono dall'add-on, senza andare in Home Assistant", async () => {
  const { scarica, chieste } = scaricaFinto();
  const plancia = new Plancia();
  const con = new Commissioni({ casa: casaDiProva(), registro: ZITTO, scarica, plancia });

  const dove = await con.rispondi({ id: 1, type: TIPO_PLANCIA });
  assert.equal(dove.success, true);
  assert.equal(dove.result.base, plancia.base);
  assert.deepEqual(dove.result.varianti, ["dashboard-en.html", "dashboard.html"]);

  const pagina = await con.rispondi({
    id: 2,
    type: TIPO,
    percorso: `${plancia.base}/legacy/dashboard.html`,
  });
  assert.equal(pagina.result.stato, 200);
  assert.equal(pagina.result.compresso, "gzip");
  assert.match(gunzipSync(Buffer.from(pagina.result.corpo, "base64")).toString(), /<html/);

  const vecchia = await con.rispondi({
    id: 3,
    type: TIPO,
    percorso: "/dashboardmodern_static/vecchia/legacy/dashboard.html",
  });
  assert.equal(vecchia.result.stato, 404);
  assert.equal(chieste.length, 0, "in Home Assistant non si va");

  /* Le chiamate REST invece si'. */
  await con.rispondi({ id: 4, type: TIPO, percorso: "/api/states" });
  assert.equal(chieste.length, 1);
});

test("senza la plancia nell'add-on, ponte/plancia dice di no e i file si chiedono a Home Assistant", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "senza-plancia-"));
  const { scarica, chieste } = scaricaFinto();
  const con = new Commissioni({
    casa: casaDiProva(),
    registro: ZITTO,
    scarica,
    plancia: new Plancia({ cartella }),
  });
  const dove = await con.rispondi({ id: 1, type: TIPO_PLANCIA });
  assert.equal(dove.success, false);
  assert.equal(dove.error.code, "not_found");
  await con.rispondi({
    id: 2,
    type: TIPO,
    percorso: "/dashboardmodern_static/x/legacy/dashboard.html",
  });
  assert.equal(chieste.length, 1);
  rmSync(cartella, { recursive: true, force: true });
});

test("la configurazione della plancia la tiene il ponte, con le stesse risposte dell'integrazione", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "commissioni-config-"));
  const con = new Commissioni({
    casa: casaDiProva(),
    registro: ZITTO,
    configurazione: new Configurazione({ cartella, adesso: () => 5000 }),
  });

  const vuota = await con.rispondi({ id: 1, type: "dashboardmodern/config/get" });
  assert.deepEqual(vuota, {
    id: 1,
    type: "result",
    success: true,
    result: {
      profile: "primary",
      requested_profile: null,
      snapshot: null,
      recoverable: [],
      profiles: [],
    },
  });

  const scritta = await con.rispondi({
    id: 2,
    type: "dashboardmodern/config/set",
    profile: "primary",
    snapshot: {
      values: { cd_stanze: '[{"name":"Sala"}]' },
      keys_revision: 1,
      writer_generation: 2,
      updated_at: 0,
    },
    expected_revision: 0,
  });
  assert.equal(scritta.success, true);
  assert.equal(scritta.result.status, "saved");
  assert.equal(scritta.result.snapshot.revision, 1);
  assert.equal(scritta.result.snapshot.updated_at, 5000);

  const conflitto = await con.rispondi({
    id: 3,
    type: "dashboardmodern/config/set",
    snapshot: { values: { cd_stanze: "[]" } },
    expected_revision: 0,
  });
  assert.equal(conflitto.result.status, "conflict");

  const letta = await con.rispondi({
    id: 4,
    type: "dashboardmodern/config/get",
    profile: "primary",
  });
  assert.equal(letta.result.snapshot.values.cd_stanze, '[{"name":"Sala"}]');

  const storta = await con.rispondi({
    id: 5,
    type: "dashboardmodern/config/set",
    snapshot: { values: "no" },
  });
  assert.equal(storta.success, false);
  assert.equal(storta.error.code, "invalid_format");
  const troppo = await con.rispondi({
    id: 6,
    type: "dashboardmodern/config/set",
    snapshot: { values: { a: "x".repeat(3 * 1024 * 1024) } },
  });
  assert.equal(troppo.error.code, "snapshot_too_large");
  const profilo = await con.rispondi({
    id: 7,
    type: "dashboardmodern/config/get",
    profile: "../x",
  });
  assert.equal(profilo.error.code, "invalid_format");

  const senzaRevisione = await con.rispondi({ id: 8, type: "dashboardmodern/config/restore" });
  assert.equal(senzaRevisione.error.code, "invalid_format");
  const ripristino = await con.rispondi({
    id: 9,
    type: "dashboardmodern/config/restore",
    revision: 42,
  });
  assert.equal(ripristino.result.status, "conflict");

  /* La copia vecchia per utente: una risposta innocua. */
  const vecchia = await con.rispondi({
    id: 10,
    type: "frontend/get_user_data",
    key: "dashboardmodern_integration_config",
  });
  assert.deepEqual(vecchia.result, { value: null });
  const scrittaVecchia = await con.rispondi({
    id: 11,
    type: "frontend/set_user_data",
    key: "dashboardmodern_integration_config",
    value: {},
  });
  assert.equal(scrittaVecchia.success, true);
  assert.equal(scrittaVecchia.result, null);
  rmSync(cartella, { recursive: true, force: true });
});

test("col ponte in mezzo: la configurazione non arriva in Home Assistant, le altre chiavi si'", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "ponte-config-"));
  const ha = await casaFinta();
  const casa = new Casa({ indirizzo: ha.indirizzo, segno: SEGNO_DEL_SUPERVISOR });
  const dispositivi = new Dispositivi({ cartella });
  const { segno } = dispositivi.abbina({ nome: "Prova" });
  const commissioni = new Commissioni({
    casa,
    registro: ZITTO,
    plancia: new Plancia(),
    configurazione: new Configurazione({ cartella }),
  });
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

  telefono.send(JSON.stringify({ id: 1, type: TIPO_PLANCIA }));
  telefono.send(
    JSON.stringify({
      id: 2,
      type: "dashboardmodern/config/set",
      snapshot: { values: { cd_stanze: '[{"name":"Sala"}]' } },
    }),
  );
  telefono.send(JSON.stringify({ id: 3, type: "dashboardmodern/config/get" }));
  telefono.send(
    JSON.stringify({
      id: 4,
      type: "frontend/get_user_data",
      key: "dashboardmodern_integration_config",
    }),
  );
  telefono.send(JSON.stringify({ id: 5, type: "frontend/get_user_data", key: "core.profile" }));
  telefono.send(JSON.stringify({ id: 6, type: "dashboardmodern/www/list" }));
  await attendi(() => detti.filter((uno) => uno.type === "result").length === 6);

  assert.equal(detti.find((uno) => uno.id === 1).result.base, new Plancia().base);
  assert.equal(detti.find((uno) => uno.id === 2).result.status, "saved");
  assert.equal(detti.find((uno) => uno.id === 3).result.snapshot.revision, 1);
  assert.deepEqual(detti.find((uno) => uno.id === 4).result, { value: null });
  /* In Home Assistant sono arrivate solo le cose sue. */
  assert.deepEqual(
    ha.arrivate.filter((una) => una.filo).map((una) => una.filo.type),
    ["frontend/get_user_data", "dashboardmodern/www/list"],
  );
  assert.equal(
    ha.arrivate.find((una) => una.filo?.type === "frontend/get_user_data").filo.key,
    "core.profile",
  );

  /* E la configurazione e' sul disco del ponte. */
  assert.equal(new Configurazione({ cartella }).leggi().snapshot.revision, 1);

  telefono.close();
  ponte.chiudiTutto();
  await new Promise((ok) => server.close(ok));
  await ha.spegni();
  rmSync(cartella, { recursive: true, force: true });
});

/* ─── Le domande del ponte a Home Assistant ──────────────────────────────── */

test("il ponte fa le sue domande a Home Assistant su un filo suo, e lo riapre se cade", async (t) => {
  const negata = new Error("solo un amministratore");
  negata.code = "unauthorized";
  const ha = await casaFinta({
    risposte: { "config/device_registry/list": [{ id: "d1" }], "manifest/list": negata },
  });
  const casa = new Casa({ indirizzo: ha.indirizzo, segno: SEGNO_DEL_SUPERVISOR });
  /* Comunque vada, si chiude tutto: un socket lasciato aperto tiene in piedi
   * il processo delle prove per sempre. */
  t.after(async () => {
    casa.chiudiIlFiloMio();
    await ha.spegni();
  });

  assert.deepEqual(await casa.chiedi({ type: "config/device_registry/list" }), [{ id: "d1" }]);
  const [prima, seconda] = await Promise.all([
    casa.chiedi({ type: "config/device_registry/list" }),
    casa.chiedi({ type: "config/area_registry/list" }),
  ]);
  assert.deepEqual(prima, [{ id: "d1" }]);
  assert.equal(seconda, null);
  assert.equal(ha.prese.length, 1, "un filo solo per tutte le domande");
  /* La stretta di mano l'ha fatta il ponte: i numeri delle domande sono suoi. */
  const numeri = ha.arrivate.filter((una) => una.filo).map((una) => una.filo.id);
  assert.deepEqual(numeri, [1, 2, 3]);

  await assert.rejects(
    () => casa.chiedi({ type: "manifest/list" }),
    (errore) => errore instanceof RispostaNegativa && errore.code === "unauthorized",
  );

  /* Home Assistant chiude: la domanda dopo riapre il filo da sola. */
  for (const presa of ha.prese) presa.chiudi();
  await attendi(() => !casa._mio);
  assert.deepEqual(await casa.chiedi({ type: "config/device_registry/list" }), [{ id: "d1" }]);
  assert.equal(ha.prese.length, 2);
});

/* ─── Il catalogo, le foto, e quello che sta nell'app ────────────────────── */

test("si riconoscono il catalogo, le foto e le cose che stanno nell'app", () => {
  const cartella = mkdtempSync(join(tmpdir(), "commissioni-foto-"));
  const con = new Commissioni({
    casa: casaDiProva(),
    registro: ZITTO,
    catalogo: { chiedi: async () => ({ integrations: [], devices: [], entities: [] }) },
    foto: new Foto({ cartella }),
  });
  assert.equal(con.riconosce({ type: "dashboardmodern/integrations/catalog" }), true);
  assert.equal(con.riconosce({ type: "dashboardmodern/www/list" }), true);
  assert.equal(con.riconosce({ type: "dashboardmodern/www/upload" }), true);
  assert.equal(con.riconosce({ type: "dashboardmodern/tickets/list" }), true);
  assert.equal(con.riconosce({ type: "dashboardmodern/chat/send" }), true);
  assert.equal(con.riconosce({ type: "dashboardmodern/altro" }), false);

  const senza = new Commissioni({ casa: casaDiProva(), registro: ZITTO });
  assert.equal(senza.riconosce({ type: "dashboardmodern/integrations/catalog" }), false);
  assert.equal(senza.riconosce({ type: "dashboardmodern/www/list" }), false);
  assert.equal(senza.riconosce({ type: "dashboardmodern/tickets/list" }), true);
  rmSync(cartella, { recursive: true, force: true });
});

test("le segnalazioni e la chat rispondono con una frase, non con un comando sconosciuto", async () => {
  const con = new Commissioni({ casa: casaDiProva(), registro: ZITTO });
  const risposta = await con.rispondi({
    id: 4,
    type: "dashboardmodern/tickets/create",
    title: "x",
  });
  assert.equal(risposta.success, false);
  assert.equal(risposta.error.code, "not_supported");
  assert.match(risposta.error.message, /nell'app/);
});

test("il catalogo passa dal ponte, coi dispositivi chiesti", async () => {
  const chieste = [];
  const con = new Commissioni({
    casa: casaDiProva(),
    registro: ZITTO,
    catalogo: {
      async chiedi({ deviceIds }) {
        chieste.push(deviceIds);
        return { integrations: [{ domain: "hon" }], devices: [], entities: [] };
      },
    },
  });
  const tutto = await con.rispondi({ id: 1, type: "dashboardmodern/integrations/catalog" });
  assert.equal(tutto.success, true);
  assert.deepEqual(tutto.result.integrations, [{ domain: "hon" }]);
  await con.rispondi({
    id: 2,
    type: "dashboardmodern/integrations/catalog",
    device_ids: ["d-lav"],
  });
  assert.deepEqual(chieste, [null, ["d-lav"]]);

  const storta = await con.rispondi({
    id: 3,
    type: "dashboardmodern/integrations/catalog",
    device_ids: "d-lav",
  });
  assert.equal(storta.error.code, "invalid_format");
  const troppi = await con.rispondi({
    id: 4,
    type: "dashboardmodern/integrations/catalog",
    device_ids: Array.from({ length: 201 }, (_, i) => `d${i}`),
  });
  assert.equal(troppi.error.code, "invalid_format");

  const rotto = new Commissioni({
    casa: casaDiProva(),
    registro: ZITTO,
    catalogo: {
      async chiedi() {
        const errore = new Error("Home Assistant non ha risposto in tempo");
        throw errore;
      },
    },
  });
  const senzaRisposta = await rotto.rispondi({
    id: 5,
    type: "dashboardmodern/integrations/catalog",
  });
  assert.equal(senzaRisposta.success, false);
  assert.match(senzaRisposta.error.message, /non ha risposto/);
});

test("le foto si caricano e si elencano dal ponte, e la pagina le riceve come file", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "commissioni-foto-"));
  const { scarica, chieste } = scaricaFinto();
  const con = new Commissioni({
    casa: casaDiProva(),
    registro: ZITTO,
    scarica,
    foto: new Foto({ cartella: join(cartella, "www") }),
  });
  const png = Buffer.concat([Buffer.from("\x89PNG\r\n\x1a\n", "latin1"), Buffer.alloc(16, 7)]);

  const vuoto = await con.rispondi({ id: 1, type: "dashboardmodern/www/list" });
  assert.equal(vuoto.success, true);
  assert.equal(vuoto.result.available, false);

  const caricata = await con.rispondi({
    id: 2,
    type: "dashboardmodern/www/upload",
    filename: "Auto.png",
    data: png.toString("base64"),
  });
  assert.equal(caricata.success, true);
  assert.equal(caricata.result.path, `${BASE_DELLE_FOTO}/dashboardmodern/auto.png`);

  const elenco = await con.rispondi({
    id: 3,
    type: "dashboardmodern/www/list",
    path: "dashboardmodern",
  });
  assert.deepEqual(
    elenco.result.images.map((una) => una.url),
    [`${BASE_DELLE_FOTO}/dashboardmodern/auto.png`],
  );
  const fuori = await con.rispondi({ id: 4, type: "dashboardmodern/www/list", path: "../" });
  assert.equal(fuori.error.code, "not_found");

  const nonUnaFoto = await con.rispondi({
    id: 5,
    type: "dashboardmodern/www/upload",
    filename: "x.png",
    data: Buffer.from("questo e' testo, non un png").toString("base64"),
  });
  assert.equal(nonUnaFoto.error.code, "invalid_upload");
  const senzaNome = await con.rispondi({ id: 6, type: "dashboardmodern/www/upload", data: "AAAA" });
  assert.equal(senzaNome.error.code, "invalid_format");

  /* E la pagina la chiede come un file qualunque: dal ponte, non da Home
   * Assistant. */
  const servita = await con.rispondi({ id: 7, type: TIPO, percorso: caricata.result.path });
  assert.equal(servita.result.stato, 200);
  assert.equal(servita.result.tipo, "image/png");
  assert.deepEqual(Buffer.from(servita.result.corpo, "base64"), png);
  assert.equal(chieste.length, 0);
  rmSync(cartella, { recursive: true, force: true });
});

test("chi non sa aprire il gzip lo dice, e il ponte non comprime", () => {
  /* Un browser non ha `dart:io` e il gzip non lo apre. Mettersi in casa un
   * decompressore per una cosa che si puo' semplicemente non fare e' il modo
   * lungo: chi non sa aprirlo lo dice, e il ponte non comprime. */
  const testo = Buffer.from("x".repeat(4096));
  const compresso = impacchetta(200, "text/html", testo);
  assert.equal(compresso.compresso, "gzip");

  const nudo = impacchetta(200, "text/html", testo, { senzaGzip: true });
  assert.equal(nudo.compresso, undefined);
  assert.equal(Buffer.from(nudo.corpo, "base64").toString(), testo.toString());
});

test("chi non lo chiede riceve quello che riceveva prima", () => {
  const testo = Buffer.from("y".repeat(4096));
  assert.equal(impacchetta(200, "text/css", testo, {}).compresso, "gzip");
});

/* ─── Le foto che stanno gia' in Home Assistant ──────────────────────────── */

/* Chi ha una casa da qualche anno ha le foto delle auto, i loghi e gli sfondi
 * in `config/www`, e la plancia li ha sempre chiamati `/local/…`. Il ponte ci
 * entra in sola lettura e li serve con quello stesso indirizzo: cosi' una
 * configurazione fatta dall'app mostra la stessa foto nella plancia dentro
 * Home Assistant, e viceversa. */

function dueCartelle() {
  const dove = mkdtempSync(join(tmpdir(), "due-"));
  mkdirSync(join(dove, "casa", "www"), { recursive: true });
  writeFileSync(
    join(dove, "casa", "www", "auto.png"),
    Buffer.concat([Buffer.from("\x89PNG\r\n\x1a\n", "latin1"), Buffer.alloc(16, 1)]),
  );
  /* Il nome che le ha dato chi l'ha scattata, con lo spazio dentro. */
  writeFileSync(
    join(dove, "casa", "www", "mia auto.png"),
    Buffer.concat([Buffer.from("\x89PNG\r\n\x1a\n", "latin1"), Buffer.alloc(16, 2)]),
  );
  return {
    dove,
    foto: new Foto({ cartella: join(dove, "ponte", "www") }),
    fotoDiCasa: new Foto({
      cartella: join(dove, "casa", "www"),
      base: BASE_DI_CASA,
      scrivibile: false,
    }),
    via: () => rmSync(dove, { recursive: true, force: true }),
  };
}

test("una foto di casa col nome che le ha dato chi l'ha scattata", async () => {
  /* Sotto `/local/` i nomi li sceglie l'utente, e «mia auto.png» arriva col
   * suo spazio dentro: il servitore dell'app scioglie i segni di percentuale
   * prima di chiedere, perche' il nome di un file e' il nome. Prima lo spazio
   * era «percorso non valido» e la foto dell'auto non si vedeva — nel browser
   * dentro Home Assistant si vedeva. */
  const { fotoDiCasa, via } = dueCartelle();
  try {
    const commissioni = new Commissioni({
      casa: casaDiProva(),
      registro: ZITTO,
      fotoDiCasa,
    });
    const risposta = await commissioni.rispondi({
      id: 11,
      type: TIPO,
      percorso: "/local/mia auto.png",
    });
    assert.equal(risposta.success, true);
    assert.equal(risposta.result.stato, 200);
    assert.equal(risposta.result.tipo, "image/png");
  } finally {
    via();
  }
});

test("l'elenco delle foto dice in quale cartella si guarda, e quali ci sono", async () => {
  const { foto, fotoDiCasa, via } = dueCartelle();
  try {
    const commissioni = new Commissioni({
      casa: casaDiProva(),
      registro: ZITTO,
      foto,
      fotoDiCasa,
    });

    /* Senza dire niente si guarda nel ponte: e' come era prima, e una
     * versione vecchia dell'app non deve trovarsi sotto le mani una cartella
     * che non si aspetta. */
    const suo = await commissioni.rispondi({ id: 1, type: "dashboardmodern/www/list" });
    assert.equal(suo.result.root, "ponte");
    assert.deepEqual(suo.result.images, []);
    assert.deepEqual(suo.result.roots, { ponte: false, casa: true });

    const diCasa = await commissioni.rispondi({
      id: 2,
      type: "dashboardmodern/www/list",
      root: "casa",
    });
    assert.equal(diCasa.result.root, "casa");
    /* Anche quella col nome «normale», con lo spazio dentro: l'elenco la
     * mostra, e il suo indirizzo lo sa portare. */
    assert.deepEqual(diCasa.result.images.map((una) => una.url).sort(), [
      "/local/auto.png",
      "/local/mia auto.png",
    ]);
  } finally {
    via();
  }
});

test("una foto di Home Assistant si serve a `/local/…`, e non ci si scrive", async () => {
  const { foto, fotoDiCasa, via } = dueCartelle();
  try {
    const commissioni = new Commissioni({
      casa: casaDiProva(),
      registro: ZITTO,
      foto,
      fotoDiCasa,
    });

    const letta = await commissioni.rispondi({
      id: 1,
      type: TIPO,
      metodo: "GET",
      percorso: "/local/auto.png",
      senzaGzip: true,
    });
    assert.equal(letta.result.stato, 200);
    assert.equal(letta.result.tipo, "image/png");

    /* Dalla cartella non si esce: e' l'unico modo in cui una richiesta
     * potrebbe leggere le automazioni o i segreti di chi ci abita. */
    const fuori = await commissioni.rispondi({
      id: 2,
      type: TIPO,
      metodo: "GET",
      percorso: "/local/secrets.yaml",
      senzaGzip: true,
    });
    assert.equal(fuori.result.stato, 404);

    /* Il caricamento va sempre nella cartella del ponte, mai in quella di
     * Home Assistant. */
    const messa = await commissioni.rispondi({
      id: 3,
      type: "dashboardmodern/www/upload",
      filename: "nuova.png",
      data: Buffer.concat([
        Buffer.from("\x89PNG\r\n\x1a\n", "latin1"),
        Buffer.alloc(16, 1),
      ]).toString("base64"),
    });
    assert.match(messa.result.path, /^\/dashboardmodern_static\/www\//);
  } finally {
    via();
  }
});

test("senza la cartella di Home Assistant non succede niente di male", async () => {
  /* L'add-on aggiornato ma non ancora riavviato non ce l'ha mappata. Prima
   * qui il ponte cadeva a meta' accensione. */
  const commissioni = new Commissioni({
    casa: casaDiProva(),
    registro: ZITTO,
    foto: new Foto({ cartella: join(tmpdir(), "non-esiste-mai", "www") }),
    fotoDiCasa: new Foto({ cartella: "", base: BASE_DI_CASA, scrivibile: false }),
  });
  const detto = await commissioni.rispondi({
    id: 1,
    type: "dashboardmodern/www/list",
    root: "casa",
  });
  assert.equal(detto.result.available, false);
  assert.deepEqual(detto.result.roots, { ponte: false, casa: false });
});
