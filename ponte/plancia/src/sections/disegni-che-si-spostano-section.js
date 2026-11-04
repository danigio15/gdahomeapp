/* Spostare i pezzi dentro i disegni.
 *
 * «Vedi come poter spostare le cose anche nei disegni, tipo i tubi nel solare
 * termico, i cerchi nel flusso energetico.» Con ✏️ (la modalita' della
 * disposizione, `disposizione-section.js`) un disegno che si e' iscritto qui
 * mostra una maniglia su ogni pezzo: si prende col mouse o col dito, si
 * sposta (si ferma sulla griglia, o allineato a un altro pezzo, e una guida
 * lo dice), e i tubi che lo toccano si ridisegnano mentre si muove. Dalla
 * tastiera: Tab fino alla maniglia e le frecce (con Maiusc a passi fini).
 *
 * Quello che si sposta resta una bozza finche' non si preme Salva nella barra
 * della disposizione: si conta con le altre modifiche, se ne va con Annulla o
 * Esc, torna di serie con Ripristina (tutta la pagina) o con «↺ Ripristina il
 * disegno» (solo questo disegno, solo questa variante). Il computer e il
 * telefono hanno due disegni diversi, e due scelte: l'etichetta in alto dice
 * quale si sta cambiando.
 *
 * La scelta salvata sta in `cd_disegni` (vedi `core/posizioni-nei-disegni.js`)
 * e viaggia col ponte. Senza scelta i disegni non si toccano.
 *
 * Un disegno si iscrive con `registraIlDisegno({ id, pagina, nome, scatola,
 * variante, nodi, ridisegna })`:
 *   - `scatola()` e' l'elemento in cui il percento e' quello del disegno;
 *   - `nodi()` dice i pezzi: { id, nome, centro: {x, y} di serie, pezzi() };
 *   - `ridisegna()` rimette il disegno con `posizioniInUso(id, variante)`.
 */

import {
  CHIAVE_DISEGNI,
  VARIANTI,
  allinea,
  casellaDel,
  conLePosizioni,
  disegniPuliti,
  limita,
  posizioniPulite,
  postoLibero,
  rettangolo,
  spingi,
  stessePosizioni,
} from "../core/posizioni-nei-disegni.js";
import { aggiungiAltreModifiche, ridisegnaLaBarra } from "./disposizione-section.js";
import { doc, esc, installStyle, root, senzaCadere, t, writeJsonIfChanged } from "./shared.js";

const KEY = "__DASHBOARDMODERN_DISEGNI_CHE_SI_SPOSTANO__";
const STILE_ID = "dm-disegni-che-si-spostano";
const state = (root[KEY] ||= {
  installed: false,
  registro: new Map(),
  bozza: new Map(),
  pagina: null,
  presa: null,
  letta: { testo: undefined, tutta: {} },
});

/* ── leggere e scrivere ─────────────────────────────────────────────────── */

/** La casella salvata, letta una volta per ogni volta che cambia. */
function salvate() {
  let testo = null;
  try {
    testo = root.localStorage?.getItem(CHIAVE_DISEGNI) ?? null;
  } catch (_errore) {}
  if (testo !== state.letta.testo) {
    let tutta = {};
    try {
      tutta = disegniPuliti(JSON.parse(testo || "{}"));
    } catch (_errore) {}
    state.letta = { testo, tutta };
  }
  return state.letta.tutta;
}

/** Le posizioni di un disegno come vanno disegnate adesso: la bozza, se si
 * sta modificando, se no quelle salvate. */
export function posizioniInUso(disegno, variante) {
  const casella = casellaDel(disegno, variante);
  if (state.bozza.has(casella)) return state.bozza.get(casella);
  return salvate()[casella] || {};
}

/** Un disegno che sa farsi spostare i pezzi. */
export function registraIlDisegno(voce) {
  if (!voce?.id) return;
  state.registro.set(voce.id, voce);
  if (state.pagina) rifaiGliStrati();
}

/* ── la bozza ───────────────────────────────────────────────────────────── */

function conta() {
  let n = 0;
  const tutta = salvate();
  for (const [casella, posizioni] of state.bozza)
    if (!stessePosizioni(posizioni, tutta[casella] || {})) n += 1;
  return n;
}

