/* La casa letta per stanza, invece che per tipo.
 *
 * «Sarebbe carino avere una sezione dove vedere le entita' raggruppate per
 * stanze, tipo una sezione divisa a pagine dove ogni pagina e' una stanza con
 * tutte le entita' della stessa.»
 *
 * Ogni sezione della plancia legge la casa per tipo: tutte le luci, tutte le
 * tapparelle, tutti gli elettrodomestici. E' il verso giusto quando si cerca
 * una cosa, ed e' quello sbagliato quando si sta in una stanza — perche' allora
 * si vuole sapere com'e' messa QUESTA stanza, non dove sta la sua luce
 * nell'elenco di tutte le luci.
 *
 * La pagina gira il verso. Non sposta niente e non riscrive niente: le
 * assegnazioni esistono gia' — luci, clima, tapparelle, elettrodomestici,
 * telecamere, carichi la stanza ce l'hanno addosso — e qui si leggono
 * dall'altro lato. Chi non ha stanza finisce in coda, sotto una pillola sua:
 * non e' un errore da nascondere, e' la sola occasione di accorgersene.
 *
 * Le card non sono nuove dove non serve che lo siano. La luce e' la card della
 * pagina Luci, la stessa: il suo tocco lo raccoglie il gestore di quella
 * sezione, che ascolta su tutto il documento e quindi funziona anche qui. Fare
 * una seconda card per la stessa luce vorrebbe dire mantenerne due.
 */
import { lightCommand, lightView, lightsSignature } from "../core/light-model.js";
import { canonicalClimateType } from "../core/device-model.js";
import { applianceGlyph } from "../core/appliance-artwork.js";
import { CHIAVE_MEDIA, letturaDelLettore, lettoriConfigurati } from "../core/media-player.js";
import {
  comandoDelDispositivo,
  genereDelComando,
  siPuoScegliere as puoScegliere,
} from "../core/comandi-accanto.js";
import { CHIAVE_ENTITA_MIE, entitaMie } from "../core/entita-mie.js";
import { roomGlyph } from "../core/personalization-catalog.js";
import {
  ROOM_ASSIGN_KEY,
  ROOM_BLOCKS,
  pickRoomPage,
  roomOverviewModel,
  roomSceneEntities,
  roomSceneSummary,
} from "../core/room-overview.js";
import { CHIAVE_VERSI, apertaSecondoVerso, insiemeInvertiti } from "../core/verso-aperture.js";
import { windowOpenFromState } from "../core/shutter-window.js";
import { nonRisponde } from "../core/chi-non-risponde.js";
import {
  QUANTO_DURA_LA_DOMANDA,
  QUANTO_DURA_L_ANNULLA,
  acceseNelPiano,
  pastiglieDellaStanza,
  stanzePerPiano,
} from "../core/le-stanze-per-piano.js";
import { apriIlMenu } from "./azioni-servizio-giusto-section.js";
import { dipingiLeCardDelClima, laCardDelClima } from "./climate-thermal-section.js";
import { parolaDiStato } from "./le-parole-di-home-assistant.js";
import { pageCardMarkup } from "./lights-page-section.js";
import { comandiMediaMarkup } from "./media-player-section.js";
import { azioniDellaPorta } from "../core/security-door-model.js";
import { configuredSecurityDoors, parolaDelGesto } from "./security-doors-section.js";
import { temperatureEntries } from "./beta25-real-device-fixes-section.js";
import {
  allStates,
  chiamaServizio,
  clean,
  doc,
  esc,
  installStyle,
  paginaVisibile,
  quandoSiCambiaPagina,
  readJson,
  root,
  section,
  siComanda,
  t,
  wrapFunction,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ROOMS_PAGE__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  signature: "",
  room: "",
  /* La domanda aperta su una tessera e l'annulla che resta dopo (#17, parte 3).
   * Stanno nello stato e non nel documento perche' la pagina si ridisegna al
   * primo cambio di stato — cioe' proprio quando la luce si spegne — e un
   * tasto «Annulla» appeso al documento sparirebbe nell'istante in cui serve. */
  chiesta: null,
  annulla: null,
});

export const ROOMS_PAGE_ID = "page-stanze";
export const ROOMS_TAB = "stanze";

/* ─────────────────────────────── il modello ─────────────────────────────── */

const lista = (nome, chiave) => {
  const canonico = section(nome, null);
  if (Array.isArray(canonico) && canonico.length) return canonico;
  const legacy = readJson(chiave, []);
  return Array.isArray(legacy) ? legacy : [];
};

/* Le sorgenti da cui la pagina Stanze legge la casa. Le usa anche
 * l'assegnatore, per sapere chi la stanza ce l'ha gia' per mestiere. */
export function roomSources() {
  const canoniche = section("lights", null);
  return {
    rooms: lista("rooms", "cd_stanze"),
    lights: Array.isArray(canoniche) && canoniche.length ? canoniche : readJson("cd_luci", {}),
    lightRooms: readJson("cd_luci_rooms", {}),
    prese: lista("prese", "cd_prese"),
    climate: lista("climate", "cd_clima_units"),
    covers: lista("covers", "cd_tapparelle"),
    appliances: lista("appliances", "cd_appliances"),
    /* I lettori (#405): la loro scheda la stanza la chiede gia', e qui si
     * legge dall'altro lato — com'e' per le luci e per le telecamere. */
    media: lettoriConfigurati(readJson(CHIAVE_MEDIA, null)),
    cameras: lista("cameras", "cd_cameras"),
    loads: lista("loads", "cd_loads"),
    robots: lista("robots", "cd_robot"),
    irrigation: section("irrigation", null) || readJson("cd_irrigazione", {}),
    assigned: assignedItems(),
  };
}

export function roomPages() {
  return roomOverviewModel(roomSources());
}

/* Le entita' assegnate a mano a una stanza, da qualunque scheda.
 *
 * La mappa e' `entita' -> stanza` e la scrive l'assegnatore in configurazione.
 * Qui si trasforma in voci con un nome leggibile: quello di Home Assistant se
 * c'e', altrimenti l'entity_id — brutto da leggere ma mai una bugia. */
export function assignedItems(mappa = readJson(ROOM_ASSIGN_KEY, {}), states = allStates()) {
  const voci = new Map();
  const metti = (entity, stanza, nome, icona) => {
    const id = clean(entity);
    const room_id = clean(stanza);
    if (!id || !room_id || voci.has(id)) return;
    voci.set(id, {
      entity: id,
      name: clean(nome) || clean(states?.[id]?.attributes?.friendly_name) || id,
      /* L'icona si scrive dove la riga la cerca gia': `emojiScelta` guarda
       * `icon`, e accetta solo quello che un glifo lo e' davvero. */
      icon: clean(icona),
      /* La classe che Home Assistant scrive sull'entita': e' quello che la
       * riga sa dire di se' quando nessuna scheda la descrive. */
      device_class: clean(states?.[id]?.attributes?.device_class),
      room_id,
    });
  };
  if (mappa && typeof mappa === "object")
    for (const [entity, room] of Object.entries(mappa)) metti(entity, room);
  /* Le entita' che uno si aggiunge a mano (#504).
   *
   * «Si potrebbero inserire le entità personalizzate nelle stanze tipo
   * Automazioni?» La scheda «Entità mie» la stanza la chiedeva gia' — c'e' la
   * sua tendina accanto all'entita' — ma quella scelta non arrivava fin qui:
   * la pagina Stanze leggeva solo le assegnazioni a mano, e un'automazione
   * messa in cucina restava scritta in configurazione senza comparire in
   * nessuna stanza. Adesso arriva, col nome e l'icona che le ha dato chi l'ha
   * aggiunta — che sono suoi, e valgono piu' di quelli di Home Assistant.
   *
   * L'assegnazione a mano viene prima: se la stessa entita' e' in tutt'e due,
   * comanda quella scritta dalla tendina della sua riga — e' la piu' esplicita
   * delle due, e comunque una riga sola non diventa due. */
  for (const voce of entitaMie(readJson(CHIAVE_ENTITA_MIE, []))) {
    metti(voce.entity, voce.room_id, voce.nome, voce.icona);
  }
  return [...voci.values()];
}

/* Come si chiama ogni blocco, e con che faccia. Le parole stanno qui e non nel
 * modulo puro, che non sa che lingua si parla. */
const BLOCK_LABELS = Object.freeze({
  clima: ["Clima", "Climate", "❄️"],
  luci: ["Luci", "Lights", "💡"],
  prese: ["Prese", "Plugs", "🔌"],
  coperture: ["Finestre", "Windows", "🪟"],
  elettrodomestici: ["Elettrodomestici", "Appliances", "🧺"],
  media: ["Musica", "Music", "🎵"],
  telecamere: ["Telecamere", "Cameras", "📹"],
  carichi: ["Carichi", "Loads", "⚡"],
  robot: ["Aspirapolvere", "Vacuums", "🤖"],
  irrigazione: ["Irrigazione", "Irrigation", "💧"],
  altro: ["Altro in questa stanza", "Also in this room", "📍"],
});

const nomeBlocco = (blocco) => {
  const voce = BLOCK_LABELS[blocco.key];
  return voce ? t(voce[0], voce[1]) : blocco.key;
};

const iconaBlocco = (blocco) => BLOCK_LABELS[blocco.key]?.[2] || "•";

/* Il fiocco di neve non va bene per tutto quello che si chiama «clima».
 *
 * Sotto quella voce ci stanno il condizionatore, il termosifone e la pompa di
 * calore: nel riepilogo della stanza portavano tutti la stessa icona, e due
 * righe affiancate — «Soggiorno» e «Clima Soggiorno» — diventavano due fiocchi
 * di neve identici sopra due cose che non fanno la stessa cosa. Il tipo la
 * configurazione lo sa gia': lo dice la casella. */
const ICONE_CLIMA = Object.freeze({ termo: "🔥", pompa: "♨️", clima: "❄️" });

/* E il cestello non va bene per tutto quello che si chiama «elettrodomestico».
 *
 * Stessa storia del fiocco di neve, segnalata da capo (#404): «gli
 * elettrodomestici non vengono visualizzati con la loro icona, a prescindere da
 * come li si configuri: appaiono tutti con l'icona del cestello». Il forno, il
 * frigo e la lavastoviglie della cucina erano tre lavatrici in fila.
 *
 * Il tipo lo sa gia' il catalogo dei disegni — e' lo stesso che sceglie il
 * disegno grande nella sezione Elettrodomestici — e da li' arriva il glifo. La
 * riga della stanza e la card della sezione dicono cosi' la stessa cosa, e
 * l'icona scritta a mano, quando c'e', continua a vincere su tutto.
 *
 * Il campo `icon` non e' sempre un'emoji: sugli elettrodomestici ci sta la
 * CHIAVE del catalogo dei disegni — «washer» — e su altre righe una `mdi:`.
 * Nessuna delle due si sa scrivere qui dentro, che e' una riga di testo. Si
 * accetta solo quello che un glifo lo e' davvero: qualcosa fuori dall'ASCII. */
const UN_GLIFO = /[^\u0000-\u007f]/;

const emojiScelta = (item) => {
  const scritta = clean(item?.emoji_icon) || clean(item?.icon);
  return UN_GLIFO.test(scritta) ? scritta : "";
};

/* Che faccia ha una cosa assegnata a mano (#426).
 *
 * «Se fosse possibile far visualizzare l'icona corretta delle batterie nelle
 *  stanze: attualmente e' il puntatore generico.»
 *
 * Il puntatore e' l'icona del BLOCCO, «Altro in questa stanza», e per il
 * blocco va bene: e' un raccoglitore, e il puntatore dice «sta qui». Sopra la
 * singola riga no: ripete che quella cosa e' stata assegnata a mano, che e'
 * l'unica cosa che a chi guarda non serve, e sette righe diverse diventano
 * sette puntatori uguali.
 *
 * Quello che una riga sa dire di se' lo scrive gia' Home Assistant: la classe
 * dell'entita' — batteria, porta, movimento — e, quando la classe non c'e', il
 * dominio, che almeno distingue una serratura da un termometro. */
