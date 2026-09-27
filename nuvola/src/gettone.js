/* Il gettone di una licenza, verificato sulla nuvola.
 *
 * E' la stessa cosa di `ponte/src/gettone.js`, con le funzioni che un Worker
 * ha: `crypto.subtle` al posto di `node:crypto`, e quindi asincrona. Le regole
 * sono quelle di `docs/LICENZE.md`, e sono le stesse righe:
 *
 *   - la firma Ed25519 e' giusta, sui byte ASCII del primo pezzo;
 *   - `v == 1`, `sog` e' il soggetto atteso, `fino > adesso`;
 *   - `scade == null || scade > adesso`;
 *   - un gettone `gdahome` vale anche quando si chiede `gdanav`.
 *
 * Senza chiave — la riga vuota di `chiave-licenze.js` — non vale nessun
 * gettone, e il centralino non guarda niente: e' come stava prima.
 */

const PEZZO = /^[A-Za-z0-9_-]+$/;
const GETTONE_MASSIMO = 4096;

function daBase64url(testo) {
  const normale = testo.replace(/-/g, "+").replace(/_/g, "/");
  const pieno = normale + "=".repeat((4 - (normale.length % 4)) % 4);
  const binario = atob(pieno);
  const byte = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) byte[i] = binario.charCodeAt(i);
  return byte;
}

/* Le chiavi importate, una per stringa: un oggetto della casa si sveglia
 * spesso, e importare la stessa chiave a ogni messaggio non serve. Vive
 * quanto vive l'isolato, che e' quanto basta. */
const chiaviFatte = new Map();

async function chiaveDa(chiave) {
  if (chiaviFatte.has(chiave)) return chiaviFatte.get(chiave);
  let fatta = null;
  try {
    const grezza = PEZZO.test(chiave) ? daBase64url(chiave) : null;
    if (grezza && grezza.length === 32) {
      fatta = await crypto.subtle.importKey("raw", grezza, { name: "Ed25519" }, false, ["verify"]);
    }
  } catch (_errore) {
    fatta = null;
  }
  chiaviFatte.set(chiave, fatta);
  return fatta;
}

/** Cosa dice un gettone, senza guardare la firma. `null` se non lo e'. */
export function leggiGettone(gettone) {
  if (typeof gettone !== "string" || gettone.length > GETTONE_MASSIMO) return null;
  const pezzi = gettone.split(".");
  if (pezzi.length !== 2 || !PEZZO.test(pezzi[0]) || !PEZZO.test(pezzi[1])) return null;
  try {
    const detto = JSON.parse(new TextDecoder().decode(daBase64url(pezzi[0])));
    return detto && typeof detto === "object" && !Array.isArray(detto) ? detto : null;
  } catch (_errore) {
    return null;
  }
}

/** Il gettone vale? Torna quello che c'e' dentro se si', `null` se no. */
export async function verificaGettone(
  gettone,
  { chiave = "", sog = "", app = "gdahome", adesso = Date.now() } = {},
) {
  if (!chiave || !sog) return null;
  const detto = leggiGettone(gettone);
  if (!detto) return null;

  const pubblica = await chiaveDa(String(chiave));
  if (!pubblica) return null;
  const [primo, firma] = gettone.split(".");
  const byteDellaFirma = daBase64url(firma);
  if (byteDellaFirma.length !== 64) return null;
  let giusta = false;
  try {
    /* I byte ASCII del primo pezzo: e' base64url, quindi ASCII per forza. */
    const dati = new TextEncoder().encode(primo);
    giusta = await crypto.subtle.verify({ name: "Ed25519" }, pubblica, byteDellaFirma, dati);
  } catch (_errore) {
    giusta = false;
  }
  if (!giusta) return null;

  return valeAdesso(detto, { sog, app, adesso }) ? detto : null;
}

/* Le regole che non sono la firma: le stesse righe di `ponte/src/gettone.js`. */
export function valeAdesso(detto, { sog, app, adesso }) {
  if (!detto || detto.v !== 1) return false;
  if (detto.sog !== sog) return false;
  if (detto.app !== app && !(app === "gdanav" && detto.app === "gdahome")) return false;
  if (typeof detto.fino !== "number" || !(detto.fino > adesso)) return false;
  if (detto.scade !== null && !(typeof detto.scade === "number" && detto.scade > adesso)) {
    return false;
  }
  return true;
}

/* Fino a quando vale: il piu' vicino fra la fine del gettone e la fine della
 * licenza. E' il numero che l'oggetto della casa scrive nel suo archivio. */
export function valeFino(detto) {
  if (!detto) return 0;
  return detto.scade === null ? detto.fino : Math.min(detto.fino, detto.scade);
}
