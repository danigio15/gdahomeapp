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
import { Freno } from "./freno.js";
import { impronta, stessoSegreto } from "./segreti.js";

const GIORNO = 24 * 60 * 60 * 1000;

/* Ogni quanto l'ora dell'ultima visita puo' finire sul disco. Una casa e'
 * collegata sempre: scrivere a ogni riaggancio sarebbe fatica per niente. */
const VISITA_SUL_DISCO = 10 * 60 * 1000;

/* Quanto al piu' spesso l'elenco finisce sul disco quando nascono case nuove.
 * L'archivio riscrive il file intero, e lo fa fermando tutto il resto: a una
 * casa nuova ogni tanto non se ne accorge nessuno, a cento al secondo si'. La
 * prima si scrive subito; quelle che arrivano subito dopo aspettano insieme
 * il giro successivo. */
const SCRITTURA_AL_PIU_OGNI = 2_000;

/* Quante case possono **nascere** in un'ora, da uno stesso indirizzo e in
 * tutto. Una casa nasce una volta nella vita — quando si installa l'add-on —
 * quindi i numeri sono larghi per chi installa davvero e stretti per chi se
 * le fabbrica: ogni casa nuova e' una riga in piu' sul disco per sei mesi. */
export const CASE_NUOVE_PER_INDIRIZZO = 20;
export const CASE_NUOVE_IN_TUTTO = 500;

export const CASA_VALIDA = /^casa_[0-9a-f]{32}$/;

export class Case {
  constructor({
    cartella = "/dati",
    giorniDiSilenzio = 180,
    adesso = () => Date.now(),
    nuovePerIndirizzo = CASE_NUOVE_PER_INDIRIZZO,
    nuoveInTutto = CASE_NUOVE_IN_TUTTO,
    scritturaAlPiuOgni = SCRITTURA_AL_PIU_OGNI,
  } = {}) {
    this.giorniDiSilenzio = giorniDiSilenzio;
    this.adesso = adesso;
    this.archivio = new Archivio(join(cartella, "case.json"), { case: [] });
    this._visitaSalvataIl = this.adesso();
    this._scrittaIl = 0;
    this._daScrivere = null;
    this.scritturaAlPiuOgni = scritturaAlPiuOgni;
    this.nuove = new Freno({ perChi: nuovePerIndirizzo, inTutto: nuoveInTutto, adesso });
    this._indice();
    this.potatura();
  }

  get lista() {
    return this.archivio.dati.case;
  }

  /* Un indice per identificativo, di fianco all'elenco: l'elenco e' quello
   * che va sul disco, l'indice e' per trovarle senza scorrerle tutte a ogni
   * casa che bussa. */
  _indice() {
    this._perId = new Map();
    for (const una of this.lista) this._perId.set(una.id, una);
  }

  quante() {
    return this.lista.length;
  }

  quella(id) {
    return this._perId.get(id) ?? null;
  }

  /* Riconosce una casa, e la apre la prima volta che si presenta.
   *
   * Torna `true` se puo' entrare. La casa nuova nasce **qui**, presentandosi:
   * non c'e' nessuna registrazione da fare prima, e non serve — quel numero e'
   * centoventotto bit di caso, e chi lo indovina non lo ha indovinato. */
  riconosci(id, segreto, { da = "?" } = {}) {
    return this.esito(id, segreto, { da }) === "entra";
  }

  /* Come `riconosci`, ma dice anche **perche'** no: `"entra"`, `"no"`, o
   * `"troppe"` quando la casa sarebbe nuova e in quest'ora ne sono gia' nate
   * troppe — da quell'indirizzo o in tutto. «Troppe» non e' un no: passa col
   * tempo, e chi lo riceve deve poter riprovare. */
  esito(id, segreto, { da = "?" } = {}) {
    if (!CASA_VALIDA.test(String(id ?? ""))) return "no";
    if (typeof segreto !== "string" || segreto.length < 32) return "no";

    const esistente = this.quella(id);
    if (!esistente) {
      if (!this.nuove.concedi(da)) return "troppe";
      const nuova = {
        id,
        impronta: impronta(segreto),
        natoIl: this.adesso(),
        vistoIl: this.adesso(),
      };
      this.lista.push(nuova);
      this._perId.set(id, nuova);
      this._salvaPresto();
      return "entra";
    }
    if (!stessoSegreto(esistente.impronta, impronta(segreto))) return "no";
    esistente.vistoIl = this.adesso();
    this._forseSalva();
    return "entra";
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
    if (andate) {
      this._indice();
      this._salva();
    }
    return andate;
  }

  _forseSalva() {
    const ora = this.adesso();
    if (ora - this._visitaSalvataIl < VISITA_SUL_DISCO) return;
    this._visitaSalvataIl = ora;
    this._salvaPresto();
  }

  /* Subito, se l'ultima scrittura e' abbastanza lontana; se no, una sola
   * scrittura al giro dopo per tutte quelle che sono arrivate nel frattempo.
   * Il tempo qui e' quello vero e non `adesso`: e' un'attesa, non una data. */
  _salvaPresto() {
    if (this._daScrivere) return;
    const passato = Date.now() - this._scrittaIl;
    if (passato >= this.scritturaAlPiuOgni) {
      this._salva();
      return;
    }
    this._daScrivere = setTimeout(() => {
      try {
        this._salva();
      } catch (_errore) {
        /* Un disco che dice no dentro un'attesa non deve far cadere il
         * centralino: le case restano in memoria, e la prossima scrittura
         * le porta tutte. */
      }
    }, this.scritturaAlPiuOgni - passato);
    this._daScrivere.unref?.();
  }

  _salva() {
    clearTimeout(this._daScrivere);
    this._daScrivere = null;
    this._scrittaIl = Date.now();
    this.archivio.salva();
  }

  /* Quello che aspetta di essere scritto si scrive adesso: chi spegne il
   * centralino non deve perdere le case nate nell'ultimo secondo. */
  chiudi() {
    if (this._daScrivere) this._salva();
  }
}
