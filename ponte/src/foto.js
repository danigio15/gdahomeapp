/* Le foto della plancia: quelle che si caricano dal telefono.
 *
 * La foto dell'auto, e domani altre: la plancia le sceglieva dalla cartella
 * `config/www` di Home Assistant, che l'integrazione leggeva perche' ci
 * girava dentro. Il ponte in quella cartella non entra, e non ne ha bisogno:
 * le foto che si caricano dalla plancia stanno qui, in `/data/www`, e si
 * servono come tutto il resto della plancia, sotto
 * `/dashboardmodern_static/www/…`. La pagina non sa dove stanno: riceve un
 * indirizzo e lo usa.
 *
 * Due regole, prese com'erano: si accettano solo immagini vere — la firma
 * nei primi byte, non il nome — e un nome gia' preso non si sovrascrive, si
 * numera, perche' una foto caricata ieri non deve sparire sotto quella di
 * oggi. L'SVG si elenca ma non si carica: e' un documento, non una bitmap.
 */

import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeSync,
} from "node:fs";
import { basename, extname, join, resolve, sep } from "node:path";

export const BASE_DELLE_FOTO = "/dashboardmodern_static/www";

/* La cartella `www` di Home Assistant, che la plancia ha sempre usato.
 *
 * Chi ha una casa da qualche anno ci ha dentro le foto delle auto, i loghi,
 * gli sfondi — e li sceglieva da li'. Il ponte non ci entrava, e la maschera
 * delle foto dell'app diceva «nessuna foto» a chi ne aveva duecento.
 *
 * Ci entra in sola lettura (`homeassistant_config:ro` nel manifesto), e
 * l'indirizzo che scrive e' quello vero: `/local/…`, lo stesso che scrive la
 * Config della dashboard. Cosi' una configurazione fatta dall'app si vede
 * uguale nella plancia dentro Home Assistant, e viceversa — che e' tutto il
 * punto. */
export const BASE_DI_CASA = "/local";

/* Dove finiscono i caricamenti, per non sparpagliare. */
const SOTTOCARTELLA = "dashboardmodern";

const IMMAGINI = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", ".svg"]);
const CARICABILI = new Set([...IMMAGINI].filter((suffisso) => suffisso !== ".svg"));
const TIPI = Object.freeze({
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
});

/* Una cartella con migliaia di file non deve diventare un messaggio enorme. */
const VOCI_MASSIME = 500;

/* Una foto da plancia: dieci megabyte bastano e avanzano. */
export const FOTO_MASSIMA = 10 * 1024 * 1024;

const PEZZO_BUONO = /^[A-Za-z0-9_\-.@+~ ]+$/;

/* La firma nei primi byte, non il nome: un file rinominato .png resta
 * quello che e'. */
function sembraUnImmagine(byte) {
  if (byte.length < 12) return false;
  const inizia = (firma) => byte.subarray(0, firma.length).equals(Buffer.from(firma, "latin1"));
  if (inizia("\x89PNG\r\n\x1a\n")) return true;
  if (byte[0] === 0xff && byte[1] === 0xd8 && byte[2] === 0xff) return true;
  if (inizia("GIF87a") || inizia("GIF89a")) return true;
  if (inizia("RIFF")) return byte.subarray(8, 12).toString("latin1") === "WEBP";
  if (inizia("BM")) return true;
  const tipo = byte.subarray(4, 12).toString("latin1");
  return tipo === "ftypavif" || tipo === "ftypavis";
}

/* Un nome di file che non puo' uscire dalla cartella ne' sorprendere. */
export function nomePulito(nomeFile) {
  const base = basename(String(nomeFile || ""))
    .trim()
    .toLowerCase()
    .replace(/ /g, "-");
  const suffisso = extname(base).replace(/[^a-z0-9._-]/g, "");
  const radice = base
    .slice(0, base.length - extname(base).length)
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^\.+|\.+$/g, "");
  return `${radice || "foto"}${suffisso || ".png"}`;
}

function vuota(disponibile) {
  return { path: "", folders: [], images: [], available: disponibile, truncated: false };
}

export class Foto {
  /** [base] e' il prefisso degli indirizzi che scrive; [scrivibile] dice se ci
   * si puo' caricare sopra. La cartella di Home Assistant si legge e basta:
   * quella e' roba di chi ci abita, non nostra da riordinare. */
  constructor({ cartella, base = BASE_DELLE_FOTO, scrivibile = true }) {
    /* Una cartella che non c'e' e' un magazzino vuoto, non un errore.
     *
     * Non e' un dettaglio: la cartella di Home Assistant esiste solo se il
     * Supervisor l'ha montata, e chi lancia il ponte sul banco non ne ha
     * nessuna. Un `resolve(undefined)` qui buttava giu' l'avvio del ponte —
     * e siccome succedeva a meta' accensione, lasciava in piedi i server gia'
     * aperti: le prove non fallivano, restavano appese per sempre. */
    this.cartella = cartella ? resolve(cartella) : "";
    this.base = base;
    this.scrivibile = scrivibile;
  }

