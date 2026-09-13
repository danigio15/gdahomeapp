/* Cambia l'indirizzo del centralino, in tutti e due i posti dove sta scritto.
 *
 *     node strumenti/centralino.mjs wss://centralino.pippo.workers.dev
 *     node strumenti/centralino.mjs --nessuno
 *     node strumenti/centralino.mjs --dimmi
 *
 * Esiste per un motivo solo: quell'indirizzo sta scritto in due file — uno che
 * finisce dentro l'add-on e uno che finisce dentro l'app — e se i due
 * divergessero non lo direbbe nessuno. I telefoni andrebbero a cercare le case
 * in un posto, le case starebbero ad aspettare in un altro, e da fuori casa
 * l'app direbbe soltanto «non trovo la casa». Un difetto cosi' si cerca per
 * giorni.
 *
 * Che restino uguali lo controlla anche una prova, cosi' non dipende dal fatto
 * che qualcuno si ricordi di usare questo.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RADICE = new URL("../", import.meta.url);

/* Lo spazio fra `=` e le virgolette e' `\s*` e non uno spazio: i formattatori
 * spezzano su due righe quello che non ci sta, e una riga che si sposta non e'
 * una riga che cambia. Ci sono gia' cascato una volta. */
const IL_PONTE = {
  dove: new URL("ponte/src/opzioni.js", RADICE),
  riga: /(export const CENTRALINO_DI_DIFETTO =\s*")([^"]*)(";)/,
};

const L_APP = {
  dove: new URL("app/lib/ponte/centralino.dart", RADICE),
  riga: /(const String centralinoDiDifettoScritto =\s*")([^"]*)(";)/,
};

/* E la chat, che e' il terzo posto.
 *
 * La chat dell'assistenza ha un indirizzo suo perche' storicamente era un
 * servizio a parte — il centralino della dashboard — e per un po' lo restera'
 * per le case che non hanno ancora aggiornato. Ma il giorno in cui le case si
 * spostano, si sposta anche lei: se restasse indietro, chi aggiorna l'add-on
 * scriverebbe in una casella che nessuno guarda piu'.
 *
 * Va scritto `https://`, non `wss://`: la chat non apre nessun filo, fa
 * domande e risposte. */
const LA_CHAT = {
  dove: new URL("ponte/src/chat.js", RADICE),
  riga: /(export const CENTRALINO_DELLA_CHAT =\s*")([^"]*)(";)/,
};

const comeHttp = (uno) =>
  String(uno)
    .replace(/^wss:\/\//i, "https://")
    .replace(/^ws:\/\//i, "http://");

function leggi(quale) {
  const testo = readFileSync(quale.dove, "utf8");
  const trovata = quale.riga.exec(testo);
  if (!trovata) {
    throw new Error(
      `non trovo la riga del centralino in ${fileURLToPath(quale.dove)}: ` +
        "qualcuno l'ha riscritta, e va rimessa com'era",
    );
  }
  return { testo, trovata };
}

export function comEScritto() {
  return {
    ponte: leggi(IL_PONTE).trovata[2],
    app: leggi(L_APP).trovata[2],
    chat: leggi(LA_CHAT).trovata[2],
  };
}

function scrivi(quale, indirizzo) {
  const { testo, trovata } = leggi(quale);
  const nuovo = testo.replace(quale.riga, `$1${indirizzo}$3`);
  writeFileSync(quale.dove, nuovo);
  return trovata[2];
}

/* Un indirizzo, non una speranza: `wss://` e un nome, e niente altro dietro.
 * Chi incolla quello che stampa Cloudflare incolla `https://`, ed e' giusto
 * accettarlo e correggerlo invece di dire di no. */
function pulisci(scritto) {
  let testo = String(scritto).trim().replace(/\/+$/, "");
  testo = testo.replace(/^https:\/\//i, "wss://").replace(/^http:\/\//i, "ws://");
  if (!/^wss?:\/\/[A-Za-z0-9._-]+(:\d+)?$/.test(testo)) {
    throw new Error(
      `«${scritto}» non e' un indirizzo di centralino.\n` +
        "Deve essere fatto cosi': wss://centralino.qualcosa.workers.dev",
    );
  }
  return testo;
}

const detto = process.argv[2];

if (!detto || detto === "--dimmi") {
  const { ponte, app, chat } = comEScritto();
  const vuoto = (uno) => (uno === "" ? "(nessuno)" : uno);
  console.log(`il ponte: ${vuoto(ponte)}`);
  console.log(`l'app:    ${vuoto(app)}`);
  console.log(`la chat:  ${vuoto(chat)}`);
  if (chat && comeHttp(ponte) && chat !== comeHttp(ponte)) {
    console.log("\n(la chat sta ancora su un altro servizio: e' voluto, finche' non si sposta)");
  }
  if (ponte !== app) {
    console.error("\nNON COINCIDONO. Rimettili a posto con:");
    console.error("  node strumenti/centralino.mjs <indirizzo>");
    process.exit(1);
  }
  if (!detto) {
    console.log("\nPer cambiarlo:");
    console.log("  node strumenti/centralino.mjs wss://centralino.pippo.workers.dev");
  }
} else {
  const indirizzo = detto === "--nessuno" ? "" : pulisci(detto);
  const prima = scrivi(IL_PONTE, indirizzo);
  scrivi(L_APP, indirizzo);
  const primaLaChat = scrivi(LA_CHAT, comeHttp(indirizzo));
  console.log(`prima: ${prima === "" ? "(nessuno)" : prima}`);
  console.log(`adesso: ${indirizzo === "" ? "(nessuno)" : indirizzo}`);
  console.log(`la chat, prima: ${primaLaChat === "" ? "(nessuna)" : primaLaChat}`);
  console.log("\nCambiati tutti e tre:");
  console.log("  ponte/src/opzioni.js");
  console.log("  app/lib/ponte/centralino.dart");
  console.log("  ponte/src/chat.js");
}
