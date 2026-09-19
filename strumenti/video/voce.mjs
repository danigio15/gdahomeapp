#!/usr/bin/env node
/* La voce del film del quadro.
 *
 *   node strumenti/video/voce.mjs                 la voce nei due film
 *   node strumenti/video/voce.mjs --lingua it     solo l'italiano
 *   node strumenti/video/voce.mjs --misura        i tempi, senza toccare niente
 *   node strumenti/video/voce.mjs --attacca       riattacca le tracce gia' fatte
 *
 * Gli altri tre film sono muti apposta — le parole stanno scritte sopra, ed e'
 * anche il modo in cui li guardano quasi tutti, col telefono in silenzio.
 * Questo no: spiega un mestiere a chi lo fa, si guarda seduti, e una voce che
 * racconta mentre lo schermo mostra arriva dove una didascalia non arriva.
 *
 * **Le parole stanno lo stesso scritte**, e non per prudenza: le didascalie del
 * film restano tutte, cosi' il filmato si capisce anche senza audio — un video
 * che si apre in una pagina senza suono, o guardato in treno, non deve
 * diventare mezzo film.
 *
 * ─── La voce e' una macchina, ed e' scritto ──────────────────────────────
 *
 * Non c'e' nessuno in questo progetto che registri due minuti di italiano
 * senza rifarli venti volte, e una voce registrata male invecchia peggio di
 * una sintetica: cambia una riga del copione e va rifatta tutta la sessione.
 * Qui invece si cambia la riga in `parlato.js` e si rilancia.
 *
 * La fa **piper**, che gira in casa e non chiama nessuno: nessun servizio,
 * nessuna chiave, nessuna riga di testo che esce da questa macchina. Il giorno
 * che qualcuno registra la sua voce, le tracce si sostituiscono e il film si
 * rifa' con `--attacca` senza toccare una riga di programma.
 *
 * ─── Cosa serve, e dove si prende ────────────────────────────────────────
 *
 * Piper e due voci, che non stanno nella repository: sono ottanta megabyte di
 * roba di terzi, e si scaricano una volta.
 *
 *   mkdir -p strumenti/video/voce && cd strumenti/video/voce
 *   curl -sSL -o piper.tar.gz https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz
 *   curl -sSL -o it.tar.gz    https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-it-riccardo_fasol-x-low.tar.gz
 *   curl -sSL -o en.tar.gz    https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-lessac-medium.tar.gz
 *   for f in *.tar.gz; do tar xzf "$f"; done
 *
 * Quella cartella non si versiona (`.gitignore`). Chi ce l'ha altrove lo dice
 * con `PIPER`, `PIPER_VOCE_IT` e `PIPER_VOCE_EN`.
 *
 * Le tracce invece **stanno** nella repository — `voce-quadro.m4a` e
 * `voce-quadro-en.m4a`, un mega in due — cosi' chi rifa' il film non ha
 * bisogno di piper: `--attacca` le riattacca e basta.
 */

import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile, rename } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CODA, PARLATO, RESPIRO } from "./parlato.js";

const QUI = path.dirname(fileURLToPath(import.meta.url));
const LINGUE = ["it", "en"];
const FILM = "gdahome-quadro";

const detto = (...cose) => console.log(...cose);
const conLaLingua = (nome, lingua) => (lingua === "it" ? nome : `${nome}-${lingua}`);

/* ── Le durate delle scene ────────────────────────────────────────────────
 *
 * Stanno in `quadro.js`, dove stanno le scene, e qui si leggono da li'.
 *
 * Si leggono **dal file**, con una espressione regolare, e non aprendo un
 * browser: `quadro.js` e' un documento da pagina — importa `pezzi.js`, che
 * guarda `location` e `document` — e Node non lo puo' caricare. Aprire un
 * Chromium per leggere quattordici numeri sarebbe un browser intero per una
 * tabella. La forma e' quella di sempre, `scena("nome", durata, …)`, ed e'
 * scritta da noi; se un giorno cambia, qui sotto non si trova nessuna scena e
 * la ripresa si ferma dicendolo, invece di fare un film sbagliato. */
