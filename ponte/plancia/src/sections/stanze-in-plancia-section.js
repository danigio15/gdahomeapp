/* Le stanze in plancia (#493).
 *
 * «Have the option to display a block on the home screen — like a widget or a
 * quick action — showing the rooms or areas of the house (such as the garden,
 * garage, etc.). It should also be possible to choose which rooms or areas
 * appear on the home screen.»
 *
 * Le stanze la plancia le ha già tutte: la loro pagina, le loro entità, la loro
 * icona. Quello che non aveva è il pezzo di casa da cui si guardano senza
 * aprire niente — una fila di stanze in plancia, con dentro la temperatura e
 * quante cose sono accese, e il tocco che porta dentro la stanza.
 *
 * Il blocco non c'è finché nessuno sceglie una stanza: una plancia non deve
 * riempirsi da sola di roba che nessuno ha chiesto. Chi ne sceglie una lo vede
 * comparire, e da lì in poi si sposta con gli altri blocchi — le persone, le
 * tessere, le azioni rapide — perché è un blocco come loro.
 *
 * Chi decide sta nel modulo puro `core/stanze-in-plancia.js`; qui c'è la mano
 * che disegna e il tocco che porta nella stanza.
 */
import { eAcceso } from "../core/stato-acceso.js";
import { oggettoWidget } from "../core/oggetti-widget.js";
import {
  CHIAVE_STANZE_IN_PLANCIA,
  idDellaStanza,
  stanzeInPlancia,
} from "../core/stanze-in-plancia.js";
import {
  allStates,
  clean,
  doc,
  esc,
  iconGlyphHtml,
  installStyle,
  readJson,
  root,
  t,
} from "./shared.js";
import { apriLaStanza, roomPages } from "./rooms-page-section.js";

const KEY = "__DASHBOARDMODERN_STANZE_IN_PLANCIA__";
const STYLE_ID = "dm-stanze-plancia-style";
export const BLOCCO_ID = "dm-stanze-home";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "" });

export function stanzeScelte() {
  const scritto = readJson(CHIAVE_STANZE_IN_PLANCIA, []);
  return Array.isArray(scritto) ? scritto : [];
}

/* Il disegno della stanza, dal catalogo di casa: è lo stesso che la stanza
 * porta nella sua pagina e nel Clima, e prenderne un altro qui vorrebbe dire
 * la stessa stanza con due facce.
 *
 * Il ripiego non e' il token. Qui si tornava a mani vuote quando il motore non
 * rispondeva, e chi chiamava scriveva al suo posto `pagina.icon`: una stanza
 * con l'icona scelta dal catalogo mdi si ritrovava «mdi:sofa» stampato come
 * parola dentro la card. Il ripiego adesso e' un simbolo, ed e' `iconGlyphHtml`
 * a sceglierlo — la stessa regola di tutta la plancia, scritta una volta. */
function disegnoDellaStanza(icona) {
  return iconGlyphHtml(icona, { size: 34, kind: "room", fallback: "🛋️" });
}

const numero = (entity, states) => {
  const grezzo = clean(states?.[clean(entity)]?.state).replace(",", ".");
  const valore = Number.parseFloat(grezzo);
  return Number.isFinite(valore) ? valore : null;
};

/**
 * Cosa dice la card di una stanza: i gradi, l'umidità, e quante cose accese.
 *
 * Le cose accese si contano su quello che la stanza ha davvero dentro — le
 * stesse voci che la sua pagina elenca — e non su un elenco parallelo: due
 * conti della stessa cosa diventano due conti diversi al primo blocco nuovo.
 */
/* Che disegno porta ogni genere di cosa, nel conto per tipo (#546).
 *
 * «Small icons should appear on the card to indicate the status or count of
 * lights (on/off), climate control, power outlets, alerts, doors, windows and
 * temperature.» Il conto unico — «3 accese» — non distingue una luce da un
 * condizionatore, ed e' proprio la distinzione che serve a decidere se valga
 * la pena entrare nella stanza.
 *
 * I disegni sono quelli di casa, gli stessi delle tessere e della fascia sotto
 * il meteo: un blocco della stanza e la tessera che lo racconta devono avere
 * la stessa faccia. Le emoji che la pagina Stanze usa per i titoli dei blocchi
 * qui non entrano — sarebbero un secondo alfabeto per la stessa cosa. */
