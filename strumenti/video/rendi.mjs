#!/usr/bin/env node
/* Chi filma.
 *
 * Apre la pagina di un film in un Chromium, e per ogni scena fa una cosa
 * sola, tante volte: sposta l'orologio delle animazioni al fotogramma che
 * tocca, scatta, e passa lo scatto a ffmpeg. Il filmato esce da li'.
 *
 * Perche' non si registra e basta: una registrazione dal vivo dipende da
 * quanto e' carico il computer, e due riprese della stessa pagina danno due
 * file diversi — con i fotogrammi lunghi dove il portatile ha rallentato.
 * Qui il tempo non passa, si dice: venticinque fotogrammi al secondo esatti,
 * sempre gli stessi.
 *
 *   node strumenti/video/rendi.mjs                 i quattro film, in due lingue
 *   node strumenti/video/rendi.mjs --film tiktok   uno solo
 *   node strumenti/video/rendi.mjs --lingua en     solo l'inglese
 *   node strumenti/video/rendi.mjs --scena il-codice          una scena sola
 *   node strumenti/video/rendi.mjs --foto il-codice@3.2       una fotografia
 *   node strumenti/video/rendi.mjs --copertine                le immagini ferme
 *
 * **Le lingue sono due**, e non sono due film: e' lo stesso, con le parole che
 * cambiano (`pezzi.js`, `t()`). Quello inglese si chiama come l'altro con
 * `-en` in fondo — `gdahome-tiktok-en.mp4` — cosi' i due stanno vicini nella
 * cartella e non si confondono.
 *
 * Il suono non c'e' in nessuno: le parole stanno scritte sopra. Nei due film
 * per i social c'e' pero' una traccia **muta**, perche' un negozio che riceve
 * un video senza nessuna traccia audio ogni tanto lo rifiuta.
 */

import { createServer } from "node:http";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, "..", "..");
const AL_SECONDO = 25;
const LINGUE = ["it", "en"];

/* Il nome di un file, nella lingua in cui e' girato: l'italiano si chiama come
   si e' sempre chiamato, cosi' chi aveva un collegamento ce l'ha ancora. */
const conLaLingua = (nome, lingua) => (lingua === "it" ? nome : `${nome}-${lingua}`);

/* I film.
 *
 * Il lungo e' quello che spiega; i due per i social dicono le stesse cose in
 * quarantasei secondi, e sono **lo stesso film** con due palchi diversi: un
 * quadrato per Facebook, uno in piedi per TikTok. Il quarto parla a chi
 * installa, e non a chi abita: e' l'unico che fa vedere il quadro.
 *
 * `su` e `giu` sono l'aria da lasciare sopra e sotto. Su TikTok quella sotto
 * non e' scelta da noi: li' ci stanno il testo, i tasti e il nome di chi
 * pubblica, e un video che ci scrive sotto e' un video scritto per meta'.
 */
const FILM = {
  presentazione: {
    pagina: "presentazione.html",
    largo: 1280,
    alto: 720,
    uscita: "gdahome-presentazione",
    ritmo: "2600k",
    copertina: { scena: "apertura", quando: 3.2 },
  },
  /* Il quarto: quello per chi installa. Non parla a chi abita una casa —
     parla a chi ne segue quaranta — e per questo dice due cose che negli altri
     non ci sono: cosa si vede dal quadro, e cosa da li' **non si vede**. La
     seconda meta' e' quella che decide se questo pezzo si puo' dare a
     qualcuno, e sta nel film per intero. */
  quadro: {
    pagina: "quadro.html",
    largo: 1280,
    alto: 720,
    uscita: "gdahome-quadro",
    ritmo: "2600k",
    copertina: { scena: "l-elenco", quando: 3.2 },
  },
  facebook: {
    pagina: "social.html",
    largo: 1080,
    alto: 1080,
    posa: { su: 72, giu: 72, aria: 30, zoom: 1 },
    uscita: "gdahome-facebook",
    ritmo: "3400k",
    muto: true,
    copertina: { scena: "il-gancio", quando: 3.2 },
  },
  tiktok: {
    pagina: "social.html",
    largo: 1080,
    alto: 1920,
    posa: { su: 210, giu: 390, aria: 40, zoom: 1.15 },
    uscita: "gdahome-tiktok",
    ritmo: "4200k",
    muto: true,
    copertina: { scena: "il-gancio", quando: 3.2 },
  },
};

