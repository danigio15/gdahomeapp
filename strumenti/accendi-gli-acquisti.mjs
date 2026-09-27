/* «Fai tutto adesso, però lascialo spento. Quando dobbiamo partire coi
 *  pagamenti dirò semplicemente: accendi gli acquisti.»
 *
 * Questo e' quel comando. Di suo **non accende niente**: guarda a che punto
 * siamo e lo dice. Accende solo se glielo si chiede in faccia, con `--fallo`.
 *
 *     node strumenti/accendi-gli-acquisti.mjs            ← guarda e racconta
 *     node strumenti/accendi-gli-acquisti.mjs --fallo    ← fabbrica la chiave
 *
 * ─── Cos'e' l'interruttore ───────────────────────────────────────────────
 *
 * Uno solo: `CHIAVE_PUBBLICA_LICENZE`. Finche' e' la stringa vuota — com'e'
 * oggi — nessun gettone vale, l'add-on non limita niente, l'app non mette
 * lucchetti e il centralino lascia passare tutti. Il giorno che ci si scrive
 * dentro una chiave, i controlli si accendono. Non c'e' nessun altro posto da
 * toccare, e nessun altro modo di accenderli per sbaglio.
 *
 * ─── Perche' un programma e non un foglietto ─────────────────────────────
 *
 * Perche' l'ordine dei passi non e' un dettaglio, e un foglietto si legge a
 * meta'. Il passo che fa male e' il quarto: **il centralino va per ultimo**.
 * La', il controllo si accende insieme alla chiave, e una casa con l'add-on
 * vecchio un gettone non lo manda affatto — non perche' non paga, ma perche'
 * quella versione del ponte le licenze non le conosce. Si chiuderebbe fuori
 * da sola, pagante o no. Per questo qui si stampa il numero da guardare e da
 * dove si prende, invece di dire «aspetta un po'».
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

/**
 * Com'e' messo l'interruttore, file per file.
 *
 * `spento` quando tutti e quattro hanno la chiave vuota, `acceso` quando tutti
 * e quattro hanno la **stessa** chiave, `rotto` quando non sono d'accordo — ed
 * e' il caso peggiore, perche' vorrebbe dire che una parte verifica e l'altra
 * no, e nessuno se ne accorge finche' un cliente non chiama.
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
  if (chiavi.size > 1)
    return { stato: "rotto", perche: "i file non hanno la stessa chiave", dentro };
  const sola = [...chiavi][0];
  return { stato: sola === "" ? "spento" : "acceso", chiave: sola, dentro };
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
    quando: "dopo il rilascio",
    che: "Aspettare che le case si aggiornino, e **poi** il centralino",
    come: `Il numero da guardare e' \`pronte_alla_licenza\` contro \`case\` nei numeri del
    centralino (\`GET /numeri\`): quante delle case collegate adesso sanno dire la loro licenza.
    Finche' e' sotto, accendere qui toglie l'accesso da fuori alla differenza —
    anche a chi ha pagato, perche' il suo add-on il gettone non lo manda.
    Solo quando i due numeri si toccano: centralino e nuvola con la chiave.`,
  },
]);

function racconta(come, gdanav) {
  const righe = [];
  if (come.stato === "spento") {
    righe.push("L'interruttore e' SPENTO: la chiave pubblica e' vuota in tutti i file.");
    righe.push("Oggi nessuno e' limitato, e l'accesso da fuori casa e' di tutti.");
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
    console.log("Quando tutto quello che va «prima» e' fatto:\n");
    console.log("    node strumenti/accendi-gli-acquisti.mjs --fallo\n");
    console.log("che fabbrica la chiave, la scrive nei file e stampa la privata una volta sola.");
    console.log("Poi si rilascia, si aspetta, e per ultimo il centralino.\n");
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

  console.log(`\n── Le prove, prima di girare l'interruttore ${"─".repeat(33)}\n`);
  const prove = leProveVanno(RADICE);
  if (!prove.verdi) {
    console.error("Le prove non passano. Non si accende niente su un albero rosso:\n");
    console.error(prove.perche);
    process.exit(1);
  }
  console.log("verdi.\n");

  console.log(`── La chiave ${"─".repeat(63)}\n`);
  const argomenti = ["strumenti/chiave-licenze.mjs"];
  if (gdanav) argomenti.push("--gdanav", gdanav);
  execFileSync("node", argomenti, { cwd: RADICE, stdio: "inherit" });

  console.log(`\n── E adesso, in quest'ordine ${"─".repeat(47)}\n`);
  console.log("  1. la privata qui sopra va SOLO nell'ambiente della macchina del quadro,");
  console.log("     come QUADRO_LICENZE_CHIAVE. In nessun file, in nessun commit.");
  console.log("  2. un acquisto vero in sandbox, e si guarda il giro intero.");
  console.log("  3. si rilascia l'add-on e l'app. Le case si aggiornano da sole.");
  console.log("  4. si aspetta: `pronte_alla_licenza` contro `case`, nei numeri del centralino.");
  console.log("  5. quando i due numeri si toccano, il centralino e la nuvola.\n");
}