const ICONE_CLASSE = Object.freeze({
  battery: "🔋",
  temperature: "🌡️",
  humidity: "💧",
  moisture: "💦",
  illuminance: "☀️",
  pressure: "🧭",
  power: "⚡",
  energy: "⚡",
  current: "⚡",
  voltage: "⚡",
  gas: "🫧",
  co: "🫧",
  co2: "🫧",
  pm25: "🌫️",
  aqi: "🌫️",
  smoke: "🔥",
  motion: "🏃",
  occupancy: "🏃",
  presence: "🏃",
  door: "🚪",
  garage_door: "🚗",
  window: "🪟",
  opening: "🪟",
  lock: "🔒",
  sound: "🔊",
  vibration: "📳",
  problem: "⚠️",
  connectivity: "📶",
  signal_strength: "📶",
  timestamp: "🕒",
  running: "▶️",
  water: "🚰",
});

const ICONE_DOMINIO = Object.freeze({
  light: "💡",
  switch: "🔌",
  lock: "🔒",
  cover: "🪟",
  climate: "❄️",
  fan: "🌀",
  camera: "📹",
  media_player: "🎵",
  vacuum: "🤖",
  humidifier: "💧",
  water_heater: "🚿",
  valve: "🚰",
  siren: "🚨",
  alarm_control_panel: "🛡️",
  person: "🙋",
  device_tracker: "📡",
  scene: "🎬",
  script: "📜",
  automation: "⚙️",
  button: "🔘",
  number: "🔢",
  select: "📋",
  input_boolean: "🔘",
  binary_sensor: "🔔",
  sensor: "📈",
});

const lower = (valore) => clean(valore).toLowerCase();

export function glifoDellaVoce(item) {
  const classe = lower(item?.device_class);
  if (ICONE_CLASSE[classe]) return ICONE_CLASSE[classe];
  const entita = entitaVoce(item);
  const dominio = lower(entita.split(".")[0]);
  return ICONE_DOMINIO[dominio] || "";
}

export function iconaVoce(item, blocco) {
  const propria = emojiScelta(item);
  if (propria) return propria;
  if (blocco.key === "clima") return ICONE_CLIMA[canonicalClimateType(item?.type)] || "❄️";
  if (blocco.key === "elettrodomestici")
    return (
      applianceGlyph(item?.visual_key) ||
      applianceGlyph(item?.device_type) ||
      applianceGlyph(item?.type) ||
      applianceGlyph(item?.name) ||
      iconaBlocco(blocco)
    );
  if (blocco.key === "altro") return glifoDellaVoce(item) || iconaBlocco(blocco);
  return iconaBlocco(blocco);
}

/* Il nome di una voce, comunque sia stata configurata: quello scelto, quello
 * che dice Home Assistant, e in ultima istanza l'entita' stessa — che e' brutta
 * da leggere ma non e' mai una bugia. */
/* L'entita' che identifica una voce.
 *
 * Quasi tutte ne hanno una che comanda. Una finestra che si apre a mano no: ha
 * il solo sensore del contatto, ed e' quello che la identifica — altrimenti
 * resterebbe una riga senza nome e senza stato. */
function entitaVoce(item) {
  return clean(
    item?.entity ||
      item?.entities?.[0] ||
      item?.contact ||
      item?.contact_entity ||
      item?.tenda ||
      item?.tendaSole ||
      item?.id,
  );
}

function nomeVoce(item, states) {
  const entity = entitaVoce(item);
  return clean(item?.name) || clean(states?.[entity]?.attributes?.friendly_name) || entity || "—";
}

/* Cosa sta facendo, in una parola. La pagina di ogni sezione lo racconta per
 * esteso; qui serve il colpo d'occhio, e per il resto c'e' la sua pagina. */
/* I modi del clima si dicono con le parole di tutti: stavano anche qui, e
 * dicevano «Raffredda» dove la pagina Clima dice «Raffresca» — la stessa
 * macchina con due parole a due dita di distanza. Adesso la tabella e' una
 * sola, quella di `le-parole-di-home-assistant.js`. */

/* Cosa sta facendo, in una parola.
 *
 * «Acceso» e' giusto per una presa e sbagliato per una finestra: lo stesso `on`
 * vuol dire due cose diverse, e a distinguerle e' il blocco in cui la voce sta.
 * La pagina di ogni sezione lo racconta per esteso; qui serve il colpo
 * d'occhio, e per il resto c'e' la sua pagina. */
/* Cosa sta suonando, in una riga (#405).
 *
 * «Attualmente appare un Playing generico»: era lo stato grezzo di Home
 * Assistant, che dice che il lettore sta suonando e non dice cosa. Il titolo e
 * l'artista li porta gia' l'entita' — la sezione Musica li scrive — e sono
 * l'unica cosa che uno vuole leggere passando davanti alla stanza.
 *
 * Quando non c'e' un titolo si dice comunque qualcosa di vero: la sorgente
 * («HDMI 1»), o l'applicazione («Spotify»), che su un televisore sono la
 * risposta giusta alla stessa domanda. E quando non c'e' nemmeno quella
 * restano le tre parole dello stato, che non sono granche' ma non mentono. */
function cosaSuona(item, states) {
  const lettura = letturaDelLettore(item, states || {});
  if (lettura.muto) return t("Non disponibile", "Unavailable");
  if (lettura.spento) return t("Spento", "Off");
  const brano = [lettura.titolo, lettura.artista].filter(Boolean).join(" · ");
  if (lettura.suona)
    return brano || lettura.sorgente || lettura.applicazione || t("In riproduzione", "Playing");
  if (lettura.inPausa)
    return brano ? `${t("In pausa", "Paused")} · ${brano}` : t("In pausa", "Paused");
  return lettura.sorgente || lettura.applicazione || t("Acceso", "On");
}

function statoVoce(item, states, blocco = "") {
  const entity = entitaVoce(item);
  let stato = clean(states?.[entity]?.state).toLowerCase();
  if (!entity) return "";
  if (!stato || stato === "unavailable" || stato === "unknown")
    return t("Non disponibile", "Unavailable");
  /* Il contatto girato (#244) sta a ON quando l'anta e' chiusa: la parola
   * segue il verso vero. */
  if (
    entity.startsWith("binary_sensor.") &&
    (stato === "on" || stato === "off") &&
    insiemeInvertiti(readJson(CHIAVE_VERSI, [])).has(entity)
  )
    stato = stato === "on" ? "off" : "on";
  if (blocco === "coperture") {
    if (stato === "on" || stato === "open") return t("Aperta", "Open");
    if (stato === "off" || stato === "closed") return t("Chiusa", "Closed");
    if (stato === "opening") return t("In apertura", "Opening");
    if (stato === "closing") return t("In chiusura", "Closing");
  }
  if (blocco === "clima") {
    const modo = parolaDiStato(stato);
    if (modo !== stato) return modo;
  }
  if (blocco === "media") return cosaSuona(item, states);
  if (stato === "on") return t("Acceso", "On");
  if (stato === "off") return t("Spento", "Off");
  if (stato === "open") return t("Aperta", "Open");
  if (stato === "closed") return t("Chiusa", "Closed");
  return stato;
}

/* ──────────────────────────── la pagina e la voce ───────────────────────── */

function lastPage() {
  const pages = doc?.querySelectorAll?.(".page");
  return pages?.length ? pages[pages.length - 1] : null;
}

export function ensureRoomsPage() {
  if (!doc) return null;
  let page = doc.getElementById(ROOMS_PAGE_ID);
  if (page) return page;
  const sorella = lastPage();
  if (!sorella?.parentElement) return null;
  page = doc.createElement("section");
  page.className = "page";
  page.id = ROOMS_PAGE_ID;
  page.innerHTML = '<div class="dm-stanze-wrap" id="stanze-wrap"></div>';
  sorella.after(page);
  return page;
}

export function ensureRoomsTab() {
  if (!doc) return null;
  let tab = doc.querySelector(`.tab[data-tab="${ROOMS_TAB}"]`);
  if (tab) return tab;
  const nav = doc.querySelector("nav.tabs");
  if (!nav) return null;
  /* La voce nasce accanto a Temperature: e' la sezione che gia' si legge per
   * stanza, ed e' li' che uno la va a cercare. */
  const before =
    nav.querySelector('.tab[data-tab="temp"]') ||
    nav.querySelector('.tab[data-tab="tapparelle"]') ||
    nav.querySelector('.tab[data-tab="config"]');
  tab = doc.createElement("button");
  tab.className = "tab";
  tab.dataset.tab = ROOMS_TAB;
  tab.id = `tab-${ROOMS_TAB}`;
  /* Il divano, non la casa e non la porta: la casa e' Home, e la porta e'
   * delle Aperture — con tutt'e due le voci in barra, due porte affiancate
   * non si distinguono al volo. Il divano e' il segno delle stanze anche in
   * Home Assistant (mdi:sofa), ed e' lo stesso che la scheda porta in
   * configurazione. */
  tab.innerHTML = `<span class="icon">🛋️</span><span class="text">${esc(t("Stanze", "Rooms"))}</span>`;
  /* Il gestore che il runtime lega alle voci lo lega una volta sola, al
   * caricamento: questa arriva dopo, e il suo tocco se lo deve gestire da se'. */
  tab.addEventListener("click", () => {
    for (const node of doc.querySelectorAll(".tab")) node.classList.remove("active");
    for (const node of doc.querySelectorAll(".page")) node.classList.remove("active");
    tab.classList.add("active");
    ensureRoomsPage()?.classList.add("active");
    root.navigator?.vibrate?.(5);
    schedule();
  });
  if (before) before.before(tab);
  else nav.append(tab);
  return tab;
}

/**
 * Apre la pagina delle Stanze su una stanza precisa.
 *
 * La chiama il blocco delle stanze in plancia (#493): li' una card e' una
 * stanza, e toccarla deve portare dove quella stanza si comanda. La scelta e
 * il cambio di pagina stanno qui perche' stanno qui il resto delle due cose —
 * chi tocca una pastiglia dentro la pagina fa esattamente questo.
 *
 * Torna `false` quando la pagina non c'è ancora: succede prima che il guscio
 * abbia finito di alzarsi, e non è un errore da urlare.
 */
export function apriLaStanza(id) {
  if (!doc) return false;
  const voce = ensureRoomsTab();
  const pagina = ensureRoomsPage();
  if (!voce || !pagina) return false;
  const scelta = clean(id);
  if (scelta) {
    state.room = scelta;
    state.signature = "";
  }
  for (const nodo of doc.querySelectorAll(".tab")) nodo.classList.remove("active");
  for (const nodo of doc.querySelectorAll(".page")) nodo.classList.remove("active");
  voce.classList.add("active");
  pagina.classList.add("active");
  root.navigator?.vibrate?.(8);
  root.scrollTo?.({ top: 0, behavior: "instant" });
  schedule();
  return true;
}

function teachNavVisibility() {
  const previous = root.cdNavVisMap;
  if (typeof previous !== "function" || previous.__dmStanze) return;
  const wrapped = function cdNavVisMap(...args) {
    const map = previous.apply(this, args) || {};
    return { ...map, [ROOMS_TAB]: ROOMS_TAB };
  };
  wrapped.__dmStanze = true;
  wrapped.__dmPrevious = previous;
  root.cdNavVisMap = wrapped;
}

/* ────────────────────────────────── markup ──────────────────────────────── */

