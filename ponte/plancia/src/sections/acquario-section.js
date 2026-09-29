/* La pagina dell'acquario (#127).
 *
 * «Si potrebbe inserire una sezione con l'acquario?»
 *
 * Fatta coi pezzi delle altre pagine, come nel render che si è visto prima di
 * scriverla:
 *
 *   · in cima la risposta grande, il riquadro «In questo momento» dei Varchi:
 *     tutto nella norma, o la cosa da guardare — l'acqua troppo calda, il
 *     livello da rabboccare, il cambio d'acqua da fare;
 *   · sotto le mattonelle di comando della Piscina: le luci, il filtro, il
 *     riscaldatore, che si accendono e si spengono con un tocco;
 *   · poi la scheda «Qualità acqua» della Piscina, con la temperatura e il pH
 *     sulla loro forcella e il livello come una riga delle Batterie, con i
 *     giorni al rabbocco;
 *   · e la scheda del cambio d'acqua, con l'anello della filtrazione: da quanti
 *     giorni non lo si fa, e il tasto per segnarlo.
 *
 * Il cambio d'acqua non lo misura nessun sensore: è una data che si segna qui,
 * e sta nella configurazione di casa — così il telefono che la segna e il
 * tablet in cucina contano gli stessi giorni.
 */
import {
  CHIAVE_ACQUARIO,
  acquarioConfigurato,
  acquarioDiCasa,
  comeStaLAcquario,
  conIlCambio,
  domandaDelLivello,
  livelliDaSeguire,
  serieDelLivello,
} from "../core/l-acquario-di-casa.js";
import { forcellaMarkup } from "./pool-irrigation-scene-section.js";
import {
  allStates,
  chiamaServizio,
  chiediAHomeAssistant,
  disegnoDiCasa,
  doc,
  esc,
  formatNumber,
  installStyle,
  paginaVisibile,
  planciaVisibile,
  quandoSiCambiaPagina,
  readJson,
  root,
  siComanda,
  t,
  writeJsonIfChanged,
} from "./shared.js";
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

const KEY = "__DASHBOARDMODERN_ACQUARIO__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  firma: "",
  sveglia: 0,
  dati: null,
  inVolo: false,
  chiestoAlle: 0,
  fallitoAlle: 0,
  annulla: null,
});

export const ACQUARIO_PAGE_ID = "page-acquario";
export const ACQUARIO_TAB = "acquario";

/* L'avviso che le medie del livello sono arrivate: la tessera in Home lo
 * ascolta, perché la risposta atterra quando la Home si è già disegnata. */
export const EVENTO_ACQUARIO = "dashboardmodern:acquario-letto";

/* Mezz'ora: l'acqua evapora in giorni. Chiedere più spesso sarebbe lavoro per
 * il Recorder in cambio di niente. */
const OGNI_QUANTO_MS = 30 * 60_000;
const DOPO_UN_ERRORE_MS = 60_000;
const ATTESA_MS = 30_000;

/* Quanto resta il tasto per tornare indietro dopo «Fatto oggi». */
const ANNULLA_MS = 5_000;

/* ── cosa c'è da guardare ─────────────────────────────────────────────── */

function configurazione() {
  return readJson(CHIAVE_ACQUARIO, {}) || {};
}

/** Le righe dell'acquario, lette adesso dagli stati. */
export function acquarioInPlancia(states = allStates()) {
  return acquarioDiCasa(states, configurazione(), (entity) => nomeDaHomeAssistant(entity, states));
}

/** Se c'è almeno una riga dichiarata. */
export function ciSonoRighe() {
  return acquarioConfigurato(configurazione());
}

/**
 * Come sta l'acquario adesso: le righe lette e il giudizio di tutto insieme.
 * `dentro` toglie le entità che la tessera in Home non vuole.
 */
export function vistaDellAcquario(states = allStates(), { dentro } = {}) {
  const letture = acquarioInPlancia(states).filter(
    (lettura) => typeof dentro !== "function" || dentro(lettura.entity),
  );
  if (!letture.length) return null;
  const adesso = Date.now();
  return {
    letture,
    adesso,
    come: comeStaLAcquario(letture, {
      serie: state.dati?.serie || {},
      config: configurazione(),
      adesso,
    }),
  };
}

/* ── le domande a Home Assistant ──────────────────────────────────────── */

function laTesseraSiVede() {
  if (!doc?.getElementById?.("page-home")?.classList?.contains("active")) return false;
  return Boolean(doc.querySelector?.(`.dm-tile[data-dm-widget="${ACQUARIO_TAB}"]`));
}

