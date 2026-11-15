/* La seconda plancia dentro Home Assistant, a muro, su una casa lenta.
 *
 * «Ha difficolta' ad aprire la pagina della plancia su HA. Quando l'ha aperta
 * le entita' sono "non trovate" per poi dopo arrivare. Le "luci centrali" non
 * le spegne.» Da un tester con una casa Premium, due plance — la principale e
 * «salone», un pannello a muro che prende le luci dalla principale — e un
 * tablet sempre acceso.
 *
 * Qui gira la catena vera, come in `dentro-home-assistant-nessun-login-
 * fallito.spec.js`: il ponte vero con la casa Premium (il gettone sul disco, il
 * quadro che non risponde), la pagina d'apertura, l'ingress, e una Home
 * Assistant finta che a ogni connessione nuova risponde con tre secondi di
 * ritardo. Si apre «salone» e si guarda:
 *
 *  - la presa della plancia non si chiude prima di essere entrata: le sezioni
 *    che mandano qualcosa appena la presa e' aperta (la chat, l'orecchio della
 *    configurazione, un tocco) prima la facevano chiudere al ponte, e la
 *    plancia ripartiva da capo dopo cinque secondi con le luci «Non trovata»;
 *  - il pannello chiede licenza e plancia di origine una volta sola, non tredici;
 *  - il pannello e' pronto con le luci, e un tocco spegne la luce davvero. */
