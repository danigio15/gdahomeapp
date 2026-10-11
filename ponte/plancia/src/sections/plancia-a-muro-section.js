/* La plancia a muro, sul tablet.
 *
 * Quando il config di questa plancia dice «a muro» (`cd_muro`, vedi
 * `core/plancia-a-muro.js`) e la casa e' Premium, la pagina si copre con un
 * pannello a tutto schermo: una schermata sola, comandi grandi, niente menu.
 * Le linguette in alto — o il dito che scorre — passano da una pagina
 * all'altra; un tocco su una card apre la sua finestra grande; dopo qualche
 * minuto senza tocchi resta l'orologio.
 *
 * ── Da dove vengono le cose ─────────────────────────────────────────────────
 *
 * Stanze, luci, clima, tapparelle, azioni e centrale le prende dalla plancia
 * di origine — di solito la principale — chiedendone il config al ponte. Gli
 * stati e i comandi passano dalla stessa presa di Home Assistant di tutta la
 * plancia: il tablet non ha un'altra strada.
 *
 * ── Premium ─────────────────────────────────────────────────────────────────
 *
 * La casa non chiude niente da se': i lucchetti di Base li mettono l'app e il
 * browser (docs/LICENZE.md). Questo e' uno di quelli: il pannello si accende
 * solo se il ponte dice che gdahome e' Premium. Con Base la plancia resta
 * quella di sempre, e il config a muro resta scritto per il giorno dopo. */
import {
  ALARM_DISARM,
  ALARM_MODES,
  alarmActiveModeWithCustom,
  alarmCodeNeeded,
  alarmVisibleModes,
} from "../core/alarm-panel.js";
import {
  chiamataDelModo,
  ilCodiceApreIlModo,
  ilModoChiedeIlCodice,
  normalizzaModiSuMisura,
} from "../core/antifurto-su-misura.js";
import { ingressiDellaCentrale } from "../core/le-zone-della-centrale.js";
import { varchiDiCasa } from "../core/varchi-di-casa.js";
import {
  FONDO_DELLA_CARTA,
  GRANA_DELLA_CARTA,
  OMBRA_DELLA_CARTA,
} from "../core/le-vesti-della-carta.js";
import { climaScalda } from "../core/device-model.js";
import { oggettoWidget } from "../core/oggetti-widget.js";
import { IN_VISTA_KEY } from "../core/state-event-gate.js";
import {
  comandoDelLettore,
  compagniDelGruppo,
  ilTastoCentrale,
  servizioDelGruppo,
  letturaDelLettore,
  orologio as orologioDelBrano,
  posizioneOra,
} from "../core/media-player.js";
import {
  CHIAVE_MURO,
  avvisiAccesi,
  derivaDelRiposo,
  comandiDellaPagina,
  eCompatto,
  eNotte,
  eUnaScena,
  MODELLI_ELENCO,
  ambientiDellaFonte,
  energiaDellaPagina,
  fonteDaiValori,
  grigliaDellaPagina,
  lettoriDellaPagina,
  postiDellaPagina,
  telecamereDellaFonte,
  fonteDalleSezioni,
  muroPulito,
  pinGiusto,
  scala,
  temaDelMomento,
  verso,
} from "../core/plancia-a-muro.js";
import { kioskAttivo, setKioskMode } from "./beta12-room-color-lock-section.js";
import { bridgeRequest, currentProfile } from "./config-persistence-section.js";
import { loadCameraFrame } from "./live-ui-section.js";
import {
  allStates,
  chiamaServizio,
  clean,
  doc,
  esc,
  installStyle,
  lexicalGlobal,
  locale,
  readJson,
  root,
  scriviSeCambia,
  section,
  wrapFunction,
  senzaCadere,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_PLANCIA_A_MURO__";
const ID = "dm-muro";
const state = (root[KEY] ||= {
  installed: false,
  muro: null,
  fonte: null,
  fonteDi: "",
  fonteLetta: 0,
  premium: null,
  premiumLetto: 0,
  pagina: 0,
  toccato: Date.now(),
  riposo: false,
  finestra: null,
  uscito: false,
  trascina: null,
  inAttesa: {},
  pressione: null,
  swipe: null,
});

/* ── Premium e fonte, chiesti al ponte ───────────────────────────────────── */

const MEZZ_ORA = 30 * 60 * 1000;

/** La casa e' Premium? Si chiede al ponte, e la risposta vale mezz'ora. */
/* ── l'avvio diretto ──────────────────────────────────────────────────────
 *
 * «Non ho capito perche' parte vuota, si vede la plancia classica e poi
 * carica quella: devi togliere questa doppia cosa e partire direttamente con
 * la plancia wall.» Il pannello aspettava due risposte del ponte — la licenza
 * e la plancia di origine — e intanto il velo d'avvio si toglieva sulla
 * plancia classica. Adesso:
 * - quello che il tablet ha saputo l'ultima volta (la licenza, la fonte) si
 *   tiene sul tablet, e il pannello si disegna subito con quello; le risposte
 *   nuove arrivano dopo e lo aggiornano;
 * - se il tablet sa gia' che questa plancia e' a muro, il velo d'avvio aspetta
 *   che il pannello abbia deciso, al massimo quattro secondi. */
const RICORDO = "dm_muro_ricordo";
const ATTESA_DEL_VELO = 4000;

function ricordo() {
  return readJson(RICORDO, null) || {};
}
function ricorda(cosa) {
  try {
    root.localStorage?.setItem(RICORDO, JSON.stringify({ ...ricordo(), ...cosa }));
  } catch (_errore) {}
}

/* Il velo d'avvio aspetta il pannello: la bandiera la guarda il guscio prima
 * di dichiarare la plancia dipinta (`section-runtime.js`). */
export const ATTESA_KEY = "__DM_MURO_DECIDE__";
let decidi = null;
function trattieniIlVelo() {
  const muro = muroPulito(readJson(CHIAVE_MURO, null));
  if (!muro.attiva || !muro.pagine.length || ricordo().premium === false) return;
  root[ATTESA_KEY] = new Promise((fatto) => {
    decidi = () => {
      decidi = null;
      root[ATTESA_KEY] = null;
      fatto();
    };
    root.setTimeout?.(() => decidi?.(), ATTESA_DEL_VELO);
  });
}
const lasciaIlVelo = () => decidi?.();

export async function premiumDellaCasa({ forza = false } = {}) {
  /* Le prove e chi incolla la plancia fuori dal ponte lo dicono da se'. */
  if (typeof root.__GDAHOME_PREMIUM__ === "boolean") {
    state.premium = root.__GDAHOME_PREMIUM__;
    return state.premium;
  }
  if (!forza && state.premium !== null && Date.now() - state.premiumLetto < MEZZ_ORA)
    return state.premium;
  let premium = false;
  try {
    const stato = await bridgeRequest("ponte/licenza/stato", {});
    premium = stato?.gdahome?.attiva === true;
  } catch (_errore) {
    /* Il ponte non risponde: si tiene quello che si sapeva. */
    premium = state.premium === true;
  }
  state.premium = premium;
  state.premiumLetto = Date.now();
  ricorda({ premium });
  return premium;
}

const UN_MINUTO = 60 * 1000;

/** Le cose della plancia di origine, gia' pronte per il tablet. */
export async function fonteDelMuro(muro, { forza = false } = {}) {
  const di = muro?.fonte || "primary";
  /* La plancia stessa si legge dal deposito di qui, che e' gia' in mano:
   * niente da tenere da parte, e una luce aggiunta e ripristinata da un altro
   * telefono si vede al ripristino, non cinque minuti dopo. */
  if (
    !forza &&
    !fonteEQui(di) &&
    state.fonte &&
    state.fonteDi === di &&
    Date.now() - state.fonteLetta < UN_MINUTO
  )
    return state.fonte;
  let fonte = null;
  if (root.__DM_MURO_FONTE__ && typeof root.__DM_MURO_FONTE__ === "object")
    fonte = fonteDaiValori(root.__DM_MURO_FONTE__);
  else if (fonteEQui(di)) fonte = fonteDiQui();
  else {
    try {
      const letto = await bridgeRequest("dashboardmodern/config/get", { profile: di });
      fonte = fonteDaiValori(letto?.snapshot?.values || {});
    } catch (_errore) {
      fonte = state.fonte;
    }
  }
  state.fonte = fonte || fonteDiQui();
  state.fonteDi = di;
  state.fonteLetta = Date.now();
  ricorda({ fonte: state.fonte, fonteDi: di });
  return state.fonte;
}

const fonteEQui = (di) =>
  !root.__DM_MURO_FONTE__ && (di === currentProfile() || !root.__DASHBOARDMODERN_HOSTED__);

/* La plancia stessa come fonte: quando il tablet legge da se'. */
function fonteDiQui() {
  return fonteDalleSezioni(
    {
      rooms: section("rooms", []),
      lights: section("lights", []),
      climate: section("climate", []),
      covers: section("covers", []),
      cameras: section("cameras", []),
    },
    {
      azioni: readJson("cd_quick_actions", []),
      persone: readJson("cd_people", []),
      centrali: readJson("cd_centrali", []),
      overrides: readJson("cd_entity_overrides", {}),
      avvisi: readJson("cd_avvisi_custom", []),
      climaUnita: readJson("cd_clima_units", []),
      lettori: readJson("cd_media_player", []),
      antifurtoModi: readJson("cd_antifurto_modi", []),
      antifurtoSuMisura: readJson("cd_antifurto_su_misura", []),
      varchi: readJson("cd_varchi", {}),
      invertiti: readJson("cd_stati_invertiti", []),
    },
  );
}

/* ── piccole letture ─────────────────────────────────────────────────────── */

/* Quello che il tablet sta mostrando: ogni entita' letta mentre si disegna, e
 * i domini che si guardano tutti insieme (le finestre aperte, il meteo, le
 * persone). Il cancello degli stati lo chiede per sapere cosa far passare
 * subito (`state-event-gate.js`): le luci della principale non stanno nella
 * configurazione di questa plancia, e senza questa domanda i loro cambi
 * arrivavano solo al battito. */
let raccolta = null;
let inVista = { ids: new Set(), domini: new Set() };
const segna = (id) => {
  if (raccolta && id) raccolta.ids.add(String(id));
};
const segnaDominio = (d) => raccolta?.domini.add(d);
export function eInVista(id) {
  const muro = state.muro;
  if (!muro?.attiva || state.premium !== true || state.uscito) return false;
  const chiave = String(id || "");
  if (inVista.ids.has(chiave) || inVista.domini.has(chiave.split(".")[0])) return true;
  /* Le aree dell'antifurto si guardano sempre: una che scatta sveglia il
   * tablet anche se la pagina aperta non la mostra. */
  if (state.fonte?.centrali?.includes(chiave)) return true;
  return Boolean(muro.risveglio?.attivo && muro.risveglio.entita === chiave);
}

const stato = (id) => {
  segna(id);
  return allStates()?.[id] || null;
};
const attributi = (id) => stato(id)?.attributes || {};
const dominio = (id) => String(id || "").split(".")[0];
const accesoVero = (id) =>
  ["on", "open", "opening", "heat", "cool", "heat_cool", "auto", "dry", "fan_only"].includes(
    String(stato(id)?.state),
  );
/* Acceso o spento come lo si vede: il tocco sul tablet cambia la card subito,
 * prima che Home Assistant risponda; la risposta vera prende il suo posto
 * appena arriva (`confermaLeAttese`). */
const acceso = (id) =>
  typeof state.inAttesa[id]?.acceso === "boolean" ? state.inAttesa[id].acceso : accesoVero(id);
const numero = (valore) => {
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};
const decimale = (valore, cifre = 1) =>
  numero(valore) === null
    ? "—"
    : Number(valore).toLocaleString(locale(), {
        minimumFractionDigits: 0,
        maximumFractionDigits: cifre,
      });
const nomeDi = (id, scelto = "", fonte = state.fonte) => {
  if (clean(scelto)) return clean(scelto);
  const dispositivo = [
    ...(fonte?.luci || []),
    ...(fonte?.clima || []),
    ...(fonte?.tapparelle || []),
  ].find((d) => d.entity === id);
  return clean(dispositivo?.name) || clean(attributi(id).friendly_name) || id;
};
let progressivo = 0;
const disegno = (chiave, misura, dove) =>
  oggettoWidget(chiave, "", `muro-${dove || progressivo++}`).replace(
    'class="dm-oggetto"',
    `class="dm-oggetto" style="width:${misura}px;height:${misura}px"`,
  );
const azioneDi = (nome, fonte = state.fonte) =>
  (fonte?.azioni || []).find((a) => a.name === nome) || null;

const ACCENTI = Object.freeze({
  luce: "#f59e0b",
  clima: "#0ea5e9",
  tapparella: "#8b5cf6",
  azione: "#10b981",
  sicurezza: "#10b981",
  allarme: "#e11d48",
});

/* Il disegno di un'azione: quello scelto, o uno che le somiglia dal nome. */
function disegnoDellAzione(azione, scelto = "") {
  if (clean(scelto)) return clean(scelto);
  const nome = String(azione?.name || "").toLowerCase();
  const indizi = [
    [/buongiorno|mattin|sveglia|morning/, "meteo"],
    [/esco|uscit|leave|away|fuori/, "aperture"],
    [/rientr|arriv|casa|home|torno/, "home"],
    [/cena|pranz|cucin|dinner|lunch/, "cottura"],
    [/cinema|film|tv|relax|musica|movie/, "media"],
    [/notte|buonanotte|night|dorm/, "sicurezza"],
    [/luc|light/, "luci"],
  ];
  return indizi.find(([re]) => re.test(nome))?.[1] || "azioni";
}

/* ── i comandi verso Home Assistant ──────────────────────────────────────── */

function comanda(domain, service, data) {
  try {
    chiamaServizio({ domain, service, data });
  } catch (_errore) {}
  if (root.navigator?.vibrate) root.navigator.vibrate(8);
}

/* Far partire un'azione della plancia di origine: lo stesso servizio che
 * sceglierebbe la plancia per quell'entita'. */
export function servizioDellAzione(azione) {
  if (!azione || !eUnaScena(azione)) return null;
  const id = clean(azione.entity);
  const d = dominio(id);
  if (d === "scene" || d === "script")
    return { domain: d, service: "turn_on", data: { entity_id: id } };
  if (d === "button" || d === "input_button")
    return { domain: d, service: "press", data: { entity_id: id } };
  if ((d === "select" || d === "input_select") && azione.option)
    return { domain: d, service: "select_option", data: { entity_id: id, option: azione.option } };
  if (d === "lock") return { domain: d, service: "unlock", data: { entity_id: id } };
  return { domain: "homeassistant", service: "toggle", data: { entity_id: id } };
}

function eseguiAzione(nome, { conferma = false } = {}) {
  const azione = azioneDi(nome);
  const servizio = servizioDellAzione(azione);
  if (!servizio) return;
  if ((conferma || azione.confirm) && state.finestra?.tipo !== "conferma") {
    apriFinestra({ tipo: "conferma", azione: nome });
    return;
  }
  chiudiFinestra();
  comanda(servizio.domain, servizio.service, servizio.data);
  state.attiva = nome;
  disegna();
}

/* Il tasto «apri» dell'ingresso: cancello, porta, serratura. */
export function servizioDiApertura(id) {
  const d = dominio(id);
  if (d === "button" || d === "input_button") return { domain: d, service: "press" };
  if (d === "lock") return { domain: d, service: "unlock" };
  if (d === "cover") return { domain: d, service: "open_cover" };
  if (d === "script" || d === "scene") return { domain: d, service: "turn_on" };
  return { domain: "homeassistant", service: "turn_on" };
}

/* Il tocco su una card «entita'»: il gesto giusto per il suo dominio. Quello
 * che non si comanda — un sensore, una persona, il meteo — non fa niente, e la
 * card lo mostra e basta. */
const SI_ACCENDONO = new Set([
  "switch",
  "input_boolean",
  "fan",
  "automation",
  "humidifier",
  "siren",
  "light",
  "group",
  "cover",
  "valve",
  "water_heater",
  "remote",
]);
export function servizioDellEntita(id, statoAttuale = "") {
  const d = dominio(id);
  if (d === "scene" || d === "script") return { domain: d, service: "turn_on" };
  if (d === "button" || d === "input_button") return { domain: d, service: "press" };
  if (d === "lock") return { domain: d, service: statoAttuale === "locked" ? "unlock" : "lock" };
  if (d === "media_player") return { domain: d, service: "media_play_pause" };
  if (d === "vacuum")
    return { domain: d, service: statoAttuale === "cleaning" ? "return_to_base" : "start" };
  if (SI_ACCENDONO.has(d)) return { domain: "homeassistant", service: "toggle" };
  return null;
}

/* Il disegno di un'entita' quando nessuno ne ha scelto uno. */
function disegnoDellEntita(id) {
  const d = dominio(id);
  const classe = String(attributi(id).device_class || "");
  if (d === "sensor" || d === "binary_sensor") {
    const perClasse = {
      temperature: "temperatura",
      humidity: "umidita",
      power: "energia",
      energy: "energia",
      battery: "batterie",
      window: "finestra",
      door: "aperture",
      garage_door: "aperture",
      opening: "aperture",
      motion: "presenza",
      occupancy: "presenza",
      presence: "presenza",
      smoke: "fumo",
      moisture: "allagamenti",
    };
    return perClasse[classe] || "widget";
  }
  return (
    {
      switch: "prese",
      input_boolean: "custom",
      fan: "aria",
      lock: "varchi",
      scene: "azioni",
      script: "azioni",
      button: "azioni",
      input_button: "azioni",
      automation: "azioni",
      media_player: "media",
      vacuum: "robot",
      camera: "telecamere",
      person: "persone",
      water_heater: "scaldabagno",
      humidifier: "umidita",
      valve: "irrigazione",
      weather: "meteo",
      siren: "allerte",
      alarm_control_panel: "sicurezza",
    }[d] || "widget"
  );
}

/* Lo stato di un'entita' in parole: «Accesa», «Chiusa», «21,5 °C». */
function statoInParole(id) {
  const s = stato(id);
  if (!s) return t("Non trovata", "Not found");
  const v = String(s.state);
  const unita = clean(s.attributes?.unit_of_measurement);
  if (numero(v) !== null && v.trim() !== "")
    return `${decimale(numero(v), Number.isInteger(numero(v)) ? 0 : 1)}${unita ? ` ${unita}` : ""}`;
  const parole = {
    on: t("Acceso", "On"),
    off: t("Spento", "Off"),
    locked: t("Chiusa", "Locked"),
    unlocked: t("Aperta", "Unlocked"),
    open: t("Aperto", "Open"),
    closed: t("Chiuso", "Closed"),
    home: t("In casa", "Home"),
    not_home: t("Fuori", "Away"),
    playing: t("In riproduzione", "Playing"),
    paused: t("In pausa", "Paused"),
    idle: t("Fermo", "Idle"),
    cleaning: t("Pulisce", "Cleaning"),
    docked: t("Alla base", "Docked"),
    unavailable: t("Non disponibile", "Unavailable"),
    unknown: "—",
  };
  if (dominio(id) === "scene" || dominio(id) === "button" || dominio(id) === "input_button")
    return "";
  return parole[v] || v;
}

/* ── il disegno ──────────────────────────────────────────────────────────── */

const MODELLI_SCRITTI = () => ({
  stanza: t("Stanza", "Room"),
  scene: t("Scene", "Scenes"),
  ingresso: t("Ingresso", "Entrance"),
  personale: t("La mia pagina", "My page"),
  luci: t("Luci", "Lights"),
  clima: t("Clima", "Climate"),
  tapparelle: t("Tapparelle", "Blinds"),
  ambienti: t("Ambienti", "Rooms"),
  telecamere: t("Telecamere", "Cameras"),
  energia: t("Energia", "Energy"),
  musica: t("Musica", "Music"),
});
const SOTTO = () => ({
  stanza: t("Luci · Clima · Tapparelle · Scene", "Lights · Climate · Blinds · Scenes"),
  scene: t("Un tocco · tutta la casa", "One tap · the whole house"),
  ingresso: t("Antifurto · Citofono · Uscita", "Alarm · Intercom · Leaving"),
  personale: t("I comandi scelti da te", "Your own controls"),
  luci: t("Tutte le luci di casa", "Every light in the house"),
  clima: t("Caldo · Freddo", "Heating · Cooling"),
  tapparelle: t("Tutte le tapparelle di casa", "Every blind in the house"),
  ambienti: t("Temperatura · Umidità · Luci", "Temperature · Humidity · Lights"),
  telecamere: t("Le immagini dal vivo", "Live pictures"),
  energia: t("Adesso, in casa", "Right now, at home"),
  musica: t("Cosa suona in casa", "What's playing at home"),
});
const DISEGNO_DEL_MODELLO = {
  stanza: "stanze",
  scene: "azioni",
  ingresso: "sicurezza",
  personale: "widget",
  luci: "luci",
  clima: "clima",
  tapparelle: "tapparelle",
  ambienti: "temperatura",
  telecamere: "telecamere",
  energia: "energia",
  musica: "media",
};
const ACCENTO_DEL_MODELLO = {
  stanza: "#f59e0b",
  scene: "#f59e0b",
  ingresso: "#10b981",
  personale: "#8b5cf6",
  luci: "#f59e0b",
  clima: "#0ea5e9",
  tapparelle: "#8b5cf6",
  ambienti: "#ef4444",
  telecamere: "#2563eb",
  energia: "#10b981",
  musica: "#ec4899",
};
const accentoDi = (pagina) => clean(pagina?.colore) || ACCENTO_DEL_MODELLO[pagina?.modello];

const titoloDi = (pagina) =>
  clean(pagina.titolo) ||
  (pagina.modello === "stanza" && clean(pagina.stanza)) ||
  MODELLI_SCRITTI()[pagina.modello];

function orologio(adesso = new Date()) {
  return {
    ora: adesso.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }),
    giorno: adesso
      .toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" })
      .replace(/\./g, "")
      .toUpperCase(),
    lungo: adesso.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long" }),
  };
}

