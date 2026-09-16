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
 * — 1.4.25 diventa 104250 — cosi' non c'e' un secondo numero da ricordarsi, e
 * cresce sempre, che e' l'unica cosa che i negozi dei telefoni chiedono.
 *
 * L'add-on puo' portarsi un **quarto numero** per le sue correzioni fra due
 * versioni della plancia (`1.4.25.1`): un numero fatto cosi' i negozi dei
 * telefoni non lo prendono, e il **nome** dell'app infatti non cambia — resta
 * 1.4.25, che e' la plancia che ha dentro. Cambia il numero di costruzione:
 * 1.4.25.1 diventa 104251, che e' il posto dove quel quarto numero ci sta.
 *
 * E' per questo che il numero di costruzione ha uno zero in fondo: senza,
 * fra 10425 e 10426 non c'era spazio per le correzioni, e una correzione
 * dell'add-on che va anche nell'app — succede: quella di oggi e' un comando
 * nuovo nel ponte e la domanda che glielo fa nell'app — non si poteva
 * portare nel negozio senza inventare una versione della plancia che non
 * esiste.
 *
 *     node strumenti/versione.mjs 1.4.25     app 1.4.25+104250, add-on 1.4.25
 *     node strumenti/versione.mjs 1.4.25.1   app 1.4.25+104251, add-on 1.4.25.1
 *     node strumenti/versione.mjs --dimmi    dice cosa c'e' scritto adesso
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));
const MANIFESTO = join(RADICE, "ponte", "config.yaml");
const PUBSPEC = join(RADICE, "app", "pubspec.yaml");
/* E il terzo posto: il numero che l'app **fa vedere**.
 *
 * Il `pubspec` lo legge chi costruisce, non l'app che gira: per rileggerlo da
 * dentro servirebbe un pacchetto in piu' che chiede al sistema che pacchetto
 * e'. Invece di aggiungerlo, il numero si scrive anche in un file Dart, qui, e
 * lo scrive lo stesso programma che scrive gli altri due — cosi' non c'e' un
 * terzo numero da ricordarsi, e una prova tiene ferma la regola che siano lo
 * stesso (`ponte/test/marchio.test.js`). */
const VERSIONE_DART = join(RADICE, "app", "lib", "versione.dart");

export function laVersioneDellAddon(manifesto) {
  return /^version: "([^"]+)"$/m.exec(manifesto)?.[1] || "";
}

export function laVersioneDellApp(pubspec) {
  return /^version: (\S+)$/m.exec(pubspec)?.[1] || "";
}

/* Il numero di costruzione: 1.4.25 → 104250, e 1.4.25.1 → 104251.
 *
 * L'ultima cifra e' la correzione dell'add-on, e senza correzione e' zero:
 * cosi' ogni versione della plancia ne ha dieci a disposizione, e il numero
 * cresce sempre — che e' l'unica cosa che i negozi chiedono. */
export function laCostruzione(versione) {
  const [grande, medio, piccolo, correzione = 0] = versione.split(".").map(Number);
  return (grande * 10000 + medio * 100 + piccolo) * 10 + correzione;
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

  /* Il **nome** dell'app segue solo i primi tre numeri — il quarto e' una
   * correzione dell'add-on, e un numero fatto cosi' i negozi non lo prendono —
   * ma il numero di costruzione se lo porta dentro: una correzione che tocca
   * anche l'app deve poter entrare nel negozio senza inventare una versione
   * della plancia che non esiste. */
  const tre = pezzi.slice(0, 3).join(".");
  const pubspec = readFileSync(PUBSPEC, "utf8");
  const suo = `${tre}+${laCostruzione(quale)}`;
  const era = laVersioneDellApp(pubspec);
  /* Il numero dentro l'app si riscrive comunque: il `pubspec` puo' essere
   * gia' quello giusto e quel file no — e' nato dopo. */
  scriviIlDart(tre, laCostruzione(quale));
  if (era === suo) {
    process.stdout.write(`l'app: ${era}, gia' quella giusta\n`);
    return;
  }
  writeFileSync(PUBSPEC, pubspec.replace(/^version: \S+$/m, `version: ${suo}`), "utf8");
  process.stdout.write(`l'app: ${era || "?"} → ${suo}\n`);
}

/* Il numero dentro l'app, per farlo vedere. */
function scriviIlDart(nome, costruzione) {
  writeFileSync(
    VERSIONE_DART,
    `/// Il numero di questa app, quello che si legge nel negozio.
///
/// **Lo scrive \`strumenti/versione.mjs\`**, insieme al manifesto dell'add-on e
/// al \`pubspec\`: a mano non si tocca, e una prova tiene ferma la regola che
/// siano lo stesso numero (\`ponte/test/marchio.test.js\`).
///
/// Il \`pubspec\` lo legge chi costruisce, non l'app che gira. Per rileggerlo
/// da dentro servirebbe un pacchetto in piu' — uno che chieda al sistema che
/// pacchetto e' — e per un numero non vale la pena: qui c'e', e si vede in
/// «Come va l'app» e nella riga in fondo alle schermate.
library;

/// Come si chiama: e' la versione della plancia che l'app ha dentro.
const String versioneDiQuestApp = "${nome}";

/// Il numero di costruzione, quello che vogliono i negozi.
const int costruzioneDiQuestApp = ${costruzione};

/// Come si scrive per chi legge: \`1.4.30 (104301)\`.
const String numeroDiQuestApp = "${nome} (${costruzione})";
`,
    "utf8",
  );
  process.stdout.write(`e nell'app si legge: ${nome} (${costruzione})\n`);
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