/* Si chiede solo quando qualcuno guarda: la pagina aperta, o la Home con la
 * sua tessera. */
function serveLeggere() {
  if (!planciaVisibile()) return false;
  const pagina = doc?.getElementById?.(ACQUARIO_PAGE_ID);
  return Boolean(pagina?.classList.contains("active")) || laTesseraSiVede();
}

async function aggiornaIDati({ forza = false } = {}) {
  const letture = acquarioInPlancia();
  /* La storia serve solo ai livelli con una soglia: un acquario senza non
   * chiede niente a nessuno. E nessuno che risponde vuol dire, di solito, gli
   * stati non ancora arrivati: si aspetta loro. */
  const livelli = livelliDaSeguire(letture);
  if (!livelli.length || letture.every((lettura) => lettura.muto) || state.inVolo) return;
  const adesso = Date.now();
  if (!forza) {
    if (state.dati && adesso - state.chiestoAlle < OGNI_QUANTO_MS) return;
    if (!state.dati && adesso - state.fallitoAlle < DOPO_UN_ERRORE_MS) return;
  }
  state.inVolo = true;
  state.chiestoAlle = adesso;
  let riuscita = false;
  try {
    const domanda = domandaDelLivello(livelli, adesso);
    const risposta = await chiediAHomeAssistant(domanda, ATTESA_MS);
    state.dati = {
      serie: Object.fromEntries(
        livelli.map((entity) => [entity, serieDelLivello(risposta, entity)]),
      ),
    };
    state.fallitoAlle = 0;
    riuscita = true;
  } catch (errore) {
    /* Senza presa non si è chiesto niente a nessuno: la plancia si sta ancora
     * collegando, e l'annuncio che è pronta farà ridisegnare. */
    if (errore?.message === "socket") state.chiestoAlle = 0;
    else {
      state.fallitoAlle = Date.now();
      root.console?.warn?.("[DashboardModern] acquario", errore);
    }
  } finally {
    state.inVolo = false;
  }
  if (!riuscita) return;
  state.firma = "";
  schedule();
  root.dispatchEvent?.(new CustomEvent(EVENTO_ACQUARIO));
}

/* Un appuntamento solo, alla prossima mezz'ora: non un battito che gira. */
function prossimoGiro() {
  if (state.sveglia || !serveLeggere()) return;
  state.sveglia =
    root.setTimeout?.(() => {
      state.sveglia = 0;
      schedule();
    }, OGNI_QUANTO_MS) || 0;
}

/* ── i comandi e il cambio d'acqua ────────────────────────────────────── */

/* Una mattonella accende o spegne: il verbo è quello del suo dominio, come
 * nelle Stanze. Quello chiuso col lucchetto si vede e basta. */
function commuta(entity) {
  if (!entity || !siComanda(entity)) return false;
  const lettura = acquarioInPlancia().find((voce) => voce.entity === entity);
  if (!lettura || lettura.muto) return false;
  chiamaServizio({
    domain: entity.split(".")[0],
    service: lettura.acceso ? "turn_off" : "turn_on",
    data: { entity_id: entity },
  });
  if (root.navigator?.vibrate) root.navigator.vibrate(5);
  return true;
}

/* «Fatto oggi» segna la data, e per cinque secondi lascia il modo di tornare
 * indietro: un tocco per sbaglio non deve costare la data di prima. */
function segnaIlCambio() {
  const prima = configurazione();
  state.annulla = { cambio: prima.cambio ?? "" };
  writeJsonIfChanged(CHIAVE_ACQUARIO, conIlCambio(prima, Date.now()));
  renderAcquario();
  root.setTimeout?.(() => {
    if (!state.annulla) return;
    state.annulla = null;
    renderAcquario();
  }, ANNULLA_MS);
}

function annullaIlCambio() {
  if (!state.annulla) return;
  writeJsonIfChanged(CHIAVE_ACQUARIO, conIlCambio(configurazione(), state.annulla.cambio));
  state.annulla = null;
  renderAcquario();
}

/* ── la pagina e la sua voce nella barra ──────────────────────────────── */

function ultimaPagina() {
  const pagine = doc?.querySelectorAll?.(".page");
  return pagine?.length ? pagine[pagine.length - 1] : null;
}

