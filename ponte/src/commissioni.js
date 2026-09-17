/* Le commissioni: quello che il ponte fa da se' per il telefono.
 *
 * Dopo la stretta di mano il ponte non guarda dentro ai messaggi: sono roba
 * fra il telefono e Home Assistant. Con un'eccezione, ed e' questa: tutto
 * quello che riguarda la plancia, che in Home Assistant non c'e'.
 *
 * Sono quattro cose: i file della plancia (`ponte/http`), dove sta e com'e'
 * (`ponte/plancia`), la sua configurazione (`dashboardmodern/config/…`, che
 * la pagina chiede come la chiederebbe all'integrazione e che qui tiene il
 * ponte), e le chiamate REST che la pagina fa a Home Assistant per lo storico
 * e le istantanee.
 *
 * La plancia vera — quella di DashboardModern, che l'app fa girare dentro un
 * WebView invece di rifarla — e' fatta di file: una pagina, un foglio di
 * stile, duecentosettanta moduli, i caratteri, i ritratti. Quei file li serve
 * Home Assistant, su una porta che dal telefono non si vede: in casa forse,
 * da fuori no, e in ogni caso l'app non sa dov'e' e non deve saperlo. L'unica
 * cosa che il telefono sa raggiungere e' il ponte.
 *
 * Quindi i file li chiede al ponte, sullo stesso filo di tutto il resto:
 *
 *     {id, type: "ponte/http", metodo: "GET", percorso: "/dashboardmodern_static/…"}
 *
 * e il ponte va a prenderli e li rimanda dentro una risposta col suo numero,
 * nella forma che ha ogni risposta di Home Assistant — cosi' per il filo
 * dell'app e' un comando come un altro. La stessa strada la fanno le chiamate
 * REST che la plancia usa per lo storico e per le istantanee delle
 * telecamere.
 *
 * Due strade, e sono diverse apposta:
 *
 *   - `/api/…` passa dal Supervisor, col suo segno. E' l'unica via che un
 *     add-on ha per chiamare l'API di Home Assistant senza avere un segno di
 *     Home Assistant, ed e' la stessa che fa il filo.
 *   - `/dashboardmodern_static/…` va dritta al contenitore di Home Assistant,
 *     senza nessun segno: sono file pubblici, e il Supervisor quella strada
 *     non la fa passare — inoltra `/api/` e basta.
 *
 * Tutto il resto no. Questo non e' un proxy verso Home Assistant: sono due
 * cartelle, e il telefono non ottiene di qui niente che non avesse gia' col
 * filo, che dopo l'abbinamento puo' chiedere a Home Assistant qualunque cosa.
 */

import { request as richiestaHttp } from "node:http";
import { request as richiestaHttps } from "node:https";
import { gzipSync } from "node:zlib";

import {
  Configurazione,
  eConfigurata,
  PROFILO_PRINCIPALE,
  ScattoTroppoGrande,
} from "./configurazione.js";
import { DISPOSITIVI_MASSIMI, ENTITA_MASSIME } from "./catalogo.js";
import { BASE_DELLE_FOTO, BASE_DI_CASA, FOTO_MASSIMA } from "./foto.js";
import { ChatHaDettoNo } from "./chat.js";
import { QuestoNoNo } from "./aggiornamenti.js";
import { CentralinoHaDettoNo, SenzaCentralino } from "./segnalazioni.js";
import { SegnalazioniDellaPlancia } from "./segnalazioni-della-plancia.js";
import { laVede, QuellaPlanciaNo, TroppePlance } from "./plance.js";

/* Quando chi chiede non ha nessuna plancia. Non e' un guasto ed e' l'app a
 * scriverlo, percio' il codice e' uno suo e non uno di Home Assistant. */
export const NIENTE_PER_TE = "niente_per_te";

export const TIPO = "ponte/http";
export const TIPO_PLANCIA = "ponte/plancia";

/* Le plance di questa casa: piu' d'una, come nella dashboard.
 *
 * Aggiungerne una e togliere una sono atti di configurazione, come abbinare un
 * telefono: si fanno dalla scheda dell'add-on, dietro l'autenticazione di Home
 * Assistant, e si fanno anche dall'app. Non e' una svista: un telefono
 * abbinato riscrive gia' la configurazione di una plancia intera con
 * `config/set`, e tenerlo fuori da qui non proteggerebbe niente. */
const PLANCE = new Map([
  ["ponte/plance/elenco", "elenco"],
  ["ponte/plance/aggiungi", "aggiungi"],
  ["ponte/plance/rinomina", "rinomina"],
  ["ponte/plance/togli", "togli"],
]);
/* Dove sta questa casa sulla rete di casa, adesso.
 *
 * Le stesse tre cose che si dicono a un telefono che si abbina
 * (`ritorno.js`), chieste sul filo invece che dentro il QR code. Serve
 * perche' quelle tre cose si dicevano **una volta sola**, e un indirizzo
 * detto una volta sola invecchia: chi abbina la casa stando fuori non ne ha
 * mai sentito nessuno, e chi l'ha abbinata in casa se lo tiene anche quando
 * il router, a un riavvio, ne da' un altro. In tutti e due i casi il telefono
 * passa dal centralino stando sul divano — funziona, e si sente.
 *
 * Il telefono lo chiede sul filo che ha gia' aperto, cioe' dopo la stretta di
 * mano e dentro la cifratura: chi risponde e' questa casa e nessun altro. E
 * l'indirizzo non gli si fa credere sulla parola — ci bussa, e lo tiene solo
 * se risponde. */
const DOVE_TORNARE = "ponte/casa/dove";

const CONFIG_GET = "dashboardmodern/config/get";
const CONFIG_SET = "dashboardmodern/config/set";
const CONFIG_RESTORE = "dashboardmodern/config/restore";
const CATALOGO = "dashboardmodern/integrations/catalog";
const FOTO_ELENCO = "dashboardmodern/www/list";
const FOTO_CARICA = "dashboardmodern/www/upload";
/* Lo spegnimento programmato del clima (#364): nell'integrazione lo tiene
 * Home Assistant, qui lo tiene il ponte (`spegnimento.js`). */
/* Cosa c'e' da aggiornare in casa, e i due tasti per farlo.
 *
 * Non hanno il nome della dashboard — `dashboardmodern/…` — e non e' una
 * distrazione: questi tre comandi non esistono nella plancia. Li' la tessera
 * degli aggiornamenti legge gli stati che il browser ha gia' in mano e chiama
 * `update.install` da se'; qui il telefono gli stati non ce li ha, e chiederli
 * per contare tre righe vorrebbe dire tirarsi giu' tutta la casa. Sono roba
 * del ponte, e si chiamano come quello che fanno. */
const AGGIORNAMENTI_ELENCO = "ponte/aggiornamenti/elenco";
const AGGIORNAMENTI_INSTALLA = "ponte/aggiornamenti/installa";
const AGGIORNAMENTI_RIAVVIA = "ponte/aggiornamenti/riavvia";

const TIMER_ELENCO = "dashboardmodern/clima/timer/list";
const TIMER_METTI = "dashboardmodern/clima/timer/set";
const TIMER_TOGLI = "dashboardmodern/clima/timer/clear";

/* Le segnalazioni della plancia: adesso passano.
 *
 * Per mesi qui c'era un rifiuto in blocco, e la frase era «Le segnalazioni
 * stanno nell'app, non nella plancia». Si vedeva cosi': la finestra si apriva,
 * il modulo c'era, e sopra una riga rossa. Chi sta davanti a Home Assistant e
 * trova un difetto e' nel momento esatto in cui vuole dirlo, e gli si
 * rispondeva «scaricati l'app».
 *
 * Adesso vanno dalla stessa strada dell'app — il ponte, il centralino, la
 * issue — e la traduzione fra i due vocabolari sta in un file suo
 * (`segnalazioni-della-plancia.js`). Sulla issue l'etichetta diventa
 * `da-home-assistant`, e la stampa il ponte perche' quale dei due comandi sia
 * arrivato lo sa solo lui.
 *
 * Restano rifiutati i tre di **chi risponde** — la coda di tutte le case,
 * prendersi una segnalazione, rispondere come manutentore. Quelli stanno nella
 * console dell'app, e accendere qui dei bottoni che nessuno serve vorrebbe
 * dire una finestra che promette e non fa. */
