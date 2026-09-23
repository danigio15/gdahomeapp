/* Il freno: quante volte in un'ora, per indirizzo e in tutto.
 *
 * Serve in piu' posti — le case che nascono, le segnalazioni, le linee della
 * chat, il modulo dei contatti, i tentativi della chiave della console — e la
 * regola e' sempre la stessa, quindi sta qui una volta sola.
 *
 * «Per indirizzo» vuol dire per rete in IPv6 — i primi 64 bit, vedi
 * `reteDi` — se no chi ha un /64 cambierebbe indirizzo a ogni tentativo.
 *
 * Due conti e non uno. Quello **per indirizzo** ferma chi insiste da solo
 * senza toccare gli altri; quello **in tutto** ferma chi arriva da mille
 * indirizzi diversi, che il primo conto non vede nemmeno. Il secondo e' piu'
 * largo apposta: e' un tetto, non una regola di tutti i giorni.
 *
 * Sta in memoria e basta: un riavvio lo azzera, ed e' giusto — sono limiti di
 * velocita', non registri. La memoria non cresce all'infinito: gli indirizzi
 * che non si sono fatti vivi nell'ultima finestra se ne vanno alla prima
 * pulita.
 */

import { reteDi } from "./indirizzo.js";

export const UN_ORA = 60 * 60 * 1000;

export class Freno {
  constructor({
    perChi = Infinity,
    inTutto = Infinity,
    finestra = UN_ORA,
    adesso = () => Date.now(),
  } = {}) {
    this.perChi = numeroOInfinito(perChi);
    this.inTutto = numeroOInfinito(inTutto);
    this.finestra = finestra;
    this.adesso = adesso;
    this._tutti = [];
    this._perChi = new Map();
  }

  /* Se c'e' ancora posto, senza contarlo. */
  cePosto(indirizzo = "?") {
    const chi = reteDi(indirizzo);
    const ora = this.adesso();
    this._pota(ora);
    if (this._tutti.length >= this.inTutto) return false;
    const suoi = (this._perChi.get(chi) || []).filter((una) => ora - una < this.finestra);
    return suoi.length < this.perChi;
  }

  /* Conta una volta, se c'e' posto. Torna `false` se il posto non c'era: in
   * quel caso non conta niente, cosi' chi viene fermato non si allunga da
   * solo l'attesa bussando. */
  concedi(chi = "?") {
    if (!this.cePosto(chi)) return false;
    this.conta(chi);
    return true;
  }

  /* Conta una volta, e basta: per chi decide dopo — i tentativi sbagliati
   * si contano solo quando si sa che erano sbagliati. */
  conta(indirizzo = "?") {
    const chi = reteDi(indirizzo);
    const ora = this.adesso();
    this._tutti.push(ora);
    const suoi = (this._perChi.get(chi) || []).filter((una) => ora - una < this.finestra);
    suoi.push(ora);
    this._perChi.set(chi, suoi);
  }

  /* Dimentica uno solo: chi entra con la chiave giusta si porta via i suoi
   * sbagli. Il conto in tutto invece resta, perche' e' di tutti. */
  dimentica(indirizzo = "?") {
    this._perChi.delete(reteDi(indirizzo));
  }

  _pota(ora) {
    while (this._tutti.length && ora - this._tutti[0] >= this.finestra) this._tutti.shift();
    if (this._perChi.size > 5000) {
      for (const [chi, volte] of this._perChi) {
        if (!volte.some((una) => ora - una < this.finestra)) this._perChi.delete(chi);
      }
    }
  }
}

function numeroOInfinito(valore) {
  const numero = Number(valore);
  return Number.isFinite(numero) && numero >= 0 ? numero : Infinity;
}

/* Un numero da una variabile d'ambiente, con il suo difetto quando manca o
 * non e' un numero. Zero vuol dire zero: chi lo scrive lo vuole spento. */
export function numeroDa(testo, difetto) {
  if (testo === undefined || testo === null || String(testo).trim() === "") return difetto;
  const numero = Number(testo);
  return Number.isFinite(numero) && numero >= 0 ? numero : difetto;
}
