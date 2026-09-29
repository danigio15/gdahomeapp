/* «Fai tutto adesso, però lascialo spento. Quando dobbiamo partire coi
 *  pagamenti dirò semplicemente: accendi gli acquisti.»
 *
 * Questo e' quel comando. Di suo **non accende niente**: guarda a che punto
 * siamo e lo dice. Accende solo se glielo si chiede in faccia, con `--fallo`.
 *
 *     node strumenti/accendi-gli-acquisti.mjs            ← guarda e racconta
 *     node strumenti/accendi-gli-acquisti.mjs --fallo    ← accende il centralino
 *
 * ─── Cos'e' l'interruttore ───────────────────────────────────────────────
 *
 * Uno solo: `CHIAVE_PUBBLICA_LICENZE`. Finche' e' la stringa vuota — com'e'
 * oggi — nessun gettone vale, l'add-on non limita niente, l'app non mette
 * lucchetti e il centralino lascia passare tutti. Il giorno che ci si scrive
 * dentro una chiave, i controlli si accendono. Non c'e' nessun altro posto da
 * toccare, e nessun altro modo di accenderli per sbaglio.
 *
 * Si accende in due passi, con la stessa chiave. La coppia si fa sulla
 * macchina del quadro, e di li' esce solo la pubblica:
 *
 *   1. `chiave-licenze.mjs --senza-centralino --pubblica <x>`: la chiave
 *      nell'add-on e nell'app. La casa tiene la licenza e gira le ricevute
 *      senza limitare niente; l'app e il browser mettono i lucchetti di Base;
 *      il centralino e la nuvola restano senza chiave, e il fuori casa aperto.
 *   2. `--fallo`, qui: la stessa chiave nel centralino e nella nuvola. Da li'
 *      il fuori casa si chiude alle case che non sono Premium.
 *
 * ─── Perche' un programma e non un foglietto ─────────────────────────────
 *
 * Perche' l'ordine dei passi non e' un dettaglio, e un foglietto si legge a
 * meta'. **Il centralino va per ultimo**, quando l'app nuova e' nei negozi:
 * la', il controllo si accende insieme alla chiave. Una casa con l'add-on
 * vecchio un gettone non lo manda affatto, e il centralino le risponde
 * «aggiorna l'add-on» (`4426`) invece di «serve Premium»: non si aspetta che
 * si aggiornino tutte, perche' nessuna ha pagato a vuoto — con l'add-on
 * vecchio l'app non vende. Il numero delle case che lo sentiranno e' nei
 * numeri del centralino, e qui si dice dove.
 *
 * L'altro passo che fa male e' il primo: i prodotti nei negozi devono essere
 * **attivi prima**. Se no una casa diventa Base e non ha nessuna strada per
 * comprare: ha solo un lucchetto e nessuna chiave.
 *
 * ─── Cosa guarda da se', e cosa no ───────────────────────────────────────
 *
 * Da se' guarda quello che sta in questa repository: se l'interruttore e'
 * ancora spento, se i sei file che tengono la chiave sono tutti d'accordo, e
 * se gdanav e' li' accanto da aggiornare insieme. Quello che sta fuori — i
 * prodotti nei negozi, le credenziali sulla macchina del quadro, quante case
 * si sono aggiornate — non lo puo' sapere, e allora non lo indovina: dice
 * dove si guarda.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));

/** I file di questa repository che tengono la chiave pubblica. */
export const I_FILE_DELLA_CHIAVE = Object.freeze([
  "ponte/src/chiave-licenze.js",
  "centralino/src/chiave-licenze.js",
  "nuvola/src/chiave-licenze.js",
  "app/lib/licenza/chiave.dart",
]);

/* La chiave scritta in un file, o "" se e' vuota. Il JavaScript la scrive
 * `export const CHIAVE_PUBBLICA_LICENZE = "…"`, il Dart
 * `const chiavePubblicaLicenze = '…'`: due forme, una domanda sola. */