/* Le copertine: due immagini ferme, fatte con la stessa macchina dei film.
 *
 * Facebook le taglia in due modi diversi — il gruppo si accorcia in basso, la
 * pagina sul telefono perde i lati — e il disegno ne tiene conto: sta in
 * `copertine.js`. */
const COPERTINE = {
  gruppo: {
    pagina: "copertine.html",
    largo: 1640,
    alto: 856,
    posa: { tipo: "gruppo" },
    uscita: "gdahome-copertina-gruppo",
  },
  pagina: {
    pagina: "copertine.html",
    largo: 1640,
    alto: 624,
    posa: { tipo: "pagina" },
    uscita: "gdahome-copertina-pagina",
  },
  /* L'immagine del profilo della pagina: quadrata, che Facebook ritaglia
     tonda. Dentro c'e' solo il marchio, quindi la lingua non la riguarda e se
     ne fa una sola. */
  profilo: {
    pagina: "copertine.html",
    largo: 1080,
    alto: 1080,
    posa: { tipo: "profilo" },
    uscita: "gdahome-profilo",
    senzaParole: true,
  },
};

/* ── Gli attrezzi, dove stanno ────────────────────────────────────────── */

/* Playwright sta installato di fianco al progetto o fra i pacchetti globali,
   e in un caso arriva impacchettato in `default`: e' scritto alla vecchia
   maniera, e chi lo importa cosi' se lo trova li' dentro. */
