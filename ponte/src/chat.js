/* La chat di assistenza: quella della dashboard, non una nostra.
 *
 * «La chat non deve passare per GitHub, puoi utilizzare la stessa chat della
 *  dashboardmodern v2.»
 *
 * Ed e' giusto, perche' quella chat esiste gia' e non passa da GitHub: sotto
 * ci sta un centralino suo — `centralino.<…>.workers.dev`, un altro da quello
 * di gdahome — e la finestra che si vede nella plancia parla con
 * l'integrazione di Home Assistant con otto comandi `dashboardmodern/chat/*`.
 *
 * Nell'app l'integrazione non c'e': quel mestiere lo fa il ponte, come lo fa
 * per la configurazione, per le foto e per il catalogo. Finora il ponte quegli
 * otto comandi li **rifiutava** — «le segnalazioni e la chat stanno nell'app»
 * — e la finestra dell'assistenza, che e' la sua, si apriva su niente.
 *
 * Quello che c'e' qui dentro e' il porto di `chat.py`, `chat_client.py` e
 * `chat_store.py` dell'integrazione: le stesse chiamate, le stesse risposte,
 * le stesse regole. Non una seconda chat da tenere allineata a mano.
 *
 * **Le due meta'.** Quattro comandi sono di chi chiede — lo stato, il filo,
 * scrivi, dimentica — e li ha ogni casa. Quattro sono di chi risponde — la
 * coda di tutte le case, aprine una, rispondere, buttarla via — e li ha una
 * casa sola al mondo: quella che nelle opzioni dell'add-on ha scritto la
 * chiave della console. Dove quella chiave non c'e', questa meta' del file non
 * si accende, e nella finestra dell'assistenza non compare niente.
 *
 * Prima quei quattro comandi il ponte li rifiutava dicendo «si aprono dalla
 * dashboard di chi mantiene». Era vero finche' chi mantiene aveva la plancia
 * e non l'app; adesso non lo e' piu', e la coda si apre da dove si risponde.
 *
 * **Chi e' questa casa.** Un nome di 128 bit e un segreto di 256, presi dal
 * caso alla prima parola scritta e tenuti in `/data/chat.json`. Chi risponde
 * vede che la linea `casa_9f3a…` ha scritto, e non ha modo di sapere altro:
 * niente entita', niente indirizzi, niente identificativo di questo Home
 * Assistant. Il segreto non esce mai dal ponte — al telefono non arriva, e
 * nella pagina non finisce.
 *
 * **La copia in casa.** La conversazione vera sta nel centralino; qui se ne
 * tiene una copia per rispondere subito anche senza rete, e per sapere cosa e'
 * cambiato. Si chiede «dopo il numero N» e non «tutti»: una conversazione
 * lunga tornerebbe intera a ogni giro per dire quasi sempre che non e'
 * cambiato niente.
 */

import { randomBytes } from "node:crypto";
import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { tagliaBene } from "./testo.js";

/* Il centralino della chat della dashboard. E' scritto qui come sta scritto
 * in `const.py` dell'integrazione — `CHAT_CENTRALINO` — e non e' quello di
 * gdahome: sono due posti diversi, e questa chat e' la sua. */
export const CENTRALINO_DELLA_CHAT = "https://centralino.danigio15.workers.dev";

/* Gli stessi tetti dell'integrazione. */
export const TESTO_MASSIMO = 4000;
const STORIA_MASSIMA = 200;
const NOME_MASSIMO = 60;
/* Quanto tiene il centralino di un'etichetta — `LIMITI.etichetta` — e quindi
 * quanto vale la pena mandargliene: piu' di cosi' lo taglia lui. */
const ETICHETTA_MASSIMA = 40;

/* Quante pagine si e' disposti a chiedere per una conversazione sola, dalla
 * parte di chi risponde. Il centralino ne tiene duecento e ne da' cento per
 * volta: due giri bastano, il terzo e' il margine perche' quei due numeri non
 * si tocchino. */
const MAX_PAGINE = 4;

/* Com'e' fatto il nome di una linea. Si controlla prima di infilarlo in un
 * indirizzo: quello che arriva dalla finestra l'ha scritto qualcuno, e un nome
 * con dentro una barra o un punto interrogativo chiederebbe al centralino una
 * cosa diversa da quella che si voleva chiedere. */
