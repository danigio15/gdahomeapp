/* «Aggiorna l'app»: la casa avvisa i telefoni rimasti indietro.
 *
 * «Ipotizza una notifica: quando è disponibile la nuova versione sugli store,
 * avvisare di aggiornare l'app.»
 *
 * ─── Da dove viene la versione nuova ─────────────────────────────────────
 *
 * Dal quadro: chi lo tiene scrive nella Gestione › Abbonamenti, negozio per
 * negozio, la build che e' davvero uscita (`quadro/src/ultime-dell-app.js`).
 * Qui si chiede ogni sei ore, come la versione minima:
 *
 *     GET <quadro>/v1/app/ultime   →   {"ultime": "<pezzo>.<firma>"}
 *
 * firmato con la chiave delle licenze, e verificato con la stessa pubblica
 * dei gettoni (`chiave-licenze.js`): chi sta in mezzo non puo' far arrivare
 * «aggiorna l'app» per una versione che non c'e'. Un elenco piu' vecchio di
 * quello che si ha non lo sostituisce. E' una GET nuda: non porta niente
 * della casa.
 *
 * ─── Chi si avvisa ───────────────────────────────────────────────────────
 *
 * Ogni telefono abbinato dice alla casa il suo sistema (iOS o Android, cioe'
 * il suo negozio) e il numero di costruzione dell'app (`chi-sono`,
 * `dispositivi.js`). Si avvisa chi ha un numero piu' piccolo dell'ultima del
 * **suo** negozio — una build gia' su Google Play e ancora in revisione da
 * Apple non fa avvisare gli iPhone.
 *
 * Una volta per versione: chi e' stato avvisato della 1180801 non lo e' piu'
 * per la stessa, nemmeno dopo un riavvio (`/data/ultime-dell-app.json`), e lo
 * sara' di nuovo solo per una piu' nuova. Una notifica che non e' partita —
 * le ore di silenzio, le notifiche spente, il telefono senza gettone — si
 * riprova al giro dopo, ogni ora.
 *
 * Le app di prima non dicono il numero di costruzione: non si avvisano.
 * Senza un numero non si sa se sono indietro.
 */

import { createPublicKey, verify } from "node:crypto";
import { join } from "node:path";

import { Archivio } from "./archivio.js";

/* Dove si chiede, se nessuno dice altro: il quadro vero. */
export const ULTIME_DI_SERIE = "https://quadro.gdahome.org/v1/app/ultime";

/* Ogni quanto si chiede la versione, e ogni quanto si guardano i telefoni. */
export const OGNI = 6 * 60 * 60 * 1000;
export const OGNI_GIRO = 60 * 60 * 1000;

const ATTESA = 10_000;
const RISPOSTA_MASSIMA = 8 * 1024;
const PEZZO = /^[A-Za-z0-9_-]+$/;
const VERSIONE = /^\d{1,4}(\.\d{1,4}){0,3}([+-][0-9A-Za-z.]{1,16})?$/;

/** I negozi, e da quale sistema si capisce. */
export const NEGOZIO_DEL_SISTEMA = Object.freeze({ ios: "apple", android: "google" });

/** Dove si aggiorna l'app, per chi legge la notifica. */
const NOME_DEL_NEGOZIO = Object.freeze({
  apple: { it: "App Store", en: "the App Store" },
  google: { it: "Google Play", en: "Google Play" },
});

const costruzioneDi = (detta) => {
  const numero = typeof detta === "string" && /^\d{1,10}$/.test(detta) ? Number(detta) : detta;
  return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
};

/**
 * Quello che dice un elenco firmato, se la firma e' giusta e la forma anche:
 * `{emesso, apple?, google?}` con `{costruzione, versione}`, o `null`.
 */
export function leggiLeUltime(firmato, chiave) {
  if (typeof firmato !== "string" || firmato.length > RISPOSTA_MASSIMA || !chiave) return null;
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
  /* `tipo` lo distingue da un gettone e dall'elenco delle revoche, firmati
   * con la stessa chiave. */
  if (!detto || detto.v !== 1 || detto.tipo !== "ultime" || !Number.isFinite(detto.emesso))
    return null;
  const fuori = { emesso: detto.emesso };
  for (const negozio of ["apple", "google"]) {
    const costruzione = costruzioneDi(detto[negozio]?.costruzione);
    if (!costruzione) continue;
    const versione = String(detto[negozio]?.versione ?? "");
    fuori[negozio] = { costruzione, versione: VERSIONE.test(versione) ? versione : "" };
  }
  return fuori;
}

/** Le parole della notifica, nelle due lingue. */
export function paroleDellAggiornamento({ negozio, versione }) {
  const dove = NOME_DEL_NEGOZIO[negozio] || NOME_DEL_NEGOZIO.google;
  const quale = versione ? ` ${versione}` : "";
  return {
    it: {
      titolo: `⬆️ GdAHome${quale} è disponibile`,
      testo: `C'è una nuova versione dell'app su ${dove.it}. Aggiornala per avere le ultime novità e correzioni.`,
    },
    en: {
      titolo: `⬆️ GdAHome${quale} is available`,
      testo: `A new version of the app is on ${dove.en}. Update it to get the latest features and fixes.`,
    },
  };
}

