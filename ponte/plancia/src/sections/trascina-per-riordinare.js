/* Riordinare un elenco trascinando (#379).
 *
 * «Sarebbe carino se le tessere si potessero spostare con drag & drop.» Le
 * tessere della Home si riordinavano solo con le frecce ▲▼, una posizione per
 * volta: portare il Meteo dal fondo in cima voleva dire venti tocchi.
 *
 * Qui si trascina dalla maniglia «⠿», col mouse e col dito. Il trascinamento
 * dell'HTML5 sul dito non c'e', quindi si usano i Pointer Events: lo stesso
 * codice per il mouse, il dito e la penna. Mentre si trascina, le altre righe
 * si spostano per fare posto — e' quella l'anteprima di dove la riga cadra' —
 * l'elenco scorre da solo vicino ai bordi, Esc rimette tutto com'era. Dalla
 * tastiera la maniglia si muove con le frecce su e giu'.
 *
 * Chi usa questo modulo segna l'elenco con `data-dm-riordina`, le righe con
 * `data-dm-riordina-riga` e la maniglia con `data-dm-maniglia`; quando una
 * riga cade in un posto nuovo l'elenco riceve l'evento `dm-riordina` con
 * `{ da, a }` e il resto — salvare, ridisegnare — lo fa lui. Il modulo non sa
 * niente di tessere: e' fatto per servire anche altrove.
 */
import { doc, root, senzaCadere } from "./shared.js";

const KEY = "__DASHBOARDMODERN_TRASCINA_PER_RIORDINARE__";
const state = (root[KEY] ||= { installed: false, presa: null });

/* Quanti pixel deve muoversi il puntatore prima che diventi un trascinamento:
 * sotto, era un tocco. */
const SOGLIA = 4;
/* Quanto vicino al bordo l'elenco comincia a scorrere da solo, e quanto in
 * fretta al massimo (pixel per fotogramma). */
const BORDO = 56;
const VELOCITA = 14;

/** Dove cade la riga `da` se il suo centro sta a `centro`: le altre righe che
 * hanno il centro sopra di lui le stanno prima. `centri` sono i centri delle
 * righe nella posizione di partenza, nell'ordine dell'elenco. */
export function doveCade(centri, da, centro) {
  let a = 0;
  for (let i = 0; i < centri.length; i += 1) {
    if (i === da) continue;
    if (centri[i] < centro) a += 1;
  }
  return a;
}

/** L'elenco con l'elemento `da` portato in `a`; gli altri scorrono. */
export function spostaNellaLista(lista, da, a) {
  const copia = [...lista];
  if (da === a || da < 0 || da >= copia.length) return copia;
  const [preso] = copia.splice(da, 1);
  copia.splice(Math.max(0, Math.min(a, copia.length)), 0, preso);
  return copia;
}

/** Di quanto scorrere quando il puntatore sta a `y` in una finestra che va da
 * `alto` a `basso`: zero lontano dai bordi, di piu' quanto piu' ci si avvicina. */
export function scorrimentoAlBordo(y, alto, basso, bordo = BORDO, massimo = VELOCITA) {
  if (y < alto + bordo) return -Math.ceil(massimo * Math.min(1, (alto + bordo - y) / bordo));
  if (y > basso - bordo) return Math.ceil(massimo * Math.min(1, (y - (basso - bordo)) / bordo));
  return 0;
}

function righe(lista) {
  return [...lista.children].filter((riga) => riga.hasAttribute?.("data-dm-riordina-riga"));
}

/* Chi scorre: il primo antenato che scorre davvero, o la pagina. */
function chiScorre(elemento) {
  for (let nodo = elemento?.parentElement; nodo; nodo = nodo.parentElement) {
    const stile = root.getComputedStyle?.(nodo);
    if (!stile) break;
    if (/(auto|scroll)/.test(stile.overflowY) && nodo.scrollHeight > nodo.clientHeight + 1) return nodo;
  }
  return doc.scrollingElement || doc.documentElement;
}

function bordiDi(scroller) {
  if (scroller === doc.scrollingElement || scroller === doc.documentElement)
    return { alto: 0, basso: root.innerHeight || 0 };
  const r = scroller.getBoundingClientRect();
  return { alto: r.top, basso: r.bottom };
}