const LINEA_VALIDA = /^[A-Za-z0-9_-]{1,64}$/;

const ATTESA = 20_000;
/* Quanto vale la rilettura prima di richiederla: la finestra la chiede a ogni
 * suo giro, e il centralino non ha niente di nuovo da dire piu' spesso di
 * cosi'. */
const QUANTO_DURA = 10_000;

export class ChatHaDettoNo extends Error {
  constructor(codice, spiegazione) {
    super(spiegazione || "la chat non ha funzionato");
    this.codice = codice || "chat";
  }
}

/* Un nome e un segreto, presi dal caso e da nient'altro.
 *
 * Sedici byte sono 128 bit: il nome della casa non si indovina, e non c'e'
 * niente da indovinare che valga la pena. Il segreto e' il doppio, e serve a
 * dimostrare al centralino che chi bussa e' la stessa casa di ieri. */
/* Quello che ci sta in un'intestazione HTTP: un byte per carattere, cioe'
 * niente sopra U+00FF. Se non ci sta, torna vuoto — meglio non dire niente che
 * dire una cosa storpiata o non partire affatto. */
export function perUnIntestazione(valore) {
  const testo = String(valore ?? "");
  for (const pezzo of testo) {
    if (pezzo.codePointAt(0) > 0xff) return "";
  }
  return testo;
}

export function unaIdentita() {
  return {
    casa: `casa_${randomBytes(16).toString("hex")}`,
    segreto: randomBytes(32).toString("hex"),
  };
}

/* Una riga come la tiene la copia in casa: il numero del centralino, da chi
 * viene, cosa dice, quando. Nient'altro, e niente che non sia nostro. */
function unaRiga(grezza) {
  const numero = Number.parseInt(grezza?.id ?? 0, 10) || 0;
  if (!numero) return null;
  return {
    id: numero,
    da: String(grezza?.da) === "console" ? "console" : "casa",
    testo: String(grezza?.testo ?? ""),
    scritto_il: Number.parseInt(grezza?.scritto_il ?? 0, 10) || 0,
  };
}

const DIFETTO = Object.freeze({ identita: {}, messaggi: [], letto: 0, nome: "", app: "" });

export class Chat {
  constructor({
    cartella,
    centralino = process.env.PONTE_CHAT || CENTRALINO_DELLA_CHAT,
    versione = "",
    plancia = "",
    lingua = "",
    chiaveDellaConsole = "",
    fetch: prendi = globalThis.fetch,
    registro,
    adesso = () => Date.now(),
    quantoDura = QUANTO_DURA,
  } = {}) {
    this.archivio = new Archivio(join(cartella, "chat.json"), DIFETTO);
    this.centralino = String(centralino || "").replace(/\/+$/, "");
    this.versione = String(versione || "");
    this.plancia = String(plancia || "");
    this.lingua = String(lingua || "");
    /* La chiave con cui si leggono le conversazioni di **tutte** le case.
     *
     * Sta nelle opzioni dell'add-on di un Home Assistant solo al mondo, come
     * nell'integrazione sta nelle opzioni di una plancia sola: il centralino
     * non conosce nessuno, sa distinguere solo chi ce l'ha da chi non ce l'ha.
     * Vuota — cioe' in tutte le case tranne una — questa meta' del ponte non
     * esiste e non si vede. */
    this.chiaveDellaConsole = String(chiaveDellaConsole || "");
    this.prendi = prendi;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this.quantoDura = quantoDura;
    this._lettoIl = 0;
  }

  /* Se c'e' un posto dove scrivere. Senza indirizzo la finestra non si
   * disegna nemmeno: meglio nessuna porta che una porta che non si apre. */
  get accesa() {
    return Boolean(this.centralino) && typeof this.prendi === "function";
  }

  /* Se da questa casa si risponde alle altre.
   *
   * Due cose insieme, come nell'integrazione: la chiave, e la chat accesa.
   * Spegnere la chat promette che «non esce niente di casa», e la promessa
   * vale anche per chi risponde. */
  get eLaConsole() {
    return this.accesa && Boolean(this.chiaveDellaConsole);
  }

