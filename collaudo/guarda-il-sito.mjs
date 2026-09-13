/* Guarda il sito, e prova che la plancia vera ci gira dentro.
 *
 *     node collaudo/guarda-il-sito.mjs
 *
 * Il sito in `sito/` e' fatto di file statici, e non ha prove sue: non c'e'
 * niente da chiamare, non c'e' niente che risponda. L'unico modo di sapere se
 * sta in piedi e' aprirlo con un browser vero e provarci dentro — come per il
 * link dell'add-on, e per la stessa ragione: se la pagina non trovasse i suoi
 * file non ci sarebbe nessun errore da nessuna parte, ci sarebbe una pagina
 * bianca.
 *
 * ## Cosa guarda, in ordine di quanto fa male sbagliarlo
 *
 *  1. **La plancia parte.** Non una riproduzione: DashboardModern, gli stessi
 *     file dell'add-on, dentro il riquadro. Deve uscire dal velo d'avvio,
 *     tirare su la sua barra con tutte le sue voci, e aprire le sue pagine. Se
 *     smette di partire, il sito promette una cosa e ne fa un'altra — ed e'
 *     la ragione per cui questo collaudo gira **prima** di pubblicare.
 *  2. **La plancia risponde.** Un comando dato alla plancia deve arrivare fino
 *     alla casa finta in pagina e cambiarle lo stato. E' la differenza fra una
 *     plancia viva e una fotografia interattiva.
 *  3. **Niente errori** in console, e nessun file che non arriva. Le due
 *     telecamere sono l'eccezione, ed e' scritta sotto.
 *  4. **Niente scorrimento di lato**, a nessuna delle tre larghezze. E' il
 *     difetto che si vede solo su un telefono vero, cioe' mai, finche' non lo
 *     si guarda apposta.
 *  5. **I link portano dove dicono**, e il chiaro e scuro si accende.
 *
 * Le fotografie finiscono in `collaudo/foto/sito-*.png`.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = dirname(QUI);
const SITO = join(RADICE, "sito");
const FOTO = join(QUI, "foto");
const PORTA = 8099;

const MISURE = [
  { nome: "telefono", larghezza: 390, altezza: 844 },
  { nome: "tablet", larghezza: 820, altezza: 1180 },
  { nome: "computer", larghezza: 1440, altezza: 980 },
];

/* Quanto si aspetta la plancia per partire. Dev'essere largo: sono
 * ottocento file, e su una macchina di GitHub sotto carico ci mette il suo. */
const PAZIENZA = 45_000;

const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
};

/* Le due telecamere della casa demo.
 *
 * La plancia le chiede a Home Assistant come immagini, su `/api/camera_proxy/`,
 * e un sito statico non ha un Home Assistant che gliele dia: tornano 404, e va
 * bene cosi'. In una casa vera quelle due richieste arrivano al ponte e
 * tornano col fotogramma. E' l'unica cosa che qui non si puo' far vedere, e
 * dirlo e' meglio che nasconderlo dietro una fotografia finta. */
const PERDONATE = [/\/api\/camera_proxy\//];

/* Lo stesso Chromium degli altri collaudi: quello che c'e' gia', non un
 * secondo da mezzo gigabyte. */
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
      );
    }
  }
  cartelle.push("/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome");
  return cartelle.find((uno) => existsSync(uno)) ?? null;
}

if (!existsSync(join(SITO, "index.html"))) {
  process.stderr.write(`In ${SITO} non c'e' nessun sito.\n`);
  process.exit(66);
}
if (!existsSync(join(SITO, "dashboardmodern_static", "legacy", "dashboard.html"))) {
  process.stderr.write("Nel sito non c'e' la plancia.\nPrima: node strumenti/porta-nel-sito.mjs\n");
  process.exit(66);
}

mkdirSync(FOTO, { recursive: true });