function meteo() {
  /* Prima quello scelto per il tablet, poi quello della config della plancia
   * di origine, poi `weather.home` come fa la plancia, e solo alla fine il
   * primo che c'e'. */
  const stati = allStates() || {};
  const fisso = clean(state.muro?.meteo) || clean(state.fonte?.meteo);
  if (!fisso) segnaDominio("weather");
  const id =
    (fisso && stati[fisso] && fisso) ||
    (stati["weather.home"] && "weather.home") ||
    Object.keys(stati).find((k) => k.startsWith("weather."));
  if (!id) return null;
  const s = stato(id);
  return { temperatura: s?.attributes?.temperature, condizione: s?.state };
}

const PAROLE_DEL_METEO = () => ({
  sunny: t("sereno", "sunny"),
  "clear-night": t("sereno", "clear"),
  partlycloudy: t("poco nuvoloso", "partly cloudy"),
  cloudy: t("nuvoloso", "cloudy"),
  rainy: t("pioggia", "rain"),
  pouring: t("pioggia forte", "pouring"),
  fog: t("nebbia", "fog"),
  snowy: t("neve", "snow"),
  lightning: t("temporale", "storm"),
  "lightning-rainy": t("temporale", "storm"),
  windy: t("vento", "windy"),
});

function testa(pagina, muro) {
  const o = orologio();
  const m = pagina.riga?.meteo !== false ? meteo() : null;
  const accento = accentoDi(pagina);
  /* Con piu' di quattro pagine le linguette tengono il disegno, e il nome
   * solo quella aperta: otto nomi interi non ci stanno accanto all'ora. */
  const molte = muro.pagine.length > 4 ? " mu-molte" : "";
  const linguette =
    muro.pagine.length > 1
      ? `<div class="mu-pagine${molte}" role="tablist">${muro.pagine
          .map(
            (p, i) =>
              `<button type="button" role="tab" class="${i === state.pagina ? "si" : ""}" style="--acc:${accentoDi(p)}" aria-label="${esc(titoloDi(p))}" data-mu-pagina="${i}" aria-selected="${i === state.pagina}">${disegno(clean(p.disegno) || DISEGNO_DEL_MODELLO[p.modello], 22, `ling-${p.id}`)}<span>${esc(titoloDi(p))}</span></button>`,
          )
          .join("")}</div>`
      : "";
  return `<div class="mu-carta mu-testa" style="--acc:${accento}">
    <button type="button" class="mu-menu" data-mu-fa="menu" aria-label="${esc(t("Apri il menu", "Open the menu"))}"><span></span><span></span><span></span></button>
    <div class="mu-titolo"><div class="mu-tit">${esc(titoloDi(pagina))}</div><div class="mu-et mu-sot">${esc(SOTTO()[pagina.modello])}</div></div>
    ${linguette}
    <div class="mu-ora" data-mu-orologio>${
      m && numero(m.temperatura) !== null
        ? `<div class="mu-meteo">${disegno("meteo", 44, "testa-meteo")}<div><b>${decimale(m.temperatura, 0)}°</b><div class="mu-et">${esc(PAROLE_DEL_METEO()[m.condizione] || "")}</div></div></div><span class="mu-sep"></span>`
        : ""
    }<div><div class="mu-h">${esc(o.ora)}</div><div class="mu-d">${esc(o.giorno)}</div></div></div>
  </div>`;
}

const STATI_DELL_ALLARME = () => ({
  /* «Metterei disattivo»: l'antifurto non si spegne, si disattiva. */
  disarmed: t("Disattivo", "Disarmed"),
  armed_home: t("In casa", "Home"),
  armed_away: t("Fuori", "Away"),
  armed_night: t("Notte", "Night"),
  armed_vacation: t("Vacanza", "Vacation"),
  armed_custom_bypass: t("Parziale", "Custom"),
  arming: t("Inserimento…", "Arming…"),
  pending: t("In attesa…", "Pending…"),
  triggered: t("ALLARME", "Alarm going off"),
  disarming: t("Disinserimento…", "Disarming…"),
});
const PAROLE_DEI_MODI = () => ({
  /* Gli stessi nomi dei tasti della sezione Sicurezza della plancia. */
  home: t("Casa", "Home"),
  away: t("Fuori", "Away"),
  night: t("Notte", "Night"),
  vacation: t("Vacanza", "Vacation"),
  custom: t("Parziale", "Partial"),
  disarm: t("Sblocca", "Disarm"),
});

/* I tasti dell'antifurto come li mostra la plancia di origine: quelli che la
 * centrale accetta, meno quelli tolti in configurazione, piu' quelli scritti a
 * mano per chi una centrale non ce l'ha. Prima qui c'erano tutti quelli che la
 * centrale dichiara, coi nomi del pannello: «stato e modalita' antifurto deve
 * seguire quelle della plancia». */
function tastiDellAntifurto(s) {
  const a = state.fonte?.antifurto || {};
  return alarmVisibleModes(s || null, a.tolte || [], a.suMisura || []).map((voce) => ({
    ...voce,
    label: voce.suMisura ? voce.label : PAROLE_DEI_MODI()[voce.mode] || voce.mode,
  }));
}

/* Quale tasto e' acceso: la regola della plancia, anche per quelli a mano. */
function tastoAcceso(s, tasti) {
  return alarmActiveModeWithCustom(
    s || null,
    tasti.map((voce) => voce.mode),
    state.fonte?.antifurto?.suMisura || [],
    allStates() || {},
  );
}

function modoSuMisura(id) {
  return (
    normalizzaModiSuMisura(state.fonte?.antifurto?.suMisura || []).find((m) => m.id === id) || null
  );
}

function centraleDelMuro(pagina) {
  return clean(pagina?.ingresso?.centrale) || state.fonte?.centrali?.[0] || "";
}

function pillole(pagina) {
  const riga = pagina.riga || {};
  const voci = [];
  const stanza = (state.fonte?.stanze || []).find((s) => s.name === pagina.stanza);
  const luci = comandiDellaPagina(pagina, state.fonte).filter((c) => c.tipo === "luce");
  const accese = luci.filter((c) => acceso(c.entita)).length;
  if (luci.length)
    voci.push([
      "luci",
      "#f59e0b",
      String(accese),
      accese === 1 ? t("luce accesa", "light on") : t("luci accese", "lights on"),
    ]);
  if (riga.clima !== false && stanza?.temp && numero(stato(stanza.temp)?.state) !== null)
    voci.push([
      "temperatura",
      "#ef4444",
      `${decimale(stato(stanza.temp).state)}°`,
      t("in stanza", "in the room"),
    ]);
  if (riga.clima !== false && stanza?.hum && numero(stato(stanza.hum)?.state) !== null)
    voci.push([
      "umidita",
      "#0ea5e9",
      `${decimale(stato(stanza.hum).state, 0)}%`,
      t("umidità", "humidity"),
    ]);
  const centrale = centraleDelMuro(pagina);
  if (riga.antifurto !== false && centrale && stato(centrale)) {
    const s = String(stato(centrale).state);
    voci.push([
      "sicurezza",
      s === "triggered" ? ACCENTI.allarme : s === "disarmed" ? "#10b981" : "#6366f1",
      STATI_DELL_ALLARME()[s] || s,
      t("antifurto", "alarm"),
    ]);
  }
  if (riga.persone !== false) {
    const persone = personeInCasa();
    if (persone.tutte)
      voci.push(["persone", "#2563eb", String(persone.inCasa), t("in casa", "at home")]);
  }
  if (!voci.length) return "";
  return `<div class="mu-carta mu-pillole">${voci
    .map(
      ([k, acc, v, l], i) =>
        `<div class="mu-pill" style="--acc:${acc}"><span class="mu-chip mu-acc">${disegno(k, 22, `pill-${i}-${k}`)}</span><div><b>${esc(v)}</b><span class="mu-et">${esc(l)}</span></div></div>`,
    )
    .join("")}</div>`;
}

function personeInCasa() {
  const elenco = state.fonte?.persone?.length
    ? state.fonte.persone.map((p) => p.entity)
    : Object.keys(allStates() || {}).filter((k) => k.startsWith("person."));
  const inCasa = elenco.filter((id) => String(stato(id)?.state) === "home");
  return { tutte: elenco.length, inCasa: inCasa.length, nomi: inCasa.map((id) => nomeDi(id)) };
}

const bulbo = (colore) =>
  `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${colore}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>`;

function luminosita(id) {
  if (state.inAttesa[id]?.luminosita !== undefined) return state.inAttesa[id].luminosita;
  const b = numero(attributi(id).brightness);
  if (!acceso(id)) return 0;
  return b === null ? 100 : Math.max(1, Math.round((b / 255) * 100));
}
const dimmerabile = (id) => {
  const modi = attributi(id).supported_color_modes;
  if (Array.isArray(modi)) return modi.some((m) => m !== "onoff");
  return numero(attributi(id).brightness) !== null;
};
const colorabile = (id) =>
  (attributi(id).supported_color_modes || []).some((m) =>
    ["hs", "rgb", "rgbw", "rgbww", "xy"].includes(m),
  );

function cardLuce(c, i) {
  const id = c.entita;
  const on = acceso(id);
  const pct = luminosita(id);
  const dimmer = dimmerabile(id);
  const manca = !stato(id);
  return `<div class="mu-carta mu-card ${on ? "mu-accesa" : ""}" style="--acc:${ACCENTI.luce}" data-mu-card="${i}" data-mu-entita="${esc(id)}">
    <div class="mu-riga1"><span class="mu-disco ${on ? "on" : ""}">${bulbo(on ? "#1f2937" : "var(--text-dim)")}</span>
      <div class="mu-nome"><div class="mu-n">${esc(nomeDi(id, c.nome))}</div><div class="mu-stato-riga"><span class="mu-stato ${on ? "" : "spento"}">${esc(manca ? t("Non trovata", "Not found") : on ? (dimmer ? `${t("Accesa", "On")} · ${pct}%` : t("Accesa", "On")) : t("Spenta", "Off"))}</span>${dimmer ? `<span class="mu-tag">DIMMER</span>` : ""}</div></div>
      <button type="button" class="mu-inter ${on ? "on" : ""}" data-mu-fa="interruttore" data-mu-entita="${esc(id)}" aria-pressed="${on}" aria-label="${esc(nomeDi(id, c.nome))}"><i></i></button></div>
    ${
      dimmer
        ? `<div class="mu-giu"><div class="mu-giu-et"><span class="mu-et">${esc(t("Luminosità", "Brightness"))}</span><span class="mu-stato ${on ? "" : "spento"}">${on ? `${pct}%` : "—"}</span></div>
      <div class="mu-bar" data-mu-cursore="luce" data-mu-entita="${esc(id)}"><i style="width:${pct}%"></i>${on ? `<u style="left:${pct}%"></u>` : ""}</div></div>`
        : ""
    }</div>`;
}

const PAROLE_DEL_CLIMA = () => ({
  heat: t("Caldo", "Heat"),
  cool: t("Freddo", "Cool"),
  heat_cool: t("Automatico", "Auto"),
  auto: t("Automatico", "Auto"),
  dry: t("Deumidifica", "Dry"),
  fan_only: t("Ventola", "Fan"),
  off: t("Spento", "Off"),
});
const AZIONI_DEL_CLIMA = () => ({
  heating: t("Riscalda", "Heating"),
  cooling: t("Raffresca", "Cooling"),
  drying: t("Deumidifica", "Drying"),
  fan: t("Ventila", "Fan"),
  idle: t("In pausa", "Idle"),
  off: t("Spento", "Off"),
});

function obiettivo(id) {
  if (state.inAttesa[id]?.temperatura !== undefined) return state.inAttesa[id].temperatura;
  return numero(attributi(id).temperature);
}

/* Da che parte sta un'unita' del clima: «se e' inserita nel caldo, il
 * simbolo caldo e non il ghiaccio». `zona` e' la pagina in cui si trova
 * (Clima caldo, Clima freddo), che decide quando l'unita' e' spenta. */
function scalda(id, zona = "") {
  const a = attributi(id);
  const tipo = (state.fonte?.clima || []).find((d) => d.entity === id)?.tipo || "clima";
  return climaScalda({ stato: stato(id)?.state, azione: a.hvac_action, tipo, zona });
}
const facciaDelClima = (id, zona) =>
  scalda(id, zona)
    ? { chiave: "caldo", accento: "#f97316" }
    : { chiave: "clima", accento: ACCENTI.clima };

/* La linguetta aperta di una pagina Clima: quella toccata, o quella scelta
 * nel config. */
function zonaDellaPagina(pagina) {
  return (state.zone ||= {})[pagina.id] || pagina.zona || "freddo";
}

/* La zona del clima in cui si e', se si e' in una pagina Clima. */
function zonaDiQui() {
  const pagina = state.muro?.pagine?.[state.pagina];
  return pagina?.modello === "clima" ? zonaDellaPagina(pagina) : "";
}

function cardClima(c, i, zona = "") {
  const id = c.entita;
  const a = attributi(id);
  const faccia = facciaDelClima(id, zona);
  const s = String(stato(id)?.state || "");
  const atteso = state.inAttesa[id]?.acceso;
  const on =
    typeof atteso === "boolean" ? atteso : Boolean(s && s !== "off" && s !== "unavailable");
  const azione = a.hvac_action
    ? AZIONI_DEL_CLIMA()[a.hvac_action]
    : on
      ? PAROLE_DEL_CLIMA()[s]
      : t("Spento", "Off");
  const target = obiettivo(id);
  return `<div class="mu-carta mu-card ${on ? "mu-accesa" : ""}" style="--acc:${faccia.accento}" data-mu-card="${i}" data-mu-entita="${esc(id)}" data-mu-lato="${faccia.chiave}">
    <div class="mu-riga1"><span class="mu-chip mu-acc" style="--c:46px">${disegno(faccia.chiave, 26, `clima-${i}`)}</span>
      <div class="mu-nome"><div class="mu-n">${esc(nomeDi(id, c.nome))}</div><div class="mu-sotto">${esc(t("ora", "now"))} ${decimale(a.current_temperature)}°</div></div>
      ${azione ? `<span class="mu-pasti">${esc(azione)}</span>` : ""}</div>
    <div class="mu-target"><span class="mu-grande">${target === null ? "—" : `${decimale(target)}°`}</span><span class="mu-et">Target</span></div>
    <div class="mu-comandi">
      ${on ? `<button type="button" class="mu-pasti mu-modo" data-mu-fa="modo" data-mu-entita="${esc(id)}">${esc(PAROLE_DEL_CLIMA()[s] || s)}</button>` : ""}
      <span class="mu-spazio"></span>
      <button type="button" class="mu-tondo" data-mu-fa="meno" data-mu-entita="${esc(id)}" aria-label="−">−</button>
      <button type="button" class="mu-tondo" data-mu-fa="piu" data-mu-entita="${esc(id)}" aria-label="+">+</button>
      <button type="button" class="mu-tondo ${on ? "pieno" : ""}" data-mu-fa="clima-acceso" data-mu-entita="${esc(id)}" aria-pressed="${on}" aria-label="${esc(t("Acceso", "Power"))}"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 3v9M18.4 6.6a9 9 0 1 1-12.8 0"/></svg></button>
    </div></div>`;
}

function cardTapparella(c, i) {
  const id = c.entita;
  const a = attributi(id);
  const s = String(stato(id)?.state || "");
  const pos = numero(a.current_position);
  const parola =
    s === "open"
      ? pos !== null && pos < 100
        ? `${t("Aperta", "Open")} · ${pos}%`
        : t("Aperta", "Open")
      : s === "closed"
        ? t("Chiusa", "Closed")
        : s === "opening"
          ? t("Si apre…", "Opening…")
          : s === "closing"
            ? t("Si chiude…", "Closing…")
            : s || "—";
  return `<div class="mu-carta mu-card ${s && s !== "closed" ? "mu-accesa" : ""}" style="--acc:${ACCENTI.tapparella}" data-mu-card="${i}" data-mu-entita="${esc(id)}">
    <div class="mu-riga1"><span class="mu-chip" style="--c:54px">${disegno("tapparelle", 32, `tapp-${i}`)}</span>
      <div class="mu-nome"><div class="mu-n">${esc(nomeDi(id, c.nome))}</div><div class="mu-stato">${esc(parola)}</div></div></div>
    ${pos !== null ? `<div class="mu-bar"><i style="width:${pos}%"></i></div>` : ""}
    <div class="mu-seg">
      <button type="button" data-mu-fa="su" data-mu-entita="${esc(id)}">▲ ${esc(t("Su", "Up"))}</button>
      <button type="button" data-mu-fa="ferma" data-mu-entita="${esc(id)}">■ ${esc(t("Stop", "Stop"))}</button>
      <button type="button" data-mu-fa="giu" data-mu-entita="${esc(id)}">▼ ${esc(t("Giù", "Down"))}</button>
    </div></div>`;
}

function tessera({ chiave, accento, etichetta, titolo, sotto, attiva, grande, dati = "", dove }) {
  return `<button type="button" class="mu-carta mu-card mu-tessera ${attiva ? "mu-accesa" : ""} ${grande ? "grande" : ""}" style="--acc:${accento}" ${dati}>
    <div class="mu-riga1"><span class="mu-chip" style="--c:${grande ? 84 : 54}px">${disegno(chiave, grande ? 50 : 32, dove)}</span><span class="mu-et">${esc(etichetta)}</span>${attiva ? `<span class="mu-pasti">${esc(t("attiva", "active"))}</span>` : ""}</div>
    <div class="mu-osw">${esc(titolo)}</div><div class="mu-sotto">${esc(sotto)}</div></button>`;
}

function cardAzione(c, i, grande = false) {
  const azione = azioneDi(c.azione);
  if (!azione) return vuoto(i, t("Azione non trovata", "Action not found"));
  return tessera({
    chiave: disegnoDellAzione(azione, c.disegno),
    accento: ACCENTI.azione,
    etichetta: grande ? t("Scena", "Scene") : t("Scena", "Scene"),
    titolo: clean(c.nome) || azione.name,
    sotto: clean(c.sotto),
    attiva: state.attiva === azione.name,
    grande,
    dati: `data-mu-fa="azione" data-mu-azione="${esc(azione.name)}"`,
    dove: `az-${i}-${grande ? "g" : "p"}`,
  });
}

/* La card di un'entita' qualunque: il suo disegno, il nome, lo stato; il
 * tocco fa il gesto del dominio. Nelle Scene e' una tessera grande. */
function cardEntita(c, i, grande = false) {
  const id = c.entita;
  const s = stato(id);
  const servizio = servizioDellEntita(id, String(s?.state || ""));
  const on = acceso(id) || ["unlocked", "playing", "cleaning"].includes(String(s?.state));
  const parole = statoInParole(id);
  return tessera({
    chiave: clean(c.disegno) || disegnoDellEntita(id),
    accento: on ? ACCENTI.luce : ACCENTI.azione,
    /* Piccola: lo stato in alto. Grande: lo stato va sotto il nome, a meno
     * che sotto non ci sia gia' la riga scelta. */
    etichetta: !grande || clean(c.sotto) ? parole : "",
    titolo: nomeDi(id, c.nome),
    sotto: clean(c.sotto) || (grande ? parole : ""),
    attiva: on,
    grande,
    dati: servizio
      ? `data-mu-fa="entita" data-mu-entita="${esc(id)}"`
      : `data-mu-entita="${esc(id)}" aria-disabled="true"`,
    dove: `en-${i}-${grande ? "g" : "p"}`,
  });
}

const vuoto = (i, perche = "") =>
  `<div class="mu-carta mu-card mu-vuoto" data-mu-card="${i}"><span class="mu-et">${esc(perche || t("Posto libero", "Empty slot"))}</span></div>`;

function paginaStanza(pagina) {
  const zona = pagina.modello === "clima" ? zonaDellaPagina(pagina) : "";
  const comandi = comandiDellaPagina(pagina, state.fonte, zona);
  const elenco = MODELLI_ELENCO.includes(pagina.modello);
  /* La pagina Clima: le due linguette in cima, come nella sezione Clima. */
  const linguette =
    pagina.modello === "clima"
      ? `<div class="mu-zone" role="tablist">${[
          ["freddo", "clima", t("Freddo", "Cooling"), "#0ea5e9"],
          ["caldo", "caldo", t("Caldo", "Heating"), "#f97316"],
        ]
          .map(
            ([z, d, parola, acc]) =>
              `<button type="button" role="tab" class="${z === zona ? "si" : ""}" style="--acc:${acc}" data-mu-zona="${z}" aria-selected="${z === zona}">${disegno(d, 22, `zona-${z}`)}${esc(parola)}</button>`,
          )
          .join("")}</div>`
      : "";
  /* Le pagine elenco non hanno tetto: una griglia per volta a schermo, e la
   * griglia scorre col dito. Vuote, lo dicono. */
  const posti = postiDellaPagina(pagina);
  const quante = elenco ? Math.max(comandi.length, 1) : posti;
  if (elenco && !comandi.length)
    return `${linguette}<div class="mu-g6" style="${stileDellaGriglia(pagina)}">${vuoto(0, t("Niente da mostrare qui", "Nothing to show here"))}</div>`;
  const carte = Array.from({ length: quante }, (_, i) => {
    const c = comandi[i];
    if (!c || c.tipo === "vuoto") return vuoto(i);
    if (c.tipo === "luce") return cardLuce(c, i);
    if (c.tipo === "clima") return cardClima(c, i, zona);
    if (c.tipo === "tapparella") return cardTapparella(c, i);
    if (c.tipo === "entita") return cardEntita(c, i);
    return cardAzione(c, i);
  });
  const riga = pagina.modello === "stanza" ? pillole(pagina) : linguette;
  return `${riga}${griglia(pagina, carte, quante)}`;
}

