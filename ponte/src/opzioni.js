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
  registro: "info",
});

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

export function leggiLeOpzioni(cartella = process.env.PONTE_ARCHIVIO || "/data") {
  let scritte = {};
  try {
    scritte = JSON.parse(readFileSync(join(cartella, "options.json"), "utf8")) || {};
  } catch (_errore) {
    /* Fuori dal Supervisor — in prova, o su un computer — il file non c'e'
     * proprio, e i difetti bastano. */
  }
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
    dispositiviMassimi: numero(scritte.dispositivi_massimi, DIFETTO.dispositivi_massimi),
    minutiDelCodice: numero(scritte.minuti_del_codice, DIFETTO.minuti_del_codice),
    giorniDiSilenzio: numero(scritte.giorni_di_silenzio, DIFETTO.giorni_di_silenzio),
    registro: String(scritte.registro || DIFETTO.registro),
    /* Il gettone con cui il ponte si scarica le versioni nuove di se stesso.
     *
     * Vuoto e' la cosa normale per chi ha installato l'add-on da un archivio:
     * li' gli aggiornamenti arrivano dal negozio, e questo non serve. Serve a
     * chi lo tiene in `/addons/gdahome` con la repository privata — cioe' a noi
     * — e si scrive una volta sola nella scheda dell'add-on.
     *
     * Non finisce in nessun registro e non esce da nessuna risposta: alla
     * console si dice soltanto se c'e' o no. */
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
    versione: versioneDelPonte(),
  };
}
