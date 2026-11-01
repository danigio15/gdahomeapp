/* «Crea la tua casa»: la procedura guidata della Casa 3D, dentro la plancia.
 *
 * Dalla foto della planimetria e dalle foto delle stanze alla casa in tre
 * dimensioni, un passo per volta, come nel prototipo approvato:
 *
 *   1. Planimetria — la foto (anche storta: si raddrizza da sola) e il piano;
 *   2. Scala — due punti di una misura nota;
 *   3. Muri — riconosciuti, e ritoccati a mano (muro, gomma, porta, finestra);
 *   4. Stanze — i nomi, dalle aree di Home Assistant o scritti a mano;
 *   5. Foto stanze — gli arredi e i dispositivi riconosciuti sul dispositivo
 *      (COCO-SSD), o segnati a mano, con il verso e i colori della foto;
 *   6. Dispositivi — ognuno con la sua entita', e quelli da aggiungere senza foto;
 *   7. Esterno — villa o palazzo, piani, tetto, i colori della facciata;
 *   8. Casa 3D — si salva, e si apre; o si aggiunge un altro piano.
 *
 * Dal campo: «se dalle foto riconosci oggetti come punti luce, telecamere,
 * finestre etc. poi devi dare la possibilita' di associare le entita' di
 * riferimento o nel caso a mano libera aggiungerle».
 *
 * Le foto non escono mai dalla pagina: restano in memoria finche' la
 * procedura e' aperta, e nel config si salvano solo le cose che se ne
 * ricavano (`core/crea-casa.js`). Solo chi amministra la plancia la apre, e
 * solo in una casa Premium, come «Colpo d'occhio».
 */
import {
  CHIAVE_CASA3D,
  DISPOSITIVI_3D,
  TIPI_DI_DISPOSITIVO,
  casa3dPulita,
  entita,
  entitaCandidate,
  entitaProposta,
} from "../core/casa-3d.js";
import {
  ARREDI_DELLE_FOTO,
  aggiungiPiano,
  areeDaiRegistri,
  dispositiviDallaFoto,
  entitaUsate,
  oggettiDaCoco,
  pianoDaRiconoscimento,
  pianoDelLivello,
  posaDiRipiego,
} from "../core/crea-casa.js";
import {
  PASSO,
  grigliaDeiMuri,
  inchiostro,
  riconosciDaFoto,
  scalaScritta,
  stimaInclinazione,
} from "../core/pianta-da-foto.js";
import {
  eNomeDiFuori,
  eNomeDiStanza,
  nomeDaScritta,
  nomiDalleScritte,
  nomiDiRipiego,
  pezziDelDisegno,
  pianiDelDisegno,
  ruoloDelloStrato,
} from "../core/pianta-da-dwg.js";
import { daiVendor } from "../core/cartella-della-plancia.js";
import { leStanzeRicordate } from "../core/le-stanze-di-home-assistant.js";
import { premiumDellaCasa, premiumRicordato } from "./plancia-a-muro-section.js";
import { puoConfigurare } from "./la-config-e-di-chi-la-amministra-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  lexicalGlobal,
  readJson,
  root,
  senzaCadere,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_CASA3D_CREA__";
const ID = "dm-c3c";
const state = (root[KEY] ||= { installed: false, S: null, modello: null, premium: null });

/* Le coppie [italiano, inglese] dei cataloghi del nucleo. */
const due = (coppia) => t(...coppia);
const numero = (v, cifre = 1) => Number(v).toFixed(cifre).replace(".", t(",", "."));

const PASSI = [
  ["Planimetria", "Floor plan"],
  ["Scala", "Scale"],
  ["Muri", "Walls"],
  ["Stanze", "Rooms"],
  ["Foto stanze", "Room photos"],
  ["Dispositivi", "Devices"],
  ["Esterno", "Outside"],
  ["Casa 3D", "3D home"],
];
const P = {
  planimetria: 0,
  scala: 1,
  muri: 2,
  stanze: 3,
  foto: 4,
  dispositivi: 5,
  esterno: 6,
  fine: 7,
};
const LIVELLI = [-1, 0, 1, 2, 3];
const NOMI_DI_RIPIEGO = [
  ["Salone", "Living room"],
  ["Cucina", "Kitchen"],
  ["Camera", "Bedroom"],
  ["Cameretta", "Kids room"],
  ["Bagno", "Bathroom"],
  ["Ingresso", "Entrance"],
  ["Disimpegno", "Hallway"],
  ["Ripostiglio", "Storage"],
  ["Studio", "Study"],
  ["Lavanderia", "Laundry"],
  ["Cortile", "Yard"],
  ["Terrazzo", "Terrace"],
];
const COLORI_STANZE = [
  "#38bdf8",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#fb923c",
  "#60a5fa",
  "#4ade80",
  "#e879f9",
];
const ARREDI_A_MANO = [
  "divano",
  "poltrona",
  "tavolino",
  "tv",
  "libreria",
  "madia",
  "pensile",
  "quadro",
  "camino",
  "pianta",
  "pranzo6",
  "cucina",
  "frigo",
  "matrimoniale",
  "singolo",
  "armadio",
  "scrivania",
  "vasca",
  "doccia",
  "wc",
  "lavabo",
  "lavatrice",
];
const TINTE = {
  facciata: ["#e9d4ae", "#dca37c", "#f1ebe0", "#c9a27a", "#b9c3c9"],
  persiane: ["#3f6b4e", "#8a6a4a", "#475569", "#e5e7eb", "#7c2d12"],
  coppi: ["#b5532f", "#7c2d12", "#475569", "#a8a29e"],
};

/* ── lo stato della procedura ─────────────────────────────────────────── */

function casaSalvata() {
  return casa3dPulita(readJson(CHIAVE_CASA3D, null));
}

function statoNuovo(salvata, livello = 0) {
  const e = salvata.esterno;
  return {
    passo: 0,
    livello,
    img: null,
    dritta: null,
    angolo: 0,
    punti: [],
    metri: null,
    mpp: null,
    griglia: null,
    casa: null,
    ritaglio: { x0: 0, y0: 0 },
    fuori: new Set(),
    nomi: {},
    aree: {},
    sel: null,
    strumento: "muro",
    foto: {},
    fotoSel: 0,
    aggiungi: null,
    manuali: [],
    nuovo: { k: "luce", stanza: 0 },
    salvata,
    tipo: salvata.tipo,
    esterno: { ...e, foto: null, scelta: "facciata" },
    lavoro: "",
    avviso: "",
    /* Dal DWG: i piani trovati nel disegno (se piu' d'uno si sceglie), e i
     * nomi delle stanze scritti nel disegno, in pixel della tela. */
    dwg: null,
    etichette: [],
    /* «Disegnala qui»: le misure del contorno, in metri. */
    aMano: { w: "", h: "" },
    inizio: null,
  };
}

/* Le aree di Home Assistant e di chi e' ogni entita': lette, non chieste. */
function registri() {
  let ricordate = null;
  try {
    ricordate = leStanzeRicordate();
  } catch (_errore) {}
  return areeDaiRegistri({
    wiz: lexicalGlobal("WIZ"),
    hass: root.__HASS__ || root.hass || null,
    ricordate,
  });
}

/* ── il riconoscitore, quando serve ──────────────────────────────────────
 *
 * TensorFlow.js e COCO-SSD stanno in `legacy/vendor/riconoscere/`: venti
 * mega fra codice e modello, che si leggono solo la prima volta che qualcuno
 * aggiunge la foto di una stanza. Se non arrivano, la procedura va avanti lo
 * stesso: gli oggetti si segnano a mano. */
/* Servita dal ponte la cartella si ricava dal nostro indirizzo, senza la
 * versione (come le figure delle persone): impacchettati, i moduli stanno in
 * `pacco/` e un percorso relativo sbaglierebbe piano. Fuori dal ponte vale il
 * percorso dei sorgenti. */
const TF = (() => {
  try {
    return new URL("../../legacy/vendor/riconoscere/tf.min.js", import.meta.url).href;
  } catch (_errore) {
    return "../../legacy/vendor/riconoscere/tf.min.js";
  }
})();
const COCO = (() => {
  try {
    return new URL("../../legacy/vendor/riconoscere/coco-ssd.min.js", import.meta.url).href;
  } catch (_errore) {
    return "../../legacy/vendor/riconoscere/coco-ssd.min.js";
  }
})();
const VENDOR = daiVendor(
  String(import.meta.url || ""),
  "riconoscere/",
  TF.slice(0, TF.lastIndexOf("/") + 1),
);
void COCO;

/* pdf.js (Apache-2.0, vedi legacy/vendor/pdfjs/LEGGIMI.txt): per il PDF del
 * catasto, solo quando si sceglie un PDF. */
const PDFJS = (() => {
  try {
    return new URL("../../legacy/vendor/pdfjs/pdf.min.js", import.meta.url).href;
  } catch (_errore) {
    return "../../legacy/vendor/pdfjs/pdf.min.js";
  }
})();
const PDFJS_LAVORO = (() => {
  try {
    return new URL("../../legacy/vendor/pdfjs/pdf.worker.min.js", import.meta.url).href;
  } catch (_errore) {
    return "../../legacy/vendor/pdfjs/pdf.worker.min.js";
  }
})();
const daServire = (indirizzo, nome) =>
  daiVendor(String(import.meta.url || ""), `pdfjs/${nome}`, indirizzo);

/* LibreDWG (GPL-3, vedi legacy/vendor/libredwg/LEGGIMI.txt): si scarica solo
 * quando si sceglie un DWG, ed e' grosso (11 MB). Stessa strada del resto. */
const LIBREDWG_JS = (() => {
  try {
    return new URL("../../legacy/vendor/libredwg/dist/libredwg-web.js", import.meta.url).href;
  } catch (_errore) {
    return "../../legacy/vendor/libredwg/dist/libredwg-web.js";
  }
})();
const LIBREDWG = daiVendor(
  String(import.meta.url || ""),
  "libredwg/",
  LIBREDWG_JS.slice(0, LIBREDWG_JS.length - "dist/libredwg-web.js".length),
);

function copione(src, pronto) {
  if (pronto()) return Promise.resolve(true);
  return new Promise((ok) => {
    const s = doc.createElement("script");
    s.src = src;
    s.async = false;
    s.onload = () => ok(Boolean(pronto()));
    s.onerror = () => ok(false);
    doc.head.appendChild(s);
  });
}

function riconoscitore() {
  if (state.modello) return state.modello;
  state.modello = (async () => {
    const S = state.S;
    if (S) {
      S.riconoscitore = "carica";
      disegnaIlPannello();
    }
    try {
      if (!(await copione(`${VENDOR}tf.min.js`, () => root.tf))) throw new Error("tf");
      if (!(await copione(`${VENDOR}coco-ssd.min.js`, () => root.cocoSsd)))
        throw new Error("coco-ssd");
      const m = await root.cocoSsd.load({ modelUrl: `${VENDOR}model.json` });
      if (state.S) state.S.riconoscitore = "pronto";
      return m;
    } catch (errore) {
      root.console?.warn?.("[DashboardModern] Casa 3D: riconoscimento non disponibile", errore);
      if (state.S) state.S.riconoscitore = "no";
      state.modello = null;
      return null;
    }
  })();
  return state.modello;
}

/* ── le immagini ──────────────────────────────────────────────────────── */

const leggi = (file) =>
  new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => no(r.error);
    r.readAsDataURL(file);
  });

async function immagine(src) {
  const im = new Image();
  im.src = src;
  await im.decode();
  return im;
}

/* Una foto troppo grande si rimpicciolisce: la planimetria a 2400 punti sul
 * lato lungo ha gia' i muri da 3 cm, e il telefono non si siede. */
function tela2d(w, h) {
  const c = doc.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function coloreIn(img, x, y) {
  const c = tela2d(9, 9),
    g = c.getContext("2d");
  g.drawImage(img, x - 4, y - 4, 9, 9, 0, 0, 9, 9);
  const d = g.getImageData(0, 0, 9, 9).data;
  let r = 0,
    v = 0,
    b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i];
    v += d[i + 1];
    b += d[i + 2];
  }
  const n = d.length / 4,
    h = (q) =>
      Math.round(q / n)
        .toString(16)
        .padStart(2, "0");
  return `#${h(r)}${h(v)}${h(b)}`;
}

