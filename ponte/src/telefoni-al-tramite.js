/* Quanti telefoni, e con quale app, detto al tramite.
 *
 * «Continuo a non vedere le app installate dagli utenti.» Le versioni
 * dell'app il quadro le sapeva solo dal rapporto (`rapporto.js`), e il
 * rapporto parte spento: su 178 case accese ne arrivavano sei telefoni. Il
 * filo verso il tramite invece lo apre ogni casa da sola (`chiamata.js`), e
 * allora il conto passa anche di li': appena entrata e poi ogni ora, la casa
 * dice al centralino
 *
 *     {t: "telefoni", visti7gg, versioni, rapporto}
 *
 * cioe' quanti telefoni si sono fatti vedere nella settimana, per negozio e
 * versione dell'app. E' lo stesso conto del rapporto (`iTelefoni`): **niente
 * nomi, modelli, identificativi dei telefoni o di chi li usa**. Il centralino
 * lo somma su tutte le case e il quadro legge solo la somma.
 *
 * `rapporto` dice se questa casa manda gia' il suo rapporto al quadro di
 * gdahome: li' i suoi telefoni ci sono gia', casa per casa, e il centralino
 * non li conta una seconda volta. Un rapporto che va al quadro di un altro
 * (un installatore col suo) non conta: quello di gdahome non lo vede.
 */

import { iTelefoni } from "./rapporto.js";

export const OGNI_ORA = 60 * 60 * 1000;

/* Come il centralino vuole scritta una versione (`centralino/src/telefoni.js`). */
const VERSIONE = /^[0-9A-Za-z.+_-]{0,40}$/;

/** Il messaggio, da quello che sa la casa adesso. */
export function iTelefoniPerIlTramite({ dispositivi, rapporto = false, adesso = Date.now }) {
  const { visti7gg, versioni } = iTelefoni(dispositivi, adesso);
  return {
    visti7gg,
    /* Il centralino butta il conto intero se una versione e' scritta
     * strana: qui una versione che non e' cifre, lettere, punti e trattini
     * diventa «non detta», e il resto arriva. */
    versioni: versioni.map((una) => ({
      ...una,
      versione: VERSIONE.test(una.versione) ? una.versione : "",
    })),
    rapporto: rapporto === true,
  };
}

export class TelefoniAlTramite {
  constructor({
    chiamata,
    dispositivi,
    rapporto = () => false,
    ogni = OGNI_ORA,
    adesso = Date.now,
  }) {
    this.chiamata = chiamata;
    this.dispositivi = dispositivi;
    this.rapporto = rapporto;
    this.ogni = ogni;
    this.adesso = adesso;
    this._orologio = null;
  }

  /* Il conto di adesso, consegnato alla chiamata: lo manda subito se il filo
   * e' su, e a ogni entrata dopo. */
  dillo() {
    try {
      this.chiamata.diITelefoni(
        iTelefoniPerIlTramite({
          dispositivi: this.dispositivi,
          rapporto: Boolean(this.rapporto()),
          adesso: this.adesso,
        }),
      );
    } catch (_errore) {
      /* Un conto che non si fa non ferma niente: si riprova al giro dopo. */
    }
  }

  parti() {
    if (this._orologio) return;
    this.dillo();
    this._orologio = setInterval(() => this.dillo(), this.ogni);
    this._orologio.unref?.();
  }

  ferma() {
    if (this._orologio) clearInterval(this._orologio);
    this._orologio = null;
  }
}
