#!/usr/bin/env node
/* Chi filma.
 *
 * Apre `presentazione.html` in un Chromium, e per ogni scena fa una cosa
 * sola, tante volte: sposta l'orologio delle animazioni al fotogramma che
 * tocca, scatta, e passa lo scatto a ffmpeg. Il filmato esce da li'.
 *
 * Perche' non si registra e basta: una registrazione dal vivo dipende da
 * quanto e' carico il computer, e due riprese della stessa pagina danno due
 * file diversi — con i fotogrammi lunghi dove il portatile ha rallentato.
 * Qui il tempo non passa, si dice: venticinque fotogrammi al secondo esatti,
 * sempre gli stessi.
 *
 *   node strumenti/video/rendi.mjs
 *   node strumenti/video/rendi.mjs --scena il-codice      una scena sola
 *   node strumenti/video/rendi.mjs --foto il-codice@3.2   una fotografia
 *
 * Il suono non c'e', e non e' una dimenticanza: il ffmpeg che si trova qui
 * dentro e' quello di Playwright, che sa fare il video e basta. Le parole
 * stanno scritte sul filmato, e il copione per chi le volesse leggere sta in
 * `copione.md`.
 */

import { createServer } from "node:http";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, "..", "..");
const AL_SECONDO = 25;
const LARGO = 1280;
const ALTO = 720;

/* La copertina: il fotogramma che si mette come anteprima dove il filmato non
   si vede ancora — la pagina della cartella, un messaggio, il negozio dei
   video. Si rifà a ogni ripresa intera, cosi' non resta indietro. */
const COPERTINA = { scena: "apertura", quando: 3.2 };

/* ── Gli attrezzi, dove stanno ────────────────────────────────────────── */

/* Playwright sta installato di fianco al progetto o fra i pacchetti globali:
   si prova il primo posto, e se non c'e' si chiede a npm dov'e' il secondo. */
async function apriPlaywright() {
  /* Preso di fianco al progetto o fra i pacchetti globali, e in un caso
     arriva impacchettato in `default`: Playwright e' scritto alla vecchia
     maniera, e chi lo importa cosi' se lo trova li' dentro. */
  const dentro = (roba) => roba?.chromium ?? roba?.default?.chromium;
  try {
    const vicino = await import("playwright");
    if (dentro(vicino)) return dentro(vicino);
  } catch {
    /* niente di fianco al progetto: si guarda fra i globali */
  }
  const globale = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
  const dove = path.join(globale, "playwright", "index.js");
  if (!existsSync(dove)) {
    throw new Error("Playwright non c'e': `npm i -D playwright`, oppure `npm i -g playwright`.");
  }
  const lontano = dentro(await import(pathToFileURL(dove).href));
  if (!lontano) throw new Error("Playwright c'e' ma non da' chromium: versione strana?");
  return lontano;
}

/* ffmpeg: quello di sistema se c'e', se no quello che Playwright si porta
   dietro — sa fare webm/VP8 e gli va bene una fila di JPEG in pasto. */
async function trovaFfmpeg() {
  try {
    return execFileSync("sh", ["-c", "command -v ffmpeg"], { encoding: "utf8" }).trim();
  } catch {
    /* niente in PATH: si guarda nella cartella dei browser di Playwright */
  }
  const cartella = process.env.PLAYWRIGHT_BROWSERS_PATH || "";
  if (cartella && existsSync(cartella)) {
    for (const nome of await readdir(cartella)) {
      if (!nome.startsWith("ffmpeg")) continue;
      const dove = path.join(cartella, nome, "ffmpeg-linux");
      if (existsSync(dove)) return dove;
    }
  }
  throw new Error("ffmpeg non trovato: installalo, oppure lascia fare a Playwright.");
}

/* ── Il quadretto ─────────────────────────────────────────────────────── */

/* Il QR del video lo disegna **l'add-on**, con il suo encoder: un quadrato
   finto disegnato a mano sarebbe l'unica cosa del filmato che non viene da
   qui dentro. Quello che ci sta scritto e' un codice **finto**, e lo dice:
   chi lo inquadra si trova in mano una frase, non un abbinamento. */