/* La griglia della pagina: colonne e righe secondo la scelta e il verso. Sul
 * pannello piccolo al massimo tre per tre, e il resto scorre. */
function misureDellaGriglia(pagina) {
  const g = grigliaDellaPagina(pagina, state.verso || "orizzontale");
  return state.compatto ? { colonne: Math.min(g.colonne, 3), righe: Math.min(g.righe, 3) } : g;
}
const stileDellaGriglia = (pagina) => {
  const g = misureDellaGriglia(pagina);
  return `--mu-col:${g.colonne};--mu-righe:${g.righe}`;
};
/* Una card piu' stretta di cosi' non tiene il disco, il nome e l'interruttore
 * su una riga: la griglia passa alla forma fitta (`mu-fitta`). */
const CARD_STRETTA = 340;
function griglia(pagina, carte, quante = carte.length) {
  const g = misureDellaGriglia(pagina);
  const scorre = quante > g.colonne * g.righe ? " mu-scorre" : "";
  const base = (state.verso === "verticale" ? 800 : 1280) / g.colonne;
  const fitta = !state.compatto && base < CARD_STRETTA ? " mu-fitta" : "";
  return `<div class="mu-g6${scorre}${fitta}" style="${stileDellaGriglia(pagina)}">${carte.join("")}</div>`;
}

function paginaScene(pagina) {
  const scene = pagina.scene.length ? pagina.scene : [];
  const carte = Array.from({ length: postiDellaPagina(pagina) }, (_, i) => {
    const c = scene[i];
    if (!c || c.tipo === "vuoto") return vuoto(i);
    return c.entita ? cardEntita(c, i, true) : cardAzione(c, i, true);
  });
  return griglia(pagina, carte);
}

/* ── le pagine da guardare: ambienti, telecamere, energia ───────────────── */

function paginaAmbienti(pagina) {
  const ambienti = ambientiDellaFonte(state.fonte || {});
  if (!ambienti.length)
    return griglia(pagina, [
      vuoto(0, t("Nessuna stanza con sonde o luci", "No room with sensors or lights")),
    ]);
  const carte = ambienti.map(({ stanza, luci }, i) => {
    const temp = stanza.temp ? numero(stato(stanza.temp)?.state) : null;
    const umid = stanza.hum ? numero(stato(stanza.hum)?.state) : null;
    const accese = luci.filter((id) => acceso(id)).length;
    const accento = accese ? ACCENTI.luce : "#ef4444";
    return `<div class="mu-carta mu-card mu-ambiente ${accese ? "mu-accesa" : ""}" style="--acc:${accento}" data-mu-card="${i}">
      <div class="mu-riga1"><span class="mu-chip mu-acc" style="--c:46px">${disegno("stanze", 26, `amb-${i}`)}</span><div class="mu-nome"><div class="mu-n">${esc(stanza.name)}</div>${luci.length ? `<div class="mu-stato ${accese ? "" : "spento"}">${esc(accese ? `${accese} ${accese === 1 ? t("luce accesa", "light on") : t("luci accese", "lights on")}` : t("Luci spente", "Lights off"))}</div>` : ""}</div></div>
      <div class="mu-target">${
        stanza.temp
          ? `<span class="mu-grande">${temp === null ? "—" : `${decimale(temp)}°`}</span>`
          : luci.length
            ? `<span class="mu-grande">${accese}/${luci.length}</span><span class="mu-et">${esc(t("luci", "lights"))}</span>`
            : ""
      }${umid === null ? "" : `<span class="mu-et">${decimale(umid, 0)}% ${esc(t("umidità", "humidity"))}</span>`}</div></div>`;
  });
  return griglia(pagina, carte);
}

function paginaTelecamere(pagina) {
  const telecamere = telecamereDellaFonte(state.fonte || {});
  if (!telecamere.length)
    return griglia(pagina, [
      vuoto(0, t("Nessuna telecamera nella plancia", "No camera in the dashboard")),
    ]);
  const carte = telecamere.map(
    (k, i) =>
      `<button type="button" class="mu-carta mu-card mu-cam" data-mu-fa="finestra-telecamera" data-mu-entita="${esc(k.entita)}" data-mu-card="${i}"><div class="mu-video">${anteprimaInCorso ? "" : `<img data-mu-telecamera="${esc(k.entita)}" alt="">`}<span class="mu-live">${esc(clean(k.nome) || nomeDi(k.entita))}</span></div></button>`,
  );
  return griglia(pagina, carte);
}

/* ── la musica ─────────────────────────────────────────────────────────────
 *
 * «Me ne devi fare una con sezione musica.» Il lettore che conta, grande:
 * la copertina come fondo, titolo e artista, il tempo che scorre, i tre tasti,
 * il volume largo quanto la card, le sorgenti. Accanto gli altri lettori
 * della casa, ognuno col suo play: un tocco lo porta in grande. Le letture e
 * i tasti sono quelli della sezione Musica (`core/media-player.js`): un tasto
 * che il lettore non sa fare non si disegna. */
const GLIFI_MUSICA = {
  precedente: '<path d="M6 5v14M19 5 9 12l10 7z"/>',
  successivo: '<path d="M18 5v14M5 5l10 7-10 7z"/>',
  suona: '<path d="M7 4.5v15l13-7.5z"/>',
  pausa: '<path d="M8 5v14M16 5v14"/>',
  accendi: '<path d="M12 3v9M18.4 6.6a9 9 0 1 1-12.8 0"/>',
  muto: '<path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6"/>',
  voce: '<path d="M4 9v6h4l5 4V5L8 9zM17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12"/>',
  gruppo:
    '<rect x="2.5" y="6" width="8" height="13" rx="2"/><rect x="13.5" y="6" width="8" height="13" rx="2"/><circle cx="6.5" cy="14.5" r="2"/><circle cx="17.5" cy="14.5" r="2"/><path d="M6.5 9.5h.01M17.5 9.5h.01"/>',
};
const glifo = (nome, misura = 30) =>
  `<svg width="${misura}" height="${misura}" viewBox="0 0 24 24" fill="${["suona"].includes(nome) ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLIFI_MUSICA[nome]}</svg>`;

/* La lettura di un lettore, con quello che il tocco sul tablet aspetta. */
function lettoreOra(voce) {
  segna(voce.entita);
  const lettura = letturaDelLettore({ entity: voce.entita, nome: voce.nome }, allStates() || {});
  const attesa = state.inAttesa[voce.entita] || {};
  if (typeof attesa.suona === "boolean") {
    lettura.suona = attesa.suona;
    lettura.inPausa = !attesa.suona;
  }
  if (attesa.volume !== undefined) lettura.volume = attesa.volume / 100;
  if (Array.isArray(attesa.gruppo)) lettura.gruppo = attesa.gruppo;
  if (!clean(voce.nome) && !stato(voce.entita)?.attributes?.friendly_name)
    lettura.nome = nomeDi(voce.entita);
  return lettura;
}

/* Quale lettore sta in grande: quello toccato, o il primo che suona. */
function lettoreScelto(pagina, letture) {
  const scelto = (state.lettori ||= {})[pagina.id];
  return (
    letture.find((l) => l.entity === scelto) ||
    letture.find((l) => l.suona) ||
    letture.find((l) => l.inPausa) ||
    letture[0]
  );
}

const parolaDelLettore = (l) =>
  l.muto
    ? t("Non disponibile", "Unavailable")
    : l.suona
      ? t("In riproduzione", "Playing")
      : l.inPausa
        ? t("In pausa", "Paused")
        : l.spento
          ? t("Spento", "Off")
          : t("Acceso", "On");

function tastoMusica(l, comando, nome, { grande = false, etichetta = "" } = {}) {
  return `<button type="button" class="mu-tondo${grande ? " grande pieno" : ""}" data-mu-fa="mp" data-mu-cmd="${comando}" data-mu-entita="${esc(l.entity)}" aria-label="${esc(etichetta || nome)}">${glifo(nome, grande ? 40 : 28)}</button>`;
}

function lettoreGrande(l) {
  const centro = ilTastoCentrale(l);
  const punto = posizioneOra(l);
  const volume = l.volume === null ? null : Math.round(l.volume * 100);
  const sotto = [l.artista, l.album].filter(Boolean).join(" · ");
  const titolo =
    l.titolo || (l.spento ? t("Spento", "Off") : l.applicazione || l.sorgente || l.nome);
  return `<div class="mu-carta mu-mp ${l.suona ? "mu-accesa" : ""}" style="--acc:#ec4899" data-mu-mp="${esc(l.entity)}">
    ${l.copertina ? `<img class="mu-mp-fondo" data-mu-copertina="${esc(l.copertina)}" src="${esc(l.copertina)}" alt="" aria-hidden="true">` : ""}
    <div class="mu-mp-testa">
      ${l.copertina ? `<img class="mu-mp-arte" data-mu-copertina="${esc(l.copertina)}" src="${esc(l.copertina)}" alt="">` : `<span class="mu-mp-arte mu-mp-arte-vuota">${disegno("media", 64, `mp-${l.entity}`)}</span>`}
      <div class="mu-mp-dici">
        <span class="mu-et">${esc(l.nome)} · ${esc(parolaDelLettore(l))}</span>
        <div class="mu-osw mu-mp-titolo">${esc(titolo)}</div>
        ${sotto ? `<div class="mu-sotto">${esc(sotto)}</div>` : ""}
      </div>
      ${bottoneDelGruppo(l)}
      ${l.puo.spegni && !l.spento ? tastoMusica(l, "spegni", "accendi", { etichetta: t("Spegni", "Turn off") }) : ""}
    </div>
    ${
      punto
        ? `<div class="mu-mp-tempo"><span data-mu-mp-ora>${esc(orologioDelBrano(punto.secondi))}</span><span class="mu-bar"><i data-mu-mp-avanza style="width:${(punto.quota * 100).toFixed(1)}%"></i></span><span>${esc(orologioDelBrano(punto.durata))}</span></div>`
        : ""
    }
    <div class="mu-mp-tasti">
      ${l.puo.precedente && !l.spento ? tastoMusica(l, "precedente", "precedente", { etichetta: t("Brano precedente", "Previous track") }) : ""}
      ${centro ? tastoMusica(l, "centro", centro === "pausa" ? "pausa" : centro === "accendi" ? "accendi" : "suona", { grande: true, etichetta: centro === "pausa" ? t("Pausa", "Pause") : centro === "accendi" ? t("Accendi", "Turn on") : t("Riproduci", "Play") }) : ""}
      ${l.puo.successivo && !l.spento ? tastoMusica(l, "successivo", "successivo", { etichetta: t("Brano successivo", "Next track") }) : ""}
    </div>
    ${
      !l.spento && (l.puo.volume || l.puo.passiVolume)
        ? `<div class="mu-mp-volume">
      ${l.puo.muto ? `<button type="button" class="mu-tondo${l.mutato ? " pieno" : ""}" data-mu-fa="mp" data-mu-cmd="muto" data-mu-entita="${esc(l.entity)}" aria-pressed="${l.mutato}" aria-label="${esc(t("Muto", "Mute"))}">${glifo(l.mutato ? "muto" : "voce", 26)}</button>` : ""}
      <button type="button" class="mu-tondo" data-mu-fa="mp" data-mu-cmd="abbassa" data-mu-entita="${esc(l.entity)}" aria-label="${esc(t("Abbassa", "Volume down"))}">−</button>
      ${
        l.puo.volume && volume !== null
          ? `<div class="mu-bar mu-mp-cursore" data-mu-cursore="volume" data-mu-entita="${esc(l.entity)}"><i style="width:${volume}%"></i><u style="left:${volume}%"></u></div><b class="mu-mp-pct">${volume}%</b>`
          : `<span class="mu-spazio"></span>`
      }
      <button type="button" class="mu-tondo" data-mu-fa="mp" data-mu-cmd="alza" data-mu-entita="${esc(l.entity)}" aria-label="${esc(t("Alza", "Volume up"))}">+</button>
    </div>`
        : ""
    }
    ${
      l.puo.sorgente && l.sorgenti.length && !l.spento
        ? `<div class="mu-mp-sorgenti">${l.sorgenti
            .slice(0, 8)
            .map(
              (sorgente) =>
                `<button type="button" class="${sorgente === l.sorgente ? "si" : ""}" data-mu-fa="mp-sorgente" data-mu-sorgente="${esc(sorgente)}" data-mu-entita="${esc(l.entity)}">${esc(sorgente)}</button>`,
            )
            .join("")}</div>`
        : ""
    }
  </div>`;
}

/* I lettori della pagina che sanno mettersi in gruppo, letti adesso. */
let lettoriDiQui = [];
function bottoneDelGruppo(l) {
  if (!l.puo.gruppo || l.spento) return "";
  const altri = lettoriDiQui.filter((x) => x.entity !== l.entity && x.puo.gruppo);
  if (!altri.length) return "";
  const insieme = compagniDelGruppo(l).length;
  return `<button type="button" class="mu-mp-gruppo${insieme ? " si" : ""}" data-mu-fa="mp-gruppo" data-mu-entita="${esc(l.entity)}" aria-label="${esc(t("Gruppo", "Group"))}">${glifo("gruppo", 24)}<span>${esc(t("Gruppo", "Group"))}${insieme ? ` · ${insieme + 1}` : ""}</span></button>`;
}

function rigaDelLettore(l, scelto) {
  const centro = ilTastoCentrale(l);
  const compagni = compagniDelGruppo(l);
  const riga =
    (compagni.length
      ? `${t("In gruppo con", "Grouped with")} ${compagni.map((id) => nomeDi(id)).join(", ")} · `
      : "") + (l.titolo ? [l.titolo, l.artista].filter(Boolean).join(" · ") : parolaDelLettore(l));
  return `<div class="mu-carta mu-mp-riga${l.entity === scelto ? " si" : ""}${l.suona ? " mu-accesa" : ""}" style="--acc:#ec4899" data-mu-fa="mp-scegli" data-mu-entita="${esc(l.entity)}" role="button" tabindex="0">
    ${l.copertina ? `<img class="mu-mp-mini" data-mu-copertina="${esc(l.copertina)}" src="${esc(l.copertina)}" alt="">` : `<span class="mu-mp-mini mu-mp-arte-vuota">${disegno("media", 30, `mpr-${l.entity}`)}</span>`}
    <div class="mu-nome"><div class="mu-n">${esc(l.nome)}</div><div class="mu-sotto">${l.suona ? '<i class="mu-mp-onde" aria-hidden="true"><b></b><b></b><b></b></i>' : ""}${esc(riga)}</div></div>
    ${centro ? tastoMusica(l, "centro", centro === "pausa" ? "pausa" : centro === "accendi" ? "accendi" : "suona", { etichetta: l.nome }) : ""}
  </div>`;
}

function paginaMusica(pagina) {
  const voci = lettoriDellaPagina(pagina, state.fonte || {});
  if (!voci.length)
    return griglia(pagina, [
      vuoto(
        0,
        t(
          "Nessun lettore: aggiungili nella sezione Musica o qui nel config",
          "No player: add them in the Music section or here in the config",
        ),
      ),
    ]);
  const letture = voci.map(lettoreOra);
  lettoriDiQui = letture;
  const grande = lettoreScelto(pagina, letture);
  const altri = letture.length > 1;
  return `<div class="mu-musica${altri ? "" : " solo"}">${lettoreGrande(grande)}${
    altri
      ? `<div class="mu-mp-elenco">${letture.map((l) => rigaDelLettore(l, grande.entity)).join("")}</div>`
      : ""
  }</div>`;
}

/* Il tempo del brano scorre senza che arrivi uno stato: un battito al
 * secondo, solo mentre la pagina Musica e' davanti e qualcosa suona, che
 * sposta la barra e il numero senza ridisegnare la pagina. */
function battitoDellaMusica() {
  const nodo = doc?.getElementById(ID);
  const lettore = nodo?.querySelector?.("[data-mu-mp]");
  const suona = lettore && !state.riposo && lettore.querySelector("[data-mu-mp-avanza]");
  if (!suona) {
    root.clearInterval?.(state.musica);
    state.musica = null;
    return;
  }
  if (state.musica) return;
  state.musica = root.setInterval?.(() => {
    const qui = doc?.getElementById(ID)?.querySelector?.("[data-mu-mp]");
    if (!qui || state.riposo) {
      root.clearInterval?.(state.musica);
      state.musica = null;
      return;
    }
    const l = letturaDelLettore({ entity: qui.dataset.muMp }, allStates() || {});
    const punto = posizioneOra(l);
    if (!punto) return;
    const barra = qui.querySelector("[data-mu-mp-avanza]");
    const ora = qui.querySelector("[data-mu-mp-ora]");
    if (barra) barra.style.width = `${(punto.quota * 100).toFixed(1)}%`;
    if (ora) ora.textContent = orologioDelBrano(punto.secondi);
  }, 1000);
}

/* Watt scritti per chi guarda da lontano: «850 W», «3,2 kW». */
function potenza(id) {
  const s = stato(id);
  const v = numero(s?.state);
  if (v === null) return { testo: "—", valore: null };
  const unita = clean(s?.attributes?.unit_of_measurement) || "W";
  const watt = /^kw$/i.test(unita) ? v * 1000 : v;
  /* Il verso lo dice la parola sopra («preleva», «cede»): il numero e' senza
   * segno. */
  const quanto = Math.abs(watt);
  return {
    valore: watt,
    testo: quanto >= 1000 ? `${decimale(quanto / 1000, 1)} kW` : `${decimale(quanto, 0)} W`,
  };
}

function paginaEnergia(pagina) {
  const e = energiaDellaPagina(pagina, state.fonte || {});
  const tessere = [];
  if (e.casa) {
    const p = potenza(e.casa);
    tessere.push([
      "casa",
      "home",
      "#0ea5e9",
      t("Consuma la casa", "House uses"),
      p.testo,
      nomeDi(e.casa),
    ]);
  }
  if (e.solare) {
    const p = potenza(e.solare);
    tessere.push([
      "solare",
      "solare",
      "#f59e0b",
      t("Produce il solare", "Solar makes"),
      p.testo,
      nomeDi(e.solare),
    ]);
  }
  if (e.rete) {
    const p = potenza(e.rete);
    /* Il segno lo decide chi misura: positivo si preleva, negativo si cede. */
    const parola =
      p.valore === null
        ? t("Rete", "Grid")
        : p.valore < 0
          ? t("Cede alla rete", "To the grid")
          : t("Preleva dalla rete", "From the grid");
    tessere.push([
      "rete",
      "energia",
      p.valore !== null && p.valore < 0 ? "#10b981" : "#8b5cf6",
      parola,
      p.testo,
      nomeDi(e.rete),
    ]);
  }
  if (e.batteria) {
    const v = numero(stato(e.batteria)?.state);
    tessere.push([
      "batteria",
      "batterie",
      "#10b981",
      t("Batteria", "Battery"),
      v === null ? "—" : `${decimale(v, 0)}%`,
      nomeDi(e.batteria),
    ]);
  }
  if (!tessere.length)
    return griglia(pagina, [
      vuoto(0, t("Scegli le misure nel config", "Choose the readings in the config")),
    ]);
  const carte = tessere.map(
    ([k, d, acc, etichetta, valore, sotto], i) =>
      `<div class="mu-carta mu-card mu-accesa mu-energia" style="--acc:${acc}" data-mu-card="${i}" data-mu-misura="${k}">
      <div class="mu-riga1"><span class="mu-chip mu-acc" style="--c:54px">${disegno(d, 32, `en-${k}`)}</span><span class="mu-et">${esc(etichetta)}</span></div>
      <div class="mu-grande">${esc(valore)}</div><div class="mu-sotto">${esc(sotto)}</div></div>`,
  );
  return griglia({ ...pagina, griglia: carte.length <= 4 ? 4 : pagina.griglia }, carte);
}

function finestreAperte() {
  /* Una finestra che si apre adesso era chiusa un attimo fa: si guarda tutto
   * il dominio, non solo quelle aperte. */
  segnaDominio("binary_sensor");
  /* Gli ingressi che la centrale ha dichiarato nella sezione Sicurezza, come
   * li conta la plancia: prima qui finiva ogni sensore con la classe
   * «finestra», e il pannello diceva aperti i «Stato finestra» dei
   * termosifoni. Chi non ne ha dichiarato nessuno vede quelli della pagina
   * Varchi della plancia, con le sue esclusioni e i suoi nomi. */
  const fonte = state.fonte || {};
  const stati = allStates() || {};
  const righe = varchiDiCasa(stati, fonte.varchi || {}, fonte.invertiti || [], (id) => nomeDi(id));
  const centrale = centraleDelMuro(state.muro?.pagine?.[state.pagina]);
  const dichiarati = fonte.antifurto?.ingressi?.[centrale] || [];
  const quali = dichiarati.length ? ingressiDellaCentrale(righe, { ingressi: dichiarati }) : righe;
  return quali.filter((riga) => riga.stato === "aperto").map((riga) => riga.name);
}