const server = createServer((richiesta, risposta) => {
  let percorso = decodeURIComponent(richiesta.url.split("?")[0]);
  if (percorso === "/") percorso = "/index.html";
  const dove = join(SITO, normalize(percorso).replace(/^(\.\.[/\\])+/, ""));
  if (!dove.startsWith(SITO)) {
    risposta.writeHead(403).end("no");
    return;
  }
  try {
    const dati = readFileSync(dove);
    risposta.writeHead(200, {
      "content-type": TIPI[extname(dove)] ?? "application/octet-stream",
    });
    risposta.end(dati);
  } catch {
    risposta.writeHead(404).end("no");
  }
});
await new Promise((pronto) => server.listen(PORTA, "127.0.0.1", pronto));
const INDIRIZZO = `http://127.0.0.1:${PORTA}/`;

const chrome = trovaIlBrowser();
if (chrome) process.stdout.write(`Chromium: ${chrome}\n`);
const browser = await chromium.launch({
  ...(chrome ? { executablePath: chrome } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server"],
});
/* La plancia ci mette il suo a partire: i difetti di Playwright sono cuciti
 * addosso a pagine piu' leggere di ottocento file. */

const storte = [];
const lamenta = (che) => storte.push(che);
const perdonata = (indirizzo) => PERDONATE.some((quale) => quale.test(indirizzo));

/* Una pagina che si lamenta da sola: ogni errore in console, ogni eccezione e
 * ogni file che non arriva finisce nell'elenco. */
async function apri(contesto, dove) {
  contesto.setDefaultTimeout(PAZIENZA);
  contesto.setDefaultNavigationTimeout(PAZIENZA);
  const pagina = await contesto.newPage();
  pagina.on("console", (messaggio) => {
    if (messaggio.type() !== "error") return;
    /* Un 404 si e' gia' lamentato come richiesta: qui verrebbe due volte. */
    if (/Failed to load resource/.test(messaggio.text())) return;
    lamenta(`[${dove}] console: ${messaggio.text()}`);
  });
  pagina.on("pageerror", (errore) => lamenta(`[${dove}] errore: ${errore.message}`));
  pagina.on("requestfailed", (richiesta) => {
    /* Una richiesta **annullata** non e' una richiesta che non arriva: e'
     * quello che succede a tutto quello che era ancora per aria quando la
     * pagina si chiude, e qui le pagine si chiudono appena hanno risposto.
     * Contarla vorrebbe dire che il collaudo diventa rosso a seconda di quanto
     * ci mette una risposta, che e' il modo migliore per non credergli piu'. */
    if (richiesta.failure()?.errorText === "net::ERR_ABORTED") return;
    if (!perdonata(richiesta.url())) lamenta(`[${dove}] non arrivato: ${richiesta.url()}`);
  });
  pagina.on("response", (risposta) => {
    if (risposta.status() !== 404 || perdonata(risposta.url())) return;
    lamenta(`[${dove}] 404: ${risposta.url().replace(INDIRIZZO, "/")}`);
  });
  /* `domcontentloaded` e non `networkidle`: con la plancia dentro il riquadro
   * la rete non sta mai ferma — ottocento file da prendere, e poi i suoi
   * timer — e aspettare il silenzio vorrebbe dire aspettare per sempre. Chi
   * chiama aspetta i segni che gli servono. */
  await pagina.goto(INDIRIZZO, { waitUntil: "domcontentloaded" });
  return pagina;
}

/* Il riquadro con dentro la plancia. E' un'altra pagina, con la sua vita: si
 * aspetta che sia uscita dal velo d'avvio e abbia tirato su la sua barra. */
async function laPlancia(pagina) {
  await pagina.locator("#plancia").scrollIntoViewIfNeeded();
  const riquadro = pagina.frameLocator(".telaio-dentro");
  await riquadro.locator("nav.tabs .tab").first().waitFor({ timeout: PAZIENZA });
  /* La barra si dipinge quattro volte prima di essere quella vera: la plancia
   * lo dice da se' mettendo `data-dm-barra="pronta"` sulla radice quando la
   * configurazione della casa e' arrivata. Aspettare quel segno e' l'unico
   * modo di non contare le voci di una barra finta. */
  await pagina.locator(".telaio-dentro").evaluate(
    (telaio) =>
      new Promise((pronta, mai) => {
        const dentro = telaio.contentDocument;
        if (!dentro) return mai(new Error("il riquadro non si legge"));
        if (dentro.documentElement.getAttribute("data-dm-barra") === "pronta") return pronta();
        const scadenza = setTimeout(() => {
          osserva.disconnect();
          /* Non e' un errore fermante: la barra puo' restare «non pronta» e
           * avere comunque le sue voci. Chi chiama le conta. */
          pronta();
        }, 20000);
        const osserva = new MutationObserver(() => {
          if (dentro.documentElement.getAttribute("data-dm-barra") !== "pronta") return;
          clearTimeout(scadenza);
          osserva.disconnect();
          pronta();
        });
        osserva.observe(dentro.documentElement, {
          attributes: true,
          attributeFilter: ["data-dm-barra"],
        });
      }),
  );
  /* E poi che il velo d'avvio se ne vada. Non si toglie di mezzo: sfuma, e
   * finche' sfuma la plancia sotto c'e' gia' tutta. Aspettarlo qui vuol dire
   * che tutto il resto del collaudo guarda una plancia scoperta. */
  await pagina
    .waitForFunction(
      () => {
        const telaio = document.querySelector(".telaio-dentro");
        const velo = telaio?.contentDocument?.getElementById("cd-boot-overlay");
        if (!velo) return true;
        const stile = telaio.contentWindow.getComputedStyle(velo);
        return (
          stile.display === "none" || stile.visibility === "hidden" || Number(stile.opacity) < 0.05
        );
      },
      null,
      { timeout: 25000 },
    )
    .catch(() => {
      /* Se non se ne va, lo dice la prova qui sotto con parole sue. */
    });
  return riquadro;
}

/* ── 1. Le tre larghezze ─────────────────────────────────────────────────── */

for (const misura of MISURE) {
  const contesto = await browser.newContext({
    viewport: { width: misura.larghezza, height: misura.altezza },
    deviceScaleFactor: 2,
  });
  const pagina = await apri(contesto, misura.nome);
  await pagina.waitForTimeout(600);

  const quanto = await pagina.evaluate(() => ({
    pagina: document.documentElement.scrollWidth,
    finestra: window.innerWidth,
  }));
  if (quanto.pagina > quanto.finestra + 1)
    lamenta(`[${misura.nome}] la pagina scorre di lato: ${quanto.pagina} su ${quanto.finestra}`);

  const riquadro = await laPlancia(pagina);
  const voci = await riquadro.locator("nav.tabs .tab").count();
  if (voci < 10) lamenta(`[${misura.nome}] la barra della plancia ha ${voci} voci`);

  process.stdout.write(`${misura.nome}: ${voci} voci nella plancia\n`);

  await pagina.screenshot({ path: join(FOTO, `sito-${misura.nome}.png`), fullPage: true });
  await contesto.close();
}

/* ── 2. La plancia vera, dentro il riquadro ──────────────────────────────── */

const contesto = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 2,
});
const pagina = await apri(contesto, "la plancia");
const riquadro = await laPlancia(pagina);

