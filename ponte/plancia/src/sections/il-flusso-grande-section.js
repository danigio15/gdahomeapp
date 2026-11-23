/* Il flusso dell'energia, grande, in Home (#460).
 *
 * «Vorrei una card da esporre in primo piano del fotovoltaico e non il
 * semplice widget, si può fare?» Si': un blocco della Home, «Flusso energia»,
 * che si accende nella scheda Home del Config e si mette in fila con gli altri
 * blocchi (`home-blocchi-section.js`). Il sole, la rete, la batteria e la
 * casa, coi numeri dal vivo, la batteria in percento, e le frecce di puntini che corrono nel
 * verso dell'energia, piu' grosse quanto piu' passa. Un tocco apre l'Energia.
 *
 * Chi decide quali nodi e quali frecce e' il modulo puro
 * `core/il-flusso-in-home.js`; i numeri sono le letture di casa della tessera
 * Energia (`lettureDiCasa`), quindi quello che si legge qui e' quello che si
 * legge li'. Qui c'e' la mano che disegna.
 *
 * Il disegno si fa una volta e poi si aggiorna al suo posto: riscriverlo a
 * ogni lettura farebbe ripartire i puntini da capo ogni pochi secondi. Le
 * strade delle frecce si misurano in pixel, quando il palco cambia misura,
 * cosi' i cerchi restano tondi e i puntini puntini. I puntini stanno fermi con
 * «riduci animazioni» e quando la pagina non si vede.
 */
import {
  BLOCCO_DEL_FLUSSO,
  CHIAVE_FLUSSO_IN_HOME,
  ilFlussoDiCasa,
  ilFlussoSiVede,
  postiDelFlusso,
  stradaFra,
} from "../core/il-flusso-in-home.js";
import { laPotenzaInParole } from "../core/le-unita-della-corrente.js";
import { oggettoWidget } from "../core/oggetti-widget.js";
import {
  FONDO_DELLA_CARTA,
  GRANA_DELLA_CARTA,
  OMBRA_DELLA_CARTA,
  tokenDellaCarta,
} from "../core/le-vesti-della-carta.js";
import { lettureDiCasa } from "./home-widgets-section.js";
import { allStates, doc, esc, installStyle, locale, readJson, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_FLUSSO_IN_HOME__";
const STYLE_ID = "dm-flusso-home-style";
export const BLOCCO_ID = "dm-flusso-home";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  struttura: "",
  posti: null,
  osservatore: null,
});

/* I colori dell'Energia: il sole ambra, la rete blu, la batteria verde, e
 * l'auto col ciano del cerchio della Wallbox. La casa e' del colore del
 * testo, come il suo cerchio nella pagina Energia. */
const DISEGNO = Object.freeze({
  solare: "solare",
  rete: "energia",
  casa: "home",
  batteria: "accumulo",
  auto: "ev",
});

const NOMI = () => ({
  solare: t("Solare", "Solar"),
  rete: t("Rete", "Grid"),
  casa: t("Casa", "Home"),
  batteria: t("Batteria", "Battery"),
  auto: t("Auto", "Car"),
});

const VERSI = () => ({
  produce: t("produce", "producing"),
  preleva: t("prelievo", "importing"),
  immette: t("immissione", "exporting"),
  carica: t("in carica", "charging"),
  scarica: t("in scarica", "discharging"),
  consuma: "",
  fermo: t("fermo", "idle"),
  ferma: t("ferma", "idle"),
});

/** Il blocco si vede? Lo dice la casella della scheda Home. */
export function ilFlussoEAcceso() {
  return ilFlussoSiVede(readJson(CHIAVE_FLUSSO_IN_HOME, null));
}

/** Il modello di adesso: le letture di casa, spartite.
 *
 * Sotto la casa, per ora, nessun carico: «Non mostrare alcun carico sotto
 * la casa al momento.» L'auto della wallbox il modulo puro la sa disegnare
 * (`auto` di `ilFlussoDiCasa`), ma qui non gliela si passa. */
export function modelloDelFlusso(states = allStates()) {
  return ilFlussoDiCasa(lettureDiCasa(states));
}

const potenza = (watt) =>
  watt == null ? "—" : laPotenzaInParole(Math.abs(watt), { lingua: locale() });

