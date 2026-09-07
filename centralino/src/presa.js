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

import { createHash, randomBytes } from "node:crypto";

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

export function telaio(tipo, carico, { maschera = false } = {}) {
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
  /* Il bit alto e' FIN: qui dentro non si spezza mai quello che si manda. */
  testa[0] = 0x80 | tipo;
  if (!maschera) return Buffer.concat([testa, dati]);

  /* La maschera non e' una difesa: e' una regola del protocollo, e vale per
   * chi **chiama** e non per chi riceve. Serve a impedire che un pezzo di
   * traffico scelto dall'attaccante somigli a una richiesta HTTP quando passa
   * davanti a un proxy che non parla WebSocket. Chi non la mette si vede
   * chiudere il filo, ed e' giusto cosi'. */
  const chiave = randomBytes(4);
  testa[1] |= 0x80;
  const coperti = Buffer.from(dati);
  for (let i = 0; i < coperti.length; i += 1) coperti[i] ^= chiave[i & 3];
  return Buffer.concat([testa, chiave, coperti]);
}

/* Stacca un telaio dalla testa del buffer.
 *
 * Torna `null` quando i byte non bastano ancora — che e' la condizione
 * normale, non un errore: un messaggio lungo arriva in piu' pezzi di rete e
 * quasi mai allineato ai telai. */
export function staccaIlTelaio(
  buffer,
  massimo = MESSAGGIO_MASSIMO,
  { vuoleLaMaschera = true } = {},
) {
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

  /* Chi chiama maschera, chi risponde no. Le due parti si aspettano cose
   * opposte, e chi si sbaglia va fermato: un telaio senza maschera da un
   * cliente — o con la maschera da un server — vuol dire che dall'altra parte
   * non c'e' quello che pensiamo. */
  if (vuoleLaMaschera && !mascherato)
    throw new ErroreDiProtocollo("telaio in arrivo senza maschera");
  if (!vuoleLaMaschera && mascherato)
    throw new ErroreDiProtocollo("telaio in arrivo con la maschera");

  const finaMaschera = mascherato ? inizio + 4 : inizio;
  if (buffer.length < finaMaschera + lunghezza) return null;
  const carico = Buffer.from(buffer.subarray(finaMaschera, finaMaschera + lunghezza));
  if (mascherato) {
    const maschera = buffer.subarray(inizio, finaMaschera);
    for (let i = 0; i < carico.length; i += 1) carico[i] ^= maschera[i & 3];
  }

  return { tipo, finito, carico, consumati: finaMaschera + lunghezza };
}

export class ErroreDiProtocollo extends Error {}
export class ErroreDiCarico extends Error {}

/* ─── La presa ───────────────────────────────────────────────────────────── */

export class Presa {
  constructor(
    socket,
    {
      onMessaggio,
      onChiusa,
      onPong,
      messaggioMassimo = MESSAGGIO_MASSIMO,
      /* `true` quando questa presa e' quella di chi **ha chiamato**: allora
       * maschera quello che manda e si aspetta senza maschera quello che
       * riceve. E' l'unica differenza fra le due parti, e sta tutta qui. */
      daCliente = false,
    } = {},
  ) {
    this.socket = socket;
    this.onMessaggio = onMessaggio || (() => {});
    this.onChiusa = onChiusa || (() => {});
    this.onPong = onPong || (() => {});
    this.massimo = messaggioMassimo;
    this.daCliente = daCliente;
    this.viva = true;
    this.hoRisposto = false;

    /* Perche' e' caduta. Vuoto quando e' caduta e basta — la rete, il
     * telefono in tasca — e pieno quando l'abbiamo chiusa noi per un motivo.
     * Senza questo, chi guarda il registro vede «il filo si e' interrotto» e
     * non ha nessun modo di sapere se era un messaggio troppo grande, un
     * segno rifiutato o davvero la rete. */
    this.motivo = "";

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

  /* I byte che chi ha fatto la stretta di mano ha letto **insieme alle
   * intestazioni**.
   *
   * Non e' un caso raro da manuale: la risposta 101 e il primo telaio partono
   * a un millesimo di distanza, quindi quasi sempre arrivano nello stesso
   * pezzo di rete. Chi li buttasse via perderebbe il primo messaggio — che e'
   * proprio quello che fa cominciare tutto, `auth_required`.
   *
   * Si chiama dopo, e non dal costruttore, per una ragione di ordine: chi ci
   * sta sopra deve potersi dichiarare aperto **prima** di vedersi arrivare un
   * messaggio. Altrimenti risponde a un filo che, per quanto ne sa lui, non e'
   * ancora aperto — e la risposta finisce nel niente. */
  riprendi(avanzo) {
    if (avanzo && avanzo.length) this._arrivano(avanzo);
  }

  _telaio(tipo, carico) {
    return telaio(tipo, carico, { maschera: this.daCliente });
  }

  manda(testo) {
    if (!this.viva) return false;
    try {
      this.socket.write(this._telaio(TIPO.testo, testo));
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
      this.socket.write(this._telaio(TIPO.ping, Buffer.alloc(0)));
    } catch (_errore) {
      this._finita();
    }
  }

  chiudi(codice = CHIUSURA.normale, motivo = "") {
    if (!this.viva) return;
    this.viva = false;
    if (motivo) this.motivo = String(motivo);
    try {
      const testo = Buffer.from(String(motivo).slice(0, 120), "utf8");
      const carico = Buffer.alloc(2 + testo.length);
      carico.writeUInt16BE(codice, 0);
      testo.copy(carico, 2);
      this.socket.write(this._telaio(TIPO.chiusura, carico));
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
        telaioLetto = staccaIlTelaio(this._avanzo, this.massimo, {
          vuoleLaMaschera: !this.daCliente,
        });
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
        this.socket.write(this._telaio(TIPO.pong, carico));
      } catch (_errore) {
        this._finita();
        return false;
      }
      return true;
    }
    if (tipo === TIPO.pong) {
      /* Un pong e' un segno di vita, e va detto a chi ascolta.
       *
       * Prima non lo diceva a nessuno, e la conseguenza era un difetto vero:
       * chi conta il silenzio contava solo i *messaggi*, e un telefono aperto
       * ma zitto — l'app ferma sulla home, che riceve e non chiede — dopo un
       * minuto e mezzo veniva buttato fuori pur essendo vivissimo. Nessuna
       * prova poteva prenderlo: durano tutte meno di quel minuto e mezzo. */
      try {
        this.onPong();
      } catch (_errore) {
        /* Chi ascolta ha sbagliato: non e' un motivo per far cadere la presa. */
      }
      return true;
    }

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
      this.onChiusa(this.motivo);
    } catch (_errore) {
      /* Chi ascolta ha sbagliato: non e' un motivo per far cadere il ponte. */
    }
  }
}
