/* Aprire la plancia dentro Home Assistant non deve suonare la campanella.
 *
 * «Da qualche aggiornamento, quando apro la plancia su HA mi arriva sempre la
 * notifica di "login fallito", anche se di fatto poi funziona tutto.» E' la
 * notifica del componente `http` di Home Assistant: «Login attempt or request
 * with invalid authentication from …». Home Assistant la scrive per ogni
 * richiesta all'API con un `Authorization` che non vale, per ogni richiesta
 * senza credenziali a una porta che le vuole, e per ogni `auth` rifiutato sul
 * WebSocket.
 *
 * Qui gira la catena vera, come in casa: il ponte vero (`ponte/src/index.js`)
 * dietro la Home Assistant finta del collaudo, la pagina d'apertura vera che
 * il ponte scrive nella `www`, l'ingress fatto da questo file — con la
 * sessione e l'utente che mette il Supervisor — e davanti una pagina che fa
 * da frontend di Home Assistant (`home-assistant` con il suo `hass`). La
 * finta porta 8123 conta, con le regole di Home Assistant, ogni richiesta che
 * farebbe scrivere quella notifica.
 *
 * Due aperture: la prima con un dispositivo pulito, la seconda con un gettone
 * vecchio rimasto nel salvataggio del collegamento della plancia
 * (`cd_connection`) — un backup della plancia autonoma, la sincronizzazione di
 * una volta. Era la seconda a suonare: la plancia ospitata lo prendeva per
 * buono e lo mandava come `Bearer` alle istantanee delle telecamere e ai
 * calendari (`sections/shared.js`, `gettoneDiAccesso`). */
import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, request as chiediHttp } from "node:http";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  alzaLaCasaFinta,
  AMMINISTRATORE_DEL_COLLAUDO,
  SCATTO_DEMO,
  SEGNO_DEL_SUPERVISOR,
} from "../../../../../collaudo/casa-finta.js";

const RADICE = fileURLToPath(new URL("../../../../../", import.meta.url));
const PONTE = join(RADICE, "ponte");
/* Il gettone di chi guarda: il frontend di Home Assistant ce l'ha, la plancia
 * non lo vede mai. */
const GETTONE_DEL_PANNELLO = "gettone-buono-del-pannello";
const INGRESSO = "/api/hassio_ingress/GettoneDellIngresso_e2e";
const SESSIONE = "sessione-dell-ingresso";
const attendi = (ms) => new Promise((ok) => setTimeout(ok, ms));

/* Le porte di Home Assistant che non chiedono niente a nessuno, o che hanno il
 * loro gettone nell'indirizzo e a chi non ce l'ha rispondono 403 (le entita'
 * della casa demo ci sono tutte). Tutto il resto dell'API, senza credenziali,
 * e' un 401 — e un 401 e' la notifica. */
const SENZA_CREDENZIALI = [
  /^\/api\/hassio_ingress\//,
  /^\/api\/hassio\/addons\/[^/]+\/(?:icon|logo)$/,
  /^\/api\/image\/serve\//,
  /^\/api\/tts_proxy\//,
  /^\/api\/hls\//,
  /^\/api\/(?:camera_proxy|camera_proxy_stream|image_proxy|media_player_proxy)\//,
  /^\/api\/brands\//,
];
/* Le porte che vogliono le credenziali, quelle che la plancia potrebbe
 * chiedere. Un indirizzo `/api/` che Home Assistant non conosce e' un 404, e
 * la casa demo ne ha (le sue foto finte): quelli non suonano. */
const CON_CREDENZIALI = [
  /^\/api\/?$/,
  /^\/api\/(?:states|history|calendars|services|logbook|config|events|template|error_log)(?:\/|$)/,
  /^\/api\/image\/upload$/,
  /^\/media\//,
  /^\/auth\/(?:token|login_flow)/,
];

function suonerebbe(richiesta, url) {
  const via = url.pathname;
  const intestazione = richiesta.headers.authorization;
  if (intestazione === `Bearer ${GETTONE_DEL_PANNELLO}`) return "";
  if (url.searchParams.has("authSig")) return "";
  /* Un `Bearer` che non vale suona dappertutto, anche sulle porte delle
   * telecamere: e' un tentativo di entrare, per Home Assistant. */
  if (intestazione !== undefined) return `Authorization «${intestazione}»`;
  if (SENZA_CREDENZIALI.some((una) => una.test(via))) return "";
  if (CON_CREDENZIALI.some((una) => una.test(via))) return "senza credenziali";
  return "";
}

/* La pagina di Home Assistant: l'elemento `home-assistant` col suo `hass`, e
 * la tessera «pagina web» della Plancia che apre la pagina d'apertura. */
