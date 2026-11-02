/* Il riconoscitore degli arredi, in un lavoratore a parte.
 *
 * ONNX Runtime con D-FINE (vedi `vendor/riconoscere/LEGGIMI.txt`) gira qui
 * dentro, e non nella pagina: un riconoscimento sul telefono dura secondi, e
 * fatto nella pagina teneva ferma la procedura — niente clessidra che gira,
 * niente tocchi, e il WebView che a un certo punto si arrende. La pagina
 * prepara la foto (640×640, un numero per pixel e per colore) e la manda qui;
 * qui si gira il modello e tornano etichette, riquadri e punteggi.
 *
 * I file arrivano gia' letti dalla pagina (`carica`): il WebAssembly si da' a
 * ONNX Runtime gia' in mano (`wasmBinary`), perche' nell'app il `.wasm` chiesto
 * da lui stesso arrivava col tipo sbagliato e si chiedeva due volte — la
 * stessa cosa successa col motore dei DWG. Il codice di ONNX Runtime e la
 * colla col suo WebAssembly si prendono dal loro indirizzo.
 *
 * Messaggi dalla pagina:  {tipo:"carica", id, ort, colla, wasm, motore, pesi}
 *                         {tipo:"rileva", id, dati, lato, w, h}
 *                         {tipo:"chiudi"}
 * Risposte:               {tipo:"pronto", id}
 *                         {tipo:"visti", id, etichette, riquadri, punti}
 *                         {tipo:"errore", id, perche}
 *
 * Niente DOM qui dentro, e niente moduli: e' un lavoratore classico, che
 * prende ONNX Runtime con `importScripts` (la sua copia a oggetto globale). */

"use strict";

/* ONNX Runtime, una volta preso: non si chiama `ort` perche' e' il nome con
 * cui lo script di ONNX Runtime si mette a oggetto globale (`var ort`), e un
 * secondo `ort` qui era «Identifier 'ort' has already been declared». */
let runtime = null;
let sessione = null;

function rispondi(messaggio) {
  self.postMessage(messaggio);
}

function perche(errore) {
  return String((errore && errore.message) || errore || "").slice(0, 200);
}

async function carica(m) {
  if (!self.ort) self.importScripts(m.ort);
  runtime = self.ort;
  if (!runtime || !runtime.InferenceSession) throw new Error("ONNX Runtime non è arrivato");
  /* un filo solo: i fili in parallelo vogliono una pagina «isolata», che
   * dentro Home Assistant e nell'app non c'e' */
  runtime.env.wasm.numThreads = 1;
  runtime.env.wasm.wasmPaths = { mjs: m.colla, wasm: m.wasm };
  runtime.env.wasm.wasmBinary = m.motore;
  sessione = await runtime.InferenceSession.create(new Uint8Array(m.pesi), {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
}

async function rileva(m) {
  if (!sessione) throw new Error("il riconoscitore non è pronto");
  const out = await sessione.run({
    images: new runtime.Tensor("float32", m.dati, [1, 3, m.lato, m.lato]),
    orig_target_sizes: new runtime.Tensor(
      "int64",
      BigInt64Array.from([BigInt(m.w), BigInt(m.h)]),
      [1, 2],
    ),
  });
  return {
    etichette: Array.from(out.labels.data, Number),
    riquadri: Float32Array.from(out.boxes.data),
    punti: Float32Array.from(out.scores.data),
  };
}

async function gestisci(m) {
  try {
    if (m.tipo === "carica") {
      await carica(m);
      rispondi({ tipo: "pronto", id: m.id });
    } else if (m.tipo === "rileva") {
      rispondi({ tipo: "visti", id: m.id, ...(await rileva(m)) });
    } else if (m.tipo === "chiudi") {
      try {
        if (sessione) await sessione.release();
      } catch (_errore) {}
      sessione = null;
      self.close();
    }
  } catch (errore) {
    rispondi({ tipo: "errore", id: m.id, perche: perche(errore) });
  }
}

/* Una cosa alla volta: due foto insieme (la pagina le manda appena
 * arrivano) non si guardano nello stesso momento, la sessione e' una. */
let coda = Promise.resolve();
self.onmessage = (evento) => {
  const m = (evento && evento.data) || {};
  coda = coda.then(() => gestisci(m));
};