/* La casa e' il mozzo: il numero sta dentro il suo cerchio, cosi' le frecce
 * che le arrivano da sopra (il sole) e partono sotto (l'auto) non passano
 * sotto una scritta. Il sole e l'auto, che stanno sulla stessa colonna, hanno
 * la scritta di fianco per la stessa ragione; rete e batteria sotto. */
function nodoMarkup(nodo, posto) {
  const nome = NOMI()[nodo.k];
  const dove = posto ? ` style="left:${posto.x}%;top:${posto.y}%"` : "";
  if (nodo.k === "casa")
    return `<div class="dm-fh-nodo" data-k="casa" data-lato="dentro"${dove} title="${esc(nome)}">
    <span class="dm-fh-cerchio">
      <span class="dm-fh-ic" aria-hidden="true">${oggettoWidget(DISEGNO.casa, "", "flusso-casa")}</span>
      <span class="dm-fh-testo"><b data-fh-valore></b><small>${esc(nome)}</small><i data-fh-verso></i></span>
    </span>
  </div>`;
  const lato = nodo.k === "solare" || nodo.k === "auto" ? "fianco" : "sotto";
  return `<div class="dm-fh-nodo" data-k="${nodo.k}" data-lato="${lato}"${dove}>
    <span class="dm-fh-cerchio"${nodo.soc != null ? ` style="--soc:${nodo.soc}"` : ""}>
      <span class="dm-fh-ic" aria-hidden="true">${oggettoWidget(DISEGNO[nodo.k], "", `flusso-${nodo.k}`)}</span>
    </span>
    <span class="dm-fh-testo">
      <b data-fh-valore></b>
      <small>${esc(nome)}</small>
      <i data-fh-verso></i>
    </span>
  </div>`;
}

function strutturaMarkup(modello) {
  const archi = modello.archi
    .map(
      (arco) => `<path class="dm-fh-binario" data-fh-arco="${arco.id}"/>
      <path class="dm-fh-puntini" data-fh-puntini="${arco.id}" pathLength="100"/>`,
    )
    .join("");
  const { posti, file } = postiDelFlusso(modello.nodi);
  return `<div class="section-title"><span class="dm-fh-titolo-ic" aria-hidden="true">${oggettoWidget(
    "solare",
    "",
    "flusso-titolo",
  )}</span>${esc(t("Flusso energia", "Energy flow"))}</div>
    <div class="dm-fh-carta" role="button" tabindex="0" data-dm-flusso-home
      aria-label="${esc(t("Flusso energia: apri la pagina Energia", "Energy flow: open the Energy page"))}">
      <div class="dm-fh-palco" style="--file:${file}">
        <svg class="dm-fh-fili" aria-hidden="true">${archi}</svg>
        ${modello.nodi.map((nodo) => nodoMarkup(nodo, posti[nodo.k])).join("")}
      </div>
    </div>`;
}

/* Le strade delle frecce, in pixel, dalle misure vere del palco. */
function posaLeStrade(blocco, modello) {
  const palco = blocco.querySelector(".dm-fh-palco");
  const svg = blocco.querySelector(".dm-fh-fili");
  if (!palco || !svg) return;
  const larghezza = palco.clientWidth;
  const altezza = palco.clientHeight;
  if (!larghezza || !altezza) return;
  const misura = larghezza < 420 ? "stretto" : larghezza < 760 ? "medio" : "largo";
  if (palco.dataset.misura !== misura) palco.dataset.misura = misura;
  const { posti } = postiDelFlusso(modello.nodi);
  const px = {};
  for (const [k, p] of Object.entries(posti)) {
    px[k] = { x: (p.x / 100) * larghezza, y: (p.y / 100) * altezza };
  }
  /* Il raggio di ogni cerchio, misurato: la casa e' piu' grande degli altri. */
  const raggio = {};
  for (const k of Object.keys(px))
    raggio[k] =
      (palco.querySelector(`.dm-fh-nodo[data-k="${k}"] .dm-fh-cerchio`)?.offsetWidth || 56) / 2 + 5;
  svg.setAttribute("viewBox", `0 0 ${larghezza} ${altezza}`);
  for (const arco of modello.archi) {
    const d = stradaFra(px[arco.da], px[arco.a], {
      rDa: raggio[arco.da],
      rA: raggio[arco.a],
      arco: arco.id === "batteria-rete",
      gomito: arco.da === "solare" && arco.a !== "casa",
    });
    for (const sel of [`[data-fh-arco="${arco.id}"]`, `[data-fh-puntini="${arco.id}"]`]) {
      const path = svg.querySelector(sel);
      if (path && path.getAttribute("d") !== d) path.setAttribute("d", d);
    }
  }
  state.posti = `${larghezza}x${altezza}`;
}