  get dati() {
    return this.archivio.dati;
  }

  /* Se questa casa la chat l'ha gia' aperta almeno una volta. */
  get aperta() {
    return Boolean(this.dati.identita?.casa && this.dati.identita?.segreto);
  }

  get messaggi() {
    return Array.isArray(this.dati.messaggi) ? this.dati.messaggi : [];
  }

  /* Il numero dell'ultimo messaggio in copia: da li' si chiede il resto. */
  get ultimo() {
    return this.messaggi.reduce((piuAlto, riga) => Math.max(piuAlto, riga.id || 0), 0);
  }

  /* I messaggi di chi risponde che nessuno ha ancora aperto. */
  get nonLetti() {
    const letto = Number(this.dati.letto || 0);
    return this.messaggi.filter((riga) => riga.da === "console" && (riga.id || 0) > letto);
  }

  /* ─── Quello che la finestra chiede ────────────────────────────────────── */

  /* `chat/state`: come sta la chat, per chi la deve disegnare.
   *
   * Non esce di casa, e non deve: serve a decidere se mostrare la porta e se
   * c'e' un pallino, e disegnare una porta non puo' costare una chiamata al
   * centralino ogni volta che qualcuno apre la Configurazione. */
  stato() {
    const nonLetti = this.nonLetti;
    const ultima = nonLetti.length ? nonLetti[nonLetti.length - 1] : {};
    return {
      enabled: this.accesa,
      /* Se questa casa e' anche quella di chi risponde. E' quello che accende
       * il Cruscotto nella finestra dell'assistenza della plancia — la scheda
       * con la coda di tutte le case — e la voce «Console» nell'app. In tutte
       * le altre case e' falso, e non c'e' niente da vedere. */
      console: this.eLaConsole,
      opened: this.aperta,
      name: String(this.dati.nome || ""),
      unread: nonLetti.length,
      preview: tagliaBene(String(ultima.testo || "").trim(), 200),
      written_at: Number(ultima.scritto_il || 0),
      messages: this.messaggi.length,
    };
  }

  /* `chat/thread`: la conversazione, riletta dal centralino.
   *
   * La copia in casa risponde subito, anche senza rete: si mostra quella, e
   * intanto si chiede al centralino solo quello che manca. Aprire la chat e'
   * averla letta, quindi il segnalibro si sposta qui.
   *
   * Un centralino giu' non e' una schermata vuota: la copia esiste per
   * questo, e il guasto si dice **accanto** alla conversazione e non al posto
   * suo — sollevare qui butterebbe via anche il gia' letto. */
  async conversazione({ zitta = false } = {}) {
    if (!this.accesa) return { enabled: false, messages: [] };
    let guaio = "";
    if (this.aperta && (zitta ? this._vecchia() : true)) {
      try {
        await this._rileggi();
      } catch (errore) {
        if (errore instanceof ChatHaDettoNo && errore.codice === "gone") {
          /* La conversazione non esiste piu' nel centralino: l'ha cancellata
           * chi risponde, o se ne sono andati i mesi di silenzio. Va via
           * anche di qua, e non e' una perdita: e' quello che era stato
           * promesso. */
          this._dimenticaQui();
        } else {
          guaio = String(errore?.message || errore);
          this.registro.attenzione(`la chat non si e' riletta: ${guaio}`);
        }
      }
    }
    if (!zitta) this._letto();
    return {
      enabled: true,
      opened: this.aperta,
      name: String(this.dati.nome || ""),
      messages: this.messaggi,
      error: guaio,
    };
  }