import { expect, test } from "@playwright/test";
import { unGettone, PUBBLICA_DI_PROVA } from "../../../../../ponte/test/gettoni-di-prova.js";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, request as chiediHttp } from "node:http";
import { connect, createServer as createNetServer } from "node:net";
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
function laPaginaDiHomeAssistant(apertura = "/local/gdahome/apri.html?addon=gdahome") {
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
  cornice.src = ${JSON.stringify(apertura)};
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

async function alzaLaCatena({ licenza = "spente", ritardo = 0, muro = null } = {}) {
  const spegni = [];
  const casa = alzaLaCasaFinta();
  const portaVeraDellaCasa = await casa.ascolta();
  spegni.push(() => casa.spegni());
  /* Una casa lenta: ogni connessione nuova verso Home Assistant — i fili
   * che il ponte apre per ogni presa della pagina, e le sue domande — aspetta
   * `ritardo` ms. E' quello che si vede da dentro l'add-on quando Home
   * Assistant o il Supervisor sono carichi. */
  const tutte = new Set();
  const lenta = createNetServer((dentro) => {
    tutte.add(dentro);
    dentro.pause();
    setTimeout(
      () => {
        const fuori = connect(portaVeraDellaCasa, "127.0.0.1", () => {
          dentro.pipe(fuori).pipe(dentro);
          dentro.resume();
        });
        fuori.on("error", () => dentro.destroy());
        dentro.on("error", () => fuori.destroy());
      },
      typeof ritardo === "function" ? ritardo() : ritardo,
    );
  });
  await new Promise((ok) => lenta.listen(0, "127.0.0.1", ok));
  spegni.unshift(() => {
    for (const una of tutte) una.destroy();
    lenta.close();
  });
  const portaDellaCasa = lenta.address().port;

  const archivio = mkdtempSync(join(tmpdir(), "la-plancia-salone-"));
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
    JSON.stringify({
      profiles: {
        primary: { ...SCATTO_DEMO, history: [] },
        salone: {
          ...SCATTO_DEMO,
          values: { ...SCATTO_DEMO.values, ...(muro ? { cd_muro: JSON.stringify(muro) } : {}) },
          history: [],
        },
      },
    }),
  );
  writeFileSync(
    join(archivio, "plance.json"),
    JSON.stringify({
      plance: [
        { profilo: "primary", titolo: "GdAHome" },
        { profilo: "salone", titolo: "SALONE", creata_il: 1 },
      ],
    }),
  );
  const CASA_ID = "casa_0123456789abcdef0123456789abcdef";
  writeFileSync(
    join(archivio, "casa.json"),
    JSON.stringify({ casa: CASA_ID, segreto: "s".repeat(40), natoIl: 1 }),
  );
  if (licenza === "premium") {
    const g = unGettone({ sog: CASA_ID });
    writeFileSync(
      join(archivio, "licenze.json"),
      JSON.stringify({
        gettoni: { gdahome: g },
        licenze: [],
        ricevutiIl: Date.now(),
        vista: Date.now(),
      }),
    );
  }
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
      ...(licenza !== "spente" ? { PONTE_CHIAVE_LICENZE: PUBBLICA_DI_PROVA } : {}),
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
      risposta.end(laPaginaDiHomeAssistant(url.searchParams.get("apri") || undefined));
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

const MURO = {
  attiva: true,
  fonte: "primary",
  pagine: [{ id: "p1", modello: "stanza", stanza: "Soggiorno" }],
};
const FARETTI = "light.soggiorno_faretti";

test("«salone» a muro, Premium, su una casa lenta: pronta, con le luci, e la luce si spegne", async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "la catena vera si prova su un browser solo");
  test.setTimeout(180_000);
  const catena = await alzaLaCatena({ licenza: "premium", muro: MURO, ritardo: 3000 });
  const contesto = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  /* Le prese chiuse dal ponte prima dell'`auth_ok` dopo aver mandato qualcosa
   * per Home Assistant: e' cosi' che la plancia ripartiva da capo. */
  const perse = [];
  const domande = [];
  try {
    const pagina = await contesto.newPage();
    pagina.on("websocket", (presa) => {
      let entrata = false;
      const prima = [];
      presa.on("framereceived", (f) => {
        if (String(f.payload).includes('"auth_ok"')) entrata = true;
      });
      presa.on("close", () => {
        if (!entrata && prima.length) perse.push(prima.join(", "));
      });
      presa.on("framesent", (f) => {
        const tipo = /"type":"([^"]+)"/.exec(String(f.payload))?.[1] || "";
        if (!entrata && !/^(ponte|dashboardmodern|frontend)\//.test(tipo)) prima.push(tipo);
        if (tipo === "ponte/licenza/stato" || tipo === "dashboardmodern/config/get")
          domande.push(`${tipo} ${/"profile":"([^"]+)"/.exec(String(f.payload))?.[1] || ""}`);
      });
    });
    const apri = encodeURIComponent(
      "/local/gdahome/apri.html?addon=gdahome&profilo=salone&titolo=SALONE",
    );
    const partita = Date.now();
    await pagina.goto(`${catena.indirizzo}?apri=${apri}`);

    const statoDeiFaretti = () =>
      laPlancia(pagina)
        ?.evaluate(
          (id) =>
            document
              .querySelector(`#dm-muro [data-mu-entita="${id}"]`)
              ?.closest(".mu-carta")
              ?.querySelector(".mu-stato")?.textContent || "",
          FARETTI,
        )
        .catch(() => "") ?? "";
    await expect.poll(statoDeiFaretti, { timeout: 30_000 }).toMatch(/^Accesa/);
    /* Tre secondi per ogni filo verso la casa: la pagina, la presa, la
     * licenza. Prima erano undici, con la presa rifatta da capo. */
    expect(Date.now() - partita).toBeLessThan(15_000);
    expect(perse, "nessuna presa chiusa per un messaggio arrivato prima della casa").toEqual([]);
    expect(domande.filter((una) => una.startsWith("ponte/licenza/stato"))).toHaveLength(1);
    expect(domande.filter((una) => una === "dashboardmodern/config/get primary")).toHaveLength(1);

    await laPlancia(pagina).evaluate((id) => {
      document
        .querySelector(`#dm-muro [data-mu-fa="interruttore"][data-mu-entita="${id}"]`)
        .click();
    }, FARETTI);
    await expect.poll(statoDeiFaretti, { timeout: 15_000 }).toBe("Spenta");
    expect(catena.campanella).toEqual([]);
  } finally {
    await contesto.close();
    await catena.abbassa();
  }
});
