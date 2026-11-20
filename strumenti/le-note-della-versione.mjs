/* Le note che la release di GitHub si porta dietro.
 *
 * Fino alla 1.6.10 la release scriveva **sempre le stesse cinque righe**:
 * «gdahome 1.6.8: l'add-on per Home Assistant, e l'app», e poi come si
 * aggiorna l'add-on e perche' l'apk non e' allegato. Giuste, tutte e cinque —
 * ma identiche dalla 1.4 in poi. Chi apriva la pagina di una versione per
 * sapere cosa cambiava leggeva quello che aveva gia' letto la volta prima.
 *
 * Cosa cambia sta scritto, e sta scritto bene: e' `ponte/CHANGELOG.md`, ed e'
 * la stessa finestra che Home Assistant fa vedere premendo «Aggiornamento
 * disponibile». Non c'era nessun motivo perche' quel testo si fermasse li'.
 * Questo programma lo prende e lo porta anche nella release.
 *
 * ─── Perche' un programma e non tre righe di `sed` nel workflow ────────────
 *
 * Perche' una versione che nel CHANGELOG non c'e' e' un guaio da dire, non da
 * ignorare: `sed` tornerebbe vuoto e la release nascerebbe senza niente
 * dentro, senza che nessuno se ne accorga. Qui si ferma e lo dice. E perche'
 * cosi' si prova (`ponte/test/le-note.test.js`) senza toccare GitHub.
 *
 * ─── Come si usa ──────────────────────────────────────────────────────────
 *
 *     node strumenti/le-note-della-versione.mjs 1.6.11
 *     node strumenti/le-note-della-versione.mjs v1.6.11 > note.md
 *     node strumenti/le-note-della-versione.mjs --app app-v1.19.20 > note.md
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));

export const DOVE_STA_IL_CHANGELOG = join("ponte", "CHANGELOG.md");

/* L'app ha il suo (dalla 1.19.19): app e add-on hanno numeri e rilasci
 * separati, e Home Assistant fa vedere il CHANGELOG dell'add-on, dove le
 * novità dell'app non c'entrano. */
export const DOVE_STA_IL_CHANGELOG_DELL_APP = join("app", "CHANGELOG.md");

/* Quello che vale per ogni versione, e che nel CHANGELOG non c'entra: il
 * CHANGELOG racconta cosa cambia, questo racconta come si prende. Sta qui e
 * non nel workflow perche' e' testo per chi legge, e il testo per chi legge si
 * prova. */
export const COME_SI_PRENDE = `**L'add-on si aggiorna da se'**: Impostazioni → Add-on → GdAHome, e c'e' il
tasto. Chi non ce l'ha ancora lo trova nel negozio degli add-on aggiungendo
questa repository fra gli Archivi; il README lo spiega per intero.

**L'app arriva dal Play Store.** Qui il pacchetto non c'e', ed e' voluto:
quello firmato da noi e quello firmato da Google non si installano uno sopra
l'altro, e partire da qui vorrebbe dire disinstallare e riabbinare il telefono
il giorno che si passa al negozio.`;

/** Come si prende l'app: dai negozi, non da qui. */
export const COME_SI_PRENDE_L_APP = `**L'app arriva dai negozi**: Google Play e App Store la propongono da soli.
Qui il pacchetto non c'e', ed e' voluto: quello firmato da noi e quello
firmato dai negozi non si installano uno sopra l'altro.

**L'add-on in casa non cambia** con questa versione dell'app: ha numero e
note suoi.`;

/** Il numero senza la `v` davanti (o `app-v` per l'app): l'etichetta ce l'ha, il CHANGELOG no. */
export function ilNumero(nome) {
  return String(nome || "")
    .trim()
    .replace(/^app-/, "")
    .replace(/^v/, "");
}

/**
 * Il capitolo di una versione, preso dal CHANGELOG.
 *
 * Dal suo `## 1.6.11` fino al `##` dopo — o alla fine, per la prima. Le righe
 * vuote in coda si tolgono: una release che comincia con tre a capo si vede.
 */
export function ilCapitolo(testo, versione) {
  const quale = ilNumero(versione);
  if (!quale) throw new Error("di quale versione? Serve il numero, per esempio 1.6.11");
  const righe = String(testo || "").split("\n");
  const inizio = righe.findIndex((una) => una.trim() === `## ${quale}`);
  if (inizio < 0) {
    throw new Error(
      `nel CHANGELOG non c'e' nessun capitolo «## ${quale}»: ` +
        "una release senza le sue note non si scrive, e un capitolo che manca si scrive prima",
    );
  }
  const dopo = righe.findIndex((una, quante) => quante > inizio && una.startsWith("## "));
  const dentro = righe.slice(inizio + 1, dopo < 0 ? righe.length : dopo);
  const capitolo = dentro.join("\n").trim();
  if (!capitolo) throw new Error(`il capitolo «## ${quale}» del CHANGELOG e' vuoto`);
  return capitolo;
}

/** Le note intere: cosa cambia, e poi come si prende ([app]: l'app). */
export function leNote(testo, versione, { app = false } = {}) {
  return `${ilCapitolo(testo, versione)}\n\n---\n\n${app ? COME_SI_PRENDE_L_APP : COME_SI_PRENDE}\n`;
}

/** Le stesse, leggendo il CHANGELOG dal disco (quello dell'app con [app]). */
export function leNoteDelCambiario(versione, { radice = RADICE, app = false } = {}) {
  const dove = app ? DOVE_STA_IL_CHANGELOG_DELL_APP : DOVE_STA_IL_CHANGELOG;
  let testo = "";
  try {
    testo = readFileSync(join(radice, dove), "utf8");
  } catch (_errore) {
    throw new Error(`il CHANGELOG non si legge: manca ${dove}`);
  }
  return leNote(testo, versione, { app });
}

/* ─── Lanciato da se' ──────────────────────────────────────────────────────── */

if (process.argv[1] && process.argv[1].endsWith("le-note-della-versione.mjs")) {
  try {
    const app = process.argv.includes("--app");
    const quale = process.argv.slice(2).find((una) => una !== "--app") || "";
    if (!quale) throw new Error("uso: node strumenti/le-note-della-versione.mjs [--app] <versione>");
    process.stdout.write(leNoteDelCambiario(quale, { app }));
  } catch (errore) {
    console.error(errore?.message || errore);
    process.exit(1);
  }
}
