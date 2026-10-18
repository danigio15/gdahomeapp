/* «Automazioni», la sezione della dashboard.
 *
 * Tutte le automazioni di Home Assistant, a gruppi, con la faccia delle
 * altre sezioni: la testata, le tre tessere (Attive · Spente · Prossima), e
 * sotto i gruppi in righe compatte — una riga per automazione, col disegno,
 * il nome, cosa fa in parole e l'interruttore. I gruppi sono le categorie
 * che chi abita ha dato in Home Assistant («Per categoria», con «Senza
 * categoria» in fondo), oppure «Per tipo» o «Per stanza», e si chiudono e si
 * aprono come in Home Assistant (▾ ▸). Qui si guardano, si accendono e si
 * spengono, e si fanno partire; si modificano nel config, dove sta l'editor
 * (`automazioni-section.js`). La linguetta sta subito prima di «Config», col
 * suo orologio viola.
 *
 * La stessa faccia e' la pagina dell'app: nell'app la linguetta in basso non
 * c'e', e le automazioni si aprono dal menu laterale («Automazioni ✨
 * PREMIUM»), a schermo pieno. Li' la pagina e' una sola: senza «Gestisci nel
 * config», con «＋ Nuova» nella barra dei filtri, e il foglio di una riga
 * porta anche «✏️ Modifica», «Duplica», «Stanza e nome» ed «Elimina» —
 * l'editor si apre nella stessa pagina.
 *
 * Tutto e' Premium: senza, il contenuto si vede sfocato sotto un velo che
 * dice cosa fa e dove si compra. Niente elenco gratuito, niente interruttori.
 *
 * I dati sono quelli della pagina del config — un elenco solo, chiesto al
 * ponte (`ponte/automazioni/stato`) — e acceso o spento lo dice lo stato vivo
 * di Home Assistant.
 */