  /* `chat/send`: manda un messaggio. Il primo apre la conversazione.
   *
   * Prima di quello questa casa non esiste per il centralino: chi la chat non
   * l'ha mai usata non ha lasciato niente da nessuna parte. */
  async scrivi(testo, { nome = "", lingua = "", app = "" } = {}) {
    if (!this.accesa) {
      throw new ChatHaDettoNo("disabled", "La chat non e' disponibile su questa plancia.");
    }
    const pulito = tagliaBene(String(testo ?? "").trim(), TESTO_MASSIMO);
    if (!pulito) throw new ChatHaDettoNo("empty", "Non c'e' niente da mandare.");
    if (nome) {
      this.dati.nome = tagliaBene(nome, NOME_MASSIMO);
      this.archivio.salva();
    }
    /* La versione dell'app resta scritta qui, e non vale solo per questo
     * messaggio: il centralino riscrive le note anche quando si **rilegge**,
     * e una nota che parte solo insieme a una frase verrebbe cancellata dal
     * primo giro di rilettura. */
    if (app && String(app) !== String(this.dati.app || "")) {
      this.dati.app = tagliaBene(app, ETICHETTA_MASSIMA);
      this.archivio.salva();
    }
    const identita = this._identita();
    /* Da dove eravamo rimasti, **prima** di scrivere. Il numero che il
     * centralino da' al messaggio nuovo e' piu' alto di tutti: prenderlo come
     * segnalibro sposterebbe il segno oltre una risposta arrivata nel
     * frattempo, e quella risposta non verrebbe chiesta mai piu'. */
    let prima = this.ultimo;
    const detto = await this._chiama("POST", "/casa/messaggi", {
      identita,
      corpo: { testo: pulito, nome: String(this.dati.nome || "") },
      note: { nome: String(this.dati.nome || ""), lingua },
    });
    if (detto?.nuova && this.messaggi.length) {
      /* La linea e' nata con questo messaggio, ma una copia c'era gia': vuol
       * dire che nel frattempo qualcuno l'ha cancellata dal centralino. Le
       * frasi vecchie parlano di un filo che non esiste piu'. */
      this._dimenticaQui();
      prima = 0;
    }
    try {
      await this._rileggi({ dopo: prima });
    } catch (_errore) {
      /* Il messaggio e' partito: quello che non e' riuscito e' rileggere. E
       * qui non si mette niente in copia, per la stessa ragione di sopra: la
       * propria frase ha il numero piu' alto di tutti. */
      this.registro.attenzione("la chat ha mandato, ma non si e' riletta");
    }
    const messaggio = detto?.messaggio;
    return { message: messaggio && typeof messaggio === "object" ? messaggio : {} };
  }

  /* `chat/forget`: cancella la conversazione, di qua e dal centralino.
   *
   * L'identita' resta: cancellarla vorrebbe dire che il messaggio dopo arriva
   * a chi risponde come una persona nuova, e la conversazione ripartirebbe da
   * capo senza che nessuno l'abbia chiesto. */
  async dimentica() {
    if (!this.aperta) {
      this._dimenticaQui();
      return false;
    }
    let via = false;
    try {
      const detto = await this._chiama("DELETE", "/casa/messaggi", {
        identita: this._identita(),
      });
      via = Boolean(detto?.cancellata ?? true);
    } catch (errore) {
      /* Se il centralino non risponde non si cancella di qua: sarebbe
       * promettere una cosa che non e' stata fatta. */
      throw errore;
    }
    this._dimenticaQui();
    return via;
  }

  /* La stessa conversazione, nella forma che l'app si aspetta.
   *
   * La schermata Assistenza dell'app e' nata sopra le segnalazioni — stessa
   * lista di fumetti, stesso `Segnalazione` — e li' un messaggio ha `da`,
   * `testo`, `il`. La chat della dashboard li chiama `da`, `testo`,
   * `scritto_il`, e chi risponde e' la «console» invece del «manutentore».
   *
   * Si traduce qui, in un posto solo, invece di insegnare all'app un secondo
   * modo di leggere una conversazione: sono le stesse frasi, e la schermata
   * che le mostra e' gia' quella giusta.
   */
  comeLaVuoleLApp() {
    if (!this.aperta && !this.messaggi.length) return null;
    return {
      numero: 0,
      tipo: "chat",
      titolo: "Chat di assistenza",
      stato: "aperta",
      aperta_il: this._quando(this.messaggi[0]?.scritto_il),
      url: "",
      messaggi: this.messaggi.map((riga) => ({
        da: riga.da === "console" ? "manutentore" : "casa",
        testo: riga.testo,
        il: this._quando(riga.scritto_il),
      })),
    };
  }

  /* ─── Il lato di chi risponde ──────────────────────────────────────────── */