const TICKET_ELENCO = "dashboardmodern/tickets/list";
const TICKET_CREA = "dashboardmodern/tickets/create";
const TICKET_SINCRONIZZA = "dashboardmodern/tickets/sync";
const TICKET_FILO = "dashboardmodern/tickets/thread";
const TICKET_RISPONDI = "dashboardmodern/tickets/reply";
const TICKET_NON_LETTI = "dashboardmodern/tickets/unread";
const TICKET_BUTTA = "dashboardmodern/tickets/delete";
const TICKET_FIRMA = /^dashboardmodern\/tickets\/auth\//;
const TICKET_DI_CHI_RISPONDE = new Set([
  "dashboardmodern/tickets/queue",
  "dashboardmodern/tickets/answer",
  "dashboardmodern/tickets/take",
]);
const NELLA_CONSOLE = "La coda di chi risponde sta nella console dell'app.";
const NIENTE_BOZZE =
  "Da qui una segnalazione o parte o non si scrive: non ci sono bozze da buttare.";

/* La chat di assistenza della dashboard: quattro comandi sono di chi chiede, e
 * li fa il ponte per ogni casa. */
const CHAT_STATO = "dashboardmodern/chat/state";
const CHAT_FILO = "dashboardmodern/chat/thread";
const CHAT_MANDA = "dashboardmodern/chat/send";
const CHAT_DIMENTICA = "dashboardmodern/chat/forget";

/* E quattro sono di chi risponde: la coda di tutte le case, aprirne una,
 * rispondere, buttarla via. Li fa lo stesso ponte, ma solo dove c'e' la chiave
 * della console — cioe' in una casa sola al mondo.
 *
 * Due nomi per la stessa porta, e non e' una svista. Quelli col prefisso della
 * dashboard sono i comandi che la finestra dell'assistenza **gia' manda**: e'
 * il Cruscotto della plancia, mille e duecento righe scritte e tradotte, e
 * riscriverlo per cambiargli il nome ai comandi sarebbe stato l'unico lavoro
 * di tutta la giornata. Quelli col prefisso del ponte sono per l'app, che la
 * dashboard non la nomina da nessuna parte. Sotto c'e' lo stesso metodo. */
const DI_CHI_RISPONDE = new Map([
  ["dashboardmodern/chat/queue", "coda"],
  ["dashboardmodern/chat/open", "apri"],
  ["dashboardmodern/chat/answer", "rispondi"],
  ["dashboardmodern/chat/drop", "butta"],
  ["ponte/console/coda", "coda"],
  ["ponte/console/apri", "apri"],
  ["ponte/console/rispondi", "rispondi"],
  ["ponte/console/butta", "butta"],
]);

/* La pagina, per abitudine vecchia, tiene anche una copia per utente della
 * configurazione in Home Assistant (`frontend/*_user_data`), con questa
 * chiave e coi numeri sotto i settecentomila. Il ponte del pannello la ferma
 * per non avere due scrittori; qui si fa lo stesso, e per la stessa ragione.
 * Le altre chiavi di `frontend/*_user_data` non sono nostre e vanno in Home
 * Assistant come tutto il resto. */
const CHIAVE_VECCHIA = "dashboardmodern_integration_config";
const NUMERO_MODERNO = 700000;

const METODI = new Set(["GET", "POST", "PUT", "DELETE"]);

/* Un file della plancia sta sotto il megabyte; una risposta di Home Assistant
 * — lo storico di un mese — puo' essere molto di piu'. Oltre questo non e'
 * una risposta: e' qualcuno che riempie la memoria. */
const RISPOSTA_MASSIMA = 16 * 1024 * 1024;
const CORPO_MASSIMO = 4 * 1024 * 1024;
const ATTESA = 30_000;

/* Quante commissioni si fanno insieme. Una plancia che parte a freddo ne
 * chiede trecento in pochi secondi: farle tutte nello stesso istante vuol
 * dire trecento connessioni aperte verso Home Assistant, che su un Raspberry
 * e' un modo per farlo pensare ad altro. Otto alla volta bastano a tenere il
 * filo pieno, e le altre aspettano il loro turno. */
const INSIEME = 8;

/* Quello che vale la pena comprimere: testo. Un modulo JavaScript si riduce a
 * un quarto, e passa dal centralino, che e' la strada lenta. Un'immagine e'
 * gia' compressa, e la si lascia stare. */
const DA_COMPRIMERE = /^(text\/|application\/(javascript|json|xml|x-javascript)|image\/svg)/i;
const ALMENO = 512;

/* Un percorso e' fatto di lettere, numeri e pochi segni. Niente `..`, niente
 * caratteri di controllo: quello che il browser della plancia chiede sta
 * tutto qui dentro, e il resto e' qualcuno che prova.
 *
 * Lo **spazio** c'e', e prima non c'era. I file della plancia hanno nomi
 * semplici, ma sotto `/local/` stanno le foto di casa, e quei nomi li
 * sceglie chi le ha scattate: «mia auto.png». Il servitore dell'app scioglie
 * i segni di percentuale prima di chiedere — un nome di file e' il nome, non
 * il modo in cui viaggia — e con lo spazio vietato qui quella foto tornava
 * «percorso non valido». Dall'altra parte `foto.js` lo spazio lo accetta gia'
 * (`PEZZO_BUONO`), e verso Home Assistant ci pensa `new URL`, che rimette la
 * percentuale dov'era. */
const PERCORSO_BUONO = /^\/[A-Za-z0-9_\-./~%+@:=&?,!()*; ]*$/;

/* Senza leggere il JSON: la maggior parte dei messaggi del telefono sono
 * comandi per Home Assistant e non vanno nemmeno aperti. */
export function eUnaCommissione(testo) {
  return (
    typeof testo === "string" &&
    (testo.includes('"ponte/') ||
      testo.includes('"dashboardmodern/') ||
      testo.includes('"frontend/'))
  );
}

function eLaCopiaVecchia(detto) {
  const tipo = detto?.type;
  if (tipo !== "frontend/get_user_data" && tipo !== "frontend/set_user_data") return false;
  if (!String(detto?.key || "").startsWith(CHIAVE_VECCHIA)) return false;
  const numero = Number(detto?.id);
  return !Number.isFinite(numero) || numero < NUMERO_MODERNO;
}

/* L'allegato come arriva dall'app: il file in base64 dentro il messaggio —
 * sul filo passa testo — e qui torna byte, una volta sola. Quello che non
 * e' base64 non e' un file. */
export function unAllegato(detto) {
  const testo = typeof detto.byte === "string" ? detto.byte.replace(/\s+/g, "") : "";
  if (!testo || !/^[A-Za-z0-9+/]+=*$/.test(testo)) return null;
  const byte = Buffer.from(testo, "base64");
  if (byte.length === 0) return null;
  return {
    nome: typeof detto.nome === "string" ? detto.nome.slice(0, 120) : "allegato",
    tipo: typeof detto.tipo === "string" ? detto.tipo.slice(0, 60) : "",
    byte: new Uint8Array(byte.buffer, byte.byteOffset, byte.byteLength),
  };
}

export function si(id, result) {
  return { id, type: "result", success: true, result };
}

export function no(id, code, message) {
  return { id, type: "result", success: false, error: { code, message } };
}