import { oggettoWidget } from "../core/oggetti-widget.js";
import {
  CATEGORIA,
  DOVE_SI_COMPRA,
  alternaInCasa,
  apriLaConferma,
  apriNelConfig,
  apriPerModificare,
  automazioniDiCasa,
  categorieDiCasa,
  chiediAllaCasa,
  duplicaInCasa,
  eseguiOra,
  fraseDelQuando,
  fraseDellAllora,
  fraseDellaCondizione,
  fraseDellaVoce,
  gruppiCompattiHtml,
  leProposte,
  nellApp,
  prestaLaListaDellApp,
  prossimaDiCasa,
  quandoCambiaLaCasa,
  RAGGRUPPA,
  alternaIlGruppo,
  riassuntoDi,
  rigaDellaVoce,
  scelteDelRaggruppa,
  rifaiITastiDeiGruppi,
  tastiDeiGruppiHtml,
  tuttiIGruppi,
  ridisegna as ridisegnaLaPagina,
  scopriPremium,
  statoDelleAutomazioni,
  ultimaVoltaDi,
  vaiA,
} from "./automazioni-section.js";
import { clean, doc, esc, installStyle, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_AUTOMAZIONI_CASA__";
const state = (root[KEY] ||= {
  installed: false,
  /* «Per categoria» (le categorie di Home Assistant), «Per tipo», «Per stanza». */
  per: "categoria",
  cerca: "",
  /* La carta aperta nel foglio: l'entita'. */
  foglio: "",
  frame: 0,
});

export const AUTOMAZIONI_CASA_TAB = "automazioni";
export const ID_DELLA_SEZIONE = "page-automazioni-casa";
const ID_DEL_FOGLIO = "auc-foglio";
/* Il «＋ Nuova» che galleggiava in basso a destra nell'app: adesso sta nella
 * barra dei filtri, e quello vecchio si toglie se c'e' ancora. */
const ID_DEL_TASTO = "auc-nuova";
const VIOLA = "#7c3aed";

/* ── la linguetta e la pagina ────────────────────────────────────────────── */

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

export function ensureLaSezione() {
  if (!doc) return null;
  let pagina = doc.getElementById(ID_DELLA_SEZIONE);
  if (pagina) return pagina;
  const config = doc.getElementById("page-config");
  const sorella = config || ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = ID_DELLA_SEZIONE;
  pagina.innerHTML = '<div class="dm-lucip-wrap auc" data-auc-casa></div>';
  if (config) config.before(pagina);
  else sorella.after(pagina);
  return pagina;
}

function apriLaSezione(tab) {
  for (const n of doc.querySelectorAll(".tab")) n.classList.remove("active");
  for (const n of doc.querySelectorAll(".page")) n.classList.remove("active");
  tab?.classList.add("active");
  ensureLaSezione()?.classList.add("active");
  if (root.navigator?.vibrate) root.navigator.vibrate(5);
  root.scrollTo?.(0, 0);
  void chiediAllaCasa();
  disegna();
}

/* La linguetta, subito prima di Config. Nell'app non c'e': le automazioni
 * stanno nel menu laterale dell'app. */
export function ensureLaLinguetta() {
  if (!doc) return null;
  let tab = doc.querySelector(`nav.tabs .tab[data-tab="${AUTOMAZIONI_CASA_TAB}"]`);
  if (nellApp()) {
    tab?.remove();
    return null;
  }
  const nav = doc.querySelector("nav.tabs");
  const config = nav?.querySelector('.tab[data-tab="config"]');
  if (!nav) return null;
  if (!tab) {
    tab = doc.createElement("button");
    tab.className = "tab";
    tab.dataset.tab = AUTOMAZIONI_CASA_TAB;
    tab.id = `tab-${AUTOMAZIONI_CASA_TAB}`;
    tab.innerHTML = `<span class="icon">⏰</span><span class="text">${esc(t("Automazioni", "Automations"))}</span>`;
    /* Il gestore che il runtime lega alle voci lo lega una volta sola, al
     * caricamento: questa arriva dopo, e il suo tocco se lo gestisce da se'. */
    tab.addEventListener("click", () => apriLaSezione(tab));
  }
  /* Subito prima di Config, anche dopo che qualcuno ha rimesso in ordine la
   * barra. */
  if (config && config.previousElementSibling !== tab) config.before(tab);
  else if (!config && tab.parentElement !== nav) nav.append(tab);
  return tab;
}

/* La voce si nasconde come tutte le altre.
 *
 * `cdApplyNavVis` accende e spegne le voci leggendo `cd_sections`, e sa quali
 * esistono da una mappa sua: si aggiunge alla mappa, e l'interruttore sta in
 * cima alla pagina del config (`automazioni-section.js`). */
function insegnaLaVisibilita() {
  const prima = root.cdNavVisMap;
  if (typeof prima !== "function" || prima.__dmAutomazioni) return;
  const avvolta = function cdNavVisMap(...args) {
    const mappa = prima.apply(this, args) || {};
    return { ...mappa, [AUTOMAZIONI_CASA_TAB]: AUTOMAZIONI_CASA_TAB };
  };
  avvolta.__dmAutomazioni = true;
  avvolta.__dmPrevious = prima;
  root.cdNavVisMap = avvolta;
}

/* ── il disegno ──────────────────────────────────────────────────────────── */

const orologio = (dove) => oggettoWidget("automazioni", "", `auc-${dove}`);
let disegni = 0;
const disegno = (chiave) => oggettoWidget(chiave, "", `auc-${chiave}-${disegni++ % 96}`);

function testata({ app }) {
  const scuro = doc?.documentElement?.dataset?.theme === "dark";
  const sotto = app
    ? t("Tutte quelle di casa", "All the home's ones")
    : t("Tutte quelle di casa · da Home Assistant", "All the home's ones · from Home Assistant");
  return `<header class="dm-page-mast" style="--dm-mast-a:${scuro ? "167,139,250" : "124,58,237"};--dm-mast-b:99,102,241"><button type="button" class="back-home-btn dm-mast-back" onclick="document.querySelector('[data-tab=&quot;home&quot;]').click(); if(navigator.vibrate)navigator.vibrate(5);"><span class="bh-icon">←</span><span>${esc(
    t("Home", "Home"),
  )}</span></button><h2 class="dm-page-mast-title">${esc(t("Automazioni", "Automations"))}</h2><div class="dm-page-mast-sub">${esc(
    sotto,
  )}</div></header>`;
}

function tessere(elenco) {
  const attive = elenco.filter((v) => v.attiva).length;
  const tutte = elenco.length;
  const prossima = prossimaDiCasa(elenco);
  return `<div class="ad-kpi"><div class="dm-lucip-kpi on" data-auc-attive><span>${esc(t("Attive", "Active"))}</span><b>${attive}</b><small>${esc(
    t(`su ${tutte} in casa`, `of ${tutte} at home`),
  )}</small></div><div class="dm-lucip-kpi" data-auc-spente><span>${esc(t("Spente", "Off"))}</span><b>${elenco.length - attive}</b><small>${esc(
    t("ferme per ora", "stopped for now"),
  )}</small></div><div class="dm-lucip-kpi pross"><span>${esc(t("Prossima", "Next"))}</span><b>${esc(prossima?.ora || "—")}</b><small>${esc(
    prossima?.voce?.nome || t("nessuna a un orario", "none on a schedule"),
  )}</small></div></div>`;
}

function strisciaDelleProposte({ app }) {
  const n = leProposte().length;
  if (!n || !statoDelleAutomazioni().ponte?.puoScrivere) return "";
  return `<button type="button" class="ad-pro" data-auc-proposte><span class="st" aria-hidden="true">✨</span><div>${esc(
    n === 1
      ? t("1 proposta per la tua casa", "1 suggestion for your home")
      : t(`${n} proposte per la tua casa`, `${n} suggestions for your home`),
  )}<small>${esc(t("Pensate sui tuoi dispositivi e su come li usi", "Based on your devices and how you use them"))}</small></div><em>${esc(
    app ? t("Vedi ›", "See ›") : t("nel config ›", "in the config ›"),
  )}</em></button>`;
}

/* «Per categoria · Per tipo · Per stanza», la ricerca, «＋ Nuova» e, nella
 * dashboard, «Gestisci nel config». «＋ Nuova» c'e' solo per chi puo'
 * scrivere: nell'app apre i modelli nella stessa pagina, nella dashboard nel
 * config. */
function filtri({ app }) {
  const config = typeof root.apriConfigEntita === "function";
  const nuova =
    statoDelleAutomazioni().ponte?.puoScrivere === true && (app || config)
      ? `<button type="button" class="ad-nuova" data-auc-nuova>＋ ${esc(t("Nuova", "Add new"))}</button>`
      : "";
  return `<div class="ad-filtri"><span class="ad-seg-riga">${scelteDelRaggruppa(state.per, "data-auc-per", "ad-seg")}${tastiDeiGruppiHtml(
    automazioniDiCasa(),
    { per: state.per, cerca: state.cerca },
  )}</span><span class="ad-cerca-riga"><label class="ad-cerca"><span aria-hidden="true">🔍</span><input type="search" data-auc-cerca value="${esc(
    state.cerca,
  )}" placeholder="${esc(t("Cerca un'automazione…", "Search an automation…"))}"></label>${nuova}</span>${
    app || !config
      ? ""
      : `<button type="button" class="ad-cfg" data-auc-config>⚙️ ${esc(t("Gestisci nel config ›", "Manage in the config ›"))}</button>`
  }</div>`;
}

/* La riga si apre nel foglio; l'interruttore la accende o la spegne. */
const attributiDellaRiga = (v) => ` data-auc-carta="${esc(v.entity_id)}" role="button" tabindex="0"`;
const interruttoreDellaRiga = (v) =>
  `<button type="button" class="aug-int" role="switch" aria-checked="${v.attiva}" data-auc-led="${esc(v.entity_id)}" aria-label="${esc(
    t(`Accendi o spegni ${v.nome}`, `Turn ${v.nome} on or off`),
  )}"></button>`;

function gruppiHtml(elenco) {
  const gruppi = gruppiCompattiHtml(elenco, {
    per: state.per,
    cerca: state.cerca,
    prefisso: "aug-auc",
    attributi: attributiDellaRiga,
    interruttore: interruttoreDellaRiga,
  });
  return gruppi || `<p class="ad-nessuna">${esc(t("Nessuna automazione con queste parole.", "No automation matches these words."))}</p>`;
}

function vuoto({ app }) {
  const puo = statoDelleAutomazioni().ponte?.puoScrivere;
  return `<div class="ad-vuoto"><div class="ill">${orologio("vuoto")}<span aria-hidden="true">✨</span></div><h3>${esc(
    t("Nessuna automazione, per ora", "No automations, for now"),
  )}</h3><p>${esc(
    t(
      "Le automazioni accendono, spengono e avvisano da sole: a un orario, quando si apre una porta, quando esci di casa. Qui le vedrai tutte, anche quelle di Home Assistant.",
      "Automations turn things on and off and alert you by themselves: at a time, when a door opens, when you leave home. You'll see them all here, Home Assistant's too.",
    ),
  )}</p>${
    !puo
      ? ""
      : app
        ? `<button type="button" data-auc-nuova>＋ ${esc(t("Crea la prima", "Create the first one"))}</button>`
        : typeof root.apriConfigEntita === "function"
          ? `<button type="button" data-auc-config-nuova>${esc(t("Crea la prima nel config ›", "Create the first one in the config ›"))}</button>`
          : ""
  }</div>`;
}

function avviso(testo) {
  return `<p class="ad-avviso">${esc(testo)}</p>`;
}

function corpo({ app }) {
  const st = statoDelleAutomazioni();
  if (st.assente)
    return avviso(
      t(
        "Le automazioni di Home Assistant si leggono con l'add-on GdAHome: qui non c'è.",
        "Home Assistant's automations are read through the GdAHome add-on: it is not here.",
      ),
    );
  if (!st.ponte) return `${tessere([])}${avviso(t("Leggo le automazioni di casa…", "Reading the home's automations…"))}`;
  const elenco = automazioniDiCasa();
  if (!elenco.length) return vuoto({ app });
  return `${tessere(elenco)}${strisciaDelleProposte({ app })}${filtri({ app })}<div class="ad-gruppi" data-auc-gruppi>${gruppiHtml(elenco)}</div>`;
}

/* Senza Premium: il contenuto sfocato, e sopra la carta che dice cosa fa. */
function chiusa({ app }) {
  return `<div class="ad-chiusa"><div class="sotto" aria-hidden="true" inert>${corpo({ app })}</div><div class="velo"><div class="carta"><div class="ill">${orologio(
    "velo",
  )}<span aria-hidden="true">✨</span></div><span class="tag">${esc(t("PREMIUM · IN ARRIVO", "PREMIUM · COMING SOON"))}</span><h3>${esc(
    t("Automazioni", "Automations"),
  )}</h3><p>${esc(
    t(
      "La casa che fa da sola: luci, clima, tapparelle e avvisi che partono quando serve.",
      "The home that does it by itself: lights, climate, shutters and alerts that start when needed.",
    ),
  )}</p><ul><li>${esc(t("Tutte le automazioni di Home Assistant, a gruppi", "All of Home Assistant's automations, in groups"))}</li><li>${esc(
    t("Le accendi e le spegni con un tocco", "Turn them on and off with a tap"),
  )}</li><li>${esc(t("Le crei e le modifichi in tre passi", "Create and edit them in three steps"))}</li><li>${esc(
    t("Proposte pensate per la tua casa", "Suggestions designed for your home"),
  )}</li></ul><button type="button" data-auc-scopri>${esc(t("Scopri Premium", "Discover Premium"))}</button><small>${esc(
    DOVE_SI_COMPRA(),
  )}</small></div></div></div>`;
}

/** Tutta la pagina: la sezione della dashboard, o la pagina dell'app. */
export function htmlDellaCasa({ app = false } = {}) {
  const premium = statoDelleAutomazioni().premium !== false;
  return `${testata({ app })}${premium ? corpo({ app }) : chiusa({ app })}`;
}

/* La pagina dell'app: la stessa, dentro un contenitore che porta lo stile. */
function htmlDellApp() {
  vestiLeCarte();
  return `<div class="dm-lucip-wrap auc auc-app" data-auc-casa>${htmlDellaCasa({ app: true })}</div>`;
}

/* ── il foglio di una carta ──────────────────────────────────────────────── */

function righe(etichetta, classe, testo) {
  return testo ? `<div class="riga ${classe}"><span>${esc(etichetta)}</span><div>${testo}</div></div>` : "";
}

function bloccoDelFoglio(v) {
  const m = v.modello;
  if (m && m.tipo !== "crono") {
    const se = m.tutte
      ? m.soloSe.map(fraseDellaCondizione).join(", ")
      : m.soloSe.map(fraseDellaCondizione).join(` ${t("o", "or")} `);
    return `${righe(t("Quando", "When"), "q", esc(fraseDelQuando(m.quando)))}${righe(t("Solo se", "Only if"), "s", esc(se))}${righe(
      t("Allora", "Then"),
      "a",
      esc(fraseDellAllora(m.allora)),
    )}`;
  }
  const f = fraseDellaVoce(v);
  if (f) return `${righe(t("Quando", "When"), "q", esc(f.quando))}${righe(t("Allora", "Then"), "a", esc(f.allora))}`;
  if (v.config) {
    const r = riassuntoDi(v.config);
    const lista = (x) => x.map((riga) => esc(riga.testo)).join("<br>");
    return `${righe(t("Quando", "When"), "q", lista(r.quando))}${righe(t("Solo se", "Only if"), "s", lista(r.soloSe))}${righe(
      t("Allora", "Then"),
      "a",
      lista(r.allora),
    )}`;
  }
  /* Senza la configurazione (chi non amministra Home Assistant non la
   * riceve) resta il riassunto del ponte, e il dettaglio in Home Assistant. */
  return `${v.riassunto ? righe(t("In breve", "In short"), "q", esc(rigaDellaVoce(v))) : ""}<div class="riga av">${esc(
    t(
      "Un'automazione avanzata: il dettaglio si legge in Home Assistant.",
      "An advanced automation: the details are in Home Assistant.",
    ),
  )}</div>`;
}

function htmlDelFoglio(v, { app }) {
  const [emoji, nomeCat, oggetto, colore] = CATEGORIA()[v.categoria] || CATEGORIA().altre;
  const st = statoDelleAutomazioni();
  const puo = st.ponte?.puoScrivere && v.modificabile;
  const fu = ultimaVoltaDi(v);
  /* La categoria di Home Assistant, se gliel'hanno data, prima del tipo. */
  const categoriaHa = categorieDiCasa().find((c) => c.id === clean(v.categoriaHa))?.nome || "";
  const dove = [categoriaHa === nomeCat ? "" : categoriaHa, `${emoji} ${nomeCat}`, clean(v.area)]
    .filter(Boolean)
    .join(" · ");
  const modifica = !puo
    ? ""
    : app
      ? `<button type="button" class="modifica" data-auc-modifica>✏️ ${esc(t("Modifica", "Edit"))}</button>`
      : typeof root.apriConfigEntita === "function"
        ? `<button type="button" class="modifica" data-auc-modifica>${esc(t("Modifica nel config ›", "Edit in the config ›"))}</button>`
        : "";
  return `<div class="ad-foglio" role="dialog" aria-modal="true" aria-label="${esc(v.nome)}" style="--c:${colore}"><div class="man"></div>
<div class="su"><span class="orb">${disegno(oggetto)}</span><div><h4>${esc(v.nome)}</h4><div class="dove">${esc(dove)}</div></div><button type="button" class="led" aria-pressed="${v.attiva}" data-auc-led="${esc(
    v.entity_id,
  )}" aria-label="${esc(t("Attiva o spenta", "On or off"))}"></button></div>
<div class="blk">${bloccoDelFoglio(v)}</div>
<div class="ult">${esc(t("Ultima volta:", "Last time:"))} <b>${esc(fu)}</b></div>
<div class="tasti"><button type="button" class="esegui" data-auc-esegui>▶ ${esc(t("Esegui ora", "Run now"))}</button>${modifica}</div>${
    app && puo
      ? `<div class="op-mod"><button type="button" data-auc-duplica>${esc(t("Duplica", "Duplicate"))}</button><button type="button" data-auc-stanza>${esc(
          t("Stanza e nome", "Room and name"),
        )}</button><button type="button" class="r" data-auc-elimina>${esc(t("Elimina", "Delete"))}</button></div>`
      : ""
  }</div>`;
}

const voceDi = (entity) => automazioniDiCasa().find((v) => v.entity_id === entity) || null;

function apriIlFoglio(entity) {
  const v = voceDi(entity);
  if (!v || !doc?.body) return;
  state.foglio = entity;
  let velo = doc.getElementById(ID_DEL_FOGLIO);
  if (!velo) {
    velo = doc.createElement("div");
    velo.id = ID_DEL_FOGLIO;
    velo.className = "ad-velo";
    doc.body.append(velo);
  }
  velo.innerHTML = htmlDelFoglio(v, { app: statoDelleAutomazioni().inApp });
}

function chiudiIlFoglio() {
  state.foglio = "";
  doc?.getElementById?.(ID_DEL_FOGLIO)?.remove();
}

/* ── disegnare ───────────────────────────────────────────────────────────── */

const laSezioneSiVede = () => doc?.getElementById?.(ID_DELLA_SEZIONE)?.classList?.contains("active");

/* Il campo della ricerca resta sotto le dita: dopo un ridisegno si torna li'. */
function conIlCampo(dove, scrivi) {
  const attivo = doc.activeElement;
  const cercava = Boolean(attivo?.matches?.("[data-auc-cerca]"));
  const cursore = cercava ? attivo.selectionStart : null;
  scrivi();
  if (cercava) {
    const campo = dove.querySelector("[data-auc-cerca]");
    campo?.focus?.();
    if (cursore !== null) {
      try {
        campo?.setSelectionRange?.(cursore, cursore);
      } catch (_errore) {}
    }
  }
}

export function disegna() {
  if (!doc) return false;
  insegnaLaVisibilita();
  ensureLaLinguetta();
  aggiornaIlTasto();
  /* Il foglio aperto segue la casa: l'interruttore che cambia, l'ultima volta. */
  if (state.foglio) {
    if (voceDi(state.foglio)) apriIlFoglio(state.foglio);
    else chiudiIlFoglio();
  }
  if (!laSezioneSiVede()) return false;
  const pagina = ensureLaSezione();
  const wrap = pagina?.querySelector("[data-auc-casa]");
  if (!wrap) return false;
  vestiLeCarte();
  const html = htmlDellaCasa({ app: false });
  if (wrap.dataset.aucScritto === html) return true;
  conIlCampo(wrap, () => {
    wrap.innerHTML = html;
    wrap.dataset.aucScritto = html;
  });
  return true;
}

/* Il «＋ Nuova» che galleggiava sopra la pagina dell'app (fino alla 1.15):
 * adesso sta nella barra dei filtri. Se e' rimasto nella pagina, si toglie. */
function aggiornaIlTasto() {
  doc.getElementById(ID_DEL_TASTO)?.remove();
}

/* Lo stile delle carte di Luci, prestato a questa pagina: e' lo stesso
 * foglio, con le pagine di qui al posto delle sue. Si copia appena c'e'. */
function vestiLeCarte() {
  if (doc.getElementById("dm-automazioni-casa-luci")) return;
  const luci = doc.getElementById("dm-lights-page-style")?.textContent;
  if (!luci) return;
  installStyle(
    "dm-automazioni-casa-luci",
    luci.split(":is(#page-luci,#page-stanze,#page-prese)").join(`:is(#${ID_DELLA_SEZIONE},#page-automazioni)`),
  );
}

let inCoda = false;
function piuTardi() {
  if (inCoda) return;
  inCoda = true;
  const fai = () => {
    inCoda = false;
    disegna();
    if (statoDelleAutomazioni().inApp) ridisegnaLaPagina();
  };
  if (root.requestAnimationFrame) root.requestAnimationFrame(fai);
  else root.setTimeout?.(fai, 0);
}

/* ── i tocchi ────────────────────────────────────────────────────────────── */

const dentroDiNoi = (el) =>
  el?.closest?.(`#${ID_DELLA_SEZIONE}, #${ID_DEL_FOGLIO}, #${ID_DEL_TASTO}, .auc-app`);

function onClick(event) {
  const el = event.target;
  if (!dentroDiNoi(el)) return;
  const st = statoDelleAutomazioni();
  const app = st.inApp;
  /* Il foglio: fuori dalla carta si chiude. */
  const velo = doc.getElementById(ID_DEL_FOGLIO);
  if (velo && el === velo) {
    chiudiIlFoglio();
    return;
  }
  const tocco = el.closest(
    "[data-auc-scopri],[data-auc-led],[data-auc-per],[data-aug-apri],[data-aug-tutti],[data-auc-proposte],[data-auc-config],[data-auc-config-nuova],[data-auc-nuova],[data-auc-esegui],[data-auc-modifica],[data-auc-duplica],[data-auc-stanza],[data-auc-elimina],[data-auc-carta]",
  );
  if (!tocco) return;
  const d = tocco.dataset;
  if (d.aucScopri !== undefined) {
    event.preventDefault();
    scopriPremium();
    return;
  }
  /* Senza Premium sotto il velo non si tocca niente. */
  if (st.premium === false) return;
  event.preventDefault();
  if (d.aucLed) {
    event.stopPropagation();
    const v = voceDi(d.aucLed);
    if (v) alternaInCasa(v);
    piuTardi();
    return;
  }
  if (d.aucPer) {
    state.per = RAGGRUPPA.includes(d.aucPer) ? d.aucPer : "categoria";
    piuTardi();
    return;
  }
  if (d.augApri) {
    alternaIlGruppo(d.augApri);
    piuTardi();
    return;
  }
  if (d.augTutti) {
    tuttiIGruppi(automazioniDiCasa(), { per: state.per, apri: d.augTutti === "apri" });
    piuTardi();
    return;
  }
  if (d.aucProposte !== undefined) {
    if (app) vaiA("proposte");
    else apriNelConfig({ vista: "proposte" });
    return;
  }
  if (d.aucConfig !== undefined) {
    apriNelConfig({ vista: "lista" });
    return;
  }
  if (d.aucConfigNuova !== undefined) {
    apriNelConfig({ vista: "modelli" });
    return;
  }
  if (d.aucNuova !== undefined) {
    if (app) {
      vaiA("modelli");
      root.scrollTo?.(0, 0);
    } else apriNelConfig({ vista: "modelli" });
    return;
  }
  const v = voceDi(state.foglio);
  if (d.aucEsegui !== undefined) {
    eseguiOra(v);
    return;
  }
  if (d.aucModifica !== undefined || d.aucStanza !== undefined) {
    chiudiIlFoglio();
    if (!v) return;
    if (app) {
      apriPerModificare(v);
      ridisegnaLaPagina();
      aggiornaIlTasto();
      root.scrollTo?.(0, 0);
    } else apriNelConfig({ voce: v });
    return;
  }
  if (d.aucDuplica !== undefined) {
    if (v) void duplicaInCasa(v);
    chiudiIlFoglio();
    return;
  }
  if (d.aucElimina !== undefined) {
    chiudiIlFoglio();
    if (v) apriLaConferma(v);
    return;
  }
  if (d.aucCarta) apriIlFoglio(d.aucCarta);
}

function onInput(event) {
  const campo = event.target;
  if (!campo?.matches?.("[data-auc-cerca]") || !dentroDiNoi(campo)) return;
  state.cerca = campo.value;
  const gruppi = campo.closest("[data-auc-casa]")?.querySelector("[data-auc-gruppi]");
  if (gruppi) gruppi.innerHTML = gruppiHtml(automazioniDiCasa());
  rifaiITastiDeiGruppi(campo.closest("[data-auc-casa]"), automazioniDiCasa(), {
    per: state.per,
    cerca: state.cerca,
  });
}

function onKey(event) {
  if (event.key === "Escape" && state.foglio) {
    chiudiIlFoglio();
    return;
  }
  if (event.key !== "Enter" && event.key !== " ") return;
  const carta = event.target?.closest?.("[data-auc-carta]");
  if (!carta || event.target !== carta) return;
  event.preventDefault();
  apriIlFoglio(carta.dataset.aucCarta);
}

/* ── lo stile ────────────────────────────────────────────────────────────── */

const SEZIONI = `:is(#${ID_DELLA_SEZIONE},#page-automazioni)`;

function stili() {
  const S = SEZIONI;
  installStyle(
    "dm-automazioni-casa-style",
    `
${S} .dm-lucip-wrap.auc{gap:14px}
#page-automazioni .auc-app{padding:8px 14px 150px}
${S} .ad-kpi{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
${S} .ad-kpi .dm-lucip-kpi{min-width:0;padding:12px 16px}
${S} .ad-kpi b{font-family:Oswald,sans-serif;font-weight:700;font-size:30px;line-height:1.05;letter-spacing:.5px;color:var(--text,#0f172a)}
${S} .ad-kpi .on b{color:${VIOLA}}
html[data-theme="dark"] ${S} .ad-kpi .on b{color:#a78bfa}
${S} .ad-kpi small{display:block;font-size:11.5px;font-weight:800;color:var(--secondary-text-color,#64748b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${S} .ad-kpi .pross b{font-size:24px}
${S} .ad-pro{display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;padding:12px 16px;border-radius:18px;border:1px solid color-mix(in srgb,${VIOLA} 30%,var(--divider-color,#dbe4ee));background:linear-gradient(120deg,color-mix(in srgb,${VIOLA} 10%,var(--card-bg,#fff)),var(--card-bg,#fff) 70%);box-shadow:0 12px 28px -22px rgba(15,23,42,.5);font:inherit;font-size:13.5px;font-weight:800;color:var(--text,#0f172a);text-align:left;cursor:pointer}
${S} .ad-pro .st{font-size:20px}
${S} .ad-pro small{display:block;font-size:11.5px;font-weight:600;color:var(--secondary-text-color,#64748b);margin-top:1px}
${S} .ad-pro em{margin-left:auto;font-style:normal;font-size:12px;font-weight:900;color:${VIOLA};white-space:nowrap}
html[data-theme="dark"] ${S} .ad-pro em{color:#c4b5fd}
${S} .ad-filtri{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
${S} .ad-seg-riga{display:flex;align-items:center;gap:8px;flex-wrap:nowrap;max-width:100%;min-width:0}
${S} .ad-seg-riga .ad-seg{min-width:0}
${S} .ad-cerca-riga{flex:1 1 320px;max-width:520px;display:flex;align-items:center;gap:10px;min-width:0}
${S} .ad-seg{display:inline-flex;padding:4px;border-radius:999px;border:1px solid var(--divider-color,#dbe4ee);background:var(--card-bg,#fff);box-shadow:0 12px 28px -22px rgba(15,23,42,.5)}
${S} .ad-seg button{border:0;background:none;cursor:pointer;padding:7px 14px;border-radius:999px;font:inherit;font-size:11px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
${S} .ad-seg button.si{background:${VIOLA};color:#fff;box-shadow:0 6px 14px -6px ${VIOLA}}
${S} .ad-cerca{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:8px;padding:0 16px;border-radius:999px;border:1px solid var(--divider-color,#dbe4ee);background:var(--card-bg,#fff);font-size:13px;color:var(--secondary-text-color,#94a3b8)}
${S} .ad-cerca input{flex:1;min-width:0;border:0;background:none;outline:none;padding:10px 0;font:inherit;font-weight:600;color:var(--text,#0f172a)}
${S} .ad-nuova{flex:none;border:0;border-radius:999px;padding:10px 18px;background:${VIOLA};color:#fff;cursor:pointer;font:inherit;font-size:13px;font-weight:900;letter-spacing:.2px;white-space:nowrap;box-shadow:0 10px 22px -12px ${VIOLA}}
${S} .ad-cfg{margin-left:auto;display:inline-flex;align-items:center;gap:6px;padding:9px 15px;border-radius:999px;border:1px solid var(--divider-color,#dbe4ee);background:transparent;cursor:pointer;font:inherit;font-size:11px;font-weight:900;letter-spacing:.7px;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
${S} .ad-nessuna,${S} .ad-avviso{margin:4px 2px;font-size:13px;font-weight:700;color:var(--secondary-text-color,#64748b)}
${S} .ad-vuoto{display:grid;justify-items:center;text-align:center;gap:10px;padding:46px 20px 50px;border-radius:26px;border:1px dashed color-mix(in srgb,${VIOLA} 35%,var(--divider-color,#dbe4ee));background:radial-gradient(80% 70% at 50% 0%,color-mix(in srgb,${VIOLA} 9%,transparent),transparent 70%),var(--card-bg,#fff)}
${S} .ad-vuoto .ill,${S} .ad-chiusa .ill{position:relative;width:132px;height:132px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 40% 35%,color-mix(in srgb,${VIOLA} 14%,#fff),color-mix(in srgb,${VIOLA} 26%,var(--card-bg,#fff)));box-shadow:0 20px 40px -24px ${VIOLA}}
html[data-theme="dark"] ${S} .ad-vuoto .ill,html[data-theme="dark"] ${S} .ad-chiusa .ill{background:radial-gradient(circle at 40% 35%,color-mix(in srgb,${VIOLA} 40%,#1e293b),color-mix(in srgb,${VIOLA} 18%,#0f172a))}
${S} .ad-vuoto .ill svg{width:78px;height:78px}
${S} .ad-vuoto .ill span{position:absolute;top:16px;right:18px;font-size:18px}
${S} .ad-vuoto h3,${S} .ad-chiusa h3{margin:6px 0 0;font-family:Oswald,sans-serif;font-weight:700;font-size:24px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text,#0f172a)}
${S} .ad-vuoto p{margin:0;max-width:380px;font-size:13.5px;line-height:1.55;font-weight:600;color:var(--secondary-text-color,#64748b)}
${S} .ad-vuoto button{margin-top:8px;border:0;border-radius:999px;padding:12px 22px;background:${VIOLA};color:#fff;font:inherit;font-size:12px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;box-shadow:0 10px 24px -10px ${VIOLA};cursor:pointer}
${S} .ad-chiusa{position:relative;min-height:640px}
${S} .ad-chiusa .sotto{filter:blur(4px);opacity:.5;pointer-events:none;user-select:none;display:grid;gap:14px}
${S} .ad-chiusa .velo{position:absolute;inset:0;display:flex;justify-content:center;align-items:flex-start;padding-top:70px;background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--card-bg,#fff) 35%,transparent) 30%)}
${S} .ad-chiusa .carta{width:min(440px,100%);box-sizing:border-box;display:grid;justify-items:center;text-align:center;gap:10px;padding:30px 24px 26px;border-radius:28px;border:1px solid color-mix(in srgb,${VIOLA} 30%,var(--divider-color,#dbe4ee));background:radial-gradient(90% 70% at 50% 0%,color-mix(in srgb,${VIOLA} 12%,transparent),transparent 70%),var(--card-bg,#fff);box-shadow:0 30px 60px -30px rgba(15,23,42,.5)}
${S} .ad-chiusa .ill{width:104px;height:104px}
${S} .ad-chiusa .ill svg{width:62px;height:62px}
${S} .ad-chiusa .ill span{position:absolute;top:8px;right:6px;font-size:20px}
${S} .ad-chiusa .tag{font-size:10.5px;font-weight:900;letter-spacing:1.4px;color:#b45309;background:color-mix(in srgb,#f59e0b 16%,transparent);border-radius:999px;padding:4px 10px}
html[data-theme="dark"] ${S} .ad-chiusa .tag{color:#fcd34d}
${S} .ad-chiusa h3{margin-top:2px}
${S} .ad-chiusa .carta p{margin:0;font-size:13.5px;line-height:1.55;font-weight:600;color:var(--secondary-text-color,#64748b)}
${S} .ad-chiusa .carta ul{margin:4px 0 0;padding:0;list-style:none;display:grid;gap:6px;text-align:left;font-size:13px;font-weight:700;color:var(--text,#0f172a)}
${S} .ad-chiusa .carta li::before{content:"✓";color:${VIOLA};font-weight:900;margin-right:8px}
html[data-theme="dark"] ${S} .ad-chiusa .carta li::before{color:#a78bfa}
${S} .ad-chiusa .carta button{margin-top:10px;border:0;border-radius:999px;padding:13px 26px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font:inherit;font-size:12px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;box-shadow:0 10px 24px -10px #d97706;cursor:pointer}
${S} .ad-chiusa .carta small{font-size:11.5px;font-weight:600;color:var(--secondary-text-color,#64748b)}
@media (max-width:560px){
  ${S} .ad-kpi{gap:8px}
  ${S} .ad-kpi .dm-lucip-kpi{padding:10px 12px}
  ${S} .ad-kpi b{font-size:26px}
  ${S} .ad-kpi .pross b{font-size:20px}
  ${S} .ad-seg{max-width:100%;overflow-x:auto;scrollbar-width:none}
  ${S} .ad-seg button{padding:7px 11px;white-space:nowrap}
  /* Il raggruppa e i due tasti stanno su una riga sola, anche a 390 px. */
  ${S} .ad-seg-riga{gap:6px;width:100%}
  ${S} .ad-seg-riga .ad-seg{padding:3px}
  ${S} .ad-seg-riga .ad-seg button{padding:7px 9px;letter-spacing:.3px}
  ${S} .ad-seg-riga .aug-tutto{width:34px;height:34px}
  ${S} .ad-cerca-riga{max-width:none;flex-basis:100%}
  ${S} .ad-cfg{display:none}
  ${S} .ad-chiusa .velo{padding-top:40px}
}
/* Il foglio di una carta. */
.ad-velo{position:fixed;inset:0;z-index:99990;background:rgba(15,23,42,.42);display:flex;align-items:flex-end;justify-content:center}
@media (min-width:700px){.ad-velo{align-items:center}}
.ad-foglio{width:min(480px,100vw);box-sizing:border-box;padding:12px 20px calc(24px + env(safe-area-inset-bottom,0px));border-radius:28px 28px 0 0;background:var(--card-bg,#fff);color:var(--text,#0f172a);box-shadow:0 -20px 60px -20px rgba(0,0,0,.45);font-family:Inter,sans-serif;max-height:88vh;overflow-y:auto}
@media (min-width:700px){.ad-foglio{border-radius:28px;padding:20px 24px 24px}}
.ad-foglio .man{width:42px;height:5px;border-radius:9px;background:var(--divider-color,#dbe4ee);margin:0 auto 14px}
@media (min-width:700px){.ad-foglio .man{display:none}}
.ad-foglio .su{display:flex;align-items:center;gap:13px}
.ad-foglio .orb{width:54px;height:54px;flex:none;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 38% 32%,color-mix(in srgb,var(--c) 25%,#fff),var(--c));box-shadow:0 3px 16px color-mix(in srgb,var(--c) 45%,transparent)}
.ad-foglio .orb svg{width:30px;height:30px}
.ad-foglio h4{margin:0;font-size:18px;font-weight:900;letter-spacing:-.2px}
.ad-foglio .dove{font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--secondary-text-color,#64748b);margin-top:3px}
.ad-foglio .led{margin-left:auto;position:relative;width:52px;height:30px;border:0;padding:0;border-radius:999px;background:color-mix(in srgb,var(--text,#0f172a) 18%,transparent);flex:none;cursor:pointer}
.ad-foglio .led[aria-pressed="true"]{background:color-mix(in srgb,var(--c) 75%,#fff);box-shadow:0 0 12px color-mix(in srgb,var(--c) 45%,transparent)}
.ad-foglio .led::after{content:"";position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(15,23,42,.35);transition:left .15s ease}
.ad-foglio .led[aria-pressed="true"]::after{left:25px}
.ad-foglio .blk{margin-top:14px;display:grid;gap:8px}
.ad-foglio .riga{display:flex;gap:12px;align-items:baseline;padding:11px 14px;border-radius:16px;background:color-mix(in srgb,var(--text,#0f172a) 4%,transparent);font-size:14px;font-weight:700;line-height:1.4}
.ad-foglio .riga>span{flex:0 0 64px;font-size:10px;font-weight:900;letter-spacing:1px;text-transform:uppercase}
.ad-foglio .q>span{color:#0ea5e9}.ad-foglio .s>span{color:#8b5cf6}.ad-foglio .a>span{color:#16a34a}
.ad-foglio .riga.av{font-weight:600;color:var(--secondary-text-color,#64748b)}
.ad-foglio .ult{margin:12px 2px 0;font-size:12.5px;font-weight:600;color:var(--secondary-text-color,#64748b)}
.ad-foglio .ult b{color:var(--text,#0f172a)}
.ad-foglio .tasti{display:flex;gap:10px;margin-top:16px}
.ad-foglio .tasti button{flex:1;border-radius:16px;padding:13px;font:inherit;font-size:13px;font-weight:900;cursor:pointer}
.ad-foglio .esegui{border:1px solid var(--divider-color,#dbe4ee);background:transparent;color:var(--text,#0f172a)}
.ad-foglio .modifica{border:0;background:${VIOLA};color:#fff;box-shadow:0 10px 24px -10px ${VIOLA}}
.ad-foglio .op-mod{display:flex;gap:8px;margin-top:10px}
.ad-foglio .op-mod button{flex:1;border-radius:14px;padding:11px 6px;font:inherit;font-size:12.5px;font-weight:800;border:1px solid var(--divider-color,#dbe4ee);background:transparent;color:var(--text,#0f172a);cursor:pointer}
.ad-foglio .op-mod button.r{color:#dc2626}
`,
  );
}

/* ── installare ──────────────────────────────────────────────────────────── */

export function installAutomazioniCasaSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  stili();
  prestaLaListaDellApp(htmlDellApp);
  quandoCambiaLaCasa(piuTardi);
  doc.addEventListener("click", onClick);
  doc.addEventListener("input", onInput);
  doc.addEventListener("keydown", onKey);
  /* Gli stati nuovi dicono chi e' acceso e l'ultima volta: si ridisegna solo
   * se la sezione si vede, e solo se e' cambiata. */
  root.addEventListener?.("dashboardmodern:states-ready", piuTardi);
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, piuTardi);
  /* La linguetta va rimessa quando qualcuno ridisegna la barra, e la pagina
   * dell'app e il suo tasto seguono le pagine che si cambiano. */
  doc.addEventListener(
    "click",
    (evento) => {
      if (evento.target?.closest?.(".tab")) piuTardi();
      else if (evento.target?.closest?.("#page-automazioni"))
        root.setTimeout?.(() => aggiornaIlTasto(), 0);
    },
    true,
  );
  piuTardi();
  return true;
}

/* Per le prove. */
export const _statoDellaCasa = state;
