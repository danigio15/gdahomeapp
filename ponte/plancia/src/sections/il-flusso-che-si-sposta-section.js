/* I cerchi del Flusso energetico si spostano (#379).
 *
 * «Vedi come poter spostare le cose anche nei disegni, tipo i tubi nel solare
 * termico, i cerchi nel Flusso energetico.» Nell'anteprima dell'Energia, nel Config, ogni
 * cerchio ha la sua maniglia: Solare, Rete, Batteria, Casa e ogni carico.
 *
 * Chi fa cosa:
 *   - i quattro principali si mettono con un foglio a parte, uno per il
 *     computer (sopra i 768 pixel) e uno per il telefono, che vince sui posti
 *     di serie (anche quelli `!important` del telefono);
 *   - i carichi li mette il modello (`conLePosizioni` in
 *     `core/energy-flow-topology.js`), che e' quello che la scena disegna gia';
 *   - le linee fra i principali le ridisegna `posaLeLinee`, solo quelle con un
 *     capo spostato, tenendo il `d` di serie in `data-dm-d-di-serie` per
 *     rimetterlo quando la scelta va via.
 *
 * Senza una scelta non si scrive niente: nessun foglio, nessun `d`, lo stesso
 * modello. Una disposizione vale per le tre viste (Istantaneo, Giorno, Mese).
 */
import {
  CERCHI_PRINCIPALI,
  DISEGNO_DELL_ENERGIA,
  conLePosizioni,
  nodoDelCarico,
} from "../core/energy-flow-topology.js";
import { curvaFraCerchi } from "../core/posizioni-nei-disegni.js";
import { posizioniInUso, registraIlDisegno } from "./disegni-che-si-spostano-section.js";
import { doc, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_FLUSSO_CHE_SI_SPOSTA__";
const FOGLIO_ID = "dm-flusso-posizioni";
const STILE_ID = "dm-flusso-che-si-sposta";
const TELEFONO = "(max-width: 768px)";
const state = (root[KEY] ||= { serie: {}, misure: null, alle: 0, ridisegna: null });

/** Le tre viste, col suffisso dei loro cerchi e delle loro linee. */
export const VISTE_DEL_FLUSSO = Object.freeze([
  { id: "view-ist", suffisso: "", periodo: "instant" },
  { id: "view-day", suffisso: "-day", periodo: "day" },
  { id: "view-month", suffisso: "-month", periodo: "month" },
]);

const CERCHIO = Object.freeze({
  solare: "n-solar",
  rete: "n-grid",
  batteria: "n-battery",
  casa: "n-home",
});

/* Dove stanno i quattro quando non si possono misurare (il foglio di serie). */
const DI_SERIE = Object.freeze({
  computer: {
    solare: { x: 50, y: 15 },
    rete: { x: 25, y: 33 },
    batteria: { x: 75, y: 33 },
    casa: { x: 50, y: 50 },
  },
  telefono: {
    solare: { x: 50, y: 15 },
    rete: { x: 20, y: 28 },
    batteria: { x: 80, y: 28 },
    casa: { x: 50, y: 46 },
  },
});

/* Le linee fra i principali: da chi a chi, e come piegano. Quelle di serie
 * vanno prima in orizzontale e poi verso il cerchio; Solare → Casa e' diritta;
 * l'arco fra Rete e Batteria passa sopra, e i suoi due versi sono la stessa
 * strada. */
const ARCHI = Object.freeze([
  { linea: "line-solar-home", da: "solare", a: "casa", piega: 0 },
  { linea: "line-grid-home", da: "rete", a: "casa" },
  { linea: "line-battery-home", da: "batteria", a: "casa" },
  { linea: "line-solar-grid", da: "solare", a: "rete" },
  { linea: "line-solar-battery", da: "solare", a: "batteria" },
  { linea: "line-grid-battery", da: "rete", a: "batteria", sopra: true },
  { linea: "line-battery-grid", da: "batteria", a: "rete", sopra: true },
]);

const PIEGA = 0.2;

export function varianteDelFlusso() {
  return root.matchMedia?.(TELEFONO)?.matches ? "telefono" : "computer";
}

/** Le scelte delle due varianti, come le vuole il modello. */
export function posizioniDelFlusso() {
  return {
    computer: posizioniInUso(DISEGNO_DELL_ENERGIA, "computer"),
    telefono: posizioniInUso(DISEGNO_DELL_ENERGIA, "telefono"),
  };
}

const nessunaScelta = (P) => !P || !Object.keys(P).length;

/** La vista che si vede, col suo palco. */
function vistaInScena() {
  for (const vista of VISTE_DEL_FLUSSO) {
    const palco = doc?.getElementById(vista.id)?.querySelector?.(".flow-stage");
    const r = palco?.getBoundingClientRect?.();
    if (r && r.width > 10 && r.height > 10) return { ...vista, palco };
  }
  return null;
}

function visibile(el) {
  const r = el?.getBoundingClientRect?.();
  return Boolean(r && r.width > 1 && r.height > 1);
}

function raggioDi(el) {
  const r = el.getBoundingClientRect();
  return Math.max(r.width, r.height) / 2;
}

/* Il centro di un cerchio adesso, in percento del palco: il suo `left` e
 * `top` (i cerchi stanno col centro li', `translate(-50%, -50%)`). */
function centroMisurato(el, palco) {
  const stile = doc.defaultView?.getComputedStyle?.(el);
  const x = Number.parseFloat(stile?.left);
  const y = Number.parseFloat(stile?.top);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !palco.clientWidth || !palco.clientHeight)
    return null;
  return {
    x: Math.round((x / palco.clientWidth) * 10000) / 100,
    y: Math.round((y / palco.clientHeight) * 10000) / 100,
  };
}

