/* Chi porta fuori gli avvisi.
 *
 * `avvisi.js` decide **cosa** dire; questo lo consegna. Sono due file perche'
 * sono due mestieri: le regole si provano senza rete, e la rete si prova senza
 * dover fabbricare una casa offline.
 *
 * ─── Un indirizzo, e nient'altro ─────────────────────────────────────────
 *
 * Si manda un `POST` con dentro il messaggio, a un indirizzo che da'
 * l'installatore. Niente posta elettronica, e non per pigrizia: mandare una
 * mail che arrivi davvero vuol dire un server SMTP, TLS, SPF, DKIM e una
 * reputazione da difendere, e il primo avviso che finisce nello spam e' un
 * avviso che non e' mai esistito.
 *
 * Un `POST` invece lo capiscono gia' tutti quelli che uno usa: Telegram —
 * `api.telegram.org/bot<…>/sendMessage?chat_id=<…>` — Slack, ntfy.sh, un
 * gestionale suo. E chi vuole la mail ci mette davanti tre righe sue.
 *
 * ─── Cosa si manda ───────────────────────────────────────────────────────
 *
 *     { "testo": "…", "tipo": "offline", "case": ["casa_…"], "quadro": "…" }
 *
 * `testo` per primo, perche' e' quello che serve: chi riceve spesso lo prende
 * cosi' com'e' e lo mostra. Gli altri campi servono a chi ci vuole costruire
 * sopra qualcosa.
 *
 * ─── Se non si riesce a consegnare ───────────────────────────────────────
 *
 * Non si riprova all'infinito e non si tiene una coda. Se un indirizzo non
 * risponde, l'avviso e' perso — e la casa resta segnata come **non avvisata**,
 * quindi al giro dopo ci si riprova per conto suo. E' un ripescaggio che costa
 * zero righe, e basta: dietro a una consegna che non riesce c'e' quasi sempre
 * un indirizzo sbagliato, e una coda non lo raddrizza.
 */

import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

/** Quanto si aspetta chi riceve prima di lasciar perdere. */
export const ATTESA = 10 * 1000;

/* Solo `https`, e per lo stesso motivo del rapporto: nel messaggio c'e' il
 * nome che l'installatore ha dato a una casa, cioe' l'unica cosa in tutto
 * questo quadro che nomini una persona. Su `http` la leggerebbe chiunque stia
 * in mezzo. */
const BUONO = /^https:\/\/[^\s/]+/;

export const indirizzoBuono = (dove) => {
  const detto = String(dove ?? "").trim();
  if (!BUONO.test(detto) || detto.length > 2048) return false;
  try {
    const letto = new URL(detto);
    /* Niente nome e parola d'ordine dentro l'indirizzo, e niente porte strane
     * scritte a mano: un avviso va a un servizio, non a una macchina di casa. */
    return letto.protocol === "https:" && !letto.username && !letto.password;
  } catch (_errore) {
    return false;
  }
};

/* ─── Dove un avviso non va ───────────────────────────────────────────────
 *
 * L'indirizzo lo scrive l'installatore, e a bussarci e' **questa** macchina:
 * da dentro, dove stanno cose che da fuori non si vedono — il servizio che
 * dice le credenziali della macchina al fornitore, il Caddy davanti, il
 * tramite. Un indirizzo che porta li' non e' un avviso, e non si manda.
 *
 * Non basta guardare il nome: `avvisi.esempio.it` puo' risolvere a
 * `127.0.0.1`. Si risolve, si guarda **ogni** indirizzo che torna, e ci si
 * collega proprio a quello che si e' guardato — non si lascia risolvere di
 * nuovo a chi si collega, che potrebbe sentirsi dare un'altra risposta. E un
 * rimando (`301`, `302`) non si segue: portarebbe da un'altra parte senza
 * passare di qui. */
const VIETATE = new BlockList();
for (const [rete, quanti] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
]) {
  VIETATE.addSubnet(rete, quanti, "ipv4");
}
for (const [rete, quanti] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
]) {
  VIETATE.addSubnet(rete, quanti, "ipv6");
}