async function leScene() {
  const dentro = await readFile(path.join(QUI, "quadro.js"), "utf8");
  const trovate = [...dentro.matchAll(/\bscena\(\s*"([^"]+)",\s*([\d.]+),/g)].map((una) => ({
    nome: una[1],
    durata: Number(una[2]),
  }));
  if (!trovate.length) {
    throw new Error("in quadro.js non si trova nessuna scena: e' cambiata la forma di scena(…)?");
  }
  return trovate;
}

/* ── Piper, e le due voci ─────────────────────────────────────────────── */

function trovaPiper() {
  const suo = process.env.PIPER;
  if (suo && existsSync(suo)) return suo;
  const vicino = path.join(QUI, "voce", "piper", "piper");
  if (existsSync(vicino)) return vicino;
  try {
    const inCammino = execFileSync("sh", ["-c", "command -v piper"], { encoding: "utf8" }).trim();
    if (inCammino) return inCammino;
  } catch {
    /* niente in PATH */
  }
  throw new Error(
    "piper non c'e'. Si scarica una volta sola: vedi le istruzioni in cima a questo file,\n" +
      "oppure dillo con PIPER=/dove/sta/piper.",
  );
}

async function trovaLaVoce(lingua) {
  const sua = process.env[lingua === "it" ? "PIPER_VOCE_IT" : "PIPER_VOCE_EN"];
  if (sua && existsSync(sua)) return sua;
  const dove = path.join(QUI, "voce");
  if (existsSync(dove)) {
    /* `it-…x-low.onnx` e `en-us-…​.onnx`: si riconoscono dal principio del nome. */
    const quali = (await readdir(dove)).filter(
      (nome) => nome.endsWith(".onnx") && nome.startsWith(`${lingua}-`),
    );
    if (quali.length) return path.join(dove, quali.sort()[0]);
  }
  throw new Error(
    `la voce ${lingua} non c'e' in strumenti/video/voce/: vedi le istruzioni in cima a questo file.`,
  );
}

/* ── Il parlato, un pezzo per volta ───────────────────────────────────── */

/* Quanto si legge piano. Uno che spiega un mestiere non corre, e la voce di
   serie corre: un filo piu' lenta, e un respiro piu' lungo fra una frase e
   l'altra, e quello che si sente somiglia a una persona che racconta. */
const ANDATURA = "1.06";
const RESPIRO_DI_FRASE = "0.35";

async function diLo(piper, voce, testo, dove) {
  /* Piper legge la frase dallo standard input e scrive il wav dove gli si
     dice. Una frase per volta, e non tutte insieme separate da un a capo:
     cosi' di ognuna si sa quanto dura, ed e' quello che serve per metterle al
     loro posto nel film. */
  const figlio = spawn(
    piper,
    [
      "--model",
      voce,
      "--length_scale",
      ANDATURA,
      "--sentence_silence",
      RESPIRO_DI_FRASE,
      "--output_file",
      dove,
    ],
    { stdio: ["pipe", "ignore", "pipe"] },
  );
  let lamento = "";
  figlio.stderr.on("data", (pezzo) => (lamento += String(pezzo)));
  figlio.stdin.end(`${testo}\n`);
  const [codice] = await once(figlio, "close");
  if (codice !== 0) throw new Error(`piper (${codice}): ${lamento.slice(-400)}`);
  return dove;
}

/* ── Un wav, letto e rimesso insieme ──────────────────────────────────────
 *
 * Piper scrive un wav PCM a 16 bit, mono. Qui si prende quello che c'e' dentro
 * — i byte del suono — e si rimette in fila nel posto giusto, con il silenzio
 * in mezzo. Farlo a mano invece che con un filtro di ffmpeg non e' orgoglio:
 * un `adelay` per trenta pezzi e' una riga di filtro lunga un chilometro, e
 * quando sbaglia non si capisce dove. Qui il conto e' una moltiplicazione. */