function annuncia(lista, testo) {
  let voce = lista.parentElement?.querySelector?.(":scope > .dm-riordina-voce");
  if (!voce) {
    voce = doc.createElement("div");
    voce.className = "dm-riordina-voce";
    voce.setAttribute("aria-live", "polite");
    voce.setAttribute("role", "status");
    lista.after(voce);
  }
  voce.textContent = testo;
}

function cadi(lista, da, a) {
  if (da === a) return;
  lista.dispatchEvent(new root.CustomEvent("dm-riordina", { bubbles: true, detail: { da, a } }));
}

/* ── il trascinamento ─────────────────────────────────────────────────── */

function onPointerDown(event) {
  if (state.presa) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const maniglia = event.target?.closest?.("[data-dm-maniglia]");
  const riga = maniglia?.closest?.("[data-dm-riordina-riga]");
  const lista = riga?.parentElement;
  if (!lista?.hasAttribute?.("data-dm-riordina")) return;
  const tutte = righe(lista);
  const da = tutte.indexOf(riga);
  if (da < 0 || tutte.length < 2) return;
  event.preventDefault();
  try {
    maniglia.setPointerCapture?.(event.pointerId);
  } catch (_error) {}
  const scroller = chiScorre(lista);
  state.presa = {
    id: event.pointerId,
    maniglia,
    riga,
    lista,
    tutte,
    da,
    a: da,
    y0: event.clientY,
    y: event.clientY,
    scroll0: scroller.scrollTop,
    scroller,
    partito: false,
    rect: tutte.map((r) => r.getBoundingClientRect()),
    passo: 0,
    giro: 0,
  };
}

function parti(presa) {
  presa.partito = true;
  const { rect, da } = presa;
  /* Il passo e' quanto una riga si sposta per fare posto: la sua altezza piu'
   * lo spazio fra le righe, misurato davvero. */
  const gap = rect.length > 1 ? Math.max(0, rect[1].top - rect[0].bottom) : 0;
  presa.passo = rect[da].height + gap;
  presa.lista.dataset.dmTrascinando = "true";
  presa.riga.dataset.dmPresa = "true";
  for (const r of presa.tutte) if (r !== presa.riga) r.dataset.dmFaPosto = "true";
  doc.documentElement.dataset.dmTrascinando = "true";
  const scorri = () => {
    if (state.presa !== presa) return;
    const { alto, basso } = bordiDi(presa.scroller);
    const passo = scorrimentoAlBordo(presa.y, alto, basso);
    if (passo) {
      presa.scroller.scrollTop += passo;
      disegna(presa);
    }
    presa.giro = root.requestAnimationFrame?.(scorri) || 0;
  };
  presa.giro = root.requestAnimationFrame?.(scorri) || 0;
}

function disegna(presa) {
  const { rect, da, tutte, riga, passo } = presa;
  const scorso = presa.scroller.scrollTop - presa.scroll0;
  const dy = presa.y - presa.y0 + scorso;
  /* La riga presa non esce dall'elenco: si ferma un po' oltre la prima e
   * l'ultima, cosi' non vola via per la pagina. */
  const min = rect[0].top - rect[da].top - passo / 2;
  const max = rect[rect.length - 1].bottom - rect[da].bottom + passo / 2;
  const fermo = Math.max(min, Math.min(max, dy));
  riga.style.transform = `translateY(${fermo}px)`;
  const centri = rect.map((r) => r.top + r.height / 2);
  const a = doveCade(centri, da, centri[da] + fermo);
  presa.a = a;
  tutte.forEach((altra, i) => {
    if (i === da) return;
    let sposta = 0;
    if (da < a && i > da && i <= a) sposta = -passo;
    if (da > a && i < da && i >= a) sposta = passo;
    altra.style.transform = sposta ? `translateY(${sposta}px)` : "";
  });
}

function onPointerMove(event) {
  const presa = state.presa;
  if (!presa || event.pointerId !== presa.id) return;
  presa.y = event.clientY;
  if (!presa.partito) {
    if (Math.abs(presa.y - presa.y0) < SOGLIA) return;
    parti(presa);
  }
  event.preventDefault();
  disegna(presa);
}

function rilascia(presa) {
  root.cancelAnimationFrame?.(presa.giro);
  for (const r of presa.tutte) {
    r.style.transform = "";
    delete r.dataset.dmFaPosto;
    delete r.dataset.dmPresa;
  }
  delete presa.lista.dataset.dmTrascinando;
  delete doc.documentElement.dataset.dmTrascinando;
  try {
    presa.maniglia.releasePointerCapture?.(presa.id);
  } catch (_error) {}
  state.presa = null;
}