  /* La chiave, e il permesso di usarla.
   *
   * Due domande e non una, come in `chat.py`. La prima e' se da questa casa si
   * risponda alle chat, e la dice la chiave. La seconda e' se la chat sia
   * accesa: senza questo controllo, chi ha spento la chat e ha una finestra
   * gia' aperta continuerebbe a parlare col centralino con l'interruttore su
   * spento. */
  _chiaveDiChiRisponde() {
    if (!this.accesa) {
      throw new ChatHaDettoNo("disabled", "La chat non e' disponibile su questa plancia.");
    }
    if (!this.chiaveDellaConsole) {
      throw new ChatHaDettoNo("forbidden", "Questa casa non risponde alle chat di assistenza.");
    }
    return this.chiaveDellaConsole;
  }

  /* Il nome di una linea, controllato prima di finire in un indirizzo. */
  _unaLinea(linea) {
    const quale = String(linea ?? "").trim();
    if (!LINEA_VALIDA.test(quale)) {
      throw new ChatHaDettoNo("unknown_line", "Quella conversazione non esiste.");
    }
    return quale;
  }

  /* `chat/queue`: le conversazioni aperte, con i non letti e l'ultima cosa
   * detta. Quello che arriva dal centralino si passa com'e': le colonne sono
   * le sue, e riscriverle qui vorrebbe dire tenerle allineate a mano. */
  async coda() {
    const detto = await this._chiamaConsole("GET", "/console/conversazioni");
    const righe = detto?.conversazioni;
    return Array.isArray(righe) ? righe.filter((riga) => riga && typeof riga === "object") : [];
  }

  /* `chat/open`: una conversazione intera.
   *
   * Intera davvero: il centralino ne da' cento per volta e ne conserva
   * duecento, quindi chiedere la prima pagina e fermarsi vorrebbe dire che
   * dalla centunesima in poi non si leggono mai — nemmeno riaprendo, perche'
   * si riaprirebbe sulle stesse cento.
   *
   * Di ogni pagina si tiene solo quello che viene davvero dopo il segnalibro:
   * fidarsi che la risposta rispetti il «dopo N» basterebbe finche' i due lati
   * restano d'accordo, e il giorno che non lo fossero il filo si riempirebbe
   * di righe doppie senza che nessuno sappia perche'. */
  async apri(linea) {
    const quale = this._unaLinea(linea);
    const filo = [];
    let dopo = 0;
    for (let giro = 0; giro < MAX_PAGINE; giro += 1) {
      const detto = await this._chiamaConsole(
        "GET",
        `/console/conversazioni/${quale}?dopo=${dopo}`,
      );
      const righe = Array.isArray(detto?.messaggi) ? detto.messaggi : [];
      const avanti = righe.filter((riga) => riga && (Number(riga.id) || 0) > dopo);
      if (!avanti.length) break;
      filo.push(...avanti);
      dopo = avanti.reduce((piuAlto, riga) => Math.max(piuAlto, Number(riga.id) || 0), dopo);
    }
    return filo;
  }

  /* `chat/answer`: rispondi a una casa. */
  async replica(linea, testo) {
    const quale = this._unaLinea(linea);
    const pulito = tagliaBene(String(testo ?? "").trim(), TESTO_MASSIMO);
    if (!pulito) throw new ChatHaDettoNo("empty", "Non c'e' niente da mandare.");
    const detto = await this._chiamaConsole("POST", `/console/conversazioni/${quale}`, {
      testo: pulito,
    });
    const messaggio = detto?.messaggio;
    return messaggio && typeof messaggio === "object" ? messaggio : {};
  }

  /* `chat/drop`: butta via una conversazione dalla coda di chi risponde.
   *
   * La casa la propria puo' cancellarla da sempre; chi risponde non poteva
   * cancellare niente, e una coda dove non si butta via nulla si riempie di
   * prove, di domande gia' risolte e di righe aperte per sbaglio, finche'
   * quella vera non si trova piu'.
   *
   * Cancella davvero, e per tutti e due: la linea sparisce dal centralino e
   * con lei quello che si erano detti — anche dalla plancia di quella casa. E'
   * il verso giusto della promessa scritta prima della prima riga. */
  async butta(linea) {
    const quale = this._unaLinea(linea);
    const detto = await this._chiamaConsole("DELETE", `/console/conversazioni/${quale}`);
    return Boolean(detto?.cancellata);
  }