export function pillsMarkup(pagine, scelta) {
  return `<nav class="dm-stanze-tabs" aria-label="${esc(t("Stanze", "Rooms"))}">${pagine
    .map((pagina) => {
      const nome = pagina.senzaStanza ? t("Senza stanza", "No room") : pagina.name;
      /* Le stanze la loro icona la tengono come mdi — «mdi:sofa» — e scritta
       * cosi' finiva nella linguetta come parola, sopra il nome. Qui si
       * traduce nel simbolo, che e' quello che il resto della plancia disegna
       * per la stessa stanza. */
      const icona = pagina.senzaStanza ? "📦" : roomGlyph(pagina.icon) || "🏠";
      return `<button type="button" class="sub-tab-btn dm-stanze-tab${
        pagina.id === scelta ? " active" : ""
      }" data-dm-stanza="${esc(pagina.id)}" aria-selected="${pagina.id === scelta}">
        <span class="dm-stanze-tab-icon">${esc(icona)}</span><span>${esc(nome)}</span><small>${pagina.count}</small>
      </button>`;
    })
    .join("")}</nav>`;
}

/* La scena della stanza: accendi tutto, spegni tutto.
 *
 * «Tutto» qui vuol dire la luce. Non il condizionatore e non la tapparella:
 * quelli hanno un verso loro — freddo o caldo, su o giu' — e decidere al posto
 * di chi guarda quale sia «acceso» sarebbe inventare un significato. La riga
 * sotto dice quante luci tocchera', cosi' non e' un tasto al buio. */
export function sceneMarkup(pagina, states) {
  const { totale, accese } = roomSceneSummary(pagina, states);
  if (!totale) return "";
  const quante = totale === 1 ? t("1 luce", "1 light") : t(`${totale} luci`, `${totale} lights`);
  return `<section class="dm-stanze-scena" role="group" aria-label="${esc(t("Scene della stanza", "Room scenes"))}">
    <div class="dm-stanze-scena-kpi">
      <span>${esc(t("Scene", "Scenes"))}</span>
      <b>${accese}/${totale}</b>
      <small>${esc(quante)}</small>
    </div>
    <div class="dm-stanze-scena-btns">
      <button type="button" data-dm-stanza-scena="on">💡 ${esc(t("Accendi tutto", "Turn everything on"))}</button>
      <span class="dm-stanze-scena-div" aria-hidden="true"></span>
      <button type="button" data-dm-stanza-scena="off">🌙 ${esc(t("Spegni tutto", "Turn everything off"))}</button>
    </div>
  </section>`;
}

/* Il clima della stanza non e' un dispositivo: sono i suoi due sensori, che
 * nella configurazione stanno sulla riga della stanza stessa. Per questo la
 * card sta qui e non fra le voci: quelle sono cose dentro la stanza, questa e'
 * la stanza. */
function readingMarkup(pagina, states) {
  /* Una stanza puo' avere piu' di una coppia di sensori.
   *
   * La scheda Temperature lo permette da tempo — «la stessa stanza puo' essere
   * selezionata piu' volte», con un nome per ognuna: il comodino, il termostato
   * a muro, la sonda della veranda. Qui pero' si leggevano solo le due caselle
   * scritte sulla riga della stanza, cioe' la prima coppia: chi ne aveva tre ne
   * vedeva una, e le altre due sembravano non essere mai state configurate.
   *
   * Le associazioni le sa gia' chi le scrive, e si chiedono a lui. */
  const associazioni = temperatureEntries(pagina).filter((voce) => voce.temp || voce.hum);
  if (!associazioni.length) return "";
  const leggi = (entity, coda) => {
    const value = clean(states?.[entity]?.state);
    return value && value !== "unknown" && value !== "unavailable" ? `${value}${coda}` : "—";
  };
  const misura = (entity, etichetta, coda) =>
    entity
      ? `<div><span>${esc(etichetta)}</span><b data-dm-stanza-lettura="${esc(entity)}" data-dm-stanza-coda="${esc(coda)}">${esc(leggi(entity, coda))}</b></div>`
      : "";
  return associazioni
    .map((voce) => {
      /* Col nome suo se ce l'ha: con tre righe uguali non si saprebbe quale
       * sonda sta dicendo cosa. */
      const titolo = clean(voce.name) || clean(pagina.name);
      return `<article class="dm-stanze-card dm-stanze-clima">
    <div class="dm-stanze-card-row">
      <span class="dm-stanze-orb">🌡️</span>
      <span class="dm-stanze-title"><b>${esc(titolo)}</b><s>${esc(t("Sensori della stanza", "Room sensors"))}</s></span>
    </div>
    <div class="dm-stanze-readings">
      ${misura(voce.temp, t("Temperatura", "Temperature"), "°")}
      ${misura(voce.hum, t("Umidità", "Humidity"), "%")}
    </div>
  </article>`;
    })
    .join("");
}

/* Una voce che non e' una luce: nome, stato, e il verso per la sua pagina.
 *
 * Non si comanda da qui. Comandare un condizionatore vuol dire scegliere modo e
 * gradi, comandare una tapparella vuol dire una percentuale: rifarli qui
 * sarebbe rifare due sezioni, e tenerne aggiornate due copie. Il tocco porta
 * dove quella cosa si comanda davvero. */
/* Cosa si accende e si spegne con un tocco, e con quale comando.
 *
 * Una luce, una presa, un ventilatore e un interruttore finto di Home Assistant
 * si comandano tutti allo stesso modo. Il clima e le tapparelle no — hanno modi
 * e posizioni — e per quelli il tocco porta ancora nella sezione, che e' il
 * posto dove si comandano per intero. */
const DOMINI_CHE_SI_TOCCANO = Object.freeze(["light", "switch", "fan", "input_boolean"]);

function siPuoAccendere(entity) {
  /* Il dominio dice che l'entita' SAPREBBE accendersi, non che si POSSA
   * comandare: la riga della stanza costruiva la chiamata a mano, senza
   * passare da `lightCommand`, e una presa marcata «si vede ma non si
   * comanda» si accendeva davvero da qui. Il divieto vale in ogni pagina. */
  return DOMINI_CHE_SI_TOCCANO.includes(clean(entity).split(".")[0]) && siComanda(entity);
}

function accesa(entity, states) {
  return clean(states?.[entity]?.state).toLowerCase() === "on";
}

/* Quello che non si accende: si fa partire (#504).
 *
 * «Si potrebbero inserire le entità personalizzate nelle stanze tipo
 * Automazioni?» Inserirle si poteva già — la tendina della stanza sta su ogni
 * riga in cui l'entità è scritta — ma nella stanza l'automazione diventava una
 * riga che diceva «on» e portava in Home, cioè da nessuna parte utile.
 * Un'automazione, uno script, una scena, un tasto: quello che si vuole fare è
 * FARLI PARTIRE, e adesso hanno il loro tasto qui, accanto al nome.
 *
 * Il verbo non si scrive qui: lo sa `core/comandi-accanto.js`, che lo usa già
 * per i comandi accanto a un dispositivo. In particolare un'automazione si fa
 * partire con «trigger» — «turn_on» la riabilita e basta, e sarebbe un tasto
 * che spegne di nascosto un'automazione di casa invece di eseguirla. */
function siPuoAvviare(entity) {
  return genereDelComando(entity) === "tasto" && siComanda(entity);
}

/* E quello che non si accende e non si fa partire: si sceglie.
 *
 * «Dentro la stanza se metto una entita per vedere solo lo stato usando le mie
 * entita, fa uguale, se premo esce dalla finestra.» Un select — la sorgente
 * dell'ampli, il programma della lavatrice, l'attivita' del telecomando — non
 * ha una levetta e non ha un tasto: ha un elenco di voci, e quello che si
 * vuole fare e' sceglierne una.
 *
 * Il verbo e la domanda le sa gia' `core/comandi-accanto.js`, che un select lo
 * chiama «tendina» da sempre; e l'elenco lo disegna gia' il popup delle azioni
 * rapide. Qui non si inventa niente: si mette il tasto che apre quello.
 *
 * Il «si comanda» resta di qua: e' il divieto «si vede ma non si comanda», che
 * sta nel magazzino di questa casa e non nella tabella dei domini. */
function siPuoScegliere(entity) {
  return puoScegliere(entity) && siComanda(entity);
}

/* La riga di una stanza si comanda da qui, non solo da un'altra pagina.
 *
 * «Le cose che compaiono nella sezione Stanze non sono comandabili: se clicco
 * su luce non fa nulla.» Prima il tocco portava nella sezione e basta — utile
 * per il clima, inutile per una luce, che si accende e si spegne e basta. Adesso
 * quello che si accende ha il suo interruttore qui, e la scritta sotto il nome
 * dice com'e' andata; il resto della riga continua a portare nella sezione, per
 * chi vuole fare di piu'. */
/* Le aperture configurate, per entità (#275).
 *
 * «Le aperture assegnate alle stanze: quando si entra nella sezione stanze e si
 * seleziona la stanza mostra la card dell'apertura ma non permette l'apertura —
 * se si clicca ti porta nella home.» Vero: un'entità assegnata a mano finisce
 * nel blocco «Altro», e quel blocco riporta in Home, che è l'unico posto che le
 * contiene tutte. Per un comando che apre un cancello è la risposta sbagliata:
 * non si vuole andare da nessuna parte, si vuole aprire.
 *
 * La riga di un'apertura porta quindi il segno delle aperture, e da lì in poi
 * è la sezione che le disegna a occuparsene — conferma, PIN e attesa comprese.
 * Nessuno reimplementa niente: si dice solo di chi è quel tocco. */
function aperturePerEntita() {
  const per = new Map();
  try {
    for (const porta of configuredSecurityDoors()) {
      const entita = clean(porta?.entity);
      if (entita) per.set(entita, porta);
    }
  } catch (_error) {}
  return per;
}

function rowMarkup(item, blocco, states, aperture = aperturePerEntita(), sotto = "") {
  const entity = entitaVoce(item);
  const porta = aperture.get(entity);
  if (porta) {
    /* La riga si chiama come il gesto che fa davvero. Diceva «Apri» sempre,
     * ma il tocco esegue il primo gesto della porta, e su una serratura coi
     * due gesti quello e' «Sblocca»: la scritta prometteva una cosa e il dito
     * ne otteneva un'altra. */
    const parola = parolaDelGesto(azioniDellaPorta(porta, states?.[porta.entity])[0]?.gesto);
    return `<article class="dm-stanze-card dm-stanze-voce dm-stanze-apertura" data-dm-door="${esc(porta.id)}" role="button" tabindex="0">
    <div class="dm-stanze-card-row">
      <span class="dm-stanze-orb">${esc(iconaVoce(item, blocco))}</span>
      <span class="dm-stanze-title"><b>${esc(clean(porta.name) || nomeVoce(item, states))}</b><s>${esc(
        porta.pin ? `${parola} — ${t("chiede il PIN", "asks for the PIN")}` : parola,
      )}</s></span>
      <span class="dm-stanze-vai" aria-hidden="true">${porta.pin ? "🔒" : "›"}</span>
    </div>
  </article>`;
  }
  const tocco = siPuoAccendere(entity)
    ? `<button type="button" class="dm-stanze-tocca" data-dm-stanza-tocca="${esc(entity)}" role="switch" aria-checked="${accesa(entity, states) ? "true" : "false"}" aria-label="${esc(nomeVoce(item, states))}"><span class="dm-stanze-tocca-pallino"></span></button>`
    : siPuoAvviare(entity)
      ? /* Il segno è quello che i comandi di un dispositivo portano già altrove:
         * una stella a quattro punte vuol dire «questo si fa partire», e nella
         * plancia vuol dire la stessa cosa dappertutto. */
        `<button type="button" class="dm-stanze-avvia" data-dm-stanza-avvia="${esc(entity)}" aria-label="${esc(
          t("Avvia", "Run"),
        )} ${esc(nomeVoce(item, states))}"><span aria-hidden="true">✦</span></button>`
      : siPuoScegliere(entity)
        ? /* Tre puntini in colonna: e' il segno di «c'e' un elenco», e non la
           * stella di «questo parte adesso». Due gesti diversi non possono
           * portare lo stesso disegno. */
          `<button type="button" class="dm-stanze-avvia dm-stanze-scegli" data-dm-stanza-scegli="${esc(entity)}" aria-label="${esc(
            t("Scegli", "Choose"),
          )} ${esc(nomeVoce(item, states))}"><span aria-hidden="true">⋮</span></button>`
        : blocco.tab
          ? `<span class="dm-stanze-vai" aria-hidden="true">›</span>`
          : "";
  /* Una riga che non porta da nessuna parte non si veste da tasto: niente
   * `role`, niente `tabindex`, niente chevron. Un tasto che non fa niente e'
   * peggio di nessun tasto, e con la tastiera e' anche una fermata in piu' in
   * un giro che non porta a niente. */
  const dove = blocco.tab
    ? ` data-dm-stanza-vai="${esc(blocco.tab)}" role="button" tabindex="0"`
    : "";
  return `<article class="dm-stanze-card dm-stanze-voce" data-dm-stanza-entita="${esc(entity)}"${dove}>
    <div class="dm-stanze-card-row">
      <span class="dm-stanze-orb">${esc(iconaVoce(item, blocco))}</span>
      <span class="dm-stanze-title"><b>${esc(nomeVoce(item, states))}</b><s data-dm-stanza-stato="${esc(entity)}" data-dm-stanza-blocco="${esc(blocco.key)}">${esc(statoVoce(item, states, blocco.key))}</s></span>
      ${tocco}
    </div>
    ${sotto}
  </article>`;
}

