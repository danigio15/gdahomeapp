/* «Casa 3D»: la plancia con la casa vera, in tre dimensioni.
 *
 * Dal campo: «una plancia indipendente dalla principale, con la planimetria
 * della casa in 3D», poi «arredamenti, punti luce, telecamere, tapparelle,
 * finestre che si aprono sulla base dei sensori», poi «scegliere se e' una
 * villa o un palazzo», e infine «se dalle foto riconosci oggetti come punti
 * luce, telecamere, finestre, poi devi dare la possibilita' di associare le
 * entita' di riferimento, o a mano libera aggiungerle».
 *
 * Il modulo e' puro: dice com'e' fatta la casa salvata nel config, la pulisce,
 * comprime e riapre la pianta, propone le entita' giuste per ogni dispositivo
 * e dice cosa fa un tocco. Non disegna e non chiama niente.
 *
 * Le foto non entrano mai qui: dal telefono escono solo le cose che se ne
 * ricavano (dove sono i muri, che arredi, che colori). Le foto restano dove
 * sono state scattate.
 */

import { entita } from "./colpo-d-occhio.js";

export { entita };

export const CHIAVE_CASA3D = "cd_casa3d";
export const VERSIONE_CASA3D = 1;
export const PIANI_AL_MASSIMO = 12;
export const STANZE_AL_MASSIMO = 60;
export const ARREDI_AL_MASSIMO = 600;
export const DISPOSITIVI_AL_MASSIMO = 400;
export const APERTURE_AL_MASSIMO = 300;
/* La pianta salvata: una griglia a passo fisso, compressa. A 5 cm un muro
 * interno da 10 cm resta di due celle, e una casa da 15×20 m sta in poche
 * decine di kilobyte. */
export const PASSO_SALVATO = 0.05;
export const CELLE_AL_MASSIMO = 1200 * 1200;

/* I valori della griglia: le stanze sono 1..n, il resto e' negativo. */
export const CELLA = Object.freeze({ fuori: -2, muro: -3, davanzale: -4, porta: -5 });

/* I dispositivi che si mettono nella casa e a cosa si collegano. `domini`
 * e `classi` dicono quali entita' proporre; `tocco` dice cosa fa toccarlo. */
