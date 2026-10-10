/* La linguetta «Batterie» dentro Energia (#117).
 *
 * «Poter aggiungere tutte le entità dei BMS, per esempio ho due BMS JK con
 *  stati di carica, stati di salute, correnti e tensioni varie.»
 *
 * Dei due render che si sono visti prima di scriverla — una voce nuova nella
 * barra, o una linguetta dentro Energia — è stata scelta la seconda: i pacchi
 * sono la batteria che la pagina Energia disegna già come una bolla, e chi li
 * cerca li cerca lì, accanto a Istantanea. Una voce in più nella barra sarebbe
 * stata una sezione per una cosa che una sezione ce l'ha già.
 *
 * Qui c'è solo il montaggio: la linguetta accanto a Istantanea, la sua vista
 * fra le altre viste di Energia, e quando ridisegnarla. Le parole e il disegno
 * li fa `accumulo-section.js`. La linguetta c'è solo quando c'è almeno un
 * pacco dichiarato: chi un accumulo non ce l'ha non vede niente di nuovo.
 *
 * Il verso della scelta fra le viste è quello del guscio: `switchEnergyView`
 * spegne tutte le linguette e tutte le viste prima di accendere la sua, e
 * quindi spegne anche questa. Questa fa lo stesso con le altre.
 */
import {
  ACCUMULO_TAB,
  EVENTO_APRI_ACCUMULO,
  ciSonoPacchi,
  paginaDellAccumulo,
  vistaDellAccumulo,
} from "./accumulo-section.js";
import { lettureDiCasa } from "./home-widgets-section.js";
import {
  doc,
  esc,
  installStyle,
  planciaVisibile,
  quandoSiCambiaPagina,
  root,
  t,
  senzaCadere,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ACCUMULO__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  firma: "",
  richiesto: false,
});

export const ACCUMULO_VIEW_ID = "view-batterie";

/* ── la linguetta e la sua vista ──────────────────────────────────────── */

function paginaEnergia() {
  return doc?.getElementById?.("page-energy") || null;
}

function filaDelleLinguette() {
  return paginaEnergia()?.querySelector?.(".sub-tabs-container .sub-tabs-energy") || null;
}

function laLinguetta() {
  return filaDelleLinguette()?.querySelector?.(`[data-dm-energia-vista="${ACCUMULO_TAB}"]`) || null;
}

function laVista() {
  return doc?.getElementById?.(ACCUMULO_VIEW_ID) || null;
}

/* La vista va con le sue sorelle, dopo l'ultima: è una `flow-view` come loro,
 * e il guscio la spegne con loro. */
function ensureVista() {
  let vista = laVista();
  if (vista) return vista;
  const pagina = paginaEnergia();
  const sorelle = pagina?.querySelectorAll?.(".flow-view");
  if (!sorelle?.length) return null;
  vista = doc.createElement("div");
  vista.id = ACCUMULO_VIEW_ID;
  vista.className = "flow-view";
  vista.innerHTML = `<div class="dm-accu" id="accumulo-wrap"></div>`;
  sorelle[sorelle.length - 1].after(vista);
  return vista;
}

/** Accende la linguetta e la sua vista, come fa `switchEnergyView` con le sue. */
export function apriLAccumulo() {
  const linguetta = ensureLinguetta();
  const vista = ensureVista();
  if (!linguetta || !vista) return false;
  for (const nodo of paginaEnergia().querySelectorAll(".sub-tabs-container .sub-tab-btn"))
    nodo.classList.remove("active");
  for (const nodo of doc.querySelectorAll(".flow-view")) nodo.classList.remove("active");
  linguetta.classList.add("active");
  vista.classList.add("active");
  /* Sul telefono la fila scorre di lato: arrivando dalla tessera in Home la
   * linguetta accesa deve stare a schermo, non oltre il bordo. */
  linguetta.scrollIntoView?.({ inline: "center", block: "nearest", behavior: "instant" });
  state.firma = "";
  dipingi();
  return true;
}

