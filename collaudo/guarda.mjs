/* Guarda l'app girare.
 *
 * Accende tutta la catena, per davvero, e poi la fotografa:
 *
 *     Chromium ── l'app (Flutter, versione web)
 *          │              └── il riquadro della plancia ── il servitore vero
 *          │                                                  (dart run bin/servitore.dart)
 *          ▼  il codice di abbinamento, battuto come lo batterebbe una persona
 *     il ponte vero ── node ponte/src/index.js, quello dell'add-on
 *          │
 *          ▼
 *     una Home Assistant finta, con dentro la casa demo di DashboardModern
 *     (i file della plancia e la sua configurazione ce li ha il ponte)
 *
 * L'unica finzione e' l'ultima. Il ponte e' il processo vero, l'app e' l'app
 * vera, il servitore e' lo stesso che gira dentro l'app sul telefono — sul
 * web un server dentro la pagina non si apre, e allora lo si accende a parte
 * e l'app ci punta con `PLANCIA_URL` — e il codice di abbinamento nasce dalla
 * console come nasce in casa.
 *
 *     node guarda.mjs            fotografa e basta
 *     node guarda.mjs --resta    resta acceso, per guardarci dentro col browser
 */

import { spawn } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import { alzaLaCasaFinta, SCATTO_DEMO, SEGNO_DEL_SUPERVISOR } from "./casa-finta.js";
import { alzaIlCentralinoFinto, CHIAVE_DELLA_CONSOLE } from "./centralino-finto.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = dirname(QUI);
const APP = join(RADICE, "app");
const PONTE = join(RADICE, "ponte");
const RESTA = process.argv.includes("--resta");
/* `--scuro`: l'app col tema scuro, come la vede chi tiene il telefono cosi'.
 * Le fotografie finiscono in una cartella a parte, per non coprire quelle
 * chiare. */
const SCURO = process.argv.includes("--scuro");
/* `--filma`: invece delle sole fotografie, registra tutto il giro in un video.
 *
 * Serve a far vedere l'app a chi non ce l'ha installata: una fotografia dice
 * com'e' fatta una schermata, un video dice come ci si arriva — che e' la
 * domanda vera quando si guarda un'app per la prima volta. Il giro e' lo
 * stesso del collaudo, solo respirato: le pause si allungano perche' chi
 * guarda deve fare in tempo a leggere. */
const FILMA = process.argv.includes("--filma");
const FOTO = join(QUI, "foto", SCURO ? "scuro" : "");
/* Dove il servitore serve la plancia. Fissa, perche' l'app la deve sapere
 * quando la si costruisce: `--dart-define=PLANCIA_URL=http://127.0.0.1:8765`. */
const PORTA_DEL_SERVITORE = Number(process.env.PORTA_DEL_SERVITORE || 8765);
const VIDEO = join(QUI, "video");
mkdirSync(FOTO, { recursive: true });
if (FILMA) mkdirSync(VIDEO, { recursive: true });

/* Quanto si respira quando si filma: le stesse attese, moltiplicate. */
const RESPIRO = FILMA ? 2.2 : 1;

const attendi = (millesimi) => new Promise((ok) => setTimeout(ok, Math.round(millesimi * RESPIRO)));

function racconta(cosa) {
  process.stdout.write(`  · ${cosa}\n`);
}

/* ─── Il pezzo che serve solo qui: servire i file dell'app ────────────────── */

const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".otf": "font/otf",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};

function serviLApp(cartella) {
  const server = createServer((richiesta, risposta) => {
    const chiesto = new URL(richiesta.url, "http://app").pathname;
    let dentro = normalize(join(cartella, chiesto === "/" ? "/index.html" : chiesto));
    if (!dentro.startsWith(normalize(cartella)) || !existsSync(dentro)) {
      dentro = join(cartella, "index.html");
    }
    /* Niente isolamento dell'origine: dentro l'app c'e' un riquadro che
     * mostra la plancia da un'altra origine — il servitore — e con
     * `require-corp` il browser lo lascerebbe vuoto. I thread di Flutter non
     * servono qui. */
    risposta.writeHead(200, {
      "content-type": TIPI[extname(dentro)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(dentro).pipe(risposta);
  });
  return {
    ascolta: () =>
      new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server.address().port))),
    spegni: () => new Promise((ok) => server.close(ok)),
  };
}

async function unaPortaLibera() {
  const { createServer: presa } = await import("node:net");
  return new Promise((ok) => {
    const s = presa();
    s.listen(0, "127.0.0.1", () => {
      const porta = s.address().port;
      s.close(() => ok(porta));
    });
  });
}

/* Dove sta il Chromium.
 *
 * Playwright ne vuole uno della *sua* versione esatta, e su una macchina che
 * ne ha gia' uno — un ambiente preparato, la macchina di chi sviluppa — le due
 * versioni quasi mai coincidono. Invece di scaricarne un secondo da mezzo
 * gigabyte, si usa quello che c'e': prima quello detto a mano, poi quelli
 * gia' scaricati da Playwright, poi quelli del sistema. Se non si trova
 * niente, si lascia decidere a Playwright. */
function trovaIlBrowser() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;

  const cartelle = [];
  const scaricati = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (scaricati && existsSync(scaricati)) {
    for (const nome of readdirSync(scaricati)) {
      if (!nome.startsWith("chromium")) continue;
      cartelle.push(
        join(scaricati, nome, "chrome-linux", "chrome"),
        join(scaricati, nome, "chrome-linux", "headless_shell"),
        join(scaricati, nome, "chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"),
      );
    }
  }
  cartelle.push(
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  );
  return cartelle.find((uno) => existsSync(uno)) ?? null;
}

/* ─── Il servitore ────────────────────────────────────────────────────────── */

/* Dove sta `dart`. Quello di Flutter, se Flutter c'e': e' lo stesso SDK con
 * cui si e' costruita l'app, e il servitore e' un pezzo dell'app. */
function trovaDart() {
  if (process.env.DART) return process.env.DART;
  for (const uno of [
    "/opt/flutter/bin/dart",
    join(process.env.HOME || "", "flutter", "bin", "dart"),
  ]) {
    if (existsSync(uno)) return uno;
  }
  return "dart";
}

/* Accende il servitore e torna l'indirizzo della plancia, o `null` se in
 * questa casa non c'e' DashboardModern (il servitore lo dice e si spegne). */
