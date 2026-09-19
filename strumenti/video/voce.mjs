#!/usr/bin/env node
/* La voce del film del quadro.
 *
 *   node strumenti/video/voce.mjs                 la voce nei due film
 *   node strumenti/video/voce.mjs --lingua it     solo l'italiano
 *   node strumenti/video/voce.mjs --misura        i tempi, senza toccare niente
 *   node strumenti/video/voce.mjs --attacca       riattacca le tracce gia' fatte
 *   node strumenti/video/voce.mjs --copione       l'elenco delle frasi da registrare
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
 * Non c'e' nessuno in questo progetto che registri quattro minuti di italiano
 * senza rifarli venti volte, e una voce registrata male invecchia peggio di
 * una sintetica: cambia una riga del copione e va rifatta tutta la sessione.
 * Qui invece si cambia la riga in `parlato.js` e si rilancia.
 *
 * La dice **Kokoro**, un modello che gira in casa e non chiama nessuno:
 * nessun servizio, nessuna chiave, nessuna riga di testo che esce da questa
 * macchina. A farlo parlare e' `dillo.py`, che e' l'unico pezzo in Python di
 * questa cartella — la libreria che sa caricare quel modello e' Python, e
 * riscriverla non e' il mestiere di un film.
 *
 * Prima era piper, e per l'italiano la sua unica voce: la piu' piccola,
 * sedici kilohertz. **Si sentiva** — ma «si sentiva» non e' una misura, e chi
 * ha montato questa voce non poteva ascoltarla. Quindi e' servito un modo di
 * giudicarla che non fosse l'orecchio: si sintetizza una frase del copione, la
 * si fa **riascoltare a un programma che trascrive**, e si contano le parole
 * che tornano. Su sei frasi di prova piper ne faceva capire il 64,2% e Kokoro
 * l'83,8%; su tutto il copione — quarantuno frasi — Kokoro sta all'84,1% in
 * italiano e al 94,4% in inglese. Gli errori di piper dicevano cosa stava
 * succedendo: «il quadro» diventava «il quarro», «un installatore» diventava
 * «un install a torre». Non dice niente sul timbro, che non si misura: dice
 * quanto si capisce, che e' la meta' che conta di piu'.
 *
 * La stessa prova ha scelto **quale voce** (`VOCI`), **quanto andare piano**
 * (`ANDATURA`) e **come si dicono le parole che italiane non sono**
 * (`COME_SI_DICE`, in `parlato.js`). Come si rifa' sta nel README, in «Come si
 * sceglie una voce senza poterla ascoltare».
 *
 * ─── Una voce vera, quando c'e' ──────────────────────────────────────────
 *
 * Una voce sintetica resta una voce sintetica, per bravo che sia il modello:
 * il tetto e' quello, e non lo alza nessuna misura. Percio' la strada per
 * metterci una voce **umana** e' aperta, e non chiede di toccare niente.
 *
 * Si registrano le frasi — `--copione` le elenca tutte, con il nome del file
 * che ognuna deve avere — e si mettono in `strumenti/video/voce/detti/`:
 *
 *   strumenti/video/voce/detti/it-0-0.wav     la prima frase della prima scena
 *   strumenti/video/voce/detti/it-0-1.wav     la seconda
 *   …
 *
 * Chi trova un file la' dentro non lo sintetizza: lo prende. Quindi si puo'
 * fare tutto, o una frase sola — quella che il modello dice male — e il resto
 * resta com'e'. Il montaggio non cambia: le scene si allungano su quello che
 * dura la voce vera, e le didascalie arrivano con la sua frase.
 *
 * I wav vanno **mono** e a 16 bit, che e' quello che il montaggio sa rimettere
 * in fila; il resto (quanto e' alto il volume, il silenzio davanti) lo sistema
 * la traccia, che si normalizza da se'.
 *
 * E se la voce vera arriva gia' montata — una traccia sola per tutto il film —
 * allora non serve nemmeno questo: si sostituiscono `voce-quadro.m4a` e
 * `voce-quadro-en.m4a` e si rifa' `--attacca`.
 *
 * ─── Cosa serve, e dove si prende ────────────────────────────────────────
 *
 * Il modello e le voci, che non stanno nella repository: sono trecentocinquanta
 * megabyte di roba di terzi, e si scaricano una volta.
 *
 *   mkdir -p strumenti/video/voce && cd strumenti/video/voce
 *   curl -sSL -O https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
 *   curl -sSL -O https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
 *   pip install kokoro-onnx soundfile
 *
 * Quella cartella non si versiona (`.gitignore`). Chi ce l'ha altrove lo dice
 * con `KOKORO_MODELLO` e `KOKORO_VOCI`.
 *
 * Le tracce invece **stanno** nella repository — `voce-quadro.m4a` e
 * `voce-quadro-en.m4a` — cosi' chi rifa' il film non ha bisogno ne' del
 * modello ne' di Python: `--attacca` le riattacca e basta.
 */