function ridisegnaTutti() {
  for (const voce of state.registro.values()) {
    try {
      voce.ridisegna?.();
    } catch (_errore) {}
  }
}

function salva() {
  if (!state.bozza.size) return;
  let tutta = salvate();
  for (const [casella, posizioni] of state.bozza) {
    const [disegno, variante] = casella.split(":");
    tutta = conLePosizioni(tutta, disegno, variante, posizioni);
  }
  writeJsonIfChanged(CHIAVE_DISEGNI, tutta);
}

function esci() {
  annullaLaPresa();
  state.pagina = null;
  state.bozza.clear();
  rifaiGliStrati();
  ridisegnaTutti();
}

function vociDellaPagina(pagina) {
  if (!pagina) return [];
  const nome = String(pagina.id || "").replace(/^page-/, "");
  return [...state.registro.values()].filter((voce) => {
    if (voce.pagina !== nome) return false;
    const scatola = voce.scatola?.();
    return Boolean(scatola && pagina.contains(scatola));
  });
}

function ripristina(pagina) {
  for (const voce of vociDellaPagina(pagina))
    for (const variante of VARIANTI) state.bozza.set(casellaDel(voce.id, variante), {});
  rifaiGliStrati();
  ridisegnaTutti();
}

function ripristinaIlDisegno(voce) {
  state.bozza.set(casellaDel(voce.id, voce.variante()), {});
  voce.ridisegna?.();
  rifaiGliStrati();
  ridisegnaLaBarra();
}

/** Un pezzo messo in un posto, nella bozza. Un pezzo rimesso dove sta di
 * serie non si scrive. */
function metti(voce, variante, nodo, punto) {
  const casella = casellaDel(voce.id, variante);
  const posizioni = { ...posizioniInUso(voce.id, variante) };
  const serie = nodo.centro;
  if (serie && Math.abs(serie.x - punto.x) < 0.05 && Math.abs(serie.y - punto.y) < 0.05)
    delete posizioni[nodo.id];
  else posizioni[nodo.id] = { x: punto.x, y: punto.y };
  state.bozza.set(casella, posizioniPulite(posizioni));
}

/* ── misurare ───────────────────────────────────────────────────────────── */

function dove(voce, nodo, variante) {
  return posizioniInUso(voce.id, variante)[nodo.id] || nodo.centro;
}

/** Quanto un pezzo (col suo disegno e le sue etichette) si allarga intorno
 * al centro, in percento della scatola. */
function ingombroDi(nodo, centro, box) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const el of nodo.pezzi?.() || []) {
    const r = el?.getBoundingClientRect?.();
    if (!r || (r.width < 1 && r.height < 1)) continue;
    x0 = Math.min(x0, ((r.left - box.left) / box.width) * 100);
    x1 = Math.max(x1, ((r.right - box.left) / box.width) * 100);
    y0 = Math.min(y0, ((r.top - box.top) / box.height) * 100);
    y1 = Math.max(y1, ((r.bottom - box.top) / box.height) * 100);
  }
  const minimo = { sinistra: 2, destra: 2, sopra: 2, sotto: 2 };
  if (!Number.isFinite(x0)) return minimo;
  return {
    sinistra: Math.max(minimo.sinistra, centro.x - x0),
    destra: Math.max(minimo.destra, x1 - centro.x),
    sopra: Math.max(minimo.sopra, centro.y - y0),
    sotto: Math.max(minimo.sotto, y1 - centro.y),
  };
}

function fotografia(voce) {
  const scatola = voce.scatola?.();
  const box = scatola?.getBoundingClientRect?.();
  if (!box || box.width < 10 || box.height < 10) return null;
  const variante = voce.variante();
  const nodi = voce.nodi() || [];
  const centri = new Map(nodi.map((nodo) => [nodo.id, dove(voce, nodo, variante)]));
  const ingombri = new Map(
    nodi.map((nodo) => [nodo.id, ingombroDi(nodo, centri.get(nodo.id), box)]),
  );
  return { scatola, box, variante, nodi, centri, ingombri };
}

