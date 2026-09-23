/* L'abbinamento: come un telefono entra la prima volta.
 *
 * Il codice nasce **solo dalla console**, cioe' dalla pagina che Home
 * Assistant serve dietro la propria autenticazione. Sulla porta dell'app non
 * c'e' nessuna via per farne nascere uno: da li' si puo' soltanto presentarne
 * uno che esiste gia'. Questa e' la differenza fra un ponte e una porta
 * aperta, ed e' il motivo per cui l'add-on ascolta su due porte diverse.
 *
 * Ne vive uno per volta. Una console che ne fabbrica un altro spegne il
 * precedente: due codici buoni insieme sono due modi di entrare, e uno dei due
 * e' sempre quello che qualcuno si e' dimenticato aperto.
 */

import { gruppoDellIndirizzo } from "./presa.js";
import { codiceNuovo, codicePulito, impronta, stessoSegreto } from "./segreti.js";

const MINUTO = 60 * 1000;

/* Il codice non si indovina, ma nessuno deve poterci provare a raffica.
 *
 * I tentativi si contano **per chi bussa** — l'indirizzo da cui arriva, o
 * quello che dice il centralino — e poi tutti insieme. Contarli solo tutti
 * insieme, come si faceva, voleva dire che dieci tentativi sbagliati di un
 * estraneo chiudevano la porta anche a chi aveva il codice vero in mano e
 * stava davanti allo schermo. Cosi' chi sbaglia si chiude la porta da solo, e
 * gli altri no.
 *
 * Il tetto di tutti insieme resta, ma alto: e' una rete sotto la rete. Il
 * codice e' di ottanta bit e vive cinque minuti, e non e' il tetto a
 * renderlo difficile da indovinare. */
const TENTATIVI_PER_CHI = 5;
const TENTATIVI_MASSIMI = 50;
const FINESTRA_DEI_TENTATIVI = 15 * MINUTO;

/* Quanti «chi» diversi si ricordano al massimo. Chi bussa puo' dire di essere
 * chiunque — passando dal centralino l'indirizzo lo dice il centralino — e
 * un elenco senza fondo sarebbe un altro modo di riempire la memoria. */
const CHI_RICORDATI = 1000;

/* L'identificativo di un utente di Home Assistant: trentadue cifre
 * esadecimali. Tenere solo quella forma vuol dire che nessuno ci scrive dentro
 * una frase, e che un valore arrivato storto diventa «non si sa di chi e'» —
 * cioe' vede tutto, come prima — invece di un fantasma che non corrisponde a
 * nessuno e non apre niente. */
function utentePulito(chi) {
  const detto = String(chi || "").trim();
  return /^[a-f0-9]{32}$/i.test(detto) ? detto : "";
}

export class Abbinamento {
  constructor({ minutiDelCodice = 5, adesso = () => Date.now() } = {}) {
    this.minutiDelCodice = minutiDelCodice;
    this.adesso = adesso;
    this._codice = null;
    /* Quando, tutti insieme; e quando, per chi. */
    this._sbagliati = [];
    this._perChi = new Map();
  }

  /* Fabbrica un codice nuovo e spegne quello di prima.
   *
   * `utente` e' **per chi** e' questo codice: l'identificativo dell'utente di
   * Home Assistant a cui il telefono che lo usera' sara' intestato.
   *
   * Serve per una cosa sola, ed e' la riga che tiene in piedi «chi vede quale
   * plancia» anche nell'app. Il QR abbina un **telefono**, non un utente: quel
   * telefono poi chiede le plance al filo, e senza questa riga se le prende
   * tutte — comprese quelle riservate a qualcun altro. Con questa riga il
   * telefono eredita un utente, e vede quello che vede lui.
   *
   * Vuoto vuol dire «non si sa di chi e'», e un telefono senza utente vede
   * tutto: e' come sono i telefoni abbinati prima di oggi, e non si spengono
   * a tradimento. */
  nuovo(utente = "") {
    const codice = codiceNuovo();
    this._codice = {
      /* Il codice **in chiaro**, e solo qui.
       *
       * Altrove in questo progetto i segreti si tengono per impronta, e resta
       * la regola: il segno di un telefono, che vive per anni e sta su un
       * disco, non si conserva mai leggibile. Questo vive cinque minuti, non
       * tocca nessun file, e serve a ridisegnarlo — chi ricarica la pagina
       * della console mentre il codice e' ancora buono deve rivederlo, non
       * doverne fabbricare un altro. Tenerlo per impronta vorrebbe dire
       * buttare via un codice valido per niente. */
      codice,
      impronta: impronta(codice),
      scadeIl: this.adesso() + this.minutiDelCodice * MINUTO,
      utente: utentePulito(utente),
    };
    /* Un codice nuovo azzera i tentativi: chi lo ha appena fabbricato sta
     * guardando lo schermo, e non deve pagare per chi ha bussato prima. */
    this._sbagliati = [];
    this._perChi.clear();
    return { codice, scadeIl: this._codice.scadeIl, utente: this._codice.utente };
  }

  /* Il codice vivo, per chi lo deve rimettere a schermo. Non esce mai dalla
   * console: quella sta dietro l'autenticazione di Home Assistant, ed e' lo
   * stesso posto dove il codice era gia' scritto. */
  vivo() {
    this._scadenza();
    if (!this._codice) return null;
    return {
      codice: this._codice.codice,
      scadeIl: this._codice.scadeIl,
      utente: this._codice.utente,
    };
  }