/** Dove sta di serie un cerchio principale: misurato quando non ha una
 * scelta (e ricordato), se no l'ultimo misurato o il foglio di serie. */
function serieDel(id, variante, vista = vistaInScena()) {
  const P = posizioniInUso(DISEGNO_DELL_ENERGIA, variante);
  if (!P[id] && vista && variante === varianteDelFlusso()) {
    const el = doc.getElementById(`${CERCHIO[id]}${vista.suffisso}`);
    const c = el && visibile(el) ? centroMisurato(el, vista.palco) : null;
    if (c) {
      state.serie[variante] = { ...state.serie[variante], [id]: c };
      return c;
    }
  }
  return state.serie[variante]?.[id] || DI_SERIE[variante][id];
}

/** Le misure del palco che si vede, per il modello: si leggono solo quando
 * c'e' una scelta, e una volta per giro (le tre viste hanno le stesse). */
export function misureDelFlusso() {
  const variante = varianteDelFlusso();
  const P = posizioniInUso(DISEGNO_DELL_ENERGIA, variante);
  if (nessunaScelta(P)) return {};
  const adesso = Date.now();
  if (state.misure && adesso - state.alle < 80 && state.misure.variante === variante)
    return state.misure.perIlModello;
  const vista = vistaInScena();
  if (!vista) return {};
  const { palco } = vista;
  const principali = {};
  for (const id of CERCHI_PRINCIPALI) {
    const el = doc.getElementById(`${CERCHIO[id]}${vista.suffisso}`);
    if (!el || !visibile(el)) continue;
    principali[id] = { ...(P[id] || serieDel(id, variante, vista)), r: raggioDi(el) };
  }
  const raggi = {};
  for (const el of palco.querySelectorAll("[data-dm-flow-node]")) {
    if (visibile(el)) raggi[nodoDelCarico(el.dataset.dmFlowNode)] = raggioDi(el);
  }
  const casa = principali.casa || { ...serieDel("casa", variante, vista), r: 62 };
  const chiave = variante === "telefono" ? "mobile" : "desktop";
  const perIlModello = {
    [chiave]: {
      larghezza: palco.clientWidth,
      altezza: palco.clientHeight,
      casa: { ...serieDel("casa", variante, vista), r: casa.r },
      raggi,
      principali,
    },
  };
  state.misure = { variante, perIlModello };
  state.alle = adesso;
  return perIlModello;
}

/* ── il foglio dei quattro principali ──────────────────────────────────── */

function regoleDeiPrincipali(P) {
  return CERCHI_PRINCIPALI.filter((id) => P?.[id])
    .map((id) => {
      const ids = VISTE_DEL_FLUSSO.map((v) => `#${CERCHIO[id]}${v.suffisso}`).join(",");
      return `html body #page-energy .flow-stage > :is(${ids}){left:${P[id].x}% !important;top:${P[id].y}% !important}`;
    })
    .join("\n");
}

