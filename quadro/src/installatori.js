/* Gli installatori iscritti a questo quadro.
 *
 * Il quadro e' **uno solo**, e sta su una macchina di gdahome. Chi installa non
 * accende niente, non compra nessun dominio e non tiene su nessun server: lo
 * si aggiunge, gli si da' una chiave, e da quel momento apre una pagina e vede
 * i suoi impianti.
 *
 * ─── Perche' questo file cambia tutto il resto ───────────────────────────
 *
 * Una stesura di questo quadro lo dava per **di uno solo**: una chiave, e chi
 * ce l'aveva vedeva tutte le case dentro. Andava bene finche' il quadro stava
 * sulla macchina dell'installatore, dove le case dentro erano le sue e basta.
 *
 * Qui dentro ci sono le case di installatori diversi, che fra loro non si devono
 * vedere: i clienti di Rossi non sono affari di Bianchi, e due installatori
 * della stessa citta' si fanno concorrenza. Percio' **ogni cosa in questo
 * quadro appartiene a qualcuno** — una casa, un invito — e ogni risposta e'
 * tagliata su chi l'ha chiesta.
 *
 * ─── Il limite, che qui finalmente e' un limite ──────────────────────────
 *
 * Quando il quadro stava su una macchina dell'installatore, un limite al numero
 * di case non si poteva imporre: quel programma girava su ferro suo, e si
 * modificava in trenta secondi. Ci si era inventati una firma da verificare nel
 * ponte — un tesserino — che era il meglio che si potesse fare, e restava un
 * dosso.
 *
 * Adesso il limite sta qui, sulla macchina di chi lo decide. `soglia` e' un
 * numero, e chi e' al limite non genera l'invito successivo. Niente firme,
 * niente scadenze da verificare in casa d'altri: **e' il server che dice di
 * no**, ed e' l'unica forma di «no» che valga qualcosa.
 */

import { randomBytes } from "node:crypto";
import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { codiceNuovo, impronta, stessoSegreto } from "./segreti.js";

/** Quanto e' lunga la chiave con cui un installatore apre la sua pagina. */
export const CHIAVE_LUNGA = 32;

/** La matricola di un installatore, come se la fabbrica questo file. */
export const CHI_VALIDO = /^inst_[0-9a-f]{16}$/;

/** Zero vuol dire senza limite: e' il caso di chi non si conta. */
export const SENZA_TETTO = 0;

export class Installatori {
  constructor({ cartella = "./dati", adesso = () => Date.now() } = {}) {
    this.adesso = adesso;
    this.archivio = new Archivio(join(cartella, "installatori.json"), { installatori: [] });
  }

  get lista() {
    return this.archivio.dati.installatori;
  }

  quello(chi) {
    return this.lista.find((uno) => uno.chi === chi) ?? null;
  }

  /**
   * Un installatore nuovo.
   *
   * La chiave torna **in chiaro una volta sola**, e qui resta solo la sua
   * impronta: se si perde si rifa', non si recupera. E' la stessa regola dei
   * codici di abbinamento del ponte, e per lo stesso motivo — un elenco di
   * chiavi leggibili e' un elenco di chiavi che prima o poi qualcuno legge.
   */
  fai({ nome = "", soglia = SENZA_TETTO } = {}) {
    const chiave = codiceNuovo(CHIAVE_LUNGA);
    const uno = {
      /* Byte casuali veri, come la matricola di una casa (`ponte/src/identita.js`).
       * Non `codiceNuovo`: quello parla un alfabeto senza zeri e senza elle,
       * fatto per essere dettato al telefono, e schiacciarlo su esadecimale
       * butterebbe via meta' dei caratteri e quasi tutto il caso. */
      chi: `inst_${randomBytes(8).toString("hex")}`,
      nome: String(nome ?? "")
        .trim()
        .slice(0, 80),
      impronta: impronta(chiave),
      soglia: Math.max(0, Math.floor(Number(soglia) || 0)),
      da: this.adesso(),
      vistoIl: null,
      /* Dove vuole essere avvisato quando una casa tace. Vuoto vuol dire che
       * non vuole: niente avvisi e nessuna richiesta a nessuno. */
      avvisi: "",
      /* Quando gli e' stata congelata l'utenza, o `null`.
       *
       * Congelato vuol dire che la sua chiave **apre ancora** — se no non si
       * saprebbe chi sta bussando e non gli si potrebbe dire perche' non
       * vede niente — ma non gli si fa vedere una riga delle sue case. Quello
       * che vede e' un cartello con un indirizzo a cui scrivere.
       *
       * E vuol dire **solo quello**: le sue case continuano a mandare il
       * rapporto e il quadro continua a riceverlo. Sospendere il monitoraggio
       * di impianti che funzionano in casa di qualcuno, per una faccenda fra
       * noi e chi li ha montati, sarebbe far pagare al cliente il conto di un
       * altro. Ed e' anche il motivo per cui si scongela e torna tutto com'era:
       * in mezzo non si e' perso niente. */
      congelato: null,
    };
    this.lista.push(uno);
    this.archivio.salva();
    return { chi: uno.chi, chiave };
  }