/* I numeri e le frecce di adesso, al loro posto, senza rifare il disegno. */
function aggiornaINumeri(blocco, modello) {
  const versi = VERSI();
  for (const nodo of modello.nodi) {
    const el = blocco.querySelector(`.dm-fh-nodo[data-k="${nodo.k}"]`);
    if (!el) continue;
    const valore = el.querySelector("[data-fh-valore]");
    const testo =
      nodo.k === "batteria" && nodo.soc != null ? `${Math.round(nodo.soc)}%` : potenza(nodo.watt);
    if (valore.textContent !== testo) valore.textContent = testo;
    let parola = versi[nodo.verso] || "";
    /* La batteria scrive la percentuale in grande: i watt li dice accanto al verso. */
    if (nodo.k === "batteria" && nodo.soc != null && nodo.watt != null && Math.abs(nodo.watt) >= 10)
      parola = `${parola} ${potenza(nodo.watt)}`.trim();
    if (nodo.k === "auto" && nodo.soc != null)
      parola = `${Math.round(nodo.soc)}%${parola ? ` · ${parola}` : ""}`;
    const verso = el.querySelector("[data-fh-verso]");
    const scritta = parola;
    if (verso.textContent !== scritta) verso.textContent = scritta;
    if (el.dataset.verso !== nodo.verso) el.dataset.verso = nodo.verso;
    const cerchio = el.querySelector(".dm-fh-cerchio");
    if (nodo.soc != null) cerchio.style.setProperty("--soc", String(nodo.soc));
  }
  for (const arco of modello.archi) {
    const binario = blocco.querySelector(`[data-fh-arco="${arco.id}"]`);
    const puntini = blocco.querySelector(`[data-fh-puntini="${arco.id}"]`);
    if (!binario || !puntini) continue;
    /* La strada e' una, il verso lo dice chi la percorre: rete e batteria
     * si scambiano i capi. */
    const capi = `${arco.da}>${arco.a}`;
    if (puntini.dataset.capi !== capi) {
      puntini.dataset.capi = capi;
      puntini.dataset.da = arco.da;
      binario.dataset.da = arco.da;
      state.posti = null;
    }
    binario.dataset.si = String(arco.attivo || arco.sempre);
    puntini.dataset.si = String(arco.attivo);
    /* Lo spessore e il passo a scalini: un numero che cambia di un watt non
     * deve far ripartire i puntini. */
    const larghezza = (Math.round(arco.larghezza * 2) / 2).toFixed(1);
    const durata = (Math.max(0.5, Math.round(arco.durata * 4) / 4) * 1.6).toFixed(2);
    if (puntini.style.getPropertyValue("--w") !== larghezza)
      puntini.style.setProperty("--w", larghezza);
    if (puntini.style.getPropertyValue("--t") !== `${durata}s`)
      puntini.style.setProperty("--t", `${durata}s`);
  }
}

function avvisaCheENato() {
  try {
    root.dispatchEvent?.(
      new CustomEvent("dashboardmodern:blocco-nuovo", { detail: { id: BLOCCO_ID } }),
    );
  } catch (_errore) {}
}

function host(pagina) {
  let nodo = doc?.getElementById?.(BLOCCO_ID);
  if (nodo) return nodo;
  nodo = doc.createElement("section");
  nodo.id = BLOCCO_ID;
  nodo.className = "dm-flusso-home";
  nodo.dataset.blocco = BLOCCO_DEL_FLUSSO;
  pagina.append(nodo);
  avvisaCheENato();
  return nodo;
}

function osserva(blocco) {
  if (state.osservatore || typeof root.ResizeObserver !== "function") return;
  state.osservatore = new root.ResizeObserver(() => {
    state.posti = null;
    schedule();
  });
  state.osservatore.observe(blocco);
}

function togli() {
  state.osservatore?.disconnect?.();
  state.osservatore = null;
  state.struttura = "";
  state.posti = null;
  doc?.getElementById?.(BLOCCO_ID)?.remove();
}

