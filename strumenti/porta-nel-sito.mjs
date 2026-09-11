/* Porta nel sito le cose che nel sito non si scrivono a mano.
 *
 * Il sito in `sito/` racconta il progetto, e per raccontarlo bene deve far
 * vedere **le cose vere**: il marchio dell'app, le sue icone, i suoi
 * caratteri, e una plancia che si tocca con dentro i numeri di una casa. Se
 * quelle quattro cose si copiassero a mano, il giorno che cambiano il sito
 * resta indietro e nessuno se ne accorge.
 *
 *     node strumenti/porta-nel-sito.mjs
 *
 * Quello che porta, e da dove:
 *
 *  - **il marchio**, da `app/assets/marchio/gda.png` — lo stesso quadrato che
 *    sta sulla schermata del telefono;
 *  - **le icone**, da `app/assets/oggetti/` — quarantasette disegni, gli
 *    stessi che l'app mette sulle sue voci;
 *  - **i caratteri**, da `ponte/plancia/legacy/vendor/fonts/` — Inter per
 *    quello che si legge, Oswald per i numeri grandi. Sono quelli della
 *    plancia, non due che gli somigliano, e stanno qui dentro: un sito che
 *    va a prendersi i caratteri da Google racconta una cosa e ne fa
 *    un'altra;
 *  - **la casa demo**, da `collaudo/casa-demo.json` — la stessa che il
 *    collaudo accende per fotografare l'app. Duecentotrentaquattro entita'
 *    di una casa che esiste: sette stanze, otto luci, cinque termostati, un
 *    fotovoltaico con la batteria, sei elettrodomestici.
 *
 * L'ultima e' la piu' importante: **i numeri della plancia del sito sono
 * quelli delle prove**. Non sono inventati per la vetrina, e il giorno che
 * la casa finta cambia cambia anche il sito.
 *
 * Quello che esce sta in `sito/statico/`, ed e' salvato nella repository
 * apposta: il sito si pubblica com'e', senza costruire niente. Questo script
 * si rilancia quando cambia una delle quattro cose qui sopra.
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
const STATICO = join(RADICE, "sito", "statico");

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

function fermati(perche) {
  process.stderr.write(`${perche}\n`);
  process.exit(66);
}

/* ── Le sezioni della plancia ─────────────────────────────────────────────
 *
 * Quali sezioni ha una plancia non lo decide il sito: lo decide la casa, in
 * `cd_sections`, e sono quelle che la scheda Impostazioni accende e spegne.
 * Il sito prende quell'elenco **cosi' com'e'**: far vedere sezioni che nella
 * plancia vera non esistono, o cambiarne i nomi, e' il modo piu' rapido di
 * far arrivare qualcuno all'app e non fargli ritrovare niente di quello che
 * gli e' stato mostrato.
 *
 * Qui sotto c'e' solo **l'ordine e il nome** di ognuna, che sono quelli della
 * fila dell'editor letta dalla release 1.4.15 e scritta in `docs/CONFIG.md`.
 * `temp` e `temperature` sono due chiavi per la stessa sezione: la plancia le
 * tiene tutte e due per compatibilita'.
 *
 * Se un giorno la casa demo accende una sezione che non e' in questa lista,
 * lo script si ferma invece di lasciarla fuori in silenzio. */