import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile, rename } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CODA, COME_SI_DICE, PARLATO, RESPIRO } from "./parlato.js";

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

/* ── Chi parla ────────────────────────────────────────────────────────── */

/* Una voce per lingua, e sono quelle che si capiscono di piu'.
 *
 * Non e' un gusto, ed e' l'unico modo che ha chi non puo' ascoltare: si
 * sintetizzano le frasi del copione, si fanno riascoltare a un programma che
 * trascrive, e si contano le parole che tornano. Fra le due voci italiane e'
 * finita 83,8 a 82,8 per `if_sara`; fra le quattro inglesi provate, `bf_emma`
 * ha fatto 92,9 contro 90,9, 90,3 e 90,3. Sono differenze piccole — il timbro
 * lo sceglie chi ha orecchie — ma la misura c'era, e si e' seguita.
 */
const VOCI = { it: "if_sara", en: "bf_emma" };

/* Con che lingua si fanno i suoni. La voce inglese del film e' inglese
   d'Inghilterra, e dirglielo cambia le vocali. */
const COME_SUONA = { it: "it", en: "en-gb" };

/* Quanto si legge piano.
 *
 * Uno che spiega un mestiere non corre, e il modello di serie corre. Quanto
 * rallentarlo non e' a occhio: provate tre andature con la stessa prova delle
 * voci, 0,92 fa capire il 4% di parole in piu' dell'uno, e 0,85 torna a
 * peggiorare. Rallentare aiuta fino a un certo punto, e oltre quel punto
 * strascica. */
const ANDATURA = { it: 0.92, en: 0.95 };

/** Le frasi registrate da una persona, se ce ne sono. */
const DETTI = path.join(QUI, "voce", "detti");

/** Come si chiama il file di una frase: lingua, scena, e quale pezzo. */
const ilSuoFile = (lingua, scena, pezzo) => `${lingua}-${scena}-${pezzo}.wav`;

function serveIlModello() {
  for (const [nome, variabile] of [
    ["kokoro-v1.0.onnx", "KOKORO_MODELLO"],
    ["voices-v1.0.bin", "KOKORO_VOCI"],
  ]) {
    const suo = process.env[variabile];
    if (suo && existsSync(suo)) continue;
    if (existsSync(path.join(QUI, "voce", nome))) continue;
    throw new Error(
      `manca ${nome}: si scarica una volta sola in strumenti/video/voce/ — le istruzioni\n` +
        `sono in cima a questo file — oppure si dice dove sta con ${variabile}.`,
    );
  }
}

/* ── Il parlato, tutto in una volta ───────────────────────────────────── */

/** Il testo come va **detto**: vedi `COME_SI_DICE` in `parlato.js`. */
const comeSiDice = (testo, lingua) =>
  (COME_SI_DICE[lingua] ?? []).reduce(
    (detto, [scritto, come]) =>
      detto.replace(new RegExp(`\\b${scritto}\\b`, "gi"), (trovata) =>
        trovata[0] === trovata[0].toUpperCase() ? come[0].toUpperCase() + come.slice(1) : come,
      ),
    testo,
  );

/**
 * Tutte le frasi di una lingua, dette in una volta sola.
 *
 * Si chiama `dillo.py` — vedi in cima — e gli si passa tutto il lavoro in un
 * JSON: caricare il modello costa un paio di secondi, e caricarlo trenta volte
 * sarebbe un minuto buttato a ogni ripresa.
 */
