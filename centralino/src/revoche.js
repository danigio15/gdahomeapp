/* Le licenze tolte, chieste al quadro.
 *
 * Un gettone vale otto giorni dalla firma (`quadro/src/licenze.js`), e il
 * centralino lo verifica da se', senza chiedere a nessuno. Vuol dire che una
 * licenza tolta dal gestore o da un installatore — un regalo sbagliato, un
 * pacchetto ripreso — continua ad aprire il fuori casa fino a otto giorni,
 * finche' il gettone che la casa ha in mano non scade.
 *
 * Accorciare il gettone non si puo' senza far male: lo stesso gettone tiene
 * Premium **in casa** a una casa rimasta senza internet, e otto giorni sono
 * proprio quelli. Quindi il gettone resta com'e', e il centralino in piu'
 * chiede al quadro, ogni tanto, l'elenco delle licenze tolte da poco:
 *
 *     GET <QUADRO_REVOCHE>   →   {"elenco": "<pezzo>.<firma>"}
 *
 * firmato con la stessa chiave dei gettoni, nella stessa forma: base64url del
 * JSON `{v: 1, tipo: "revoche", emesso, lic: ["lic_…", …]}`, un punto, e la
 * firma Ed25519. Qui si verifica con la pubblica di `chiave-licenze.js`: chi
 * sta in mezzo non puo' aggiungere una licenza all'elenco, e quindi non puo'
 * chiudere fuori nessuno.
 *
 * ─── Perche' non chiude fuori chi non c'entra ────────────────────────────
 *
 *  - Si guarda il `lic` del gettone, non la casa. Una casa a cui la licenza e'
 *    stata tolta e poi ridata ha un gettone **di un'altra licenza**, che
 *    nell'elenco non c'e'.
 *  - Il quadro nell'elenco mette solo le licenze tolte a una casa che non ne ha
 *    un'altra buona: chi ne ha due e se ne vede togliere una non resta fuori
 *    nelle sei ore che gli servono a farsi dare il gettone dell'altra.
 *  - Se il quadro non risponde, si tiene l'ultimo elenco buono; e un elenco
 *    vecchio di un giorno non vale piu' niente — si torna agli otto giorni di
 *    prima, che e' il modo in cui va oggi. Non si chiude mai **di piu'** per
 *    un quadro che tace.
 *  - Una casa offline non c'entra: da fuori, una casa che non e' collegata
 *    non si apre comunque, e in casa decide il ponte, col suo gettone.
 *
 * Senza `QUADRO_REVOCHE` non si chiede niente, ed e' com'era.
 */

import { createPublicKey, verify } from "node:crypto";

import { chiaveBuona } from "./modo-delle-licenze.js";

/* Ogni quanto si chiede l'elenco. */
export const OGNI_QUANTO = 10 * 60 * 1000;

/* Oltre quanto un elenco non vale piu': si torna agli otto giorni del
 * gettone. */
export const ELENCO_VECCHIO = 24 * 60 * 60 * 1000;

/* Quanto avanti puo' essere l'orologio del quadro. */
const ANTICIPO_TOLLERATO = 10 * 60 * 1000;

/* Quanto si aspetta il quadro, e quanto puo' pesare la sua risposta. */
const ATTESA = 10_000;
const RISPOSTA_MASSIMA = 2 * 1024 * 1024;

/* Quante licenze tolte al massimo, e com'e' fatta una. */
const LICENZE_AL_MASSIMO = 50_000;
const LICENZA = /^lic_[0-9a-f]{16}$/;
const PEZZO = /^[A-Za-z0-9_-]+$/;

/**
 * Cosa dice un elenco firmato, se la firma e' giusta e la forma anche. Torna
 * `{emesso, lic}` oppure `null`. Non guarda l'ora: quello lo fa chi lo tiene.
 */