/* L'ingresso su un pannello piccolo: sei tessere, ognuna un gesto. Lo stato
 * dell'antifurto e il citofono aprono la loro finestra; «apri» apre. */
function paginaIngressoCompatta(pagina) {
  const ing = pagina.ingresso;
  const centrale = centraleDelMuro(pagina);
  const s = stato(centrale);
  const valore = String(s?.state || "");
  const spento = valore === "disarmed";
  const uscita = azioneDi(spento ? ing.esco : ing.rientro || ing.esco);
  const persone = personeInCasa();
  const tessere = [
    s
      ? tessera({
          chiave: "sicurezza",
          accento: valore === "triggered" ? ACCENTI.allarme : spento ? "#10b981" : "#6366f1",
          etichetta: t("Antifurto", "Alarm"),
          titolo: STATI_DELL_ALLARME()[valore] || valore,
          sotto: "",
          attiva: true,
          dati: `data-mu-fa="finestra-antifurto"`,
          dove: "c-allarme",
        })
      : "",
    ing.telecamera
      ? tessera({
          chiave: "citofono",
          accento: "#2563eb",
          etichetta: t("Citofono", "Intercom"),
          titolo: nomeDi(ing.telecamera),
          sotto: "",
          dati: `data-mu-fa="finestra-citofono"`,
          dove: "c-citofono",
        })
      : "",
    ing.apri
      ? tessera({
          chiave: "varchi",
          accento: "#0ea5e9",
          etichetta: t("Apri", "Open"),
          titolo: nomeDi(ing.apri, ing.nomeApri),
          sotto: "",
          dati: `data-mu-fa="apri" data-mu-entita="${esc(ing.apri)}"`,
          dove: "c-apri1",
        })
      : "",
    ing.apri2
      ? tessera({
          chiave: "aperture",
          accento: "#0ea5e9",
          etichetta: t("Apri", "Open"),
          titolo: nomeDi(ing.apri2, ing.nomeApri2),
          sotto: "",
          dati: `data-mu-fa="apri" data-mu-entita="${esc(ing.apri2)}"`,
          dove: "c-apri2",
        })
      : "",
    uscita
      ? tessera({
          chiave: spento ? "aperture" : "home",
          accento: "#0ea5e9",
          etichetta: spento ? t("Uscita", "Leaving") : t("Arrivo", "Arriving"),
          titolo: spento ? t("Esco", "Leaving") : t("Rientro", "I'm home"),
          sotto: "",
          dati: `data-mu-fa="azione" data-mu-azione="${esc(uscita.name)}" data-mu-conferma="${pagina.confermaUscita ? 1 : ""}"`,
          dove: "c-uscita",
        })
      : "",
    ing.persone && persone.tutte
      ? tessera({
          chiave: "persone",
          accento: "#2563eb",
          etichetta: t("In casa", "At home"),
          titolo: String(persone.inCasa),
          sotto: "",
          dove: "c-persone",
        })
      : "",
  ].filter(Boolean);
  return `<div class="mu-g6">${tessere.join("")}</div>`;
}

function paginaIngresso(pagina) {
  if (state.compatto) return paginaIngressoCompatta(pagina);
  const ing = pagina.ingresso;
  const centrale = centraleDelMuro(pagina);
  const s = stato(centrale);
  const valore = String(s?.state || "");
  const scattato = valore === "triggered";
  const spento = valore === "disarmed";
  const accento = scattato ? ACCENTI.allarme : spento ? "#10b981" : "#6366f1";
  const modi = tastiDellAntifurto(s);
  const acceso = tastoAcceso(s, modi);
  const aperte = ing.finestre ? finestreAperte() : [];
  const persone = personeInCasa();
  const uscita = spento ? ing.esco : ing.rientro || ing.esco;
  const azioneUscita = azioneDi(uscita);
  const telecamera = clean(ing.telecamera);
  return `<div class="mu-ingresso">
    <div class="mu-carta mu-accesa mu-allarme" style="--acc:${accento}">
      <div class="mu-riga1"><span class="mu-chip" style="--c:96px">${disegno("sicurezza", 60, "allarme")}</span>
        <div><span class="mu-et">${esc(t("Antifurto", "Alarm"))}</span><div class="mu-osw mu-stato-allarme">${esc(s ? STATI_DELL_ALLARME()[valore] || valore : modi.find((m) => m.mode === acceso)?.label || (modi.length ? t("Disattivo", "Disarmed") : t("Nessuna centrale", "No alarm panel")))}</div>
        ${aperte.length ? `<div class="mu-sotto mu-avviso-finestre">${disegno("finestra", 22, "fin")}${esc(t("Aperte", "Open"))}: <b>${esc(aperte.slice(0, 3).join(", "))}${aperte.length > 3 ? ` +${aperte.length - 3}` : ""}</b></div>` : ""}</div></div>
      ${
        modi.length
          ? `<div class="mu-seg mu-modi">${modi
              .map((m) => {
                const attivo = m.mode === acceso;
                return `<button type="button" class="${attivo ? "si" : ""}" data-mu-fa="allarme" data-mu-modo="${esc(m.mode)}">${esc(m.label)}</button>`;
              })
              .join(
                "",
              )}</div><div class="mu-et mu-nota">${esc(t("Il codice si chiede prima di inserire", "The code is asked before arming"))}</div>`
          : ""
      }
    </div>
    <div class="mu-carta mu-citofono">
      <div class="mu-video">${telecamera ? `<img data-mu-telecamera="${esc(telecamera)}" alt="">` : `<div class="mu-video-vuoto">${disegno("telecamere", 80, "tele-vuota")}</div>`}<span class="mu-live">${esc(telecamera ? nomeDi(telecamera) : t("Nessuna telecamera", "No camera"))}</span></div>
      ${
        ing.apri || ing.apri2
          ? `<div class="mu-due">${ing.apri ? `<button type="button" class="mu-btn pieno" data-mu-fa="apri" data-mu-entita="${esc(ing.apri)}">${disegno("varchi", 26, "apri1")}${esc(nomeDi(ing.apri, ing.nomeApri))}</button>` : ""}${ing.apri2 ? `<button type="button" class="mu-btn" data-mu-fa="apri" data-mu-entita="${esc(ing.apri2)}">${disegno("aperture", 26, "apri2")}${esc(nomeDi(ing.apri2, ing.nomeApri2))}</button>` : ""}</div>`
          : ""
      }
    </div>
    <div class="mu-piede">
      ${
        azioneUscita
          ? tessera({
              chiave: spento ? "aperture" : "home",
              accento: "#0ea5e9",
              etichetta: spento ? t("Uscita", "Leaving") : t("Arrivo", "Arriving"),
              titolo: spento ? t("Esco", "Leaving") : t("Rientro", "I'm home"),
              sotto:
                azioneUscita.name === (spento ? t("Esco", "Leaving") : t("Rientro", "I'm home"))
                  ? ""
                  : azioneUscita.name,
              attiva: false,
              dati: `data-mu-fa="azione" data-mu-azione="${esc(azioneUscita.name)}" data-mu-conferma="${pagina.confermaUscita ? 1 : ""}"`,
              dove: "uscita",
            })
          : ""
      }
      ${
        ing.persone && persone.tutte
          ? tessera({
              chiave: "persone",
              accento: "#2563eb",
              etichetta: t("In casa", "At home"),
              titolo: String(persone.inCasa),
              sotto: persone.nomi.join(", ") || t("Nessuno", "Nobody"),
              dove: "persone",
            })
          : ""
      }
    </div>
  </div>`;
}

function corpoDellaPagina(pagina) {
  if (pagina.modello === "scene") return paginaScene(pagina);
  if (pagina.modello === "ingresso") return paginaIngresso(pagina);
  if (pagina.modello === "ambienti") return paginaAmbienti(pagina);
  if (pagina.modello === "telecamere") return paginaTelecamere(pagina);
  if (pagina.modello === "energia") return paginaEnergia(pagina);
  if (pagina.modello === "musica") return paginaMusica(pagina);
  return paginaStanza(pagina);
}

/* ── l'anteprima nel config ────────────────────────────────────────────────
 *
 * «Come configuratore riusciamo a fare meglio?» Chi sceglie i posti deve
 * vedere cosa sta facendo, senza salvare e andare al tablet: il config mostra
 * la pagina aperta disegnata come sul tablet, con gli stati veri di adesso.
 * E' lo stesso disegno del pannello, con la bozza al posto del muro salvato. */
let anteprimaInCorso = false;
export function anteprimaDellaPagina(muro, indice = 0, fonte = state.fonte) {
  const pagina = muro?.pagine?.[indice];
  if (!pagina || !fonte) return "";
  const prima = {
    muro: state.muro,
    fonte: state.fonte,
    pagina: state.pagina,
    finestra: state.finestra,
    compatto: state.compatto,
    verso: state.verso,
  };
  const raccoltaPrima = raccolta;
  raccolta = null;
  anteprimaInCorso = true;
  try {
    Object.assign(state, {
      muro,
      fonte,
      pagina: indice,
      finestra: null,
      compatto: false,
      verso: muro.orientamento === "verticale" ? "verticale" : "orizzontale",
    });
    return `<div class="mu-pagina mu-pag-${pagina.modello}">${testa(pagina, muro)}${corpoDellaPagina(pagina)}</div>`;
  } finally {
    Object.assign(state, prima);
    raccolta = raccoltaPrima;
    anteprimaInCorso = false;
  }
}

/* ── le finestre: quello che si apre sopra la pagina ─────────────────────── */

const COLORI = Object.freeze([
  ["#ffd8a8", null, 2700],
  ["#fff1d6", null, 3500],
  ["#ffffff", null, 5000],
  ["#bfe3ff", [191, 227, 255]],
  ["#a78bfa", [167, 139, 250]],
  ["#f472b6", [244, 114, 182]],
  ["#34d399", [52, 211, 153]],
]);

function finestra() {
  const f = state.finestra;
  if (!f) return "";
  let dentro = "";
  if (f.tipo === "luce") {
    const id = f.entita;
    const on = acceso(id);
    const pct = luminosita(id);
    dentro = `<div class="mu-fin-luce">
      <div class="mu-colonna" data-mu-cursore="luce-alta" data-mu-entita="${esc(id)}"><i style="height:${pct}%"></i><b>${on ? `${pct}%` : t("Spenta", "Off")}</b></div>
      <div class="mu-fin-dx">
        <div class="mu-riga1"><span class="mu-disco ${on ? "on" : ""}">${bulbo(on ? "#1f2937" : "var(--text-dim)")}</span><div class="mu-nome"><div class="mu-n" style="font-size:28px">${esc(nomeDi(id))}</div><div class="mu-stato">${esc(on ? `${t("Accesa", "On")} · ${pct}%` : t("Spenta", "Off"))}</div></div><button type="button" class="mu-tondo" data-mu-fa="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
        ${
          colorabile(id) || (attributi(id).supported_color_modes || []).includes("color_temp")
            ? `<div><span class="mu-et">${esc(t("Colore", "Colour"))}</span><div class="mu-colori">${COLORI.map(
                ([c], i) =>
                  `<button type="button" style="background:${c}" data-mu-fa="colore" data-mu-colore="${i}" data-mu-entita="${esc(id)}" aria-label="${c}"></button>`,
              ).join("")}</div></div>`
            : ""
        }
        <div><span class="mu-et">${esc(t("Preferite", "Favourites"))}</span><div class="mu-seg">${[
          10, 60, 100,
        ]
          .map(
            (p) =>
              `<button type="button" class="${on && pct === p ? "si" : ""}" data-mu-fa="livello" data-mu-livello="${p}" data-mu-entita="${esc(id)}">${p}%</button>`,
          )
          .join("")}</div></div>
        <div class="mu-due"><button type="button" class="mu-btn" data-mu-fa="spegni" data-mu-entita="${esc(id)}">${esc(t("Spegni", "Turn off"))}</button><button type="button" class="mu-btn pieno" data-mu-fa="chiudi">${esc(t("Fatto", "Done"))}</button></div>
      </div></div>`;
  } else if (f.tipo === "clima") {
    const id = f.entita;
    const modi = (attributi(id).hvac_modes || []).filter(Boolean);
    const s = String(stato(id)?.state || "");
    dentro = `<div class="mu-fin-clima">
      <div class="mu-riga1"><span class="mu-chip mu-acc" style="--c:52px">${disegno(facciaDelClima(id, f.zona).chiave, 30, "fin-clima")}</span><div class="mu-nome"><div class="mu-n" style="font-size:26px">${esc(nomeDi(id))}</div><div class="mu-sotto">${esc(t("Ambiente", "Room"))} ${decimale(attributi(id).current_temperature)}°</div></div><button type="button" class="mu-tondo" data-mu-fa="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
      <div class="mu-fin-temp"><button type="button" class="mu-tondo grande" data-mu-fa="meno" data-mu-entita="${esc(id)}">−</button><span class="mu-grande" style="font-size:96px">${obiettivo(id) === null ? "—" : `${decimale(obiettivo(id))}°`}</span><button type="button" class="mu-tondo grande" data-mu-fa="piu" data-mu-entita="${esc(id)}">+</button></div>
      <div class="mu-seg">${modi
        .map(
          (m) =>
            `<button type="button" class="${m === s ? "si" : ""}" data-mu-fa="hvac" data-mu-modo="${esc(m)}" data-mu-entita="${esc(id)}">${esc(PAROLE_DEL_CLIMA()[m] || m)}</button>`,
        )
        .join("")}</div></div>`;
  } else if (f.tipo === "tapparella") {
    const id = f.entita;
    const pos = numero(attributi(id).current_position);
    dentro = `<div class="mu-fin-clima" style="--acc:${ACCENTI.tapparella}">
      <div class="mu-riga1"><span class="mu-chip mu-acc" style="--c:52px">${disegno("tapparelle", 30, "fin-tapp")}</span><div class="mu-nome"><div class="mu-n" style="font-size:24px">${esc(nomeDi(id))}</div><div class="mu-stato">${pos === null ? esc(String(stato(id)?.state || "")) : `${pos}%`}</div></div><button type="button" class="mu-tondo" data-mu-fa="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
      ${pos !== null ? `<div class="mu-bar"><i style="width:${pos}%"></i></div>` : ""}
      <div class="mu-seg mu-seg-alto"><button type="button" data-mu-fa="su" data-mu-entita="${esc(id)}">▲ ${esc(t("Su", "Up"))}</button><button type="button" data-mu-fa="ferma" data-mu-entita="${esc(id)}">■ ${esc(t("Stop", "Stop"))}</button><button type="button" data-mu-fa="giu" data-mu-entita="${esc(id)}">▼ ${esc(t("Giù", "Down"))}</button></div></div>`;
  } else if (f.tipo === "antifurto") {
    const pagina = state.muro?.pagine?.[state.pagina];
    const centrale = centraleDelMuro(pagina);
    const s = stato(centrale);
    const valore = String(s?.state || "");
    const modi = tastiDellAntifurto(s);
    const acceso = tastoAcceso(s, modi);
    const aperte = pagina?.ingresso?.finestre ? finestreAperte() : [];
    dentro = `<div class="mu-fin-clima" style="--acc:${valore === "disarmed" ? "#10b981" : "#6366f1"}">
      <div class="mu-riga1"><span class="mu-chip mu-acc" style="--c:52px">${disegno("sicurezza", 30, "fin-allarme")}</span><div class="mu-nome"><div class="mu-n" style="font-size:24px">${esc(STATI_DELL_ALLARME()[valore] || valore)}</div>${aperte.length ? `<div class="mu-sotto">${esc(t("Aperte", "Open"))}: ${esc(aperte.slice(0, 2).join(", "))}</div>` : ""}</div><button type="button" class="mu-tondo" data-mu-fa="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
      <div class="mu-seg mu-seg-alto mu-modi">${modi.map((m) => `<button type="button" class="${m.mode === acceso ? "si" : ""}" data-mu-fa="allarme" data-mu-modo="${esc(m.mode)}">${esc(m.label)}</button>`).join("")}</div></div>`;
  } else if (f.tipo === "citofono") {
    const ing = state.muro?.pagine?.[state.pagina]?.ingresso || {};
    dentro = `<div class="mu-fin-clima">
      <div class="mu-riga1"><div class="mu-nome"><div class="mu-n" style="font-size:22px">${esc(nomeDi(ing.telecamera))}</div></div><button type="button" class="mu-tondo" data-mu-fa="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
      <div class="mu-video mu-video-fin"><img data-mu-telecamera="${esc(ing.telecamera)}" alt=""></div>
      ${ing.apri || ing.apri2 ? `<div class="mu-due">${ing.apri ? `<button type="button" class="mu-btn pieno" data-mu-fa="apri" data-mu-entita="${esc(ing.apri)}">${esc(nomeDi(ing.apri, ing.nomeApri))}</button>` : ""}${ing.apri2 ? `<button type="button" class="mu-btn" data-mu-fa="apri" data-mu-entita="${esc(ing.apri2)}">${esc(nomeDi(ing.apri2, ing.nomeApri2))}</button>` : ""}</div>` : ""}</div>`;
  } else if (f.tipo === "gruppo") {
    const pagina = state.muro?.pagine?.[state.pagina];
    const tutti = lettoriDellaPagina(pagina, state.fonte || {}).map(lettoreOra);
    const capo = tutti.find((x) => x.entity === f.entita) || lettoreOra({ entita: f.entita });
    const compagni = compagniDelGruppo(capo);
    const altri = tutti.filter((x) => x.entity !== capo.entity && x.puo.gruppo);
    dentro = `<div class="mu-fin-clima">
      <div class="mu-riga1"><span class="mu-chip mu-acc" style="--c:52px">${glifo("gruppo", 28)}</span><div class="mu-nome"><div class="mu-n" style="font-size:24px">${esc(t("Suona insieme a", "Plays together with"))} ${esc(capo.nome)}</div><div class="mu-sotto">${esc(t("Tocca un lettore per metterlo o toglierlo dal gruppo", "Tap a player to add it to or remove it from the group"))}</div></div><button type="button" class="mu-tondo" data-mu-fa="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
      <div class="mu-mp-gruppo-elenco">${altri
        .map((x) => {
          const dentroIlGruppo = compagni.includes(x.entity);
          return `<button type="button" class="mu-carta mu-mp-riga${dentroIlGruppo ? " si mu-accesa" : ""}" style="--acc:#ec4899" data-mu-fa="mp-unisci" data-mu-entita="${esc(capo.entity)}" data-mu-altro="${esc(x.entity)}" aria-pressed="${dentroIlGruppo}">
          ${x.copertina ? `<img class="mu-mp-mini" src="${esc(x.copertina)}" alt="">` : `<span class="mu-mp-mini mu-mp-arte-vuota">${disegno("media", 30, `grp-${x.entity}`)}</span>`}
          <div class="mu-nome"><div class="mu-n">${esc(x.nome)}</div><div class="mu-sotto">${esc(dentroIlGruppo ? t("Nel gruppo", "In the group") : parolaDelLettore(x))}</div></div>
          <span class="mu-inter ${dentroIlGruppo ? "on" : ""}"><i></i></span></button>`;
        })
        .join("")}</div>
      ${compagni.length ? `<button type="button" class="mu-btn" data-mu-fa="mp-sciogli" data-mu-entita="${esc(capo.entity)}">${esc(t("Sciogli il gruppo", "Ungroup all"))}</button>` : ""}</div>`;
  } else if (f.tipo === "telecamera") {
    dentro = `<div class="mu-fin-clima">
      <div class="mu-riga1"><div class="mu-nome"><div class="mu-n" style="font-size:22px">${esc(nomeDi(f.entita))}</div></div><button type="button" class="mu-tondo" data-mu-fa="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
      <div class="mu-video mu-video-fin"><img data-mu-telecamera="${esc(f.entita)}" alt=""></div></div>`;
  } else if (f.tipo === "conferma") {
    dentro = `<div class="mu-fin-conferma"><div class="mu-osw" style="font-size:40px">${esc(f.azione)}</div><div class="mu-sotto">${esc(t("Confermi?", "Confirm?"))}</div>
      <div class="mu-due"><button type="button" class="mu-btn" data-mu-fa="chiudi">${esc(t("Annulla", "Cancel"))}</button><button type="button" class="mu-btn pieno" data-mu-fa="azione" data-mu-azione="${esc(f.azione)}" data-mu-confermata="1">${esc(t("Sì, vai", "Yes, go"))}</button></div></div>`;
  } else if (f.tipo === "codice") {
    const titolo =
      f.scopo === "uscita" || f.scopo === "menu"
        ? t("Codice per uscire", "Code to exit")
        : t("Codice dell'antifurto", "Alarm code");
    dentro = `<div class="mu-fin-codice"><div class="mu-riga1"><div class="mu-nome"><div class="mu-n" style="font-size:24px">${esc(titolo)}</div><div class="mu-puntini">${"●".repeat((f.scritto || "").length) || "&nbsp;"}</div>${f.errore ? `<div class="mu-stato" style="--acc:#e11d48">${esc(t("Codice sbagliato", "Wrong code"))}</div>` : ""}</div><button type="button" class="mu-tondo" data-mu-fa="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
      <div class="mu-tasti">${["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"]
        .map(
          (k) =>
            `<button type="button" class="mu-tondo ${k === "✓" ? "pieno" : ""}" data-mu-fa="cifra" data-mu-cifra="${k}">${k}</button>`,
        )
        .join("")}</div></div>`;
  }
  const accento =
    {
      clima: ACCENTI.clima,
      codice: "#6366f1",
      tapparella: ACCENTI.tapparella,
      antifurto: "#10b981",
      citofono: "#2563eb",
      telecamera: "#2563eb",
      gruppo: "#ec4899",
    }[f.tipo] || ACCENTI.luce;
  return `<div class="mu-velo" data-mu-fa="fuori"><div class="mu-carta mu-accesa mu-finestra" style="--acc:${accento}">${dentro}</div></div>`;
}