  /* ─── Il di dentro ─────────────────────────────────────────────────────── */

  /* Il centralino conta i secondi; l'app legge le date come le scrive
   * Home Assistant. Uno zero non e' una data e non si inventa. */
  _quando(secondi) {
    const numero = Number(secondi || 0);
    if (!numero) return "";
    try {
      return new Date(numero * (numero > 1e11 ? 1 : 1000)).toISOString();
    } catch (_errore) {
      return "";
    }
  }

  _identita() {
    const dentro = this.dati.identita;
    if (dentro?.casa && dentro?.segreto) {
      return { casa: String(dentro.casa), segreto: String(dentro.segreto) };
    }
    const nuova = unaIdentita();
    this.dati.identita = nuova;
    this.archivio.salva();
    this.registro.info("la chat di assistenza ha aperto la sua linea");
    return nuova;
  }

  _vecchia() {
    return this.adesso() - this._lettoIl >= this.quantoDura;
  }

  /* Cosa legge chi risponde sotto «versione».
   *
   * L'integrazione manda li' la versione della plancia, e quella e' la cosa
   * di cui si parla: si tiene davanti. Ma una casa che passa da qui non ha
   * l'integrazione — in mezzo c'e' il ponte, e chi scrive sta spesso in
   * un'app invece che nella pagina — e chi risponde a una domanda su una
   * plancia 1.4.19 che si comporta in un modo che nella 1.4.19 non esiste
   * perderebbe mezz'ora prima di arrivare a chiederlo.
   *
   * Sono quaranta caratteri, non un rapporto: la diagnostica per bene sta
   * nell'app, sotto «Come va l'app», e si incolla quando serve. */
  _etichetta() {
    const pezzi = [];
    if (this.plancia) pezzi.push(`plancia ${this.plancia}`);
    if (this.versione) pezzi.push(`ponte ${this.versione}`);
    const app = String(this.dati.app || "");
    if (app) pezzi.push(`app ${app}`);
    return pezzi.join(" ").slice(0, ETICHETTA_MASSIMA);
  }

  async _rileggi({ dopo = null } = {}) {
    const identita = this._identita();
    const da = dopo === null ? this.ultimo : dopo;
    const detto = await this._chiama("GET", `/casa/messaggi?dopo=${Number(da) || 0}`, {
      identita,
    });
    /* Il centralino dice anche se la linea e' ancora aperta, e qui e' un
     * fatto che non si puo' buttare via: questa funzione la chiama solo chi
     * la chat l'ha gia' aperta, e sentirsi rispondere «non c'e' nessuna
     * linea» vuol dire che la conversazione non esiste piu'. */
    if (detto?.aperta === false) {
      throw new ChatHaDettoNo("gone", "La conversazione non c'e' piu'.");
    }
    this._aggiungi(Array.isArray(detto?.messaggi) ? detto.messaggi : []);
    this._lettoIl = this.adesso();
  }

  /* Mette in copia i messaggi arrivati, senza doppioni: la stessa richiesta
   * puo' partire due volte — un riavvio nel mezzo, due schermate aperte — e
   * un messaggio scritto due volte nella copia si vedrebbe due volte. Il
   * numero e' quello del centralino e non si ripete: basta lui. */
  _aggiungi(nuovi) {
    const conosciuti = new Set(this.messaggi.map((riga) => riga.id));
    const arrivati = [];
    for (const grezza of nuovi) {
      const riga = unaRiga(grezza);
      if (!riga || conosciuti.has(riga.id)) continue;
      conosciuti.add(riga.id);
      arrivati.push(riga);
    }
    if (!arrivati.length) return [];
    const tutte = [...this.messaggi, ...arrivati].sort((una, altra) => una.id - altra.id);
    /* La copia non e' un archivio: la conversazione vera sta nel centralino,
     * che tiene lo stesso numero di righe. */
    this.dati.messaggi = tutte.slice(-STORIA_MASSIMA);
    this.archivio.salva();
    return arrivati;
  }