/* ── gli strati della modifica ──────────────────────────────────────────── */

const pc = (n) => `${Number(n).toFixed(3)}%`;

function etichettaDellaVariante(variante) {
  return variante === "telefono"
    ? t("📱 Disegno del telefono", "📱 Phone drawing")
    : t("🖥 Disegno del computer", "🖥 Computer drawing");
}

function stratoMarkup(voce, foto) {
  const altra =
    foto.variante === "telefono"
      ? t("Sul computer resta com'è", "The computer keeps its own")
      : t("Sul telefono resta com'è", "The phone keeps its own");
  const toccato = Object.keys(posizioniInUso(voce.id, foto.variante)).length > 0;
  let html = `<div class="dm-dis-testa">
    <span class="dm-dis-variante" title="${esc(altra)}">${esc(etichettaDellaVariante(foto.variante))}</span>
    <button type="button" class="dm-dis-ripristina" data-dm-disegno-ripristina${toccato ? "" : " disabled"}>${esc(
      t("↺ Ripristina il disegno", "↺ Reset drawing"),
    )}</button>
  </div><div class="dm-dis-guide" aria-hidden="true"></div>`;
  const px = (v, lato) => ((v * foto.box[lato]) / 100).toFixed(1);
  for (const nodo of foto.nodi) {
    const c = foto.centri.get(nodo.id);
    /* Quello che il pezzo si porta dietro, attorno alla sua maniglia: si vede
     * quando la maniglia e' sotto il puntatore, ha il fuoco o e' in mano. */
    const g = foto.ingombri.get(nodo.id);
    const ombra = `<i class="dm-dis-ombra" aria-hidden="true" style="left:calc(50% - ${px(g.sinistra, "width")}px);top:calc(50% - ${px(
      g.sopra,
      "height",
    )}px);width:${px(g.sinistra + g.destra, "width")}px;height:${px(g.sopra + g.sotto, "height")}px"></i>`;
    html += `<button type="button" class="dm-dis-maniglia" data-dm-disegno-nodo="${esc(nodo.id)}" style="left:${pc(
      c.x,
    )};top:${pc(c.y)}" aria-label="${esc(
      t(
        `Sposta ${nodo.nome}: trascina, o usa le frecce`,
        `Move ${nodo.nome}: drag, or use the arrow keys`,
      ),
    )}" title="${esc(nodo.nome)}">${ombra}<span aria-hidden="true">✥</span></button>`;
  }
  return html;
}

/** Mette (o toglie) lo strato con le maniglie su ogni disegno della pagina
 * in modifica. */
function rifaiGliStrati() {
  for (const voce of state.registro.values()) {
    const scatola = voce.scatola?.();
    const strato = scatola?.querySelector?.(":scope > [data-dm-disegno-strato]");
    const qui = state.pagina && vociDellaPagina(state.pagina).includes(voce);
    if (!qui) {
      strato?.remove();
      scatola?.removeAttribute?.("data-dm-disegno-in-modifica");
      continue;
    }
    const foto = fotografia(voce);
    if (!foto) continue;
    const fuoco = doc.activeElement?.getAttribute?.("data-dm-disegno-nodo");
    let nuovo = strato;
    if (!nuovo) {
      nuovo = doc.createElement("div");
      nuovo.setAttribute("data-dm-disegno-strato", voce.id);
      nuovo.setAttribute("data-dm-non-trascinare", "");
      nuovo.setAttribute("role", "group");
      scatola.append(nuovo);
    }
    const nome = voce.nome?.() || voce.id;
    nuovo.setAttribute("aria-label", t(`Pezzi del disegno: ${nome}`, `Drawing pieces: ${nome}`));
    nuovo.setAttribute("data-dm-variante", foto.variante);
    nuovo.innerHTML = stratoMarkup(voce, foto);
    scatola.setAttribute("data-dm-disegno-in-modifica", "");
    if (fuoco && strato?.contains?.(doc.activeElement) !== true)
      nuovo.querySelector(`[data-dm-disegno-nodo="${fuoco}"]`)?.focus?.({ preventScroll: true });
  }
}

