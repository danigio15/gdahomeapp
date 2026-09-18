/* Gli inviti, e le chiavi che ne restano.
 *
 * Come una casa entra in questo quadro. Ricalca quello che gdahome fa gia' per
 * abbinare un telefono (`ponte/src/abbinamento.js`): un codice che vive pochi
 * minuti, si usa **una volta sola**, e da li' in poi vale per quella casa e
 * per nessun'altra.
 *
 * ─── Il verso ────────────────────────────────────────────────────────────
 *
 * Non e' il quadro che va a cercare le case: e' la casa che si presenta. Un
 * quadro che andasse a bussare dovrebbe sapere dove sono, e le case di gdahome
 * un indirizzo pubblico non ce l'hanno — e' tutto il punto del ponte.
 *
 * ─── Il codice si brucia, ma non si riscrive ─────────────────────────────
 *
 * Una stesura del documento diceva che alla prima cartolina il quadro
 * restituisce alla casa **una chiave nuova**, e l'invito muore. Sarebbe un po'
 * piu' stretto, e si e' scelto di no: quella chiave nuova la casa dovrebbe
 * tenersela in `/data`, e da quel momento la riga scritta nella scheda
 * dell'add-on non sarebbe piu' quella che la casa usa davvero. Si perderebbe
 * la cosa che regge tutto il resto — **quello che c'e' scritto nella casella
 * e' quello che parte** — per guadagnare poco.
 *
 * Quindi il codice resta quello, e a bruciarsi e' il suo essere libero: alla
 * prima cartolina si lega a quella matricola, e da allora nessun'altra casa lo
 * puo' usare. Chi lo intercettasse prima dell'uso dovrebbe comunque conoscere
 * una matricola, che e' centoventotto bit di caso.
 */

import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { codiceNuovo, impronta, stessoSegreto } from "./segreti.js";

const MINUTO = 60 * 1000;

/** Quanto vive un invito. Gli stessi quindici minuti che dice il documento. */
export const MINUTI_DELL_INVITO = 15;

/** Quanti inviti aperti si tengono insieme: oltre, e' un elenco di prove. */
export const INVITI_AL_MASSIMO = 20;

/** La matricola di una casa, come se la fabbrica il ponte. */
export const CASA_VALIDA = /^casa_[0-9a-f]{32}$/;

/* Il codice, a gruppi di quattro. Le quattro lettere per gruppo non sono
 * estetica: un codice da sedici caratteri di fila si ricopia sbagliato, e
 * questo si incolla ma si legge anche al telefono a qualcuno. L'alfabeto e'
 * quello di `segreti.js`, senza gli zeri e le elle che si confondono. */
export const bello = (codice) => String(codice).replace(/(.{4})(?=.)/g, "$1-");

export const brutto = (codice) =>
  String(codice ?? "")
    .replace(/-/g, "")
    .trim()
    .toUpperCase();

export class Chiavi {
  constructor({ cartella = "./dati", adesso = () => Date.now() } = {}) {
    this.adesso = adesso;
    this.archivio = new Archivio(join(cartella, "chiavi.json"), { inviti: [], chiavi: [] });
    this.potatura();
  }

  get inviti() {
    return this.archivio.dati.inviti;
  }

  get chiavi() {
    return this.archivio.dati.chiavi;
  }

  /**
   * Un invito nuovo, per una casa sola e per un quarto d'ora.
   *
   * Lo fa **un installatore**, e la casa che lo usera' sara' sua: e' qui che
   * nasce l'appartenenza, e da qui che passa il tetto. Un invito senza padrone
   * non si fa — sarebbe una casa che entra nel quadro senza essere di nessuno,
   * e nessuno la vedrebbe mai.
   */
  fai({ di, per = "", tetto = 0, quante = 0 } = {}) {
    if (!di) throw new TroppiInviti("un invito lo fa qualcuno, non si fa da solo");
    this.potatura();

    /* Il tetto, imposto **qui**: gli inviti aperti contano come case, se no si
     * fanno venti codici in un minuto e il giorno dopo ci sono venti case oltre
     * il tetto, tutte legittime. */
    const suoi = this.inviti.filter((uno) => uno.di === di).length;
    if (tetto > 0 && quante + suoi >= tetto) {
      throw new TroppiInviti(
        `questo conto arriva a ${tetto} case, e ci e' arrivato: per aggiungerne serve alzare il tetto`,
      );
    }
    if (suoi >= INVITI_AL_MASSIMO) {
      throw new TroppiInviti("ci sono gia' troppi codici in attesa: annullane qualcuno");
    }

    const codice = bello(codiceNuovo(16));
    this.inviti.push({
      codice,
      di,
      per: String(per || "").slice(0, 60),
      fattoIl: this.adesso(),
      scadeIl: this.adesso() + MINUTI_DELL_INVITO * MINUTO,
    });
    this.archivio.salva();
    return codice;
  }

