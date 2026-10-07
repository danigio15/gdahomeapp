/* La casa di prova: un codice per chi deve provare l'app senza abitarci.
 *
 * Prima di pubblicare l'app, Apple la prova con una casa vera: da lontano, e
 * nei giorni che sceglie lei. Il codice di abbinamento di tutti i giorni non
 * basta, ed e' fatto apposta per non bastare: vale cinque minuti e una volta
 * sola, e chi rivede l'app non e' davanti allo schermo quando lo si fabbrica.
 *
 * Questo e' un secondo codice, con regole sue:
 *
 *   - vale **fino a sette giorni**, e per **piu' telefoni** (al massimo
 *     cinque: un iPhone e un iPad di chi rivede, e un po' di margine);
 *   - sta su disco, perche' un add-on che si riavvia nel mezzo della
 *     revisione non lo deve buttare via;
 *   - chi entra con lui entra **come un utente che non amministra**, scelto
 *     nella console: vede quello che vede lui, e la dogana (`dogana.js`) gli
 *     lascia fare solo quello che puo' fare lui;
 *   - i telefoni entrati con lui sono «di prova» (`finoA` in
 *     `dispositivi.js`): escono da soli alla scadenza, e subito se il codice
 *     si revoca.
 *
 * Il codice di tutti i giorni resta com'era, e i due vivono insieme: chi
 * abbina il proprio telefono durante la revisione non spegne la casa di
 * prova, e il contrario. La stretta di mano prova le due chiavi — vedi
 * `_perAbbinare` in `portiere.js` — e il centralino tiene le due attese una
 * accanto all'altra.
 *
 * Il codice sta su disco **in chiaro**, ed e' una scelta. Per stringere la
 * mano serve il codice e non la sua impronta (`cifra.js`), e la console lo
 * deve poter rimostrare a chi riapre la pagina. Sta in `/data`, accanto alle
 * chiavi del filo dei telefoni, che sono altrettanto delicate: chi legge
 * quella cartella ha gia' di peggio in mano. E apre al massimo sette giorni,
 * per un utente che non amministra.
 */

import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { codiceNuovo } from "./segreti.js";

const GIORNO = 24 * 60 * 60 * 1000;

/* Quanto puo' durare, al massimo. Una revisione dell'App Store dura di solito
 * un giorno o due, e ogni tanto si ferma per una domanda: sette giorni la
 * coprono. Il centralino ha lo stesso tetto (`PROVA_VIVE_AL_MASSIMO`). */
export const GIORNI_AL_MASSIMO = 7;

/* Quanti telefoni possono entrare con lo stesso codice. Un codice che gira
 * per piu' giorni nelle note di qualcun altro non deve poter riempire la
 * casa: i telefoni di casa restano dieci, e cinque di quelli bastano a chi
 * rivede. */
export const TELEFONI_DI_PROVA = 5;

/* L'identificativo di un utente di Home Assistant: trentadue cifre
 * esadecimali, come in `abbinamento.js`. */
function utentePulito(chi) {
  const detto = String(chi || "").trim();
  return /^[a-f0-9]{32}$/i.test(detto) ? detto : "";
}

export class CasaDiProva {
  constructor({ cartella = "/data", adesso = () => Date.now() } = {}) {
    this.adesso = adesso;
    this.archivio = new Archivio(join(cartella, "casa-di-prova.json"), { prova: null });
  }

  /* Quello che c'e' scritto, giusto o sbagliato che sia. */
  get _scritta() {
    const prova = this.archivio.dati.prova;
    if (
      !prova ||
      typeof prova !== "object" ||
      typeof prova.codice !== "string" ||
      !prova.codice ||
      !Number.isFinite(prova.scadeIl) ||
      !utentePulito(prova.utente)
    ) {
      return null;
    }
    return prova;
  }

  /* Il codice che vale adesso, o `null`. Uno scaduto non vale anche se e'
   * ancora scritto: lo toglie lo spazzino (`index.js`), ma fino ad allora
   * non apre niente. */
  viva() {
    const prova = this._scritta;
    if (!prova || prova.scadeIl <= this.adesso()) return null;
    return {
      codice: prova.codice,
      natoIl: prova.natoIl,
      scadeIl: prova.scadeIl,
      utente: utentePulito(prova.utente),
    };
  }

  /* Se c'e' scritto un codice che non vale piu': lo spazzino lo deve
   * togliere, e con lui i telefoni entrati. Un file rovinato conta come
   * scaduto: va tolto lo stesso. */
  scaduta() {
    const cera = this.archivio.dati.prova;
    if (!cera) return false;
    return this.viva() === null;
  }

  /* Un codice nuovo. Ce n'e' uno alla volta: due codici di prova sarebbero
   * due porte da ricordarsi di chiudere, e chi ne vuole un altro revoca
   * prima quello che c'e' (`InUso`).
   *
   * `utente` e' obbligatorio. Un telefono senza utente in questa casa vede
   * tutto e amministra (`_amministra` in `ponte.js`): e' com'erano i telefoni
   * di prima, e non e' quello che si da' a uno sconosciuto. Che l'utente non
   * amministri lo controlla chi chiama (`server.js`), che sa chiederlo a Home
   * Assistant; qui si controlla solo che ci sia. */
  nuova({ utente, giorni = GIORNI_AL_MASSIMO } = {}) {
    const chi = utentePulito(utente);
    if (!chi) throw new SenzaUtente("la casa di prova vuole un utente di Home Assistant");
    if (this.viva()) {
      throw new InUso("c'e' gia' una casa di prova: revocala prima di farne un'altra");
    }
    /* Da uno a sette giorni. Un numero che non e' un numero vale sette: e'
     * quello che la console propone di serie. */
    const detti = Math.round(Number(giorni));
    const quanti = detti >= 1 ? Math.min(GIORNI_AL_MASSIMO, detti) : GIORNI_AL_MASSIMO;
    const ora = this.adesso();
    this.archivio.dati.prova = {
      codice: codiceNuovo(),
      natoIl: ora,
      scadeIl: ora + quanti * GIORNO,
      utente: chi,
    };
    this.archivio.salva();
    return this.viva();
  }

  /* Via il codice, valido o scaduto. Torna se c'era. I telefoni entrati con
   * lui li toglie chi chiama, che ha in mano anche i fili da chiudere. */
  togli() {
    const cera = Boolean(this.archivio.dati.prova);
    if (!cera) return false;
    this.archivio.dati.prova = null;
    this.archivio.salva();
    return true;
  }
}

export class SenzaUtente extends Error {}

export class InUso extends Error {}