function coloreZona(img, x0, y0, x1, y1) {
  const c = tela2d(24, 24),
    g = c.getContext("2d");
  g.drawImage(img, x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0), 0, 0, 24, 24);
  const d = g.getImageData(0, 0, 24, 24).data,
    v = [];
  for (let i = 0; i < d.length; i += 4) v.push([d[i], d[i + 1], d[i + 2]]);
  v.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  const m = v.slice(Math.floor(v.length * 0.3), Math.floor(v.length * 0.8));
  const s = m.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]);
  return `#${s
    .map((q) =>
      Math.round(q / m.length)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/* ── la tela ───────────────────────────────────────────────────────────── */

function nodo() {
  return doc.getElementById(ID);
}
const pezzo = (sel) => nodo()?.querySelector(sel);

function adatta(w, h) {
  const palco = pezzo(".c3c-palco"),
    tela = pezzo(".c3c-tela");
  const mw = Math.max(80, palco.clientWidth - 24),
    mh = Math.max(80, palco.clientHeight - 24),
    s = Math.min(mw / w, mh / h);
  tela.width = Math.max(1, Math.round(w * s));
  tela.height = Math.max(1, Math.round(h * s));
  state.vista = { s, w, h };
  return tela.getContext("2d");
}

function daSchermo(ev) {
  const b = pezzo(".c3c-tela").getBoundingClientRect(),
    s = state.vista?.s || 1;
  return [(ev.clientX - b.left) / s, (ev.clientY - b.top) / s];
}

function aSchermo(x, y) {
  const b = pezzo(".c3c-tela").getBoundingClientRect(),
    p = pezzo(".c3c-palco").getBoundingClientRect(),
    s = state.vista?.s || 1;
  return [b.left - p.left + x * s, b.top - p.top + y * s];
}

function vuota(testo) {
  const g = adatta(800, 600);
  g.fillStyle = "#0f172a";
  g.fillRect(0, 0, 800, 600);
  if (testo) {
    g.fillStyle = "#94a3b8";
    g.font = "16px Inter, system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText(testo, 400 * state.vista.s, 300 * state.vista.s);
  }
}

function disegnaLaTela() {
  const S = state.S,
    sopra = pezzo(".c3c-sopra");
  if (!S || !sopra) return;
  sopra.innerHTML = "";
  if (S.premium !== true) return vuota("");
  if (S.passo <= P.scala) {
    if (S.dwg) return vuota(t("Scegli il piano del disegno", "Choose the floor from the drawing"));
    if (!S.dritta) return vuota(t("Carica la planimetria", "Upload the floor plan"));
    const g = adatta(S.dritta.width, S.dritta.height),
      s = state.vista.s;
    g.drawImage(S.dritta, 0, 0, pezzo(".c3c-tela").width, pezzo(".c3c-tela").height);
    if (S.passo === P.scala) {
      for (const p of S.punti) {
        const [x, y] = aSchermo(...p);
        sopra.insertAdjacentHTML(
          "beforeend",
          `<div class="c3c-punto" style="left:${x}px;top:${y}px"></div>`,
        );
      }
      if (S.punti.length === 2) {
        g.strokeStyle = "#0ea5e9";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(S.punti[0][0] * s, S.punti[0][1] * s);
        g.lineTo(S.punti[1][0] * s, S.punti[1][1] * s);
        g.stroke();
        if (S.metri) {
          const [a, b] = S.punti.map((p) => aSchermo(...p));
          sopra.insertAdjacentHTML(
            "beforeend",
            `<div class="c3c-misura" style="left:${(a[0] + b[0]) / 2}px;top:${(a[1] + b[1]) / 2}px">${esc(numero(S.metri, 2))} m</div>`,
          );
        }
      }
    }
    return;
  }
  if (S.passo === P.foto) return disegnaFotoStanza();
  if (S.passo === P.esterno) return disegnaFacciata();
  return disegnaPianta();
}

function disegnaPianta() {
  const S = state.S,
    { W, H } = S.griglia,
    c = S.casa;
  let x0 = W,
    x1 = 0,
    y0 = H,
    y1 = 0;
  for (let i = 0; i < W * H; i++) {
    if (!(S.griglia.muro[i] || c.tipo[i] > 0)) continue;
    const x = i % W,
      y = (i / W) | 0;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < x0) {
    x0 = 0;
    y0 = 0;
    x1 = W - 1;
    y1 = H - 1;
  }
  x0 = Math.max(0, x0 - 15);
  y0 = Math.max(0, y0 - 15);
  x1 = Math.min(W - 1, x1 + 15);
  y1 = Math.min(H - 1, y1 + 15);
  S.ritaglio = { x0, y0 };
  const w = x1 - x0 + 1,
    h = y1 - y0 + 1,
    g = adatta(w, h);
  const im = g.createImageData(w, h);
  const rgb = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  const tinte = {};
  c.stanze.forEach((s, k) => (tinte[s.id] = rgb(COLORI_STANZE[k % COLORI_STANZE.length])));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const v = c.tipo[y * W + x],
        o = ((y - y0) * w + (x - x0)) * 4;
      let col =
        v === -3
          ? [15, 23, 42]
          : v === -4
            ? [14, 165, 233]
            : v === -5
              ? [34, 197, 94]
              : v > 0 && tinte[v]
                ? tinte[v]
                : [226, 232, 240];
      if (v > 0 && tinte[v]) {
        const a = S.fuori.has(v) ? 0.18 : S.sel === v ? 0.75 : 0.42;
        col = col.map((q) => Math.round(q * a + 248 * (1 - a)));
      }
      im.data.set([...col, 255], o);
    }
  const tmp = tela2d(w, h);
  tmp.getContext("2d").putImageData(im, 0, 0);
  g.imageSmoothingEnabled = false;
  g.drawImage(tmp, 0, 0, pezzo(".c3c-tela").width, pezzo(".c3c-tela").height);
  if (S.passo < P.stanze) return;
  const sopra = pezzo(".c3c-sopra");
  for (const s of c.stanze) {
    const [x, y] = aSchermo(s.sx / PASSO - x0, s.sy / PASSO - y0),
      nf = (S.foto[s.id] || []).length;
    sopra.insertAdjacentHTML(
      "beforeend",
      `<div class="c3c-nome-st" style="left:${x}px;top:${y}px">${S.fuori.has(s.id) ? "🌳 " : ""}${esc(nomeDi(s.id))}<i>${esc(numero(s.area))} m²${nf ? ` · 📷 ${nf}` : ""}</i></div>`,
    );
  }
  if (S.passo === P.dispositivi || S.passo === P.fine)
    for (const d of tuttiIDispositivi()) {
      const [x, y] = aSchermo(d.x / PASSO - x0, d.y / PASSO - y0);
      sopra.insertAdjacentHTML(
        "beforeend",
        `<div class="c3c-disp-pianta${d.entity ? " si" : ""}${S.selDisp === d.ref ? " scelto" : ""}" style="left:${x}px;top:${y}px" title="${esc(due(DISPOSITIVI_3D[d.k].nome))}">${DISPOSITIVI_3D[d.k].icona}</div>`,
      );
    }
}

function disegnaFotoStanza() {
  const S = state.S,
    F = (S.foto[S.sel] || [])[S.fotoSel];
  if (!F) return vuota(t("Aggiungi le foto di questa stanza", "Add photos of this room"));
  const g = adatta(F.w, F.h),
    s = state.vista.s,
    sopra = pezzo(".c3c-sopra");
  g.drawImage(F.img, 0, 0, pezzo(".c3c-tela").width, pezzo(".c3c-tela").height);
  const riquadro = (box, classe, testo) => {
    const [x, y] = aSchermo(box[0], box[1]);
    sopra.insertAdjacentHTML(
      "beforeend",
      `<div class="c3c-box ${classe}" style="left:${x}px;top:${y}px;width:${box[2] * s}px;height:${box[3] * s}px"><b>${testo}</b></div>`,
    );
  };
  for (const o of F.oggetti) {
    const V = ARREDI_DELLE_FOTO[o.k];
    riquadro(
      o.box,
      o.manuale ? "manuale" : "",
      `${V?.icona || ""} ${esc(V ? due(V.nome) : o.k)}${o.score ? ` · ${Math.round(o.score * 100)}%` : ""}`,
    );
  }
  F.dispositivi.forEach((d, i) => {
    const D = DISPOSITIVI_3D[d.k],
      ref = `f:${S.sel}:${S.fotoSel}:${i}`;
    riquadro(
      d.box,
      `disp${d.entity ? " si" : ""}${S.selDisp === ref ? " scelto" : ""}`,
      `${D.icona} ${esc(due(D.nome))}${d.entity ? " · ✓" : ""}`,
    );
  });
}

function disegnaFacciata() {
  const S = state.S,
    E = S.esterno;
  if (E.foto) {
    const g = adatta(E.foto.width, E.foto.height);
    g.drawImage(E.foto, 0, 0, pezzo(".c3c-tela").width, pezzo(".c3c-tela").height);
    return;
  }
  const g = adatta(800, 600),
    s = state.vista.s;
  g.scale(s, s);
  g.fillStyle = "#16213a";
  g.fillRect(0, 0, 800, 600);
  g.fillStyle = "#2d4a32";
  g.fillRect(0, 470, 800, 130);
  const piani =
    S.tipo === "palazzo"
      ? Math.min(5, E.pianiPalazzo)
      : Math.max(1, S.salvata.piani.filter((p) => p.livello >= 0).length || 1, S.livello + 1);
  const hp = Math.min(90, 380 / piani),
    base = 470,
    x0 = 210,
    w = 380;
  g.fillStyle = E.facciata;
  g.fillRect(x0, base - piani * hp, w, piani * hp);
  for (let p = 0; p < piani; p++)
    for (let i = 0; i < 4; i++) {
      const x = x0 + 40 + i * 88,
        y = base - (p + 1) * hp + hp * 0.25;
      g.fillStyle = "#1e293b";
      g.fillRect(x, y, 34, hp * 0.55);
      g.fillStyle = E.persiane;
      g.fillRect(x - 16, y, 15, hp * 0.55);
      g.fillRect(x + 35, y, 15, hp * 0.55);
    }
  g.fillStyle = E.coppi;
  g.beginPath();
  if (S.tipo === "villa" && E.tetto === "falde") {
    g.moveTo(x0 - 30, base - piani * hp);
    g.lineTo(x0 + w / 2, base - piani * hp - 90);
    g.lineTo(x0 + w + 30, base - piani * hp);
  } else g.rect(x0 - 10, base - piani * hp - 14, w + 20, 14);
  g.fill();
}

/* ── i dispositivi del piano ──────────────────────────────────────────── */

const stanzeVive = () => (state.S.casa?.stanze || []).filter((s) => !state.S.fuori.has(s.id));
const stanzaDi = (id) => (state.S.casa?.stanze || []).find((s) => s.id === Number(id));

/* Il nome di una stanza: quello dato (o scritto nel disegno), altrimenti
 * «Stanza N» contando le stanze senza nome e senza ripetere un nome gia'
 * preso. */
function nomeDi(id) {
  const S = state.S,
    dato = clean(S.nomi[id]);
  if (dato) return dato;
  const ids = (S.casa?.stanze || []).map((s) => s.id),
    presi = {};
  for (const k of ids) if (clean(S.nomi[k])) presi[k] = clean(S.nomi[k]);
  return nomiDiRipiego(ids, presi, t("Stanza", "Room"))[id] || `${t("Stanza", "Room")} ${id}`;
}

/* Ogni dispositivo ha un riferimento: «f:stanza:foto:n» se viene da una
 * foto, «m:n» se e' stato aggiunto senza. */
function trova(ref) {
  const S = state.S,
    [tipo, a, b, c] = clean(ref).split(":");
  if (tipo === "m") return S.manuali[Number(a)] || null;
  if (tipo === "f") return S.foto[Number(a)]?.[Number(b)]?.dispositivi?.[Number(c)] || null;
  return null;
}

function togli(ref) {
  const S = state.S,
    [tipo, a, b, c] = clean(ref).split(":");
  if (tipo === "m") S.manuali.splice(Number(a), 1);
  if (tipo === "f") S.foto[Number(a)]?.[Number(b)]?.dispositivi?.splice(Number(c), 1);
  if (S.selDisp === ref) S.selDisp = null;
}

/* Tutti, con la stanza, il riferimento e dove stanno nella pianta (metri, sulla griglia da 3 cm). */
function tuttiIDispositivi() {
  const S = state.S,
    out = [];
  if (!S.casa) return out;
  for (const s of stanzeVive()) {
    (S.foto[s.id] || []).forEach((F, fi) => {
      const posati = dispositiviDallaFoto(S.casa, s, F);
      F.dispositivi.forEach((d, i) => {
        const p = posati[i] || {};
        out.push({
          ...d,
          ref: `f:${s.id}:${fi}:${i}`,
          stanza: s.id,
          x: p.x ?? s.sx,
          y: p.y ?? s.sy,
          daFoto: true,
        });
      });
    });
  }
  const contati = {};
  S.manuali.forEach((d, i) => {
    const s = stanzaDi(d.stanza);
    if (!s || S.fuori.has(s.id)) return;
    const chiave = `${s.id}:${d.k}`;
    const p = posaDiRipiego(S.casa, s, d.k, contati[chiave] || 0);
    contati[chiave] = (contati[chiave] || 0) + 1;
    out.push({ ...d, ref: `m:${i}`, stanza: s.id, x: p.x, y: p.y, daFoto: false });
  });
  return out;
}

function usate(tranne) {
  const S = state.S,
    k = pianoDelLivello(S.livello).k;
  const altri = { piani: S.salvata.piani.filter((p) => p.k !== k), esterno: S.salvata.esterno };
  const out = entitaUsate(altri);
  for (const s of Object.values(S.foto))
    for (const F of s)
      for (const d of F.dispositivi) if (d !== tranne && d.entity) out.push(d.entity);
  for (const d of S.manuali) if (d !== tranne && d.entity) out.push(d.entity);
  return out;
}

function contesto(k, stanzaId, tranne) {
  const S = state.S;
  return {
    stanza: nomeDi(stanzaId),
    area: clean(S.aree[stanzaId]),
    states: allStates() || {},
    aree: S.registri.diEntita,
    usate: usate(tranne),
  };
}

function proponi(k, stanzaId, d) {
  return entitaProposta(k, contesto(k, stanzaId, d));
}

function conti() {
  const tutti = tuttiIDispositivi();
  const collegati = tutti.filter((d) => d.entity).length;
  return { tutti: tutti.length, collegati, mancano: tutti.length - collegati };
}

/* ── il pannello di ogni passo ────────────────────────────────────────── */

const scheda = (titolo, corpo, classe = "") =>
  `<section class="c3c-scheda${classe ? ` ${classe}` : ""}"><div class="c3c-titolo">${titolo}</div>${corpo}</section>`;

function avanti(testo = t("Avanti →", "Next →"), ok = true, indietro = true) {
  return `<div class="c3c-riga-btn">${indietro ? `<button type="button" class="c3c-btn" data-c3c="indietro">${esc(t("← Indietro", "← Back"))}</button>` : ""}<button type="button" class="c3c-btn pieno" data-c3c="avanti"${ok ? "" : " disabled"}>${esc(testo)}</button></div>`;
}

const nota = (testo) => `<div class="c3c-piccolo">${testo}</div>`;
const PRIVATO = () =>
  `<div class="c3c-privato">🔒 ${esc(
    t(
      "Le foto restano su questo dispositivo: non si salvano e non si mandano da nessuna parte. Nel config vanno solo muri, stanze, arredi, colori e dispositivi.",
      "Photos stay on this device: they are never saved or sent anywhere. Only walls, rooms, furniture, colours and devices go into the config.",
    ),
  )}</div>`;

function pPlanimetria() {
  const S = state.S,
    fatti = new Map(S.salvata.piani.map((p) => [p.k, p]));
  const livelli = LIVELLI.map((n) => {
    const L = pianoDelLivello(n),
      gia = fatti.has(L.k);
    return `<button type="button" class="c3c-ch${S.livello === n ? " si" : ""}" data-c3c-livello="${n}">${esc(due(L.nome))}${gia ? " ✓" : ""}</button>`;
  }).join("");
  const gia = fatti.get(pianoDelLivello(S.livello).k);
  return (
    scheda(
      `🏢 <b>${esc(t("Il piano", "The floor"))}</b>`,
      `<div>${livelli}</div>${
        gia
          ? nota(
              esc(
                t(
                  `Questo piano c'è già (${gia.stanze.length} stanze): rifacendolo lo sostituisci.`,
                  `This floor already exists (${gia.stanze.length} rooms): redoing it replaces it.`,
                ),
              ),
            )
          : S.salvata.piani.length
            ? nota(
                esc(
                  t(
                    "Un piano nuovo si aggiunge a quelli che ci sono.",
                    "A new floor is added to the existing ones.",
                  ),
                ),
              )
            : ""
      }`,
    ) +
    scheda(
      `🗺️ <b>${esc(t("La planimetria", "The floor plan"))}</b>`,
      `<button type="button" class="c3c-carica" data-c3c="carica"><b>📄</b>${esc(t("Carica una foto o un PDF della planimetria", "Upload a photo or a PDF of the floor plan"))}<span class="c3c-piccolo">${esc(
        t(
          "il PDF del catasto va bene così com'è: la scala la leggo dal foglio",
          "the cadastral PDF is fine as it is: I read the scale from the sheet",
        ),
      )}</span></button>
      <button type="button" class="c3c-carica" data-c3c="caricadwg"><b>📐</b>${esc(t("Carica il disegno DWG", "Upload the DWG drawing"))}<span class="c3c-piccolo">${esc(
        t(
          "il file dell'architetto o del geometra: la scala e i nomi delle stanze li prendo dal disegno",
          "the architect's file: scale and room names come from the drawing",
        ),
      )}</span></button>
      ${S.lavoro ? `<div class="c3c-lavoro">⏳ ${esc(S.lavoro)}</div>` : ""}
      ${S.avviso ? `<div class="c3c-lavoro">⚠️ ${esc(S.avviso)}${S.dettaglio ? `<small class="c3c-dettaglio" translate="no">${esc(S.dettaglio)}</small>` : ""}</div>` : ""}
      ${dwgScelta()}
      ${S.dritta && !S.dwg ? nota(`✓ ${esc(t("Raddrizzata di", "Straightened by"))} ${esc(numero(Math.abs(S.angolo)))}° · ${S.dritta.width}×${S.dritta.height} px`) : ""}`,
    ) +
    scheda(
      `✏️ <b>${esc(t("Non hai una planimetria?", "No floor plan?"))}</b>`,
      `${nota(esc(t("Disegnala qui: scrivi le misure esterne del piano, poi dividi le stanze col «Muro dritto».", "Draw it here: enter the floor's outer size, then split the rooms with the «Straight wall».")))}
      <div class="c3c-mano"><label class="c3c-metri"><input class="c3c-in" data-c3c-mano="w" inputmode="decimal" value="${esc(S.aMano.w)}" placeholder="${esc(t("larghezza, es. 12", "width, e.g. 12"))}"> <span>m</span></label>
      <span aria-hidden="true">×</span>
      <label class="c3c-metri"><input class="c3c-in" data-c3c-mano="h" inputmode="decimal" value="${esc(S.aMano.h)}" placeholder="${esc(t("profondità, es. 10", "depth, e.g. 10"))}"> <span>m</span></label></div>
      <button type="button" class="c3c-carica c3c-carica-piccola" data-c3c="amano"${misureAMano() ? "" : " disabled"}><b>✏️</b>${esc(t("Disegnala qui", "Draw it here"))}</button>`,
    ) +
    scheda(
      `💡 <b>${esc(t("Consigli", "Tips"))}</b>`,
      `<div class="c3c-piccolo c3c-righe">${esc(t("Foto dall'alto, foglio intero, buona luce.", "Shoot from above, whole sheet, good light."))}<br>${esc(
        t(
          "Non serve che sia dritta: la raddrizzo io.",
          "It doesn't need to be straight: I'll fix it.",
        ),
      )}<br>${esc(t("Scritte e quote non danno fastidio.", "Text and dimensions are fine."))}</div>${PRIVATO()}`,
    ) +
    avanti(t("Avanti →", "Next →"), Boolean(S.dritta), false)
  );
}

function pScala() {
  const S = state.S;
  return (
    scheda(
      `📏 <b>${esc(t("La scala", "The scale"))}</b>`,
      `${nota(esc(t("Tocca i due estremi di una misura che conosci: una quota scritta, un muro, una porta (di solito 80 cm).", "Tap both ends of a length you know: a written dimension, a wall, a door (usually 80 cm).")))}
      ${nota(S.punti.length === 2 ? `✓ ${esc(t("Due punti scelti", "Two points chosen"))}` : esc(t(`Punti: ${S.punti.length} di 2`, `Points: ${S.punti.length} of 2`)))}
      <label class="c3c-metri"><input class="c3c-in" data-c3c-metri inputmode="decimal" value="${S.metri ? esc(numero(S.metri, 2)) : ""}" placeholder="${esc(t("es. 4,20", "e.g. 4.20"))}"> <span>${esc(t("metri", "metres"))}</span></label>
      ${S.mpp ? nota(esc(t(`1 metro = ${Math.round(1 / S.mpp)} pixel della foto`, `1 metre = ${Math.round(1 / S.mpp)} photo pixels`))) : ""}`,
    ) + avanti(t("Riconosci i muri →", "Find the walls →"), Boolean(S.mpp))
  );
}

function pMuri() {
  const S = state.S,
    c = S.casa;
  const porte = c.aperture.filter((a) => a.tipo === "porta").length,
    fin = c.aperture.filter((a) => a.tipo === "finestra").length;
  const strumenti = [
    ["dritto", "📏", t("Muro dritto", "Straight wall")],
    ["muro", "✏️", t("Muro", "Wall")],
    ["gomma", "🧽", t("Gomma", "Eraser")],
    ["porta", "🚪", t("Porta", "Door")],
    ["finestra", "🪟", t("Finestra", "Window")],
  ];
  const aiuto =
    S.strumento === "dritto"
      ? t(
          "Trascina da un punto all'altro: il muro viene dritto (orizzontale o verticale se ci sei vicino).",
          "Drag from one point to another: the wall comes out straight (snapped when close to level).",
        )
      : S.strumento === "muro"
        ? t(
            "Trascina per disegnare un muro: divide due stanze unite.",
            "Drag to draw a wall: it splits two merged rooms.",
          )
        : S.strumento === "gomma"
          ? t(
              "Trascina per cancellare un pezzo di muro sbagliato.",
              "Drag to erase a wrong piece of wall.",
            )
          : S.strumento === "porta"
            ? t(
                "Tocca un muro per aprirci una porta (80 cm).",
                "Tap a wall to open a door (80 cm).",
              )
            : t(
                "Tocca un muro per aprirci una finestra (120 cm).",
                "Tap a wall to open a window (120 cm).",
              );
  return (
    scheda(
      `🧱 <b>${esc(t("I muri", "The walls"))}</b>`,
      `${nota(esc(t(`Trovati ${c.stanze.length} ambienti, ${porte} porte e ${fin} finestre. Correggi dove serve, poi vai avanti.`, `Found ${c.stanze.length} rooms, ${porte} doors and ${fin} windows. Fix what's needed, then go on.`)))}
      <div class="c3c-strumenti">${strumenti.map(([k, i, n]) => `<button type="button" class="${S.strumento === k ? "si" : ""}" data-c3c-strumento="${k}"><b>${i}</b>${esc(n)}</button>`).join("")}</div>
      <div class="c3c-leg"><span><i style="background:#0f172a"></i>${esc(t("muro", "wall"))}</span><span><i style="background:#22c55e"></i>${esc(t("porta", "door"))}</span><span><i style="background:#0ea5e9"></i>${esc(t("finestra", "window"))}</span><span><i style="background:#bae6fd"></i>${esc(t("stanza", "room"))}</span></div>
      ${nota(esc(aiuto))}`,
    ) + avanti()
  );
}

function sceltaDellaStanza(s) {
  const S = state.S,
    aree = Object.entries(S.registri.aree).sort((a, b) => a[1].localeCompare(b[1]));
  const area = clean(S.aree[s.id]),
    nome = clean(S.nomi[s.id]);
  const voci = aree.length
    ? aree.map(
        ([id, n]) =>
          `<option value="a:${esc(id)}"${area === id ? " selected" : ""}>${esc(n)}</option>`,
      )
    : NOMI_DI_RIPIEGO.map(
        (c) =>
          `<option value="n:${esc(due(c))}"${!area && nome === due(c) ? " selected" : ""}>${esc(due(c))}</option>`,
      );
  const libero =
    nome && !area && !(aree.length ? false : NOMI_DI_RIPIEGO.some((c) => due(c) === nome));
  return `<select class="c3c-in" data-c3c-area="${s.id}"><option value="">${esc(aree.length ? t("— area di Home Assistant —", "— Home Assistant area —") : t("— scegli un nome —", "— pick a name —"))}</option>${voci.join("")}</select>
    <input class="c3c-in" data-c3c-nome="${s.id}" value="${libero ? esc(nome) : ""}" placeholder="${esc(t("o scrivi un nome", "or type a name"))}" autocomplete="off">`;
}

function pStanze() {
  const S = state.S,
    c = S.casa,
    ci = Object.keys(S.registri.aree).length;
  return (
    scheda(
      `🏷️ <b>${esc(t("Le stanze", "The rooms"))}</b>`,
      `${nota(
        esc(
          ci
            ? t(
                "Dai un nome a ogni stanza scegliendo l'area di Home Assistant: così luci, telecamere e sensori di quell'area si propongono da soli.",
                "Name each room by picking its Home Assistant area: lights, cameras and sensors of that area are then suggested by themselves.",
              )
            : t(
                "Dai un nome a ogni stanza. Non ho trovato le aree di Home Assistant: scegli un nome o scrivilo.",
                "Name each room. I couldn't find the Home Assistant areas: pick a name or type one.",
              ),
        ),
      )}
      <div class="c3c-stanze">${c.stanze
        .map(
          (
            s,
            k,
          ) => `<div class="c3c-stanza${S.sel === s.id ? " si" : ""}${S.fuori.has(s.id) ? " fuori" : ""}" data-c3c-stanza="${s.id}">
            <span class="c3c-pall" style="background:${COLORI_STANZE[k % COLORI_STANZE.length]}"></span>
            <div class="c3c-stanza-campi">${sceltaDellaStanza(s)}</div>
            <span class="c3c-m">${esc(numero(s.area))} m²</span>
            <button type="button" class="c3c-ch${S.fuori.has(s.id) ? " si" : ""}" data-c3c-fuori="${s.id}" title="${esc(t("È fuori casa", "It's outside"))}">🌳</button>
          </div>`,
        )
        .join("")}</div>
      ${nota(esc(t("🌳 = è fuori casa (cortile, balcone): le sue aperture diventano finestre.", "🌳 = it's outside (yard, balcony): its openings become windows.")))}`,
    ) + avanti()
  );
}

function sceltaEntitaMarkup(d, ref, stanzaId) {
  const cand = entitaCandidate(d.k, contesto(d.k, stanzaId, d)).slice(0, 40);
  const fuoriElenco = d.entity && !cand.some((x) => x.entity === d.entity);
  const voci = [
    `<option value="">${esc(t("— nessuna per ora —", "— none yet —"))}</option>`,
    ...(fuoriElenco ? [`<option value="${esc(d.entity)}" selected>${esc(d.entity)}</option>`] : []),
    ...cand.map(
      (x) =>
        `<option value="${esc(x.entity)}"${x.entity === d.entity ? " selected" : ""}>${esc(x.nome)} · ${esc(x.entity)}</option>`,
    ),
  ].join("");
  return `<div class="c3c-entita">
      <select class="c3c-in" data-c3c-ent="${esc(ref)}" aria-label="${esc(t("Entità", "Entity"))}">${voci}</select>
      <input class="c3c-in c3c-fisso" data-c3c-mano="${esc(ref)}" value="${fuoriElenco ? esc(d.entity) : ""}" placeholder="${esc(t("o scrivi l'entità (es. light.salone)", "or type the entity (e.g. light.living)"))}" spellcheck="false" autocomplete="off">
    </div>`;
}

function dispositivoMarkup(d, ref, stanzaId, sotto) {
  const D = DISPOSITIVI_3D[d.k],
    S = state.S;
  return `<div class="c3c-disp${d.entity ? " si" : " manca"}${S.selDisp === ref ? " scelto" : ""}" data-c3c-disp="${esc(ref)}">
      <div class="c3c-disp-testa"><span class="c3c-disp-ic">${D.icona}</span><b>${esc(due(D.nome))}</b><em>${esc(sotto)}</em>
        <span class="c3c-stato">${d.entity ? `✓ ${esc(t("collegato", "linked"))}` : esc(t("da collegare", "to link"))}</span>
        <button type="button" class="c3c-x" data-c3c-togli-disp="${esc(ref)}" aria-label="${esc(t("Togli", "Remove"))}">✕</button></div>
      ${sceltaEntitaMarkup(d, ref, stanzaId)}
    </div>`;
}

function contoMarkup() {
  const c = conti();
  if (!c.tutti) return "";
  return `<span class="c3c-conto${c.mancano ? " manca" : ""}">${esc(t(`${c.collegati} collegati · ${c.mancano} mancanti`, `${c.collegati} linked · ${c.mancano} missing`))}</span>`;
}

function statoDelRiconoscitore() {
  const r = state.S.riconoscitore;
  if (r === "carica")
    return `<div class="c3c-lavoro">⏳ ${esc(t("Preparo il riconoscimento degli oggetti, sul dispositivo…", "Getting object recognition ready, on this device…"))}</div>`;
  if (r === "no")
    return `<div class="c3c-lavoro no">${esc(t("Il riconoscimento automatico non è disponibile qui: segna tu arredi e dispositivi toccandoli nella foto.", "Automatic recognition isn't available here: mark furniture and devices by tapping them in the photo."))}</div>`;
  return "";
}

function pFotoStanze() {
  const S = state.S,
    vive = stanzeVive();
  if (!vive.length)
    return (
      scheda(
        `📷 <b>${esc(t("Foto delle stanze", "Room photos"))}</b>`,
        nota(esc(t("Nessuna stanza in casa.", "No rooms indoors."))),
      ) + avanti()
    );
  let s = vive.find((x) => x.id === S.sel);
  if (!s) {
    s = vive[0];
    S.sel = s.id;
    S.fotoSel = 0;
  }
  const foto = S.foto[s.id] || [],
    F = foto[S.fotoSel],
    nome = nomeDi(s.id);
  let html = scheda(
    `📷 <b>${esc(t("Foto delle stanze", "Room photos"))}</b>`,
    `<div class="c3c-ch-list">${vive
      .map(
        (x) =>
          `<button type="button" class="c3c-ch${x.id === s.id ? " si" : ""}" data-c3c-stanzaf="${x.id}">${esc(nomeDi(x.id))}${(S.foto[x.id] || []).length ? ` · ${(S.foto[x.id] || []).length}` : ""}</button>`,
      )
      .join("")}</div>
    <button type="button" class="c3c-carica basso" data-c3c="caricast"><b>➕</b>${esc(t(`Aggiungi foto di ${nome}`, `Add photos of ${nome}`))}</button>
    ${S.lavoro ? `<div class="c3c-lavoro">⏳ ${esc(S.lavoro)}</div>` : ""}
    ${statoDelRiconoscitore()}
    ${foto.length ? `<div class="c3c-miniature">${foto.map((f, i) => `<img src="${f.src}" alt="" class="${i === S.fotoSel ? "si" : ""}" data-c3c-fotosel="${i}">`).join("")}</div>` : ""}
    ${PRIVATO()}`,
  );
  if (F) {
    const frecce = { N: "↑", S: "↓", E: "→", O: "←" };
    html += scheda(
      `🧭 <b>${esc(t("Verso dove guardavi?", "Which way were you facing?"))}</b>`,
      `<div class="c3c-bussola">${["", "N", "", "O", "c", "E", "", "S", ""]
        .map((d) =>
          d === "c"
            ? `<span class="c">${esc(nome)}</span>`
            : d
              ? `<button type="button" class="${F.verso === d ? "si" : ""}" data-c3c-verso="${d}" aria-label="${d}">${frecce[d]}</button>`
              : "<i></i>",
        )
        .join(
          "",
        )}</div>${nota(esc(t("la parete che si vede di fronte nella foto (in alto nella pianta = ↑)", "the wall you see straight ahead in the photo (top of the plan = ↑)")))}`,
    );
    const arredi = F.oggetti
      .map((o, i) => {
        const V = ARREDI_DELLE_FOTO[o.k];
        return `<div class="c3c-trovato">${V?.icona || ""} ${esc(V ? due(V.nome) : o.k)}${o.colore ? `<span class="c3c-col" style="background:${esc(o.colore)}"></span>` : ""}<em>${esc(o.manuale ? t("aggiunto da te", "added by you") : t(`riconosciuto ${Math.round(o.score * 100)}%`, `recognised ${Math.round(o.score * 100)}%`))}</em><button type="button" class="c3c-x" data-c3c-togli="${i}" aria-label="${esc(t("Togli", "Remove"))}">✕</button></div>`;
      })
      .join("");
    html += scheda(
      `🛋️ <b>${esc(t("Arredi", "Furniture"))}</b>`,
      arredi || nota(esc(t("Nessun arredo in questa foto.", "No furniture in this photo."))),
    );
    const disp = F.dispositivi
      .map((d, i) =>
        dispositivoMarkup(
          d,
          `f:${s.id}:${S.fotoSel}:${i}`,
          s.id,
          d.manuale
            ? t("segnato da te", "marked by you")
            : t(
                `riconosciuto ${Math.round((d.score || 0) * 100)}%`,
                `recognised ${Math.round((d.score || 0) * 100)}%`,
              ),
        ),
      )
      .join("");
    html += scheda(
      `🔌 <b>${esc(t("Dispositivi nella foto", "Devices in the photo"))}</b>${contoMarkup()}`,
      `${disp || nota(esc(t("Nessun dispositivo segnato in questa foto.", "No device marked in this photo.")))}
      ${nota(esc(t("Ogni dispositivo risponde a un'entità di Home Assistant: scegli dall'elenco (già filtrato per tipo e stanza), scrivila a mano, o lasciala per dopo.", "Each device answers to a Home Assistant entity: pick it from the list (already filtered by type and room), type it, or leave it for later.")))}`,
    );
    const aggiungi = S.aggiungi;
    const quale = aggiungi
      ? aggiungi.tipo === "arredo"
        ? due(ARREDI_DELLE_FOTO[aggiungi.k].nome)
        : due(DISPOSITIVI_3D[aggiungi.k].nome)
      : "";
    html += scheda(
      `➕ <b>${esc(t("Manca qualcosa?", "Something missing?"))}</b>`,
      `<div class="c3c-piccolo c3c-spazio">${aggiungi ? `${esc(t("Tocca nella foto dove sta:", "Tap where it is in the photo:"))} <b>${esc(quale)}</b>` : esc(t("Scegli cosa e toccalo nella foto.", "Pick what, then tap it in the photo."))}</div>
      <div class="c3c-sotto">${esc(t("Dispositivi", "Devices"))}</div>
      <div>${TIPI_DI_DISPOSITIVO.map((k) => `<button type="button" class="c3c-ch${aggiungi?.tipo === "disp" && aggiungi.k === k ? " si" : ""}" data-c3c-aggd="${k}">${DISPOSITIVI_3D[k].icona} ${esc(due(DISPOSITIVI_3D[k].nome))}</button>`).join("")}</div>
      <div class="c3c-sotto">${esc(t("Arredi", "Furniture"))}</div>
      <div>${ARREDI_A_MANO.map((k) => `<button type="button" class="c3c-ch${aggiungi?.tipo === "arredo" && aggiungi.k === k ? " si" : ""}" data-c3c-agg="${k}">${ARREDI_DELLE_FOTO[k].icona} ${esc(due(ARREDI_DELLE_FOTO[k].nome))}</button>`).join("")}</div>`,
    );
    html += scheda(
      `🎨 <b>${esc(t("Colori dalla foto", "Colours from the photo"))}</b>`,
      `<div class="c3c-tinte"><span><i style="background:${esc(F.pavimento)}"></i>${esc(t("Pavimento", "Floor"))}</span><span><i style="background:${esc(F.pareti)}"></i>${esc(t("Pareti", "Walls"))}</span></div>`,
    );
  }
  return html + avanti();
}

function pDispositivi() {
  const S = state.S,
    tutti = tuttiIDispositivi(),
    vive = stanzeVive();
  const perStanza = vive
    .map((s) => {
      const suoi = tutti.filter((d) => d.stanza === s.id);
      if (!suoi.length) return "";
      return `<div class="c3c-sotto">${esc(nomeDi(s.id))}</div>${suoi
        .map((d) =>
          dispositivoMarkup(
            trova(d.ref),
            d.ref,
            s.id,
            d.daFoto
              ? t("dalla foto", "from a photo")
              : t("aggiunto senza foto", "added without photo"),
          ),
        )
        .join("")}`;
    })
    .join("");
  if (!S.nuovo.stanza || !vive.some((s) => s.id === S.nuovo.stanza))
    S.nuovo.stanza = vive[0]?.id || 0;
  const aggiungi = vive.length
    ? `<div class="c3c-nuovo">
        <select class="c3c-in" data-c3c-nuovo-k>${TIPI_DI_DISPOSITIVO.map((k) => `<option value="${k}"${S.nuovo.k === k ? " selected" : ""}>${DISPOSITIVI_3D[k].icona} ${esc(due(DISPOSITIVI_3D[k].nome))}</option>`).join("")}</select>
        <select class="c3c-in" data-c3c-nuovo-stanza>${vive.map((s) => `<option value="${s.id}"${S.nuovo.stanza === s.id ? " selected" : ""}>${esc(nomeDi(s.id))}</option>`).join("")}</select>
        <button type="button" class="c3c-btn pieno" data-c3c="nuovo">${esc(t("Aggiungi senza foto", "Add without photo"))}</button>
      </div>${nota(esc(t("Va dove si monta di solito (al soffitto, sul muro, in un angolo, sulla finestra): in 3D lo sposti dove vuoi.", "It goes where it's usually mounted (ceiling, wall, corner, window): in 3D you can move it anywhere.")))}`
    : "";
  return (
    scheda(
      `🔗 <b>${esc(t("Dispositivi ed entità", "Devices and entities"))}</b>${contoMarkup()}`,
      `${perStanza || nota(esc(t("Ancora nessun dispositivo: segnali nelle foto delle stanze, o aggiungili qui sotto.", "No devices yet: mark them in the room photos, or add them below.")))}`,
    ) +
    scheda(`➕ <b>${esc(t("Aggiungi un dispositivo", "Add a device"))}</b>`, aggiungi) +
    avanti()
  );
}

function pEsterno() {
  const S = state.S,
    E = S.esterno;
  const chip = (attr, v, testo, si) =>
    `<button type="button" class="c3c-ch${si ? " si" : ""}" data-c3c-${attr}="${v}">${testo}</button>`;
  let forma = `<div>${chip("tipo", "villa", `🏡 ${esc(t("Villa", "House"))}`, S.tipo === "villa")}${chip("tipo", "palazzo", `🏢 ${esc(t("Palazzo", "Apartment block"))}`, S.tipo === "palazzo")}</div>`;
  if (S.tipo === "palazzo") {
    forma += `<div class="c3c-sotto">${esc(t("Piani del palazzo", "Floors of the building"))}</div><div>${[2, 3, 4, 5, 6, 7, 8, 10, 12].map((n) => chip("piani", n, n, E.pianiPalazzo === n)).join("")}</div>
      <div class="c3c-sotto">${esc(t("Il tuo piano", "Your floor"))}</div><div>${Array.from({ length: Math.min(E.pianiPalazzo, 12) }, (_, n) => chip("mio", n, n === 0 ? esc(t("terra", "ground")) : n, E.mioPiano === n)).join("")}</div>`;
  } else {
    forma += `<div class="c3c-sotto">${esc(t("Tetto", "Roof"))}</div><div>${chip("tetto", "falde", esc(t("A falde", "Pitched")), E.tetto === "falde")}${chip("tetto", "piano", esc(t("Piano", "Flat")), E.tetto === "piano")}</div>`;
  }
  const nomi = {
    facciata: t("Facciata", "Facade"),
    persiane: t("Persiane", "Shutters"),
    coppi: t("Tetto", "Roof"),
  };
  return (
    scheda(`🏡 <b>${esc(t("Com'è da fuori", "What it looks like outside"))}</b>`, forma) +
    scheda(
      `📷 <b>${esc(t("Foto della facciata", "Photo of the facade"))}</b>`,
      `<button type="button" class="c3c-carica basso" data-c3c="caricaf"><b>➕</b>${esc(E.foto ? t("Cambia foto", "Change photo") : t("Aggiungi una foto da fuori", "Add a photo from outside"))}</button>
      ${nota(esc(E.foto ? t("Scegli cosa, poi toccalo nella foto per prenderne il colore:", "Pick what, then tap it in the photo to take its colour:") : t("Senza foto scegli i colori qui sotto:", "Without a photo pick the colours below:")))}
      <div class="c3c-tinte">${Object.entries(nomi)
        .map(
          ([k, n]) =>
            `<button type="button" class="${E.scelta === k ? "si" : ""}" data-c3c-scelta="${k}"><i style="background:${esc(E[k])}"></i>${esc(n)}</button>`,
        )
        .join("")}</div>
      ${E.foto ? "" : `<div class="c3c-tinte c3c-spazio-su">${TINTE[E.scelta].map((h) => `<button type="button" data-c3c-col="${h}" aria-label="${h}"><i style="background:${h}"></i></button>`).join("")}</div>`}
      ${PRIVATO()}`,
    ) +
    avanti(t("Crea la casa →", "Create the home →"))
  );
}

function pFine() {
  const S = state.S,
    L = pianoDelLivello(S.livello),
    c = conti();
  const vive = stanzeVive(),
    foto = Object.values(S.foto).flat(),
    arredi = foto.reduce((a, f) => a + f.oggetti.length, 0);
  const altri = S.salvata.piani.filter((p) => p.k !== L.k);
  return (
    scheda(
      `✅ <b>${esc(t(`${due(L.nome)}: pronto`, `${due(L.nome)}: ready`))}</b>`,
      `<div class="c3c-piccolo c3c-righe">${esc(t(`${vive.length} stanze · ${S.casa.aperture.length} porte e finestre`, `${vive.length} rooms · ${S.casa.aperture.length} doors and windows`))}<br>${esc(
        t(
          `${foto.length} foto · ${arredi} arredi messi al loro posto`,
          `${foto.length} photos · ${arredi} pieces of furniture placed`,
        ),
      )}<br>${esc(t(`${c.tutti} dispositivi, ${c.collegati} collegati a un'entità`, `${c.tutti} devices, ${c.collegati} linked to an entity`))}<br>${esc(
        S.tipo === "villa"
          ? t("Villa", "House")
          : t(
              `Palazzo di ${S.esterno.pianiPalazzo} piani`,
              `${S.esterno.pianiPalazzo}-floor building`,
            ),
      )}${altri.length ? `<br>${esc(t("Altri piani:", "Other floors:"))} ${altri.map((p) => esc(p.nome)).join(", ")}` : ""}</div>
      ${S.avviso ? `<div class="c3c-lavoro no">${esc(S.avviso)}</div>` : ""}
      <div class="c3c-riga-btn"><button type="button" class="c3c-btn pieno" data-c3c="salva">🏠 ${esc(t("Salva e apri la casa in 3D", "Save and open the 3D home"))}</button></div>
      <div class="c3c-riga-btn"><button type="button" class="c3c-btn" data-c3c="altro">➕ ${esc(t("Aggiungi un altro piano", "Add another floor"))}</button><button type="button" class="c3c-btn" data-c3c="rifai">↺ ${esc(t("Rifai questo piano", "Redo this floor"))}</button></div>
      ${nota(esc(t("Poi in 3D sposti, ruoti e aggiungi quello che manca.", "Then in 3D you move, rotate and add what's missing.")))}
      ${PRIVATO()}`,
    ) +
    `<div class="c3c-riga-btn"><button type="button" class="c3c-btn" data-c3c="indietro">${esc(t("← Indietro", "← Back"))}</button></div>`
  );
}

function bloccata() {
  const S = state.S;
  if (S.premium === null)
    return scheda(
      `⏳ <b>${esc(t("Un momento", "One moment"))}</b>`,
      nota(esc(t("Controllo la licenza della casa…", "Checking the home's licence…"))),
    );
  return scheda(
    `🔒 <b>${esc(t("Casa 3D", "3D Home"))}</b>`,
    nota(
      esc(
        t(
          "La casa in tre dimensioni è una funzione Premium. Quello che hai già salvato resta salvato.",
          "The 3D home is a Premium feature. What you've already saved stays saved.",
        ),
      ),
    ),
  );
}

function disegnaIlPannello() {
  const S = state.S,
    n = nodo();
  if (!S || !n) return;
  n.dataset.passo = String(S.passo);
  const passi = n.querySelector(".c3c-passi");
  passi.innerHTML = PASSI.map(
    (p, i) =>
      `<button type="button" class="c3c-pillola${i === S.passo ? " si" : i < S.passo ? " fatto" : ""}" data-c3c-p="${i}"${i <= S.passo ? "" : " disabled"}><span class="c3c-passo-n">${i < S.passo ? "✓" : i + 1}</span><span class="c3c-passo-t">${esc(due(p))}</span></button>`,
  ).join("");
  n.querySelector(".c3c-sottotitolo").textContent =
    `${due(pianoDelLivello(S.livello).nome)} · ${t("dalla planimetria e dalle foto · le foto restano sul tuo dispositivo", "from the floor plan and photos · photos stay on your device")}`;
  const pannello = n.querySelector(".c3c-pannello"),
    sopra = pannello.scrollTop;
  if (S.premium !== true) pannello.innerHTML = bloccata();
  else
    pannello.innerHTML = [
      pPlanimetria,
      pScala,
      pMuri,
      pStanze,
      pFotoStanze,
      pDispositivi,
      pEsterno,
      pFine,
    ][S.passo]();
  pannello.scrollTop = sopra;
}

function disegna() {
  disegnaIlPannello();
  disegnaLaTela();
}

/* ── le azioni ────────────────────────────────────────────────────────── */

async function usaPlanimetria(src) {
  const S = state.S;
  S.lavoro = t("Raddrizzo la planimetria…", "Straightening the floor plan…");
  disegnaIlPannello();
  await new Promise((ok) => setTimeout(ok, 30));
  try {
    let img = typeof src === "string" ? await immagine(src) : src;
    const lato = Math.max(img.width, img.height);
    if (lato > 2400) {
      const k = 2400 / lato,
        c = tela2d(Math.round(img.width * k), Math.round(img.height * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      img = c;
    }
    const c0 = tela2d(img.width, img.height),
      q = c0.getContext("2d");
    q.drawImage(img, 0, 0);
    /* Un disegno (DWG, «Disegnala qui») e' gia' dritto: si raddrizzano solo
     * le foto. */
    S.angolo =
      typeof src === "string" ? stimaInclinazione(q.getImageData(0, 0, c0.width, c0.height)) : 0;
    const d = tela2d(img.width, img.height),
      r = d.getContext("2d");
    r.fillStyle = "#3b3a37";
    r.fillRect(0, 0, d.width, d.height);
    r.translate(d.width / 2, d.height / 2);
    r.rotate((S.angolo * Math.PI) / 180);
    r.drawImage(img, -img.width / 2, -img.height / 2);
    Object.assign(S, {
      img,
      dritta: d,
      vetri: null,
      porte: null,
      disegno: false,
      punti: [],
      metri: null,
      mpp: null,
      griglia: null,
      casa: null,
      nomi: {},
      aree: {},
      fuori: new Set(),
      foto: {},
      manuali: [],
      etichette: [],
    });
  } catch (errore) {
    root.console?.warn?.("[DashboardModern] Casa 3D: planimetria", errore);
  }
  S.lavoro = "";
  disegna();
}

/* ── dal disegno: DWG e «Disegnala qui» ─────────────────────────────── */

let pdfjs = null;
async function caricaPdfjs() {
  if (!pdfjs)
    pdfjs = import(/* @vite-ignore */ daServire(PDFJS, "pdf.min.js")).then((m) => {
      m.GlobalWorkerOptions.workerSrc = daServire(PDFJS_LAVORO, "pdf.worker.min.js");
      return m;
    });
  try {
    return await pdfjs;
  } catch (errore) {
    pdfjs = null;
    throw errore;
  }
}

/* Il PDF della planimetria (il catasto lo da' cosi'): la prima pagina,
 * disegnata nitida. Se sul foglio c'e' scritta la scala («Scala 1:200») la
 * casa e' gia' in metri, e si va dritti ai muri: sul catasto non ci sono
 * quote da toccare. Senza scala si passa dai due punti, come per una foto. */
async function usaPdf(file) {
  const S = state.S;
  Object.assign(S, {
    dwg: null,
    avviso: "",
    dettaglio: "",
    lavoro: t("Apro il PDF…", "Opening the PDF…"),
  });
  disegnaIlPannello();
  try {
    const [lib, dati] = await Promise.all([caricaPdfjs(), file.arrayBuffer()]);
    const documento = await lib.getDocument({ data: new Uint8Array(dati) }).promise;
    const pagina = await documento.getPage(1);
    const uno = pagina.getViewport({ scale: 1 });
    const zoom = 2400 / Math.max(uno.width, uno.height);
    const vista = pagina.getViewport({ scale: zoom });
    const tela = tela2d(Math.round(vista.width), Math.round(vista.height));
    const g = tela.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, tela.width, tela.height);
    await pagina.render({ canvasContext: g, viewport: vista }).promise;
    let scala = 0;
    try {
      const testo = await pagina.getTextContent();
      scala = scalaScritta(testo.items.map((i) => i.str).join(" "));
    } catch (_errore) {}
    documento.destroy?.();
    S.lavoro = "";
    await usaPlanimetria(tela);
    if (scala) {
      /* un punto PDF e' 1/72 di pollice: la larghezza del foglio in metri,
       * per la scala, sui pixel della tela */
      const foglio = (uno.width / 72) * 0.0254 * scala;
      S.daScala = scala;
      return pronta(foglio / tela.width);
    }
    S.avviso = t(
      "Sul PDF non ho trovato la scala: tocca i due capi di una misura che conosci.",
      "No scale found on the PDF: tap both ends of a length you know.",
    );
    disegna();
  } catch (errore) {
    root.console?.warn?.("[DashboardModern] Casa 3D: PDF", errore);
    S.lavoro = "";
    S.dettaglio = perche(errore);
    S.avviso = t(
      "Questo PDF non si apre. Prova con una schermata della pagina.",
      "This PDF can't be opened. Try a screenshot of the page.",
    );
    disegna();
  }
}

/* Il motore dei DWG, scaricato da noi: una volta sola, senza cache, e dato
 * al lettore gia' in mano.
 *
 * Lasciato fare al lettore, il file lo chiedeva due volte: prima «in
 * streaming», che vuole il tipo `application/wasm` — e il servitore dell'app
 * sul telefono quel tipo non lo conosce — poi, rifiutata la prima, di nuovo
 * tutto intero, con la cache del browser in mezzo che si era tenuta mezzo
 * file e chiedeva «e' cambiato?». Dentro l'app finiva in «both async and
 * sync fetching of the wasm failed», che non dice ne' cosa ne' perche'. Cosi'
 * la strada e' una, e se non va si sa come: il codice e la risposta di chi
 * l'ha data. */
async function scaricaIlMotore(dove, prendi = root.fetch?.bind(root)) {
  let ultimo = null;
  for (let volta = 0; volta < 2; volta++) {
    let risposta;
    try {
      risposta = await prendi(dove, { credentials: "same-origin", cache: "no-store" });
    } catch (errore) {
      ultimo = new Error(`libredwg-web.wasm: ${perche(errore) || "rete"}`);
      continue;
    }
    if (!risposta.ok) {
      let detto = "";
      try {
        detto = perche(await risposta.text()).slice(0, 100);
      } catch (_errore) {
        /* Senza corpo basta il codice. */
      }
      ultimo = new Error(`libredwg-web.wasm: HTTP ${risposta.status}${detto ? ` ${detto}` : ""}`);
      /* Un «no» e' un no: chiederlo di nuovo non lo cambia. Solo chi non ha
       * risposto in tempo (5xx) merita la seconda volta. */
      if (risposta.status < 500) break;
      continue;
    }
    const byte = new Uint8Array(await risposta.arrayBuffer());
    /* «\0asm»: senza, e' una pagina d'errore col 200 davanti. */
    if (byte.length < 8 || byte[0] !== 0 || byte[1] !== 0x61 || byte[2] !== 0x73 || byte[3] !== 0x6d)
      throw new Error(`libredwg-web.wasm: ${byte.length} byte, non e' WebAssembly`);
    return byte;
  }
  throw ultimo;
}