export const DISPOSITIVI_3D = Object.freeze({
  luce: {
    icona: "💡",
    nome: ["Punto luce", "Light"],
    domini: ["light", "switch"],
    classi: [],
    parole: ["luce", "lamp", "light", "faretti", "plafon"],
    mont: "soffitto",
    tocco: "accendi",
  },
  telecamera: {
    icona: "📷",
    nome: ["Telecamera", "Camera"],
    domini: ["camera"],
    classi: [],
    parole: ["cam", "telecamera"],
    mont: "angolo",
    tocco: "guarda",
  },
  tapparella: {
    icona: "🪟",
    nome: ["Tapparella", "Shutter"],
    domini: ["cover"],
    classi: ["shutter", "blind", "window", "curtain", "awning", "shade"],
    parole: ["tapparella", "persiana", "tenda", "shutter"],
    mont: "finestra",
    tocco: "apri",
  },
  finestra: {
    icona: "🪟",
    nome: ["Sensore finestra", "Window sensor"],
    domini: ["binary_sensor"],
    classi: ["window", "opening"],
    parole: ["finestra", "window"],
    mont: "finestra",
    tocco: null,
  },
  porta: {
    icona: "🚪",
    nome: ["Sensore porta", "Door sensor"],
    domini: ["binary_sensor", "lock"],
    classi: ["door", "garage_door", "opening"],
    parole: ["porta", "door", "ingresso", "portone"],
    mont: "porta",
    tocco: null,
  },
  movimento: {
    icona: "🚶",
    nome: ["Sensore movimento", "Motion sensor"],
    domini: ["binary_sensor"],
    classi: ["motion", "occupancy"],
    parole: ["movimento", "motion", "pir"],
    mont: "angolo",
    tocco: null,
  },
  presenza: {
    icona: "📡",
    nome: ["Sensore presenza", "Presence sensor"],
    domini: ["binary_sensor"],
    classi: ["occupancy", "presence"],
    parole: ["presenza", "presence", "mmwave", "occupancy"],
    mont: "soffitto",
    tocco: null,
  },
  termometro: {
    icona: "🌡️",
    nome: ["Termometro", "Thermometer"],
    domini: ["sensor"],
    classi: ["temperature"],
    parole: ["temperatura", "temperature"],
    mont: "muro",
    tocco: null,
  },
  clima: {
    icona: "❄️",
    nome: ["Climatizzatore", "Air conditioner"],
    domini: ["climate"],
    classi: [],
    parole: ["clima", "condizionatore", "split", "ac"],
    mont: "muro",
    tocco: "accendi",
  },
  termostato: {
    icona: "🔥",
    nome: ["Termostato", "Thermostat"],
    domini: ["climate"],
    classi: [],
    parole: ["termostato", "thermostat", "riscaldamento"],
    mont: "muro",
    tocco: null,
  },
  fumo: {
    icona: "🚨",
    nome: ["Rilevatore fumo", "Smoke detector"],
    domini: ["binary_sensor"],
    classi: ["smoke", "gas", "carbon_monoxide"],
    parole: ["fumo", "smoke", "gas"],
    mont: "soffitto",
    tocco: null,
  },
  acqua: {
    icona: "💧",
    nome: ["Sensore allagamento", "Leak sensor"],
    domini: ["binary_sensor"],
    classi: ["moisture"],
    parole: ["acqua", "allagamento", "leak", "water"],
    mont: "pavimento",
    tocco: null,
  },
  presa: {
    icona: "🔌",
    nome: ["Presa", "Plug"],
    domini: ["switch"],
    classi: ["outlet"],
    parole: ["presa", "plug", "outlet"],
    mont: "muro",
    tocco: "accendi",
  },
  tv: {
    icona: "📺",
    nome: ["TV", "TV"],
    domini: ["media_player"],
    classi: ["tv"],
    parole: ["tv", "televisore"],
    mont: "muro",
    tocco: "accendi",
  },
  altoparlante: {
    icona: "🔊",
    nome: ["Altoparlante", "Speaker"],
    domini: ["media_player"],
    classi: ["speaker"],
    parole: ["echo", "speaker", "sonos", "altoparlante"],
    mont: "muro",
    tocco: null,
  },
  antifurto: {
    icona: "🛡️",
    nome: ["Sirena / sensore allarme", "Alarm sensor"],
    domini: ["binary_sensor", "alarm_control_panel"],
    classi: ["motion", "tamper", "safety"],
    parole: ["allarme", "alarm", "sirena"],
    mont: "angolo",
    tocco: null,
  },
  pannello: {
    icona: "🖲️",
    nome: ["Pannello / interruttore", "Wall panel"],
    domini: ["switch", "light", "button", "event"],
    classi: [],
    parole: ["pannello", "interruttore", "touch"],
    mont: "muro",
    tocco: null,
  },
});
export const TIPI_DI_DISPOSITIVO = Object.freeze(Object.keys(DISPOSITIVI_3D));

const clean = (v) => String(v ?? "").trim();
const testo = (v, quanto = 60) => clean(v).slice(0, quanto);
const elenco = (v) => (Array.isArray(v) ? v : []);
const numero = (v, min, max, ripiego) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : ripiego;
};
const colore = (v, ripiego = "") =>
  /^#[0-9a-f]{6}$/i.test(clean(v)) ? clean(v).toLowerCase() : ripiego;
const chiave = (v, ripiego = "") => (/^[a-z0-9_]{1,24}$/.test(clean(v)) ? clean(v) : ripiego);

/* ── la pianta compressa ──────────────────────────────────────────────────
 *
 * Una corsa dopo l'altra: il valore della cella (spostato di 8, cosi' sta in
 * un byte: -8..247) e quante volte si ripete (in 7 bit per byte). Poi base64.
 * Fatto a mano perche' deve girare uguale nella pagina e nelle prove. */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function aBase64(byte) {
  let out = "";
  for (let i = 0; i < byte.length; i += 3) {
    const a = byte[i],
      b = byte[i + 1],
      c = byte[i + 2];
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? "=" : B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? "=" : B64[c & 63];
  }
  return out;
}

