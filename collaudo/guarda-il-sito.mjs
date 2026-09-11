/* Guarda il sito, e prova che la plancia dimostrativa risponde.
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
 * Quello che guarda, in ordine di quanto fa male sbagliarlo:
 *
 *  1. **la plancia risponde**. E' il pezzo per cui il sito esiste: la luce che
 *     si spegne, la tapparella che scende, il termostato che si sposta,
 *     l'allarme che si inserisce, il lucchetto che porta ai piani. Se questi
 *     smettono di funzionare, il sito racconta una bugia;
 *  2. **niente errori** in console, e nessun file che non arriva;
 *  3. **niente scorrimento di lato**, a nessuna delle tre larghezze. E' il
 *     difetto che si vede solo su un telefono vero, cioe' mai, finche' non lo
 *     si guarda apposta;
 *  4. **i prezzi ci sono**: la tabella e l'elenco del gratis li riempie
 *     `sito.js` da `listino.js`, e se quel pezzo si rompe restano due buchi
 *     bianchi in mezzo alla sezione che deve far comprare.
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

const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
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
if (!existsSync(join(SITO, "statico", "casa.js"))) {
  process.stderr.write("Nel sito manca la casa demo.\nPrima: node strumenti/porta-nel-sito.mjs\n");
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
  const pagina = await contesto.newPage();
  pagina.on("console", (messaggio) => {
    if (messaggio.type() === "error") lamenta(`[${dove}] console: ${messaggio.text()}`);
  });
  pagina.on("pageerror", (errore) => lamenta(`[${dove}] errore: ${errore.message}`));
  pagina.on("requestfailed", (richiesta) => lamenta(`[${dove}] non arrivato: ${richiesta.url()}`));
  await pagina.goto(INDIRIZZO, { waitUntil: "networkidle" });
  return pagina;
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

  const tessere = await pagina.locator(".pl-tessera").count();
  if (tessere === 0) lamenta(`[${misura.nome}] la plancia non ha disegnato nessuna tessera`);

  const righe = await pagina.locator("#riga-singoli tr").count();
  const gratis = await pagina.locator("#elenco-gratis li").count();
  if (righe === 0) lamenta(`[${misura.nome}] la tabella dei singoli e' vuota`);
  if (gratis === 0) lamenta(`[${misura.nome}] l'elenco di cosa e' gratis e' vuoto`);

  process.stdout.write(
    `${misura.nome}: ${tessere} tessere, ${righe} righe di listino, ${gratis} voci gratis\n`,
  );

  await pagina.screenshot({
    path: join(FOTO, `sito-${misura.nome}.png`),
    fullPage: true,
  });
  await contesto.close();
}

/* ── 2. La plancia risponde ──────────────────────────────────────────────── */

const contesto = await browser.newContext({
  viewport: { width: 1440, height: 980 },
  deviceScaleFactor: 2,
});
const pagina = await apri(contesto, "i clic");
await pagina.locator("#plancia").scrollIntoViewIfNeeded();

async function prova(che, fai) {
  try {
    await fai();
    process.stdout.write(`  ok  ${che}\n`);
  } catch (errore) {
    lamenta(`[i clic] ${che}: ${errore.message}`);
    process.stdout.write(`  NO  ${che}\n`);
  }
}

const sezione = (nome) => pagina.getByRole("button", { name: nome, exact: true }).first();

await prova("si apre la sezione Luci", async () => {
  await sezione("Luci").click();
  await pagina.waitForSelector(".pl-luce");
});

await prova("una luce si spegne", async () => {
  const prima = await pagina.locator(".pl-luce.pl-accesa").count();
  await pagina.locator(".pl-luce .pl-interruttore").first().click();
  await pagina.waitForTimeout(120);
  const dopo = await pagina.locator(".pl-luce.pl-accesa").count();
  if (prima === dopo) throw new Error(`le accese sono restate ${prima}`);
});

