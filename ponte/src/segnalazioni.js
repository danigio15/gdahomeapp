/* Le segnalazioni e la chat, dalla parte del ponte.
 *
 * L'app le scrive e le legge dal ponte, con i comandi `ponte/segnalazioni/…`
 * e `ponte/chat/…`; il ponte le porta al centralino, che e' l'unico che puo'
 * parlare fuori casa per conto di questa casa, e il centralino le porta a
 * GitHub. Qui non c'e' nessun gettone di nessuno: il ponte si presenta al
 * centralino col segreto della casa, lo stesso della chiamata.
 *
 * Il ponte tiene una copia di quello che sa in `/data/segnalazioni.json`:
 * l'elenco, e l'ultimo filo letto di ognuna. Cosi' l'app vede subito
 * qualcosa anche quando il centralino e' lento o giu', e sa cosa e' cambiato
 * dall'ultima volta.
 *
 * Senza centralino — `da_fuori_casa` spento — non c'e' nessun posto dove
 * spedire, e si dice cosi'.
 */

import { join } from "node:path";

import { Archivio } from "./archivio.js";

/* Quanto si aspetta il centralino. */
const ATTESA = 20_000;
/* Un allegato da dieci megabyte, da dentro casa fino al centralino e da li'
 * a GitHub, ci mette il suo tempo. */
const ATTESA_PER_UN_ALLEGATO = 120_000;

/* Lo stesso tetto del centralino: quello che passa di qui e' gia' il file
 * intero. */
export const ALLEGATO_MASSIMO = 10 * 1024 * 1024;

/* Quanto vale l'elenco tenuto qui prima di richiederlo. */
const QUANTO_DURA_LELENCO = 60_000;

export const TIPI = Object.freeze(["problema", "idea", "domanda"]);

export class SenzaCentralino extends Error {
  constructor() {
    super("Questa casa non passa da nessun centralino: le segnalazioni non si possono spedire.");
    this.codice = "senza_centralino";
  }
}

export class CentralinoHaDettoNo extends Error {
  constructor(stato, codice, spiegazione) {
    super(spiegazione || `il centralino ha risposto ${stato}`);
    this.stato = stato;
    this.codice = codice || "centralino";
  }
}

/* Da `wss://centralino…` a `https://centralino…`: lo stesso posto, la porta
 * di fianco. */
export function baseDelCentralino(centralino) {
  const detto = String(centralino || "")
    .trim()
    .replace(/\/+$/, "");
  if (!detto) return "";
  return detto.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
}

export class Segnalazioni {
  constructor({
    identita,
    centralino,
    cartella,
    versione = "",
    registro,
    fetch: prendi = globalThis.fetch,
    adesso = () => Date.now(),
  }) {
    this.identita = identita;
    this.base = baseDelCentralino(centralino);
    this.versione = versione;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.prendi = prendi;
    this.adesso = adesso;
    this.archivio = new Archivio(join(cartella, "segnalazioni.json"), {
      segnalazioni: [],
      fili: {},
      chat: null,
      elencoLettoIl: 0,
    });
  }

  get spedibili() {
    return Boolean(this.base);
  }

  /* L'elenco, con quello che si sa di ognuna. Dal centralino quando e' ora,
   * altrimenti da qui. */
  async elenco({ aggiorna = false } = {}) {
    const dati = this.archivio.dati;
    const vecchio = this.adesso() - (dati.elencoLettoIl || 0) > QUANTO_DURA_LELENCO;
    if (this.spedibili && (aggiorna || vecchio)) {
      try {
        const { segnalazioni } = await this._chiama("GET", "/segnalazioni");
        if (Array.isArray(segnalazioni)) {
          dati.segnalazioni = segnalazioni;
          dati.elencoLettoIl = this.adesso();
          this.archivio.salva();
        }
      } catch (errore) {
        /* Si mostra quello che si ha: e' meglio di niente, e l'app vede
         * `aggiornato_il` e sa che e' vecchio. */
        this.registro.attenzione(`l'elenco delle segnalazioni non si aggiorna: ${errore.message}`);
      }
    }
    return {
      spedibili: this.spedibili,
      aggiornato_il: dati.elencoLettoIl || 0,
      segnalazioni: dati.segnalazioni.map((una) => ({
        ...una,
        messaggi: dati.fili[una.numero]?.messaggi?.length ?? 1,
      })),
    };
  }

  async crea({ tipo, titolo, corpo, diagnostica }) {
    const intero = await this._chiama("POST", "/segnalazioni", {
      tipo: TIPI.includes(tipo) ? tipo : "problema",
      titolo,
      corpo,
      diagnostica: this._diagnostica(diagnostica),
    });
    this._tieni(intero);
    return intero;
  }

  async leggi(numero) {
    const intero = await this._chiama("GET", `/segnalazioni/${Number(numero)}`);
    this._tieni(intero);
    return intero;
  }