function onPointerUp(event) {
  const presa = state.presa;
  if (!presa || event.pointerId !== presa.id) return;
  const { lista, da, a, partito } = presa;
  rilascia(presa);
  if (!partito) return;
  /* Il clic che segue il rilascio non deve diventare un tocco sulla riga. */
  const ferma = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };
  doc.addEventListener("click", ferma, { capture: true, once: true });
  root.setTimeout?.(() => doc.removeEventListener("click", ferma, { capture: true }), 0);
  cadi(lista, da, a);
}

function onPointerCancel(event) {
  const presa = state.presa;
  if (!presa || event.pointerId !== presa.id) return;
  rilascia(presa);
}

function onKeyDown(event) {
  /* Esc durante il trascinamento: tutto torna com'era, niente si salva. */
  if (event.key === "Escape" && state.presa) {
    event.preventDefault();
    event.stopPropagation();
    rilascia(state.presa);
    return;
  }
  /* Dalla tastiera: la maniglia con le frecce su e giu'. */
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
  const maniglia = event.target?.closest?.("[data-dm-maniglia]");
  const riga = maniglia?.closest?.("[data-dm-riordina-riga]");
  const lista = riga?.parentElement;
  if (!lista?.hasAttribute?.("data-dm-riordina")) return;
  const tutte = righe(lista);
  const da = tutte.indexOf(riga);
  const a = event.key === "ArrowUp" ? da - 1 : da + 1;
  if (da < 0 || a < 0 || a >= tutte.length) return;
  event.preventDefault();
  /* Dopo il ridisegno il fuoco torna sulla maniglia della stessa riga, cosi'
   * si puo' continuare a premere la freccia. */
  const chiave = riga.dataset.dmRiordinaRiga;
  cadi(lista, da, a);
  annuncia(lista, `${a + 1} / ${tutte.length}`);
  root.queueMicrotask?.(() => {
    const nuova = doc.querySelector?.(
      `[data-dm-riordina] [data-dm-riordina-riga="${root.CSS?.escape ? root.CSS.escape(chiave) : chiave}"] [data-dm-maniglia]`,
    );
    nuova?.focus?.();
  });
}

export const STILE_RIORDINA = `
  [data-dm-maniglia]{
    flex:0 0 32px;width:32px;height:44px;margin:-6px 0 -6px -6px;padding:0;border:0;border-radius:10px;
    background:transparent;color:var(--text-dim,#94a3b8);font-size:18px;line-height:1;
    display:inline-flex;align-items:center;justify-content:center;cursor:grab;
    touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
  [data-dm-maniglia]:hover{color:var(--text,#0f172a);background:color-mix(in srgb,var(--text-dim,#94a3b8) 14%,transparent)}
  [data-dm-maniglia]:focus-visible{outline:2px solid var(--accent,#3b82f6);outline-offset:1px}
  [data-dm-riordina][data-dm-trascinando="true"]{user-select:none;-webkit-user-select:none}
  [data-dm-riordina] [data-dm-fa-posto="true"]{transition:transform .18s cubic-bezier(.2,.8,.2,1)}
  [data-dm-riordina] [data-dm-presa="true"]{
    position:relative;z-index:5;cursor:grabbing;
    box-shadow:0 18px 36px -14px rgba(15,23,42,.45),0 0 0 2px var(--accent,#3b82f6)!important;
    background:var(--card-bg,#fff)}
  [data-dm-riordina] [data-dm-presa="true"] [data-dm-maniglia]{cursor:grabbing;color:var(--accent,#3b82f6)}
  html[data-dm-trascinando="true"],html[data-dm-trascinando="true"] *{cursor:grabbing!important}
  .dm-riordina-voce{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  @media (prefers-reduced-motion:reduce){[data-dm-riordina] [data-dm-fa-posto="true"]{transition:none}}
`;

export function installTrascinaPerRiordinare() {
  if (!doc || state.installed) return;
  state.installed = true;
  doc.addEventListener("pointerdown", onPointerDown, { passive: false });
  doc.addEventListener("pointermove", onPointerMove, { passive: false });
  doc.addEventListener("pointerup", onPointerUp);
  doc.addEventListener("pointercancel", onPointerCancel);
  doc.addEventListener("keydown", onKeyDown, true);
}

senzaCadere(installTrascinaPerRiordinare);
