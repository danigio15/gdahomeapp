/* La presa: un server WebSocket scritto qui dentro.
 *
 * Il ponte non ha dipendenze npm, e questo e' il motivo per cui puo'
 * permetterselo. Node porta con se' un WebSocket *cliente*, che al ponte serve
 * per bussare a Home Assistant; il lato *server* — quello su cui bussa l'app —
 * in Node non c'e', e sono le duecento righe qui sotto.
 *
 * Il protocollo sta nella RFC 6455. Le tre cose che contano davvero:
 *
 *  - la stretta di mano e' un SHA-1 della chiave del cliente incollata a un
 *    GUID fisso, e non e' una difesa: serve solo a non scambiare per WebSocket
 *    una richiesta HTTP finita li' per sbaglio;
 *  - ogni telaio che arriva DAL cliente e' mascherato, e quello che parte
 *    verso il cliente non lo e' mai. Un telaio non mascherato in arrivo non e'
 *    un cliente distratto: e' il segno di qualcuno che sta parlando con un
 *    proxy in mezzo, e si chiude;
 *  - un messaggio puo' arrivare a pezzi, e i pezzi possono avere in mezzo un
 *    ping. Chi tratta ogni telaio come un messaggio funziona finche' non
 *    incontra un messaggio lungo.
 */

import { createHash } from "node:crypto";

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const TIPO = Object.freeze({
  seguito: 0x0,
  testo: 0x1,
  binario: 0x2,
  chiusura: 0x8,
  ping: 0x9,
  pong: 0xa,
});

/* I motivi di chiusura che questo server usa davvero. */
export const CHIUSURA = Object.freeze({
  normale: 1000,
  protocollo: 1002,
  troppoGrande: 1009,
  guasto: 1011,
});

/* Un messaggio piu' lungo di cosi' non e' un comando a Home Assistant. Il
 * limite serve prima di tutto contro chi annuncia due gigabyte di carico utile
 * per farli mettere da parte in memoria. */
const MESSAGGIO_MASSIMO = 1024 * 1024;

/* ─── La stretta di mano ─────────────────────────────────────────────────── */

export function eUnaSalita(richiesta) {
  const salita = String(richiesta.headers.upgrade || "").toLowerCase();
  return salita === "websocket" && String(richiesta.method || "").toUpperCase() === "GET";
}

export function firmaDellaChiave(chiave) {
  return createHash("sha1")
    .update(String(chiave || "") + GUID)
    .digest("base64");
}

/* Risponde 101 e restituisce la presa, oppure chiude e restituisce `null`. */
export function accetta(richiesta, socket, opzioni = {}) {
  const chiave = richiesta.headers["sec-websocket-key"];
  const versione = String(richiesta.headers["sec-websocket-version"] || "");
  if (!chiave || versione !== "13") {
    socket.end("HTTP/1.1 400 Bad Request\r\nsec-websocket-version: 13\r\n\r\n");
    return null;
  }
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "upgrade: websocket\r\n" +
      "connection: Upgrade\r\n" +
      `sec-websocket-accept: ${firmaDellaChiave(chiave)}\r\n\r\n`,
  );
  return new Presa(socket, opzioni);
}

/* ─── I telai ────────────────────────────────────────────────────────────── */

export function telaio(tipo, carico) {
  const dati = Buffer.isBuffer(carico) ? carico : Buffer.from(String(carico ?? ""), "utf8");
  let testa;
  if (dati.length < 126) {
    testa = Buffer.alloc(2);
    testa[1] = dati.length;
  } else if (dati.length < 65536) {
    testa = Buffer.alloc(4);
    testa[1] = 126;
    testa.writeUInt16BE(dati.length, 2);
  } else {
    testa = Buffer.alloc(10);
    testa[1] = 127;
    testa.writeBigUInt64BE(BigInt(dati.length), 2);
  }
  /* Il bit alto e' FIN: questo server non spezza mai quello che manda. Il bit
   * della maschera resta a zero, e deve restare a zero. */
  testa[0] = 0x80 | tipo;
  return Buffer.concat([testa, dati]);
}