export class Commissioni {
  constructor({
    casa,
    registro,
    plancia = null,
    plance = null,
    configurazione = null,
    catalogo = null,
    foto = null,
    fotoDiCasa = null,
    segnalazioni = null,
    chat = null,
    spegnimento = null,
    aggiornamenti = null,
    ritorno = null,
    scarica = scaricaDavvero,
    insieme = INSIEME,
  } = {}) {
    this.casa = casa;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    /* La plancia dentro l'add-on, e la sua configurazione. Senza — un ponte
     * sul banco, senza la cartella — i file si chiedono a Home Assistant,
     * dove ci sarebbero solo con l'integrazione. */
    this.plancia = plancia;
    /* Quali plance ci sono: i file sono gli stessi per tutte, e questo dice
     * quante sono, come si chiamano e in quale cassetto tiene la sua
     * configurazione ognuna (`plance.js`). */
    this.plance = plance;
    this.configurazione = configurazione;
    /* Il catalogo delle integrazioni e le foto: le altre due cose che la
     * plancia chiedeva all'integrazione. */
    this.catalogo = catalogo;
    this.foto = foto;
    /* Quelle che stanno gia' in Home Assistant, in sola lettura: chi ha una
     * casa da qualche anno le ha li', e le sceglieva da li'. */
    this.fotoDiCasa = fotoDiCasa;
    /* Le segnalazioni dell'app, che passano dal centralino di gdahome. */
    this.segnalazioni = segnalazioni;
    /* E le stesse, scritte dalla finestra della plancia in Home Assistant:
     * un traduttore fra i due vocabolari, sopra lo stesso archivio. Due
     * strade, un elenco — se no una segnalazione scritta da Home Assistant
     * nell'app non si vedrebbe, e sarebbe la stessa casa che racconta due
     * storie. */
    this.dallaPlancia = new SegnalazioniDellaPlancia({ segnalazioni, registro: this.registro });
    /* La chat di assistenza della plancia, che passa dal centralino della
     * dashboard: e' la sua, e nell'app il mestiere dell'integrazione lo fa il
     * ponte. */
    this.chat = chat;
    /* Il conto alla rovescia del clima, che nell'integrazione sta in Home
     * Assistant e qui sta nel ponte. */
    this.spegnimento = spegnimento;
    /* Cosa c'e' da aggiornare, e i due tasti per farlo. In Home Assistant si
     * vede da una pagina che chi usa l'app non apre piu'. */
    this.aggiornamenti = aggiornamenti;
    /* Dove sta questa casa sulla rete di casa: lo sa il Ritorno, che lo
     * chiede al Supervisor. Si mette dopo la costruzione — il Ritorno nasce
     * piu' tardi, che gli serve la porta vera — e dove non c'e' la domanda si
     * sente rispondere «non conosco», come ogni comando che questo ponte non
     * sa fare. */
    this.ritorno = ritorno;
    this.scarica = scarica;
    this.insieme = insieme;
    this._inCorso = 0;
    this._coda = [];
  }

  /* E' una cosa che fa il ponte, o va in Home Assistant? */
  riconosce(detto) {
    const tipo = detto?.type;
    if (typeof tipo !== "string") return false;
    if (tipo.startsWith("ponte/")) return true;
    if (tipo === CONFIG_GET || tipo === CONFIG_SET || tipo === CONFIG_RESTORE)
      return Boolean(this.configurazione);
    if (tipo === CATALOGO) return Boolean(this.catalogo);
    if (tipo === FOTO_ELENCO || tipo === FOTO_CARICA) return Boolean(this.foto);
    if (tipo === CHAT_STATO || tipo === CHAT_FILO || tipo === CHAT_MANDA || tipo === CHAT_DIMENTICA)
      return Boolean(this.chat);
    /* E la coda di chi risponde: la fa lo stesso ponte, e se la chat non c'e'
     * non e' roba sua. Che poi la chiave ci sia o no lo dice la chat, con una
     * frase — qui si decide solo chi risponde a questo comando. */
    if (DI_CHI_RISPONDE.has(tipo)) return Boolean(this.chat);
    if (tipo === TIMER_ELENCO || tipo === TIMER_METTI || tipo === TIMER_TOGLI)
      return Boolean(this.spegnimento);
    /* Le segnalazioni della plancia: sono sempre sue, anche quando non ci sono
     * segnalazioni accese. Chi le chiama e' la finestra della plancia, e
     * quello che deve sentirsi dire — «passano», «qui non si fa», «manca il
     * centralino» — e' questo ponte a saperlo. */
    if (tipo.startsWith("dashboardmodern/tickets/")) return true;
    return Boolean(this.configurazione) && eLaCopiaVecchia(detto);
  }

  /* La risposta a un messaggio riconosciuto, nella forma di Home Assistant.
   * Non solleva mai: un errore e' una risposta con `success: false`, come
   * farebbe Home Assistant per un comando andato storto. */
  /* `chiChiede` e' chi sta dall'altra parte del filo, quando si sa: il
   * telefono che ha aperto il filo — e quindi l'utente di Home Assistant a cui
   * quel telefono e' intestato — oppure l'utente che sta guardando la plancia
   * dentro Home Assistant.
   *
   * Serve a una cosa: le plance che si riservano a qualcuno non devono
   * comparire a chi non le vede. Senza questa riga il QR abbinerebbe un
   * telefono che poi chiede l'elenco e se lo prende tutto — e «chi la vede»
   * varrebbe solo dentro Home Assistant.
   *
   * `null` o vuoto vuol dire «non si sa chi chiede», e chi non si sa vede
   * tutto: e' come sono i telefoni abbinati prima di oggi. */
  async rispondi(detto, { chiChiede = "", amministra = null } = {}) {
    const id = detto?.id ?? null;
    const tipo = detto?.type;
    if (tipo === TIPO) return this._http(detto, chiChiede, amministra);
    if (tipo === TIPO_PLANCIA) return this._laPlancia(detto, chiChiede, amministra);
    if (PLANCE.has(tipo)) return this._lePlance(detto, chiChiede, amministra);
    if (typeof tipo === "string" && tipo.startsWith("ponte/chat/")) return this._chatDellApp(detto);
    if (typeof tipo === "string" && tipo.startsWith("ponte/segnalazioni/"))
      return this._segnalazioni(detto);
    if (tipo === CONFIG_GET || tipo === CONFIG_SET || tipo === CONFIG_RESTORE)
      return this._configurazione(detto);
    if (tipo === DOVE_TORNARE) return this._doveTornare(detto);
    if (tipo === CATALOGO) return this._catalogo(detto);
    if (tipo === FOTO_ELENCO) return this._elencoDelleFoto(detto);
    if (tipo === FOTO_CARICA) return this._caricaUnaFoto(detto);
    if (tipo === CHAT_STATO || tipo === CHAT_FILO || tipo === CHAT_MANDA || tipo === CHAT_DIMENTICA)
      return this._chat(detto);
    if (DI_CHI_RISPONDE.has(tipo)) return this._laConsoleDellaChat(detto);
    if (tipo === TIMER_ELENCO || tipo === TIMER_METTI || tipo === TIMER_TOGLI)
      return this._timerDelClima(detto);
    if (
      tipo === AGGIORNAMENTI_ELENCO ||
      tipo === AGGIORNAMENTI_INSTALLA ||
      tipo === AGGIORNAMENTI_RIAVVIA
    )
      return this._aggiornamenti(detto);
    if (typeof tipo === "string" && tipo.startsWith("dashboardmodern/tickets/"))
      return this._segnalazioniDellaPlancia(detto);
    if (eLaCopiaVecchia(detto)) {
      /* Una risposta innocua, come fa il ponte del pannello: il codice
       * vecchio non resta appeso, e l'unico scrittore resta quello moderno. */
      return si(id, tipo === "frontend/get_user_data" ? { value: null } : null);
    }
    return no(id, "unknown_command", `non conosco ${tipo}`);
  }

  /* Dove ribussare: le stesse tre cose del QR code, dette sul filo.
   *
   * Non e' un segreto e non apre niente: chi chiede ha gia' fatto la stretta
   * di mano, cioe' ha gia' la chiave di questa casa, e con quella chiede a
   * Home Assistant qualunque cosa. Qui si dice soltanto da dove lo si puo'
   * fare piu' in fretta. */
  async _doveTornare(detto) {
    const id = detto?.id ?? null;
    if (!this.ritorno) return no(id, "unknown_command", `non conosco ${detto?.type}`);
    try {
      return si(id, await this.ritorno.cosaDire());
    } catch (errore) {
      /* Il Supervisor che non risponde non e' un guasto di questa casa: il
       * telefono resta dov'e', cioe' sul centralino. */
      this.registro.attenzione(`non so dire dove sta questa casa: ${errore?.message || errore}`);
      return no(id, "unknown_error", "non so dire dove sta questa casa");
    }
  }

