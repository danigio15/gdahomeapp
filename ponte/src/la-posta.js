/* La posta: un lettore IMAP piccolo, per le bollette e per nient'altro.
 *
 * Il ponte non porta librerie: questo e' il minimo di IMAP4rev1 (RFC 3501)
 * che serve a leggere le mail delle bollette, scritto su `node:tls`. Entra
 * con la password per app (mai quella vera dell'account), apre la posta in
 * arrivo in sola lettura, cerca, legge, esce. Non scrive, non sposta, non
 * segna come lette: `EXAMINE` invece di `SELECT`, e `BODY.PEEK` invece di
 * `BODY`.
 *
 * La password non finisce mai nei registri: i comandi si scrivono nel
 * registro solo per nome, e il LOGIN non si scrive affatto.
 */

import { connect } from "node:tls";

export class ErroreDellaPosta extends Error {
  constructor(codice, messaggio) {
    super(messaggio || codice);
    this.codice = codice;
  }
}

/* Una stringa IMAP fra virgolette, con le virgolette e le barre protette. */
export function tra(testo) {
  return `"${String(testo ?? "").replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

/**
 * Le risposte di un comando, dal flusso di byte: righe e letterali `{n}`.
 *
 * Si tiene il buffer intero finche' non arriva la riga col tag del comando;
 * i letterali (il messaggio intero, in FETCH) si leggono per lunghezza e non
 * per riga, perche' dentro un messaggio di righe ce ne sono quante si vuole.
 */
export class LettoreDiRisposte {
  constructor() {
    this.buffer = Buffer.alloc(0);
  }

  aggiungi(pezzo) {
    this.buffer = Buffer.concat([this.buffer, pezzo]);
  }

  /* Una risposta intera (una riga col suo eventuale letterale), o `null`. */
  prossima() {
    let dove = 0;
    const parti = [];
    const letterali = [];
    for (;;) {
      const acapo = this.buffer.indexOf("\r\n", dove);
      if (acapo < 0) return null;
      const riga = this.buffer.subarray(dove, acapo).toString("latin1");
      parti.push(riga);
      const letterale = /\{(\d+)\}$/.exec(riga);
      if (!letterale) {
        this.buffer = this.buffer.subarray(acapo + 2);
        return { riga: parti.join(" "), letterali };
      }
      const quanti = Number(letterale[1]);
      const inizio = acapo + 2;
      if (this.buffer.length < inizio + quanti) return null;
      letterali.push(this.buffer.subarray(inizio, inizio + quanti));
      dove = inizio + quanti;
    }
  }
}

/**
 * Una sessione IMAP. `presa` e' per le prove: un oggetto con `write`, `on`,
 * `end`, `destroy` come un socket.
 */
export class Posta {
  constructor({
    host = "imap.gmail.com",
    porta = 993,
    attesa = 30_000,
    presa = null,
    registro = null,
  } = {}) {
    this.host = host;
    this.porta = porta;
    this.attesa = attesa;
    this._presa = presa;
    this.registro = registro ?? { info() {} };
    this._lettore = new LettoreDiRisposte();
    this._prossimoTag = 1;
    this._inAttesa = null;
    this._raccolte = [];
  }

  async apri() {
    const presa =
      this._presa ||
      connect({ host: this.host, port: this.porta, servername: this.host, minVersion: "TLSv1.2" });
    this._presa = presa;
    presa.on("data", (pezzo) => this._dati(pezzo));
    presa.on("error", (errore) => this._fallisci(new ErroreDellaPosta("rete", errore.message)));
    presa.on("close", () => this._fallisci(new ErroreDellaPosta("rete", "la posta ha chiuso")));
    /* Il saluto del server: «* OK …». */
    await this._aspetta(null);
  }

  _dati(pezzo) {
    this._lettore.aggiungi(pezzo);
    for (let r = this._lettore.prossima(); r; r = this._lettore.prossima()) {
      const attesa = this._inAttesa;
      if (!attesa) continue;
      if (attesa.tag === null && r.riga.startsWith("* ")) {
        this._inAttesa = null;
        clearTimeout(attesa.timer);
        if (/^\* (OK|PREAUTH)/i.test(r.riga)) attesa.risolvi([r]);
        else attesa.rifiuta(new ErroreDellaPosta("rete", "la posta non ha salutato"));
        continue;
      }
      if (attesa.tag && r.riga.startsWith(`${attesa.tag} `)) {
        this._inAttesa = null;
        clearTimeout(attesa.timer);
        const raccolte = this._raccolte;
        this._raccolte = [];
        if (/^\S+ OK/i.test(r.riga)) attesa.risolvi(raccolte);
        else {
          const detto = r.riga.replace(/^\S+ (NO|BAD)\s*/i, "");
          const codice = /AUTHENTICATIONFAILED|invalid credentials|LOGIN failed/i.test(detto)
            ? "accesso"
            : "posta";
          attesa.rifiuta(new ErroreDellaPosta(codice, detto));
        }
        continue;
      }
      this._raccolte.push(r);
    }
  }

  _fallisci(errore) {
    const attesa = this._inAttesa;
    if (!attesa) return;
    this._inAttesa = null;
    clearTimeout(attesa.timer);
    attesa.rifiuta(errore);
  }

  _aspetta(tag) {
    return new Promise((risolvi, rifiuta) => {
      const timer = setTimeout(
        () => this._fallisci(new ErroreDellaPosta("tempo", "la posta non risponde")),
        this.attesa,
      );
      this._inAttesa = { tag, risolvi, rifiuta, timer };
    });
  }

  /* Un comando, e le sue risposte non etichettate. `nome` va nel registro al
   * posto del comando: il LOGIN porta la password, e non si scrive. */
  async comando(testo, nome = testo.split(" ")[0]) {
    const tag = `G${this._prossimoTag++}`;
    const risposta = this._aspetta(tag);
    this._presa.write(`${tag} ${testo}\r\n`);
    this.registro.info?.(`posta: ${nome}`);
    return risposta;
  }

  async entra(utente, password) {
    await this.comando(`LOGIN ${tra(utente)} ${tra(password)}`, "LOGIN");
  }

  /* In sola lettura: niente viene segnato come letto. */
  async apriLaCartella(cartella = "INBOX") {
    await this.comando(`EXAMINE ${tra(cartella)}`, "EXAMINE");
  }

  /**
   * Gli UID che rispondono alla ricerca. Su Gmail `X-GM-RAW` prende la stessa
   * ricerca della casella di Gmail («from:enel.it newer_than:2y»); altrove si
   * cerca col FROM di IMAP.
   */
  async cerca({ gmail = "", da = [] } = {}) {
    const comandi = gmail
      ? [`UID SEARCH X-GM-RAW ${tra(gmail)}`]
      : da.map((mittente) => `UID SEARCH FROM ${tra(mittente)}`);
    const uid = new Set();
    for (const c of comandi) {
      for (const r of await this.comando(c, "SEARCH")) {
        const trovati = /^\* SEARCH\s*(.*)$/i.exec(r.riga);
        if (!trovati) continue;
        for (const n of trovati[1].split(/\s+/)) if (/^\d+$/.test(n)) uid.add(Number(n));
      }
    }
    return [...uid].sort((a, b) => a - b);
  }

  /* I messaggi interi, senza segnarli come letti. */
  async leggi(uid = []) {
    if (!uid.length) return [];
    const fuori = [];
    for (const r of await this.comando(`UID FETCH ${uid.join(",")} (BODY.PEEK[])`, "FETCH")) {
      if (/^\* \d+ FETCH/i.test(r.riga) && r.letterali.length) fuori.push(r.letterali[0]);
    }
    return fuori;
  }

  async esci() {
    try {
      await this.comando("LOGOUT");
    } catch (_errore) {
      /* Il server chiude da solo dopo il LOGOUT: e' quello che si voleva. */
    }
    this._presa?.end?.();
    this._presa?.destroy?.();
  }
}