/* I comandi veri dentro la card della stanza (#467).
 *
 * «The media player card must have media player functions, the climate card
 * must have climate control functions.» La riga della stanza diceva com'e'
 * messa una cosa e portava alla sua sezione: per una luce basta — c'e'
 * l'interruttore — e per una cassa o un condizionatore no, perche' quello che
 * si vuole fare li' e' mettere in pausa e alzare di un grado, non leggere.
 *
 * Niente comandi nuovi: sono gli stessi della pagina Musica e della finestra
 * del Clima, e i loro gestori stanno sul documento — quindi funzionano anche
 * qui senza che nessuno li riattacchi. La riga resta la riga di tutte le
 * altre: i comandi si aggiungono sotto, non al posto suo. */
function comandiDellaVoce(item, blocco, states) {
  const entity = entitaVoce(item);
  if (!entity) return "";
  if (blocco.key === "media") {
    const riga = letturaDelLettore(
      { entity, nome: nomeVoce(item, states) },
      states,
      root.resolveEntity || ((valore) => valore),
    );
    return riga.muto ? "" : comandiMediaMarkup(riga);
  }
  /* Il clima non passa piu' di qui: nella stanza c'e' la card della pagina
   * Clima (#11), che i comandi ce li ha suoi — il meno, il piu', lo
   * spegnimento e il tasto che apre i modi. Il pannello qui dentro era il modo
   * di dare comandi a una riga che comandi non ne aveva. */
  return "";
}

/* Dove si comanda davvero ogni tipo di cosa. */
const TAB_DI = Object.freeze({
  clima: "clima",
  luci: "luci",
  prese: "prese",
  coperture: "tapparelle",
  elettrodomestici: "appliances-main",
  /* Stessa storia dei lettori (#405): «se cliccato rimanda alla home della
   * dashboard». La pagina Musica ce l'hanno, ed e' li' che si comanda. */
  media: "media",
  /* Le telecamere adesso si aprono da sole, sopra la stanza (#503): questa
   * riga resta come ripiego per quando il guscio non sa aprirne una — una
   * telecamera cancellata dalla configurazione, per dire. La Sicurezza e'
   * comunque meglio della Home, che era dove si finiva prima: li' non c'e'
   * nessuna telecamera. */
  telecamere: "security",
  carichi: "energy",
  robot: "robot",
  irrigazione: "irrigazione",
  /* Un'entita' assegnata a mano non ha una pagina sua, e per un anno il tocco
   * l'ha riportata in Home. «L'unico posto che le contiene tutte» era il modo
   * gentile di dire «da nessuna parte»: chi premeva perdeva la stanza in cui
   * stava e non trovava niente in cambio, perche' in Home quella riga non c'e'.
   *
   * E' lo stesso difetto gia' corretto tre volte — le aperture (#275), i
   * lettori (#405), le telecamere (#503) — e ogni volta la cura e' stata dare
   * una destinazione vera. Qui una destinazione vera non c'e', e allora non ci
   * si va: la riga resta una riga, si legge, e quello che ha da comandare lo
   * comanda con la levetta, la stella o i puntini che ha accanto.
   *
   * Vuoto e non «home»: lo legge `blockMarkup`, e una riga senza dove non si
   * disegna nemmeno come un tasto. */
  altro: "",
});

export function blockMarkup(blocco, states) {
  if (!blocco.voci.length) return "";
  /* Un genere che la tabella non conosce non si manda in Home per ripiego:
   * si lascia senza dove, che e' la verita'. Mandare in Home chi non sa dove
   * andare e' stato per un anno il difetto piu' segnalato di questa pagina. */
  const conTab = { ...blocco, tab: TAB_DI[blocco.key] ?? "" };
  /* Il clima ha la sua card, ed e' quella della pagina Clima (#11): «la tessera
   * del clima nella stanza ha uno stile diverso da quella della pagina Clima».
   * Non una somigliante — la stessa funzione, chiamata da qui — senza la riga
   * della stanza, che dentro la stanza direbbe il nome che c'e' gia' in cima.
   *
   * Un'unita' che la configurazione del clima non conosce non ce l'ha: quella
   * resta una riga come tutte le altre, che e' la verita' su quello che sa la
   * plancia di lei. */
  if (blocco.key === "clima") {
    const aperture = aperturePerEntita();
    const carte = blocco.voci
      .map((item) => {
        const propria = laCardDelClima(entitaVoce(item), { stanza: false });
        return propria || rowMarkup(item, conTab, states, aperture);
      })
      .join("");
    return `<h2 class="dm-stanze-h"><span>${esc(nomeBlocco(blocco))}</span><span class="dm-stanze-n">${blocco.voci.length}</span></h2>
    <div class="dm-stanze-grid dm-stanze-grid-clima">${carte}</div>`;
  }
  const card =
    blocco.key === "luci" || blocco.key === "prese"
      ? blocco.voci
          .map((luce) => {
            const entity = clean(luce.entity || luce.id);
            return pageCardMarkup(
              lightView(entity, {
                name: clean(luce.name),
                state: states?.[entity],
                comandabile: siComanda(entity),
              }),
            );
          })
          .join("")
      : (() => {
          /* La mappa delle aperture si legge una volta per blocco: prima la
           * rifaceva ogni riga, e con dieci righe erano dieci letture della
           * stessa configurazione. */
          const aperture = aperturePerEntita();
          return blocco.voci
            .map((item) =>
              rowMarkup(item, conTab, states, aperture, comandiDellaVoce(item, conTab, states)),
            )
            .join("");
        })();
  return `<h2 class="dm-stanze-h"><span>${esc(nomeBlocco(blocco))}</span><span class="dm-stanze-n">${blocco.voci.length}</span></h2>
    <div class="dm-stanze-grid">${card}</div>`;
}

/* ── l'indice: le stanze, un piano alla volta (#17) ──────────────────────── */

/* «Rooms must be displayed in groups based on the selected floor, with the
 * room icon and name centered. Small icons should appear on the card to
 * indicate the status or count of lights, climate control, power outlets,
 * alerts, doors, windows, and temperature.»
 *
 * La pagina Stanze si apriva su UNA stanza, con la fila delle linguette in
 * cima. Con cinque stanze funziona; con venti — ed e' il caso che teneva
 * aperta anche la #12, «via il limite di 8 stanze» — la fila diventa uno
 * scorrimento orizzontale in cui si cerca il nome. Adesso la pagina si apre
 * sull'elenco, diviso per piano, e la stanza si apre toccandola.
 *
 * Le pastiglie sulla tessera non sono dati nuovi: e' tutta roba che la pagina
 * sa gia' per ogni stanza, e che prima si poteva leggere solo entrandoci. Qui
 * e' disegno; quali pastiglie merita una stanza lo dice il nucleo. */

/* I piani della casa nell'ordine in cui stanno, quando il guscio lo sa. */
function iPiani() {
  try {
    const nomi = root.cdFloorNames?.();
    return Array.isArray(nomi) ? nomi.map(clean).filter(Boolean) : [];
  } catch (_error) {
    return [];
  }
}

const statoDi = (entity, states) => clean(states?.[clean(entity)]?.state);

const SI_COMANDA_ACCESO = /^(on|playing|cleaning)$/i;
const CLIMA_ACCESO = /^(heat|cool|auto|dry|fan_only|heat_cool)$/i;
/* Una porta che non e' chiusa. «Aperta» per una serratura vuol dire sbloccata,
 * e per un cancello a meta' corsa vuol dire in movimento: tutte e tre sono la
 * stessa notizia — non e' chiusa — ed e' quella che si vuole da fuori. */
const VARCO_APERTO = /^(open|opening|closing|unlocked|on)$/i;

/* Quante cose di un blocco sono accese adesso. */
function acceseNelBlocco(pagina, chiave, states, prova) {
  const blocco = (pagina?.blocchi || []).find((voce) => voce.key === chiave);
  if (!blocco) return 0;
  let quante = 0;
  for (const voce of blocco.voci) {
    const entity = entitaVoce(voce);
    if (entity && prova(statoDi(entity, states), entity)) quante += 1;
  }
  return quante;
}

/* Le tapparelle e le finestre aperte, col verso giusto: chi ha un contatto che
 * dice ON da chiuso l'ha gia' dichiarato una volta per tutta la plancia. */
function varchiAperti(pagina, states, girati) {
  return acceseNelBlocco(pagina, "coperture", states, (stato, entity) => {
    const aperto = apertaSecondoVerso(windowOpenFromState(stato), girati.has(entity));
    return aperto === true;
  });
}

/* Le porte e i cancelli di questa stanza che non sono chiusi. Non stanno in un
 * blocco loro — una porta arriva dov'e' stata assegnata — quindi si guardano
 * tutte le voci della stanza e si tengono quelle che la sezione Apri porte
 * conosce. */
function porteAperte(pagina, states, aperture) {
  let quante = 0;
  for (const blocco of pagina?.blocchi || [])
    for (const voce of blocco.voci) {
      const entity = entitaVoce(voce);
      if (!entity || !aperture.has(entity)) continue;
      if (VARCO_APERTO.test(statoDi(entity, states))) quante += 1;
    }
  return quante;
}

/* Cosa non risponde, in questa stanza. E' lo stesso «non risponde» della
 * tessera di casa (#33) — solo `unavailable`, non `unknown` — perche' due idee
 * di «offline» nella stessa plancia divergono al primo caso strano. */
function muteNellaStanza(pagina, states) {
  let quante = 0;
  for (const blocco of pagina?.blocchi || [])
    for (const voce of blocco.voci) {
      const entity = entitaVoce(voce);
      if (entity && nonRisponde(statoDi(entity, states))) quante += 1;
    }
  return quante;
}

/* I gradi della stanza: la prima sonda configurata, che e' quella che la
 * stanza porta sulla sua riga. Le altre stanno nella stanza aperta, dove c'e'
 * lo spazio per dire quale sonda e'. */
function gradiDellaStanza(pagina, states) {
  const prima = temperatureEntries(pagina).find((voce) => clean(voce.temp));
  const valore = Number.parseFloat(statoDi(prima?.temp, states).replace(",", "."));
  return Number.isFinite(valore) ? valore : null;
}