  /* Lo spegnimento programmato: le stesse tre risposte dell'integrazione.
   * Un'entita' e' una parola con un punto dentro; i minuti vanno da zero
   * (togli il timer) a settecentoventi, come lo slider. */
  _timerDelClima(detto) {
    const id = detto.id ?? null;
    const timer = this.spegnimento;
    if (!timer) return no(id, "unknown_command", `non conosco ${detto.type}`);
    try {
      if (detto.type === TIMER_ELENCO) return si(id, { scadenze: timer.scadenze() });
      const entita = typeof detto.entity_id === "string" ? detto.entity_id.trim() : "";
      if (entita.length < 3 || entita.length > 255 || !entita.includes("."))
        return no(id, "invalid_format", "entity_id non valido");
      if (detto.type === TIMER_TOGLI) {
        timer.annulla(entita);
        return si(id, { removed: true });
      }
      const minuti = Number(detto.minuti);
      if (!Number.isInteger(minuti) || minuti < 0 || minuti > 720)
        return no(id, "invalid_format", "minuti non validi: da 0 a 720");
      return si(id, { entity_id: entita, scadenza: timer.programma(entita, minuti) });
    } catch (errore) {
      this.registro.errore(`timer del clima andato storto: ${errore?.message || errore}`);
      return no(id, "ponte_timer", "non ha funzionato");
    }
  }

  /* Cosa c'e' da aggiornare in casa, e i due tasti per farlo.
   *
   * Tre comandi e una regola sola: quello che non si sa, non si inventa. Un
   * ponte vecchio non li conosce e risponde «non conosco», che e' la risposta
   * che l'app sa gia' leggere — la sezione resta, e dice che questa casa non
   * sa ancora rispondere invece di girare a vuoto.
   *
   * L'elenco e' una lettura e non cambia niente. Gli altri due fanno partire
   * qualcosa che ci mette minuti e che, meta' delle volte, porta giu' il filo
   * mentre lo fa: `aggiornamenti.js` aspetta poco e risponde «avviato», e a
   * dire com'e' andata ci pensa l'elenco al giro dopo.
   */
  async _aggiornamenti(detto) {
    const id = detto?.id ?? null;
    const quali = this.aggiornamenti;
    if (!quali) return no(id, "unknown_command", `non conosco ${detto?.type}`);
    try {
      if (detto.type === AGGIORNAMENTI_ELENCO)
        return si(id, { aggiornamenti: await quali.elenco({ forza: detto?.forza === true }) });
      if (detto.type === AGGIORNAMENTI_RIAVVIA) {
        this.registro.info("riavvio di Home Assistant chiesto dall'app");
        return si(id, await quali.riavvia());
      }
      const entita = typeof detto.entity_id === "string" ? detto.entity_id.trim() : "";
      this.registro.info(`installazione di ${entita} chiesta dall'app`);
      return si(id, await quali.installa(entita));
    } catch (errore) {
      /* Quello che si puo' spiegare si spiega: «quell'aggiornamento non c'e'
       * piu'» dopo che qualcun altro l'ha gia' fatto e' una frase buona da
       * leggere, e non e' un guasto di niente. */
      if (errore instanceof QuestoNoNo) return no(id, errore.code, errore.message);
      /* E un no di Home Assistant e' suo: il permesso negato di un riavvio si
       * dice com'e', che rifarlo non serve a niente. */
      if (errore?.code) return no(id, errore.code, errore.message || "Home Assistant ha detto no");
      this.registro.errore(`aggiornamenti: ${errore?.message || errore}`);
      return no(id, "ponte_aggiornamenti", "non ha funzionato");
    }
  }

  /* Dove stanno i file della plancia, e quale plancia aprire.
   *
   * Senza `profilo` si risponde con la **prima**, che e' la risposta di
   * sempre: chi ha un'app di ieri non si accorge di niente. Chi lo passa ha
   * scelto una delle altre. E l'elenco viaggia insieme, perche' il selettore
   * lo disegna chi ha appena chiesto la plancia: una seconda domanda per
   * sapere quante sono sarebbe un secondo giro sul filo per niente. */
  _laPlancia(detto, chiChiede = "", amministra = null) {
    const id = detto?.id ?? null;
    if (!this.plancia?.cE) return no(id, "not_found", "questo ponte non ha la plancia");
    const voluto = typeof detto?.profilo === "string" ? detto.profilo.trim() : "";
    const sue = this._lePlanceSue(chiChiede, amministra);
    let quale = this.plance ? (voluto ? this.plance.quale(voluto) : this.plance.prima) : null;
    if (voluto && !quale) return no(id, "not_found", "quella plancia non c'e'");
    /* Nessuna plancia per chi chiede: si dice, e non si apre niente.
     *
     * Qui prima c'era un ripiego — «se nessuna e' sua, la prima si apre
     * comunque, se no il telefono si apre sul vuoto» — e quel ripiego
     * **spegneva la restrizione proprio per chi doveva fermare**: bastava
     * farsi un codice per se' per aprire la plancia riservata a un altro,
     * perche' chi non ne ha nessuna ricadeva sulla prima. Una restrizione che
     * si spegne da sola quando uno non ha niente non e' una restrizione.
     *
     * Il vuoto era un problema vero, e la risposta giusta non era aprire
     * un'altra plancia: e' dirlo. L'app scrive che in questa casa non ci sono
     * plance per la sua utenza, e chi legge sa cosa chiedere a chi amministra
     * la casa. */
    if (chiChiede && sue.length === 0) {
      return no(id, NIENTE_PER_TE, "in questa casa non ci sono plance per la tua utenza");
    }
    /* Chiedere una plancia che non e' sua non e' un errore da spiegare: e'
     * come chiedere la prima **delle sue**. Dirgli «quella esiste ma non e'
     * tua» sarebbe dirgli una cosa che non deve sapere, e per lui non cambia
     * niente. */
    if (quale && !sue.some((una) => una.profilo === quale.profilo)) {
      quale = sue[0] ?? null;
    }
    return si(id, {
      ...this.plancia.descrizione(quale),
      plance: sue,
    });
  }

  /* Le plance che questo si vede. La regola sta in un posto solo —
   * `laVede` in `plance.js` — ed e' la stessa che vale dentro Home
   * Assistant. */
  /* Se questo telefono vede almeno una plancia.
   *
   * Chi non si sa chi e' vede tutto: e' come sono i telefoni abbinati prima
   * di oggi, e un aggiornamento non deve spegnere niente a nessuno. */
  _vedeQualchePlancia(chiChiede = "", amministra = null) {
    if (!chiChiede) return true;
    return this._lePlanceSue(chiChiede, amministra).length > 0;
  }

  _lePlanceSue(chiChiede = "", amministra = null) {
    const tutte = this.plance ? this.plance.elenco() : [];
    if (!chiChiede) return tutte;
    return tutte.filter((una) => laVede(una, chiChiede, amministra));
  }