function apriFinestra(f) {
  state.finestra = f;
  disegna();
}
function chiudiFinestra() {
  if (!state.finestra) return;
  state.finestra = null;
  disegna();
}

/* ── il riposo ───────────────────────────────────────────────────────────── */

function riposo(muro) {
  const o = orologio();
  const notte = eNotte(muro);
  const pagina = muro.pagine[0];
  if (muro.avvisi) for (const a of state.fonte?.avvisi || []) a.entita.forEach(segna);
  const avvisi = muro.avvisi
    ? avvisiAccesi(state.fonte || {}, allStates() || {}, centraleDelMuro(pagina))
    : [];
  const chip = avvisi
    .slice(0, 3)
    .map(
      (a) =>
        `<div class="mu-carta mu-avviso ${a.grave ? "grave" : ""}" style="--acc:${a.grave ? ACCENTI.allarme : "#06b6d4"}"><span class="mu-chip mu-acc" style="--c:40px">${a.grave ? disegno("sicurezza", 24, "av-allarme") : disegno("avvisi", 24, `av-${esc(a.chiave)}`)}</span><b>${esc(a.grave ? t("Antifurto: allarme in corso", "Alarm: triggered") : a.testo)}</b></div>`,
    )
    .join("");
  /* Il blocco si sposta ogni minuto (derivaDelRiposo): niente resta fermo
   * nello stesso punto, nemmeno gli avvisi o la scritta in fondo. */
  const d = derivaDelRiposo(Date.now());
  const deriva = `style="--dx:${d.x.toFixed(3)};--dy:${d.y.toFixed(3)}"`;
  if (notte)
    return `<div class="mu-riposo notte" data-mu-fa="sveglia">${chip ? `<div class="mu-deriva" ${deriva}><div class="mu-avvisi">${chip}</div></div>` : ""}</div>`;
  const m = meteo();
  const centrale = centraleDelMuro(pagina);
  /* Con piu' aree l'antifurto va su una riga sua, al centro, e dice quali
   * sono inserite: «Antifurto · Spento» non diceva niente a chi ha la
   * perimetrale accesa e la zona notte no. */
  const aree = state.fonte?.aree?.length > 1 ? state.fonte.aree : null;
  const allarme =
    !aree && centrale && stato(centrale) ? STATI_DELL_ALLARME()[stato(centrale).state] : "";
  const rigaDelleAree = aree ? areeSulRiposo(aree) : "";
  const stanza = (state.fonte?.stanze || []).find((s) => s.name === pagina?.stanza);
  const sonda = clean(muro.riposo?.sensore) || stanza?.temp || "";
  const dentro =
    sonda && numero(stato(sonda)?.state) !== null ? `${decimale(stato(sonda).state)}°` : "";
  /* Quello che si vuole sapere passando davanti, senza toccare: fuori, dentro,
   * chi c'e', cosa e' rimasto aperto, l'antifurto. Ognuna solo se c'e'. */
  const persone = personeInCasa();
  const chi =
    persone.inCasa === 0
      ? t("Nessuno in casa", "Nobody home")
      : persone.nomi.length <= 2
        ? persone.nomi.join(" · ")
        : `${persone.inCasa} ${t("in casa", "at home")}`;
  const aperte = finestreAperte().length;
  return `<div class="mu-riposo" data-mu-fa="sveglia"><div class="mu-deriva" ${deriva}>
    ${chip ? `<div class="mu-avvisi">${chip}</div>` : ""}
    <div class="mu-osw mu-orologione">${esc(o.ora)}</div>
    <div class="mu-et mu-data">${esc(o.lungo)}</div>
    <div class="mu-riposo-riga">
      ${m && numero(m.temperatura) !== null ? `<span>${disegno("meteo", 34, "rip-meteo")}${decimale(m.temperatura, 0)}° ${esc(PAROLE_DEL_METEO()[m.condizione] || "")}</span>` : ""}
      ${dentro ? `<span>${disegno("temperatura", 30, "rip-temp")}${dentro} ${esc(t("in casa", "inside"))}</span>` : ""}
      ${persone.tutte ? `<span data-mu-riposo="persone">${disegno("persone", 30, "rip-persone")}${esc(chi)}</span>` : ""}
      ${aperte ? `<span data-mu-riposo="aperte" class="mu-attenzione">${disegno("aperture", 30, "rip-aperture")}${aperte} ${esc(aperte === 1 ? t("finestra aperta", "window open") : t("finestre aperte", "windows open"))}</span>` : ""}
      ${allarme ? `<span>${disegno("sicurezza", 30, "rip-allarme")}${esc(t("Antifurto", "Alarm"))} · ${esc(allarme)}</span>` : ""}
    </div>
    ${rigaDelleAree}
    <div class="mu-et mu-tocca">${esc(t("Tocca per i comandi", "Tap for controls"))}</div></div></div>`;
}

function areeSulRiposo(aree) {
  const lette = aree
    .map((a, i) => ({
      nome:
        clean(a.nome) ||
        clean(stato(a.entita)?.attributes?.friendly_name) ||
        `${t("Area", "Area")} ${i + 1}`,
      valore: String(stato(a.entita)?.state || ""),
    }))
    .filter((a) => a.valore);
  if (!lette.length) return "";
  const attive = lette.filter((a) => a.valore !== "disarmed");
  const suona = attive.some((a) => a.valore === "triggered");
  const dette = attive.length
    ? attive
        .map(
          (a) =>
            `<span class="${a.valore === "triggered" ? "grave" : ""}"><b>${esc(a.nome)}</b> ${esc(STATI_DELL_ALLARME()[a.valore] || a.valore)}</span>`,
        )
        .join('<i aria-hidden="true">·</i>')
    : `<b>${esc(STATI_DELL_ALLARME().disarmed)}</b>`;
  return `<div class="mu-riposo-aree${suona ? " grave" : ""}">${disegno("sicurezza", 30, "rip-aree")}<span>${esc(t("Antifurto", "Alarm"))}</span><i aria-hidden="true">·</i>${dette}</div>`;
}

/* ── la tela: dove sta, quanto e' grande, cosa mostra ────────────────────── */

/* ── il config del tablet ──────────────────────────────────────────────────
 *
 * «Se premo config del dispositivo a muro mi deve aprire solo quello, non
 * tutto il config; e quando esco dal config, esce cosi' e non si vede di nuovo
 * la dashboard.» L'orologio tenuto (col PIN, se c'e') apre il config sulla
 * scheda «A muro» e nasconde il resto; chiuso il config, torna il pannello.
 * Qualunque config aperto sopra il pannello — dal menu dell'app — toglie il
 * pannello subito, e chiuso lo rimette. */
const SOLO_MURO = "dm-solo-muro";
let guardaIlConfig = 0;

function configAperto() {
  togliLaTela();
  if (guardaIlConfig) return;
  /* Il config si chiude togliendo il suo riquadro, senza passare da nessuna
   * funzione: lo si guarda un fotogramma alla volta, e solo finche' e'
   * aperto. */
  const giro = () => {
    if (editorAperto()) {
      guardaIlConfig = root.requestAnimationFrame?.(giro) || root.setTimeout?.(giro, 200);
      return;
    }
    guardaIlConfig = 0;
    doc?.documentElement?.classList?.remove(SOLO_MURO);
    state.uscito = false;
    state.riposo = false;
    tocco();
    rileggi().catch(() => {});
  };
  guardaIlConfig = root.requestAnimationFrame?.(giro) || root.setTimeout?.(giro, 200);
}

/* Il tasto ☰ in cima al pannello, come quello della plancia principale.
 *
 * «Nella nuova dashboard metti l'hamburger in alto come la dashboard main,
 * per aprire la barra laterale di Home Assistant oppure il menu di gdahome
 * nell'app.» Non si rifà niente: si preme il tasto della plancia, che c'e'
 * anche sotto il pannello. In Home Assistant apre la barra laterale; nell'app
 * lo intercetta chi la ospita (`premesse.dart`) e apre il menu di gdahome. */
/* Il menu laterale di Home Assistant — e quello dell'app — si apre sotto il
 * pannello, che sta sopra tutto: «l'icona hamburger non funziona, non si apre
 * il menu laterale». Mentre il menu e' aperto il pannello scende sotto il
 * cassetto; il primo tocco fuori dal ☰ lo rimette sopra. */
function scendiSottoIlMenu() {
  const tela = doc?.getElementById?.(ID);
  if (!tela) return;
  tela.dataset.muSottoIlMenu = "true";
  const aperto = Date.now();
  const risali = (evento) => {
    if (Date.now() - aperto < 300) return;
    if (evento?.target?.closest?.('[data-mu-fa="menu"]')) return;
    doc.removeEventListener("pointerdown", risali, true);
    /* Dopo il tocco, non durante: il tocco finisce su quello che c'e' sopra
     * adesso — il velo del menu, che lo chiude — e non sul pannello. */
    root.setTimeout?.(() => delete tela.dataset.muSottoIlMenu, 350);
  };
  doc.addEventListener("pointerdown", risali, true);
}

/* Chi ha il menu laterale, in ordine.
 *
 * «Hamburger ancora non va: quando clicco si e' aperta la navbar. Si deve
 * aprire il menu laterale di Home Assistant se sono su HA, e su gdahome il
 * menu laterale dell'app.» Prima qui si premeva il ☰ della plancia sotto il
 * pannello; ma col chiosco quel tasto non apre il cassetto, fa uscire la barra
 * in basso — e sul tablet appeso al muro la barra e' proprio quello che il
 * pannello copre. Il menu adesso lo si chiede direttamente a chi lo ha:
 *
 * 1. l'app gdahome sul telefono o sul tablet: il suo canale;
 * 2. Home Assistant, se la plancia ci sta dentro: il suo cassetto;
 * 3. l'app gdahome nel browser, che ospita la plancia in un riquadro;
 * 4. nessuno dei tre: la plancia e' aperta da sola, e il menu e' il suo. */
export function apriIlMenu() {
  scendiSottoIlMenu();
  try {
    if (root.gdahomeDice?.postMessage) {
      root.gdahomeDice.postMessage("gdahome:menu");
      return true;
    }
  } catch (_errore) {}
  let dentroHa = false;
  try {
    dentroHa = Boolean(root.documentoDiHomeAssistant?.());
  } catch (_errore) {}
  if (dentroHa && typeof root.apriMenuLaterale === "function") {
    root.apriMenuLaterale();
    return true;
  }
  try {
    if (root.parent && root.parent !== root) {
      root.parent.postMessage({ gdahome: "menu" }, "*");
      if (!dentroHa) return true;
    }
  } catch (_errore) {}
  if (typeof root.apriMenuLaterale === "function") {
    root.apriMenuLaterale();
    return true;
  }
  return false;
}

export function apriIlConfigDelMuro() {
  if (typeof root.apriConfigEntita !== "function") return false;
  doc?.documentElement?.classList?.add(SOLO_MURO);
  root.apriConfigEntita();
  /* La linguetta «A muro» la aggiunge la sua scheda subito dopo l'apertura:
   * si aspetta che ci sia, qualche fotogramma al massimo, e poi la si apre. */
  let giri = 0;
  const vaiAlMuro = () => {
    const linguetta = doc?.querySelector?.('#editor-modal .ed-tab[data-tab="muro"]');
    if (linguetta) {
      try {
        root.editorSwitch?.("muro");
      } catch (_errore) {}
      return;
    }
    if (giri++ < 60) (root.requestAnimationFrame || root.setTimeout)?.(vaiAlMuro, 16);
  };
  vaiAlMuro();
  tastoTuttoIlConfig();
  configAperto();
  return true;
}

/* «Tenendo premuto si va diretti al config muro: ma se uno volesse andare
 * nella config generale, lo deve fare dal pc su un'altra plancia?» No: in
 * cima al config del tablet c'e' «Tutto il config», che toglie il recinto e
 * lascia il config intero, con le sue schede. */
function tastoTuttoIlConfig() {
  let giri = 0;
  const metti = () => {
    const testa = doc?.querySelector?.("#editor-modal .ed-head");
    if (!testa) {
      if (giri++ < 60) (root.requestAnimationFrame || root.setTimeout)?.(metti, 16);
      return;
    }
    if (testa.querySelector("[data-mu-tutto-il-config]")) return;
    const tasto = doc.createElement("button");
    tasto.type = "button";
    tasto.className = "mu-tutto-il-config";
    tasto.dataset.muTuttoIlConfig = "true";
    tasto.textContent = `⚙️ ${t("Tutto il config", "Full config")}`;
    tasto.addEventListener("click", () => {
      doc.documentElement.classList.remove(SOLO_MURO);
      tasto.remove();
    });
    const chiudi = testa.querySelector(".ed-head-close");
    if (chiudi) chiudi.before(tasto);
    else testa.append(tasto);
  };
  metti();
}

function agganciaIlConfig() {
  wrapFunction("apriConfigEntita", "__dmMuroConfig", () => {
    if (editorAperto()) configAperto();
  });
}

function editorAperto() {
  return Boolean(doc?.getElementById("editor-modal"));
}

function tela() {
  let nodo = doc.getElementById(ID);
  if (!nodo) {
    nodo = doc.createElement("div");
    nodo.id = ID;
    nodo.setAttribute("role", "application");
    nodo.innerHTML = `<div class="mu-tela" data-mu-tela></div>`;
    doc.body.appendChild(nodo);
    nodo.addEventListener("click", onClick);
    nodo.addEventListener("pointerdown", onPointerDown);
    nodo.addEventListener("pointermove", onPointerMove);
    nodo.addEventListener("pointerup", onPointerUp);
    nodo.addEventListener("pointercancel", onPointerUp);
  }
  return nodo;
}

/* Il battito del tablet: uno solo, e solo mentre il pannello c'e'. Ogni
 * quindici secondi l'orologio e il riposo, la telecamera che non e' un video;
 * ogni dieci minuti la fonte, come rete di sicurezza: il cambio vero arriva
 * subito, dall'avviso sul bus di casa (`ascoltaLaFonte`). */
function avviaIlBattito() {
  if (state.timer) return;
  let giri = 0;
  state.timer = root.setInterval?.(() => {
    giri += 1;
    battito();
    rinfrescaLeTelecamere();
    if (giri % 40 === 0) rileggi({ forza: true }).catch(() => {});
    /* Un ponte di prima, che le revisioni non le sa dire: la configurazione
     * si rilegge intera, ma ogni minuto e non ogni dieci secondi. */
    if (state.revisioniNo && giri % 4 === 0) root.cdSyncPull?.();
  }, 15 * 1000);
  state.guardia = root.setInterval?.(() => {
    guardaLeRevisioni().catch(() => {});
  }, GUARDIA_MS);
  allineaLOrologio();
}

function fermaIlBattito() {
  if (state.timer) root.clearInterval?.(state.timer);
  if (state.guardia) root.clearInterval?.(state.guardia);
  root.clearTimeout?.(state.minuto);
  state.timer = null;
  state.guardia = null;
  state.minuto = null;
}

/* L'orologio cambia al minuto giusto, non fino a quindici secondi dopo: su
 * un tablet a muro l'ora si guarda, e un'ora indietro si nota. */
function allineaLOrologio() {
  root.clearTimeout?.(state.minuto);
  const adesso = new Date();
  const mancano = 60_000 - (adesso.getSeconds() * 1000 + adesso.getMilliseconds()) + 50;
  state.minuto = root.setTimeout?.(() => {
    battito();
    allineaLOrologio();
  }, mancano);
}

/* ── la configurazione che cambia da un altro telefono ────────────────────
 *
 * «I dati devono essere in real time.» La plancia rilegge la configurazione
 * quando riprende il fuoco, e un tablet a muro il fuoco non lo perde mai: una
 * pagina aggiunta dal telefono, o una luce nuova nella principale, arrivava
 * sul tablet al riavvio. Ogni dieci secondi si chiede al ponte a che
 * revisione sono questa plancia e quella da cui si legge — pochi byte — e si
 * scarica lo scatto solo se il numero e' cambiato. */
const GUARDIA_MS = 10 * 1000;

export async function guardaLeRevisioni() {
  if (!root.__DASHBOARDMODERN_HOSTED__ || state.revisioniNo || state.guardando) return false;
  const qui = currentProfile();
  const fonte = state.muro?.fonte || "primary";
  const profili = [...new Set([qui, fonte])];
  state.guardando = true;
  let risposta = null;
  try {
    risposta = await bridgeRequest("ponte/config/revisioni", { profili });
  } catch (errore) {
    if (/non conosco|unknown/i.test(String(errore?.message || ""))) state.revisioniNo = true;
    return false;
  } finally {
    state.guardando = false;
  }
  const nuove = risposta?.revisioni;
  if (!nuove || typeof nuove !== "object") return false;
  const viste = (state.revisioni ||= {});
  const cambiata = (profilo) =>
    Object.hasOwn(nuove, profilo) &&
    Object.hasOwn(viste, profilo) &&
    Number(nuove[profilo]) !== Number(viste[profilo]);
  const quiCambiata = cambiata(qui);
  const fonteCambiata = fonte !== qui && cambiata(fonte);
  Object.assign(viste, nuove);
  /* La plancia di qui: la ripristina chi la sa ripristinare, e il ripristino
   * annuncia `persistence-restored`, che rilegge il muro. */
  if (quiCambiata) root.cdSyncPull?.();
  if (fonteCambiata && state.muro) {
    await fonteDelMuro(state.muro, { forza: true });
    disegna();
  }
  return quiCambiata || fonteCambiata;
}

/* Lo schermo, dentro l'app: «lo spegni schermo toglie l'orologio, ma lascia
 * acceso l'Android con le icone sotto e la barra sopra». Le barre del sistema
 * e la luminosita' le comanda l'app (`app/lib/casa/lo_schermo.dart`): le si
 * dice se il pannello c'e' e se e' notte, solo quando cambia. Fuori dall'app
 * il canale non c'e' e non succede niente. */
const detto = { muro: "", spento: "" };
function diciAlloSchermo(chiave, si) {
  const canale = root.gdahomeSchermo;
  const valore = si ? "si" : "no";
  if (!canale?.postMessage || detto[chiave] === valore) return;
  detto[chiave] = valore;
  try {
    canale.postMessage(`${chiave}:${valore}`);
  } catch (_errore) {}
}

function togliLaTela() {
  diciAlloSchermo("spento", false);
  diciAlloSchermo("muro", false);
  fermaIlBattito();
  doc?.getElementById(ID)?.remove();
  doc?.documentElement?.classList?.remove("dm-muro-acceso");
}

function misura(nodo, muro) {
  const larghezza = root.innerWidth || 1280;
  const altezza = root.innerHeight || 800;
  const v = verso(muro, larghezza, altezza);
  const s = scala(v, larghezza, altezza);
  const dentro = nodo.firstElementChild;
  state.compatto = eCompatto(larghezza, altezza);
  state.verso = v;
  nodo.dataset.verso = v;
  nodo.dataset.compatto = state.compatto ? "1" : "";
  dentro.style.zoom = String(s);
  dentro.style.width = `${larghezza / s}px`;
  dentro.style.height = `${altezza / s}px`;
}