function daBase64(testo64) {
  const s = clean(testo64).replace(/[^A-Za-z0-9+/]/g, "");
  const out = [];
  for (let i = 0; i < s.length; i += 4) {
    const n = [0, 1, 2, 3].map((k) => B64.indexOf(s[i + k] ?? "A"));
    out.push((n[0] << 2) | (n[1] >> 4));
    if (i + 2 < s.length) out.push(((n[1] & 15) << 4) | (n[2] >> 2));
    if (i + 3 < s.length) out.push(((n[2] & 3) << 6) | n[3]);
  }
  return out;
}

/** La griglia (W×H valori interi) in un testo corto. */
export function comprimiGriglia(tipo) {
  const byte = [];
  const N = tipo.length;
  for (let i = 0; i < N;) {
    const v = Math.max(-8, Math.min(247, tipo[i] | 0));
    let n = 1;
    while (i + n < N && Math.max(-8, Math.min(247, tipo[i + n] | 0)) === v) n++;
    byte.push(v + 8);
    let resto = n;
    do {
      let b = resto & 127;
      resto = Math.floor(resto / 128);
      if (resto > 0) b |= 128;
      byte.push(b);
    } while (resto > 0);
    i += n;
  }
  return aBase64(byte);
}

/** Il contrario: dal testo alla griglia di `N` celle. Le celle che mancano sono fuori. */
export function espandiGriglia(testo64, N) {
  const tipo = new Int16Array(Math.max(0, Math.min(CELLE_AL_MASSIMO, N | 0))).fill(CELLA.fuori);
  const byte = daBase64(testo64);
  let i = 0,
    k = 0;
  while (k < byte.length && i < tipo.length) {
    const v = byte[k++] - 8;
    let n = 0,
      peso = 1,
      b;
    do {
      b = byte[k++] ?? 0;
      n += (b & 127) * peso;
      peso *= 128;
    } while (b & 128 && k < byte.length);
    const fine = Math.min(tipo.length, i + n);
    for (; i < fine; i++) tipo[i] = v;
  }
  return tipo;
}

/** Ricampiona una griglia a un altro passo (il piu' vicino: le stanze restano intere). */
export function ricampiona({ W, H, passo, tipo }, nuovoPasso = PASSO_SALVATO) {
  const f = passo / nuovoPasso;
  const W2 = Math.max(1, Math.round(W * f)),
    H2 = Math.max(1, Math.round(H * f));
  const out = new Int16Array(W2 * H2);
  for (let y = 0; y < H2; y++) {
    const sy = Math.min(H - 1, Math.floor((y + 0.5) / f));
    for (let x = 0; x < W2; x++) {
      const sx = Math.min(W - 1, Math.floor((x + 0.5) / f));
      out[y * W2 + x] = tipo[sy * W + sx];
    }
  }
  return { W: W2, H: H2, passo: nuovoPasso, tipo: out };
}

/* ── la casa pulita ───────────────────────────────────────────────────── */

const punto = (p) => ({ x: numero(p?.x, -500, 500, 0), y: numero(p?.y, -500, 500, 0) });

function stanzaPulita(s) {
  const id = Number(s?.id);
  if (!Number.isInteger(id) || id < 1 || id > 247) return null;
  return {
    id,
    nome: testo(s?.nome, 40) || `Stanza ${id}`,
    area: testo(s?.area, 64), // l'area di Home Assistant (area_id), se c'e'
    pavimento: s?.pavimento
      ? {
          tipo: chiave(s.pavimento.tipo, "gres60"),
          colore: colore(s.pavimento.colore, "#d9cbb3"),
          colore2: colore(s.pavimento.colore2),
          diagonale: s.pavimento.diagonale === true,
        }
      : null,
    pareti: colore(s?.pareti),
    fuori: s?.fuori === true,
  };
}

