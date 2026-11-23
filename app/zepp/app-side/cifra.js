/* La cifratura fra l'orologio e la casa, dalla parte dell'orologio.
 *
 * E' la stessa di `ponte/src/cifra.js` (Node) e di `app/lib/ponte/cifra.dart`
 * (l'app): X25519 per lo scambio, HKDF-SHA256 per la chiave, AES-256-GCM per
 * le buste. Le tre punte devono coincidere byte per byte, e la prova sta in
 * `test/cifra.test.js`, che apre e chiude buste con `ponte/src/cifra.js`, e
 * in `test/insieme.test.js`, che fa parlare questo file col portiere vero.
 *
 * Niente scritto a mano: le primitive vengono da `@noble/curves`,
 * `@noble/hashes` e `@noble/ciphers`, che non hanno dipendenze e sono
 * verificate da terzi. Il servizio di fianco gira nell'app Zepp, che non
 * promette ne' `crypto.subtle` ne' `TextEncoder`: qui i testi diventano byte
 * da soli (`inByte`, `daByte`) e le librerie ricevono sempre byte.
 */

import { x25519 } from "@noble/curves/ed25519.js";
import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

export const VERSIONE = 1;
export const VERSIONE_DELL_ABBINAMENTO = 2;
export const VERSIONE_DEL_LEGAME = 1;

const ETICHETTA_FILO = "gdahome/filo/v1";
const ETICHETTA_ABBINAMENTO = "gdahome/abbinamento/v2";
const ETICHETTA_DEL_LEGAME = "gdahome/lega/v1";

/* La chiave pubblica X25519 viaggia come la scrive Node: SubjectPublicKeyInfo
 * in DER, cioe' questi dodici byte e poi i trentadue della chiave. */
const TESTA_SPKI = Uint8Array.from([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x03, 0x21, 0x00,
]);

/* ─── Testi e byte, senza chiedere niente alla piattaforma ───────────────── */

export function inByte(testo) {
  const fuori = [];
  const s = String(testo);
  for (let i = 0; i < s.length; i += 1) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const basso = s.charCodeAt(i + 1);
      if (basso >= 0xdc00 && basso <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (basso - 0xdc00);
        i += 1;
      }
    }
    if (c < 0x80) fuori.push(c);
    else if (c < 0x800) fuori.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000) fuori.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else
      fuori.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f),
      );
  }
  return Uint8Array.from(fuori);
}

export function daByte(byte) {
  let fuori = "";
  for (let i = 0; i < byte.length; ) {
    const a = byte[i];
    let c;
    if (a < 0x80) {
      c = a;
      i += 1;
    } else if (a >= 0xf0) {
      c =
        ((a & 0x07) << 18) |
        ((byte[i + 1] & 0x3f) << 12) |
        ((byte[i + 2] & 0x3f) << 6) |
        (byte[i + 3] & 0x3f);
      i += 4;
    } else if (a >= 0xe0) {
      c = ((a & 0x0f) << 12) | ((byte[i + 1] & 0x3f) << 6) | (byte[i + 2] & 0x3f);
      i += 3;
    } else {
      c = ((a & 0x1f) << 6) | (byte[i + 1] & 0x3f);
      i += 2;
    }
    if (c >= 0x10000) {
      c -= 0x10000;
      fuori += String.fromCharCode(0xd800 + (c >> 10), 0xdc00 + (c & 0x3ff));
    } else {
      fuori += String.fromCharCode(c);
    }
  }
  return fuori;
}

const LETTERE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function inBase64(byte) {
  let fuori = "";
  for (let i = 0; i < byte.length; i += 3) {
    const a = byte[i];
    const b = i + 1 < byte.length ? byte[i + 1] : 0;
    const c = i + 2 < byte.length ? byte[i + 2] : 0;
    fuori += LETTERE[a >> 2] + LETTERE[((a & 3) << 4) | (b >> 4)];
    fuori += i + 1 < byte.length ? LETTERE[((b & 15) << 2) | (c >> 6)] : "=";
    fuori += i + 2 < byte.length ? LETTERE[c & 63] : "=";
  }
  return fuori;
}

export function daBase64(testo) {
  const pulito = String(testo).replace(/[^A-Za-z0-9+/]/g, "");
  const fuori = [];
  let accumulo = 0;
  let bit = 0;
  for (const lettera of pulito) {
    accumulo = (accumulo << 6) | LETTERE.indexOf(lettera);
    bit += 6;
    if (bit >= 8) {
      bit -= 8;
      fuori.push((accumulo >> bit) & 0xff);
    }
  }
  return Uint8Array.from(fuori);
}

