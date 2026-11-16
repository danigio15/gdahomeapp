/* La Casa 3D col modello di chi abita (#440): i controlli e i conti.
 *
 * Dal campo: «possibilita' di caricare la pianta 3D fatta da un altro
 * programma e utilizzare quella grafica senza passare da quella della app».
 * Chi ha gia' la casa in SweetHome3D, SketchUp, Blender, Planner 5D, Polycam
 * la esporta in GLB (o glTF, o OBJ) e la carica qui.
 *
 * Il modulo e' puro: non disegna e non chiama niente. Dice
 *   · che cosa e' un file, dal contenuto e non dal nome: un `.glb` che
 *     dentro e' una pagina web resta una pagina web;
 *   · se si puo' aprire senza andare a prendere niente fuori: un glTF che
 *     rimanda a `https://…` o a `texture.png` accanto si rifiuta, perche' la
 *     casa non chiede niente a nessuno e un file a pezzi qui non arriva;
 *   · se chiede estensioni che la plancia non sa leggere (Draco, Meshopt,
 *     KTX2): meglio dirlo prima che lasciare una casa nera;
 *   · quanti triangoli e immagini porta, per avvisare un tablet lento;
 *   · come si raddrizza: unita', asse in alto, verso, scala.
 *
 * Il ponte rifa' gli stessi controlli per conto suo (`ponte/src/modelli-3d.js`):
 * la pagina e' di chi la usa, il disco e' della casa.
 */
import { UNITA_DEL_MODELLO } from "./casa-3d.js";

export { UNITA_DEL_MODELLO };

/** Il file piu' grande che si carica: una casa intera con le sue trame ci sta. */
export const MODELLO_MASSIMO = 50 * 1024 * 1024;
/** Oltre questi triangoli si avvisa; oltre i massimi non si carica. */
export const TRIANGOLI_DA_AVVISO = 500_000;
export const TRIANGOLI_MASSIMI = 4_000_000;
/** Su un dispositivo piccolo, oltre questi si torna alla casa generata. */
export const TRIANGOLI_PER_I_PICCOLI = 1_000_000;
/** Un'immagine piu' larga di cosi' pesa sulla memoria di un tablet. */
export const LATO_DA_AVVISO = 4096;
export const IMMAGINI_DA_AVVISO = 48;

/* Le estensioni che, se un file le pretende, la plancia sa leggere senza
 * nient'altro che three: materiali, trame trasformate, maglie quantizzate,
 * webp/avif (li apre il browser), le luci (che pero' si spengono: la luce
 * della casa e' quella delle lampade vere). */
export const ESTENSIONI_PERMESSE = Object.freeze([
  "KHR_materials_clearcoat",
  "KHR_materials_dispersion",
  "KHR_materials_ior",
  "KHR_materials_sheen",
  "KHR_materials_specular",
  "KHR_materials_transmission",
  "KHR_materials_iridescence",
  "KHR_materials_anisotropy",
  "KHR_materials_unlit",
  "KHR_materials_volume",
  "KHR_materials_emissive_strength",
  "KHR_texture_transform",
  "KHR_mesh_quantization",
  "KHR_lights_punctual",
  "EXT_materials_bump",
  "EXT_texture_webp",
  "EXT_texture_avif",
  "EXT_mesh_gpu_instancing",
]);
/* Quelle compresse: vogliono un decodificatore (WebAssembly) che qui non c'e'. */
export const ESTENSIONI_COMPRESSE = Object.freeze([
  "KHR_draco_mesh_compression",
  "EXT_meshopt_compression",
  "KHR_texture_basisu",
]);

const DATI_BUONI = /^data:application\/(?:octet-stream|gltf-buffer);base64,/i;
const IMMAGINE_BUONA = /^data:image\/(?:png|jpeg|webp|avif);base64,/i;

const testoDi = (byte, da = 0, a = byte.length) => {
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(byte.subarray(da, a));
  } catch (_errore) {
    return "";
  }
};
const parola = (byte, i) =>
  (byte[i] | (byte[i + 1] << 8) | (byte[i + 2] << 16) | (byte[i + 3] << 24)) >>> 0;

/** I byte di qualunque cosa: Uint8Array, ArrayBuffer, Buffer. */
export function aByte(dati) {
  if (dati instanceof Uint8Array) return dati;
  if (dati instanceof ArrayBuffer) return new Uint8Array(dati);
  if (ArrayBuffer.isView(dati))
    return new Uint8Array(dati.buffer, dati.byteOffset, dati.byteLength);
  return new Uint8Array(0);
}

