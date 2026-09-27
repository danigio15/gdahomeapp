/* Guarda il sito con un browser vero.
 *
 *     node collaudo/guarda-il-sito.mjs
 *
 * Il sito in `sito/` e' fatto di file statici, e non ha prove sue: non c'e'
 * niente da chiamare, non c'e' niente che risponda. L'unico modo di sapere se
 * sta in piedi e' aprirlo con un browser vero e guardarci dentro: se la pagina
 * non trovasse i suoi file non ci sarebbe nessun errore da nessuna parte, ci
 * sarebbe un buco.
 *
 * ## Cosa guarda, in ordine di quanto fa male sbagliarlo
 *
 *  1. **Le fotografie delle app arrivano.** La plancia, l'app gdahome e gdanav
 *     si raccontano con fotografie vere; un'immagine che non arriva non fa
 *     rumore, lascia un buco. Si scorre tutta la pagina — sono caricate
 *     quando ci si arriva — e si chiede al browser se ogni immagine ha dei
 *     pixel dentro.
 *  2. **Niente errori** in console, e nessun file che non arriva.
 *  3. **Niente scorrimento di lato**, a nessuna delle tre larghezze, e il
 *     menu del telefono si apre e si richiude.
 *  4. **Le voci del menu portano alle loro sezioni**, la lingua si cambia, il
 *     modulo dei contatti manda al tramite, e la pagina resta chiara anche a
 *     chi preferisce il scuro.
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

/* Quanto si aspetta una pagina. Largo: su una macchina di GitHub sotto
 * carico anche una pagina ferma ci mette il suo. */
const PAZIENZA = 30_000;

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

const storte = [];
const lamenta = (che) => storte.push(che);

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
    lamenta(`[${dove}] non arrivato: ${richiesta.url()}`);
  });
  pagina.on("response", (risposta) => {
    if (risposta.status() !== 404) return;
    lamenta(`[${dove}] 404: ${risposta.url().replace(INDIRIZZO, "/")}`);
  });
  await pagina.goto(INDIRIZZO, { waitUntil: "load" });
  return pagina;
}

/* Scorre tutta la pagina, un pezzo alla volta, e aspetta che ogni immagine
 * sia arrivata. Le fotografie sono `loading="lazy"`: il browser le chiede
 * quando ci si avvicina, e guardarle senza scorrere vorrebbe dire contare
 * come rotte quelle che nessuno ha ancora chiesto. */
async function scorriTutta(pagina) {
  const alta = await pagina.evaluate(() => document.documentElement.scrollHeight);
  const passo = await pagina.evaluate(() => Math.max(300, window.innerHeight * 0.8));
  for (let y = 0; y <= alta; y += passo) {
    await pagina.evaluate((dove) => window.scrollTo(0, dove), y);
    await pagina.waitForTimeout(120);
  }
  await pagina
    .waitForFunction(() => [...document.images].every((una) => una.complete), null, {
      timeout: PAZIENZA,
    })
    .catch(() => {
      /* Quelle che non arrivano le dice chi chiama, una per una. */
    });
  /* E le schede, che compaiono salendo: nella fotografia devono esserci. */
  await pagina.evaluate(() =>
    document.querySelectorAll(".appare").forEach((una) => una.classList.add("qui")),
  );
  await pagina.evaluate(() => window.scrollTo(0, 0));
}

/* Le immagini della pagina che non hanno pixel dentro. */
async function immaginiRotte(pagina, dove = "") {
  return pagina.evaluate(
    (dove) =>
      [...document.querySelectorAll(`${dove} img`)]
        .filter((una) => !(una.complete && una.naturalWidth > 0))
        .map((una) => una.getAttribute("src")),
    dove,
  );
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

  /* Le sezioni si raggiungono dalla barra a tutte le larghezze. Sul computer
   * le voci stanno in fila; sotto i 940 pixel stanno dietro un tasto, e il
   * tasto deve esserci, aprirle, e non far scorrere la pagina di lato. Prima
   * sul telefono sparivano e basta, e dal telefono si arrivava a una sezione
   * solo scorrendo tutta la pagina. */
  const tasto = pagina.locator(".menu > summary");
  const primaVoce = pagina.locator('.navigazione a[href="#contatti"]');
  if (misura.larghezza > 940) {
    if (await tasto.isVisible()) lamenta(`[${misura.nome}] c'e' il tasto del menu del telefono`);
    if (!(await primaVoce.isVisible()))
      lamenta(`[${misura.nome}] le voci della barra non si vedono`);
  } else {
    if (!(await tasto.isVisible())) lamenta(`[${misura.nome}] manca il tasto del menu`);
    if (await primaVoce.isVisible()) lamenta(`[${misura.nome}] le voci si vedono col menu chiuso`);
    await tasto.click();
    if (!(await primaVoce.isVisible())) lamenta(`[${misura.nome}] il menu non si apre`);
    const aperto = await pagina.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      finestra: window.innerWidth,
    }));
    if (aperto.pagina > aperto.finestra + 1)
      lamenta(`[${misura.nome}] col menu aperto la pagina scorre di lato`);
    await primaVoce.click();
    if (await primaVoce.isVisible())
      lamenta(`[${misura.nome}] il menu resta aperto dopo la scelta`);
    await pagina.evaluate(() => window.scrollTo(0, 0));
  }

  /* Tutte le fotografie, a questa larghezza: sul telefono le file vanno a
   * due per riga, e un'immagine alta zero pixel qui si vedrebbe solo qui. */
  await scorriTutta(pagina);
  const rotte = await immaginiRotte(pagina);
  if (rotte.length) lamenta(`[${misura.nome}] immagini che non arrivano: ${rotte.join(", ")}`);
  const dopo = await pagina.evaluate(() => document.documentElement.scrollWidth);
  if (dopo > misura.larghezza + 1)
    lamenta(`[${misura.nome}] con le fotografie arrivate la pagina scorre di lato: ${dopo}`);

  process.stdout.write(`${misura.nome}: ${await pagina.locator("img").count()} immagini\n`);

  await pagina.screenshot({ path: join(FOTO, `sito-${misura.nome}.png`), fullPage: true });
  await contesto.close();
}

