/* I numeri di versione: quello dell'app e quello dell'add-on.
 *
 * **Sono due, e vanno ognuno per conto suo** (dalla 1.19.19): «se si aggiorna
 * solo l'app non rilasciare alcun aggiornamento per l'add-on, e al
 * contrario». Fino ad allora app e add-on portavano sempre lo stesso numero, e
 * ogni rilascio dell'app faceva comparire in Home Assistant un «Aggiornamento
 * disponibile» dell'add-on che dentro non aveva niente di nuovo (e viceversa
 * un'app nei negozi uguale a quella di prima). Adesso si dice quale cambia:
 *
 *     node strumenti/versione.mjs --app 1.19.20      solo l'app: pubspec e versione.dart
 *     node strumenti/versione.mjs --add-on 1.19.20   solo l'add-on: manifesto e plancia
 *     node strumenti/versione.mjs --add-on 1.19.19.1 l'add-on con la correzione
 *     node strumenti/versione.mjs 1.19.20            tutti e due, quando cambiano tutti e due
 *     node strumenti/versione.mjs --dimmi            dice cosa c'e' scritto adesso
 *
 * I posti sono quattro e sono fatti diversi: l'add-on ha `ponte/config.yaml`
 * (`version: "1.4.25"`) e la versione che la plancia dichiara
 * (`ponte/plancia/ORIGINE.json`); l'app ha `app/pubspec.yaml`
 * (`version: 1.4.25+1042500`) e il numero che fa vedere (`app/lib/versione.dart`).
 * Le prove (`ponte/test/marchio.test.js`) tengono ferme le regole che restano:
 * dentro l'app i suoi due posti dicono lo stesso, dentro l'add-on anche.
 *
 * Il numero di costruzione dell'app si deriva dal nome — 1.4.25 diventa
 * 1042500 — cosi' non c'e' un secondo numero da ricordarsi, e cresce sempre,
 * che e' l'unica cosa che i negozi dei telefoni chiedono: un numero piu'
 * piccolo di quello che c'e' il programma lo rifiuta.
 *
 * L'add-on puo' portarsi un **quarto numero** per le sue correzioni
 * (`1.4.25.1`): i negozi non c'entrano. Col numero unico di prima (`1.4.25.1`
 * per tutti e due) il quarto finiva anche nella costruzione dell'app
 * (1042501); si fa ancora, per chi lo chiede senza dire quale.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

/* E il quarto: quello che **la plancia dichiara mentre gira**.
 *
 * `ORIGINE.json` e' la carta d'identita' della plancia — l'impronta di ogni
 * file, il commit da cui viene, e il suo numero di versione. Quel numero lo
 * legge il ponte (`plancia.provenienza.versione`) e lo mette nel rapporto, da
 * dove finisce nella console dell'add-on, nel cruscotto dell'installatore e
 * nell'app, alla riga «la plancia».
 *
 * Non lo scriveva nessuno. `sigilla-la-plancia.mjs` se lo riporta avanti dal
 * giro prima (`versione: String(prima?.versione || "")`), quindi restava fermo
 * al giorno in cui qualcuno l'aveva scritto a mano: mentre tutto il resto
 * diceva 1.5.9, la plancia continuava a dichiararsi **1.4.32**. Tre numeri
 * giusti e uno vecchio di quattordici versioni, sulla stessa riga della stessa
 * schermata.
 *
 * Qui ci va il numero a **tre** cifre, non quello a quattro: il quarto e' una
 * correzione dell'add-on, e la plancia dentro e' la stessa. E' la stessa regola
 * del nome dell'app, ed e' per questo che `versioneDiQuestApp` si chiama «la
 * versione della plancia che l'app ha dentro».
 *
 * Si tocca solo quel campo: il sigillo e' l'impronta dei file dentro `legacy/`,
 * `src/`, `avatars/` e `brands/` (`ponte/src/provenienza.js`), e `ORIGINE.json`
 * non e' fra quelli. Scriverci la versione non muove il sigillo e non invalida
 * nessuna firma. */
const ORIGINE_DELLA_PLANCIA = join(RADICE, "ponte", "plancia", "ORIGINE.json");

export function laVersioneDellAddon(manifesto) {
  return /^version: "([^"]+)"$/m.exec(manifesto)?.[1] || "";
}

export function laVersioneDellApp(pubspec) {
  return /^version: (\S+)$/m.exec(pubspec)?.[1] || "";
}

