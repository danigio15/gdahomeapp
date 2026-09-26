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
 * Una stesura del documento diceva che al primo rapporto il quadro
 * restituisce alla casa **una chiave nuova**, e l'invito muore. Sarebbe un po'
 * piu' stretto, e si e' scelto di no: quella chiave nuova la casa dovrebbe
 * tenersela in `/data`, e da quel momento la riga scritta nella scheda
 * dell'add-on non sarebbe piu' quella che la casa usa davvero. Si perderebbe
 * la cosa che regge tutto il resto — **quello che c'e' scritto nella casella
 * e' quello che parte** — per guadagnare poco.
 *
 * Quindi il codice resta quello, e a bruciarsi e' il suo essere libero: al
 * primo rapporto si lega a quella matricola, e da allora nessun'altra casa lo
 * puo' usare.
 *
 * ─── La matricola non e' un segreto ──────────────────────────────────────
 *
 * Qui c'era scritto che chi intercettasse un codice «dovrebbe comunque
 * conoscere una matricola, che e' centoventotto bit di caso». Il caso c'e',
 * ma la matricola **non e' tenuta segreta**: sta nel cruscotto di chi segue
 * la casa, negli indirizzi dell'editor della plancia, nelle intestazioni di
 * ogni rapporto; la conosce chi seguiva quella casa prima. E' un nome, non una
 * chiave, e niente qui dentro deve reggersi sul fatto che non la si sappia.
 *
 * Per questo una casa **gia' legata** non cambia padrone con un invito e
 * basta: deve dimostrare di essere lei (vedi `riconosci`).
 *
 * ─── Gli inviti si tengono per impronta ──────────────────────────────────
 *
 * Come le chiavi: nel file c'e' lo SHA-256 del codice, non il codice. Chi
 * legge `chiavi.json` non si porta via un invito buono. Il codice intero si
 * vede **una volta**, quando lo si fa; dopo, nell'elenco, restano le ultime
 * quattro lettere, per riconoscerlo.
 */

import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { randomBytes } from "node:crypto";

import { codiceNuovo, impronta, stessoSegreto } from "./segreti.js";

const MINUTO = 60 * 1000;

/* Quanto vive un invito.
 *
 * Erano quindici minuti, copiati dal codice che abbina un telefono. Li' hanno
 * senso: chi abbina un telefono ha in mano il telefono e lo schermo che mostra
 * il QR, e quindici minuti sono un'eternita'.
 *
 * Qui no, e si e' visto al primo uso vero. In quei quindici minuti ci devono
 * stare: copiare il codice, aprire Home Assistant, trovare l'add-on, andare in
 * Configurazione, incollare, salvare, far ripartire il ponte — e poi il primo
 * rapporto. Chi si distrae in mezzo si prende un 403 che non dice «scaduto»,
 * dice «questa chiave non apre niente», e va a cercare un guasto che non c'e'.
 * E nel caso vero il codice non lo incolla nemmeno chi lo genera: lo manda a
 * un cliente, che lo fara' stasera.
 *
 * Un giorno, allora. Il conto del rischio: chi intercettasse un codice non
 * aprirebbe niente — non e' una porta, e' il permesso di **depositare** righe
 * di numeri nella lista di un installatore. Il risultato del suo furto sarebbe
 * una casa finta in un elenco, che si stacca con un tasto: portarsi via una
 * casa vera che e' gia' di qualcuno con un invito solo non si puo' (vedi
 * `riconosci`). Contro questo, quindici minuti non compravano niente. */
export const MINUTI_DELL_INVITO = 24 * 60;

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

/* Il nome di un invito nell'elenco: serve a revocarlo senza doverne sapere il
 * codice, che dopo la prima volta non si vede piu'. */
export const INVITO_VALIDO = /^inv_[0-9a-f]{16}$/;

/* L'impronta di un codice come lo si scrive: senza trattini, maiuscolo. E' la
 * stessa funzione delle chiavi, e non per caso: al primo rapporto l'impronta
 * dell'invito **diventa** l'impronta della chiave. */
const ilSegnoDel = (codice) => impronta(brutto(codice));

/* Un segreto che la casa si tiene per se' (`x-casa-segreto`): si guarda la
 * lunghezza e basta, che il contenuto e' affar suo. */