/** Quello che una stanza ha da dire da fuori, gia' contato. */
export function contiDellaStanza(pagina, states, aperture = aperturePerEntita()) {
  const girati = insiemeInvertiti(readJson(CHIAVE_VERSI, []));
  return {
    luci: roomSceneSummary(pagina, states).accese,
    prese: acceseNelBlocco(pagina, "prese", states, (stato) => SI_COMANDA_ACCESO.test(stato)),
    clima: acceseNelBlocco(pagina, "clima", states, (stato) => CLIMA_ACCESO.test(stato)),
    finestre: varchiAperti(pagina, states, girati),
    porte: porteAperte(pagina, states, aperture),
    mute: muteNellaStanza(pagina, states),
    gradi: gradiDellaStanza(pagina, states),
  };
}

function tuttiIConti(pagine, states) {
  const aperture = aperturePerEntita();
  const conti = {};
  for (const pagina of pagine) conti[pagina.id] = contiDellaStanza(pagina, states, aperture);
  return conti;
}

/* La parola di una pastiglia, per chi ascolta invece di guardare. Il numero da
 * solo non dice di cosa: «3» sotto una lampadina si capisce con gli occhi e
 * non con le orecchie. */
function paroleDellaPastiglia(pastiglia) {
  const uno = pastiglia.conto === 1;
  if (pastiglia.chiave === "gradi") return t("temperatura", "temperature");
  if (pastiglia.chiave === "luci")
    return uno ? t("luce accesa", "light on") : t("luci accese", "lights on");
  if (pastiglia.chiave === "prese")
    return uno ? t("presa accesa", "socket on") : t("prese accese", "sockets on");
  if (pastiglia.chiave === "clima")
    return uno ? t("unità accesa", "unit on") : t("unità accese", "units on");
  if (pastiglia.chiave === "finestre")
    return uno ? t("finestra aperta", "window open") : t("finestre aperte", "windows open");
  if (pastiglia.chiave === "porte")
    return uno ? t("porta aperta", "door open") : t("porte aperte", "doors open");
  return uno ? t("non risponde", "not answering") : t("non rispondono", "not answering");
}

function pastigliaMarkup(pastiglia) {
  const testo =
    pastiglia.chiave === "gradi"
      ? `${Math.round(pastiglia.valore)}°`
      : String(pastiglia.conto);
  const parola = paroleDellaPastiglia(pastiglia);
  const dentro = `<i aria-hidden="true">${esc(pastiglia.icona)}</i><b>${esc(testo)}</b>
      <span class="dm-stanze-pill-voce">${esc(parola)}</span>`;
  const comuni = `class="dm-stanze-pill" data-dm-stanza-pill="${esc(pastiglia.chiave)}"
      data-dm-comanda="${esc(pastiglia.comanda)}"`;
  /* Quella che comanda e' un tasto vero (#17, parte 3): con la tastiera ci si
   * arriva, e chi ascolta sente che e' una cosa che si preme. Le altre sono
   * scritte, e il tocco scivola sulla tessera, che porta dentro. */
  if (pastiglia.comanda !== "spegni")
    return `<span ${comuni} title="${esc(`${testo} ${parola}`)}">${dentro}</span>`;
  return `<button type="button" ${comuni} data-dm-stanza-spegni="${esc(pastiglia.chiave)}"
      title="${esc(`${testo} ${parola}`)}" aria-label="${esc(
        `${t("Spegni", "Turn off")} · ${testo} ${parola}`,
      )}">${dentro}</button>`;
}

/* ── la domanda e l'annulla, sulla tessera ───────────────────────────────── */

/* Quanti e come si chiamano, per la frase della domanda. */
function paroleDaSpegnere(chiave, quante) {
  const uno = quante === 1;
  if (chiave === "prese") return uno ? t("presa", "socket") : t("prese", "sockets");
  return uno ? t("luce", "light") : t("luci", "lights");
}

function vivo(momento) {
  return Boolean(momento) && Number(momento.fino) > Date.now();
}

/* Il velo nero sulla tessera: la domanda, oppure l'annulla dopo il fatto.
 *
 * Uno solo alla volta, e sempre lo stesso posto: due riquadri che si
 * contendono la stessa tessera sarebbero due cose da leggere nello stesso
 * punto. */
function veloDellaTessera(pagina, conti) {
  const chiesta = state.chiesta;
  if (vivo(chiesta) && chiesta.stanza === pagina.id) {
    const quante = Math.max(1, Number(conti?.[chiesta.chiave]) || 0);
    const frase = `${t("Spengo", "Turn off")} ${quante} ${paroleDaSpegnere(chiesta.chiave, quante)}?`;
    return `<div class="dm-stanze-velo" data-dm-stanza-velo="chiesta">
        <span>${esc(frase)}</span>
        <button type="button" data-dm-stanza-conferma="${esc(chiesta.chiave)}">${esc(
          t("Spegni", "Turn off"),
        )}</button>
      </div>`;
  }
  const annulla = state.annulla;
  if (vivo(annulla) && annulla.stanza === pagina.id)
    return `<div class="dm-stanze-velo" data-dm-stanza-velo="annulla">
        <span>${esc(t("Spente", "Turned off"))}</span>
        <button type="button" data-dm-stanza-annulla>${esc(t("Annulla", "Undo"))}</button>
      </div>`;
  return "";
}

function tesseraDellaStanza(pagina, conti) {
  const nome = pagina.senzaStanza ? t("Senza stanza", "No room") : pagina.name;
  const icona = pagina.senzaStanza ? "📦" : roomGlyph(pagina.icon) || "🏠";
  const pastiglie = pastiglieDellaStanza(conti).map(pastigliaMarkup).join("");
  return `<article class="dm-stanze-tessera" data-dm-stanza="${esc(pagina.id)}" role="button" tabindex="0"
      aria-label="${esc(nome)}">
      <span class="dm-stanze-tessera-ic" aria-hidden="true">${esc(icona)}</span>
      <strong class="dm-stanze-tessera-nome">${esc(nome)}</strong>
      ${pastiglie ? `<span class="dm-stanze-pills">${pastiglie}</span>` : ""}
      ${veloDellaTessera(pagina, conti)}
    </article>`;
}

function gruppoMarkup(gruppo, conti) {
  const accese = acceseNelPiano(gruppo, conti);
  /* Zero non si scrive: «tutto spento» e' la stessa cosa detta bene, ed e' la
   * risposta che uno cerca guardando le scale. */
  const riassunto = accese
    ? `${accese} ${accese === 1 ? t("accesa", "on") : t("accese", "on")}`
    : t("tutto spento", "all off");
  /* Le stanze a cui nessuno ha detto il piano si intitolano anche loro, quando
   * i piani ci sono: un gruppo muto in fondo a un elenco diviso si legge come
   * «queste stanno nel piano qui sopra», che e' il contrario di quello che
   * dice. */
  const nome = gruppo.piano || t("Senza piano", "No floor");
  const testa = gruppo.intitolare
    ? `<h2 class="dm-stanze-piano"><span>🏠 ${esc(nome)}</span><small>${esc(riassunto)}</small></h2>`
    : "";
  return `${testa}<div class="dm-stanze-indice-griglia">${gruppo.stanze
    .map((pagina) => tesseraDellaStanza(pagina, conti[pagina.id] || {}))
    .join("")}</div>`;
}

/** L'elenco delle stanze, diviso per piano: e' la pagina quando non c'e' una stanza aperta. */
export function indiceMarkup(pagine, states = {}) {
  const conti = tuttiIConti(pagine, states);
  const gruppi = stanzePerPiano(pagine, { piani: iPiani() });
  const quante = pagine.length === 1 ? t("una stanza", "one room") : `${pagine.length} ${t("stanze", "rooms")}`;
  const piani = gruppi.filter((gruppo) => gruppo.intitolare && gruppo.piano).length;
  const sopra = piani > 1 ? `${piani} ${t("piani", "floors")} · ${quante}` : quante;
  return `<header class="dm-stanze-indice-testa">
      <h1>${esc(t("Le stanze", "The rooms"))}</h1><small>${esc(sopra)}</small>
    </header>
    ${gruppi.map((gruppo) => gruppoMarkup(gruppo, conti)).join("")}`;
}

export function roomPageMarkup(pagine, scelta, states = {}) {
  if (!pagine.length)
    return `<div class="ed-empty dm-stanze-empty">${esc(
      t(
        "Nessuna stanza configurata. Aggiungile dalla scheda Stanze dell'editor: da lì ogni sezione può assegnare le sue entità.",
        "No rooms configured yet. Add them from the editor's Rooms tab: every section can then assign its entities to one.",
      ),
    )}</div>`;
  /* Senza una stanza scelta si vede l'elenco (#17): e' il punto di partenza
   * della pagina, e da li' si entra. La fila delle linguette resta dentro la
   * stanza aperta, dove serve a saltare alla successiva senza tornare
   * indietro — sull'elenco direbbe due volte la stessa cosa. */
  if (!clean(scelta)) return indiceMarkup(pagine, states);
  const pagina = pickRoomPage(pagine, scelta);
  const blocchi = pagina.blocchi.map((blocco) => blockMarkup(blocco, states)).join("");
  const vuota = blocchi
    ? ""
    : `<div class="dm-stanze-empty">${esc(
        t(
          "Questa stanza non ha ancora niente. L'assegnazione si fa nella scheda di ogni sezione.",
          "Nothing here yet. Entities are assigned from each section's own tab.",
        ),
      )}</div>`;
  const indietro = `<button type="button" class="dm-stanze-indietro" data-dm-stanze-indice>
      <span aria-hidden="true">←</span> ${esc(t("Le stanze", "The rooms"))}</button>`;
  return `${indietro}${pillsMarkup(pagine, pagina.id)}${sceneMarkup(pagina, states)}${readingMarkup(pagina, states)}${blocchi}${vuota}`;
}

/* ─────────────────────────────────── paint ──────────────────────────────── */

function signature(pagine, scelta, states) {
  return [
    scelta,
    pagine
      .map((pagina) =>
        [
          pagina.id,
          pagina.name,
          pagina.count,
          /* Non solo quante cose ci sono: anche QUALI.
           *
           * Contando soltanto si perdevano i cambi che non cambiano il
           * numero — una tapparella rinominata, un'entita' sostituita, una
           * cosa spostata in un'altra stanza mentre un'altra ne prende il
           * posto: la pagina restava con il nome vecchio, e toccandolo si
           * andava sull'entita' vecchia, fino a un ricaricamento. */
          pagina.blocchi
            .map(
              (blocco) =>
                `${blocco.key}:${blocco.voci
                  .map((voce) => `${clean(voce?.id || voce?.entity || voce?.name)}`)
                  .join("+")}`,
            )
            .join(","),
        ].join("~"),
      )
      .join("|"),
    lightsSignature(
      roomSceneEntities(pickRoomPage(pagine, scelta)).map((entity) =>
        lightView(entity, { state: states?.[entity], comandabile: siComanda(entity) }),
      ),
    ),
    /* Sull'elenco cambia tutto quello che le pastiglie dicono, e non e' niente
     * di quello che sta qui sopra: una luce spenta in un'altra stanza non
     * cambia ne' il conto delle cose ne' le luci della stanza aperta, ma
     * cambia la sua tessera. Si prende l'impronta dei conti, e solo quando
     * l'elenco e' davvero quello che si vede. */
    clean(scelta) ? "" : JSON.stringify(tuttiIConti(pagine, states)),
    /* E il velo aperto su una tessera: la domanda e l'annulla nascono e
     * muoiono senza che cambi nessuno stato della casa. */
    [state.chiesta?.stanza, state.chiesta?.chiave, state.annulla?.stanza, state.annulla?.chiave]
      .map((voce) => voce || "")
      .join("~"),
  ].join("§");
}

export function renderRoomsPage() {
  return paint();
}

