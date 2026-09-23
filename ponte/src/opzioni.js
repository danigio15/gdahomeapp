/* Le opzioni, come le scrive l'utente nella scheda dell'add-on.
 *
 * Il Supervisor le lascia in `/data/options.json` gia' validate contro lo
 * `schema` del manifesto, quindi qui non si rivalida niente: si legge, e per
 * ogni voce che manca — perche' il file e' vecchio di una versione fa — si
 * mette il difetto.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { CENTRALINO_DELLA_CHAT } from "./chat.js";
import { CodiceIllegibile, leggiIlCodice, OGNI_DI_SERIE, ogniQuanto } from "./rapporto.js";

/* Il centralino dell'app, quello che accende chi la distribuisce.
 *
 * Sta qui perche' **l'utente non lo deve battere**. Chi installa l'add-on non
 * sa cosa sia un centralino e non deve saperlo: installa, e da fuori casa
 * funziona. Chiedergli di incollare un indirizzo in una scheda di
 * configurazione sarebbe la stessa cosa che gli abbiamo promesso di non
 * chiedere.
 *
 * Chi invece il proprio centralino ce l'ha — o non ne vuole nessuno — scrive
 * la sua voce nelle opzioni, e questa non conta piu'.
 *
 * **Deve essere identico a quello scritto in `app/lib/ponte/centralino.dart`.**
 * Se divergessero, i telefoni andrebbero a cercare le case in un posto e le
 * case starebbero ad aspettare in un altro, e non lo direbbe nessuno: da fuori
 * casa l'app direbbe soltanto «non trovo la casa». Li tiene insieme
 * `ponte/test/centralino-di-difetto.test.js`, e si cambiano tutti e due con
 * `node strumenti/centralino.mjs <indirizzo>`. */
export const CENTRALINO_DI_DIFETTO = "wss://tramite.gdahome.org";

const DIFETTO = Object.freeze({
  centralino: CENTRALINO_DI_DIFETTO,
  da_fuori_casa: true,
  porta_app: 8098,
  dispositivi_massimi: 10,
  minuti_del_codice: 5,
  giorni_di_silenzio: 90,
  quadro_ogni: OGNI_DI_SERIE,
  registro: "info",
});

/* Dove sta ogni casella adesso, e come si chiamava prima.
 *
 * Dalla 1.5.8 le opzioni sono a **sezioni**: Home Assistant non ha titoli, e
 * tredici caselle in fila le leggevano tre persone diverse di cui due non
 * c'entravano niente. Annidarle e' l'unico modo che la scheda dell'add-on
 * abbia di disegnare un titolo.
 *
 * La chiave della sezione e' scelta apposta **diversa** da ogni chiave di
 * prima: `installatore` e `gestore` erano interruttori, e una casa che se li
 * ritrovasse come sezione avrebbe un booleano dove adesso ci va un gruppo.
 *
 * ─── E quella di prima si legge lo stesso ────────────────────────────────
 *
 * Il Supervisor, aggiornando, potrebbe tenersi le caselle vecchie o buttarle:
 * non si sa da qui, e non e' una cosa da indovinare. Se se le tiene, questa
 * riga fa si' che **non si rompa niente** — la casa continua a mandare il suo
 * rapporto con il codice che ha gia'. Se le butta, quel codice va rimesso una
 * volta, e la scheda dice dove.
 *
 * Costa una mappa e non costa nessun ramo: si legge il nuovo, e dove il nuovo
 * non c'e' si ripiega sul vecchio. */