function ilSuono(wav) {
  if (wav.toString("ascii", 0, 4) !== "RIFF") throw new Error("questo non e' un wav");
  let dove = 12;
  let formato = null;
  while (dove + 8 <= wav.length) {
    const pezzo = wav.toString("ascii", dove, dove + 4);
    const quanto = wav.readUInt32LE(dove + 4);
    if (pezzo === "fmt ") {
      formato = {
        canali: wav.readUInt16LE(dove + 10),
        alSecondo: wav.readUInt32LE(dove + 12),
        bit: wav.readUInt16LE(dove + 22),
      };
    }
    if (pezzo === "data") {
      return { ...formato, byte: wav.subarray(dove + 8, dove + 8 + quanto) };
    }
    dove += 8 + quanto + (quanto % 2);
  }
  throw new Error("in questo wav non c'e' nessun «data»");
}

const quantoDura = (suono) =>
  suono.byte.length / (suono.alSecondo * suono.canali * (suono.bit / 8));

/** Un wav muto, lungo quanto si dice. */
const silenzio = (secondi, come) =>
  Buffer.alloc(Math.max(0, Math.round(secondi * come.alSecondo)) * come.canali * (come.bit / 8));

/** L'intestazione di un wav, davanti ai byte del suono. */
function intestazione(byte, come) {
  const testa = Buffer.alloc(44);
  const alByte = come.alSecondo * come.canali * (come.bit / 8);
  testa.write("RIFF", 0, "ascii");
  testa.writeUInt32LE(36 + byte.length, 4);
  testa.write("WAVEfmt ", 8, "ascii");
  testa.writeUInt32LE(16, 16);
  testa.writeUInt16LE(1, 20);
  testa.writeUInt16LE(come.canali, 22);
  testa.writeUInt32LE(come.alSecondo, 24);
  testa.writeUInt32LE(alByte, 28);
  testa.writeUInt16LE(come.canali * (come.bit / 8), 32);
  testa.writeUInt16LE(come.bit, 34);
  testa.write("data", 36, "ascii");
  testa.writeUInt32LE(byte.length, 40);
  return Buffer.concat([testa, byte]);
}

/* ── La ripresa ───────────────────────────────────────────────────────── */

/**
 * Dice tutto il parlato di una lingua, e torna i pezzi con i loro tempi.
 *
 * I tempi si contano **dentro la scena**: il primo pezzo comincia dopo `dopo`
 * secondi, gli altri uno dietro l'altro con un respiro in mezzo. Il posto nel
 * film lo si trova dopo, sommando le durate delle scene che vengono prima.
 */
async function diTutto(piper, voce, lingua, cartella) {
  const detti = [];
  for (const [quale, scena] of PARLATO.entries()) {
    let quando = scena.dopo;
    const pezzi = [];
    for (const [numero, pezzo] of scena.pezzi.entries()) {
      const dove = path.join(cartella, `${lingua}-${quale}-${numero}.wav`);
      await diLo(piper, voce, pezzo[lingua], dove);
      const suono = ilSuono(await readFile(dove));
      pezzi.push({ suono, quando, dura: quantoDura(suono) });
      quando += quantoDura(suono) + RESPIRO;
    }
    detti.push({ scena: scena.scena, pezzi, finisce: quando - RESPIRO });
  }
  return detti;
}