let libreDwg = null;
async function caricaLibreDwg() {
  if (!libreDwg)
    libreDwg = Promise.all([
      import(/* @vite-ignore */ `${LIBREDWG}dist/libredwg-web.js`),
      scaricaIlMotore(`${LIBREDWG}wasm/libredwg-web.wasm`),
    ]).then(([m, wasmBinary]) =>
      m
        .createModule({
          wasmBinary,
          locateFile: (nome) => `${LIBREDWG}wasm/${nome}`,
        })
        .then((modulo) => ({ lib: m.LibreDwg.createByWasmInstance(modulo), tipo: m.Dwg_File_Type })),
    );
  try {
    return await libreDwg;
  } catch (errore) {
    libreDwg = null;
    throw errore;
  }
}

/* La causa vera di un guasto, in poche parole, sotto l'avviso: «Questo DWG
 * non si legge» dal telefono e' stato a lungo un indovinello, perche' dal
 * telefono la console non si vede. Cosi' chi lo vede lo puo' fotografare. */
function perche(errore) {
  const testo = String(errore?.message || errore || "")
    .replace(/\s+/g, " ")
    .trim();
  return testo ? testo.slice(0, 160) : "";
}

async function usaDwg(file) {
  const S = state.S;
  Object.assign(S, {
    dwg: null,
    avviso: "",
    dettaglio: "",
    lavoro: t("Leggo il disegno DWG…", "Reading the DWG drawing…"),
  });
  disegnaIlPannello();
  /* Due guasti diversi, due messaggi diversi: se non arriva il lettore (11 MB,
   * dalla rete) il disegno non c'entra, e dire «salvalo in una versione piu'
   * vecchia» mandava a cercare il problema nel posto sbagliato. */
  let motore;
  try {
    motore = await caricaLibreDwg();
  } catch (errore) {
    root.console?.warn?.("[DashboardModern] Casa 3D: lettore DWG", errore);
    S.lavoro = "";
    S.dettaglio = perche(errore);
    S.avviso = t(
      "Il lettore dei DWG non si è scaricato: controlla la connessione e riprova.",
      "The DWG reader didn't download: check the connection and try again.",
    );
    return disegna();
  }
  try {
    const { lib, tipo } = motore;
    const dati = await file.arrayBuffer();
    const letto = lib.dwg_read_data(dati, tipo.DWG);
    if (!letto) throw new Error("dwg");
    let db;
    try {
      db = lib.convert(letto);
    } finally {
      lib.dwg_free(letto);
    }
    const piani = pianiDelDisegno(pezziDelDisegno(db), {
      insunits: Number(db?.header?.INSUNITS) || 0,
    });
    S.lavoro = "";
    if (!piani.length) {
      S.avviso = t(
        "Nel disegno non ho trovato una pianta: muri e linee mancano o stanno in blocchi.",
        "No floor plan found in the drawing: walls and lines are missing or inside blocks.",
      );
      return disegna();
    }
    if (piani.length === 1) return usaPianoDwg(piani[0]);
    S.dwg = {
      piani: piani.map((p) => ({
        ...p,
        anteprima: tavolaDelPiano(p, 260).tela.toDataURL("image/png"),
      })),
    };
    disegna();
    nodo()?.querySelector(".c3c-dwg")?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    return;
  } catch (errore) {
    root.console?.warn?.("[DashboardModern] Casa 3D: DWG", errore);
    S.lavoro = "";
    S.dettaglio = perche(errore);
    S.avviso = t(
      "Questo DWG non si legge. Prova a salvarlo da AutoCAD in una versione più vecchia, o carica una foto.",
      "This DWG can't be read. Try saving it from AutoCAD as an older version, or upload a photo.",
    );
    return disegna();
  }
}

