/* Se chi bussa sta sulla rete di casa.
 *
 * Nato per dirlo e basta: «sono in casa, apro gdahome nel browser con
 * l'indirizzo di fuori, e mi dice che fuori casa serve Premium». Adesso lo
 * dice **e lo fa valere**: con gdahome Base l'app si apre solo dalla rete di
 * casa, e un telefono che da qui risulta fuori il portiere lo ferma alla prima
 * parola (`portiere.js`, `soloInCasa`; `licenze.js`, `soloDaCasa`). Le strade
 * per arrivare alla porta dell'app da fuori sono tante — il centralino, una
 * porta aperta sul router, un proxy (l'add-on NGINX, il tunnel di Cloudflare,
 * Caddy), una VPN (Tailscale, ZeroTier, WireGuard) — e la domanda e' una
 * sola: questa presa e' di un telefono sulla rete di casa, o no?
 *
 * **Come si decide**, nell'ordine:
 *
 *  1. **Un proxy davanti vuol dire fuori.** Un telefono in casa bussa dritto
 *     all'indirizzo della macchina: nessuno scrive `X-Forwarded-For`,
 *     `Forwarded`, `X-Real-IP`, `CF-Connecting-IP` e le loro cugine. Se ci
 *     sono, in mezzo c'e' qualcuno, e quello che scrive non si puo' verificare
 *     (un proxy configurato male gira quello che gli scrive il visitatore).
 *     Una volta un proxy che diceva «indirizzo privato» faceva casa; con Base
 *     non piu': nel dubbio si e' fuori.
 *  2. **L'indirizzo del socket**, e solo quello. Pubblico: fuori. 100.64/10
 *     (Tailscale, il CGNAT dei gestori): fuori. Link-local: fuori — un
 *     telefono non arriva in questo contenitore dal suo link, ci arrivano gli
 *     altri contenitori.
 *  3. **La macchina stessa non e' un telefono.** La rete fra gli add-on
 *     (172.30.32.0/23, e la sua cugina IPv6) e' da dove arriva chi passa da un
 *     altro add-on — NGINX, cloudflared, un tunnel — e da dove arriva quello
 *     che la macchina gira a se stessa (il «giro» del router, un subnet router
 *     di Tailscale che maschera col proprio indirizzo). Lo stesso per gli
 *     indirizzi della macchina e per i router di casa: chi bussa con
 *     l'indirizzo del router e' il router che gira qualcosa da fuori.
 *  4. **La rete di casa, quando la si conosce.** Il Supervisor dice su quali
 *     reti sta la macchina (`/network/info`, lo chiede gia' `ritorno.js`): un
 *     telefono di casa sta in una di quelle — stessa sottorete IPv4, stesso
 *     /64 IPv6. Una VPN che da' ai suoi indirizzi privati di un'altra rete
 *     (WireGuard, OpenVPN, ZeroTier) resta fuori. Finche' il Supervisor non
 *     ha risposto, o non risponde, basta un indirizzo privato.
 *
 * Il loopback del contenitore resta casa: da li' bussa solo chi gira dentro
 * l'add-on (le prove), e non c'e' strada da fuori che ci arrivi.
 *
 * **Quello che non si puo' sapere**, detto chiaro: un inoltro che non scrive
 * niente e che sta su un'altra macchina della rete di casa (un Raspberry con
 * `socat`, un proxy TCP, una VPN del router che da' indirizzi della rete di
 * casa) e' identico, visto da qui, a un telefono sul divano. Dall'indirizzo
 * non si puo' dire di piu'.
 */

import { BlockList, isIP } from "node:net";

/* Le intestazioni che scrive chi sta in mezzo. Un telefono, e un browser,
 * non ne scrivono nessuna. */