/** Questo indirizzo IP e' di quelli dove un avviso non va? */
export function eVietato(indirizzo) {
  const detto = String(indirizzo ?? "")
    .trim()
    .replace(/^\[|\]$/g, "");
  const tipo = isIP(detto);
  if (!tipo) return true;
  if (tipo === 6) {
    /* Un IPv4 vestito da IPv6 (`::ffff:127.0.0.1`) si guarda da IPv4. */
    const dentro = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(detto);
    if (dentro) return eVietato(dentro[1]);
    return VIETATE.check(detto, "ipv6");
  }
  return VIETATE.check(detto, "ipv4");
}

/* Risolve un nome e tiene solo la risposta se **tutti** gli indirizzi vanno
 * bene: uno solo vietato basta per dire di no. */
async function risolviBene(nome, risolvi) {
  const detti = await risolvi(nome, { all: true, verbatim: true });
  const tutti = Array.isArray(detti) ? detti : [detti];
  if (!tutti.length) return null;
  if (tutti.some((uno) => eVietato(uno?.address))) return null;
  return tutti;
}

/* La consegna vera, con Node e basta: una richiesta che si collega
 * all'indirizzo gia' guardato, e che un rimando non lo segue. */
function consegnaDiretta(dove, { corpo, indirizzi, attesa }) {
  const buono = indirizzi[0];
  return new Promise((fatto) => {
    const richiesta = httpsRequest(
      dove,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(corpo),
        },
        timeout: attesa,
        /* Il nome l'abbiamo gia' risolto e guardato: ci si collega a quello. */
        lookup: (_nome, opzioni, richiama) => {
          if (opzioni?.all) richiama(null, [{ address: buono.address, family: buono.family }]);
          else richiama(null, buono.address, buono.family);
        },
      },
      (risposta) => {
        risposta.resume();
        fatto({
          ok: risposta.statusCode >= 200 && risposta.statusCode < 300,
          status: risposta.statusCode,
        });
      },
    );
    richiesta.on("timeout", () =>
      richiesta.destroy(new Error("chi riceve non ha risposto in tempo")),
    );
    richiesta.on("error", (errore) => fatto({ ok: false, status: 0, errore }));
    richiesta.end(corpo);
  });
}

export class Fattorino {
  /**
   * @param {object} opzioni
   * @param {Function} [opzioni.prendi] al posto della consegna vera, per le
   *   prove: riceve `(dove, {method, headers, body, redirect, signal})` e
   *   torna qualcosa con `ok` e `status`, come `fetch`
   * @param {Function} [opzioni.risolvi] al posto di `dns.lookup`, per le prove
   */
  constructor({ prendi = null, risolvi = lookup, registro = { info() {}, errore() {} } } = {}) {
    this.prendi = prendi;
    this.risolvi = risolvi;
    this.registro = registro;
  }

  /**
   * Consegna un messaggio. Torna `true` solo se e' arrivato davvero.
   *
   * Il `false` non e' un dettaglio: e' quello che tiene la casa segnata come
   * non avvisata, e quindi quello che fa riprovare al giro dopo.
   */
  async porta(dove, detto) {
    if (!indirizzoBuono(dove)) return false;
    const corpo = JSON.stringify({
      testo: detto.testo,
      tipo: detto.tipo,
      case: detto.case,
      quadro: "gdahome",
    });
    try {
      const nome = new URL(String(dove).trim()).hostname;
      const indirizzi = await risolviBene(nome.replace(/^\[|\]$/g, ""), this.risolvi);
      if (!indirizzi) {
        this.registro.errore("l'avviso non e' partito: quell'indirizzo porta dentro, non fuori");
        return false;
      }
      const risposta = this.prendi
        ? await this.prendi(dove, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: corpo,
            redirect: "manual",
            signal: AbortSignal.timeout(ATTESA),
          })
        : await consegnaDiretta(String(dove).trim(), { corpo, indirizzi, attesa: ATTESA });
      if (!risposta?.ok) {
        this.registro.errore(`l'avviso non e' stato accettato: ${risposta?.status ?? "?"}`);
        return false;
      }
      return true;
    } catch (errore) {
      this.registro.errore(`l'avviso non e' partito: ${errore?.message || errore}`);
      return false;
    }
  }
}