async function accendiIlServitore({ portaDelPonte, codice, cartella }) {
  const processo = spawn(
    trovaDart(),
    [
      "run",
      "bin/servitore.dart",
      "--casa",
      `127.0.0.1:${portaDelPonte}`,
      "--codice",
      codice,
      "--porta",
      String(PORTA_DEL_SERVITORE),
      "--cartella",
      cartella,
    ],
    { cwd: APP, env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"] },
  );
  daSpegnere.push(
    () =>
      new Promise((ok) => {
        if (processo.exitCode !== null) return ok();
        processo.once("exit", ok);
        processo.kill("SIGTERM");
        setTimeout(() => processo.kill("SIGKILL"), 3000).unref?.();
      }),
  );
  return new Promise((ok, no) => {
    let detto = "";
    let finito = false;
    const fine = setTimeout(() => {
      if (finito) return;
      finito = true;
      no(new Error("il servitore non si e' acceso in due minuti"));
    }, 120_000);
    processo.stdout.on("data", (d) => {
      const testo = String(d);
      process.stdout.write(`    servitore │ ${testo}`);
      detto += testo;
      const trovata = /^plancia: (\S+)$/m.exec(detto);
      if (trovata && !finito) {
        finito = true;
        clearTimeout(fine);
        ok(trovata[1]);
      }
    });
    processo.stderr.on("data", (d) => {
      const testo = String(d);
      process.stdout.write(`    servitore │ ${testo}`);
      if (/non c'e' DashboardModern/.test(testo) && !finito) {
        finito = true;
        clearTimeout(fine);
        ok(null);
      }
    });
    processo.on("exit", (codiceDiUscita) => {
      if (finito) return;
      finito = true;
      clearTimeout(fine);
      no(new Error(`il servitore si e' spento subito (${codiceDiUscita})`));
    });
  });
}

/* Il riquadro con dentro la plancia vera: e' un'altra pagina, con la sua
 * finestra, e ci si parla come a una pagina. Si aspetta che sia **pronta**
 * — il segno lo mette la plancia stessa quando la configurazione e'
 * arrivata e la barra e' disegnata — perche' prima di quello c'e' il velo
 * d'avvio, e una fotografia del velo non dice niente. */
async function laPlancia(pagina, quanto = 90_000) {
  const fine = Date.now() + quanto;
  let ultimo = "nessun riquadro";
  while (Date.now() < fine) {
    const riquadro = pagina.frames().find((f) => f.url().includes("/dashboardmodern_static/"));
    if (riquadro) {
      ultimo = await riquadro
        .evaluate(
          () =>
            `barra=${document.documentElement.getAttribute("data-dm-barra")} pronta=${Boolean(window.__DASHBOARDMODERN_READY__)}`,
        )
        .catch((errore) => `il riquadro non risponde: ${errore?.message || errore}`);
      if (/barra=pronta pronta=true/.test(ultimo)) return riquadro;
    }
    await attendi(300);
  }
  throw new Error(`la plancia non e' comparsa nel riquadro (${ultimo})`);
}

/* ─── Il banco ────────────────────────────────────────────────────────────── */

const daSpegnere = [];
async function abbassaTutto() {
  for (const spegni of daSpegnere.reverse()) {
    try {
      await spegni();
    } catch (_errore) {
      /* Se uno non si spegne, gli altri si spengono lo stesso. */
    }
  }
}

async function main() {
  rmSync(FOTO, { recursive: true, force: true });
  mkdirSync(FOTO, { recursive: true });

  /* 1. La casa finta. */
  const casa = alzaLaCasaFinta();
  /* Il centralino finto: accetta la chiamata della casa e tiene le
   * segnalazioni e la chat, rispondendo da solo come farebbe chi mantiene
   * l'app. Cosi' nelle fotografie il filo ha due voci. */
  const centralino = await alzaIlCentralinoFinto();
  daSpegnere.push(() => centralino.spegni());
  racconta(`il centralino finto sulla ${centralino.porta}`);
  const portaDellaCasa = await casa.ascolta();
  daSpegnere.push(() => casa.spegni());
  racconta(`Home Assistant finta sulla ${portaDellaCasa}`);

  /* 2. Il ponte vero. */
  const archivio = join(QUI, ".archivio");
  rmSync(archivio, { recursive: true, force: true });
  mkdirSync(archivio, { recursive: true });
  const portaDelPonte = await unaPortaLibera();
  const portaDellaConsole = await unaPortaLibera();
  writeFileSync(
    join(archivio, "options.json"),
    JSON.stringify({
      porta_app: portaDelPonte,
      dispositivi_massimi: 5,
      minuti_del_codice: 5,
      giorni_di_silenzio: 90,
      registro: "info",
    }),
  );

  /* La configurazione della plancia la tiene il ponte, nel suo archivio:
   * gliela si mette prima di accenderlo, com'e' nella casa demo, cosi' la
   * plancia si apre gia' configurata — stanze, luci, persone, energia. */
  writeFileSync(
    join(archivio, "plancia.json"),
    JSON.stringify({ profiles: { primary: { ...SCATTO_DEMO, history: [] } } }, null, 2),
  );

  /* I file della plancia il ponte li ha con se', in `ponte/plancia/`: qui
   * come nell'add-on, senza nessuna integrazione in Home Assistant. */
  const processo = spawn("node", [join(PONTE, "src", "index.js")], {
    env: {
      ...process.env,
      PONTE_ARCHIVIO: archivio,
      PONTE_CONSOLE: join(PONTE, "console"),
      PONTE_PORTA_CONSOLE: String(portaDellaConsole),
      SUPERVISOR_TOKEN: SEGNO_DEL_SUPERVISOR,
      PONTE_CASA: `http://127.0.0.1:${portaDellaCasa}`,
      /* Il ponte chiama il centralino finto: la chiamata riesce, e le
       * segnalazioni hanno una strada per uscire. */
      PONTE_CENTRALINO: centralino.indirizzo,
      /* E la chat dell'assistenza bussa allo stesso posto, sull'altro suo
       * sportello: nella vita e' un centralino diverso — quello della
       * dashboard — e da qui non si esce sulla rete vera. */
      PONTE_CHAT: centralino.dellaChat,
      /* E questa casa finta e' anche quella di **chi risponde**: con la
       * chiave della console compaiono la voce «Console» nel menu dell'app e
       * il Cruscotto nella finestra dell'assistenza della plancia. Nella vita
       * ce l'ha una casa sola al mondo; qui ce l'ha perche' le due meta' della
       * chat si vedano nella stessa fotografia. */
      PONTE_CHIAVE_CONSOLE: CHIAVE_DELLA_CONSOLE,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  daSpegnere.push(
    () =>
      new Promise((ok) => {
        processo.once("exit", ok);
        processo.kill("SIGTERM");
        setTimeout(() => processo.kill("SIGKILL"), 3000).unref?.();
      }),
  );
  processo.stdout.on("data", (d) => process.stdout.write(`    ponte │ ${d}`));
  processo.stderr.on("data", (d) => process.stdout.write(`    ponte │ ${d}`));

  for (let i = 0; i < 100; i += 1) {
    try {
      const risposta = await fetch(`http://127.0.0.1:${portaDelPonte}/salute`);
      if ((await risposta.json()).vivo) break;
    } catch (_errore) {
      /* Non e' ancora su. */
    }
    await attendi(100);
  }
  racconta(`il ponte vero sulla ${portaDelPonte}, console sulla ${portaDellaConsole}`);

  /* 3. Il servitore della plancia. E' il pezzo dell'app che sul web non puo'
   * girare — un server dentro una pagina non si apre — quindi lo si accende
   * qui a parte, uguale a com'e' nell'app: si abbina al ponte con un codice
   * suo, apre il filo, trova la plancia e la serve. Il riquadro dell'app ci
   * punta. Il codice vive uno per volta: prima il suo, poi quello dell'app. */
  const codiceDelServitore = (
    await (
      await fetch(`http://127.0.0.1:${portaDellaConsole}/api/codice`, { method: "POST" })
    ).json()
  ).codice;
  const paginaDellaPlancia = await accendiIlServitore({
    portaDelPonte,
    codice: codiceDelServitore,
    cartella: join(archivio, "plancia"),
  });
  if (paginaDellaPlancia) racconta(`il servitore serve la plancia: ${paginaDellaPlancia}`);

  /* 4. Il codice di abbinamento dell'app, dalla console — come in casa. */
  const { codice } = await (
    await fetch(`http://127.0.0.1:${portaDellaConsole}/api/codice`, { method: "POST" })
  ).json();
  racconta(`codice di abbinamento: ${codice}`);

  /* 5. L'app. */
  const costruita = join(APP, "build", "web");
  if (!existsSync(join(costruita, "index.html"))) {
    throw new Error(
      "l'app non e' stata costruita. Prima:\n" +
        "  cd app && flutter build web --release --pwa-strategy=none" +
        " --dart-define=COLLAUDO=true" +
        ` --dart-define=PLANCIA_URL=http://127.0.0.1:${PORTA_DEL_SERVITORE}`,
    );
  }
  const sito = serviLApp(costruita);
  const portaDellApp = await sito.ascolta();
  daSpegnere.push(() => sito.spegni());
  racconta(`l'app sulla ${portaDellApp}`);

  /* 6. Il browser. */
  const dove = trovaIlBrowser();
  if (dove) racconta(`Chromium: ${dove}`);
  const browser = await chromium.launch({
    ...(dove ? { executablePath: dove } : {}),
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      /* Qui gira tutto su `127.0.0.1`. Su una macchina con un proxy
       * configurato nell'ambiente, Chromium ci manderebbe anche queste, e non
       * arriverebbe da nessuna parte. */
      "--no-proxy-server",
    ],
  });
  daSpegnere.push(() => browser.close());
  const contesto = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    colorScheme: SCURO ? "dark" : "light",
    /* Il video lo scrive Playwright da se', un fotogramma alla volta: si
     * chiude il contesto e il file c'e'. Niente da installare, niente
     * ffmpeg. */
    ...(FILMA ? { recordVideo: { dir: VIDEO, size: { width: 430, height: 932 } } } : {}),
    /* CanvasKit disegna il testo su tela, e per farlo si scarica i glifi da
     * `fonts.gstatic.com`. Dietro un proxy che rifirma il traffico con una
     * propria autorita', quel prelievo fallisce e le schermate escono **senza
     * una lettera** — il disegno c'e', il testo no. Qui si sta guardando la
     * propria app su `127.0.0.1`: accettare il certificato non concede niente
     * a nessuno.
     *
     * Vale solo per la versione web. L'app installata i caratteri li prende
     * dal sistema e non chiede niente a nessuno. */
    ignoreHTTPSErrors: true,
  });
  const pagina = await contesto.newPage();
  pagina.on("console", (m) => {
    if (m.type() === "error") process.stdout.write(`    app   │ ${m.text()}\n`);
  });
  /* Quando qualcosa non si carica, la cosa utile e' **cosa**: senza l'indirizzo
   * un errore di certificato non dice niente. */
  pagina.on("requestfailed", (r) => {
    process.stdout.write(`    app   │ non caricato: ${r.url()} (${r.failure()?.errorText})\n`);
  });

  /* CanvasKit — il pezzo che disegna — Flutter di suo se lo scarica da
   * internet a ogni avvio. Dentro il pacchetto costruito c'e' gia', e usare
   * quello vuol dire che il collaudo gira anche senza rete: e' la stessa
   * regola che si e' data la plancia, e qui in piu' evita di sbattere contro
   * i certificati di un proxy aziendale. */
  await pagina.addInitScript(() => {
    globalThis.flutterConfiguration = { canvasKitBaseUrl: "/canvaskit/" };
  });

  await pagina.goto(`http://127.0.0.1:${portaDellApp}/`, { waitUntil: "load" });
  /* Flutter ha cambiato piu' volte come si chiama l'elemento in cui disegna:
   * si aspetta il primo che compare fra quelli conosciuti. */
  await pagina.waitForSelector("flutter-view, flt-glass-pane, flt-scene-host, canvas", {
    state: "attached",
    timeout: 60_000,
  });
  await attendi(2500);
  await scatta(pagina, "1-primo-avvio");

  return { pagina, contesto, codice, portaDelPonte, portaDellaConsole };
}

/* Una rotellata in mezzo allo schermo.
 *
 * La rotella scorre quello che sta sotto il mouse — e il mouse, dopo una
 * fotografia, sta in un angolo dove non c'e' niente da scorrere. Percio' lo si
 * riporta al centro prima di girarla, se no la pagina non si muove e le
 * fotografie «piu' in basso» vengono tutte uguali alla prima. */
async function scorri(pagina, quanto) {
  const { width, height } = pagina.viewportSize();
  await pagina.mouse.move(width / 2, height / 2);
  if (!FILMA) {
    await pagina.mouse.wheel(0, quanto);
    return;
  }
  /* Filmando, una rotellata sola e' uno scatto: la pagina salta da un punto
   * all'altro e chi guarda perde il filo di dov'era. Si scorre a passetti, che
   * e' anche il modo in cui scorre un dito vero. */
  const passi = 12;
  for (let passo = 0; passo < passi; passo += 1) {
    await pagina.mouse.wheel(0, quanto / passi);
    await new Promise((ok) => setTimeout(ok, 28));
  }
}

async function scatta(pagina, nome) {
  /* Il mouse resta dove ha premuto l'ultima volta, e sotto di lui un bottone
   * si scalda: in fotografia sembrerebbe premuto. Lo si sposta sul bordo
   * sinistro, a meta' altezza, dove non c'e' niente: nell'angolo in alto a
   * destra c'e' il bottone della barra del titolo, e fermarglisi sopra gli
   * fa spuntare il fumetto col nome, che finiva in fotografia. */
  await pagina.mouse.move(1, Math.round(pagina.viewportSize().height / 2));
  await attendi(120);
  const dove = join(FOTO, `${nome}.png`);
  await pagina.screenshot({ path: dove });
  racconta(`fotografia: ${nome}.png`);
}

/* ─── Guidare l'app ───────────────────────────────────────────────────────── */

/* Con l'albero dell'accessibilita' acceso, ogni casella e ogni bottone hanno
 * la loro etichetta nel documento: si trovano per nome, come li troverebbe chi
 * usa un lettore di schermo.
 *
 * Si scrive **come scrive una persona**: prima si tocca la casella, poi si
 * battono i tasti. Riempirla di forza dal di fuori, con `fill`, non funziona:
 * Flutter tiene il testo per conto suo e quello che si scrive nell'elemento
 * del documento non gli arriva mai. */
async function scriviIn(pagina, etichetta, cosa) {
  await premi(pagina, etichetta);
  await attendi(150);
  /* Svuotare prima: la casella del nome arriva con «Casa» gia' dentro, e
   * scrivendoci sopra verrebbe «CasaCasa del collaudo». */
  await pagina.keyboard.press("Control+A");
  await pagina.keyboard.press("Delete");
  await pagina.keyboard.type(cosa, { delay: 15 });
  await attendi(150);
}

/* Cosa c'e' da premere, adesso. Serve quando un'etichetta non si trova: senza,
 * si resta a indovinare. */
async function cosaCeDaPremere(pagina) {
  return pagina.evaluate(() =>
    [...document.querySelectorAll("[aria-label], flt-semantics")]
      .map((uno) => uno.getAttribute("aria-label") || uno.textContent?.trim())
      .filter((uno) => uno)
      .slice(0, 80),
  );
}

/* Aspetta che una scritta compaia. Meglio di un'attesa a tempo: una rete lenta
 * non fa fallire il collaudo, e una veloce non lo fa aspettare per niente. */
async function aspettaCheCompaia(pagina, etichetta, quanto = 30_000) {
  const fine = Date.now() + quanto;
  while (Date.now() < fine) {
    const cE = await cosaCeDaPremere(pagina);
    if (cE.some((uno) => uno.includes(etichetta))) return;
    await attendi(250);
  }
  const cEra = await cosaCeDaPremere(pagina);
  throw new Error(`«${etichetta}» non e' comparsa. A schermo c'e': ${cEra.join(" · ")}`);
}

/* Si preme **il nodo**, non il punto dove sta disegnato.
 *
 * Flutter, quando un tocco cade su un nodo premibile dell'albero, non lo passa
 * a chi disegna: aspetta il `click` del browser su **quel** nodo e manda un
 * «tap» con il suo nome. E' la strada che fa un lettore di schermo, e la si fa
 * direttamente: un `click()` sul nodo premibile, e Flutter preme quel bottone
 * — non quello che sta disegnato sotto il punto dove si sarebbe cliccato, che
 * puo' essere un altro se l'albero si e' mosso fra il misurare e il premere.
 *
 * Le caselle di testo non sono premibili: hanno dentro l'elemento che scrive,
 * e un `click()` su di lui gli da' il fuoco — anche questo e' come fa il
 * motore. Se il nodo non e' ne' l'una ne' l'altra cosa torna `false`, e chi
 * chiama prova col mouse.
 *
 * La pausa prima: un `click` che arriva a meno di cinquanta millisecondi
 * dall'ultimo tocco del mouse Flutter lo butta via, credendolo lo stesso tocco
 * contato due volte. */
async function premiIlNodo(nodo) {
  await attendi(80);
  const come = await nodo
    .evaluate((elemento) => {
      const scrive = elemento.matches("input, textarea")
        ? elemento
        : elemento.querySelector("input, textarea");
      if (scrive) {
        scrive.click();
        return "casella";
      }
      const premibile = elemento.hasAttribute("flt-tappable")
        ? elemento
        : elemento.querySelector("[flt-tappable]") || elemento.closest("[flt-tappable]");
      if (premibile) {
        premibile.click();
        return "nodo";
      }
      return null;
    })
    .catch(() => null);
  return Boolean(come);
}

async function premi(pagina, etichetta, opzioni = {}) {
  const bottone = await ilBottone(pagina, etichetta, opzioni);
  if (!bottone) {
    const cEra = await cosaCeDaPremere(pagina);
    throw new Error(`non trovo «${etichetta}». A schermo c'e': ${cEra.join(" · ")}`);
  }
  if (await premiIlNodo(bottone)) return;
  const riquadro = await bottone.boundingBox().catch(() => null);
  if (riquadro && riquadro.width > 0 && riquadro.height > 0) {
    await pagina.mouse.click(riquadro.x + riquadro.width / 2, riquadro.y + riquadro.height / 2);
    return;
  }
  const andata = await bottone
    .click({ force: true, timeout: 2500 })
    .then(() => true)
    .catch(() => false);
  if (andata) return;
  const cEra = await cosaCeDaPremere(pagina);
  throw new Error(
    `«${etichetta}» c'era e non si e' lasciata premere. A schermo c'e': ${cEra.join(" · ")}`,
  );
}

/* Quale nodo si preme, per un'etichetta.
 *
 * Sta a parte perche' lo chiede anche chi deve scorrere un menu prima di
 * premere: per sapere **dove** e' una voce bisogna sceglierla con le stesse
 * regole con cui poi la si preme, se no si misura una cosa e se ne preme
 * un'altra. Torna `null` quando quel testo a schermo non c'e'. */
async function ilBottone(pagina, etichetta, { inAlto = false, aspetta = true } = {}) {
  const tutti = pagina.locator(
    `[aria-label="${etichetta}"], [aria-label^="${etichetta}"], flt-semantics:has-text("${etichetta}")`,
  );
  try {
    await tutti.first().waitFor({ state: "attached", timeout: aspetta ? 20_000 : 600 });
  } catch (_errore) {
    return null;
  }

  /* Si prendono gli **elementi**, non i posti.
   *
   * Un `nth(4)` non e' un nodo: e' «il quinto che combacia, quando lo si
   * chiedera'». L'albero dell'accessibilita' di Flutter si rifa' in
   * continuazione — una barra che si chiude, una pagina che scorre — e fra il
   * misurare e il premere il quinto era diventato un altro, o non c'era piu':
   * il collaudo restava fermo trenta secondi ad aspettare un nodo che nessuno
   * avrebbe piu' disegnato. Presi cosi' invece sono maniglie su elementi veri,
   * fotografati tutti nello stesso istante: quello che si misura e' quello che
   * si preme.
   *
   * Quanti se ne guardano: senza etichetta esatta la ricerca per testo prende
   * anche tutti i **contenitori** che quella scritta se la trovano dentro, e
   * con una barra di venti voci sono centinaia. I primi quaranta bastano —
   * l'albero e' in ordine di documento, e quello che si vuole premere sta li'
   * in mezzo. */
  const presi = (await tutti.elementHandles()).slice(0, 60);
  if (presi.length === 0) return null;

  /* Chi combacia davvero, a gradini.
   *
   * La ricerca per testo non guarda le maiuscole e prende anche i pezzi:
   * «Manda» sta dentro «Domanda», e siccome il bottone «Domanda» e' piu'
   * piccolo di «Manda» era lui a vincere — la segnalazione cambiava tipo e non
   * partiva. Quindi prima chi ha **proprio** quella scritta, o quell'etichetta:
   * «Clima» nel menu e' un bottone con quel nome, e «Clima soggiorno · Clima
   * ca…» sulla tessera dietro e' un'altra cosa.
   *
   * Poi l'etichetta che comincia cosi' e va a capo: una casella di testo che
   * ha il fuoco si porta dietro, dopo un a capo, anche il suggerimento che
   * mostra — «Le lettere sotto al quadretto⏎ABCD-2345-EFGH-6789» — e finche'
   * ha il fuoco quell'etichetta in due righe e' la sua.
   *
   * Poi chi la contiene, con le maiuscole giuste. E solo alla fine tutti.
   *
   * Si decide qui, sugli elementi gia' presi, non con una seconda domanda
   * all'albero: fra una domanda e l'altra il fuoco arrivava sulla casella,
   * l'etichetta cambiava, e la seconda domanda tornava a mani vuote. */
  const scritte = await Promise.all(
    presi.map((nodo) =>
      nodo
        .evaluate((e) => ({
          etichetta: e.getAttribute("aria-label"),
          testo: (e.textContent || "").trim(),
          premibile:
            e.matches("input, textarea") ||
            Boolean(e.querySelector("input, textarea")) ||
            e.hasAttribute("flt-tappable") ||
            Boolean(e.querySelector("[flt-tappable]")) ||
            Boolean(e.closest("[flt-tappable]")),
        }))
        .catch(() => ({ etichetta: null, testo: "", premibile: false })),
    ),
  );
  const esatti = presi.filter(
    (_nodo, i) => scritte[i].etichetta === etichetta || scritte[i].testo === etichetta,
  );
  const quasi = presi.filter((_nodo, i) =>
    (scritte[i].etichetta || "").startsWith(`${etichetta}\n`),
  );
  const contengono = presi.filter(
    (_nodo, i) =>
      (scritte[i].etichetta || "").includes(etichetta) || scritte[i].testo.includes(etichetta),
  );
  const combaciano =
    esatti.length > 0
      ? esatti
      : quasi.length > 0
        ? quasi
        : contengono.length > 0
          ? contengono
          : presi;
  /* E fra chi combacia, chi si puo' premere: un bottone, una casella, una
   * scritta che sta dentro a un bottone. Il fumetto che spunta quando il
   * mouse si ferma su «Rileggi» ha la stessa parola, e' piu' piccolo del
   * bottone e non fa niente: senza questo era lui a vincere. */
  const premibili = combaciano.filter((nodo) => scritte[presi.indexOf(nodo)].premibile);
  const nodi = premibili.length > 0 ? premibili : combaciano;

  const riquadri = await Promise.all(nodi.map((nodo) => nodo.boundingBox().catch(() => null)));
  if (process.env.COLLAUDO_SPIA) {
    for (let i = 0; i < nodi.length; i += 1) {
      const r = riquadri[i];
      const tag = await nodi[i]
        .evaluate(
          (e) =>
            `${e.tagName}#${e.id} role=${e.getAttribute("role")} aria=${e.getAttribute("aria-label")}`,
        )
        .catch(() => "sparito");
      process.stdout.write(
        `    spia │ «${etichetta}» ${i}: ${tag} → ${r ? `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}` : "nessun riquadro"}\n`,
      );
    }
  }

  /* Con la stessa etichetta ce n'e' spesso piu' d'uno: la ricerca per testo
   * prende anche i **contenitori** che quella scritta se la trovano dentro,
   * quindi il primo puo' essere una scatola grande quanto mezza schermata, e
   * premerne il centro vuol dire premere tutt'altro — e' successo: il tocco su
   * «Scrivilo a mano» e' finito sul bottone di sopra, e si e' aperto il
   * lettore.
   *
   * Quindi si prende il **piu' piccolo**: fra una scatola e quello che ci sta
   * dentro, quello che si voleva premere e' sempre quello dentro. Con `inAlto`
   * invece si prende quello piu' vicino al bordo di sopra, che e' dove sta un
   * bottone della barra del titolo: li' i candidati sono fratelli, non uno
   * dentro l'altro. */
  const schermo = pagina.viewportSize();
  let bottone = nodi[0];
  let migliore = Infinity;
  for (let i = 0; i < nodi.length; i += 1) {
    const riquadro = riquadri[i];
    /* Un nodo di un pixel non e' un bottone: e' un residuo dell'albero, e
     * prenderlo perche' e' «il piu' piccolo» vuol dire premere nel vuoto.
     * E un nodo grande quanto lo schermo non e' un bottone nemmeno lui: e' il
     * contenitore di tutto, e la ricerca per testo lo prende perche' la
     * scritta ce l'ha *dentro*. Con `inAlto` vinceva sempre lui — sta a y=0 —
     * e il tocco cadeva in mezzo alla pagina. */
    if (!riquadro || riquadro.width < 16 || riquadro.height < 16) continue;
    if (schermo && riquadro.width * riquadro.height > schermo.width * schermo.height * 0.6)
      continue;
    /* Con `inAlto` si cerca un bottone della barra del titolo, e «il piu' in
     * alto» da solo non basta: un contenitore che comincia a filo del bordo
     * sta piu' in alto del bottone e vince, e il tocco cade in mezzo alla
     * pagina. Si guardano quindi solo i candidati che stanno **nella** barra
     * del titolo — il primo quarto di schermo — e fra quelli si prende sempre
     * il piu' piccolo, che e' la regola di tutti gli altri. */
    if (inAlto && schermo && riquadro.y > schermo.height * 0.25) continue;
    const quanto = riquadro.width * riquadro.height;
    if (quanto < migliore) {
      migliore = quanto;
      bottone = nodi[i];
    }
  }
  return bottone;
}

