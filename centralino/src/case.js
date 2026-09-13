/* Le case che il centralino conosce.
 *
 * Una casa si presenta con un identificativo che si e' fabbricata da sola —
 * `casa_` e trentadue cifre esadecimali — e un segreto. Di quel segreto qui
 * resta solo l'impronta: chi legge questo file non entra in casa di nessuno.
 *
 * La prima che si presenta con un identificativo se lo prende, e da li' in poi
 * quell'identificativo e' suo. Senza questa regola chiunque potrebbe
 * presentarsi come una casa altrui e raccogliere i segni dei telefoni che
 * bussano: e' l'unica cosa che il centralino deve davvero difendere, perche'
 * tutto il resto lo verifica il ponte per conto suo.
 */

import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { impronta, stessoSegreto } from "./segreti.js";

const GIORNO = 24 * 60 * 60 * 1000;

/* Ogni quanto l'ora dell'ultima visita puo' finire sul disco. Una casa e'
 * collegata sempre: scrivere a ogni riaggancio sarebbe fatica per niente. */
const VISITA_SUL_DISCO = 10 * 60 * 1000;

export const CASA_VALIDA = /^casa_[0-9a-f]{32}$/;

export class Case {
  constructor({ cartella = "/dati", giorniDiSilenzio = 180, adesso = () => Date.now() } = {}) {
    this.giorniDiSilenzio = giorniDiSilenzio;
    this.adesso = adesso;
    this.archivio = new Archivio(join(cartella, "case.json"), { case: [] });
    this._visitaSalvataIl = this.adesso();
    this.potatura();
  }

  get lista() {
    return this.archivio.dati.case;
  }

  quante() {
    return this.lista.length;
  }

  quella(id) {
    return this.lista.find((una) => una.id === id) ?? null;
  }

  /* Riconosce una casa, e la apre la prima volta che si presenta.
   *
   * Torna `true` se puo' entrare. La casa nuova nasce **qui**, presentandosi:
   * non c'e' nessuna registrazione da fare prima, e non serve — quel numero e'
   * centoventotto bit di caso, e chi lo indovina non lo ha indovinato. */
  riconosci(id, segreto) {
    if (!CASA_VALIDA.test(String(id ?? ""))) return false;
    if (typeof segreto !== "string" || segreto.length < 32) return false;

    const esistente = this.quella(id);
    if (!esistente) {
      this.lista.push({
        id,
        impronta: impronta(segreto),
        natoIl: this.adesso(),
        vistoIl: this.adesso(),
      });
      this.archivio.salva();
      return true;
    }
    if (!stessoSegreto(esistente.impronta, impronta(segreto))) return false;
    esistente.vistoIl = this.adesso();
    this._forseSalva();
    return true;
  }

  /* Riconosce una casa **senza aprirla**.
   *
   * Serve allo sportello, la porta HTTP di fianco al filo: li' una casa nuova
   * non deve poter nascere. Se potesse, chi conoscesse l'identificativo di una
   * casa spenta se lo prenderebbe senza nemmeno provare ad aprirci un filo, e
   * da quel momento le segnalazioni di quella casa sarebbero sue. Dal filo la
   * prima che si presenta se lo prende, ed e' giusto; da qui no. */
  verifica(id, segreto) {
    if (!CASA_VALIDA.test(String(id ?? ""))) return false;
    if (typeof segreto !== "string" || segreto.length < 32) return false;
    const esistente = this.quella(id);
    if (!esistente) return false;
    return stessoSegreto(esistente.impronta, impronta(segreto));
  }

  /* Via le case sparite da troppo tempo: un'installazione spenta per sempre
   * non deve restare a occupare il suo identificativo in eterno. */
  potatura() {
    if (!this.giorniDiSilenzio) return 0;
    const limite = this.adesso() - this.giorniDiSilenzio * GIORNO;
    const prima = this.lista.length;
    this.archivio.dati.case = this.lista.filter((una) => (una.vistoIl || 0) >= limite);
    const andate = prima - this.lista.length;
    if (andate) this.archivio.salva();
    return andate;
  }

  _forseSalva() {
    const ora = this.adesso();
    if (ora - this._visitaSalvataIl < VISITA_SUL_DISCO) return;
    this._visitaSalvataIl = ora;
    this.archivio.salva();
  }
}