const SEZIONI = [
  { chiave: "home", nome: "Home", disegno: "home" },
  { chiave: "energy", nome: "Energia", disegno: "energia" },
  { chiave: "ev", nome: "Auto elettrica", disegno: "ev" },
  { chiave: "boiler", nome: "Solare termico", disegno: "scaldabagno" },
  { chiave: "security", nome: "Sicurezza", disegno: "sicurezza" },
  { chiave: "server", nome: "MiniPC", disegno: "minipc" },
  { chiave: "temp", nome: "Temperatura", disegno: "temperatura", anche: ["temperature"] },
  { chiave: "clima", nome: "Clima", disegno: "clima" },
  { chiave: "piscina", nome: "Piscina", disegno: "piscina" },
  { chiave: "irrigazione", nome: "Irrigazione", disegno: "irrigazione" },
  { chiave: "tapparelle", nome: "Finestre", disegno: "tapparelle" },
  { chiave: "stanze", nome: "Stanze", disegno: "stanze" },
  { chiave: "luci", nome: "Luci", disegno: "luci" },
  { chiave: "prese", nome: "Prese", disegno: "prese" },
  { chiave: "appliances", nome: "Elettrodomestici", disegno: "elettrodomestici" },
  { chiave: "robot", nome: "Robot", disegno: "robot" },
  { chiave: "media", nome: "Media", disegno: "media" },
  { chiave: "porte", nome: "Porte", disegno: "aperture" },
  { chiave: "ups", nome: "UPS", disegno: "ups" },
  { chiave: "calendario", nome: "Calendario", disegno: "agenda" },
];

/* ── La casa demo ─────────────────────────────────────────────────────────
 *
 * Il file del collaudo ha due meta': le entita', e la configurazione della
 * plancia come Home Assistant la restituirebbe — con dentro, in una stringa,
 * lo stato vero della dashboard. Al sito servono tutte e due, ma non cosi':
 * le entita' gli servono per chiave, e della configurazione gli serve quello
 * che si disegna.
 *
 * E la configurazione sta in due posti, che servono tutti e due:
 * `dm_dashboard_state` per le cose che la plancia ha gia' rifatto — stanze,
 * luci, clima, tapparelle, elettrodomestici, telecamere, energia, piscina,
 * irrigazione — e le chiavi `cd_*` per quelle che stanno ancora nel modo
 * vecchio: prese, lettori, serrature, UPS, calendari, liste, persone, e le
 * sezioni e le entita' che l'utente si e' fatto da se'. */
