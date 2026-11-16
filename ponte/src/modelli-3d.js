/* I modelli 3D della Casa 3D: quelli fatti con un altro programma (#440).
 *
 * «Possibilita' di caricare la pianta 3D fatta da un altro programma e
 * utilizzare quella grafica senza passare da quella della app.» Chi ha la
 * casa in SweetHome3D, SketchUp, Blender, Planner 5D o Polycam la esporta in
 * GLB (o glTF, o OBJ) e la carica dalla plancia. Il file sta qui, in
 * `/data/modelli3d`; nel config della plancia c'e' solo il suo nome.
 *
 * Le regole sono quelle delle foto (`foto.js`), piu' strette dove serve:
 *
 *  - **il contenuto, non il nome**: un GLB ha la sua firma nei primi byte, un
 *    glTF e' un JSON con la versione 2, un OBJ e' testo con le sue righe. Il
 *    resto — un archivio, una pagina, un eseguibile rinominato — e' un no;
 *  - **niente che vada a prendere qualcosa fuori**: un glTF che rimanda a un
 *    indirizzo (`https://…`) o a un file accanto (`texture.png`) si rifiuta.
 *    Dentro il pacchetto si', fuori no: la casa non chiede niente a nessuno;
 *  - **niente estensioni che vogliono un decodificatore** (Draco, Meshopt,
 *    KTX2): la plancia non le sa aprire, e un modello che non si apre e'
 *    meglio rifiutarlo subito che lasciare la casa nera;
 *  - **un tetto**: 50 MB per modello, 200 MB tutti insieme, otto al massimo.
 *    Stanno sullo stesso disco della configurazione;
 *  - **solo a chi e' di casa**: il file si legge e si scrive solo da un filo
 *    con un utente (`commissioni.js`), e scrive solo chi configura la plancia.
 *
 * Arriva a pezzi: un messaggio sul filo dentro Home Assistant non passa il
 * megabyte (`presa.js`), e un modello ne pesa decine. I pezzi vanno in un
 * file da parte, non in memoria; finito l'ultimo il file si controlla tutto,
 * e solo allora prende il suo nome. Un caricamento lasciato a meta' sparisce
 * da solo dopo dieci minuti.
 */

import { createHash, randomBytes } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

export const MODELLO_MASSIMO = 50 * 1024 * 1024;
export const TETTO_DEI_MODELLI = 200 * 1024 * 1024;
export const MODELLI_AL_MASSIMO = 8;
/** I pezzi in salita: stanno sotto il megabyte anche in base64. */
export const PEZZO_IN_SALITA = 512 * 1024;
/** I pezzi in discesa: la busta ne porta sedici, qui se ne mandano due. */
export const PEZZO_IN_DISCESA = 2 * 1024 * 1024;
const SCADE = 10 * 60 * 1000;
const IN_ARRIVO = ".in-arrivo-";
const NOME_BUONO = /^([a-f0-9]{16})\.(glb|gltf|obj)$/;

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
const DATI_BUONI = /^data:application\/(?:octet-stream|gltf-buffer);base64,/i;
const IMMAGINE_BUONA = /^data:image\/(?:png|jpeg|webp|avif);base64,/i;

/* Un no che dice perche': `codice` e' per la plancia, il messaggio per chi legge. */
export class ModelloRifiutato extends Error {
  constructor(codice, messaggio) {
    super(messaggio);
    this.name = "ModelloRifiutato";
    this.codice = codice;
  }
}

const MESSAGGI = Object.freeze({
  sconosciuto: "Il file non e' un modello 3D GLB, glTF o OBJ.",
  rotto: "Il modello 3D e' rovinato: non si legge.",
  versione: "Il modello glTF non e' della versione 2.",
  esterno:
    "Il modello rimanda a file fuori dal pacchetto: esportalo come GLB, con le trame dentro.",
  compresso: "Il modello e' compresso (Draco, Meshopt o KTX2): esportalo senza compressione.",
  estensione: "Il modello chiede un'estensione glTF che la plancia non sa leggere.",
  grande: "Il modello supera i 50 MB.",
  pieno: "Lo spazio per i modelli 3D e' pieno: togline uno prima di caricarne un altro.",
  scaduto: "Il caricamento del modello e' scaduto: ricomincia.",
  ordine: "Un pezzo del modello e' arrivato fuori ordine: ricomincia.",
  pezzo: "Un pezzo del modello non e' buono.",
});
const rifiuta = (codice) => new ModelloRifiutato(codice, MESSAGGI[codice] || codice);