function aperturaPulita(a) {
  const tipo = ["porta", "finestra"].includes(a?.tipo) ? a.tipo : null;
  if (!tipo) return null;
  return {
    tipo,
    ...punto({ x: a.cx ?? a.x, y: a.cy ?? a.y }),
    largo: numero(a?.largo, 0.4, 6, 0.9),
    orizz: a?.orizz !== false,
    verso: [-1, 0, 1].includes(a?.verso) ? a.verso : 0,
    portafinestra: a?.portafinestra === true,
    stanza: numero(a?.stanza, 0, 247, 0) | 0,
  };
}

function arredoPulito(a) {
  const k = chiave(a?.k);
  if (!k) return null;
  return {
    k,
    stanza: numero(a?.stanza, 0, 247, 0) | 0,
    ...punto(a),
    rot: numero(a?.rot, -100, 100, 0),
    tinta: colore(a?.tinta),
    sotto: a?.sotto === true,
  };
}

/** Un dispositivo: il tipo, dove sta e a quale entita' di Home Assistant risponde. */
export function dispositivoPulito(d) {
  const k = TIPI_DI_DISPOSITIVO.includes(d?.k) ? d.k : null;
  if (!k) return null;
  return {
    k,
    stanza: numero(d?.stanza, 0, 247, 0) | 0,
    ...punto(d),
    h: numero(
      d?.h,
      0,
      4,
      DISPOSITIVI_3D[k].mont === "soffitto"
        ? 2.9
        : DISPOSITIVI_3D[k].mont === "pavimento"
          ? 0
          : 2.3,
    ),
    rot: numero(d?.rot, -100, 100, 0),
    entity: entita(d?.entity),
    nome: testo(d?.nome, 40),
    fov: k === "telecamera" ? numero(d?.fov, 40, 180, 100) : undefined,
    da: ["foto", "mano", "auto"].includes(d?.da) ? d.da : "mano",
  };
}

function pianoPulito(p, i) {
  const W = numero(p?.W, 1, 1200, 0) | 0,
    H = numero(p?.H, 1, 1200, 0) | 0;
  if (!W || !H || W * H > CELLE_AL_MASSIMO || !clean(p?.griglia)) return null;
  const stanze = elenco(p?.stanze).map(stanzaPulita).filter(Boolean).slice(0, STANZE_AL_MASSIMO);
  return {
    k: chiave(p?.k, `piano${i}`),
    nome: testo(p?.nome, 30) || `Piano ${i}`,
    livello: numero(p?.livello, -3, 30, i) | 0,
    W,
    H,
    passo: numero(p?.passo, 0.02, 0.2, PASSO_SALVATO),
    griglia: clean(p.griglia).slice(0, 2_000_000),
    stanze,
    aperture: elenco(p?.aperture).map(aperturaPulita).filter(Boolean).slice(0, APERTURE_AL_MASSIMO),
    arredi: elenco(p?.arredi).map(arredoPulito).filter(Boolean).slice(0, ARREDI_AL_MASSIMO),
    dispositivi: elenco(p?.dispositivi)
      .map(dispositivoPulito)
      .filter(Boolean)
      .slice(0, DISPOSITIVI_AL_MASSIMO),
  };
}

/** La casa come la si salva: tutto controllato, niente di troppo. */
export function casa3dPulita(raw) {
  const c = raw && typeof raw === "object" ? raw : {};
  const e = c.esterno && typeof c.esterno === "object" ? c.esterno : {};
  const tipo = c.tipo === "palazzo" ? "palazzo" : "villa";
  const piani = elenco(c.piani).map(pianoPulito).filter(Boolean).slice(0, PIANI_AL_MASSIMO);
  return {
    versione: VERSIONE_CASA3D,
    /* Accesa anche senza piani: una plancia «Casa 3D» appena nata e' gia'
     * lei, e mostra «Crea la tua casa» invece di ricadere nella classica. */
    attiva: c.attiva === true,
    tipo,
    esterno: {
      pianiPalazzo: numero(e.pianiPalazzo, 2, 20, 6) | 0,
      mioPiano: numero(e.mioPiano, 0, 19, 0) | 0,
      tetto: e.tetto === "piano" ? "piano" : "falde",
      facciata: colore(e.facciata, "#e9d4ae"),
      persiane: colore(e.persiane, "#3f6b4e"),
      coppi: colore(e.coppi, "#b5532f"),
      giardino: e.giardino !== false,
      telecamere: elenco(e.telecamere)
        .map(dispositivoPulito)
        .filter((d) => d && d.k === "telecamera")
        .slice(0, 16),
    },
    piani,
  };
}