async function fabbricaIlQuadretto() {
  const dove = path.join(QUI, "quadretto.svg");
  const { qrInSvg } = await import(pathToFileURL(path.join(RADICE, "ponte/src/qr.js")).href);
  const finto = "gdahome://codice-finto-del-video/non-abbina-niente";
  await writeFile(dove, qrInSvg(finto, { titolo: "Codice di abbinamento (finto)" }));
  return dove;
}

/* ── Un servitore, per i file che stanno qui ──────────────────────────── */

const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ttf": "font/ttf",
};

function servitore() {
  const server = createServer(async (domanda, risposta) => {
    const dove = path.join(RADICE, decodeURIComponent(new URL(domanda.url, "http://x").pathname));
    /* Fuori dalla radice non si serve niente. */
    if (!dove.startsWith(RADICE)) {
      risposta.writeHead(403).end();
      return;
    }
    try {
      const roba = await readFile(dove);
      risposta.writeHead(200, {
        "content-type": TIPI[path.extname(dove)] || "application/octet-stream",
      });
      risposta.end(roba);
    } catch {
      risposta.writeHead(404).end();
    }
  });
  return new Promise((pronto) => server.listen(0, "127.0.0.1", () => pronto(server)));
}

/* ── La ripresa ───────────────────────────────────────────────────────── */

const detto = (...cose) => console.log(...cose);