function paint() {
  const wrap = doc?.getElementById("stanze-wrap");
  if (!wrap) return;
  /* Questo giro costruisce il modello di ogni stanza, legge gli stati della
   * casa e ne prende l'impronta: con la pagina chiusa e' tutto lavoro per una
   * pagina che nessuno ha davanti, e passava a ogni mazzetto di stati. Al
   * ritorno sulla linguetta si ridipinge (vedi `quandoSiCambiaPagina`). */
  if (!paginaVisibile(ROOMS_PAGE_ID)) return;
  const pagine = roomPages();
  const states = allStates();
  /* La stanza scelta resta scelta solo finche' esiste: una stanza cancellata
   * riporta all'elenco, che e' la verita' su dov'e' finita. Qui prima si
   * prendeva la prima della lista — era l'unico modo di avere una pagina —
   * e adesso l'elenco c'e' (#17). */
  if (state.room && !pagine.some((pagina) => pagina.id === state.room)) state.room = "";
  const firma = signature(pagine, state.room, states);
  if (firma !== state.signature) {
    state.signature = firma;
    wrap.innerHTML = roomPageMarkup(pagine, state.room, states);
    /* Le card del clima nascono spente: il disegno porta i trattini, i numeri
     * li mette chi dipinge. E' lo stesso mestiere e lo stesso codice della
     * pagina Clima (#11), chiamato sul pezzo di documento che questa passata ha
     * appena scritto. */
    dipingiLeCardDelClima(wrap);
    return;
  }
  /* Struttura uguale: si riscrivono solo i valori. Rifare l'HTML a ogni giro
   * spegnerebbe il dito posato su un cursore e farebbe ripartire ogni
   * animazione da capo. */
  for (const node of wrap.querySelectorAll("[data-dm-stanza-lettura]")) {
    const entity = node.getAttribute("data-dm-stanza-lettura");
    const valore = clean(states?.[entity]?.state);
    /* L'unita' la porta la riga che l'ha disegnata. Prima si deduceva
     * confrontando l'entita' con l'umidita' della stanza: con piu' coppie di
     * sensori quel confronto sbagliava tutte le righe tranne la prima, e le
     * umidita' delle altre uscivano in gradi. */
    const coda = node.getAttribute("data-dm-stanza-coda") || "°";
    const testo =
      valore && valore !== "unknown" && valore !== "unavailable" ? `${valore}${coda}` : "—";
    if (node.textContent !== testo) node.textContent = testo;
  }
  for (const node of wrap.querySelectorAll("[data-dm-stanza-stato]")) {
    const testo = statoVoce(
      { entity: node.getAttribute("data-dm-stanza-stato") },
      states,
      node.getAttribute("data-dm-stanza-blocco") || "",
    );
    if (node.textContent !== testo) node.textContent = testo;
  }
  /* E i gradi delle card del clima, che non sono un `textContent` ma una barra,
   * una legenda e un colore: li rimette chi li sa mettere. */
  dipingiLeCardDelClima(wrap);
}

function repaint() {
  state.frame = 0;
  ensureRoomsPage();
  teachNavVisibility();
  ensureRoomsTab();
  paint();
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(repaint) || root.setTimeout?.(repaint, 0) || 0;
}

/* ─────────────────────────────────── ascolto ────────────────────────────── */

/* ── spegnere una stanza da fuori (#17, parte 3) ─────────────────────────── */

/* Cosa si spegne, in quella stanza, premendo quella pastiglia. Le luci le
 * conta gia' la scena della stanza — e' la stessa domanda — e le prese sono
 * quelle del loro blocco che rispondono e sono accese. */
function cosaSiSpegne(pagina, chiave, states) {
  if (chiave === "luci")
    return roomSceneEntities(pagina).filter((entity) => {
      const vista = lightView(entity, {
        state: states[entity],
        comandabile: siComanda(entity),
      });
      return vista.on && vista.available;
    });
  const blocco = (pagina?.blocchi || []).find((voce) => voce.key === chiave);
  return (blocco?.voci || [])
    .map((voce) => entitaVoce(voce))
    .filter(
      (entity) =>
        entity && siComanda(entity) && SI_COMANDA_ACCESO.test(statoDi(entity, states)),
    );
}

/* Accende o spegne un elenco di entita', ognuna col comando che la sua specie
 * capisce: una luce si spegne con `light.turn_off`, una presa con quello del
 * suo dominio. Il lucchetto l'hanno gia' tolto di mezzo i due filtri sopra. */
function commuta(entita, acceso, states) {
  for (const entity of entita) {
    if (entity.startsWith("light.")) {
      const vista = lightView(entity, {
        state: states[entity],
        comandabile: siComanda(entity),
      });
      chiamaServizio(lightCommand(vista, { power: acceso }));
      continue;
    }
    const dominio = entity.split(".")[0];
    chiamaServizio({
      domain: dominio,
      service: acceso ? "turn_on" : "turn_off",
      data: { entity_id: entity },
    });
  }
}

/* Il timer che fa sparire la domanda o l'annulla quando scade. Uno solo: i due
 * veli non convivono, e due timer vorrebbero dire due risvegli a rimuovere
 * ognuno il velo dell'altro. */
function fraQuanto(quanto) {
  root.clearTimeout?.(state.sveglia);
  state.sveglia = root.setTimeout?.(() => {
    state.sveglia = 0;
    state.signature = "";
    schedule();
  }, quanto + 40);
}

/* «Spengo 3 luci?»: il tocco chiede, non fa.
 *
 * «Una tessera che finora si toccava per ENTRARE diventa una tessera con sette
 * bersagli dentro, e il tocco sbagliato spegne le luci a chi voleva solo
 * guardare.» La domanda e' la risposta a quel rischio, e costa un tocco in
 * piu' solo a chi voleva spegnere davvero. */
function chiediDiSpegnere(stanza, chiave) {
  state.annulla = null;
  state.chiesta = { stanza, chiave, fino: Date.now() + QUANTO_DURA_LA_DOMANDA };
  root.navigator?.vibrate?.(8);
  fraQuanto(QUANTO_DURA_LA_DOMANDA);
  state.signature = "";
  schedule();
}

function spegniDavvero(stanza, chiave) {
  const states = allStates();
  const pagina = pickRoomPage(roomPages(), stanza);
  const entita = cosaSiSpegne(pagina, chiave, states);
  commuta(entita, false, states);
  root.navigator?.vibrate?.(15);
  state.chiesta = null;
  /* L'annulla si ricorda COSA ha spento, non «rimetti com'era»: rimettere
   * com'era vorrebbe dire uno scatto di tutta la stanza, e in mezzo secondo
   * la casa e' gia' cambiata da sola. Queste sono le entita' che ha toccato
   * lui, e sono le sole che deve rimettere a posto. */
  state.annulla = { stanza, chiave, entita, fino: Date.now() + QUANTO_DURA_L_ANNULLA };
  fraQuanto(QUANTO_DURA_L_ANNULLA);
  state.signature = "";
  schedule();
}

function riaccendi() {
  const annulla = state.annulla;
  state.annulla = null;
  root.clearTimeout?.(state.sveglia);
  state.sveglia = 0;
  if (annulla?.entita?.length) {
    commuta(annulla.entita, true, allStates());
    root.navigator?.vibrate?.(8);
  }
  state.signature = "";
  schedule();
}

function runScene(on) {
  const states = allStates();
  const pagina = pickRoomPage(roomPages(), state.room);
  root.navigator?.vibrate?.(15);
  for (const entity of roomSceneEntities(pagina)) {
    const view = lightView(entity, { state: states[entity], comandabile: siComanda(entity) });
    if (view.on === on || !view.available) continue;
    chiamaServizio(lightCommand(view, { power: on }));
  }
  state.signature = "";
  schedule();
}

/* Portare nella sezione non basta: bisogna arrivare sulla cosa.
 *
 * Il tocco su una riga cambiava pagina e finiva li'. In una casa con dodici
 * condizionatori vuol dire scaricare chi guarda in cima a un elenco e lasciarlo
 * cercare quello che aveva appena toccato — «mi rimanda alla sezione clima ma
 * non all'entita', quindi cosi' non serve a niente». Detto giusto.
 *
 * Dopo il cambio di pagina si apre la cosa: il clima ha il suo popup per
 * entita', e per il resto si cerca la scheda che porta quell'entita' addosso e
 * si tocca quella. Se non si trova niente resta il comportamento di prima —
 * la sezione aperta — che e' comunque meglio di restare dov'eravamo.
 *
 * Il rinvio di un fotogramma non e' pigrizia: la pagina di destinazione si
 * disegna quando diventa attiva, e cercare la scheda un istante prima vuol dire
 * cercarla in una pagina ancora vuota. */
function apriLaVoce(entity) {
  if (!entity || !doc) return false;
  const prova = () => {
    if (typeof root.apriClimaPopup === "function" && entity.startsWith("climate.")) {
      try {
        root.apriClimaPopup(entity);
        return true;
      } catch (_errore) {}
    }
    const scheda = doc.querySelector(
      `.page.active [data-appliance-id="${CSS.escape(entity)}"],` +
        `.page.active [data-dm-lucip="${CSS.escape(entity)}"],` +
        `.page.active [data-entity="${CSS.escape(entity)}"],` +
        `.page.active [data-dm-entita="${CSS.escape(entity)}"]`,
    );
    if (!scheda) return false;
    scheda.scrollIntoView?.({ block: "center", behavior: "smooth" });
    scheda.click?.();
    return true;
  };
  root.requestAnimationFrame?.(() => {
    if (!prova()) root.setTimeout?.(prova, 220);
  }) || root.setTimeout?.(prova, 0);
  return true;
}

/* La telecamera di questa entita' fra quelle configurate (#503).
 *
 * Torna l'indice oltre alla riga perche' il guscio nomina le telecamere con
 * `camSlug(cam, i)`, e quell'`i` e' la posizione nella lista: senza, per una
 * telecamera senza entita' il nome verrebbe fuori diverso da quello che il
 * guscio ha scritto sulla sua scheda, e la finestra si aprirebbe vuota. */
export function telecameraDellEntita(entity, lista) {
  const cercata = clean(entity);
  if (!cercata.startsWith("camera.")) return null;
  const righe = Array.isArray(lista) ? lista : [];
  const indice = righe.findIndex(
    (riga) => clean(riga?.entity || riga?.camera_entity) === cercata,
  );
  return indice < 0 ? null : { indice, riga: righe[indice] };
}

/* Una telecamera della stanza si apre da sola (#503).
 *
 * «Se vado su stanze e c'è una telecamera e ci clicco sopra dovrebbe aprire
 * solo quella e non puntare sulla scheda dove ci sono tutte le telecamere. Se
 * poi torno indietro non torna sulla stanza dov'ero.»
 *
 * Le due metà sono la stessa cosa: portare nella Sicurezza vuol dire uscire
 * dalla stanza, e chi esce poi deve ritrovarla. La finestra della singola
 * telecamera il guscio la apre già dalla scheda Telecamere — qui non se ne
 * disegna una seconda, si chiede la sua — e una finestra sopra la stanza la
 * stanza non la fa sparire: si chiude, e si è ancora lì.
 *
 * Se il guscio non c'è, o la telecamera in configurazione non c'è, non si
 * inventa niente: torna `false` e il tocco riprende la strada di prima. */
function apriLaTelecamera(entity) {
  if (typeof root.apriCamera !== "function" || typeof root.camSlug !== "function") return false;
  let lista = [];
  try {
    lista = root.getCameras?.() || [];
  } catch (_errore) {
    return false;
  }
  const trovata = telecameraDellEntita(entity, lista);
  if (!trovata) return false;
  try {
    const nome = clean(trovata.riga?.name) || clean(entity).split(".")[1];
    root.apriCamera(root.camSlug(trovata.riga, trovata.indice), nome.toUpperCase());
    return true;
  } catch (_errore) {
    return false;
  }
}

