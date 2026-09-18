/* Il giro degli avvisi: passa, guarda, e semmai dice qualcosa.
 *
 * Mette insieme le due meta' — `avvisi.js` che decide, `fattorino.js` che
 * consegna — e le fa girare ogni tanto, una volta per installatore.
 *
 * ─── Perche' una volta per installatore, e non una per tutte ─────────────
 *
 * Perche' la regola del «tacciono in tanti insieme» si misura sugli impianti **di
 * uno**: otto su dodici di Rossi sono un guasto suo da guardare in grande;
 * otto su quattrocento di tutto il quadro non vogliono dire niente e non
 * direbbero niente a nessuno. Un calcolo che mescolasse gli installatori
 * darebbe a ognuno l'avviso sbagliato.
 *
 * ─── Il segno si mette solo se il messaggio e' partito ───────────────────
 *
 * `avvisataIl` si scrive **dopo** la consegna, e solo se e' riuscita. Scriverlo
 * prima vorrebbe dire che un indirizzo sbagliato per mezz'ora si mangia gli
 * avvisi di quella mezz'ora per sempre: la casa resterebbe segnata come «gia'
 * detto» senza che nessuno l'abbia mai saputo.
 */

import { chiTace, cosaDire, siamoStatiViaNoi, TACE_DOPO } from "./avvisi.js";
import { Fattorino } from "./fattorino.js";

/** Ogni quanto passa il giro. */
export const OGNI = 10 * 60 * 1000;

export class Giro {
  constructor({
    case: case_,
    installatori,
    fattorino = new Fattorino(),
    tacePer = TACE_DOPO,
    adesso = () => Date.now(),
    registro = { debug() {}, info() {}, attenzione() {}, errore() {} },
  }) {
    this.case = case_;
    this.installatori = installatori;
    this.fattorino = fattorino;
    this.tacePer = tacePer;
    this.adesso = adesso;
    this.registro = registro;
    this.ultimoGiro = null;
    this.giro = null;
  }

  parti() {
    if (this.giro) return;
    this.giro = setInterval(() => {
      this.passa().catch((errore) => {
        this.registro.errore(`il giro degli avvisi e' inciampato: ${errore?.message || errore}`);
      });
    }, OGNI);
    this.giro.unref?.();
  }

  ferma() {
    clearInterval(this.giro);
    this.giro = null;
  }

  /**
   * Un giro. Torna quanti messaggi sono partiti, che serve alle prove.
   */
  async passa() {
    const ora = this.adesso();

    /* Se siamo stati via noi, questo giro non dice niente: si rimette in pari e
     * guarda dal prossimo. Vale anche al primo giro dopo l'accensione — un
     * quadro appena acceso non sa cosa e' successo mentre era spento, e la
     * prima cosa che fa non puo' essere svegliare qualcuno. */
    if (siamoStatiViaNoi(this.ultimoGiro, ora, this.tacePer)) {
      if (this.ultimoGiro) {
        this.registro.attenzione(
          "questo quadro e' stato fermo piu' a lungo del silenzio che cerca: " +
            "questo giro non avvisa nessuno, perche' il silenzio era il nostro",
        );
      }
      this.ultimoGiro = ora;
      /* Le case che nel frattempo sono tornate a parlare si dimenticano lo
       * stesso: quello e' un segno da togliere, non un messaggio da mandare. */
      this._dimenticaChiEtornato(ora);
      return 0;
    }
    this.ultimoGiro = ora;

    let partiti = 0;
    for (const uno of this.installatori.lista) {
      partiti += await this._perUno(uno, ora);
    }
    return partiti;
  }

  async _perUno(uno, ora) {
    const sue = this.case.lista.filter((una) => una.di === uno.chi);
    if (!sue.length) return 0;

    const { mute, tornate } = chiTace(sue, { tacePer: this.tacePer, adesso: ora });
    if (!mute.length && !tornate.length) return 0;

    /* Chi non ha detto dove vuole essere avvisato non riceve niente — ma le sue
     * case che sono tornate a parlare si dimenticano lo stesso, se no il giorno
     * che accende gli avvisi si becca un mucchio di «e' tornata» di roba
     * successa mesi fa. */
    if (!uno.avvisi) {
      for (const quella of tornate) this.case.segnaAvvisata(quella.casa.casa, null);
      return 0;
    }

    let partiti = 0;
    for (const detto of cosaDire({ mute, tornate, quante: sue.length })) {
      const arrivato = await this.fattorino.porta(uno.avvisi, detto);
      if (!arrivato) continue;
      partiti += 1;
      /* Il segno si mette **dopo**, e solo se e' partito. */
      for (const casa of detto.case) {
        this.case.segnaAvvisata(casa, detto.tipo === "tornata" ? null : ora);
      }
    }
    if (partiti) this.registro.info(`${partiti} avvisi mandati a ${uno.nome || uno.chi}`);
    return partiti;
  }

  _dimenticaChiEtornato(ora) {
    for (const una of this.case.lista) {
      if (!una.avvisataIl) continue;
      const { tornate } = chiTace([una], { tacePer: this.tacePer, adesso: ora });
      if (tornate.length) this.case.segnaAvvisata(una.casa, null);
    }
  }
}
