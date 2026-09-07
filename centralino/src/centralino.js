/* Il centralino: la cosa che fa incontrare un telefono e la sua casa.
 *
 *      il telefono                                    la casa
 *           │                                            │
 *           │  wss://…/telefono/casa_9f3a…               │  wss://…/casa
 *           └──────────────►  ┌──────────────┐  ◄────────┘
 *                             │  centralino  │   (chiama lei, sempre)
 *                             └──────────────┘
 *
 * **La casa chiama fuori.** E' tutto il punto. Non c'e' nessuna porta da
 * aprire sul router, nessun indirizzo pubblico da avere, nessuna VPN da
 * installare: la casa apre lei un filo verso qui e lo tiene aperto, e i
 * telefoni arrivano da questa parte.
 *
 * Su quel filo solo ci stanno tutti i telefoni di quella casa, uno per canale.
 *
 * ─── Quello che il centralino NON fa, ed e' la parte importante ───────────
 *
 * Non verifica niente che sia un segreto. Non sa se un codice di abbinamento
 * e' giusto — instrada sulla sua *impronta*, e il codice non lo vede mai. Non
 * sa se il segno di un telefono e' buono: lo passa alla casa, che lo verifica
 * lei. Non guarda dentro ai messaggi: sono byte, e li sposta.
 *
 * L'unica cosa che difende e' che una casa non possa spacciarsi per un'altra —
 * perche' se ci riuscisse raccoglierebbe i segni dei telefoni che bussano — e
 * per quello c'e' `case.js`.
 */

import { CASA_VALIDA } from "./case.js";
import { CHIUSURA } from "./presa.js";

/* Quanti telefoni insieme puo' avere una casa. Oltre non e' una famiglia. */
const TELEFONI_PER_CASA = 20;

/* Quanto vive l'attesa di un abbinamento: la stessa finestra del codice. */
const ABBINAMENTO_VIVE = 6 * 60 * 1000;

/* Un messaggio piu' lungo di cosi' non e' un comando a Home Assistant. */
export const MESSAGGIO_MASSIMO = 1024 * 1024;

/* Ogni quanto il centralino manda un colpetto alle case, per accorgersi di
 * quelle che se ne sono andate senza dire niente — una casa dietro un router
 * che si riavvia non chiude un bel niente, resta li' aperta e muta. */
const BATTITO = 45_000;
const SILENZIO_MASSIMO = 150_000;

export class Centralino {
  constructor({ case: case_, registro, adesso = () => Date.now() } = {}) {
    this.case = case_;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;

    /** Le case collegate adesso, per identificativo. */
    this.collegate = new Map();
    /** Le attese di abbinamento vive, per impronta del codice. */
    this.abbinamenti = new Map();

    this._battito = setInterval(() => this._giroDiControllo(), BATTITO);
    this._battito.unref?.();
  }

  quanteCase() {
    return this.collegate.size;
  }

  quantiTelefoni() {
    let quanti = 0;
    for (const casa of this.collegate.values()) quanti += casa.canali.size;
    return quanti;
  }

  /* ─── Una casa si presenta ───────────────────────────────────────────── */

  accogliUnaCasa(presa, { da = "?" } = {}) {
    const casa = new CasaCollegata(this, presa, da);
    casa.avvia();
    return casa;
  }

  /* ─── Un telefono bussa ──────────────────────────────────────────────── */

  /* Il telefono dice a quale casa vuole nell'indirizzo, e non e' un segreto:
   * l'identificativo serve a instradare, il segno a entrare, e il segno viene
   * dopo — dentro il filo, verso la casa, che e' l'unica che lo puo'
   * verificare. */
  accogliUnTelefono(presa, { casa: idDellaCasa, da = "?" } = {}) {
    const casa = this.collegate.get(idDellaCasa);
    if (!casa) {
      /* Detto com'e': «questa casa adesso non e' collegata». Non e' un
       * rifiuto, e il telefono deve riprovare fra poco invece di arrendersi. */
      presa.chiudi(CHIUSURA.normale, "casa non collegata");
      return null;
    }
    return casa.apriUnCanale(presa, da);
  }

