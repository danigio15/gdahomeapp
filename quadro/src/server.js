/* La porta del quadro.
 *
 * Un quadro solo, su una macchina di gdahome, con dentro le case di installatori
 * diversi. Chi installa non accende niente: lo si aggiunge, gli si da' una
 * chiave, e apre una pagina.
 *
 *   GET    /                             la soglia: cos'e' questo indirizzo
 *   GET    /salute                       dice solo che e' vivo
 *
 *   POST   /rapporto                     una casa deposita i suoi numeri, e si
 *                                        porta via quello che le e' stato chiesto
 *   POST   /plancia                      una casa manda com'e' fatta una sua
 *                                        plancia, se il quadro gliel'ha chiesto
 *   GET    /plancia/<profilo>?id=…       e ritira quella che le e' stata scritta
 *   GET    /attesa                       la casa resta in linea, e sente subito
 *   GET    /segno/<inst_…>/<segno>       l'icona di un aggiornamento, senza chiave
 *   GET    /marchio/<chi>                il logo di un installatore, senza chiave
 *   GET    /carattere/<nome>.woff2       il carattere delle pagine, senza chiave
 *
 *   GET    /console/                     la pagina dell'installatore
 *   GET    /console/io                   chi sono, quanti ne ho, qual e' il limite
 *   PUT    /console/io/avvisi            dove mandarmi gli avvisi
 *   POST   /console/io/avvisi/prova      mandamene uno adesso, per vedere
 *   GET    /console/case                 **le sue** case
 *   GET    /console/note/<segno>         le note intere di un aggiornamento
 *   GET    /console/inviti               i **suoi** codici in attesa
 *   POST   /console/inviti               fanne uno, se il limite lo consente
 *   DELETE /console/inviti/<inv_…>       annulla il suo
 *   PUT    /console/casa/<casa_…>        il nome, se la casa e' sua
 *   PUT    /console/casa/<casa_…>/plancia/<profilo>   i due nomi di una sua plancia
 *   POST   /console/casa/<casa_…>/plance     una plancia in piu', che la casa crea
 *   DELETE /console/casa/<casa_…>        non seguirla piu', se e' sua
 *   POST   /console/casa/<casa_…>/installa   chiedile di installare una cosa
 *   POST   /console/casa/<casa_…>/riavvia    chiedile di riavviare Home Assistant
 *   DELETE /console/casa/<casa_…>/installa   ci ripensa, se non e' ancora passata
 *   GET    /console/casa/<casa_…>/plancia/<profilo>/configurazione   com'e' fatta quella plancia
 *   PUT    /console/casa/<casa_…>/plancia/<profilo>/configurazione   scrivila cosi', al prossimo rapporto
 *   POST   /console/casa/<casa_…>/plancia/<profilo>/rinfresca   chiedi alla casa lo scatto di adesso
 *   GET    /console/casa/<casa_…>/plancia/<profilo>/stato       se lo scatto c'e', e di quando
 *   POST   /console/casa/<casa_…>/plancia/<profilo>/gettone     il gettone per l'editor di quella plancia
 *
 *   GET    /plancia-da-lontano/<casa_…>/<profilo>/            la pagina dell'editor della plancia
 *   WS     /plancia-da-lontano/<casa_…>/<profilo>/websocket   e il filo su cui parla, cieco
 *   GET    /dashboardmodern_static/…                          i file della plancia, senza chiave
 *
 *   GET    /gestore/                     la pagina di chi tiene il quadro
 *   GET    /gestore/installatori         chi c'e', quanti impianti ha ognuno e
 *                                        quante entita' in tutto
 *   GET    /gestore/installatore/<id>/case   le sue case, come le vede lui
 *   GET    /gestore/installatore/<id>/note/<segno>   le note intere, come le legge lui
 *   GET    /gestore/salute               /salute per intero: versione, conti, aggiornamenti
 *   POST   /gestore/installatori         aggiungine uno
 *   PUT    /gestore/installatore/<id>    nome e limite
 *   POST   /gestore/installatore/<id>/congela   congelagli l'utenza
 *   DELETE /gestore/installatore/<id>/congela   e ridagliela
 *   POST   /gestore/installatore/<id>/chiave   una chiave nuova
 *   DELETE /gestore/installatore/<id>    eliminalo, con tutto quello che e' suo
 *
 * ─── Tre chiavi, e ognuna apre una porta sola ────────────────────────────
 *
 * Dal **davanti** entrano le case, ognuna con la chiave che le e' stata data:
 * quella apre una porta sola — depositare un rapporto per la propria
 * matricola — e non fa vedere niente.
 *
 * Dal **retro** entrano gli installatori, ognuno con la sua: quella fa vedere
 * **le sue** case e nient'altro. E' la riga che tiene separati installatori che fra
 * loro si fanno concorrenza: i clienti di Rossi non sono affari di Bianchi.
 *
 * Dalla **gestione** entra chi tiene il quadro: aggiunge gli installatori, mette i limiti,
 * e vede le case di ognuno **come le vede lui** — il nome che le ha dato, i
 * controlli, quante entita' hanno — con la chiave della gestione, e non un
 * grammo di piu' di quello che arriva all'installatore. Per un pezzo questa
 * porta contava e basta, «quante, non quali»: adesso chi tiene il quadro
 * tiene anche i suoi installatori, e per aiutarne uno deve vedere quello
 * che vede lui. Non tocca niente: da qui non si installa, non si rinomina,
 * non si toglie. Quello resta a chi la casa l'ha messa.
 *
 * ─── Cosa arriva in una casa, e da dove ─────────────────────────────────
 *
 * Qui c'era scritto che non c'e' nessuna via che entri in una casa. Non e'
 * piu' vero, e va detto com'e': da qui si chiede a una casa di **installare**
 * un aggiornamento, di **riavviare** Home Assistant, di **configurare** una
 * plancia, di vestirla e di crearne una. Nessuno di questi bussa alla casa: la
 * casa passa a prenderseli nella risposta al suo rapporto, o sul filo di
 * `/attesa` che apre lei.
 *
 * E ognuno sta dietro un interruttore **della casa**, non di qui: la
 * manutenzione per installare e riavviare, `quadro_configurazione` per la
 * plancia, il marchio per le vesti. Li accende chi ci abita, dalla scheda
 * dell'add-on, e il no che conta lo dice la casa (`ponte/src/lavori.js`) —
 * questo quadro lo sa e non chiede quello che verrebbe rifiutato, ma non e'
 * lui a decidere. Una casa con gli interruttori spenti da qui riceve solo il
 * nome dell'installatore.
 */

import { readFileSync } from "node:fs";
import { createServer } from "node:http";

import { createHash } from "node:crypto";

import { TUTTE, PLANCE_AL_MASSIMO } from "./case.js";
import { CASA_VALIDA, INVITO_VALIDO, TroppiInviti } from "./chiavi.js";
import { DISCO_FINITO, DISCO_PIENO, TROPPO_CALDO } from "./controlli.js";
import { Fattorino, indirizzoBuono } from "./fattorino.js";
import { comeVaLAggiornamento, laVersioneCheGira } from "./mi-aggiorno.js";
import { CHI_VALIDO } from "./installatori.js";
import { CucituraCieca } from "./cucitura-cieca.js";
import { haFlussi, PlanceDelleCase, PLANCIA_MASSIMA } from "./plance.js";
import { BASE as BASE_DELLA_PLANCIA, PlanciaServita } from "./plancia-servita.js";
import { accetta, eUnaSalita } from "./presa.js";
import { stessoSegreto } from "./segreti.js";
import { ilTipoDi, Marchi, QUANTO_GROSSO } from "./marchi.js";
import { SEGNO_VALIDO, Segni } from "./segni.js";
import { Biglietti, GettoniDellEditor } from "./biglietti.js";
import { laFormaDel, leRigheDeiSegni } from "./forma-del-rapporto.js";
import { Freno } from "./freno.js";

/**
 * Quanto puo' essere grossa un rapporto. Le vere stanno sotto i quattro KiB —
 * ma un rapporto che porta le icone che gli sono state chieste pesa di piu', e
 * quel di piu' e' il motivo di questo numero.
 *
 * Deve stare **sopra** a quello che la casa e' disposta a mandare
 * (`IN_TUTTO_AL_MASSIMO` in `ponte/src/segni.js`, 96 KiB contati in base64) piu'
 * il rapporto vero e proprio. Se stesse sotto succederebbe questo: la casa
 * prepara le icone, il rapporto sfora, qui torna un 413 — e non salta l'icona,
 * salta **tutto il rapporto**. La casa si tiene l'elenco di quello che le e'
 * stato chiesto, al minuto dopo rimanda lo stesso pacco, e si ribecca il 413.
 * Quella casa smetterebbe di dire come sta, per sempre, per un'icona.
 *
 * Ed e' esattamente com'era: 64 KiB qui contro 192 KiB di byte veri di la',
 * che in base64 fanno 256. Bastava un'icona sola un po' grossa.
 *
 * I due numeri si tengono per mano, e una prova per parte li tiene fermi.
 */
const RAPPORTO_MASSIMA = 256 * 1024;

/* A chi scrive un installatore a cui e' stata congelata l'utenza.
 *
 * Sta scritto qui e non nella pagina perche' e' una cosa di questo quadro, non
 * del disegno: chi un domani mettesse su un quadro suo cambia una riga, e non
 * va a cercarla dentro un foglio di stile. */
export const DOVE_SCRIVERE = "assistenza@gdahome.org";

/* Quanto si tiene aperta una richiesta di `/attesa` prima di rispondere a mani
 * vuote.
 *
 * Cinquanta secondi. Il numero non e' scelto per il tempo reale — quello lo da'
 * gia' la prima risposta — ma **contro chi sta in mezzo**: proxy, bilanciatori
 * e router tagliano le richieste ferme, e sessanta secondi e' la soglia che si
 * incontra piu' spesso. Chiudendo prima noi, il filo si riapre in modo
 * ordinato invece di cadere, e nel registro della casa non compare un errore
 * al minuto.
 *
 * E' anche il tempo massimo in cui una casa spenta resta scritta qui dentro
 * senza che nessuno se ne accorga. */
const QUANTO_SI_ASPETTA = 50 * 1000;

const PAGINA = new URL("../console/index.html", import.meta.url);
const PAGINA_DEL_GESTORE = new URL("../gestore/index.html", import.meta.url);

