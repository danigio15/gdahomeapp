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
export const CENTRALINO_DI_DIFETTO = "wss://gdahome-centralino.danigio15.workers.dev";

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
     * Chi non scrive niente prende quello dell'app: e' il caso di chiunque
     * installi l'add-on e basta, che e' come deve essere.
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
    /* La cartella della console si cerca di fianco al codice, non dentro la
     * cartella da cui si e' stati lanciati: `npm test` e l'add-on partono da
     * due posti diversi, e la pagina deve trovarsi in tutti e due. */
    console: process.env.PONTE_CONSOLE || fileURLToPath(new URL("../console", import.meta.url)),
  };
}