function handleClick(event) {
  /* Il tocco su un'apertura è di chi le disegna: qui si sta soltanto in
   * disparte, come già si fa per l'interruttore dentro la riga. Senza questo
   * la riga porterebbe altrove mentre la conferma si apre. */
  if (event.target?.closest?.("[data-dm-door]")) return;
  /* Il tasto che torna all'elenco (#17). Sta prima di tutto: e' dentro la
   * stanza aperta, e da li' in poi nessun'altra regola lo riguarda. */
  if (event.target?.closest?.("[data-dm-stanze-indice]")) {
    state.room = "";
    state.signature = "";
    root.navigator?.vibrate?.(8);
    root.scrollTo?.({ top: 0, behavior: "instant" });
    schedule();
    return;
  }
  /* Le pastiglie che comandano, e i due tasti del velo (#17, parte 3). Stanno
   * PRIMA della tessera che le contiene: senza uscire qui, ogni tocco su una
   * pastiglia aprirebbe anche la stanza. */
  const spegni = event.target?.closest?.("[data-dm-stanza-spegni]");
  if (spegni) {
    event.preventDefault();
    event.stopPropagation();
    chiediDiSpegnere(
      clean(spegni.closest("[data-dm-stanza]")?.dataset.dmStanza),
      clean(spegni.dataset.dmStanzaSpegni),
    );
    return;
  }
  const conferma = event.target?.closest?.("[data-dm-stanza-conferma]");
  if (conferma) {
    event.preventDefault();
    event.stopPropagation();
    spegniDavvero(
      clean(conferma.closest("[data-dm-stanza]")?.dataset.dmStanza),
      clean(conferma.dataset.dmStanzaConferma),
    );
    return;
  }
  if (event.target?.closest?.("[data-dm-stanza-annulla]")) {
    event.preventDefault();
    event.stopPropagation();
    riaccendi();
    return;
  }
  /* Le altre pastiglie non comandano: il tocco scivola sulla tessera, che
   * porta dentro. E' la stessa regola detta nel nucleo — una pastiglia che a
   * volte comanda e a volte no sarebbe peggio di due disegni diversi. */
  const pillola = event.target?.closest?.("[data-dm-stanza]");
  if (pillola) {
    state.room = pillola.getAttribute("data-dm-stanza") || "";
    state.signature = "";
    root.navigator?.vibrate?.(8);
    schedule();
    return;
  }
  const scena = event.target?.closest?.("[data-dm-stanza-scena]");
  if (scena) {
    runScene(scena.getAttribute("data-dm-stanza-scena") === "on");
    return;
  }
  /* L'interruttore prima della riga: sta dentro la riga, e la riga porta
   * altrove — senza questo, accendere una luce cambiava pagina. */
  const tocca = event.target?.closest?.("[data-dm-stanza-tocca]");
  if (tocca) {
    event.preventDefault();
    event.stopPropagation();
    const entity = clean(tocca.getAttribute("data-dm-stanza-tocca"));
    if (!entity) return;
    const domain = entity.split(".")[0];
    const acceso = accesa(entity, allStates());
    root.navigator?.vibrate?.(8);
    chiamaServizio({
      domain,
      service: acceso ? "turn_off" : "turn_on",
      data: { entity_id: entity },
    });
    /* L'interruttore si muove subito, senza aspettare che Home Assistant
     * ritorni lo stato: chi tocca deve vedere qualcosa muoversi. Non si
     * ridisegna qui — ridisegnare adesso rileggerebbe lo stato vecchio e lo
     * rimetterebbe com'era, che da fuori si legge «non ha fatto niente». Il
     * ridisegno arriva col cambio di stato, e allora o conferma o corregge. */
    tocca.setAttribute("aria-checked", acceso ? "false" : "true");
    return;
  }
  /* Il tasto che fa partire un'automazione, uno script, una scena (#504). Come
   * l'interruttore qui sopra: il tocco e' suo, non della riga — senza, far
   * partire un'automazione cambierebbe pagina. */
  const avvia = event.target?.closest?.("[data-dm-stanza-avvia]");
  if (avvia) {
    event.preventDefault();
    event.stopPropagation();
    const entity = clean(avvia.getAttribute("data-dm-stanza-avvia"));
    const comando = entity && siComanda(entity) ? comandoDelDispositivo({ entity }) : null;
    if (!comando) return;
    root.navigator?.vibrate?.(8);
    chiamaServizio(comando);
    return;
  }
  /* E il tasto che apre l'elenco di un select. Come i due qui sopra: il tocco
   * e' suo, non della riga.
   *
   * L'elenco lo disegna il popup delle azioni rapide, che le voci di un select
   * le sa gia' leggere e scrivere. Chiamarlo da qui vuol dire che la finestra
   * e' una sola: due elenchi della stessa cosa, disegnati in due posti, dopo
   * un po' dicono due cose diverse. */
  const scegli = event.target?.closest?.("[data-dm-stanza-scegli]");
  if (scegli) {
    event.preventDefault();
    event.stopPropagation();
    const entity = clean(scegli.getAttribute("data-dm-stanza-scegli"));
    if (!entity || !siComanda(entity)) return;
    root.navigator?.vibrate?.(8);
    apriIlMenu(entity);
    return;
  }
  /* Un tocco su un comando non e' un tocco sulla card (#467): i tasti del
   * lettore e il pannello del clima stanno DENTRO la riga, e la riga porta
   * altrove. Senza questo, mettere in pausa cambiava pagina. Chi esegue quei
   * comandi e' il gestore della loro sezione, che ascolta sul documento. */
  if (event.target?.closest?.("[data-dm-mp],[data-dm-w-panel]")) return;
  const vai = event.target?.closest?.("[data-dm-stanza-vai]");
  if (vai) {
    const entita = clean(vai.getAttribute("data-dm-stanza-entita"));
    /* La telecamera si apre sopra la stanza, senza cambiare pagina (#503). */
    if (apriLaTelecamera(entita)) return;
    const tab = doc?.querySelector?.(`.tab[data-tab="${vai.getAttribute("data-dm-stanza-vai")}"]`);
    tab?.click?.();
    apriLaVoce(entita);
  }
}

export function installRoomsPageSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  ensureRoomsPage();
  teachNavVisibility();
  ensureRoomsTab();
  doc.addEventListener("click", handleClick);
  doc.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    /* E la tessera di una stanza sull'elenco (#17): ha `role="button"` e sta
     * nel giro della tastiera, quindi Invio e spazio devono aprirla come il
     * dito. Un bersaglio raggiungibile che non risponde e' una fermata in un
     * giro che non porta a niente. */
    if (event.target?.closest?.("[data-dm-stanza-vai],.dm-stanze-tessera")) handleClick(event);
  });
  for (const name of ["render", "cdApplyNavVis"])
    wrapFunction(name, "__dmRoomsPageSection", schedule);
  quandoSiCambiaPagina(schedule);
  for (const event of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:config-reset",
  ])
    root.addEventListener?.(event, schedule);
  schedule();
}