async function main() {
  const argomenti = process.argv.slice(2);
  const valore = (nome) => {
    const dove = argomenti.indexOf(nome);
    return dove === -1 ? null : argomenti[dove + 1];
  };
  const soloQuesta = valore("--scena");
  const fotografie = valore("--foto");
  /* Una scena sola finisce fra i provini, non sopra il filmato buono: chi
     prova una scena non si aspetta di perdere gli altri due minuti. */
  const uscita =
    valore("--dove") ||
    (soloQuesta
      ? path.join(QUI, "provini", `${soloQuesta}.webm`)
      : path.join(QUI, "gdahome-presentazione.webm"));

  await fabbricaIlQuadretto();
  const chromium = await apriPlaywright();
  const server = await servitore();
  const porta = server.address().port;

  const browser = await chromium.launch({
    args: ["--force-color-profile=srgb", "--font-render-hinting=none", "--disable-lcd-text"],
  });
  const pagina = await browser.newPage({
    viewport: { width: LARGO, height: ALTO },
    deviceScaleFactor: 1,
  });
  const guai = [];
  pagina.on("pageerror", (guaio) => guai.push(String(guaio)));
  pagina.on("console", (riga) => {
    if (riga.type() === "error") guai.push(riga.text());
  });

  await pagina.goto(`http://127.0.0.1:${porta}/strumenti/video/presentazione.html`, {
    waitUntil: "networkidle",
  });
  await pagina.waitForFunction(() => window.video !== undefined, null, { timeout: 15000 });
  await pagina.evaluate(() => window.video.pronta());

  const elenco = await pagina.evaluate(() => window.video.elenco);
  if (guai.length) {
    detto("⚠ la pagina si lamenta:", guai.slice(0, 5).join(" / "));
  }

  /* Una fotografia sola, per guardare com'e' venuta una scena. */
  if (fotografie) {
    for (const pezzo of fotografie.split(",")) {
      const [nome, quando] = pezzo.split("@");
      const quale = elenco.findIndex((s) => s.nome === nome.trim());
      if (quale === -1) throw new Error(`scena sconosciuta: ${nome}`);
      await pagina.evaluate((i) => window.video.vaiA(i), quale);
      await pagina.evaluate((ms) => window.video.vaiAlMomento(ms), Number(quando || 0) * 1000);
      const dove = path.join(QUI, "provini", `${nome.trim()}-${quando || 0}.png`);
      await pagina.screenshot({ path: dove });
      detto("📷", dove);
    }
    await browser.close();
    server.close();
    return;
  }

  const daFare = elenco
    .map((scena, i) => ({ ...scena, i }))
    .filter((scena) => !soloQuesta || scena.nome === soloQuesta);
  if (!daFare.length) throw new Error(`nessuna scena si chiama «${soloQuesta}»`);

  const ffmpeg = await trovaFfmpeg();
  detto(`🎬 ${daFare.length} scene · ${AL_SECONDO} fotogrammi al secondo · ${LARGO}×${ALTO}`);
  detto(`   ffmpeg: ${ffmpeg}`);

  const cuoco = spawn(
    ffmpeg,
    [
      "-y",
      "-f",
      "image2pipe",
      "-c:v",
      "mjpeg",
      "-framerate",
      String(AL_SECONDO),
      "-i",
      "pipe:0",
      "-an",
      "-c:v",
      "libvpx",
      "-b:v",
      "2600k",
      "-crf",
      "12",
      "-qmin",
      "3",
      "-qmax",
      "40",
      "-deadline",
      "good",
      "-cpu-used",
      "3",
      "-auto-alt-ref",
      "0",
      "-pix_fmt",
      "yuv420p",
      "-threads",
      "4",
      uscita,
    ],
    { stdio: ["pipe", "ignore", "pipe"] },
  );
  let lamento = "";
  cuoco.stderr.on("data", (pezzo) => (lamento = String(pezzo)));

  const manda = async (roba) => {
    if (!cuoco.stdin.write(roba)) await once(cuoco.stdin, "drain");
  };

  let fotogrammi = 0;
  const cominciato = Date.now();

  for (const scena of daFare) {
    await pagina.evaluate((i) => window.video.vaiA(i), scena.i);
    /* Un giro di disegno prima di chiedere le animazioni: quelle di una scena
       appena mostrata non esistono ancora. */
    await pagina.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
    const siFerma = await pagina.evaluate(() => window.video.quandoSiFerma());

    const quanti = Math.round(scena.durata * AL_SECONDO);
    let ultimo = null;
    let scattati = 0;
    for (let f = 0; f < quanti; f += 1) {
      const quando = (f / AL_SECONDO) * 1000;
      /* Finita l'ultima animazione, la scena e' ferma: lo stesso scatto
         rimandato costa niente, e rifarlo costerebbe come tutti gli altri. */
      if (ultimo === null || quando <= siFerma + 1000 / AL_SECONDO) {
        await pagina.evaluate((ms) => window.video.vaiAlMomento(ms), quando);
        ultimo = await pagina.screenshot({ type: "jpeg", quality: 94 });
        scattati += 1;
      }
      await manda(ultimo);
      fotogrammi += 1;
    }
    detto(
      `   · ${scena.nome.padEnd(26)} ${String(scena.durata).padStart(5)}s  ${String(quanti).padStart(4)} fotogrammi, ${scattati} scattati`,
    );
  }

  cuoco.stdin.end();
  const [codice] = await once(cuoco, "close");

  /* La copertina, alla fine e solo dalla ripresa intera. */
  if (!soloQuesta) {
    const quale = elenco.findIndex((s) => s.nome === COPERTINA.scena);
    await pagina.evaluate((i) => window.video.vaiA(i), quale);
    await pagina.evaluate((ms) => window.video.vaiAlMomento(ms), COPERTINA.quando * 1000);
    await pagina.screenshot({ path: path.join(QUI, "copertina.png") });
  }

  await browser.close();
  server.close();

  if (codice !== 0) throw new Error(`ffmpeg si e' fermato (${codice}): ${lamento}`);

  const durata = (fotogrammi / AL_SECONDO).toFixed(1);
  const quanto = ((Date.now() - cominciato) / 1000).toFixed(0);
  detto(`✅ ${uscita}`);
  detto(`   ${durata}s di filmato, ${fotogrammi} fotogrammi, ripresi in ${quanto}s`);
  if (guai.length) detto(`⚠ ${guai.length} lamentele dalla pagina:`, guai.slice(0, 3));
}

main().catch((guaio) => {
  console.error("✖", guaio.message);
  process.exit(1);
});