/* Durante uno spostamento si muovono solo la maniglia (con la sua ombra) e le
 * guide: rifare lo strato a ogni passo toglierebbe il puntatore di mano. */
function muoviNelloStrato(strato, nodoId, punto, ingombro, guide = []) {
  const maniglia = strato.querySelector(`[data-dm-disegno-nodo="${nodoId}"]`);
  if (maniglia) {
    maniglia.style.left = pc(punto.x);
    maniglia.style.top = pc(punto.y);
  }
  const contenitore = strato.querySelector(".dm-dis-guide");
  if (contenitore)
    contenitore.innerHTML = guide
      .map(
        (g) =>
          `<i class="dm-dis-guida" data-asse="${g.asse}" style="${g.asse === "x" ? "left" : "top"}:${pc(g.valore)}"></i>`,
      )
      .join("");
  const ripristina = strato.querySelector("[data-dm-disegno-ripristina]");
  if (ripristina) ripristina.disabled = false;
}

/* ── il puntatore ───────────────────────────────────────────────────────── */

const SOGLIA_PX = 3;

function annullaLaPresa({ rimetti = true } = {}) {
  const presa = state.presa;
  if (!presa) return;
  state.presa = null;
  doc.documentElement.removeAttribute("data-dm-disegno-trascinando");
  presa.strato?.removeAttribute?.("data-dm-in-mano");
  if (rimetti) {
    if (presa.prima === undefined) state.bozza.delete(presa.casella);
    else state.bozza.set(presa.casella, presa.prima);
    presa.voce.ridisegna?.();
  }
  presa.strato?.querySelector?.(".dm-dis-guide")?.replaceChildren?.();
}

function prendi(event, maniglia) {
  const strato = maniglia.closest("[data-dm-disegno-strato]");
  const voce = state.registro.get(strato?.getAttribute("data-dm-disegno-strato"));
  if (!voce) return false;
  const foto = fotografia(voce);
  const nodo = foto?.nodi.find((n) => n.id === maniglia.getAttribute("data-dm-disegno-nodo"));
  if (!nodo) return false;
  const casella = casellaDel(voce.id, foto.variante);
  state.presa = {
    voce,
    nodo,
    foto,
    strato,
    casella,
    prima: state.bozza.has(casella) ? state.bozza.get(casella) : undefined,
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    da: foto.centri.get(nodo.id),
    mosso: false,
  };
  try {
    maniglia.setPointerCapture?.(event.pointerId);
  } catch (_errore) {}
  return true;
}

function puntoDellaPresa(presa, event) {
  const dx = ((event.clientX - presa.x) / presa.foto.box.width) * 100;
  const dy = ((event.clientY - presa.y) / presa.foto.box.height) * 100;
  const altri = presa.foto.nodi
    .filter((n) => n.id !== presa.nodo.id)
    .map((n) => presa.foto.centri.get(n.id));
  const allineato = allinea({ x: presa.da.x + dx, y: presa.da.y + dy }, altri);
  const ingombro = presa.foto.ingombri.get(presa.nodo.id);
  const punto = limita(allineato, ingombro);
  const guide = allineato.guide.filter((g) => Math.abs(punto[g.asse] - g.valore) < 0.01);
  return { punto, guide, ingombro };
}

