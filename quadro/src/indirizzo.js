/* Da chi arriva una richiesta.
 *
 * Davanti c'e' Caddy, sulla stessa macchina, quindi il socket dice quasi
 * sempre 127.0.0.1: contare per socket vorrebbe dire contare tutti insieme, e
 * un tetto «per indirizzo» diventerebbe un tetto per tutti — basterebbe uno a
 * riempirlo. Caddy scrive l'indirizzo vero in `x-forwarded-for`, e quella riga
 * si crede **solo** se a portarla e' stata la macchina stessa: da chiunque
 * altro l'intestazione la scrive chi vuole.
 *
 * Dell'intestazione si prende l'**ultimo** elemento: e' quello che ha scritto
 * Caddy, l'unico che viene da noi. Quelli prima li ha portati il cliente, e se
 * li inventa come vuole.
 *
 * E un IPv6 si conta per /64: una sola connessione di casa ne ha a miliardi, e
 * contarli uno per uno vorrebbe dire nessun tetto.
 *
 * La stessa regola di `centralino/src/indirizzo.js`, piu' la /64.
 */

import { isIP } from "node:net";

const DA_QUI = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export const eDaQui = (indirizzo) => DA_QUI.has(String(indirizzo || ""));

/* L'indirizzo vero di chi bussa, cosi' com'e'. */
export function daChi(richiesta) {
  const diretto = String(richiesta?.socket?.remoteAddress || "?");
  if (!eDaQui(diretto)) return diretto;
  const passati = String(richiesta?.headers?.["x-forwarded-for"] || "")
    .split(",")
    .map((uno) => uno.trim())
    .filter(Boolean);
  const ultimo = passati.at(-1) || "";
  return isIP(ultimo) ? ultimo : diretto;
}

/* Lo stesso, nella forma con cui si conta: un IPv4 com'e', un IPv6 per /64. */
export function perContare(indirizzo) {
  const detto = String(indirizzo || "?").replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i, "$1");
  if (isIP(detto) !== 6) return detto;
  /* Le prime quattro parti, dopo aver riempito il `::`. */
  const [prima, dopo = ""] = detto.split("::");
  const testa = prima ? prima.split(":") : [];
  const coda = detto.includes("::") ? (dopo ? dopo.split(":") : []) : [];
  const mancano = 8 - testa.length - coda.length;
  const tutte = detto.includes("::")
    ? [...testa, ...Array(Math.max(0, mancano)).fill("0"), ...coda]
    : testa;
  return `${tutte
    .slice(0, 4)
    .map((una) => (parseInt(una, 16) || 0).toString(16))
    .join(":")}::/64`;
}

/** Da chi arriva, gia' pronto per essere contato. */
export const daChiSiConta = (richiesta) => perContare(daChi(richiesta));