/* ── 2. Le tre sezioni che fanno vedere le app ─────────────────────────── */

const contesto = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 2,
});
const pagina = await apri(contesto, "le sezioni");
await scorriTutta(pagina);

async function prova(che, fai) {
  try {
    await fai();
    process.stdout.write(`  ok  ${che}\n`);
  } catch (errore) {
    process.stdout.write(`  NO  ${che}\n`);
    lamenta(`[le sezioni] ${che}: ${errore.message.split("\n")[0]}`);
  }
}

/* La plancia, l'app gdahome e gdanav: ognuna con la sua sezione, la sua voce
 * nel menu e le sue fotografie — arrivate, non solo scritte. Prima al posto
 * della plancia c'era un riquadro con dentro la plancia vera, e sul server a
 * volte restava vuoto con un avviso sopra: adesso sono fotografie, e questa
 * prova guarda che ci siano davvero. */
for (const [id, nome, almeno] of [
  ["plancia", "la plancia", 3],
  ["app", "l'app gdahome", 4],
  ["gdanav", "gdanav", 6],
]) {
  await prova(`${nome}: la sezione, la voce nel menu, le fotografie`, async () => {
    const com_e = await pagina.evaluate(
      (id) => ({
        sezione: Boolean(document.getElementById(id)),
        voce: Boolean(document.querySelector(`.navigazione a[href="#${id}"]`)),
        foto: document.querySelectorAll(`#${id} img[src^="statico/"]`).length,
      }),
      id,
    );
    if (!com_e.sezione) throw new Error(`non c'e' la sezione #${id}`);
    if (!com_e.voce) throw new Error("dal menu non ci si arriva");
    if (com_e.foto < almeno)
      throw new Error(`ci sono ${com_e.foto} fotografie, ne aspettavo almeno ${almeno}`);
    const rotte = await immaginiRotte(pagina, `#${id}`);
    if (rotte.length) throw new Error(`non arrivano: ${rotte.join(", ")}`);
  });
}

await prova(
  "nella pagina non c'e' nessun riquadro, e nessun avviso che manca qualcosa",
  async () => {
    const resti = await pagina.evaluate(() => ({
      riquadri: document.querySelectorAll("iframe").length,
      avviso: /non è stata pubblicata/.test(document.body.innerText),
    }));
    if (resti.riquadri) throw new Error(`ci sono ${resti.riquadri} riquadri`);
    if (resti.avviso) throw new Error("la pagina dice ancora che qualcosa non e' stato pubblicato");
  },
);

await prova("ogni voce del menu porta a una sezione che c'e'", async () => {
  const perse = await pagina.evaluate(() =>
    [...document.querySelectorAll(".navigazione a[href^='#']")]
      .map((voce) => voce.getAttribute("href").slice(1))
      .filter((id) => !document.getElementById(id)),
  );
  if (perse.length) throw new Error(`portano nel vuoto: ${perse.join(", ")}`);
});

/* La lingua: i due tasti in cima cambiano la pagina senza ricaricarla, e le
 * sezioni nuove devono cambiare con lei — titolo, didascalie, e il testo
 * alternativo delle fotografie. Poi si torna all'italiano. */