/* Quante correzioni ci stanno fra due versioni della plancia: cento, da 0 a 99.
 *
 * **Erano dieci**, e dieci sono finite: dopo la 1.4.32.9 il numero successivo
 * e' la 1.4.32.10, e con una cifra sola quella dava 104330 — **lo stesso
 * numero della 1.4.33**. Un numero di costruzione non si puo' riusare: il
 * negozio lo rifiuta, e non lo rifiuta oggi, lo rifiuta il giorno che si fa la
 * plancia nuova, quando nessuno si ricorda piu' perche'.
 *
 * Allargandolo a due cifre i numeri **crescono comunque** — 1.4.32.9 era
 * 104329 e diventa 1043209 — che e' l'unica cosa che i negozi chiedono. */
const CORREZIONI = 100;

/* Il numero di costruzione: 1.4.25 → 1042500, e 1.4.25.1 → 1042501.
 *
 * Le ultime due cifre sono la correzione dell'add-on, e senza correzione sono
 * zero: cosi' non c'e' un secondo numero da ricordarsi. */
export function laCostruzione(versione) {
  const [grande, medio, piccolo, correzione = 0] = versione.split(".").map(Number);
  return (grande * 10000 + medio * 100 + piccolo) * CORREZIONI + correzione;
}

function controlla(quale, { quattro = true } = {}) {
  const pezzi = quale.split(".");
  const massimo = quattro ? 4 : 3;
  if (pezzi.length < 3 || pezzi.length > massimo || pezzi.some((uno) => !/^\d+$/.test(uno))) {
    process.stderr.write(
      quattro
        ? `«${quale}» non e' una versione: ci vogliono tre numeri, o quattro con la\n` +
            "correzione dell'add-on. Per esempio 1.4.25 oppure 1.4.25.1\n"
        : `«${quale}» non e' una versione dell'app: ci vogliono tre numeri, per esempio\n` +
            "1.4.25 (il quarto e' solo dell'add-on: i negozi non lo prendono)\n",
    );
    process.exit(64);
  }
  /* La correzione deve stare nel posto che ha. Se no il numero di costruzione
   * si accavalla con quello della versione dopo, e non lo si scopre qui: lo
   * scopre il negozio, mesi dopo, rifiutando un numero gia' usato. */
  if (pezzi.length === 4 && Number(pezzi[3]) >= CORREZIONI) {
    process.stderr.write(
      `la correzione «${pezzi[3]}» non ci sta: da 0 a ${CORREZIONI - 1}.\n` +
        "Oltre, il numero di costruzione sarebbe quello della versione dopo.\n",
    );
    process.exit(64);
  }
  return pezzi;
}