/**
 * Quanto dura ogni scena, e da che minuto comincia.
 *
 * **La scena aspetta la voce.** Dura quello che c'e' scritto in `quadro.js` —
 * che e' il tempo che vuole quello che si vede — oppure quanto ci mette il
 * parlato a finire, se e' di piu'. Mai di meno: una voce che continua mentre
 * lo schermo e' gia' cambiato si sente subito, e si sente male.
 *
 * Quindi le due lingue fanno **due film di lunghezza diversa**, ed e' giusto
 * cosi': la stessa frase in inglese non dura quanto in italiano, e allungare
 * l'italiano per farlo tornare vorrebbe dire quattordici pause finte.
 */
function iTempi(scene, detti) {
  const parlato = new Map(detti.map((uno) => [uno.scena, uno.finisce + CODA]));
  let somma = 0;
  const dove = new Map();
  for (const una of scene) {
    const dura = Math.max(una.durata, Math.ceil((parlato.get(una.nome) ?? 0) * 4) / 4);
    dove.set(una.nome, { comincia: somma, dura, scritta: una.durata });
    somma += dura;
  }
  return { dove, tutto: somma };
}

/**
 * I tempi, scritti dove il film li va a prendere.
 *
 * `quadro.js` gira in un browser e non puo' far parlare nessuno: i tempi della
 * voce glieli si lascia qui, in un file che legge quando si apre. Dentro c'e',
 * per ogni lingua, quanto dura ogni scena e a che secondo comincia ognuno dei
 * pezzi che si dicono — e sono quelli che fanno arrivare le didascalie insieme
 * alle parole.
 *
 * **Sta nella repository**, ed e' l'unico file qui dentro fatto da un
 * programma. Il motivo e' che senza, chi rifa' il film senza piper installato
 * lo rifarebbe con le scene corte di prima e la voce gli finirebbe sopra.
 */
async function scriviITempi(lingua, tempi, detti) {
  const dove = path.join(QUI, "parlato-tempi.json");
  let tutto = {};
  try {
    tutto = JSON.parse(await readFile(dove, "utf8"));
  } catch {
    /* la prima volta non c'e' */
  }
  tutto[lingua] = Object.fromEntries(
    detti.map((uno) => [
      uno.scena,
      {
        durata: Number(tempi.dove.get(uno.scena).dura.toFixed(2)),
        pezzi: uno.pezzi.map((pezzo) => Number(pezzo.quando.toFixed(2))),
      },
    ]),
  );
  await writeFile(dove, `${JSON.stringify(tutto, null, 2)}\n`);
  return dove;
}

/** Quanto dura davvero un film gia' girato. */
async function quantoDuraIlFilm(ffmpeg, film) {
  const probe = ffmpeg.replace(/ffmpeg$/, "ffprobe");
  try {
    const fuori = execFileSync(
      existsSync(probe) ? probe : "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", film],
      { encoding: "utf8" },
    );
    return Number(fuori.trim());
  } catch {
    return null;
  }
}

/**
 * I nomi delle scene tornano, e la tabella di quanto dura cosa.
 *
 * Il parlato non puo' piu' «non starci» — la scena si allunga da sola fino a
 * quando la voce ha finito (`iTempi`) — ma un nome sbagliato si': una scena
 * del copione che nel film non esiste e' una voce che non si sentirebbe mai, e
 * non se ne accorgerebbe nessuno.
 */
function guardaLeScene(detti, tempi, { dillo = false } = {}) {
  if (dillo) {
    detto(`   ${"scena".padEnd(24)} ${"parlato".padStart(8)} ${"scena".padStart(8)}`);
  }
  for (const uno of detti) {
    const suo = tempi.dove.get(uno.scena);
    if (!suo) {
      throw new Error(
        `nel copione c'e' una scena che nel film non esiste: «${uno.scena}».\n` +
          `I nomi sono quelli di scena(…) in quadro.js.`,
      );
    }
    if (dillo) {
      detto(
        `   ${uno.scena.padEnd(24)} ${(uno.finisce + CODA).toFixed(1).padStart(8)} ` +
          `${suo.dura.toFixed(1).padStart(8)}${suo.dura > suo.scritta ? "  ← la scena aspetta la voce" : ""}`,
      );
    }
  }

  /* E il contrario: una scena del film su cui non si dice niente. Non e' un
     errore — una scena puo' stare in piedi da sola — ma in un film parlato e'
     quasi sempre una riga di copione dimenticata, e mezzo minuto di silenzio
     in mezzo non se ne accorge nessuno finche' non lo si guarda. */
  const dette = new Set(detti.map((uno) => uno.scena));
  for (const [nome] of tempi.dove) {
    if (!dette.has(nome)) detto(`   ⚠ su «${nome}» non si dice niente: manca in parlato.js?`);
  }
}