const OGGETTO_DEL_BLOCCO = Object.freeze({
  luci: "luci",
  clima: "clima",
  prese: "prese",
  coperture: "tapparelle",
  elettrodomestici: "elettrodomestici",
  media: "media",
  telecamere: "telecamere",
  carichi: "energia",
  robot: "robot",
  irrigazione: "irrigazione",
  altro: "evidenza",
});

export function riassuntoDellaStanza(pagina, states = allStates()) {
  const gradi = numero(pagina?.temp, states);
  const umidita = numero(pagina?.hum, states);
  let accese = 0;
  /* Il conto per genere, nell'ordine in cui i blocchi stanno nella stanza: e'
   * l'ordine che la pagina della stanza mostra gia', e due ordini diversi per
   * la stessa casa sono due cose da tenere a mente. */
  const perTipo = [];
  for (const blocco of pagina?.blocchi || []) {
    const chiave = clean(blocco?.key);
    let quante = 0;
    for (const voce of blocco?.voci || []) {
      /* «Acceso» non vuol dire `on` e basta: una cassa che suona dice
       * `playing`, un condizionatore che scalda dice `heat`, un robot al
       * lavoro dice `cleaning`. Contando la sola parola `on` si contavano gli
       * interruttori, e una stanza con la musica accesa e il termosifone che
       * va risultava spenta. Le parole stanno in un posto solo. */
      const entity = clean(voce?.entity || voce?.entity_id);
      if (entity && eAcceso(states?.[entity])) quante += 1;
    }
    if (!quante) continue;
    accese += quante;
    perTipo.push({ chiave, oggetto: OGGETTO_DEL_BLOCCO[chiave] || "evidenza", quante });
  }
  return { gradi, umidita, accese, perTipo, quante: Number(pagina?.count) || 0 };
}

/* Le pastiglie di cosa e' acceso, un genere per pastiglia (#546).
 *
 * Escono solo i generi che hanno qualcosa acceso: una fila di zeri non e' un
 * colpo d'occhio, e' un modulo da compilare. Il numero sta accanto al disegno
 * perche' «due luci» e «una luce» sono due notizie diverse. */
function accesePerTipoMarkup(perTipo) {
  if (!perTipo.length) return "";
  return `<span class="dm-stanza-plancia-generi">${perTipo
    .map(
      (voce) =>
        `<span class="dm-stanza-plancia-genere" data-dm-genere="${esc(voce.chiave)}">` +
        `<span class="dm-stanza-plancia-genere-ic" aria-hidden="true">${oggettoWidget(
          voce.oggetto,
        )}</span><b>${esc(String(voce.quante))}</b></span>`,
    )
    .join("")}</span>`;
}

function cardMarkup(pagina, states) {
  const { gradi, umidita, accese, perTipo } = riassuntoDellaStanza(pagina, states);
  const disegno = disegnoDellaStanza(pagina.icon);
  const misure = [
    gradi === null ? "" : `${Math.round(gradi)}°`,
    umidita === null ? "" : `${Math.round(umidita)}%`,
  ]
    .filter(Boolean)
    .join(" · ");
  const acceso = accese > 0;
  /* Il nome, il disegno e le misure stanno in colonna e in mezzo (#546):
   * «with the room icon and name centered». Di fianco, con le pastiglie dei
   * generi sotto, il nome finiva schiacciato in un angolo della card e la
   * fila delle pastiglie restava appesa a destra senza un asse. */
  return `<button type="button" class="dm-stanza-plancia" data-dm-stanza-plancia="${esc(pagina.id)}"
      data-accesa="${acceso}" aria-label="${esc(pagina.name)}">
    <span class="dm-stanza-plancia-ic" aria-hidden="true">${disegno}</span>
    <span class="dm-stanza-plancia-testo">
      <b>${esc(pagina.name)}</b>
      <small>${esc(misure)}</small>
    </span>
    ${accesePerTipoMarkup(perTipo)}
  </button>`;
}

