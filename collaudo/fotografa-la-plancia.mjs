/* Le fotografie della plancia per il sito.
 *
 *     node strumenti/porta-nel-sito.mjs        ← prima: porta la plancia nel sito
 *     node collaudo/fotografa-la-plancia.mjs
 *     node strumenti/porta-nel-sito.mjs        ← dopo: le copia in sito/statico/
 *
 * Il sito fa vedere la plancia con delle fotografie, e le fotografie devono
 * essere della plancia vera: gli stessi file dell'add-on, con dentro la casa
 * demo del collaudo (`casa-demo.json`). Le prende da
 * `sito/dashboardmodern_static/`, dove le mette `porta-nel-sito.mjs` con la
 * Home Assistant finta dentro la pagina (`sito/casa-in-pagina.js`), e le
 * scrive in `docs/immagini/plancia-*.jpg`. Da li' `porta-nel-sito.mjs` copia
 * nel sito quelle che le pagine chiamano.
 *
 * Una pagina per fotografia, presa dalla sua linguetta come la prende chi la
 * usa. Due cose sole si nascondono, e tutte e due non sono la plancia:
 *
 *  - il riquadro «La dashboard è quasi pronta», che compare finche' la
 *    configurazione non ha collegato le entita'. La casa demo le ha, ma
 *    dentro la pagina non passa dalla configurazione, e il riquadro c'e' lo
 *    stesso: in una casa configurata non si vede;
 *  - il tasto tondo dell'assistente, che sta sopra a tutto e in una
 *    fotografia copre la scheda sotto.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = dirname(QUI);
const SITO = join(RADICE, "sito");
const USCITA = join(RADICE, "docs", "immagini");
const PORTA = 8098;

/* Le linguette della plancia (`data-tab`) e il nome della fotografia.
 * L'Energia si apre sull'istante: il fotovoltaico, la rete, la batteria, la
 * casa e i carichi, con le frecce. Le viste del giorno e del mese chiedono
 * lo storico, che la Home Assistant dentro la pagina non ha. */
const SUL_TELEFONO = [
  ["home", "casa"],
  ["luci", "luci"],
  ["clima", "clima"],
  ["energy", "energia"],
  ["tapparelle", "finestre"],
  ["security", "sicurezza"],
  ["ev", "auto"],
  ["stanze", "stanze"],
];
const SUL_COMPUTER = [
  ["home", "computer"],
  ["energy", "energia-computer"],
];

const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

/* Lo stesso Chromium degli altri collaudi: quello che c'e' gia'. */
function trovaIlBrowser() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const cartelle = [];
  const scaricati = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (scaricati && existsSync(scaricati)) {
    for (const nome of readdirSync(scaricati)) {
      if (!nome.startsWith("chromium")) continue;
      cartelle.push(join(scaricati, nome, "chrome-linux", "chrome"));
    }
  }
  cartelle.push("/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome");
  return cartelle.find((uno) => existsSync(uno)) ?? null;
}

const PLANCIA = "dashboardmodern_static/legacy/dashboard.html";
if (!existsSync(join(SITO, PLANCIA))) {
  process.stderr.write(
    "Nel sito non c'e' la plancia: prima `node strumenti/porta-nel-sito.mjs`.\n",
  );
  process.exit(66);
}
mkdirSync(USCITA, { recursive: true });

const server = createServer((richiesta, risposta) => {
  const percorso = decodeURIComponent(richiesta.url.split("?")[0]);
  const dove = join(SITO, normalize(percorso).replace(/^(\.\.[/\\])+/, ""));
  if (!dove.startsWith(SITO)) {
    risposta.writeHead(403).end("no");
    return;
  }
  try {
    const dati = readFileSync(dove);
    risposta.writeHead(200, { "content-type": TIPI[extname(dove)] ?? "application/octet-stream" });
    risposta.end(dati);
  } catch {
    risposta.writeHead(404).end("no");
  }
});
await new Promise((pronto) => server.listen(PORTA, "127.0.0.1", pronto));

const chrome = trovaIlBrowser();
const browser = await chromium.launch({
  ...(chrome ? { executablePath: chrome } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server"],
});

async function fotografa(misura, pagine) {
  const contesto = await browser.newContext({
    viewport: { width: misura.larghezza, height: misura.altezza },
    deviceScaleFactor: misura.densita,
    isMobile: misura.telefono,
    hasTouch: misura.telefono,
    locale: "it-IT",
    colorScheme: "light",
  });
  const pagina = await contesto.newPage();
  await pagina.goto(`http://127.0.0.1:${PORTA}/${PLANCIA}`, { waitUntil: "networkidle" });
  /* La plancia arriva a pezzi: le sezioni si montano dopo il primo giro. */
  await pagina.waitForTimeout(3500);
  await pagina.addStyleTag({
    content: "#cd-empty-banner,#dm-assist-tasto{display:none!important}",
  });
  for (const [linguetta, nome] of pagine) {
    const trovata = await pagina.evaluate((linguetta) => {
      const tasto = document.querySelector(`.tab[data-tab="${linguetta}"]`);
      if (!tasto) return false;
      tasto.click();
      return true;
    }, linguetta);
    if (!trovata) {
      process.stderr.write(`La plancia non ha la linguetta «${linguetta}».\n`);
      process.exitCode = 1;
      continue;
    }
    await pagina.waitForTimeout(1800);
    await pagina.evaluate(() => window.scrollTo(0, 0));
    await pagina.waitForTimeout(300);
    const file = join(USCITA, `plancia-${nome}.jpg`);
    await pagina.screenshot({ path: file, type: "jpeg", quality: 84 });
    process.stdout.write(`  ${file.replace(`${RADICE}/`, "")}\n`);
  }
  await contesto.close();
}

await fotografa({ larghezza: 390, altezza: 844, densita: 1.5, telefono: true }, SUL_TELEFONO);
await fotografa({ larghezza: 1440, altezza: 900, densita: 1, telefono: false }, SUL_COMPUTER);

await browser.close();
server.close();
