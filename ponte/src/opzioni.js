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

const DIFETTO = Object.freeze({
  centralino: "",
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
    /* Dove chiamare per farsi raggiungere da fuori. Vuoto vuol dire: solo
     * dentro casa, e va benissimo per chi non esce mai dal proprio Wi-Fi. */
    centralino: String(process.env.PONTE_CENTRALINO || scritte.centralino || ""),
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
