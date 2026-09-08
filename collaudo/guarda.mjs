/* Guarda l'app girare.
 *
 * Accende tutta la catena, per davvero, e poi la fotografa:
 *
 *     Chromium ── l'app (Flutter, versione web)
 *          │
 *          ▼  il codice di abbinamento, battuto come lo batterebbe una persona
 *     il ponte vero ── node ponte/src/index.js, quello dell'add-on
 *          │
 *          ▼
 *     una Home Assistant finta, con dentro una casa piccola
 *
 * L'unica finzione e' l'ultima. Il ponte e' il processo vero, l'app e' l'app
 * vera, e il codice di abbinamento nasce dalla console come nasce in casa.
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

import { alzaLaCasaFinta, SEGNO_DEL_SUPERVISOR } from "./casa-finta.js";

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
const VIDEO = join(QUI, "video");
mkdirSync(FOTO, { recursive: true });
if (FILMA) mkdirSync(VIDEO, { recursive: true });

/* Quanto si respira quando si filma: le stesse attese, moltiplicate. */
const RESPIRO = FILMA ? 2.2 : 1;

const attendi = (millesimi) =>
  new Promise((ok) => setTimeout(ok, Math.round(millesimi * RESPIRO)));

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
    risposta.writeHead(200, {
      "content-type": TIPI[extname(dentro)] || "application/octet-stream",
      "cache-control": "no-store",
      /* Flutter sul web vuole queste due per usare i thread. */
      "cross-origin-opener-policy": "same-origin",
      "cross-origin-embedder-policy": "require-corp",
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

  const processo = spawn("node", [join(PONTE, "src", "index.js")], {
    env: {
      ...process.env,
      PONTE_ARCHIVIO: archivio,
      PONTE_CONSOLE: join(PONTE, "console"),
      PONTE_PORTA_CONSOLE: String(portaDellaConsole),
      SUPERVISOR_TOKEN: SEGNO_DEL_SUPERVISOR,
      PONTE_CASA: `http://127.0.0.1:${portaDellaCasa}`,
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

  /* 3. Il codice di abbinamento, dalla console — come in casa. */
  const { codice } = await (
    await fetch(`http://127.0.0.1:${portaDellaConsole}/api/codice`, { method: "POST" })
  ).json();
  racconta(`codice di abbinamento: ${codice}`);

  /* 4. L'app. */
  const costruita = join(APP, "build", "web");
  if (!existsSync(join(costruita, "index.html"))) {
    throw new Error(
      "l'app non e' stata costruita. Prima:\n" +
        "  cd app && flutter build web --release --dart-define=COLLAUDO=true",
    );
  }
  const sito = serviLApp(costruita);
  const portaDellApp = await sito.ascolta();
  daSpegnere.push(() => sito.spegni());
  racconta(`l'app sulla ${portaDellApp}`);

  /* 5. Il browser. */
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
    ...(FILMA
      ? { recordVideo: { dir: VIDEO, size: { width: 430, height: 932 } } }
      : {}),
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
   * si scalda: in fotografia sembrerebbe premuto. Lo si sposta in un angolo
   * dove non c'e' niente. */
  await pagina.mouse.move(pagina.viewportSize().width - 8, 8);
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

async function premi(pagina, etichetta, { inAlto = false } = {}) {
  let tutti = pagina.locator(
    `[aria-label="${etichetta}"], flt-semantics:has-text("${etichetta}")`,
  );
  try {
    await tutti.first().waitFor({ state: "attached", timeout: 20_000 });
  } catch (_errore) {
    const cEra = await cosaCeDaPremere(pagina);
    throw new Error(`non trovo «${etichetta}». A schermo c'e': ${cEra.join(" · ")}`);
  }
  /* Un'etichetta esatta vale piu' di una scritta che la contiene: «Clima» nel
   * menu e' un bottone con quel nome, e «Clima soggiorno · Clima ca…» sulla
   * tessera dietro e' un'altra cosa. */
  const esatti = pagina.locator(`[aria-label="${etichetta}"]`);
  if ((await esatti.count()) > 0) tutti = esatti;

  /* Con la stessa etichetta ce n'e' spesso piu' d'uno: Flutter lascia in giro
   * nodi vecchi, e la ricerca per testo prende anche i **contenitori** che
   * quella scritta se la trovano dentro. Il primo che si trova puo' quindi
   * essere una scatola grande quanto mezza schermata, e premerne il centro
   * vuol dire premere tutt'altro — e' successo: il tocco su «Scrivilo a mano»
   * e' finito sul bottone di sopra, e si e' aperto il lettore.
   *
   * Quindi si prende il **piu' piccolo**: fra una scatola e quello che ci sta
   * dentro, quello che si voleva premere e' sempre quello dentro. Con `inAlto`
   * invece si prende quello piu' vicino al bordo di sopra, che e' dove sta un
   * bottone della barra del titolo: li' i candidati sono fratelli, non uno
   * dentro l'altro. */
  /* Quanti candidati si guardano davvero.
   *
   * Senza etichetta esatta la ricerca per testo prende anche tutti i
   * **contenitori** che quella scritta se la trovano dentro, e con un menu di
   * venti voci sono centinaia di nodi: chiedere il riquadro di ognuno vuol
   * dire un viaggio nel browser per ognuno, e il collaudo ci metteva cinque
   * minuti per premere un bottone. I primi quaranta bastano: l'albero e' in
   * ordine di documento, e quello che si vuole premere sta li' in mezzo. */
  const trovati = await tutti.count();
  const quanti = Math.min(trovati, 40);
  if (process.env.COLLAUDO_SPIA) {
    for (let i = 0; i < quanti; i += 1) {
      const r = await tutti.nth(i).boundingBox();
      const tag = await tutti
        .nth(i)
        .evaluate(
          (e) =>
            `${e.tagName}#${e.id} role=${e.getAttribute("role")} aria=${e.getAttribute("aria-label")}`,
        );
      process.stdout.write(
        `    spia │ «${etichetta}» ${i}: ${tag} → ${r ? `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}` : "nessun riquadro"}\n`,
      );
    }
  }
  let bottone = tutti.first();
  if (quanti > 1) {
    let migliore = Infinity;
    for (let i = 0; i < quanti; i += 1) {
      const riquadro = await tutti.nth(i).boundingBox();
      /* Un nodo di un pixel non e' un bottone: e' un residuo dell'albero, e
       * prenderlo perche' e' «il piu' piccolo» vuol dire premere nel vuoto.
       * E un nodo grande quanto lo schermo non e' un bottone nemmeno lui: e'
       * il contenitore di tutto, e la ricerca per testo lo prende perche' la
       * scritta ce l'ha *dentro*. Con `inAlto` vinceva sempre lui — sta a
       * y=0 — e il tocco cadeva in mezzo alla pagina. */
      if (!riquadro || riquadro.width < 16 || riquadro.height < 16) continue;
      const schermo = pagina.viewportSize();
      if (schermo && riquadro.width * riquadro.height > schermo.width * schermo.height * 0.6)
        continue;
      const quanto = inAlto ? riquadro.y : riquadro.width * riquadro.height;
      if (quanto < migliore) {
        migliore = quanto;
        bottone = tutti.nth(i);
      }
    }
  }
  /* Col mouse, sul centro del riquadro vero.
   *
   * Premere l'elemento dell'albero non basta: quegli elementi Flutter li mette
   * dove gli pare e il tocco finisce da un'altra parte — la prima volta il
   * «Abbina» ha messo il fuoco sulla casella dell'indirizzo. Il riquadro
   * invece dice dove la cosa e' *disegnata*, e li' sotto c'e' la tela che
   * riceve i tocchi davvero. */
  const riquadro = await bottone.boundingBox();
  if (riquadro && riquadro.width > 0 && riquadro.height > 0) {
    await pagina.mouse.click(riquadro.x + riquadro.width / 2, riquadro.y + riquadro.height / 2);
    return;
  }
  await bottone.click({ force: true });
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
   * il filo con Home Assistant, e l'app legge la casa e la sua plancia. La
   * home e' la plancia: le persone, le tessere, le azioni rapide. */
  await aspettaCheCompaia(pagina, "PERSONE");
  await attendi(800);
  await scatta(pagina, "3-home");
  /* La plancia e' piu' alta dello schermo: si scorre e si fotografa il resto,
   * poi si torna in cima. */
  await scorri(pagina, 900);
  await attendi(700);
  await scatta(pagina, "3b-home-tessere");
  /* Fino in fondo, dove stanno le azioni rapide: una rotellata sola non
   * basta, Flutter ne prende una alla volta. */
  for (let giro = 0; giro < 8; giro += 1) {
    await scorri(pagina, 1200);
    await attendi(150);
  }
  await attendi(700);
  await scatta(pagina, "3c-home-azioni");
  for (let giro = 0; giro < 10; giro += 1) {
    await scorri(pagina, -1200);
    await attendi(100);
  }
  await attendi(500);

  /* Il menu laterale. Sta dietro il bottone in alto a sinistra, e li' l'albero
   * dell'accessibilita' di Flutter mette i riquadri dove gli pare: quando il
   * tocco sul nodo non arriva al bottone disegnato, si tocca dove il bottone
   * **sta**. Col dito sul telefono non serve. */
  async function apriIlMenu() {
    await premi(pagina, "Menu", { inAlto: true });
    try {
      await aspettaCheCompaia(pagina, "Aiutanti", 3000);
    } catch (_ancoraNo) {
      await pagina.mouse.click(8 + 24, 12 + 24);
      await aspettaCheCompaia(pagina, "Aiutanti", 4000);
    }
    await attendi(500);
  }

  /* Il menu e' piu' alto dello schermo: le voci in fondo — Continuita', MiniPC
   * — stanno sotto il bordo, e premere il centro del loro riquadro vorrebbe
   * dire premere fuori dalla finestra. Prima si scorre il menu finche' la voce
   * non e' davvero li'. */
  async function premiNelMenu(nome) {
    const schermo = pagina.viewportSize();
    for (let giro = 0; giro < 10; giro += 1) {
      const voce = pagina.locator(`[aria-label="${nome}"]`).first();
      /* Col tempo: `boundingBox()` di suo **aspetta** che l'elemento ci sia, e
       * l'attesa di serie e' mezzo minuto. Su una voce che non c'e' ancora
       * — il menu sta entrando — dieci giri diventavano cinque minuti, e il
       * collaudo sembrava un'app lenta quando la lenta era l'attesa. */
      const dove = await voce.boundingBox({ timeout: 800 }).catch(() => null);
      /* Nessun riquadro vuol dire «il menu sta ancora entrando», non «e' piu'
       * in basso»: scorrere adesso vorrebbe dire scorrere alla cieca, e in
       * otto giri il menu finirebbe in fondo con la voce fuori dallo schermo. */
      if (!dove) {
        await attendi(200);
        continue;
      }
      if (dove.y >= 0 && dove.y + dove.height <= schermo.height) break;
      /* La rotella gira dove sta il mouse, e il menu sta a sinistra. */
      await pagina.mouse.move(schermo.width / 4, schermo.height / 2);
      await pagina.mouse.wheel(0, 260);
      await attendi(200);
    }
    await premi(pagina, nome);
  }

  /* Le pagine della plancia, una per una, dal menu. */
  const pagine = [
    ["Stanze", "SENSORI DELLA STANZA", "4a-stanze"],
    ["Luci", "Accendi tutte", "4b-luci"],
    ["Clima", "Accendi tutto", "4c-clima"],
    ["Temperatura", "TUTTE", "4d-temperatura"],
    ["Finestre", "Apri tutto", "4e-finestre"],
    ["Agenda", "cose aperte", "4f-agenda"],
    ["Sicurezza", "Antifurto", "4g-sicurezza"],
    ["Prese", "Accendi tutte", "4h-prese"],
    ["Musica", "in riproduzione", "4i-musica"],
    ["Robot", "in funzione", "4j-robot"],
    ["Energia", "DAL SOLE", "4k-energia"],
    ["Elettrodomestici", "ASSORBIMENTO", "4l-elettrodomestici"],
    ["Continuità", "tutto alimentato", "4m-continuita"],
    ["MiniPC", "tranquillo", "4n-minipc"],
  ];
  for (const [nome, attesa, foto] of pagine) {
    racconta(`apro ${nome}`);
    await apriIlMenu();
    await premiNelMenu(nome);
    await aspettaCheCompaia(pagina, attesa);
    await attendi(900);
    await scatta(pagina, foto);
  }

  racconta("apro il menu");
  await apriIlMenu();
  await scatta(pagina, "5-menu");

  racconta("apro i dispositivi");
  await premi(pagina, "Dispositivi");
  await aspettaCheCompaia(pagina, "Cerca fra");
  await attendi(1200);
  await scatta(pagina, "6-dispositivi");

  racconta("apro l'elenco delle case");
  await apriIlMenu();
  await premi(pagina, "Le tue case");
  /* Si aspetta «Aggiungi», che sta **solo** nell'elenco delle case. */
  await aspettaCheCompaia(pagina, "Aggiungi");
  await attendi(600);
  await scatta(pagina, "7-le-case");

  /* Chi guarda il video deve tornare a casa: e' li' che si comincia, ed e' li'
   * che si finisce. */
  if (FILMA) {
    await apriIlMenu();
    await premi(pagina, "Home");
    await aspettaCheCompaia(pagina, "PERSONE");
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