  /* Aggiungere, rinominare e togliere una plancia.
   *
   * Togliendone una va via anche il suo cassetto nella configurazione: se
   * restasse, chi rifacesse una plancia con lo stesso nome si ritroverebbe
   * dentro il lavoro di quella di prima. Quel cassetto lo tiene la cassetta
   * della configurazione, e a lei si chiede. */
  _lePlance(detto, chiChiede = "", amministra = null) {
    const id = detto?.id ?? null;
    const plance = this.plance;
    if (!plance) return no(id, "unknown_command", `non conosco ${detto.type}`);
    /* Le sue, e solo le sue. Anche quando sono zero: un elenco che si
     * riempie di quelle degli altri appena il tuo e' vuoto e' lo stesso buco
     * di `_laPlancia`, un piano piu' sotto. */
    const sue = () => this._lePlanceSue(chiChiede, amministra);
    /* E quello che non si vede non si tocca: senza questo, chi non vede una
     * plancia poteva comunque rinominarla o toglierla passandone il profilo,
     * che e' peggio che vederla. */
    const nonESua = (quello) => {
      if (!chiChiede || !quello) return false;
      const mie = this._lePlanceSue(chiChiede, amministra);
      return !mie.some((una) => una.profilo === quello);
    };
    const titolo = typeof detto.titolo === "string" ? detto.titolo : "";
    const profilo = typeof detto.profilo === "string" ? detto.profilo : "";
    try {
      switch (PLANCE.get(detto.type)) {
        case "elenco":
          return si(id, { plance: sue() });
        case "aggiungi": {
          const nuova = plance.aggiungi(titolo);
          return si(id, { plance: sue(), quale: nuova });
        }
        case "rinomina":
          if (nonESua(profilo)) return no(id, NIENTE_PER_TE, "quella plancia non e' tua");
          return si(id, {
            quale: plance.rinomina(profilo, titolo),
            plance: sue(),
          });
        case "togli":
          if (nonESua(profilo)) return no(id, NIENTE_PER_TE, "quella plancia non e' tua");
          plance.togli(profilo, {
            dimentica: (quello) => this.configurazione?.dimentica(quello),
          });
          return si(id, { plance: sue() });
        default:
          return no(id, "unknown_command", `non conosco ${detto.type}`);
      }
    } catch (errore) {
      if (errore instanceof TroppePlance || errore instanceof QuellaPlanciaNo) {
        return no(id, errore.codice, errore.message);
      }
      this.registro.errore(`le plance sono andate storte: ${errore?.message || errore}`);
      return no(id, "ponte_plance", "non ha funzionato");
    }
  }

  async _configurazione(detto) {
    const id = detto.id ?? null;
    const cassetta = this.configurazione;
    if (!cassetta) return no(id, "unknown_command", `non conosco ${detto.type}`);
    const profilo = detto.profile ?? PROFILO_PRINCIPALE;
    if (!Configurazione.profiloBuono(profilo))
      return no(id, "invalid_format", "profilo non valido");
    try {
      if (detto.type === CONFIG_GET) {
        await this._laPrendeDallIntegrazione(profilo);
        return si(id, cassetta.leggi(profilo));
      }
      if (detto.type === CONFIG_RESTORE) {
        const revisione = Number(detto.revision);
        if (!Number.isFinite(revisione)) return no(id, "invalid_format", "manca la revisione");
        return si(id, cassetta.ripristina(profilo, revisione));
      }
      const scatto = detto.snapshot;
      if (
        !scatto ||
        typeof scatto !== "object" ||
        !scatto.values ||
        typeof scatto.values !== "object"
      )
        return no(id, "invalid_format", "manca lo scatto");
      return si(
        id,
        cassetta.scrivi(profilo, scatto.values, {
          keys_revision: scatto.keys_revision ?? 0,
          writer_generation: scatto.writer_generation ?? 0,
          updated_at: scatto.updated_at ?? 0,
          expected_revision: detto.expected_revision ?? null,
          reset: detto.reset === true,
        }),
      );
    } catch (errore) {
      if (errore instanceof ScattoTroppoGrande) return no(id, "snapshot_too_large", errore.message);
      this.registro.errore(`configurazione andata storta: ${errore?.message || errore}`);
      return no(id, "ponte_config", "non ha funzionato");
    }
  }

  /* Chi aveva la dashboard prima di gdahome non ricomincia da zero.
   *
   * L'integrazione di DashboardModern — quella che si installa da HACS — la
   * configurazione la tiene in Home Assistant, in `.storage`, e risponde lei
   * a `dashboardmodern/config/*`. Il ponte risponde a quegli **stessi**
   * comandi con la propria cassetta, che per una casa nuova e' vuota: e cosi'
   * chi la plancia l'aveva gia' configurata in Home Assistant apriva l'app e
   * la trovava bianca, e doveva rifare tutto — importare le entita', rimettere
   * le sezioni. L'ha segnalato un provatore, e non e' un caso raro: e' quello
   * che succede a chiunque installi gdahome su una casa che la dashboard ce
   * l'ha gia'.
   *
   * Allora la prima volta che si chiede la configurazione di un profilo, e
   * qui non c'e' niente, la si chiede a Home Assistant: se l'integrazione c'e'
   * risponde lei, e quello che risponde si adotta. La forma e' la stessa —
   * `config_store.py` e `configurazione.js` sono gemelli, e lo scatto
   * pubblico ha gli stessi sei campi — quindi non c'e' niente da tradurre.
   *
   * Tre regole, e sono quelle che rendono questa cosa sicura:
   *
   *  - si guarda **solo** quando qui e' vuoto. Una configurazione fatta
   *    dall'app non viene mai coperta da quella vecchia dell'integrazione;
   *  - si chiede **una volta per profilo**, e se Home Assistant risponde che
   *    quel comando non lo conosce — cioe' l'integrazione non c'e', ed e' il
   *    caso della maggior parte delle case — non si chiede piu' per nessuno;
   *  - non solleva mai. Una casa senza integrazione, un filo caduto, una
   *    risposta strana: si va avanti con la cassetta vuota, che e' esattamente
   *    quello che si faceva prima.
   */
  async _laPrendeDallIntegrazione(profilo) {
    const cassetta = this.configurazione;
    if (!cassetta || !this.casa || this._nienteIntegrazione) return;
    this._giaChiesti ??= new Set();
    if (this._giaChiesti.has(profilo)) return;
    this._giaChiesti.add(profilo);

    /* Se qui c'e' gia' qualcosa, la buona e' questa. */
    try {
      if (eConfigurata(cassetta.leggi(profilo)?.snapshot?.values)) return;
    } catch (_errore) {
      return;
    }

    let suo;
    try {
      /* Quattro secondi e non venti.
       *
       * Di questa domanda sta aspettando la **prima lettura della plancia**:
       * la pagina ha appena aperto il filo e non disegna niente finche' non
       * sa com'e' configurata. Una casa che non risponde non deve tenere una
       * plancia bianca per venti secondi — dopo quattro si va avanti con
       * quello che c'e', che prima di oggi era tutto quello che si faceva. */
      suo = await this.casa.chiedi({ type: CONFIG_GET, profile: profilo }, { entro: 4000 });
    } catch (errore) {
      if (errore?.code === "unknown_command") {
        /* In questa casa l'integrazione non c'e', e non ci sara' nemmeno fra
         * un minuto: non si chiede piu' per nessun profilo. */
        this._nienteIntegrazione = true;
        return;
      }
      /* Il filo caduto, o una casa lenta: non e' una risposta, e non si tiene
       * per una risposta. La prossima volta che si apre la plancia si
       * richiede — una casa che non risponde ha problemi piu' grossi di
       * questo, e non e' un motivo per perdersi la configurazione di chi
       * aveva l'integrazione. */
      this._giaChiesti.delete(profilo);
      this.registro.info(
        `la configurazione dell'integrazione non si e' letta: ${errore?.message || errore}`,
      );
      return;
    }

    const scatto = suo?.snapshot;
    if (!scatto || !eConfigurata(scatto.values)) return;

    try {
      const esito = cassetta.scrivi(profilo, scatto.values, {
        keys_revision: scatto.keys_revision ?? 0,
        writer_generation: scatto.writer_generation ?? 0,
        updated_at: scatto.updated_at ?? 0,
      });
      this.registro.info(
        `la plancia «${profilo}» prende la configurazione dall'integrazione di Home Assistant (${esito?.status || "?"})`,
      );
    } catch (errore) {
      this.registro.attenzione(
        `la configurazione dell'integrazione non si e' adottata: ${errore?.message || errore}`,
      );
    }
  }