  /**
   * Congela un'utenza: da adesso la sua pagina non gli fa vedere piu' niente.
   *
   * Non e' «togli» col nome gentile. Togliere manda via tutto e non si torna
   * indietro; questo e' un interruttore, e l'altro verso e' `scongela`.
   */
  congela(chi) {
    const uno = this.quello(chi);
    if (!uno || uno.congelato) return false;
    uno.congelato = this.adesso();
    this.archivio.salva();
    return true;
  }

  /** E l'interruttore dall'altra parte: torna tutto com'era, senza rifare niente. */
  scongela(chi) {
    const uno = this.quello(chi);
    if (!uno || !uno.congelato) return false;
    uno.congelato = null;
    this.archivio.salva();
    return true;
  }

  /** Se questa utenza e' congelata. Una matricola che non c'e' non lo e'. */
  congelato(chi) {
    return Boolean(this.quello(chi)?.congelato);
  }

  /** Una chiave nuova per chi ha perso la sua. Quella di prima smette subito. */
  rifai(chi) {
    const uno = this.quello(chi);
    if (!uno) return null;
    const chiave = codiceNuovo(CHIAVE_LUNGA);
    uno.impronta = impronta(chiave);
    this.archivio.salva();
    return chiave;
  }

  /**
   * Chi sta bussando?
   *
   * Torna la matricola, o `null`. Si scorre tutta la lista anche quando la
   * prima torna: un confronto che si ferma appena trova dice, col tempo che ci
   * mette, quanti installatori ci sono prima di quello giusto.
   */
  riconosci(chiave) {
    const detta = String(chiave ?? "");
    if (detta.length < 16) return null;
    const segno = impronta(detta);
    let trovato = null;
    for (const uno of this.lista) {
      if (stessoSegreto(uno.impronta, segno)) trovato = uno;
    }
    if (!trovato) return null;
    /* L'ultima volta che si e' fatto vivo: serve a chi tiene il quadro per
     * sapere chi lo usa davvero e chi e' solo iscritto. Si scrive di
     * rado — una volta all'ora — perche' una pagina che si rinfresca da sola
     * ogni minuto non deve far scrivere il disco ogni minuto. */
    const ora = this.adesso();
    if (!trovato.vistoIl || ora - trovato.vistoIl > 60 * 60 * 1000) {
      trovato.vistoIl = ora;
      this.archivio.salva();
    }
    return trovato.chi;
  }

  rinomina(chi, nome) {
    const uno = this.quello(chi);
    if (!uno) return false;
    uno.nome = String(nome ?? "")
      .trim()
      .slice(0, 80);
    this.archivio.salva();
    return true;
  }

  /**
   * Dove mandargli gli avvisi. Vuoto li spegne.
   *
   * Non si controlla qui che sia un indirizzo buono: lo fa il fattorino, che
   * e' l'unico che sa cosa sa consegnare. Due controlli dello stesso fatto in
   * due file sono due controlli che un giorno dicono cose diverse.
   */
  doveAvvisare(chi, dove) {
    const uno = this.quello(chi);
    if (!uno) return false;
    uno.avvisi = String(dove ?? "")
      .trim()
      .slice(0, 300);
    this.archivio.salva();
    return true;
  }

  /**
   * Che razza di marchio ha, o stringa vuota.
   *
   * Qui dentro ci sta **una parola** — `png`, `jpg` — e non l'immagine: i byte
   * stanno in un file per conto loro (`marchi.js`), perche' questo archivio si
   * rilegge a ogni richiesta e si riscrive per cambiare una soglia.
   */
  ilMarchio(chi, razza) {
    const uno = this.quello(chi);
    if (!uno) return false;
    uno.marchio = String(razza ?? "").trim();
    this.archivio.salva();
    return true;
  }

  /** Il limite di case. Zero lo toglie. */
  limite(chi, quante) {
    const uno = this.quello(chi);
    if (!uno) return false;
    uno.soglia = Math.max(0, Math.floor(Number(quante) || 0));
    this.archivio.salva();
    return true;
  }

  togli(chi) {
    const prima = this.lista.length;
    this.archivio.dati.installatori = this.lista.filter((uno) => uno.chi !== chi);
    if (this.lista.length !== prima) this.archivio.salva();
    return this.lista.length !== prima;
  }

  /**
   * L'elenco per chi tiene il quadro.
   *
   * **Quante case, non quali.** Il conto sta qui; i nomi che l'installatore ha
   * dato ai suoi impianti restano dove sono e non passano mai di qua: chi
   * gestisce il quadro sa che Rossi ne segue trentasette, non chi sono.
   */
  elenco(quante = () => 0, entita = () => 0) {
    return this.lista
      .map((uno) => ({
        chi: uno.chi,
        nome: uno.nome,
        marchio: uno.marchio || "",
        soglia: uno.soglia,
        da: uno.da,
        vistoIl: uno.vistoIl,
        congelato: uno.congelato || null,
        case: quante(uno.chi),
        entita: entita(uno.chi),
        /* Al limite: la prossima casa non entra, e si vede prima che
         * l'installatore telefoni per chiedere perche'. */
        pieno: uno.soglia > SENZA_TETTO && quante(uno.chi) >= uno.soglia,
      }))
      .sort((uno, altro) => (uno.nome || uno.chi).localeCompare(altro.nome || altro.chi));
  }
}