const DOVE_STAVANO = Object.freeze({
  da_fuori_casa: ["casa", "da_fuori_casa"],
  quadro: ["casa", "quadro"],
  quadro_ogni: ["casa", "quadro_ogni"],
  quadro_manutenzione: ["casa", "quadro_manutenzione"],
  quadro_configurazione: ["casa", "quadro_configurazione"],
  quadro_marchio: ["casa", "quadro_marchio"],
  minuti_del_codice: ["casa", "minuti_del_codice"],
  giorni_di_silenzio: ["casa", "giorni_di_silenzio"],
  dispositivi_massimi: ["casa", "dispositivi_massimi"],
  installatore: ["chi_installa", "acceso"],
  chiave_cruscotto: ["chi_installa", "chiave"],
  chiave_gestione: ["gestione", "chiave"],
  chiave_console: ["assistenza", "chiave"],
  porta_app: ["avanzate", "porta_app"],
  registro: ["avanzate", "registro"],
});

/* Le opzioni in **una riga sola di chiavi**, come le leggeva questo file
 * prima delle sezioni.
 *
 * Sta qui e non sparso: dodici posti che sanno dove sta ogni casella sono
 * dodici posti da cambiare il giorno che una si sposta, e undici che uno si
 * dimentica. Da qui in giu' il resto del file non sa nemmeno che le sezioni
 * esistano. */
export function appiattisci(grezze) {
  const dentro = grezze && typeof grezze === "object" ? grezze : {};
  const piatte = { ...dentro };
  for (const [nome, [sezione, campo]] of Object.entries(DOVE_STAVANO)) {
    const gruppo = dentro[sezione];
    if (!gruppo || typeof gruppo !== "object") continue;
    /* `undefined` vuol dire «questa sezione quella casella non ce l'ha», e
     * allora vale quella di prima. `""` e `false` no: sono risposte, e vincono
     * su quello che c'era scritto nella scheda vecchia. */
    if (gruppo[campo] !== undefined) piatte[nome] = gruppo[campo];
  }
  return piatte;
}

const numero = (valore, difetto) => {
  const letto = Number(valore);
  return Number.isFinite(letto) ? letto : difetto;
};

/* La versione del ponte, letta dal manifesto dell'add-on: e' l'unico posto
 * dove sta scritta, e chi legge una segnalazione vuole sapere quale ponte
 * l'ha mandata. */
export function versioneDelPonte() {
  try {
    const manifesto = readFileSync(
      fileURLToPath(new URL("../config.yaml", import.meta.url)),
      "utf8",
    );
    return /^version:\s*"?([^"\n]+)"?/m.exec(manifesto)?.[1]?.trim() || "";
  } catch (_errore) {
    return "";
  }
}

/* Il registro vero non c'e' ancora quando si leggono le opzioni — lo si apre
 * con il livello che sta scritto li' dentro — e un codice storto si deve dire
 * lo stesso. Due righe su `stderr`, e basta. */
const registroDiEmergenza = (riga) => process.stderr.write(`  ! ${riga}\n`);

/* Il codice del quadro, letto senza far cadere niente. */
export function leggiIlQuadro(scritto, dillo = () => {}) {
  try {
    return leggiIlCodice(scritto);
  } catch (errore) {
    dillo(
      errore instanceof CodiceIllegibile
        ? `il codice del quadro non si legge (${errore.message}): questa casa non manda nessun rapporto`
        : `${errore.message}: questa casa non manda nessun rapporto finche' non si aggiorna gdahome`,
    );
    return null;
  }
}