function onPuntatore(event) {
  if (event.type === "pointerdown") {
    if (!state.pagina || event.button > 0) return;
    const maniglia = event.target?.closest?.("[data-dm-disegno-nodo]");
    if (!maniglia) return;
    event.preventDefault();
    event.stopPropagation();
    annullaLaPresa();
    prendi(event, maniglia);
    return;
  }
  const presa = state.presa;
  if (
    !presa ||
    (event.pointerId !== undefined && presa.id !== undefined && event.pointerId !== presa.id)
  )
    return;
  event.preventDefault();
  event.stopPropagation();
  if (event.type === "pointercancel") return annullaLaPresa();
  if (!presa.mosso && Math.hypot(event.clientX - presa.x, event.clientY - presa.y) < SOGLIA_PX) {
    if (event.type === "pointerup") annullaLaPresa({ rimetti: false });
    return;
  }
  if (!presa.mosso) {
    presa.mosso = true;
    doc.documentElement.setAttribute("data-dm-disegno-trascinando", presa.nodo.id);
    /* La maniglia in mano resta piena: le altre si fanno da parte. */
    presa.strato.setAttribute("data-dm-in-mano", presa.nodo.id);
    presa.strato
      .querySelector(`[data-dm-disegno-nodo="${presa.nodo.id}"]`)
      ?.setAttribute("data-dm-presa", "");
  }
  let { punto, guide, ingombro } = puntoDellaPresa(presa, event);
  if (event.type === "pointerup") {
    /* Lasciato sopra un altro pezzo: al posto libero piu' vicino. */
    const occupati = presa.foto.nodi
      .filter((n) => n.id !== presa.nodo.id)
      .map((n) => rettangolo(presa.foto.centri.get(n.id), presa.foto.ingombri.get(n.id)));
    punto = postoLibero(punto, ingombro, occupati);
    guide = [];
  }
  metti(presa.voce, presa.foto.variante, presa.nodo, punto);
  presa.voce.ridisegna?.();
  muoviNelloStrato(presa.strato, presa.nodo.id, punto, ingombro, guide);
  if (event.type === "pointerup") {
    annullaLaPresa({ rimetti: false });
    rifaiGliStrati();
    ridisegnaLaBarra();
  }
}

/* ── la tastiera ────────────────────────────────────────────────────────── */

function onTasto(event) {
  if (event.key === "Escape" && state.presa) {
    event.preventDefault();
    event.stopPropagation();
    annullaLaPresa();
    rifaiGliStrati();
    return;
  }
  if (!state.pagina || event.altKey || event.ctrlKey || event.metaKey) return;
  const maniglia = event.target?.closest?.("[data-dm-disegno-nodo]");
  if (!maniglia) return;
  const strato = maniglia.closest("[data-dm-disegno-strato]");
  const voce = state.registro.get(strato?.getAttribute("data-dm-disegno-strato"));
  const foto = voce && fotografia(voce);
  const nodo = foto?.nodi.find((n) => n.id === maniglia.getAttribute("data-dm-disegno-nodo"));
  if (!nodo) return;
  const spinto = spingi(foto.centri.get(nodo.id), event.key, { fine: event.shiftKey });
  if (!spinto) return;
  event.preventDefault();
  event.stopPropagation();
  const punto = limita(spinto, foto.ingombri.get(nodo.id));
  metti(voce, foto.variante, nodo, punto);
  voce.ridisegna?.();
  rifaiGliStrati();
  ridisegnaLaBarra();
}

function onClick(event) {
  const bersaglio = event.target;
  if (!bersaglio?.closest?.("[data-dm-disegno-strato]")) return;
  event.preventDefault();
  event.stopPropagation();
  if (!bersaglio.closest("[data-dm-disegno-ripristina]")) return;
  const strato = bersaglio.closest("[data-dm-disegno-strato]");
  const voce = state.registro.get(strato.getAttribute("data-dm-disegno-strato"));
  if (voce) ripristinaIlDisegno(voce);
}

/* ── lo stile ───────────────────────────────────────────────────────────── */

