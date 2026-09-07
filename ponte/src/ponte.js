/* Il ponte: quello che succede quando un telefono si collega.
 *
 * L'idea sta tutta in una riga: **al telefono il ponte si presenta come Home
 * Assistant**. Stessa stretta di mano — `auth_required`, `auth`, `auth_ok` —
 * stessi messaggi, stessi numeri di richiesta. Il telefono non sa di parlare
 * con un ponte, e quindi qualunque codice che sa parlare con Home Assistant
 * funziona di qui senza cambiare una virgola.
 *
 * L'unica differenza sta nel segno: dove Home Assistant vuole un suo segno,
 * qui ci va quello del ponte, che il telefono ha ricevuto abbinandosi. Il
 * ponte lo riconosce, apre *lui* il filo con Home Assistant col segno del
 * Supervisor, e da quel momento passa i messaggi da una parte all'altra senza
 * guardarci dentro.
 *
 * Cosa vuol dire questo per la sicurezza, detto chiaro: un telefono abbinato
 * puo' fare in Home Assistant quello che puo' fare il ponte, cioe' tutto. Per
 * questo un codice di abbinamento nasce solo dietro l'autenticazione di Home
 * Assistant, dura cinque minuti, si usa una volta, e ogni telefono si stacca
 * da solo dalla console.
 */

import { CasaIrraggiungibile } from "./casa.js";

/* Quanti messaggi al secondo puo' mandare un telefono.
 *
 * Una plancia che si apre ne manda una raffica — le sottoscrizioni, i
 * registri, lo storico — e poi quasi niente. Il limite serve contro un
 * telefono impazzito o un cliente scritto male, non contro l'uso normale:
 * qualunque cosa sotto questa soglia passa senza accorgersene. */
const MESSAGGI_AL_SECONDO = 50;
const RAFFICA = 300;

/* Ogni quanto il ponte controlla che il telefono ci sia ancora.
 *
 * Un telefono che esce dal Wi-Fi non chiude niente: il socket resta li',
 * apparentemente aperto, finche' qualcuno non prova a scriverci. Senza questo
 * giro il ponte terrebbe in piedi un filo con Home Assistant per ogni telefono
 * che se n'e' andato. */
const BATTITO = 30_000;
const SILENZIO_MASSIMO = 90_000;

export class Ponte {
  constructor({ casa, dispositivi, registro }) {
    this.casa = casa;
    this.dispositivi = dispositivi;
    this.registro = registro;
    this.collegamenti = new Set();
  }

  /* Un telefono ha appena aperto una presa. */
  accogli(presa, { da = "?" } = {}) {
    const collegamento = new Collegamento(this, presa, da);
    this.collegamenti.add(collegamento);
    collegamento.avvia();
    return collegamento;
  }

  quantiCollegati() {
    return this.collegamenti.size;
  }

  collegatiPerDispositivo() {
    const conto = new Map();
    for (const uno of this.collegamenti) {
      if (!uno.dispositivo) continue;
      conto.set(uno.dispositivo.id, (conto.get(uno.dispositivo.id) || 0) + 1);
    }
    return conto;
  }

  /* Butta giu' i fili di un telefono staccato dalla console. Senza questo, un
   * telefono revocato resterebbe dentro finche' non chiude lui. */
  scollega(idDelDispositivo) {
    let quanti = 0;
    for (const uno of [...this.collegamenti]) {
      if (uno.dispositivo?.id !== idDelDispositivo) continue;
      uno.chiudi(1008, "questo dispositivo e' stato staccato");
      quanti += 1;
    }
    return quanti;
  }

  chiudiTutto() {
    for (const uno of [...this.collegamenti]) uno.chiudi(1001, "il ponte si sta spegnendo");
  }
}

class Collegamento {
  constructor(ponte, presa, da) {
    this.ponte = ponte;
    this.presa = presa;
    this.da = da;
    this.dispositivo = null;
    this.filo = null;
    this.chiuso = false;
    this.gettoni = RAFFICA;
    this.ultimoGettone = Date.now();
    this.vistoIl = Date.now();
    this.battito = null;
  }

