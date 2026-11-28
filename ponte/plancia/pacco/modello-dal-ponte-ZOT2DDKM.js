import {
  chiediAHomeAssistant
} from "./chunk-Z33ELZ7A.js";

// src/sections/casa-3d/modello-dal-ponte.js
var PEZZO_IN_SALITA = 512 * 1024;
var PEZZO_IN_DISCESA = 2 * 1024 * 1024;
var CASSETTO = "gdahome-casa3d-modelli";
function aBase64(byte) {
  let binario = "";
  for (let i = 0; i < byte.length; i += 32768)
    binario += String.fromCharCode.apply(null, byte.subarray(i, i + 32768));
  return btoa(binario);
}
function daBase64(testo) {
  const binario = atob(String(testo || ""));
  const out = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) out[i] = binario.charCodeAt(i);
  return out;
}
function motivoDi(errore) {
  if (errore?.motivo) return errore.motivo;
  const codici = { storage_full: "pieno", rate_limited: "troppi", unauthorized: "permesso", unknown_command: "senza-ponte" };
  return codici[errore?.code] || (errore?.code === "invalid_upload" ? "sconosciuto" : "filo");
}
async function caricaIlModello(byte, { profilo, quandoAvanza = () => {
}, chiedi = chiediAHomeAssistant } = {}) {
  try {
    const { caricamento } = await chiedi({ type: "ponte/casa3d/modello/inizia", peso: byte.length, profile: profilo }, 15e3);
    let indice = 0;
    for (let da = 0; da < byte.length; da += PEZZO_IN_SALITA, indice++) {
      const pezzo = byte.subarray(da, Math.min(byte.length, da + PEZZO_IN_SALITA));
      await chiedi(
        { type: "ponte/casa3d/modello/pezzo", caricamento, indice, data: aBase64(pezzo), profile: profilo },
        3e4
      );
      quandoAvanza(Math.min(byte.length, da + pezzo.length), byte.length);
    }
    const fatto = await chiedi({ type: "ponte/casa3d/modello/fine", caricamento, profile: profilo }, 6e4);
    try {
      await mettiNelCassetto(fatto, byte);
    } catch (_errore) {
    }
    return fatto;
  } catch (errore) {
    throw Object.assign(errore instanceof Error ? errore : new Error(String(errore)), { motivo: errore?.motivo || motivoDi(errore) });
  }
}
var chiaveDel = (m) => `/__gdahome_casa3d__/${m.id}-${m.impronta || "x"}`;
async function cassetto() {
  if (typeof caches === "undefined" || !caches?.open) return null;
  return caches.open(CASSETTO);
}
async function mettiNelCassetto(m, byte) {
  const c = await cassetto();
  if (!c || !m?.id) return;
  for (const r of await c.keys()) if (!r.url.includes(`/${m.id}-`)) await c.delete(r);
  await c.put(new Request(chiaveDel(m)), new Response(byte, { headers: { "Content-Type": "application/octet-stream" } }));
}
async function scaricaIlModello(m, { quandoAvanza = () => {
}, chiedi = chiediAHomeAssistant } = {}) {
  try {
    const c = await cassetto();
    const r = c && await c.match(new Request(chiaveDel(m)));
    if (r) return new Uint8Array(await r.arrayBuffer());
  } catch (_errore) {
  }
  let peso = Number(m.peso) || 0;
  let out = peso ? new Uint8Array(peso) : null;
  let da = 0;
  for (let giro = 0; giro < 1e3; giro++) {
    const pezzo = await chiedi({ type: "ponte/casa3d/modello/leggi", modello: m.id, da, quanto: PEZZO_IN_DISCESA }, 3e4);
    if (!out || pezzo.peso !== peso) {
      peso = Number(pezzo.peso) || 0;
      const nuovo = new Uint8Array(peso);
      if (out) nuovo.set(out.subarray(0, Math.min(da, peso)));
      out = nuovo;
    }
    const byte = daBase64(pezzo.corpo);
    out.set(byte.subarray(0, Math.max(0, peso - da)), da);
    da += byte.length;
    quandoAvanza(da, peso);
    if (pezzo.fine || !byte.length) break;
  }
  try {
    await mettiNelCassetto(m, out);
  } catch (_errore) {
  }
  return out;
}
async function togliIlModello(id, { profilo, chiedi = chiediAHomeAssistant } = {}) {
  try {
    await chiedi({ type: "ponte/casa3d/modello/togli", modello: id, profile: profilo }, 15e3);
  } catch (_errore) {
  }
  try {
    const c = await cassetto();
    if (c) {
      for (const r of await c.keys()) if (r.url.includes(`/${id}-`)) await c.delete(r);
    }
  } catch (_errore) {
  }
}
export {
  PEZZO_IN_DISCESA,
  PEZZO_IN_SALITA,
  caricaIlModello,
  scaricaIlModello,
  togliIlModello
};