await prova("la lingua si cambia, anche nelle sezioni nuove", async () => {
  await pagina.locator('.lingua[data-lingua="en"]').first().click();
  const inglese = await pagina.evaluate(() => ({
    lingua: document.documentElement.lang,
    titolo: document.querySelector("#gdanav h2")?.textContent.trim(),
    didascalia: document.querySelector("#app figcaption")?.textContent.trim(),
    alt: document.querySelector("#gdanav img")?.getAttribute("alt"),
  }));
  await pagina.locator('.lingua[data-lingua="it"]').first().click();
  const italiano = await pagina.evaluate(() => ({
    lingua: document.documentElement.lang,
    titolo: document.querySelector("#gdanav h2")?.textContent.trim(),
  }));
  if (inglese.lingua !== "en") throw new Error(`in inglese la pagina dice lang=${inglese.lingua}`);
  if (!/navigator/i.test(inglese.titolo ?? ""))
    throw new Error(`il titolo di gdanav in inglese e' «${inglese.titolo}»`);
  if (!/menu/i.test(inglese.didascalia ?? "") || /casa/i.test(inglese.didascalia ?? ""))
    throw new Error(`la didascalia dell'app in inglese e' «${inglese.didascalia}»`);
  if (!/Driving/.test(inglese.alt ?? ""))
    throw new Error(`il testo della fotografia in inglese e' «${inglese.alt}»`);
  if (italiano.lingua !== "it" || !/navigatore/.test(italiano.titolo ?? ""))
    throw new Error("tornando all'italiano la pagina non torna com'era");
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

/* Il modulo dei contatti e' l'unica cosa della pagina che non e' un file: se
 * il suo indirizzo cambiasse, o il tasto sparisse, la pagina si aprirebbe
 * benissimo e nessuno potrebbe piu' scrivere. Qui si guarda che ci sia, che
 * mandi al tramite, che i tre campi abbiano i nomi che il tramite legge, e che
 * dal menu si arrivi a lui e alla sezione per chi installa. */
await prova("il modulo dei contatti c'e', e manda al tramite", async () => {
  const modulo = await pagina.evaluate(() => {
    const forma = document.querySelector("#contatti form");
    if (!forma) return null;
    return {
      via: forma.getAttribute("action"),
      metodo: (forma.getAttribute("method") || "").toLowerCase(),
      campi: [...forma.querySelectorAll("input, textarea")].map((uno) => uno.name),
      tasto: Boolean(forma.querySelector('button[type="submit"]')),
      dalMenu: Boolean(document.querySelector('.navigazione a[href="#contatti"]')),
      installatori:
        Boolean(document.querySelector('.navigazione a[href="#installatori"]')) &&
        Boolean(document.getElementById("installatori")),
    };
  });
  if (!modulo) throw new Error("nella sezione «contatti» non c'e' nessun modulo");
  if (modulo.via !== "/contatto" || modulo.metodo !== "post")
    throw new Error(`il modulo manda a ${modulo.metodo} ${modulo.via}`);
  for (const campo of ["nome", "email", "messaggio"])
    if (!modulo.campi.includes(campo)) throw new Error(`manca il campo «${campo}»`);
  if (!modulo.tasto) throw new Error("non c'e' il tasto per mandare");
  if (!modulo.dalMenu) throw new Error("dal menu non si arriva ai contatti");
  if (!modulo.installatori)
    throw new Error("la sezione per chi installa non c'e', o dal menu non ci si arriva");
});

/* Il bottone che raccoglie le donazioni. E' l'unico posto della pagina dove
 * un errore costa dei soldi a qualcuno: un indirizzo sbagliato manda a una
 * persona che non c'entra, e uno vuoto manda a nessuno — e in tutti e due i
 * casi la pagina si apre benissimo e non lo dice a nessuno.
 *
 * Deve restare lo stesso a cui manda il «Sostieni il progetto» dentro la
 * plancia: uno solo, cosi' non si sparpaglia e non si contraddice. */
await prova("il bottone delle donazioni porta dove deve", async () => {
  const dove = await pagina.evaluate(() => {
    const bottone = document.querySelector("#sostieni a.bottone");
    return bottone ? bottone.getAttribute("href") : null;
  });
  if (!dove) throw new Error("nella sezione «sostieni» non c'e' nessun bottone");
  const nellaPlancia = readFileSync(
    join(RADICE, "ponte", "plancia", "src", "sections", "sostieni-il-progetto-section.js"),
    "utf8",
  );
  if (!nellaPlancia.includes(dove))
    throw new Error(`il sito manda a ${dove}, che nella plancia non c'e': i due si sono divisi`);
});

/* Tutte le immagini della pagina, non solo quelle delle tre sezioni: la
 * fotografia in copertina, il marchio, le icone delle schede. Un'immagine che
 * non arriva non fa nessun rumore — lascia un buco, e la pagina intorno sta in
 * piedi lo stesso. Per questo non basta che il tag ci sia: si chiede al
 * browser se ha davvero dei pixel dentro. */
await prova("ogni immagine della pagina arriva", async () => {
  const quante = await pagina.locator("img").count();
  if (quante < 25) throw new Error(`nella pagina ci sono solo ${quante} immagini`);
  const rotte = await immaginiRotte(pagina);
  if (rotte.length) throw new Error(`non arrivano: ${rotte.join(", ")}`);
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

for (const id of ["plancia", "app", "gdanav"]) {
  await pagina.locator(`#${id}`).scrollIntoViewIfNeeded();
  await pagina.waitForTimeout(300);
  await pagina.locator(`#${id}`).screenshot({ path: join(FOTO, `sito-${id}.png`) });
}

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
  `\nIl sito sta in piedi, e le fotografie delle app ci sono tutte. Le sue sono in ${FOTO}.\n`,
);