function installStyles() {
  installStyle(
    "dm-stanze-style",
    `
      #page-stanze .dm-stanze-wrap{box-sizing:border-box;width:100%;max-width:var(--dm-page-room,none);margin:0 auto;padding:0 4px 18px;display:grid;gap:10px}

      /* Le pillole sono quelle di Temperature: stessa forma, stesso font, stesso
       * conteggio. Due modi di disegnare la stessa cosa sarebbero due cose. */
      /* Lo spazio dentro il nastro e la fila che va a capo col mouse non stanno
       * piu' qui: sono la stessa regola dei periodi e degli impianti, e adesso
       * ce l'ha in mano le-strisce-di-linguette-section.js per tutt'e tre. */
      #page-stanze .dm-stanze-tabs{display:flex;align-items:center;gap:10px;width:100%;margin:2px 0 0;padding-left:2px;padding-right:2px;overflow-x:auto;scrollbar-width:none}
      #page-stanze .dm-stanze-tabs::-webkit-scrollbar{display:none}
      #page-stanze .dm-stanze-tab{font-family:inherit;display:inline-flex;align-items:center;gap:8px;flex:0 0 auto;min-height:44px;padding:9px 16px;border:1.5px solid var(--divider-color,#dbe4ee);border-radius:100px;background:var(--card-bg,#fff);color:var(--text-dim,#64748b);font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;cursor:pointer;box-shadow:0 8px 20px -12px rgba(15,23,42,.28)}
      #page-stanze .dm-stanze-tab.active{border-color:color-mix(in srgb,var(--primary-color,#0ea5e9) 46%,transparent);background:color-mix(in srgb,var(--primary-color,#0ea5e9) 12%,var(--card-bg,#fff));color:var(--primary-color,#0284c7)}
      #page-stanze .dm-stanze-tab>span:not(.dm-stanze-tab-icon){max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #page-stanze .dm-stanze-tab-icon{display:grid;place-items:center;width:24px;height:24px;font-size:20px;line-height:1}
      #page-stanze .dm-stanze-tab small{display:grid;place-items:center;min-width:19px;height:19px;padding:0 5px;border-radius:999px;background:color-mix(in srgb,currentColor 15%,transparent);font-size:9px;font-weight:900}

      /* La scena, nella forma della fascia di Luci: la lettura a sinistra, i due
       * comandi in un solo controllo segmentato. */
      #page-stanze .dm-stanze-scena{display:flex;align-items:stretch;gap:10px;flex-wrap:wrap;margin:2px 0 4px}
      #page-stanze .dm-stanze-scena-kpi{display:flex;flex-direction:column;justify-content:center;gap:1px;min-width:118px;padding:10px 17px;border:1px solid var(--divider-color,#dbe4ee);border-radius:18px;background:var(--card-bg,#fff);box-shadow:0 12px 28px -22px rgba(15,23,42,.5)}
      #page-stanze .dm-stanze-scena-kpi>span{font-size:9px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
      #page-stanze .dm-stanze-scena-kpi>b{font-size:17px;font-weight:900;letter-spacing:-.2px;color:var(--text,#0f172a)}
      #page-stanze .dm-stanze-scena-kpi>small{font-size:10px;font-weight:800;letter-spacing:.5px;color:var(--secondary-text-color,#94a3b8)}
      #page-stanze .dm-stanze-scena-btns{display:flex;align-items:stretch;flex:1 1 260px;border:1px solid var(--divider-color,#dbe4ee);border-radius:18px;background:var(--card-bg,#fff);box-shadow:0 12px 28px -22px rgba(15,23,42,.5);overflow:hidden}
      #page-stanze .dm-stanze-scena-btns button{flex:1 1 0;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 16px;border:0;background:transparent;cursor:pointer;font:inherit;font-size:12px;font-weight:800;letter-spacing:.5px;color:var(--secondary-text-color,#64748b);transition:color .25s ease,background .25s ease}
      #page-stanze .dm-stanze-scena-btns button[data-dm-stanza-scena="on"]:hover{color:#b45309;background:color-mix(in srgb,#f59e0b 14%,transparent)}
      #page-stanze .dm-stanze-scena-btns button[data-dm-stanza-scena="off"]:hover{color:var(--text,#0f172a);background:color-mix(in srgb,#64748b 12%,transparent)}
      #page-stanze .dm-stanze-scena-btns button:active{transform:scale(.97)}
      #page-stanze .dm-stanze-scena-div{width:1px;margin:9px 0;background:var(--divider-color,#dbe4ee)}

      #page-stanze .dm-stanze-h{display:flex;align-items:center;gap:10px;margin:12px 2px 0;color:var(--secondary-text-color,#64748b);font-size:11px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase}
      #page-stanze .dm-stanze-h::after{content:"";flex:1 1 auto;height:1px;background:linear-gradient(90deg,var(--divider-color,#dbe4ee),transparent)}
      #page-stanze .dm-stanze-n{flex:0 0 auto;order:0;padding:2px 9px;border:1px solid var(--divider-color,#dbe4ee);border-radius:999px;font-size:10px;letter-spacing:.6px}

      #page-stanze .dm-stanze-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(min(258px,100%),1fr))}
      /* L'elenco delle stanze (#17): la testata, i piani, e la tessera con le
         sue pastiglie. La tessera e' grande — si tocca per entrare — e le
         pastiglie sotto sono larghe 44 punti, che e' la misura del pollice:
         dalla #17 in poi alcune comandano, e un bersaglio piccolo su una cosa
         che spegne le luci e' un difetto, non un dettaglio. */
      #page-stanze .dm-stanze-indice-testa{display:flex;align-items:baseline;gap:10px;
        margin:2px 2px 14px;flex-wrap:wrap}
      #page-stanze .dm-stanze-indice-testa h1{margin:0;font-size:22px;font-weight:900;
        letter-spacing:-.4px;color:var(--text,#0f172a)}
      #page-stanze .dm-stanze-indice-testa small{color:var(--secondary-text-color,#64748b);
        font-size:12px;font-weight:800;letter-spacing:.4px}
      #page-stanze .dm-stanze-piano{display:flex;align-items:baseline;gap:10px;
        margin:18px 2px 10px;font-size:13px;font-weight:900;letter-spacing:.6px;
        text-transform:uppercase;color:var(--text,#0f172a)}
      #page-stanze .dm-stanze-piano small{margin-left:auto;font-size:11px;font-weight:800;
        letter-spacing:.6px;color:var(--secondary-text-color,#94a3b8);text-transform:none}
      #page-stanze .dm-stanze-indice-griglia{display:grid;gap:12px;
        grid-template-columns:repeat(auto-fit,minmax(min(258px,100%),1fr))}
      #page-stanze .dm-stanze-tessera{position:relative;display:grid;gap:10px;
        justify-items:center;padding:18px 14px 14px;cursor:pointer;
        border:1px solid var(--divider-color,#dbe4ee);border-radius:22px;
        background:linear-gradient(180deg,var(--card-bg,#fff) 0%,color-mix(in srgb,#94a3b8 4%,var(--card-bg,#fff)) 100%);
        box-shadow:0 16px 32px -24px rgba(15,23,42,.45);
        transition:transform .16s ease,box-shadow .16s ease}
      #page-stanze .dm-stanze-tessera:active{transform:scale(.985)}
      #page-stanze .dm-stanze-tessera:focus-visible{outline:2px solid var(--primary-color,#0ea5e9);
        outline-offset:3px}
      #page-stanze .dm-stanze-tessera-ic{font-size:34px;line-height:1}
      #page-stanze .dm-stanze-tessera-nome{font-size:16px;font-weight:900;letter-spacing:-.2px;
        text-align:center;color:var(--text,#0f172a)}
      #page-stanze .dm-stanze-pills{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;
        width:100%}
      #page-stanze .dm-stanze-pill{display:inline-flex;align-items:center;gap:5px;
        min-height:44px;min-width:44px;justify-content:center;padding:0 12px;
        border:1px solid var(--divider-color,#e2e8f0);border-radius:999px;
        background:var(--surface-2,#f8fafc);color:var(--text,#0f172a);
        font-size:13px;font-weight:800;line-height:1}
      #page-stanze .dm-stanze-pill i{font-style:normal;font-size:15px}
      /* La parola sta nel titolo e per chi ascolta, non a schermo: sulla
         tessera ci stanno il segno e il numero, e sette parole in fila
         sarebbero un paragrafo. */
      #page-stanze .dm-stanze-pill-voce{position:absolute;width:1px;height:1px;overflow:hidden;
        clip-path:inset(50%);white-space:nowrap}
      /* Il velo della domanda e quello dell'annulla (#17, parte 3): nero, sopra
         la tessera, e va via da solo. Uno solo alla volta — due riquadri che si
         contendono lo stesso posto sarebbero due cose da leggere nello stesso
         punto — e il tasto e' largo quanto le pastiglie, per la stessa ragione
         per cui sono larghe cosi'. */
      #page-stanze .dm-stanze-velo{position:absolute;inset:0;z-index:2;
        display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;
        padding:12px;border-radius:22px;text-align:center;
        background:rgba(15,23,42,.96);color:#f8fafc;
        font-size:14px;font-weight:800;letter-spacing:-.1px;
        animation:dm-stanze-velo .16s ease-out}
      @keyframes dm-stanze-velo{from{opacity:0}to{opacity:1}}
      #page-stanze .dm-stanze-velo button{min-height:44px;padding:0 16px;cursor:pointer;
        border:0;border-radius:999px;background:#f8fafc;color:#0f172a;
        font:inherit;font-weight:900;letter-spacing:.2px}
      #page-stanze .dm-stanze-velo button:active{transform:scale(.96)}
      #page-stanze .dm-stanze-velo[data-dm-stanza-velo="annulla"]{background:rgba(15,23,42,.86)}
      @media(prefers-reduced-motion:reduce){
        #page-stanze .dm-stanze-velo{animation:none}
        #page-stanze .dm-stanze-tessera{transition:none}
      }
      #page-stanze .dm-stanze-indietro{display:inline-flex;align-items:center;gap:8px;
        min-height:44px;margin:0 2px 10px;padding:0 14px;cursor:pointer;
        border:1px solid var(--divider-color,#e2e8f0);border-radius:999px;
        background:var(--surface-2,#f8fafc);color:var(--text,#0f172a);
        font-size:13px;font-weight:800;letter-spacing:.3px}
      #page-stanze .dm-stanze-indietro:active{transform:scale(.97)}
      /* Il clima tiene la griglia a tutte le larghezze (#11): sopra i 900px la
         griglia delle stanze diventa una fila flessibile, e le sue misure sono
         scritte per la card delle stanze. Quella del clima e' un'altra card — e'
         quella della pagina Clima — e in quella fila resterebbe senza larghezza,
         stretta quanto il suo contenuto. */
      #page-stanze .dm-stanze-grid-clima{display:grid!important;
        grid-template-columns:repeat(auto-fit,minmax(min(258px,100%),1fr))}
      #page-stanze .dm-stanze-card{position:relative;display:grid;align-content:start;overflow:hidden;border:1px solid var(--divider-color,#dbe4ee);border-radius:22px;background:linear-gradient(180deg,var(--card-bg,#fff) 0%,color-mix(in srgb,#94a3b8 4%,var(--card-bg,#fff)) 100%);box-shadow:0 16px 32px -24px rgba(15,23,42,.45)}
      #page-stanze .dm-stanze-card-row{display:flex;align-items:center;gap:12px;padding:14px}
      #page-stanze .dm-stanze-orb{display:grid;place-items:center;flex:0 0 auto;width:50px;height:50px;border-radius:17px;background:linear-gradient(160deg,var(--secondary-background-color,#eef3f8),color-mix(in srgb,#94a3b8 14%,var(--secondary-background-color,#eef3f8)));font-size:24px;line-height:1}
      #page-stanze .dm-stanze-title{display:grid;gap:2px;min-width:0;flex:1 1 auto}
      #page-stanze .dm-stanze-title b{font-size:15px;font-weight:900;letter-spacing:-.2px;overflow-wrap:anywhere}
      #page-stanze .dm-stanze-title s{text-decoration:none;font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--secondary-text-color,#94a3b8)}
      #page-stanze .dm-stanze-voce{cursor:pointer}
      #page-stanze .dm-stanze-voce:active{transform:scale(.985)}
      #page-stanze .dm-stanze-vai{flex:0 0 auto;color:var(--secondary-text-color,#cbd5e1);font-size:20px;font-weight:900;line-height:1}
      /* L'interruttore della riga: lo stesso della pagina Luci, cosi' chi lo
         vede qui sa gia' cos'e' e come si tocca. */
      #page-stanze .dm-stanze-tocca{flex:0 0 auto;display:inline-flex;align-items:center;width:50px;height:30px;padding:3px;border:0;border-radius:999px;background:var(--divider-color,#cbd5e1);cursor:pointer;transition:background .18s ease}
      #page-stanze .dm-stanze-tocca[aria-checked="true"]{background:var(--primary-color,#0ea5e9)}
      #page-stanze .dm-stanze-tocca-pallino{width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(15,23,42,.28);transition:transform .18s ease}
      #page-stanze .dm-stanze-tocca[aria-checked="true"] .dm-stanze-tocca-pallino{transform:translateX(20px)}
      #page-stanze .dm-stanze-tocca:focus-visible{outline:2px solid var(--primary-color,#0ea5e9);outline-offset:2px}
      @media (prefers-reduced-motion:reduce){
        #page-stanze .dm-stanze-tocca,#page-stanze .dm-stanze-tocca-pallino{transition:none}
      }
      /* Il tasto che fa partire (#504): un'automazione, uno script, una scena.
         Tondo come l'interruttore accanto e della stessa altezza, cosi' le
         righe di una stanza restano tutte alte uguale — una che si accende e
         una che si fa partire sono due gesti diversi, non due righe diverse. */
      #page-stanze .dm-stanze-avvia{
        flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;
        width:30px;height:30px;padding:0;border:1px solid var(--card-border,#e8edf3);
        border-radius:50%;background:var(--surface-2,#f8fafc);color:var(--primary-color,#0ea5e9);
        font-size:14px;line-height:1;cursor:pointer;transition:background .18s ease,border-color .18s ease}
      #page-stanze .dm-stanze-avvia:hover{
        border-color:var(--primary-color,#0ea5e9);
        background:color-mix(in srgb,var(--primary-color,#0ea5e9) 10%,var(--surface-2,#f8fafc))}
      #page-stanze .dm-stanze-avvia:active{transform:scale(.94)}
      #page-stanze .dm-stanze-avvia:focus-visible{outline:2px solid var(--primary-color,#0ea5e9);outline-offset:2px}
      /* Il tasto che apre l'elenco di un menu a tendina: lo stesso tondo, lo
         stesso posto, perche' una riga alta uguale all'altra e' meta' del
         mestiere. Cambia solo il disegno dentro — tre puntini invece della
         stella — e i tre puntini sono stretti e alti: alla misura della
         stella si vedono come un granello. */
      #page-stanze .dm-stanze-scegli{font-size:19px;font-weight:900;letter-spacing:0}
      @media (prefers-reduced-motion:reduce){
        #page-stanze .dm-stanze-avvia{transition:none}
        #page-stanze .dm-stanze-avvia:active{transform:none}
      }
      /* I comandi veri dentro la card (#467): il pannello del clima e la
         pulsantiera del lettore arrivano gia' vestiti da chi li disegna — sono
         gli stessi della Home e della finestra del Clima — e qui si dice solo
         dove stanno. Stessa rientranza delle letture qui sotto, cosi' i tasti
         si incolonnano col nome della voce invece di attaccarsi al bordo. */
      #page-stanze .dm-stanze-card > .dm-w-panel,
      #page-stanze .dm-stanze-card > .dm-mp-comandi{padding:0 14px 14px}
      #page-stanze .dm-stanze-readings{display:flex;gap:20px;padding:0 14px 14px}
      #page-stanze .dm-stanze-readings div{display:grid;gap:2px}
      #page-stanze .dm-stanze-readings span{font-size:9px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
      #page-stanze .dm-stanze-readings b{font-size:26px;font-weight:900;letter-spacing:-.5px;color:var(--text,#0f172a)}
      #page-stanze .dm-stanze-empty{margin:8px 2px;padding:18px;border:1px dashed var(--divider-color,#cfdae7);border-radius:16px;color:var(--secondary-text-color,#94a3b8);font-size:12.5px;font-weight:700;text-align:center;line-height:1.5}

      @media(min-width:900px){
        #page-stanze .dm-stanze-grid{display:flex;flex-wrap:wrap}
        #page-stanze .dm-stanze-card,#page-stanze .dm-lucip-card{flex:1 1 272px;max-width:384px}
        #page-stanze .dm-stanze-scena-btns{flex:0 1 560px}
      }
      @media(max-width:560px){
        #page-stanze .dm-stanze-grid{grid-template-columns:1fr}
        #page-stanze .dm-stanze-scena-btns button{padding:11px 10px}
      }
    `,
  );
}
