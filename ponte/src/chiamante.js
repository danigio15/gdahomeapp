/* La presa di chi chiama: un cliente WebSocket, scritto qui.
 *
 * ─── Perche' esiste ───────────────────────────────────────────────────────
 *
 * Il ponte chiama fuori in due posti: verso Home Assistant e verso il
 * centralino. Tutti e due usavano il `WebSocket` incorporato in Node, che
 * sembra sempre esserci — e infatti c'e', **su Node 22**. L'immagine
 * dell'add-on monta Node 20, dove quel `WebSocket` non esiste, e il ponte
 * diceva
 *
 *     non riesco ad aprire il filo: this.Presa is not a constructor
 *
 * Nelle prove non si vedeva: le prove girano su Node 22, e i finti che
 * iniettano non sono mai il vero. Un difetto che compare solo dove il codice
 * gira davvero e' il peggiore che ci sia, e questo aveva colpito tutti e due i
 * fili — non solo quello del centralino: **nemmeno il filo verso Home
 * Assistant si sarebbe aperto**.
 *
 * La cura non e' aggiornare l'immagine, che rimanda solo il problema alla
 * prossima cosa che manca: e' non dipendere piu' da quello che c'e' o non c'e'
 * nella versione di turno. Il ponte la presa dall'altra parte se la scrive
 * gia' da solo; questa e' la stessa cosa, girata dalla parte di chi chiama.
 *
 * ─── Cosa cambia fra le due parti ─────────────────────────────────────────
 *
 * Una cosa sola: **chi chiama maschera quello che manda**, chi risponde no.
 * Non e' una difesa — la maschera e' una chiave di quattro byte scritta nel
 * telaio stesso — ma una regola del protocollo, e chi non la rispetta si vede
 * chiudere il filo. Il resto — telai, ping, chiusure, messaggi spezzati — e'
 * identico, e infatti e' lo stesso codice: `presa.js`.
 *
 * ─── L'interfaccia ────────────────────────────────────────────────────────
 *
 * Fuori si comporta come il `WebSocket` dei browser — `addEventListener`,
 * `send`, `close` — e non per vezzo: cosi' chi lo usa non cambia una riga, e
 * nelle prove si continua a mettere al suo posto un finto che parla la lingua
 * che parlano tutti.
 */

import { randomBytes } from "node:crypto";
import { connect as connettiInChiaro } from "node:net";
import { connect as connettiInCifrato } from "node:tls";

import { firmaDellaChiave, Presa } from "./presa.js";

/* Quanto si aspetta la stretta di mano prima di dire che non c'e' nessuno. */
const ATTESA = 15_000;

/* Le intestazioni non sono mai cosi' lunghe. Oltre, dall'altra parte non c'e'
 * un server WebSocket: c'e' qualcosa che sta rispondendo una pagina. */
const INTESTAZIONI_MASSIME = 16 * 1024;

export const CONNETTENDO = 0;
export const APERTA = 1;
export const CHIUDENDO = 2;
export const CHIUSA = 3;

export class Chiamante {
  constructor(indirizzo, { attesa = ATTESA, messaggioMassimo = null } = {}) {
    this.indirizzo = String(indirizzo);
    this.readyState = CONNETTENDO;
    this.messaggioMassimo = messaggioMassimo;

    /* Perche' e' caduto, quando si sa. Chi ascolta `close` lo trova
     * nell'evento, e finisce nel registro invece di sparire. */
    this.motivo = "";

    this._ascoltatori = { open: [], message: [], close: [], error: [] };
    this._presa = null;
    this._socket = null;
    this._intestazioni = Buffer.alloc(0);

    this._scadenza = setTimeout(() => {
      this._male(new Error("la stretta di mano non e' arrivata in tempo"));
    }, attesa);
    this._scadenza.unref?.();

    try {
      this._chiama();
    } catch (errore) {
      /* Un indirizzo che non si legge nemmeno: si risponde come a un filo
       * caduto, non con un'eccezione in faccia a chi ha chiamato. */
      queueMicrotask(() => this._male(errore));
    }
  }

  /* ─── Quello che vede chi lo usa ───────────────────────────────────────── */

  addEventListener(quale, chi) {
    if (this._ascoltatori[quale]) this._ascoltatori[quale].push(chi);
  }

  removeEventListener(quale, chi) {
    const dove = this._ascoltatori[quale];
    if (!dove) return;
    const quando = dove.indexOf(chi);
    if (quando >= 0) dove.splice(quando, 1);
  }

  send(testo) {
    if (this.readyState !== APERTA) return;
    this._presa.manda(testo);
  }

  close(codice = 1000, motivo = "") {
    if (this.readyState === CHIUSA || this.readyState === CHIUDENDO) return;
    this.readyState = CHIUDENDO;
    clearTimeout(this._scadenza);
    if (this._presa) {
      this._presa.chiudi(codice, motivo);
      return;
    }
    this._socket?.destroy();
    this._finita();
  }

  /* ─── La stretta di mano ───────────────────────────────────────────────── */