/* Quello che un glTF chiede fuori di se'. */
function controllaIlGltf(json, glb) {
  if (!json || typeof json !== "object") throw rifiuta("rotto");
  if (!/^2(\.|$)/.test(String(json.asset?.version ?? ""))) throw rifiuta("versione");
  const buffers = Array.isArray(json.buffers) ? json.buffers : [];
  buffers.forEach((b, i) => {
    if (b?.uri === undefined && glb && i === 0) return;
    if (typeof b?.uri !== "string" || !DATI_BUONI.test(b.uri)) throw rifiuta("esterno");
  });
  for (const im of Array.isArray(json.images) ? json.images : []) {
    if (im?.uri === undefined && Number.isInteger(im?.bufferView)) continue;
    if (typeof im?.uri !== "string" || !IMMAGINE_BUONA.test(im.uri)) throw rifiuta("esterno");
  }
  const pretese = Array.isArray(json.extensionsRequired) ? json.extensionsRequired : [];
  for (const e of pretese) {
    if (["KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_texture_basisu"].includes(e))
      throw rifiuta("compresso");
    if (!ESTENSIONI_PERMESSE.includes(e)) throw rifiuta("estensione");
  }
}

/** Il formato del modello dal suo contenuto ("glb", "gltf", "obj"), o un
 * [ModelloRifiutato] che dice perche' no. */
