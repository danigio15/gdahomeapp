/* Risigilla la plancia, dopo che l'abbiamo toccata.
 *
 * Fino a ieri la plancia arrivava da fuori: era la copia verbatim di una
 * release di `dashboardmodern-v2`, e `porta-la-plancia.mjs` la portava dentro
 * e la sigillava. Quella repository non c'e' piu': **la plancia vive qui**, e
 * qui si correggono i suoi difetti.
 *
 * Cambia una cosa sola, ma cambia tutto il verso del lavoro. Il sigillo di
 * `ORIGINE.json` — l'impronta di ogni file, piu' l'impronta della lista — non
 * dice piu' «questa e' la copia intatta del lavoro di un altro»: dice «questa
 * e' la plancia come l'abbiamo pubblicata noi». Serve ancora, e serve per la
 * stessa ragione di prima: dentro ogni casa il ponte ricontrolla le impronte,
 * e una copia rimaneggiata da qualcun altro lo dice nella console
 * (`ponte/src/provenienza.js`).
 *
 * Il che vuol dire che **dopo ogni correzione alla plancia il sigillo va
 * rifatto**. Senza, il ponte di tutti direbbe «modificata» su una plancia che
 * abbiamo modificato noi apposta — e un allarme che suona quando non e'
 * successo niente si impara a non sentirlo. Una prova lo tiene fermo
 * (`ponte/test/provenienza.test.js`): se i file non tornano col sigillo, le
 * Prove si fermano prima che quella plancia esca di qui.
 *
 *     node strumenti/sigilla-la-plancia.mjs            risigilla com'e'
 *     node strumenti/sigilla-la-plancia.mjs --dimmi    dice se tornerebbe
 *
 * Le impronte non le calcola questo programma: le chiede al ponte, che e' chi
 * poi le verifica. Due formule per la stessa cosa vorrebbero dire, il giorno
 * che una delle due cambia, «modificata» su una plancia intatta.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { leImpronte, sigilloDi } from "../ponte/src/provenienza.js";

const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));
const PLANCIA = join(RADICE, "ponte", "plancia");
const ORIGINE = join(PLANCIA, "ORIGINE.json");

/* Dove vive la plancia adesso. Prima era la repository di qualcun altro; il
 * campo resta perche' e' quello che la console mostra a chi si chiede da dove
 * arrivi la pagina che ha davanti. */
const REPOSITORY = "danigio15/gdahomeapp";

/** Il commit da cui si sta sigillando. Vuoto fuori da un checkout. */
export function ilCommit(dove = RADICE) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: dove, encoding: "utf8" }).trim();
  } catch (_errore) {
    return "";
  }
}

/** Quello che c'e' scritto adesso in `ORIGINE.json`, o niente. */
export function lOrigine(via = ORIGINE) {
  try {
    return JSON.parse(readFileSync(via, "utf8"));
  } catch (_errore) {
    return null;
  }
}

/**
 * Il contenuto nuovo di `ORIGINE.json`, a partire dai file che ci sono.
 *
 * La **firma** si tiene solo se il sigillo non e' cambiato. E' l'unica regola
 * delicata qui dentro: la firma vale per un sigillo preciso, e portarsela
 * dietro su file diversi vorrebbe dire una plancia che si dichiara firmata
 * mentre la sua firma non regge — cioe' peggio di una non firmata, perche'
 * bisogna verificarla per scoprirlo. Quando i file cambiano la firma si
 * svuota, e la rimette `firma-la-plancia.mjs` con la chiave privata.
 */
export function ilSigillo(cartella, { prima = null, commit = "", quando = new Date() } = {}) {
  const impronte = leImpronte(cartella);
  const nomi = Object.keys(impronte).sort();
  const sigillo = sigilloDi(impronte);
  const eraLoStesso = prima && String(prima.sigillo || "") === sigillo;
  return {
    repository: REPOSITORY,
    commit: commit || String(prima?.commit || ""),
    versione: String(prima?.versione || ""),
    portata_il: eraLoStesso ? String(prima.portata_il || "") : quando.toISOString(),
    file: nomi.length,
    byte: nomi.reduce((somma, nome) => somma + byteDi(join(cartella, nome)), 0),
    sigillo,
    firma: eraLoStesso ? String(prima.firma || "") : "",
    impronte: Object.fromEntries(nomi.map((nome) => [nome, impronte[nome]])),
  };
}

function byteDi(via) {
  try {
    return readFileSync(via).length;
  } catch (_errore) {
    return 0;
  }
}

/** Se quello che c'e' scritto torna con i file che ci sono. */
export function torna(cartella, origine) {
  if (!origine) return false;
  return sigilloDi(leImpronte(cartella)) === String(origine.sigillo || "");
}

/* Lanciato da se'. */
if (process.argv[1] && process.argv[1].endsWith("sigilla-la-plancia.mjs")) {
  if (!existsSync(PLANCIA)) {
    console.error("qui la plancia non c'e': non c'e' niente da sigillare");
    process.exit(1);
  }
  const prima = lOrigine();
  if (process.argv.includes("--dimmi")) {
    const aPosto = torna(PLANCIA, prima);
    console.log(
      aPosto
        ? `il sigillo torna: ${Object.keys(prima.impronte || {}).length} file`
        : "il sigillo NON torna: la plancia e' cambiata e va risigillata",
    );
    process.exit(aPosto ? 0 : 1);
  }
  const nuovo = ilSigillo(PLANCIA, { prima, commit: ilCommit() });
  writeFileSync(ORIGINE, `${JSON.stringify(nuovo, null, 2)}\n`);
  const cambiato = !prima || prima.sigillo !== nuovo.sigillo;
  console.log(
    cambiato
      ? `sigillo nuovo: ${nuovo.file} file, ${nuovo.sigillo.slice(0, 12)}…` +
          (prima?.firma ? " — la firma di prima non vale piu' e si e' svuotata" : "")
      : `niente da rifare: ${nuovo.file} file, il sigillo e' lo stesso`,
  );
}