/** Mette i pezzi al loro posto, e ne fa una traccia sola lunga quanto il film. */
function montaLaTraccia(detti, tempi) {
  const come = detti[0]?.pezzi[0]?.suono;
  if (!come) throw new Error("non c'e' niente da montare");
  const byte = Buffer.alloc(
    Math.round(tempi.tutto * come.alSecondo) * come.canali * (come.bit / 8),
  );
  const alByte = come.alSecondo * come.canali * (come.bit / 8);
  for (const uno of detti) {
    const suo = tempi.dove.get(uno.scena);
    for (const pezzo of uno.pezzi) {
      const da = Math.round((suo.comincia + pezzo.quando) * alByte);
      /* Di due byte per campione: si parte pari, se no il suono esce a pezzi. */
      pezzo.suono.byte.copy(byte, da - (da % (come.canali * (come.bit / 8))));
    }
  }
  return intestazione(byte, come);
}

/* ── ffmpeg: la traccia, e il film che la porta ───────────────────────── */

function trovaFfmpeg() {
  try {
    return execFileSync("sh", ["-c", "command -v ffmpeg"], { encoding: "utf8" }).trim();
  } catch {
    throw new Error("ffmpeg non trovato: `apt install ffmpeg`.");
  }
}

async function esegui(dove, argomenti) {
  const figlio = spawn(dove, argomenti, { stdio: ["ignore", "ignore", "pipe"] });
  let lamento = "";
  figlio.stderr.on("data", (pezzo) => (lamento += String(pezzo)));
  const [codice] = await once(figlio, "close");
  if (codice !== 0) throw new Error(`${path.basename(dove)} (${codice}): ${lamento.slice(-400)}`);
}

/** Il wav montato diventa una traccia da tenere: aac, e un volume solo. */
async function laTraccia(ffmpeg, wav, dove) {
  await esegui(ffmpeg, [
    "-y",
    "-i",
    wav,
    /* Un parlato ha i suoi alti e bassi, e un video si guarda a un volume
       solo: si porta tutto allo stesso livello invece di far alzare e
       abbassare a chi guarda. */
    "-af",
    "loudnorm=I=-18:TP=-2:LRA=11,aresample=22050",
    "-c:a",
    "aac",
    "-b:a",
    "112k",
    "-ac",
    "1",
    dove,
  ]);
}

/** La traccia dentro il film, senza rifare il video. */
async function attacca(ffmpeg, film, traccia) {
  const intanto = `${film}.intanto.mp4`;
  await esegui(ffmpeg, [
    "-y",
    "-i",
    film,
    "-i",
    traccia,
    "-map",
    "0:v",
    "-map",
    "1:a",
    "-c:v",
    "copy",
    "-c:a",
    "copy",
    "-movflags",
    "+faststart",
    "-shortest",
    intanto,
  ]);
  await rename(intanto, film);
}

/* ── Il giro ──────────────────────────────────────────────────────────── */

