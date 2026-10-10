/* Mette la plancia in un pacchetto, per il ponte.
 *
 * Il perche' sta in `ponte/src/pacco-della-plancia.js`: la pagina chiedeva
 * quattrocentotrentotto file a ogni apertura, e impacchettata ne chiede una
 * ventina. Qui si fa il pacchetto — esbuild, gli stessi due ingressi di
 * sempre, i moduli condivisi in pezzi a parte — e gli si scrive accanto
 * l'impronta dei sorgenti da cui e' fatto. Il ponte lo usa solo se
 * quell'impronta torna.
 *
 * Non si lancia a mano: lo lancia `sigilla-la-plancia.mjs` ogni volta che
 * risigilla, cosi' pacchetto e sorgenti non possono andare ognuno per conto
 * suo. Se lo si lancia da solo, fa il pacchetto e basta.
 *
 * Niente minificazione, misurato: sul tempo d'apertura non si vede, e i nomi
 * veri sono quelli che rendono leggibile un errore arrivato da una casa.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CARTELLA_DEL_PACCO,
  FOGLIO_DEL_PACCO,
  INGRESSI_DEL_PACCO,
  ilPaccoDi,
  improntaDeiSorgenti,
} from "../ponte/src/pacco-della-plancia.js";

const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));
const PLANCIA = join(RADICE, "ponte", "plancia");

/* esbuild sta fra gli attrezzi dell'officina, alla versione scritta li'. */
const ESBUILD = join(RADICE, "officina", "node_modules", ".bin", "esbuild");

/** Rifa' il pacchetto della plancia in `cartella`. Torna quanti moduli. */
export function impacchetta(cartella = PLANCIA) {
  if (!existsSync(ESBUILD)) {
    throw new Error(
      "manca esbuild per fare il pacchetto della plancia: lancia «npm ci» in officina/",
    );
  }
  const dove = join(cartella, CARTELLA_DEL_PACCO);
  rmSync(dove, { recursive: true, force: true });
  mkdirSync(dove, { recursive: true });
  execFileSync(
    ESBUILD,
    [
      ...INGRESSI_DEL_PACCO,
      "--bundle",
      "--format=esm",
      "--splitting",
      "--outbase=.",
      `--outdir=${CARTELLA_DEL_PACCO}`,
      "--charset=utf8",
      "--log-level=error",
    ],
    { cwd: cartella, stdio: "inherit" },
  );
  writeFileSync(
    join(dove, FOGLIO_DEL_PACCO),
    `${JSON.stringify({ sorgenti: improntaDeiSorgenti(cartella) }, null, 2)}\n`,
  );
  const { pacco, perche } = ilPaccoDi(cartella);
  if (!pacco) throw new Error(`il pacchetto appena fatto non regge: ${perche}`);
  return pacco.file.length;
}

if (process.argv[1] && process.argv[1].endsWith("impacchetta-la-plancia.mjs")) {
  const quanti = impacchetta();
  console.log(`plancia impacchettata in ponte/plancia/${CARTELLA_DEL_PACCO}/: ${quanti} moduli`);
}