function laCasa() {
  const origine = join(RADICE, "collaudo", "casa-demo.json");
  if (!existsSync(origine)) fermati(`Non trovo ${origine}.`);
  const crudo = JSON.parse(readFileSync(origine, "utf8"));

  const entita = {};
  for (const voce of crudo.entita ?? []) {
    /* `last_changed` e `last_updated` sono due date del giorno in cui la casa
     * finta e' stata scritta: nel sito farebbero solo invecchiare la pagina. */
    entita[voce.entity_id] = {
      stato: voce.state,
      attributi: voce.attributes ?? {},
    };
  }
  if (Object.keys(entita).length === 0) fermati("La casa demo non ha entita'.");

  const valori = crudo.configurazione?.snapshot?.values ?? {};
  if (!valori.dm_dashboard_state) fermati("Nella casa demo non c'e' lo stato della plancia.");
  const stato = JSON.parse(valori.dm_dashboard_state);
  const sezioni = stato.sections ?? {};

  const inOrdine = (elenco) => [...(elenco ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const letta = (chiave, difetto) => {
    const grezza = valori[chiave];
    if (grezza === undefined || grezza === null || grezza === "") return difetto;
    if (typeof grezza !== "string") return grezza;
    try {
      return JSON.parse(grezza);
    } catch {
      return grezza;
    }
  };

  /* Le sezioni accese, nell'ordine della plancia. */
  const accese = letta("cd_sections", stato.visibility ?? {});
  const conosciute = new Set();
  const inFila = [];
  for (const sezione of SEZIONI) {
    const chiavi = [sezione.chiave, ...(sezione.anche ?? [])];
    for (const una of chiavi) conosciute.add(una);
    if (!chiavi.some((una) => accese[una])) continue;
    inFila.push({ chiave: sezione.chiave, nome: sezione.nome, disegno: sezione.disegno });
  }
  const ignote = Object.keys(accese).filter((chiave) => accese[chiave] && !conosciute.has(chiave));
  if (ignote.length)
    fermati(
      `La casa demo accende sezioni che il sito non sa disegnare: ${ignote.join(", ")}.\n` +
        "Vanno aggiunte a SEZIONI qui dentro e a sito/plancia.js — se no il sito\n" +
        "farebbe vedere una plancia con dentro meno di quella vera.",
    );
  if (inFila.length === 0) fermati("La casa demo non ha nessuna sezione accesa.");

  return {
    origine: "collaudo/casa-demo.json",
    entita,
    plancia: {
      sezioni: inFila,
      /* Quello che la plancia ha gia' rifatto. */
      stanze: inOrdine(sezioni.rooms),
      luci: inOrdine(sezioni.lights),
      clima: inOrdine(sezioni.climate),
      tapparelle: inOrdine(sezioni.covers),
      elettrodomestici: inOrdine(sezioni.appliances),
      telecamere: sezioni.cameras ?? [],
      carichi: inOrdine(sezioni.energyLoads),
      robot: sezioni.robots ?? [],
      energia: sezioni.energy ?? {},
      auto: sezioni.ev ?? [],
      piscina: sezioni.pool ?? {},
      irrigazione: sezioni.irrigation ?? {},
      /* Quello che sta ancora nel modo vecchio. */
      prese: letta("cd_prese", []),
      media: letta("cd_media_player", []),
      porte: letta("cd_security_doors", []),
      ups: letta("cd_ups", {}),
      calendari: letta("cd_calendari", []),
      liste: letta("cd_todo", []),
      avvisi: letta("cd_avvisi_custom", []),
      persone: letta("cd_people", []),
      /* Quello che l'utente si e' fatto da se': una sezione in piu' nella
       * fila, e delle entita' appese a una sezione che c'e' gia'. Sono due
       * funzioni vere della plancia, e nel sito si vedono. */
      sezioniMie: letta("cd_sezioni_mie", []),
      entitaMie: letta("cd_entita_mie", []),
      costoKwh: Number(letta("cd_costo_kwh", 0.28)) || 0.28,
    },
  };
}

/* ── Il giro ──────────────────────────────────────────────────────────── */

rmSync(STATICO, { recursive: true, force: true });
mkdirSync(join(STATICO, "oggetti"), { recursive: true });
mkdirSync(join(STATICO, "font"), { recursive: true });

const fatto = [];
const conta = (che, quanti, byte) => fatto.push({ che, quanti, byte });

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

/* I caratteri. */
const font = join(RADICE, "ponte", "plancia", "legacy", "vendor", "fonts");
if (!existsSync(font)) fermati(`Non trovo i caratteri in ${font}.`);
let fontByte = 0;
for (const nome of CARATTERI) {
  const da = join(font, nome);
  if (!existsSync(da)) fermati(`Nella plancia manca il carattere ${nome}.`);
  cpSync(da, join(STATICO, "font", nome));
  fontByte += statSync(join(STATICO, "font", nome)).size;
}
conta("i caratteri", CARATTERI.length, fontByte);

/* La casa demo.
 *
 * Esce come JavaScript e non come JSON, per una ragione sola: un `fetch` di
 * un file JSON non funziona quando la pagina si apre col doppio clic, perche'
 * su `file://` il browser non lascia leggere niente di fianco. Un `<script>`
 * invece si legge sempre. Cosi' il sito si guarda anche senza metterlo su un
 * server, che e' la prima cosa che uno fa. */
const casa = laCasa();
const dove = join(STATICO, "casa.js");
writeFileSync(
  dove,
  "/* La casa demo del collaudo, portata qui da strumenti/porta-nel-sito.mjs.\n" +
    " * Non si scrive a mano: si rilancia lo script. */\n" +
    `window.CASA_DEMO = ${JSON.stringify(casa)};\n`,
);
conta("la casa demo", Object.keys(casa.entita).length, statSync(dove).size);

const scritti = (n) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} kB`;

process.stdout.write(`Nel sito, in sito/statico/:\n`);
for (const { che, quanti, byte } of fatto)
  process.stdout.write(
    `  ${che}: ${quanti} ${che === "la casa demo" ? "entita'" : "file"}, ${scritti(byte)}\n`,
  );
process.stdout.write(`  in tutto: ${scritti(fatto.reduce((somma, x) => somma + x.byte, 0))}\n`);