export function ensureLinguetta() {
  const fila = filaDelleLinguette();
  if (!fila) return null;
  let linguetta = laLinguetta();
  if (linguetta) return linguetta;
  linguetta = doc.createElement("button");
  linguetta.type = "button";
  linguetta.className = "sub-tab-btn";
  linguetta.dataset.dmEnergiaVista = ACCUMULO_TAB;
  linguetta.innerHTML = `🔋 ${esc(t("Batterie", "Batteries"))}`;
  linguetta.addEventListener("click", () => {
    if (root.navigator?.vibrate) root.navigator.vibrate(5);
    apriLAccumulo();
    root.scrollTo?.({ top: 0, behavior: "instant" });
  });
  fila.append(linguetta);
  return linguetta;
}

/* In fondo, dopo Temperature: «i tab nella sezione Energia: Batterie va in
 * fondo dopo Temperature». Stava accanto a Istantanea e spingeva le viste di
 * sempre fuori dal loro posto. Si rimette in coda anche quando qualcuno
 * aggiunge una linguetta dopo di lei. */
function inFondoAllaFila(linguetta) {
  const fila = linguetta?.parentElement;
  if (fila && fila.lastElementChild !== linguetta) fila.append(linguetta);
}

/* La linguetta c'è quando c'è un pacco. Se sparisce mentre è aperta — l'ultimo
 * pacco tolto dal Config — si torna a Istantanea, che è la vista di serie. */
function accendiLaLinguetta() {
  const linguetta = ensureLinguetta();
  const vista = ensureVista();
  if (!linguetta || !vista) return;
  inFondoAllaFila(linguetta);
  const serve = ciSonoPacchi();
  linguetta.hidden = !serve;
  if (serve) linguetta.style.removeProperty("display");
  else linguetta.style.setProperty("display", "none", "important");
  if (!serve && vista.classList.contains("active")) {
    const istantanea = [...(filaDelleLinguette()?.querySelectorAll(".sub-tab-btn") || [])].find(
      (nodo) => /'ist'/.test(nodo.getAttribute("onclick") || ""),
    );
    vista.classList.remove("active");
    linguetta.classList.remove("active");
    istantanea?.classList.add("active");
    doc.getElementById("view-ist")?.classList.add("active");
  }
}

function siVede() {
  if (!planciaVisibile()) return false;
  return Boolean(
    paginaEnergia()?.classList.contains("active") && laVista()?.classList.contains("active"),
  );
}

/** La vista con le letture di adesso, e con quello che la pagina Energia sa. */
function vistaDiAdesso() {
  let casa = {};
  try {
    casa = lettureDiCasa();
  } catch (_errore) {
    /* Senza le letture di casa si sa lo stesso tutto dei pacchi: manca solo
     * il «dal fotovoltaico». */
  }
  return vistaDellAccumulo(undefined, { casa });
}