export function leggiLElenco(firmato, chiave) {
  if (typeof firmato !== "string" || firmato.length > RISPOSTA_MASSIMA) return null;
  if (!chiaveBuona(chiave)) return null;
  const pezzi = firmato.split(".");
  if (pezzi.length !== 2 || !PEZZO.test(pezzi[0]) || !PEZZO.test(pezzi[1])) return null;
  const firma = Buffer.from(pezzi[1], "base64url");
  if (firma.length !== 64) return null;
  let giusta = false;
  try {
    const pubblica = createPublicKey({
      key: { kty: "OKP", crv: "Ed25519", x: String(chiave) },
      format: "jwk",
    });
    giusta = verify(null, Buffer.from(pezzi[0], "ascii"), pubblica, firma);
  } catch (_errore) {
    giusta = false;
  }
  if (!giusta) return null;
  let detto;
  try {
    detto = JSON.parse(Buffer.from(pezzi[0], "base64url").toString("utf8"));
  } catch (_errore) {
    return null;
  }
  /* `tipo` e' quello che lo distingue da un gettone, e un gettone da lui: un
   * gettone non ha `tipo`, e un elenco non ha `sog` ne' `fino`. */
  if (!detto || detto.v !== 1 || detto.tipo !== "revoche") return null;
  if (!Number.isFinite(detto.emesso) || !Array.isArray(detto.lic)) return null;
  if (detto.lic.length > LICENZE_AL_MASSIMO) return null;
  return {
    emesso: detto.emesso,
    lic: detto.lic.filter((una) => typeof una === "string" && LICENZA.test(una)),
  };
}

export class Revoche {
  constructor({
    dove = "",
    chiave = "",
    registro,
    adesso = () => Date.now(),
    ogni = OGNI_QUANTO,
    prendi = (...argomenti) => fetch(...argomenti),
  } = {}) {
    this.dove = String(dove || "");
    this.chiave = String(chiave || "");
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this.ogni = ogni;
    this.prendi = prendi;
    /** Le licenze tolte dell'ultimo elenco buono, e quando l'ha firmato il quadro. */
    this.tolte = new Set();
    this.emesso = 0;
    /** Quando l'ultimo elenco buono e' arrivato qui, per `/salute`. */
    this.arrivatoIl = null;
    this._giro = null;
  }

  /* Se ha senso chiedere: un indirizzo, e una chiave con cui verificare. */
  get accese() {
    return Boolean(this.dove) && chiaveBuona(this.chiave);
  }

  /* L'elenco vale finche' non e' troppo vecchio. Dopo, nessuna licenza e'
   * tolta per il centralino: decide di nuovo solo il gettone. */
  get vale() {
    return this.emesso > 0 && this.adesso() - this.emesso <= ELENCO_VECCHIO;
  }

  /** Se questa licenza e' stata tolta, per quello che si sa adesso. */
  tolta(lic) {
    if (typeof lic !== "string" || !this.vale) return false;
    return this.tolte.has(lic);
  }

  quante() {
    return this.vale ? this.tolte.size : 0;
  }

  /* Prende l'elenco buono, se e' piu' nuovo di quello che c'e'. Torna se lo
   * ha preso. Un elenco piu' vecchio non torna indietro: chi sta in mezzo
   * potrebbe rimandarne uno di ieri, in cui una licenza non c'era ancora. */
  tieni(firmato) {
    const detto = leggiLElenco(firmato, this.chiave);
    if (!detto) {
      this.registro.attenzione("l'elenco delle licenze tolte non ha una firma buona: lo lascio");
      return false;
    }
    const ora = this.adesso();
    if (detto.emesso > ora + ANTICIPO_TOLLERATO || ora - detto.emesso > ELENCO_VECCHIO) {
      this.registro.attenzione("l'elenco delle licenze tolte e' fuori tempo: lo lascio");
      return false;
    }
    if (detto.emesso < this.emesso) return false;
    this.tolte = new Set(detto.lic);
    this.emesso = detto.emesso;
    this.arrivatoIl = ora;
    return true;
  }

  /* Chiede l'elenco una volta. Non solleva mai: un quadro che non risponde
   * non e' un motivo per cambiare niente. */
  async aggiorna() {
    if (!this.accese) return false;
    try {
      const risposta = await this.prendi(this.dove, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(ATTESA),
      });
      if (!risposta.ok) {
        this.registro.attenzione(`il quadro non da' le licenze tolte: ${risposta.status}`);
        return false;
      }
      const testo = await risposta.text();
      if (testo.length > RISPOSTA_MASSIMA) return false;
      const detto = JSON.parse(testo);
      return this.tieni(detto?.elenco);
    } catch (errore) {
      this.registro.attenzione(
        `le licenze tolte non arrivano dal quadro: ${errore?.message || errore}`,
      );
      return false;
    }
  }

  avvia() {
    if (!this.accese || this._giro) return;
    void this.aggiorna();
    this._giro = setInterval(() => void this.aggiorna(), this.ogni);
    this._giro.unref?.();
  }

  ferma() {
    clearInterval(this._giro);
    this._giro = null;
  }
}
