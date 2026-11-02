/* Il riconoscitore degli arredi viaggia a pezzi (vedi
 * strumenti/spezza-il-riconoscitore.mjs): nell'app ogni file della plancia
 * arriva al telefono in un messaggio del filo cifrato, in base64, e l'app
 * oltre i 16 MB chiude il filo; il centralino, da fuori casa, oltre gli 8 in
 * coda. Qui si controlla che `pezzi.json` e i file sul disco tornino: ogni
 * pezzo c'e', i pezzi messi in fila pesano quanto il file intero, nessuno
 * passa i tre mega (quattro in base64), e i file interi non sono rimasti
 * accanto ai pezzi a raddoppiare il repo. */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const cartella = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../legacy/vendor/riconoscere",
);
const elenco = JSON.parse(readFileSync(path.join(cartella, "pezzi.json"), "utf8"));

/* Tre mega: quattro in base64, la meta' di quello che il centralino tiene in
 * coda e un quarto di quello che l'app accetta in un messaggio. */
const UN_PEZZO_AL_MASSIMO = 3 * 1024 * 1024;

test("i pezzi del riconoscitore ci sono tutti, in fila, e ognuno passa dal filo", () => {
  assert.ok(elenco.unPezzo <= UN_PEZZO_AL_MASSIMO, `pezzi da ${elenco.unPezzo} byte`);
  for (const [cosa, estensione] of [
    ["modello", ".bin"],
    ["wasm", ".wasm"],
  ]) {
    const parte = elenco[cosa];
    assert.ok(Array.isArray(parte?.pezzi) && parte.pezzi.length > 1, `${cosa}: nessun pezzo`);
    let totale = 0;
    parte.pezzi.forEach((nome, i) => {
      assert.ok(
        nome.endsWith(`.${i + 1}${estensione}`),
        `${cosa}: ${nome} non e' il pezzo ${i + 1}`,
      );
      const peso = statSync(path.join(cartella, nome)).size;
      assert.ok(peso > 0 && peso <= elenco.unPezzo, `${nome}: ${peso} byte`);
      /* solo l'ultimo puo' essere piu' corto */
      if (i < parte.pezzi.length - 1) assert.equal(peso, elenco.unPezzo, nome);
      totale += peso;
    });
    assert.equal(totale, parte.byte, `${cosa}: i pezzi non fanno il file intero`);
  }
  /* il primo pezzo del WebAssembly comincia come un WebAssembly */
  const testa = readFileSync(path.join(cartella, elenco.wasm.pezzi[0])).subarray(0, 4);
  assert.deepEqual([...testa], [0, 0x61, 0x73, 0x6d]);
});

test("i file interi non stanno accanto ai pezzi: sarebbero 36 MB doppi", () => {
  const nomi = readdirSync(cartella);
  assert.ok(!nomi.includes("dfine-s-obj365.bin"), "il modello intero e' rimasto");
  assert.ok(!nomi.includes("ort-wasm-simd-threaded.wasm"), "il WebAssembly intero e' rimasto");
  /* e nessun pezzo orfano, di una spezzatura di prima */
  const noti = new Set([...elenco.modello.pezzi, ...elenco.wasm.pezzi]);
  const orfani = nomi.filter((n) => /\.\d+\.(bin|wasm)$/.test(n) && !noti.has(n));
  assert.deepEqual(orfani, []);
});

test("quello che il lavoratore si aspetta c'e': ONNX Runtime, la colla e i nomi", () => {
  for (const nome of ["ort.wasm.min.js", "ort-wasm-simd-threaded.js", "obj365.json"])
    assert.ok(statSync(path.join(cartella, nome)).size > 0, nome);
  const nomi = JSON.parse(readFileSync(path.join(cartella, "obj365.json"), "utf8"));
  assert.equal(nomi.length, 365);
  /* il lavoratore sta accanto ai vendor, e parla coi messaggi che la sezione manda */
  const lavoratore = readFileSync(
    path.resolve(cartella, "../../riconoscere-lavoratore.js"),
    "utf8",
  );
  for (const parola of [
    '"carica"',
    '"rileva"',
    '"chiudi"',
    '"pronto"',
    '"visti"',
    '"errore"',
    "wasmBinary",
  ])
    assert.ok(lavoratore.includes(parola), parola);
});