const CERCA = /(?:CHIAVE_PUBBLICA_LICENZE|chiavePubblicaLicenze)\s*=\s*["']([^"']*)["']/;

export function laChiaveIn(testo) {
  const trovata = CERCA.exec(String(testo ?? ""));
  return trovata ? trovata[1] : null;
}

/* Dove va la chiave al primo passo: la casa e l'app. */
const CASA_E_APP = new Set(["ponte/src/chiave-licenze.js", "app/lib/licenza/chiave.dart"]);

/**
 * Com'e' messo l'interruttore, file per file.
 *
 * `spento` quando tutti e quattro hanno la chiave vuota, `acceso` quando tutti
 * e quattro hanno la **stessa** chiave, `senza-centralino` quando ce l'hanno
 * l'add-on e l'app e il centralino e la nuvola no; `rotto` quando non sono
 * d'accordo — ed e' il caso peggiore, perche' vorrebbe dire che una parte
 * verifica e l'altra no, e nessuno se ne accorge finche' un cliente non chiama.
 */
export function comEMesso({ radice = RADICE, file = I_FILE_DELLA_CHIAVE } = {}) {
  const dentro = file.map((nome) => {
    const dove = join(radice, nome);
    if (!existsSync(dove)) return { file: nome, ce: false, chiave: null };
    return { file: nome, ce: true, chiave: laChiaveIn(readFileSync(dove, "utf8")) };
  });
  const mancanti = dentro.filter((uno) => !uno.ce || uno.chiave === null);
  const chiavi = new Set(dentro.filter((uno) => uno.chiave !== null).map((uno) => uno.chiave));
  if (mancanti.length)
    return { stato: "rotto", perche: "qualche file non c'e' o non si legge", dentro };
  if (chiavi.size === 1) {
    const sola = [...chiavi][0];
    return { stato: sola === "" ? "spento" : "acceso", chiave: sola, dentro };
  }
  /* Il primo passo: la stessa chiave nella casa e nell'app, e nessuna nel
   * centralino e nella nuvola. Qualunque altro miscuglio e' rotto — il
   * centralino con una chiave che la casa non ha chiuderebbe fuori tutti. */
  const loro = dentro.filter((uno) => CASA_E_APP.has(uno.file));
  const gliAltri = dentro.filter((uno) => !CASA_E_APP.has(uno.file));
  const sua = loro[0]?.chiave ?? "";
  const primoPasso =
    sua !== "" &&
    loro.length === CASA_E_APP.size &&
    loro.every((uno) => uno.chiave === sua) &&
    gliAltri.every((uno) => uno.chiave === "");
  if (primoPasso) return { stato: "senza-centralino", chiave: sua, dentro };
  return { stato: "rotto", perche: "i file non hanno la stessa chiave", dentro };
}

/* gdanav sta in un'altra repository, e la chiave la vuole uguale: se e' li'
 * accanto si aggiorna nello stesso giro, se no si dice dove andarla a
 * rimettere. */
export function doveSiaGdanav(radice = RADICE) {
  for (const dove of [join(radice, "..", "gdanav"), join(radice, "gdanav")]) {
    if (existsSync(join(dove, "packages", "gdanav_app", "lib", "stato", "chiave_licenze.dart"))) {
      return dove;
    }
  }
  return null;
}

/* Le prove di casa, prima di toccare qualunque cosa: un interruttore non si
 * gira su un albero che non si sa se sta in piedi. */
function leProveVanno(radice) {
  try {
    execFileSync("npm", ["test"], { cwd: radice, stdio: "pipe", encoding: "utf8" });
    return { verdi: true };
  } catch (errore) {
    return { verdi: false, perche: String(errore.stdout || errore.message).slice(-2000) };
  }
}

