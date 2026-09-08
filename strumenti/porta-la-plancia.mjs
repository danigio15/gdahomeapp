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
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

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
  process.stderr.write("Uso: node strumenti/porta-la-plancia.mjs /dove/sta/dashboardmodern-v2\n");
  process.exit(64);
}
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
for (const cartella of CARTELLE) {
  const da = join(frontend, cartella);
  if (!existsSync(da)) continue;
  for (const relativo of iFile(da, frontend)) {
    const dove = join(DESTINAZIONE, relativo);
    mkdirSync(dirname(dove), { recursive: true });
    cpSync(join(frontend, relativo), dove);
    quanti += 1;
    byte += statSync(dove).size;
  }
}

let commit = "";
try {
  commit = execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
} catch (_errore) {
  /* Non e' un checkout di git: si scrive quello che si sa. */
}
writeFileSync(
  join(DESTINAZIONE, "ORIGINE.json"),
  JSON.stringify(
    {
      repository: "danigio15/dashboardmodern-v2",
      commit,
      portata_il: new Date().toISOString(),
      file: quanti,
      byte,
    },
    null,
    2,
  ) + "\n",
);

process.stdout.write(
  `Portati ${quanti} file (${(byte / 1024 / 1024).toFixed(1)} MB) in ponte/plancia` +
    (commit ? `, dal commit ${commit.slice(0, 10)}` : "") +
    ".\n",
);
