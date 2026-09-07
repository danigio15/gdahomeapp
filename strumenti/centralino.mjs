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

const IL_PONTE = {
  dove: new URL("ponte/src/opzioni.js", RADICE),
  riga: /^(export const CENTRALINO_DI_DIFETTO = ")([^"]*)(";)$/m,
};

const L_APP = {
  dove: new URL("app/lib/ponte/centralino.dart", RADICE),
  riga: /^(const String centralinoDiDifettoScritto = ")([^"]*)(";)$/m,
};

function leggi(quale) {
  const testo = readFileSync(quale.dove, "utf8");
  const trovata = quale.riga.exec(testo);
  if (!trovata) {
    throw new Error(
      `non trovo la riga del centralino in ${fileURLToPath(quale.dove)}: ` +
        "qualcuno l'ha riscritta, e va rimessa su una riga sola",
    );
  }
  return { testo, trovata };
}

export function comEScritto() {
  return {
    ponte: leggi(IL_PONTE).trovata[2],
    app: leggi(L_APP).trovata[2],
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
  const { ponte, app } = comEScritto();
  const vuoto = (uno) => (uno === "" ? "(nessuno)" : uno);
  console.log(`il ponte: ${vuoto(ponte)}`);
  console.log(`l'app:    ${vuoto(app)}`);
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
  console.log(`prima: ${prima === "" ? "(nessuno)" : prima}`);
  console.log(`adesso: ${indirizzo === "" ? "(nessuno)" : indirizzo}`);
  console.log("\nCambiati tutti e due:");
  console.log("  ponte/src/opzioni.js");
  console.log("  app/lib/ponte/centralino.dart");
}