await prova("«Spegni tutte» le spegne tutte", async () => {
  await pagina.getByRole("button", { name: "Spegni tutte" }).click();
  await pagina.waitForTimeout(120);
  const accese = await pagina.locator(".pl-luce.pl-accesa").count();
  if (accese !== 0) throw new Error(`ne restano accese ${accese}`);
});

await prova("l'energia disegna il flusso e la giornata", async () => {
  await sezione("Energia").click();
  await pagina.waitForSelector(".pl-flusso-nodo");
  await pagina.waitForSelector(".pl-giorno");
});

await prova("il termostato si sposta", async () => {
  await sezione("Clima").click();
  await pagina.waitForSelector(".pl-termostato");
  const prima = await pagina.locator(".pl-clima .pl-cifra-n").first().textContent();
  await pagina.getByRole("button", { name: "Più mezzo grado" }).first().click();
  await pagina.waitForTimeout(120);
  const dopo = await pagina.locator(".pl-clima .pl-cifra-n").first().textContent();
  if (prima === dopo) throw new Error(`la mira e' restata a ${prima}`);
});

await prova("la tapparella scende", async () => {
  await sezione("Finestre").click();
  await pagina.waitForSelector(".pl-tapparella");
  await pagina.getByRole("button", { name: "Giù" }).first().click();
  await pagina.waitForTimeout(700);
  const quanto = await pagina
    .locator(".pl-tapparella")
    .first()
    .evaluate((nodo) => nodo.style.height);
  if (quanto !== "100%") throw new Error(`la tapparella e' a ${quanto}`);
});

await prova("l'allarme si inserisce", async () => {
  await sezione("Sicurezza").click();
  await pagina.waitForSelector(".pl-allarme");
  await pagina.getByRole("button", { name: "Fuori casa" }).click();
  await pagina.waitForSelector(".pl-allarme.pl-inserito");
});

await prova("il lucchetto porta ai piani", async () => {
  await pagina.getByRole("button", { name: "Vedi i piani" }).first().click();
  await pagina.waitForTimeout(900);
  const dove = await pagina.evaluate(() => {
    const piani = document.getElementById("piani").getBoundingClientRect();
    return piani.top;
  });
  if (Math.abs(dove) > 220) throw new Error(`i piani sono rimasti a ${Math.round(dove)}px`);
});

await prova("la schermata Acquisti mostra il listino", async () => {
  await pagina.locator("#plancia").scrollIntoViewIfNeeded();
  await pagina.getByRole("button", { name: "Acquisti" }).first().click();
  await pagina.waitForSelector(".pl-acquisto-grande");
  const quante = await pagina.locator(".pl-acquisto").count();
  if (quante < 8) throw new Error(`solo ${quante} voci nel listino`);
});

await prova("i Dispositivi elencano le entita'", async () => {
  await pagina.getByRole("button", { name: "Dispositivi" }).first().click();
  await pagina.waitForSelector(".pl-dominio");
});

await prova("le voci in arrivo si aprono", async () => {
  await pagina.getByRole("button", { name: "Zigbee" }).first().click();
  await pagina.waitForSelector(".pl-arrivo");
});

await prova("il tema scuro si accende", async () => {
  await pagina.locator("#cambia-tema").click();
  await pagina.waitForTimeout(250);
  const tema = await pagina.evaluate(() => document.documentElement.getAttribute("data-tema"));
  if (tema !== "scuro") throw new Error(`il tema e' ${tema}`);
});

await pagina.locator("#plancia").scrollIntoViewIfNeeded();
await pagina.waitForTimeout(400);
await pagina.screenshot({ path: join(FOTO, "sito-scuro.png") });

await contesto.close();
await browser.close();
server.close();

if (storte.length) {
  process.stdout.write("\n--- da sistemare ---\n");
  for (const storta of storte) process.stdout.write(` · ${storta}\n`);
  process.exit(1);
}
process.stdout.write(`\nIl sito sta in piedi. Le fotografie sono in ${FOTO}.\n`);