  /* Elenca cartelle e immagini sotto la cartella delle foto.
   *
   * `null` quando il percorso chiesto esce dalla cartella: e' l'unico modo in
   * cui una richiesta potrebbe leggere qualcosa che non le compete, e va
   * fermata qui. Una cartella che non esiste ancora non e' un errore: e' una
   * casa senza foto, e la risposta lo dice con `available`. */
  /* C'e' qualcosa da mostrare qui? Serve alla maschera per non offrire una
   * strada che non porta da nessuna parte: senza la cartella di Home
   * Assistant mappata, il tasto «Home Assistant» non si vede proprio. */
  get cE() {
    return Boolean(this.cartella) && existsSync(this.cartella);
  }

  elenca(relativo = "") {
    if (!this.cE) return vuota(false);
    let base;
    try {
      base = realpathSync(this.cartella);
    } catch (_errore) {
      return vuota(false);
    }
    const chiesto = String(relativo || "").replace(/^\/+|\/+$/g, "");
    if (chiesto.includes("\0")) return null;
    let dentro;
    try {
      dentro = chiesto ? realpathSync(join(base, chiesto)) : base;
    } catch (_errore) {
      return null;
    }
    if (dentro !== base && !dentro.startsWith(base + sep)) return null;
    let dati;
    try {
      dati = statSync(dentro);
    } catch (_errore) {
      return null;
    }
    if (!dati.isDirectory()) return null;

    const folders = [];
    const images = [];
    let truncated = false;
    for (const nome of readdirSync(dentro)) {
      if (nome.startsWith(".")) continue;
      if (folders.length + images.length >= VOCI_MASSIME) {
        truncated = true;
        break;
      }
      let vero;
      try {
        vero = realpathSync(join(dentro, nome));
      } catch (_errore) {
        continue;
      }
      if (!vero.startsWith(base + sep)) continue;
      const mostrato = vero
        .slice(base.length + 1)
        .split(sep)
        .join("/");
      let suo;
      try {
        suo = statSync(vero);
      } catch (_errore) {
        continue;
      }
      if (suo.isDirectory()) folders.push({ name: nome, path: mostrato });
      else if (IMMAGINI.has(extname(nome).toLowerCase()))
        images.push({ name: nome, path: mostrato, url: `${this.base}/${mostrato}` });
    }
    const perNome = (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    folders.sort(perNome);
    images.sort(perNome);
    return {
      path:
        dentro === base
          ? ""
          : dentro
              .slice(base.length + 1)
              .split(sep)
              .join("/"),
      folders,
      images,
      available: true,
      truncated,
    };
  }

  /* Mette via una foto e ne da' l'indirizzo. `null` per un file che non e'
   * un'immagine, o troppo grande. */
  carica(nomeFile, byte) {
    if (!this.cartella) return null;
    /* Nella cartella di Home Assistant non si scrive. E' roba di chi ci abita
     * — automazioni, temi, foto messe li' negli anni — e un add-on che ci
     * lascia dentro file e' un add-on che, il giorno che si disinstalla,
     * lascia sporco in casa d'altri. */
    if (!this.scrivibile) return null;
    const nome = nomePulito(nomeFile);
    if (!CARICABILI.has(extname(nome))) return null;
    if (!Buffer.isBuffer(byte) || !byte.length || byte.length > FOTO_MASSIMA) return null;
    if (!sembraUnImmagine(byte)) return null;
    const cartella = join(this.cartella, SOTTOCARTELLA);
    mkdirSync(cartella, { recursive: true });
    const radice = nome.slice(0, nome.length - extname(nome).length);
    const suffisso = extname(nome);
    let destinazione = join(cartella, nome);
    for (let contatore = 2; ; contatore += 1) {
      if (!resolve(destinazione).startsWith(this.cartella + sep)) return null;
      try {
        /* Apertura esclusiva: due caricamenti insieme con lo stesso nome non
         * si scrivono addosso — il secondo trova il file gia' nato e passa
         * al numero dopo. */
        const fd = openSync(destinazione, "wx");
        try {
          writeSync(fd, byte);
        } finally {
          closeSync(fd);
        }
        break;
      } catch (errore) {
        if (errore?.code !== "EEXIST") throw errore;
        destinazione = join(cartella, `${radice}-${contatore}${suffisso}`);
      }
    }
    return { path: `${this.base}/${SOTTOCARTELLA}/${basename(destinazione)}` };
  }

  /* Una foto, dal percorso come lo chiede il browser. */
  leggi(percorso) {
    if (!this.cartella) return questoNo();
    const pulito = String(percorso || "").split("?")[0];
    if (!pulito.startsWith(`${this.base}/`)) return questoNo();
    const pezzi = pulito.slice(this.base.length + 1).split("/");
    if (!pezzi.length || !pezzi.every((uno) => uno && uno !== ".." && PEZZO_BUONO.test(uno)))
      return questoNo();
    const tipo = TIPI[extname(pezzi[pezzi.length - 1]).toLowerCase()];
    if (!tipo) return questoNo();
    const dove = resolve(this.cartella, ...pezzi);
    if (!dove.startsWith(this.cartella + sep)) return questoNo();
    try {
      if (!statSync(dove).isFile()) return questoNo();
      return { stato: 200, tipo, corpo: readFileSync(dove) };
    } catch (_errore) {
      return questoNo();
    }
  }
}

function questoNo() {
  return {
    stato: 404,
    tipo: "text/plain; charset=utf-8",
    corpo: Buffer.from("qui non c'e' niente"),
  };
}