function dipingi() {
  const dove = laVista()?.querySelector?.("#accumulo-wrap");
  if (!dove || !siVede()) return;
  const markup = paginaDellAccumulo(vistaDiAdesso());
  if (state.firma === markup && dove.firstElementChild) return;
  state.firma = markup;
  dove.innerHTML = markup;
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      accendiLaLinguetta();
      /* La tessera in Home ha chiesto questa linguetta, e la voce Energia è
       * stata appena premuta: si apre adesso che la pagina c'è. */
      if (state.richiesto && paginaEnergia()?.classList.contains("active")) {
        state.richiesto = false;
        if (ciSonoPacchi()) apriLAccumulo();
      }
      dipingi();
    } catch (errore) {
      root.console?.warn?.("[DashboardModern] accumulo", errore);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

/** Ridisegna adesso, saltando la firma: la usa chi cambia la configurazione. */
export function renderAccumulo() {
  state.firma = "";
  schedule();
}

/* ── il foglio ────────────────────────────────────────────────────────── */

/* Le schede, l'anello, la pastiglia e la forcella sono quelli della Piscina, e
 * stanno nel suo foglio; la risposta grande è quella dell'Acquario, copiata
 * qui perché quella è legata alla sua pagina. Qui il resto: la carica grande,
 * le caselle delle letture e la striscia delle celle. */
function installStyles() {
  const V = `#${ACCUMULO_VIEW_ID}`;
  installStyle(
    "dm-accumulo-section-style",
    `
    ${V} .dm-accu{display:grid;gap:14px;padding:4px 0 24px}
    ${V} .dm-accu-vuoto{display:grid;gap:6px;padding:22px 18px;text-align:center;
      border:1px dashed var(--divider-color,#dbe4ee);border-radius:18px;background:var(--card-bg,#fff)}
    ${V} .dm-accu-vuoto strong{font-size:14px;font-weight:900}
    ${V} .dm-accu-vuoto span{font-size:12px;font-weight:700;color:var(--secondary-text-color,#64748b)}

    ${V} .dm-accu-testa{
      display:grid;gap:4px;padding:20px 22px;border-radius:22px;min-width:0;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      box-shadow:var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    ${V} .dm-accu-testa>small{
      font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;
      color:var(--text-dim,#64748b)}
    ${V} .dm-accu-testa-riga{display:flex;align-items:baseline;justify-content:space-between;gap:10px;min-width:0}
    ${V} .dm-accu-testa strong{font-size:30px;font-weight:900;line-height:1.05;color:var(--text,#0f172a);min-width:0}
    ${V} .dm-accu-testa[data-stato="carica"] strong{color:#15803d}
    ${V} .dm-accu-testa[data-stato="scarica"] strong{color:#c2410c}
    ${V} .dm-accu-soc{font-family:Oswald,Inter,sans-serif;font-size:40px;font-weight:700;line-height:1;color:var(--text,#0f172a);flex:0 0 auto}
    ${V} .dm-accu-soc i{font-style:normal;font-size:20px;color:var(--text-dim,#64748b);margin-left:2px}
    ${V} .dm-accu-barra{display:block;height:10px;margin:6px 0 4px;border-radius:999px;
      background:color-mix(in srgb,#16a34a 16%,var(--surface-3,#e2e8f0));overflow:hidden}
    ${V} .dm-accu-barra i{display:block;height:100%;width:calc(var(--pct) * 1%);border-radius:999px;
      background:linear-gradient(90deg,#4ade80,#16a34a);box-shadow:0 0 12px rgba(22,163,74,.35)}
    ${V} .dm-accu-nomi{font-size:13px;font-weight:800;color:var(--text,#0f172a)}
    ${V} .dm-accu-sotto{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
    ${V} .dm-accu-avviso{display:flex;align-items:center;gap:8px;margin-top:6px;padding:8px 12px;border-radius:12px;
      background:rgba(245,158,11,.12);color:#b45309;font-size:12px;font-weight:800;line-height:1.35}

    ${V} .dm-accu-pacchi{align-items:start}
    ${V} .dm-accu-pacco{display:grid;gap:12px;min-width:0}
    ${V} .dm-accu-tit{display:grid;gap:1px;min-width:0}
    ${V} .dm-accu-tit>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${V} .dm-accu-marca{font-size:10.5px;font-weight:800;letter-spacing:.4px;color:var(--text-dim,#64748b);text-transform:uppercase}
    ${V} .dm-accu-pacco .dm-pool-badge{white-space:nowrap;flex:0 0 auto}
    ${V} .dm-accu-pacco .dm-pool-badge[data-avviso="true"]{background:rgba(245,158,11,.16);color:#b45309}
    ${V} .dm-accu-pacco .dm-pool-badge[data-verso="scarica"]{background:rgba(234,88,12,.12);color:#c2410c}
    ${V} .dm-accu-pacco[data-stato="muto"]{opacity:.72}
    ${V} .dm-accu-ring{background:conic-gradient(from -90deg,#22c55e 0 calc(var(--pct,0) * 1%),var(--surface-3,#e2e8f0) 0)}
    ${V} .dm-accu-corpo{justify-items:center}
    ${V} .dm-accu-dati{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;min-width:0;width:100%;justify-self:stretch}
    ${V} .dm-accu-dato{display:grid;gap:1px;align-content:start;padding:7px 10px;border-radius:12px;background:var(--surface-2,#f1f5f9);min-width:0}
    ${V} .dm-accu-dato span{font-size:9.5px;font-weight:900;letter-spacing:.7px;text-transform:uppercase;color:var(--text-dim,#64748b);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${V} .dm-accu-dato b{font-family:Oswald,Inter,sans-serif;font-size:17px;font-weight:700;color:var(--text,#0f172a);white-space:nowrap}
    ${V} .dm-accu-dato small{font-size:10px;font-weight:750;color:var(--text-dim,#64748b)}

    ${V} .dm-accu-sez{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 8px;margin-top:2px;font-size:12.5px;font-weight:900;color:var(--text,#0f172a)}
    ${V} .dm-accu-sez small{font-size:11px;font-weight:750;color:var(--text-dim,#64748b)}
    ${V} .dm-accu-celle{display:grid;grid-template-columns:repeat(var(--celle,16),minmax(0,1fr));gap:3px;align-items:end;
      height:74px;padding:8px 8px 0;border-radius:14px;background:var(--surface-2,#f1f5f9)}
    ${V} .dm-accu-cella{position:relative;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;min-width:0}
    ${V} .dm-accu-cella i{display:block;width:100%;max-width:18px;border-radius:5px 5px 2px 2px;background:linear-gradient(180deg,#7dd3fc,#0ea5e9)}
    ${V} .dm-accu-cella[data-tipo="max"] i{background:linear-gradient(180deg,#86efac,#16a34a)}
    ${V} .dm-accu-cella[data-tipo="min"] i{background:linear-gradient(180deg,#fcd34d,#f59e0b)}
    ${V} .dm-accu-cella em{font-style:normal;font-size:8.5px;font-weight:800;line-height:14px;color:var(--text-dim,#64748b)}
    ${V} .dm-accu-celle-leg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11.5px;font-weight:800;color:var(--text,#0f172a)}
    ${V} .dm-accu-celle-leg span{display:inline-flex;align-items:center;gap:6px}
    ${V} .dm-accu-celle-leg i{width:10px;height:10px;border-radius:3px;background:#f59e0b}
    ${V} .dm-accu-celle-leg [data-tipo="max"] i{background:#16a34a}
    /* Sul telefono i numeri sotto le celle si stringono: con ventiquattro
       celle a 8,5 punti si leggerebbero uno sopra l'altro. */
    @media(max-width:520px){
      ${V} .dm-accu-cella em{font-size:7.5px}
      ${V} .dm-accu-celle{gap:2px;padding:8px 6px 0}
      ${V} .dm-accu-testa{padding:18px}
      ${V} .dm-accu-testa strong{font-size:26px}
    }
    `,
  );
}

export function installAccumuloInEnergia() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  ensureVista();
  ensureLinguetta();
  for (const nome of ["render", "switchEnergyView"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmAccumulo) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    avvolta.__dmAccumulo = true;
    avvolta.__dmPrevious = precedente;
    root[nome] = avvolta;
  }
  root.addEventListener?.(EVENTO_APRI_ACCUMULO, () => {
    state.richiesto = true;
    schedule();
  });
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  doc.addEventListener?.("visibilitychange", schedule);
  quandoSiCambiaPagina(schedule);
  schedule();
  return true;
}

senzaCadere(installAccumuloInEnergia);
