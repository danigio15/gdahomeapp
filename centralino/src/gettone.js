/* Il gettone di una licenza, verificato da chi lo riceve.
 *
 * Il quadro firma, tutti gli altri verificano: e' la regola di
 * `docs/LICENZE.md`, e questo file e' la meta' «verificano» per chi gira in
 * Node — il ponte e il centralino, che ne tiene una copia identica (vedi
 * `centralino/src/PRESI_DAL_PONTE.md`). Il centralino sulla nuvola fa la
 * stessa cosa con le funzioni del Worker, in `nuvola/src/gettone.js`.
 *
 *     gettone = base64url(payload JSON) + "." + base64url(firma Ed25519)
 *     firma   = Ed25519(privata del quadro, byte ASCII del primo pezzo)
 *
 * ─── Le regole, uguali ovunque ───────────────────────────────────────────
 *
 *   - la firma e' giusta con la chiave pubblica;
 *   - `v == 1`, `sog` e' il soggetto atteso, `fino > adesso`;
 *   - `scade == null || scade > adesso`;
 *   - un gettone `gdahome` vale anche quando si chiede `gdanav`.
 *
 * Nient'altro: niente orologi di tolleranza, niente eccezioni per chi e' «quasi
 * scaduto». Tre pezzi che verificano con tre regole leggermente diverse sono
 * tre pezzi che un giorno non sono d'accordo sulla stessa casa.
 *
 * Senza chiave — la riga vuota di `chiave-licenze.js` — non vale nessun
 * gettone: e' il modo in cui le licenze stanno spente.
 */

import { createPublicKey, verify } from "node:crypto";

/* base64url senza `=`: lettere, cifre, `-` e `_`, e basta. */
const PEZZO = /^[A-Za-z0-9_-]+$/;

/* Un gettone vero pesa qualche centinaio di byte. Oltre questo non e' un
 * gettone, e non vale la fatica di aprirlo. */
const GETTONE_MASSIMO = 4096;

/* La chiave, fatta una volta sola per ogni stringa: il ponte verifica a ogni
 * domanda sul filo, e rifare l'oggetto ogni volta sarebbe lavoro per niente. */
const chiaviFatte = new Map();

function chiaveDa(chiave) {
  if (chiaviFatte.has(chiave)) return chiaviFatte.get(chiave);
  let fatta = null;
  try {
    if (PEZZO.test(chiave) && Buffer.from(chiave, "base64url").length === 32) {
      fatta = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: chiave }, format: "jwk" });
    }
  } catch (_errore) {
    fatta = null;
  }
  chiaviFatte.set(chiave, fatta);
  return fatta;
}

/**
 * Cosa dice un gettone, **senza** guardare la firma.
 *
 * Serve a mostrare, non a decidere: chi deve decidere se una casa e' Premium
 * usa `verificaGettone`. Torna `null` se non e' nemmeno fatto come un gettone.
 */
export function leggiGettone(gettone) {
  if (typeof gettone !== "string" || gettone.length > GETTONE_MASSIMO) return null;
  const pezzi = gettone.split(".");
  if (pezzi.length !== 2 || !PEZZO.test(pezzi[0]) || !PEZZO.test(pezzi[1])) return null;
  try {
    const detto = JSON.parse(Buffer.from(pezzi[0], "base64url").toString("utf8"));
    return detto && typeof detto === "object" && !Array.isArray(detto) ? detto : null;
  } catch (_errore) {
    return null;
  }
}

/**
 * Il gettone vale? Torna quello che c'e' dentro se si', `null` se no.
 *
 * `app` e' quello che si chiede — «questa casa ha gdahome?», «questo telefono
 * ha gdanav?» — e non quello che c'e' scritto nel gettone: un gettone
 * `gdahome` risponde di si' anche a `gdanav`, perche' gdanav Premium e'
 * compreso.
 */
export function verificaGettone(
  gettone,
  { chiave = "", sog = "", app = "gdahome", adesso = Date.now() } = {},
) {
  if (!chiave || !sog) return null;
  const detto = leggiGettone(gettone);
  if (!detto) return null;

  const pubblica = chiaveDa(String(chiave));
  if (!pubblica) return null;
  const [primo, firma] = gettone.split(".");
  const byteDellaFirma = Buffer.from(firma, "base64url");
  if (byteDellaFirma.length !== 64) return null;
  let giusta = false;
  try {
    giusta = verify(null, Buffer.from(primo, "ascii"), pubblica, byteDellaFirma);
  } catch (_errore) {
    giusta = false;
  }
  if (!giusta) return null;

  return valeAdesso(detto, { sog, app, adesso }) ? detto : null;
}

/* Le regole che non sono la firma. Stanno da sole perche' la nuvola ha la
 * sua firma — asincrona, con le funzioni del Worker — e queste righe devono
 * essere le stesse: la copia la' e' tenuta uguale da una prova. */
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

/* Fino a quando vale, cioe' il piu' vicino fra la fine del gettone e la fine
 * della licenza. E' il numero che un centralino si ricorda per una casa. */
export function valeFino(detto) {
  if (!detto) return 0;
  return detto.scade === null ? detto.fino : Math.min(detto.fino, detto.scade);
}
