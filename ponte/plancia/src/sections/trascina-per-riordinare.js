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

/** Di quanto e' rimpicciolita una griglia: la sua larghezza sulla pagina
 * contro quella che ha per se'. 1 se non lo e'. */
function scalaDi(lista, base = lista.getBoundingClientRect()) {
  const propria = lista.offsetWidth;
  if (!propria || !base.width) return 1;
  const k = base.width / propria;
  return Math.abs(k - 1) < 0.01 ? 1 : k;
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

/* Chi scorre di lato: il primo antenato (o la fila stessa) che scorre davvero
 * in orizzontale. La barra delle sezioni sul telefono. */
function chiScorreDiLato(elemento) {
  for (let nodo = elemento; nodo && nodo !== doc.body; nodo = nodo.parentElement) {
    const stile = root.getComputedStyle?.(nodo);
    if (!stile) break;
    if (/(auto|scroll)/.test(stile.overflowX) && nodo.scrollWidth > nodo.clientWidth + 1) return nodo;
  }
  return null;
}

/* Una cosa ferma sullo schermo — `position:fixed`, la barra in basso — non si
 * avvicina scorrendo la pagina: li' la pagina non deve scorrere da sola. */
function dentroUnaCosaFerma(elemento) {
  for (let nodo = elemento; nodo && nodo !== doc.documentElement; nodo = nodo.parentElement) {
    if (root.getComputedStyle?.(nodo)?.position === "fixed") return true;
  }
  return false;
}

/* Dove una voce STA, non dove si vede: mentre scivola verso il posto nuovo il
 * suo disegno e' spostato dalla trasformazione dell'animazione, e chiedere a
 * lui faceva rimbalzare il posto d'arrivo avanti e indietro. Si toglie la
 * traslazione in corso (in unita' della pagina: per la scala della griglia). */
function postoDi(voce, k = 1) {
  const r = voce.getBoundingClientRect();
  let dx = 0;
  let dy = 0;
  try {
    const t = root.getComputedStyle?.(voce)?.transform;
    if (t && t !== "none" && root.DOMMatrixReadOnly) {
      const m = new root.DOMMatrixReadOnly(t);
      dx = m.m41 * k;
      dy = m.m42 * k;
    }
  } catch (_errore) {}
  return { left: r.left - dx, top: r.top - dy, right: r.right - dx, bottom: r.bottom - dy };
}

/* Il fantasma sotto il dito: la sua posizione si ricalcola ogni volta dal
 * riferimento com'e' adesso, cosi' resta sotto il dito anche se intanto la
 * pagina o la fila sono scorse. */
function piazzaIlFantasma(presa) {
  const { fantasma, riferimento, rettangolo0 } = presa;
  if (!fantasma || !riferimento) return;
  const k = presa.scala || 1;
  const base = riferimento.getBoundingClientRect();
  const sinistra = rettangolo0.left + (presa.x - presa.x0) - base.left;
  const alto = rettangolo0.top + (presa.y - presa.y0) - base.top;
  fantasma.style.left = `${sinistra / k + (riferimento.scrollLeft || 0)}px`;
  fantasma.style.top = `${alto / k + (riferimento.scrollTop || 0)}px`;
  fantasma.style.transform = "rotate(-2deg) scale(1.05)";
}

/* Quello che sta incollato in cima a chi scorre e copre le prime righe: la
 * barra «Cerca in tutta la configurazione…» del Config. Sul telefono copriva
 * la testa dell'anteprima, e il trascinamento non scorreva finche' il dito
 * non arrivava sotto di lei. */
const INCOLLATI_IN_CIMA = ".dm-cerca-config";

function copertoInCima(scroller, alto) {
  let fino = alto;
  for (const barra of scroller?.querySelectorAll?.(INCOLLATI_IN_CIMA) || []) {
    const r = barra.getBoundingClientRect?.();
    if (r && r.height > 0 && r.top <= alto + 2) fino = Math.max(fino, r.bottom);
  }
  return fino;
}

function bordiDi(scroller) {
  if (scroller === doc.scrollingElement || scroller === doc.documentElement)
    return { alto: copertoInCima(doc, 0), basso: root.innerHeight || 0 };
  const r = scroller.getBoundingClientRect();
  return { alto: copertoInCima(scroller, r.top), basso: r.bottom };
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

/* Una griglia (`data-dm-riordina="griglia"`) non e' un elenco: le voci stanno
 * su piu' colonne, e «fare posto» spostando le altre in verticale non vuol
 * dire niente. Li' la voce presa resta nella griglia come POSTO DI ARRIVO —
 * il riquadro tratteggiato — e un fantasma uguale a lei segue il puntatore;
 * il posto si sposta nella griglia mentre si trascina, e le altre voci
 * scivolano al loro posto nuovo. */
const eGriglia = (lista) => lista?.getAttribute?.("data-dm-riordina") === "griglia";

/* Sul dito una voce intera che si trascina ruba lo scorrimento della pagina:
 * con `data-dm-tieni` il trascinamento parte solo tenendo premuto un attimo,
 * e un dito che scorre subito scorre la pagina come sempre. */
const TIENI_MS = 280;

function onPointerDown(event) {
  if (state.presa) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (event.target?.closest?.("[data-dm-non-trascinare]")) return;
  const maniglia = event.target?.closest?.("[data-dm-maniglia]");
  const riga = maniglia?.closest?.("[data-dm-riordina-riga]");
  const lista = riga?.parentElement;
  if (!lista?.hasAttribute?.("data-dm-riordina")) return;
  const tutte = righe(lista);
  const da = tutte.indexOf(riga);
  if (da < 0 || tutte.length < 2) return;
  const tieni = event.pointerType !== "mouse" && maniglia.hasAttribute("data-dm-tieni");
  if (!tieni) event.preventDefault();
  const scroller = chiScorre(lista);
  const presa = {
    id: event.pointerId,
    maniglia,
    riga,
    lista,
    tutte,
    griglia: eGriglia(lista),
    da,
    a: da,
    x0: event.clientX,
    y0: event.clientY,
    x: event.clientX,
    y: event.clientY,
    scroll0: scroller.scrollTop,
    scroller,
    partito: false,
    tieni,
    pronto: !tieni,
    timer: 0,
    rect: tutte.map((r) => r.getBoundingClientRect()),
    passo: 0,
    giro: 0,
  };
  state.presa = presa;
  if (tieni) {
    presa.timer = root.setTimeout?.(() => {
      if (state.presa !== presa) return;
      presa.pronto = true;
      try {
        maniglia.setPointerCapture?.(event.pointerId);
      } catch (_error) {}
      root.navigator?.vibrate?.(12);
      parti(presa);
      disegna(presa);
    }, TIENI_MS);
  } else {
    try {
      maniglia.setPointerCapture?.(event.pointerId);
    } catch (_error) {}
  }
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
  if (presa.griglia) {
    /* Il fantasma sta dentro la griglia: cosi' porta gli stessi stili della
     * voce vera, qualunque sia il foglio che la veste. E' posato in assoluto,
     * e il suo riferimento e' quello che il browser gli da' davvero
     * (`offsetParent`): la griglia stessa, di solito, ma non sempre — la barra
     * delle sezioni sul telefono ha le voci in una striscia `display:contents`,
     * che non ha una scatola, e li' il riferimento e' la barra. Misurare la
     * striscia dava zero, e il fantasma finiva fuori dallo schermo. */
    const r = rect[da];
    const fantasma = presa.riga.cloneNode(true);
    fantasma.removeAttribute("data-dm-riordina-riga");
    fantasma.removeAttribute("data-dm-presa");
    fantasma.removeAttribute("id");
    fantasma.dataset.dmFantasma = "true";
    fantasma.setAttribute("aria-hidden", "true");
    Object.assign(fantasma.style, { position: "absolute", left: "0px", top: "0px", margin: "0", pointerEvents: "none" });
    presa.lista.append(fantasma);
    presa.fantasma = fantasma;
    const riferimento = fantasma.offsetParent || doc.documentElement;
    presa.riferimento = riferimento;
    /* Una griglia rimpicciolita (l'anteprima «Telefono» su uno schermo
     * stretto): le misure della pagina si riportano a quelle della griglia. */
    const k = scalaDi(riferimento);
    presa.scala = k;
    Object.assign(fantasma.style, { width: `${r.width / k}px`, height: `${r.height / k}px` });
    presa.rettangolo0 = { left: r.left, top: r.top };
    /* Una fila che scorre di lato (la barra delle sezioni) scorre di lato
     * anche mentre si trascina; e se sta ferma sullo schermo (`fixed`) la
     * pagina sotto non deve scorrere. */
    presa.diLato = chiScorreDiLato(presa.lista);
    presa.ferma = dentroUnaCosaFerma(presa.lista);
    /* Una fila sola: conta solo dove sta il dito di lato, un dito che sale un
     * po' sopra la barra trascina lo stesso. */
    presa.unaFila = rect.every((q) => Math.abs(q.top - rect[0].top) < 6);
    piazzaIlFantasma(presa);
  }
  const scorri = () => {
    if (state.presa !== presa) return;
    /* Ogni fotogramma il fantasma torna sotto il dito: la fila puo' essere
     * scorsa da sola (il browser che tiene in vista la voce spostata). */
    if (presa.griglia) piazzaIlFantasma(presa);
    if (presa.diLato) {
      const r = presa.diLato.getBoundingClientRect();
      const passo = scorrimentoAlBordo(presa.x, r.left, r.right);
      if (passo) {
        presa.diLato.scrollLeft += passo;
        disegna(presa);
      }
    } else if (!presa.ferma) {
      const { alto, basso } = bordiDi(presa.scroller);
      const passo = scorrimentoAlBordo(presa.y, alto, basso);
      if (passo) {
        presa.scroller.scrollTop += passo;
        disegna(presa);
      }
    }
    presa.giro = root.requestAnimationFrame?.(scorri) || 0;
  };
  presa.giro = root.requestAnimationFrame?.(scorri) || 0;
}

/* Le voci si spostano scivolando: si misura dove stavano, si sposta il nodo,
 * si misura dove stanno, e si parte dalla differenza (FLIP). */
function scivola(voci, sposta) {
  const prima = new Map(voci.map((v) => [v, v.getBoundingClientRect()]));
  sposta();
  for (const v of voci) {
    const a = prima.get(v);
    const b = v.getBoundingClientRect();
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    if (!dx && !dy) continue;
    v.style.transition = "none";
    v.style.transform = `translate(${dx}px,${dy}px)`;
    void v.offsetWidth;
    v.style.transition = "";
    v.style.transform = "";
  }
}

function disegnaGriglia(presa) {
  const { lista, riga } = presa;
  /* Il fantasma e' la voce sollevata: segue il puntatore, un filo piu' grande
   * e appena girata, con l'ombra di una cosa tenuta in mano. */
  piazzaIlFantasma(presa);
  const k = presa.scala || 1;
  const voci = righe(lista);
  const sopra = voci.find((v) => {
    if (v === riga) return false;
    const p = postoDi(v, k);
    const diLato = presa.x >= p.left && presa.x <= p.right;
    return presa.unaFila ? diLato : diLato && presa.y >= p.top && presa.y <= p.bottom;
  });
  if (!sopra) return;
  const qui = voci.indexOf(riga);
  const la = voci.indexOf(sopra);
  scivola(
    voci.filter((v) => v !== riga),
    () => {
      if (qui < la) sopra.after(riga);
      else sopra.before(riga);
    },
  );
  presa.a = righe(lista).indexOf(riga);
}

function disegna(presa) {
  if (presa.griglia) {
    disegnaGriglia(presa);
    return;
  }
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
  presa.x = event.clientX;
  presa.y = event.clientY;
  if (!presa.partito) {
    const mosso = Math.hypot(presa.x - presa.x0, presa.y - presa.y0);
    /* Prima che il dito abbia tenuto abbastanza, un movimento e' uno
     * scorrimento: si lascia stare. */
    if (!presa.pronto) {
      if (mosso > 8) annullaLaPresa(presa);
      return;
    }
    if (mosso < SOGLIA) return;
    parti(presa);
  }
  event.preventDefault();
  disegna(presa);
}

function annullaLaPresa(presa) {
  root.clearTimeout?.(presa.timer);
  state.presa = null;
}

function rilascia(presa, { rimetti = false } = {}) {
  root.clearTimeout?.(presa.timer);
  root.cancelAnimationFrame?.(presa.giro);
  if (presa.griglia && rimetti) {
    /* Esc: la voce torna dov'era, senza scivolare. */
    const voci = righe(presa.lista).filter((v) => v !== presa.riga);
    const dopo = voci[presa.da];
    if (dopo) dopo.before(presa.riga);
    else presa.lista.append(presa.riga);
  }
  presa.fantasma?.remove();
  for (const r of righe(presa.lista)) {
    r.style.transform = "";
    r.style.transition = "";
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
  rilascia(presa, { rimetti: true });
}

/* Mentre si trascina col dito la pagina non deve scorrere: il gesto e' gia'
 * di qualcuno. */
function onTouchMove(event) {
  if (state.presa?.partito) event.preventDefault();
}

/* Sul dito, tenere premuto apre il menu del browser: durante la presa no. */
function onContextMenu(event) {
  if (state.presa) event.preventDefault();
}

const AVANTI = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

function onKeyDown(event) {
  /* Esc durante il trascinamento: tutto torna com'era, niente si salva. */
  if (event.key === "Escape" && state.presa) {
    event.preventDefault();
    event.stopPropagation();
    rilascia(state.presa, { rimetti: true });
    return;
  }
  /* Dalla tastiera: la maniglia con le frecce (su e giu' in un elenco, anche
   * destra e sinistra in una griglia). */
  const verso = AVANTI[event.key];
  if (!verso) return;
  const maniglia = event.target?.closest?.("[data-dm-maniglia]");
  const riga = maniglia?.closest?.("[data-dm-riordina-riga]");
  const lista = riga?.parentElement;
  if (!lista?.hasAttribute?.("data-dm-riordina")) return;
  if (!eGriglia(lista) && (event.key === "ArrowLeft" || event.key === "ArrowRight")) return;
  const tutte = righe(lista);
  const da = tutte.indexOf(riga);
  const a = da + verso;
  if (da < 0 || a < 0 || a >= tutte.length) return;
  event.preventDefault();
  event.stopPropagation();
  /* Dopo il ridisegno il fuoco torna sulla maniglia della stessa riga, cosi'
   * si puo' continuare a premere la freccia. */
  const chiave = riga.dataset.dmRiordinaRiga;
  /* L'elenco si riconosce dalle sue classi: nella stessa scheda ce ne puo'
   * essere piu' d'uno con le stesse voci — l'anteprima e l'elenco sotto — e il
   * fuoco deve tornare in quello dove si stava premendo. */
  const esc = (testo) => (root.CSS?.escape ? root.CSS.escape(testo) : testo);
  const classi = [...lista.classList].map((c) => `.${esc(c)}`).join("");
  cadi(lista, da, a);
  annuncia(lista, `${a + 1} / ${tutte.length}`);
  root.queueMicrotask?.(() => {
    const nuova = doc.querySelector?.(`${classi}[data-dm-riordina] > [data-dm-riordina-riga="${esc(chiave)}"]`);
    const fuoco = nuova?.matches?.("[data-dm-maniglia]") ? nuova : nuova?.querySelector?.("[data-dm-maniglia]");
    fuoco?.focus?.();
  });
}

export const STILE_RIORDINA = `
  [data-dm-maniglia]:not([data-dm-riordina-riga]){
    flex:0 0 32px;width:32px;height:44px;margin:-6px 0 -6px -6px;padding:0;border:0;border-radius:10px;
    background:transparent;color:var(--text-dim,#94a3b8);font-size:18px;line-height:1;
    display:inline-flex;align-items:center;justify-content:center;cursor:grab;
    touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
  [data-dm-maniglia]:not([data-dm-riordina-riga]):hover{color:var(--text,#0f172a);background:color-mix(in srgb,var(--text-dim,#94a3b8) 14%,transparent)}
  [data-dm-maniglia]:not([data-dm-riordina-riga]):focus-visible{outline:2px solid var(--accent,#3b82f6);outline-offset:1px}
  [data-dm-riordina][data-dm-trascinando="true"]{user-select:none;-webkit-user-select:none}
  [data-dm-riordina] [data-dm-fa-posto="true"]{transition:transform .18s cubic-bezier(.2,.8,.2,1)}
  [data-dm-riordina] [data-dm-presa="true"]{
    position:relative;z-index:5;cursor:grabbing;
    box-shadow:0 18px 36px -14px rgba(15,23,42,.45),0 0 0 2px var(--accent,#3b82f6)!important;
    background:var(--card-bg,#fff)}
  [data-dm-riordina] [data-dm-presa="true"] [data-dm-maniglia]{cursor:grabbing;color:var(--accent,#3b82f6)}
  html[data-dm-trascinando="true"],html[data-dm-trascinando="true"] *{cursor:grabbing!important;user-select:none!important;-webkit-user-select:none!important}
  [data-dm-riordina="griglia"]{position:relative}
  [data-dm-riordina="griglia"] [data-dm-riordina-riga]{transition:transform .2s cubic-bezier(.2,.8,.2,1)}
  [data-dm-riordina="griglia"] [data-dm-presa="true"]{
    box-shadow:none!important;border-radius:22px;
    background:color-mix(in srgb,var(--accent,#3b82f6) 12%,transparent)!important;
    outline:2px dashed var(--accent,#3b82f6);outline-offset:-2px}
  [data-dm-riordina="griglia"] [data-dm-presa="true"]>*{opacity:0}
  [data-dm-riordina="griglia"] [data-dm-fantasma="true"]{
    z-index:20;opacity:.97;transition:none!important;cursor:grabbing;border-radius:22px;
    filter:drop-shadow(0 22px 26px rgba(15,23,42,.35));
    box-shadow:0 0 0 2px var(--accent,#3b82f6)!important}
  [data-dm-riordina="griglia"] [data-dm-fantasma="true"]>:not(button){width:100%!important;height:100%!important;
    max-width:none!important;margin:0!important;box-sizing:border-box;opacity:1!important}
  [data-dm-tieni]{touch-action:pan-y;-webkit-touch-callout:none;user-select:none;-webkit-user-select:none}
  .dm-riordina-voce{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  @media (prefers-reduced-motion:reduce){[data-dm-riordina] [data-dm-fa-posto="true"],[data-dm-riordina="griglia"] [data-dm-riordina-riga]{transition:none}}
`;

/* Chi deve prendere il puntatore prima che lo vedano altri — la modalita'
 * modifica della plancia, dove una carta ha i suoi gesti (la luminosita' di
 * una luce si regola trascinando) — chiama questi direttamente, in cattura,
 * e ferma l'evento: cosi' il gesto della carta non parte e qui non arriva
 * due volte. */
export const prendiIlPuntatore = Object.freeze({
  giu: (event) => onPointerDown(event),
  muovi: (event) => onPointerMove(event),
  su: (event) => onPointerUp(event),
  annulla: (event) => onPointerCancel(event),
  inMano: () => Boolean(state.presa),
});

export function installTrascinaPerRiordinare() {
  if (!doc || state.installed) return;
  state.installed = true;
  doc.addEventListener("pointerdown", onPointerDown, { passive: false });
  doc.addEventListener("pointermove", onPointerMove, { passive: false });
  doc.addEventListener("pointerup", onPointerUp);
  doc.addEventListener("pointercancel", onPointerCancel);
  doc.addEventListener("keydown", onKeyDown, true);
  doc.addEventListener("touchmove", onTouchMove, { passive: false });
  doc.addEventListener("contextmenu", onContextMenu);
}

senzaCadere(installTrascinaPerRiordinare);