async function fallePronunciare(lingua, pezzi) {
  const figlio = spawn("python3", [path.join(QUI, "dillo.py")], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  let detto = "";
  let lamento = "";
  figlio.stdout.on("data", (pezzo) => (detto += String(pezzo)));
  figlio.stderr.on("data", (pezzo) => (lamento += String(pezzo)));
  figlio.stdin.end(
    JSON.stringify({
      voce: VOCI[lingua],
      lingua: COME_SUONA[lingua],
      andatura: ANDATURA[lingua],
      pezzi,
    }),
  );
  const [codice] = await once(figlio, "close");
  if (codice !== 0) throw new Error(`dillo.py (${codice}): ${lamento.trim().slice(-500)}`);
  return JSON.parse(detto);
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
async function diTutto(lingua, cartella) {
  /* Prima tutti i pezzi in fila, col posto dove andranno a finire: e' quello
     che si passa a chi parla, in una volta sola. */
  const lavoro = [];
  for (const [quale, scena] of PARLATO.entries()) {
    for (const [numero, pezzo] of scena.pezzi.entries()) {
      /* Se questa frase l'ha gia' detta una persona, si prende la sua e non
         si sintetizza niente: vedi «Una voce vera, quando c'e'», in cima. */
      const sua = path.join(DETTI, ilSuoFile(lingua, quale, numero));
      lavoro.push({
        quale,
        numero,
        testo: comeSiDice(pezzo[lingua], lingua),
        dove: existsSync(sua) ? sua : path.join(cartella, `${lingua}-${quale}-${numero}.wav`),
        vera: existsSync(sua),
      });
    }
  }
  const daDire = lavoro.filter((uno) => !uno.vera);
  const vere = lavoro.length - daDire.length;
  if (vere)
    detto(`   ${vere} frasi su ${lavoro.length} sono registrate: quelle non si sintetizzano`);
  if (daDire.length) {
    await fallePronunciare(
      lingua,
      daDire.map(({ testo, dove }) => ({ testo, dove })),
    );
  }

  /* Poi si rimettono in scena e si contano i tempi: il primo pezzo comincia
     dopo `dopo` secondi, gli altri uno dietro l'altro con un respiro in mezzo.
     Il posto nel film lo si trova dopo, sommando le scene che vengono prima. */
  const detti = [];
  for (const [quale, scena] of PARLATO.entries()) {
    let quando = scena.dopo;
    const pezzi = [];
    for (let numero = 0; numero < scena.pezzi.length; numero += 1) {
      const suo = lavoro.find((uno) => uno.quale === quale && uno.numero === numero);
      const suono = ilSuono(await readFile(suo.dove));
      pezzi.push({ suono, quando, dura: quantoDura(suono) });
      quando += quantoDura(suono) + RESPIRO;
    }
    detti.push({ scena: scena.scena, pezzi, finisce: quando - RESPIRO });
  }
  return detti;
}

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
 * programma. Il motivo e' che senza, chi rifa' il film senza il modello della
 * voce lo rifarebbe con le scene corte di prima e la voce gli finirebbe sopra.
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
  const soloCopione = argomenti.includes("--copione");
  const lingue = valore("--lingua") ? [valore("--lingua")] : LINGUE;
  for (const lingua of lingue) {
    if (!LINGUE.includes(lingua)) throw new Error(`lingua sconosciuta: ${lingua}`);
  }

  /* L'elenco delle frasi da registrare, per chi ci mette la sua voce.
   *
   * Non serve niente per stamparlo — ne' il modello, ne' ffmpeg — perche' chi
   * lo chiede di solito non sta facendo un film: sta andando a leggere in un
   * microfono, e quello che gli serve e' il testo e il nome del file. */
  if (soloCopione) {
    for (const lingua of lingue) {
      detto(`\n── ${lingua} ── da mettere in strumenti/video/voce/detti/`);
      for (const [quale, scena] of PARLATO.entries()) {
        detto(`\n   ${scena.scena}`);
        for (const [numero, pezzo] of scena.pezzi.entries()) {
          const nome = ilSuoFile(lingua, quale, numero);
          detto(`   ${existsSync(path.join(DETTI, nome)) ? "●" : "○"} ${nome}  ${pezzo[lingua]}`);
        }
      }
    }
    detto("\n   ● c'e' gia'   ○ manca, e la dice il modello");
    return;
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

  serveIlModello();
  const cartella = await mkdtemp(path.join(tmpdir(), "voce-del-quadro-"));
  try {
    for (const lingua of lingue) {
      detto(`🎙  ${lingua} · ${VOCI[lingua]} · ${PARLATO.length} scene`);
      const detti = await diTutto(lingua, cartella);
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