/* Stacca un telaio dalla testa del buffer.
 *
 * Torna `null` quando i byte non bastano ancora — che e' la condizione
 * normale, non un errore: un messaggio lungo arriva in piu' pezzi di rete e
 * quasi mai allineato ai telai. */
export function staccaIlTelaio(buffer, massimo = MESSAGGIO_MASSIMO) {
  if (buffer.length < 2) return null;
  const primo = buffer[0];
  const secondo = buffer[1];

  if (primo & 0x70) throw new ErroreDiProtocollo("bit riservati accesi");

  const tipo = primo & 0x0f;
  const finito = (primo & 0x80) !== 0;
  const mascherato = (secondo & 0x80) !== 0;
  let lunghezza = secondo & 0x7f;
  let inizio = 2;

  if (lunghezza === 126) {
    if (buffer.length < 4) return null;
    lunghezza = buffer.readUInt16BE(2);
    inizio = 4;
  } else if (lunghezza === 127) {
    if (buffer.length < 10) return null;
    const grande = buffer.readBigUInt64BE(2);
    if (grande > BigInt(massimo)) throw new ErroreDiCarico("telaio troppo grande");
    lunghezza = Number(grande);
    inizio = 10;
  }
  if (lunghezza > massimo) throw new ErroreDiCarico("telaio troppo grande");

  /* Un telaio di servizio — ping, pong, chiusura — non si spezza e non supera
   * i 125 byte. Chi lo spezza non sta parlando WebSocket. */
  if (tipo >= 0x8 && (!finito || lunghezza > 125))
    throw new ErroreDiProtocollo("telaio di servizio malformato");

  if (!mascherato) throw new ErroreDiProtocollo("telaio in arrivo senza maschera");

  const finaMaschera = inizio + 4;
  if (buffer.length < finaMaschera + lunghezza) return null;
  const maschera = buffer.subarray(inizio, finaMaschera);
  const carico = Buffer.from(buffer.subarray(finaMaschera, finaMaschera + lunghezza));
  for (let i = 0; i < carico.length; i += 1) carico[i] ^= maschera[i & 3];

  return { tipo, finito, carico, consumati: finaMaschera + lunghezza };
}

export class ErroreDiProtocollo extends Error {}
export class ErroreDiCarico extends Error {}

/* ─── La presa ───────────────────────────────────────────────────────────── */

export class Presa {
  constructor(socket, { onMessaggio, onChiusa, messaggioMassimo = MESSAGGIO_MASSIMO } = {}) {
    this.socket = socket;
    this.onMessaggio = onMessaggio || (() => {});
    this.onChiusa = onChiusa || (() => {});
    this.massimo = messaggioMassimo;
    this.viva = true;
    this.hoRisposto = false;

    this._avanzo = Buffer.alloc(0);
    this._pezzi = [];
    this._tipoInCorso = null;
    this._lunghezzaInCorso = 0;

    socket.on("data", (pezzo) => this._arrivano(pezzo));
    socket.on("close", () => this._finita());
    socket.on("error", () => this._finita());
    socket.setTimeout(0);
    socket.setNoDelay(true);
  }

  manda(testo) {
    if (!this.viva) return false;
    try {
      this.socket.write(telaio(TIPO.testo, testo));
      return true;
    } catch (_errore) {
      /* Scrivere su una presa gia' caduta non e' un guasto del ponte. */
      this._finita();
      return false;
    }
  }

  ping() {
    if (!this.viva) return;
    try {
      this.socket.write(telaio(TIPO.ping, Buffer.alloc(0)));
    } catch (_errore) {
      this._finita();
    }
  }