export function renderIlFlussoInHome() {
  const pagina = doc?.getElementById?.("page-home");
  if (!pagina) return false;
  if (!ilFlussoEAcceso()) {
    togli();
    return false;
  }
  const modello = modelloDelFlusso();
  if (modello.vuoto) {
    /* Nessuna sorgente configurata: un disegno con la sola casa non dice
     * niente, e il blocco non c'e'. */
    togli();
    return false;
  }
  const blocco = host(pagina);
  const struttura = [
    modello.nodi.map((nodo) => nodo.k).join(","),
    modello.archi.map((arco) => arco.id).join(","),
    t("Flusso energia", "Energy flow"),
  ].join("|");
  if (state.struttura !== struttura || !blocco.querySelector(".dm-fh-palco")) {
    blocco.innerHTML = strutturaMarkup(modello);
    state.struttura = struttura;
    state.posti = null;
  }
  osserva(blocco);
  aggiornaINumeri(blocco, modello);
  if (!state.posti) posaLeStrade(blocco, modello);
  fermaSeNonSiVede();
  return true;
}

/* I puntini si fermano quando la pagina non si vede: il tablet a muro col
 * browser dietro, il telefono in tasca. «Riduci animazioni» li ferma dal
 * foglio. */
function fermaSeNonSiVede() {
  const blocco = doc?.getElementById?.(BLOCCO_ID);
  if (!blocco) return;
  const fermo = String(Boolean(doc.hidden));
  if (blocco.dataset.fermo !== fermo) blocco.dataset.fermo = fermo;
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      renderIlFlussoInHome();
    } catch (errore) {
      root.console?.warn?.("[DashboardModern] flusso in home", errore);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

/** Rifa' il blocco adesso: lo chiama la scheda quando si accende o si spegne. */
export function ridisegnaIlFlussoInHome() {
  state.struttura = "";
  schedule();
}

/* Il tocco porta in Energia, con la voce vera della barra: e' il gesto che il
 * guscio conosce. Se l'Energia e' spenta il tocco non porta da nessuna parte. */
function apriLEnergia() {
  const voce = doc?.querySelector?.('.tab[data-tab="energy"]');
  if (!voce || voce.style?.display === "none") return false;
  voce.click();
  return true;
}

function onClick(evento) {
  if (!evento.target?.closest?.(`#${BLOCCO_ID} [data-dm-flusso-home]`)) return;
  evento.preventDefault();
  apriLEnergia();
}

function onKey(evento) {
  if (evento.key !== "Enter" && evento.key !== " ") return;
  const carta = evento.target?.closest?.(`#${BLOCCO_ID} [data-dm-flusso-home]`);
  if (!carta || evento.target !== carta) return;
  evento.preventDefault();
  apriLEnergia();
}

const COLORI = `
  --fh-solare:#f59e0b;--fh-rete:#2563eb;--fh-batteria:#10b981;--fh-auto:#06b6d4;--fh-casa:var(--text,#0f172a)`;

function stile() {
  const B = `#${BLOCCO_ID}`;
  installStyle(
    STYLE_ID,
    `
  ${tokenDellaCarta(B)}
  ${B}{display:block;margin-top:18px;${COLORI}}
  html[data-theme="dark"] ${B}{--fh-rete:#60a5fa;--fh-batteria:#34d399;--fh-solare:#fbbf24;--fh-auto:#22d3ee}
  ${B} .section-title{display:flex;align-items:center;gap:8px}
  .dm-fh-titolo-ic{display:inline-grid;place-items:center;width:20px;height:20px}
  .dm-fh-titolo-ic svg{width:20px;height:20px}
  ${B} .dm-fh-carta{position:relative;overflow:hidden;border-radius:26px;padding:12px 8px 58px;cursor:pointer;
    color:var(--text,#0f172a);background:${FONDO_DELLA_CARTA};box-shadow:${OMBRA_DELLA_CARTA};
    transition:transform .18s cubic-bezier(.16,1,.3,1)}
  ${B} .dm-fh-carta::before{${GRANA_DELLA_CARTA}}
  @media(hover:hover){${B} .dm-fh-carta:hover{transform:translateY(-2px)}}
  ${B} .dm-fh-carta:active{transform:translateY(1px) scale(.997)}
  ${B} .dm-fh-carta:focus-visible{outline:2px solid var(--fh-rete);outline-offset:3px}

  /* Il palco: alto quanto le sue file, la croce coi posti in percento. */
  ${B} .dm-fh-palco{--r:30px;--fila:132px;position:relative;height:calc(var(--file) * var(--fila));max-width:920px;margin:0 auto}
  ${B} .dm-fh-palco[data-misura="stretto"]{--r:26px;--fila:124px}
  ${B} .dm-fh-palco[data-misura="largo"]{--r:38px;--fila:156px}
  ${B} .dm-fh-fili{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
  ${B} .dm-fh-binario{fill:none;stroke:color-mix(in srgb,var(--text-dim,#94a3b8) 30%,transparent);stroke-width:2;stroke-linecap:round;display:none}
  ${B} .dm-fh-binario[data-si="true"]{display:inline}
  /* La scia di luce della pagina Energia: una cometa per tratto, che corre sul
     binario tenue della sua strada (il percorso e' lungo cento, \`pathLength\`:
     una scia di quattordici e il vuoto per il resto). «Qua vedo
     l'animazione, nella nuova no»: i puntini si fermavano con «riduci
     animazioni», la pagina Energia no. Adesso sono la stessa cosa, e si
     comportano allo stesso modo. */
  ${B} .dm-fh-puntini{fill:none;stroke:var(--fh-c);stroke-width:calc(var(--w,4) * 1px + 1.5px);stroke-linecap:round;stroke-dasharray:14 86;
    display:none;animation:dm-fh-corre var(--t,1.6s) linear infinite!important;animation-play-state:running!important;
    will-change:stroke-dashoffset;filter:drop-shadow(0 0 5px var(--fh-c))}
  ${B} .dm-fh-puntini[data-si="true"]{display:inline}
  ${B} [data-da="solare"]{--fh-c:var(--fh-solare)}
  ${B} [data-da="rete"]{--fh-c:var(--fh-rete)}
  ${B} [data-da="batteria"]{--fh-c:var(--fh-batteria)}
  ${B} [data-da="casa"]{--fh-c:var(--fh-auto)}
  ${B} .dm-fh-binario[data-si="true"]{stroke:color-mix(in srgb,var(--fh-c) 22%,color-mix(in srgb,var(--text-dim,#94a3b8) 25%,transparent))}
  @keyframes dm-fh-corre{from{stroke-dashoffset:0}to{stroke-dashoffset:-100}}
  ${B}[data-fermo="true"] .dm-fh-puntini{animation-play-state:paused!important}
  @media(prefers-reduced-motion:reduce){
    ${B} .dm-fh-carta{transition:none}
  }

  /* I nodi: il cerchio col disegno, e sotto il numero e la parola. */
  ${B} .dm-fh-nodo{position:absolute;left:50%;top:50%;transform:translate(-50%,calc(-1 * var(--r)));
    display:flex;flex-direction:column;align-items:center;gap:5px;z-index:1;width:max-content;max-width:42%}
  ${B} .dm-fh-nodo[data-k="solare"]{--c:var(--fh-solare)}
  ${B} .dm-fh-nodo[data-k="rete"]{--c:var(--fh-rete)}
  ${B} .dm-fh-nodo[data-k="batteria"]{--c:var(--fh-batteria)}
  ${B} .dm-fh-nodo[data-k="auto"]{--c:var(--fh-auto)}
  ${B} .dm-fh-nodo[data-k="casa"]{--c:var(--fh-casa)}
  ${B} .dm-fh-cerchio{position:relative;display:grid;place-items:center;width:calc(var(--r) * 2);height:calc(var(--r) * 2);border-radius:50%;
    background:var(--card-bg,#fff);
    box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 75%,transparent),0 10px 22px -12px color-mix(in srgb,var(--c) 80%,rgba(15,23,42,.6))}
  ${B} .dm-fh-nodo[data-verso="fermo"] .dm-fh-cerchio,${B} .dm-fh-nodo[data-verso="ferma"] .dm-fh-cerchio{
    box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 30%,transparent)}
  /* La batteria: l'anello si riempie quanto la carica. */
  ${B} .dm-fh-cerchio[style*="--soc"]{box-shadow:0 10px 22px -12px color-mix(in srgb,var(--c) 80%,rgba(15,23,42,.6))}
  ${B} .dm-fh-cerchio[style*="--soc"]::before{content:"";position:absolute;inset:-5px;border-radius:50%;
    background:conic-gradient(var(--c) calc(var(--soc) * 1%),color-mix(in srgb,var(--c) 16%,transparent) 0);
    -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 5px),#000 calc(100% - 4px));
    mask:radial-gradient(farthest-side,transparent calc(100% - 5px),#000 calc(100% - 4px))}
  ${B} .dm-fh-ic{display:grid;place-items:center;width:58%;height:58%}
  ${B} .dm-fh-ic svg{width:100%;height:100%;display:block}
  ${B} .dm-fh-testo{display:flex;flex-direction:column;align-items:center;gap:1px;padding:2px 8px 3px;border-radius:10px;
    text-align:center;max-width:100%}
  ${B} .dm-fh-testo b{font-family:'Oswald','Inter',sans-serif;font-weight:500;font-size:19px;line-height:1.15;
    letter-spacing:.01em;font-variant-numeric:tabular-nums;white-space:nowrap}
  /* Il nome, e sotto cosa sta facendo: due righe corte invece di una lunga,
     che sul telefono non ci stava. */
  ${B} .dm-fh-testo small{font-size:10px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--text-dim,#64748b);
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
  ${B} .dm-fh-testo i{font-style:normal;font-size:11px;font-weight:700;line-height:1.2;color:color-mix(in srgb,var(--c) 70%,var(--text,#0f172a));
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
  ${B} .dm-fh-testo i:empty{display:none}
  ${B} .dm-fh-palco[data-misura="stretto"] .dm-fh-testo b{font-size:16px}
  ${B} .dm-fh-palco[data-misura="stretto"] .dm-fh-testo small{font-size:9px}
  ${B} .dm-fh-palco[data-misura="stretto"] .dm-fh-testo i{font-size:10px}
  ${B} .dm-fh-palco[data-misura="largo"] .dm-fh-testo b{font-size:24px}
  ${B} .dm-fh-palco[data-misura="largo"] .dm-fh-testo small{font-size:11.5px}
  ${B} .dm-fh-palco[data-misura="largo"] .dm-fh-testo i{font-size:13px}

  /* Il sole e l'auto: la scritta di fianco, la colonna di mezzo resta alle
     frecce. Il centro del cerchio resta sul suo posto. */
  ${B} .dm-fh-nodo[data-lato="fianco"]{flex-direction:row;gap:8px;transform:translate(calc(-1 * var(--r)),-50%);max-width:none}
  ${B} .dm-fh-nodo[data-lato="fianco"] .dm-fh-testo{align-items:flex-start;text-align:left;padding-left:4px}
  /* Il sole sale un po': dal suo fianco partono le frecce verso la rete e la
     batteria, in orizzontale, e la scritta ci starebbe sopra. */
  ${B} .dm-fh-nodo[data-k="solare"] .dm-fh-testo{transform:translateY(calc(-50% - 8px))}
  /* La casa: un cerchio piu' grande, col numero dentro. */
  ${B} .dm-fh-nodo[data-lato="dentro"]{transform:translate(-50%,-50%);max-width:none}
  ${B} .dm-fh-nodo[data-lato="dentro"] .dm-fh-cerchio{width:calc(var(--r) * 2.8);height:calc(var(--r) * 2.8);
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px}
  ${B} .dm-fh-nodo[data-lato="dentro"] .dm-fh-ic{width:34%;height:34%;flex:0 0 auto}
  ${B} .dm-fh-nodo[data-lato="dentro"] .dm-fh-testo{padding:0;background:none;gap:0}
  ${B} .dm-fh-nodo[data-lato="dentro"] .dm-fh-testo b{line-height:1.05}
  ${B} .dm-fh-nodo[data-lato="dentro"] .dm-fh-testo small{font-size:8.5px}
  ${B} .dm-fh-palco[data-misura="largo"] .dm-fh-nodo[data-lato="dentro"] .dm-fh-testo small{font-size:10.5px}
  `,
  );
}

export function installIlFlussoInHome() {
  if (!doc || state.installed) return false;
  state.installed = true;
  stile();
  doc.addEventListener("click", onClick);
  doc.addEventListener("keydown", onKey);
  doc.addEventListener("visibilitychange", fermaSeNonSiVede);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  /* Tornando sulla Home le misure del palco sono quelle vere: prima, a pagina
   * nascosta, erano zero. */
  doc.addEventListener("click", (evento) => {
    if (evento.target?.closest?.(".tab,[data-tab]")) {
      state.posti = null;
      schedule();
    }
  });
  schedule();
  return true;
}