/* «E' nato un blocco»: l'avviso per chi mette i blocchi in fila.
 *
 * Il blocco nasce in fondo alla pagina, perche' `append` non conosce l'ordine
 * che chi ha la casa si e' scelto. Chi quell'ordine lo applica gira sugli
 * eventi di stato, e quando questo blocco nasce quel giro e' gia' passato: il
 * disegno sta dentro un requestAnimationFrame, la messa in fila no. Cosi' la
 * prima stanza spuntata compariva in coda alla Home — sotto i dispositivi,
 * anche a chi le stanze le aveva messe in cima — e ci restava fino al cambio
 * di stato seguente, che rimetteva tutto a posto per caso.
 *
 * Si avvisa invece di chiamare: e' la sezione che ordina a conoscere questa,
 * e chiamarla da qui sarebbe un anello fra due moduli. */
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
  if (!pagina) return null;
  nodo = doc.createElement("section");
  nodo.id = BLOCCO_ID;
  nodo.className = "dm-stanze-plancia";
  pagina.append(nodo);
  avvisaCheENato();
  return nodo;
}

export function renderStanzeInPlancia() {
  const pagina = doc?.getElementById?.("page-home");
  if (!pagina) return false;
  let pagine = [];
  try {
    pagine = stanzeInPlancia(stanzeScelte(), roomPages());
  } catch (_errore) {
    pagine = [];
  }
  const nodo = doc.getElementById(BLOCCO_ID);
  if (!pagine.length) {
    /* Nessuna stanza scelta: il blocco non c'è. Lasciarlo vuoto vorrebbe dire
     * un titolo che annuncia il nulla, che è peggio di niente. */
    nodo?.remove();
    return false;
  }
  const states = allStates();
  const firma = pagine
    .map((voce) => {
      const riassunto = riassuntoDellaStanza(voce, states);
      return [
        voce.id,
        voce.name,
        voce.icon,
        riassunto.gradi,
        riassunto.umidita,
        /* Il conto per genere, non solo il totale: una luce che si spegne
         * mentre si accende un condizionatore lascia il totale a due, e la
         * card sarebbe rimasta a dire «luce» fino al cambio dopo. */
        riassunto.perTipo.map((tipo) => `${tipo.chiave}:${tipo.quante}`).join(","),
      ].join("|");
    })
    .join("§");
  const casa = host(pagina);
  if (!casa) return false;
  if (state.firma === firma && casa.querySelector("[data-dm-stanza-plancia]")) return true;
  state.firma = firma;
  /* Il titolo porta il disegno di casa, non il divano di sistema: e' l'unico
   * posto del blocco che era rimasto a un'emoji, e su due telefoni diversi
   * aveva due facce. */
  casa.innerHTML = `<div class="section-title"><span class="dm-stanze-plancia-titolo-ic" aria-hidden="true">${oggettoWidget(
    "stanze",
  )}</span>${esc(t("Stanze", "Rooms"))}</div>
    <div class="dm-stanze-plancia-griglia">${pagine
      .map((voce) => cardMarkup(voce, states))
      .join("")}</div>`;
  return true;
}

function onClick(evento) {
  const card = evento.target?.closest?.("[data-dm-stanza-plancia]");
  if (!card) return;
  evento.preventDefault();
  apriLaStanza(card.getAttribute("data-dm-stanza-plancia") || "");
}

function schedule() {
  if (state.frame) return;
  state.frame =
    root.requestAnimationFrame?.(() => {
      state.frame = 0;
      try {
        renderStanzeInPlancia();
      } catch (errore) {
        root.console?.warn?.("[DashboardModern] stanze in plancia", errore);
      }
    }) || 0;
}

/** Rifà il blocco adesso: lo chiama la scheda quando si spunta una stanza. */
export function ridisegnaStanzeInPlancia() {
  state.firma = "";
  schedule();
}