/* Il piano del disegno su una tela bianca: muri neri, in scala nota. */
function tavolaDelPiano(p, lungo = 2400) {
  const margine = 0.6 / p.metriPerUnita;
  const w = p.x1 - p.x0 + 2 * margine,
    h = p.y1 - p.y0 + 2 * margine;
  const ppu = lungo / Math.max(w, h);
  const tela = tela2d(Math.max(8, Math.round(w * ppu)), Math.max(8, Math.round(h * ppu)));
  const g = tela.getContext("2d");
  const X = (x) => (x - p.x0 + margine) * ppu,
    Y = (y) => (p.y1 + margine - y) * ppu;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, tela.width, tela.height);
  g.fillStyle = g.strokeStyle = "#000";
  g.lineCap = g.lineJoin = "round";
  g.lineWidth = Math.max(1.5, (0.035 * ppu) / p.metriPerUnita);
  /* Gli infissi, se il disegno li tiene in uno strato loro, su una tela a
   * parte: dicono dove sono le finestre, senza indovinarle. */
  const vetri = p.soloMuri ? tela2d(tela.width, tela.height) : null,
    gv = vetri?.getContext("2d");
  /* Le porte (e i basculanti) su un'altra tela: non sono muri, ma dicono
   * quale varco largo e' un'apertura da chiudere. */
  const porte = p.soloMuri ? tela2d(tela.width, tela.height) : null,
    gp = porte?.getContext("2d");
  for (const q of [gv, gp].filter(Boolean)) {
    q.strokeStyle = "#000";
    q.lineCap = "round";
    q.lineWidth = g.lineWidth;
  }
  for (const l of p.linee) {
    /* Se il disegno separa i muri in uno strato loro, le altre righe (scale,
     * viste, porte aperte, simboli) restano fuori: fitte come sono, la
     * chiusura le farebbe diventare muri. */
    const ruolo = p.soloMuri ? ruoloDelloStrato(l.strato) : "muro";
    if (ruolo === "altro") continue;
    const su = ruolo === "infisso" ? gv : ruolo === "porta" ? gp : g;
    su.beginPath();
    l.forEach(([x, y], i) => (i ? su.lineTo(X(x), Y(y)) : su.moveTo(X(x), Y(y))));
    su.stroke();
  }
  for (const c of p.piene) {
    if (p.soloMuri && ruoloDelloStrato(c.strato) === "altro") continue;
    g.beginPath();
    c.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
    g.closePath();
    g.fill();
  }
  const etichette = p.scritte
    .filter((e) => eNomeDiStanza(e.t))
    .map((e) => ({ t: nomeDaScritta(e.t), x: X(e.x), y: Y(e.y) }));
  return { tela, vetri, porte, mpp: p.metriPerUnita / ppu, etichette };
}