const segretoBuono = (segreto) => {
  const detto = String(segreto ?? "");
  return detto.length >= 32 && detto.length <= 256 ? detto : "";
};

export class Chiavi {
  constructor({ cartella = "./dati", adesso = () => Date.now() } = {}) {
    this.adesso = adesso;
    this.archivio = new Archivio(join(cartella, "chiavi.json"), {
      inviti: [],
      chiavi: [],
      /* casa → impronta del segreto che quella casa si e' fatta da se'. Resta
       * anche quando la chiave se ne va: e' il modo in cui una casa si fa
       * riconoscere il giorno che cambia installatore. */
      segreti: {},
    });
    if (!this.archivio.dati.segreti || typeof this.archivio.dati.segreti !== "object")
      this.archivio.dati.segreti = {};
    this._inImpronta();
    this.potatura();
  }

  /* Gli inviti scritti in chiaro dalle versioni di prima diventano impronte
   * alla prima accensione: il codice non si perde — chi l'ha mandato a un
   * cliente lo vede ancora funzionare — ma dal file sparisce. */
  _inImpronta() {
    let cambiati = 0;
    this.archivio.dati.inviti = this.inviti.map((uno) => {
      if (!uno || typeof uno !== "object" || !uno.codice) return uno;
      cambiati += 1;
      const { codice, ...resto } = uno;
      return {
        ...resto,
        id: resto.id || `inv_${randomBytes(8).toString("hex")}`,
        impronta: ilSegnoDel(codice),
        finale: brutto(codice).slice(-4),
      };
    });
    if (cambiati) this.archivio.salva();
  }

  get inviti() {
    return this.archivio.dati.inviti;
  }

  get chiavi() {
    return this.archivio.dati.chiavi;
  }

  /**
   * Un invito nuovo, per una casa sola e per un giorno.
   *
   * Lo fa **un installatore**, e la casa che lo usera' sara' sua: e' qui che
   * nasce l'appartenenza, e da qui che passa il limite. Un invito senza padrone
   * non si fa — sarebbe una casa che entra nel quadro senza essere di nessuno,
   * e nessuno la vedrebbe mai.
   */
  fai({ di, per = "", limite = 0, quante = 0 } = {}) {
    if (!di) throw new TroppiInviti("un invito lo fa qualcuno, non si fa da solo");
    this.potatura();

    /* Il limite, imposto **qui**: gli inviti aperti contano come case, se no si
     * fanno venti codici in un minuto e il giorno dopo ci sono venti case oltre
     * il limite, tutte legittime. */
    const suoi = this.inviti.filter((uno) => uno.di === di).length;
    if (limite > 0 && quante + suoi >= limite) {
      throw new TroppiInviti(
        /* Senza contare: con un limite di uno, «1 impianti» si legge male, e un
         * numero e un sostantivo che non concordano sono la cosa che si nota
         * per prima in un messaggio d'errore. */
        `il tuo limite e' ${limite}, e ci sei arrivato: per aggiungerne serve alzarlo`,
      );
    }
    if (suoi >= INVITI_AL_MASSIMO) {
      throw new TroppiInviti("ci sono gia' troppi codici in attesa: annullane qualcuno");
    }

    const codice = bello(codiceNuovo(16));
    const id = `inv_${randomBytes(8).toString("hex")}`;
    this.inviti.push({
      id,
      impronta: ilSegnoDel(codice),
      finale: brutto(codice).slice(-4),
      di,
      per: String(per || "").slice(0, 60),
      fattoIl: this.adesso(),
      scadeIl: this.adesso() + MINUTI_DELL_INVITO * MINUTO,
    });
    this.archivio.salva();
    this.ultimoFatto = id;
    return codice;
  }

