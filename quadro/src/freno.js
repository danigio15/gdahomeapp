/* Il freno: quante volte si puo' bussare, per chi bussa.
 *
 * Un secchio per ognuno, che si riempie da solo a un passo fisso. Ogni
 * richiesta prende un gettone; a secchio vuoto la risposta e' un 429, con
 * scritto fra quanto riprovare. Il secchio ha un fondo apposta: una casa che
 * viene svegliata dal cruscotto manda un rapporto in piu' subito dopo quello
 * del minuto, e non deve sentirsi dire di no per questo.
 *
 * Tutto in memoria, e va bene cosi': un quadro che si riavvia riparte coi
 * secchi pieni, e nessuno ci perde niente.
 */

export class Freno {
  /**
   * @param {object} opzioni
   * @param {number} opzioni.quanti quanti gettoni tiene il secchio
   * @param {number} opzioni.ogni ogni quanti millisecondi ne torna uno
   * @param {number} opzioni.chiAlMassimo quanti secchi si tengono in tutto
   */
  constructor({
    quanti = 6,
    ogni = 20 * 1000,
    chiAlMassimo = 50000,
    adesso = () => Date.now(),
  } = {}) {
    this.quanti = quanti;
    this.ogni = ogni;
    this.chiAlMassimo = chiAlMassimo;
    this.adesso = adesso;
    this._secchi = new Map();
  }

  /**
   * Puo' passare? Torna `0` se si', o quanti secondi aspettare se no.
   */
  passa(chi) {
    const ora = this.adesso();
    let suo = this._secchi.get(chi);
    if (!suo) {
      /* Un tetto anche ai secchi: chi bussa con mille nomi diversi non deve
       * far crescere questa mappa per sempre. Se ne va il piu' vecchio. */
      if (this._secchi.size >= this.chiAlMassimo) {
        this._secchi.delete(this._secchi.keys().next().value);
      }
      suo = { gettoni: this.quanti, da: ora };
    } else {
      this._secchi.delete(chi);
      const tornati = Math.floor((ora - suo.da) / this.ogni);
      if (tornati > 0) {
        suo.gettoni = Math.min(this.quanti, suo.gettoni + tornati);
        suo.da = suo.gettoni >= this.quanti ? ora : suo.da + tornati * this.ogni;
      }
    }
    this._secchi.set(chi, suo);
    if (suo.gettoni > 0) {
      suo.gettoni -= 1;
      return 0;
    }
    return Math.max(1, Math.ceil((suo.da + this.ogni - ora) / 1000));
  }
}
