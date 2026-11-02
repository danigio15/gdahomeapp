/* Spezza il riconoscitore degli arredi in pezzi che passano dal filo.
 *
 * Nell'app i file della plancia arrivano al telefono per il filo cifrato,
 * uno per messaggio, in base64: l'app oltre i 16 MB a messaggio chiude il
 * filo (`interoMassimo`, `app/lib/ponte/stretta.dart`) e il centralino, da
 * fuori casa, oltre gli 8 in coda. Il modello D-FINE pesa 21,7 MB e non si
 * comprime (pesi in fp16): intero non arrivava mai, e sul telefono usciva «Il
 * riconoscimento automatico non e' disponibile qui» dopo un'attesa lunga.
 *
 * Qui si tagliano in pezzi da tre megabyte — quattro in base64, la meta' di
 * quello che il centralino tiene in coda — il modello e il WebAssembly di
 * ONNX Runtime, e si scrive `pezzi.json`, che la pagina legge per sapere
 * cosa chiedere e quanto pesa in tutto (per dire «12 di 36 MB»). I pezzi del
 * WebAssembly tengono l'estensione `.wasm`: cosi' il ponte li comprime (da
 * 14 MB a 3,6) come fa col motore dei DWG.
 *
 *     node strumenti/spezza-il-riconoscitore.mjs <modello.onnx> <ort-wasm.wasm>
 *
 * I file interi non restano nella cartella: sarebbero venti e piu' megabyte
 * doppi nel repo. La prova `riconoscitore-a-pezzi.test.js` controlla che i
 * pezzi tornino con `pezzi.json`. */

import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = dirname(dirname(fileURLToPath(import.meta.url)));
export const CARTELLA = join(RADICE, "ponte", "plancia", "legacy", "vendor", "riconoscere");
export const UN_PEZZO = 3 * 1024 * 1024;
export const PEZZI = "pezzi.json";
const MODELLO = "dfine-s-obj365";
const WASM = "ort-wasm-simd-threaded";
const UN_PEZZO_DI_PRIMA = /^(dfine-s-obj365|ort-wasm-simd-threaded)\.\d+\.(bin|wasm)$/;

/** Scrive i pezzi di `byte` come `<nome>.<n><estensione>` e torna la lista. */
export function spezza(byte, nome, estensione, cartella = CARTELLA, unPezzo = UN_PEZZO) {
  const pezzi = [];
  for (let da = 0, n = 1; da < byte.length; da += unPezzo, n++) {
    const file = `${nome}.${n}${estensione}`;
    writeFileSync(join(cartella, file), byte.subarray(da, Math.min(byte.length, da + unPezzo)));
    pezzi.push(file);
  }
  return pezzi;
}

function main() {
  const [modello, wasm] = process.argv.slice(2);
  if (!modello || !wasm) {
    console.error("uso: node strumenti/spezza-il-riconoscitore.mjs <modello.onnx> <ort-wasm.wasm>");
    process.exit(2);
  }
  /* via i pezzi di prima, e i file interi se ci sono ancora */
  for (const f of readdirSync(CARTELLA)) {
    if (UN_PEZZO_DI_PRIMA.test(f)) unlinkSync(join(CARTELLA, f));
  }
  for (const intero of [`${MODELLO}.bin`, `${WASM}.wasm`]) {
    if (existsSync(join(CARTELLA, intero))) unlinkSync(join(CARTELLA, intero));
  }
  const pesi = readFileSync(modello),
    motore = readFileSync(wasm);
  const elenco = {
    unPezzo: UN_PEZZO,
    modello: { byte: pesi.length, pezzi: spezza(pesi, MODELLO, ".bin") },
    wasm: { byte: motore.length, pezzi: spezza(motore, WASM, ".wasm") },
  };
  writeFileSync(join(CARTELLA, PEZZI), `${JSON.stringify(elenco, null, 2)}\n`);
  const tot = pesi.length + motore.length;
  console.log(
    `${elenco.modello.pezzi.length} pezzi di modello (${basename(modello)}) e ${elenco.wasm.pezzi.length} di WebAssembly (${basename(wasm)}), ${(tot / 1e6).toFixed(1)} MB in tutto, in ${CARTELLA}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
