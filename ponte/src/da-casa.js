/* Se chi bussa sta sulla rete di casa.
 *
 * «Sono in casa, apro gdahome nel browser con l'indirizzo di fuori, e mi dice
 * che fuori casa serve Premium.» La web app servita da un indirizzo `https`
 * pubblico non puo' bussare a `http://192.168.…` — il browser lo vieta — e
 * con gdahome Base l'indirizzo pubblico l'app non lo provava nemmeno. Da
 * fuori, sullo schermo del telefono, «sono in casa» e «sono in stazione» con
 * lo stesso indirizzo sono la stessa cosa. Da qui no: la casa vede da dove
 * arriva la presa, e lo dice.
 *
 * Lo dice e basta. A decidere resta l'app, come per tutto il resto di Base
 * (`licenze.js`, `limitata`): la casa non chiude niente.
 *
 * **Come si decide.** L'indirizzo di chi bussa e' di una rete privata —
 * 10/8, 172.16/12, 192.168/16, il loopback, il link-local, gli fc00::/7 — e
 * nessun proxy davanti dice di aver ricevuto la richiesta da un indirizzo
 * pubblico. Davanti all'add-on ci puo' essere il proxy di chi ha messo un
 * dominio suo (NGINX, Caddy, il tunnel di Cloudflare): per lui la presa
 * arriva da un indirizzo privato, quello del proxy, e il visitatore vero sta
 * in `X-Forwarded-For` e nelle sue cugine. Si guardano **tutti** gli
 * indirizzi scritti, non solo il primo o l'ultimo: chi scrive di suo un
 * `X-Forwarded-For: 192.168.1.5` da fuori se lo ritrova davanti a quello che
 * il proxy ci aggiunge — quello pubblico — e resta fuori.
 *
 * Gli indirizzi 100.64/10 (Tailscale e le VPN che li usano) non sono la rete
 * di casa: sono un modo di entrarci da fuori, ed e' quello che fa Premium.
 *
 * Un proxy che non scrive niente di chi gli ha parlato non si puo' smentire:
 * la richiesta sembra di casa. E' la stessa fiducia che c'era prima, quando
 * l'indirizzo di casa scritto nel QR bastava per dire «sono in casa».
 */

import { isIP } from "node:net";

/* Le intestazioni dove un proxy scrive il visitatore vero. */
const DEI_PROXY = ["x-forwarded-for", "x-real-ip", "cf-connecting-ip", "true-client-ip"];

/** L'indirizzo come lo si confronta: senza porta, senza `[…]`, senza il
 * prefisso IPv4-in-IPv6 che Node mette davanti alle prese IPv4. */
export function indirizzoPulito(grezzo) {
  let testo = String(grezzo ?? "")
    .trim()
    .replace(/^"|"$/g, "");
  if (!testo) return "";
  const tra = /^\[([^\]]+)\](?::\d+)?$/.exec(testo);
  if (tra) testo = tra[1];
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(testo)) testo = testo.replace(/:\d+$/, "");
  testo = testo.replace(/%.*$/, "").toLowerCase();
  if (testo.startsWith("::ffff:") && isIP(testo.slice(7)) === 4) testo = testo.slice(7);
  return isIP(testo) ? testo : "";
}

/** Se l'indirizzo e' di una rete che non esce su internet. */
export function eDiRetePrivata(grezzo) {
  const ip = indirizzoPulito(grezzo);
  if (!ip) return false;
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    );
  }
  if (ip === "::1") return true;
  const primo = parseInt(ip.split(":")[0] || "0", 16);
  // fc00::/7 (le ULA) e fe80::/10 (il link-local).
  return (primo & 0xfe00) === 0xfc00 || (primo & 0xffc0) === 0xfe80;
}

/* Tutti gli indirizzi che i proxy davanti hanno scritto. */
function scrittiDaiProxy(intestazioni = {}) {
  const tutti = [];
  for (const nome of DEI_PROXY) {
    const valore = intestazioni[nome];
    const righe = Array.isArray(valore) ? valore : [valore];
    for (const riga of righe) {
      if (typeof riga !== "string") continue;
      for (const pezzo of riga.split(",")) if (pezzo.trim()) tutti.push(pezzo.trim());
    }
  }
  const forwarded = intestazioni.forwarded;
  for (const riga of Array.isArray(forwarded) ? forwarded : [forwarded]) {
    if (typeof riga !== "string") continue;
    for (const preso of riga.matchAll(/for=("[^"]*"|[^;,\s]+)/gi)) tutti.push(preso[1]);
  }
  return tutti;
}

/**
 * Se questa richiesta arriva dalla rete di casa.
 *
 * `richiesta` e' quella di `node:http` (serve `socket.remoteAddress` e
 * `headers`). Un indirizzo scritto da un proxy che non si sa leggere conta
 * come pubblico: nel dubbio si e' fuori.
 */
export function arrivaDaCasa(richiesta) {
  if (!eDiRetePrivata(richiesta?.socket?.remoteAddress)) return false;
  return scrittiDaiProxy(richiesta?.headers).every((scritto) => eDiRetePrivata(scritto));
}