  /* Annullare un invito di un altro non si puo', e non e' una finezza: i codici
   * stanno tutti nello stesso file, e senza `di` chiunque potrebbe spegnere gli
   * abbinamenti in corso di un concorrente. */
  annulla(codice, di) {
    const quale = brutto(codice);
    const prima = this.inviti.length;
    this.archivio.dati.inviti = this.inviti.filter(
      (uno) => !(brutto(uno.codice) === quale && (!di || uno.di === di)),
    );
    if (this.inviti.length !== prima) this.archivio.salva();
    return this.inviti.length !== prima;
  }

  /** Gli inviti aperti **di uno**, con quanto gli resta. */
  elenco(di) {
    this.potatura();
    return this.inviti
      .filter((uno) => !di || uno.di === di)
      .map((uno) => ({
        codice: uno.codice,
        per: uno.per,
        fattoIl: uno.fattoIl,
        scadeFra: Math.max(0, Math.round((uno.scadeIl - this.adesso()) / 1000)),
      }));
  }

  /**
   * Questa casa, con questa chiave, puo' depositare?
   *
   * Tre casi, in quest'ordine:
   *
   *  1. la chiave e' gia' legata a una casa: passa solo se e' **questa** casa.
   *     E' la riga che rende un codice usato inservibile per chiunque altro;
   *  2. la chiave e' un invito ancora vivo: si lega a questa casa, l'invito
   *     sparisce, e da adesso vale il caso 1;
   *  3. niente di tutto questo: no.
   */
  riconosci(casa, chiave) {
    if (!CASA_VALIDA.test(String(casa ?? ""))) return false;
    const detta = String(chiave ?? "");
    if (detta.length < 8) return false;
    const segno = impronta(brutto(detta));

    const gia = this.chiavi.find((una) => stessoSegreto(una.impronta, segno));
    if (gia) return gia.casa === casa;

    this.potatura();
    const invito = this.inviti.find((uno) => brutto(uno.codice) === brutto(detta));
    if (!invito) return false;

    this.archivio.dati.inviti = this.inviti.filter((uno) => uno !== invito);
    this.chiavi.push({
      impronta: segno,
      casa,
      /* Di chi e' questa casa. Si porta dietro dall'invito e non si tocca piu':
       * e' quello che fa comparire la casa nella pagina di uno e non di un
       * altro. */
      di: invito.di,
      natoIl: this.adesso(),
      per: invito.per,
    });
    this.archivio.salva();
    return true;
  }

  /** Di chi e' questa casa, secondo l'invito con cui e' entrata. */
  diChiE(casa) {
    return this.chiavi.find((una) => una.casa === casa)?.di ?? null;
  }

  /** Quello che l'invito diceva di questa casa, quando e' stata abbinata. */
  perChiEra(casa) {
    return this.chiavi.find((una) => una.casa === casa)?.per || "";
  }

  /* Staccare una casa vuol dire buttare la sua chiave: da quel momento le sue
   * cartoline non entrano piu'. La casa non lo sa e continua a mandarle finche'
   * chi ci abita non svuota la casella — ed e' giusto cosi': da qui si decide
   * cosa si riceve, non cosa fa casa d'altri. */
  stacca(casa) {
    const prima = this.chiavi.length;
    this.archivio.dati.chiavi = this.chiavi.filter((una) => una.casa !== casa);
    if (this.chiavi.length !== prima) this.archivio.salva();
    return this.chiavi.length !== prima;
  }

  /** Via gli inviti scaduti: un codice morto non deve restare a occupare posto. */
  potatura() {
    const ora = this.adesso();
    const prima = this.inviti.length;
    this.archivio.dati.inviti = this.inviti.filter((uno) => uno.scadeIl > ora);
    const andati = prima - this.inviti.length;
    if (andati) this.archivio.salva();
    return andati;
  }
}

export class TroppiInviti extends Error {}
