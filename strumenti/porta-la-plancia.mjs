/* Porta la plancia dentro l'add-on.
 *
 * La plancia di DashboardModern e' fatta di file — una pagina, un foglio di
 * stile, i moduli, i caratteri, i ritratti — e sta nella repository
 * `dashboardmodern-v2`, dentro la cartella del frontend dell'integrazione.
 * Nell'app non deve servire nessuna integrazione in Home Assistant: e' il
 * ponte che serve quei file al telefono, e per farlo li deve avere.
 *
 * Questo script li copia da un checkout di `dashboardmodern-v2` a
 * `ponte/plancia/`, e scrive in `ORIGINE.json` da quale commit vengono. Si
 * rilancia a ogni aggiornamento della plancia:
 *
 *     node strumenti/porta-la-plancia.mjs /dove/sta/dashboardmodern-v2
 *
 * Si copia solo quello che il browser puo' chiedere — gli stessi criteri di
 * `frontend.py` nell'integrazione — e niente altro: ne' le prove, ne' i file
 * di Python, ne' il pannello di Home Assistant, che qui non serve.
 */

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/* Il sigillo lo calcola il ponte, non questo script: se lo calcolassero tutti
 * e due, il giorno che uno dei due cambiasse formula la verifica direbbe
 * «modificata» su una plancia intatta. */
import { improntaDi, sigilloDi } from "../ponte/src/provenienza.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const DESTINAZIONE = join(dirname(QUI), "ponte", "plancia");

const SUFFISSI = new Set([
  ".js",
  ".css",
  ".json",
  ".html",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
  ".gif",
  ".ico",
  ".woff2",
  ".woff",
]);
const CARTELLE_ESCLUSE = new Set(["e2e", "tests", "__pycache__"]);
const FILE_ESCLUSI = new Set(["legacy/VENDOR.json"]);

/* Le cartelle che si portano, com'e' fatta la plancia: `legacy/` e' la
 * pagina e quello che carica, `src/` i moduli, e le altre due i ritratti
 * delle persone e i loghi delle auto, che la pagina chiede con un percorso
 * assoluto. */
const CARTELLE = ["legacy", "src", "avatars", "brands"];

const checkout = process.argv[2];
if (!checkout) {
  process.stderr.write(
    "Uso: node strumenti/porta-la-plancia.mjs /dove/sta/dashboardmodern-v2 [--commit=<sha>]\n",
  );
  process.exit(64);
}

/* Da dove viene, quando non e' un checkout di git.
 *
 * Senza un computer la plancia si prende come si puo': il pacchetto di una
 * versione, scaricato da GitHub, che di `.git` non ha niente. Il commit
 * allora si dice qui — `--commit=3e0f8a5…` — e finisce in `ORIGINE.json`
 * come se venisse da un checkout, perche' e' lo stesso fatto: quei file
 * vengono da li'. */
const dettoIlCommit = process.argv.slice(3).find((uno) => uno.startsWith("--commit="));
const frontend = join(checkout, "custom_components", "dashboardmodern", "frontend");
if (!existsSync(join(frontend, "legacy", "dashboard.html"))) {
  process.stderr.write(`In ${frontend} non c'e' la plancia (manca legacy/dashboard.html).\n`);
  process.exit(66);
}

function* iFile(cartella, radice) {
  for (const nome of readdirSync(cartella).sort()) {
    const intero = join(cartella, nome);
    const relativo = relative(radice, intero).split("\\").join("/");
    const dati = statSync(intero);
    if (dati.isDirectory()) {
      if (CARTELLE_ESCLUSE.has(nome)) continue;
      yield* iFile(intero, radice);
      continue;
    }
    if (!dati.isFile()) continue;
    if (!SUFFISSI.has(extname(nome).toLowerCase())) continue;
    if (FILE_ESCLUSI.has(relativo)) continue;
    yield relativo;
  }
}

rmSync(DESTINAZIONE, { recursive: true, force: true });
mkdirSync(DESTINAZIONE, { recursive: true });

let quanti = 0;
let byte = 0;
/* L'impronta di ogni file, e non solo il conto.
 *
 * Serve a rispondere a una domanda sola, ed e' quella che conta quando il
 * lavoro di qualcuno finisce in mano ad altri: **questa plancia e' quella che
 * ho pubblicato io, o l'ha toccata qualcuno?** Col solo numero di file la
 * risposta e' «boh»; con le impronte si sa anche quali. */
const impronte = {};
for (const cartella of CARTELLE) {
  const da = join(frontend, cartella);
  if (!existsSync(da)) continue;
  for (const relativo of iFile(da, frontend)) {
    const dove = join(DESTINAZIONE, relativo);
    mkdirSync(dirname(dove), { recursive: true });
    cpSync(join(frontend, relativo), dove);
    impronte[relativo] = improntaDi(readFileSync(dove));
    quanti += 1;
    byte += statSync(dove).size;
  }
}