  async rispondi(numero, testo) {
    const intero = await this._chiama("POST", `/segnalazioni/${Number(numero)}/risposte`, {
      testo,
    });
    this._tieni(intero);
    return intero;
  }

  /* Un allegato — foto o video — a una segnalazione. Al centralino va cosi'
   * com'e', in binario: e' lui a metterlo nella repository. */
  async allega(numero, { nome, tipo, byte }) {
    const intero = await this._chiamaConUnFile(`/segnalazioni/${Number(numero)}/allegati`, {
      nome,
      tipo,
      byte,
    });
    this._tieni(intero);
    return intero;
  }

  async allegaAllaChat({ nome, tipo, byte }) {
    const chat = await this._chiamaConUnFile("/chat/allegati", { nome, tipo, byte });
    this.archivio.dati.chat = chat;
    this.archivio.salva();
    return chat;
  }

  async chat() {
    const { chat } = await this._chiama("GET", "/chat");
    this.archivio.dati.chat = chat ?? null;
    this.archivio.salva();
    return chat ?? null;
  }

  async chatta(testo, diagnostica) {
    const chat = await this._chiama("POST", "/chat/messaggi", {
      testo,
      diagnostica: this._diagnostica(diagnostica),
    });
    this.archivio.dati.chat = chat;
    this.archivio.salva();
    return chat;
  }

  /* Quello che il ponte sa di se' e che vale la pena far arrivare a chi
   * legge la segnalazione, insieme a quello che dice l'app. */
  _diagnostica(dellApp) {
    const pulita = {};
    for (const [chiave, valore] of Object.entries(dellApp || {})) {
      if (typeof chiave !== "string" || !/^[a-z_]{1,32}$/.test(chiave)) continue;
      if (valore === null || valore === undefined) continue;
      pulita[chiave] = String(valore).slice(0, 200);
    }
    if (this.versione) pulita.ponte = this.versione;
    pulita.node = process.version;
    return pulita;
  }

  _tieni(intero) {
    if (!intero || typeof intero !== "object" || !Number.isFinite(Number(intero.numero))) return;
    const dati = this.archivio.dati;
    const voce = {
      numero: intero.numero,
      tipo: intero.tipo,
      titolo: intero.titolo,
      stato: intero.stato,
      aperta_il: intero.aperta_il,
      url: intero.url,
    };
    const dove = dati.segnalazioni.findIndex((una) => una.numero === intero.numero);
    if (dove >= 0) dati.segnalazioni[dove] = { ...dati.segnalazioni[dove], ...voce };
    else dati.segnalazioni.unshift(voce);
    dati.fili[intero.numero] = intero;
    this.archivio.salva();
  }

  _chiama(metodo, via, corpo) {
    return this._chiamaDavvero(metodo, via, {
      intestazioni: corpo ? { "content-type": "application/json" } : {},
      corpo: corpo ? JSON.stringify(corpo) : undefined,
      attesa: ATTESA,
    });
  }

  _chiamaConUnFile(via, { nome, tipo, byte }) {
    if (!(byte instanceof Uint8Array) || byte.length === 0)
      throw new CentralinoHaDettoNo(400, "manca_il_file", "Manca il file.");
    if (byte.length > ALLEGATO_MASSIMO)
      throw new CentralinoHaDettoNo(
        413,
        "troppo_grande",
        "L'allegato e' troppo grande: al massimo 10 MB.",
      );
    return this._chiamaDavvero("POST", via, {
      intestazioni: {
        "content-type": String(tipo || "application/octet-stream"),
        "x-gdahome-nome": String(nome || "allegato").replace(/[^\x20-\x7e]/g, "_"),
      },
      corpo: byte,
      attesa: ATTESA_PER_UN_ALLEGATO,
    });
  }

  async _chiamaDavvero(metodo, via, { intestazioni, corpo, attesa }) {
    if (!this.spedibili) throw new SenzaCentralino();
    let risposta;
    try {
      risposta = await this.prendi(`${this.base}/casa/${this.identita.casa}${via}`, {
        method: metodo,
        headers: {
          authorization: `Casa ${this.identita.segreto}`,
          ...intestazioni,
        },
        body: corpo,
        signal: AbortSignal.timeout(attesa),
      });
    } catch (errore) {
      throw new CentralinoHaDettoNo(
        0,
        "centralino",
        `il centralino non risponde: ${errore?.message || errore}`,
      );
    }
    let letto = null;
    try {
      letto = await risposta.json();
    } catch (_errore) {
      /* Senza corpo. */
    }
    if (!risposta.ok) {
      throw new CentralinoHaDettoNo(
        risposta.status,
        letto?.errore || "centralino",
        letto?.spiegazione || `il centralino ha risposto ${risposta.status}`,
      );
    }
    return letto ?? {};
  }
}
