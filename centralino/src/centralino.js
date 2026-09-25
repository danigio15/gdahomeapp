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

/* Quello che puo' mandare un telefono, in un messaggio solo.
 *
 * Meno di quello della casa, e apposta: il messaggio del telefono non arriva
 * alla casa cosi' com'e', arriva **dentro una busta** — `{"c":…,"t":"d","m":…}`
 * — e dentro una stringa JSON ogni virgoletta diventa due caratteri, e un
 * carattere di controllo sei. Un messaggio da un megabyte poteva diventare una
 * busta da sei, e il ponte, che oltre il megabyte chiude il filo, avrebbe
 * chiuso **quello della casa**: un telefono solo staccava tutti gli altri.
 *
 * Il ponte spezza quello che manda in pezzi da 512 KB; 600 KB lasciano il
 * margine per la busta. E la busta si misura lo stesso, prima di partire:
 * quella che non ci sta chiude il telefono, non la casa. */
export const MESSAGGIO_DEL_TELEFONO = 600 * 1024;
const BUSTA_MASSIMA = MESSAGGIO_MASSIMO;

/* Quanto aspetta una casa appena arrivata prima di presentarsi, e un telefono
 * prima di dire la prima parola. Tutti e due parlano subito — la casa manda il
 * `sono-io` appena il filo e' aperto, il telefono la sua meta' della stretta —
 * quindi chi resta zitto cosi' a lungo non e' lento: occupa un posto. */
export const ATTESA_DELLA_PRESENTAZIONE = 15_000;
export const ATTESA_DELLA_PRIMA_PAROLA = 15_000;

/* Quanti fili aperti in tutto, e da uno stesso indirizzo. Il secondo e'
 * largo — dietro lo stesso indirizzo di un operatore mobile possono esserci
 * molti telefoni — ma non infinito. */
export const PRESE_IN_TUTTO = 10_000;
export const PRESE_PER_INDIRIZZO = 200;

/* Quanto puo' restare in coda, non ancora partito, verso un filo solo. Chi
 * non legge — un telefono che si e' fermato senza chiudere — farebbe
 * crescere la coda nella memoria del centralino finche' c'e' memoria. */
export const CODA_MASSIMA = 8 * 1024 * 1024;

/* «Non posso ora, riprova»: il ponte lo legge come una caduta qualunque e
 * ribussa con calma, invece di smettere per sempre come davanti a un no. */
const RIPROVA_PIU_TARDI = 1013;
/* «Questo tipo di dati non lo accetto»: un telefono manda testo, sempre. */
const DATI_NON_ACCETTATI = 1003;

/* Ogni quanto il centralino manda un colpetto alle case, per accorgersi di
 * quelle che se ne sono andate senza dire niente — una casa dietro un router
 * che si riavvia non chiude un bel niente, resta li' aperta e muta. */
const BATTITO = 45_000;
const SILENZIO_MASSIMO = 150_000;

