/* L'archivio: un file JSON in `/data`, scritto senza lasciarlo a meta'.
 *
 * `/data` e' l'unica cartella di un add-on che sopravvive a un riavvio e a un
 * aggiornamento. Ci finisce poca roba — l'elenco dei telefoni abbinati — ma
 * quella poca deve restare leggibile anche se la corrente va via nel mezzo di
 * una scrittura: si scrive di fianco e si rinomina, che sul filesystem e'
 * un'operazione sola.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export class Archivio {
  constructor(percorso, difetto = {}) {
    this.percorso = percorso;
    this.difetto = difetto;
    this.dati = this._leggi();
  }

  _leggi() {
    try {
      const testo = readFileSync(this.percorso, "utf8");
      const letto = JSON.parse(testo);
      if (letto && typeof letto === "object" && !Array.isArray(letto))
        return { ...structuredClone(this.difetto), ...letto };
    } catch (_errore) {
      /* File assente alla prima accensione, o illeggibile perche' qualcuno ci
       * ha messo le mani: in tutti e due i casi si riparte dal difetto invece
       * di non partire. Quello che c'era resta sul disco, non si cancella. */
    }
    return structuredClone(this.difetto);
  }

  salva() {
    const cartella = dirname(this.percorso);
    try {
      mkdirSync(cartella, { recursive: true });
    } catch (_errore) {
      /* C'e' gia'. */
    }
    const diFianco = join(cartella, `.${Date.now()}.parziale`);
    writeFileSync(diFianco, JSON.stringify(this.dati, null, 2), "utf8");
    renameSync(diFianco, this.percorso);
  }
}