function laPaginaDiHomeAssistant() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Home Assistant</title></head>
<body style="margin:0"><home-assistant></home-assistant><script>
  const ha = document.querySelector("home-assistant");
  const risposte = {
    "/addons/gdahome/info": { state: "started", ingress_url: ${JSON.stringify(`${INGRESSO}/`)} },
    "/ingress/session": { session: ${JSON.stringify(SESSIONE)} },
    "/ingress/validate_session": {},
  };
  ha.hass = {
    user: { id: ${JSON.stringify(AMMINISTRATORE_DEL_COLLAUDO)}, is_admin: true, name: "Chi guarda" },
    locale: { language: "it" },
    language: "it",
    auth: { data: { access_token: ${JSON.stringify(GETTONE_DEL_PANNELLO)} } },
    callWS(m) {
      if (m.type !== "supervisor/api") return Promise.resolve(null);
      const via = String(m.endpoint).replace(/^\\/addons\\/[^/]+\\/info$/, "/addons/gdahome/info");
      return Promise.resolve(risposte[via] || {});
    },
    callApi() { return Promise.reject(new Error("niente REST")); },
  };
  ha.hass.connection = { sendMessagePromise: (m) => ha.hass.callWS(m) };
  const cornice = document.createElement("iframe");
  cornice.style.cssText = "width:100vw;height:100vh;border:0";
  cornice.src = "/local/gdahome/apri.html?addon=gdahome";
  ha.appendChild(cornice);
</script></body></html>`;
}

const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".json": "application/json",
};

async function unaPortaLibera() {
  return new Promise((ok) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const porta = server.address().port;
      server.close(() => ok(porta));
    });
  });
}

/* Quello che l'ingress aggiunge davanti all'add-on. */
function intestazioniDellIngress(richiesta) {
  return {
    ...richiesta.headers,
    "x-remote-user-id": AMMINISTRATORE_DEL_COLLAUDO,
    "x-ingress-path": INGRESSO,
  };
}

async function alzaLaCatena() {
  const spegni = [];
  const casa = alzaLaCasaFinta();
  const portaDellaCasa = await casa.ascolta();
  spegni.push(() => casa.spegni());

  const archivio = mkdtempSync(join(tmpdir(), "nessun-login-fallito-"));
  spegni.push(() => rmSync(archivio, { recursive: true, force: true }));
  const www = join(archivio, "www");
  mkdirSync(www, { recursive: true });
  const portaDelPonte = await unaPortaLibera();
  const portaDellaConsole = await unaPortaLibera();
  writeFileSync(
    join(archivio, "options.json"),
    JSON.stringify({ porta_app: portaDelPonte, dispositivi_massimi: 5, registro: "info" }),
  );
  writeFileSync(
    join(archivio, "plancia.json"),
    JSON.stringify({ profiles: { primary: { ...SCATTO_DEMO, history: [] } } }),
  );
  const ponte = spawn(process.execPath, [join(PONTE, "src", "index.js")], {
    env: {
      ...process.env,
      PONTE_ARCHIVIO: archivio,
      PONTE_CONSOLE: join(PONTE, "console"),
      PONTE_PORTA_CONSOLE: String(portaDellaConsole),
      PONTE_PROXY_INGRESS: "127.0.0.1",
      SUPERVISOR_TOKEN: SEGNO_DEL_SUPERVISOR,
      PONTE_CASA: `http://127.0.0.1:${portaDellaCasa}`,
      PONTE_SUPERVISOR: `http://127.0.0.1:${portaDellaCasa}`,
      PONTE_MARCHI: `http://127.0.0.1:${portaDellaCasa}/`,
      PONTE_CENTRALINO: "http://127.0.0.1:9",
      PONTE_CHAT: "http://127.0.0.1:9",
      PONTE_QUADRO_DOVE: "http://127.0.0.1:9",
      PONTE_WWW_CASA: www,
    },
    stdio: ["ignore", "ignore", "ignore"],
  });
  spegni.unshift(
    () =>
      new Promise((ok) => {
        ponte.once("exit", ok);
        ponte.kill("SIGKILL");
      }),
  );
  const apertura = join(www, "gdahome", "apri.html");
  for (let i = 0; i < 200 && !existsSync(apertura); i += 1) await attendi(100);
  if (!existsSync(apertura)) throw new Error("il ponte non ha scritto la pagina d'apertura");

  /* ─── La porta 8123 ─── */
  const campanella = [];
  const prese = [];
  const front = createServer((richiesta, risposta) => {
    const url = new URL(richiesta.url || "/", "http://casa");
    if (url.pathname === "/") {
      risposta.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      risposta.end(laPaginaDiHomeAssistant());
      return;
    }
    if (url.pathname.startsWith("/local/")) {
      const file = join(www, decodeURIComponent(url.pathname.slice("/local/".length)));
      if (!file.startsWith(www) || !existsSync(file)) {
        risposta.writeHead(404);
        risposta.end();
        return;
      }
      risposta.writeHead(200, {
        "content-type": TIPI[extname(file)] || "application/octet-stream",
      });
      risposta.end(readFileSync(file));
      return;
    }
    if (url.pathname.startsWith(`${INGRESSO}/`)) {
      const dietro = chiediHttp(
        {
          host: "127.0.0.1",
          port: portaDellaConsole,
          method: richiesta.method,
          path: url.pathname.slice(INGRESSO.length) + url.search,
          headers: intestazioniDellIngress(richiesta),
        },
        (r) => {
          risposta.writeHead(r.statusCode || 502, r.headers);
          r.pipe(risposta);
        },
      );
      dietro.on("error", () => {
        risposta.writeHead(502);
        risposta.end();
      });
      richiesta.pipe(dietro);
      return;
    }
    const perche = suonerebbe(richiesta, url);
    if (perche) {
      campanella.push(`${richiesta.method} ${url.pathname}${url.search}: ${perche}`);
      risposta.writeHead(401, { "content-type": "text/plain" });
      risposta.end("401: Unauthorized");
      return;
    }
    risposta.writeHead(404, { "content-type": "text/plain" });
    risposta.end("404: Not Found");
  });
  front.on("upgrade", (richiesta, presa, testa) => {
    const url = new URL(richiesta.url || "/", "http://casa");
    prese.push(url.pathname);
    if (!url.pathname.startsWith(`${INGRESSO}/`)) {
      /* Una presa diretta verso Home Assistant: dalla plancia ospitata non deve
       * partirne nessuna, e un `auth` senza un gettone buono sarebbe la
       * notifica. Qui non si apre nemmeno. */
      campanella.push(`WebSocket diretto ${url.pathname}`);
      presa.destroy();
      return;
    }
    const dietro = connect(portaDellaConsole, "127.0.0.1", () => {
      let righe = `${richiesta.method} ${url.pathname.slice(INGRESSO.length)}${url.search} HTTP/1.1\r\n`;
      for (const [nome, valore] of Object.entries(intestazioniDellIngress(richiesta)))
        righe += `${nome}: ${valore}\r\n`;
      dietro.write(`${righe}\r\n`);
      if (testa?.length) dietro.write(testa);
      presa.pipe(dietro).pipe(presa);
    });
    dietro.on("error", () => presa.destroy());
    presa.on("error", () => dietro.destroy());
  });
  await new Promise((ok) => front.listen(0, "127.0.0.1", ok));
  spegni.unshift(() => new Promise((ok) => front.close(() => ok())));
  front.unref?.();

  return {
    indirizzo: `http://127.0.0.1:${front.address().port}/`,
    campanella,
    prese,
    async abbassa() {
      for (const una of spegni) {
        try {
          await una();
        } catch (_errore) {
          /* Gli altri si spengono lo stesso. */
        }
      }
    },
  };
}

