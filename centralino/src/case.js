/* Le case che il centralino conosce.
 *
 * Una casa si presenta con un identificativo che si e' fabbricata da sola —
 * `casa_` e trentadue cifre esadecimali — e un segreto. Di quel segreto qui
 * resta solo l'impronta: chi legge questo file non entra in casa di nessuno.
 *
 * La prima che si presenta con un identificativo se lo prende, e da li' in poi
 * quell'identificativo e' suo. Chi se lo prendesse al posto suo non ci
 * guadagnerebbe chiavi ne' segni: tra telefono e casa tutto viaggia cifrato da
 * un capo all'altro, e il centralino passa byte che non sa leggere. Quello che
 * otterrebbe e' di **sbarrare la strada**: i telefoni che bussano finirebbero
 * da lui, dove non concludono niente, e la casa vera verrebbe rifiutata come
 * un'impostora. Non e' un furto, e' una casa irraggiungibile da fuori — ed e'
 * questo che il centralino deve difendere, perche' tutto il resto lo verifica
 * il ponte per conto suo.
 *
 * Per lo stesso motivo un identificativo, una volta preso, non torna libero:
 * nemmeno quando la casa tace da mesi (vedi `potatura`).
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
 * le fabbrica: ogni casa nuova e' una riga in piu' sul disco, e una volta nata
 * il suo identificativo non torna libero da solo (`potatura`). */
export const CASE_NUOVE_PER_INDIRIZZO = 20;
export const CASE_NUOVE_IN_TUTTO = 500;

/* Quante case addormentate si ricordano al piu'. Una, sul disco, e' sui
 * duecento byte, quindi duecentomila stanno in una quarantina di mega:
 * abbastanza per tutte le installazioni vere, e un tetto per chi le fabbrica
 * apposta. */
export const ADDORMENTATE_AL_PIU = 200_000;

export const CASA_VALIDA = /^casa_[0-9a-f]{32}$/;

export class Case {
  constructor({
    cartella = "/dati",
    giorniDiSilenzio = 180,
    adesso = () => Date.now(),
    nuovePerIndirizzo = CASE_NUOVE_PER_INDIRIZZO,
    nuoveInTutto = CASE_NUOVE_IN_TUTTO,
    scritturaAlPiuOgni = SCRITTURA_AL_PIU_OGNI,
    addormentateAlPiu = ADDORMENTATE_AL_PIU,
  } = {}) {
    this.giorniDiSilenzio = giorniDiSilenzio;
    this.addormentateAlPiu = addormentateAlPiu;
    this.adesso = adesso;
    this.archivio = new Archivio(join(cartella, "case.json"), { case: [], addormentate: [] });
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

  /* Le case potate: tacciono da troppo per contarle, ma il loro
   * identificativo resta loro. Un file scritto prima che ci fossero non ha
   * questa voce, e la si fa nascere vuota. */
  get addormentate() {
    if (!Array.isArray(this.archivio.dati.addormentate)) this.archivio.dati.addormentate = [];
    return this.archivio.dati.addormentate;
  }

  /* Un indice per identificativo, di fianco a ciascun elenco: gli elenchi
   * sono quello che va sul disco, gli indici sono per trovarle senza
   * scorrerle tutte a ogni casa che bussa. Se per qualche motivo una casa
   * sta in tutti e due gli elenchi, vale quella sveglia. */
  _indice() {
    this._perId = new Map();
    for (const una of this.lista) this._perId.set(una.id, una);
    this._dormono = new Map();
    for (const una of this.addormentate) {
      if (!this._perId.has(una.id)) this._dormono.set(una.id, una);
    }
  }

  /* Quante case vive: quelle addormentate non si contano. */
  quante() {
    return this.lista.length;
  }

  /* La casa con quell'identificativo, sveglia o addormentata: per chi chiede
   * «e' di qualcuno?» la risposta e' la stessa. */
  quella(id) {
    return this._perId.get(id) ?? this._dormono.get(id) ?? null;
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

    const addormentata = this._dormono.get(id);
    if (addormentata) {
      if (!stessoSegreto(addormentata.impronta, impronta(segreto))) return "no";
      this._sveglia(addormentata);
      return "entra";
    }

    const esistente = this._perId.get(id);
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

  /* Una casa addormentata che torna col suo segreto: di nuovo tra le vive,
   * con la data di nascita di sempre. Non e' una casa nuova, e il freno delle
   * nascite non la riguarda. */
  _sveglia(una) {
    this.archivio.dati.addormentate = this.addormentate.filter((altra) => altra.id !== una.id);
    this._dormono.delete(una.id);
    const sveglia = {
      id: una.id,
      impronta: una.impronta,
      natoIl: una.natoIl,
      vistoIl: this.adesso(),
    };
    this.lista.push(sveglia);
    this._perId.set(una.id, sveglia);
    this._salvaPresto();
  }

  /* Le case sparite da troppo tempo smettono di contare, ma non smettono di
   * essere loro.
   *
   * Una casa che tace da `giorniDiSilenzio` esce dall'elenco delle vive — non
   * e' piu' un'installazione «in giro» — e passa tra le addormentate, dove di
   * lei resta l'essenziale: identificativo, impronta del segreto, quando e'
   * nata e quando si e' vista l'ultima volta. Se l'identificativo tornasse
   * libero, chiunque lo conosca — e non e' un segreto, viaggia negli
   * indirizzi — potrebbe prenderselo, e la casa vera al suo ritorno verrebbe
   * rifiutata. Cosi' invece torna quando vuole, e un altro resta fuori.
   *
   * Le addormentate non scadono col tempo. Hanno solo un tetto,
   * `addormentateAlPiu`, che c'e' per chi le fabbricasse a raffica: oltre quel
   * numero si dimenticano per prime quelle vissute meno — nate e sparite nel
   * giro di poco, com'e' una casa fabbricata — e a parita' quelle sparite da
   * piu' tempo. Una casa vera, rimasta accesa per mesi, e' l'ultima ad
   * andarsene; il tetto e' largo abbastanza che, finche' nessuno ne fabbrica
   * a centinaia di migliaia, non se ne va nessuna. */
  potatura() {
    if (!this.giorniDiSilenzio) return 0;
    const limite = this.adesso() - this.giorniDiSilenzio * GIORNO;
    const vive = [];
    const andate = [];
    for (const una of this.lista) ((una.vistoIl || 0) >= limite ? vive : andate).push(una);
    const dimenticate = this._dimentica(andate);
    if (andate.length || dimenticate) {
      this.archivio.dati.case = vive;
      this._indice();
      this._salva();
    }
    return andate.length;
  }

  /* Mette le appena potate tra le addormentate, e se si passa il tetto
   * dimentica quelle che lo meritano di piu'. Torna quante ne ha dimenticate. */
  _dimentica(andate) {
    const tutte = this.addormentate;
    for (const una of andate) {
      tutte.push({ id: una.id, impronta: una.impronta, natoIl: una.natoIl, vistoIl: una.vistoIl });
    }
    const troppe = tutte.length - this.addormentateAlPiu;
    if (troppe <= 0) return 0;
    const vissuta = (una) => (una.vistoIl || 0) - (una.natoIl || 0);
    tutte.sort((a, b) => vissuta(b) - vissuta(a) || (b.vistoIl || 0) - (a.vistoIl || 0));
    tutte.length = this.addormentateAlPiu;
    return troppe;
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