export function daEsadecimale(testo) {
  const s = String(testo);
  const fuori = new Uint8Array(s.length / 2);
  for (let i = 0; i < fuori.length; i += 1) fuori[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return fuori;
}

export function insieme(...pezzi) {
  const quanti = pezzi.reduce((tot, uno) => tot + uno.length, 0);
  const fuori = new Uint8Array(quanti);
  let dove = 0;
  for (const pezzo of pezzi) {
    fuori.set(pezzo, dove);
    dove += pezzo.length;
  }
  return fuori;
}

/* Il codice come lo scrive la casa: maiuscole, niente spazi ne' trattini
 * (`ponte/src/segreti.js`, `codicePulito`). */
export function codicePulito(scritto) {
  return String(scritto ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
}

/* ─── La stretta di mano ─────────────────────────────────────────────────── */

/** Una coppia effimera: `segreta` resta qui, `pubblica` e' gia' in DER. */
export function coppiaEffimera(caso) {
  const segreta = caso(32);
  return { segreta, pubblica: insieme(TESTA_SPKI, x25519.getPublicKey(segreta)) };
}

function chiaveNuda(der) {
  const byte = der instanceof Uint8Array ? der : daBase64(der);
  if (byte.length !== 44) throw new Error("chiave pubblica sbagliata");
  for (let i = 0; i < TESTA_SPKI.length; i += 1) {
    if (byte[i] !== TESTA_SPKI[i]) throw new Error("chiave pubblica sbagliata");
  }
  return byte.subarray(12);
}

/* L'impronta delle due righe in chiaro, per il legame: ognuna preceduta dalla
 * sua lunghezza in quattro byte (`ponte/src/cifra.js`). */
export function improntaDellaStretta(ciao, pronto) {
  const lunga = (byte) =>
    Uint8Array.from([
      (byte.length >>> 24) & 255,
      (byte.length >>> 16) & 255,
      (byte.length >>> 8) & 255,
      byte.length & 255,
    ]);
  const a = inByte(ciao);
  const b = inByte(pronto);
  return sha256(
    insieme(inByte(ETICHETTA_DEL_LEGAME), Uint8Array.from([0]), lunga(a), a, lunga(b), b),
  );
}

export function chiaveDiSessione({
  miaSegreta,
  suaPubblica,
  delTelefono,
  dellaCasa,
  apertura,
  chiaveDelFilo = null,
  codice = null,
  stretta = null,
}) {
  if (Boolean(chiaveDelFilo) === Boolean(codice)) {
    throw new Error("serve la chiave del filo oppure il codice, e uno solo dei due");
  }
  const scambio = x25519.getSharedSecret(miaSegreta, chiaveNuda(suaPubblica));
  const segreto = chiaveDelFilo ? daEsadecimale(chiaveDelFilo) : inByte(codicePulito(codice));
  /* Le due chiavi pubbliche entrano nel sale in DER, come le scrive la casa:
   * in byte, o in base64 come viaggiano. */
  const comeByte = (chiave) => (chiave instanceof Uint8Array ? chiave : daBase64(chiave));
  const sale = insieme(
    apertura,
    comeByte(delTelefono),
    comeByte(dellaCasa),
    ...(stretta ? [stretta] : []),
  );
  const etichetta = chiaveDelFilo ? ETICHETTA_FILO : ETICHETTA_ABBINAMENTO;
  return hkdf(
    sha256,
    insieme(scambio, segreto),
    sale,
    inByte(stretta ? `${etichetta}+lega` : etichetta),
    32,
  );
}

/* ─── Le buste ───────────────────────────────────────────────────────────── */

const DA_CHI = { telefono: 0, casa: 1 };

function nonce(daChi, contatore) {
  const dodici = new Uint8Array(12);
  dodici[0] = daChi;
  /* Il contatore in otto byte, alla fine: basta la parte bassa, un orologio
   * non manda quattro miliardi di buste. */
  dodici[8] = (contatore >>> 24) & 255;
  dodici[9] = (contatore >>> 16) & 255;
  dodici[10] = (contatore >>> 8) & 255;
  dodici[11] = contatore & 255;
  return dodici;
}

export class BustaGuasta extends Error {}

/* Le buste di un filo: ognuna col suo numero, in ordine, in tutte e due le
 * direzioni. Come quelle di `ponte/src/cifra.js`, senza il gzip: l'orologio
 * non dice di saperlo aprire, e la casa non comprime. */
export class Busta {
  constructor(chiave) {
    this.chiave = chiave;
    this.mando = 0;
    this.ricevo = 0;
  }

  chiudi(testo) {
    const dodici = nonce(DA_CHI.telefono, this.mando);
    const cifrato = gcm(this.chiave, dodici).encrypt(inByte(testo));
    this.mando += 1;
    return inBase64(insieme(dodici, cifrato));
  }

  apri(base64) {
    const tutto = daBase64(base64);
    if (tutto.length < 12 + 16) throw new BustaGuasta("busta troppo corta");
    const dodici = tutto.subarray(0, 12);
    if (dodici[0] !== DA_CHI.casa) throw new BustaGuasta("busta dalla direzione sbagliata");
    const contatore =
      ((dodici[8] << 24) >>> 0) + (dodici[9] << 16) + (dodici[10] << 8) + dodici[11];
    if (dodici[4] || dodici[5] || dodici[6] || dodici[7] || contatore !== this.ricevo) {
      throw new BustaGuasta("busta fuori ordine");
    }
    let byte;
    try {
      byte = gcm(this.chiave, dodici).decrypt(tutto.subarray(12));
    } catch (_errore) {
      throw new BustaGuasta("la busta non si apre");
    }
    this.ricevo += 1;
    return daByte(byte);
  }
}