export function mettiIPrincipali() {
  if (!doc?.head) return;
  const { computer, telefono } = posizioniDelFlusso();
  const css = [
    [computer, "(min-width: 769px)"],
    [telefono, TELEFONO],
  ]
    .map(([P, media]) => {
      const regole = regoleDeiPrincipali(P);
      return regole ? `@media ${media} {\n${regole}\n}` : "";
    })
    .filter(Boolean)
    .join("\n");
  let foglio = doc.getElementById(FOGLIO_ID);
  if (!css) {
    foglio?.remove();
    return;
  }
  if (!foglio) {
    foglio = doc.createElement("style");
    foglio.id = FOGLIO_ID;
    doc.head.append(foglio);
  }
  if (foglio.textContent !== css) foglio.textContent = css;
}

/* ── le linee fra i principali ─────────────────────────────────────────── */

function rimettiDiSerie(linea) {
  const serie = linea?.getAttribute?.("data-dm-d-di-serie");
  if (serie === null || serie === undefined) return;
  if (linea.getAttribute("d") !== serie) linea.setAttribute("d", serie);
  linea.removeAttribute("data-dm-d-di-serie");
}

/** Le linee fra Solare, Rete, Batteria e Casa con un capo spostato, dal bordo
 * di un cerchio al bordo dell'altro; le altre restano quelle disegnate a mano
 * (e tornano quelle, quando la scelta va via). Prima di `mirrorLegacyMainFlows`,
 * che copia la strada nel binario sotto la linea. */
export function posaLeLinee() {
  if (!doc) return;
  const variante = varianteDelFlusso();
  const scelte = posizioniDelFlusso();
  /* Il caso di tutti i giorni: nessuna scelta, e nessuna linea da rimettere.
   * Non si cerca niente nella pagina. */
  if (nessunaScelta(scelte.computer) && nessunaScelta(scelte.telefono) && !state.lineeToccate)
    return;
  state.lineeToccate = false;
  const vista = scelte[variante] && !nessunaScelta(scelte[variante]) ? vistaInScena() : null;
  let misure = null;
  if (vista) {
    const P = scelte[variante];
    const { palco } = vista;
    const W = palco.clientWidth;
    const H = palco.clientHeight;
    const cerchi = {};
    for (const id of CERCHI_PRINCIPALI) {
      const el = doc.getElementById(`${CERCHIO[id]}${vista.suffisso}`);
      if (!el || !visibile(el)) continue;
      const c = P[id] || serieDel(id, variante, vista);
      cerchi[id] = { p: [(c.x / 100) * W, (c.y / 100) * H], r: raggioDi(el) };
    }
    misure = { W, H, cerchi };
  }
  for (const [nome, prefisso, box] of [
    ["computer", "", [1000, 600]],
    ["telefono", "m-", [1000, 1000]],
  ]) {
    const P = scelte[nome];
    for (const { suffisso } of VISTE_DEL_FLUSSO) {
      for (const arco of ARCHI) {
        const linea = doc.getElementById(`${prefisso}${arco.linea}${suffisso}`);
        if (!linea) continue;
        const tocca = !nessunaScelta(P) && (P[arco.da] || P[arco.a]);
        if (!tocca) {
          rimettiDiSerie(linea);
          continue;
        }
        state.lineeToccate = true;
        /* L'altra variante non si vede e non si misura: tiene quello che ha,
         * e si rifa' quando torna in scena. */
        if (nome !== variante || !misure) continue;
        const A = misure.cerchi[arco.da];
        const B = misure.cerchi[arco.a];
        if (!A || !B) continue;
        const meta = [(A.p[0] + B.p[0]) / 2, (A.p[1] + B.p[1]) / 2];
        const d = curvaFraCerchi(A.p, A.r, B.p, B.r, {
          piega: arco.piega ?? PIEGA,
          verso: arco.sopra ? [meta[0], meta[1] - 1000] : [B.p[0], A.p[1]],
          scala: [box[0] / misure.W, box[1] / misure.H],
        });
        if (!d) continue;
        if (!linea.hasAttribute("data-dm-d-di-serie"))
          linea.setAttribute("data-dm-d-di-serie", linea.getAttribute("d") || "");
        if (linea.getAttribute("d") !== d) linea.setAttribute("d", d);
      }
    }
  }
}