  annulla() {
    const cera = Boolean(this._codice);
    this._codice = null;
    return cera;
  }

  /* Quanto manca al codice vivo, senza dire quale sia. */
  stato() {
    this._scadenza();
    const bloccatoFinoA = this._bloccatoFinoA();
    return {
      attivo: Boolean(this._codice),
      scadeIl: this._codice?.scadeIl ?? null,
      utente: this._codice?.utente ?? "",
      tentativiSbagliati: this._sbagliati.length,
      bloccatoFinoA,
    };
  }

  /* Consuma il codice. Solleva con un motivo leggibile invece di tornare
   * `false`: chi chiama deve poter dire all'utente *perche'* non e' entrato,
   * e «codice sbagliato» e «troppi tentativi» sono due cose diverse.
   *
   * `da` e' chi bussa: i tentativi sbagliati si contano anche per lui. */
  consuma(scritto, { da = "?" } = {}) {
    /* Qui conta solo il tetto di chi bussa: chi arriva a `consuma` il codice
     * lo sta presentando, e il tetto di tutti insieme — che si riempie anche
     * da fuori — non deve lasciare fuori proprio chi ce l'ha in mano. */
    const bloccatoFinoA = this._suoBlocco(gruppoDellIndirizzo(da));
    if (bloccatoFinoA) throw new TroppiTentativi("troppi tentativi", bloccatoFinoA);

    this._scadenza();
    if (!this._codice) throw new CodiceSbagliato("nessun codice di abbinamento e' attivo");

    if (!stessoSegreto(this._codice.impronta, impronta(codicePulito(scritto)))) {
      this.sbagliato(da);
      throw new CodiceSbagliato("codice sbagliato");
    }

    /* Usato una volta e finito. Un codice che resta buono fino alla scadenza
     * abbina due telefoni se qualcuno lo legge da sopra la spalla.
     *
     * Torna **per chi era**, e non `true`: il telefono va intestato a quello
     * li', e questo e' l'unico posto che lo sa. Chi chiama lo passa a
     * `dispositivi.abbina`. Resta vero come prima per chi lo usava come un
     * sì — una stringa vuota non e' falsa, ma un oggetto sì lo e' sempre. */
    const utente = this._codice.utente;
    this._codice = null;
    this._sbagliati = [];
    this._perChi.clear();
    return { utente };
  }

  /* Un tentativo andato male che non e' passato da `consuma`: e' la stretta
   * di mano dell'abbinamento, dove il codice non viaggia e un codice
   * sbagliato si vede da una busta che non si apre. Conta uguale. */
  sbagliato(da = "?") {
    const ora = this.adesso();
    this._sbagliati.push(ora);
    const chi = gruppoDellIndirizzo(da);
    const suoi = this._perChi.get(chi) ?? [];
    suoi.push(ora);
    /* Tolto e rimesso: cosi' l'ordine della mappa e' quello dell'ultimo
     * tentativo, e quando e' piena se ne va chi non si fa vivo da piu' tempo. */
    this._perChi.delete(chi);
    this._perChi.set(chi, suoi);
    while (this._perChi.size > CHI_RICORDATI) {
      this._perChi.delete(this._perChi.keys().next().value);
    }
  }

  /* Fino a quando `da` deve aspettare, o `null` se puo' provare.
   *
   * Il tetto suo vale sempre. Quello di tutti insieme vale solo per chi ha
   * gia' sbagliato di recente: si riempie anche da fuori, a raffica, e se
   * valesse per tutti bloccherebbe proprio chi sta davanti allo schermo col
   * codice giusto e non ha ancora provato. Gli IPv6 si contano per `/64`. */
  bloccato(da = "?") {
    const chi = gruppoDellIndirizzo(da);
    const suo = this._suoBlocco(chi);
    if (!this._perChi.has(chi)) return suo;
    const tutti = this._bloccatoFinoA();
    if (tutti == null) return suo;
    if (suo == null) return tutti;
    return Math.max(tutti, suo);
  }

  _suoBlocco(chi) {
    const ora = this.adesso();
    const suoi = (this._perChi.get(chi) ?? []).filter(
      (quando) => ora - quando < FINESTRA_DEI_TENTATIVI,
    );
    if (suoi.length) this._perChi.set(chi, suoi);
    else this._perChi.delete(chi);
    return suoi.length >= TENTATIVI_PER_CHI ? suoi[0] + FINESTRA_DEI_TENTATIVI : null;
  }

  _scadenza() {
    if (this._codice && this._codice.scadeIl <= this.adesso()) this._codice = null;
  }

  /* Il blocco di tutti insieme. */
  _bloccatoFinoA() {
    const ora = this.adesso();
    this._sbagliati = this._sbagliati.filter((quando) => ora - quando < FINESTRA_DEI_TENTATIVI);
    if (this._sbagliati.length < TENTATIVI_MASSIMI) return null;
    return this._sbagliati[0] + FINESTRA_DEI_TENTATIVI;
  }
}

export class CodiceSbagliato extends Error {}

export class TroppiTentativi extends Error {
  constructor(messaggio, finoA) {
    super(messaggio);
    this.finoA = finoA;
  }
}
