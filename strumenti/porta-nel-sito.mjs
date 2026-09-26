/* Porta nel sito le cose che nel sito non si scrivono a mano.
 *
 *     node strumenti/porta-nel-sito.mjs
 *
 * Il sito in `sito/` racconta il progetto, e per raccontarlo bene deve far
 * vedere **le cose vere**. Non delle riproduzioni: le cose. Quello che porta,
 * e da dove:
 *
 *  - **la plancia**, da `ponte/plancia/` — quella di DashboardModern, gli
 *    stessi file che stanno dentro l'add-on. Non una copia rifatta a mano, non
 *    delle fotografie: la plancia, che nel sito gira davvero;
 *  - **la casa demo**, da `collaudo/casa-demo.json` — la stessa che il
 *    collaudo accende per fotografare l'app, con cui la plancia del sito si
 *    riempie: duecentotrentacinque entita' di una casa che esiste;
 *  - **il marchio**, da `app/assets/marchio/gda.png`;
 *  - **le icone**, da `app/assets/oggetti/` — le stesse che l'app mette sulle
 *    sue voci;
 *  - **i caratteri**, da `ponte/plancia/legacy/vendor/fonts/` — Inter e
 *    Oswald, quelli della plancia. Stanno qui dentro: un sito che racconta che
 *    la casa non parla con nessuno e poi va a prendersi i caratteri da Google
 *    si smentisce da solo.
 *
 * ## Le due meta', e perche' una sola sta nella repository
 *
 * Quello che finisce in `sito/statico/` sono seicento kilobyte, ed e'
 * salvato: la pagina si apre e si pubblica com'e'.
 *
 * La plancia invece sono **diciassette megabyte e ottocentottantasette file**,
 * ed e' una copia identica di roba che nella repository c'e' gia'. Perche' non
 * ce ne sia una seconda, `sito/dashboardmodern_static/` sta fuori da git (`.gitignore`) e si
 * rifa' con questo script — in locale prima di guardare il sito, e nella
 * pagina «Il sito» di GitHub prima di pubblicarlo.
 *
 * ## L'unica cosa che si tocca della plancia
 *
 * Una riga, in `dashboard.html`: due `<script>` infilati prima del preludio.
 * Il preludio (`legacy/bridge-prelude.js`) ha un gancio fatto apposta — se
 * trova un `__DASHBOARDMODERN_BRIDGE_WS__` gia' messo nella finestra, lo usa
 * al posto del WebSocket vero — ed e' lo stesso gancio con cui l'app sul
 * telefono le cuce addosso il proprio filo. Dall'altra parte del gancio, qui,
 * c'e' `sito/casa-in-pagina.js`: una Home Assistant finta dentro la pagina.
 *
 * Tutto il resto della plancia arriva **byte per byte** come sta nell'add-on,
 * e lo script lo controlla: se `dashboard.html` non ha piu' il preludio dove
 * se lo aspetta, si ferma invece di pubblicare una plancia che non parte.
 */

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
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = dirname(QUI);
const SITO = join(RADICE, "sito");
const STATICO = join(SITO, "statico");
/* La plancia va in una cartella che si chiama **cosi'**, e non e' un vezzo:
 * la plancia ricava da se' dove stanno i suoi ritratti guardando il proprio
 * indirizzo (`src/sections/person-avatar-section.js`), e quello che cerca e'
 * `/dashboardmodern_static/`. E' il nome con cui la serve Home Assistant, ed
 * e' il nome con cui la serve il ponte. Chiamandola in un altro modo, i
 * ritratti delle persone finiscono a 404. */
const PLANCIA_NEL_SITO = join(SITO, "dashboardmodern_static");

/* I caratteri: solo i sottoinsiemi che servono a una pagina in italiano.
 *
 * La plancia se li porta dietro per quindici lingue — greco, cirillico,
 * vietnamita — e sono megabyte. Qui la pagina e' una e in italiano: latin per
 * quello che si scrive, latin-ext per le poche parole che escono dal latino
 * base. I pesi sono quelli che lo stile usa davvero, e non uno di piu'. */
const CARATTERI = [
  "inter-latin-300-normal.woff2",
  "inter-latin-400-normal.woff2",
  "inter-latin-700-normal.woff2",
  "inter-latin-ext-300-normal.woff2",
  "inter-latin-ext-400-normal.woff2",
  "inter-latin-ext-700-normal.woff2",
  "oswald-latin-500-normal.woff2",
  "oswald-latin-ext-500-normal.woff2",
];