export function ensureAcquarioPage() {
  if (!doc) return null;
  let pagina = doc.getElementById(ACQUARIO_PAGE_ID);
  if (pagina) return pagina;
  const sorella = ultimaPagina();
  if (!sorella?.parentElement) return null;
  pagina = doc.createElement("section");
  pagina.className = "page";
  pagina.id = ACQUARIO_PAGE_ID;
  pagina.innerHTML = `<div class="dm-acq-wrap" id="acquario-wrap"></div>`;
  sorella.after(pagina);
  return pagina;
}

export function ensureAcquarioTab() {
  if (!doc) return null;
  let voce = doc.querySelector(`.tab[data-tab="${ACQUARIO_TAB}"]`);
  if (voce) return voce;
  const barra = doc.querySelector("nav.tabs");
  if (!barra) return null;
  /* Accanto alla piscina: è l'altra acqua di casa che si guarda. */
  const dopo =
    barra.querySelector('.tab[data-tab="piscina"]') ||
    barra.querySelector('.tab[data-tab="piante"]') ||
    barra.querySelector('.tab[data-tab="irrigazione"]') ||
    barra.querySelector('.tab[data-tab="home"]');
  voce = doc.createElement("button");
  voce.className = "tab";
  voce.dataset.tab = ACQUARIO_TAB;
  voce.id = `tab-${ACQUARIO_TAB}`;
  voce.innerHTML = `<span class="icon">🐠</span><span class="text">${esc(t("Acquario", "Aquarium"))}</span>`;
  voce.addEventListener("click", () => {
    for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
    for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
    voce.classList.add("active");
    ensureAcquarioPage()?.classList.add("active");
    const testata = doc.querySelector("header");
    if (testata) testata.style.display = "none";
    root.scrollTo?.({ top: 0, behavior: "instant" });
    if (root.navigator?.vibrate) root.navigator.vibrate(5);
    schedule();
  });
  if (dopo) dopo.after(voce);
  else barra.append(voce);
  return voce;
}

/* La voce si governa da sé, come quella delle piante: c'è quando c'è una riga
 * dichiarata e nessuno l'ha spenta. */
function sezioneAccesa() {
  const sezioni = readJson("cd_sections", {});
  return !(sezioni && typeof sezioni === "object" && sezioni[ACQUARIO_TAB] === false);
}

function accendiLaVoce() {
  const voce = ensureAcquarioTab();
  if (!voce) return;
  const serve = ciSonoRighe() && sezioneAccesa();
  if (serve) voce.style.removeProperty("display");
  else voce.style.setProperty("display", "none", "important");
  const pagina = doc.getElementById(ACQUARIO_PAGE_ID);
  if (!serve && pagina?.classList.contains("active"))
    doc.querySelector('.tab[data-tab="home"]')?.click();
}

/* ── le parole ────────────────────────────────────────────────────────── */

const SPAZIO = " ";

/* Le cifre che il sensore dà, fino a due: un pH si legge a 7,25, una
 * temperatura a 25,6, i ppm interi. */
function cifreDi(valore) {
  const dopo = String(valore).split(".")[1] || "";
  return Math.min(2, dopo.length);
}

function numeroInParole(valore) {
  return formatNumber(valore, cifreDi(valore));
}

function valoreInParole(lettura) {
  if (lettura.valore === null) return "—";
  return `${numeroInParole(lettura.valore)}${lettura.unita ? `${SPAZIO}${lettura.unita}` : ""}`;
}

function forchettaInParole(lettura) {
  const unita = lettura.unita ? `${SPAZIO}${lettura.unita}` : "";
  return `${t("ideale", "ideal")} ${numeroInParole(lettura.minimo)} – ${numeroInParole(lettura.massimo)}${unita}`;
}

/* I giorni stanno dentro la frase, e l'uno e lo zero hanno la loro: «fra 1
 * giorni» e «0 giorni fa» si leggono subito. */

/** Da quanto è stata cambiata l'acqua; vuoto se non è mai stato segnato. */
export function cambioInParole(cambio) {
  if (!cambio || cambio.giorni === null) return "";
  const { giorni } = cambio;
  if (giorni === 0) return t("Cambio d'acqua fatto oggi", "Water changed today");
  if (giorni === 1) return t("Cambio d'acqua fatto ieri", "Water changed yesterday");
  return t(`Cambio d'acqua ${giorni} giorni fa`, `Water changed ${giorni} days ago`);
}

/** Quando tocca il prossimo, o di quanto è in ritardo. */
export function prossimoCambioInParole(cambio) {
  if (!cambio || cambio.fra === null) return "";
  const { fra } = cambio;
  if (fra > 1) return t(`il prossimo fra ${fra} giorni`, `next one in ${fra} days`);
  if (fra === 1) return t("il prossimo domani", "next one tomorrow");
  if (fra === 0) return t("da fare oggi", "due today");
  if (fra === -1) return t("in ritardo di un giorno", "one day late");
  const ritardo = -fra;
  return t(`in ritardo di ${ritardo} giorni`, `${ritardo} days late`);
}