/** Ridisegna il tablet: o lo spegne, se non deve esserci. */
export function disegna() {
  if (!doc?.body) return;
  const muro = state.muro;
  if (
    !muro?.attiva ||
    !muro.pagine.length ||
    state.premium !== true ||
    state.uscito ||
    editorAperto()
  ) {
    togliLaTela();
    return;
  }
  if (!state.fonte) return;
  const nodo = tela();
  lasciaIlVelo();
  avviaIlBattito();
  doc.documentElement.classList.add("dm-muro-acceso");
  const temaPlancia = doc.documentElement.getAttribute("data-theme") || "dark";
  nodo.dataset.tema = temaDelMomento(muro, new Date(), temaPlancia);
  misura(nodo, muro);
  if (state.pagina >= muro.pagine.length) state.pagina = 0;
  const pagina = muro.pagine[state.pagina];
  raccolta = { ids: new Set(), domini: new Set() };
  let corpo = "";
  try {
    corpo = state.riposo
      ? riposo(muro)
      : `<div class="mu-pagina mu-pag-${pagina.modello}">${testa(pagina, muro)}${corpoDellaPagina(
          pagina,
        )}</div>${finestra()}`;
    /* Il riposo si sveglia per l'antifurto anche quando non lo mostra. */
    segna(centraleDelMuro(muro.pagine[0]));
    inVista = raccolta;
  } finally {
    raccolta = null;
  }
  /* Mentre il dito trascina un cursore non si ridisegna: la barra la muove il
   * dito, e un aggiornamento di Home Assistant a meta' la farebbe saltare. */
  if (state.trascina) return;
  /* La telecamera non si ricarica a ogni ridisegno: il fotogramma (o il
   * video) che c'era si rimette al suo posto, e solo una nuova si carica. */
  const vecchie = new Map(
    [...nodo.querySelectorAll("img[data-mu-telecamera]")].map((img) => [
      img.dataset.muTelecamera,
      img,
    ]),
  );
  const copertine = new Map(
    [...nodo.querySelectorAll("img[data-mu-copertina]")].map((img) => [
      `${img.className}|${img.dataset.muCopertina}`,
      img,
    ]),
  );
  if (scriviSeCambia(nodo.firstElementChild, corpo)) {
    caricaLeTelecamere(nodo, vecchie);
    /* La copertina che c'era resta la stessa immagine: niente lampo. */
    for (const img of nodo.querySelectorAll("img[data-mu-copertina]")) {
      const prima = copertine.get(`${img.className}|${img.dataset.muCopertina}`);
      if (prima && prima !== img) img.replaceWith(prima);
    }
  }
  battitoDellaMusica();
  if (state.riposo) posizionaIlRiposo(nodo);
  diciAlloSchermo("muro", true);
  diciAlloSchermo("spento", Boolean(state.riposo && eNotte(muro)));
}

/* Il blocco del riposo va dove dice derivaDelRiposo, ma dentro lo spazio che
 * resta libero: quanto, lo sa solo chi lo misura — l'orologio da 240 px non e'
 * largo uguale alle 11:11 e alle 20:08, e un avviso acceso allarga tutto. */
function posizionaIlRiposo(nodo) {
  const blocco = nodo.querySelector(".mu-deriva");
  const riquadro = blocco?.parentElement;
  if (!blocco || !riquadro) return;
  const libero = (tutto, suo) => Math.max(0, (tutto - suo) / 2 - 16);
  const dx = Number(blocco.style.getPropertyValue("--dx")) || 0;
  const dy = Number(blocco.style.getPropertyValue("--dy")) || 0;
  blocco.style.setProperty(
    "--sx",
    `${Math.round(dx * libero(riquadro.clientWidth, blocco.offsetWidth))}px`,
  );
  blocco.style.setProperty(
    "--sy",
    `${Math.round(dy * libero(riquadro.clientHeight, blocco.offsetHeight))}px`,
  );
}

function caricaLeTelecamere(nodo, vecchie = new Map()) {
  for (const img of nodo.querySelectorAll("img[data-mu-telecamera]")) {
    const entity = img.dataset.muTelecamera;
    const prima = vecchie.get(entity);
    if (prima) {
      img.replaceWith(prima);
      continue;
    }
    loadCameraFrame({ entity }, img).catch(() => {});
  }
}

/* Il fotogramma si rinfresca da se' ogni tanto; un video vivo si muove gia'. */
function rinfrescaLeTelecamere() {
  const nodo = doc?.getElementById(ID);
  if (!nodo || state.riposo) return;
  for (const img of nodo.querySelectorAll("img[data-mu-telecamera]"))
    if (!img.dataset.dmCameraStream)
      loadCameraFrame({ entity: img.dataset.muTelecamera }, img).catch(() => {});
}

/* ── le mani: tocchi, cursori, dita che scorrono ─────────────────────────── */

function tocco() {
  state.toccato = Date.now();
}

function attendi(id, cosa, valore) {
  state.inAttesa[id] = { ...(state.inAttesa[id] || {}), [cosa]: valore };
  root.clearTimeout?.(state.inAttesa[id]._timer);
  state.inAttesa[id]._timer = root.setTimeout?.(() => {
    delete state.inAttesa[id];
    disegna();
  }, 4000);
}

/* Il tocco che accende o spegne: la card cambia subito, il comando parte. */
function alterna(id, domain, service, data = { entity_id: id }) {
  attendi(id, "acceso", !acceso(id));
  comanda(domain, service, data);
  disegna();
}

/* Quando Home Assistant dice lo stesso che il tablet aspettava, l'attesa
 * finisce subito: niente quattro secondi in cui il tablet non ascolta. */
const ATTESE = ["acceso", "luminosita", "temperatura", "volume", "suona", "gruppo"];
export function attesaConfermata(cosa, atteso, reale) {
  if (cosa === "acceso") return reale.acceso === atteso;
  if (cosa === "suona") return reale.suona === atteso;
  if (cosa === "gruppo")
    return reale.gruppo === (Array.isArray(atteso) ? atteso : []).slice(1).sort().join(",");
  if (cosa === "volume") return reale.volume !== null && Math.abs(reale.volume - atteso) <= 1;
  if (cosa === "luminosita")
    return reale.luminosita !== null && Math.abs(reale.luminosita - atteso) <= 2;
  if (cosa === "temperatura")
    return reale.temperatura !== null && Math.abs(reale.temperatura - atteso) < 0.05;
  return false;
}

function confermaLeAttese(event) {
  const ids =
    event?.detail?.entity_ids || (event?.detail?.entity_id ? [event.detail.entity_id] : []);
  for (const id of ids) {
    const attesa = state.inAttesa[id];
    if (!attesa) continue;
    const b = numero(attributi(id).brightness);
    const reale = {
      acceso: accesoVero(id),
      luminosita: !accesoVero(id)
        ? 0
        : b === null
          ? null
          : Math.max(1, Math.round((b / 255) * 100)),
      temperatura: numero(attributi(id).temperature),
      volume:
        numero(attributi(id).volume_level) === null
          ? null
          : Math.round(numero(attributi(id).volume_level) * 100),
      suona: ["playing", "buffering"].includes(String(stato(id)?.state)),
      gruppo: (attributi(id).group_members || [])
        .filter((x) => x !== id)
        .sort()
        .join(","),
    };
    for (const cosa of ATTESE)
      if (cosa in attesa && attesaConfermata(cosa, attesa[cosa], reale)) delete attesa[cosa];
    if (!ATTESE.some((cosa) => cosa in attesa)) {
      root.clearTimeout?.(attesa._timer);
      delete state.inAttesa[id];
    }
  }
}

let timerClima = null;
function cambiaTemperatura(id, verso) {
  const a = attributi(id);
  const passo = numero(a.target_temp_step) || 0.5;
  const min = numero(a.min_temp) ?? 7;
  const max = numero(a.max_temp) ?? 35;
  const ora = obiettivo(id) ?? numero(a.current_temperature) ?? 20;
  const nuova = Math.min(max, Math.max(min, Math.round((ora + verso * passo) / passo) * passo));
  attendi(id, "temperatura", nuova);
  disegna();
  root.clearTimeout?.(timerClima);
  timerClima = root.setTimeout?.(
    () => comanda("climate", "set_temperature", { entity_id: id, temperature: nuova }),
    700,
  );
}

function allarme(modo, codice = "") {
  const pagina = state.muro?.pagine?.[state.pagina];
  const centrale = centraleDelMuro(pagina);
  const s = stato(centrale);
  /* Un tasto scritto a mano chiama la sua entita', col suo codice se ne ha
   * uno: lo stesso giro della plancia (antifurto-su-misura.js). */
  const mio = modoSuMisura(modo);
  if (mio) {
    if (ilModoChiedeIlCodice(mio) && !codice) {
      apriFinestra({ tipo: "codice", scopo: "allarme", modo, scritto: "" });
      return;
    }
    if (codice && !ilCodiceApreIlModo(mio, codice)) {
      const f = state.finestra;
      if (f?.tipo === "codice") {
        f.errore = true;
        f.scritto = "";
        disegna();
      }
      return;
    }
    const chiamata = chiamataDelModo(mio);
    chiudiFinestra();
    if (chiamata) comanda(chiamata.domain, chiamata.service, { ...chiamata.data });
    return;
  }
  if (!s) return;
  const voce = modo === "disarm" ? ALARM_DISARM : ALARM_MODES.find((m) => m.mode === modo);
  if (!voce) return;
  if (alarmCodeNeeded(s, voce.service) && !codice) {
    apriFinestra({ tipo: "codice", scopo: "allarme", modo, scritto: "" });
    return;
  }
  chiudiFinestra();
  comanda("alarm_control_panel", voce.service, {
    entity_id: centrale,
    ...(codice ? { code: codice } : {}),
  });
}

function cifra(k) {
  const f = state.finestra;
  if (!f || f.tipo !== "codice") return;
  if (k === "⌫") f.scritto = (f.scritto || "").slice(0, -1);
  else if (k === "✓") {
    if (f.scopo === "uscita" || f.scopo === "menu") {
      if (pinGiusto(state.muro, f.scritto)) {
        state.finestra = null;
        if (f.scopo === "menu") {
          disegna();
          apriIlMenu();
        } else apriIlConfigDelMuro();
        return;
      } else {
        f.errore = true;
        f.scritto = "";
      }
    } else allarme(f.modo, f.scritto);
  } else if ((f.scritto || "").length < 12) {
    f.scritto = (f.scritto || "") + k;
    f.errore = false;
  }
  disegna();
}

function onClick(event) {
  tocco();
  const linguettaClima = event.target?.closest?.("[data-mu-zona]");
  if (linguettaClima) {
    const pagina = state.muro?.pagine?.[state.pagina];
    if (pagina) (state.zone ||= {})[pagina.id] = linguettaClima.dataset.muZona;
    disegna();
    return;
  }
  const bersaglio = event.target?.closest?.("[data-mu-fa],[data-mu-pagina],[data-mu-card]");
  if (!bersaglio) return;
  if (bersaglio.dataset.muPagina !== undefined) {
    state.pagina = Number(bersaglio.dataset.muPagina) || 0;
    state.finestra = null;
    disegna();
    return;
  }
  const fa = bersaglio.dataset.muFa;
  const id = bersaglio.dataset.muEntita || "";
  if (!fa && bersaglio.dataset.muCard !== undefined) {
    /* Il tocco sulla card, fuori dai suoi tasti: la finestra grande. Sul
     * pannello piccolo la luce si accende e si spegne col tocco, e la sua
     * finestra si apre tenendo premuto. */
    const entita = bersaglio.dataset.muEntita;
    if (state.tenuto) {
      state.tenuto = false;
      return;
    }
    if (entita && dominio(entita) === "light") {
      if (state.compatto) alterna(entita, "light", "toggle");
      else apriFinestra({ tipo: "luce", entita });
    } else if (entita && bersaglio.querySelector?.('[data-mu-fa="interruttore"]'))
      /* Una presa nella card della luce: non ha una finestra sua, il tocco
       * la accende e la spegne. */
      comanda(dominio(entita), "toggle", { entity_id: entita });
    else if (entita && dominio(entita) === "climate")
      apriFinestra({ tipo: "clima", entita, zona: zonaDiQui() });
    else if (entita && dominio(entita) === "cover") apriFinestra({ tipo: "tapparella", entita });
    return;
  }
  event.stopPropagation();
  switch (fa) {
    case "menu":
      /* Col blocco acceso il menu e' un'uscita come l'orologio: chiede il
       * codice. */
      if (state.muro?.blocco?.attivo) apriFinestra({ tipo: "codice", scopo: "menu", scritto: "" });
      else apriIlMenu();
      return;
    case "sveglia":
      state.riposo = false;
      disegna();
      return;
    case "fuori":
      if (event.target === bersaglio) chiudiFinestra();
      return;
    case "chiudi":
      chiudiFinestra();
      return;
    case "interruttore":
      /* Nella card della luce puo' esserci anche una presa: ognuno col suo
       * dominio, `light.toggle` su uno `switch` non fa niente. */
      alterna(id, dominio(id) || "light", "toggle");
      return;
    case "spegni":
      attendi(id, "acceso", false);
      comanda(dominio(id) || "light", "turn_off", { entity_id: id });
      chiudiFinestra();
      disegna();
      return;
    case "livello":
      attendi(id, "acceso", true);
      attendi(id, "luminosita", Number(bersaglio.dataset.muLivello));
      comanda("light", "turn_on", {
        entity_id: id,
        brightness_pct: Number(bersaglio.dataset.muLivello),
      });
      disegna();
      return;
    case "colore": {
      const [, rgb, kelvin] = COLORI[Number(bersaglio.dataset.muColore)] || [];
      comanda("light", "turn_on", {
        entity_id: id,
        ...(rgb ? { rgb_color: rgb } : { color_temp_kelvin: kelvin }),
      });
      return;
    }
    case "meno":
      cambiaTemperatura(id, -1);
      return;
    case "piu":
      cambiaTemperatura(id, 1);
      return;
    case "clima-acceso": {
      const s = String(stato(id)?.state || "off");
      if (s !== "off") alterna(id, "climate", "turn_off");
      else {
        const modi = (attributi(id).hvac_modes || []).filter((m) => m !== "off");
        if (modi.length)
          alterna(id, "climate", "set_hvac_mode", { entity_id: id, hvac_mode: modi[0] });
        else alterna(id, "climate", "turn_on");
      }
      return;
    }
    case "modo":
      apriFinestra({ tipo: "clima", entita: id, zona: zonaDiQui() });
      return;
    case "finestra-antifurto":
      apriFinestra({ tipo: "antifurto" });
      return;
    case "finestra-citofono":
      apriFinestra({ tipo: "citofono" });
      return;
    case "mp": {
      const l = letturaDelLettore({ entity: id }, allStates() || {});
      const cmd = bersaglio.dataset.muCmd;
      const servizio = comandoDelLettore(cmd, l);
      if (!servizio) return;
      const dati = { entity_id: id };
      if (cmd === "muto") dati.is_volume_muted = !l.mutato;
      if (cmd === "centro" && !l.spento) attendi(id, "suona", !l.suona);
      if ((cmd === "alza" || cmd === "abbassa") && l.volume !== null && l.puo.volume) {
        /* Un punto alla volta, come nella sezione Musica: il numero si vede
         * subito. */
        const dopo = Math.min(
          100,
          Math.max(0, Math.round(l.volume * 100) + (cmd === "alza" ? 2 : -2)),
        );
        attendi(id, "volume", dopo);
        comanda("media_player", "volume_set", { entity_id: id, volume_level: dopo / 100 });
        disegna();
        return;
      }
      comanda("media_player", servizio, dati);
      disegna();
      return;
    }
    case "mp-gruppo":
      apriFinestra({ tipo: "gruppo", entita: id });
      return;
    case "mp-unisci": {
      const capo = lettoreOra({ entita: id });
      const altro = bersaglio.dataset.muAltro;
      const servizio = servizioDelGruppo(capo, altro);
      if (!servizio) return;
      /* Il gruppo cambia subito sul tablet: quello vero lo conferma. */
      const compagni = compagniDelGruppo(capo);
      const dopo =
        servizio.service === "join"
          ? [capo.entity, ...compagni, altro]
          : [capo.entity, ...compagni.filter((x) => x !== altro)];
      attendi(id, "gruppo", dopo.length > 1 ? dopo : []);
      comanda("media_player", servizio.service, servizio.data);
      disegna();
      return;
    }
    case "mp-sciogli": {
      const capo = lettoreOra({ entita: id });
      for (const altro of compagniDelGruppo(capo))
        comanda("media_player", "unjoin", { entity_id: altro });
      attendi(id, "gruppo", []);
      chiudiFinestra();
      disegna();
      return;
    }
    case "mp-sorgente":
      comanda("media_player", "select_source", {
        entity_id: id,
        source: bersaglio.dataset.muSorgente,
      });
      return;
    case "mp-scegli": {
      const pagina = state.muro?.pagine?.[state.pagina];
      if (pagina) (state.lettori ||= {})[pagina.id] = id;
      disegna();
      return;
    }
    case "finestra-telecamera":
      apriFinestra({ tipo: "telecamera", entita: id });
      return;
    case "hvac":
      comanda("climate", "set_hvac_mode", { entity_id: id, hvac_mode: bersaglio.dataset.muModo });
      return;
    case "su":
      comanda("cover", "open_cover", { entity_id: id });
      return;
    case "ferma":
      comanda("cover", "stop_cover", { entity_id: id });
      return;
    case "giu":
      comanda("cover", "close_cover", { entity_id: id });
      return;
    case "azione":
      if (bersaglio.dataset.muConfermata) {
        const nome = bersaglio.dataset.muAzione;
        const servizio = servizioDellAzione(azioneDi(nome));
        chiudiFinestra();
        if (servizio) comanda(servizio.domain, servizio.service, servizio.data);
        state.attiva = nome;
        disegna();
      } else
        eseguiAzione(bersaglio.dataset.muAzione, {
          conferma: Boolean(bersaglio.dataset.muConferma),
        });
      return;
    case "allarme":
      allarme(bersaglio.dataset.muModo);
      return;
    case "entita": {
      const servizio = servizioDellEntita(id, String(stato(id)?.state || ""));
      if (!servizio) return;
      /* Accendi e spegni si vedono subito; un tasto o una scena no: non
       * restano accesi. */
      if (servizio.service === "toggle") alterna(id, servizio.domain, servizio.service);
      else comanda(servizio.domain, servizio.service, { entity_id: id });
      return;
    }
    case "apri": {
      const s = servizioDiApertura(id);
      comanda(s.domain, s.service, { entity_id: id });
      return;
    }
    case "cifra":
      cifra(bersaglio.dataset.muCifra);
      return;
    default:
  }
}

/* Il cursore: la barra della luce nella card, e la colonna nella finestra. */
function percentualeDalDito(event, barra, verticale, minimo = 1) {
  const r = barra.getBoundingClientRect();
  const p = verticale ? 1 - (event.clientY - r.top) / r.height : (event.clientX - r.left) / r.width;
  return Math.max(minimo, Math.min(100, Math.round(p * 100)));
}

function onPointerDown(event) {
  tocco();
  /* Un dito nuovo comincia da capo. La pressione lunga su una luce apre la
   * finestra e lascia il segno, perché il tocco che segue non la spenga; ma
   * il dito si alza sulla finestra, non sulla card, e quel tocco non arriva
   * mai: il segno restava, e mangiava il primo tocco dopo — il clima o la
   * tapparella non si aprivano. */
  state.tenuto = false;
  const barra = event.target?.closest?.("[data-mu-cursore]");
  if (barra) {
    const verticale = barra.dataset.muCursore === "luce-alta";
    state.trascina = {
      barra,
      id: barra.dataset.muEntita,
      verticale,
      volume: barra.dataset.muCursore === "volume",
    };
    barra.setPointerCapture?.(event.pointerId);
    onPointerMove(event);
    return;
  }
  /* Sul pannello piccolo, il dito tenuto su una luce apre la sua finestra. */
  const carta = event.target?.closest?.('[data-mu-card][data-mu-entita^="light."]');
  if (state.compatto && carta) {
    root.clearTimeout?.(state.pressione);
    state.pressione = root.setTimeout?.(() => {
      state.pressione = null;
      state.tenuto = true;
      apriFinestra({ tipo: "luce", entita: carta.dataset.muEntita });
    }, 600);
  }
  /* Il dito tenuto sull'orologio: l'uscita dal muro. */
  if (event.target?.closest?.("[data-mu-orologio]")) {
    root.clearTimeout?.(state.pressione);
    state.pressione = root.setTimeout?.(() => {
      state.pressione = null;
      if (state.muro?.blocco?.attivo)
        apriFinestra({ tipo: "codice", scopo: "uscita", scritto: "" });
      else apriIlConfigDelMuro();
    }, 2000);
  }
}

function onPointerMove(event) {
  const t = state.trascina;
  if (!t) return;
  const p = percentualeDalDito(event, t.barra, t.verticale, t.volume ? 0 : 1);
  t.valore = p;
  const riempi = t.barra.querySelector("i");
  if (riempi) riempi.style[t.verticale ? "height" : "width"] = `${p}%`;
  const pallino = t.barra.querySelector("u");
  if (pallino) pallino.style.left = `${p}%`;
  const scritta = t.barra.querySelector("b") || (t.volume && t.barra.nextElementSibling);
  if (scritta) scritta.textContent = `${p}%`;
}

function onPointerUp(event) {
  root.clearTimeout?.(state.pressione);
  state.pressione = null;
  const t = state.trascina;
  if (t) {
    state.trascina = null;
    if (t.volume && t.valore !== undefined) {
      attendi(t.id, "volume", t.valore);
      comanda("media_player", "volume_set", { entity_id: t.id, volume_level: t.valore / 100 });
    } else if (t.valore) {
      attendi(t.id, "acceso", true);
      attendi(t.id, "luminosita", t.valore);
      comanda("light", "turn_on", { entity_id: t.id, brightness_pct: t.valore });
    }
    disegna();
    return;
  }
  /* Niente swipe: «per cambiare sezione solo premere sul tab». Un dito che
   * scorre su un tablet a muro spesso non voleva cambiare pagina. */
}

/* ── il tempo che passa ──────────────────────────────────────────────────── */

function battito() {
  const muro = state.muro;
  if (!muro?.attiva) return;
  const fermo = Date.now() - state.toccato;
  const sonno = (muro.riposo.attivo ? muro.riposo.minuti : 0) * 60 * 1000;
  if (!state.riposo && !state.finestra && !state.trascina && sonno && fermo > sonno) {
    state.riposo = true;
    if (muro.riposo.torna !== false) state.pagina = 0;
  }
  if (!state.riposo && eNotte(muro) && fermo > 60 * 1000 && !state.finestra) {
    state.riposo = true;
    if (muro.riposo.torna !== false) state.pagina = 0;
  }
  disegna();
}