  /* La chat di assistenza della plancia, quella che non passa da GitHub.
   *
   * Le quattro risposte hanno la forma che la finestra dell'assistenza si
   * aspetta — sono quelle di `websocket_api.py` dell'integrazione, una per
   * una — perche' la finestra e' la sua e non si tocca. */
  async _chat(detto) {
    const id = detto.id ?? null;
    const chat = this.chat;
    if (!chat) return no(id, "unknown_command", `non conosco ${detto.type}`);
    try {
      switch (detto.type) {
        case CHAT_STATO:
          return si(id, chat.stato());
        case CHAT_FILO:
          return si(id, await chat.conversazione());
        case CHAT_MANDA:
          return si(
            id,
            await chat.scrivi(typeof detto.message === "string" ? detto.message : "", {
              nome: typeof detto.name === "string" ? detto.name : "",
              lingua: typeof detto.locale === "string" ? detto.locale : "",
            }),
          );
        case CHAT_DIMENTICA:
          return si(id, { forgotten: await chat.dimentica() });
        default:
          return no(id, "unknown_command", `non conosco ${detto.type}`);
      }
    } catch (errore) {
      if (errore instanceof ChatHaDettoNo) return no(id, errore.codice, errore.message);
      this.registro.errore(`la chat e' andata storta: ${errore?.message || errore}`);
      return no(id, "ponte_chat", "non ha funzionato");
    }
  }

  /* L'altra meta': la coda di tutte le case, per chi risponde.
   *
   * Le risposte hanno i nomi di `websocket_api.py` — `conversations`,
   * `messages`, `message`, `dropped` — perche' a leggerle c'e' il Cruscotto
   * della plancia, che e' scritto per quelli.
   *
   * **Chi puo' chiedere.** Chiunque sia gia' entrato: un telefono abbinato o
   * una finestra della plancia dentro Home Assistant. Nel ponte non c'e'
   * nessun grado di amministratore da controllare — chi e' passato
   * dall'abbinamento e' gia' dentro casa — e il confine vero e' un altro: la
   * chiave della console. Sta nelle opzioni dell'add-on, che si aprono solo da
   * Home Assistant e solo da chi lo amministra, e senza quella qui non si
   * apre niente in nessuna casa del mondo. */
  async _laConsoleDellaChat(detto) {
    const id = detto.id ?? null;
    const chat = this.chat;
    if (!chat) return no(id, "unknown_command", `non conosco ${detto.type}`);
    /* Una linea la si nomina in due modi, perche' due finestre la nominano in
     * due modi: `line` e' come la chiama la plancia, `linea` come la chiama
     * l'app. Il primo che c'e' vale. */
    const linea =
      typeof detto.line === "string"
        ? detto.line
        : typeof detto.linea === "string"
          ? detto.linea
          : "";
    const testo =
      typeof detto.message === "string"
        ? detto.message
        : typeof detto.testo === "string"
          ? detto.testo
          : "";
    try {
      switch (DI_CHI_RISPONDE.get(detto.type)) {
        case "coda":
          return si(id, { conversations: await chat.coda() });
        case "apri":
          return si(id, { messages: await chat.apri(linea) });
        case "rispondi":
          return si(id, { message: await chat.replica(linea, testo) });
        case "butta":
          return si(id, { dropped: await chat.butta(linea) });
        default:
          return no(id, "unknown_command", `non conosco ${detto.type}`);
      }
    } catch (errore) {
      if (errore instanceof ChatHaDettoNo) return no(id, errore.codice, errore.message);
      this.registro.errore(`la console della chat e' andata storta: ${errore?.message || errore}`);
      return no(id, "ponte_chat", "non ha funzionato");
    }
  }

  /* La chat dell'app: **la stessa** di quella della plancia, e non passa da
   * GitHub — «la chat non deve passare per github, puoi utilizzare la stessa
   * chat della dashboardmodern v2».
   *
   * Prima apriva una issue come una segnalazione, e non andava: una
   * segnalazione e' un difetto che deve restare scritto e ritrovabile,
   * chiedere aiuto e' un'altra cosa — si incolla un pezzo di configurazione,
   * il nome delle proprie entita', a volte una foto di casa — e non si chiede
   * a nessuno di farlo su una pagina pubblica.
   *
   * La schermata dell'app resta la sua: legge una conversazione con dentro
   * dei fumetti, come faceva prima. Sotto, adesso, c'e' `chat.js`. */
  async _chatDellApp(detto) {
    const id = detto.id ?? null;
    const chat = this.chat;
    if (!chat) return no(id, "unknown_command", `non conosco ${detto.type}`);
    try {
      switch (detto.type) {
        /* Come sta la chat, senza uscire di casa: serve all'app per sapere
         * se questa e' la casa di chi risponde — e quindi se disegnare la
         * voce «Console» — senza chiedere la coda per scoprirlo. E' lo stesso
         * `chat/state` che riceve la finestra della plancia. */
        case "ponte/chat/stato":
          return si(id, chat.stato());
        case "ponte/chat/leggi": {
          /* Un centralino giu' non e' una schermata vuota: le parole che
           * c'erano si vedono ancora, e il guasto si dice **accanto** — nella
           * finestra della plancia e nell'app allo stesso modo. Senza questo
           * l'app mostrerebbe una conversazione vecchia con la faccia di una
           * aggiornata. */
          const filo = await chat.conversazione();
          return si(id, { chat: chat.comeLaVuoleLApp(), guaio: filo.error || "" });
        }
        case "ponte/chat/scrivi": {
          const testo = typeof detto.testo === "string" ? detto.testo.slice(0, 5000) : "";
          /* Delle molte misure che l'app manda insieme a una segnalazione, al
           * centralino della chat ne entra una: la sua versione, in fondo
           * all'etichetta. Il resto sta nell'app, sotto «Come va l'app», e si
           * incolla quando chi risponde lo chiede. */
          const app =
            detto.diagnostica && typeof detto.diagnostica === "object"
              ? String(detto.diagnostica.app ?? "")
              : "";
          await chat.scrivi(testo, { app });
          return si(id, chat.comeLaVuoleLApp());
        }
        /* Un allegato questa chat non lo prende: la sua porta passa parole. Si
         * dice, e si dice dove metterlo — una foto dentro una segnalazione ci
         * sta, ed e' il posto giusto per una prova. */
        case "ponte/chat/allega":
          return no(
            id,
            "not_supported",
            "La chat di assistenza passa parole. Una foto si allega a una segnalazione.",
          );
        default:
          return no(id, "unknown_command", `non conosco ${detto.type}`);
      }
    } catch (errore) {
      if (errore instanceof ChatHaDettoNo) return no(id, errore.codice, errore.message);
      this.registro.errore(`la chat dell'app e' andata storta: ${errore?.message || errore}`);
      return no(id, "ponte_chat", "non ha funzionato");
    }
  }

  async _segnalazioni(detto) {
    const id = detto.id ?? null;
    const mie = this.segnalazioni;
    if (!mie) return no(id, "unknown_command", `non conosco ${detto.type}`);
    const parola = (valore, massimo) =>
      typeof valore === "string" ? valore.slice(0, massimo) : "";
    try {
      switch (detto.type) {
        case "ponte/segnalazioni/elenco":
          return si(id, await mie.elenco({ aggiorna: detto.aggiorna === true }));
        case "ponte/segnalazioni/crea":
          return si(
            id,
            await mie.crea({
              tipo: parola(detto.tipo, 20),
              titolo: parola(detto.titolo, 200),
              corpo: parola(detto.corpo, 10000),
              /* Questo comando lo manda l'app, e nient'altro: la plancia ha
                 il suo. Da dove viene lo dice il ponte, non il telefono. */
              da: "app",
              diagnostica:
                detto.diagnostica && typeof detto.diagnostica === "object" ? detto.diagnostica : {},
            }),
          );
        case "ponte/segnalazioni/leggi":
          if (!Number.isFinite(Number(detto.numero)))
            return no(id, "invalid_format", "manca il numero");
          return si(id, await mie.leggi(Number(detto.numero)));
        case "ponte/segnalazioni/rispondi":
          if (!Number.isFinite(Number(detto.numero)))
            return no(id, "invalid_format", "manca il numero");
          return si(id, await mie.rispondi(Number(detto.numero), parola(detto.testo, 5000)));
        case "ponte/segnalazioni/allega": {
          if (!Number.isFinite(Number(detto.numero)))
            return no(id, "invalid_format", "manca il numero");
          const allegato = unAllegato(detto);
          if (!allegato) return no(id, "invalid_format", "manca il file, o non e' base64");
          return si(id, await mie.allega(Number(detto.numero), allegato));
        }
        default:
          return no(id, "unknown_command", `non conosco ${detto.type}`);
      }
    } catch (errore) {
      if (errore instanceof SenzaCentralino) return no(id, errore.codice, errore.message);
      if (errore instanceof CentralinoHaDettoNo) return no(id, errore.codice, errore.message);
      this.registro.errore(`segnalazione andata storta: ${errore?.message || errore}`);
      return no(id, "ponte_segnalazioni", "non ha funzionato");
    }
  }