async function usaPianoDwg(p) {
  const S = state.S;
  if (!p) return;
  const { tela, vetri, porte, mpp, etichette } = tavolaDelPiano(p);
  S.dwg = null;
  await usaPlanimetria(tela);
  Object.assign(S, { vetri, porte, disegno: true });
  return pronta(mpp, etichette);
}

/* Dopo un disegno la scala e' gia' nota: si va dritti ai muri. */
function pronta(mpp, etichette = []) {
  const S = state.S;
  Object.assign(S, { mpp, etichette, avviso: "", dettaglio: "" });
  S.passo = P.scala;
  vaiAvanti();
}

function misureAMano() {
  const S = state.S,
    n = (v) => parseFloat(String(v || "").replace(",", "."));
  const w = n(S?.aMano?.w),
    h = n(S?.aMano?.h);
  return w >= 2 && w <= 60 && h >= 2 && h <= 60 ? { w, h } : null;
}

/* «Disegnala qui»: un contorno di muri esterni nelle misure scritte. Le
 * stanze si dividono poi col «Muro dritto». */
async function disegnaAMano() {
  const S = state.S,
    m = misureAMano();
  if (!m) return;
  const ppm = Math.min(120, 2000 / Math.max(m.w, m.h) / 1.1),
    margine = 0.6,
    spesso = 0.3;
  const tela = tela2d(Math.round((m.w + 2 * margine) * ppm), Math.round((m.h + 2 * margine) * ppm));
  const g = tela.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, tela.width, tela.height);
  g.strokeStyle = "#000";
  g.lineWidth = spesso * ppm;
  g.strokeRect(
    (margine + spesso / 2) * ppm,
    (margine + spesso / 2) * ppm,
    (m.w - spesso) * ppm,
    (m.h - spesso) * ppm,
  );
  S.dwg = null;
  await usaPlanimetria(tela);
  Object.assign(S, { strumento: "dritto", disegno: true });
  return pronta(1 / ppm);
}

/* I piani di un DWG che ne ha piu' d'uno: si sceglie quale. */
function dwgScelta() {
  const S = state.S;
  if (!S.dwg?.piani?.length) return "";
  return `<div class="c3c-dwg"><b>${esc(t("Nel disegno ci sono più piani: quale fai adesso?", "The drawing has several floors: which one now?"))}</b>
    <div class="c3c-dwg-piani">${S.dwg.piani
      .map(
        (p, i) =>
          `<button type="button" class="c3c-dwg-piano" data-c3c-dwg="${i}"><img alt="" src="${p.anteprima}"><span>${esc(p.nome || t(`Piano ${i + 1}`, `Floor ${i + 1}`))}</span><small>${esc(numero(p.larghezzaMetri, 1))} × ${esc(numero(p.profonditaMetri, 1))} m</small></button>`,
      )
      .join("")}</div></div>`;
}