async function prova(che, fai) {
  try {
    await fai();
    process.stdout.write(`  ok  ${che}\n`);
  } catch (errore) {
    process.stdout.write(`  NO  ${che}\n`);
    lamenta(`[la plancia] ${che}: ${errore.message.split("\n")[0]}`);
  }
}

/* Quello che la plancia ha davvero nella barra: non un elenco scritto qui, il
 * suo. Se un giorno DashboardModern ne aggiunge o ne toglie, questo collaudo
 * non va corretto — e' giusto che il sito faccia vedere quelle che ci sono. */
let vociDellaBarra = [];

await prova("la plancia esce dal velo d'avvio", async () => {
  const velo = riquadro.locator("#cd-boot-overlay");
  /* Il velo resta nel documento anche dopo: se ne va con l'opacita', non
   * togliendosi di mezzo. Per questo non basta chiedere a Playwright se «si
   * vede» — per lui un elemento trasparente e' li'. */
  const su = await pagina.locator(".telaio-dentro").evaluate((telaio) => {
    const velo = telaio.contentDocument.getElementById("cd-boot-overlay");
    if (!velo) return false;
    const stile = telaio.contentWindow.getComputedStyle(velo);
    return (
      stile.display !== "none" && stile.visibility !== "hidden" && Number(stile.opacity) > 0.05
    );
  });
  if (su) throw new Error("il velo d'avvio e' ancora su");
});