function laPlancia(pagina) {
  return pagina.frames().find((cornice) => cornice.url().includes(`${INGRESSO}/plancia/`));
}

/* Collegata davvero (il pallino verde viene da `auth_ok`), e poi il tempo che
 * le sezioni chiedano le loro foto e i loro calendari. */
async function apertaECollegata(pagina) {
  await expect
    .poll(
      async () =>
        (await laPlancia(pagina)
          ?.evaluate(() => document.getElementById("live-dot")?.classList.contains("connected"))
          .catch(() => false)) === true,
      { timeout: 60_000 },
    )
    .toBe(true);
  await attendi(8_000);
}

test("aprire la plancia dentro Home Assistant non fa nessuna richiesta con credenziali che non valgono", async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "la catena vera si prova su un browser solo");
  test.setTimeout(180_000);
  const catena = await alzaLaCatena();
  const contesto = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const pagina = await contesto.newPage();
    await pagina.goto(catena.indirizzo);
    await apertaECollegata(pagina);
    expect(catena.campanella, "prima apertura").toEqual([]);

    /* Il gettone vecchio nel salvataggio del collegamento, scritto come lo
     * scriverebbe la plancia stessa (con il suo spazio dei nomi). */
    const spazio = await laPlancia(pagina).evaluate(() => {
      localStorage.setItem(
        "cd_connection",
        JSON.stringify({ token: "gettone-lungo-revocato", admin_users: [] }),
      );
      return window.__DASHBOARDMODERN_STORAGE_NS__;
    });
    expect(spazio).toBeTruthy();
    await pagina.reload();
    await apertaECollegata(pagina);
    expect(catena.campanella, "con un gettone vecchio nel collegamento").toEqual([]);

    /* E tutte le prese della plancia vanno al ponte, dall'ingress. */
    expect(catena.prese.length).toBeGreaterThan(0);
    expect(catena.prese.filter((via) => !via.startsWith(`${INGRESSO}/`))).toEqual([]);
  } finally {
    await contesto.close();
    await catena.abbassa();
  }
});