function ogniInParole(ogni) {
  return ogni === 1
    ? t("ogni giorno", "every day")
    : t(`ogni ${ogni} giorni`, `every ${ogni} days`);
}

/** Fra quanti giorni si rabbocca. */
export function rabboccoInParole(giorni) {
  if (giorni === null || giorni === undefined) return "";
  if (giorni < 1) return t("rabbocco a breve", "top-up soon");
  if (giorni === 1) return t("rabbocco domani", "top-up tomorrow");
  return t(`rabbocco fra ${giorni} giorni`, `top-up in ${giorni} days`);
}

/* Acceso e spento si accordano con quello che comandano: le luci sono
 * accese, il filtro è acceso. */
function statoDelComando(lettura) {
  if (lettura.muto) return t("Non risponde", "Not answering");
  if (lettura.genere === "luci") return lettura.acceso ? t("accese", "on") : t("spente", "off");
  return lettura.acceso ? t("acceso", "on") : t("spento", "off");
}

/* Cosa dice la risposta grande di una misura fuori forcella: l'acqua troppo
 * calda o troppo fredda, il pH troppo alto o troppo basso. Una misura
 * qualunque dice solo che è fuori, e il suo nome sta sotto. */
function fuoriInParole({ lettura, verdetto }) {
  const alto = verdetto === "high";
  if (lettura.genere === "temperatura")
    return alto
      ? t("Acqua troppo calda", "Water too warm")
      : t("Acqua troppo fredda", "Water too cold");
  if (lettura.genere === "ph")
    return alto ? t("pH troppo alto", "pH too high") : t("pH troppo basso", "pH too low");
  return t("Fuori norma", "Out of range");
}

function quanteMute(quante) {
  return quante === 1
    ? t("1 non risponde", "1 not answering")
    : `${quante} ${t("non rispondono", "not answering")}`;
}

function vascaInParole(come) {
  return [come.vasca, come.litri ? `${formatNumber(come.litri, 0)}${SPAZIO}L` : ""]
    .filter(Boolean)
    .join(" · ");
}

/**
 * La risposta grande in cima: `{ stato, grande, nomi, sotto }`.
 *
 * Una cosa sola, la più importante: una misura fuori forcella, poi l'acqua da
 * rabboccare, poi il cambio d'acqua da fare. Se va tutto bene lo dice, con la
 * vasca e da quanto è stata cambiata l'acqua.
 */
