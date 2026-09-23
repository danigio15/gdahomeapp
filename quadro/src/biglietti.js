/* Il biglietto per aprire il cruscotto in un browser che non e' il nostro.
 *
 * «Continua a chiedere il codice da web.» Dal telefono il tasto «Apri nel
 * browser» apre il browser del sistema, e a quella scheda l'app non puo' dire
 * niente: non e' sua. La chiave nell'indirizzo non ci va — finisce nella
 * cronologia, nei segnalibri, negli schermi condivisi — e cosi' il cruscotto
 * la chiedeva a mano a chi ce l'aveva gia' in tasca.
 *
 * Il biglietto e' quello che ci va al posto suo. L'app, che la chiave ce l'ha,
 * ne chiede uno al quadro (`POST /console/biglietto`, con la chiave) e lo mette
 * nell'indirizzo; il browser lo consegna (`POST /console/entra`, senza chiave),
 * riceve la chiave e la tiene come se fosse stata battuta. Un biglietto vale
 * **un minuto** e **una volta**: letto, e' carta straccia, e in cronologia ci
 * resta quella. Chi lo trovasse dopo non apre niente.
 *
 * Stanno in memoria e basta: un quadro che si riavvia li perde, e chi aveva il
 * browser a meta' strada batte la chiave una volta, come prima.
 */

import { randomBytes } from "node:crypto";

/** Quanto vale un biglietto, in millisecondi: il tempo di aprire un browser. */
export const BIGLIETTO_DURA = 60_000;

/** Quanti biglietti in attesa puo' avere uno stesso installatore. */
export const BIGLIETTI_PER_UNO = 5;

export class Biglietti {
  constructor({ adesso = () => Date.now(), nuovo = () => randomBytes(16).toString("hex") } = {}) {
    this.adesso = adesso;
    this.nuovo = nuovo;
    this.aperti = new Map();
  }

  /** Un biglietto per `chi`, che porta la sua `chiave`. */
  stacca(chi, chiave) {
    this._butta();
    /* Oltre il tetto se ne va il piu' vecchio: cinque browser aperti in un
     * minuto non sono una persona, e una lista che cresce non e' una lista. */
    const suoi = [...this.aperti].filter(([, uno]) => uno.chi === chi).map(([codice]) => codice);
    const diTroppo = Math.max(0, suoi.length - BIGLIETTI_PER_UNO + 1);
    for (const vecchio of suoi.slice(0, diTroppo)) this.aperti.delete(vecchio);
    const biglietto = this.nuovo();
    const scade = this.adesso() + BIGLIETTO_DURA;
    this.aperti.set(biglietto, { chi, chiave: String(chiave ?? ""), scade });
    return { biglietto, scade };
  }

  /** La chiave che quel biglietto porta, una volta sola; `null` se non vale. */
  riscatta(biglietto) {
    this._butta();
    const codice = String(biglietto ?? "");
    const preso = this.aperti.get(codice);
    if (!preso) return null;
    this.aperti.delete(codice);
    return { chi: preso.chi, chiave: preso.chiave };
  }

  /** Quanti ne aspettano, per chi prova. */
  get quanti() {
    return this.aperti.size;
  }

  _butta() {
    const ora = this.adesso();
    for (const [codice, dati] of this.aperti) if (dati.scade <= ora) this.aperti.delete(codice);
  }
}

/* ─── Il gettone dell'editor della plancia ────────────────────────────────
 *
 * L'editor della plancia (`plancia-servita.js`) e' una pagina che il quadro
 * serve ma che non ha scritto lui: e' DashboardModern, con i suoi moduli. Per
 * entrare sul suo filo le serve di dire chi e', e fino a ieri lo diceva con
 * **la chiave del cruscotto**, letta dal deposito del browser. Quella chiave
 * apre tutto: le case, gli inviti, i lavori.
 *
 * Adesso le si da' un gettone suo: il cruscotto lo chiede al quadro con la
 * chiave (`POST /console/casa/<casa>/plancia/<profilo>/gettone`) e lo passa
 * alla pagina. Vale mezz'ora, per **quella** casa e **quella** plancia, e
 * apre il filo di quella plancia e nient'altro: nessuna via del cruscotto lo
 * riconosce.
 */

/** Quanto vale un gettone dell'editor. */
export const GETTONE_DURA = 30 * 60 * 1000;

/** Quanti gettoni aperti puo' avere uno stesso installatore. */
export const GETTONI_PER_UNO = 20;

export class GettoniDellEditor {
  constructor({ adesso = () => Date.now(), nuovo = () => randomBytes(16).toString("hex") } = {}) {
    this.adesso = adesso;
    this.nuovo = nuovo;
    this.aperti = new Map();
  }

  /** Un gettone per `chi`, buono per questa casa e questa plancia. */
  dai(chi, casa, profilo) {
    this._butta();
    const suoi = [...this.aperti].filter(([, uno]) => uno.chi === chi).map(([gettone]) => gettone);
    for (const vecchio of suoi.slice(0, Math.max(0, suoi.length - GETTONI_PER_UNO + 1)))
      this.aperti.delete(vecchio);
    const gettone = this.nuovo();
    const scade = this.adesso() + GETTONE_DURA;
    this.aperti.set(gettone, { chi, casa, profilo, scade });
    return { gettone, scade };
  }

  /**
   * Di chi e' questo gettone, se vale per questa casa e questa plancia; se no
   * `null`. Non si consuma: la pagina dell'editor riapre il filo quando cade,
   * e deve poter rientrare finche' il gettone vale.
   */
  riconosci(gettone, casa, profilo) {
    this._butta();
    const suo = this.aperti.get(String(gettone ?? ""));
    if (!suo || suo.casa !== casa || suo.profilo !== profilo) return null;
    return suo.chi;
  }

  /** Via tutti quelli di uno: la sua chiave e' cambiata, o non c'e' piu'. */
  dimentica(chi) {
    for (const [gettone, uno] of this.aperti) if (uno.chi === chi) this.aperti.delete(gettone);
  }

  _butta() {
    const ora = this.adesso();
    for (const [gettone, dati] of this.aperti) if (dati.scade <= ora) this.aperti.delete(gettone);
  }
}