  /* Un telefono che si sta abbinando non sa ancora a quale casa va: sa solo il
   * codice. Instrada sull'**impronta** del codice, che la casa ha registrato
   * quando la console lo ha fabbricato — cosi' il codice qui non passa mai. */
  accogliUnAbbinamento(presa, { impronta, da = "?" } = {}) {
    const attesa = this.abbinamenti.get(impronta);
    if (!attesa || attesa.scadeIl <= this.adesso()) {
      this.abbinamenti.delete(impronta);
      presa.chiudi(CHIUSURA.normale, "nessun abbinamento in corso");
      return null;
    }
    const casa = this.collegate.get(attesa.casa);
    if (!casa) {
      presa.chiudi(CHIUSURA.normale, "casa non collegata");
      return null;
    }
    return casa.apriUnCanale(presa, da);
  }

  /* ─── Manutenzione ───────────────────────────────────────────────────── */

  _giroDiControllo() {
    const ora = this.adesso();
    for (const [impronta, attesa] of [...this.abbinamenti]) {
      if (attesa.scadeIl <= ora) this.abbinamenti.delete(impronta);
    }
    for (const casa of [...this.collegate.values()]) {
      if (ora - casa.vistaIl > SILENZIO_MASSIMO) {
        casa.chiudi("nessun segno di vita");
        continue;
      }
      casa.presa.ping();
    }
  }

  chiudiTutto() {
    clearInterval(this._battito);
    for (const casa of [...this.collegate.values()]) casa.chiudi("il centralino si spegne");
  }
}

/* ─── Una casa, dalla parte del centralino ───────────────────────────────── */

class CasaCollegata {
  constructor(centralino, presa, da) {
    this.centralino = centralino;
    this.presa = presa;
    this.da = da;
    this.id = null;
    this.canali = new Map();
    this.prossimoCanale = 1;
    this.vistaIl = centralino.adesso();
    this.chiusa = false;
  }

  get entrata() {
    return this.id !== null;
  }

  avvia() {
    this.presa.onMessaggio = (testo) => this._dallaCasa(testo);
    this.presa.onChiusa = () => this._finita();
  }

  _dallaCasa(testo) {
    if (this.chiusa) return;
    this.vistaIl = this.centralino.adesso();

    let detto;
    try {
      detto = JSON.parse(testo);
    } catch (_errore) {
      this._rifiuta("non ho capito");
      return;
    }
    if (!detto || typeof detto !== "object") {
      this._rifiuta("non ho capito");
      return;
    }

    if (!this.entrata) {
      this._siPresenta(detto);
      return;
    }

    switch (detto.t) {
      case "apri-abbinamento":
        this._apriUnAbbinamento(detto.impronta);
        return;
      case "chiudi-abbinamento":
        this._chiudiGliAbbinamenti();
        return;
      case "d":
        this._versoIlTelefono(detto.c, detto.m);
        return;
      case "chiudi":
        this._chiudiIlCanale(detto.c, "la casa ha chiuso");
        return;
      default:
        /* Roba che non si conosce si lascia perdere: una casa piu' nuova del
         * centralino puo' dire cose che qui non si sanno ancora, e non e' un
         * motivo per buttarla fuori. */
        return;
    }
  }

  _siPresenta(detto) {
    if (detto.t !== "sono-io") {
      this._rifiuta("prima bisogna presentarsi");
      return;
    }
    if (!this.centralino.case.riconosci(detto.casa, detto.segreto)) {
      this.centralino.registro.attenzione(`casa rifiutata da ${this.da}`);
      this._rifiuta("non ti riconosco");
      return;
    }

    /* Una casa sola per identificativo. Chi arriva secondo prende il posto del
     * primo, e non il contrario: il primo puo' essere un filo morto che
     * nessuno ha ancora dichiarato tale, e la casa vera che si riaggancia non
     * deve restare fuori per colpa del proprio fantasma. */
    const gia = this.centralino.collegate.get(detto.casa);
    if (gia && gia !== this) gia.chiudi("questa casa si e' ricollegata");

    this.id = detto.casa;
    this.centralino.collegate.set(this.id, this);
    this.presa.manda(JSON.stringify({ t: "bene" }));
    this.centralino.registro.info(`casa collegata da ${this.da}`);
  }