function riconosci() {
  const S = state.S;
  if (!S.griglia) {
    const im = S.dritta.getContext("2d").getImageData(0, 0, S.dritta.width, S.dritta.height);
    /* le tele a parte del disegno (infissi, porte), come mappe di pixel */
    const mappa = (tela) => {
      if (tela?.width !== im.width || tela.height !== im.height) return null;
      const d = tela.getContext("2d").getImageData(0, 0, im.width, im.height).data,
        m = new Uint8Array(im.width * im.height);
      for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 64 ? 1 : 0;
      return m;
    };
    S.griglia = grigliaDeiMuri(inchiostro(im), im.width, im.height, S.mpp, {
      vetri: mappa(S.vetri),
      porte: mappa(S.porte),
      disegno: S.disegno === true,
    });
  }
  ricalcola();
}

/* Dopo un ritocco ai muri le stanze si riconoscono di nuovo: nomi, foto e
 * dispositivi restano alla stanza fatta degli stessi «cuori». */
function ricalcola() {
  const S = state.S;
  const vecchi = S.casa
    ? Object.fromEntries(
        S.casa.stanze.map((s) => [
          s.cuori.join(","),
          {
            id: s.id,
            nome: S.nomi[s.id],
            area: S.aree[s.id],
            fuori: S.fuori.has(s.id),
            foto: S.foto[s.id],
          },
        ]),
      )
    : {};
  S.casa = riconosciDaFoto(S.griglia);
  const nomi = {},
    aree = {},
    fuori = new Set(),
    foto = {},
    daA = {};
  for (const s of S.casa.stanze) {
    const v = vecchi[s.cuori.join(",")];
    if (!v) continue;
    daA[v.id] = s.id;
    if (v.nome) nomi[s.id] = v.nome;
    if (v.area) aree[s.id] = v.area;
    if (v.fuori) fuori.add(s.id);
    if (v.foto) foto[s.id] = v.foto;
  }
  /* I nomi scritti nel disegno (DWG): una stanza senza nome prende la
   * scritta che le sta dentro. */
  if (S.etichette?.length && S.mpp) {
    const dalDisegno = nomiDalleScritte(S.casa, S.etichette, PASSO / S.mpp),
      giaViste = new Set(Object.values(daA));
    for (const [id, nome] of Object.entries(dalDisegno)) {
      if (nomi[id]) continue;
      nomi[id] = nome;
      /* «cortile interno», «giardino»: il disegno dice che e' fuori. Solo
       * per una stanza nuova: se l'utente l'ha gia' rimessa dentro, resta. */
      if (!giaViste.has(Number(id)) && eNomeDiFuori(nome)) fuori.add(Number(id));
    }
  }
  Object.assign(S, { nomi, aree, fuori, foto });
  S.manuali = S.manuali.filter((d) => daA[d.stanza]).map((d) => ({ ...d, stanza: daA[d.stanza] }));
  if (S.sel && !S.casa.stanze.some((s) => s.id === S.sel)) S.sel = null;
}

function aggiornaScala() {
  const S = state.S;
  if (S.punti.length === 2 && S.metri) {
    const px = Math.hypot(S.punti[1][0] - S.punti[0][0], S.punti[1][1] - S.punti[0][1]);
    S.mpp = px > 4 ? S.metri / px : null;
  } else S.mpp = null;
  S.griglia = null;
}

function pennello(ev) {
  const S = state.S;
  const [x, y] = daSchermo(ev),
    cx = Math.round(x + S.ritaglio.x0),
    cy = Math.round(y + S.ritaglio.y0),
    { W, H, muro, barriera } = S.griglia;
  const r = S.strumento === "muro" ? 2 : 4;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const xx = cx + dx,
        yy = cy + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const i = yy * W + xx;
      muro[i] = barriera[i] = S.strumento === "muro" ? 1 : 0;
    }
  const g = pezzo(".c3c-tela").getContext("2d"),
    s = state.vista.s;
  g.fillStyle = S.strumento === "muro" ? "#0f172a" : "#f8fafc";
  g.fillRect((x - r) * s, (y - r) * s, 2 * r * s, 2 * r * s);
}

function apriVarco(x, y, largo) {
  const S = state.S,
    cx = Math.round(x + S.ritaglio.x0),
    cy = Math.round(y + S.ritaglio.y0),
    { W, H, muro, barriera } = S.griglia;
  const m = (xx, yy) => (xx >= 0 && yy >= 0 && xx < W && yy < H ? muro[yy * W + xx] : 0);
  let oriz = 0,
    vert = 0;
  for (let d = -15; d <= 15; d++) {
    oriz += m(cx + d, cy);
    vert += m(cx, cy + d);
  }
  const L = Math.round(largo / PASSO / 2);
  for (let a = -L; a <= L; a++)
    for (let b = -12; b <= 12; b++) {
      const xx = oriz >= vert ? cx + a : cx + b,
        yy = oriz >= vert ? cy + b : cy + a;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const i = yy * W + xx;
      muro[i] = 0;
      barriera[i] = largo > 1 ? (b === 0 ? 1 : 0) : 0;
    }
}

async function aggiungiFotoStanza(src) {
  const S = state.S,
    stanza = S.sel;
  const img = await immagine(src);
  const F = {
    src,
    img,
    w: img.naturalWidth || img.width,
    h: img.naturalHeight || img.height,
    oggetti: [],
    dispositivi: [],
    verso: "N",
  };
  F.pavimento = coloreZona(img, F.w * 0.2, F.h * 0.82, F.w * 0.8, F.h * 0.95);
  F.pareti = coloreZona(img, F.w * 0.25, F.h * 0.12, F.w * 0.75, F.h * 0.3);
  (S.foto[stanza] ||= []).push(F);
  S.fotoSel = S.foto[stanza].length - 1;
  S.lavoro = t(
    "Cerco arredi e dispositivi nella foto…",
    "Looking for furniture and devices in the photo…",
  );
  disegna();
  const modello = await riconoscitore();
  if (modello) {
    try {
      const visti = oggettiDaCoco(await modello.detect(img, 20, 0.3));
      for (const o of visti.arredi) {
        const [x, y, w, h] = o.box;
        F.oggetti.push({
          ...o,
          colore: coloreZona(img, x + w * 0.3, y + h * 0.3, x + w * 0.7, y + h * 0.7),
        });
      }
      for (const d of visti.dispositivi)
        F.dispositivi.push({ ...d, entity: proponi(d.k, stanza, null) });
    } catch (errore) {
      root.console?.warn?.("[DashboardModern] Casa 3D: riconoscimento", errore);
    }
  }
  S.lavoro = "";
  if (state.S === S) disegna();
}

function segnaNellaFoto(x, y) {
  const S = state.S,
    F = (S.foto[S.sel] || [])[S.fotoSel],
    A = S.aggiungi;
  if (!F || !A) return;
  if (A.tipo === "arredo") {
    const w = F.w * 0.22,
      h = F.h * 0.14;
    F.oggetti.push({
      k: A.k,
      box: [x - w / 2, y - h / 2, w, h],
      colore: coloreIn(F.img, x, y),
      manuale: true,
    });
  } else {
    const w = F.w * 0.1,
      h = F.h * 0.07,
      d = { k: A.k, box: [x - w / 2, y - h / 2, w, h], manuale: true, entity: "" };
    d.entity = proponi(A.k, S.sel, d);
    F.dispositivi.push(d);
    S.selDisp = `f:${S.sel}:${S.fotoSel}:${F.dispositivi.length - 1}`;
  }
  S.aggiungi = null;
}

/* Il piano di adesso, come si salva. */
function pianoDiAdesso() {
  const S = state.S,
    fotoDerivate = {};
  /* delle foto si passano solo i dati ricavati: l'immagine resta qui */
  for (const [id, sue] of Object.entries(S.foto))
    fotoDerivate[id] = sue.map((F) => ({
      verso: F.verso,
      w: F.w,
      h: F.h,
      oggetti: F.oggetti,
      dispositivi: F.dispositivi,
      pavimento: F.pavimento,
      pareti: F.pareti,
    }));
  const nomi = {};
  for (const s of S.casa.stanze) nomi[s.id] = nomeDi(s.id);
  return pianoDaRiconoscimento({
    casa: S.casa,
    nomi,
    aree: S.aree,
    fuori: S.fuori,
    foto: fotoDerivate,
    dispositivi: S.manuali,
    livello: S.livello,
  });
}

function salva() {
  const S = state.S,
    piano = pianoDiAdesso();
  if (!piano) {
    S.avviso = t("Non trovo nessuna stanza da salvare.", "I can't find any room to save.");
    return null;
  }
  const { foto: _foto, scelta: _scelta, ...esterno } = S.esterno;
  const casa = casa3dPulita({
    ...aggiungiPiano({ ...S.salvata, tipo: S.tipo, esterno }, piano),
    attiva: true,
  });
  writeJsonIfChanged(CHIAVE_CASA3D, casa);
  S.salvata = casa;
  S.avviso = "";
  return casa;
}

function ridisegnaLaCasa() {
  try {
    if (typeof root.__DM_CASA3D_RIDISEGNA__ === "function") root.__DM_CASA3D_RIDISEGNA__();
    else root.dispatchEvent?.(new Event("dashboardmodern:persistence-restored"));
  } catch (_errore) {}
}

function nuovoPiano(livello) {
  const S = state.S,
    salvata = S.salvata,
    tipo = S.tipo,
    esterno = S.esterno;
  state.S = {
    ...statoNuovo(salvata, livello),
    tipo,
    esterno: { ...esterno, foto: null },
    premium: S.premium,
    registri: S.registri,
    riconoscitore: S.riconoscitore,
  };
}

function prossimoLivello() {
  const fatti = new Set(state.S.salvata.piani.map((p) => p.livello));
  for (const n of [0, 1, 2, 3, 4, 5, -1]) if (!fatti.has(n)) return n;
  return state.S.livello + 1;
}

function vaiAvanti() {
  const S = state.S;
  if (S.passo === P.scala) {
    S.lavoro = t("Riconosco muri e stanze…", "Finding walls and rooms…");
    disegnaIlPannello();
    setTimeout(() => {
      try {
        riconosci();
        S.passo = P.muri;
      } catch (errore) {
        root.console?.warn?.("[DashboardModern] Casa 3D: muri", errore);
      }
      S.lavoro = "";
      disegna();
    }, 30);
    return;
  }
  if (S.passo === P.muri && !S.casa?.stanze?.length) return;
  S.passo = Math.min(P.fine, S.passo + 1);
  S.aggiungi = null;
}

async function alClic(ev) {
  const S = state.S;
  if (!S) return;
  const b = ev.target.closest("button,[data-c3c-fotosel],[data-c3c-stanza]");
  if (!b || !nodo()?.contains(b)) return;
  const d = b.dataset,
    n = nodo();
  if (d.c3c === "chiudi") return chiudi();
  if (S.premium !== true) return;
  switch (d.c3c) {
    case "carica":
      return n.querySelector("[data-c3c-file='pianta']").click();
    case "caricadwg":
      return n.querySelector("[data-c3c-file='dwg']").click();
    case "amano":
      return disegnaAMano();
    case "caricast":
      return n.querySelector("[data-c3c-file='stanza']").click();
    case "caricaf":
      return n.querySelector("[data-c3c-file='facciata']").click();
    case "indietro":
      S.passo = Math.max(0, S.passo - 1);
      S.aggiungi = null;
      break;
    case "avanti":
      vaiAvanti();
      break;
    case "nuovo": {
      const k = TIPI_DI_DISPOSITIVO.includes(S.nuovo.k) ? S.nuovo.k : "luce";
      const nuovo = { k, stanza: S.nuovo.stanza, entity: "", nome: "" };
      nuovo.entity = proponi(k, S.nuovo.stanza, nuovo);
      S.manuali.push(nuovo);
      S.selDisp = `m:${S.manuali.length - 1}`;
      break;
    }
    case "salva":
      if (salva()) {
        chiudi(true);
        ridisegnaLaCasa();
        return;
      }
      break;
    case "altro":
      if (salva()) nuovoPiano(prossimoLivello());
      break;
    case "rifai":
      nuovoPiano(S.livello);
      break;
    default:
      break;
  }
  if (d.c3cP !== undefined && Number(d.c3cP) <= S.passo) {
    S.passo = Number(d.c3cP);
    S.aggiungi = null;
  }
  if (d.c3cLivello !== undefined) S.livello = Number(d.c3cLivello);
  if (d.c3cDwg !== undefined && S.dwg) return usaPianoDwg(S.dwg.piani[Number(d.c3cDwg)]);
  if (d.c3cStrumento) S.strumento = d.c3cStrumento;
  if (d.c3cStanza && !ev.target.closest("select,input,[data-c3c-fuori]"))
    S.sel = Number(d.c3cStanza);
  if (d.c3cStanza && ev.target.closest("select,input")) return;
  if (d.c3cFuori) {
    const id = Number(d.c3cFuori);
    if (S.fuori.has(id)) S.fuori.delete(id);
    else S.fuori.add(id);
  }
  if (d.c3cStanzaf) {
    S.sel = Number(d.c3cStanzaf);
    S.fotoSel = 0;
    S.aggiungi = null;
  }
  if (d.c3cFotosel !== undefined) S.fotoSel = Number(d.c3cFotosel);
  if (d.c3cVerso) S.foto[S.sel][S.fotoSel].verso = d.c3cVerso;
  if (d.c3cAgg)
    S.aggiungi =
      S.aggiungi?.k === d.c3cAgg && S.aggiungi.tipo === "arredo"
        ? null
        : { tipo: "arredo", k: d.c3cAgg };
  if (d.c3cAggd)
    S.aggiungi =
      S.aggiungi?.k === d.c3cAggd && S.aggiungi.tipo === "disp"
        ? null
        : { tipo: "disp", k: d.c3cAggd };
  if (d.c3cTogli !== undefined) S.foto[S.sel][S.fotoSel].oggetti.splice(Number(d.c3cTogli), 1);
  if (d.c3cTogliDisp) togli(d.c3cTogliDisp);
  if (d.c3cTipo) S.tipo = d.c3cTipo === "palazzo" ? "palazzo" : "villa";
  if (d.c3cPiani) {
    S.esterno.pianiPalazzo = Number(d.c3cPiani);
    S.esterno.mioPiano = Math.min(S.esterno.mioPiano, S.esterno.pianiPalazzo - 1);
  }
  if (d.c3cMio !== undefined) S.esterno.mioPiano = Number(d.c3cMio);
  if (d.c3cTetto) S.esterno.tetto = d.c3cTetto;
  if (d.c3cScelta) S.esterno.scelta = d.c3cScelta;
  if (d.c3cCol) S.esterno[S.esterno.scelta] = d.c3cCol;
  if (state.S) disegna();
}

/* Dopo aver scelto o scritto un'entita' la scheda si aggiorna dov'e', senza
 * ridisegnare il pannello: chi ha scritto e poi tocca «Avanti» deve trovare
 * il tasto sotto il dito, non uno nuovo messo al suo posto. */