  avvia() {
    this.presa.onMessaggio = (testo) => this._dalTelefono(testo);
    this.presa.onChiusa = () => this._finito();
    /* Un telefono che riceve e non chiede — l'app ferma sulla home — non manda
     * niente per minuti, ed e' vivo lo stesso. Il pong e' il suo modo di dire
     * che c'e'. */
    this.presa.onPong = () => {
      this.vistoIl = Date.now();
    };
    /* Come Home Assistant: la prima parola la dice il server. */
    this.presa.manda(JSON.stringify({ type: "auth_required", ha_version: "ponte" }));
    this.battito = setInterval(() => this._controlla(), BATTITO);
  }

  _controlla() {
    if (this.chiuso) return;
    if (Date.now() - this.vistoIl > SILENZIO_MASSIMO) {
      this.chiudi(1001, "nessun segno di vita");
      return;
    }
    this.presa.ping();
  }

  _dalTelefono(testo) {
    if (this.chiuso) return;
    this.vistoIl = Date.now();
    if (!this._cePosto()) {
      this.chiudi(1008, "troppi messaggi");
      return;
    }

    /* Dopo la stretta il ponte non guarda piu' dentro: quello che arriva e'
     * roba fra il telefono e Home Assistant, e leggerla sarebbe soltanto un
     * modo per sbagliarla. */
    if (this.dispositivo) {
      if (!this.filo?.manda(testo)) this.chiudi(1011, "il filo con la casa e' caduto");
      return;
    }

    let detto;
    try {
      detto = JSON.parse(testo);
    } catch (_errore) {
      this._rifiuta("non ho capito");
      return;
    }
    if (detto?.type !== "auth") {
      this._rifiuta("prima bisogna autenticarsi");
      return;
    }
    this._autentica(String(detto.access_token || ""));
  }

  async _autentica(segno) {
    const dispositivo = this.ponte.dispositivi.riconosci(segno);
    if (!dispositivo) {
      this.ponte.registro?.attenzione?.(`abbinamento rifiutato da ${this.da}`);
      this._rifiuta("segno non valido");
      return;
    }

    try {
      this.filo = await this.ponte.casa.apriIlFilo({
        onMessaggio: (dallaCasa) => this.presa.manda(dallaCasa),
        onChiusa: () => this.chiudi(1011, "Home Assistant ha chiuso"),
      });
    } catch (errore) {
      const perche =
        errore instanceof CasaIrraggiungibile ? errore.message : "non riesco a parlare con la casa";
      this.ponte.registro?.errore?.(`filo non aperto per ${dispositivo.nome}: ${perche}`);
      this._rifiuta(perche);
      return;
    }

    /* Fra l'`await` e qui il telefono puo' essersene andato. */
    if (this.chiuso) {
      this.filo.chiudi();
      return;
    }

    this.dispositivo = dispositivo;
    this.ponte.registro?.info?.(`${dispositivo.nome} e' entrato da ${this.da}`);
    this.presa.manda(JSON.stringify({ type: "auth_ok", ha_version: "ponte" }));
  }

  _rifiuta(perche) {
    this.presa.manda(JSON.stringify({ type: "auth_invalid", message: perche }));
    this.chiudi(1008, perche);
  }

  /* Un secchio che si riempie da solo: cinquanta gettoni al secondo, trecento
   * al massimo. Chi sta sotto non se ne accorge mai. */
  _cePosto() {
    const ora = Date.now();
    this.gettoni = Math.min(
      RAFFICA,
      this.gettoni + ((ora - this.ultimoGettone) / 1000) * MESSAGGI_AL_SECONDO,
    );
    this.ultimoGettone = ora;
    if (this.gettoni < 1) return false;
    this.gettoni -= 1;
    return true;
  }

  chiudi(codice = 1000, motivo = "") {
    if (this.chiuso) return;
    this.chiuso = true;
    if (this.battito) clearInterval(this.battito);
    this.filo?.chiudi();
    this.presa.chiudi(codice, motivo);
    this.ponte.collegamenti.delete(this);
  }

  _finito() {
    if (this.chiuso) return;
    this.chiuso = true;
    if (this.battito) clearInterval(this.battito);
    this.filo?.chiudi();
    this.ponte.collegamenti.delete(this);
  }
}
