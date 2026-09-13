/* Il numero di versione, scritto nei due posti che lo devono dire uguale.
 *
 * L'add-on e l'app portano lo stesso numero, ed e' quello della plancia che
 * sta dentro: chi apre l'app e chi apre la console si aspetta di leggere due
 * volte quello che ha installato. I posti sono due e sono fatti diversi —
 * `ponte/config.yaml` vuole `version: "1.4.25"`, `app/pubspec.yaml` vuole
 * `version: 1.4.25+10425` — e finche' li scriveva una `sed` dentro un
 * workflow, la regola stava in una riga di shell che nessuno provava.
 *
 * Qui invece sta in un programma, e una prova la tiene ferma
 * (`ponte/test/marchio.test.js`): il numero di costruzione si deriva dal nome
 * — 1.4.25 diventa 10425 — cosi' non c'e' un secondo numero da ricordarsi, e
 * cresce sempre, che e' l'unica cosa che i negozi dei telefoni chiedono.
 *
 * L'add-on puo' portarsi un **quarto numero** per le sue correzioni fra due
 * versioni della plancia (`1.4.25.1`): li' l'app non si tocca, perche' un
 * numero fatto cosi' i negozi non lo prendono.
 *
 *     node strumenti/versione.mjs 1.4.25     scrive tutti e due
 *     node strumenti/versione.mjs 1.4.25.1   solo l'add-on, l'app resta 1.4.25
 *     node strumenti/versione.mjs --dimmi    dice cosa c'e' scritto adesso
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));
const MANIFESTO = join(RADICE, "ponte", "config.yaml");
const PUBSPEC = join(RADICE, "app", "pubspec.yaml");

export function laVersioneDellAddon(manifesto) {
  return /^version: "([^"]+)"$/m.exec(manifesto)?.[1] || "";
}

export function laVersioneDellApp(pubspec) {
  return /^version: (\S+)$/m.exec(pubspec)?.[1] || "";
}

/* Il numero di costruzione: 1.4.25 → 10425. */
export function laCostruzione(versione) {
  const [grande, medio, piccolo] = versione.split(".").map(Number);
  return grande * 10000 + medio * 100 + piccolo;
}

function scrivi(quale) {
  const pezzi = quale.split(".");
  if (pezzi.length < 3 || pezzi.length > 4 || pezzi.some((uno) => !/^\d+$/.test(uno))) {
    process.stderr.write(
      `«${quale}» non e' una versione: ci vogliono tre numeri, o quattro con la\n` +
        "correzione dell'add-on. Per esempio 1.4.25 oppure 1.4.25.1\n",
    );
    process.exit(64);
  }

  const manifesto = readFileSync(MANIFESTO, "utf8");
  const prima = laVersioneDellAddon(manifesto);
  writeFileSync(MANIFESTO, manifesto.replace(/^version: "[^"]+"$/m, `version: "${quale}"`), "utf8");
  process.stdout.write(`l'add-on: ${prima || "?"} → ${quale}\n`);

  /* L'app segue solo i primi tre numeri: il quarto e' una correzione
   * dell'add-on, e l'app in quel giro non cambia. */
  const tre = pezzi.slice(0, 3).join(".");
  const pubspec = readFileSync(PUBSPEC, "utf8");
  const suo = `${tre}+${laCostruzione(tre)}`;
  const era = laVersioneDellApp(pubspec);
  if (era === suo) {
    process.stdout.write(`l'app: ${era}, gia' quella giusta\n`);
    return;
  }
  writeFileSync(PUBSPEC, pubspec.replace(/^version: \S+$/m, `version: ${suo}`), "utf8");
  process.stdout.write(`l'app: ${era || "?"} → ${suo}\n`);
}

function dimmi() {
  const addon = laVersioneDellAddon(readFileSync(MANIFESTO, "utf8"));
  const app = laVersioneDellApp(readFileSync(PUBSPEC, "utf8"));
  process.stdout.write(`add-on: ${addon}\napp:    ${app}\n`);
}

const detto = process.argv[2];
if (!detto) {
  process.stderr.write(
    "Uso: node strumenti/versione.mjs <versione>\n" + "     node strumenti/versione.mjs --dimmi\n",
  );
  process.exit(64);
} else if (detto === "--dimmi") {
  dimmi();
} else {
  scrivi(detto);
}