export function json(risposta, corpo, stato = 200) {
  /* L'a capo in fondo non e' un vezzo: `/salute` si guarda **col curl da un
   * terminale** — lo dice il README, ed e' la prima cosa che si fa dopo aver
   * acceso la macchina. Senza, la risposta finisce incollata al prompt della
   * riga dopo, e su un telefono, dove la riga va a capo da sola, diventa
   * illeggibile o sembra che non abbia risposto niente.
   *
   * Per chi legge la risposta da programma non cambia nulla: uno spazio bianco
   * in fondo a un JSON lo ignorano tutti. */
  const testo = `${JSON.stringify(corpo)}\n`;
  risposta.writeHead(stato, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(testo),
  });
  risposta.end(testo);
}

const male = (risposta, stato, perche) => json(risposta, { errore: perche }, stato);

const ilSegno = (richiesta) =>
  (/^Bearer\s+(.+)$/i.exec(String(richiesta.headers.authorization || "").trim()) || [])[1] || "";

async function ilCorpo(richiesta, massimo) {
  let quanto = 0;
  const pezzi = [];
  for await (const pezzo of richiesta) {
    quanto += pezzo.length;
    if (quanto > massimo) throw new TroppoGrosso("questo rapporto e' troppo grosso");
    pezzi.push(pezzo);
  }
  try {
    return JSON.parse(Buffer.concat(pezzi).toString("utf8"));
  } catch (_errore) {
    throw new TroppoGrosso("questo non e' JSON");
  }
}

/* I byte com'e' arrivati, senza provare a leggerli come JSON: e' quello che
 * serve a un'immagine. Il tetto e' l'argomento, perche' un logo e un rapporto
 * non sono grossi uguale. */
async function iByte(richiesta, massimo) {
  let quanto = 0;
  const pezzi = [];
  for await (const pezzo of richiesta) {
    quanto += pezzo.length;
    if (quanto > massimo) throw new TroppoGrosso("questa immagine e' troppo grossa");
    pezzi.push(pezzo);
  }
  return Buffer.concat(pezzi);
}

class TroppoGrosso extends Error {}

/* ─── Le testate di sicurezza ─────────────────────────────────────────────
 *
 * Su ogni risposta, due righe che non costano niente: il browser non indovina
 * il tipo di un file (`nosniff`) e, andando da qui a un'altra parte, non si
 * porta dietro l'indirizzo da cui viene (`no-referrer`) — negli indirizzi di
 * questo quadro ci sono matricole di case.
 *
 * Le pagine hanno in piu' la loro politica (`laPolitica`), e HSTS la mette
 * Caddy, che e' quello che parla TLS (`accendi.sh`). */
function testateDiSerie(risposta) {
  risposta.setHeader("x-content-type-options", "nosniff");
  risposta.setHeader("referrer-policy", "no-referrer");
}

/* L'impronta di ogni `<script>` scritto dentro una pagina, per la politica:
 * cosi' gira quello che c'e' nel file, e un pezzo di pagina iniettato da fuori
 * no. Si calcola sul file com'e', una volta. */
function leImpronteDegliScript(html) {
  const impronte = [];
  const cerca = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let uno;
  while ((uno = cerca.exec(html)) !== null) {
    if (/\ssrc\s*=/i.test(uno[1] || "")) continue;
    impronte.push(`'sha256-${createHash("sha256").update(uno[2], "utf8").digest("base64")}'`);
  }
  return impronte;
}

/* Le origini che possono tenere il cruscotto dentro un riquadro, e passargli
 * la chiave: `QUADRO_OSPITI`, separate da spazi o virgole. Vuoto vuol dire
 * «chiunque lo metta in un riquadro» — e' il caso della tessera dentro Home
 * Assistant, il cui indirizzo e' diverso in ogni casa — e allora una chiave
 * consegnata da un'origine che non e' questa la pagina la usa solo dopo che
 * chi guarda ha detto di si' (vedi `console/index.html`). */
export function gliOspiti(detti = process.env.QUADRO_OSPITI || "") {
  return String(detti)
    .split(/[\s,]+/)
    .map((una) => una.trim().replace(/\/+$/, ""))
    .filter((una) => /^https?:\/\/(\*\.)?[a-z0-9.-]+(:\d{1,5})?$/i.test(una));
}

/* La politica di una pagina.
 *
 * Gli script sono quelli del file e basta, per impronta; niente `<object>`,
 * niente `<base>` che cambi da dove si leggono gli indirizzi relativi, niente
 * moduli spediti altrove. Chi puo' metterla in un riquadro dipende dalla
 * pagina: la gestione nessuno; il cruscotto chi ce lo mette davvero (vedi
 * `gliOspiti`). */
