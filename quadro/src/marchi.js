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
 * PNG, JPEG, WEBP e SVG, e si guarda come **comincia il file**, non come si
 * chiama: il nome lo sceglie chi carica. L'SVG e' l'unico che porta dentro un
 * programma, e viene servito con `Content-Security-Policy` e
 * `Content-Disposition: inline` da un'origine che non e' quella della console:
 * un `<img>` non esegue lo script di un SVG, ma quel file lo si puo' anche
 * aprire a mano, ed e' li' che conterebbe.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Piu' di cosi' non e' un logo, e' un'immagine da stampare. */
export const QUANTO_GROSSO = 128 * 1024;

/* Come comincia ognuno dei quattro. Si guarda il **contenuto**: un `.png` che
 * dentro e' un eseguibile resta un eseguibile, e il nome del file lo sceglie
 * chi carica. */
const LE_RAZZE = [
  { tipo: "png", mime: "image/png", segno: [0x89, 0x50, 0x4e, 0x47] },
  { tipo: "jpg", mime: "image/jpeg", segno: [0xff, 0xd8, 0xff] },
  { tipo: "webp", mime: "image/webp", segno: [0x52, 0x49, 0x46, 0x46] },
];

const IL_TIPO = Object.fromEntries(LE_RAZZE.map((una) => [una.tipo, una.mime]));
IL_TIPO.svg = "image/svg+xml";

/**
 * Che razza di immagine e' questa, guardando come comincia.
 *
 * Torna `"png"`, `"jpg"`, `"webp"`, `"svg"` o stringa vuota. Vuota vuol dire
 * «questo non e' un'immagine che so servire», e chi chiama risponde di no.
 *
 * @param {Buffer} byte il file com'e' arrivato
 */
export function cheRazzaE(byte) {
  if (!Buffer.isBuffer(byte) || byte.length < 4) return "";
  for (const una of LE_RAZZE) {
    if (una.segno.every((quanto, dove) => byte[dove] === quanto)) return una.tipo;
  }
  /* L'SVG e' testo, e puo' cominciare con la dichiarazione XML, con un
   * commento o con dei bianchi: si guarda in testa, non il primo byte. */
  const testa = byte.subarray(0, 512).toString("utf8").trimStart();
  if (/^<(\?xml|!--|svg)[\s>]/i.test(testa) && /<svg[\s>]/i.test(testa)) return "svg";
  return "";
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
   * Il vecchio si toglie **prima**: cambiando da PNG a SVG resterebbero due
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

  /** Il marchio di uno, o `null`. */
  leggi(chi, razza) {
    if (!razza || !IL_TIPO[razza]) return null;
    try {
      return readFileSync(this._dove(chi, razza));
    } catch (_nonCE) {
      /* Il file non c'e' e l'archivio dice di si': succede se qualcuno ha
       * ripulito `/data` a mano. Non e' un guasto da mostrare, e' un marchio
       * che non c'e'. */
      return null;
    }
  }

  /** Lo toglie. Silenzioso: toglierne uno che non c'e' e' gia' il risultato. */
  togli(chi, razza = "") {
    for (const quale of razza ? [razza] : Object.keys(IL_TIPO)) {
      rmSync(this._dove(chi, quale), { force: true });
    }
  }
}