const DEI_PROXY = new Set([
  "forwarded",
  "x-real-ip",
  "x-client-ip",
  "x-cluster-client-ip",
  "x-original-forwarded-for",
  "true-client-ip",
  "fastly-client-ip",
  "cdn-loop",
  "via",
  "x-ingress-path",
]);
/* E le famiglie intere: `X-Forwarded-*`, quelle di Cloudflare (`CF-*`) e
 * quelle che Tailscale aggiunge quando serve una porta (`Tailscale-*`). */
const FAMIGLIE_DEI_PROXY = ["x-forwarded-", "cf-", "tailscale-"];

/* La rete fra gli add-on, come la fa il Supervisor: da li' arriva chi passa
 * da un altro add-on, e quello che la macchina gira a se stessa. */
const RETI_DELLA_MACCHINA = [
  ["172.30.32.0", 23],
  ["fd0c:ac1e:2100::", 48],
];

/* Le schede del Supervisor che sono la rete di casa. Una VPN che si fa la sua
 * scheda non e' fra queste. */
const SCHEDE_DI_CASA = new Set(["ethernet", "wireless", "vlan"]);

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

function eLoopback(ip) {
  return ip === "::1" || (isIP(ip) === 4 && ip.startsWith("127."));
}

function eLinkLocal(ip) {
  if (isIP(ip) === 4) return ip.startsWith("169.254.");
  return (parseInt(ip.split(":")[0] || "0", 16) & 0xffc0) === 0xfe80;
}

const famiglia = (ip) => (isIP(ip) === 4 ? "ipv4" : "ipv6");

/** Se davanti c'e' un proxy: una qualunque delle sue intestazioni. */
export function passaDaUnProxy(intestazioni = {}) {
  for (const nome of Object.keys(intestazioni || {})) {
    const minuscolo = nome.toLowerCase();
    if (DEI_PROXY.has(minuscolo)) return true;
    if (FAMIGLIE_DEI_PROXY.some((prefisso) => minuscolo.startsWith(prefisso))) return true;
  }
  return false;
}

/* "192.168.1.50/24" → { ip, bit }, o null. */
function unaRete(scritto, { diSerie } = {}) {
  const [davanti, dietro] = String(scritto ?? "").split("/");
  const ip = indirizzoPulito(davanti);
  if (!ip) return null;
  const massimo = isIP(ip) === 4 ? 32 : 128;
  let bit = Number.parseInt(dietro, 10);
  if (!Number.isFinite(bit) || bit < 0 || bit > massimo) bit = diSerie ?? massimo;
  return { ip, bit };
}

/**
 * La rete di casa, da quello che dice il Supervisor in `/network/info`.
 *
 * Torna `null` se non si capisce niente. Si legge senza fidarsi della forma:
 * la risposta non la decidiamo noi.
 *
 *  - `reti`: le sottoreti dove sta un telefono di casa — quelle delle schede
 *    ethernet, Wi-Fi e VLAN. IPv4 solo private (una macchina con un indirizzo
 *    pubblico sulla scheda non fa «di casa» i suoi vicini di rack); IPv6 al
 *    piu' larghe un /64, che e' quello che un router da' a una rete di casa.
 *  - `macchina`: le reti della macchina stessa, la rete fra gli add-on.
 *  - `propri`: gli indirizzi della macchina e dei router di casa.
 */