function aggiornaLaScheda(ref, disp, aMano) {
  const n = nodo();
  for (const card of n.querySelectorAll("[data-c3c-disp]")) {
    if (card.dataset.c3cDisp !== ref) {
      card.classList.remove("scelto");
      continue;
    }
    card.classList.toggle("si", Boolean(disp.entity));
    card.classList.toggle("manca", !disp.entity);
    card.classList.add("scelto");
    const stato = card.querySelector(".c3c-stato");
    if (stato)
      stato.textContent = disp.entity
        ? `✓ ${t("collegato", "linked")}`
        : t("da collegare", "to link");
    const scelta = card.querySelector("[data-c3c-ent]");
    if (aMano && scelta) {
      if (disp.entity && ![...scelta.options].some((o) => o.value === disp.entity))
        scelta.add(new Option(disp.entity, disp.entity), 1);
      scelta.value = disp.entity;
    }
    const mano = card.querySelector("[data-c3c-mano]");
    if (!aMano && mano) mano.value = "";
  }
  const c = conti();
  for (const conto of n.querySelectorAll(".c3c-conto")) {
    conto.classList.toggle("manca", c.mancano > 0);
    conto.textContent = t(
      `${c.collegati} collegati · ${c.mancano} mancanti`,
      `${c.collegati} linked · ${c.mancano} missing`,
    );
  }
  disegnaLaTela();
}

function alCambio(ev) {
  const S = state.S,
    e = ev.target,
    d = e.dataset;
  if (!S || !nodo()?.contains(e)) return;
  if (d.c3cArea !== undefined) {
    const id = Number(d.c3cArea),
      v = clean(e.value);
    if (v.startsWith("a:")) {
      S.aree[id] = v.slice(2);
      S.nomi[id] = S.registri.aree[v.slice(2)] || "";
    } else if (v.startsWith("n:")) {
      S.aree[id] = "";
      S.nomi[id] = v.slice(2);
    } else {
      S.aree[id] = "";
      S.nomi[id] = "";
    }
    return disegna();
  }
  if (d.c3cNome !== undefined) {
    const id = Number(d.c3cNome),
      v = clean(e.value).slice(0, 40);
    /* un nome che e' quello di un'area si porta dietro l'area */
    const area = Object.entries(S.registri.aree).find(
      ([, n]) => n.toLowerCase() === v.toLowerCase(),
    );
    S.nomi[id] = area ? area[1] : v;
    S.aree[id] = area ? area[0] : "";
    const scelta = nodo().querySelector(`[data-c3c-area="${id}"]`);
    if (scelta) scelta.value = area ? `a:${area[0]}` : "";
    return disegnaLaTela();
  }
  if (d.c3cEnt !== undefined || d.c3cMano !== undefined) {
    const ref = d.c3cEnt ?? d.c3cMano,
      disp = trova(ref),
      v = clean(e.value);
    if (!disp) return;
    if (d.c3cMano !== undefined && v && !entita(v)) {
      e.setCustomValidity?.(t("Non è un'entità (dominio.nome)", "Not an entity (domain.name)"));
      e.reportValidity?.();
      return;
    }
    e.setCustomValidity?.("");
    disp.entity = entita(v);
    S.selDisp = ref;
    return aggiornaLaScheda(ref, disp, d.c3cMano !== undefined);
  }
  if (d.c3cNuovoK !== undefined) S.nuovo.k = e.value;
  if (d.c3cNuovoStanza !== undefined) S.nuovo.stanza = Number(e.value);
  if (d.c3cFile !== undefined) return alFile(e);
}

async function alFile(e) {
  const S = state.S,
    quale = e.dataset.c3cFile,
    file = [...(e.files || [])];
  e.value = "";
  if (!file.length) return;
  if (
    quale === "pianta" &&
    (/\.pdf$/i.test(file[0].name || "") || file[0].type === "application/pdf")
  )
    return usaPdf(file[0]);
  if (quale === "pianta") return usaPlanimetria(await leggi(file[0]));
  if (quale === "dwg") return usaDwg(file[0]);
  if (quale === "stanza") {
    for (const f of file) if (state.S === S) await aggiungiFotoStanza(await leggi(f));
    return;
  }
  if (quale === "facciata") {
    S.esterno.foto = await immagine(await leggi(file[0]));
    disegna();
  }
}

function alScrivere(ev) {
  const S = state.S,
    e = ev.target;
  if (S && e.dataset.c3cMano) {
    S.aMano[e.dataset.c3cMano] = clean(e.value);
    const b = nodo().querySelector("[data-c3c='amano']");
    if (b) b.disabled = !misureAMano();
    return;
  }
  if (!S || e.dataset.c3cMetri === undefined) return;
  const v = parseFloat(clean(e.value).replace(",", "."));
  S.metri = v > 0 && v < 500 ? v : null;
  aggiornaScala();
  const b = nodo().querySelector("[data-c3c='avanti']");
  if (b) b.disabled = !S.mpp;
  disegnaLaTela();
}

let premuto = false;

function giu(ev) {
  const S = state.S;
  if (!S || S.premium !== true) return;
  const [x, y] = daSchermo(ev);
  if (S.passo === P.muri && (S.strumento === "porta" || S.strumento === "finestra")) {
    apriVarco(x, y, S.strumento === "porta" ? 0.8 : 1.2);
    ricalcola();
    return disegna();
  }
  if (S.passo === P.muri) {
    premuto = true;
    pezzo(".c3c-tela").setPointerCapture?.(ev.pointerId);
    if (S.strumento === "dritto") {
      S.inizio = [x + S.ritaglio.x0, y + S.ritaglio.y0];
      return;
    }
    return pennello(ev);
  }
  if (S.passo === P.scala) {
    if (S.punti.length >= 2) S.punti = [];
    S.punti.push([x, y]);
    aggiornaScala();
    return disegna();
  }
  if (S.passo === P.stanze || S.passo === P.fine || S.passo === P.dispositivi) {
    const cx = Math.round(x + S.ritaglio.x0),
      cy = Math.round(y + S.ritaglio.y0),
      v = S.casa.tipo[cy * S.griglia.W + cx];
    if (v > 0) {
      S.sel = v;
      if (S.passo === P.dispositivi) S.nuovo.stanza = v;
      disegna();
    }
    return;
  }
  if (S.passo === P.foto && S.aggiungi) {
    segnaNellaFoto(x, y);
    return disegna();
  }
  if (S.passo === P.esterno && S.esterno.foto) {
    S.esterno[S.esterno.scelta] = coloreIn(S.esterno.foto, x, y);
    disegna();
  }
}

function muovi(ev) {
  if (premuto && state.S?.passo === P.muri && state.S.strumento !== "dritto") pennello(ev);
}

function su(ev) {
  if (!premuto) return;
  premuto = false;
  const S = state.S;
  if (S?.passo !== P.muri) return;
  if (S.strumento === "dritto" && S.inizio && ev && pezzo(".c3c-tela")) {
    const [x, y] = daSchermo(ev);
    muroDritto(S.inizio, [x + S.ritaglio.x0, y + S.ritaglio.y0]);
    S.inizio = null;
  }
  ricalcola();
  disegna();
}

/* Un muro dritto nella griglia, da un punto all'altro; vicino all'orizzontale
 * o alla verticale si raddrizza del tutto. Spesso come un tramezzo. */
function muroDritto([x0, y0], [x1, y1]) {
  const S = state.S,
    { W, H, muro, barriera } = S.griglia;
  let dx = x1 - x0,
    dy = y1 - y0;
  if (Math.abs(dx) > 4 * Math.abs(dy)) dy = 0;
  else if (Math.abs(dy) > 4 * Math.abs(dx)) dx = 0;
  const passi = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
  for (let k = 0; k <= passi; k++) {
    const cx = Math.round(x0 + (dx * k) / passi),
      cy = Math.round(y0 + (dy * k) / passi);
    for (let oy = -2; oy <= 2; oy++)
      for (let ox = -2; ox <= 2; ox++) {
        const xx = cx + ox,
          yy = cy + oy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        muro[yy * W + xx] = barriera[yy * W + xx] = 1;
      }
  }
}

/* ── aprire e chiudere ───────────────────────────────────────────────── */

function montaLaTela() {
  let n = nodo();
  if (n) return n;
  n = doc.createElement("div");
  n.id = ID;
  n.setAttribute("role", "dialog");
  n.setAttribute("aria-modal", "true");
  n.innerHTML = `<div class="c3c-pagina">
      <header class="c3c-testa">
        <div class="c3c-testa-testo"><h1>${esc(t("Crea la tua casa", "Create your home"))}</h1><div class="c3c-sottotitolo"></div></div>
        <nav class="c3c-passi"></nav>
        <button type="button" class="c3c-chiudi" data-c3c="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button>
      </header>
      <div class="c3c-palco"><canvas class="c3c-tela"></canvas><div class="c3c-sopra"></div></div>
      <div class="c3c-pannello"></div>
    </div>
    <input type="file" data-c3c-file="pianta" accept="image/*,.pdf,application/pdf" hidden>
    <input type="file" data-c3c-file="stanza" accept="image/*" multiple hidden>
    <input type="file" data-c3c-file="facciata" accept="image/*" hidden>
    <input type="file" data-c3c-file="dwg" accept=".dwg,image/vnd.dwg,application/acad,application/x-dwg" hidden>`;
  doc.body.appendChild(n);
  n.addEventListener("click", alClic);
  n.addEventListener("change", alCambio);
  n.addEventListener("input", alScrivere);
  const tela = n.querySelector(".c3c-tela");
  tela.addEventListener("pointerdown", giu);
  tela.addEventListener("pointermove", muovi);
  root.addEventListener?.("pointerup", su);
  return n;
}

function chiudi(salvato = false) {
  const S = state.S;
  if (!salvato && S && S.passo > 0 && S.premium === true) {
    const ok = root.confirm?.(
      t(
        "Chiudere? Quello che non hai salvato si perde (le foto non si salvano mai).",
        "Close? Anything not saved is lost (photos are never saved).",
      ),
    );
    if (ok === false) return;
  }
  state.S = null;
  premuto = false;
  root.removeEventListener?.("pointerup", su);
  nodo()?.remove();
  doc?.documentElement?.classList?.remove("dm-c3c-aperta");
}

function alTasto(ev) {
  if (ev.key === "Escape" && state.S) chiudi();
}

function alRidimensionare() {
  if (state.S) disegnaLaTela();
}

/**
 * Apre la procedura. `piano` (la chiave di un piano, o il piano stesso) dice
 * quale rifare; senza, si parte dal primo che manca.
 */
export function apriCreaCasa({ piano = null } = {}) {
  if (!doc?.body) return false;
  let admin = false;
  try {
    admin = puoConfigurare();
  } catch (_errore) {}
  if (!admin) return false;
  installaLoStile();
  const salvata = casaSalvata();
  const chiave = clean(typeof piano === "string" ? piano : piano?.k);
  const dato = salvata.piani.find((p) => p.k === chiave);
  const livello = dato
    ? dato.livello
    : Number.isFinite(Number(piano?.livello))
      ? Number(piano.livello)
      : salvata.piani.length
        ? null
        : 0;
  state.S = statoNuovo(salvata, 0);
  state.S.registri = registri();
  state.S.riconoscitore = state.modello ? "pronto" : "fermo";
  state.S.livello = livello ?? prossimoLivello();
  state.S.premium = premiumRicordato() === true || state.premium === true ? true : null;
  premiumDellaCasa()
    .then((premium) => {
      state.premium = premium === true;
      if (!state.S) return;
      const prima = state.S.premium;
      state.S.premium = premium === true;
      if (prima !== state.S.premium) disegna();
    })
    .catch(() => {
      if (state.S && state.S.premium === null) {
        state.S.premium = false;
        disegna();
      }
    });
  montaLaTela();
  doc.documentElement.classList.add("dm-c3c-aperta");
  nodo().dataset.tema =
    doc.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  disegna();
  return true;
}

/* ── il foglio ────────────────────────────────────────────────────────── */