await prova("la barra ha le sue voci", async () => {
  vociDellaBarra = (await riquadro.locator("nav.tabs .tab").allTextContents()).map((t) =>
    t.replace(/\s+/g, " ").trim(),
  );
  if (vociDellaBarra.length < 10)
    throw new Error(`ne ha ${vociDellaBarra.length}: ${vociDellaBarra.join(", ")}`);
  process.stdout.write(`      (${vociDellaBarra.length}: ${vociDellaBarra.join(" · ")})\n`);
});

await prova("c'e' la sezione che si e' fatta chi ci abita", async () => {
  /* Nella casa demo ce n'e' una, l'acquario (`cd_sezioni_mie`): e' una
   * funzione vera della plancia, e se sparisce dalla barra vuol dire che la
   * configurazione non e' arrivata. */
  if (!vociDellaBarra.some((voce) => /acquario/i.test(voce)))
    throw new Error("non trovo l'acquario fra le voci");
});

/* Premere una voce della barra.
 *
 * La barra della plancia sta in fondo al suo documento ed e' lunga trenta
 * voci: dentro un riquadro alto ottocento pixel resta sotto il bordo, e si
 * nasconde anche da sola dopo un minuto. Un clic «come lo farebbe un dito»
 * qui vorrebbe dire prima scorrere il riquadro e poi riportarla su, e sarebbe
 * una prova della barra invece che delle pagine. Si preme il bottone dov'e',
 * ed e' il suo gestore vero a cambiare pagina. */
async function premiLaVoce(quale) {
  return pagina.locator(".telaio-dentro").evaluate((telaio, quale) => {
    const voce = telaio.contentDocument.querySelector(`nav.tabs .tab[data-tab="${quale}"]`);
    if (!voce) return false;
    voce.click();
    return true;
  }, quale);
}

async function paginaAperta() {
  return pagina
    .locator(".telaio-dentro")
    .evaluate(
      (telaio) =>
        [...telaio.contentDocument.querySelectorAll("section[id^='page-']")]
          .filter((sezione) => sezione.offsetParent !== null)
          .map((sezione) => sezione.id)[0] || "",
    );
}

await prova("le pagine si aprono", async () => {
  const aperte = [];
  for (const quale of ["energy", "luci", "security", "stanze"]) {
    if (!(await premiLaVoce(quale))) continue;
    await pagina.waitForTimeout(1000);
    const dove = await paginaAperta();
    if (dove) aperte.push(dove);
  }
  if (aperte.length < 3)
    throw new Error(`se ne sono aperte ${aperte.length}: ${aperte.join(", ")}`);
  process.stdout.write(`      (${aperte.join(" · ")})\n`);
});

await prova("un comando arriva fino alla casa", async () => {
  /* Si chiama il servizio come lo chiamerebbe la plancia premendo una luce, e
   * si guarda se la casa finta in pagina se n'e' accorta. E' il filo intero:
   * plancia → gancio → casa in pagina. */
  const prima = await pagina
    .locator(".telaio-dentro")
    .evaluate(
      (telaio) => telaio.contentWindow.__CASA_IN_PAGINA__.entita.get("light.cucina_led").state,
    );
  await pagina.locator(".telaio-dentro").evaluate((telaio) => {
    const dentro = telaio.contentWindow;
    const presa = new dentro.__DASHBOARDMODERN_BRIDGE_WS__("ws://finta/api/websocket");
    presa.onopen = () => {
      presa.send(JSON.stringify({ type: "auth", access_token: "x" }));
      presa.send(
        JSON.stringify({
          id: 99,
          type: "call_service",
          domain: "light",
          service: "turn_off",
          target: { entity_id: "light.cucina_led" },
        }),
      );
    };
  });
  await pagina.waitForTimeout(900);
  const dopo = await pagina
    .locator(".telaio-dentro")
    .evaluate(
      (telaio) => telaio.contentWindow.__CASA_IN_PAGINA__.entita.get("light.cucina_led").state,
    );
  if (prima === dopo) throw new Error(`la luce e' rimasta ${prima}`);
});

