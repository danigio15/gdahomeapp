/* I segreti: fabbricarli, confrontarli, e non conservarli mai in chiaro.
 *
 * Tre regole, e sono le stesse del centralino:
 *
 *  - un segreto si conserva per impronta. Chi legge il file dei dispositivi
 *    non entra in casa di nessuno;
 *  - due segreti non si confrontano mai con `===`. Il tempo che ci mette
 *    dipende da quante lettere iniziali coincidono, e da quel tempo si ricava
 *    il segreto una lettera per volta;
 *  - il caso viene da `randomBytes`, mai da `Math.random`, che e' prevedibile
 *    per costruzione.
 */

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export function impronta(segreto) {
  return createHash("sha256")
    .update(String(segreto ?? ""), "utf8")
    .digest("hex");
}

export function stessoSegreto(uno, due) {
  const a = Buffer.from(String(uno ?? ""), "utf8");
  const b = Buffer.from(String(due ?? ""), "utf8");
  /* `timingSafeEqual` pretende la stessa lunghezza e altrimenti solleva. Le
   * lunghezze qui sono impronte, quindi sempre uguali; quando non lo sono la
   * risposta e' no, e non c'e' niente da nascondere sul tempo perche' la
   * lunghezza non e' un segreto. */
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function segnoNuovo() {
  return randomBytes(32).toString("hex");
}

/* L'alfabeto dei codici di abbinamento.
 *
 * Niente 0/O, niente 1/I/L: un codice si legge dallo schermo del computer e si
 * batte sul telefono, e quelle coppie si sbagliano. Ventotto lettere alla
 * ottava fanno trentasette milioni di miliardi di codici, che per una finestra
 * di cinque minuti e' molto piu' che abbastanza. */
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function codiceNuovo(quante = 8) {
  let codice = "";
  for (let i = 0; i < quante; i += 1) codice += ALFABETO[randomInt(ALFABETO.length)];
  return codice;
}

/* Chi lo batte a mano scrive minuscolo, mette spazi, o un trattino in mezzo. */
export function codicePulito(scritto) {
  return String(scritto ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
}
