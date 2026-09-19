/* I segni degli aggiornamenti: l'icona vera, e le note intere.
 *
 * ─── Perche' esiste ───────────────────────────────────────────────────────
 *
 * Nell'app funziona cosi': il telefono chiede al ponte il logo di un
 * aggiornamento, e il ponte glielo **scarica** — dal Supervisor per un add-on,
 * dai marchi di Home Assistant per un'integrazione — e gli passa i byte. Le
 * note uguale: `update/release_notes`, e si aprono dentro l'app.
 *
 * Nel quadro no, perche' fra il quadro e la casa non c'e' nessun filo su cui
 * chiedere: arriva un rapporto, e basta. Cosi' il rapporto portava una
 * **parola** — `shelly`, `hacs` — e la pagina del cruscotto andava a cercarla
 * su `brands.home-assistant.io`. Il risultato, su una casa vera:
 *
 *     [HACS]  Spook 👻 Your homie Update    v5.1.0 → v5.5.0
 *     [ S ]   Studio Code Server            7.1.0 → 7.1.1
 *     [ S ]   Switch casa                   8194 → 8451
 *
 * Il logo di HACS al posto di quello dell'applicazione — perche' quella parola
 * per un'integrazione installata da HACS **e'** `hacs` — e la lettera dove
 * quella parola non c'e' proprio, che e' il caso di ogni firmware. E «le note
 * per intero» era un collegamento che portava fuori.
 *
 * Adesso e' il ponte a mandare i byte, come fa con l'app: gli stessi byte,
 * dalla stessa strada.
 *
 * ─── Una volta sola, e chi lo dice e' il quadro ───────────────────────────
 *
 * Un'icona pesa qualche decina di kilobyte e le note qualche riga: mandarle a
 * ogni rapporto vorrebbe dire qualche megabyte al giorno per casa, per roba
 * che non cambia mai. Percio' ogni aggiornamento ha un **segno** — quattro
 * byte ricavati dal suo nome e dalla versione a cui va — e il quadro,
 * rispondendo, dice **quali segni non ha**. Il rapporto dopo porta quelli, e
 * nessun altro.
 *
 * E' il quadro a dirlo, non la casa a ricordarselo, e la differenza conta: un
 * quadro che perde i suoi file li richiede da se', e una casa che si riavvia
 * non rimanda niente che sia gia' arrivato.
 *
 * ─── Cosa non passa di qui ────────────────────────────────────────────────
 *
 * L'entita'. `update.camera_di_marco_termostato` direbbe chi abita in quella
 * casa e in quale stanza; il segno e' un'impronta di quello che nel rapporto
 * c'e' gia' — il nome dell'applicazione e la versione — e non aggiunge niente
 * a quello che il quadro sa gia'.
 */

import { createHash } from "node:crypto";

/** Quanto puo' pesare un'icona per essere mandata. Le vere stanno molto sotto. */
export const UN_SEGNO_AL_MASSIMO = 24 * 1024;

/**
 * E quanto ne possono pesare in tutto in un rapporto solo, **contati come
 * viaggiano**: in base64, cioe' un terzo piu' dei byte veri.
 *
 * Il numero non e' scelto qui: e' scelto dal quadro, che i rapporti troppo
 * grossi li rifiuta con un 413 (`RAPPORTO_MASSIMA` in `quadro/src/server.js`).
 * E un rapporto rifiutato non e' un'icona che salta — e' **tutto** il
 * rapporto che salta, e siccome la casa si tiene l'elenco di quello che le e'
 * stato chiesto, al minuto dopo rimanda lo stesso pacco troppo grosso e si
 * becca lo stesso 413. Quella casa smetterebbe di dire come sta, per sempre,
 * per un'icona.
 *
 * Prima qui c'erano 192 KiB contati sui byte veri: in base64 fanno 256, e il
 * quadro ne accettava 64 in tutto. Bastava **un'icona sola** un po' grossa.
 *
 * Adesso i due numeri si tengono per mano, e una prova per parte li tiene
 * fermi: qui sotto ci deve stare il rapporto intero, non solo le icone.
 */
export const IN_TUTTO_AL_MASSIMO = 96 * 1024;

/** Quanto testo di note si manda. Un CHANGELOG intero non ci sta e non serve. */
export const NOTE_AL_MASSIMO = 8 * 1024;