/* Il sigillo: un'impronta sola di tutte le impronte, ed e' quella che si
 * firma. Firmare ottocento righe una per una non aggiungerebbe niente. */
const sigillo = sigilloDi(impronte);

let commit = dettoIlCommit ? dettoIlCommit.slice("--commit=".length).trim() : "";
if (!commit) {
  try {
    commit = execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch (_errore) {
    /* Non e' un checkout di git, e nessuno ha detto da dove viene: si scrive
     * quello che si sa. */
  }
}

/* Che versione e', detta com'e' scritta nel manifesto dell'integrazione: e'
 * il numero che l'utente riconosce, mentre il commit e' per noi. */
let versione = "";
try {
  const manifesto = JSON.parse(
    readFileSync(join(checkout, "custom_components", "dashboardmodern", "manifest.json"), "utf8"),
  );
  versione = String(manifesto.version || "");
} catch (_errore) {
  /* Senza manifesto si va avanti col commit. */
}
/* La licenza della dashboard, accanto al suo codice — e il foglietto che dice
 * di chi e' quella cartella.
 *
 * Li scrive **questo script**, e non e' un dettaglio: erano stati messi a mano
 * il giorno che la repository e' diventata pubblica, e il primo import li ha
 * cancellati tutti e due senza dire niente (la cartella si svuota prima di
 * copiare). Una licenza che sparisce al prossimo aggiornamento della plancia
 * non e' una licenza: e' un file. Adesso rinasce a ogni import, e si prende da
 * dove sta di casa — la `LICENSE` del checkout da cui si copia — cosi' e'
 * sempre la sua versione e non una copia che invecchia.
 *
 * Stanno **sopra** le cartelle firmate (`legacy`, `src`, `avatars`, `brands`),
 * quindi il sigillo non se ne accorge: vedi `ponte/src/provenienza.js`. */
const LA_SUA_LICENZA = join(checkout, "LICENSE");
if (existsSync(LA_SUA_LICENZA)) {
  cpSync(LA_SUA_LICENZA, join(DESTINAZIONE, "LICENSE"));
}
writeFileSync(
  join(DESTINAZIONE, "LEGGIMI.txt"),
  "Questa cartella non e' di gdahome: e' una copia di DashboardModern.\n" +
    "\n" +
    "Che versione, da quale commit e con quali impronte sta scritto in\n" +
    "ORIGINE.json, accanto. La porta dentro strumenti/porta-la-plancia.mjs, e il\n" +
    "ponte la ricontrolla a ogni avvio (ponte/src/provenienza.js): se un file e'\n" +
    "cambiato, lo dice invece di servirlo come se fosse l'originale.\n" +
    "\n" +
    "**La sua licenza e' la sua, e sta qui accanto: LICENSE.** Non e' quella di\n" +
    "gdahome, che sta alla radice della repository. Sono due licenze diverse\n" +
    "perche' sono due lavori diversi dello stesso autore, e quella di\n" +
    "DashboardModern vieta a chiunque altro di ridistribuirla, di farne versioni\n" +
    "derivate e di metterla in un prodotto a pagamento.\n" +
    "\n" +
    "Detto per chi passa di qui: il fatto che questo codice si legga non vuol dire\n" +
    "che si possa prendere. Si legge perche' un add-on di Home Assistant e' fatto\n" +
    "di file che stanno sul disco di chi lo installa, e nasconderli sarebbe\n" +
    "teatro.\n" +
    "\n" +
    "Non si modifica niente qui dentro, e non servirebbe: al prossimo import\n" +
    "questa cartella si rifa' da zero. Le aggiunte di gdahome alla plancia — il\n" +
    "nome, il marchio, le tessere che nell'app non ci vanno — stanno nella pagina\n" +
    "servita: ponte/src/premesse.js per Home Assistant,\n" +
    "app/lib/plancia/premesse.dart per l'app. E' per quello che questa cartella\n" +
    "resta quella che e'.\n",
);

writeFileSync(
  join(DESTINAZIONE, "ORIGINE.json"),
  JSON.stringify(
    {
      repository: "danigio15/dashboardmodern-v2",
      commit,
      versione,
      portata_il: new Date().toISOString(),
      file: quanti,
      byte,
      sigillo,
      /* La firma la mette `strumenti/firma-la-plancia.mjs`, che ha la chiave.
       * Qui resta vuota: una plancia portata dentro e non ancora firmata lo
       * deve dire, non far finta di niente. */
      firma: "",
      impronte,
    },
    null,
    2,
  ) + "\n",
);

process.stdout.write(
  `Portati ${quanti} file (${(byte / 1024 / 1024).toFixed(1)} MB) in ponte/plancia` +
    (versione ? `, versione ${versione}` : "") +
    (commit ? `, dal commit ${commit.slice(0, 10)}` : "") +
    `.\nSigillo ${sigillo.slice(0, 16)}… — da firmare con` +
    " strumenti/firma-la-plancia.mjs\n",
);