const banco = await main();
try {
  const { pagina, codice, portaDelPonte } = banco;

  racconta("compilo il modulo, come lo compilerebbe una persona");
  await scriviIn(pagina, "Come si chiama", "Casa del collaudo");
  /* Qui si va per la strada delle lettere, e non e' pigrizia: in un browser
   * dentro una macchina non c'e' nessuna fotocamera, e non c'e' niente da
   * inquadrare. Quello che si sta collaudando e' il resto — il ponte vero, il
   * segno, il filo, la casa — e a quello ci si arriva battendo, come ci arriva
   * chi la fotocamera non ce l'ha. */
  await premi(pagina, "Non puoi inquadrarlo? Scrivilo a mano");
  await attendi(300);
  await scriviIn(pagina, "Le lettere sotto al quadretto", codice);
  await scriviIn(pagina, "Indirizzo di casa (facoltativo)", `127.0.0.1:${portaDelPonte}`);
  await scatta(pagina, "2-modulo-compilato");

  racconta("abbino");
  /* Con l'Invio, non col bottone: e' la strada che il modulo gestisce
   * (`onSubmitted`), ed e' quella che usa chi ha appena finito di battere il
   * codice. */
  await pagina.keyboard.press("Enter");
  /* Qui succede tutto: il ponte controlla il codice, fabbrica il segno, apre
   * il filo con Home Assistant, e l'app trova la plancia e la apre nel
   * riquadro. La home e' la plancia vera: quella di DashboardModern, com'e'. */
  const plancia = await laPlancia(pagina);
  await attendi(1500);
  await scatta(pagina, "3-home");
  /* La plancia e' piu' alta dello schermo: e' una pagina, e si scorre come
   * una pagina. */
  await plancia.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" }));
  await attendi(800);
  await scatta(pagina, "3b-home-tessere");
  await plancia.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
  );
  await attendi(800);
  await scatta(pagina, "3c-home-fondo");
  await plancia.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await attendi(500);

  /* Le pagine della plancia, dalla **sua** barra in fondo: quelle che ci sono
   * davvero, perche' la plancia nasconde le voci delle sezioni vuote. Si
   * preme dentro il riquadro, come si preme sulla plancia. */
  const schede = await plancia.locator("nav.tabs .tab:visible").evaluateAll((voci) =>
    voci.map((una) => ({
      quale: una.dataset.tab,
      nome: una.querySelector(".text")?.textContent?.trim() || una.dataset.tab,
    })),
  );
  racconta(`la plancia ha ${schede.length} pagine: ${schede.map((una) => una.nome).join(", ")}`);
  /* Si preme la voce dal di dentro, con un clic sintetico: sul telefono la
   * barra scorre in orizzontale e le voci in fondo stanno fuori dallo
   * schermo, e un clic col mouse su una cosa fuori dallo schermo non parte.
   * Il gestore della plancia e' lo stesso. */
  const premiLaScheda = (quale) =>
    plancia.evaluate((dove) => {
      const voce = document.querySelector(`nav.tabs .tab[data-tab="${dove}"]`);
      if (!voce) throw new Error(`nella barra della plancia non c'e' ${dove}`);
      voce.click();
    }, quale);
  /* `COLLAUDO_SALTA_PLANCIA=1` salta il giro delle pagine della plancia: e'
   * la parte lunga, e chi sta lavorando a una schermata dell'app vuole
   * arrivarci in fretta. */
  for (const { quale, nome } of schede) {
    if (quale === "home" || process.env.COLLAUDO_SALTA_PLANCIA) continue;
    racconta(`apro ${nome}`);
    await premiLaScheda(quale);
    await plancia.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await attendi(1400);
    await scatta(pagina, `4-${quale}`);
  }
  await premiLaScheda("home");
  await attendi(700);

  /* Il menu laterale. Sta dietro il bottone in alto a sinistra, e li' l'albero
   * dell'accessibilita' di Flutter mette i riquadri dove gli pare: quando il
   * tocco sul nodo non arriva al bottone disegnato, si tocca dove il bottone
   * **sta**. Col dito sul telefono non serve. */
  /* La barra delle sezioni non e' un menu a tendina: e' una dock che sta
   * sotto il bordo e si chiama dalla maniglia, la pillola in fondo allo
   * schermo. Si preme li'. */
  async function apriIlMenu() {
    /* Si richiude da sola poco dopo che si e' scelto: premere la maniglia
     * mentre e' ancora aperta la chiuderebbe. */
    await attendi(1400);
    /* Premere la maniglia quando la barra e' gia' su la manda giu'. */
    if (!(await laBarraECaperta())) {
      await premi(pagina, "Barra delle sezioni");
      await attendi(900);
    }
    /* Non si aspetta una voce in particolare: la barra si apre gia' scorsa
     * sulla sezione aperta, e quale voce si veda dipende da dove si e'. Chi
     * viene dopo la cerca scorrendo, e se la barra non fosse salita lo
     * direbbe li'. */
    await attendi(800);
  }

  /* Il menu e' piu' alto dello schermo: le voci in fondo — Continuita', MiniPC
   * — stanno sotto il bordo, e premere il centro del loro riquadro vorrebbe
   * dire premere fuori dalla finestra. Prima si scorre il menu finche' la voce
   * non e' davvero li'. */
  /* Una voce della barra. La barra sta di lato, scorre in verticale e ne
   * mostra una dozzina per volta: quella che si cerca puo' stare fuori, e
   * finche' sta fuori in Flutter **non esiste** — nell'albero che si
   * interroga da fuori non c'e' nodo con quel testo. Quindi si scorre finche'
   * non compare. */
  async function premiNelMenu(sezione) {
    const nome = sezione.toUpperCase();
    const schermo = pagina.viewportSize();
    /* Dove sta la barra: sul fianco sinistro, a meta' altezza. */
    const dentroLaBarra = { x: 96, y: schermo.height / 2 };

    /* Cercare e premere stanno nello stesso tentativo, e il tentativo
     * ricomincia da capo.
     *
     * Perche' la barra, quando si riapre, torna scorsa sulla sezione che si
     * sta guardando: se si e' scorso fino in fondo per trovare
     * «Configurazione» e nel frattempo la barra si e' richiusa da sola, alla
     * riapertura quella voce e' di nuovo fuori vista — e la maniglia che si
     * era misurata prima non e' piu' di niente. Riaprire e riprendere a
     * scorrere da dove si era e' proprio la cosa che non si puo' fare. */
    for (let tentativo = 0; tentativo < 4; tentativo += 1) {
      if (!(await laBarraECaperta())) {
        await premi(pagina, "Barra delle sezioni");
        await attendi(900);
      }
      /* La barra e' piu' alta dello schermo: le voci in fondo stanno sotto il
       * bordo, e finche' stanno fuori in Flutter **non esistono** — nell'albero
       * che si interroga da fuori non c'e' nodo con quel testo. Si scorre
       * finche' non compare. */
      let dove = null;
      let voce = null;
      for (let giro = 0; giro < 16; giro += 1) {
        const bottone = await ilBottone(pagina, nome, { aspetta: false });
        const riquadro = await (bottone?.boundingBox().catch(() => null) ?? null);
        /* Una voce della barra: alta quanto una voce — i contenitori che quel
         * testo se lo trovano dentro sono alti tutta la barra — e **dentro la
         * barra**, che sta sul fianco sinistro. Senza quest'ultima, una parola
         * che sta anche sulla pagina dietro vinceva sulla voce: la ricerca per
         * testo non guarda le maiuscole, e «Elettrodomestici» scritto in un
         * elenco e' lo stesso testo di «ELETTRODOMESTICI» nella barra. */
        const eUnaVoce =
          riquadro && riquadro.height > 20 && riquadro.height < 70 && riquadro.x < 210;
        if (eUnaVoce && riquadro.y >= 8 && riquadro.y + riquadro.height <= schermo.height - 8) {
          dove = riquadro;
          voce = bottone;
          break;
        }
        if (!(await laBarraECaperta())) break;
        await pagina.mouse.move(dentroLaBarra.x, dentroLaBarra.y);
        await pagina.mouse.wheel(0, 180);
        await attendi(200);
      }
      if (!dove) continue;
      /* Subito, sul nodo che si e' appena misurato: fra il misurare e il
       * premere non ci va nient'altro. Se il nodo non si lascia premere, il
       * mouse sul posto. */
      if (!(await premiIlNodo(voce))) {
        await pagina.mouse.click(dove.x + dove.width / 2, dove.y + dove.height / 2);
      }

      /* Ha preso?
       *
       * Una voce premuta manda giu' la barra — e' quello che fa la plancia,
       * per dare il tempo di vedere che si e' premuto e poi togliersi di
       * mezzo. Se dopo un secondo la barra e' ancora su, quel tocco non e'
       * finito su una voce, ed e' da rifare. */
      await attendi(1000);
      if (!(await laBarraECaperta())) return;
    }
    /* Quattro tentativi e niente: lo si dice, invece di andare avanti e
     * accusare la pagina dopo di non essere comparsa. */
    const cEra = await cosaCeDaPremere(pagina);
    throw new Error(
      `«${nome}» nella barra non si e' lasciata premere. A schermo c'e': ${cEra.join(" · ")}`,
    );
  }

  /* Se la barra e' dentro. Lo dice la **maniglia**.
   *
   * Non una voce: le voci scorrono, e la prima — «HOME» — esce di vista appena
   * la barra si apre su una sezione in fondo all'elenco. Chiedere di lei
   * voleva dire sentirsi rispondere «chiusa» a barra apertissima, premere la
   * maniglia per aprirla e cosi' chiuderla davvero.
   *
   * La maniglia invece c'e' sempre, e quando la barra e' dentro si sposta di
   * fianco a lei: se sta sul bordo la barra e' fuori, se sta a duecento punti
   * la barra e' aperta. Una cosa sola da guardare, e sempre la stessa. */
  async function laBarraECaperta() {
    const maniglia = await ilBottone(pagina, "Barra delle sezioni", {
      aspetta: false,
    });
    const dove = await (maniglia?.boundingBox().catch(() => null) ?? null);
    /* Ben dentro, non a meta' strada: la maniglia ci mette quattro decimi di
     * secondo ad arrivare, e sorprenderla per via voleva dire leggere «e'
     * aperta» su una barra che si stava ancora aprendo — e premere la
     * maniglia per aprirla, cioe' richiuderla. */
    return Boolean(dove && dove.x > 150);
  }

  /* Andare in una sezione dell'app, e assicurarsi di esserci arrivati.
   *
   * Che la barra si sia chiusa dice che si e' premuta **una** voce, non che si
   * e' premuta **quella**: la barra puo' star finendo di scorrere mentre si
   * preme, e il dito prende la vicina. La prova d'essere arrivati e' una
   * parola che sta solo su quella pagina. */
  async function vaiA(nome, attesa) {
    for (let tentativo = 1; tentativo <= 3; tentativo += 1) {
      await apriIlMenu();
      await premiNelMenu(nome);
      try {
        await aspettaCheCompaia(pagina, attesa, tentativo < 3 ? 6000 : 30_000);
        return;
      } catch (errore) {
        if (tentativo === 3) throw errore;
        process.stdout.write(`    · «${nome}» non ha preso, riprovo\n`);
      }
    }
  }

  racconta("apro la barra dell'app");
  await apriIlMenu();
  await scatta(pagina, "5-barra");

  racconta("apro i dispositivi");
  await vaiA("Dispositivi", "Cerca fra");
  await attendi(1200);
  await scatta(pagina, "6-dispositivi");

  /* La Configurazione.
   *
   * Non e' una schermata dell'app: e' la pagina **Configurazione della
   * dashboard**, quella vera, e la voce del menu apre lei dentro il
   * riquadro. Prima l'app ne aveva una sua, rifatta in Flutter, e per quanto
   * le si rifacessero le caselle una per una restava un'altra cosa —
   * un'altra grafica, un'altra alberatura, un altro posto dove ogni cosa
   * sta. Poi la voce apriva solo il suo editor, e la pagina restava murata:
   * cosi' si perdevano il Tema, la Tavolozza, la Barra e le donazioni, che
   * stanno nella pagina e non nell'editor. Adesso si apre la pagina: di
   * rifatto non c'e' niente, e si guarda che sia la sua. */
  /* La plancia si ricarica, e si deve **ricollegare**.
   *
   * Nel browser la pagina della plancia si ricarica per un sacco di ragioni
   * normali: si preme «Salva» nella Configurazione, si tocca «Plancia»
   * essendoci gia', si cambia «Plancia leggera», la casa arriva dopo che la
   * pagina si era aperta. Ogni ricarica e' un documento nuovo, con un
   * WebSocket nuovo — e quello nuovo trovava la cucitura del documento di
   * prima, ancora viva, e non ne apriva un'altra: niente `auth_ok`, pallino
   * rosso, nessuno stato e nessuna configurazione. Cioe' «non hai ancora
   * collegato le tue entita'» su una casa configurata, con il filo vivo.
   *
   * Il collaudo non lo vedeva perche' **non ricaricava mai**: apriva la
   * plancia una volta e da li' in poi cambiava solo pagina, che e' un'altra
   * cosa. Adesso ricarica, e guarda il pallino. */
  racconta("ricarico la plancia, e guardo che si ricolleghi");
  /* Si ricarica **dal di dentro**, e non dal menu dell'app.
   *
   * Quello che rompe la cucitura e' «un documento nuovo in quel riquadro», e
   * `location.reload()` e' quello nella sua forma piu' pulita: la stessa cosa
   * che fa `ricarica()` dell'app quando si salva nella Configurazione, senza
   * dover passare da una voce del menu — che in un collaudo si preme quando
   * la barra si lascia premere, e non e' quello che si sta provando.
   *
   * Il segno sul documento di prima serve a sapere quale riquadro si sta
   * guardando: quello vecchio resta li' per qualche decimo, e senza il segno
   * si finirebbe a fare le domande alla pagina sbagliata e a dirsi che va
   * tutto bene. */
  await plancia.evaluate(() => {
    window.__collaudoVecchia = true;
    location.reload();
  });
  const fineDellaRicarica = Date.now() + 60_000;
  let ricaricata = null;
  while (Date.now() < fineDellaRicarica) {
    const quale = pagina.frames().find((f) => f.url().includes("/dashboardmodern_static/"));
    if (quale) {
      const vecchia = await quale
        .evaluate(() => Boolean(window.__collaudoVecchia))
        .catch(() => true);
      if (!vecchia) {
        ricaricata = quale;
        break;
      }
    }
    await attendi(250);
  }
  if (!ricaricata) throw new Error("la plancia non si e' ricaricata");
  /* Il pallino diventa verde su `auth_ok`, e la scritta accanto lo dice: sono
   * la prima cosa che si guarda, e quella che si vedeva rossa. */
  const fineDelPallino = Date.now() + 45_000;
  let come = null;
  while (Date.now() < fineDelPallino) {
    come = await ricaricata
      .evaluate(() => ({
        collegato: Boolean(document.getElementById("live-dot")?.classList.contains("connected")),
        scritta: (document.getElementById("conn-text")?.textContent || "").trim(),
        senzaEntita: Boolean(document.getElementById("cd-empty-banner")),
      }))
      .catch(() => null);
    if (come?.collegato) break;
    await attendi(300);
  }
  if (!come?.collegato) {
    throw new Error(
      `ricaricata la plancia, il pallino non e' verde: «${come?.scritta || "niente"}»` +
        `${come?.senzaEntita ? ", e dice che le entita' non sono collegate" : ""}`,
    );
  }
  /* E la configurazione e' tornata con lei: l'avviso «non hai ancora
   * collegato le tue entita'» compare proprio quando la configurazione non e'
   * arrivata, ed e' il secondo segno di quel difetto. */
  if (come.senzaEntita) {
    throw new Error("ricaricata la plancia, dice che le entita' non sono collegate");
  }
  racconta(`la plancia si e' ricollegata: ${come.scritta || "pallino verde"}`);
  await attendi(700);
  await scatta(pagina, "3d-plancia-ricaricata");

  racconta("apro la Configurazione della plancia dal menu");
  const laConfig = await laPlancia(pagina);
  await apriIlMenu();
  /* La prova che la voce ha preso e' **la pagina**, non la barra.
   *
   * `premiNelMenu` guarda la maniglia: una voce premuta manda giu' la barra,
   * e se dopo un secondo e' ancora su quel tocco non e' finito su una voce.
   * Vale per le schermate dell'app, e non per le due voci che aprono il
   * riquadro: qui il collaudo gira nel browser, dove la plancia sta in un
   * `iframe` e il suo cambio di pagina lavora sullo **stesso filo** che
   * disegna Flutter. La barra si sta chiudendo, la sua animazione resta
   * indietro di qualche decimo, e la maniglia si legge ancora alta su una
   * pagina che si e' aperta al primo tocco. Si preme, e poi si chiede alla
   * plancia se ci siamo. */
  try {
    await premiNelMenu("Configurazione");
  } catch (male) {
    racconta(`la barra non si e' letta chiusa: guardo la pagina (${male.message})`);
  }
  await laConfig.waitForSelector("#page-config.active", { timeout: 30_000 });
  await attendi(1800);
  await scatta(pagina, "6g-la-config-della-plancia");

  /* Sulla Configurazione la barra in fondo alla plancia non c'e'.
   *
   * Nella dashboard ci sta — li' la Config e' una pagina come le altre — e
   * nell'app no: la Config si apre dal menu, e due barre a schermo vogliono
   * dire toccare una sezione della plancia e ritrovarsi altrove senza sapere
   * da dove. Una schermata, una barra. */
  racconta("controllo che la barra della plancia sparisca");
  const laBarraDellaPlancia = await laConfig.evaluate(() => {
    const barra = document.querySelector("nav.tabs.bottom-nav-bar");
    if (!barra) return "non c'e' proprio";
    return getComputedStyle(barra).display === "none" ? "" : "si vede";
  });
  if (laBarraDellaPlancia) {
    throw new Error(`la barra della plancia sulla Config: ${laBarraDellaPlancia}`);
  }

  /* «Sostieni il progetto» nell'app non c'e': la tessera della dashboard e'
   * nascosta, perche' qui gli acquisti ci sono e una donazione accanto a un
   * listino e' la stessa domanda fatta due volte. Si guarda che non ci sia. */
  racconta("controllo che le donazioni non compaiano");
  const laTesseraDelleDonazioni = await laConfig.evaluate(() => {
    const tessera = document.querySelector("#page-config .dm-sostieni-tessera");
    if (!tessera) return false;
    return tessera.getBoundingClientRect().height > 0;
  });
  if (laTesseraDelleDonazioni) {
    throw new Error("la tessera delle donazioni si vede, e nell'app non deve");
  }

  /* L'editor si apre da dentro la pagina, dalla sua tessera: e' il giro che
   * si fa nella dashboard. */
  racconta("apro l'editor dalla tessera «Configura Entita'»");
  await laConfig.evaluate(() => {
    const tessera = document.getElementById("srv-config-card");
    if (tessera) tessera.click();
    else window.apriConfigEntita?.();
  });
  await laConfig.waitForSelector("#editor-modal", { timeout: 30_000 });
  await attendi(1800);
  await scatta(pagina, "6g3-editor-della-config");

  /* Una scheda qualunque, dal di dentro: quello che si vede e' il markup
   * della dashboard, non un modulo nostro che le somiglia. */
  racconta("apro i varchi nella Config");
  await laConfig.evaluate(() => {
    try {
      window.editorSwitch?.("varchi");
    } catch (male) {
      /* La scheda non c'e' in questa versione: pazienza, si guarda quella
       * che c'e'. */
    }
  });
  await attendi(1600);
  await scatta(pagina, "6h-config-varchi");
  await laConfig.evaluate(() => {
    try {
      window.editorSwitch?.("people");
    } catch (male) {}
  });
  await attendi(1600);
  await scatta(pagina, "6i-config-persone");

  /* Si chiude come nella dashboard: l'editor se ne va e sotto resta la sua
   * pagina, che non si e' mai ricaricata. */
  racconta("chiudo l'editor");
  await laConfig.evaluate(() => document.getElementById("editor-modal")?.remove());
  await attendi(900);

  /* La barra della plancia «a scomparsa», che e' il caso vero.
   *
   * Qui dentro la barra e' **fissa**, che e' il difetto della dashboard; su un
   * telefono chi la mette a scomparsa — dalla tessera «Barra di navigazione»,
   * due dita sopra — non riusciva piu' a uscire dalla Configurazione: il
   * ritorno alla plancia tocca una linguetta di quella barra, e una barra a
   * scomparsa **che noi abbiamo nascosto** quel tocco non lo prende.
   *
   * La si mette a scomparsa come la mette la sua tessera — la chiave nel
   * deposito locale, e l'avviso che la plancia ascolta da se' — e il ritorno
   * si prova cosi'. Senza questo passo il collaudo era verde e il telefono no.
   */
  racconta("metto la barra della plancia «a scomparsa», come su un telefono");
  await laConfig.evaluate(() => {
    localStorage.setItem("cd_navbar_mode", "auto");
    window.dispatchEvent(new Event("dashboardmodern:persistence-restored"));
  });
  await attendi(700);

  /* E si scrive nell'indirizzo l'ordine «apri la Config», come fa il telefono.
   *
   * Sul telefono, se la chiamata diretta non riesce al primo colpo, il ripiego
   * porta il riquadro su `…#gdahome-config`. Quell'ordine serve **una volta**:
   * restando scritto, ogni ricarica riapriva la Configurazione, e chi dal menu
   * tornava alla Plancia si rivedeva la Config senza capire da dove. */
  await laConfig.evaluate(() => {
    location.hash = "gdahome-config";
  });
  await attendi(300);

  /* Dalla Configurazione alla Plancia: la plancia torna dov'era, e la pagina
   * Config si chiude come si chiuderebbe toccando un'altra linguetta della
   * sua barra. */
  racconta("torno alla plancia");
  await apriIlMenu();
  try {
    await premiNelMenu("Plancia");
  } catch (male) {
    racconta(`la barra non si e' letta chiusa: guardo la pagina (${male.message})`);
  }
  await attendi(1500);
  const laConfigSiEChiusa = await laConfig.evaluate(
    () => !document.getElementById("page-config")?.classList.contains("active"),
  );
  if (!laConfigSiEChiusa) {
    throw new Error("la plancia non e' tornata dalla Configurazione (con la barra «a scomparsa»)");
  }
  /* E l'ordine nell'indirizzo se n'e' andato con l'uscita: se restasse, la
   * prima ricarica della pagina riaprirebbe la Configurazione. */
  const restaLOrdine = await laConfig.evaluate(() => /gdahome-config/.test(location.hash));
  if (restaLOrdine) {
    throw new Error(
      "l'indirizzo tiene ancora «apri la Config»: alla prima ricarica tornerebbe la Config",
    );
  }

  /* La barra torna fissa, com'era: quello che viene dopo la guarda, e una
   * barra a scomparsa si nasconde da se' dopo quattro secondi. */
  await laConfig.evaluate(() => {
    localStorage.setItem("cd_navbar_mode", "fixed");
    window.dispatchEvent(new Event("dashboardmodern:persistence-restored"));
  });
  await attendi(700);
  /* E la barra della plancia e' tornata con lei. */
  const laBarraETornata = await laConfig.evaluate(() => {
    const barra = document.querySelector("nav.tabs.bottom-nav-bar");
    return !!barra && getComputedStyle(barra).display !== "none";
  });
  if (!laBarraETornata) {
    throw new Error("tornati alla plancia, la sua barra non e' tornata");
  }

  /* «Come va l'app»: quello che e' dell'app e non della plancia — i
   * fotogrammi, il filo con la casa, il ritardo dei dati — e i due
   * interruttori che pesano sul riquadro. Nel menu, e non solo dentro
   * l'Assistenza: e' la pagina da fotografare quando l'app va a scatti. */
  racconta("apro «Come va l'app» dal menu");
  /* Si aspetta la riga d'apertura, non un'insegna: le insegne dentro una
   * scheda l'albero dei significati non le dichiara sempre. */
  await vaiA("Come va l'app", "L'ultimo minuto");
  await attendi(900);
  await scatta(pagina, "6l2-come-va-l-app");

  racconta("apro gli acquisti");
  await vaiA("Acquisti", "Prova aperta su");
  await attendi(900);
  await scatta(pagina, "6l-acquisti");
  await scorri(pagina, 1100);
  await attendi(700);
  await scatta(pagina, "6m-acquisti-listino");

  racconta("apro le segnalazioni");
  await vaiA("Segnalazioni", "Nessuna segnalazione");
  await attendi(900);
  await scatta(pagina, "6b-segnalazioni");

  racconta("ne scrivo una");
  await premi(pagina, "Nuova segnalazione");
  await aspettaCheCompaia(pagina, "Parte anche questo");
  await attendi(500);
  await premi(pagina, "Idea");
  await scriviIn(pagina, "In due parole", "Una tessera per la piscina");
  await scriviIn(
    pagina,
    "Racconta",
    "Sarebbe bello vederla in home, con la temperatura dell'acqua e la pompa.",
  );
  await attendi(400);
  await scatta(pagina, "6c-nuova-segnalazione");
  await premi(pagina, "Manda");
  await aspettaCheCompaia(pagina, "#12");
  /* Il manutentore finto risponde dopo un attimo: si rilegge, e c'e'. */
  await attendi(2200);
  await premi(pagina, "Rileggi", { inAlto: true });
  await aspettaCheCompaia(pagina, "Grazie, guardo subito");
  await attendi(600);
  await scatta(pagina, "6d-segnalazione");
  await premi(pagina, "Back", { inAlto: true });
  await attendi(800);

  /* I filtri dell'elenco, quelli della dashboard: quattro tasti coi conti.
   *
   * Ci sono appena c'e' una segnalazione — e non solo quando gli stati sono
   * piu' d'uno: un comando che appare e sparisce non e' un comando. Si
   * guarda che ci siano tutti e quattro e che premerne uno filtri davvero. */
  racconta("i filtri delle segnalazioni");
  for (const nome of ["Da lavorare", "In lavorazione", "Chiuse", "Tutte"]) {
    await aspettaCheCompaia(pagina, nome);
  }
  await attendi(500);
  await scatta(pagina, "6d2-segnalazioni-filtri");
  /* «Chiuse» non ne ha nessuna: lo dice, invece di mostrare una lista
   * vuota senza spiegazione. */
  await premi(pagina, "Chiuse");
  await aspettaCheCompaia(pagina, "Nessuna segnalazione in questo stato");
  await attendi(400);
  await scatta(pagina, "6d3-segnalazioni-filtro-vuoto");
  await premi(pagina, "Tutte");
  await aspettaCheCompaia(pagina, "Una tessera per la piscina");
  await attendi(400);

  racconta("apro l'assistenza");
  await vaiA("Assistenza", "Qui si parla con chi fa");
  await attendi(600);
  await scriviIn(
    pagina,
    "Scrivi a chi fa l'app…",
    "Buongiorno! Come si aggiunge una seconda casa?",
  );
  await premi(pagina, "Manda");
  await aspettaCheCompaia(pagina, "Come si aggiunge una seconda casa");
  /* La risposta arriva dopo un attimo, e la si vede mandando la parola dopo:
   * il filo che torna e' quello intero. */
  await attendi(2200);
  await scriviIn(pagina, "Scrivi a chi fa l'app…", "Grazie!");
  await premi(pagina, "Manda");
  await aspettaCheCompaia(pagina, "Grazie, guardo subito");
  await attendi(700);
  await scatta(pagina, "6e-assistenza");

  /* La Console: la stessa conversazione, vista dall'altra parte.
   *
   * La voce c'e' perche' questa casa ha la chiave; in una casa qualunque non
   * comparirebbe. Quello che si vede qui e' la domanda appena scritta
   * dall'Assistenza, arrivata nella coda di chi risponde. */
  racconta("apro la console dell'assistenza");
  await vaiA("Console", "CONVERSAZIONI");
  await attendi(800);
  await scatta(pagina, "6e2-console-coda");

  await premi(pagina, "casa_");
  await aspettaCheCompaia(pagina, "Tutte le conversazioni");
  await attendi(800);
  await scriviIn(pagina, "Rispondi a", "Dalla home, in alto a sinistra.");
  await premi(pagina, "Manda");
  await aspettaCheCompaia(pagina, "Dalla home, in alto a sinistra");
  await attendi(700);
  await scatta(pagina, "6e3-console-filo");

  /* «Come va l'app»: i numeri di come disegna, e quanto passa sul filo. E'
   * la pagina che si chiede di fotografare quando l'app va a scatti, quindi
   * la si fotografa anche qui. */
  racconta("apro «Come va l'app»");
  await premi(pagina, "Come va l'app");
  await aspettaCheCompaia(pagina, "Fotogrammi");
  await attendi(1500);
  await scatta(pagina, "6f-come-va-l-app");
  /* Il bottone per tornare: in inglese, che e' la lingua del browser del collaudo. */
  await premi(pagina, "Back");
  await aspettaCheCompaia(pagina, "Scrivi a chi fa l'app");
  await attendi(400);

  racconta("torno alla plancia");
  await apriIlMenu();
  await premiNelMenu("Plancia");
  await laPlancia(pagina);
  await attendi(600);

  racconta("apro l'elenco delle case");
  /* L'elenco delle case sta in cima alla barra, dietro il nome della casa:
   * e' li' che si guarda per sapere in che casa si e'. */
  await apriIlMenu();
  await premi(pagina, "Casa del collaudo");
  /* Si aspetta «Aggiungi», che sta **solo** nell'elenco delle case. */
  await aspettaCheCompaia(pagina, "Aggiungi");
  await attendi(600);
  await scatta(pagina, "7-le-case");

  /* Chi guarda il video deve tornare a casa: e' li' che si comincia, ed e' li'
   * che si finisce. */
  if (FILMA) {
    await premi(pagina, "Back", { inAlto: true });
    await laPlancia(pagina);
    await attendi(1200);
  }

  racconta("fatto");
} catch (errore) {
  process.stdout.write(`\n  ✗ ${errore?.message || errore}\n`);
  try {
    await scatta(banco.pagina, "x-dove-si-e-fermata");
  } catch (_altro) {
    /* Se non si riesce nemmeno a fotografare, pazienza. */
  }
  if (!RESTA) {
    await abbassaTutto();
    process.exit(1);
  }
}

if (RESTA) {
  racconta("resto acceso: ctrl-C per chiudere");
  await new Promise(() => {});
} else {
  /* Il video si chiude col contesto, non col browser: chiudendo il browser
   * per primo il file resterebbe a meta'. */
  let video = "";
  if (FILMA) {
    const dove = await banco.pagina.video()?.path();
    await banco.contesto.close();
    if (dove && existsSync(dove)) {
      video = join(VIDEO, `giro-completo${SCURO ? "-scuro" : ""}.webm`);
      renameSync(dove, video);
    }
  }
  await abbassaTutto();
  process.stdout.write(`\n  Le fotografie stanno in ${FOTO}\n`);
  if (video) process.stdout.write(`  Il video sta in ${video}\n`);
  process.exit(0);
}