  /* Rifiutare **dicendolo**.
   *
   * Chiudere e basta sarebbe la cosa peggiore: il ponte vedrebbe un filo
   * caduto, che e' quello che succede mille volte al giorno per colpa della
   * rete, e ribusserebbe all'infinito senza capire. Un rifiuto e' un'altra
   * cosa da una caduta — non passera' col tempo — e va detto, cosi' chi lo
   * riceve puo' smettere e scriverlo nel proprio registro invece di girare a
   * vuoto per sempre. */
  _rifiuta(perche) {
    this.presa.manda(JSON.stringify({ t: "no", perche }));
    if (this.chiusa) return;
    this.chiusa = true;
    this._staccaDalCentralino();
    /* 1008 e' «non per la rete, per la politica»: il ponte lo legge come
     * definitivo anche se il messaggio andasse perso. */
    this.presa.chiudi(1008, perche);
  }

  _apriUnAbbinamento(impronta) {
    if (typeof impronta !== "string" || !/^[0-9a-f]{64}$/.test(impronta)) return;
    this._chiudiGliAbbinamenti();
    this.centralino.abbinamenti.set(impronta, {
      casa: this.id,
      scadeIl: this.centralino.adesso() + ABBINAMENTO_VIVE,
    });
  }

  _chiudiGliAbbinamenti() {
    for (const [impronta, attesa] of [...this.centralino.abbinamenti]) {
      if (attesa.casa === this.id) this.centralino.abbinamenti.delete(impronta);
    }
  }

  /* ─── I canali ───────────────────────────────────────────────────────── */

  apriUnCanale(presaDelTelefono, da) {
    if (this.canali.size >= TELEFONI_PER_CASA) {
      presaDelTelefono.chiudi(CHIUSURA.normale, "troppi telefoni su questa casa");
      return null;
    }
    const numero = this.prossimoCanale++;
    const canale = { numero, presa: presaDelTelefono, da };
    this.canali.set(numero, canale);

    presaDelTelefono.onMessaggio = (testo) => {
      if (this.chiusa) return;
      this.presa.manda(JSON.stringify({ c: numero, t: "d", m: testo }));
    };
    presaDelTelefono.onChiusa = () => {
      if (!this.canali.delete(numero)) return;
      if (!this.chiusa) this.presa.manda(JSON.stringify({ c: numero, t: "chiudi" }));
    };

    this.presa.manda(JSON.stringify({ c: numero, t: "apri", da }));
    return canale;
  }

  _versoIlTelefono(numero, messaggio) {
    const canale = this.canali.get(numero);
    if (!canale || typeof messaggio !== "string") return;
    canale.presa.manda(messaggio);
  }

  _chiudiIlCanale(numero, perche) {
    const canale = this.canali.get(numero);
    if (!canale) return;
    this.canali.delete(numero);
    canale.presa.chiudi(CHIUSURA.normale, perche);
  }

  /* ─── Fine ───────────────────────────────────────────────────────────── */

  chiudi(perche = "") {
    if (this.chiusa) return;
    this.chiusa = true;
    /* I telefoni non restano appesi a una casa che non c'e' piu': meglio che
     * si accorgano subito e ribussino, invece di parlare nel vuoto. */
    for (const canale of [...this.canali.values()]) {
      canale.presa.chiudi(CHIUSURA.normale, "la casa si e' scollegata");
    }
    this.canali.clear();
    this._staccaDalCentralino();
    this.presa.chiudi(CHIUSURA.normale, perche);
  }

  _finita() {
    if (this.chiusa) return;
    this.chiusa = true;
    for (const canale of [...this.canali.values()]) {
      canale.presa.chiudi(CHIUSURA.normale, "la casa si e' scollegata");
    }
    this.canali.clear();
    this._staccaDalCentralino();
  }

  _staccaDalCentralino() {
    if (!this.id) return;
    this._chiudiGliAbbinamenti();
    if (this.centralino.collegate.get(this.id) === this) {
      this.centralino.collegate.delete(this.id);
    }
  }
}