function stile() {
  installStyle(
    STYLE_ID,
    `
  #${BLOCCO_ID}{display:block;margin-top:18px}
  #${BLOCCO_ID} .section-title{display:flex;align-items:center;gap:8px}
  .dm-stanze-plancia-titolo-ic{display:inline-grid;place-items:center;width:20px;height:20px}
  .dm-stanze-plancia-titolo-ic svg{width:20px;height:20px}
  #${BLOCCO_ID} .dm-stanze-plancia-griglia{
    display:grid;gap:10px;
    grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr))}
  .dm-stanza-plancia{
    display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0;width:100%;
    padding:14px 12px;border-radius:18px;cursor:pointer;font:inherit;text-align:center;
    color:var(--text,#0f172a);
    background:var(--card-background-color,var(--card-bg,#fff));
    border:1px solid var(--card-border,#e2e8f0);
    box-shadow:0 8px 18px -14px rgba(15,23,42,.85);
    transition:transform .13s ease,border-color .13s ease}
  @media(hover:hover){.dm-stanza-plancia:hover{transform:translateY(-2px)}}
  .dm-stanza-plancia:active{transform:translateY(1px) scale(.99)}
  .dm-stanza-plancia:focus-visible{outline:2px solid var(--accent,#0ea5e9);outline-offset:3px}
  /* Una stanza con qualcosa acceso si vede da lontano: è la ragione per cui
     uno guarda la plancia invece di aprire la pagina. */
  .dm-stanza-plancia[data-accesa="true"]{
    border-color:color-mix(in srgb,#f59e0b 52%,transparent)}
  .dm-stanza-plancia-ic{
    flex:0 0 auto;display:grid;place-items:center;width:42px;height:42px;
    border-radius:14px;font-size:22px;line-height:1;
    background:var(--bg-sculpted,#f0f4f8)}
  .dm-stanza-plancia-ic svg{width:26px;height:26px}
  .dm-stanza-plancia-testo{
    display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;width:100%}
  .dm-stanza-plancia-testo b{
    font-size:13.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dm-stanza-plancia-testo small{
    font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b);
    font-variant-numeric:tabular-nums;white-space:nowrap}
  /* Le pastiglie dei generi (#546): una per famiglia di cose accese, col
     disegno di casa e quante ne sono. Vanno a capo da sole — una stanza con
     luci, clima e prese accesi ne ha tre, e su mezza colonna non stanno in
     fila. */
  .dm-stanza-plancia-generi{
    display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px;
    width:100%;min-width:0}
  .dm-stanza-plancia-genere{
    display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;
    font-size:11px;font-weight:900;font-variant-numeric:tabular-nums;
    color:#b45309;background:color-mix(in srgb,#f59e0b 20%,transparent)}
  .dm-stanza-plancia-genere-ic{display:inline-grid;place-items:center;width:15px;height:15px}
  .dm-stanza-plancia-genere-ic svg{width:15px;height:15px}

  /* Due colonne sul telefono (#524).
   *
   * «Would it be possible to view the cards in two columns on smartphones? To
   * save space.» Una stanza per riga, su uno schermo da sei pollici, vuol dire
   * scorrere mezza pagina per leggere sei nomi — e il blocco delle stanze
   * serve a dare un colpo d'occhio, non una lista.
   *
   * Non bastava abbassare il minimo della griglia: con auto-fit due colonne
   * ci stanno solo se due minimi piu' il vuoto in mezzo entrano nella pagina,
   * e su un telefono da 390 pixel, tolti i margini, non entravano mai. Qui le
   * colonne si dichiarano: due, e larghe uguali.
   *
   * La card si stringe con loro — il disegno piu' piccolo, meno aria ai lati,
   * la pastiglia degli accesi sotto invece che di fianco — perche' a meta'
   * larghezza, di fianco, resterebbe un nome tagliato dopo tre lettere. */
  @media (max-width:560px){
    #${BLOCCO_ID} .dm-stanze-plancia-griglia{
      grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .dm-stanza-plancia{gap:7px;padding:11px 9px}
    .dm-stanza-plancia-ic{width:34px;height:34px;border-radius:12px;font-size:18px}
    .dm-stanza-plancia-ic svg{width:21px;height:21px}
    .dm-stanza-plancia-testo b{font-size:12.5px}
    .dm-stanza-plancia-testo small{
      font-size:11px;white-space:normal;overflow-wrap:anywhere}
    /* Su mezza colonna la pastiglia si stringe attorno al numero: il disegno
       resta, la cornice no. */
    .dm-stanza-plancia-generi{gap:5px}
    .dm-stanza-plancia-genere{padding:2px 6px;font-size:10.5px;gap:3px}
  }
  `,
  );
}

export function installStanzeInPlancia() {
  if (!doc || state.installed) return false;
  state.installed = true;
  stile();
  doc.addEventListener("click", onClick);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  schedule();
  return true;
}