/* ── i pezzi che si spostano ──────────────────────────────────────────── */

const NOMI = {
  solare: () => t("Solare", "Solar"),
  rete: () => t("Rete", "Grid"),
  batteria: () => t("Batteria", "Battery"),
  casa: () => t("Casa", "Home"),
};

/** Il modello di serie (prima delle scelte) che la scena ha appena disegnato,
 * e quello con le scelte: dicono dove stanno i carichi di serie e adesso. */
export function ricordaIlModello(periodo, diSerie, disegnato) {
  state.modelli = { ...state.modelli, [periodo]: { diSerie, disegnato } };
}

function nodiDelFlusso() {
  const vista = vistaInScena();
  if (!vista) return [];
  const variante = varianteDelFlusso();
  const chiave = variante === "telefono" ? "mobile" : "desktop";
  const nodi = [];
  for (const id of CERCHI_PRINCIPALI) {
    const el = doc.getElementById(`${CERCHIO[id]}${vista.suffisso}`);
    if (!el || !visibile(el)) continue;
    nodi.push({
      id,
      nome: NOMI[id](),
      centro: serieDel(id, variante, vista),
      pezzi: () => [doc.getElementById(`${CERCHIO[id]}${vista.suffisso}`)].filter(visibile),
    });
  }
  const modelli = state.modelli?.[vista.periodo];
  for (const node of modelli?.diSerie?.nodes || []) {
    const sel = `[data-dm-flow-node="${String(node.id).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"]`;
    const el = vista.palco.querySelector(sel);
    if (!el || !visibile(el)) continue;
    nodi.push({
      id: nodoDelCarico(node.id),
      nome: node.name,
      centro: { x: node[chiave].left, y: node[chiave].top },
      /* Dove starebbe senza una scelta sua, con le scelte di adesso: un
       * carico nuovo messo al posto libero sta li', non dove lo vorrebbe la
       * fila. Si rifa' ogni volta — il modello disegnato per ultimo ha gia'
       * dentro il posto che gli si sta dando con la mano. */
      adesso: () => {
        const diSerie = state.modelli?.[vista.periodo]?.diSerie;
        if (!diSerie) return null;
        const qui = conLePosizioni(diSerie, posizioniDelFlusso(), misureDelFlusso()).nodes?.find(
          (n) => n.id === node.id,
        );
        return qui ? { x: qui[chiave].left, y: qui[chiave].top } : null;
      },
      pezzi: () => [vista.palco.querySelector(sel)].filter(visibile),
    });
  }
  return nodi;
}

function stile() {
  return `
  /* In modifica i cerchi non scivolano: seguono la mano. */
  #page-energy .flow-stage[data-dm-disegno-in-modifica] > .node {
    transition-property:transform, box-shadow, border-color, background-color, color, opacity !important;
  }
  /* Un carico arrivato dopo, messo al posto libero: in modifica si vede. */
  #page-energy .flow-stage[data-dm-disegno-in-modifica] > .dm-flow-node[data-dm-flow-nuovo="true"] {
    border-style:dashed !important;
  }`;
}

/** Il flusso nell'elenco dei disegni che si spostano. `ridisegna` e' della
 * scena: rimette i carichi e le linee con le scelte di adesso. */
export function registraIlFlusso({ ridisegna }) {
  state.ridisegna = ridisegna;
  if (doc?.head && !doc.getElementById(STILE_ID)) {
    const foglio = doc.createElement("style");
    foglio.id = STILE_ID;
    foglio.textContent = stile();
    doc.head.append(foglio);
  }
  registraIlDisegno({
    id: DISEGNO_DELL_ENERGIA,
    pagina: "energy",
    nome: () => t("Flusso energetico", "Energy flow"),
    scatola: () => vistaInScena()?.palco || null,
    variante: varianteDelFlusso,
    nodi: nodiDelFlusso,
    ridisegna: () => {
      state.misure = null;
      mettiIPrincipali();
      state.ridisegna?.();
    },
  });
  mettiIPrincipali();
}