/** Quanto si aspetta un'icona. Non e' roba urgente: al giro dopo si riprova. */
const ATTESA = 10_000;

/**
 * «Un'icona non c'e' proprio», che e' un'altra cosa da «non e' arrivata».
 *
 * La prima e' definitiva — un firmware non ha un logo da nessuna parte — e si
 * dice al quadro, che smette di chiederla. La seconda e' di oggi — la rete, un
 * 403, il Supervisor che dorme — e si tace, cosi' al giro dopo si riprova.
 */
const NON_CE_NE = Symbol("non ce n'e'");

/* Da dove si accetta di scaricare un'icona che non sia del Supervisor.
 *
 * Un host solo, scritto qui. L'indirizzo lo dichiara l'entita', cioe' lo
 * scrive un'integrazione — e un'integrazione e' codice che qualcuno ha
 * installato in casa, non per forza codice di cui ci si fida. Senza questa
 * riga, `entity_picture` sarebbe un modo di far bussare questa casa dove uno
 * vuole. */
const I_MARCHI = "https://brands.home-assistant.io/";

const LE_RAZZE = [
  { tipo: "image/png", segno: [0x89, 0x50, 0x4e, 0x47] },
  { tipo: "image/jpeg", segno: [0xff, 0xd8, 0xff] },
  { tipo: "image/webp", segno: [0x52, 0x49, 0x46, 0x46] },
];

/**
 * Il segno di un aggiornamento: quattro byte, dal nome e dalla versione.
 *
 * Deve venire uguale da tutt'e due le parti e per tutte le case: due case che
 * aspettano lo stesso aggiornamento di Mosquitto fanno lo stesso segno, e il
 * quadro tiene un'icona sola invece di quaranta copie.
 */
export function ilSegnoDi(nome, a) {
  const chi = `${String(nome ?? "").trim()}\n${String(a ?? "").trim()}`;
  if (chi.length < 2) return "";
  return createHash("sha256").update(chi, "utf8").digest("hex").slice(0, 16);
}

/** Che immagine e' questa, guardando come comincia. */
export function cheImmagineE(byte) {
  if (!Buffer.isBuffer(byte) || byte.length < 4 || byte.length > UN_SEGNO_AL_MASSIMO) return null;
  for (const una of LE_RAZZE) {
    if (una.segno.every((quanto, dove) => byte[dove] === quanto)) return una.tipo;
  }
  const testa = byte.subarray(0, 512).toString("utf8").trimStart();
  if (/^<(\?xml|!--|svg)[\s>]/i.test(testa) && /<svg[\s>]/i.test(testa)) return "image/svg+xml";
  return null;
}

export class Segni {
  constructor({
    aggiornamenti = null,
    casa = null,
    supervisor = process.env.PONTE_SUPERVISOR || "http://supervisor",
    segno = process.env.SUPERVISOR_TOKEN || "",
    fetch: prendi = globalThis.fetch,
    registro = null,
  } = {}) {
    this.aggiornamenti = aggiornamenti;
    this.casa = casa;
    this.supervisor = String(supervisor || "").replace(/\/+$/, "");
    this.segno = String(segno || "");
    this.prendi = prendi;
    this.registro = registro ?? { debug() {}, info() {}, attenzione() {}, errore() {} };
  }