await prova("la pagina delle luci si riempie", async () => {
  if (!(await premiLaVoce("luci"))) throw new Error("non c'e' la voce Luci");
  await pagina.waitForTimeout(1400);
  const testo = await pagina
    .locator(".telaio-dentro")
    .evaluate((telaio) => telaio.contentDocument.querySelector("#page-luci")?.innerText || "");
  if (testo.trim().length < 20) throw new Error(`c'e' scritto solo «${testo.trim()}»`);
});

await prova("la casa demo e' quella delle prove", async () => {
  const quante = await pagina
    .locator(".telaio-dentro")
    .evaluate((telaio) => telaio.contentWindow.__CASA_IN_PAGINA__.quante);
  if (quante < 200) throw new Error(`la casa in pagina ha ${quante} entita'`);
});

/* ── 3. Il resto della pagina ────────────────────────────────────────────── */

await prova("i link portano dove dicono", async () => {
  await pagina.locator('.navigazione a[href="#scarica"]').first().click();
  /* Lo scorrimento e' morbido: si aspetta che si fermi invece di indovinare
   * quanto ci mette. */
  await pagina.waitForFunction(
    () => {
      const dove = document.getElementById("scarica");
      return dove && Math.abs(dove.getBoundingClientRect().top - 88) < 160;
    },
    null,
    { timeout: 10000 },
  );
});

/* Le schermate dell'app sono il pezzo che regge la copertina: senza di loro
 * chi arriva legge di un'app senza averla mai vista. E un'immagine che non
 * arriva non fa nessun rumore — lascia un buco, e la pagina intorno sta in
 * piedi lo stesso. Per questo si guardano una per una, e non basta che il tag
 * ci sia: si chiede al browser se ha davvero dei pixel dentro. */
/* Il pezzo di ricambio deve restare zitto quando la plancia c'e'. E' la
 * direzione che fa piu' danno: un riquadro che funziona e che sopra ci mette
 * «la plancia non e' arrivata» dice una bugia a chi guarda, e nessuna prova
 * sulla plancia se ne accorgerebbe — lei parte lo stesso, sotto. */
await prova("quando la plancia c'e', nessuno dice che manca", async () => {
  const detto = await pagina.evaluate(() => {
    const invece = document.querySelector(".telaio-senza");
    const telaio = document.querySelector(".telaio-dentro");
    return { invece: invece ? !invece.hidden : null, telaioVia: telaio ? telaio.hidden : null };
  });
  if (detto.invece === null) throw new Error("il pezzo di ricambio non c'e' piu' nella pagina");
  if (detto.invece) throw new Error("la pagina dice che la plancia manca, e invece sta girando");
  if (detto.telaioVia) throw new Error("il riquadro e' nascosto, e la plancia dentro ci gira");
});

await prova("le schermate dell'app si vedono", async () => {
  const come = await pagina.evaluate(() =>
    [...document.querySelectorAll('img[src*="statico/schermate/"]')].map((una) => ({
      quale: una.getAttribute("src"),
      arrivata: una.complete && una.naturalWidth > 0,
      larga: una.naturalWidth,
    })),
  );
  if (come.length < 4)
    throw new Error(`mi aspettavo almeno 4 schermate, ne ho trovate ${come.length}`);
  const rotte = come.filter((una) => !una.arrivata);
  if (rotte.length) throw new Error(`non arrivano: ${rotte.map((una) => una.quale).join(", ")}`);
});

/* Una luce sola: il sito non ha piu' un tema scuro, e non deve tornare ad
 * averne uno per sbaglio — chi lo aprisse con un telefono in tema scuro si
 * ritroverebbe la copertina quasi nera, cioe' una pagina diversa da quella
 * che gli e' stata mostrata, e le schermate dell'app ci galleggerebbero
 * sopra come ritagli. Qui si guarda col browser che dice di preferire il
 * scuro: il fondo deve restare chiaro lo stesso. */
