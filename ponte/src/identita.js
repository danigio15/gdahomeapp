/* Chi e' questa casa, per il centralino.
 *
 * Un identificativo e un segreto, fabbricati una volta sola alla prima
 * accensione e conservati in `/data`. L'identificativo serve a instradare — sta
 * nell'indirizzo a cui bussano i telefoni, e non e' un segreto. Il segreto
 * serve a dimostrare che questa casa e' quella casa, e non esce mai da qui.
 *
 * Sono centoventotto e duecentocinquantasei bit di caso: non si chiedono a
 * nessuno, non si registrano da nessuna parte prima, e non si scelgono. La
 * prima volta che la casa si presenta al centralino, quell'identificativo
 * diventa suo.
 */

import { join } from "node:path";
import { randomBytes } from "node:crypto";

import { Archivio } from "./archivio.js";
import { segnoNuovo } from "./segreti.js";

export class Identita {
  constructor({ cartella = "/data" } = {}) {
    this.archivio = new Archivio(join(cartella, "casa.json"), {});
    if (!this._eBuona()) {
      this.archivio.dati = {
        casa: `casa_${randomBytes(16).toString("hex")}`,
        segreto: segnoNuovo(),
        natoIl: Date.now(),
      };
      this.archivio.salva();
    }
  }

  /* Qui stava il **sale delle impronte**, e non c'e' piu'.
   *
   * Serviva al rapporto del quadro: le entita' che non rispondevano si
   * mandavano come quattro cifre, e il sale teneva quelle cifre diverse da
   * casa a casa. Adesso il rapporto manda il nome del dispositivo — il perche'
   * sta in cima a `salute.js` — e un sale che non protegge piu' niente e'
   * solo una riga che qualcuno un giorno legge e crede vera.
   *
   * Nei `casa.json` delle case gia' accese la chiave `sale` resta scritta e
   * non la legge piu' nessuno. Toglierla vorrebbe dire riscrivere il file
   * dell'identita' a ogni accensione per una stringa di trentadue caratteri
   * che non da' fastidio a nessuno. */

  get casa() {
    return this.archivio.dati.casa;
  }

  get segreto() {
    return this.archivio.dati.segreto;
  }

  _eBuona() {
    const { casa, segreto } = this.archivio.dati;
    return (
      typeof casa === "string" &&
      /^casa_[0-9a-f]{32}$/.test(casa) &&
      typeof segreto === "string" &&
      segreto.length >= 32
    );
  }

  /* Il segreto non compare: `toString` finisce nei registri. */
  toString() {
    return `Identita(${this.casa})`;
  }
}