export function formatoDelModello(byte) {
  if (!Buffer.isBuffer(byte) || byte.length < 4) throw rifiuta("sconosciuto");
  if (byte.subarray(0, 4).toString("latin1") === "glTF") {
    if (byte.length < 20 || byte.readUInt32LE(4) !== 2) throw rifiuta("versione");
    if (byte.readUInt32LE(8) !== byte.length) throw rifiuta("rotto");
    const lunghezza = byte.readUInt32LE(12);
    if (byte.readUInt32LE(16) !== 0x4e4f534a || 20 + lunghezza > byte.length)
      throw rifiuta("rotto");
    let json;
    try {
      json = JSON.parse(byte.subarray(20, 20 + lunghezza).toString("utf8"));
    } catch (_errore) {
      throw rifiuta("rotto");
    }
    controllaIlGltf(json, true);
    return "glb";
  }
  /* Da qui e' testo, o non e' niente: un byte zero lo tradisce. */
  if (byte.includes(0)) throw rifiuta("sconosciuto");
  const testo = byte.toString("utf8").replace(/^﻿/, "");
  const testa = testo.slice(0, 65536).trimStart();
  if (testa.startsWith("{")) {
    let json;
    try {
      json = JSON.parse(testo);
    } catch (_errore) {
      throw rifiuta("rotto");
    }
    controllaIlGltf(json, false);
    return "gltf";
  }
  const righe = testa.split(/\r?\n/, 400).filter((r) => r.trim());
  const sue = righe.filter((r) =>
    /^\s*(?:#|v|vn|vt|vp|f|l|p|o|g|s|usemtl|mtllib)(?:\s|$)/.test(r),
  ).length;
  const conVertici = /^\s*v\s/m.test(testa);
  const conFacce = /^\s*f\s/m.test(testo);
  if (righe.length && sue >= righe.length * 0.8 && conVertici && conFacce) return "obj";
  throw rifiuta("sconosciuto");
}

function quantoPesa(cartella) {
  let totale = 0;
  try {
    for (const nome of readdirSync(cartella)) {
      try {
        const dati = statSync(join(cartella, nome));
        if (dati.isFile()) totale += dati.size;
      } catch (_errore) {
        /* sparito nel frattempo */
      }
    }
  } catch (_errore) {
    return 0;
  }
  return totale;
}

export class Modelli3D {
  constructor({
    cartella,
    tetto = TETTO_DEI_MODELLI,
    massimo = MODELLO_MASSIMO,
    quanti = MODELLI_AL_MASSIMO,
    adesso = () => Date.now(),
  } = {}) {
    this.cartella = cartella ? resolve(cartella) : "";
    this.tetto = tetto;
    this.massimo = massimo;
    this.quanti = quanti;
    this.adesso = adesso;
    /* I caricamenti a meta': segno → { chi, nome, peso, ricevuti, indice, scade, file }. */
    this._inArrivo = new Map();
    /* Quelli di una vita fa (un riavvio a meta' caricamento) non servono piu'. */
    try {
      for (const nome of readdirSync(this.cartella))
        if (nome.startsWith(IN_ARRIVO)) rmSync(join(this.cartella, nome), { force: true });
    } catch (_errore) {
      /* la cartella non c'e' ancora: nasce col primo modello */
    }
  }

  get cE() {
    return Boolean(this.cartella);
  }

  _pulisci() {
    const ora = this.adesso();
    for (const [segno, c] of this._inArrivo) {
      if (c.scade > ora) continue;
      rmSync(c.file, { force: true });
      this._inArrivo.delete(segno);
    }
  }

  /* I modelli che ci sono, coi loro nomi buoni. */
  _modelli() {
    try {
      return readdirSync(this.cartella).filter((n) => NOME_BUONO.test(n));
    } catch (_errore) {
      return [];
    }
  }

  /** Comincia un caricamento: torna il segno da ripetere con ogni pezzo. */
  inizia({ chi = "", peso } = {}) {
    if (!this.cartella) throw rifiuta("pieno");
    this._pulisci();
    const n = Number(peso);
    if (!Number.isInteger(n) || n < 4) throw rifiuta("sconosciuto");
    if (n > this.massimo) throw rifiuta("grande");
    /* Uno alla volta per persona: un secondo cancella il primo. */
    for (const [segno, c] of this._inArrivo)
      if (c.chi === chi) {
        rmSync(c.file, { force: true });
        this._inArrivo.delete(segno);
      }
    let inCorso = 0;
    for (const c of this._inArrivo.values()) inCorso += c.peso;
    if (
      this._modelli().length >= this.quanti ||
      quantoPesa(this.cartella) + inCorso + n > this.tetto
    )
      throw rifiuta("pieno");
    mkdirSync(this.cartella, { recursive: true });
    const segno = randomBytes(12).toString("hex");
    const file = join(this.cartella, `${IN_ARRIVO}${segno}`);
    writeFileSync(file, Buffer.alloc(0), { flag: "wx" });
    this._inArrivo.set(segno, {
      chi,
      peso: n,
      ricevuti: 0,
      indice: 0,
      scade: this.adesso() + SCADE,
      file,
    });
    return { caricamento: segno, pezzo: PEZZO_IN_SALITA };
  }

  /** Un pezzo, in ordine. Torna quanto e' arrivato finora. */
  pezzo({ chi = "", caricamento, indice, byte } = {}) {
    this._pulisci();
    const c = this._inArrivo.get(String(caricamento || ""));
    if (!c || c.chi !== chi) throw rifiuta("scaduto");
    if (Number(indice) !== c.indice) throw rifiuta("ordine");
    if (!Buffer.isBuffer(byte) || !byte.length || byte.length > PEZZO_IN_SALITA)
      throw rifiuta("pezzo");
    if (c.ricevuti + byte.length > c.peso) throw rifiuta("grande");
    appendFileSync(c.file, byte);
    c.ricevuti += byte.length;
    c.indice += 1;
    c.scade = this.adesso() + SCADE;
    return { ricevuti: c.ricevuti, peso: c.peso };
  }

  /** L'ultimo passo: il file intero si controlla e prende il suo nome. */
  finisci({ chi = "", caricamento } = {}) {
    this._pulisci();
    const segno = String(caricamento || "");
    const c = this._inArrivo.get(segno);
    if (!c || c.chi !== chi) throw rifiuta("scaduto");
    this._inArrivo.delete(segno);
    try {
      if (c.ricevuti !== c.peso) throw rifiuta("rotto");
      const byte = readFileSync(c.file);
      const formato = formatoDelModello(byte);
      const id = randomBytes(8).toString("hex");
      const impronta = createHash("sha256").update(byte).digest("hex").slice(0, 32);
      renameSync(c.file, join(this.cartella, `${id}.${formato}`));
      return { id, formato, peso: byte.length, impronta };
    } finally {
      rmSync(c.file, { force: true });
    }
  }

  _dove(id) {
    const chiave = String(id || "");
    if (!/^[a-f0-9]{16}$/.test(chiave)) return null;
    const nome = this._modelli().find((n) => n.startsWith(`${chiave}.`));
    return nome
      ? { nome, file: join(this.cartella, nome), formato: NOME_BUONO.exec(nome)[2] }
      : null;
  }

  /** Un pezzo del modello, per chi lo apre. `null` se non c'e'. */
  leggi(id, da = 0, quanto = PEZZO_IN_DISCESA) {
    const dove = this._dove(id);
    if (!dove) return null;
    /* Solo il pezzo chiesto: leggere cinquanta megabyte per mandarne due,
     * venticinque volte di fila, sarebbe il filo di tutta la casa. */
    const peso = statSync(dove.file).size;
    const inizio = Math.max(0, Math.min(peso, Math.floor(Number(da) || 0)));
    const lungo = Math.max(1, Math.min(PEZZO_IN_DISCESA, Math.floor(Number(quanto) || 0)));
    const byte = Buffer.alloc(Math.max(0, Math.min(lungo, peso - inizio)));
    const fd = openSync(dove.file, "r");
    try {
      if (byte.length) readSync(fd, byte, 0, byte.length, inizio);
    } finally {
      closeSync(fd);
    }
    return { formato: dove.formato, peso, da: inizio, byte, fine: inizio + byte.length >= peso };
  }

  /** Toglie un modello. Vero se c'era. */
  togli(id) {
    const dove = this._dove(id);
    if (!dove) return false;
    rmSync(dove.file, { force: true });
    return !existsSync(dove.file);
  }

  elenco() {
    return this._modelli().map((nome) => {
      const [, id, formato] = NOME_BUONO.exec(nome);
      let peso = 0;
      try {
        peso = statSync(join(this.cartella, nome)).size;
      } catch (_errore) {}
      return { id, formato, peso };
    });
  }
}
