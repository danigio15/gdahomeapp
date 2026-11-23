/* Lo sportello del polso: il filo, per chi non sa tenere un filo aperto.
 *
 * Un Amazfit parla con la casa dal suo «servizio di fianco», che gira dentro
 * l'app Zepp sul telefono e ha solo `fetch`: niente WebSocket. Allora il filo
 * glielo si tiene qui. Ogni sua richiesta porta le parole che dice e torna
 * con quelle che la casa gli ha risposto; in mezzo, per la casa, c'e' un
 * canale come quello di un telefono qualunque (`centralino.js`,
 * `apriUnCanale`), con la stessa porta, la stessa regola di Premium e gli
 * stessi tetti.
 *
 *     POST /polso/telefono/<casa>          {m:[…]}         → {s, m:[…]}
 *     POST /polso/telefono/<casa>          {s, m:[…]}      → {s, m:[…], fine?}
 *     POST /polso/abbinamento/<impronta>   {m:[…]}  …        lo stesso, per abbinarsi
 *
 * `s` e' la sessione: un numero a caso che dice quale canale continuare. `m`
 * sono le parole, cosi' come sono: la stretta di mano in chiaro e poi buste
 * cifrate (`ponte/src/portiere.js`). Qui **non si guarda dentro** e non si
 * scrive niente di quello che passa: ne' le parole, ne' la sessione. Nel
 * registro vanno solo i conti.
 *
 * La risposta parte appena la casa ha detto qualcosa (e un attimo dopo, per
 * prendere anche quello che arriva insieme), o quando la casa chiude il
 * canale — con `fine` — o dopo `ATTESA_DELLA_RISPOSTA` senza niente: e
 * l'orologio richiede.
 *
 * Si arriva allo stesso indirizzo del relay di sempre: e' lo stesso server,
 * un'altra via. Risponde anche alle domande del browser (CORS): il servizio
 * di fianco su qualche telefono e' una pagina, e quello che passa e' cifrato
 * per la casa, quindi a chi lo legga non serve a niente.
 */

import { randomBytes } from "node:crypto";

import { CASA_VALIDA } from "./case.js";
import { Freno } from "./freno.js";
import { daChi, reteLargaDi } from "./indirizzo.js";
import { RichiestaSbagliata } from "./segnalazioni.js";
import { byteDi, json } from "./sportello.js";

const VIA = /^\/polso\/(telefono|abbinamento)\/([A-Za-z0-9_]+)$/;
const IMPRONTA = /^[0-9a-f]{64}$/;
const SESSIONE = /^[0-9a-f]{32}$/;

/* Quanto puo' essere grande una richiesta, e quante parole dentro. Le parole
 * di un orologio sono una stretta di mano e domande da poche righe. */
export const RICHIESTA_MASSIMA = 64 * 1024;
export const PAROLE_PER_RICHIESTA = 4;

/* Quanto puo' accumulare una sessione verso l'orologio, finche' non viene a
 * prenderlo: una fotografia sono pochi chilobyte. Oltre, si chiude. */
export const CODA_MASSIMA = 512 * 1024;

/* Quanto si aspetta che la casa risponda, e quanto si aspetta ancora dopo la
 * prima parola per prendere anche quelle che arrivano insieme. */
export const ATTESA_DELLA_RISPOSTA = 9_000;
export const CODA_DELLA_RISPOSTA = 120;

/* Quanto vive una sessione senza richieste: l'orologio guarda la casa ogni
 * venti secondi mentre l'app e' aperta. Chiusa l'app, la sessione se ne va. */
export const SESSIONE_ZITTA = 60_000;

/* Quante sessioni insieme, in tutto. Ognuna e' anche un filo per il conto
 * dei posti (`cePostoPer`), come un telefono. */
export const SESSIONI_IN_TUTTO = 2000;

/* Le richieste per indirizzo in un'ora: una ogni venti secondi fanno 180, e
 * i comandi sono pochi. E le sessioni nuove, che costano una stretta di mano
 * alla casa. */
export const RICHIESTE_PER_INDIRIZZO = 900;
export const RICHIESTE_IN_TUTTO = 400_000;
export const SESSIONI_NUOVE_PER_INDIRIZZO = 120;

const INTESTAZIONI_DEL_BROWSER = Object.freeze({
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "600",
});

/* La presa di una sessione: per il centralino e' una presa come quella di un
 * WebSocket — `manda`, `chiudi`, `onMessaggio`, `onChiusa` — e sotto c'e' una
 * coda che l'orologio svuota a ogni richiesta. */
