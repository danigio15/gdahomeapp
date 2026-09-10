/* Guarda il link: gdahome servita dall'add-on, sotto l'ingress.
 *
 * E' l'unica prova che mette insieme i tre pezzi che devono combaciare perche'
 * il link funzioni davvero, e che nessuna prova unitaria puo' mettere insieme:
 *
 *  1. il ponte che serve `ponte/app/` sotto `/app/`;
 *  2. il prefisso dell'ingress di Home Assistant davanti a tutto, che cambia a
 *     ogni riavvio — qui se ne mette uno finto apposta;
 *  3. la pagina che si calcola da sola da dove pende (`<base href>`), e va a
 *     prendere i suoi file **li'** e non nella radice del sito.
 *
 * Se uno dei tre e' storto non c'e' un errore da nessuna parte: c'e' una
 * pagina bianca. Per questo qui si guarda con un browser vero, e si fotografa.
 *
 *     node collaudo/guarda-il-link.mjs
 *
 * Le fotografie finiscono in `collaudo/foto/link-*.png`.
 */

import { chromium } from "playwright";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { costruisciLaConsole } from "../ponte/src/server.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = dirname(QUI);
const APP = join(RADICE, "ponte", "app");
const FOTO = join(QUI, "foto");

/* Un prefisso finto, e non nessun prefisso: e' il caso che si rompe. */
const DAVANTI = "/api/hassio_ingress/un-gettone-qualunque";

const MISURE = [
  { nome: "telefono", larghezza: 390, altezza: 844 },
  { nome: "tablet", larghezza: 820, altezza: 1180 },
  { nome: "computer", larghezza: 1440, altezza: 900 },
];

/* Lo stesso Chromium di `guarda.mjs`: quello che c'e' gia', non un secondo da
 * mezzo gigabyte. */
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

if (!existsSync(join(APP, "index.html"))) {
  process.stderr.write(
    "In ponte/app non c'e' nessuna app.\n" +
      "Prima: cd app && flutter build web --release --pwa-strategy=none\n" +
      "Poi:   node strumenti/porta-l-app.mjs\n",
  );
  process.exit(66);
}

/* Un ponte con dentro il minimo: qui si guarda una cartella servita, non la
 * casa. */
const server = costruisciLaConsole({
  ponte: { collegatiPerDispositivo: () => new Map() },
  casa: { saluta: async () => ({ viva: true }) },
  dispositivi: { elenco: () => [], quanti: () => 0 },
  abbinamento: { stato: () => ({ attivo: false }) },
  opzioni: { portaDellApp: 8098, dispositiviMassimi: 10, app: APP },
  cartellaDellaConsole: join(RADICE, "ponte", "console"),
  cartellaDellApp: APP,
});

/* L'ingress, fatto a mano: Home Assistant mette il prefisso davanti e lo dice
 * nell'intestazione. E' esattamente il pezzo che si sta provando. */
const vero = server.listeners("request")[0];
server.removeAllListeners("request");
server.on("request", (richiesta, risposta) => {
  richiesta.headers["x-ingress-path"] = DAVANTI;
  vero(richiesta, risposta);
});

await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const dove = `http://127.0.0.1:${server.address().port}`;
process.stdout.write(`Il ponte finto: ${dove}${DAVANTI}/app\n`);

mkdirSync(FOTO, { recursive: true });
const chrome = trovaIlBrowser();
if (chrome) process.stdout.write(`Chromium: ${chrome}\n`);
const browser = await chromium.launch({
  ...(chrome ? { executablePath: chrome } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-proxy-server"],
});

let storto = 0;
for (const misura of MISURE) {
  const contesto = await browser.newContext({
    viewport: { width: misura.larghezza, height: misura.altezza },
    deviceScaleFactor: 2,
  });
  const pagina = await contesto.newPage();
  const guai = [];
  pagina.on("pageerror", (male) => guai.push(String(male)));
  pagina.on("requestfailed", (chiesta) => {
    /* Quello che l'app va a prendere fuori — i caratteri di Google — non e'
     * roba nostra e non deve far cadere niente: senza linea l'app si disegna
     * lo stesso, ed e' proprio quello che si vuole vedere. */
    if (chiesta.url().startsWith(dove)) guai.push(`non arrivato: ${chiesta.url()}`);
  });

  await pagina.goto(`${dove}${DAVANTI}/app`, { waitUntil: "load" });
  await pagina.waitForTimeout(6000);

  const base = await pagina.evaluate(() => document.baseURI);
  const atteso = `${dove}${DAVANTI}/app/`;
  process.stdout.write(`\n── ${misura.nome} (${misura.larghezza}px) ──\n`);
  process.stdout.write(`   indirizzo: ${pagina.url()}\n`);
  process.stdout.write(`   base:      ${base}\n`);
  if (pagina.url() !== atteso) {
    process.stdout.write(`   ⚠ l'indirizzo doveva essere ${atteso}\n`);
    storto += 1;
  }
  if (base !== atteso) {
    process.stdout.write(`   ⚠ la base doveva essere ${atteso}\n`);
    storto += 1;
  }
  if (guai.length) {
    process.stdout.write(`   ⚠ guai:\n     ${guai.slice(0, 8).join("\n     ")}\n`);
    storto += guai.length;
  }
  await pagina.screenshot({ path: join(FOTO, `link-${misura.nome}.png`) });
  await contesto.close();
}

await browser.close();
server.close();
process.stdout.write(
  storto ? `\n${storto} cose storte.\n` : "\nTutto a posto: le fotografie stanno in collaudo/foto.\n",
);
process.exit(storto ? 1 : 0);