function svegliaSeServe(event) {
  const muro = state.muro;
  if (!state.riposo || !muro) return;
  const sensore = muro.risveglio.attivo ? muro.risveglio.entita : "";
  const centrali = [
    ...new Set([centraleDelMuro(muro.pagine[0]), ...(state.fonte?.centrali || [])].filter(Boolean)),
  ];
  const ids =
    event?.detail?.entity_ids || (event?.detail?.entity_id ? [event.detail.entity_id] : []);
  const tocca = (id) => !ids.length || ids.includes(id);
  if (
    (sensore && tocca(sensore) && String(stato(sensore)?.state) === "on") ||
    centrali.some((id) => tocca(id) && String(stato(id)?.state) === "triggered")
  ) {
    state.riposo = false;
    tocco();
  }
}

/* ── rileggere il config, la licenza e la fonte ──────────────────────────── */

export async function rileggi({ forza = false } = {}) {
  const muro = muroPulito(readJson(CHIAVE_MURO, null));
  state.muro = muro;
  if (!muro.attiva || !muro.pagine.length) {
    disegna();
    lasciaIlVelo();
    return;
  }
  /* Quello che si sapeva: il pannello si disegna subito, e le risposte del
   * ponte qui sotto lo correggono se serve. */
  const saputo = ricordo();
  if (
    state.premium === null &&
    saputo.premium === true &&
    typeof root.__GDAHOME_PREMIUM__ !== "boolean"
  )
    state.premium = true;
  if (
    !state.fonte &&
    saputo.fonte &&
    saputo.fonteDi === (muro.fonte || "primary") &&
    !root.__DM_MURO_FONTE__
  )
    state.fonte = saputo.fonte;
  if (state.premium === true && state.fonte) disegna();
  await premiumDellaCasa({ forza });
  if (state.premium === true) await fonteDelMuro(muro, { forza });
  if (state.premium === true && !kioskAttivo()) {
    try {
      setKioskMode(true);
    } catch (_errore) {}
  }
  ascoltaLaFonte();
  disegna();
  lasciaIlVelo();
}

function stili() {
  /* Le stesse regole valgono per il pannello e per la sua anteprima nel
   * config (`.mu-anteprima`). */
  const MURO = `:is(#${ID},.mu-anteprima)`;
  const tokens = (tema) =>
    tema === "dark"
      ? `--bg-sculpted:#0c1322;--card-bg:#161f36;--text:#e6edf7;--text-dim:#92a4c2;--dm-vetrino:rgba(255,255,255,.06);--dm-velo:14%;--dm-cuscino:22%;--dm-grana:.34`
      : `--bg-sculpted:#f0f4f8;--card-bg:#ffffff;--text:#0f172a;--text-dim:#64748b;--dm-vetrino:rgba(255,255,255,.72);--dm-velo:9%;--dm-cuscino:15%;--dm-grana:.5`;
  installStyle(
    "dm-muro-style",
    `
html.dm-muro-acceso,html.dm-muro-acceso body{overflow:hidden!important}
html.dm-solo-muro #editor-modal .ed-tabs,html.dm-solo-muro #editor-modal #dm-alberatura-famiglie,html.dm-solo-muro #editor-modal .dm-cerca-config,html.dm-solo-muro #editor-modal .dm-alberatura-titolo-famiglia{display:none!important}
#editor-modal .mu-tutto-il-config{display:none}
html.dm-solo-muro #editor-modal .mu-tutto-il-config{display:inline-flex;align-items:center;gap:6px;margin-right:8px;padding:8px 14px;border-radius:12px;border:none;background:var(--accent,#3b82f6);color:#fff;font-weight:800;font-size:13px;cursor:pointer}
html.dm-solo-muro #editor-modal .ed-body,html.dm-solo-muro #editor-modal #ed-body{margin-left:0!important;max-width:none!important}
${MURO}[data-mu-sotto-il-menu]{z-index:4!important}
#dm-muro{position:fixed;inset:0;z-index:2147482000}
${MURO}{overflow:hidden;color:var(--text);font-family:Inter,system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;-webkit-user-select:none;user-select:none;touch-action:manipulation;
  background:radial-gradient(120% 80% at 50% -10%,color-mix(in srgb,var(--card-bg) 70%,transparent),transparent 60%),var(--bg-sculpted)}
${MURO}[data-tema="dark"]{${tokens("dark")}}
${MURO}[data-tema="light"]{${tokens("light")}}
${MURO} *{box-sizing:border-box}
${MURO} button{font:inherit;color:inherit;border:0;background:none;cursor:pointer;text-align:inherit;-webkit-tap-highlight-color:transparent}
${MURO} .mu-tela{position:relative;transform-origin:0 0}
${MURO} .mu-pagina{display:grid;grid-template-rows:auto auto 1fr;gap:16px;padding:22px;height:100%}
${MURO} .mu-pag-scene,${MURO} .mu-pag-ingresso,${MURO} .mu-pag-personale,${MURO} .mu-pag-luci{grid-template-rows:auto 1fr}
${MURO} .mu-zone{display:flex;gap:8px;padding:6px;border-radius:18px;width:max-content;background:var(--dm-vetrino);border:1px solid color-mix(in srgb,var(--text) 10%,transparent)}
${MURO} .mu-zone button{display:flex;align-items:center;gap:10px;padding:10px 22px;border:0;border-radius:13px;background:none;color:var(--text-dim);font:800 17px Inter,system-ui,sans-serif;cursor:pointer}
${MURO} .mu-zone button.si{color:var(--text);background:color-mix(in srgb,var(--acc) 22%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 55%,transparent)}
${MURO} .mu-carta{position:relative;overflow:hidden;border-radius:24px;background:${FONDO_DELLA_CARTA};box-shadow:${OMBRA_DELLA_CARTA}}
${MURO} .mu-carta::before{${GRANA_DELLA_CARTA}}
${MURO} .mu-carta>*{position:relative}
${MURO} .mu-accesa{background:radial-gradient(135% 105% at 100% 0%,color-mix(in srgb,var(--acc) var(--dm-velo),transparent),transparent 66%),${FONDO_DELLA_CARTA};
  box-shadow:inset 0 1px 0 var(--dm-vetrino),inset 0 0 0 1px color-mix(in srgb,var(--acc) 34%,transparent),inset 0 -1px 0 color-mix(in srgb,var(--acc) 16%,transparent),0 1px 1px rgba(15,23,42,.05),0 18px 34px -16px color-mix(in srgb,var(--acc) 70%,rgba(15,23,42,.5))}
${MURO} .mu-chip{flex:0 0 auto;width:var(--c,52px);height:var(--c,52px);display:grid;place-items:center;border-radius:calc(var(--c,52px)*.36);
  background:linear-gradient(158deg,color-mix(in srgb,var(--text) 8%,var(--card-bg)),color-mix(in srgb,var(--text) 3%,var(--card-bg)));
  box-shadow:inset 0 1px 0 var(--dm-vetrino),inset 0 0 0 1px color-mix(in srgb,var(--text) 7%,transparent),inset 0 -3px 6px -4px color-mix(in srgb,var(--text) 30%,transparent),0 5px 11px -9px rgba(15,23,42,.8)}
${MURO} .mu-accesa .mu-chip,${MURO} .mu-chip.mu-acc{background:linear-gradient(158deg,color-mix(in srgb,var(--acc) var(--dm-cuscino),var(--card-bg)),color-mix(in srgb,var(--acc) 9%,var(--card-bg)));
  box-shadow:inset 0 1px 0 var(--dm-vetrino),inset 0 0 0 1px color-mix(in srgb,var(--acc) 32%,transparent),inset 0 -3px 7px -4px color-mix(in srgb,var(--acc) 55%,transparent),0 10px 18px -11px color-mix(in srgb,var(--acc) 90%,transparent)}
${MURO} .dm-oggetto{filter:drop-shadow(0 2px 3px rgba(15,23,42,.22))}
${MURO} .mu-et{font-size:12px;font-weight:900;letter-spacing:.11em;text-transform:uppercase;color:var(--text-dim)}
${MURO} .mu-osw{font-family:Oswald,Inter,sans-serif;font-weight:500;letter-spacing:-.01em;font-size:38px;line-height:1}
${MURO} .mu-stato{white-space:nowrap;font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--acc)}
${MURO} .mu-stato.spento{color:var(--text-dim)}
${MURO} .mu-tag{font-size:10px;font-weight:900;letter-spacing:.08em;padding:3px 8px;border-radius:7px;border:1px solid color-mix(in srgb,var(--acc) 45%,transparent);color:color-mix(in srgb,var(--acc) 85%,var(--text));background:color-mix(in srgb,var(--acc) 10%,transparent)}
${MURO} .mu-testa{display:flex;align-items:center;padding:18px 26px;gap:22px}
${MURO} .mu-menu{flex:0 0 auto;width:48px;height:48px;border-radius:16px;border:0;background:color-mix(in srgb,var(--text) 5%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 12%,transparent);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:0;cursor:pointer;color:inherit}
${MURO} .mu-menu span{display:block;width:20px;height:2px;border-radius:2px;background:var(--text)}
${MURO}[data-compatto="1"] .mu-menu{width:40px;height:40px;border-radius:13px}
${MURO} .mu-testa::after{content:"";position:absolute;left:24px;right:24px;bottom:0;height:2px;border-radius:2px;background:linear-gradient(90deg,var(--acc),#0ea5e9 60%,transparent)}
${MURO} .mu-tit{font-family:Oswald,Inter,sans-serif;font-weight:500;font-size:40px;line-height:1;letter-spacing:.02em;color:var(--acc);text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:420px}
${MURO} .mu-sot{margin-top:8px}
${MURO} .mu-pagine{display:flex;gap:6px;padding:5px;border-radius:16px;margin-left:auto;background:color-mix(in srgb,var(--text) 5%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 9%,transparent)}
${MURO} .mu-pagine button{display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:12px;font-weight:800;font-size:15px;color:var(--text-dim)}
${MURO} .mu-pagine button.si{background:color-mix(in srgb,var(--acc) 18%,var(--card-bg));color:color-mix(in srgb,var(--acc) 85%,var(--text));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 45%,transparent)}
${MURO} .mu-ora{margin-left:auto;display:flex;align-items:center;gap:22px;text-align:right}
${MURO} .mu-pagine+.mu-ora{margin-left:24px}
${MURO} .mu-h{font-family:Oswald,Inter,sans-serif;font-weight:500;font-size:58px;line-height:.9}
${MURO} .mu-d{font-size:12px;font-weight:900;letter-spacing:.11em;color:var(--text-dim);margin-top:6px}
${MURO} .mu-sep{width:1px;align-self:stretch;background:color-mix(in srgb,var(--text) 12%,transparent)}
${MURO} .mu-meteo{display:flex;align-items:center;gap:10px}
${MURO} .mu-meteo b{font-family:Oswald,Inter,sans-serif;font-weight:500;font-size:34px}
${MURO} .mu-meteo .mu-et{font-size:10px}
${MURO} .mu-pillole{display:flex;gap:26px;padding:14px 22px;align-items:center;flex-wrap:wrap;row-gap:12px}
${MURO} .mu-pill{display:flex;align-items:center;gap:12px}
${MURO} .mu-pill .mu-chip{--c:38px}
${MURO} .mu-pill b{font-size:20px;font-weight:800;display:block;line-height:1}
${MURO} .mu-pill .mu-et{font-size:10.5px}
${MURO} .mu-g6{--mu-col:3;--mu-righe:2;--mu-gap:16px;--mu-alto:150px;display:grid;grid-template-columns:repeat(var(--mu-col),minmax(0,1fr));grid-template-rows:repeat(var(--mu-righe),minmax(0,1fr));gap:var(--mu-gap);min-height:0}
${MURO} .mu-g6.mu-scorre{grid-template-rows:none;grid-auto-rows:calc((100% - var(--mu-gap) * (var(--mu-righe) - 1)) / var(--mu-righe));overflow-y:auto;scroll-snap-type:y proximity;overscroll-behavior:contain;scrollbar-width:none}
${MURO} .mu-pagine.mu-molte button:not(.si) span{display:none}
${MURO} .mu-pag-musica{grid-template-rows:auto 1fr}
${MURO} .mu-musica{display:grid;grid-template-columns:1.55fr 1fr;gap:16px;min-height:0}
${MURO} .mu-musica.solo{grid-template-columns:1fr}
${MURO} .mu-mp{padding:26px;display:flex;flex-direction:column;gap:20px;min-height:0}
${MURO} .mu-mp-fondo{position:absolute!important;inset:-40px;width:calc(100% + 80px);height:calc(100% + 80px);object-fit:cover;filter:blur(42px) saturate(1.3);opacity:.32;pointer-events:none}
${MURO} .mu-mp-testa{display:flex;align-items:center;gap:22px;min-width:0}
${MURO} .mu-mp-arte{flex:none;width:150px;height:150px;border-radius:22px;object-fit:cover;box-shadow:0 18px 34px -14px rgba(15,23,42,.55)}
${MURO} .mu-mp-arte-vuota{display:grid;place-items:center;background:color-mix(in srgb,var(--acc) 14%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 30%,transparent)}
${MURO} .mu-mp-dici{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
${MURO} .mu-mp-titolo{font-size:40px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-mp-dici .mu-sotto{font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-mp-testa>.mu-tondo{align-self:flex-start}
${MURO} .mu-mp-gruppo{align-self:flex-start;display:flex;align-items:center;gap:8px;height:56px;padding:0 18px;border-radius:999px;font-weight:800;font-size:15px;white-space:nowrap;background:color-mix(in srgb,var(--text) 5%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 12%,transparent)}
${MURO} .mu-mp-gruppo.si{color:#fff;background:var(--acc);box-shadow:0 10px 24px -10px var(--acc)}
${MURO} .mu-mp-gruppo-elenco{display:flex;flex-direction:column;gap:10px;max-height:52vh;overflow-y:auto}
${MURO} .mu-mp-gruppo-elenco .mu-mp-riga{text-align:left;width:100%}
${MURO} .mu-mp-gruppo-elenco .mu-inter.on{background:var(--acc)}
${MURO} .mu-mp-tempo{display:flex;align-items:center;gap:14px;font-size:14px;font-weight:800;color:var(--text-dim);font-variant-numeric:tabular-nums}
${MURO} .mu-mp-tempo .mu-bar{flex:1}
${MURO} .mu-mp-tasti{display:flex;align-items:center;justify-content:center;gap:34px;margin-top:auto}
${MURO} .mu-mp-tasti .mu-tondo.grande{width:104px;height:104px}
${MURO} .mu-mp-volume{display:flex;align-items:center;gap:14px}
${MURO} .mu-mp-cursore{flex:1}
${MURO} .mu-mp-pct{min-width:52px;text-align:right;font-size:18px;font-weight:800;font-variant-numeric:tabular-nums}
${MURO} .mu-mp-sorgenti{display:flex;gap:8px;flex-wrap:wrap}
${MURO} .mu-mp-sorgenti button{padding:10px 16px;border-radius:999px;font-weight:800;font-size:14px;color:var(--text-dim);background:color-mix(in srgb,var(--text) 5%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 10%,transparent)}
${MURO} .mu-mp-sorgenti button.si{color:color-mix(in srgb,var(--acc) 85%,var(--text));background:color-mix(in srgb,var(--acc) 16%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 45%,transparent)}
${MURO} .mu-mp-elenco{display:flex;flex-direction:column;gap:12px;min-height:0;overflow-y:auto;scrollbar-width:none}
${MURO} .mu-mp-riga{display:flex;align-items:center;gap:14px;padding:14px;cursor:pointer;flex:none}
${MURO} .mu-mp-riga.si{box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--acc) 60%,transparent),0 14px 28px -16px var(--acc)}
${MURO} .mu-mp-riga .mu-tondo{width:56px;height:56px}
${MURO} .mu-mp-riga .mu-sotto{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:8px}
${MURO} .mu-mp-mini{flex:none;width:64px;height:64px;border-radius:14px;object-fit:cover}
${MURO} .mu-mp-onde{display:inline-flex;align-items:flex-end;gap:2px;height:14px;flex:none}
${MURO} .mu-mp-onde b{width:3px;border-radius:2px;background:var(--acc);animation:mu-onda 1s ease-in-out infinite}
${MURO} .mu-mp-onde b:nth-child(2){animation-delay:-.4s}
${MURO} .mu-mp-onde b:nth-child(3){animation-delay:-.7s}
@keyframes mu-onda{0%,100%{height:4px}50%{height:14px}}
${MURO}[data-verso="verticale"] .mu-musica{grid-template-columns:1fr;grid-template-rows:auto 1fr}
${MURO}[data-compatto="1"] .mu-musica{grid-template-columns:1fr}
${MURO}[data-compatto="1"] .mu-mp-elenco,${MURO}[data-compatto="1"] .mu-mp-sorgenti{display:none}
${MURO}[data-compatto="1"] .mu-mp{padding:14px;gap:12px}
${MURO}[data-compatto="1"] .mu-mp-arte{width:72px;height:72px;border-radius:14px}
${MURO}[data-compatto="1"] .mu-mp-titolo{font-size:24px}
${MURO}[data-compatto="1"] .mu-mp-tasti{gap:16px}
${MURO}[data-compatto="1"] .mu-mp-tasti .mu-tondo.grande{width:72px;height:72px}
${MURO} .mu-fitta{--mu-gap:12px}
${MURO} .mu-fitta .mu-card{padding:16px;gap:10px;border-radius:20px}
${MURO} .mu-fitta .mu-riga1{gap:10px}
${MURO} .mu-fitta .mu-card .mu-disco{width:48px;height:48px}
${MURO} .mu-fitta .mu-card .mu-disco svg{width:24px;height:24px}
${MURO} .mu-fitta .mu-n{font-size:17px;white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
${MURO} .mu-fitta .mu-tag,${MURO} .mu-fitta .mu-modo,${MURO} .mu-fitta .mu-riga1>.mu-pasti{display:none}
${MURO} .mu-fitta .mu-inter{width:50px;height:30px}
${MURO} .mu-fitta .mu-inter i{width:22px;height:22px}
${MURO} .mu-fitta .mu-inter.on i{left:24px}
${MURO} .mu-fitta .mu-chip{--c:44px!important}
${MURO} .mu-fitta .mu-grande{font-size:48px}
${MURO} .mu-fitta .mu-tondo{width:52px;height:52px;font-size:24px}
${MURO} .mu-fitta .mu-comandi{gap:8px}
${MURO} .mu-fitta .mu-seg>button{height:52px;font-size:14px;gap:4px;padding:0 4px}
${MURO} .mu-fitta .mu-osw,${MURO} .mu-fitta .mu-tessera.grande .mu-osw{font-size:28px}
${MURO} .mu-pagine.mu-molte button{padding:10px 12px}
${MURO} .mu-pag-ambienti,${MURO} .mu-pag-telecamere,${MURO} .mu-pag-energia,${MURO} .mu-pag-tapparelle{grid-template-rows:auto 1fr}
${MURO} .mu-ambiente .mu-target{margin-top:auto;flex-wrap:wrap}
${MURO} .mu-cam{padding:8px}
${MURO} .mu-cam .mu-video{height:100%;min-height:0}
${MURO} .mu-energia .mu-grande{margin-top:auto;font-size:72px}
${MURO} .mu-anteprima{position:relative;width:1280px;height:800px;border-radius:18px;pointer-events:none;background:radial-gradient(120% 80% at 50% -10%,color-mix(in srgb,var(--card-bg) 70%,transparent),transparent 60%),var(--bg-sculpted)}
${MURO}.mu-anteprima[data-verso="verticale"]{width:800px;height:1280px}
${MURO}.mu-anteprima .mu-pagina{height:100%}
${MURO} .mu-g6.mu-scorre>*{scroll-snap-align:start}
/* Sul telefono i riquadri non si allungano a riempire lo schermo: «li trovo
   troppo grandi». Hanno un'altezza loro, e la pagina scorre se servono. */
${MURO}[data-compatto="1"][data-verso="verticale"] .mu-g6{grid-template-rows:none!important;grid-auto-rows:minmax(0,var(--mu-alto,150px))!important;align-content:start;overflow-y:auto;scrollbar-width:none}
${MURO} .mu-card{padding:22px;display:flex;flex-direction:column;gap:14px;min-height:0;width:100%}
${MURO} .mu-tessera{text-align:left}
${MURO} .mu-tessera .mu-osw{margin-top:auto}
${MURO} .mu-tessera.grande .mu-osw{font-size:46px}
${MURO} .mu-vuoto{align-items:center;justify-content:center;opacity:.55;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--text) 10%,transparent);background:transparent}
${MURO} .mu-vuoto::before{display:none}
${MURO} .mu-riga1{display:flex;align-items:center;gap:14px;min-width:0}
${MURO} .mu-riga1>.mu-pasti{margin-left:auto}
${MURO} .mu-nome{flex:1;min-width:0}
${MURO} .mu-n{font-size:21px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-stato-riga{display:flex;gap:8px;align-items:center;margin-top:6px}
${MURO} .mu-sotto{font-size:14px;font-weight:700;color:var(--text-dim)}
${MURO} .mu-disco{width:70px;height:70px;border-radius:50%;display:grid;place-items:center;flex:none;background:color-mix(in srgb,var(--text) 6%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 14%,transparent)}
${MURO} .mu-disco.on{background:radial-gradient(circle at 40% 35%,#ffe2b3,#fbbf24 55%,#f59e0b);box-shadow:0 0 0 1px #fcd34d88,0 0 28px -2px #f59e0bcc}
${MURO} .mu-inter{width:58px;height:34px;border-radius:17px;position:relative;flex:none;background:color-mix(in srgb,var(--text) 14%,var(--card-bg))}
${MURO} .mu-inter i{position:absolute;top:4px;left:4px;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.3);transition:left .18s ease}
${MURO} .mu-inter.on{background:linear-gradient(90deg,#fbbf24,#f59e0b)}
${MURO} .mu-inter.on i{left:28px}
${MURO} .mu-giu{margin-top:auto}
${MURO} .mu-giu-et{display:flex;justify-content:space-between;margin-bottom:12px}
${MURO} .mu-giu-et .mu-et{font-size:10.5px}
${MURO} .mu-bar{height:10px;border-radius:6px;background:color-mix(in srgb,var(--text) 12%,transparent);position:relative;touch-action:none}
${MURO} [data-mu-cursore].mu-bar{height:34px;background:transparent}
${MURO} [data-mu-cursore].mu-bar::before{content:"";position:absolute;left:0;right:0;top:12px;height:10px;border-radius:6px;background:color-mix(in srgb,var(--text) 12%,transparent)}
${MURO} .mu-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:6px;background:var(--acc)}
${MURO} [data-mu-cursore].mu-bar i{top:12px;height:10px}
${MURO} .mu-bar u{position:absolute;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:#fff;box-shadow:0 0 0 3px var(--acc),0 3px 6px rgba(0,0,0,.35)}
${MURO} .mu-pasti{display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:999px;font-size:11.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--acc);background:color-mix(in srgb,var(--acc) 14%,transparent);white-space:nowrap}
${MURO} .mu-pasti::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
${MURO} .mu-modo{padding:12px 16px;font-size:13px;border:1px solid color-mix(in srgb,var(--acc) 40%,transparent)}
${MURO} .mu-target{display:flex;align-items:baseline;gap:10px}
${MURO} .mu-grande{font-size:66px;font-weight:800;letter-spacing:-.03em;color:var(--acc);line-height:1}
${MURO} .mu-target .mu-et{font-size:10.5px}
${MURO} .mu-comandi{margin-top:auto;display:flex;align-items:center;gap:12px}
${MURO} .mu-spazio{flex:1}
${MURO} .mu-tondo{width:68px;height:68px;flex:none;border-radius:50%;display:grid;place-items:center;font-size:30px;text-align:center;background:color-mix(in srgb,var(--text) 5%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 12%,transparent)}
${MURO} .mu-tondo.grande{width:96px;height:96px;font-size:42px}
${MURO} .mu-tondo.pieno{background:var(--acc);color:#fff;box-shadow:0 10px 24px -8px var(--acc)}
${MURO} .mu-seg{display:flex;padding:6px;gap:6px;border-radius:20px;margin-top:auto;background:color-mix(in srgb,var(--text) 4%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 8%,transparent)}
${MURO} .mu-seg>button{flex:1;height:64px;border-radius:15px;display:flex;align-items:center;justify-content:center;gap:10px;font-weight:800;font-size:17px;color:var(--text-dim);text-align:center}
${MURO} .mu-seg>button.si{background:color-mix(in srgb,var(--acc) 16%,var(--card-bg));color:color-mix(in srgb,var(--acc) 80%,var(--text));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 45%,transparent),0 8px 18px -10px var(--acc)}
${MURO} .mu-btn{height:72px;border-radius:20px;display:flex;align-items:center;justify-content:center;gap:12px;font-weight:800;font-size:19px;background:color-mix(in srgb,var(--text) 5%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 10%,transparent)}
${MURO} .mu-btn.pieno{--acc:#0ea5e9;background:linear-gradient(180deg,color-mix(in srgb,var(--acc) 90%,#fff),var(--acc));color:#fff;box-shadow:0 12px 26px -10px var(--acc),inset 0 1px 0 rgba(255,255,255,.3)}
${MURO} .mu-due{display:grid;grid-template-columns:1fr 1fr;gap:12px}
${MURO} .mu-ingresso{display:grid;grid-template-columns:1fr 1.1fr;grid-template-rows:1fr auto;gap:16px;min-height:0}
${MURO} .mu-allarme{padding:24px;display:flex;flex-direction:column;gap:18px}
${MURO} .mu-stato-allarme{font-size:52px;color:var(--acc);margin-top:6px}
${MURO} .mu-avviso-finestre{display:flex;align-items:center;gap:8px;margin-top:8px}
${MURO} .mu-modi{--acc:#e11d48}
${MURO} .mu-nota{font-size:10.5px;text-align:center}
${MURO} .mu-citofono{padding:18px;display:flex;flex-direction:column;gap:14px}
${MURO} .mu-video{flex:1;border-radius:16px;position:relative;overflow:hidden;min-height:120px;background:radial-gradient(120% 90% at 30% 20%,#2a3550,#0b1020)}
${MURO} .mu-video img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
${MURO} .mu-video-vuoto{position:absolute;inset:0;display:grid;place-items:center;opacity:.5}
${MURO} .mu-live{position:absolute;left:14px;top:14px;padding:6px 12px;border-radius:999px;background:#000a;color:#fff;font-size:11.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
${MURO} .mu-piede{grid-column:1/-1;display:grid;grid-template-columns:1.5fr 1fr;gap:16px}
${MURO} .mu-piede .mu-card{padding:16px 22px}
${MURO} .mu-velo{position:absolute;inset:0;display:grid;place-items:center;background:rgba(5,8,15,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);z-index:5}
${MURO} .mu-finestra{width:min(880px,92%);padding:30px}
${MURO} .mu-fin-luce{display:grid;grid-template-columns:200px 1fr;gap:30px;align-items:center}
${MURO} .mu-colonna{width:120px;height:420px;margin:auto;border-radius:36px;position:relative;overflow:hidden;touch-action:none;background:color-mix(in srgb,var(--text) 10%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 10%,transparent)}
${MURO} .mu-colonna i{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,#fcd34d,#f59e0b)}
${MURO} .mu-colonna b{position:absolute;left:0;right:0;top:45%;text-align:center;font-family:Oswald,Inter,sans-serif;font-weight:500;font-size:30px;mix-blend-mode:difference;color:#fff}
${MURO} .mu-fin-dx{display:flex;flex-direction:column;gap:22px}
${MURO} .mu-fin-dx .mu-seg{margin-top:12px}
${MURO} .mu-colori{display:flex;gap:14px;margin-top:12px;flex-wrap:wrap}
${MURO} .mu-colori button{width:58px;height:58px;border-radius:50%;box-shadow:inset 0 0 0 1px #0002}
${MURO} .mu-fin-clima,${MURO} .mu-fin-codice,${MURO} .mu-fin-conferma{display:flex;flex-direction:column;gap:24px}
${MURO} .mu-fin-clima .mu-seg{margin-top:0}
${MURO} .mu-fin-temp{display:flex;align-items:center;justify-content:center;gap:40px}
${MURO} .mu-fin-conferma{text-align:center;align-items:center}
${MURO} .mu-fin-conferma .mu-due{width:100%}
${MURO} .mu-puntini{font-size:30px;letter-spacing:.3em;margin-top:6px;min-height:36px}
${MURO} .mu-tasti{display:grid;grid-template-columns:repeat(3,96px);gap:16px;justify-content:center}
${MURO} .mu-tasti .mu-tondo{width:96px;height:96px;font-size:32px;font-weight:700}
${MURO} .mu-riposo{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#05080f;color:#dbe4f3}
${MURO} .mu-riposo.notte{background:#000}
${MURO} .mu-deriva{position:absolute;left:50%;top:50%;transform:translate(calc(-50% + var(--sx,0px)),calc(-50% + var(--sy,0px)));display:flex;flex-direction:column;align-items:center;gap:14px;width:max-content;max-width:96%;animation:mu-appari 1.8s ease both}
@keyframes mu-appari{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){${MURO} .mu-deriva{animation:none}}
${MURO} .mu-deriva .mu-avvisi{position:static;padding:0;margin-bottom:10px}
${MURO} .mu-deriva .mu-tocca{position:static;margin-top:14px}
${MURO} .mu-riposo-riga .mu-attenzione{color:#fbbf24}
${MURO} .mu-orologione{font-size:240px;line-height:.9}
${MURO} .mu-data{font-size:18px;letter-spacing:.2em}
${MURO} .mu-riposo-riga{display:flex;flex-wrap:wrap;justify-content:center;gap:16px 40px;margin-top:22px;color:#92a4c2;font-weight:700;font-size:20px}
${MURO} .mu-riposo-riga span{display:flex;align-items:center;gap:10px}
${MURO} .mu-tocca{position:absolute;bottom:28px;opacity:.6}
${MURO} .mu-riposo-aree{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;max-width:90%;margin-top:14px;color:#92a4c2;font-weight:700;font-size:20px;text-align:center}
${MURO} .mu-riposo-aree b{color:#dbe4f3;font-weight:800}
${MURO} .mu-riposo-aree .grave,${MURO} .mu-riposo-aree .grave b{color:#fda4af}
${MURO} .mu-riposo-aree i{font-style:normal;opacity:.6}
${MURO}[data-compatto="1"] .mu-riposo-aree{font-size:15px;gap:6px}
${MURO} .mu-avvisi{position:absolute;top:28px;left:0;right:0;display:flex;justify-content:center;gap:12px;flex-wrap:wrap;padding:0 20px}
${MURO} .mu-avviso{display:flex;align-items:center;gap:12px;padding:12px 20px 12px 12px;border-radius:999px;font-size:16px}
${MURO} .mu-avviso.grave b{color:#fda4af}
${MURO}[data-compatto="1"] .mu-pagina{padding:10px;gap:10px;grid-template-rows:auto 1fr}
${MURO}[data-compatto="1"] .mu-pag-clima{grid-template-rows:auto auto 1fr}
${MURO}[data-compatto="1"] .mu-zone button{padding:8px 14px;font-size:14px}
${MURO}[data-compatto="1"] .mu-testa{padding:10px 14px;gap:10px;flex-wrap:nowrap}
${MURO}[data-compatto="1"] .mu-tit{font-size:26px;max-width:150px}
${MURO}[data-compatto="1"] .mu-sot,${MURO}[data-compatto="1"] .mu-meteo,${MURO}[data-compatto="1"] .mu-sep,${MURO}[data-compatto="1"] .mu-pillole,${MURO}[data-compatto="1"] .mu-d{display:none}
${MURO}[data-compatto="1"] .mu-h{font-size:32px}
${MURO}[data-compatto="1"] .mu-pagine{order:0;width:auto;margin:0 0 0 auto;padding:3px;gap:3px}
${MURO}[data-compatto="1"] .mu-pagine button{padding:8px;flex:none}
${MURO}[data-compatto="1"] .mu-pagine button span{display:none}
${MURO}[data-compatto="1"] .mu-ora{margin-left:10px}
${MURO}[data-compatto="1"] .mu-g6{--mu-gap:10px}
${MURO}[data-compatto="1"] .mu-card{padding:12px;gap:8px;border-radius:18px}
${MURO}[data-compatto="1"] .mu-card .mu-riga1{flex-wrap:wrap;gap:8px;align-content:flex-start}
${MURO}[data-compatto="1"] .mu-card .mu-nome{flex:1 1 100%}
${MURO}[data-compatto="1"] .mu-card .mu-n{font-size:16px;white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
${MURO}[data-compatto="1"] .mu-card .mu-disco{width:44px;height:44px}
${MURO}[data-compatto="1"] .mu-card .mu-disco svg{width:22px;height:22px}
${MURO}[data-compatto="1"] .mu-card .mu-chip{--c:44px!important}
${MURO}[data-compatto="1"] .mu-card .mu-chip .dm-oggetto{width:26px!important;height:26px!important}
${MURO}[data-compatto="1"] .mu-card .mu-giu,${MURO}[data-compatto="1"] .mu-card .mu-bar,${MURO}[data-compatto="1"] .mu-card .mu-seg,${MURO}[data-compatto="1"] .mu-card .mu-comandi,${MURO}[data-compatto="1"] .mu-card .mu-tag,${MURO}[data-compatto="1"] .mu-card .mu-inter,${MURO}[data-compatto="1"] .mu-card .mu-target .mu-et,${MURO}[data-compatto="1"] .mu-tessera .mu-sotto:empty{display:none}
${MURO}[data-compatto="1"] .mu-card .mu-target{margin-top:auto}
${MURO}[data-compatto="1"] .mu-card .mu-grande{font-size:34px}
${MURO}[data-compatto="1"] .mu-card .mu-riga1>.mu-pasti{display:none}
${MURO}[data-compatto="1"] .mu-tessera .mu-osw,${MURO}[data-compatto="1"] .mu-tessera.grande .mu-osw{font-size:24px}
${MURO}[data-compatto="1"] .mu-tessera .mu-et{font-size:10px}
${MURO}[data-compatto="1"] .mu-tessera .mu-sotto{font-size:12px}
${MURO}[data-compatto="1"] .mu-finestra{width:94%;padding:16px;border-radius:20px}
${MURO}[data-compatto="1"] .mu-fin-luce{grid-template-columns:110px 1fr;gap:14px}
${MURO}[data-compatto="1"] .mu-colonna{width:90px;height:250px;border-radius:26px}
${MURO}[data-compatto="1"] .mu-fin-dx{gap:12px}
${MURO}[data-compatto="1"] .mu-fin-dx .mu-riga1 .mu-disco{display:none}
${MURO}[data-compatto="1"] .mu-colori{gap:8px}
${MURO}[data-compatto="1"] .mu-colori button{width:38px;height:38px}
${MURO}[data-compatto="1"] .mu-seg>button{height:52px;font-size:15px}
${MURO}[data-compatto="1"] .mu-seg-alto{flex-direction:column}
${MURO}[data-compatto="1"] .mu-seg-alto>button{flex:none}
${MURO}[data-compatto="1"] .mu-btn{height:56px;font-size:16px}
${MURO}[data-compatto="1"] .mu-tondo{width:52px;height:52px;font-size:24px}
${MURO}[data-compatto="1"] .mu-tondo.grande{width:72px;height:72px;font-size:32px}
${MURO}[data-compatto="1"] .mu-fin-temp{gap:16px}
${MURO}[data-compatto="1"] .mu-fin-temp .mu-grande{font-size:60px!important}
${MURO}[data-compatto="1"] .mu-fin-clima,${MURO}[data-compatto="1"] .mu-fin-codice,${MURO}[data-compatto="1"] .mu-fin-conferma{gap:14px}
${MURO}[data-compatto="1"] .mu-tasti{grid-template-columns:repeat(3,64px);gap:10px}
${MURO}[data-compatto="1"] .mu-tasti .mu-tondo{width:64px;height:64px;font-size:24px}
${MURO}[data-compatto="1"] .mu-video-fin{flex:none;height:200px}
${MURO}[data-compatto="1"] .mu-orologione{font-size:110px}
${MURO}[data-compatto="1"] .mu-data{font-size:13px}
${MURO}[data-compatto="1"] .mu-riposo-riga{flex-direction:column;gap:10px;align-items:center;font-size:15px}
${MURO}[data-compatto="1"] .mu-avviso{font-size:13px}
${MURO}[data-verso="verticale"] .mu-testa{flex-wrap:wrap}
${MURO}[data-verso="verticale"] .mu-pagine{order:3;width:100%;margin:6px 0 4px}
${MURO}[data-verso="verticale"] .mu-pagine button{flex:1;justify-content:center}
${MURO}[data-verso="verticale"] .mu-meteo,${MURO}[data-verso="verticale"] .mu-sep{display:none}
${MURO}[data-verso="verticale"] .mu-ora{margin-left:auto}
${MURO}[data-verso="verticale"] .mu-ingresso{grid-template-columns:1fr;grid-template-rows:auto 1fr auto}
${MURO}[data-verso="verticale"] .mu-piede{grid-template-columns:1fr 1fr}
${MURO}[data-verso="verticale"] .mu-fin-luce{grid-template-columns:1fr}
${MURO}[data-verso="verticale"] .mu-colonna{height:300px}
${MURO}[data-verso="verticale"] .mu-orologione{font-size:180px}
${MURO}[data-verso="verticale"] .mu-riposo-riga{flex-direction:column;gap:14px;align-items:center}
`,
  );
}