/** I passi che questo programma non puo' fare, nell'ordine in cui vanno fatti. */
export const I_PASSI_A_MANO = Object.freeze([
  {
    quando: "prima",
    che: "I prodotti nei negozi, attivi",
    come: `gdahome: abbonamento \`gdahome_premium\`, piani \`mensile\` e \`annuale\` (Play Console) e
    \`gdahome_premium_mensile\`/\`_annuale\` (App Store Connect). Con la prova gratuita di 14 giorni.
    Se non sono attivi, una casa che diventa Base ha un lucchetto e nessuna strada per comprare.`,
  },
  {
    quando: "prima",
    che: "Le credenziali dei negozi sulla macchina del quadro",
    come: `\`QUADRO_GOOGLE_SERVICE_ACCOUNT\` (il JSON intero), e per Apple \`QUADRO_APPLE_CHIAVE\`,
    \`QUADRO_APPLE_KEY_ID\`, \`QUADRO_APPLE_ISSUER\`, \`QUADRO_APPLE_BUNDLE\`.
    Senza, i regali funzionano e gli acquisti rispondono 503.`,
  },
  {
    quando: "prima",
    che: "Le licenze regalate a chi deve tenerle",
    come: `Dalla pagina del gestore: le tue case, chi prova, gli installatori.
    Vanno date **prima**, non dopo: dopo vuol dire che per un po' sono Base.`,
  },
  {
    quando: "dopo la chiave",
    che: "Un acquisto vero in sandbox",
    come: `Comprare davvero da una build interna e vedere il giro intero:
    negozio → casa (\`ponte/licenza/negozio\`) → quadro → gettone → \`ponte/licenza/stato\` dice Premium.
    E' l'unico modo di sapere che la catena gira.`,
  },
  {
    quando: "quando l'app nuova e' nei negozi",
    che: "Il centralino e la nuvola, per ultimi",
    come: `\`--fallo\`, qui: la stessa chiave anche li'. Da quel momento il fuori casa e' Premium.
    Chi ha l'add-on vecchio si sente dire «aggiorna l'add-on», e nessuno ha pagato a vuoto:
    con l'add-on vecchio l'app non vende. Quante case lo sentiranno lo dice
    \`pronte_alla_licenza\` contro \`case\`, in \`GET /salute\` del centralino chiesto dalla macchina
    stessa (\`curl http://127.0.0.1:8099/salute\`): da fuori quei numeri non si vedono.`,
  },
]);

function racconta(come, gdanav) {
  const righe = [];
  if (come.stato === "spento") {
    righe.push("L'interruttore e' SPENTO: la chiave pubblica e' vuota in tutti i file.");
    righe.push("Oggi nessuno e' limitato, e l'accesso da fuori casa e' di tutti.");
  } else if (come.stato === "senza-centralino") {
    righe.push(`L'interruttore e' ACCESO SENZA IL CENTRALINO: la chiave e' \`${come.chiave}\`.`);
    righe.push("E' nell'add-on e nell'app; il centralino e la nuvola sono senza.");
    righe.push("La casa tiene la licenza e gira le ricevute senza limitare niente; i");
    righe.push("lucchetti di Base li mettono l'app e il browser. Il fuori casa e' ancora aperto.");
  } else if (come.stato === "acceso") {
    righe.push(`L'interruttore e' ACCESO: la chiave e' \`${come.chiave}\`.`);
    righe.push("I controlli valgono da qui in avanti, per chi ha il pezzo aggiornato.");
  } else {
    righe.push(`⚠ L'interruttore e' ROTTO: ${come.perche}.`);
    righe.push(
      "Una parte verifica e un'altra no, e non se ne accorge nessuno finche' non chiama un cliente.",
    );
    for (const uno of come.dentro) {
      righe.push(`    ${uno.file}: ${uno.ce ? `«${uno.chiave ?? "non si legge"}»` : "non c'e'"}`);
    }
  }
  righe.push("");
  righe.push(
    gdanav
      ? `gdanav e' qui accanto (${gdanav}): si aggiorna nello stesso giro.`
      : "gdanav non e' qui accanto: la stessa chiave va rimessa li' a mano, con\n    `node strumenti/chiave-licenze.mjs --pubblica <la chiave> --gdanav <dove sta>`.",
  );
  return righe.join("\n");
}