  _letto() {
    const ultimo = this.ultimo;
    if (Number(this.dati.letto || 0) >= ultimo) return;
    this.dati.letto = ultimo;
    this.archivio.salva();
  }

  _dimenticaQui() {
    if (!this.messaggi.length && !Number(this.dati.letto || 0)) return;
    this.dati.messaggi = [];
    this.dati.letto = 0;
    this.archivio.salva();
  }

  /* Una chiamata al centralino della chat: le intestazioni dell'integrazione,
   * le stesse, perche' dall'altra parte c'e' lo stesso programma.
   *
   * Le tre note che partono insieme al messaggio — la versione, Home
   * Assistant, la lingua — servono a capire una domanda senza doverla
   * chiedere, e sono le uniche che chi risponde riceve senza che nessuno le
   * abbia scritte. Nessuna entita', nessuno stato, nessun indirizzo. */
  async _chiama(metodo, via, { identita, corpo = null, note = {} } = {}) {
    if (!this.accesa) {
      throw new ChatHaDettoNo("not_configured", "La chat non e' configurata.");
    }
    const intestazioni = {
      accept: "application/json",
      "user-agent": "gdahome-ponte",
      authorization: `Bearer ${identita.segreto}`,
      "x-casa": identita.casa,
      "x-versione": this._etichetta(),
      /* Chi gira non e' Home Assistant ma il ponte: si dice quello che si e',
       * invece di far credere a chi risponde una versione che non esiste. */
      "x-ha": "",
      "x-lingua": String(note.lingua || this.lingua || ""),
      /* Il nome nell'intestazione solo se ci sta.
       *
       * Un'intestazione HTTP porta un byte per carattere, e chi si fa chiamare
       * «Giovanni 🙂» ne ha uno che non ci entra: `fetch` non ci prova nemmeno,
       * solleva, e il ponte lo raccontava come «Centralino non
       * raggiungibile». Un emoji nel nome spegneva la chat, tutta, per sempre.
       *
       * Non lo si taglia e non lo si storpia: lo si lascia fuori. Il nome
       * viaggia per davvero nel **corpo**, quando si scrive, e il centralino
       * tiene quello di ieri quando arriva vuoto — quindi ometterlo su una
       * rilettura non perde niente. */
      "x-nome": perUnIntestazione(note.nome),
    };
    return this._bussa(metodo, via, intestazioni, corpo);
  }

  /* Una chiamata al centralino per conto di chi risponde.
   *
   * Le intestazioni sono meno: qui non c'e' nessuna casa che si presenta, c'e'
   * una chiave che apre tutte le linee. Niente `x-casa`, niente segreto, e
   * niente note — le note le scrive chi chiede, non chi risponde. */
  async _chiamaConsole(metodo, via, corpo = null) {
    const chiave = this._chiaveDiChiRisponde();
    const intestazioni = {
      accept: "application/json",
      "user-agent": "gdahome-ponte",
      authorization: `Bearer ${chiave}`,
    };
    if (corpo) intestazioni["content-type"] = "application/json";
    return this._bussa(metodo, via, intestazioni, corpo);
  }

  /* Bussare, e capire cosa e' tornato. E' lo stesso per tutti e due gli
   * sportelli, e sta in un posto solo: un centralino giu' deve raccontarsi
   * nello stesso modo a chi chiede aiuto e a chi lo da'. */
  async _bussa(metodo, via, intestazioni, corpo) {
    let risposta;
    try {
      risposta = await this.prendi(`${this.centralino}${via}`, {
        method: metodo,
        headers: intestazioni,
        body: corpo ? JSON.stringify(corpo) : undefined,
        signal: AbortSignal.timeout(ATTESA),
      });
    } catch (errore) {
      throw new ChatHaDettoNo("unreachable", `Centralino non raggiungibile: ${errore?.message}`);
    }
    let detto = null;
    try {
      detto = await risposta.json();
    } catch (_errore) {
      detto = null;
    }
    if (!risposta.ok) {
      throw new ChatHaDettoNo(
        String(detto?.errore || detto?.code || `http_${risposta.status}`),
        String(
          detto?.spiegazione || detto?.message || `Il centralino ha risposto ${risposta.status}.`,
        ),
      );
    }
    return detto;
  }
}