/* ─── In tempo reale: l'orecchio sul bus di casa ────────────────────────────
 *
 * «Gli aggiornamenti devono essere in tempo reale.» Quando una plancia salva
 * la sua configurazione, il ponte lo dice sul bus di Home Assistant
 * (`dashboardmodern_config`, col profilo). Il pannello ascolta con lo stesso
 * socket del guscio, come la chat dell'assistenza, e se il profilo e' quello
 * da cui legge rilegge subito la fonte. A ogni evento di stato si controlla
 * che l'ascolto sia ancora attaccato: una riconnessione del guscio butta via
 * i gestori in attesa. */
export const EVENTO_DELLA_CONFIGURAZIONE = "dashboardmodern_config";
const orecchio = { id: 0, socket: null, gestore: null, controllato: 0 };

/** Se un messaggio del socket dice che la configurazione di `profilo` e' cambiata. */
export function eCambiataLaFonte(messaggio, profilo) {
  if (messaggio?.type !== "event") return false;
  const evento = messaggio.event;
  if (evento?.event_type !== EVENTO_DELLA_CONFIGURAZIONE) return false;
  return clean(evento?.data?.profile || "primary") === clean(profilo || "primary");
}

function ascoltaLaFonte() {
  const socket = lexicalGlobal("ws");
  const pending = lexicalGlobal("pendingWsCallbacks");
  if (!socket || socket.readyState !== 1 || !pending) return false;
  if (orecchio.id && orecchio.socket === socket && pending[orecchio.id] === orecchio.gestore)
    return true;
  let id;
  try {
    id = root.eval("msgId++");
  } catch (_errore) {
    return false;
  }
  if (!Number.isFinite(Number(id))) return false;
  const gestore = (messaggio) => {
    if (!state.muro?.attiva) return;
    /* La plancia di questo tablet: la si ripristina (il config del muro
     * cambiato da un altro telefono), e il ripristino rilegge il muro. */
    if (eCambiataLaFonte(messaggio, currentProfile())) root.cdSyncPull?.();
    else if (eCambiataLaFonte(messaggio, state.muro.fonte))
      rileggi({ forza: true }).catch(() => {});
  };
  gestore.keepAlive = true;
  pending[id] = gestore;
  try {
    socket.send(
      JSON.stringify({ id, type: "subscribe_events", event_type: EVENTO_DELLA_CONFIGURAZIONE }),
    );
  } catch (_errore) {
    delete pending[id];
    return false;
  }
  Object.assign(orecchio, { id, socket, gestore });
  return true;
}

function controllaLOrecchio() {
  const adesso = Date.now();
  if (adesso - orecchio.controllato < 10000) return;
  orecchio.controllato = adesso;
  if (state.muro?.attiva) ascoltaLaFonte();
}

export function installPlanciaAMuro() {
  if (!doc || state.installed) return false;
  state.installed = true;
  stili();
  trattieniIlVelo();
  agganciaIlConfig();
  const ancora = () => rileggi().catch(() => {});
  root.addEventListener?.("dashboardmodern:legacy-ready", agganciaIlConfig);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:muro",
  ])
    root.addEventListener?.(evento, ancora);
  root.addEventListener?.("dashboardmodern:states-ready", () => disegna());
  root[IN_VISTA_KEY] = eInVista;
  root.addEventListener?.("dashboardmodern:state-changed", (event) => {
    controllaLOrecchio();
    svegliaSeServe(event);
    confermaLeAttese(event);
    /* Un mazzetto che non tocca niente di quello che si vede non ridisegna:
     * su un tablet economico la casa che parla di continuo si sente. */
    const ids = event?.detail?.entity_ids || [];
    if (ids.length && !ids.some(eInVista)) return;
    disegna();
  });
  root.addEventListener?.("resize", () => disegna());
  /* Un salvataggio del config, e il tablet che torna acceso: la fonte si
   * rilegge subito. */
  for (const evento of ["dashboardmodern:persistence-saved", "dashboardmodern:store-user-write"])
    root.addEventListener?.(evento, () => {
      if (state.muro?.attiva) ancora();
    });
  doc.addEventListener?.("visibilitychange", () => {
    if (doc.visibilityState === "visible" && state.muro?.attiva)
      rileggi({ forza: true }).catch(() => {});
  });
  root.addEventListener?.("storage", (event) => {
    if (String(event?.key || "").endsWith(CHIAVE_MURO)) ancora();
  });
  root.dmMuro = {
    rileggi: (opzioni) => rileggi(opzioni),
    configDelMuro: () => apriIlConfigDelMuro(),
    esci: () => {
      state.uscito = true;
      disegna();
    },
    torna: () => {
      state.uscito = false;
      state.riposo = false;
      tocco();
      rileggi().catch(() => {});
    },
    riposa: () => {
      state.riposo = true;
      state.pagina = 0;
      state.finestra = null;
      disegna();
    },
    stato: () => ({ ...state, trascina: null }),
  };
  ancora();
  return true;
}

senzaCadere(installPlanciaAMuro);
