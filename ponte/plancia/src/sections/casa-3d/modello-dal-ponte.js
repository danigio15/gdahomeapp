/* Il modello 3D della Casa 3D, fra la plancia e il ponte (#440).
 *
 * Sale a pezzi e riscende a pezzi: un messaggio sul filo dentro Home
 * Assistant non passa il megabyte, e un modello ne pesa decine. Il ponte
 * (`ponte/src/modelli-3d.js`) controlla il file intero prima di tenerlo, e lo
 * da' solo a chi e' di casa.
 *
 * Una volta arrivato, il modello si tiene nella cache del browser col suo
 * nome e la sua impronta: riaprire la casa non vuol dire riscaricare
 * cinquanta megabyte. Se la cache non c'e' (una pagina non sicura, un
 * WebView che non la da') si riscarica, e basta.
 */
import { chiediAHomeAssistant } from "../shared.js";

/* Quanto sale per volta: sotto il megabyte anche in base64, col resto del
 * messaggio intorno. Il ponte non ne accetta di piu'. */
export const PEZZO_IN_SALITA = 512 * 1024;
export const PEZZO_IN_DISCESA = 2 * 1024 * 1024;
const CASSETTO = "gdahome-casa3d-modelli";

function aBase64(byte) {
  let binario = "";
  for (let i = 0; i < byte.length; i += 0x8000)
    binario += String.fromCharCode.apply(null, byte.subarray(i, i + 0x8000));
  return btoa(binario);
}

function daBase64(testo) {
  const binario = atob(String(testo || ""));
  const out = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) out[i] = binario.charCodeAt(i);
  return out;
}

/** Un errore del ponte col suo motivo (`motivo`), per dirlo con parole giuste. */
function motivoDi(errore) {
  if (errore?.motivo) return errore.motivo;
  const codici = { storage_full: "pieno", rate_limited: "troppi", unauthorized: "permesso", unknown_command: "senza-ponte" };
  return codici[errore?.code] || (errore?.code === "invalid_upload" ? "sconosciuto" : "filo");
}

/**
 * Carica il modello al ponte. `quandoAvanza(fatti, tutti)` dice a che punto.
 * Torna `{ id, formato, peso, impronta }`; se il ponte dice di no solleva un
 * errore con `motivo`.
 */
export async function caricaIlModello(byte, { profilo, quandoAvanza = () => {}, chiedi = chiediAHomeAssistant } = {}) {
  try {
    const { caricamento } = await chiedi({ type: "ponte/casa3d/modello/inizia", peso: byte.length, profile: profilo }, 15000);
    let indice = 0;
    for (let da = 0; da < byte.length; da += PEZZO_IN_SALITA, indice++) {
      const pezzo = byte.subarray(da, Math.min(byte.length, da + PEZZO_IN_SALITA));
      await chiedi(
        { type: "ponte/casa3d/modello/pezzo", caricamento, indice, data: aBase64(pezzo), profile: profilo },
        30000,
      );
      quandoAvanza(Math.min(byte.length, da + pezzo.length), byte.length);
    }
    const fatto = await chiedi({ type: "ponte/casa3d/modello/fine", caricamento, profile: profilo }, 60000);
    try {
      await mettiNelCassetto(fatto, byte);
    } catch (_errore) {}
    return fatto;
  } catch (errore) {
    throw Object.assign(errore instanceof Error ? errore : new Error(String(errore)), { motivo: errore?.motivo || motivoDi(errore) });
  }
}

const chiaveDel = (m) => `/__gdahome_casa3d__/${m.id}-${m.impronta || "x"}`;

async function cassetto() {
  if (typeof caches === "undefined" || !caches?.open) return null;
  return caches.open(CASSETTO);
}

async function mettiNelCassetto(m, byte) {
  const c = await cassetto();
  if (!c || !m?.id) return;
  /* Uno solo per volta: il modello di prima, se c'era, se ne va. */
  for (const r of await c.keys()) if (!r.url.includes(`/${m.id}-`)) await c.delete(r);
  await c.put(new Request(chiaveDel(m)), new Response(byte, { headers: { "Content-Type": "application/octet-stream" } }));
}

/**
 * I byte del modello salvato: dal cassetto del browser se c'e', se no dal
 * ponte, a pezzi. `quandoAvanza(fatti, tutti)` come per il caricamento.
 */
export async function scaricaIlModello(m, { quandoAvanza = () => {}, chiedi = chiediAHomeAssistant } = {}) {
  try {
    const c = await cassetto();
    const r = c && (await c.match(new Request(chiaveDel(m))));
    if (r) return new Uint8Array(await r.arrayBuffer());
  } catch (_errore) {}
  let peso = Number(m.peso) || 0;
  let out = peso ? new Uint8Array(peso) : null;
  let da = 0;
  for (let giro = 0; giro < 1000; giro++) {
    const pezzo = await chiedi({ type: "ponte/casa3d/modello/leggi", modello: m.id, da, quanto: PEZZO_IN_DISCESA }, 30000);
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
  } catch (_errore) {}
  return out;
}

/** Toglie dal ponte un modello che nessuno usa piu'. */
export async function togliIlModello(id, { profilo, chiedi = chiediAHomeAssistant } = {}) {
  try {
    await chiedi({ type: "ponte/casa3d/modello/togli", modello: id, profile: profilo }, 15000);
  } catch (_errore) {}
  try {
    const c = await cassetto();
    if (c) for (const r of await c.keys()) if (r.url.includes(`/${id}-`)) await c.delete(r);
  } catch (_errore) {}
}