const STILE = `
[data-dm-disegno-strato]{position:absolute;inset:0;z-index:30;pointer-events:none}
[data-dm-disegno-in-modifica]{outline:2px dashed color-mix(in srgb,#0ea5e9 55%,transparent);outline-offset:4px;border-radius:12px}
.dm-dis-testa{position:absolute;right:6px;bottom:6px;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;align-items:center;pointer-events:none;max-width:calc(100% - 12px)}
.dm-dis-testa > *{pointer-events:auto}
.dm-dis-variante{display:inline-flex;align-items:center;min-height:30px;padding:0 12px;border-radius:999px;font:700 12.5px/1 inherit;
  background:color-mix(in srgb,#0ea5e9 14%,var(--card-bg,#fff));color:color-mix(in srgb,#0369a1 80%,var(--text,#0f172a));
  border:1px solid color-mix(in srgb,#0ea5e9 40%,transparent);white-space:nowrap}
.dm-dis-ripristina{min-height:30px;padding:0 12px;border-radius:999px;font:600 12.5px/1 inherit;cursor:pointer;white-space:nowrap;
  background:var(--card-bg,#fff);color:inherit;border:1px solid color-mix(in srgb,var(--text,#0f172a) 16%,transparent)}
.dm-dis-ripristina[disabled]{opacity:.45;cursor:default}
.dm-dis-ombra{position:absolute;display:block;border-radius:10px;pointer-events:none;opacity:0;transition:opacity .15s ease;
  border:1.5px dashed color-mix(in srgb,#0ea5e9 70%,transparent);background:color-mix(in srgb,#0ea5e9 6%,transparent)}
.dm-dis-maniglia:is(:hover,:focus-visible,[data-dm-presa]) .dm-dis-ombra{opacity:1}
.dm-dis-maniglia > span{position:relative}
.dm-dis-maniglia{position:absolute;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:999px;pointer-events:auto;cursor:grab;
  display:grid;place-items:center;padding:0;touch-action:none;user-select:none;-webkit-user-select:none;
  background:var(--accent,#2563eb);color:#fff;border:2px solid #fff;font:700 17px/1 inherit;
  box-shadow:0 4px 14px rgba(15,23,42,.28),0 0 0 4px color-mix(in srgb,var(--accent,#2563eb) 22%,transparent)}
.dm-dis-maniglia:hover{filter:brightness(1.08)}
.dm-dis-maniglia:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}
html[data-dm-disegno-trascinando] .dm-dis-maniglia{cursor:grabbing}
[data-dm-in-mano] .dm-dis-maniglia:not([data-dm-presa]){opacity:.55}
@media (pointer:coarse){.dm-dis-maniglia{width:44px;height:44px;margin:-22px 0 0 -22px}}
.dm-dis-guide{position:absolute;inset:0;pointer-events:none}
.dm-dis-guida{position:absolute;display:block}
.dm-dis-guida[data-asse="x"]{top:-6px;bottom:-6px;width:0;border-left:1.5px dashed #f59e0b}
.dm-dis-guida[data-asse="y"]{left:-6px;right:-6px;height:0;border-top:1.5px dashed #f59e0b}
html[data-theme="dark"] .dm-dis-variante{color:#7dd3fc}
`;

/* ── installare ─────────────────────────────────────────────────────────── */

const MODIFICHE = Object.freeze({
  conta,
  salva,
  annulla: esci,
  esci,
  ripristina,
  entra(pagina) {
    state.pagina = pagina || null;
    state.bozza.clear();
    rifaiGliStrati();
  },
  haQualcosa: (pagina) => vociDellaPagina(pagina).length > 0,
});

function quandoCambiaFuori() {
  /* Un altro dispositivo ha salvato: i disegni si rimettono (la bozza, se
   * c'e', resta quella di qui). */
  ridisegnaTutti();
  if (state.pagina && !state.presa) rifaiGliStrati();
}

export function installDisegniCheSiSpostano() {
  if (!doc?.body || state.installed) return;
  state.installed = true;
  installStyle(STILE_ID, STILE);
  aggiungiAltreModifiche(MODIFICHE);
  /* Sulla finestra e in cattura: prima della disposizione (che ascolta sul
   * documento) e prima dei gesti delle carte. */
  for (const tipo of ["pointerdown", "pointermove", "pointerup", "pointercancel"])
    root.addEventListener?.(tipo, onPuntatore, { capture: true, passive: false });
  root.addEventListener?.("keydown", onTasto, true);
  root.addEventListener?.("click", onClick, true);
  root.addEventListener?.("storage", quandoCambiaFuori);
  root.addEventListener?.("dashboardmodern:config-synced", quandoCambiaFuori);
  /* Il telefono girato cambia disegno: lo strato si rifa' per l'altro. */
  root.addEventListener?.("resize", () => {
    if (state.pagina && !state.presa) root.requestAnimationFrame?.(rifaiGliStrati);
  });
}

/* Per le prove. */
root.dmDisegni = {
  posizioniInUso,
  conta,
  voci: () => [...state.registro.keys()],
};

senzaCadere(installDisegniCheSiSpostano);