/* Il JSON di un GLB: intestazione, lunghezza vera, primo pezzo JSON. */
function jsonDelGlb(byte) {
  if (byte.length < 20) return { errore: "rotto" };
  if (parola(byte, 4) !== 2) return { errore: "versione" };
  if (parola(byte, 8) !== byte.length) return { errore: "rotto" };
  const lunghezza = parola(byte, 12);
  if (parola(byte, 16) !== 0x4e4f534a || 20 + lunghezza > byte.length) return { errore: "rotto" };
  try {
    return { json: JSON.parse(testoDi(byte, 20, 20 + lunghezza)) };
  } catch (_errore) {
    return { errore: "rotto" };
  }
}

/** Il formato, dal contenuto: "glb", "gltf", "obj" o "" (non e' un modello). */
export function formatoDelFile(dati) {
  const byte = aByte(dati);
  if (byte.length < 4) return "";
  if (byte[0] === 0x67 && byte[1] === 0x6c && byte[2] === 0x54 && byte[3] === 0x46) return "glb";
  /* Testo: niente byte zero (un binario rinominato ne ha a manciate). */
  const inizio = byte.subarray(0, Math.min(byte.length, 65536));
  if (inizio.includes(0)) return "";
  const testa = testoDi(inizio).replace(/^﻿/, "").trimStart();
  if (testa.startsWith("{")) return "gltf";
  if (testa.startsWith("<")) return "";
  /* OBJ: righe che cominciano con le parole del formato, e almeno un vertice. */
  const righe = testa.split(/\r?\n/, 400).filter((r) => r.trim());
  const sue = righe.filter((r) => /^\s*(?:#|v|vn|vt|vp|f|l|p|o|g|s|usemtl|mtllib)(?:\s|$)/.test(r));
  if (sue.length >= Math.max(1, righe.length * 0.8) && righe.some((r) => /^\s*v\s/.test(r)))
    return "obj";
  return "";
}

/** Quello che un glTF chiede fuori di se', e le estensioni che pretende. */
export function controllaIlGltf(json, { glb = false } = {}) {
  if (!json || typeof json !== "object") return { errore: "rotto" };
  if (!/^2(\.|$)/.test(String(json.asset?.version ?? ""))) return { errore: "versione" };
  for (const [i, b] of (Array.isArray(json.buffers) ? json.buffers : []).entries()) {
    if (b?.uri === undefined) {
      if (glb && i === 0) continue;
      return { errore: "rotto" };
    }
    if (typeof b.uri !== "string" || !DATI_BUONI.test(b.uri)) return { errore: "esterno" };
  }
  for (const im of Array.isArray(json.images) ? json.images : []) {
    if (im?.uri === undefined && Number.isInteger(im?.bufferView)) continue;
    if (typeof im?.uri !== "string" || !IMMAGINE_BUONA.test(im.uri)) return { errore: "esterno" };
  }
  const pretese = Array.isArray(json.extensionsRequired) ? json.extensionsRequired : [];
  if (pretese.some((e) => ESTENSIONI_COMPRESSE.includes(e))) return { errore: "compresso" };
  if (pretese.some((e) => !ESTENSIONI_PERMESSE.includes(e))) return { errore: "estensione" };
  return { errore: "" };
}

/* ── i conti di un glTF, senza three ───────────────────────────────────── */

const IDENTITA = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** a·b, matrici 4×4 per colonne (come glTF e three). */
export function moltiplica(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}

function matriceDelNodo(n) {
  if (Array.isArray(n?.matrix) && n.matrix.length === 16) return n.matrix.map(Number);
  const [tx, ty, tz] = Array.isArray(n?.translation) ? n.translation.map(Number) : [0, 0, 0];
  const [qx, qy, qz, qw] = Array.isArray(n?.rotation) ? n.rotation.map(Number) : [0, 0, 0, 1];
  const [sx, sy, sz] = Array.isArray(n?.scale) ? n.scale.map(Number) : [1, 1, 1];
  const xx = qx * qx,
    yy = qy * qy,
    zz = qz * qz;
  const xy = qx * qy,
    xz = qx * qz,
    yz = qy * qz,
    wx = qw * qx,
    wy = qw * qy,
    wz = qw * qz;
  return [
    (1 - 2 * (yy + zz)) * sx,
    2 * (xy + wz) * sx,
    2 * (xz - wy) * sx,
    0,
    2 * (xy - wz) * sy,
    (1 - 2 * (xx + zz)) * sy,
    2 * (yz + wx) * sy,
    0,
    2 * (xz + wy) * sz,
    2 * (yz - wx) * sz,
    (1 - 2 * (xx + yy)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ];
}

/** Un punto per una matrice. */
export function applica(m, [x, y, z]) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

const VUOTI = () => ({
  min: [Infinity, Infinity, Infinity],
  max: [-Infinity, -Infinity, -Infinity],
});
function allarga(c, p) {
  for (let i = 0; i < 3; i++) {
    if (p[i] < c.min[i]) c.min[i] = p[i];
    if (p[i] > c.max[i]) c.max[i] = p[i];
  }
}
const angoli = ({ min, max }) => {
  const out = [];
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) out.push([x, y, z]);
  return out;
};

/** Triangoli, immagini e ingombro di un glTF, dalla sua descrizione. */
export function contiDelGltf(json) {
  const accessori = Array.isArray(json?.accessors) ? json.accessors : [];
  const maglie = Array.isArray(json?.meshes) ? json.meshes : [];
  const nodi = Array.isArray(json?.nodes) ? json.nodes : [];
  const quanti = (i) => Math.max(0, Number(accessori[i]?.count) || 0);
  const triangoliDellaMaglia = maglie.map((m) =>
    (Array.isArray(m?.primitives) ? m.primitives : []).reduce((tot, p) => {
      const modo = p?.mode ?? 4;
      const n = Number.isInteger(p?.indices) ? quanti(p.indices) : quanti(p?.attributes?.POSITION);
      if (modo === 4) return tot + Math.floor(n / 3);
      if (modo === 5 || modo === 6) return tot + Math.max(0, n - 2);
      return tot;
    }, 0),
  );
  let triangoli = 0;
  const confini = VUOTI();
  const visti = new Set();
  const visita = (i, padre) => {
    const n = nodi[i];
    if (!n || visti.has(i) || visti.size > 100_000) return;
    visti.add(i);
    const m = moltiplica(padre, matriceDelNodo(n));
    if (Number.isInteger(n.mesh) && maglie[n.mesh]) {
      triangoli += triangoliDellaMaglia[n.mesh] || 0;
      for (const p of maglie[n.mesh].primitives || []) {
        const a = accessori[p?.attributes?.POSITION];
        if (Array.isArray(a?.min) && Array.isArray(a?.max))
          for (const q of angoli({ min: a.min.map(Number), max: a.max.map(Number) }))
            allarga(confini, applica(m, q));
      }
    }
    for (const f of Array.isArray(n.children) ? n.children : []) visita(f, m);
  };
  const scene = Array.isArray(json?.scenes) ? json.scenes : [];
  const scena = scene[Number.isInteger(json?.scene) ? json.scene : 0];
  const radici = Array.isArray(scena?.nodes) ? scena.nodes : nodi.map((_n, i) => i);
  for (const r of radici) visita(r, IDENTITA());
  const immagini = Array.isArray(json?.images) ? json.images.length : 0;
  return {
    triangoli,
    immagini,
    confini: Number.isFinite(confini.min[0]) ? confini : null,
  };
}

/** Triangoli e ingombro di un OBJ, dal testo. */
export function contiDellObj(testo) {
  let triangoli = 0;
  const confini = VUOTI();
  for (const riga of String(testo || "").split(/\r?\n/)) {
    if (riga.startsWith("v ")) {
      const p = riga.slice(2).trim().split(/\s+/).slice(0, 3).map(Number);
      if (p.length === 3 && p.every(Number.isFinite)) allarga(confini, p);
    } else if (riga.startsWith("f ")) {
      triangoli += Math.max(0, riga.slice(2).trim().split(/\s+/).length - 2);
    }
  }
  return { triangoli, immagini: 0, confini: Number.isFinite(confini.min[0]) ? confini : null };
}

/**
 * Il controllo intero di un file: cos'e', se si puo' aprire, quanto pesa.
 *
 * Torna `{ ok, formato, errore, avvisi, triangoli, immagini, confini }`.
 * `errore` e' una parola sola: "grande", "vuoto", "sconosciuto", "rotto",
 * "versione", "esterno", "compresso", "estensione", "pesante", "senza-facce".
 */
export function controllaIlModello(dati, { massimo = MODELLO_MASSIMO } = {}) {
  const byte = aByte(dati);
  const no = (errore, formato = "") => ({
    ok: false,
    formato,
    errore,
    avvisi: [],
    triangoli: 0,
    immagini: 0,
    confini: null,
  });
  if (!byte.length) return no("vuoto");
  if (byte.length > massimo) return no("grande");
  const formato = formatoDelFile(byte);
  if (!formato) return no("sconosciuto");
  let conti;
  if (formato === "obj") {
    conti = contiDellObj(testoDi(byte));
    if (!conti.triangoli) return no("senza-facce", formato);
  } else {
    let json;
    if (formato === "glb") {
      const letto = jsonDelGlb(byte);
      if (letto.errore) return no(letto.errore, formato);
      json = letto.json;
    } else {
      try {
        json = JSON.parse(testoDi(byte).replace(/^﻿/, ""));
      } catch (_errore) {
        return no("rotto", formato);
      }
    }
    const { errore } = controllaIlGltf(json, { glb: formato === "glb" });
    if (errore) return no(errore, formato);
    conti = contiDelGltf(json);
    if (!conti.triangoli) return no("senza-facce", formato);
  }
  if (conti.triangoli > TRIANGOLI_MASSIMI) return no("pesante", formato);
  const avvisi = [];
  if (conti.triangoli > TRIANGOLI_DA_AVVISO) avvisi.push("triangoli");
  if (conti.immagini > IMMAGINI_DA_AVVISO) avvisi.push("immagini");
  return { ok: true, formato, errore: "", avvisi, ...conti };
}

/* ── raddrizzare: unita', asse in alto, verso ──────────────────────────── */

/** Le unita' piu' probabili dalla misura piu' lunga del file: una casa sta
 * fra un paio di metri e un paio di centinaia. */
export function unitaProbabili(lato) {
  const d = Math.abs(Number(lato) || 0);
  if (d > 20_000) return "mm";
  if (d > 250) return "cm";
  return "m";
}

/** La matrice che porta il file nel mondo della casa (metri, Y in alto):
 * prima l'asse (Z in alto → Y in alto), poi la scala, poi il verso. */
export function matriceDelModello({ unita = "m", su = "y", rot = 0, scala = 1 } = {}) {
  const f = (UNITA_DEL_MODELLO[unita] ?? 1) * (Number(scala) > 0 ? Number(scala) : 1);
  const a = (Number(rot) * Math.PI) / 180;
  const c = Math.cos(a),
    s = Math.sin(a);
  const giro = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
  const misura = [f, 0, 0, 0, 0, f, 0, 0, 0, 0, f, 0, 0, 0, 0, 1];
  /* Z in alto: x resta, z diventa y, y diventa -z (rotazione di -90° su X). */
  const asse = su === "z" ? [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1] : IDENTITA();
  return moltiplica(giro, moltiplica(misura, asse));
}

/** Dove va il modello: la matrice, piu' lo spostamento che lo mette in
 * mezzo al prato e coi piedi a terra. `confini` sono quelli del file. */
export function posaDelModello(confini, impostazioni = {}) {
  const m = matriceDelModello(impostazioni);
  if (!confini) return { matrice: m, misure: [0, 0, 0], confini: null };
  const c = VUOTI();
  for (const q of angoli(confini)) allarga(c, applica(m, q));
  const dx = -(c.min[0] + c.max[0]) / 2,
    dy = -c.min[1],
    dz = -(c.min[2] + c.max[2]) / 2;
  m[12] += dx;
  m[13] += dy;
  m[14] += dz;
  const misure = [c.max[0] - c.min[0], c.max[1] - c.min[1], c.max[2] - c.min[2]];
  return {
    matrice: m,
    misure,
    confini: {
      min: [c.min[0] + dx, 0, c.min[2] + dz],
      max: [c.max[0] + dx, misure[1], c.max[2] + dz],
    },
  };
}

/** Il contrario di una matrice di posa (giro, scala uguale, spostamento):
 * da un punto toccato nel mondo al punto del file. */
export function inversa(m) {
  const [a, b, c, , d, e, f, , g, h, i] = m;
  const det = a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e);
  if (!det) return IDENTITA();
  const r = [
    (e * i - f * h) / det,
    (c * h - b * i) / det,
    (b * f - c * e) / det,
    0,
    (f * g - d * i) / det,
    (a * i - c * g) / det,
    (c * d - a * f) / det,
    0,
    (d * h - e * g) / det,
    (b * g - a * h) / det,
    (a * e - b * d) / det,
    0,
    0,
    0,
    0,
    1,
  ];
  const t = applica(r, [m[12], m[13], m[14]]);
  r[12] = -t[0];
  r[13] = -t[1];
  r[14] = -t[2];
  return r;
}

/** Un dispositivo messo dove si e' toccato il modello (punto nel mondo). */
export function puntoDelFile(matrice, punto) {
  const [x, y, z] = applica(inversa(matrice), punto);
  const tondo = (v) => Math.round(v * 1e4) / 1e4;
  return { x: tondo(x), y: tondo(y), z: tondo(z) };
}

/** Il punto del mondo di un dispositivo messo sul modello. */
export const puntoNelMondo = (matrice, d) => applica(matrice, [d.x, d.y, d.z]);

/** Se questo dispositivo e' piccolo per un modello cosi' (memoria, processori). */
export function eUnDispositivoPiccolo(nav = globalThis.navigator) {
  const memoria = Number(nav?.deviceMemory);
  const nuclei = Number(nav?.hardwareConcurrency);
  return (Number.isFinite(memoria) && memoria <= 2) || (Number.isFinite(nuclei) && nuclei <= 2);
}

/** Se il modello va lasciato perdere su questo dispositivo. */
export const troppoPerQuestoDispositivo = (modello, nav) =>
  Number(modello?.triangoli) > TRIANGOLI_PER_I_PICCOLI && eUnDispositivoPiccolo(nav);