function laPolitica(html, { riquadro }) {
  return [
    "default-src 'self'",
    `script-src ${leImpronteDegliScript(html).join(" ") || "'none'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    `frame-ancestors ${riquadro}`,
  ].join("; ");
}

/* Chi bussa da questa stessa macchina, e non per conto di un altro: senza
 * `x-forwarded-for`, che Caddy mette sempre a chi viene da fuori. */
const daQui = (richiesta) => {
  const da = String(richiesta.socket?.remoteAddress || "");
  const locale = da === "127.0.0.1" || da === "::1" || da === "::ffff:127.0.0.1";
  return locale && !richiesta.headers["x-forwarded-for"] && !richiesta.headers.forwarded;
};

/* Quante porte dell'editor si tengono aperte prima che dicano chi sono. Un
 * WebSocket costa poco, ma mille che non dicono niente per quindici secondi
 * l'uno sono mille prese aperte per niente. */
export const EDITOR_MUTI_AL_MASSIMO = 16;
export const EDITOR_MUTI_PER_UNO = 4;
export const EDITOR_AL_MASSIMO = 64;

export function costruisciIlServer({
  case: case_,
  chiavi,
  installatori,
  chiaveDelGestore = "",
  cartella = "./dati",
  fattorino = new Fattorino(),
  /* I biglietti con cui l'app apre il cruscotto in un altro browser
   * (`biglietti.js`): stanno in memoria, e si passano solo per provarli. */
  biglietti = new Biglietti(),
  /* La plancia da servire dentro il cruscotto, per l'editor: quella
   * dell'add-on, trovata da sola (`plancia-servita.js`). */
  plancia: planciaServita = new PlanciaServita(),
  /* I gettoni dell'editor della plancia (`biglietti.js`): in memoria. */
  gettoni = new GettoniDellEditor(),
  /* Il freno dei rapporti, casa per casa: sei di fila, poi uno ogni venti
   * secondi. Una casa manda un rapporto al minuto, e qualcuno in piu' quando
   * il cruscotto la sveglia: sotto questo passo non ci arriva mai. */
  frenoDeiRapporti = new Freno({ quanti: 6, ogni: 20 * 1000 }),
  /* E quello delle plance e del filo tenuto aperto, che sono piu' fitti. */
  frenoDellePlance = new Freno({ quanti: 12, ogni: 15 * 1000 }),
  frenoDellAttesa = new Freno({ quanti: 20, ogni: 5 * 1000 }),
  /* E quello delle prove degli avvisi, installatore per installatore. */
  frenoDelleProve = new Freno({ quanti: 3, ogni: 60 * 1000 }),
  /* Chi puo' tenere il cruscotto in un riquadro: vedi `gliOspiti`. */
  ospiti = gliOspiti(),
  registro = { debug() {}, info() {}, attenzione() {}, errore() {} },
}) {
  /* La gestione si apre solo dove c'e' una chiave vera. Senza, questo quadro
   * riceve rapporti e non ha modo di aggiungere nessun installatore: e' una meta'
   * inutile, e va detto all'accensione invece di farlo scoprire dalla pagina. */
  const gestoreAperto = String(chiaveDelGestore).length >= 16;

  /* Le due pagine, lette al primo che le chiede (`laPagina`). */
  let pagina;
  let paginaDelGestore;

  /* I loghi degli installatori. Un file per uno, fuori dall'archivio: il
   * perche' sta in cima a `marchi.js`. */
  const marchi = new Marchi({ cartella });
  /* Le icone vere degli aggiornamenti e le loro note intere, come le manda la
   * casa: una cartella per installatore. Il perche' sta in cima a `segni.js`.
   * Quella di tutti, delle versioni di prima, si svuota adesso. */
  const segniDi = (chi) => new Segni({ cartella, di: chi });
  try {
    new Segni({ cartella }).sgombraLaVecchia();
  } catch (_errore) {
    /* Una cartella che non si svuota non ferma il quadro: non la legge piu'
     * nessuno. */
  }
  /* Le plance delle case che si lasciano configurare da lontano: gli scatti
   * che arrivano da casa e le richieste che aspettano di essere ritirate. */
  const scatti = new PlanceDelleCase({ cartella });

  /* ─── Il filo tenuto aperto ───────────────────────────────────────────
   *
   * Chi sta fermo su `/attesa`, casa per casa. Dopo aver depositato, una casa
   * lascia li' una richiesta che non si chiude: quando qualcuno preme
   * «Installa» le si risponde **nell'istante**, invece di farle aspettare il
   * rapporto del minuto dopo.
   *
   * Perche' una richiesta tenuta aperta e non un WebSocket: da una casa al
   * quadro c'e' di mezzo il router di casa, e qualche volta il proxy di
   * un'azienda. Una GET che tarda e' la cosa che passa dappertutto, e qui non
   * serve altro — il filo porta una frase sola, ogni tanto, in una direzione.
   *
   * Una per casa: se ne arriva una seconda, la prima si chiude subito a mani
   * vuote. Una casa che si riavvia lascia indietro la sua, e due fili aperti
   * per la stessa casa vorrebbero dire un comando consegnato a quello morto.
   *
   * La memoria e' del processo e va bene cosi': se il quadro si riavvia i fili
   * cadono, le case se ne accorgono e li riaprono, e nel frattempo c'e' il
   * rapporto al minuto che non ha mai smesso. */
  const aspettano = new Map();

  function sveglia(casa, cosa) {
    const chi = aspettano.get(casa);
    if (!chi) return false;
    aspettano.delete(casa);
    clearTimeout(chi.orologio);
    try {
      chi.rispondi(cosa);
    } catch (_errore) {
      /* Il filo se n'e' andato mentre gli si rispondeva: non e' un guaio di
       * nessuno, e il lavoro resta in coda per il rapporto dopo. */
    }
    return true;
  }

  /* Quando un lavoro viene chiesto, chi e' in linea lo sente adesso. */
  case_.alLavoro = (casa) => {
    if (!aspettano.has(casa)) return;
    const fai = case_.ilLavoroDa(casa);
    if (fai) sveglia(casa, { fai });
  };

  const server = createServer((richiesta, risposta) => {
    testateDiSerie(risposta);
    servi(richiesta, risposta).catch((errore) => {
      registro.errore(`il quadro e' inciampato: ${errore?.message || errore}`);
      if (!risposta.headersSent) male(risposta, 500, "qualcosa e' andato storto");
    });
  });

  /* Spegnendo, i fili aperti si chiudono a mani vuote.
   *
   * Senza questo `server.close()` resterebbe li' ad aspettare che finiscano
   * cinquanta richieste che per definizione non finiscono, e il quadro non si
   * spegnerebbe piu' — in produzione, e nelle prove. Le case se ne accorgono e
   * riaprono al giro dopo. */
  /* E gli editor aperti: un WebSocket aperto tiene su il server come una
   * richiesta aperta. */
  const cuciture = new Set();
  /* Il tempo per mandare la richiesta intera, e le intestazioni: chi le manda
   * una lettera al minuto tiene una presa aperta per niente. Il filo di
   * `/attesa` non c'entra: quello e' la **risposta** che tarda, e la richiesta
   * e' arrivata tutta subito. */
  server.requestTimeout = 60 * 1000;
  server.headersTimeout = 20 * 1000;
  server.lasciaAndareIFili = () => {
    for (const casa of [...aspettano.keys()]) sveglia(casa, {});
    for (const una of [...cuciture]) una.chiudi(1001, "il quadro si spegne");
  };

  /* Il filo dell'editor della plancia: la pagina crede di parlare con Home
   * Assistant, e parla con la cucitura cieca (`cucitura-cieca.js`), che di
   * casa ha solo quello che la casa le ha mandato. Chi e' lo dice il primo
   * messaggio, col gettone dell'editor (`biglietti.js`). */
  server.on("upgrade", (richiesta, socket, testa) => {
    const via = new URL(richiesta.url || "/", "http://quadro").pathname;
    const salita =
      /^\/plancia-da-lontano\/(casa_[0-9a-f]{32})\/([a-z0-9][a-z0-9-]{0,40})\/websocket$/.exec(via);
    if (!salita || !eUnaSalita(richiesta)) {
      socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
      return;
    }
    /* Un tetto a chi sta sul filo senza aver ancora detto chi e', in tutto e
     * per indirizzo, e uno a tutti gli editor aperti. */
    const da = socket.remoteAddress || "?";
    const muti = [...cuciture].filter((una) => !una.chi);
    if (
      cuciture.size >= EDITOR_AL_MASSIMO ||
      muti.length >= EDITOR_MUTI_AL_MASSIMO ||
      muti.filter((una) => una.da === da).length >= EDITOR_MUTI_PER_UNO
    ) {
      socket.end("HTTP/1.1 503 Service Unavailable\r\n\r\n");
      return;
    }
    const presa = accetta(richiesta, socket, {
      onGuasto: (errore) => registro.errore(`l'editor della plancia: ${errore?.stack || errore}`),
    });
    if (!presa) return;
    const cucitura = new CucituraCieca({
      presa,
      casa: salita[1],
      profilo: salita[2],
      scatti,
      case: case_,
      /* Il gettone di questa casa e di questa plancia, e nient'altro: la
       * chiave del cruscotto qui non entra (`biglietti.js`). */
      riconosci: (segno) => gettoni.riconosci(segno, salita[1], salita[2]),
      congelato: (chi) => installatori.congelato(chi),
      registro,
      da,
    });
    cuciture.add(cucitura);
    const eraChiusa = presa.onChiusa;
    presa.onChiusa = (motivo) => {
      cuciture.delete(cucitura);
      eraChiusa?.(motivo);
    };
    presa.riprendi(testa);
  });
  return server;

  async function servi(richiesta, risposta) {
    /* La barra finale **non** si toglie, e non e' una svista: la pagina chiede
     * le sue vie in relativo — `case`, non `/console/case` — cosi' funziona
     * anche dietro un proxy che la monta sotto un prefisso. Da `/console/` un
     * indirizzo relativo porta a `/console/case`; da `/console` porterebbe a
     * `/case`. Percio' chi bussa senza barra ci viene mandato. */
    const via = (richiesta.url || "/").split("?")[0];
    const metodo = richiesta.method || "GET";

    if ((via === "/salute" || via === "/salute/") && metodo === "GET") {
      /* Da fuori dice solo che e' vivo.
       *
       * Diceva anche quale versione gira, quante case e quanti installatori ci
       * sono e se si sta aggiornando: tutte cose utili a chi tiene il quadro,
       * e a chi lo guarda da fuori per sapere cosa c'e' dietro. Adesso quelle
       * righe le legge chi e' su questa macchina (`curl 127.0.0.1:8100/salute`,
       * che e' quello che si fa dopo averla accesa) e la gestione, con la sua
       * chiave, su `/gestore/salute`. */
      json(risposta, daQui(richiesta) ? laSalute() : { vivo: true });
      return;
    }

    if (via === "/" && metodo === "GET") {
      risposta.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      risposta.end(
        "Il quadro di gdahome.\n\n" +
          "Qui le case installate depositano poche righe di numeri, e chi le ha\n" +
          "installate le guarda. Non si entra in nessuna casa da qui.\n\n" +
          "Se hai un codice, va incollato nella scheda dell'add-on gdahome di\n" +
          "casa tua, non qui. La console degli installatori sta su /console/.\n",
      );
      return;
    }

    /* ─── Il davanti: le case ──────────────────────────────────────────── */

    /* La casa resta in linea, e sente subito.
     *
     * Dopo aver depositato il suo rapporto, una casa chiede qui e **non si
     * chiude**: la richiesta resta aperta finche' non c'e' qualcosa da dirle o
     * finche' non scade. Cosi' fra il tasto «Installa» e l'installazione che
     * parte non passa piu' un minuto — passa il tempo di un giro di rete.
     *
     * Chi non puo' o non vuole tenerlo aperto — un ponte vecchio, un proxy che
     * taglia le richieste lunghe — non perde niente: il rapporto al minuto
     * porta il lavoro come ha sempre fatto. Questo e' in piu', non al posto. */
    if (via === "/attesa" && metodo === "GET") {
      const casa = String(richiesta.headers["x-casa"] || "");
      if (!CASA_VALIDA.test(casa)) {
        male(risposta, 400, "questa non e' una matricola");
        return;
      }
      if (!chiavi.riconosci(casa, ilSegno(richiesta), leProve(richiesta))) {
        male(risposta, 403, "questa chiave non apre niente");
        return;
      }
      /* Il freno si guarda **dopo** la chiave: se no chiunque sappia una
       * matricola potrebbe consumare i gettoni di quella casa al posto suo. */
      const fraQuanto = frenoDellAttesa.passa(casa);
      if (fraQuanto) {
        frenato(risposta, fraQuanto);
        return;
      }
      /* Quello che c'e' gia' non fa aspettare nessuno. */
      const subito = case_.ilLavoroDa(casa);
      if (subito) {
        json(risposta, { fai: subito });
        return;
      }
      /* Una per casa: la precedente si chiude a mani vuote, e quella casa ne
       * apre una sola perche' aspetta la risposta prima di rifarlo. */
      sveglia(casa, {});
      const rispondi = (cosa) => json(risposta, cosa);
      const orologio = setTimeout(() => sveglia(casa, {}), QUANTO_SI_ASPETTA);
      orologio.unref?.();
      aspettano.set(casa, { rispondi, orologio });
      /* E se il filo cade dall'altra parte — casa spenta, rete che se ne va —
       * si toglie di mezzo: se no la prima cosa che arriva finirebbe scritta
       * dentro un socket che non c'e' piu', e quel lavoro sarebbe perso invece
       * che consegnato al rapporto dopo. */
      richiesta.on("close", () => {
        const chi = aspettano.get(casa);
        if (chi && chi.rispondi === rispondi) {
          aspettano.delete(casa);
          clearTimeout(orologio);
        }
      });
      return;
    }

    /* Com'e' fatta una plancia, mandata da casa.
     *
     * Solo perche' il quadro l'ha chiesto nella risposta a un rapporto, e solo
     * da una casa che nel suo ultimo rapporto ha detto di permetterlo: una che
     * non lo permette qui non deposita niente, chieda pure chi vuole. Stessa
     * chiave e stessa matricola del rapporto, un tetto suo — una plancia
     * pesa piu' di un rapporto — e mai niente che sia un'immagine: quello che
     * arriva e' gia' passato dal setaccio di casa, e qui non c'e' nessuna via
     * che apra un flusso. */
    if (via === "/plancia" && metodo === "POST") {
      const casa = String(richiesta.headers["x-casa"] || "");
      if (!CASA_VALIDA.test(casa)) {
        male(risposta, 400, "questa non e' una matricola");
        return;
      }
      if (!chiavi.riconosci(casa, ilSegno(richiesta), leProve(richiesta))) {
        male(risposta, 403, "questa chiave non apre niente");
        return;
      }
      if (case_.quella(casa)?.carta?.configurazione !== true) {
        male(risposta, 409, "questa casa non lascia configurare la plancia da lontano");
        return;
      }
      const fraQuanto = frenoDellePlance.passa(casa);
      if (fraQuanto) {
        frenato(risposta, fraQuanto);
        return;
      }
      let scatto;
      try {
        scatto = await ilCorpo(richiesta, PLANCIA_MASSIMA);
      } catch (errore) {
        male(risposta, 413, String(errore?.message || errore));
        return;
      }
      const preso = scatti.prendi(casa, {
        profilo: scatto?.profilo,
        titolo: scatto?.titolo,
        revisione: scatto?.revisione,
        chiavi: scatto?.chiavi,
        generazione: scatto?.generazione,
        aggiornataIl: scatto?.aggiornataIl,
        valori: scatto?.valori,
        /* L'inventario di casa, se questo scatto lo porta: cosa c'e', senza
         * cosa succede. Ripassa dal setaccio dentro `prendi`. */
        inventario: scatto?.inventario ?? null,
      });
      if (!preso) {
        male(risposta, 400, "uno scatto e' un profilo, un titolo, una revisione e i valori");
        return;
      }
      registro.info(
        `da ${casa} e' arrivata la plancia «${preso.profilo}», revisione ${preso.revisione}`,
      );
      json(risposta, { presa: true });
      return;
    }
    /* La configurazione che l'installatore ha scritto, ritirata da casa.
     *
     * E' il pezzo grosso di un lavoro «configura», che nella risposta al
     * rapporto non ci starebbe: la casa ha trovato li' il lavoro, con il suo
     * `id`, e viene a prendersi il resto con la sua chiave. Si consegna una
     * volta, e per quell'`id` soltanto. */
    const ritiro = /^\/plancia\/([a-z0-9][a-z0-9-]{0,63})$/.exec(via);
    if (ritiro && metodo === "GET") {
      const casa = String(richiesta.headers["x-casa"] || "");
      if (!CASA_VALIDA.test(casa)) {
        male(risposta, 400, "questa non e' una matricola");
        return;
      }
      if (!chiavi.riconosci(casa, ilSegno(richiesta), leProve(richiesta))) {
        male(risposta, 403, "questa chiave non apre niente");
        return;
      }
      const id = new URL(richiesta.url, "http://quadro").searchParams.get("id");
      const chiesta = scatti.daConsegnare(casa, ritiro[1], id);
      if (!chiesta) {
        male(risposta, 404, "per questa plancia non c'e' niente da ritirare");
        return;
      }
      registro.info(`${casa} ha ritirato la configurazione della plancia «${ritiro[1]}»`);
      json(risposta, chiesta);
      return;
    }
    if (via === "/rapporto" && metodo === "POST") {
      const casa = String(richiesta.headers["x-casa"] || "");
      if (!CASA_VALIDA.test(casa)) {
        male(risposta, 400, "questa non e' una matricola");
        return;
      }
      if (!chiavi.riconosci(casa, ilSegno(richiesta), leProve(richiesta))) {
        /* Non si distingue «chiave sbagliata» da «chiave di un'altra casa»:
         * chi bussa con una chiave che non e' sua non deve imparare niente da
         * come gli si dice di no. */
        male(risposta, 403, "questa chiave non apre niente");
        return;
      }
      /* Il freno: vedi `frenoDeiRapporti`. Dopo la chiave, per lo stesso
       * motivo di `/attesa`. */
      const fraQuanto = frenoDeiRapporti.passa(casa);
      if (fraQuanto) {
        frenato(risposta, fraQuanto);
        return;
      }
      let carta;
      try {
        carta = await ilCorpo(richiesta, RAPPORTO_MASSIMA);
      } catch (errore) {
        male(risposta, 413, String(errore?.message || errore));
        return;
      }
      if (!carta || typeof carta !== "object" || Array.isArray(carta)) {
        male(risposta, 400, "un rapporto e' un oggetto");
        return;
      }
      /* La matricola che conta e' quella in testa, non quella nel corpo: la
       * prima e' stata verificata contro una chiave, la seconda l'ha scritta
       * chi manda. Si riscrive, e non si discute. Lo stesso vale per di chi e'
       * questa casa: lo dice l'invito con cui e' entrata. */
      const prima = case_.quella(casa);
      const di = chiavi.diChiE(casa);
      /* Si tiene la **forma** del rapporto, non il rapporto com'e' arrivato:
       * numeri che sono numeri, parole tagliate, elenchi col tetto, e niente
       * campi che qui non si conoscono (`forma-del-rapporto.js`). E' quello
       * che finisce nell'archivio e nella pagina di chi installa. */
      const grezzo = carta;
      carta = laFormaDel(grezzo);
      case_.deposita(casa, { ...carta, casa }, di);
      if (!prima) registro.info(`una casa nuova si e' presentata: ${casa}`);
      /* Nella risposta torna **il nome dell'installatore**, che la casa non ha modo
       * di sapere altrimenti: nel codice che le e' stato incollato c'e' solo un
       * codice. Serve alla console dell'add-on, dove chi ci abita legge chi
       * riceve i suoi numeri — e «Impianti Rossi» gli dice qualcosa, un
       * indirizzo no.
       *
       * Quel nome lo scrive **chi tiene il quadro**, non l'installatore: non
       * c'e' nessuna via da cui uno possa cambiarsi il nome, e quindi non
       * c'e' modo di presentarsi in casa di qualcuno come qualcun altro. */
      /* E nella stessa risposta, se c'e', **quello che le e' stato chiesto**.
       *
       * E' l'unica strada per cui un comando entra in una casa, e passa di
       * qui: verso una casa non c'e' nessuna porta aperta, nessun buco nel
       * router, niente da difendere. E' lei che bussa, ogni minuto, e qualche
       * volta chi apre le dice qualcosa.
       *
       * Si chiede **dopo** aver depositato, e non prima: `deposita` butta il
       * lavoro che quella casa ha gia' preso in carico, e chiederlo prima
       * vorrebbe dire riconsegnarle quello che sta gia' facendo. */
      const fai = case_.ilLavoroDa(casa);
      if (fai) registro.info(`a ${casa} si e' consegnato: ${fai.cosa} ${fai.nome} ${fai.a}`);
      /* E se chi segue questa casa ha un logo suo, la matricola con cui
       * andarselo a prendere.
       *
       * La **matricola**, non l'indirizzo: l'indirizzo se lo compone la casa
       * col quadro che ha gia' in configurazione. E' la stessa regola del
       * marchio di un aggiornamento — se di qui passasse un indirizzo, sarebbe
       * questo quadro a decidere dove va a bussare il browser di chi ci abita. */
      const suo = installatori.quello(di);
      /* Le icone e le note che sono arrivate dentro questo rapporto, e quelle
       * che ancora mancano.
       *
       * E' questo scambio che fa viaggiare un'icona **una volta sola**: la casa
       * manda solo quello che il quadro le dice di non avere, e il quadro lo
       * sa guardando i suoi file. Un quadro che li perde li richiede da se'; una
       * casa che si riavvia non rimanda niente che sia gia' arrivato. */
      /* Nella cartella di **chi segue questa casa**, e in quella soltanto:
       * quello che manda una sua casa lo vede lui e nessun altro. Una casa
       * senza nessuno non scrive niente. */
      const suoi = suo ? segniDi(suo.chi) : null;
      const elenco = leRigheDeiSegni(grezzo);
      if (suoi) suoi.metti(elenco);
      const manca = suoi ? suoi.quelliCheMancano(elenco) : [];
      /* E le vesti delle sue plance: i nomi che chi la segue ha scelto per
       * ognuna, se ne ha scelti. Assenti vuol dire «nessuno», e la casa lo
       * legge cosi': quello che era vestito si sveste. */
      const vesti = case_.leVestiDi(casa);
      /* E le plance di cui manca lo scatto, o ne ha uno di un'altra revisione:
       * la casa le manda al giro dopo, su `/plancia`, e solo quelle. Solo se
       * lo permette — e' lei a dirlo, nel rapporto. */
      const vuoleLaPlancia =
        carta?.configurazione === true ? scatti.quali(casa, carta?.plance?.elenco) : [];
      json(risposta, {
        presa: true,
        di: suo?.nome || "",
        ...(suo?.marchio ? { marchio: suo.chi } : {}),
        ...(fai ? { fai } : {}),
        ...(manca.length ? { manca } : {}),
        ...(vesti ? { vesti } : {}),
        ...(vuoleLaPlancia.length ? { vuoleLaPlancia } : {}),
      });
      return;
    }

    /* L'icona di un aggiornamento, **senza chiave**.
     *
     * Stessa regola del marchio di un installatore: sedici cifre esadecimali
     * non si indovinano, e quello che si scopre indovinandole e' l'icona di
     * Mosquitto. Chi la guarda e' il browser di chi installa, e la prende da
     * qui invece che da `brands.home-assistant.io` — cosi' quel browser non va
     * a farsi vedere da una macchina che non e' la sua, e quello che trova e'
     * l'icona giusta invece del logo di HACS. */
    /* `quale` e non `ilSegno`: quel nome e' gia' preso, ed e' la funzione che
     * legge la chiave dall'intestazione. Chiamandolo cosi' la si oscurava, e
     * da li' in poi **ogni** via che chiede una chiave rispondeva 500. */
    /* Con davanti l'installatore: la cartella e' la sua (vedi `segni.js`). */
    const quale = new RegExp(
      `^/segno/(${CHI_VALIDO.source.slice(1, -1)})/(${SEGNO_VALIDO.source.slice(1, -1)})$`,
    ).exec(via);
    if (quale && metodo === "GET") {
      const suo = installatori.quello(quale[1]) ? segniDi(quale[1]).leggi(quale[2]) : null;
      if (!suo) {
        male(risposta, 404, "questo aggiornamento non ha un'icona");
        return;
      }
      risposta.writeHead(200, {
        "content-type": suo.tipo,
        "content-length": suo.byte.length,
        /* Un giorno: l'icona di una versione non cambia mai, e il segno cambia
         * con la versione. */
        "cache-control": "public, max-age=86400, immutable",
        /* Un SVG porta dentro un programma: dentro un `<img>` non gira, ma
         * questo indirizzo lo si puo' anche aprire a mano. */
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "x-content-type-options": "nosniff",
      });
      risposta.end(suo.byte);
      return;
    }

    /* Il carattere delle pagine, servito da qui e non da Google.
     *
     * Le due pagine sono scritte in Manrope. Prenderlo da Google Fonts vorrebbe
     * dire che il browser di ogni installatore — e di chi apre il cruscotto
     * dentro Home Assistant — va a farsi vedere da una macchina che non e' la
     * nostra, a ogni pagina: e' la stessa regola delle icone e dei marchi, che
     * il browser non va a prendere da fuori. I due file stanno in
     * `quadro/carattere/` con la loro licenza (OFL), e si servono senza
     * chiave: un carattere non e' un segreto, ed e' un file che la pagina
     * chiede prima di avere la chiave in mano. Un anno di cache: il nome del
     * file cambia se cambia il carattere. */
    const ilCarattere = /^\/carattere\/(manrope-latin(?:-ext)?)\.woff2$/.exec(via);
    if (ilCarattere && metodo === "GET") {
      let byte = null;
      try {
        byte = readFileSync(new URL(`../carattere/${ilCarattere[1]}.woff2`, import.meta.url));
      } catch (_nonCE) {
        byte = null;
      }
      if (!byte) {
        male(risposta, 404, "questo carattere non c'e'");
        return;
      }
      risposta.writeHead(200, {
        "content-type": "font/woff2",
        "content-length": byte.length,
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      });
      risposta.end(byte);
      return;
    }

    /* Il logo di un installatore, **senza chiave**.
     *
     * Non e' una svista. Questo logo deve arrivare nel browser di chi abita una
     * casa abbinata — che una chiave non ce l'ha, e non gliela si puo' dare — e
     * nella pagina del cruscotto, che la chiave ce l'ha ma la tiene per se'. Un
     * `inst_` sono sedici cifre esadecimali: non si indovina, e quello che si
     * scopre indovinandolo e' un logo stampato su un furgone. */
    const ilMarchio = /^\/marchio\/(inst_[0-9a-f]{16})$/.exec(via);
    if (ilMarchio && metodo === "GET") {
      const suo = installatori.quello(ilMarchio[1]);
      const byte = suo ? marchi.leggi(suo.chi, suo.marchio) : null;
      if (!byte) {
        male(risposta, 404, "questo installatore non ha un marchio");
        return;
      }
      risposta.writeHead(200, {
        "content-type": ilTipoDi(suo.marchio),
        "content-length": byte.length,
        /* Un'ora: un logo cambia una volta ogni mai, e ogni casa abbinata lo
         * chiede a ogni ricarica della pagina. */
        "cache-control": "public, max-age=3600",
        /* Un SVG porta dentro un programma. Dentro un `<img>` non gira, ma
         * questo indirizzo lo si puo' anche aprire a mano — ed e' li' che
         * conterebbe. Queste due righe fanno si' che non conti. */
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "x-content-type-options": "nosniff",
      });
      risposta.end(byte);
      return;
    }

    /* ─── Il retro: gli installatori ───────────────────────────────────── */

    if (via === "/console" && metodo === "GET") {
      risposta.writeHead(301, { location: "/console/" });
      risposta.end();
      return;
    }

    /* La pagina dell'editor della plancia, per il cruscotto.
     *
     * Senza chiave, come i suoi file: e' la pagina pubblica della plancia,
     * quella della repository, con in testa per quale casa e quale plancia
     * e'. Quello che non e' pubblico — lo scatto, l'inventario — lo da' il
     * filo, e il filo la chiave la vuole. Si serve solo per una casa che
     * lascia configurare da lontano: alle altre non c'e' niente da mostrare. */
    const daLontano =
      /^\/plancia-da-lontano\/(casa_[0-9a-f]{32})\/([a-z0-9][a-z0-9-]{0,40})\/$/.exec(via);
    if (daLontano && metodo === "GET") {
      const sua = case_.quella(daLontano[1]);
      if (!sua || sua.carta?.configurazione !== true) {
        male(risposta, 404, "qui non c'e' niente");
        return;
      }
      if (!planciaServita.cE) {
        male(risposta, 404, "questo quadro non si porta dietro la plancia");
        return;
      }
      /* Il marchio di chi segue la casa e i nomi che ha scelto per questa
       * plancia: la pagina esce vestita come la vedrebbe chi ci abita. */
      const suo = installatori.quello(sua.di);
      const logo = suo?.marchio ? marchi.leggi(suo.chi, suo.marchio) : null;
      const chi = suo ? { nome: suo.nome, logo, tipo: ilTipoDi(suo.marchio) } : null;
      const scatto = scatti.scatto(daLontano[1], daLontano[2]);
      risposta.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        /* Questa pagina sta dentro il cruscotto e basta: nessun altro la puo'
         * mettere in un riquadro. Gli script sono i suoi, scritti dentro e
         * fra i file della plancia, e la politica piu' stretta di cosi' non
         * la regge senza riscriverla. */
        "content-security-policy": "object-src 'none'; frame-ancestors 'self'",
        "x-frame-options": "SAMEORIGIN",
      });
      risposta.end(
        planciaServita.pagina({
          casa: daLontano[1],
          profilo: daLontano[2],
          chi,
          vesti: case_.leVestiDi(daLontano[1])?.[daLontano[2]] ?? null,
          configurata: scatto ? Object.keys(scatto.valori || {}).length > 0 : null,
        }),
      );
      return;
    }

    /* E i suoi file: senza chiave — sono quelli della repository — e con
     * l'impronta nell'indirizzo, cosi' il browser se li tiene un anno. */
    if (via.startsWith(`${BASE_DELLA_PLANCIA}/`) && metodo === "GET") {
      if (!planciaServita.cE) {
        male(risposta, 404, "questo quadro non si porta dietro la plancia");
        return;
      }
      const letto = planciaServita.leggi(via);
      if (letto.stato !== 200) {
        male(risposta, letto.stato, "questo file non c'e'");
        return;
      }
      risposta.writeHead(200, {
        "content-type": letto.tipo,
        "cache-control": "public, max-age=31536000, immutable",
        "content-length": letto.corpo.length,
      });
      risposta.end(letto.corpo);
      return;
    }

    if (via === "/console/" && metodo === "GET") {
      laPagina(risposta);
      return;
    }

    /* Il biglietto consegnato da un browser che la chiave non ce l'ha ancora:
     * vale un minuto e una volta (`biglietti.js`). Sta PRIMA della soglia
     * della chiave, perche' la chiave e' proprio quello che chi bussa qui
     * viene a prendere. La chiave che il biglietto porta si riguarda: un
     * installatore tolto nel frattempo non entra da qui. */
    if (via === "/console/entra" && metodo === "POST") {
      let detto = {};
      try {
        detto = await ilCorpo(richiesta, 1024);
      } catch (_errore) {
        detto = {};
      }
      const preso = biglietti.riscatta(String(detto?.biglietto || ""));
      if (!preso || !installatori.riconosci(preso.chiave)) {
        male(risposta, 410, "questo biglietto non vale piu'");
        return;
      }
      json(risposta, { chiave: preso.chiave });
      return;
    }

    if (via.startsWith("/console/")) {
      const chi = installatori.riconosci(ilSegno(richiesta));
      if (!chi) {
        male(risposta, 401, "la chiave non va bene");
        return;
      }
      /* Congelato: la chiave apre, e non fa vedere niente.
       *
       * La chiave deve aprire, se no non si saprebbe chi sta bussando e non
       * gli si potrebbe dire **perche'** non vede piu' niente: si troverebbe
       * un «la chiave non va bene» e andrebbe a cercare un guasto che non
       * c'e'. Quindi si risponde a lui, per nome, con l'indirizzo a cui
       * scrivere.
       *
       * Il controllo sta **qui**, sulla soglia, e non dentro le singole vie:
       * una via aggiunta domani sarebbe una via che si dimentica di guardare
       * se questa utenza e' congelata, e nessuno se ne accorgerebbe fino al
       * giorno che conta. */
      if (installatori.congelato(chi)) {
        json(
          risposta,
          {
            errore: "questa utenza e' congelata",
            congelato: true,
            scrivi: DOVE_SCRIVERE,
          },
          403,
        );
        return;
      }
      await ilRetro(
        richiesta,
        risposta,
        via.slice("/console".length).replace(/\/+$/, ""),
        metodo,
        chi,
      );
      return;
    }

    /* ─── La gestione: chi tiene il quadro ───────────────────────────── */

    if (via === "/gestore" && metodo === "GET") {
      risposta.writeHead(301, { location: "/gestore/" });
      risposta.end();
      return;
    }

    /* La pagina si serve **senza chiave**, come quella degli installatori: la
     * chiave la chiede lei, e senza non mostra niente. Servirla dietro
     * autenticazione vorrebbe dire non avere nessun posto dove digitarla. */
    if (via === "/gestore/" && metodo === "GET") {
      laPagina(risposta, PAGINA_DEL_GESTORE, "gestore");
      return;
    }

    if (via.startsWith("/gestore/")) {
      if (!gestoreAperto || !stessoSegreto(ilSegno(richiesta), String(chiaveDelGestore))) {
        male(
          risposta,
          401,
          gestoreAperto ? "la chiave non va bene" : "questo cruscotto non ha gestore",
        );
        return;
      }
      await laGestione(
        richiesta,
        risposta,
        via.slice("/gestore".length).replace(/\/+$/, ""),
        metodo,
      );
      return;
    }

    male(risposta, 404, "qui non c'e' niente");
  }

  /* La salute per intero: per chi e' sulla macchina e per la gestione.
   *
   * Se il quadro non riesce piu' ad aggiornarsi, lo dice **qui**: e' la riga
   * che si apre dopo averlo acceso, e quella che si riapre quando si sospetta
   * qualcosa. Il registro di una macchina che funziona non lo apre nessuno.
   * E non compare quasi mai: ci vogliono sei giri di fila andati a vuoto.
   *
   * E **quale versione gira**: risponde a «si e' aggiornato?» senza dover
   * entrare nella macchina a leggere un registro. */
  function laSalute() {
    const fermo = comeVaLAggiornamento({ cartella });
    const versione = laVersioneCheGira();
    return {
      vivo: true,
      ...(versione ? { versione } : {}),
      case: case_.lista.length,
      installatori: installatori.lista.length,
      gestore: gestoreAperto,
      ...(fermo ? { nonMiAggiorno: fermo } : {}),
    };
  }

  /* Le prove che una casa porta, oltre alla sua chiave: servono solo il
   * giorno che cambia installatore (`chiavi.riconosci`). */
  function leProve(richiesta) {
    return {
      segreto: String(richiesta.headers["x-casa-segreto"] || ""),
      chiavePrima: String(richiesta.headers["x-chiave-prima"] || ""),
    };
  }

  /* Un 429 con scritto fra quanto riprovare. */
  function frenato(risposta, secondi) {
    risposta.setHeader("retry-after", String(secondi));
    male(risposta, 429, "troppe richieste: riprova fra poco");
  }

  /* Le case di un installatore, nella forma in cui le legge la sua pagina.
   *
   * Una funzione sola per due porte: la sua (`/console/case`) e quella di chi
   * tiene il quadro (`/gestore/installatore/<chi>/case`). Cosi' quello che
   * vede la gestione e' **per costruzione** quello che vede lui — non una
   * seconda forma che gli somiglia oggi e domani no. */
  function leCaseDi(chi) {
    const sue = case_.elenco(chi);
    return {
      case: sue,
      /* Di quali aggiornamenti si hanno le note intere.
       *
       * Un elenco a parte e non un campo dentro ogni riga: la riga di un
       * aggiornamento e' quello che la casa ha mandato, e questo e' quello
       * che il quadro ha ricevuto — due cose diverse, e mescolarle vorrebbe
       * dire riscrivere il rapporto di una casa con roba nostra. Serve alla
       * pagina per far comparire il tasto solo dove c'e' qualcosa da aprire.
       *
       * Solo quelli di **queste** case: un elenco di tutti quelli che il
       * quadro ha sarebbe roba di case di altri, e viaggerebbe a ogni giro. */
      note: [
        ...new Set(
          sue.flatMap((una) =>
            (una.carta?.aggiornamenti?.elenco || [])
              .map((uno) => String(uno?.segno || ""))
              .filter((uno) => segniDi(chi).note(uno)),
          ),
        ),
      ],
      /* Le soglie con cui la pagina colora i metri sono **le stesse** con cui
       * qui si decide se una casa e' da guardare: viaggiano insieme alle case
       * invece di stare scritte anche nella pagina, perche' due numeri uguali
       * in due posti sono due numeri che prima o poi diventano diversi. */
      soglie: { troppoCaldo: TROPPO_CALDO, discoPieno: DISCO_PIENO, discoFinito: DISCO_FINITO },
    };
  }

  /* Le note intere di un aggiornamento, quelle che la casa ha preso da Home
   * Assistant: si rispondono uguali dal retro e dalla gestione. */
  function rispondiLeNote(risposta, chi, segno) {
    const dette = segniDi(chi).note(segno);
    if (!dette) {
      male(risposta, 404, "di questo aggiornamento non sono arrivate le note");
      return;
    }
    json(risposta, { note: dette });
  }

  async function ilRetro(richiesta, risposta, via, metodo, chi) {
    const io = installatori.quello(chi);

    if (via === "/io" && metodo === "GET") {
      json(risposta, {
        /* La matricola serve alla pagina per andarsi a prendere il proprio
         * logo: `/marchio/<chi>` non vuole chiave, e la chiave non si mette in
         * un `src` che finisce nella cronologia del browser. */
        chi,
        nome: io?.nome || "",
        marchio: io?.marchio || "",
        soglia: io?.soglia || 0,
        case: case_.quante(chi),
        avvisi: io?.avvisi || "",
      });
      return;
    }

    if (via === "/io/avvisi" && metodo === "PUT") {
      const detto = await ilDetto(richiesta);
      const dove = String(detto?.dove ?? "").trim();
      /* Vuoto li spegne, ed e' un caso normale. Un indirizzo che non e' `https`
       * si rifiuta subito dicendo perche': nel messaggio c'e' il nome che lui
       * ha dato a una casa, e in chiaro lo leggerebbe chiunque stia in mezzo. */
      if (dove && !indirizzoBuono(dove)) {
        male(risposta, 400, "l'indirizzo degli avvisi deve cominciare per https://");
        return;
      }
      installatori.doveAvvisare(chi, dove);
      json(risposta, { avvisi: dove });
      return;
    }

    if (via === "/io/marchio" && metodo === "PUT") {
      let byte;
      try {
        byte = await iByte(richiesta, QUANTO_GROSSO);
      } catch (errore) {
        male(risposta, 413, String(errore?.message || errore));
        return;
      }
      const razza = marchi.metti(chi, byte, io?.marchio || "");
      if (!razza) {
        /* Un no che dice **perche'**: «non ha funzionato» davanti a un logo
         * che si vede benissimo nel finder e' la risposta peggiore che ci sia. */
        male(
          risposta,
          400,
          byte.length > QUANTO_GROSSO
            ? "questa immagine e' troppo grossa"
            : "si accettano PNG, JPEG e WEBP, e questa non e' nessuno dei tre",
        );
        return;
      }
      installatori.ilMarchio(chi, razza);
      registro.info(`${chi} ha messo il suo marchio (${razza}, ${byte.length} byte)`);
      json(risposta, { marchio: razza });
      return;
    }

    if (via === "/io/marchio" && metodo === "DELETE") {
      marchi.togli(chi, io?.marchio || "");
      installatori.ilMarchio(chi, "");
      json(risposta, { marchio: "" });
      return;
    }

    if (via === "/io/avvisi/prova" && metodo === "POST") {
      /* Un messaggio finto, adesso. Un avviso che si scopre rotto la notte che
       * serviva non e' un avviso: qui si vede subito se quell'indirizzo
       * accetta quello che gli si manda. */
      if (!io?.avvisi) {
        male(risposta, 400, "prima serve un indirizzo dove mandarli");
        return;
      }
      /* Poche per volta: e' un tasto per vedere se funziona, non un modo di
       * far bussare questa macchina a raffica da qualche parte. */
      const fraQuanto = frenoDelleProve.passa(chi);
      if (fraQuanto) {
        frenato(risposta, fraQuanto);
        return;
      }
      const arrivato = await fattorino.porta(io.avvisi, {
        tipo: "prova",
        case: [],
        testo:
          "Questa e' una prova del quadro di gdahome. " +
          "Se la stai leggendo, gli avvisi arrivano dove devono.",
      });
      /* Si' o no, e nient'altro: ne' il codice che ha risposto chi riceve,
       * ne' perche' non e' partito. Un indirizzo che non si accetta, uno che
       * non risponde e uno che dice di no si dicono uguale — da qui non si
       * deve poter imparare cosa c'e' dietro un indirizzo. */
      json(risposta, { arrivato: arrivato === true });
      return;
    }

    if (via === "/case" && metodo === "GET") {
      json(risposta, leCaseDi(chi));
      return;
    }

    /* Le note intere di un aggiornamento, quelle che la casa ha preso da Home
     * Assistant.
     *
     * Con la chiave, e non senza come l'icona: un'icona e' un disegno, un
     * CHANGELOG e' testo che qualcuno ha scritto. E si aprono **dentro la
     * pagina**: prima c'era un collegamento che portava fuori, e leggere cosa
     * cambia prima di premere «Installa» vuol dire restare dove si e'. */
    const leNote = new RegExp(`^/note/(${SEGNO_VALIDO.source.slice(1, -1)})$`).exec(via);
    if (leNote && metodo === "GET") {
      rispondiLeNote(risposta, chi, leNote[1]);
      return;
    }

    /* Un biglietto per aprire il cruscotto in un altro browser senza
     * ribattere la chiave: lo chiede l'app prima di aprire il browser del
     * telefono, e porta la chiave con cui e' stato chiesto — questa. */
    if (via === "/biglietto" && metodo === "POST") {
      json(risposta, biglietti.stacca(chi, ilSegno(richiesta)));
      return;
    }

    if (via === "/inviti" && metodo === "GET") {
      json(risposta, { inviti: chiavi.elenco(chi) });
      return;
    }

    if (via === "/inviti" && metodo === "POST") {
      let detto = {};
      try {
        detto = await ilCorpo(richiesta, 4096);
      } catch (_errore) {
        detto = {};
      }
      try {
        const codice = chiavi.fai({
          di: chi,
          per: detto?.per,
          limite: io?.soglia || 0,
          quante: case_.quante(chi),
        });
        registro.info("un codice nuovo, buono per una casa e per un giorno");
        /* Il codice intero esce **adesso e basta**: nell'archivio c'e' la sua
         * impronta, e nell'elenco solo le ultime lettere. L'`id` serve alla
         * pagina per sapere quale riga e' questa. */
        json(risposta, { codice, id: chiavi.ultimoFatto, inviti: chiavi.elenco(chi) });
      } catch (errore) {
        male(risposta, errore instanceof TroppiInviti ? 409 : 500, String(errore?.message));
      }
      return;
    }

    /* Col suo nome (`inv_…`), o col codice intero di una volta. */
    const invito = /^\/inviti\/(inv_[0-9a-f]{16}|[A-Za-z0-9-]{8,40})$/.exec(via);
    if (invito && metodo === "DELETE") {
      json(risposta, { annullato: chiavi.annulla(invito[1], chi), inviti: chiavi.elenco(chi) });
      return;
    }

    const casa = /^\/casa\/(casa_[0-9a-f]{32})$/.exec(via);
    if (casa && metodo === "PUT") {
      let detto = {};
      try {
        detto = await ilCorpo(richiesta, 4096);
      } catch (_errore) {
        detto = {};
      }
      if (!case_.rinomina(casa[1], detto?.nome, chi)) {
        /* «Non e' tua» e «non esiste» si dicono uguale: da un no non si deve
         * imparare che una certa matricola esiste da qualche altra parte. */
        male(risposta, 404, "questa casa non la segui tu");
        return;
      }
      json(risposta, { case: case_.elenco(chi) });
      return;
    }

    /* Le vesti di una plancia: i due nomi che l'installatore sceglie per
     * ognuna delle plance di una sua casa — il titolo per il menu laterale e
     * la home, la parola del velo d'avvio. Vedi `Case.vesti`. */
    const veste = /^\/casa\/(casa_[0-9a-f]{32})\/plancia\/([a-z0-9][a-z0-9-]{0,40})$/.exec(via);
    if (veste && metodo === "PUT") {
      let detto = {};
      try {
        detto = await ilCorpo(richiesta, 4096);
      } catch (_errore) {
        detto = {};
      }
      const esito = case_.vesti(
        veste[1],
        veste[2],
        { titolo: detto?.titolo, velo: detto?.velo },
        chi,
      );
      if (esito.errore === "non_sua") {
        male(risposta, 404, "questa casa non la segui tu");
        return;
      }
      if (esito.errore === "senza_elenco") {
        male(
          risposta,
          409,
          "questo impianto non manda ancora l'elenco delle plance: aggiorna l'add-on gdahome di casa",
        );
        return;
      }
      if (esito.errore === "non_ce") {
        male(risposta, 404, "questo impianto non ha una plancia con quel profilo");
        return;
      }
      if (esito.errore === "senza_nome") {
        male(risposta, 400, "una plancia che la casa deve ancora creare ha bisogno del suo nome");
        return;
      }
      registro.info(`${chi} ha vestito la plancia ${veste[2]} di ${veste[1]}`);
      /* E la casa lo sa adesso, se e' in linea: la scelta viaggia nella
       * risposta al rapporto, e senza questa riga arriverebbe al giro del
       * minuto. Un ponte di ieri, che questa parola non la conosce, riapre
       * il filo e basta, e la trova al giro dopo come prima. */
      sveglia(veste[1], { rapporto: true });
      json(risposta, { case: case_.elenco(chi) });
      return;
    }

    /* Una plancia in piu', voluta dal cruscotto: qui nasce la scelta, la
     * casa la crea al rapporto dopo. Vedi `Case.nuovaPlancia`. */
    const plance = /^\/casa\/(casa_[0-9a-f]{32})\/plance$/.exec(via);
    if (plance && metodo === "POST") {
      let detto = {};
      try {
        detto = await ilCorpo(richiesta, 4096);
      } catch (_errore) {
        detto = {};
      }
      const esito = case_.nuovaPlancia(
        plance[1],
        { titolo: detto?.titolo, velo: detto?.velo },
        chi,
      );
      if (esito.errore === "non_sua") {
        male(risposta, 404, "questa casa non la segui tu");
        return;
      }
      if (esito.errore === "senza_elenco") {
        male(
          risposta,
          409,
          "questo impianto non manda ancora l'elenco delle plance: aggiorna l'add-on gdahome di casa",
        );
        return;
      }
      if (esito.errore === "senza_nome") {
        male(risposta, 400, "serve il nome della plancia");
        return;
      }
      if (esito.errore === "troppe") {
        male(
          risposta,
          409,
          `di plance se ne tengono ${PLANCE_AL_MASSIMO} per impianto, e questo e' al limite`,
        );
        return;
      }
      registro.info(`${chi} ha aggiunto la plancia ${esito.profilo} a ${plance[1]}`);
      /* La casa la crea appena passa, e passa adesso se e' in linea: chi ha
       * premuto «Aggiungi» la vede nascere in pochi secondi, senza che in
       * casa nessuno confermi niente — non c'e' niente da confermare. */
      sveglia(plance[1], { rapporto: true });
      json(risposta, { profilo: esito.profilo, case: case_.elenco(chi) });
      return;
    }

    /* I due lavori che si chiedono a una casa: installare una cosa, o
     * riavviare Home Assistant. Stessa strada — si mette in attesa, la casa se
     * lo porta via al rapporto dopo — e stessa porta per annullare. */
    /* L'editor vuole la plancia **di adesso**: si segna che lo scatto di
     * questa plancia va rimandato anche se la revisione e' la stessa, e si
     * sveglia la casa perche' passi subito. La risposta dice cosa c'e' gia'
     * — lo scatto di prima, se c'e', e di quando — e se la casa era in
     * linea: chi apre l'editor sa cosa aspettarsi. */
    /* Il gettone per l'editor di questa plancia: lo chiede il cruscotto con
     * la sua chiave, e lo passa alla pagina dell'editor al posto della
     * chiave (`biglietti.js`). Solo per una casa sua che lo permette. */
    const perLEditor =
      /^\/casa\/(casa_[0-9a-f]{32})\/plancia\/([a-z0-9][a-z0-9-]{0,40})\/gettone$/.exec(via);
    if (perLEditor && metodo === "POST") {
      const sua = case_.quella(perLEditor[1]);
      if (!sua || sua.di !== chi) {
        male(risposta, 404, "qui non c'e' niente");
        return;
      }
      if (sua.carta?.configurazione !== true) {
        male(risposta, 409, "questo impianto non lascia configurare la plancia da lontano");
        return;
      }
      json(risposta, gettoni.dai(chi, perLEditor[1], perLEditor[2]));
      return;
    }

    const rinfresco =
      /^\/casa\/(casa_[0-9a-f]{32})\/plancia\/([a-z0-9][a-z0-9-]{0,40})\/(rinfresca|stato)$/.exec(
        via,
      );
    if (rinfresco && metodo === (rinfresco[3] === "rinfresca" ? "POST" : "GET")) {
      const sua = case_.quella(rinfresco[1]);
      if (!sua || sua.di !== chi) {
        male(risposta, 404, "qui non c'e' niente");
        return;
      }
      if (sua.carta?.configurazione !== true) {
        male(risposta, 409, "questo impianto non lascia configurare la plancia da lontano");
        return;
      }
      let inLinea = aspettano.has(rinfresco[1]);
      if (rinfresco[3] === "rinfresca") {
        scatti.rinfresca(rinfresco[1], rinfresco[2]);
        inLinea = sveglia(rinfresco[1], { rapporto: true }) || inLinea;
        registro.info(`${chi} vuole lo scatto di «${rinfresco[2]}» di ${rinfresco[1]} adesso`);
      }
      const scatto = scatti.scatto(rinfresco[1], rinfresco[2]);
      json(risposta, {
        scatto: scatto
          ? {
              revisione: scatto.revisione,
              presoIl: scatto.presoIl,
              chiesta: scatto.chiesta,
            }
          : null,
        inventario: Boolean(scatti.inventario(rinfresco[1])),
        inLinea,
        editor: planciaServita.cE ? planciaServita.versione() : "",
      });
      return;
    }

    /* Com'e' fatta una plancia di una casa che lo permette, e scriverla.
     *
     * Leggere da' lo scatto arrivato da casa, con la richiesta in attesa se
     * c'e'. Scrivere mette in coda un lavoro «configura» — stessa strada di
     * «installa»: la casa lo trova nel prossimo rapporto — e tiene da parte i
     * valori perche' la casa passi a ritirarli. I no si dicono uguale, come
     * per gli altri lavori: casa non tua, casa che non lo permette, un lavoro
     * gia' in coda. */
    const plancia =
      /^\/casa\/(casa_[0-9a-f]{32})\/plancia\/([a-z0-9][a-z0-9-]{0,40})\/configurazione$/.exec(via);
    if (plancia && (metodo === "GET" || metodo === "PUT")) {
      const sua = case_.quella(plancia[1]);
      if (!sua || sua.di !== chi) {
        male(risposta, 404, "qui non c'e' niente");
        return;
      }
      if (sua.carta?.configurazione !== true) {
        male(risposta, 409, "questo impianto non lascia configurare la plancia da lontano");
        return;
      }
      if (metodo === "GET") {
        json(risposta, { scatto: scatti.scatto(plancia[1], plancia[2]) });
        return;
      }
      let detto;
      try {
        detto = await ilCorpo(richiesta, PLANCIA_MASSIMA);
      } catch (errore) {
        male(risposta, 413, String(errore?.message || errore));
        return;
      }
      const valori = detto?.valori;
      if (!valori || typeof valori !== "object" || Array.isArray(valori)) {
        male(risposta, 400, "una configurazione e' un oggetto");
        return;
      }
      /* La regola che tiene in piedi il permesso, detta anche qui: da lontano
       * si sceglie quale telecamera va dove, non dove sta il suo flusso. La
       * casa lo ricontrolla per conto suo. */
      if (haFlussi(valori)) {
        male(
          risposta,
          400,
          "dentro c'e' un indirizzo di flusso o un gettone: da lontano non si toccano",
        );
        return;
      }
      const revisioneAttesa = Number.isFinite(Number(detto?.revisioneAttesa))
        ? Math.max(0, Math.floor(Number(detto.revisioneAttesa)))
        : null;
      const messo = case_.chiediUnLavoro(
        plancia[1],
        { cosa: "configura", nome: plancia[2], da: String(revisioneAttesa ?? ""), a: "" },
        chi,
      );
      if (!messo) {
        male(risposta, 409, "questo lavoro non si puo' chiedere adesso");
        return;
      }
      scatti.chiedi(plancia[1], plancia[2], { id: messo.id, valori, revisioneAttesa });
      registro.info(`chiesto a ${plancia[1]}: configura la plancia «${plancia[2]}»`);
      json(risposta, { chiesto: messo, case: case_.elenco(chi) });
      return;
    }
    const lavoro = /^\/casa\/(casa_[0-9a-f]{32})\/(installa|riavvia|configura)$/.exec(via);
    if (lavoro && metodo === "POST") {
      let detto = {};
      try {
        detto = await ilCorpo(richiesta, 4096);
      } catch (_errore) {
        detto = {};
      }
      const messo = case_.chiediUnLavoro(lavoro[1], { ...detto, cosa: lavoro[2] }, chi);
      if (!messo) {
        /* Tre no in uno, e si dicono uguale: la casa non e' tua, non ha aperto
         * la manutenzione, o ne sta gia' facendo uno. Il primo dei tre e' il
         * motivo per cui si dicono uguale — da un no non si deve imparare che
         * una certa matricola esiste da qualche altra parte — e gli altri due
         * la pagina li sa gia', perche' li legge nel rapporto. */
        male(risposta, 409, "questo lavoro non si puo' chiedere adesso");
        return;
      }
      registro.info(
        messo.cosa === "riavvia"
          ? `chiesto a ${lavoro[1]}: riavvia Home Assistant`
          : `chiesto a ${lavoro[1]}: installa ${messo.nome} ${messo.da} → ${messo.a}`,
      );
      json(risposta, { chiesto: messo, case: case_.elenco(chi) });
      return;
    }

    if (lavoro && metodo === "DELETE") {
      const inCoda = case_.quella(lavoro[1])?.lavoro;
      const annullato = case_.annullaIlLavoro(lavoro[1], chi);
      if (annullato && inCoda?.cosa === "configura")
        scatti.dimenticaLaChiesta(lavoro[1], inCoda.nome);
      json(risposta, { annullato, case: case_.elenco(chi) });
      return;
    }

    if (casa && metodo === "DELETE") {
      /* Non seguirla piu' vuol dire due cose insieme: si butta quello che se
       * ne sa, e si butta la sua chiave — se no il primo rapporto la farebbe
       * rinascere tre secondi dopo. */
      const mia = chiavi.diChiE(casa[1]) === chi;
      const cEra = case_.togli(casa[1], chi);
      if (mia) chiavi.stacca(casa[1]);
      if (cEra) scatti.butta(casa[1]);
      if (cEra) registro.info(`questa casa non si segue piu': ${casa[1]}`);
      json(risposta, { tolta: cEra, case: case_.elenco(chi) });
      return;
    }

    male(risposta, 404, "qui non c'e' niente");
  }

  async function laGestione(richiesta, risposta, via, metodo) {
    /* Il quadro visto da chi lo tiene, sempre nella stessa forma.
     *
     * Lo tornano **tutte** le vie che cambiano qualcosa, non solo quella che
     * legge: una risposta che porta l'elenco ma non i totali fa scrivere zero
     * alla pagina, e chi ha appena aggiunto un installatore vede «0 impianti in tutto»
     * con le righe che dicono altro. Una forma sola non lo lascia succedere. */
    const ilQuadro = () => ({
      installatori: installatori.elenco(
        (chi) => case_.quante(chi),
        (chi) => case_.entita(chi),
      ),
      case: case_.lista.length,
      /* Quelle di un installatore tolto: restano, e continuano a depositare. Senza
       * questo numero il totale non tornerebbe con la somma degli installatori, e non
       * si capirebbe perche'. */
      orfane: case_.orfane(installatori.lista.map((uno) => uno.chi)),
    });

    if (via === "/installatori" && metodo === "GET") {
      json(risposta, ilQuadro());
      return;
    }

    /* Le case di un installatore, come le vede lui.
     *
     * La stessa funzione della sua pagina, e quindi la stessa risposta: il
     * nome che ha dato a ogni casa, lo stato, i controlli, il rapporto con
     * quante entita' ha. Non c'e' un campo in piu' — se all'installatore una
     * cosa non arriva, non arriva nemmeno qui. Un installatore che non c'e'
     * e' un 404, non un elenco vuoto: un elenco vuoto sembrerebbe «nessuna
     * casa», che e' un'altra risposta. */
    const leSue = new RegExp(`^/installatore/(${CHI_VALIDO.source.slice(1, -1)})/case$`).exec(via);
    if (leSue && metodo === "GET") {
      if (!installatori.quello(leSue[1])) {
        male(risposta, 404, "questo installatore non c'e'");
        return;
      }
      json(risposta, leCaseDi(leSue[1]));
      return;
    }

    /* Le note intere: le stesse che legge l'installatore, dalla sua
     * cartella, con la chiave della gestione. */
    const leNote = new RegExp(
      `^/installatore/(${CHI_VALIDO.source.slice(1, -1)})/note/(${SEGNO_VALIDO.source.slice(1, -1)})$`,
    ).exec(via);
    if (leNote && metodo === "GET") {
      if (!installatori.quello(leNote[1])) {
        male(risposta, 404, "questo installatore non c'e'");
        return;
      }
      rispondiLeNote(risposta, leNote[1], leNote[2]);
      return;
    }

    if (via === "/salute" && metodo === "GET") {
      json(risposta, laSalute());
      return;
    }

    if (via === "/installatori" && metodo === "POST") {
      const detto = await ilDetto(richiesta);
      const fatto = installatori.fai({ nome: detto?.nome, soglia: detto?.soglia });
      registro.info(`un installatore nuovo: ${fatto.chi}`);
      /* La chiave in chiaro esce **una volta sola**, adesso. Poi qui resta solo
       * la sua impronta: se si perde si rifa', non si recupera. */
      json(risposta, { ...fatto, ...ilQuadro() });
      return;
    }

    const uno = new RegExp(`^/installatore/(${CHI_VALIDO.source.slice(1, -1)})$`).exec(via);
    if (uno && metodo === "PUT") {
      const detto = await ilDetto(richiesta);
      if (!installatori.quello(uno[1])) {
        male(risposta, 404, "questo installatore non c'e'");
        return;
      }
      if (detto?.nome !== undefined) {
        /* Vuoto si rifiuta: un installatore senza nome e' una riga che non
         * dice di chi sono gli impianti, e il nome finisce anche in cima alle
         * plance delle sue case. La soglia invece si cambia da sola, e allora
         * il nome non si tocca. */
        const nome = String(detto.nome ?? "")
          .replace(/\s+/g, " ")
          .trim();
        if (!nome) {
          male(risposta, 400, "serve un nome");
          return;
        }
        installatori.rinomina(uno[1], nome);
      }
      if (detto?.soglia !== undefined) installatori.limite(uno[1], detto.soglia);
      json(risposta, ilQuadro());
      return;
    }

    if (uno && metodo === "DELETE") {
      /* Eliminare un installatore porta via **tutto quello che e' suo**: lui, i
       * suoi codici in attesa, le chiavi delle sue case, le sue case e il suo
       * marchio.
       *
       * ─── Perche' adesso porta via anche le case ──────────────────────────
       *
       * Prima no: le case restavano, e siccome nessuno le guardava piu'
       * diventavano un numero — «3 impianti senza piu' nessuno» — che non si
       * poteva ne' aprire ne' riassegnare. Il ragionamento era buono (sono
       * impianti che funzionano in casa di qualcuno) ma la conseguenza no:
       * roba che occupa posto per sempre e non serve a nessuno.
       *
       * Adesso ci sono **due tasti, e due cose diverse**. Congela e' quello per
       * la lite con l'installatore: lui non vede piu' niente, le case restano
       * accese e non si perde una riga. Elimina e' quello per «questo non c'e'
       * piu'», e fa proprio quello.
       *
       * ─── Cosa succede a quelle case ──────────────────────────────────────
       *
       * Continuano a mandare il rapporto — non lo sanno, e da qui non si
       * decide cosa fa casa d'altri — e si sentono rispondere di no. Per
       * tornare dentro ci vuole un codice nuovo, di un installatore vivo,
       * incollato **da dentro casa**: e' l'unica strada, ed e' la stessa che
       * regge tutto il resto. Riaggiungere l'installatore di prima non basta,
       * perche' prende una matricola nuova.
       *
       * La pagina lo dice prima di farlo, con quante case si porta dietro. */
      const chi = uno[1];
      if (!installatori.quello(chi)) {
        male(risposta, 404, "questo installatore non c'e'");
        return;
      }
      const suoi = chiavi.toglieTutto(chi);
      const quante = case_.toglieTutto(chi);
      gettoni.dimentica(chi);
      marchi.togli(chi, installatori.quello(chi)?.marchio || "");
      const chiuso = installatori.togli(chi);
      registro.info(
        `installatore eliminato: ${chi} — ${quante} case, ${suoi.chiavi} chiavi, ` +
          `${suoi.inviti} codici in attesa`,
      );
      json(risposta, { chiuso, case: quante, ...ilQuadro() });
      return;
    }

    /* Congela e scongela.
     *
     * Due vie e non una con un `acceso: true/false` nel corpo: cosi' quello
     * che sta per succedere si legge nel registro del server e nella barra del
     * browser, e un corpo storto non puo' scongelare chi si voleva congelare. */
    const gelo = new RegExp(`^/installatore/(${CHI_VALIDO.source.slice(1, -1)})/congela$`).exec(
      via,
    );
    if (gelo && (metodo === "POST" || metodo === "DELETE")) {
      if (!installatori.quello(gelo[1])) {
        male(risposta, 404, "questo installatore non c'e'");
        return;
      }
      const congela = metodo === "POST";
      const cambiato = congela ? installatori.congela(gelo[1]) : installatori.scongela(gelo[1]);
      if (cambiato) {
        registro.info(
          congela
            ? `utenza congelata: ${gelo[1]} — la sua pagina non gli fa piu' vedere niente`
            : `utenza scongelata: ${gelo[1]} — torna a vedere le sue case`,
        );
      }
      json(risposta, { congelato: congela, ...ilQuadro() });
      return;
    }

    const chiave = new RegExp(`^/installatore/(${CHI_VALIDO.source.slice(1, -1)})/chiave$`).exec(
      via,
    );
    if (chiave && metodo === "POST") {
      const nuova = installatori.rifai(chiave[1]);
      if (!nuova) {
        male(risposta, 404, "questo installatore non c'e'");
        return;
      }
      /* Una chiave nuova chiude anche gli editor aperti con quella di prima. */
      gettoni.dimentica(chiave[1]);
      registro.info(`chiave rifatta per ${chiave[1]}: quella di prima non apre piu'`);
      json(risposta, { chiave: nuova });
      return;
    }

    male(risposta, 404, "qui non c'e' niente");
  }

  async function ilDetto(richiesta) {
    try {
      return await ilCorpo(richiesta, 4096);
    } catch (_errore) {
      return {};
    }
  }

  function laPagina(risposta, quale = PAGINA, chiamata = "console") {
    /* Lette dal disco al primo che le chiede, e poi tenute in memoria, con la
     * loro politica gia' fatta. */
    let foglio = quale === PAGINA ? pagina : paginaDelGestore;
    if (foglio === undefined) {
      let testo = null;
      try {
        testo = readFileSync(quale, "utf8");
      } catch (_errore) {
        testo = null;
      }
      if (testo !== null && quale === PAGINA) {
        /* Gli ospiti scritti dentro la pagina, dove la pagina li legge: da
         * quelle origini una chiave consegnata si prende senza chiedere. */
        testo = testo.replace(
          /<meta name="gdahome-ospiti" content="[^"]*"/,
          `<meta name="gdahome-ospiti" content="${ospiti.join(" ").replace(/[^a-z0-9:/.* -]/gi, "")}"`,
        );
      }
      foglio =
        testo === null
          ? null
          : {
              corpo: Buffer.from(testo, "utf8"),
              politica: laPolitica(testo, {
                /* La gestione non sta dentro niente. Il cruscotto si': nella
                 * tessera di Home Assistant e nell'app, e l'indirizzo di un
                 * Home Assistant e' diverso in ogni casa. Se chi tiene il
                 * quadro li elenca (`QUADRO_OSPITI`) si stringe a quelli. */
                riquadro:
                  quale === PAGINA
                    ? ospiti.length
                      ? `'self' ${ospiti.join(" ")}`
                      : "*"
                    : "'none'",
              }),
            };
      if (quale === PAGINA) pagina = foglio;
      else paginaDelGestore = foglio;
    }
    if (!foglio) {
      male(risposta, 404, `la pagina della ${chiamata} non c'e'`);
      return;
    }
    risposta.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": foglio.politica,
      ...(quale === PAGINA ? {} : { "x-frame-options": "DENY" }),
    });
    risposta.end(foglio.corpo);
  }
}

/* Usato dalla gestione per contare tutto quello che c'e', di chiunque sia. */
export { TUTTE };