  chiudi(codice = CHIUSURA.normale, motivo = "") {
    if (!this.viva) return;
    this.viva = false;
    try {
      const testo = Buffer.from(String(motivo).slice(0, 120), "utf8");
      const carico = Buffer.alloc(2 + testo.length);
      carico.writeUInt16BE(codice, 0);
      testo.copy(carico, 2);
      this.socket.write(telaio(TIPO.chiusura, carico));
    } catch (_errore) {
      /* Se non si riesce nemmeno a dire addio, si stacca e basta. */
    }
    this.socket.end();
    this._avvisa();
  }

  _arrivano(pezzo) {
    if (!this.viva) return;
    this._avanzo = this._avanzo.length ? Buffer.concat([this._avanzo, pezzo]) : pezzo;
    for (;;) {
      let telaioLetto;
      try {
        telaioLetto = staccaIlTelaio(this._avanzo, this.massimo);
      } catch (errore) {
        this.chiudi(
          errore instanceof ErroreDiCarico ? CHIUSURA.troppoGrande : CHIUSURA.protocollo,
          errore.message,
        );
        return;
      }
      if (!telaioLetto) return;
      this._avanzo = this._avanzo.subarray(telaioLetto.consumati);
      if (!this._gestisci(telaioLetto)) return;
    }
  }

  /* Torna `false` quando la presa e' stata chiusa e non ha senso continuare. */
  _gestisci({ tipo, finito, carico }) {
    if (tipo === TIPO.chiusura) {
      this.chiudi(CHIUSURA.normale, "");
      return false;
    }
    if (tipo === TIPO.ping) {
      try {
        this.socket.write(telaio(TIPO.pong, carico));
      } catch (_errore) {
        this._finita();
        return false;
      }
      return true;
    }
    if (tipo === TIPO.pong) return true;

    if (tipo === TIPO.testo || tipo === TIPO.binario) {
      if (this._tipoInCorso !== null) {
        this.chiudi(CHIUSURA.protocollo, "messaggio dentro un messaggio");
        return false;
      }
      this._tipoInCorso = tipo;
      this._pezzi = [];
      this._lunghezzaInCorso = 0;
    } else if (tipo === TIPO.seguito) {
      if (this._tipoInCorso === null) {
        this.chiudi(CHIUSURA.protocollo, "seguito senza inizio");
        return false;
      }
    } else {
      this.chiudi(CHIUSURA.protocollo, `telaio sconosciuto ${tipo}`);
      return false;
    }

    /* Il limite si controlla mentre i pezzi arrivano, non alla fine: un
     * messaggio spezzato in mille telai da un megabyte l'uno passerebbe il
     * controllo sul singolo telaio e riempirebbe la memoria lo stesso. */
    this._lunghezzaInCorso += carico.length;
    if (this._lunghezzaInCorso > this.massimo) {
      this.chiudi(CHIUSURA.troppoGrande, "messaggio troppo grande");
      return false;
    }
    this._pezzi.push(carico);
    if (!finito) return true;

    const intero = this._pezzi.length === 1 ? this._pezzi[0] : Buffer.concat(this._pezzi);
    const eraTesto = this._tipoInCorso === TIPO.testo;
    this._pezzi = [];
    this._tipoInCorso = null;
    this._lunghezzaInCorso = 0;
    try {
      this.onMessaggio(eraTesto ? intero.toString("utf8") : intero, eraTesto);
    } catch (_errore) {
      this.chiudi(CHIUSURA.guasto, "");
      return false;
    }
    return this.viva;
  }

  _finita() {
    this.viva = false;
    this._avvisa();
  }

  /* L'avviso di chiusura parte una volta sola: `close` sul socket arriva anche
   * dopo un `chiudi()` nostro, e chi ascolta non deve contarlo due volte. */
  _avvisa() {
    if (this.hoRisposto) return;
    this.hoRisposto = true;
    try {
      this.onChiusa();
    } catch (_errore) {
      /* Chi ascolta ha sbagliato: non e' un motivo per far cadere il ponte. */
    }
  }
}