export function testaDellAcquario(come) {
  const mute = come.mute.length ? quanteMute(come.mute.length) : "";
  if (come.stato === "fuori") {
    if (come.fuori.length === 1) {
      const [voce] = come.fuori;
      return {
        stato: "fuori",
        grande: fuoriInParole(voce),
        nomi: `${voce.lettura.name} · ${valoreInParole(voce.lettura)}`,
        sotto: [forchettaInParole(voce.lettura), mute].filter(Boolean).join(" · "),
      };
    }
    const quante = come.fuori.length;
    return {
      stato: "fuori",
      grande: t(`${quante} valori fuori norma`, `${quante} readings out of range`),
      nomi: come.fuori.map((voce) => voce.lettura.name).join(" · "),
      sotto: mute,
    };
  }
  if (come.stato === "livello") {
    const [voce] = come.bassi;
    return {
      stato: "livello",
      grande: t("Da rabboccare", "Top up the water"),
      nomi: voce.lettura.binario
        ? voce.lettura.name
        : `${voce.lettura.name} · ${valoreInParole(voce.lettura)}`,
      sotto: [vascaInParole(come), mute].filter(Boolean).join(" · "),
    };
  }
  if (come.stato === "cambio")
    return {
      stato: "cambio",
      grande: t("Cambio d'acqua da fare", "Water change due"),
      nomi: [come.vasca, cambioInParole(come.cambio)].filter(Boolean).join(" · "),
      sotto: [prossimoCambioInParole(come.cambio), mute].filter(Boolean).join(" · "),
    };
  if (come.stato === "mute")
    return { stato: "mute", grande: t("Nessuna risponde", "None answering"), nomi: "", sotto: "" };
  return {
    stato: "bene",
    grande: t("Tutto nella norma", "All in range"),
    nomi: vascaInParole(come),
    sotto: [
      cambioInParole(come.cambio),
      come.rabbocco ? rabboccoInParole(come.rabbocco.giorni) : "",
      mute,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function testaMarkup(testa) {
  return `<div class="dm-acq-testa" data-stato="${esc(testa.stato)}">
    <small>${esc(t("In questo momento", "Right now"))}</small>
    <strong>${esc(testa.grande)}</strong>
    ${testa.nomi ? `<span class="dm-acq-nomi">${esc(testa.nomi)}</span>` : ""}
    ${testa.sotto ? `<span class="dm-acq-sotto">${esc(testa.sotto)}</span>` : ""}
  </div>`;
}

/* Le mattonelle della Piscina: la luce gialla, il riscaldatore arancio, il
 * resto azzurro. Il comando non sta in `data-act`, che è della piscina. */
const MATTONELLA = Object.freeze({
  luci: { vestito: "light", glifo: "💡" },
  filtro: { vestito: "pump", glifo: "🌀" },
  riscaldatore: { vestito: "heat", glifo: "🔥" },
  comando: { vestito: "pump", glifo: "🔌" },
});

function mattonellaMarkup(lettura) {
  const { vestito, glifo } = MATTONELLA[lettura.genere] || MATTONELLA.comando;
  const acceso = lettura.acceso === true;
  const comandabile = !lettura.muto && siComanda(lettura.entity);
  return `<button type="button" class="dm-pool-tile" data-dm-pool-tile="${vestito}" data-on="${acceso}"
      aria-pressed="${acceso}" data-dm-acq-comando="${esc(lettura.entity)}"${comandabile ? "" : ' aria-disabled="true"'}>
    <span class="dm-pool-tile-icon" aria-hidden="true">${glifo}</span>
    <span class="dm-pool-tile-label">${esc(lettura.name)}</span>
    <span class="dm-pool-tile-state">${esc(statoDelComando(lettura))}</span>
  </button>`;
}

function chiaveDellaMisura(lettura) {
  return `acq-${lettura.entity.replace(/[^a-z0-9]+/gi, "-")}`;
}

/* Una misura sulla sua forcella, con la barra della Piscina. Senza forcella —
 * una misura a cui non la si è data — resta la riga di testa, col numero. */
function misuraMarkup({ lettura, verdetto }) {
  if (lettura.muto || lettura.minimo === null)
    return `<div class="dm-gauge" data-dm-gauge="${esc(chiaveDellaMisura(lettura))}" data-verdict="">
      <div class="dm-gauge-head">
        <span class="dm-gauge-label">${esc(lettura.name)}</span>
        <span class="dm-gauge-value">${esc(lettura.muto ? "—" : valoreInParole(lettura))}</span>
      </div>
      ${lettura.muto ? `<div class="dm-gauge-foot"><span class="dm-gauge-range">${esc(t("Non risponde", "Not answering"))}</span></div>` : ""}
    </div>`;
  return forcellaMarkup({
    chiave: chiaveDellaMisura(lettura),
    etichetta: lettura.name,
    valore: lettura.valore,
    testo: valoreInParole(lettura),
    minimo: lettura.minimo,
    massimo: lettura.massimo,
    verdetto,
    parola:
      verdetto === "low"
        ? t("troppo basso", "too low")
        : verdetto === "high"
          ? t("troppo alto", "too high")
          : t("nella norma", "in range"),
    forchetta: forchettaInParole(lettura),
  });
}

/* Il livello come una riga delle Batterie: il disegno, il nome, la barra
 * quando è in percento, e a destra quello che conta — fra quanti giorni si
 * rabbocca. */
function livelloMarkup({ lettura, basso, giorni }) {
  const stato = lettura.muto ? "muta" : basso ? "basso" : "bene";
  const percento =
    !lettura.binario && lettura.valore !== null && /%/.test(lettura.unita)
      ? Math.max(0, Math.min(100, lettura.valore))
      : null;
  const destra = lettura.muto
    ? t("Non risponde", "Not answering")
    : basso
      ? t("da rabboccare", "to top up")
      : giorni !== null
        ? rabboccoInParole(giorni)
        : lettura.binario
          ? t("nella norma", "in range")
          : valoreInParole(lettura);
  const sotto =
    percento !== null
      ? `<span class="dm-acq-livello-barra"><i style="width:${esc(String(percento))}%"></i></span>`
      : !lettura.binario && !lettura.muto && giorni !== null
        ? `<small>${esc(valoreInParole(lettura))}</small>`
        : "";
  return `<div class="dm-acq-livello" data-stato="${esc(stato)}">
    <span class="dm-acq-livello-ic" aria-hidden="true">${disegnoDiCasa(lettura.icon, { misura: 26, ripiego: "water" })}</span>
    <div class="dm-acq-livello-testo"><strong>${esc(lettura.name)}</strong>${sotto}</div>
    <b class="dm-acq-livello-stato">${esc(destra)}</b>
  </div>`;
}

function qualitaMarkup(come) {
  const misure = come.misure.map(misuraMarkup).join("");
  const livelli = come.livelli.map(livelloMarkup).join("");
  if (!misure && !livelli) return "";
  return `<article class="dm-pool-card dm-acq-qualita">
    <div class="dm-pool-card-head">
      <span class="dm-pool-card-title"><i aria-hidden="true">🧪</i>${esc(t("Qualità acqua", "Water quality"))}</span>
    </div>
    ${misure ? `<div class="dm-pool-gauges">${misure}</div>` : ""}
    ${livelli}
  </article>`;
}

/* Il cambio d'acqua con l'anello della filtrazione: quanti giorni sono
 * passati su quanti ne vanno, e il tasto per segnarlo. */
function cambioMarkup(come) {
  const { cambio } = come;
  const pieno =
    cambio.giorni === null ? 0 : Math.min(100, Math.round((cambio.giorni / cambio.ogni) * 100));
  const nota =
    cambio.ultimo === null
      ? t(
          "Non è ancora segnato: tocca «Fatto oggi» il giorno che lo fai, e da lì la pagina conta i giorni.",
          "Not recorded yet: tap “Done today” on the day you do it, and from then on the page counts the days.",
        )
      : [cambioInParole(cambio), prossimoCambioInParole(cambio)].filter(Boolean).join(" · ");
  const tasto = state.annulla
    ? `<button type="button" class="dm-btn dm-ghost" data-dm-acq-annulla>↶ ${esc(t("Annulla", "Undo"))}</button>`
    : `<button type="button" class="dm-btn dm-primary" data-dm-acq-cambio>✓ ${esc(t("Fatto oggi", "Done today"))}</button>`;
  return `<article class="dm-pool-card dm-acq-cambio" data-stato="${cambio.scaduto ? "scaduto" : "ok"}">
    <div class="dm-pool-card-head">
      <span class="dm-pool-card-title"><i aria-hidden="true">🪣</i>${esc(t("Cambio d'acqua", "Water change"))}</span>
      <span class="dm-pool-badge">${esc(ogniInParole(cambio.ogni))}</span>
    </div>
    <div class="dm-pool-filtration-body">
      <div class="dm-ring" style="--pct:${pieno}">
        <span class="dm-ring-core"><b>${esc(cambio.giorni === null ? "—" : String(cambio.giorni))}</b><i>/ ${esc(String(cambio.ogni))}</i></span>
      </div>
      <div class="dm-pool-filtration-copy">
        <p class="dm-pool-note">${esc(nota)}</p>
        <div class="dm-pool-actions dm-acq-azioni">${tasto}</div>
      </div>
    </div>
  </article>`;
}

function vuotoMarkup() {
  return `<div class="dm-acq-vuoto">
    <strong>${esc(t("Nessun acquario configurato", "No aquarium configured"))}</strong>
    <span>${esc(
      t(
        "L'acquario compare qui quando aggiungi le sue entità nella scheda Acquario della configurazione: la temperatura, il pH, il livello, le luci, il filtro.",
        "The aquarium shows up here once you add its entities in the Aquarium tab of the settings: temperature, pH, level, lights, filter.",
      ),
    )}</span>
  </div>`;
}

/** La pagina intera, da quello che si sa adesso. */
export function paginaDellAcquario(vista) {
  if (!vista) return vuotoMarkup();
  const { come } = vista;
  const mattonelle = come.comandi.map(mattonellaMarkup).join("");
  return `${testaMarkup(testaDellAcquario(come))}
    ${mattonelle ? `<div class="dm-pool-tiles">${mattonelle}</div>` : ""}
    <div class="dm-pool-cards">${qualitaMarkup(come)}${cambioMarkup(come)}</div>`;
}

/* ── la tessera in Home ───────────────────────────────────────────────── */

/**
 * La tessera in Home, dalla stessa vista della pagina: la temperatura
 * dell'acqua, come la Piscina, e sotto la cosa da guardare. Chiede attenzione
 * quando c'è da fare — la forcella, il rabbocco, il cambio — come la batteria
 * da cambiare.
 */
export function tesseraDellAcquario(vista) {
  if (!vista) return null;
  const { come } = vista;
  const testa = testaDellAcquario(come);
  const daFare = come.stato === "fuori" || come.stato === "livello" || come.stato === "cambio";
  const acqua = come.misure.find(
    (voce) => voce.lettura.genere === "temperatura" && !voce.lettura.muto,
  )?.lettura;
  return {
    key: ACQUARIO_TAB,
    accent: daFare ? "#f59e0b" : "#0ea5e9",
    icon: "🐠",
    label: t("Acquario", "Aquarium"),
    value: acqua ? `${formatNumber(acqua.valore, 1)}°` : "—",
    caption: [testa.grande, daFare ? testa.nomi : cambioInParole(come.cambio)]
      .filter(Boolean)
      .join(" · "),
    ring: null,
    attiva: daFare,
    alert: daFare,
    rows: [
      ...come.misure.map(({ lettura, verdetto }) => ({
        entity: lettura.entity,
        name: lettura.name,
        glyph: disegnoDiCasa(lettura.icon, { misura: 20, ripiego: "aquarium" }),
        value: lettura.muto ? t("Non risponde", "Not answering") : valoreInParole(lettura),
        tono:
          verdetto === "low" || verdetto === "high" ? "allarme" : verdetto === "ok" ? "quiete" : "",
      })),
      ...come.livelli.map(({ lettura, basso, giorni }) => ({
        entity: lettura.entity,
        name: lettura.name,
        glyph: disegnoDiCasa(lettura.icon, { misura: 20, ripiego: "water" }),
        value: lettura.muto
          ? t("Non risponde", "Not answering")
          : basso
            ? t("da rabboccare", "to top up")
            : giorni !== null
              ? rabboccoInParole(giorni)
              : lettura.binario
                ? t("nella norma", "in range")
                : valoreInParole(lettura),
        tono: lettura.muto ? "" : basso ? "allarme" : "quiete",
      })),
      ...come.comandi.map((lettura) => ({
        entity: lettura.entity,
        name: lettura.name,
        glyph: disegnoDiCasa(lettura.icon, { misura: 20, ripiego: "toggle" }),
        value: statoDelComando(lettura),
        tono: lettura.muto ? "" : "quiete",
      })),
    ],
  };
}

function dipingi() {
  const pagina = ensureAcquarioPage();
  const dove = pagina?.querySelector?.("#acquario-wrap");
  if (!dove) return;
  if (!paginaVisibile(ACQUARIO_PAGE_ID)) return;
  const markup = paginaDellAcquario(vistaDellAcquario());
  if (state.firma === markup && dove.firstElementChild) return;
  state.firma = markup;
  dove.innerHTML = markup;
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      accendiLaVoce();
      dipingi();
      if (serveLeggere()) {
        aggiornaIDati();
        prossimoGiro();
      }
    } catch (error) {
      root.console?.warn?.("[DashboardModern] acquario", error);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

/** Ridisegna adesso, saltando la firma: la usa chi cambia la configurazione. */
export function renderAcquario() {
  state.firma = "";
  /* Un livello nuovo, o una soglia nuova, vuole la sua storia. */
  state.chiestoAlle = 0;
  schedule();
}

/* ── il foglio ────────────────────────────────────────────────────────── */

/* Copie delle regole dei Varchi e delle Batterie, legate a questa pagina; le
 * mattonelle, le schede, la forcella e l'anello no — quelli sono di tutti, e
 * stanno nel foglio della Piscina. */
function installStyles() {
  const P = `#${ACQUARIO_PAGE_ID}`;
  installStyle(
    "dm-acquario-section-style",
    `
    ${P} .dm-acq-wrap{display:grid;gap:14px;padding:0 0 24px}
    ${P} .dm-acq-vuoto{display:grid;gap:6px;padding:22px 18px;text-align:center;
      border:1px dashed var(--divider-color,#dbe4ee);border-radius:18px;background:var(--card-bg,#fff)}
    ${P} .dm-acq-vuoto strong{font-size:14px;font-weight:900}
    ${P} .dm-acq-vuoto span{font-size:12px;font-weight:700;color:var(--secondary-text-color,#64748b)}

    /* La risposta grande, come quella dei Varchi. */
    ${P} .dm-acq-testa{
      display:grid;gap:4px;padding:20px 22px;border-radius:22px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      box-shadow:var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    ${P} .dm-acq-testa small{
      font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;
      color:var(--text-dim,#64748b)}
    ${P} .dm-acq-testa strong{font-size:30px;font-weight:900;line-height:1.05;color:var(--text,#0f172a)}
    ${P} .dm-acq-testa[data-stato="bene"] strong{color:#15803d}
    ${P} .dm-acq-testa[data-stato="fuori"] strong,
    ${P} .dm-acq-testa[data-stato="livello"] strong,
    ${P} .dm-acq-testa[data-stato="cambio"] strong{color:#b45309}
    ${P} .dm-acq-nomi{font-size:13px;font-weight:800;color:var(--text,#0f172a)}
    ${P} .dm-acq-sotto{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}

    /* Chi è chiuso col lucchetto si vede, ma non si tocca. */
    ${P} .dm-pool-tile[aria-disabled="true"]{cursor:default}
    ${P} .dm-pool-tile[aria-disabled="true"]:hover{transform:none}

    /* Il livello, come una riga delle Batterie. */
    ${P} .dm-acq-livello{
      display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:12px;
      padding:12px 14px;border-radius:16px;
      border:1px solid color-mix(in srgb,var(--dm-acq,#10b981) 36%,transparent);
      background:color-mix(in srgb,var(--dm-acq,#10b981) 7%,var(--card-bg,#fff))}
    ${P} .dm-acq-livello[data-stato="basso"]{--dm-acq:#f59e0b}
    ${P} .dm-acq-livello[data-stato="muta"]{--dm-acq:#94a3b8;opacity:.72}
    ${P} .dm-acq-livello-ic{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;
      background:color-mix(in srgb,var(--dm-acq,#10b981) 18%,transparent)}
    ${P} .dm-acq-livello-ic .dm-catalogo-art{display:grid;place-items:center;line-height:0}
    ${P} .dm-acq-livello-ic svg{display:block;width:26px;height:26px}
    ${P} .dm-acq-livello-testo{display:grid;gap:3px;min-width:0}
    ${P} .dm-acq-livello-testo strong{font-size:14px;font-weight:900;color:var(--text,#0f172a);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    ${P} .dm-acq-livello-testo small{font-size:11px;font-weight:700;color:var(--text-dim,#64748b)}
    ${P} .dm-acq-livello-barra{display:block;height:5px;border-radius:999px;margin-top:2px;
      background:color-mix(in srgb,var(--dm-acq,#10b981) 18%,transparent);overflow:hidden}
    ${P} .dm-acq-livello-barra i{display:block;height:100%;border-radius:999px;background:var(--dm-acq,#10b981)}
    ${P} .dm-acq-livello-stato{font-size:13.5px;font-weight:900;text-align:right;line-height:1.2;
      color:color-mix(in srgb,var(--dm-acq,#10b981) 78%,var(--text,#0f172a))}

    /* Il cambio d'acqua: un tasto solo, largo quanto la colonna; e quando è
       in ritardo l'anello si scalda come la risposta grande. */
    ${P} .dm-acq-azioni{grid-template-columns:minmax(0,1fr)}
    ${P} .dm-acq-cambio[data-stato="scaduto"] .dm-ring{
      background:conic-gradient(from -90deg,#f59e0b 0 calc(var(--pct,0) * 1%),var(--surface-3,#e2e8f0) 0)}
    `,
  );
}

export function installAcquario() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  ensureAcquarioPage();
  ensureAcquarioTab();
  for (const nome of ["render", "cdApplyNavVis"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmAcquario) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    avvolta.__dmAcquario = true;
    avvolta.__dmPrevious = precedente;
    root[nome] = avvolta;
  }
  doc.addEventListener?.("click", (evento) => {
    const dentro = evento.target?.closest?.(`#${ACQUARIO_PAGE_ID}`);
    if (!dentro) return;
    const mattonella = evento.target.closest("[data-dm-acq-comando]");
    if (mattonella) {
      evento.preventDefault();
      commuta(mattonella.dataset.dmAcqComando);
      return;
    }
    if (evento.target.closest("[data-dm-acq-cambio]")) {
      evento.preventDefault();
      segnaIlCambio();
      return;
    }
    if (evento.target.closest("[data-dm-acq-annulla]")) {
      evento.preventDefault();
      annullaIlCambio();
    }
  });
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
    /* La tessera in Home c'è solo dopo che la Home si è dipinta: è lì che si
     * sa se qualcuno la sta guardando. */
    "dashboardmodern:widgets-painted",
  ])
    root.addEventListener?.(evento, schedule);
  doc.addEventListener?.("visibilitychange", schedule);
  quandoSiCambiaPagina(schedule);
  schedule();
  return true;
}

installAcquario();