/** Una casa vuota, spenta: quella di chi non l'ha ancora creata. */
export const CASA3D_VUOTA = Object.freeze(casa3dPulita({}));

/* ── le entita' giuste per un dispositivo ────────────────────────────────
 *
 * Si propongono in ordine: prima quelle del dominio giusto con la classe
 * giusta, poi quelle che nel nome o nell'area hanno la stanza, poi le altre
 * del dominio. Quelle gia' usate da un altro dispositivo vanno in fondo. */
const parole = (s) =>
  clean(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);

export function entitaCandidate(
  k,
  { stanza = "", area = "", states = {}, aree = {}, usate = [] } = {},
) {
  const D = DISPOSITIVI_3D[k];
  if (!D) return [];
  const daStanza = new Set([...parole(stanza), ...parole(area)]);
  const usateSet = new Set(usate);
  const out = [];
  for (const [id, st] of Object.entries(states || {})) {
    const dom = id.split(".")[0];
    if (!D.domini.includes(dom)) continue;
    const attr = st?.attributes || {};
    const classe = clean(attr.device_class);
    if (D.classi.length && dom === "binary_sensor" && !D.classi.includes(classe)) continue;
    if (D.classi.length && dom === "sensor" && !D.classi.includes(classe)) continue;
    let punti = 10;
    if (D.classi.includes(classe)) punti += 20;
    const nome = `${id} ${attr.friendly_name || ""}`;
    const sue = parole(nome);
    if (sue.some((w) => D.parole.some((p) => w.startsWith(p)))) punti += 8;
    const suaArea = aree[id] || "";
    if (suaArea && area && suaArea === area) punti += 40;
    if (sue.some((w) => daStanza.has(w)) || parole(suaArea).some((w) => daStanza.has(w)))
      punti += 25;
    if (usateSet.has(id)) punti -= 50;
    if (st?.state === "unavailable") punti -= 5;
    out.push({ entity: id, nome: clean(attr.friendly_name) || id, punti });
  }
  return out.sort((a, b) => b.punti - a.punti || a.nome.localeCompare(b.nome));
}

/** La prima scelta, se e' abbastanza buona da metterla da sola (stessa area o stessa stanza nel nome). */
export function entitaProposta(k, contesto) {
  const [prima] = entitaCandidate(k, contesto);
  return prima && prima.punti >= 35 ? prima.entity : "";
}

/* ── cosa dice e cosa fa ─────────────────────────────────────────────── */

const ACCESO = new Set([
  "on",
  "open",
  "opening",
  "detected",
  "home",
  "playing",
  "heat",
  "cool",
  "heat_cool",
  "auto",
  "dry",
  "fan_only",
  "triggered",
  "unlocked",
]);

