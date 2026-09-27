/* La versione minima dell'app: il giorno dei pagamenti, dalla parte della casa.
 *
 * Le app della prova hanno tutto aperto, e non sanno fermarsi da sole: non
 * chiedono a nessuno se sono troppo vecchie, e non dicono nemmeno alla casa
 * che numero sono. Il giorno che esce la versione pubblica, con i pagamenti,
 * chi le ha non pagherebbe mai. Quindi le ferma la casa.
 *
 * ─── Da dove viene il numero ─────────────────────────────────────────────
 *
 * Dal centralino: `GET <centralino in https>/versioni` risponde
 * `{"gdahome": {"minima": N}}` (vedi `centralino/src/versioni.js`), e N lo
 * decide chi tiene il centralino (`VERSIONE_MINIMA_APP`). La casa lo chiede
 * all'accensione e ogni sei ore, come fa con le licenze, e l'ultimo buono lo
 * tiene in `/data/versioni.json`: un centralino che non risponde, o una casa
 * senza internet, non riaprono le app vecchie.
 *
 * Il centralino e' quello della casa; se la casa non ne vuole nessuno
 * (`da_fuori_casa` spento) si chiede a quello di difetto (`opzioni.js`,
 * `versioni`). Non porta niente della casa: e' una GET nuda, senza nome e
 * senza segreto.
 *
 * ─── Chi si ferma ─────────────────────────────────────────────────────────
 *
 * Con la minima a zero, com'e' di serie: nessuno, e non cambia niente.
 *
 * Sopra zero: il telefono che nella prima parola non dice `app` — cioe' tutte
 * le app di oggi — o dice un numero piu' piccolo, si sente dire di no con
 * `motivo: "aggiorna-l-app"` (vedi `portiere.js`). L'app nuova lo mostra con
 * la sua pagina «aggiornala»; quella vecchia mostra la frase, che dice lo
 * stesso.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { baseDelCentralino } from "./segnalazioni.js";

/* Ogni quanto si richiede: come le licenze. */
export const OGNI = 6 * 60 * 60 * 1000;

/* Nessuno aspetta davanti a uno schermo. */
const ATTESA = 10_000;

/* Il numero, com'e' scritto: un intero da zero in su, o niente. */
export function numeroDiCostruzione(detto) {
  if (typeof detto === "number") return Number.isSafeInteger(detto) && detto >= 0 ? detto : null;
  if (typeof detto === "string" && /^\d{1,10}$/.test(detto.trim())) return Number(detto.trim());
  return null;
}

export class VersioneMinima {
  constructor({
    centralino = "",
    cartella = "",
    fetch: prendi = globalThis.fetch,
    ogni = OGNI,
    registro,
    /* La cartella di gdahome nel browser servita da questo add-on (`/app/`).
     * Serve solo a dirlo nel registro, se e' piu' vecchia della minima: vedi
     * `_eLaNostra`. */
    cartellaDellApp = "",
  } = {}) {
    this.cartellaDellApp = String(cartellaDellApp || "");
    /* Vuoto: non si chiede niente, e la minima resta quella sul disco (zero,
     * la prima volta). L'indirizzo lo decide `opzioni.js`. */
    this.dove = baseDelCentralino(centralino);
    this.prendi = prendi;
    this.ogni = ogni;
    this.registro = registro ?? { debug() {}, info() {}, attenzione() {}, errore() {} };
    this._memoria = cartella
      ? new Archivio(join(String(cartella), "versioni.json"), {})
      : { dati: {}, salva() {} };
    this._orologio = null;
    this._inCorso = null;
  }

  /** Il numero piu' piccolo che entra. Zero: entrano tutti. */
  get minima() {
    return numeroDiCostruzione(this._memoria.dati?.gdahome?.minima) ?? 0;
  }

  /** Se un telefono che ha detto `app` (o niente) va fermato. */
  troppoVecchia(detto) {
    const minima = this.minima;
    if (!minima) return false;
    const suo = numeroDiCostruzione(detto);
    return suo === null || suo < minima;
  }

  parti() {
    if (this._orologio || !this.dove) return;
    void this.chiedi();
    this._orologio = setInterval(() => void this.chiedi(), this.ogni);
    this._orologio.unref?.();
  }

  ferma() {
    clearInterval(this._orologio);
    this._orologio = null;
  }

  /* L'app nel browser che serve questo add-on e' la stessa costruzione
   * dell'add-on (`strumenti/porta-l-app.mjs`), e dice il suo numero come
   * tutte. Se e' piu' vecchia della minima vuol dire che l'add-on e' stato
   * portato fuori senza ricostruirla: il portiere la fermerebbe come un
   * telefono vecchio. Non si fa finta di niente: lo si scrive. */
  _eLaNostra() {
    if (!this.cartellaDellApp || !this.minima) return;
    let sua = null;
    try {
      const detto = JSON.parse(readFileSync(join(this.cartellaDellApp, "version.json"), "utf8"));
      sua = numeroDiCostruzione(detto?.build_number);
    } catch (_errore) {
      return;
    }
    if (sua !== null && sua < this.minima) {
      this.registro.attenzione(
        `gdahome nel browser di questo add-on e' la ${sua}, sotto la minima ${this.minima}: va ricostruita`,
      );
    }
  }

  /** Chiede la minima al centralino. Non solleva mai: un giro andato male
   * lascia quella di prima. */
  async chiedi() {
    if (!this.dove) return this.minima;
    if (this._inCorso) return this._inCorso;
    this._inCorso = (async () => {
      try {
        const risposta = await this.prendi(`${this.dove}/versioni`, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(ATTESA),
        });
        if (!risposta.ok) throw new Error(`il centralino ha risposto ${risposta.status}`);
        const detto = await risposta.json();
        const minima = numeroDiCostruzione(detto?.gdahome?.minima);
        if (minima === null) throw new Error("il centralino non ha detto una versione");
        if (minima !== this.minima || this._memoria.dati?.gdahome === undefined) {
          const prima = this.minima;
          this._memoria.dati = { gdahome: { minima }, chiesta: Date.now() };
          try {
            this._memoria.salva();
          } catch (errore) {
            this.registro.attenzione(
              `versioni: non riesco a scrivere: ${errore?.message || errore}`,
            );
          }
          if (minima !== prima) {
            this.registro.info(
              minima
                ? `le app sotto la ${minima} non entrano piu': devono essere aggiornate`
                : "nessuna versione minima dell'app: entrano tutte",
            );
            this._eLaNostra();
          }
        }
      } catch (errore) {
        /* Un centralino che non ha `/versioni` (uno vecchio, o di qualcun
         * altro) o che non risponde: resta quello che si sapeva. */
        this.registro.debug?.(`versioni: ${errore?.message || errore}`);
      } finally {
        this._inCorso = null;
      }
      return this.minima;
    })();
    return this._inCorso;
  }
}