  /* Annullare un invito di un altro non si puo', e non e' una finezza: i codici
   * stanno tutti nello stesso file, e senza `di` chiunque potrebbe spegnere gli
   * abbinamenti in corso di un concorrente. */
  /* Si revoca col suo nome (`inv_…`), o col codice intero se lo si ha ancora
   * in mano. */
  annulla(codice, di) {
    const detto = String(codice ?? "");
    const segno = INVITO_VALIDO.test(detto) ? "" : ilSegnoDel(detto);
    const questo = (uno) =>
      INVITO_VALIDO.test(detto) ? uno.id === detto : stessoSegreto(uno.impronta, segno);
    const prima = this.inviti.length;
    this.archivio.dati.inviti = this.inviti.filter(
      (uno) => !(questo(uno) && (!di || uno.di === di)),
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
        /* Il codice intero non c'e' piu': solo il nome per revocarlo e le
         * ultime quattro lettere per riconoscerlo. */
        id: uno.id,
        finale: uno.finale || "",
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
   *
   * ─── Una casa ha una chiave sola ─────────────────────────────────────────
   *
   * Qui c'era un guasto, e per vederlo bisognava cambiare installatore a una
   * casa gia' abbinata — cioe' la prima cosa che si fa provando.
   *
   * Il caso 2 **aggiungeva**: la casa restava legata anche alla chiave di
   * prima, e `diChiE` risponde con la **prima** che trova. Quindi l'invito
   * nuovo veniva bruciato — spariva dai codici in attesa, come deve — e la
   * casa continuava a risultare di chi c'era prima. Nel cruscotto del nuovo
   * installatore: zero impianti. Da fuori sembrava che il codice fosse stato
   * buttato via per niente.
   *
   * Adesso legarsi a un invito nuovo **sostituisce**, e il caso 1 ripara le
   * doppie gia' fatte al primo rapporto che arriva: chi ha gia' il guasto in
   * casa non deve rifare niente a mano.
   *
   * ─── Sostituisce, ma solo se la casa dimostra di essere lei ─────────────
   *
   * Sostituire con un invito e basta voleva dire questo: chi conosce la
   * matricola di una casa gia' legata — e la matricola non e' un segreto, vedi
   * in cima — si fa un invito suo, bussa con quella matricola, e la casa passa
   * a lui. Quella vera, al rapporto dopo, si sente dire di no.
   *
   * Quindi una casa che ha gia' una chiave cambia padrone solo se porta con se'
   * una prova, in `prove`:
   *
   *  - `segreto`: il segreto che la casa si e' fatta da se' e manda in
   *    `x-casa-segreto`. Il quadro ne tiene l'impronta dalla prima volta che
   *    la casa lo manda insieme a una chiave buona, e da li' in poi e' quello
   *    che la riconosce. Resta anche quando la chiave se ne va;
   *  - `chiavePrima`: la chiave (il codice) che la casa usava fino a ieri, in
   *    `x-chiave-prima`.
   *
   * Una casa che non e' legata a niente — mai vista, o staccata da chi la
   * seguiva — entra con l'invito come sempre; se pero' il quadro conosce gia'
   * il suo segreto, lo vuole anche allora.
   *
   * Un invito rifiutato per questo **non si brucia**: resta buono per la casa
   * giusta.
   */
  riconosci(casa, chiave, prove = {}) {
    if (!CASA_VALIDA.test(String(casa ?? ""))) return false;
    const detta = String(chiave ?? "");
    if (detta.length < 8) return false;
    const segno = impronta(brutto(detta));
    const segreto = segretoBuono(prove?.segreto);

    const gia = this.chiavi.find((una) => stessoSegreto(una.impronta, segno));
    if (gia) {
      if (gia.casa !== casa) return false;
      let cambiato = false;
      /* Ripara le doppie di prima: questa e' la chiave con cui la casa sta
       * bussando adesso, quindi e' quella buona, e le altre sue se ne vanno. */
      if (this.chiavi.some((una) => una !== gia && una.casa === casa)) {
        this.archivio.dati.chiavi = this.chiavi.filter((una) => una === gia || una.casa !== casa);
        cambiato = true;
      }
      /* La prima volta che una casa gia' legata manda il suo segreto, lo si
       * impara: la chiave appena controllata dice che e' lei. Dopo non si
       * cambia piu' da qui. */
      if (segreto && !this.segreti[casa]) {
        this.segreti[casa] = impronta(segreto);
        cambiato = true;
      }
      if (cambiato) this.archivio.salva();
      return true;
    }

    this.potatura();
    const invito = this.inviti.find((uno) => stessoSegreto(uno.impronta, segno));
    if (!invito) return false;

    const lei = this._eLei(casa, segreto, prove?.chiavePrima);
    if (!lei) return false;

    this.archivio.dati.inviti = this.inviti.filter((uno) => uno !== invito);
    /* Via la chiave di prima di questa casa, se ce n'era una: riabbinarsi vuol
     * dire cambiare padrone, non averne due. */
    this.archivio.dati.chiavi = this.chiavi.filter((una) => una.casa !== casa);
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
    /* Il segreto: si impara se non lo si sapeva. Se la casa e' passata con
     * la chiave di prima e un segreto diverso da quello noto — ha perso il suo
     * e se n'e' fatto un altro — vale quello nuovo; se non ne ha mandato
     * nessuno, quello vecchio si dimentica, e si reimpara alla prossima. */
    if (lei === "con-la-chiave-di-prima") {
      if (segreto) this.segreti[casa] = impronta(segreto);
      else delete this.segreti[casa];
    } else if (segreto && !this.segreti[casa]) this.segreti[casa] = impronta(segreto);
    this.archivio.salva();
    return true;
  }

  get segreti() {
    return this.archivio.dati.segreti;
  }

  /* Puo' questa casa legarsi a un invito nuovo? Si', se non e' di nessuno e
   * non ha un segreto conosciuto; altrimenti solo con una prova: il segreto
   * che il quadro conosce, **o** la chiave con cui e' legata adesso.
   *
   * Tutte e due, e non solo il segreto: una casa che ha perso il suo file —
   * un ripristino, un add-on reinstallato — si e' fatta un segreto nuovo, e
   * senza la seconda strada non si riabbinerebbe piu'. La chiave di prima
   * prova lo stesso che e' lei: e' quella che usava fino a ieri.
   *
   * Torna `false`, `"col-segreto"`, `"con-la-chiave-di-prima"` o `"libera"`. */
  _eLei(casa, segreto, chiavePrima) {
    const suo = this.segreti[casa];
    if (suo && segreto && stessoSegreto(suo, impronta(segreto))) return "col-segreto";
    const legata = this.chiavi.filter((una) => una.casa === casa);
    const prima = String(chiavePrima ?? "");
    if (legata.length && prima.length >= 8) {
      const segnoDiPrima = impronta(brutto(prima));
      if (legata.some((una) => stessoSegreto(una.impronta, segnoDiPrima)))
        return "con-la-chiave-di-prima";
    }
    if (!suo && !legata.length) return "libera";
    return false;
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
   * rapporti non entrano piu'. La casa non lo sa e continua a mandarle finche'
   * chi ci abita non svuota la casella — ed e' giusto cosi': da qui si decide
   * cosa si riceve, non cosa fa casa d'altri. */
  stacca(casa) {
    const prima = this.chiavi.length;
    this.archivio.dati.chiavi = this.chiavi.filter((una) => una.casa !== casa);
    if (this.chiavi.length !== prima) this.archivio.salva();
    return this.chiavi.length !== prima;
  }

  /**
   * Via tutto quello che e' di uno: i suoi inviti aperti e le chiavi delle sue
   * case.
   *
   * Serve a «elimina» nella gestione, e la conseguenza e' grossa e voluta: da
   * quel momento quelle case bussano e si sentono dire di no. Il codice che
   * hanno incollato in configurazione non apre piu' niente, e per tornare
   * dentro ce ne vuole uno nuovo — di un installatore vivo, incollato da
   * dentro casa. E' esattamente quello che «elimina» vuol dire, ed e' la
   * differenza con «congela», che non tocca niente di tutto questo.
   *
   * Torna quante ne ha buttate, per scriverlo nel registro.
   */
  toglieTutto(di) {
    if (!di) return { inviti: 0, chiavi: 0 };
    const inviti = this.inviti.length;
    const chiavi = this.chiavi.length;
    this.archivio.dati.inviti = this.inviti.filter((uno) => uno.di !== di);
    this.archivio.dati.chiavi = this.chiavi.filter((una) => una.di !== di);
    const quanti = {
      inviti: inviti - this.inviti.length,
      chiavi: chiavi - this.chiavi.length,
    };
    if (quanti.inviti || quanti.chiavi) this.archivio.salva();
    return quanti;
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