  /* I comandi della finestra della plancia, tradotti.
   *
   * Gli errori si dicono come li dice il centralino — «hai troppe
   * segnalazioni aperte», «il centralino non risponde» — perche' quella
   * finestra li mostra tali e quali a chi ha appena premuto invia, e
   * «non_ha_funzionato» non gli dice cosa fare. */
  async _segnalazioniDellaPlancia(detto) {
    const id = detto.id ?? null;
    const mie = this.dallaPlancia;
    const parola = (valore, massimo) =>
      typeof valore === "string" ? valore.slice(0, massimo) : "";
    const ilNumero = () => Number(detto.number);

    /* I tre di chi risponde, e il cestino: si rifiutano con una frase. Non
     * sono comandi sconosciuti — la finestra ce li ha — sono comandi che da
     * qui non si fanno, e dirlo con parole e' diverso dal non risponderli. */
    if (TICKET_DI_CHI_RISPONDE.has(detto.type)) return no(id, "not_supported", NELLA_CONSOLE);
    if (detto.type === TICKET_BUTTA) return no(id, "not_supported", NIENTE_BOZZE);

    /* E i tre della firma: qui non c'e' niente da collegare, e si risponde
     * invece di far disegnare un errore rosso per una cosa che non serve. */
    if (TICKET_FIRMA.test(String(detto.type || ""))) return si(id, mie.laFirmaNonSiCollega());

    if (!this.segnalazioni) return no(id, "unknown_command", `non conosco ${detto.type}`);
    try {
      switch (detto.type) {
        case TICKET_ELENCO:
          return si(id, await mie.elenco());
        case TICKET_SINCRONIZZA:
          return si(id, await mie.sincronizza());
        case TICKET_NON_LETTI:
          return si(id, await mie.nonLetti());
        case TICKET_CREA:
          return si(
            id,
            await mie.crea({
              ticket_type: parola(detto.ticket_type, 20),
              title: parola(detto.title, 200),
              body: parola(detto.body, 10000),
              diagnostics:
                detto.diagnostics && typeof detto.diagnostics === "object" ? detto.diagnostics : {},
            }),
          );
        case TICKET_FILO:
          if (!Number.isFinite(ilNumero())) return no(id, "invalid_format", "manca il numero");
          return si(id, await mie.filo(ilNumero()));
        case TICKET_RISPONDI:
          if (!Number.isFinite(ilNumero())) return no(id, "invalid_format", "manca il numero");
          return si(id, await mie.rispondi(ilNumero(), parola(detto.message, 5000)));
        default:
          return no(id, "unknown_command", `non conosco ${detto.type}`);
      }
    } catch (errore) {
      if (errore instanceof SenzaCentralino) return no(id, errore.codice, errore.message);
      if (errore instanceof CentralinoHaDettoNo) return no(id, errore.codice, errore.message);
      this.registro.errore(
        `una segnalazione dalla plancia e' andata storta: ${errore?.message || errore}`,
      );
      return no(id, "ponte_segnalazioni", "non ha funzionato");
    }
  }

  async _catalogo(detto) {
    const id = detto.id ?? null;
    if (!this.catalogo) return no(id, "unknown_command", `non conosco ${detto.type}`);
    let deviceIds = null;
    if (detto.device_ids !== undefined) {
      if (
        !Array.isArray(detto.device_ids) ||
        detto.device_ids.length > DISPOSITIVI_MASSIMI ||
        !detto.device_ids.every(
          (uno) => typeof uno === "string" && uno.length > 0 && uno.length <= 64,
        )
      )
        return no(id, "invalid_format", "device_ids non valido");
      deviceIds = detto.device_ids;
    }
    /* Per nome (#382): la scheda delle macchine chiede di chi sono i sensori
     * che ha trovato, a lotti. */
    let entityIds = null;
    if (detto.entity_ids !== undefined) {
      if (
        !Array.isArray(detto.entity_ids) ||
        detto.entity_ids.length > ENTITA_MASSIME ||
        !detto.entity_ids.every(
          (uno) => typeof uno === "string" && uno.length >= 3 && uno.length <= 255,
        )
      )
        return no(id, "invalid_format", "entity_ids non valido");
      entityIds = detto.entity_ids;
    }
    try {
      return si(id, await this.catalogo.chiedi({ deviceIds, entityIds }));
    } catch (errore) {
      this.registro.attenzione(`catalogo non costruito: ${errore?.message || errore}`);
      return no(
        id,
        errore?.code || "ponte_catalogo",
        String(errore?.message || "non ha funzionato"),
      );
    }
  }

  _elencoDelleFoto(detto) {
    const id = detto.id ?? null;
    if (!this.foto) return no(id, "unknown_command", `non conosco ${detto.type}`);
    const percorso = detto.path ?? "";
    if (typeof percorso !== "string" || percorso.length > 512)
      return no(id, "invalid_format", "percorso non valido");
    /* Da quale delle due cartelle: quella di Home Assistant — dove c'e' quello
     * che c'era gia' — o quella del ponte, dove finisce quello che si carica
     * dall'app.
     *
     * Senza dire niente si guarda in **quella di Home Assistant**, e non e'
     * una preferenza: chi chiede senza dire niente e' la maschera delle foto
     * della dashboard, e per lei `/local` vuol dire `config/www` di Home
     * Assistant. Prima si guardava nel ponte, e allora a chi ha duecento foto
     * in `config/www` la maschera diceva «la cartella config/www non esiste
     * ancora: creala» — rispondendo di un'altra cartella, e dando torto a una
     * persona che aveva ragione.
     *
     * Se la cartella di Home Assistant non e' montata — l'add-on senza
     * `homeassistant_config:ro`, o aggiornato e non ancora riavviato — si
     * ripiega su quella del ponte: e' meglio mostrare le foto caricate
     * dall'app che non mostrare niente. */
    const diCasa =
      detto.root === "casa" || (detto.root !== "ponte" && Boolean(this.fotoDiCasa?.cE));
    const dove = diCasa ? this.fotoDiCasa : this.foto;
    if (!dove) return no(id, "not_found", "Questa cartella non c'e'");
    const elenco = dove.elenca(percorso);
    if (elenco === null) return no(id, "not_found", "La cartella non esiste dentro www");
    /* Quali cartelle si possono guardare: la maschera lo chiede una volta e
     * sa se mostrare il tasto «Home Assistant», invece di offrirlo e poi
     * dire che non c'e' niente. */
    return si(id, {
      ...elenco,
      root: diCasa ? "casa" : "ponte",
      roots: {
        ponte: Boolean(this.foto?.cE),
        casa: Boolean(this.fotoDiCasa?.cE),
      },
    });
  }

  _caricaUnaFoto(detto) {
    const id = detto.id ?? null;
    if (!this.foto) return no(id, "unknown_command", `non conosco ${detto.type}`);
    if (typeof detto.filename !== "string" || !detto.filename || detto.filename.length > 255)
      return no(id, "invalid_format", "manca il nome del file");
    if (typeof detto.data !== "string" || !detto.data || detto.data.length > FOTO_MASSIMA * 2)
      return no(id, "invalid_format", "manca la foto");
    let byte;
    try {
      byte = Buffer.from(detto.data, "base64");
    } catch (_errore) {
      return no(id, "invalid_data", "La foto non e' leggibile.");
    }
    const messa = this.foto.carica(detto.filename, byte);
    if (!messa)
      return no(id, "invalid_upload", "Il file non e' un'immagine, o e' piu' grande di 10 MB.");
    return si(id, messa);
  }