if (process.argv[1] && process.argv[1].endsWith("accendi-gli-acquisti.mjs")) {
  const fallo = process.argv.includes("--fallo");
  const come = comEMesso();
  const gdanav = doveSiaGdanav();

  console.log(`\n── Gli acquisti ${"─".repeat(56)}\n`);
  console.log(racconta(come, gdanav));

  if (!fallo) {
    console.log(`\n── Quello che va fatto a mano, in quest'ordine ${"─".repeat(30)}\n`);
    for (const passo of I_PASSI_A_MANO) {
      console.log(`  [${passo.quando}]  ${passo.che}`);
      for (const riga of passo.come.split("\n")) console.log(`    ${riga.trim()}`);
      console.log("");
    }
    console.log("La coppia si fa sulla macchina del quadro, e di li' esce solo la pubblica:\n");
    console.log(
      "    node strumenti/chiave-licenze.mjs --senza-centralino --pubblica <la pubblica>\n",
    );
    console.log("Poi si rilascia. Quando l'app nuova e' nei negozi, il centralino:\n");
    console.log("    node strumenti/accendi-gli-acquisti.mjs --fallo\n");
    process.exit(0);
  }

  if (come.stato === "acceso") {
    console.error(
      "\nGli acquisti sono gia' accesi. Rifare la chiave qui invaliderebbe tutti i gettoni\n" +
        "in giro: le case tornano Base finche' non ne chiedono uno nuovo (fino a sei ore).\n" +
        "Se la privata e' uscita e va cambiata, si fa a mano con `chiave-licenze.mjs`,\n" +
        "sapendo cosa succede.\n",
    );
    process.exit(1);
  }
  if (come.stato === "rotto") {
    console.error("\nPrima si rimette a posto l'interruttore: i file non sono d'accordo.\n");
    process.exit(1);
  }
  if (come.stato === "spento") {
    /* Qui una coppia non si fabbrica: la privata stamperebbe su questo
     * schermo, e il suo posto e' solo la macchina del quadro. */
    console.error(
      "\nPrima il primo passo. La coppia si fa sulla macchina del quadro, e di li' esce\n" +
        "solo la pubblica, che si scrive con\n\n" +
        "    node strumenti/chiave-licenze.mjs --senza-centralino --pubblica <la pubblica>\n",
    );
    process.exit(1);
  }

  console.log(`\n── Le prove, prima di girare l'interruttore ${"─".repeat(33)}\n`);
  const prove = leProveVanno(RADICE);
  if (!prove.verdi) {
    console.error("Le prove non passano. Non si accende niente su un albero rosso:\n");
    console.error(prove.perche);
    process.exit(1);
  }
  console.log("verdi.\n");

  console.log(`── La chiave ${"─".repeat(63)}\n`);
  /* La chiave e' gia' fatta: la privata sta sul quadro e ha firmato i
   * gettoni che girano. Se ne facesse un'altra, tutte le case che hanno
   * pagato tornerebbero Base per sei ore. Si allarga quella. */
  const argomenti = ["strumenti/chiave-licenze.mjs", "--pubblica", come.chiave];
  if (gdanav) argomenti.push("--gdanav", gdanav);
  execFileSync("node", argomenti, { cwd: RADICE, stdio: "inherit" });

  console.log(`\n── E adesso ${"─".repeat(64)}\n`);
  console.log("  1. la chiave e' quella di prima: sul quadro non cambia niente.");
  console.log("  2. si rilasciano il centralino e la nuvola. Da li' il fuori casa e' Premium,");
  console.log("     e chi ha l'add-on vecchio si sente dire di aggiornarlo.\n");
}