function installaLoStile() {
  const Q = `#${ID}`;
  installStyle(
    "dm-casa3d-crea-style",
    `
    html.dm-c3c-aperta,html.dm-c3c-aperta body{overflow:hidden!important}
    ${Q}{--c3c-accento:#0ea5e9;--c3c-accento-rgb:14,165,233;--c3c-fondo:#0c1322;--c3c-vetro:rgba(22,31,54,.86);--c3c-bordo:#263453;
      --c3c-s2:#1b2540;--c3c-s3:#212d4c;--c3c-testo:#e6edf7;--c3c-fioco:#92a4c2;--c3c-ombra:0 8px 30px rgba(0,0,0,.35);
      position:fixed;inset:0;z-index:2147483200;background:var(--c3c-fondo);color:var(--c3c-testo);
      font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
    ${Q}[data-tema="light"]{--c3c-fondo:#eef2f7;--c3c-vetro:#ffffff;--c3c-bordo:#e2e8f0;--c3c-s2:#f8fafc;--c3c-s3:#eef2f7;
      --c3c-testo:#0a0e17;--c3c-fioco:#64748b;--c3c-ombra:0 1px 2px rgba(15,23,42,.04),0 4px 12px rgba(15,23,42,.06)}
    ${Q} *{box-sizing:border-box}
    ${Q} button{font:inherit;color:inherit}
    ${Q} .c3c-pagina{display:grid;grid-template-columns:minmax(0,1fr) 380px;grid-template-rows:auto minmax(0,1fr);gap:18px;padding:22px;height:100%}
    ${Q} .c3c-testa{grid-column:1/-1;display:flex;align-items:center;gap:14px;min-width:0}
    ${Q} .c3c-testa-testo{flex:0 1 auto;min-width:0}
    ${Q} .c3c-testa h1{margin:0;font-family:'Oswald',system-ui,sans-serif;font-weight:700;font-size:28px;letter-spacing:.02em;text-transform:uppercase;line-height:1.1}
    ${Q} .c3c-sottotitolo{color:var(--c3c-fioco);font-size:13px;margin-top:2px}
    ${Q} .c3c-passi{display:flex;gap:4px;margin-left:auto;background:var(--c3c-vetro);border:1px solid var(--c3c-bordo);border-radius:100px;padding:4px;box-shadow:var(--c3c-ombra);overflow-x:auto;max-width:100%;scrollbar-width:none}
    ${Q} .c3c-pillola{display:inline-flex;align-items:center;padding:7px 12px;border-radius:100px;font-size:12px;font-weight:700;color:var(--c3c-fioco);border:0;background:none;white-space:nowrap;cursor:pointer}
    ${Q} .c3c-pillola:disabled{cursor:default;opacity:.75}
    ${Q} .c3c-pillola.si{background:rgba(var(--c3c-accento-rgb),.16);color:var(--c3c-accento)}
    ${Q} .c3c-passo-n{display:inline-flex;width:20px;height:20px;border-radius:50%;align-items:center;justify-content:center;font-size:11px;background:var(--c3c-s3);margin-right:6px}
    ${Q} .c3c-pillola.fatto .c3c-passo-n{background:#16a34a;color:#fff}
    ${Q} .c3c-pillola.si .c3c-passo-n{background:var(--c3c-accento);color:#fff}
    ${Q} .c3c-chiudi{flex:0 0 auto;width:42px;height:42px;border-radius:14px;border:1px solid var(--c3c-bordo);background:var(--c3c-vetro);font-size:16px;cursor:pointer;box-shadow:var(--c3c-ombra)}
    ${Q} .c3c-palco{position:relative;display:flex;align-items:center;justify-content:center;min-height:0;border-radius:24px;overflow:hidden;
      background:radial-gradient(ellipse at 50% 40%,#1b2b4f,#0d1528 75%);border:1px solid var(--c3c-bordo);box-shadow:var(--c3c-ombra)}
    ${Q} .c3c-tela{display:block;max-width:100%;max-height:100%;border-radius:14px;cursor:crosshair;touch-action:none}
    ${Q} .c3c-sopra{position:absolute;inset:0;pointer-events:none}
    ${Q} .c3c-pannello{display:flex;flex-direction:column;gap:14px;min-height:0;overflow-y:auto;padding-bottom:8px;-webkit-overflow-scrolling:touch}
    ${Q} .c3c-scheda{background:var(--c3c-vetro);border:1px solid var(--c3c-bordo);border-radius:20px;box-shadow:var(--c3c-ombra);padding:16px;flex:0 0 auto}
    ${Q} .c3c-titolo{font-family:'Oswald',system-ui,sans-serif;font-weight:500;font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:var(--c3c-fioco);margin-bottom:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    ${Q} .c3c-titolo b{color:var(--c3c-testo);font-weight:500}
    ${Q} .c3c-dettaglio{display:block;margin-top:6px;font-size:11px;font-weight:500;opacity:.75;word-break:break-word}
    ${Q} .c3c-piccolo{font-size:12px;color:var(--c3c-fioco);line-height:1.5;margin-top:8px}
    ${Q} .c3c-righe{line-height:1.8}
    ${Q} .c3c-spazio{margin:0 0 8px}
    ${Q} .c3c-spazio-su{margin-top:8px}
    ${Q} .c3c-sotto{font-size:11px;font-weight:700;color:var(--c3c-fioco);text-transform:uppercase;letter-spacing:.06em;margin:12px 0 6px}
    ${Q} .c3c-privato{margin-top:12px;padding:9px 11px;border-radius:12px;font-size:11.5px;line-height:1.45;color:var(--c3c-fioco);background:rgba(22,163,74,.10);border:1px solid rgba(22,163,74,.35)}
    ${Q} .c3c-lavoro{margin-top:10px;padding:8px 11px;border-radius:12px;font-size:12px;font-weight:700;background:rgba(var(--c3c-accento-rgb),.12);color:var(--c3c-accento)}
    ${Q} .c3c-lavoro.no{background:rgba(245,158,11,.12);color:#f59e0b}
    ${Q} .c3c-carica{display:block;width:100%;border:2px dashed var(--c3c-bordo);border-radius:18px;padding:22px;text-align:center;cursor:pointer;background:var(--c3c-s2);font-weight:700;font-size:13px}
    ${Q} .c3c-carica b{display:block;font-size:30px;margin-bottom:6px}
    ${Q} .c3c-carica+.c3c-carica{margin-top:10px}
    ${Q} .c3c-carica-piccola{padding:12px;margin-top:10px}
    ${Q} .c3c-carica-piccola b{display:inline;font-size:18px;margin:0 6px 0 0}
    ${Q} .c3c-carica:disabled{opacity:.5;cursor:default}
    ${Q} .c3c-mano{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}
    ${Q} .c3c-mano .c3c-in{width:9em}
    ${Q} .c3c-dwg{margin-top:12px;display:grid;gap:10px}
    ${Q} .c3c-dwg-piani{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}
    ${Q} .c3c-dwg-piano{display:grid;gap:4px;justify-items:center;padding:8px;border-radius:14px;border:1px solid var(--c3c-bordo);background:var(--c3c-s2);cursor:pointer;color:inherit;font:inherit;font-weight:700;font-size:12px;text-align:center}
    ${Q} .c3c-dwg-piano img{width:100%;aspect-ratio:1;object-fit:contain;background:#fff;border-radius:8px}
    ${Q} .c3c-dwg-piano small{font-weight:500;opacity:.75}
    ${Q} .c3c-carica.basso{padding:12px;margin-top:8px}
    ${Q} .c3c-carica.basso b{font-size:22px}
    ${Q} .c3c-carica .c3c-piccolo{display:block;font-weight:400;margin-top:6px}
    ${Q} .c3c-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 14px;border-radius:12px;background:var(--c3c-s2);border:1px solid var(--c3c-bordo);font-weight:700;font-size:13px;cursor:pointer}
    ${Q} .c3c-btn.pieno{background:var(--c3c-accento);border-color:var(--c3c-accento);color:#fff}
    ${Q} .c3c-btn:disabled{opacity:.4;cursor:default}
    ${Q} .c3c-riga-btn{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    ${Q} .c3c-strumenti{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
    ${Q} .c3c-strumenti button{padding:10px 4px;border-radius:12px;background:var(--c3c-s2);border:1px solid var(--c3c-bordo);text-align:center;font-size:11.5px;cursor:pointer}
    ${Q} .c3c-strumenti button b{display:block;font-size:20px}
    ${Q} .c3c-strumenti button.si{border-color:#38bdf8;background:rgba(14,165,233,.14)}
    ${Q} .c3c-leg{display:flex;gap:10px;flex-wrap:wrap;font-size:11.5px;color:var(--c3c-fioco);margin-top:10px}
    ${Q} .c3c-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px;border:1px solid rgba(148,163,184,.4)}
    ${Q} .c3c-stanze{display:grid;gap:6px}
    ${Q} .c3c-stanza{display:flex;align-items:center;gap:8px;padding:8px;border-radius:12px;background:var(--c3c-s2);border:1px solid var(--c3c-bordo);cursor:pointer}
    ${Q} .c3c-stanza.si{border-color:#38bdf8}
    ${Q} .c3c-stanza.fuori{opacity:.7}
    ${Q} .c3c-pall{width:14px;height:14px;border-radius:4px;flex:none}
    ${Q} .c3c-stanza-campi{flex:1;display:grid;gap:5px;min-width:0}
    ${Q} .c3c-m{font-size:11px;color:var(--c3c-fioco);width:52px;text-align:right;flex:none}
    ${Q} .c3c-stanza .c3c-ch{margin:0}
    ${Q} .c3c-in{width:100%;min-width:0;padding:7px 8px;border-radius:9px;background:var(--c3c-s3);color:var(--c3c-testo);border:1px solid var(--c3c-bordo);font:inherit;font-size:12.5px}
    ${Q} .c3c-in:invalid,${Q} .c3c-in.no{border-color:#ef4444}
    ${Q} .c3c-fisso{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
    ${Q} .c3c-metri{display:flex;align-items:center;gap:8px;margin-top:10px}
    ${Q} .c3c-metri .c3c-in{width:110px;padding:9px;font-size:15px;font-weight:700}
    ${Q} .c3c-ch{padding:6px 10px;border-radius:100px;border:1px solid var(--c3c-bordo);background:var(--c3c-s2);font-size:12px;cursor:pointer;display:inline-block;margin:0 4px 6px 0}
    ${Q} .c3c-ch.si{background:#0ea5e9;border-color:#0ea5e9;color:#fff;font-weight:700}
    ${Q} .c3c-ch-list{display:flex;flex-wrap:wrap}
    ${Q} .c3c-miniature{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}
    ${Q} .c3c-miniature img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:8px;border:2px solid transparent;cursor:pointer}
    ${Q} .c3c-miniature img.si{border-color:#38bdf8}
    ${Q} .c3c-trovato{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:10px;background:var(--c3c-s2);margin-bottom:5px;font-size:12px}
    ${Q} .c3c-col{width:16px;height:16px;border-radius:4px;border:1px solid rgba(255,255,255,.2);flex:none}
    ${Q} .c3c-trovato em{margin-left:auto;font-style:normal;font-size:10.5px;color:var(--c3c-fioco)}
    ${Q} .c3c-x{flex:none;padding:2px 7px;border-radius:100px;border:1px solid var(--c3c-bordo);background:var(--c3c-s3);font-size:11px;cursor:pointer}
    ${Q} .c3c-disp{padding:9px;border-radius:12px;background:var(--c3c-s2);border:1px solid var(--c3c-bordo);margin-bottom:7px}
    ${Q} .c3c-disp.manca{border-color:rgba(245,158,11,.55)}
    ${Q} .c3c-disp.scelto{box-shadow:0 0 0 2px rgba(var(--c3c-accento-rgb),.6)}
    ${Q} .c3c-disp-testa{display:flex;align-items:center;gap:7px;font-size:12.5px;min-width:0}
    ${Q} .c3c-disp-testa b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
    ${Q} .c3c-disp-testa em{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1 1 auto}
    ${Q} .c3c-stato{white-space:nowrap;flex:none}
    ${Q} .c3c-disp-ic{font-size:18px}
    ${Q} .c3c-disp-testa em{font-style:normal;font-size:10.5px;color:var(--c3c-fioco)}
    ${Q} .c3c-stato{margin-left:auto;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:100px;color:#b45309;background:rgba(245,158,11,.16)}
    ${Q} .c3c-disp.si .c3c-stato{color:#16a34a;background:rgba(22,163,74,.16)}
    ${Q} .c3c-entita{display:grid;gap:5px;margin-top:7px}
    ${Q} .c3c-conto{margin-left:auto;padding:3px 9px;border-radius:999px;font-family:'Inter',system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:0;text-transform:none;color:#16a34a;background:rgba(22,163,74,.16)}
    ${Q} .c3c-conto.manca{color:#f59e0b;background:rgba(245,158,11,.16)}
    ${Q} .c3c-nuovo{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px}
    ${Q} .c3c-nuovo .c3c-btn{grid-column:1/-1;justify-content:center}
    ${Q} .c3c-bussola{display:grid;grid-template-columns:repeat(3,36px);grid-template-rows:repeat(3,36px);gap:4px;justify-content:center;margin:6px 0}
    ${Q} .c3c-bussola button{display:flex;align-items:center;justify-content:center;border-radius:10px;background:var(--c3c-s2);border:1px solid var(--c3c-bordo);cursor:pointer;font-size:16px}
    ${Q} .c3c-bussola button.si{background:#0ea5e9;color:#fff}
    ${Q} .c3c-bussola .c{display:flex;align-items:center;justify-content:center;text-align:center;font-size:10px;color:var(--c3c-fioco);overflow:hidden}
    ${Q} .c3c-tinte{display:flex;gap:6px;flex-wrap:wrap}
    ${Q} .c3c-tinte>span,${Q} .c3c-tinte>button{display:flex;align-items:center;gap:6px;padding:5px 9px;border-radius:100px;background:var(--c3c-s2);border:1px solid var(--c3c-bordo);font-size:11.5px;cursor:pointer}
    ${Q} .c3c-tinte i{width:14px;height:14px;border-radius:50%;border:1px solid rgba(255,255,255,.25)}
    ${Q} .c3c-tinte .si{border-color:#38bdf8}
    ${Q} .c3c-box{position:absolute;border:2px solid #38bdf8;border-radius:6px;background:rgba(14,165,233,.08)}
    ${Q} .c3c-box b{position:absolute;left:-2px;top:-24px;background:#0ea5e9;color:#fff;font-size:11px;padding:3px 7px;border-radius:7px;white-space:nowrap}
    ${Q} .c3c-box.manuale{border-color:#a855f7;background:rgba(168,85,247,.1)}
    ${Q} .c3c-box.manuale b{background:#a855f7}
    ${Q} .c3c-box.disp{border-color:#f59e0b;background:rgba(245,158,11,.12);border-style:dashed}
    ${Q} .c3c-box.disp b{background:#d97706;top:auto;bottom:-24px}
    ${Q} .c3c-box.disp.si{border-color:#22c55e;border-style:solid}
    ${Q} .c3c-box.disp.si b{background:#16a34a}
    ${Q} .c3c-box.scelto{box-shadow:0 0 0 3px rgba(255,255,255,.7)}
    ${Q} .c3c-punto{position:absolute;width:16px;height:16px;border-radius:50%;background:#0ea5e9;border:3px solid #fff;transform:translate(-50%,-50%);box-shadow:0 2px 8px rgba(0,0,0,.4)}
    ${Q} .c3c-misura{position:absolute;padding:4px 9px;border-radius:8px;background:#0ea5e9;color:#fff;font-weight:700;font-size:12px;transform:translate(-50%,-140%)}
    ${Q} .c3c-nome-st{position:absolute;transform:translate(-50%,-50%);padding:4px 9px;border-radius:9px;background:rgba(15,23,42,.85);color:#fff;font-size:11.5px;font-weight:700;white-space:nowrap}
    ${Q} .c3c-nome-st i{font-style:normal;font-weight:500;color:#94a3b8;margin-left:5px}
    ${Q} .c3c-disp-pianta{position:absolute;transform:translate(-50%,-50%);width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:14px;background:#fff;border:2px solid #f59e0b;box-shadow:0 2px 6px rgba(0,0,0,.35)}
    ${Q} .c3c-disp-pianta.si{border-color:#16a34a}
    ${Q} .c3c-disp-pianta.scelto{box-shadow:0 0 0 3px rgba(14,165,233,.8)}
    /* Telefono, Fold aperto, schermo basso: scorre tutta la pagina. Prima la
     * testata e il disegno stavano fermi e i dati scorrevano in una striscia
     * di 150 px sotto («come faccio a vedere i dati, e' impossibile»). Il
     * disegno resta grande; dentro il disegno il dito disegna, fuori scorre. */
    @media (max-width:900px),(max-height:640px){
      ${Q}{overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
      ${Q} .c3c-pagina{height:auto;min-height:100%;grid-template-rows:auto auto auto}
      ${Q} .c3c-palco{height:min(60vh,560px);min-height:280px}
      ${Q} .c3c-pannello{overflow:visible;min-height:auto}
    }
    @media (max-height:640px) and (min-width:901px){
      ${Q} .c3c-pagina{grid-template-rows:auto auto}
      ${Q} .c3c-palco{height:max(320px,calc(100vh - 140px))}
    }
    @media (max-width:900px){
      ${Q} .c3c-pagina{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto auto;gap:12px;padding:12px}
      ${Q} .c3c-testa{flex-wrap:wrap}
      ${Q} .c3c-testa-testo{flex:1 1 0}
      ${Q} .c3c-testa h1{font-size:21px}
      ${Q} .c3c-passi{order:3;flex-basis:100%;margin-left:0}
      ${Q} .c3c-passo-t{display:none}
      ${Q} .c3c-pillola.si .c3c-passo-t{display:inline}
    }
    `,
  );
}

/* ── l'accensione ─────────────────────────────────────────────────────── */

export function installCasa3DCrea() {
  if (!doc || state.installed) return false;
  state.installed = true;
  root.__DM_CASA3D_CREA__ = apriCreaCasa;
  doc.addEventListener?.("keydown", alTasto);
  root.addEventListener?.("resize", alRidimensionare);
  return true;
}

senzaCadere(installCasa3DCrea);