  async _http(detto, chiChiede = "", amministra = null) {
    const id = detto?.id ?? null;
    const metodo = String(detto.metodo ?? "GET").toUpperCase();
    if (!METODI.has(metodo)) return no(id, "not_allowed", `il metodo ${metodo} non passa di qui`);

    const percorso = detto.percorso;
    if (typeof percorso !== "string" || !PERCORSO_BUONO.test(percorso) || percorso.includes("..")) {
      return no(id, "not_allowed", "percorso non valido");
    }

    /* Se chi chiede sa aprire il gzip. Un browser no, e lo dice. */
    const senzaGzip = detto.senzaGzip === true;

    let corpo = null;
    if (detto.corpo != null) {
      if (typeof detto.corpo !== "string") return no(id, "not_allowed", "corpo non valido");
      corpo = Buffer.from(detto.corpo, "base64");
      if (corpo.length > CORPO_MASSIMO) return no(id, "not_allowed", "corpo troppo grande");
    }

    /* Le foto caricate dalla plancia stanno nel ponte. */
    if (percorso.startsWith(`${BASE_DELLE_FOTO}/`) && this.foto) {
      const { stato, tipo, corpo: letto } = this.foto.leggi(percorso);
      return si(id, impacchetta(stato, tipo, letto, { senzaGzip }));
    }

    /* E `/local/…` e' la cartella `www` di Home Assistant.
     *
     * Dentro Home Assistant quell'indirizzo lo serve Home Assistant stessa, e
     * la plancia lo usa da sempre. Nell'app la plancia gira dietro il
     * servitore, e li' quell'indirizzo non porta da nessuna parte: se lo
     * serve il ponte, dal disco, e la stessa configurazione mostra la stessa
     * foto in tutti e due i posti. Sola lettura, e solo immagini. */
    if (percorso.startsWith(`${BASE_DI_CASA}/`) && this.fotoDiCasa) {
      const { stato, tipo, corpo: letto } = this.fotoDiCasa.leggi(percorso);
      return si(id, impacchetta(stato, tipo, letto, { senzaGzip }));
    }

    /* I file della plancia non si servono a chi non vede nessuna plancia.
     *
     * Il rifiuto di `ponte/plancia` da solo non basterebbe: l'app, quando il
     * ponte dice di no, va a cercare la plancia fra i pannelli di Home
     * Assistant — ed e' giusto che lo faccia, perche' e' cosi' che trova
     * quella servita dall'integrazione — ma allora la porta si riapriva da
     * un'altra parte. Senza i file, non c'e' plancia da nessuna strada. */
    if (
      percorso.startsWith("/dashboardmodern_static/") &&
      !this._vedeQualchePlancia(chiChiede, amministra)
    ) {
      return no(id, NIENTE_PER_TE, "in questa casa non ci sono plance per la tua utenza");
    }

    /* I file della plancia stanno qui, nell'add-on: non si va da nessuna
     * parte. Il metodo non conta, e' un file. */
    if (percorso.startsWith("/dashboardmodern_static/") && this.plancia?.cE) {
      const { stato, tipo, corpo: letto } = this.plancia.leggi(percorso);
      return si(id, impacchetta(stato, tipo, letto, { senzaGzip }));
    }

    const dove = await this._dove(percorso);
    if (!dove) {
      return no(id, "not_allowed", "di qui passano solo /api/, /dashboardmodern_static/ e /local/");
    }

    const intestazioni = { ...dove.intestazioni, "accept-encoding": "identity" };
    const tipoDelCorpo = detto.tipo;
    if (corpo && typeof tipoDelCorpo === "string") intestazioni["content-type"] = tipoDelCorpo;

    await this._ilMioTurno();
    try {
      const {
        stato,
        tipo,
        corpo: ricevuto,
      } = await this.scarica({
        url: dove.url,
        metodo,
        intestazioni,
        corpo,
        insicuro: dove.insicuro,
        massimo: RISPOSTA_MASSIMA,
        attesa: ATTESA,
      });
      return si(id, impacchetta(stato, tipo, ricevuto, { senzaGzip }));
    } catch (errore) {
      this.registro.attenzione(
        `commissione fallita (${metodo} ${percorso}): ${errore?.message || errore}`,
      );
      return no(id, "ponte_http", String(errore?.message || "non ha funzionato"));
    } finally {
      this._finito();
    }
  }

  async _dove(percorso) {
    if (percorso.startsWith("/api/")) {
      /* Il filo con Home Assistant passa di qui: `/api/websocket` non e' una
       * cosa che si scarica. */
      if (percorso === "/api/websocket" || percorso.startsWith("/api/websocket?")) return null;
      return {
        url: `${this.casa.indirizzo}${percorso}`,
        intestazioni: { authorization: `Bearer ${this.casa.segno}` },
        insicuro: false,
      };
    }
    if (percorso.startsWith("/dashboardmodern_static/")) {
      const base = await this.casa.doveStaLaPlancia();
      return { url: `${base}${percorso}`, intestazioni: {}, insicuro: base.startsWith("https:") };
    }
    return null;
  }

  _ilMioTurno() {
    if (this._inCorso < this.insieme) {
      this._inCorso += 1;
      return Promise.resolve();
    }
    return new Promise((tocca) => this._coda.push(tocca));
  }

  _finito() {
    const prossimo = this._coda.shift();
    if (prossimo) prossimo();
    else this._inCorso -= 1;
  }
}

/* Il corpo in base64, compresso se e' testo. Chi lo riceve guarda
 * `compresso` e sa cosa fare.
 *
 * Con `senzaGzip` non si comprime: e' quello che chiede l'app quando gira in
 * un **browser**, dove il gzip non si apre — `dart:io` non c'e', e mettersi in
 * casa un decompressore per una cosa che si puo' semplicemente non fare e' il
 * modo lungo. Sulla rete di casa qualche byte in piu' non si sente; fuori casa
 * e' il prezzo di poter guardare la casa da un browser. Chi non lo chiede —
 * cioe' ogni telefono — riceve quello che riceveva prima. */
export function impacchetta(stato, tipo, corpo, { senzaGzip = false } = {}) {
  const dati = Buffer.isBuffer(corpo) ? corpo : Buffer.from(corpo ?? "");
  const tipoPulito = String(tipo || "application/octet-stream");
  if (!senzaGzip && DA_COMPRIMERE.test(tipoPulito) && dati.length >= ALMENO) {
    return { stato, tipo: tipoPulito, corpo: gzipSync(dati).toString("base64"), compresso: "gzip" };
  }
  return { stato, tipo: tipoPulito, corpo: dati.toString("base64") };
}

/* Scaricare con `node:http` e non con `fetch`, per una ragione sola: Home
 * Assistant con il TLS acceso serve i file su `https://172.30.32.1:8123`, con
 * un certificato che parla di un altro nome. Sulla rete fra i contenitori
 * quel certificato non dice niente a nessuno, e `fetch` non ha un modo pulito
 * di lasciarlo passare per una richiesta sola. */
export function scaricaDavvero({
  url,
  metodo = "GET",
  intestazioni = {},
  corpo = null,
  insicuro = false,
  massimo = RISPOSTA_MASSIMA,
  attesa = ATTESA,
}) {
  return new Promise((riuscito, fallito) => {
    const dove = new URL(url);
    const richiesta = dove.protocol === "https:" ? richiestaHttps : richiestaHttp;
    const pezzi = [];
    let quanto = 0;
    const chiamata = richiesta(
      dove,
      {
        method: metodo,
        headers: intestazioni,
        timeout: attesa,
        ...(dove.protocol === "https:" ? { rejectUnauthorized: !insicuro } : {}),
      },
      (risposta) => {
        risposta.on("data", (pezzo) => {
          quanto += pezzo.length;
          if (quanto > massimo) {
            risposta.destroy(new Error("risposta troppo grande"));
            return;
          }
          pezzi.push(pezzo);
        });
        risposta.on("end", () =>
          riuscito({
            stato: risposta.statusCode ?? 0,
            tipo: risposta.headers["content-type"] || "application/octet-stream",
            corpo: Buffer.concat(pezzi),
          }),
        );
        risposta.on("error", fallito);
      },
    );
    chiamata.on("timeout", () =>
      chiamata.destroy(new Error("Home Assistant non ha risposto in tempo")),
    );
    chiamata.on("error", fallito);
    if (corpo) chiamata.write(corpo);
    chiamata.end();
  });
}