  _chiama() {
    const dove = new URL(this.indirizzo);
    const cifrato = dove.protocol === "wss:" || dove.protocol === "https:";
    if (!cifrato && dove.protocol !== "ws:" && dove.protocol !== "http:") {
      throw new Error(`non so parlare ${dove.protocol}`);
    }
    const porta = Number(dove.port) || (cifrato ? 443 : 80);
    const via = `${dove.pathname || "/"}${dove.search || ""}`;

    const socket = cifrato
      ? connettiInCifrato({ host: dove.hostname, port: porta, servername: dove.hostname })
      : connettiInChiaro({ host: dove.hostname, port: porta });
    this._socket = socket;

    const chiave = randomBytes(16).toString("base64");
    const attesa = firmaDellaChiave(chiave);

    const leggi = (pezzo) => this._intestazione(pezzo, attesa, leggi);
    socket.on(cifrato ? "secureConnect" : "connect", () => {
      /* `Host` porta la porta solo quando non e' quella solita: alcuni proxy
       * confrontano quella riga con quello che si aspettano, e una porta
       * scritta dove non serve li fa rispondere di no. */
      const ospite = porta === (cifrato ? 443 : 80) ? dove.hostname : `${dove.hostname}:${porta}`;
      socket.write(
        [
          `GET ${via} HTTP/1.1`,
          `Host: ${ospite}`,
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Key: ${chiave}`,
          "Sec-WebSocket-Version: 13",
          "",
          "",
        ].join("\r\n"),
      );
    });
    socket.on("data", leggi);
    socket.on("error", (errore) => this._male(errore));
    socket.on("close", () => {
      if (this.readyState === CONNETTENDO) {
        this._male(new Error("il filo si e' chiuso prima di aprirsi"));
      }
    });
    socket.setNoDelay(true);
  }

  _intestazione(pezzo, attesa, leggi) {
    if (this.readyState !== CONNETTENDO) return;
    this._intestazioni = Buffer.concat([this._intestazioni, pezzo]);

    const fine = this._intestazioni.indexOf("\r\n\r\n");
    if (fine < 0) {
      if (this._intestazioni.length > INTESTAZIONI_MASSIME) {
        this._male(new Error("dall'altra parte non c'e' un WebSocket"));
      }
      return;
    }

    const testa = this._intestazioni.subarray(0, fine).toString("latin1");
    /* Quello che viene dopo le intestazioni sono gia' telai, ed e' arrivato
     * nello stesso pezzo di rete: va passato alla presa, non buttato. */
    const avanzo = this._intestazioni.subarray(fine + 4);

    const righe = testa.split("\r\n");
    const stato = Number(righe[0]?.split(" ")[1]);
    if (stato !== 101) {
      this._male(new Error(`ha risposto ${stato || "qualcosa che non capisco"}`));
      return;
    }

    const dette = new Map();
    for (const riga of righe.slice(1)) {
      const duePunti = riga.indexOf(":");
      if (duePunti < 0) continue;
      dette.set(riga.slice(0, duePunti).trim().toLowerCase(), riga.slice(duePunti + 1).trim());
    }

    if ((dette.get("upgrade") || "").toLowerCase() !== "websocket") {
      this._male(new Error("la risposta non e' una salita a WebSocket"));
      return;
    }
    /* La firma della chiave e' quello che distingue un WebSocket vero da
     * qualunque altra cosa che risponda 101: non e' un segreto e non protegge
     * da niente, ma dice che dall'altra parte c'e' qualcuno che il protocollo
     * lo conosce. */
    if (dette.get("sec-websocket-accept") !== attesa) {
      this._male(new Error("la firma della stretta di mano non torna"));
      return;
    }

    this._socket.off("data", leggi);
    clearTimeout(this._scadenza);

    this._presa = new Presa(this._socket, {
      daCliente: true,
      ...(this.messaggioMassimo ? { messaggioMassimo: this.messaggioMassimo } : {}),
      onMessaggio: (testo) => this._avvisa("message", { data: testo }),
      onChiusa: (motivo) => {
        if (motivo) this.motivo = motivo;
        this._finita();
      },
    });

    /* Aperto **prima** di guardare quello che era gia' arrivato.
     *
     * L'ordine non e' un dettaglio di stile. La risposta 101 e il primo telaio
     * partono a un millesimo di distanza e quasi sempre arrivano insieme:
     * se si leggesse quel telaio prima di dichiararsi aperti, chi ci sta sopra
     * risponderebbe a un filo che per noi non e' ancora aperto, e la risposta
     * verrebbe buttata via in silenzio. E' successo: la stretta di mano con
     * Home Assistant si fermava li', senza un errore da nessuna parte. */
    this.readyState = APERTA;
    this._avvisa("open", {});
    this._presa.riprendi(avanzo);
  }

  /* ─── La fine ──────────────────────────────────────────────────────────── */

  _male(errore) {
    if (this.readyState === CHIUSA) return;
    if (!this.motivo) this.motivo = String(errore?.message || errore || "");
    clearTimeout(this._scadenza);
    this._avvisa("error", { error: errore, message: errore?.message });
    this._socket?.destroy();
    this._finita();
  }

  _finita() {
    if (this.readyState === CHIUSA) return;
    this.readyState = CHIUSA;
    this._avvisa("close", { motivo: this.motivo });
  }

  _avvisa(quale, evento) {
    for (const chi of [...this._ascoltatori[quale]]) {
      try {
        chi(evento);
      } catch (_errore) {
        /* Chi ascolta ha sbagliato: non e' un motivo per far cadere il ponte. */
      }
    }
  }
}