export class UltimeDellApp {
  constructor({
    dove = ULTIME_DI_SERIE,
    chiave = "",
    cartella = "",
    dispositivi = null,
    notifiche = null,
    fetch: prendi = globalThis.fetch,
    ogni = OGNI,
    ogniGiro = OGNI_GIRO,
    registro,
  } = {}) {
    this.dove = String(dove || "");
    this.chiave = String(chiave || "");
    this.dispositivi = dispositivi;
    this.notifiche = notifiche;
    this.prendi = prendi;
    this.ogni = ogni;
    this.ogniGiro = ogniGiro;
    this.registro = registro ?? { debug() {}, info() {}, attenzione() {}, errore() {} };
    this._memoria = cartella
      ? new Archivio(join(String(cartella), "ultime-dell-app.json"), { ultime: null, avvisati: {} })
      : { dati: { ultime: null, avvisati: {} }, salva() {} };
    this._orologi = [];
    this._inCorso = null;
    this._giro = null;
  }

  /** L'ultimo elenco buono: `{emesso, apple?, google?}` o `null`. */
  get ultime() {
    return this._memoria.dati.ultime ?? null;
  }

  parti() {
    if (this._orologi.length) return;
    if (this.dove) {
      void this.chiedi();
      this._orologi.push(setInterval(() => void this.chiedi(), this.ogni));
    }
    this._orologi.push(setInterval(() => void this.avvisa(), this.ogniGiro));
    for (const uno of this._orologi) uno.unref?.();
  }

  ferma() {
    for (const uno of this._orologi) clearInterval(uno);
    this._orologi = [];
  }

  /** Chiede le ultime al quadro e, se ce n'e' una nuova, avvisa. Non solleva. */
  async chiedi() {
    if (!this.dove) return this.ultime;
    if (this._inCorso) return this._inCorso;
    this._inCorso = (async () => {
      try {
        const risposta = await this.prendi(this.dove, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(ATTESA),
        });
        if (!risposta.ok) throw new Error(`il quadro ha risposto ${risposta.status}`);
        const detto = await risposta.json();
        const lette = leggiLeUltime(detto?.ultime, this.chiave);
        if (!lette) throw new Error("l'elenco non e' firmato giusto");
        if (lette.emesso >= (this.ultime?.emesso ?? 0)) {
          this._memoria.dati.ultime = lette;
          this._memoria.salva();
        }
      } catch (errore) {
        this.registro.debug?.(`le ultime dell'app non arrivano: ${errore?.message || errore}`);
      } finally {
        this._inCorso = null;
      }
      await this.avvisa();
      return this.ultime;
    })();
    return this._inCorso;
  }

  /**
   * Chi va avvisato adesso: `[{id, negozio, costruzione, versione}]`, i
   * telefoni con una build piu' vecchia dell'ultima del loro negozio e non
   * ancora avvisati per quella.
   */
  daAvvisare() {
    const ultime = this.ultime;
    if (!ultime) return [];
    const avvisati = this._memoria.dati.avvisati || {};
    const fuori = [];
    for (const uno of this.dispositivi?.elenco?.() || []) {
      const negozio = NEGOZIO_DEL_SISTEMA[String(uno.sistema || "").toLowerCase()];
      const ultima = negozio && ultime[negozio];
      const sua = costruzioneDi(uno.costruzione);
      if (!ultima || !sua || sua >= ultima.costruzione) continue;
      if (avvisati[uno.id] >= ultima.costruzione) continue;
      fuori.push({ id: uno.id, negozio, ...ultima });
    }
    return fuori;
  }

  /** Avvisa chi va avvisato. Torna quanti telefoni l'hanno avuta. */
  async avvisa() {
    if (this._giro) return this._giro;
    this._giro = (async () => {
      let quanti = 0;
      try {
        const vivi = new Set((this.dispositivi?.elenco?.() || []).map((uno) => uno.id));
        const avvisati = (this._memoria.dati.avvisati ||= {});
        /* Chi non c'e' piu' non si ricorda. */
        for (const id of Object.keys(avvisati)) if (!vivi.has(id)) delete avvisati[id];
        for (const uno of this.daAvvisare()) {
          const partita = await this.notifiche?.consegna?.(
            {
              tipo: "aggiorna_app",
              categoria: "manutenzione",
              chiave: `aggiorna_app|${uno.costruzione}`,
              negozio: uno.negozio,
              parole: paroleDellAggiornamento(uno),
            },
            { soloA: uno.id },
          );
          if (partita > 0) {
            avvisati[uno.id] = uno.costruzione;
            quanti += 1;
          }
        }
        this._memoria.salva();
        if (quanti) this.registro.info(`«aggiorna l'app» a ${quanti} telefoni`);
      } catch (errore) {
        this.registro.attenzione(`«aggiorna l'app» non parte: ${errore?.message || errore}`);
      } finally {
        this._giro = null;
      }
      return quanti;
    })();
    return this._giro;
  }
}
