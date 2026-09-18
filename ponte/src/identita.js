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
    /* Il sale delle impronte.
     *
     * Serve al rapporto del quadro: le entita' che non rispondono si
     * mandano come quattro cifre, e senza un sale di questa casa la stessa
     * entita' darebbe le stesse quattro cifre in tutte le case del mondo —
     * cioe' si girerebbero in un pomeriggio con un elenco di nomi plausibili.
     *
     * Nasce qui e non dove si usa perche' qui c'e' gia' il file che
     * sopravvive ai riavvii, e perche' una casa che cambia sale a ogni
     * accensione farebbe credere al quadro che ogni giorno si rompe un
     * dispositivo diverso. Si aggiunge senza rifare l'identita': le case che
     * esistono gia' non hanno nessun motivo di cambiare numero. */
    if (typeof this.archivio.dati.sale !== "string" || this.archivio.dati.sale.length < 32) {
      this.archivio.dati.sale = randomBytes(16).toString("hex");
      this.archivio.salva();
    }
  }

  /* Il sale delle impronte. Non e' un segreto come quello del centralino — non
   * apre niente — ma non esce lo stesso: e' quello che tiene i nomi delle
   * entita' dentro questa casa. */
  get sale() {
    return this.archivio.dati.sale;
  }

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