export function leggiLeOpzioni(cartella = process.env.PONTE_ARCHIVIO || "/data") {
  let grezze = {};
  try {
    grezze = JSON.parse(readFileSync(join(cartella, "options.json"), "utf8")) || {};
  } catch (_errore) {
    /* Fuori dal Supervisor — in prova, o su un computer — il file non c'e'
     * proprio, e i difetti bastano. */
  }
  /* A sezioni dalla 1.5.8, piatte prima: qui diventano una cosa sola. */
  const scritte = appiattisci(grezze);
  /* Le due chiavi, lette una volta sola perche' servono due volte ciascuna:
   * per dire **se** la cosa e' accesa, e per darla a chi la usa.
   *
   * `trim()` non e' pignoleria: queste si incollano da un messaggio o da una
   * mail, e uno spazio in fondo e' il modo piu' comune di ritrovarsi una
   * chiave «scritta» che non apre niente. Meglio toglierlo qui che spiegarlo
   * al telefono. */
  const chiaveDelCruscotto = String(
    process.env.PONTE_CHIAVE_CRUSCOTTO ?? scritte.chiave_cruscotto ?? "",
  ).trim();
  const chiaveDellaGestione = String(
    process.env.PONTE_CHIAVE_GESTIONE ?? scritte.chiave_gestione ?? "",
  ).trim();
  return {
    cartella,
    /* Dove chiamare per farsi raggiungere da fuori.
     *
     * **Nella scheda dell'add-on non c'e' nessuna casella**, e non e' una
     * dimenticanza: c'era, e stava sempre vuota. L'indirizzo giusto e' quello
     * qui sotto, lo stesso scritto dentro l'app — e una casella che non va
     * toccata e' una casella che prima o poi qualcuno tocca, scrivendoci
     * qualcosa di storto o congelando per quella casa un indirizzo che il
     * giorno che cambia non cambia piu'.
     *
     * `scritte.centralino` si legge ancora, e non e' codice morto: e' quello
     * che ha in casa chi aggiorna da una versione in cui la casella c'era. Se
     * ci aveva scritto qualcosa, continua a valere finche' non la cancella —
     * togliere una casella non e' un buon momento per cambiare di nascosto
     * dove chiama la casa di qualcuno.
     *
     * `PONTE_CENTRALINO` e' per il banco: il collaudo accende un centralino
     * finto e ce lo dice da li'.
     *
     * Chi non vuole passare da nessun centralino spegne `da_fuori_casa`. E'
     * un interruttore e non una casella da svuotare apposta, perche' «voglio
     * solo la rete di casa» e' una scelta, e una scelta si dice premendo una
     * cosa che si chiama come quello che fa. */
    centralino:
      scritte.da_fuori_casa === false
        ? ""
        : String(process.env.PONTE_CENTRALINO || scritte.centralino || CENTRALINO_DI_DIFETTO),
    portaDellApp: numero(scritte.porta_app, DIFETTO.porta_app),
    portaDellaConsole: numero(process.env.PONTE_PORTA_CONSOLE, 8099),
    /* Da dove puo' arrivare chi bussa alla console: nell'add-on solo il proxy
     * dell'ingress del Supervisor (`server.js`), e non si cambia dalla
     * scheda. `PONTE_PROXY_INGRESS` e' per il banco — il collaudo accende il
     * ponte fuori dal Supervisor e bussa da `127.0.0.1` — ed e' una variabile
     * d'ambiente, che dentro l'add-on non scrive nessuno. Piu' indirizzi si
     * separano con la virgola. Non detto, vale quello del Supervisor. */
    ...(process.env.PONTE_PROXY_INGRESS
      ? {
          proxyDellIngress: String(process.env.PONTE_PROXY_INGRESS)
            .split(",")
            .map((uno) => uno.trim())
            .filter(Boolean),
        }
      : {}),
    dispositiviMassimi: numero(scritte.dispositivi_massimi, DIFETTO.dispositivi_massimi),
    minutiDelCodice: numero(scritte.minuti_del_codice, DIFETTO.minuti_del_codice),
    giorniDiSilenzio: numero(scritte.giorni_di_silenzio, DIFETTO.giorni_di_silenzio),
    registro: String(scritte.registro || DIFETTO.registro),
    /* Il gettone con cui il ponte si scarica le versioni nuove di se stesso.
     *
     * **Nella scheda dell'add-on non c'e' piu' nessuna casella.** La
     * repository di gdahome e' pubblica: chi installa dal negozio riceve gli
     * aggiornamenti dal negozio, e chi tiene l'add-on in `/addons/gdahome` li
     * prende col bottone nella console, che legge un manifesto pubblico senza
     * presentarsi. Una casella che tutti devono lasciare vuota e' una casella
     * che prima o poi qualcuno riempie.
     *
     * La riga resta per chi si tiene una copia **privata** di questo add-on:
     * li' il manifesto senza gettone non si legge, e glielo si passa
     * dall'ambiente. Non finisce in nessun registro e non esce da nessuna
     * risposta. */
    gettone: String(process.env.PONTE_GETTONE || scritte.gettone || ""),
    /* La cartella della console si cerca di fianco al codice, non dentro la
     * cartella da cui si e' stati lanciati: `npm test` e l'add-on partono da
     * due posti diversi, e la pagina deve trovarsi in tutti e due. */
    console: process.env.PONTE_CONSOLE || fileURLToPath(new URL("../console", import.meta.url)),
    /* E di fianco alla console c'e' gdahome, quella che si apre in un browser.
     * Stessa regola: si cerca vicino al codice.
     *
     * Puo' non esserci — chi lancia il ponte da una copia della repository non
     * ha nessuna app costruita sotto mano, e non deve per questo vedere errori
     * — e allora quel pezzo semplicemente non si serve. */
    app: process.env.PONTE_APP || fileURLToPath(new URL("../app", import.meta.url)),
    /* La cartella `www` di Home Assistant, dove chi ha una casa da qualche
     * anno tiene le foto delle auto, i loghi, gli sfondi.
     *
     * Il Supervisor la monta su `/homeassistant` quando il manifesto chiede
     * `homeassistant_config:ro`. Se non c'e' — l'add-on aggiornato ma non
     * riavviato, o una prova — non e' un guaio: quella meta' della maschera
     * delle foto semplicemente non compare. */
    wwwDiCasa: process.env.PONTE_WWW_CASA || "/homeassistant/www",
    /* Il centralino della **chat** di assistenza, che non e' quello di
     * gdahome: e' quello della dashboard, scritto in `chat.js` com'e' scritto
     * in `const.py` dell'integrazione. Non c'e' niente da configurare — chi
     * installa l'add-on non deve sapere che esiste — e si cambia solo da qui,
     * che serve al collaudo per farlo bussare a un centralino finto. */
    chat: String(process.env.PONTE_CHAT || CENTRALINO_DELLA_CHAT),
    /* La chiave con cui si risponde alle chat di tutte le case.
     *
     * Vuota e' la cosa normale, ed e' il caso di chiunque installi l'add-on:
     * da quella parte non c'e' niente da vedere e non si vede niente. La
     * scrive **una casa sola al mondo** — quella di chi l'app la mantiene — e
     * da quel momento nella finestra dell'assistenza compare la coda di tutte
     * le altre.
     *
     * E' la stessa che sta fra i segreti del centralino: non si inventa qui,
     * si copia da li'. */
    chiaveDellaConsole: String(process.env.PONTE_CHIAVE_CONSOLE || scritte.chiave_console || ""),
    /* Questo Home Assistant e' di chi installa.
     *
     * Due condizioni, e servono tutt'e due: l'interruttore acceso **e** il
     * codice del cruscotto scritto nella scheda. L'interruttore da solo non
     * apre niente.
     *
     * Prima bastava l'interruttore, e la chiave la chiedeva la pagina. Il
     * difetto era che chi lo accendeva per sbaglio — o in casa di un cliente —
     * si trovava comunque una voce nella barra laterale e una sezione nella
     * console: porte che non si aprono, ma che si vedono, e una porta che si
     * vede e' una domanda a cui qualcuno deve rispondere. Adesso senza codice
     * non compare niente: non chiuso, assente.
     *
     * Il costo, detto: la chiave finisce nelle opzioni dell'add-on, che stanno
     * su disco in chiaro e nei backup. Va scritta sull'Home Assistant di chi
     * installa — il suo — e non su quello di un cliente, ed e' la stessa
     * ragione di prima detta piu' forte. */
    installatore:
      (String(process.env.PONTE_INSTALLATORE ?? scritte.installatore ?? "") === "true" ||
        scritte.installatore === true) &&
      Boolean(chiaveDelCruscotto),
    chiaveDelCruscotto,
    /* Questo Home Assistant e' di chi **tiene** il quadro.
     *
     * Qui l'interruttore non c'e' proprio, e non e' una svista: e' una casa
     * sola al mondo, e un interruttore su tutte le altre e' un invito a
     * premerlo. La chiave e' l'interruttore — scritta, la voce c'e'; vuota,
     * non esiste niente da accendere.
     *
     * Home Assistant non sa nascondere una casella a chi non la riguarda, e
     * quindi la casella si vede dappertutto; ma `password?` la mostra a
     * pallini e vuota non fa niente, e su ogni Home Assistant che non sia
     * questo resta vuota. */
    gestore: Boolean(chiaveDellaGestione),
    chiaveDellaGestione,
    /* Il quadro di chi ha installato l'impianto: dove mandare il rapporto, e
     * con che presentarsi.
     *
     * Vuoto e' la cosa normale, ed e' il caso di chiunque la casa se la sia
     * messa da se': senza codice non parte niente e non si apre nessuna
     * connessione. Chi ce l'ha se l'e' fatto dare da chi gli ha fatto
     * l'impianto, e puo' toglierlo quando vuole.
     *
     * Un codice storto **non ferma il ponte**: si dice nel registro e si va
     * avanti senza. Una casa che non si accende perche' qualcuno ha incollato
     * male una riga in una casella facoltativa e' un guasto peggiore di quello
     * che voleva evitare. */
    quadro: leggiIlQuadro(process.env.PONTE_QUADRO || scritte.quadro, registroDiEmergenza),
    quadroOgni: ogniQuanto(scritte.quadro_ogni, DIFETTO.quadro_ogni),
    /* Il secondo interruttore: lasciarsi aggiornare da lontano.
     *
     * Mandare i numeri e farsi mettere le mani dentro sono due permessi, e
     * questo e' spento di serie. Il primo si da' incollando un codice, e in
     * quel gesto non ci sta dentro anche il secondo: chi lo accende lo accende
     * apposta, e sa cosa sta accendendo perche' la casella lo dice.
     *
     * Senza codice del quadro non vuol dire niente e non fa niente: e' come la
     * chiave di una porta che non c'e'. Si tiene lo stesso il valore com'e' —
     * non si spegne da solo — cosi' chi rimette il codice ritrova quello che
     * aveva scelto invece di doverci ripensare. */
    manutenzione:
      String(process.env.PONTE_MANUTENZIONE ?? scritte.quadro_manutenzione ?? "") === "true" ||
      scritte.quadro_manutenzione === true,
    /* Il terzo interruttore: lasciarsi configurare la plancia da lontano.
     *
     * E' un permesso a parte, e non sta dentro la manutenzione: lasciar
     * installare un aggiornamento e lasciar rimettere mano alla propria plancia
     * — le stanze, le entita', la disposizione — sono due cose diverse, e chi
     * accende questa sa che l'installatore vedra' come e' fatta la sua plancia.
     * Le immagini delle telecamere no, e non per scelta di chi accende: da
     * questa strada non passano (`plancia-da-lontano.js`). */
    configurazionePlancia:
      String(process.env.PONTE_CONFIGURAZIONE ?? scritte.quadro_configurazione ?? "") === "true" ||
      scritte.quadro_configurazione === true,
    /* Se la plancia porta il marchio di chi ha montato l'impianto.
     *
     * **Acceso di serie**, ed e' il contrario della manutenzione: quello e' un
     * permesso — qualcuno da fuori fa succedere qualcosa qui dentro — e questo
     * e' solo cosa c'e' scritto in cima a una pagina. Chi ha un installatore
     * il suo nome ce l'ha voluto; chi non ce l'ha non se ne accorge, perche'
     * senza installatore questa riga non cambia niente.
     *
     * Spento vuol dire spento anche se il quadro manda un marchio: la casa ha
     * l'ultima parola su cosa si vede in casa sua. */
    marchioDellInstallatore: scritte.quadro_marchio !== false,
    versione: versioneDelPonte(),
  };
}