/** Lo stato da mostrare sopra il dispositivo. */
export function statoDelDispositivo(k, st, italiano = true) {
  const D = DISPOSITIVI_3D[k];
  const s = clean(st?.state);
  const L = (it, en) => (italiano ? it : en);
  if (!D || !st)
    return { attivo: false, testo: D?.icona || "", tono: "spento", disponibile: false };
  if (s === "unavailable" || s === "unknown")
    return {
      attivo: false,
      testo: `${D.icona} ${L("non risponde", "offline")}`,
      tono: "spento",
      disponibile: false,
    };
  const attr = st.attributes || {};
  switch (k) {
    case "luce":
    case "presa":
    case "tv": {
      const pct =
        typeof attr.brightness === "number" ? ` ${Math.round((attr.brightness / 255) * 100)}%` : "";
      return {
        attivo: s === "on" || s === "playing",
        testo: `${D.icona}${s === "on" ? pct || " " + L("accesa", "on") : s === "playing" ? " ▶" : ""}`,
        tono: s === "on" || s === "playing" ? "luce" : "spento",
        disponibile: true,
        luminosita:
          typeof attr.brightness === "number" ? attr.brightness / 255 : s === "on" ? 1 : 0,
      };
    }
    case "tapparella": {
      const pos =
        typeof attr.current_position === "number"
          ? attr.current_position
          : s === "open"
            ? 100
            : s === "closed"
              ? 0
              : 50;
      return {
        attivo: pos > 0,
        testo: `${D.icona} ${pos === 0 ? L("chiusa", "closed") : pos === 100 ? L("aperta", "open") : pos + "%"}`,
        tono: "neutro",
        disponibile: true,
        apertura: pos / 100,
      };
    }
    case "finestra":
    case "porta": {
      const aperta = s === "on" || s === "open" || s === "unlocked";
      return {
        attivo: aperta,
        testo: aperta ? `${D.icona} ${L("aperta", "open")}` : D.icona,
        tono: aperta ? "allarme" : "neutro",
        disponibile: true,
        apertura: aperta ? 1 : 0,
      };
    }
    case "movimento":
    case "presenza":
    case "antifurto":
      return {
        attivo: s === "on" || s === "triggered",
        testo: s === "on" || s === "triggered" ? `${D.icona} ${L("movimento", "motion")}` : D.icona,
        tono: s === "on" || s === "triggered" ? "movimento" : "neutro",
        disponibile: true,
      };
    case "fumo":
    case "acqua":
      return {
        attivo: s === "on",
        testo: s === "on" ? `${D.icona} ${L("ALLARME", "ALARM")}` : D.icona,
        tono: s === "on" ? "allarme" : "ok",
        disponibile: true,
      };
    case "termometro": {
      const v = Number(s);
      return {
        attivo: false,
        testo: Number.isFinite(v)
          ? `${D.icona} ${v.toFixed(1).replace(".", italiano ? "," : ".")}°`
          : D.icona,
        tono: "clima",
        disponibile: true,
      };
    }
    case "clima":
    case "termostato": {
      const t = attr.current_temperature;
      return {
        attivo: ACCESO.has(s) && s !== "off",
        testo: `${D.icona}${typeof t === "number" ? " " + t.toFixed(1).replace(".", italiano ? "," : ".") + "°" : ""}${s === "off" ? "" : " · " + s}`,
        tono: s === "off" ? "spento" : "clima",
        disponibile: true,
      };
    }
    case "telecamera":
      return {
        attivo: true,
        testo: `${D.icona} ${L("live", "live")}`,
        tono: "telecamera",
        disponibile: true,
      };
    default:
      return { attivo: ACCESO.has(s), testo: D.icona, tono: "neutro", disponibile: true };
  }
}

/** Cosa fa un tocco sul dispositivo: il servizio da chiamare, o un'azione della pagina. */
export function azioneDelTocco(k, entity, st) {
  const D = DISPOSITIVI_3D[k];
  const id = entita(entity);
  if (!D || !id) return null;
  const dom = id.split(".")[0];
  if (D.tocco === "guarda") return { pagina: "telecamera", entity: id };
  if (D.tocco === "accendi") {
    if (dom === "climate")
      return {
        domain: "climate",
        service: clean(st?.state) === "off" ? "turn_on" : "turn_off",
        data: { entity_id: id },
      };
    if (["light", "switch", "media_player", "fan"].includes(dom))
      return { domain: dom, service: "toggle", data: { entity_id: id } };
  }
  if (D.tocco === "apri" && dom === "cover") {
    const s = clean(st?.state);
    return {
      domain: "cover",
      service:
        s === "opening" || s === "closing"
          ? "stop_cover"
          : s === "closed"
            ? "open_cover"
            : "close_cover",
      data: { entity_id: id },
    };
  }
  return null;
}

/** Quante cose della casa sono collegate e quante no: per dire cosa manca. */
export function contaCollegati(casa) {
  let tutti = 0,
    collegati = 0;
  for (const p of casa?.piani || [])
    for (const d of p.dispositivi || []) {
      tutti++;
      if (d.entity) collegati++;
    }
  for (const d of casa?.esterno?.telecamere || []) {
    tutti++;
    if (d.entity) collegati++;
  }
  return { tutti, collegati, mancano: tutti - collegati };
}
