/* Porta gdahome da browser dentro l'add-on.
 *
 * L'app web e' un mucchio di file costruiti — `flutter build web` — e chi ha
 * l'add-on acceso non ha un computer per costruirseli. Allora se li porta
 * dietro l'add-on: questo script copia `app/build/web/` dentro `ponte/app/`,
 * e da li' il ponte la serve sotto `/app/`, dietro l'ingress di Home
 * Assistant.
 *
 *     cd app && flutter build web --release --pwa-strategy=none
 *     node ../strumenti/porta-l-app.mjs
 *
 * Non si copia tutto. Flutter costruisce **sei** motori di disegno — uno per
 * ogni combinazione di browser che potrebbe capitare — e ne usa uno solo;
 * costruisce anche le tabelle dei simboli, che servono a leggere le tracce di
 * un errore e non a far girare niente. Sono trenta megabyte che finirebbero
 * nella repository, nell'immagine dell'add-on e sul disco di casa senza che
 * nessuno li apra mai.
 *
 * Quale motore si usa lo dice `app/web/flutter_bootstrap.js`: `canvaskit`,
 * nella sua versione buona per tutti i browser. Se un giorno quella riga
 * cambia, va cambiata anche la lista qui sotto — e la prova
 * `ponte/test/app.test.js` se ne accorge, perche' guarda che i file che la
 * pagina chiede ci siano davvero.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = dirname(QUI);
const COSTRUITA = join(RADICE, "app", "build", "web");
const DESTINAZIONE = join(RADICE, "ponte", "app");

/* I motori che non si usano. Restano nella cartella costruita — non e' roba
 * nostra da cancellare — ma dentro l'add-on non ci vanno. */
const MOTORI_INUTILI = [
  "canvaskit/chromium",
  "canvaskit/webparagraph",
  "canvaskit/skwasm",
  "canvaskit/skwasm_heavy",
  "canvaskit/wimp",
];

/* Roba che non serve a far girare niente:
 *  - `.symbols`: le tabelle per leggere le tracce degli errori, otto megabyte;
 *  - `flutter_service_worker.js`: quello di Flutter, che qui e' spento apposta
 *    (`--pwa-strategy=none`) perche' il nostro vuole lo stesso posto;
 *  - `.last_build_id`: un appunto del compilatore. */
const SCARTATI = new Set([".symbols"]);
const FILE_SCARTATI = new Set(["flutter_service_worker.js", ".last_build_id"]);

function siPorta(relativo) {
  if (FILE_SCARTATI.has(relativo)) return false;
  if (SCARTATI.has(extname(relativo))) return false;
  for (const motore of MOTORI_INUTILI) {
    if (relativo === motore || relativo.startsWith(`${motore}/`) || relativo.startsWith(`${motore}.`))
      return false;
  }
  return true;
}

function* iFile(cartella, radice) {
  for (const nome of readdirSync(cartella).sort()) {
    const intero = join(cartella, nome);
    const relativo = relative(radice, intero).split("\\").join("/");
    const dati = statSync(intero);
    if (dati.isDirectory()) {
      if (!siPorta(relativo)) continue;
      yield* iFile(intero, radice);
      continue;
    }
    if (!dati.isFile()) continue;
    if (!siPorta(relativo)) continue;
    yield relativo;
  }
}

if (!existsSync(join(COSTRUITA, "index.html"))) {
  process.stderr.write(
    `In ${COSTRUITA} non c'e' nessuna app costruita.\n` +
      "Prima: cd app && flutter build web --release --pwa-strategy=none\n",
  );
  process.exit(66);
}

rmSync(DESTINAZIONE, { recursive: true, force: true });
mkdirSync(DESTINAZIONE, { recursive: true });

let quanti = 0;
let byte = 0;
for (const relativo of iFile(COSTRUITA, COSTRUITA)) {
  const dove = join(DESTINAZIONE, relativo);
  mkdirSync(dirname(dove), { recursive: true });
  cpSync(join(COSTRUITA, relativo), dove);
  quanti += 1;
  byte += statSync(dove).size;
}

let commit = "";
try {
  commit = execFileSync("git", ["-C", RADICE, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
} catch (_errore) {
  /* Non e' un checkout di git: si scrive quello che si sa. */
}

writeFileSync(
  join(DESTINAZIONE, "ORIGINE.json"),
  JSON.stringify(
    {
      cosa: "gdahome da aprire in un browser, costruita con flutter build web",
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
  `Portati ${quanti} file (${(byte / 1024 / 1024).toFixed(1)} MB) in ponte/app` +
    (commit ? `, dal commit ${commit.slice(0, 10)}` : "") +
    ".\nIl ponte la serve sotto /app/, dietro l'ingress.\n",
);
