/* Le caselle della configurazione, prese dalla plancia.
 *
 * La Config della plancia e' fatta di **caselle**: «Potenza fotovoltaico
 * (W)», «Batteria auto (%)», «Interruttore boiler». Sono trecento, stanno
 * tutte in `CD_SLOTS` dentro il runtime della dashboard, e la schermata della
 * configurazione nell'app deve mostrare quelle — le stesse, con le stesse
 * etichette, nello stesso ordine.
 *
 * Ricopiarle a mano in Dart sarebbe stato un errore di quelli che si pagano
 * dopo: trecento righe da tenere allineate a mano a ogni versione della
 * plancia, e nessuno che se ne accorga quando si scollegano. Quindi si
 * leggono da dove stanno, una volta, e finiscono in un file che l'app si
 * porta dentro:
 *
 *     node strumenti/leggi-le-caselle.mjs
 *
 * Si rilancia da solo in fondo a `porta-la-plancia.mjs`, cosi' aggiornare la
 * plancia aggiorna anche le caselle e non ci si deve pensare.
 *
 * Il letterale si prende contando le graffe, e si legge come dato — non si
 * esegue niente della plancia. Se un giorno `CD_SLOTS` smettesse di essere un
 * letterale, questo script si ferma con un errore invece di indovinare.
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = dirname(QUI);
const RUNTIME = join(RADICE, "ponte", "plancia", "legacy", "dashboard-runtime-it.js");
const DESTINAZIONE = join(RADICE, "app", "assets", "plancia", "caselle.json");

/* Il letterale che sta dopo `<nome> = `, contando le graffe.
 *
 * Le graffe dentro le stringhe non contano: un'etichetta puo' contenerne
 * («{n} gradi»), e senza saltare le stringhe si chiuderebbe il conto nel
 * posto sbagliato. */
export function letterale(testo, nome) {
  const attacco = new RegExp(`(?:const|let|var)?\\s*${nome}\\s*=\\s*\\{`).exec(testo);
  if (!attacco) throw new Error(`in questa plancia non c'e' ${nome}`);
  const dalla = attacco.index + attacco[0].length - 1;
  let quante = 0;
  let dentro = null;
  let scappa = false;
  for (let dove = dalla; dove < testo.length; dove += 1) {
    const lettera = testo[dove];
    if (dentro) {
      if (scappa) scappa = false;
      else if (lettera === "\\") scappa = true;
      else if (lettera === dentro) dentro = null;
      continue;
    }
    if (lettera === "'" || lettera === '"' || lettera === "`") {
      dentro = lettera;
      continue;
    }
    if (lettera === "{") quante += 1;
    else if (lettera === "}") {
      quante -= 1;
      if (quante === 0) return testo.slice(dalla, dove + 1);
    }
  }
  throw new Error(`il letterale di ${nome} non si chiude`);
}

/* Da letterale JavaScript a dato.
 *
 * Sono stringhe, elenchi e oggetti: niente da eseguire. Si normalizzano le
 * virgolette semplici e le chiavi senza virgolette, che JSON non accetta, e
 * poi lo legge `JSON.parse` — cosi' se dentro ci finisse qualcosa che non e'
 * un dato, si ferma qui. */
export function leggiIlLetterale(pezzo) {
  const virgolette = pezzo.replace(/'((?:[^'\\]|\\.)*)'/g, (_tutto, dentro) =>
    JSON.stringify(dentro.replace(/\\'/g, "'").replace(/\\\\/g, "\\")),
  );
  const chiavi = virgolette.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":');
  const senzaCode = chiavi.replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(senzaCode);
}

export function caselle(testo) {
  const sezioni = leggiIlLetterale(letterale(testo, "CD_SLOTS"));
  const fuori = {};
  for (const [chiave, sezione] of Object.entries(sezioni)) {
    fuori[chiave] = {
      etichetta: String(sezione.label || chiave),
      caselle: (sezione.slots || []).map((una) => ({
        chiave: String(una.ref),
        etichetta: String(una.lbl || una.ref),
      })),
    };
  }
  return fuori;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const testo = readFileSync(RUNTIME, "utf8");
  const fuori = caselle(testo);
  const quante = Object.values(fuori).reduce((somma, s) => somma + s.caselle.length, 0);
  mkdirSync(dirname(DESTINAZIONE), { recursive: true });
  writeFileSync(DESTINAZIONE, `${JSON.stringify(fuori, null, 2)}\n`);
  const sezioni = Object.keys(fuori).length;
  process.stdout.write(
    `${quante} caselle in ${sezioni} sezioni → app/assets/plancia/caselle.json\n`,
  );
}