  /**
   * Quello che il quadro ha chiesto, per gli aggiornamenti che ci sono adesso.
   *
   * @param {string[]} manca i segni che il quadro non ha
   * @param {Array} elenco gli aggiornamenti come li ha dati `Aggiornamenti`
   * @returns {Promise<Map<string, {logo?: string, logoTipo?: string, leNote?: string,
   *          senzaLogo?: boolean, senzaNote?: boolean}>>}
   */
  async quelliCheMancano(manca, elenco) {
    const chiesti = new Set((Array.isArray(manca) ? manca : []).map((uno) => String(uno)));
    const fatti = new Map();
    if (!chiesti.size || !Array.isArray(elenco)) return fatti;
    let quanto = 0;
    for (const uno of elenco) {
      const quale = ilSegnoDi(uno?.nome, uno?.a);
      if (!quale || !chiesti.has(quale) || fatti.has(quale)) continue;
      const suo = {};
      /* L'icona per prima: e' quella che si vede. Se il tetto e' finito si
       * lascia agli altri, e il quadro la richiede al giro dopo. */
      if (quanto < IN_TUTTO_AL_MASSIMO) {
        const preso = await this._ilLogo(uno?.entita);
        if (preso === NON_CE_NE) {
          /* Un firmware non ha nessuna icona da nessuna parte. Dirlo e' meglio
           * che tacere: il quadro se lo segna e smette di chiederla, invece di
           * ridomandarla a ogni rapporto per sempre. */
          suo.senzaLogo = true;
        } else if (preso) {
          suo.logo = preso.byte.toString("base64");
          suo.logoTipo = preso.tipo;
          quanto += suo.logo.length;
        }
        /* E se `preso` e' `null` non si dice niente: quello e' uno scarico
         * andato storto — la rete, un 403, il Supervisor che dorme — e al
         * giro dopo si riprova. «Non ce l'ho adesso» e «non esiste» sono due
         * cose diverse, e confonderle vuol dire o richiedere per sempre o
         * rinunciare per sempre. */
      }
      const note = await this._leNote(uno?.entita);
      if (note) {
        /* `leNote` e non `note`: nella riga del rapporto `note` c'e' gia', ed
         * e' **l'indirizzo** delle note sul sito di chi le ha scritte. Queste
         * sono il testo, che e' un'altra cosa — e chiamarle uguale voleva dire
         * che una delle due si mangiava l'altra senza che nessuno se ne
         * accorgesse. */
        suo.leNote = note;
        quanto += note.length;
      } else {
        /* Anche qui: chi non sa dare le note non ne ha, e `_leNote` non
         * distingue il vuoto dal guasto perche' per le note **non c'e'**
         * guasto — si leggono dall'entita' che e' gia' in mano. */
        suo.senzaNote = true;
      }
      fatti.set(quale, suo);
    }
    return fatti;
  }

  /* I byte dell'icona; `null` se non e' arrivata, `NON_CE_NE` se non esiste.
   * Non solleva mai: un'icona che non arriva e' una riga con la lettera, e va
   * molto meglio di un rapporto che non parte. */
  async _ilLogo(entita) {
    if (!entita || !this.aggiornamenti) return NON_CE_NE;
    let dove = "";
    try {
      dove = await this.aggiornamenti.doveIlLogo(entita);
    } catch (_errore) {
      return null;
    }
    /* Nessun indirizzo: quell'aggiornamento un'icona non ce l'ha. */
    if (!dove) return NON_CE_NE;
    /* L'icona di un add-on si chiede **al Supervisor**, non a Home Assistant:
     * la' quella strada e' un proxy con le sue regole di permesso, e in una
     * casa vera ha risposto 403 per l'icona di un add-on di un altro. Il
     * segno che abbiamo e' quello del Supervisor. */
    const dellAddon = /^\/api\/hassio\/(addons\/[^/]+\/(?:icon|logo))$/.exec(dove);
    if (dellAddon) {
      if (!this.supervisor || !this.segno) return NON_CE_NE;
      return this._scarica(`${this.supervisor}/${dellAddon[1]}`, {
        authorization: `Bearer ${this.segno}`,
      });
    }
    /* Un indirizzo di casa che non sia del Supervisor non si sa chiedere da
     * qui — per quello ci vuole il segno di chi ha fatto la domanda — e non si
     * inventa: resta la lettera. */
    if (dove.startsWith("/")) return NON_CE_NE;
    if (!dove.startsWith(I_MARCHI)) return NON_CE_NE;
    return this._scarica(dove, {});
  }

  async _scarica(url, intestazioni) {
    try {
      const risposta = await this.prendi(url, {
        headers: { ...intestazioni, "accept-encoding": "identity" },
        signal: AbortSignal.timeout(ATTESA),
      });
      if (!risposta.ok) return null;
      const byte = Buffer.from(await risposta.arrayBuffer());
      const tipo = cheImmagineE(byte);
      return tipo ? { byte, tipo } : null;
    } catch (errore) {
      this.registro.debug(`il segno da ${url}: ${errore?.message || errore}`);
      return null;
    }
  }

  /* Le note intere, come le da' Home Assistant. */
  async _leNote(entita) {
    if (!entita || !this.aggiornamenti) return "";
    try {
      const dette = await this.aggiornamenti.note(entita);
      return String(dette?.note ?? "")
        .trim()
        .slice(0, NOTE_AL_MASSIMO);
    } catch (_errore) {
      /* Chi non sa dare le note non ne ha: e' un caso normale, non un guasto. */
      return "";
    }
  }
}
