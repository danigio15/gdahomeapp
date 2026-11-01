/* La focale di una foto, letta dall'EXIF del JPEG.
 *
 * Per passare dai pixel ai metri in una foto di una stanza serve sapere
 * quanto «stringe» l'obiettivo: un forno largo 60 cm che nella foto e' largo
 * 437 pixel sta a una distanza che dipende dalla focale. I telefoni la
 * scrivono nel file (FocalLengthIn35mmFilm: 23, 24, 26 mm...), e quella si
 * legge qui, senza librerie: il JPEG e' una fila di segmenti, l'EXIF sta nel
 * segmento APP1, dentro c'e' una tabella TIFF con le voci (tag, tipo,
 * quanti, valore). Si guardano solo le voci che servono.
 *
 * Non si tocca il DOM: byte in ingresso, numeri in uscita. */

const SOI = 0xffd8;
const APP1 = 0xffe1;
const SOS = 0xffda;
const EXIF_IFD = 0x8769;
const FOCALE = 0x920a; // RATIONAL, mm
const FOCALE_35MM = 0xa405; // SHORT, mm equivalenti
const MARCA = 0x010f;
const MODELLO = 0x0110;
const QUANTO_SI_LEGGE = 512 * 1024;

/* Il fotogramma 35 mm e' 36×24: la «focale equivalente» dei telefoni e'
 * riferita al sensore 4:3 intero, e il lato lungo dell'immagine (anche
 * tagliata a 16:9, che taglia sopra e sotto) resta quello. Diagonale di un
 * 4:3 col lato lungo L = L·1,25; diagonale del 35 mm = 43,27 mm. */
const DIAGONALE_35MM = 43.27;
export const FOCALE_DI_SERIE = 25;

function ascii(vista, da, n) {
  let s = "";
  for (let i = 0; i < n; i++) {
    const c = vista.getUint8(da + i);
    if (!c) break;
    s += String.fromCharCode(c);
  }
  return s.trim();
}

/* Una tabella TIFF: torna la mappa tag → valore per i tag chiesti. */
function leggiIfd(vista, base, offset, little, tag) {
  const out = {};
  if (offset + 2 > vista.byteLength) return out;
  const n = vista.getUint16(base + offset, little);
  for (let i = 0; i < n; i++) {
    const p = base + offset + 2 + i * 12;
    if (p + 12 > vista.byteLength) break;
    const t = vista.getUint16(p, little);
    if (!tag.has(t)) continue;
    const tipo = vista.getUint16(p + 2, little),
      quanti = vista.getUint32(p + 4, little);
    const dove = quanti * (tipo === 3 ? 2 : tipo === 2 || tipo === 1 ? 1 : tipo === 4 ? 4 : 8) > 4;
    const v = dove ? base + vista.getUint32(p + 8, little) : p + 8;
    if (v < 0 || v + 4 > vista.byteLength) continue;
    if (tipo === 3) out[t] = vista.getUint16(v, little);
    else if (tipo === 4) out[t] = vista.getUint32(v, little);
    else if (tipo === 5 && v + 8 <= vista.byteLength) {
      const num = vista.getUint32(v, little),
        den = vista.getUint32(v + 4, little);
      out[t] = den ? num / den : null;
    } else if (tipo === 2) out[t] = ascii(vista, v, Math.min(quanti, 64));
  }
  return out;
}

/** La focale della foto: `{ f35, focale, marca, modello }`, o null senza EXIF.
 * `f35` in mm equivalenti (quello che serve), `focale` quella vera in mm. */
export function focaleDallaFoto(bytes) {
  const buf =
    bytes instanceof ArrayBuffer
      ? bytes
      : ArrayBuffer.isView(bytes)
        ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
        : null;
  if (!buf || buf.byteLength < 4) return null;
  const vista = new DataView(buf, 0, Math.min(buf.byteLength, QUANTO_SI_LEGGE));
  if (vista.getUint16(0) !== SOI) return null;
  let p = 2;
  while (p + 4 <= vista.byteLength) {
    if (vista.getUint8(p) !== 0xff) return null;
    const marker = vista.getUint16(p);
    if (marker === SOS) return null;
    const lunghezza = vista.getUint16(p + 2);
    if (marker === APP1 && p + 10 <= vista.byteLength && ascii(vista, p + 4, 4) === "Exif") {
      const base = p + 10;
      if (base + 8 > vista.byteLength) return null;
      const ordine = vista.getUint16(base);
      const little = ordine === 0x4949;
      if (!little && ordine !== 0x4d4d) return null;
      const ifd0 = vista.getUint32(base + 4, little);
      const zero = leggiIfd(vista, base, ifd0, little, new Set([EXIF_IFD, MARCA, MODELLO]));
      const exif =
        zero[EXIF_IFD] !== undefined
          ? leggiIfd(vista, base, zero[EXIF_IFD], little, new Set([FOCALE, FOCALE_35MM]))
          : {};
      const f35 = exif[FOCALE_35MM] > 0 && exif[FOCALE_35MM] < 400 ? exif[FOCALE_35MM] : null;
      const focale = exif[FOCALE] > 0 && exif[FOCALE] < 400 ? exif[FOCALE] : null;
      if (f35 === null && focale === null && !zero[MARCA]) return null;
      return {
        f35,
        focale,
        marca: typeof zero[MARCA] === "string" ? zero[MARCA] : "",
        modello: typeof zero[MODELLO] === "string" ? zero[MODELLO] : "",
      };
    }
    p += 2 + lunghezza;
  }
  return null;
}

/** La focale in pixel di una foto `w`×`h`, dai mm equivalenti (o quella di
 * serie di un telefono, 25 mm, se non si sa). */
export function focaleInPixel({ w, h, f35 } = {}) {
  const lungo = Math.max(Number(w) || 0, Number(h) || 0);
  if (!(lungo > 0)) return 0;
  const mm = f35 > 0 && f35 < 400 ? f35 : FOCALE_DI_SERIE;
  return (mm * lungo * 1.25) / DIAGONALE_35MM;
}