/* Dove si infilano i due script: subito prima del preludio della plancia, che
 * e' il primo codice suo che gira. */
const PRELUDIO = '<script src="./bridge-prelude.js"></script>';
const DA_INFILARE =
  '<script src="../../statico/casa.js"></script>\n' +
  '<script src="../../casa-in-pagina.js"></script>\n';

function fermati(perche) {
  process.stderr.write(`${perche}\n`);
  process.exit(66);
}

/* ── La casa demo ─────────────────────────────────────────────────────────
 *
 * Esce **come sta**: le entita' nella forma di Home Assistant e la
 * configurazione nella forma del ponte, perche' e' cosi' che la casa finta in
 * pagina le deve rispondere alla plancia. Qui non si interpreta niente — il
 * giorno che si interpretasse, il sito farebbe vedere una casa che non e'
 * quella delle prove.
 *
 * Esce come JavaScript e non come JSON per una ragione sola: un `fetch` di un
 * file JSON non funziona quando la pagina si apre col doppio clic, perche' su
 * `file://` il browser non lascia leggere niente di fianco. Un `<script>`
 * invece si legge sempre. */
function laCasa() {
  const origine = join(RADICE, "collaudo", "casa-demo.json");
  if (!existsSync(origine)) fermati(`Non trovo ${origine}.`);
  const crudo = JSON.parse(readFileSync(origine, "utf8"));

  if (!Array.isArray(crudo.entita) || crudo.entita.length === 0)
    fermati("La casa demo non ha entita'.");
  if (!crudo.configurazione?.snapshot?.values)
    fermati("Nella casa demo non c'e' la configurazione della plancia.");

  return {
    origine: "collaudo/casa-demo.json",
    /* `last_changed` e `last_updated` non servono: la casa in pagina le
     * rimette a adesso, se no la plancia direbbe «visto 40 giorni fa». */
    entita: crudo.entita.map(({ entity_id, state, attributes }) => ({
      entity_id,
      state,
      attributes: attributes ?? {},
    })),
    configurazione: crudo.configurazione,
  };
}

/* ── La plancia ─────────────────────────────────────────────────────────── */

function portaLaPlancia() {
  const da = join(RADICE, "ponte", "plancia");
  if (!existsSync(join(da, "legacy", "dashboard.html")))
    fermati(
      `In ${da} non c'e' la plancia.\n` +
        "La plancia sta in `ponte/plancia/`, dentro l'add-on: se li' non c'e',\n" +
        "questo checkout e' incompleto.",
    );

  rmSync(PLANCIA_NEL_SITO, { recursive: true, force: true });
  cpSync(da, PLANCIA_NEL_SITO, { recursive: true });

  /* I due script, prima del preludio. E' l'unica riga della plancia che
   * cambia: se un giorno il preludio si chiamasse diversamente, meglio
   * fermarsi qui che pubblicare una plancia che resta sul velo d'avvio. */
  for (const pagina of ["dashboard.html", "dashboard-en.html"]) {
    const dove = join(PLANCIA_NEL_SITO, "legacy", pagina);
    if (!existsSync(dove)) continue;
    const testo = readFileSync(dove, "utf8");
    if (!testo.includes(PRELUDIO))
      fermati(
        `In ${pagina} non trovo il preludio della plancia.\n` +
          `Cercavo: ${PRELUDIO}\n` +
          "Senza, la casa finta non si attacca e la plancia del sito resta al velo.",
      );
    writeFileSync(dove, testo.replace(PRELUDIO, DA_INFILARE + PRELUDIO));
  }

  let quanti = 0;
  let byte = 0;
  const guarda = (cartella) => {
    for (const nome of readdirSync(cartella)) {
      const intero = join(cartella, nome);
      const dati = statSync(intero);
      if (dati.isDirectory()) guarda(intero);
      else {
        quanti += 1;
        byte += dati.size;
      }
    }
  };
  guarda(PLANCIA_NEL_SITO);
  return { quanti, byte };
}

/* ── Il giro ──────────────────────────────────────────────────────────── */

rmSync(STATICO, { recursive: true, force: true });
mkdirSync(join(STATICO, "oggetti"), { recursive: true });
mkdirSync(join(STATICO, "font"), { recursive: true });

const fatto = [];
const conta = (che, quanti, byte, unita = "file") => fatto.push({ che, quanti, byte, unita });

/* Il marchio. */
const marchio = join(RADICE, "app", "assets", "marchio", "gda.png");
if (!existsSync(marchio)) fermati(`Non trovo il marchio in ${marchio}.`);
cpSync(marchio, join(STATICO, "marchio.png"));
conta("il marchio", 1, statSync(join(STATICO, "marchio.png")).size);