await prova("anche a chi preferisce il scuro, la copertina resta chiara", async () => {
  const alBuio = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: "dark",
  });
  try {
    const suaPagina = await alBuio.newPage();
    await suaPagina.goto(INDIRIZZO, { waitUntil: "domcontentloaded" });
    const fondo = await suaPagina.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const [r, g, b] = fondo.match(/\d+/g).map(Number);
    /* Chiaro vuol dire chiaro: la media dei tre canali sopra la meta'. Il
     * fondo del sito e' #f0f4f8, cioe' 244; quello scuro di prima era 17. */
    if ((r + g + b) / 3 < 128) throw new Error(`il fondo e' ${fondo}: e' tornato scuro`);
  } finally {
    await alBuio.close();
  }
});

await pagina.locator("#plancia").scrollIntoViewIfNeeded();
await pagina.waitForTimeout(800);
await pagina.screenshot({ path: join(FOTO, "sito-plancia.png") });

/* ── 4. L'informativa ────────────────────────────────────────────────────
 *
 * La seconda pagina del sito, e quella con l'obbligo piu' serio: e'
 * l'indirizzo che sta scritto sulla scheda del Play Store. Che il testo sia
 * quello giusto lo tiene una prova del centralino; qui si guarda l'altra
 * meta', quella che nessuna prova sul testo vedrebbe — che la pagina **si
 * vesta**.
 *
 * Non e' un timore campato per aria: e' gia' successo. L'informativa era
 * scritta addosso a un `stile.css` che poi e' stato rifatto da capo per
 * l'indice, e da quel momento apriva senza niente addosso — il testo giusto,
 * nero su bianco, senza un margine. Chi rifa' i colori guarda l'indice, non
 * lei. */
const altraPagina = await contesto.newPage();
await altraPagina.goto(`${INDIRIZZO}privacy.html`, { waitUntil: "load" });

await prova("l'informativa e' vestita come il sito", async () => {
  const com_e = await altraPagina.evaluate(() => {
    const corpo = getComputedStyle(document.body);
    const dentro = document.querySelector(".dentro");
    const link = document.querySelector("section a");
    return {
      carattere: corpo.fontFamily,
      fondo: corpo.backgroundColor,
      colonna: dentro ? Math.round(dentro.getBoundingClientRect().width) : 0,
      link: link ? getComputedStyle(link).color : "",
      inchiostro: corpo.color,
    };
  });
  /* I caratteri del sito, non quelli di sistema: se `stile.css` non fosse
   * arrivato, qui ci sarebbe il Times del browser. */
  if (!com_e.carattere.includes("Inter"))
    throw new Error(`l'informativa non ha i caratteri del sito: ${com_e.carattere}`);
  /* E il fondo del sito, non il bianco di una pagina senza vestito. */
  if (com_e.fondo === "rgba(0, 0, 0, 0)" || com_e.fondo === "rgb(255, 255, 255)")
    throw new Error(`l'informativa non ha il fondo del sito: ${com_e.fondo}`);
  /* La colonna: un testo di legge largo quanto lo schermo non si rilegge. */
  if (com_e.colonna === 0 || com_e.colonna > 800)
    throw new Error(`la colonna dell'informativa e' larga ${com_e.colonna}`);
  /* I collegamenti dentro il testo si devono distinguere dal testo. */
  if (com_e.link === com_e.inchiostro)
    throw new Error("i collegamenti dell'informativa sono del colore del testo");
});

await prova("dall'informativa si torna indietro", async () => {
  await altraPagina.locator(".indietro").click();
  await altraPagina.waitForURL((dove) => !dove.pathname.includes("privacy"), { timeout: 10000 });
});

await altraPagina.goto(`${INDIRIZZO}privacy.html`, { waitUntil: "load" });
await altraPagina.screenshot({ path: join(FOTO, "sito-privacy.png") });
await altraPagina.close();

await contesto.close();
await browser.close();
server.close();

if (storte.length) {
  process.stdout.write("\nDa sistemare:\n");
  for (const storta of storte) process.stdout.write(` · ${storta}\n`);
  process.exit(1);
}
process.stdout.write(
  `\nIl sito sta in piedi, e la plancia dentro ci gira. Le fotografie sono in ${FOTO}.\n`,
);