async function main() {
  const argomenti = process.argv.slice(2);
  const valore = (nome) => {
    const dove = argomenti.indexOf(nome);
    return dove === -1 ? null : argomenti[dove + 1];
  };
  const soloMisura = argomenti.includes("--misura");
  const soloAttacca = argomenti.includes("--attacca");
  const lingue = valore("--lingua") ? [valore("--lingua")] : LINGUE;
  for (const lingua of lingue) {
    if (!LINGUE.includes(lingua)) throw new Error(`lingua sconosciuta: ${lingua}`);
  }

  const ffmpeg = trovaFfmpeg();
  const scene = await leScene();

  if (soloAttacca) {
    for (const lingua of lingue) {
      const traccia = path.join(QUI, `voce-${conLaLingua("quadro", lingua)}.m4a`);
      const film = path.join(QUI, `${conLaLingua(FILM, lingua)}.mp4`);
      if (!existsSync(traccia)) throw new Error(`la traccia non c'e': ${traccia}`);
      await attacca(ffmpeg, film, traccia);
      detto(`🔊 ${path.basename(film)} — riattaccata ${path.basename(traccia)}`);
    }
    return;
  }

  const piper = trovaPiper();
  const cartella = await mkdtemp(path.join(tmpdir(), "voce-del-quadro-"));
  try {
    for (const lingua of lingue) {
      const voce = await trovaLaVoce(lingua);
      detto(`🎙  ${lingua} · ${path.basename(voce)} · ${PARLATO.length} scene`);
      const detti = await diTutto(piper, voce, lingua, cartella);
      const tempi = iTempi(scene, detti);
      guardaLeScene(detti, tempi, { dillo: soloMisura });
      const parlato = detti.reduce(
        (somma, uno) => somma + uno.pezzi.reduce((quanto, pezzo) => quanto + pezzo.dura, 0),
        0,
      );
      detto(
        `   film ${tempi.tutto.toFixed(1)}s · parlato ${parlato.toFixed(1)}s ` +
          `(${Math.round((parlato / tempi.tutto) * 100)}%)`,
      );
      if (soloMisura) continue;

      await scriviITempi(lingua, tempi, detti);
      const wav = path.join(cartella, `voce-${lingua}.wav`);
      await writeFile(wav, montaLaTraccia(detti, tempi));
      const traccia = path.join(QUI, `voce-${conLaLingua("quadro", lingua)}.m4a`);
      await laTraccia(ffmpeg, wav, traccia);
      detto(`   ${path.basename(traccia)}`);

      /* Il film, se c'e' gia' ed e' stato girato con queste parole.
       *
       * Le scene aspettano la voce, quindi cambiare una riga del copione
       * cambia quanto dura il film: uno girato prima e' lungo un altro
       * tanto, e la voce ci finirebbe sopra storta. Si guarda la durata —
       * costa un ffprobe — e invece di attaccare si dice cosa rilanciare. */
      const film = path.join(QUI, `${conLaLingua(FILM, lingua)}.mp4`);
      if (!existsSync(film)) {
        detto(
          `   il film non c'e' ancora: gira «rendi.mjs --film quadro --lingua ${lingua}», poi «voce.mjs --attacca»`,
        );
        continue;
      }
      const dura = await quantoDuraIlFilm(ffmpeg, film);
      if (dura !== null && Math.abs(dura - tempi.tutto) > 0.25) {
        detto(
          `   ${path.basename(film)} dura ${dura.toFixed(1)}s e le scene adesso ne fanno ${tempi.tutto.toFixed(1)}: ` +
            `e' stato girato con altre parole.\n` +
            `   Rigiralo — «rendi.mjs --film quadro --lingua ${lingua}» — e poi «voce.mjs --attacca».`,
        );
        continue;
      }
      await attacca(ffmpeg, film, traccia);
      detto(`🔊 ${path.basename(film)} — con dentro ${path.basename(traccia)}`);
    }
  } finally {
    await rm(cartella, { recursive: true, force: true });
  }
}

await mkdir(path.join(QUI, "voce"), { recursive: true }).catch(() => {});
main().catch((guaio) => {
  console.error("✖", guaio.message);
  process.exit(1);
});