async function apriPlaywright() {
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

/* ffmpeg, e cosa sa fare.
 *
 * Quello di sistema, se c'e', sa fare **mp4**, ed e' quello che vogliono i
 * negozi dei video: TikTok un webm non lo prende, e Facebook lo prende male.
 * Quello che Playwright si porta dietro sa fare solo webm/VP8 — va benissimo
 * per guardare il filmato in un browser, e per i social e' un ripiego che va
 * detto invece che scoperto dopo. */
async function trovaFfmpeg() {
  const prova = (dove) => {
    try {
      const encoder = execFileSync(dove, ["-hide_banner", "-encoders"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      return { dove, mp4: encoder.includes("libx264") };
    } catch {
      return null;
    }
  };

  try {
    const inCammino = execFileSync("sh", ["-c", "command -v ffmpeg"], { encoding: "utf8" }).trim();
    const buono = inCammino && prova(inCammino);
    if (buono) return buono;
  } catch {
    /* niente in PATH: si guarda nella cartella dei browser di Playwright */
  }
  const cartella = process.env.PLAYWRIGHT_BROWSERS_PATH || "";
  if (cartella && existsSync(cartella)) {
    for (const nome of await readdir(cartella)) {
      if (!nome.startsWith("ffmpeg")) continue;
      const dove = path.join(cartella, nome, "ffmpeg-linux");
      if (existsSync(dove)) return { dove, mp4: false };
    }
  }
  throw new Error("ffmpeg non trovato: installalo, oppure lascia fare a Playwright.");
}

/* Come si impacchetta: mp4 se si puo', se no webm. */
function comeSiImpacchetta(ffmpeg, film, uscita) {
  const dentro = [
    "-f",
    "image2pipe",
    "-c:v",
    "mjpeg",
    "-framerate",
    String(AL_SECONDO),
    "-i",
    "pipe:0",
  ];
  if (!ffmpeg.mp4) {
    return [
      ...dentro,
      "-an",
      "-c:v",
      "libvpx",
      "-b:v",
      film.ritmo,
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
      `${uscita}.webm`,
    ];
  }
  /* La traccia muta: un video senza nessun audio ogni tanto un negozio lo
     rifiuta, e accorgersene mentre si pubblica e' la cosa peggiore. */
  const suono = film.muto
    ? [
        "-f",
        "lavfi",
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        "-shortest",
      ]
    : ["-an"];
  return [
    ...dentro,
    ...suono,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-maxrate",
    film.ritmo,
    "-bufsize",
    "8M",
    "-profile:v",
    "high",
    "-level",
    "4.0",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    `${uscita}.mp4`,
  ];
}

/* ── Il QR code ───────────────────────────────────────────────────────── */

/* Il QR del video lo disegna **l'add-on**, con il suo encoder: un quadrato
   finto disegnato a mano sarebbe l'unica cosa del filmato che non viene da
   qui dentro. Quello che ci sta scritto e' un codice **finto**, e lo dice:
   chi lo inquadra si trova in mano una frase, non un abbinamento. */
async function fabbricaIlQrCode() {
  const { qrInSvg } = await import(pathToFileURL(path.join(RADICE, "ponte/src/qr.js")).href);
  const finto = "gdahome://codice-finto-del-video/non-abbina-niente";
  await writeFile(
    path.join(QUI, "qrcode.svg"),
    qrInSvg(finto, { titolo: "Codice di abbinamento (finto)" }),
  );
}

/* ── Un servitore, per i file che stanno qui ──────────────────────────── */

const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  /* I tempi del parlato, che il film del quadro si va a prendere da solo
     (`parlato-tempi.json`). Senza questa riga si serviva come una roba
     qualunque: `fetch` lo leggeva lo stesso, ma un file servito col tipo
     sbagliato e' un guasto che aspetta. */
  ".json": "application/json; charset=utf-8",
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

/* L'indirizzo di un film: la sua pagina, come sta in piedi il palco, e in che
   lingua si gira. */
const indirizzo = (porta, film, lingua) => {
  const roba = new URLSearchParams({
    largo: film.largo,
    alto: film.alto,
    lingua,
    ...(film.posa ?? {}),
  });
  return `http://127.0.0.1:${porta}/strumenti/video/${film.pagina}?${roba}`;
};

/* ── La ripresa ───────────────────────────────────────────────────────── */

const detto = (...cose) => console.log(...cose);

/* Apre la pagina di un film e aspetta che sia pronta a farsi fotografare. */
async function apriIlFilm(browser, porta, film, lingua = "it") {
  const pagina = await browser.newPage({
    viewport: { width: film.largo, height: film.alto },
    deviceScaleFactor: 1,
  });
  const guai = [];
  pagina.on("pageerror", (guaio) => guai.push(String(guaio)));
  pagina.on("console", (riga) => {
    if (riga.type() === "error") guai.push(riga.text());
  });
  await pagina.goto(indirizzo(porta, film, lingua), { waitUntil: "networkidle" });
  await pagina.waitForFunction(() => window.video !== undefined, null, { timeout: 15000 });
  await pagina.evaluate(() => window.video.pronta());
  if (guai.length) detto("⚠ la pagina si lamenta:", guai.slice(0, 3).join(" / "));
  return { pagina, elenco: await pagina.evaluate(() => window.video.elenco) };
}

/* Gira un film intero, o una scena sola. */
async function gira(browser, porta, ffmpeg, nomeDelFilm, soloQuesta, dove, lingua = "it") {
  const film = FILM[nomeDelFilm];
  const { pagina, elenco } = await apriIlFilm(browser, porta, film, lingua);

  const daFare = elenco
    .map((scena, i) => ({ ...scena, i }))
    .filter((scena) => !soloQuesta || scena.nome === soloQuesta);
  if (!daFare.length)
    throw new Error(`in «${nomeDelFilm}» nessuna scena si chiama «${soloQuesta}»`);

  /* Una scena sola finisce fra i provini, non sopra il filmato buono: chi
     prova una scena non si aspetta di perdere gli altri due minuti. */
  const uscita =
    dove ||
    (soloQuesta
      ? path.join(QUI, "provini", conLaLingua(soloQuesta, lingua))
      : path.join(QUI, conLaLingua(film.uscita, lingua)));
  const ricetta = comeSiImpacchetta(ffmpeg, film, uscita);
  const cuoco = spawn(ffmpeg.dove, ["-y", ...ricetta], { stdio: ["pipe", "ignore", "pipe"] });
  let lamento = "";
  cuoco.stderr.on("data", (pezzo) => (lamento = String(pezzo)));
  const manda = async (roba) => {
    if (!cuoco.stdin.write(roba)) await once(cuoco.stdin, "drain");
  };

  detto(`🎬 ${nomeDelFilm} · ${lingua} · ${film.largo}×${film.alto} · ${daFare.length} scene`);
  let fotogrammi = 0;
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
      `   · ${scena.nome.padEnd(24)} ${String(scena.durata).padStart(5)}s  ${String(quanti).padStart(4)} fotogrammi, ${scattati} scattati`,
    );
  }

  cuoco.stdin.end();
  const [codice] = await once(cuoco, "close");
  if (codice !== 0) throw new Error(`ffmpeg si e' fermato (${codice}): ${lamento}`);

  /* La copertina: il fotogramma da mettere dove il filmato non si vede
     ancora. Si rifa' a ogni ripresa intera, cosi' non resta indietro. */
  if (!soloQuesta) {
    const quale = elenco.findIndex((s) => s.nome === film.copertina.scena);
    await pagina.evaluate((i) => window.video.vaiA(i), quale);
    await pagina.evaluate((ms) => window.video.vaiAlMomento(ms), film.copertina.quando * 1000);
    await pagina.screenshot({
      path: path.join(QUI, `${conLaLingua(film.uscita, lingua)}-copertina.png`),
    });
  }

  await pagina.close();
  const nome = `${uscita}.${ffmpeg.mp4 ? "mp4" : "webm"}`;
  detto(`✅ ${nome} — ${(fotogrammi / AL_SECONDO).toFixed(1)}s, ${fotogrammi} fotogrammi`);
  return nome;
}

async function main() {
  const argomenti = process.argv.slice(2);
  const valore = (nome) => {
    const dove = argomenti.indexOf(nome);
    return dove === -1 ? null : argomenti[dove + 1];
  };
  const quali = valore("--film") ? [valore("--film")] : Object.keys(FILM);
  for (const nome of quali) {
    if (!FILM[nome]) throw new Error(`film sconosciuto: ${nome} (ci sono: ${Object.keys(FILM)})`);
  }
  const soloQuesta = valore("--scena");
  const fotografie = valore("--foto");
  const soloCopertine = argomenti.includes("--copertine");
  const lingue = valore("--lingua") ? [valore("--lingua")] : LINGUE;
  for (const lingua of lingue) {
    if (!LINGUE.includes(lingua))
      throw new Error(`lingua sconosciuta: ${lingua} (ci sono: ${LINGUE})`);
  }

  await mkdir(path.join(QUI, "provini"), { recursive: true });
  await fabbricaIlQrCode();
  const chromium = await apriPlaywright();
  const server = await servitore();
  const porta = server.address().port;
  const browser = await chromium.launch({
    args: ["--force-color-profile=srgb", "--font-render-hinting=none", "--disable-lcd-text"],
  });

  try {
    /* Le copertine di Facebook: due immagini ferme. */
    if (soloCopertine) {
      for (const [nome, copertina] of Object.entries(COPERTINE)) {
        /* Quella senza parole si fa una volta sola: girarla due volte darebbe
           due file identici con due nomi. */
        for (const lingua of copertina.senzaParole ? ["it"] : lingue) {
          const { pagina } = await apriIlFilm(browser, porta, copertina, lingua);
          await pagina.evaluate(() => window.video.vaiA(0));
          /* Ferme vuol dire ferme: si porta l'orologio oltre la fine di tutto,
             cosi' quello che si vede e' lo stato finale e non un mezzo
             ingresso. */
          await pagina.evaluate(() => window.video.vaiAlMomento(20000));
          const dove = path.join(QUI, `${conLaLingua(copertina.uscita, lingua)}.png`);
          await pagina.screenshot({ path: dove });
          await pagina.close();
          detto(`🖼  ${nome.padEnd(8)} ${lingua}  ${copertina.largo}×${copertina.alto}  ${dove}`);
        }
      }
      return;
    }

    /* Una fotografia sola, per guardare com'e' venuta una scena. */
    if (fotografie) {
      for (const nomeDelFilm of quali) {
        const film = FILM[nomeDelFilm];
        for (const lingua of lingue) {
          const { pagina, elenco } = await apriIlFilm(browser, porta, film, lingua);
          for (const pezzo of fotografie.split(",")) {
            const [nome, quando] = pezzo.split("@");
            const quale = elenco.findIndex((s) => s.nome === nome.trim());
            if (quale === -1) continue;
            await pagina.evaluate((i) => window.video.vaiA(i), quale);
            await pagina.evaluate(
              (ms) => window.video.vaiAlMomento(ms),
              Number(quando || 0) * 1000,
            );
            const dove = path.join(
              QUI,
              "provini",
              `${nomeDelFilm}-${lingua}-${nome.trim()}-${quando || 0}.png`,
            );
            await pagina.screenshot({ path: dove });
            detto("📷", dove);
          }
          await pagina.close();
        }
      }
      return;
    }

    const ffmpeg = await trovaFfmpeg();
    detto(`   ffmpeg: ${ffmpeg.dove}${ffmpeg.mp4 ? "" : " — senza h264: esce webm invece di mp4"}`);
    const cominciato = Date.now();
    for (const nomeDelFilm of quali) {
      for (const lingua of lingue) {
        await gira(browser, porta, ffmpeg, nomeDelFilm, soloQuesta, valore("--dove"), lingua);
      }
    }
    detto(`   ripresi in ${((Date.now() - cominciato) / 1000).toFixed(0)}s`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((guaio) => {
  console.error("✖", guaio.message);
  process.exit(1);
});