/* L'add-on: il manifesto, e la versione che la plancia dice di se'. */
function scriviLAddon(quale) {
  const pezzi = controlla(quale);
  const manifesto = readFileSync(MANIFESTO, "utf8");
  const prima = laVersioneDellAddon(manifesto);
  writeFileSync(MANIFESTO, manifesto.replace(/^version: "[^"]+"$/m, `version: "${quale}"`), "utf8");
  process.stdout.write(`l'add-on: ${prima || "?"} → ${quale}\n`);
  /* La plancia dichiara il numero a tre cifre: il quarto e' una correzione
   * dell'add-on, e la plancia dentro e' la stessa. */
  scriviLOrigine(pezzi.slice(0, 3).join("."));
  /* E le versioni che la plancia dice di se' (la scheda Runtime del config):
   * si risigilla, che le riscrive con il numero nuovo. Senza, il Runtime
   * diceva ancora il numero di prima. */
  const sigilla = join(RADICE, "strumenti", "sigilla-la-plancia.mjs");
  if (existsSync(join(RADICE, "ponte", "plancia"))) {
    execFileSync(process.execPath, [sigilla], { cwd: RADICE, stdio: "inherit" });
  }
}

/* L'app: il pubspec e il numero che fa vedere. [nome] a tre numeri,
 * [costruzione] quella che va nei negozi. */
function scriviLApp(nome, costruzione) {
  const pubspec = readFileSync(PUBSPEC, "utf8");
  const suo = `${nome}+${costruzione}`;
  const era = laVersioneDellApp(pubspec);
  const costruzioneDiPrima = Number(/\+(\d+)$/.exec(era)?.[1] || 0);
  /* I negozi vogliono un numero sempre piu' grande: uno uguale o piu'
   * piccolo lo rifiutano, e lo si scopre a pacchetto fatto. */
  if (costruzioneDiPrima && costruzione < costruzioneDiPrima) {
    process.stderr.write(
      `l'app e' gia' alla costruzione ${costruzioneDiPrima}: ${suo} e' piu' indietro, e i negozi la rifiuterebbero.\n`,
    );
    process.exit(65);
  }
  /* Il numero dentro l'app si riscrive comunque: il `pubspec` puo' essere
   * gia' quello giusto e quel file no — e' nato dopo. */
  scriviIlDart(nome, costruzione);
  if (era === suo) {
    process.stdout.write(`l'app: ${era}, gia' quella giusta\n`);
    return;
  }
  writeFileSync(PUBSPEC, pubspec.replace(/^version: \S+$/m, `version: ${suo}`), "utf8");
  process.stdout.write(`l'app: ${era || "?"} → ${suo}\n`);
}

/* Tutti e due allo stesso numero, come si faceva prima: quando cambiano
 * tutti e due. Il quarto numero dell'add-on finisce nella costruzione
 * dell'app (1.4.25.1 → 1042501), il nome dell'app resta a tre. */
function scrivi(quale) {
  const pezzi = controlla(quale);
  scriviLAddon(quale);
  scriviLApp(pezzi.slice(0, 3).join("."), laCostruzione(quale));
}

/* Quello che la plancia dichiara mentre gira. Se non c'e' — una copia della
 * repository senza la plancia dentro — non si inventa niente e non si lamenta:
 * chi non ha la plancia non ha niente da tenere in pari. */
function scriviLOrigine(tre) {
  let scritto;
  try {
    scritto = readFileSync(ORIGINE_DELLA_PLANCIA, "utf8");
  } catch (_nonCE) {
    return;
  }
  const dentro = JSON.parse(scritto);
  const era = String(dentro.versione || "");
  if (era === tre) {
    process.stdout.write(`la plancia: ${era}, gia' quella giusta\n`);
    return;
  }
  dentro.versione = tre;
  writeFileSync(ORIGINE_DELLA_PLANCIA, `${JSON.stringify(dentro, null, 2)}\n`, "utf8");
  process.stdout.write(`la plancia: ${era || "?"} → ${tre}\n`);
}

/* Il numero dentro l'app, per farlo vedere. */
function scriviIlDart(nome, costruzione) {
  writeFileSync(
    VERSIONE_DART,
    `/// Il numero di questa app, quello che si legge nel negozio.
///
/// **Lo scrive \`strumenti/versione.mjs --app\`**, insieme al \`pubspec\`: a mano
/// non si tocca, e una prova tiene ferma la regola che dicano lo stesso
/// numero (\`ponte/test/marchio.test.js\`). L'add-on ha un numero suo.
///
/// Il \`pubspec\` lo legge chi costruisce, non l'app che gira. Per rileggerlo
/// da dentro servirebbe un pacchetto in piu' — uno che chieda al sistema che
/// pacchetto e' — e per un numero non vale la pena: qui c'e', e si vede in
/// «Come va l'app» e nella riga in fondo alle schermate.
library;

/// Come si chiama: la versione dell'app (l'add-on ha la sua).
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
  /* E la plancia. Sta qui perche' e' il posto dove si va a guardare quando i
   * numeri non tornano, ed era proprio quello a non tornare. */
  try {
    const dentro = JSON.parse(readFileSync(ORIGINE_DELLA_PLANCIA, "utf8"));
    process.stdout.write(`plancia: ${String(dentro.versione || "?")}\n`);
  } catch (_nonCE) {
    /* Senza plancia non c'e' niente da dire. */
  }
}

const [detto, numero] = process.argv.slice(2);
if (!detto) {
  process.stderr.write(
    "Uso: node strumenti/versione.mjs --app <versione>       solo l'app\n" +
      "     node strumenti/versione.mjs --add-on <versione>    solo l'add-on\n" +
      "     node strumenti/versione.mjs <versione>             tutti e due\n" +
      "     node strumenti/versione.mjs --dimmi\n",
  );
  process.exit(64);
} else if (detto === "--dimmi") {
  dimmi();
} else if (detto === "--app") {
  const pezzi = controlla(numero || "", { quattro: false });
  scriviLApp(pezzi.join("."), laCostruzione(numero));
} else if (detto === "--add-on") {
  scriviLAddon(numero || "");
} else {
  scrivi(detto);
}