class PresaDelPolso {
  constructor(sessione) {
    this.sessione = sessione;
    this.viva = true;
    this.coda = [];
    this.byte = 0;
    this.fine = null;
    this.onMessaggio = () => {};
    this.onChiusa = () => {};
    /* `centralino.manda` guarda quanto e' rimasto indietro. */
    this.socket = { writableLength: 0 };
  }

  manda(testo) {
    if (!this.viva) return false;
    const quanto = Buffer.byteLength(String(testo));
    if (this.byte + quanto > CODA_MASSIMA) {
      this.chiudi(1009, "troppo da prendere");
      return false;
    }
    this.coda.push(String(testo));
    this.byte += quanto;
    this.socket.writableLength = this.byte;
    this.sessione.sveglia();
    return true;
  }

  prendi() {
    const tutte = this.coda;
    this.coda = [];
    this.byte = 0;
    this.socket.writableLength = 0;
    return tutte;
  }

  ping() {}

  presentata() {}

  chiudi(codice = 1000, motivo = "") {
    if (!this.viva) return;
    this.viva = false;
    this.fine = { codice, motivo: String(motivo || "").slice(0, 120) };
    this.sessione.sveglia();
    this.sessione.finita();
    try {
      this.onChiusa();
    } catch (_errore) {
      /* Chi ascoltava ha sbagliato: la sessione e' chiusa lo stesso. */
    }
  }
}

class Sessione {
  constructor(sportello, id) {
    this.sportello = sportello;
    this.id = id;
    this.presa = new PresaDelPolso(this);
    this.inAttesa = null;
    this.occupata = false;
    this._zitta = null;
    this._andata = () => {};
    this.ancora();
  }

  /* Ancora viva: si sposta in avanti il momento in cui la si chiude. */
  ancora() {
    clearTimeout(this._zitta);
    this._zitta = setTimeout(
      () => this.presa.chiudi(1000, "nessuna richiesta"),
      this.sportello.sessioneZitta,
    );
    this._zitta.unref?.();
  }

  sveglia() {
    this.inAttesa?.();
  }

  finita() {
    clearTimeout(this._zitta);
    this.sportello.sessioni.delete(this.id);
    this._andata();
  }

  /* Le parole dell'orologio alla casa, una per una, e poi si aspetta. */
  async giro(parole) {
    this.occupata = true;
    /* Mentre l'orologio aspetta la risposta non e' zitto: il conto del
     * silenzio riparte quando la risposta e' partita. */
    clearTimeout(this._zitta);
    try {
      for (const parola of parole) {
        if (!this.presa.viva) break;
        this.presa.onMessaggio(parola, true);
      }
      await this._aspetta();
      const m = this.presa.prendi();
      return { s: this.id, m, ...(this.presa.fine ? { fine: this.presa.fine } : {}) };
    } finally {
      this.occupata = false;
      if (this.presa.viva) this.ancora();
    }
  }

  _aspetta() {
    if (this.presa.coda.length || !this.presa.viva) {
      return new Promise((fatto) => setTimeout(fatto, this.sportello.codaDellaRisposta));
    }
    return new Promise((fatto) => {
      let finito = false;
      const basta = () => {
        if (finito) return;
        finito = true;
        clearTimeout(tardi);
        this.inAttesa = null;
        fatto();
      };
      const tardi = setTimeout(basta, this.sportello.attesaDellaRisposta);
      this.inAttesa = () => {
        this.inAttesa = null;
        /* Ancora un attimo: le parole che arrivano insieme partono insieme. */
        setTimeout(basta, this.presa.viva ? this.sportello.codaDellaRisposta : 0);
      };
    });
  }
}

export class SportelloDelPolso {
  constructor({
    centralino,
    registro = null,
    freno = new Freno({ perChi: RICHIESTE_PER_INDIRIZZO, inTutto: RICHIESTE_IN_TUTTO }),
    frenoDelleSessioni = new Freno({ perChi: SESSIONI_NUOVE_PER_INDIRIZZO }),
    attesaDellaRisposta = ATTESA_DELLA_RISPOSTA,
    codaDellaRisposta = CODA_DELLA_RISPOSTA,
    sessioneZitta = SESSIONE_ZITTA,
    sessioniInTutto = SESSIONI_IN_TUTTO,
  }) {
    this.centralino = centralino;
    this.registro = registro;
    this.freno = freno;
    this.frenoDelleSessioni = frenoDelleSessioni;
    this.attesaDellaRisposta = attesaDellaRisposta;
    this.codaDellaRisposta = codaDellaRisposta;
    this.sessioneZitta = sessioneZitta;
    this.sessioniInTutto = sessioniInTutto;
    this.sessioni = new Map();
    /* I conti per `/salute`: quante richieste, e quante fermate. Mai chi. */
    this.conti = { richieste: 0, fermate: 0 };
  }

