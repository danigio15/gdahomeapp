/* Le foto della cornice del tablet a muro: restano in casa, qui.
 *
 * «Cornice foto» e' uno stile del riposo della plancia a muro
 * (`plancia/src/core/il-riposo-vivo.js`): sul tablet passano le foto di casa,
 * una dopo l'altra. Sono foto di famiglia, e la regola e' una: **non escono
 * di casa**. Non vanno su nessun servizio, non passano dal centralino per
 * restarci, non finiscono nella configurazione della plancia (che viaggia fra
 * i dispositivi): stanno in `/data/riposo-foto/`, il disco dell'add-on, e le
 * legge solo chi e' di casa.
 *
 * Le carica il config della plancia, dal telefono o dal computer. Prima di
 * partire il browser le rimpicciolisce (lato lungo 1920, JPEG) e ne fa una
 * miniatura per l'elenco; qui si controlla tutto lo stesso, perche' chi parla
 * col ponte non e' per forza quella pagina:
 *
 *  - **il contenuto, non il nome**: JPEG, PNG o WebP, riconosciuti dalla firma
 *    nei primi byte, e il tipo dichiarato deve essere quello della firma;
 *  - **il nome lo da' il ponte**: sedici lettere a caso e l'estensione del
 *    tipo. Quello che arriva da fuori non diventa mai un percorso, e quando
 *    torna indietro (per leggere o togliere) deve avere quella forma esatta:
 *    niente `..`, niente barre, niente altro;
 *  - **un tetto**: una foto non passa i 700 kB — ci sta, in base64, in un
 *    messaggio sul filo di Home Assistant, che si ferma al megabyte
 *    (`presa.js`) — e non se ne tengono piu' di sessanta;
 *  - **chi carica e chi toglie** lo decide `commissioni.js`: solo chi
 *    amministra la casa (`SOLO_CHI_AMMINISTRA`). Guardarle lo puo' chi e'
 *    entrato col suo utente e vede almeno una plancia.
 */

import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve, sep } from "node:path";

/** Quanto puo' pesare una foto, gia' rimpicciolita dal browser. */
export const FOTO_DEL_RIPOSO_MASSIMA = 700 * 1024;
/** E la sua miniatura, per l'elenco del config. */
export const MINIATURA_MASSIMA = 64 * 1024;
/** Quante foto si tengono: un'ora di cornice a una foto al minuto. */
export const FOTO_DEL_RIPOSO_AL_MASSIMO = 60;

export const TIPI_DEL_RIPOSO = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
});
const TIPO_DELL_ESTENSIONE = Object.freeze({
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
});

/* Il nome di una foto, come lo da' il ponte. */
const ID_BUONO = /^[a-z0-9]{16}$/;
const FILE_BUONO = /^([a-z0-9]{16})\.(jpg|png|webp)$/;
const MINI = ".mini.jpg";

/* Un no che dice perche': `codice` e' per la plancia, il messaggio per chi legge. */
export class FotoDelRiposoNo extends Error {
  constructor(codice, messaggio) {
    super(messaggio);
    this.name = "FotoDelRiposoNo";
    this.codice = codice;
  }
}

const MESSAGGI = Object.freeze({
  tipo: "La foto deve essere un JPEG, un PNG o un WebP.",
  firma: "Il file non e' l'immagine che dice di essere.",
  grande: "La foto supera i 700 kB: rimpiccioliscila prima di caricarla.",
  mini: "La miniatura non e' un JPEG piccolo.",
  piena: "Ci sono gia' sessanta foto: togline qualcuna prima di caricarne altre.",
  nome: "Questa foto non c'e'.",
  cartella: "Questo ponte non ha dove tenere le foto.",
});
const rifiuta = (codice) => new FotoDelRiposoNo(codice, MESSAGGI[codice] || codice);

/** Il tipo dell'immagine dalla firma nei primi byte, o "" se non e' una delle tre. */
export function tipoDallaFirma(byte) {
  if (!Buffer.isBuffer(byte) || byte.length < 12) return "";
  if (byte[0] === 0xff && byte[1] === 0xd8 && byte[2] === 0xff) return "image/jpeg";
  if (byte.subarray(0, 8).equals(Buffer.from("\x89PNG\r\n\x1a\n", "latin1"))) return "image/png";
  if (
    byte.subarray(0, 4).toString("latin1") === "RIFF" &&
    byte.subarray(8, 12).toString("latin1") === "WEBP"
  )
    return "image/webp";
  return "";
}

export class FotoDelRiposo {
  constructor({
    cartella,
    massima = FOTO_DEL_RIPOSO_MASSIMA,
    quante = FOTO_DEL_RIPOSO_AL_MASSIMO,
    adesso = () => Date.now(),
  } = {}) {
    /* Senza cartella — un ponte sul banco — non c'e' niente da tenere, e lo
     * si dice: nessuna foto, e nessun caricamento. */
    this.cartella = cartella ? resolve(cartella) : "";
    this.massima = massima;
    this.quante = quante;
    this.adesso = adesso;
  }

  get cE() {
    return Boolean(this.cartella);
  }

