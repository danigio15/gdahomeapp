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
 * batte sul telefono, e quelle coppie si sbagliano.
 *
 * Trentuno lettere fanno poco meno di cinque bit l'una. Sedici lettere sono
 * quindi ottanta bit — un numero che non si indovina nemmeno provandolo
 * lontano da qui. E lontano da qui e' il caso che conta: al centralino il
 * codice non arriva mai, ci arriva la sua **impronta**, ma un'impronta si
 * prova a raffica in casa propria, senza che nessuno lo veda e senza nessun
 * limite di tentativi. Otto lettere sono quaranta bit, e quaranta bit su una
 * scheda grafica cadono in qualche minuto: dentro i cinque minuti in cui il
 * codice vale. Sedici no, e non cadranno.
 *
 * Sedici lettere non si battono volentieri, ed e' il motivo per cui c'e' il
 * codice a quadretti: si inquadra, e non si batte niente. Chi proprio deve
 * scriverle a mano le trova sotto al quadretto, in quattro gruppi da
 * quattro. */
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function codiceNuovo(quante = 16) {
  let codice = "";
  for (let i = 0; i < quante; i += 1) codice += ALFABETO[randomInt(ALFABETO.length)];
  return codice;
}

/* Come si legge: quattro gruppi da quattro. Un codice di sedici lettere di
 * fila non lo copia nessuno senza perdere il segno. */
export function codiceAGruppi(codice, quanti = 4) {
  return String(codice ?? "").replace(new RegExp(`(.{${quanti}})(?=.)`, "g"), "$1-");
}

/* Chi lo batte a mano scrive minuscolo, mette spazi, o un trattino in mezzo. */
export function codicePulito(scritto) {
  return String(scritto ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
}
