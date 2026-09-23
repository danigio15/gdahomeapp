/* Il marchio di un installatore: il suo logo, non il nostro.
 *
 * Chi monta impianti per mestiere ha un nome e un logo suoi, e li ha stampati
 * sul furgone. Nel cruscotto da cui guarda i suoi impianti — e in casa dei
 * suoi clienti — trovarsi il marchio di gdahome e' trovarsi il marchio di
 * qualcun altro: quella casa l'ha montata lui, e il cliente quando ha un
 * problema chiama lui.
 *
 * ─── Perche' un file e non una riga nell'archivio ───────────────────────
 *
 * L'archivio degli installatori si legge a ogni richiesta e si riscrive a ogni
 * modifica. Centoventotto kilobyte di PNG dentro quel JSON vorrebbero dire
 * rileggerli e riscriverli per cambiare una soglia. Il file sta per conto suo,
 * e nell'archivio resta **una parola**: che tipo di immagine e', o niente.
 *
 * ─── Chi lo puo' vedere ──────────────────────────────────────────────────
 *
 * Tutti quelli che ne sanno l'indirizzo, e l'indirizzo e' `/marchio/<chi>`.
 * Non e' una svista: quel logo deve arrivare nel browser di chi abita una casa
 * abbinata, e quel browser una chiave non ce l'ha e non gliela si puo' dare.
 * Un `inst_` sono sedici cifre esadecimali — non si indovina — e quello che si
 * scopre indovinandolo e' un logo che sta gia' stampato su un furgone.
 *
 * ─── Cosa si accetta ─────────────────────────────────────────────────────
 *
 * PNG, JPEG e WEBP, e si guarda come **comincia il file**, non come si
 * chiama: il nome lo sceglie chi carica.
 *
 * L'SVG si accettava, e non piu'. E' testo, e dentro puo' portare un
 * programma: servito da questa stessa origine, con la sua testata di
 * sicurezza, un `<img>` non lo esegue — ma lo stesso file finisce anche dentro
 * la pagina dell'editor della plancia e nelle case dei clienti, e ogni posto
 * nuovo in cui lo si mette e' un posto in cui ricordarsi di disinnescarlo. Un
 * logo in PNG fa lo stesso lavoro e non ha niente da disinnescare. I loghi SVG
 * gia' caricati non si servono piu': chi li aveva lo ricarica in PNG.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Piu' di cosi' non e' un logo, e' un'immagine da stampare. */
export const QUANTO_GROSSO = 128 * 1024;

/* Come comincia ognuno dei tre. Si guarda il **contenuto**: un `.png` che
 * dentro e' un eseguibile resta un eseguibile, e il nome del file lo sceglie
 * chi carica. Le firme sono quelle intere — gli otto byte del PNG, il
 * `RIFF….WEBP` — e non solo i primi: `RIFF` da solo e' anche un WAV. */
const LE_RAZZE = [
  {
    tipo: "png",
    mime: "image/png",
    e: (b) =>
      b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  {
    tipo: "jpg",
    mime: "image/jpeg",
    e: (b) => b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    tipo: "webp",
    mime: "image/webp",
    e: (b) =>
      b.length >= 12 &&
      b.subarray(0, 4).toString("latin1") === "RIFF" &&
      b.subarray(8, 12).toString("latin1") === "WEBP",
  },
];

const IL_TIPO = Object.fromEntries(LE_RAZZE.map((una) => [una.tipo, una.mime]));

/**
 * Che razza di immagine e' questa, guardando come comincia.
 *
 * Torna `"png"`, `"jpg"`, `"webp"` o stringa vuota. Vuota vuol dire «questo
 * non e' un'immagine che so servire», e chi chiama risponde di no. Un SVG e'
 * vuota (vedi in cima).
 *
 * @param {Buffer} byte il file com'e' arrivato
 */
export function cheRazzaE(byte) {
  if (!Buffer.isBuffer(byte) || byte.length < 4) return "";
  return LE_RAZZE.find((una) => una.e(byte))?.tipo ?? "";
}

/** Il tipo da mettere in testa alla risposta, per una razza. */
export const ilTipoDi = (razza) => IL_TIPO[razza] || "";

export class Marchi {
  constructor({ cartella = "./dati" } = {}) {
    this.cartella = join(cartella, "marchi");
  }

  /* Dove sta il file di uno. Il nome e' la sua matricola, che il server ha
   * gia' controllato contro `CHI_VALIDO`: qui non ci arriva niente che non sia
   * `inst_` piu' sedici cifre. */
  _dove(chi, razza) {
    return join(this.cartella, `${chi}.${razza}`);
  }

  /**
   * Mette il marchio di uno. Torna la razza, o stringa vuota se non si accetta.
   *
   * Il vecchio si toglie **prima**: cambiando da PNG a JPEG resterebbero due
   * file, e il giorno che uno li guarda non saprebbe quale vale.
   */
  metti(chi, byte, razzaDiPrima = "") {
    if (!Buffer.isBuffer(byte) || byte.length === 0 || byte.length > QUANTO_GROSSO) return "";
    const razza = cheRazzaE(byte);
    if (!razza) return "";
    this.togli(chi, razzaDiPrima);
    mkdirSync(this.cartella, { recursive: true });
    writeFileSync(this._dove(chi, razza), byte);
    return razza;
  }

  /** Il marchio di uno, o `null`. Si riguarda com'e' fatto anche in uscita:
   * un file messo li' a mano, o un SVG di prima, non esce. */
  leggi(chi, razza) {
    if (!razza || !IL_TIPO[razza]) return null;
    try {
      const byte = readFileSync(this._dove(chi, razza));
      return cheRazzaE(byte) === razza ? byte : null;
    } catch (_nonCE) {
      /* Il file non c'e' e l'archivio dice di si': succede se qualcuno ha
       * ripulito `/data` a mano. Non e' un guasto da mostrare, e' un marchio
       * che non c'e'. */
      return null;
    }
  }

  /** Lo toglie. Silenzioso: toglierne uno che non c'e' e' gia' il risultato. */
  togli(chi, razza = "") {
    /* Anche `svg`: e' la razza di chi l'aveva caricato prima che non si
     * accettasse piu', e togliendo il marchio si toglie anche quel file. */
    for (const quale of razza ? [razza] : [...Object.keys(IL_TIPO), "svg"]) {
      if (!/^[a-z]+$/.test(quale)) continue;
      rmSync(this._dove(chi, quale), { force: true });
    }
  }
}