  /* Il percorso di un file di questa cartella, o `null` se il nome non e'
   * uno di quelli che il ponte da'. Il controllo della forma e' quello che
   * conta; il confronto con la cartella e' la cintura sopra le bretelle. */
  _dove(file) {
    if (!this.cartella || typeof file !== "string") return null;
    const id = file.endsWith(MINI) ? file.slice(0, -MINI.length) : null;
    if (id !== null ? !ID_BUONO.test(id) : !FILE_BUONO.test(file)) return null;
    const dove = resolve(this.cartella, file);
    return dove.startsWith(this.cartella + sep) ? dove : null;
  }

  /* I file veri della cartella, per id. Quello che non ha la forma giusta —
   * un file messo li' a mano, un caricamento a meta' — non si vede. */
  _file() {
    if (!this.cartella || !existsSync(this.cartella)) return [];
    const trovati = [];
    for (const nome of readdirSync(this.cartella)) {
      const forma = FILE_BUONO.exec(nome);
      if (!forma) continue;
      let dati;
      try {
        dati = statSync(join(this.cartella, nome));
      } catch (_errore) {
        continue;
      }
      if (!dati.isFile()) continue;
      trovati.push({
        id: forma[1],
        file: nome,
        tipo: TIPO_DELL_ESTENSIONE[forma[2]],
        peso: dati.size,
        quando: Math.round(dati.mtimeMs),
        mini: existsSync(join(this.cartella, `${forma[1]}${MINI}`)),
      });
    }
    /* Nell'ordine in cui sono arrivate: e' l'ordine dell'elenco nel config. */
    return trovati.sort((a, b) => a.quando - b.quando || a.id.localeCompare(b.id));
  }

  /** Le foto che ci sono: `{id, tipo, peso, quando, mini}`. */
  elenco() {
    return this._file().map(({ file: _file, ...resto }) => resto);
  }

  /**
   * Mette via una foto. `byte` e' la foto, `tipo` quello che dice di essere,
   * `mini` (facoltativa) la sua miniatura in JPEG. Torna `{id, tipo, peso}`;
   * un [FotoDelRiposoNo] se qualcosa non va, e allora non resta niente.
   */
  carica(byte, tipo, mini = null) {
    if (!this.cartella) throw rifiuta("cartella");
    const estensione = TIPI_DEL_RIPOSO[String(tipo || "")];
    if (!estensione) throw rifiuta("tipo");
    if (!Buffer.isBuffer(byte) || !byte.length) throw rifiuta("firma");
    if (byte.length > this.massima) throw rifiuta("grande");
    if (tipoDallaFirma(byte) !== tipo) throw rifiuta("firma");
    if (mini !== null) {
      if (!Buffer.isBuffer(mini) || !mini.length || mini.length > MINIATURA_MASSIMA)
        throw rifiuta("mini");
      if (tipoDallaFirma(mini) !== "image/jpeg") throw rifiuta("mini");
    }
    if (this._file().length >= this.quante) throw rifiuta("piena");
    mkdirSync(this.cartella, { recursive: true });
    let id = idNuovo();
    while (existsSync(join(this.cartella, `${id}.${estensione}`))) id = idNuovo();
    const dove = this._dove(`${id}.${estensione}`);
    /* Prima in un file da parte, poi col suo nome: una foto a meta' non
     * compare mai nell'elenco, neanche se il ponte si spegne mentre scrive. */
    const daParte = join(this.cartella, `.in-arrivo-${id}`);
    writeFileSync(daParte, byte);
    if (mini) writeFileSync(join(this.cartella, `${id}${MINI}`), mini);
    renameSync(daParte, dove);
    return { id, tipo, peso: byte.length };
  }

  /** Toglie una foto e la sua miniatura. Torna se c'era. */
  togli(id) {
    if (typeof id !== "string" || !ID_BUONO.test(id)) return false;
    const foto = this._file().find((f) => f.id === id);
    if (!foto) return false;
    const dove = this._dove(foto.file);
    const mini = this._dove(`${id}${MINI}`);
    if (dove) rmSync(dove, { force: true });
    if (mini) rmSync(mini, { force: true });
    return true;
  }

  /**
   * Una foto da mostrare: `{id, tipo, byte}`, o `null` se non c'e'. Con
   * `mini` la miniatura, se c'e'; se no la foto intera, che va bene lo stesso.
   */
  leggi(id, { mini = false } = {}) {
    if (typeof id !== "string" || !ID_BUONO.test(id)) return null;
    const foto = this._file().find((f) => f.id === id);
    if (!foto) return null;
    try {
      if (mini && foto.mini) {
        const dove = this._dove(`${id}${MINI}`);
        if (dove) return { id, tipo: "image/jpeg", byte: readFileSync(dove) };
      }
      const dove = this._dove(foto.file);
      return dove ? { id, tipo: foto.tipo, byte: readFileSync(dove) } : null;
    } catch (_errore) {
      return null;
    }
  }
}

function idNuovo() {
  const lettere = "abcdefghijklmnopqrstuvwxyz0123456789";
  return [...randomBytes(16)].map((b) => lettere[b % lettere.length]).join("");
}