export class Centralino {
  constructor({
    case: case_,
    registro,
    adesso = () => Date.now(),
    attesaDellaPresentazione = ATTESA_DELLA_PRESENTAZIONE,
    attesaDellaPrimaParola = ATTESA_DELLA_PRIMA_PAROLA,
    preseInTutto = PRESE_IN_TUTTO,
    presePerIndirizzo = PRESE_PER_INDIRIZZO,
    codaMassima = CODA_MASSIMA,
  } = {}) {
    this.case = case_;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this.attesaDellaPresentazione = attesaDellaPresentazione;
    this.attesaDellaPrimaParola = attesaDellaPrimaParola;
    this.preseInTutto = preseInTutto;
    this.presePerIndirizzo = presePerIndirizzo;
    this.codaMassima = codaMassima;

    /** Quanti fili aperti, in tutto e per indirizzo. */
    this.prese = 0;
    this.presePer = new Map();

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

  /* Quanti fili sono aperti adesso, in tutto.
   *
   * Si chiamava `quantiTelefoni`, e non erano telefoni: e' il numero di CANALI
   * aperti in questo istante. Lo stesso telefono con l'app aperta e una scheda
   * del browser ne tiene due, e ci finiscono dentro anche i fili di chi si sta
   * abbinando, che un telefono abbinato non lo e' ancora. Chi leggeva
   * «22 telefoni collegati» capiva «l'app e' su 22 telefoni», che e' un'altra
   * cosa e non e' vera. */
  quantiCollegamenti() {
    let quanti = 0;
    for (const casa of this.collegate.values()) quanti += casa.canali.size;
    return quanti;
  }

  /* E quante di quelle sono davvero l'app aperta: i fili entrati da
   * `/telefono/<casa>`, cioe' chi e' gia' abbinato e sta guardando. Restano
   * fuori gli abbinamenti in corso. Resta un conto di adesso, non di quanti
   * hanno l'app installata: quello il centralino non lo sa e non lo tiene. */
  quanteAppAperte() {
    let quante = 0;
    for (const casa of this.collegate.values())
      for (const canale of casa.canali.values()) if (canale.via === "telefono") quante += 1;
    return quante;
  }

  /* ─── Quanti fili ────────────────────────────────────────────────────── */

  /* Se c'e' posto per un filo in piu' da questo indirizzo. Si chiede prima
   * di rispondere alla stretta di mano: un filo che non c'e' posto per
   * tenere non si apre nemmeno. */
  cePostoPer(da) {
    if (this.prese >= this.preseInTutto) return false;
    return (this.presePer.get(da) || 0) < this.presePerIndirizzo;
  }

  /* Un filo in piu', e la funzione da chiamare quando se ne va. */
  unaPresaIn(da) {
    this.prese += 1;
    this.presePer.set(da, (this.presePer.get(da) || 0) + 1);
    let andata = false;
    return () => {
      if (andata) return;
      andata = true;
      this.prese -= 1;
      const quante = (this.presePer.get(da) || 1) - 1;
      if (quante > 0) this.presePer.set(da, quante);
      else this.presePer.delete(da);
    };
  }

  /* Mandare, ma non all'infinito: se chi sta dall'altra parte non legge e la
   * coda ha passato la soglia, il filo si chiude invece di crescere. */
  manda(presa, testo) {
    const inCoda = Number(presa?.socket?.writableLength || 0);
    if (inCoda > this.codaMassima) {
      presa.chiudi(RIPROVA_PIU_TARDI, "troppo indietro nel leggere");
      return false;
    }
    return presa.manda(testo);
  }

  /* ─── Una casa si presenta ───────────────────────────────────────────── */

  accogliUnaCasa(presa, { da = "?" } = {}) {
    const casa = new CasaCollegata(this, presa, da);
    casa.avvia();
    return casa;
  }

  /* Il telefono deve dire la prima parola entro poco, e deve dirla in testo.
   * Vale per tutti e due i modi di arrivare — alla propria casa o in
   * abbinamento — e si arma prima di cercare la casa, cosi' anche un canale
   * rifiutato non resta appeso. */
  _sorvegliaIlTelefono(presa) {
    const zitto = setTimeout(() => {
      presa.chiudi(CHIUSURA.normale, "nessuna parola dal telefono");
    }, this.attesaDellaPrimaParola);
    zitto.unref?.();
    return () => clearTimeout(zitto);
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
    return casa.apriUnCanale(presa, da, this._sorvegliaIlTelefono(presa), "telefono");
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
    return casa.apriUnCanale(presa, da, this._sorvegliaIlTelefono(presa), "abbinamento");
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
    this._attesa = null;
  }

  get entrata() {
    return this.id !== null;
  }

  avvia() {
    this.presa.onMessaggio = (testo) => this._dallaCasa(testo);
    this.presa.onChiusa = () => this._finita();
    /* Una casa che non si presenta non e' una casa: e' un filo che occupa un
     * posto. La casa vera il `sono-io` lo manda appena aperto. */
    this._attesa = setTimeout(() => {
      if (!this.entrata && !this.chiusa) this.chiudi("non ti sei presentata in tempo");
    }, this.centralino.attesaDellaPresentazione);
    this._attesa.unref?.();
  }

  _manda(testo) {
    return this.centralino.manda(this.presa, testo);
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
      case "battito":
        /* Il colpetto della casa, rimandato indietro. Non serve a questo
         * centralino — lui le case le pinga per conto suo — ma serve a lei:
         * e' cosi' che si accorge di un filo morto senza chiusura, e quel
         * filo e' dietro il suo router, non dietro il nostro. */
        this._manda(testo);
        return;
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
    const esito = this.centralino.case.esito(detto.casa, detto.segreto, { da: this.da });
    if (esito === "troppe") {
      /* Non un no: troppe case nuove in quest'ora, da qui o in tutto. Non si
       * dice «no» — il ponte smetterebbe per sempre — si chiude come una
       * caduta, e lui ribussa con calma piu' tardi. */
      this.centralino.registro.attenzione(`troppe case nuove: ${this.da} aspetta`);
      this.chiusa = true;
      clearTimeout(this._attesa);
      this.presa.chiudi(RIPROVA_PIU_TARDI, "troppe case nuove: riprova piu' tardi");
      return;
    }
    if (esito !== "entra") {
      this.centralino.registro.attenzione(`casa rifiutata da ${this.da}`);
      this._rifiuta("non ti riconosco");
      return;
    }
    clearTimeout(this._attesa);

    /* Una casa sola per identificativo. Chi arriva secondo prende il posto del
     * primo, e non il contrario: il primo puo' essere un filo morto che
     * nessuno ha ancora dichiarato tale, e la casa vera che si riaggancia non
     * deve restare fuori per colpa del proprio fantasma. */
    const gia = this.centralino.collegate.get(detto.casa);
    if (gia && gia !== this) gia.chiudi("questa casa si e' ricollegata");

    this.id = detto.casa;
    this.centralino.collegate.set(this.id, this);
    this._manda(JSON.stringify({ t: "bene" }));
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
    clearTimeout(this._attesa);
    this._staccaDalCentralino();
    /* 1008 e' «non per la rete, per la politica»: il ponte lo legge come
     * definitivo anche se il messaggio andasse perso. */
    this.presa.chiudi(1008, perche);
  }

  _apriUnAbbinamento(impronta) {
    if (typeof impronta !== "string" || !/^[0-9a-f]{64}$/.test(impronta)) return;
    /* Un'impronta gia' presa da un'altra casa, ancora collegata e ancora nel
     * suo tempo, resta sua. Chi arriva secondo con la stessa impronta non ha
     * fabbricato lui quel codice — i codici sono ottanta bit di caso — e
     * lasciarglielo riscrivere vorrebbe dire mandare a lui il telefono che
     * si sta abbinando all'altra. */
    const gia = this.centralino.abbinamenti.get(impronta);
    if (
      gia &&
      gia.casa !== this.id &&
      gia.scadeIl > this.centralino.adesso() &&
      this.centralino.collegate.has(gia.casa)
    ) {
      this.centralino.registro.attenzione(`un'impronta gia' presa da un'altra casa: ${this.da}`);
      return;
    }
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

  /* `via` dice alla casa da quale porta e' entrato il telefono: da
   * `/telefono/<casa>` arriva chi e' gia' abbinato, da `/abbinamento/<impronta>`
   * chi si sta abbinando. La casa lo usa per accettare la stretta
   * dell'abbinamento solo dalla seconda. */
  apriUnCanale(presaDelTelefono, da, haParlato = () => {}, via = "telefono") {
    if (this.canali.size >= TELEFONI_PER_CASA) {
      haParlato();
      presaDelTelefono.chiudi(CHIUSURA.normale, "troppi telefoni su questa casa");
      return null;
    }
    const numero = this.prossimoCanale++;
    /* `via` si tiene anche qui, non solo mandato alla casa: e' l'unico modo di
     * distinguere poi un'app aperta da un abbinamento in corso. */
    const canale = { numero, presa: presaDelTelefono, da, via };
    this.canali.set(numero, canale);

    presaDelTelefono.onMessaggio = (testo, eraTesto = typeof testo === "string") => {
      haParlato();
      if (this.chiusa) return;
      /* Il telefono parla in testo, sempre: un telaio binario non e' suo. */
      if (!eraTesto || typeof testo !== "string") {
        presaDelTelefono.chiudi(DATI_NON_ACCETTATI, "solo testo");
        return;
      }
      const busta = JSON.stringify({ c: numero, t: "d", m: testo });
      if (Buffer.byteLength(busta) > BUSTA_MASSIMA) {
        presaDelTelefono.chiudi(CHIUSURA.troppoGrande, "messaggio troppo grande");
        return;
      }
      this._manda(busta);
    };
    presaDelTelefono.onChiusa = () => {
      haParlato();
      if (!this.canali.delete(numero)) return;
      if (!this.chiusa) this._manda(JSON.stringify({ c: numero, t: "chiudi" }));
    };

    this._manda(JSON.stringify({ c: numero, t: "apri", da, via }));
    return canale;
  }

  _versoIlTelefono(numero, messaggio) {
    const canale = this.canali.get(numero);
    if (!canale || typeof messaggio !== "string") return;
    this.centralino.manda(canale.presa, messaggio);
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
    clearTimeout(this._attesa);
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
    clearTimeout(this._attesa);
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