  quanteSessioni() {
    return this.sessioni.size;
  }

  /* Se la via e' questa, risponde e torna `true`; se no `false`, e passa. */
  async forseServe(richiesta, risposta, via) {
    const trovata = VIA.exec(via);
    if (!trovata) return false;
    for (const [nome, valore] of Object.entries(INTESTAZIONI_DEL_BROWSER)) {
      risposta.setHeader(nome, valore);
    }
    if (richiesta.method === "OPTIONS") {
      risposta.writeHead(204);
      risposta.end();
      return true;
    }
    if (richiesta.method !== "POST") {
      risposta.setHeader("allow", "POST, OPTIONS");
      json(risposta, { errore: "solo-post" }, 405);
      return true;
    }
    const [, porta, dove] = trovata;
    if (porta === "telefono" ? !CASA_VALIDA.test(dove) : !IMPRONTA.test(dove)) {
      json(risposta, { errore: "indirizzo-non-valido" }, 400);
      return true;
    }
    const da = daChi(richiesta);
    this.conti.richieste += 1;
    if (!this.freno.concedi(da)) {
      this.conti.fermate += 1;
      risposta.setHeader("retry-after", "60");
      json(risposta, { errore: "troppe-richieste" }, 429);
      return true;
    }

    let corpo;
    try {
      corpo = JSON.parse((await byteDi(richiesta, RICHIESTA_MASSIMA)).toString("utf8"));
    } catch (errore) {
      if (errore instanceof RichiestaSbagliata) {
        json(risposta, { errore: "richiesta-troppo-grande" }, errore.stato);
        return true;
      }
      json(risposta, { errore: "non-json" }, 400);
      return true;
    }
    const parole = corpo?.m;
    if (
      !corpo ||
      typeof corpo !== "object" ||
      !Array.isArray(parole) ||
      parole.length > PAROLE_PER_RICHIESTA ||
      parole.some((una) => typeof una !== "string")
    ) {
      json(risposta, { errore: "richiesta-sbagliata" }, 400);
      return true;
    }

    /* Una sessione che c'e' gia'. */
    if (corpo.s !== undefined) {
      const sessione =
        typeof corpo.s === "string" && SESSIONE.test(corpo.s) ? this.sessioni.get(corpo.s) : null;
      if (!sessione) {
        json(risposta, { errore: "sessione-finita" }, 410);
        return true;
      }
      if (sessione.occupata) {
        json(risposta, { errore: "una-richiesta-alla-volta" }, 409);
        return true;
      }
      json(risposta, await sessione.giro(parole));
      return true;
    }

    /* Una sessione nuova: si comincia dicendo la prima parola. */
    if (!parole.length) {
      json(risposta, { errore: "richiesta-sbagliata" }, 400);
      return true;
    }
    const rete = reteLargaDi(da);
    if (
      this.sessioni.size >= this.sessioniInTutto ||
      (this.centralino.cePostoPer && !this.centralino.cePostoPer(rete)) ||
      !this.frenoDelleSessioni.concedi(da)
    ) {
      this.conti.fermate += 1;
      risposta.setHeader("retry-after", "30");
      json(risposta, { errore: "troppe-sessioni" }, 503);
      return true;
    }
    const sessione = new Sessione(this, randomBytes(16).toString("hex"));
    this.sessioni.set(sessione.id, sessione);
    if (this.centralino.unaPresaIn) sessione._andata = this.centralino.unaPresaIn(rete);
    if (porta === "telefono") {
      this.centralino.accogliUnTelefono(sessione.presa, { casa: dove, da, che: "polso" });
    } else {
      this.centralino.accogliUnAbbinamento(sessione.presa, { impronta: dove, da });
    }
    json(risposta, await sessione.giro(parole));
    return true;
  }

  chiudiTutto() {
    for (const sessione of [...this.sessioni.values()])
      sessione.presa.chiudi(1001, "il centralino si spegne");
  }
}