export function laReteDiCasa(dati) {
  const schede = dati?.interfaces;
  if (!Array.isArray(schede)) return null;
  const reti = [];
  const macchina = [];
  const propri = [];
  for (const scheda of schede) {
    if (!scheda || typeof scheda !== "object" || scheda.enabled === false) continue;
    if (typeof scheda.type === "string" && !SCHEDE_DI_CASA.has(scheda.type)) continue;
    for (const quale of ["ipv4", "ipv6"]) {
      const come = scheda[quale];
      if (!come || typeof come !== "object") continue;
      const indirizzi = Array.isArray(come.address) ? come.address : [];
      for (const scritto of indirizzi) {
        const rete = unaRete(scritto, { diSerie: quale === "ipv4" ? 24 : 64 });
        if (!rete || eLoopback(rete.ip) || eLinkLocal(rete.ip)) continue;
        propri.push(rete.ip);
        if (isIP(rete.ip) === 4) {
          if (!eDiRetePrivata(rete.ip)) continue;
          /* Un /32 non e' una rete: e' la macchina e basta. */
          reti.push({ ip: rete.ip, bit: rete.bit >= 31 ? 24 : rete.bit });
        } else {
          /* DHCPv6 da' spesso un /128: la rete di casa e' il suo /64. */
          reti.push({ ip: rete.ip, bit: Math.min(Math.max(rete.bit, 48), 64) });
        }
      }
      const router = indirizzoPulito(come.gateway);
      if (router) propri.push(router);
    }
  }
  const docker = dati?.docker;
  if (docker && typeof docker === "object") {
    const rete = unaRete(docker.address);
    if (rete) macchina.push(rete);
    const suo = indirizzoPulito(docker.gateway);
    if (suo) propri.push(suo);
  }
  return { reti, macchina, propri };
}

/* Le liste pronte per il confronto. Si rifanno solo quando la rete cambia. */
const PRONTE = new WeakMap();
const SENZA_RETE = {};
function pronte(rete) {
  const chiave = rete && typeof rete === "object" ? rete : SENZA_RETE;
  if (PRONTE.has(chiave)) return PRONTE.get(chiave);
  const casa = new BlockList();
  const macchina = new BlockList();
  let quanteDiCasa = 0;
  for (const [ip, bit] of RETI_DELLA_MACCHINA) macchina.addSubnet(ip, bit, famiglia(ip));
  for (const { ip, bit } of rete?.macchina ?? []) {
    try {
      macchina.addSubnet(ip, bit, famiglia(ip));
    } catch (_errore) {
      /* Una rete scritta storta: si lascia stare. */
    }
  }
  for (const { ip, bit } of rete?.reti ?? []) {
    try {
      casa.addSubnet(ip, bit, famiglia(ip));
      quanteDiCasa += 1;
    } catch (_errore) {
      /* Come sopra. */
    }
  }
  const propri = new Set((rete?.propri ?? []).map((uno) => indirizzoPulito(uno)).filter(Boolean));
  const fatte = { casa, macchina, propri, quanteDiCasa };
  PRONTE.set(chiave, fatte);
  return fatte;
}

/**
 * Se questa richiesta arriva da un telefono sulla rete di casa.
 *
 * `richiesta` e' quella di `node:http` (serve `socket.remoteAddress` e
 * `headers`). `rete` e' quella di `laReteDiCasa`, se il Supervisor l'ha
 * detta; senza, basta un indirizzo privato che non sia della macchina. Nel
 * dubbio si e' fuori.
 */
export function arrivaDaCasa(richiesta, rete = null) {
  if (passaDaUnProxy(richiesta?.headers)) return false;
  const ip = indirizzoPulito(richiesta?.socket?.remoteAddress);
  if (!ip) return false;
  if (eLoopback(ip)) return true;
  if (eLinkLocal(ip) || !eDiRetePrivataODiCasa(ip, rete)) return false;
  const { casa, macchina, propri, quanteDiCasa } = pronte(rete);
  if (propri.has(ip) || macchina.check(ip, famiglia(ip))) return false;
  if (quanteDiCasa > 0) return casa.check(ip, famiglia(ip));
  return eDiRetePrivata(ip);
}

/* Privato, o un IPv6 globale che sta in una rete di casa: l'unico indirizzo
 * pubblico che puo' essere di casa e' quello del /64 della casa stessa. */
function eDiRetePrivataODiCasa(ip, rete) {
  if (eDiRetePrivata(ip)) return true;
  if (isIP(ip) !== 6) return false;
  const { casa, quanteDiCasa } = pronte(rete);
  return quanteDiCasa > 0 && casa.check(ip, "ipv6");
}
