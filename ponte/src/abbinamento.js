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

import { codiceNuovo, codicePulito, impronta, stessoSegreto } from "./segreti.js";

const MINUTO = 60 * 1000;

/* Un codice di otto lettere non si indovina, ma nessuno deve poterci provare
 * a raffica: dopo dieci tentativi sbagliati in un quarto d'ora la porta resta
 * chiusa finche' la finestra non passa, e la console lo vede. */
const TENTATIVI_MASSIMI = 10;
const FINESTRA_DEI_TENTATIVI = 15 * MINUTO;

export class Abbinamento {
  constructor({ minutiDelCodice = 5, adesso = () => Date.now() } = {}) {
    this.minutiDelCodice = minutiDelCodice;
    this.adesso = adesso;
    this._codice = null;
    this._sbagliati = [];
  }

  /* Fabbrica un codice nuovo e spegne quello di prima. */
  nuovo() {
    const codice = codiceNuovo(8);
    this._codice = {
      impronta: impronta(codice),
      scadeIl: this.adesso() + this.minutiDelCodice * MINUTO,
    };
    /* Un codice nuovo azzera i tentativi: chi lo ha appena fabbricato sta
     * guardando lo schermo, e non deve pagare per chi ha bussato prima. */
    this._sbagliati = [];
    return { codice, scadeIl: this._codice.scadeIl };
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
      tentativiSbagliati: this._sbagliati.length,
      bloccatoFinoA,
    };
  }

  /* Consuma il codice. Solleva con un motivo leggibile invece di tornare
   * `false`: chi chiama deve poter dire all'utente *perche'* non e' entrato,
   * e «codice sbagliato» e «troppi tentativi» sono due cose diverse. */
  consuma(scritto) {
    const bloccatoFinoA = this._bloccatoFinoA();
    if (bloccatoFinoA) throw new TroppiTentativi("troppi tentativi", bloccatoFinoA);

    this._scadenza();
    if (!this._codice) throw new CodiceSbagliato("nessun codice di abbinamento e' attivo");

    if (!stessoSegreto(this._codice.impronta, impronta(codicePulito(scritto)))) {
      this._sbagliati.push(this.adesso());
      throw new CodiceSbagliato("codice sbagliato");
    }

    /* Usato una volta e finito. Un codice che resta buono fino alla scadenza
     * abbina due telefoni se qualcuno lo legge da sopra la spalla. */
    this._codice = null;
    this._sbagliati = [];
    return true;
  }

  _scadenza() {
    if (this._codice && this._codice.scadeIl <= this.adesso()) this._codice = null;
  }

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