/* Le icone. */
const oggetti = join(RADICE, "app", "assets", "oggetti");
if (!existsSync(oggetti)) fermati(`Non trovo le icone in ${oggetti}.`);
let icone = 0;
let iconeByte = 0;
for (const nome of readdirSync(oggetti).sort()) {
  if (!nome.endsWith(".svg")) continue;
  cpSync(join(oggetti, nome), join(STATICO, "oggetti", nome));
  icone += 1;
  iconeByte += statSync(join(STATICO, "oggetti", nome)).size;
}
if (icone === 0) fermati("Non ho trovato nessuna icona da portare.");
conta("le icone", icone, iconeByte);

/* Le schermate dell'app.
 *
 * Sono le stesse che stanno nel README e sul negozio: fotografie vere di
 * quello che si vede sul telefono, non dei mockup. Una copertina che racconta
 * un'app senza farla vedere chiede a chi legge di fidarsi; queste tolgono di
 * mezzo la domanda. */
const schermate = join(RADICE, "docs", "immagini");
if (!existsSync(schermate)) fermati(`Non trovo le schermate in ${schermate}.`);
let quanteSchermate = 0;
let schermateByte = 0;
for (const nome of readdirSync(schermate).sort()) {
  if (!nome.endsWith(".png")) continue;
  cpSync(join(schermate, nome), join(STATICO, "schermate", nome));
  quanteSchermate += 1;
  schermateByte += statSync(join(STATICO, "schermate", nome)).size;
}
if (quanteSchermate === 0) fermati("Non ho trovato nessuna schermata da portare.");
conta("le schermate", quanteSchermate, schermateByte);

/* gdanav dentro gdahome: le schermate del telefono e gli schermi di Android
 * Auto. Stanno in una cartella loro, accanto alle altre schermate, e si
 * portano allo stesso modo: una cartella che il sito usa e che lo script
 * rifa' da capo non si scrive a mano. */
const gdanav = join(schermate, "gdanav");
if (!existsSync(gdanav)) fermati(`Non trovo le schermate di gdanav in ${gdanav}.`);
mkdirSync(join(STATICO, "gdanav"), { recursive: true });
let quanteGdanav = 0;
let gdanavByte = 0;
for (const nome of readdirSync(gdanav).sort()) {
  if (!nome.endsWith(".png")) continue;
  cpSync(join(gdanav, nome), join(STATICO, "gdanav", nome));
  quanteGdanav += 1;
  gdanavByte += statSync(join(STATICO, "gdanav", nome)).size;
}
if (quanteGdanav === 0) fermati("Non ho trovato nessuna schermata di gdanav da portare.");
conta("gdanav", quanteGdanav, gdanavByte);

/* I caratteri. */
const font = join(RADICE, "ponte", "plancia", "legacy", "vendor", "fonts");
if (!existsSync(font)) fermati(`Non trovo i caratteri in ${font}.`);
let fontByte = 0;
for (const nome of CARATTERI) {
  const daQui = join(font, nome);
  if (!existsSync(daQui)) fermati(`Nella plancia manca il carattere ${nome}.`);
  cpSync(daQui, join(STATICO, "font", nome));
  fontByte += statSync(join(STATICO, "font", nome)).size;
}
conta("i caratteri", CARATTERI.length, fontByte);

/* La casa demo. */
const casa = laCasa();
const dove = join(STATICO, "casa.js");
writeFileSync(
  dove,
  "/* La casa demo del collaudo, portata qui da strumenti/porta-nel-sito.mjs.\n" +
    " * Non si scrive a mano: si rilancia lo script. */\n" +
    `window.CASA_DEMO = ${JSON.stringify(casa)};\n`,
);
conta("la casa demo", casa.entita.length, statSync(dove).size, "entita'");

/* La plancia vera. */
const plancia = portaLaPlancia();
conta("la plancia", plancia.quanti, plancia.byte);

const scritti = (n) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} kB`;

process.stdout.write("Nel sito:\n");
for (const { che, quanti, byte, unita } of fatto)
  process.stdout.write(`  ${che}: ${quanti} ${unita}, ${scritti(byte)}\n`);
process.stdout.write(
  `  in tutto: ${scritti(fatto.reduce((somma, x) => somma + x.byte, 0))}\n` +
    "  (sito/dashboardmodern_static/ sta fuori da git: si rifa' con questo script)\n",
);
