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
import { quickClimatePresetOf, quickClimateSteps } from "../core/quick-climate.js";
import {
  coppiaDelTermostato,
  coppiaSpostata,
  eUnTermostatoACoppia,
  obiettiviDelClima,
  obiettivoDaMuovere,
} from "../core/i-due-obiettivi-del-clima.js";
import { disegnoDelCatalogo } from "../core/catalogo-disegni.js";
import {
  classeDelFondo,
  fondoMarkup,
  immaginePulita,
  riquadroConImmagineMarkup,
} from "../core/immagine-del-riquadro.js";
import { DISEGNI_DA_RIQUADRO } from "../core/disegni-da-riquadro.js";
import {
  ALARM_DISARM,
  ALARM_MODES,
  alarmActiveMode,
  alarmActiveModeWithCustom,
  alarmCodeNeeded,
  alarmVisibleModes,
} from "../core/alarm-panel.js";
import {
  chiamataDelModo,
  ilCodiceApreIlModo,
  ilModoChiedeIlCodice,
  normalizzaModiSuMisura,
  eScattatoAdesso,
} from "../core/antifurto-su-misura.js";
import { ingressiDellaCentrale } from "../core/le-zone-della-centrale.js";
import { varchiDiCasa } from "../core/varchi-di-casa.js";
import {
  FONDO_DELLA_CARTA,
  GRANA_DELLA_CARTA,
  OMBRA_DELLA_CARTA,
} from "../core/le-vesti-della-carta.js";
import { climaScalda } from "../core/device-model.js";
import { segnoDelTempo } from "../core/la-card-del-meteo.js";
import {
  adessoDelMeteo,
  foglioDelMeteo,
  parolaDellaCondizione,
  previsioniDelMeteo,
  sensoriDellaStazione,
  stazioneDelMeteo,
  storiaDellaStazione,
  vistaDelMeteo,
} from "./meteo-section.js";
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
  areeDellIngresso,
  avvisiAccesi,
  lettureDellIngresso,
  chiamateDelFermaTutto,
  gruppiDelMixer,
  letturaDelCanale,
  menuDiLato,
  pulsanteAcceso,
  pulsanteDiceLoStato,
  pulsantiDellaPagina,
  servizioDelFader,
  servizioDelMuto,
  servizioDelPasso,
  servizioDelPulsante,
  servizioDellaTelecamera,
  servizioDelTasto,
  statoDeiDueTasti,
  temperaturaDelMuro,
  valoreDallaPosizione,
  derivaDelRiposo,
  batteriaDalBrowser,
  batteriaDelTablet,
  comandiDellaPagina,
  eCompatto,
  eNotte,
  chiCeVicino,
  eNotteDellaLuce,
  livelloDellaLuce,
  eUnaScena,
  MODELLI_ELENCO,
  ambientiDellaFonte,
  altreMisureDellaPagina,
  energiaDellaPagina,
  entitaDelMeteoDelMuro,
  meteoDelMuro,
  potenzaConIlSegno,
  grigliaPer,
  fonteDaiValori,
  grigliaDellaPagina,
  lettoriDellaPagina,
  postiDellaPagina,
  telecamereDellaFonte,
  fonteDalleSezioni,
  muroPulito,
  nomeDellaPersonaDelMuro,
  personeDelMuro,
  pinGiusto,
  scala,
  tastiDellaTapparella,
  temaDelMomento,
  verso,
} from "../core/plancia-a-muro.js";
import { kioskAttivo, setKioskMode } from "./beta12-room-color-lock-section.js";
import {
  comandoDelDispositivo,
  genereDelComando,
  partiDelComando,
} from "../core/comandi-accanto.js";
import { comandoDelTelecomando, tastiDelTelecomando } from "../core/telecomando.js";
import { piattaformeConosciute } from "./di-chi-e-unentita-section.js";
import { bridgeRequest, currentProfile } from "./config-persistence-section.js";
import { loadCameraFrame } from "./live-ui-section.js";
import {
  campanelloSuona as squilloDelCampanello,
  conLaFoto,
  conLoSquillo,
  durataScritta,
  faseDelloSquillo,
  finestraDaChiudere,
  opzioniDelCampanello,
  quantoFa,
  ricordoDelCampanello,
  schermoSempreAcceso,
  storiaPulita,
} from "../core/il-campanello-a-muro.js";
import {
  ascoltaIlPrimoTocco,
  fermaIlCampanello,
  suonaIlCampanello as suonaIlSuono,
  suonoBloccato,
} from "./il-suono-del-campanello.js";
import { avviaWebRtcNativo } from "./telecamera-webrtc-section.js";
import { consiglioInCima } from "./assistente-di-casa-section.js";
import { apriLoSfoglio } from "./media-player-section.js";
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
  writeJsonIfChanged,
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
  /* Quello che il browser del tablet dice della sua batteria, se lo dice. */
  batteria: null,
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

/** Quello che questo dispositivo ha saputo l'ultima volta della licenza:
 * `true`, `false`, o `undefined` se non l'ha mai chiesto. Serve a chi si
 * disegna prima che il ponte risponda (il «Colpo d'occhio»). */
export function premiumRicordato() {
  if (typeof root.__GDAHOME_PREMIUM__ === "boolean") return root.__GDAHOME_PREMIUM__;
  return ricordo().premium;
}

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
      energy: section("energy", {}),
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
      rapidoGlobale: readJson("cd_clima_rapido", null),
      rapidoPerUnita: readJson("cd_clima_rapido_unita", {}),
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
  /* E i campanelli: lo squillo deve arrivare anche se non si disegnano. */
  if (eUnCampanello(chiave)) return true;
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
  if (clean(dispositivo?.name)) return clean(dispositivo.name);
  /* Una persona si chiama col nome che ha nella scheda Persone, come in Home. */
  const ha = attributi(id);
  return nomeDellaPersonaDelMuro(id, fonte, allStates() || {}) || clean(ha.friendly_name) || id;
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

/* Il disegno di un'azione: quello scelto nel config, o quello delle scene.
 *
 * Qui il tablet lo indovinava dal nome — «luci» la lampadina, «cinema» la
 * cassa — e le scene di Home Assistant scelte come entita' avevano invece
 * sempre il loro. Due tessere che fanno la stessa cosa uscivano diverse: «Luci
 * salone» con la lampadina, «Modo cinema» con la cassa, la stessa scena scelta
 * come entita' con il disegno delle scene. «Perche' ci sono due icone diverse?
 * Sono due scene praticamente uguali.» Adesso una scena e' una scena, comunque
 * la si scelga; chi ne vuole uno suo lo sceglie nel campo «Icona». */
function disegnoDellAzione(_azione, scelto = "") {
  return clean(scelto) || "azioni";
}

/* ── i comandi verso Home Assistant ──────────────────────────────────────── */

function comanda(domain, service, data) {
  try {
    chiamaServizio({ domain, service, data });
  } catch (_errore) {}
  if (root.navigator?.vibrate) root.navigator.vibrate(8);
}

/* I menu a tendina: non si accendono, hanno delle voci. */
const MENU = new Set(["select", "input_select"]);

/* Far partire un'azione della plancia di origine: lo stesso servizio che
 * sceglierebbe la plancia per quell'entita'. */
export function servizioDellAzione(azione) {
  if (!azione || !eUnaScena(azione)) return null;
  /* L'entita' di un'azione puo' essere scritta col suo nome breve: la
   * plancia la risolve prima di chiamare (`resolveEntity`), e qui si fa lo
   * stesso, se no il dominio non si legge e parte un «accendi/spegni» che
   * Home Assistant accetta e non esegue. */
  let id = clean(azione.entity);
  try {
    id = clean(root.resolveEntity?.(id) || id);
  } catch (_errore) {}
  const d = dominio(id);
  /* Un menu a tendina senza una voce fissata nell'azione: la voce si sceglie
   * adesso, come sul telefono. Prima partiva un «toggle», e il tasto non
   * faceva niente. */
  if (MENU.has(d) && !clean(azione.option)) return { scegli: id };
  if (d === "scene" || d === "script")
    return { domain: d, service: "turn_on", data: { entity_id: id } };
  if (d === "button" || d === "input_button")
    return { domain: d, service: "press", data: { entity_id: id } };
  if (MENU.has(d))
    return { domain: d, service: "select_option", data: { entity_id: id, option: clean(azione.option) } };
  if (d === "lock") return { domain: d, service: "unlock", data: { entity_id: id } };
  return { domain: "homeassistant", service: "toggle", data: { entity_id: id } };
}

function eseguiAzione(nome, { conferma = false } = {}) {
  const azione = azioneDi(nome);
  const servizio = servizioDellAzione(azione);
  if (!servizio) return;
  if (servizio.scegli) {
    apriFinestra({ tipo: "scelte", entita: servizio.scegli, azione: nome });
    return;
  }
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
  meteo: t("Meteo", "Weather"),
  mixer: t("Audio", "Audio"),
  telecamera: t("Telecamera", "Camera"),
  comandi: t("Comandi", "Controls"),
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
  meteo: t("Adesso · Ora per ora · Prossimi giorni", "Now · Hour by hour · Next days"),
  mixer: t("Livelli e muto di ogni canale", "Level and mute for every channel"),
  telecamera: t("Movimento · Zoom · Preset", "Pan · Zoom · Presets"),
  comandi: t("Avvio e spegnimento", "Start and shutdown"),
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
  meteo: "meteo",
  mixer: "media",
  telecamera: "telecamere",
  comandi: "azioni",
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
  meteo: "#0ea5e9",
  mixer: "#f59e0b",
  telecamera: "#0ea5e9",
  comandi: "#10b981",
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

/* Prima quello scelto per il tablet, poi quello della config della plancia
 * di origine, poi `weather.home` come fa la plancia, e solo alla fine il
 * primo che c'e' (`entitaDelMeteoDelMuro`). */
function entitaDelMeteo() {
  const fisso = clean(state.muro?.meteo) || clean(state.fonte?.meteo);
  if (!fisso) segnaDominio("weather");
  return entitaDelMeteoDelMuro(state.muro, state.fonte || {}, allStates() || {});
}

function meteo() {
  const id = entitaDelMeteo();
  if (!id) return null;
  const s = stato(id);
  return { temperatura: s?.attributes?.temperature, condizione: s?.state };
}

/* La temperatura «in casa» del tablet: il sensore scelto (`riposo.sensore`),
 * o quello della stanza della prima pagina. E' la stessa che il riposo
 * mostrava gia' accanto al meteo; con «Temperatura mostrata: da un sensore in
 * casa» (`muro.temperatura === "casa"`) prende anche il posto della
 * temperatura del meteo, in alto accanto all'ora. Un numero solo, da un posto
 * solo: in alto e sul riposo non possono dire due «in casa» diversi. */
/* Quale sensore, e se e' di fuori, lo decide il nucleo (`temperaturaDelMuro`):
 * una stanza all'aperto non e' «in casa». Restituisce `{ testo, fuori }`, il
 * testo vuoto se il sensore non dice un numero. */
function temperaturaInCasa(muro) {
  const { sonda, fuori } = temperaturaDelMuro(muro, state.fonte || {});
  if (sonda) segna(sonda);
  const n = sonda ? numero(stato(sonda)?.state) : null;
  return { testo: n === null ? "" : `${decimale(n)}°`, fuori };
}
/* La parola sotto il numero: «in casa», o «fuori» per la sonda del terrazzo. */
const doveDellaTemperatura = (fuori) => (fuori ? t("fuori", "outside") : t("in casa", "inside"));

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

/* Sul pannello piccolo un titolo lungo si stringe invece di finire coi
 * puntini: «LA MIA PAGI…» non dice niente. */
function titoloLungo(titolo) {
  if (!state.compatto) return "";
  const lettere = String(titolo || "").length;
  return lettere > 12 ? " mu-tit-xl" : lettere > 8 ? " mu-tit-l" : "";
}

/* Il sottotitolo: quello del tipo di pagina, e per il Meteo con la stazione
 * quello della pagina Meteo della plancia. */
function sottoDellaPagina(pagina) {
  if (pagina.modello === "meteo" && Object.keys(sensoriDellaStazione()).length)
    return t("Adesso · La mia stazione · Previsioni", "Now · My station · Forecast");
  return SOTTO()[pagina.modello];
}

function testa(pagina, muro) {
  const o = orologio();
  /* Sulla pagina Meteo il meteo in alto ripeterebbe in piccolo quello che la
   * pagina dice in grande: resta solo la temperatura di casa, se e' quella
   * scelta, che la pagina non dice. */
  const suMeteo = pagina.modello === "meteo";
  const m = pagina.riga?.meteo !== false ? meteo() : null;
  /* «Temperatura mostrata»: quella del meteo, o quella di casa. Con quella di
   * casa il disegno e la parola del meteo restano (dicono che tempo fa fuori),
   * e sotto il numero c'e' scritto «in casa», perche' nessuno lo scambi per
   * quella di fuori. Il disegno sta sulla riga del numero, attaccato: se stesse
   * accanto alla colonna, una scritta lunga («in casa · poco nuvoloso») la
   * allargherebbe e lo staccherebbe dal numero. La scritta sta su una riga
   * sola, e quando non c'e' posto finisce coi puntini. */
  const sensore =
    pagina.riga?.meteo !== false && muro.temperatura === "casa"
      ? temperaturaInCasa(muro)
      : { testo: "", fuori: false };
  const inCasa = sensore.testo;
  const parolaDelMeteo = m ? PAROLE_DEL_METEO()[m.condizione] || "" : "";
  const chipDelMeteo = inCasa
    ? `<div class="mu-meteo mu-meteo-casa" data-mu-temperatura="casa"><div class="mu-meteo-su">${m ? disegno("meteo", 44, "testa-meteo") : disegno("temperatura", 40, "testa-temp")}<b>${esc(inCasa)}</b></div><div class="mu-et">${esc([doveDellaTemperatura(sensore.fuori), parolaDelMeteo].filter(Boolean).join(" · "))}</div></div><span class="mu-sep"></span>`
    : m && !suMeteo && numero(m.temperatura) !== null
      ? `<div class="mu-meteo" data-mu-temperatura="meteo"><div class="mu-meteo-su">${disegno("meteo", 44, "testa-meteo")}<b>${decimale(m.temperatura, 0)}°</b></div><div class="mu-et">${esc(parolaDelMeteo)}</div></div><span class="mu-sep"></span>`
      : "";
  const accento = accentoDi(pagina);
  /* Le linguette col nome finche' ci stanno: da un 4 pollici a un 15 lo
   * spazio cambia di tanto, e su uno grande cinque pagine non sono troppe.
   * Lo decide `adattaLeLinguette`, che le misura dopo il disegno. */
  /* Col menu di lato le pagine stanno nella colonna a sinistra, e il ☰ con
   * loro: la testa resta col titolo, il meteo e l'ora. */
  const lato = menuDiLato(muro, state.verso, state.compatto);
  const linguette =
    !lato && muro.pagine.length > 1
      ? `<div class="mu-pagine" role="tablist">${muro.pagine
          .map(
            (p, i) =>
              `<button type="button" role="tab" class="${i === state.pagina ? "si" : ""}" style="--acc:${accentoDi(p)}" aria-label="${esc(titoloDi(p))}" data-mu-pagina="${i}" aria-selected="${i === state.pagina}">${disegno(clean(p.disegno) || DISEGNO_DEL_MODELLO[p.modello], 22, `ling-${p.id}`)}<span>${esc(titoloDi(p))}</span></button>`,
          )
          .join("")}</div>`
      : "";
  return `<div class="mu-carta mu-testa${lato ? " mu-testa-lato" : ""}" style="--acc:${accento}">
    ${lato ? "" : tastoDelMenu()}
    <div class="mu-titolo"><div class="mu-tit${titoloLungo(titoloDi(pagina))}">${esc(titoloDi(pagina))}</div><div class="mu-et mu-sot">${esc(sottoDellaPagina(pagina))}</div></div>
    ${linguette}
    <div class="mu-ora" data-mu-orologio>${chipDelMeteo}<div><div class="mu-h">${esc(o.ora)}</div><div class="mu-d">${esc(o.giorno)}</div></div></div>
  </div>`;
}

const tastoDelMenu = () =>
  `<button type="button" class="mu-menu" data-mu-fa="menu" aria-label="${esc(t("Apri il menu", "Open the menu"))}"><span></span><span></span><span></span></button>`;

/* Il menu di lato: «una colonna di tasti grandi a sinistra, come sui
 * pannelli di regia». Ogni pagina e' un tasto col suo disegno e il suo nome,
 * quella aperta e' accesa nel suo colore; in cima il ☰. */
function menuLaterale(muro) {
  return `<nav class="mu-lato" role="tablist">${tastoDelMenu()}${muro.pagine
    .map(
      (p, i) =>
        `<button type="button" role="tab" class="mu-lato-tasto${i === state.pagina ? " si" : ""}" style="--acc:${accentoDi(p)}" aria-label="${esc(titoloDi(p))}" data-mu-pagina="${i}" aria-selected="${i === state.pagina}">${disegno(clean(p.disegno) || DISEGNO_DEL_MODELLO[p.modello], 46, `lato-${p.id}`)}<span>${esc(titoloDi(p))}</span></button>`,
    )
    .join("")}</nav>`;
}

/* La pagina intera, col menu di lato se c'e': la usano il pannello e la sua
 * anteprima nel config. */
function paginaIntera(pagina, muro) {
  const lato = menuDiLato(muro, state.verso, state.compatto);
  return `<div class="mu-pagina mu-pag-${pagina.modello}${lato ? " mu-con-lato" : ""}">${lato ? menuLaterale(muro) : ""}${testa(pagina, muro)}${corpoDellaPagina(pagina)}</div>`;
}

const STATI_DELL_ALLARME = () => ({
  /* «Metterei disattivo»: l'antifurto non si spegne, si disattiva. */
  disarmed: t("Disattivo", "Disarmed"),
  /* «Quando c'e' antifurto inserito non devi scrivere fuori ma metti
   * inserito e al massimo il nome della partizione inserita. Tipo se e' notte
   * scrivi inserito notte.» Lo stato dice che l'antifurto e' inserito, e come;
   * «Fuori» resta la parola del tasto (`PAROLE_DEI_MODI`), che e' un gesto:
   * scritto come stato, accanto all'ora, sembrava dire dov'era la gente. */
  armed_home: t("Inserito casa", "Armed home"),
  armed_away: t("Inserito", "Armed"),
  armed_night: t("Inserito notte", "Armed night"),
  armed_vacation: t("Inserito vacanza", "Armed vacation"),
  armed_custom_bypass: t("Inserito parziale", "Armed partial"),
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

/* Lo stato di una centrale sola in parole, coi modi scritti a mano: se la
 * centrale e' inserita e il tasto acceso e' uno di quelli scritti a mano
 * (antifurto-su-misura.js), «Inserito Giardino» dice di piu' di «Inserito». */
function statoDellaCentrale(s) {
  const valore = String(s?.state || "");
  if (valore.startsWith("armed_")) {
    const mio = modoSuMisura(tastoAcceso(s, tastiDellAntifurto(s)));
    if (mio) return `${t("Inserito", "Armed")} ${mio.nome || mio.id}`;
  }
  return STATI_DELL_ALLARME()[valore] || valore;
}

/* Le aree dell'antifurto di una pagina: quelle scelte nell'Ingresso, o la
 * centrale scritta come prima, o tutte quelle della plancia di origine
 * (`areeDellIngresso`). */
function areeDellaPagina(pagina) {
  return areeDellIngresso(pagina, state.fonte || {});
}

function centraleDelMuro(pagina) {
  return areeDellaPagina(pagina)[0]?.entita || state.fonte?.centrali?.[0] || "";
}

/* Il nome di un'area: quello della sezione Sicurezza, o quello che le da'
 * Home Assistant, o «Area 2». */
const nomeDellArea = (area, i = 0) =>
  clean(area?.nome) ||
  clean(stato(area?.entita)?.attributes?.friendly_name) ||
  `${t("Area", "Area")} ${i + 1}`;

/* Il colore di uno stato dell'antifurto: verde spento, rosso che suona,
 * ambra mentre cambia, indaco inserito. */
function accentoDellAllarme(valore) {
  if (valore === "triggered") return ACCENTI.allarme;
  if (valore === "disarmed") return "#10b981";
  if (["arming", "pending", "disarming"].includes(valore)) return "#f59e0b";
  if (!valore || valore === "unavailable" || valore === "unknown") return "#64748b";
  return "#6366f1";
}

/* Le parole di uno stato dell'antifurto, anche quando la centrale non c'e'. */
const parolaDellAllarme = (valore) =>
  !valore || valore === "unavailable" || valore === "unknown"
    ? t("Non disponibile", "Unavailable")
    : STATI_DELL_ALLARME()[valore] || valore;

/* I tasti di un'area quando le aree sono piu' d'una: quelli che la sua
 * centrale accetta, meno quelli tolti in configurazione. I tasti scritti a
 * mano non sono di un'area: stanno in una fila loro, sotto. */
function tastiDellArea(s) {
  const a = state.fonte?.antifurto || {};
  return alarmVisibleModes(s || null, a.tolte || [], []).map((voce) => ({
    ...voce,
    label: PAROLE_DEI_MODI()[voce.mode] || voce.mode,
  }));
}

const quanteInserite = (inserite, tutte) =>
  t(`${inserite} di ${tutte} inserite`, `${inserite} of ${tutte} armed`);
const quanteAree = (quante) => t(`Antifurto · ${quante} aree`, `Alarm · ${quante} areas`);

/* Le aree tutte insieme, in una parola: «Disattivo», «Fuori» se sono tutte
 * fuori, «ALLARME» se ne suona una, «2 di 3 inserite» altrimenti. */
function riassuntoDelleAree(aree) {
  const valori = aree.map((a) => String(stato(a.entita)?.state || ""));
  const suona = aree.filter((_a, i) => valori[i] === "triggered");
  if (suona.length) return { valore: "triggered", testo: STATI_DELL_ALLARME().triggered, suona };
  const lette = valori.filter((v) => v && v !== "unavailable" && v !== "unknown");
  if (!lette.length) return { valore: "", testo: parolaDellAllarme(""), suona };
  if (lette.every((v) => v === lette[0]) && lette.length === valori.length)
    return { valore: lette[0], testo: parolaDellAllarme(lette[0]), suona };
  const inserite = lette.filter((v) => v.startsWith("armed_")).length;
  const cambia = lette.find((v) => ["arming", "pending", "disarming"].includes(v));
  if (cambia && !inserite) return { valore: cambia, testo: parolaDellAllarme(cambia), suona };
  return {
    valore: inserite ? "armed_custom_bypass" : "disarmed",
    testo: inserite ? quanteInserite(inserite, valori.length) : parolaDellAllarme("disarmed"),
    suona,
  };
}

/* Un'area nella card dell'antifurto: il suo nome e il suo stato a sinistra,
 * i suoi tasti a destra. Ogni tasto dice a quale area va. */
function rigaDellArea(area, i) {
  const s = stato(area.entita);
  const valore = String(s?.state || "");
  const modi = tastiDellArea(s);
  const attivo = alarmActiveMode(
    valore,
    modi.map((m) => m.mode),
  );
  return `<div class="mu-area${valore === "triggered" ? " grave" : ""}" style="--acc:${accentoDellAllarme(valore)}" data-mu-area="${esc(area.entita)}">
    <div class="mu-area-dice"><b class="mu-area-nome">${esc(nomeDellArea(area, i))}</b><span class="mu-area-stato"><i></i>${esc(parolaDellAllarme(valore))}</span></div>
    ${
      s
        ? `<div class="mu-seg mu-modi mu-modi-area">${modi
            .map(
              (m) =>
                `<button type="button" class="${m.mode === attivo ? "si" : ""}" data-mu-fa="allarme" data-mu-modo="${esc(m.mode)}" data-mu-area="${esc(area.entita)}">${esc(m.label)}</button>`,
            )
            .join("")}</div>`
        : ""
    }
  </div>`;
}

/* I tasti scritti a mano (antifurto-su-misura.js), quando le aree sono piu'
 * d'una: non sono di nessuna, e stanno in una fila loro. */
function tastiSuMisuraMarkup() {
  const miei = alarmVisibleModes(null, [], state.fonte?.antifurto?.suMisura || []).filter(
    (voce) => voce.suMisura,
  );
  if (!miei.length) return "";
  const acceso = alarmActiveModeWithCustom(
    null,
    miei.map((m) => m.mode),
    state.fonte?.antifurto?.suMisura || [],
    allStates() || {},
  );
  return `<div class="mu-seg mu-modi mu-modi-area mu-modi-miei">${miei
    .map(
      (m) =>
        `<button type="button" class="${m.mode === acceso ? "si" : ""}" data-mu-fa="allarme" data-mu-modo="${esc(m.mode)}">${esc(m.label)}</button>`,
    )
    .join("")}</div>`;
}

/* Le aree una sotto l'altra, per la card e per la sua finestra. */
function areeMarkup(aree) {
  const codice = aree.some((a) => {
    const s = stato(a.entita);
    return s && alarmCodeNeeded(s, "alarm_arm_away");
  });
  return `<div class="mu-aree" data-quante="${Math.min(aree.length, 4)}">${aree.map(rigaDellArea).join("")}${tastiSuMisuraMarkup()}</div>${
    codice
      ? `<div class="mu-et mu-nota">${esc(t("Il codice si chiede prima di inserire", "The code is asked before arming"))}</div>`
      : ""
  }`;
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

/* Chi e' in casa, coi nomi che la card Persone della plancia gli da'. */
function personeInCasa() {
  const persone = personeDelMuro(state.fonte, allStates() || {});
  persone.entita.forEach(segna);
  return persone;
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

/* ── i riquadri con l'immagine ──────────────────────────────────────────
 *
 * «Riquadri con l'immagine»: un posto puo' portare una foto di casa o un
 * disegno da riquadro (`immagine-del-riquadro.js`) che lo riempie tutto. Il
 * riquadro e' lo stesso per la luce, per un'entita' qualunque, per una scena
 * e per un cancello: l'immagine, il velo scuro in fondo col nome e lo stato
 * in bianco, e in alto a destra il comando in vetro — l'interruttore, o il
 * tasto «Apri». Il tocco resta quello della card di sempre: gli stessi
 * `data-mu-…`, quindi chi ascolta i tocchi non sa che e' cambiato il vestito.
 * Il clima, la tapparella e i due tasti hanno troppi comandi per un'immagine,
 * e restano come sono. */
function cardConImmagine(
  c,
  i,
  {
    nome,
    stato: parola,
    acceso: on,
    accento,
    destra = "",
    dati = "",
    tag = "div",
    classi = "",
    comandi = "",
  },
) {
  if (!immaginePulita(c?.immagine)) return "";
  return vestito({
    immagine: c.immagine,
    nome,
    stato: parola,
    acceso: on,
    accento,
    destra,
    comandi,
    tag,
    classi: `mu-card mu-rq ${classi}`.trim(),
    attributi: `data-mu-card="${i}" ${dati}`,
  });
}

/* Le tessere delle pagine che non hanno posti — l'energia, la musica, il
 * meteo, l'ingresso, i preset della telecamera — portano la loro immagine
 * nella pagina stessa (`immagini`, per chiave di tessera: «casa», «adesso»,
 * «lettore:media_player.sala», «preset:0»). Si posa come fondo: la tessera
 * resta com'e', coi suoi numeri e i suoi tasti, e il velo li fa leggere. */
function immagineDellaTessera(chiave) {
  return immaginePulita(state.muro?.pagine?.[state.pagina]?.immagini?.[chiave]);
}
const classeDellaTessera = (chiave) => classeDelFondo(immagineDellaTessera(chiave));
const fondoDellaTessera = (chiave) => fondoMarkup(immagineDellaTessera(chiave));

/* Tutti i riquadri con l'immagine del muro passano di qui. Quando l'editor
 * chiede la faccia di un posto (`facciaDelPosto`), qui si ferma quello che il
 * riquadro direbbe — lo stato, il comando in alto a destra — e l'anteprima
 * del blocco «Immagine» dice quello che dira' il tablet: «76 %» per la
 * batteria, ON e OFF per i due tasti, non un «Acceso» per tutti. */
let facciaPresa = null;
function vestito(argomenti) {
  if (facciaPresa) facciaPresa.presa ||= argomenti;
  return riquadroConImmagineMarkup(argomenti);
}

/* Un tasto in vetro sopra l'immagine: i due tasti, le frecce della tapparella.
 * `dati` sono quelli del tocco di sempre, `classi` dicono quale e com'e'. */
const tastoDiVetro = ({ classi = "", dati = "", scritta, etichetta, extra = "" }) =>
  `<button type="button" class="dm-rq-dt ${classi}" ${dati} aria-label="${esc(etichetta)}"${extra}>${scritta}</button>`;
/* L'interruttore in vetro: un tasto vero nella card della luce, un segno
 * dentro le tessere (che sono gia' un tasto, e un tasto dentro un tasto non
 * si fa). */
const interruttoreDiVetro = (id, on, etichetta) =>
  `<button type="button" class="dm-rq-int ${on ? "on" : ""}" data-mu-fa="interruttore" data-mu-entita="${esc(id)}" aria-pressed="${on}" aria-label="${esc(etichetta)}"><i></i></button>`;
const segnoDiVetro = (vetro) =>
  vetro?.tipo === "int"
    ? `<span class="dm-rq-int ${vetro.on ? "on" : ""}" aria-hidden="true"><i></i></span>`
    : vetro?.tipo === "tasto"
      ? `<span class="dm-rq-tasto" aria-hidden="true"><b></b>${esc(vetro.testo)}</span>`
      : "";

function cardLuce(c, i) {
  const id = c.entita;
  const on = acceso(id);
  const pct = luminosita(id);
  const dimmer = dimmerabile(id);
  const manca = !stato(id);
  const conImmagine = cardConImmagine(c, i, {
    nome: nomeDi(id, c.nome),
    stato: manca
      ? t("Non trovata", "Not found")
      : on
        ? dimmer
          ? `${t("Accesa", "On")} · ${pct}%`
          : t("Accesa", "On")
        : t("Spenta", "Off"),
    acceso: on,
    accento: ACCENTI.luce,
    destra: interruttoreDiVetro(id, on, nomeDi(id, c.nome)),
    dati: `data-mu-entita="${esc(id)}"`,
    /* La luminosita' resta: la barra di sempre, sul velo sotto lo stato. */
    comandi: dimmer
      ? `<div class="mu-bar dm-rq-barra" data-mu-cursore="luce" data-mu-entita="${esc(id)}" aria-label="${esc(t("Luminosità", "Brightness"))}"><i style="width:${on ? pct : 0}%"></i>${on ? `<u style="left:${pct}%"></u>` : ""}</div>`
      : "",
  });
  if (conImmagine) return conImmagine;
  /* La luce nella forma della famiglia (`tessera`): il disco e lo stato in
   * alto, l'interruttore in alto a destra, il nome grande in fondo. La barra
   * della luminosita' viene sotto il nome, e se la casella e' bassa se ne va
   * prima del nome (`@container` negli stili). */
  return `<div class="mu-carta mu-card mu-fam mu-luce ${on ? "mu-accesa" : ""}" style="--acc:${ACCENTI.luce}" data-mu-card="${i}" data-mu-entita="${esc(id)}">
    <div class="mu-riga1"><span class="mu-disco ${on ? "on" : ""}">${bulbo(on ? "#1f2937" : "var(--text-dim)")}</span><span class="mu-stato ${on ? "" : "spento"}">${esc(manca ? t("Non trovata", "Not found") : on ? (dimmer ? `${t("Accesa", "On")} · ${pct}%` : t("Accesa", "On")) : t("Spenta", "Off"))}</span>
      <button type="button" class="mu-inter ${on ? "on" : ""}" data-mu-fa="interruttore" data-mu-entita="${esc(id)}" aria-pressed="${on}" aria-label="${esc(nomeDi(id, c.nome))}"><i></i></button></div>
    <div class="mu-osw mu-fam-nome mu-n">${esc(nomeDi(id, c.nome))}</div>
    ${
      dimmer
        ? `<div class="mu-giu"><div class="mu-giu-et"><span class="mu-et">${esc(t("Luminosità", "Brightness"))} <span class="mu-tag">DIMMER</span></span><span class="mu-stato ${on ? "" : "spento"}">${on ? `${pct}%` : "—"}</span></div>
      <div class="mu-bar" data-mu-cursore="luce" data-mu-entita="${esc(id)}"><i style="width:${pct}%"></i>${on ? `<u style="left:${pct}%"></u>` : ""}</div></div>`
        : ""
    }</div>`;
}

/* ── il riquadro dei due tasti ───────────────────────────────────────────
 *
 * «Se ci fosse un on e off di uno switch che sono due entita' separate, si
 * potrebbe nei riquadri smezzarlo e fare in uno unico on e off? Unico nome,
 * ma con ON e OFF uno a destra e uno a sinistra.» La forma e' quella della
 * luce (`cardLuce`): il disco e lo stato in alto a sinistra, il nome grande in
 * fondo; in alto a destra, al posto dell'interruttore, due tasti — ON a
 * sinistra, OFF a destra — e ognuno manda il suo comando alla sua entita'
 * (`servizioDelTasto` nel nucleo). Il tocco sul riquadro fuori dai tasti non
 * apre niente: la card non ha un'entita' sola a cui aprire la finestra.
 *
 * Lo stato, se c'e' da dove leggerlo (`statoDeiDueTasti`), si vede come sulla
 * luce: «Accesa» col disco illuminato e il tasto ON pieno d'ambra, «Spenta»
 * col tasto OFF schiarito. Se non c'e' — due pulsanti e basta — il riquadro
 * dice «Comando», e per un paio di secondi dopo il tocco «✓ Inviato», col
 * tasto premuto cerchiato: senza, chi preme non saprebbe se e' partito. */
const INVIATO_PER = 2000;
/* Acceso come lo dice l'entita' dello stato: quello che conta per la luce
 * (`acceso`), e in piu' i sensori che dicono «in casa», «aperta», «suona». */
const accesoDeiDueTasti = (id) =>
  typeof state.inAttesa[id]?.acceso === "boolean"
    ? state.inAttesa[id].acceso
    : accesoVero(id) || ["home", "unlocked", "playing"].includes(String(stato(id)?.state));
const chiaveDeiDueTasti = (c) => `${c.entita}|${c.entitaOff}`;

function cardDueTasti(c, i) {
  const letto = statoDeiDueTasti(c);
  const nome = clean(c.nome) || nomeDi(c.entita);
  const manca = letto && !stato(letto);
  const sa = Boolean(letto) && !manca;
  const on = sa && accesoDeiDueTasti(letto);
  const inviato = !sa ? state.inviati?.[chiaveDeiDueTasti(c)] || "" : "";
  /* Il disegno: quello scelto, o la lampadina se non se n'e' scelto uno —
   * e' la stessa della luce, che col disco acceso si illumina. */
  const icona = clean(c.disegno)
    ? disegno(clean(c.disegno), 30, `dt-${i}`)
    : bulbo(on ? "#1f2937" : "var(--text-dim)");
  const parola = manca
    ? t("Non trovata", "Not found")
    : sa
      ? on
        ? t("Accesa", "On")
        : t("Spenta", "Off")
      : inviato
        ? `✓ ${t("Inviato", "Sent")}`
        : t("Comando", "Command");
  /* `forma` e' «mu-tasto» sulla card di sempre, «dm-rq-dt» in vetro sopra
   * l'immagine: il tocco e' lo stesso, cambia solo il vestito. */
  const tasto = (verso, id, scritta, etichetta, forma = "mu-tasto") => {
    const classi = [
      forma,
      `${forma}-${verso}`,
      sa && verso === "on" && on ? "si" : "",
      sa && verso === "off" && !on ? "si" : "",
      inviato === verso ? "premuto" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `<button type="button" class="${classi}" data-mu-fa="duetasti" data-mu-verso="${verso}" data-mu-entita="${esc(id)}" data-mu-stato="${esc(sa ? letto : "")}" data-mu-chiave="${esc(chiaveDeiDueTasti(c))}"${sa ? ` aria-pressed="${verso === "on" ? on : !on}"` : ""} aria-label="${esc(etichetta)}">${scritta}</button>`;
  };
  const accendi = `${t("Accendi", "Turn on")} ${nome}`;
  const spegni = `${t("Spegni", "Turn off")} ${nome}`;
  /* Con l'immagine: ON e OFF in vetro in alto a destra, al posto
   * dell'interruttore; il nome e lo stato sul velo in fondo. Il tocco fuori
   * dai tasti non apre niente, come sulla card di sempre: la card non porta
   * `data-mu-entita`. */
  const conImmagine = cardConImmagine(c, i, {
    nome,
    stato: parola,
    acceso: on,
    accento: ACCENTI.luce,
    destra: `<div class="dm-rq-due">${tasto("on", c.entita, "ON", accendi, "dm-rq-dt")}${tasto("off", c.entitaOff, "OFF", spegni, "dm-rq-dt")}</div>`,
    classi: "mu-duetasti",
  });
  if (conImmagine) return conImmagine;
  return `<div class="mu-carta mu-card mu-fam mu-duetasti ${on ? "mu-accesa" : ""}" style="--acc:${ACCENTI.luce}" data-mu-card="${i}">
    <div class="mu-riga1"><span class="mu-disco ${on ? "on" : ""}">${icona}</span><span class="mu-stato ${on ? "" : "spento"}${inviato ? " mu-inviato" : ""}">${esc(parola)}</span>
      <div class="mu-due">${tasto("on", c.entita, "ON", accendi)}${tasto("off", c.entitaOff, "OFF", spegni)}</div></div>
    <div class="mu-osw mu-fam-nome mu-n">${esc(nome)}</div></div>`;
}

/* Il tocco su un tasto dei due: il suo comando, e il riquadro che lo mostra
 * subito — acceso o spento se sa lo stato, «✓ Inviato» se non lo sa. */
function premiIlTasto(bersaglio) {
  const { muEntita: id, muVerso: verso, muStato: letto, muChiave: chiave } = bersaglio.dataset;
  const servizio = servizioDelTasto(id);
  if (!servizio) return;
  if (letto) attendi(letto, "acceso", verso === "on");
  else if (chiave) {
    const inviati = (state.inviati ||= {});
    inviati[chiave] = verso;
    root.clearTimeout?.((state.timerDegliInviati ||= {})[chiave]);
    state.timerDegliInviati[chiave] = root.setTimeout?.(() => {
      delete inviati[chiave];
      disegna();
    }, INVIATO_PER);
  }
  comanda(servizio.domain, servizio.service, servizio.data);
  disegna();
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
/* Le velocita' della ventola come le dice Home Assistant, in parole. */
const PAROLE_DELLA_VENTOLA = () => ({
  auto: t("auto", "Auto"),
  low: t("bassa", "low"),
  medium: t("media", "medium"),
  middle: t("media", "medium"),
  high: t("alta", "high"),
  quiet: t("silenziosa", "quiet"),
  turbo: t("turbo", "Turbo"),
});
const AZIONI_DEL_CLIMA = () => ({
  heating: t("Riscalda", "Heating"),
  cooling: t("Raffresca", "Cooling"),
  drying: t("Deumidifica", "Drying"),
  fan: t("Ventila", "Fan"),
  idle: t("In pausa", "Idle"),
  off: t("Spento", "Off"),
});

/* Gli obiettivi di un'unita' del clima come li vede il muro: uno solo, o la
 * coppia caldo-freddo dei termostati che Home Assistant mostra con due numeri
 * (22 e 40: sotto il primo scalda, sopra il secondo raffresca). La regola e'
 * quella del nucleo (core/i-due-obiettivi-del-clima.js), la stessa della
 * pagina Clima e della Home; qui ci si mette sopra soltanto la coppia appena
 * toccata e non ancora confermata, come il numero solo ha `temperatura`: il
 * tablet la mostra subito, e non torna indietro mentre il comando viaggia. */
function obiettiviDelMuro(id) {
  const lettura = obiettiviDelClima(attributi(id), stato(id)?.state);
  const attesa = state.inAttesa[id]?.coppia;
  if (!lettura.doppio || !attesa) return lettura;
  return Object.freeze({
    ...lettura,
    basso: attesa.target_temp_low,
    alto: attesa.target_temp_high,
  });
}

/* E' un termostato a coppia? Allora sta nella linguetta «Termostato» e ha la
 * sua card, coi due numeri insieme. La regola e' del nucleo. */
const aCoppia = (id) => eUnTermostatoACoppia(attributi(id));

/* I due numeri di un termostato a coppia, qualunque sia la modalita' — la
 * card della linguetta Termostato li mostra sempre tutti e due — con sopra la
 * coppia appena toccata e non ancora confermata. `null` se Home Assistant non
 * li pubblica tutti e due. */
function coppiaDelMuro(id) {
  const vera = coppiaDelTermostato(attributi(id));
  const attesa = state.inAttesa[id]?.coppia;
  if (!vera || !attesa) return vera;
  return Object.freeze({ ...vera, basso: attesa.target_temp_low, alto: attesa.target_temp_high });
}

/* Quale dei due estremi muove un meno o un piu' che non dice quale. Sulla
 * card e nella finestra del termostato ogni tasto lo dice (`data-mu-estremo`);
 * questo resta per chi non lo dice: in caldo e in freddo quello della
 * modalita', altrimenti quello della linguetta da cui si guarda. */
function estremoDelMuro(id, lettura, zona = zonaDiQui(id)) {
  return obiettivoDaMuovere(lettura, "", zona === "caldo" ? "basso" : "alto");
}

/* Il numero che il meno e il piu' muovono: il solo, o l'estremo scelto. */
function obiettivo(id, zona) {
  if (state.inAttesa[id]?.temperatura !== undefined) return state.inAttesa[id].temperatura;
  const lettura = obiettiviDelMuro(id);
  if (!lettura.doppio) return lettura.singolo;
  const quale = estremoDelMuro(id, lettura, zona);
  return quale ? lettura[quale] : null;
}

/* I gradi voluti scritti sulla card del clima. */
function gradiVoluti(id, zona) {
  const gradi = obiettivo(id, zona);
  return gradi === null ? "—" : `${esc(decimale(gradi))}°`;
}

/* Il segno di ciascuna riga: la fiamma per il caldo, il fiocco per il
 * freddo. Piccoli e a tratto, nel colore della riga: i disegni del catalogo
 * sono pannelli interi, e accanto a un numero sarebbero rumore. */
const SEGNI_DEL_TERMOSTATO = Object.freeze({
  basso:
    '<svg class="mu-est-s" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5c3.2 3 4.8 5.6 4.8 8a4.8 4.8 0 0 1-9.6 0c0-1.3.5-2.5 1.4-3.6.3 1.4 1 2.2 2 2.4-.4-2.4.1-4.7 1.4-6.8Z"/><path d="M6.4 13.5A6.6 6.6 0 0 0 12 21.5a6.6 6.6 0 0 0 5.6-8"/></svg>',
  alto: '<svg class="mu-est-s" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 2v20M4.2 7l15.6 10M19.8 7 4.2 17"/><path d="M12 6.2 9.6 4M12 6.2 14.4 4M12 17.8 9.6 20M12 17.8l2.4 2.2"/></svg>',
});

/* Le due righe del termostato a coppia: «Caldo 22°» col suo meno e il suo
 * piu', «Freddo 40°» coi suoi. Servono alla card e alla finestra, che le
 * vogliono uguali: cambia solo la misura, e la decide il foglio di stile. */
function righeDelTermostato(id) {
  const coppia = coppiaDelMuro(id);
  const a = attributi(id);
  const passo = numero(a.target_temp_step) || 0.5;
  const scala = [numero(a.min_temp) ?? 7, numero(a.max_temp) ?? 35];
  return [
    [
      "basso",
      t("Caldo", "Heating"),
      "#f97316",
      SEGNI_DEL_TERMOSTATO.basso,
      t("Abbassa il caldo", "Lower the heating"),
      t("Alza il caldo", "Raise the heating"),
    ],
    [
      "alto",
      t("Freddo", "Cooling"),
      "#0ea5e9",
      SEGNI_DEL_TERMOSTATO.alto,
      t("Abbassa il freddo", "Lower the cooling"),
      t("Alza il freddo", "Raise the cooling"),
    ],
  ]
    .map(([estremo, parola, acc, icona, giu, su]) => {
      const valore = coppia ? coppia[estremo] : null;
      /* A fine corsa il tasto si spegne: il caldo non sale oltre il freddo
       * (Home Assistant lo rifiuta), ne' oltre gli estremi dell'unita'. */
      const fermo = (verso) =>
        !coppia || !coppiaSpostata(coppia, estremo, verso, { passo, scala }) ? " disabled" : "";
      return `<div class="mu-est" data-mu-estremo="${estremo}" style="--est:${acc}"><span class="mu-est-n">${icona}<span class="mu-est-p">${esc(parola)}</span></span><b class="mu-est-v">${valore === null ? "—" : `${esc(decimale(valore))}°`}</b><button type="button" class="mu-tondo mu-est-t" data-mu-fa="meno" data-mu-estremo="${estremo}" data-mu-entita="${esc(id)}" aria-label="${esc(giu)}"${fermo(-1)}>−</button><button type="button" class="mu-tondo mu-est-t" data-mu-fa="piu" data-mu-estremo="${estremo}" data-mu-entita="${esc(id)}" aria-label="${esc(su)}"${fermo(1)}>+</button></div>`;
    })
    .join("");
}

/* I comandi del clima in vetro, sopra l'immagine (`cardClima`,
 * `cardTermostato`): gli stessi `data-mu-fa` della card di sempre. */
const accensioneDiVetro = (id, on) =>
  `<button type="button" class="dm-rq-dt dm-rq-acceso ${on ? "si" : ""}" data-mu-fa="clima-acceso" data-mu-entita="${esc(id)}" aria-pressed="${on}" aria-label="${esc(t("Acceso", "Power"))}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 3v9M18.4 6.6a9 9 0 1 1-12.8 0"/></svg></button>`;
const menoGradiPiu = (id, gradi, estremo = "", fermo = () => "") => {
  const quale = estremo ? ` data-mu-estremo="${estremo}"` : "";
  return `<span class="dm-rq-gradi"><button type="button" class="dm-rq-dt" data-mu-fa="meno"${quale} data-mu-entita="${esc(id)}" aria-label="−"${fermo(-1)}>−</button><b>${gradi}</b><button type="button" class="dm-rq-dt" data-mu-fa="piu"${quale} data-mu-entita="${esc(id)}" aria-label="+"${fermo(1)}>+</button></span>`;
};
function righeDiVetro(id) {
  const coppia = coppiaDelMuro(id);
  const a = attributi(id);
  const passo = numero(a.target_temp_step) || 0.5;
  const scala = [numero(a.min_temp) ?? 7, numero(a.max_temp) ?? 35];
  return [
    ["basso", t("Caldo", "Heating"), "#f97316"],
    ["alto", t("Freddo", "Cooling"), "#0ea5e9"],
  ]
    .map(([estremo, parola, acc]) => {
      const valore = coppia ? coppia[estremo] : null;
      const fermo = (verso) =>
        !coppia || !coppiaSpostata(coppia, estremo, verso, { passo, scala }) ? " disabled" : "";
      return `<span class="dm-rq-estremo" data-mu-estremo="${estremo}" style="--est:${acc}"><i>${esc(parola)}</i>${menoGradiPiu(id, valore === null ? "—" : `${esc(decimale(valore))}°`, estremo, fermo)}</span>`;
    })
    .join("");
}

/* La card del termostato a coppia, sul muro.
 *
 * In cima il disegno, il nome con la temperatura della stanza, la modalita'
 * (che apre la finestra coi modi) e l'interruttore; sotto le due righe, una
 * per numero, ognuna col suo meno e il suo piu'. Niente da scegliere prima di
 * toccare. Sulle celle piccole la forma si stringe da sola — prima se ne va il
 * disegno, poi la parola accanto all'icona, poi la riga del nome — e le due
 * righe coi tasti restano: sono quello per cui la card c'e'. */
function cardTermostato(c, i) {
  const id = c.entita;
  const a = attributi(id);
  const s = String(stato(id)?.state || "");
  const atteso = state.inAttesa[id]?.acceso;
  const on =
    typeof atteso === "boolean" ? atteso : Boolean(s && s !== "off" && s !== "unavailable");
  const modo = on ? PAROLE_DEL_CLIMA()[s] || s : t("Spento", "Off");
  /* Con l'immagine: l'accensione in vetro in alto, e sul velo il nome con la
   * stanza, il modo, e le due righe — caldo e freddo — ognuna col suo meno e
   * il suo piu', come sulla card di sempre. */
  const conImmagine = cardConImmagine(c, i, {
    nome: nomeDi(id, c.nome),
    stato: `${t("ora", "now")} ${decimale(a.current_temperature)}°`,
    acceso: on,
    accento: ACCENTO_DEL_TERMOSTATO,
    destra: accensioneDiVetro(id, on),
    dati: `data-mu-entita="${esc(id)}" data-mu-lato="termostato"`,
    classi: "mu-clima-rq mu-termostato-rq",
    comandi: `<button type="button" class="dm-rq-dt dm-rq-modo" data-mu-fa="modo" data-mu-entita="${esc(id)}">${esc(modo)}</button>${righeDiVetro(id)}`,
  });
  if (conImmagine) return conImmagine;
  return `<div class="mu-carta mu-card mu-termostato ${on ? "mu-accesa" : ""}" style="--acc:${ACCENTO_DEL_TERMOSTATO}" data-mu-card="${i}" data-mu-entita="${esc(id)}" data-mu-lato="termostato">
    <div class="mu-ter-alto"><span class="mu-chip mu-acc" style="--c:40px">${disegno("temperatura", 24, `ter-${i}`)}</span><div class="mu-nome"><div class="mu-n">${esc(nomeDi(id, c.nome))}</div><div class="mu-sotto">${esc(t("ora", "now"))} ${decimale(a.current_temperature)}°</div></div><button type="button" class="mu-pasti mu-modo" data-mu-fa="modo" data-mu-entita="${esc(id)}">${esc(modo)}</button><button type="button" class="mu-tondo mu-ter-acceso ${on ? "pieno" : ""}" data-mu-fa="clima-acceso" data-mu-entita="${esc(id)}" aria-pressed="${on}" aria-label="${esc(t("Acceso", "Power"))}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 3v9M18.4 6.6a9 9 0 1 1-12.8 0"/></svg></button></div>
    <div class="mu-ter-righe">${righeDelTermostato(id)}</div>
  </div>`;
}

/* Il colore della linguetta e della card del termostato: ne' l'arancio del
 * caldo ne' l'azzurro del freddo, perche' e' tutti e due. */
const ACCENTO_DEL_TERMOSTATO = "#8b5cf6";

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
  const scelta = (state.zone ||= {})[pagina.id] || pagina.zona || "freddo";
  /* La linguetta «Termostato» c'e' solo finche' c'e' un termostato a coppia:
   * se quella ricordata se n'e' andata, si torna a quella del config. */
  if (scelta === "termostato" && !ciSonoTermostati())
    return pagina.zona && pagina.zona !== "termostato" ? pagina.zona : "freddo";
  return scelta;
}

/* Almeno un'unita' del clima e' un termostato a coppia: la terza linguetta
 * ha qualcosa da mostrare. */
function ciSonoTermostati() {
  return (state.fonte?.clima || []).some((d) => d?.entity && aCoppia(d.entity));
}

/* Da che parte sta un'unita' fuori dalla pagina Clima, dove non c'e' una
 * linguetta a dirlo. «Se metto i comandi clima non funziona bene come la
 * pagina»: in una pagina Personale la zona restava vuota, e il comando rapido
 * ripiegava sul freddo — un termostato acceso dal suo tasto partiva a
 * raffrescare, e la pastiglia diceva «Freddo» sotto un «Riscalda». Qui la
 * zona la dice l'unita' stessa: un termostato scalda sempre, un clima o una
 * pompa stanno dalla parte di quello che fanno adesso, e da spenti dalla
 * parte del loro tipo. */
function zonaDellUnita(id, adesso = new Date()) {
  const tipo = (state.fonte?.clima || []).find((d) => d.entity === id)?.tipo || "clima";
  if (tipo === "termo") return "caldo";
  /* Prima di tutto quello che l'unita' sa fare. Un riscaldamento o un
   * boiler messi in casa come «clima» non raffrescano: i loro modi lo
   * dicono, e il tasto non deve proporre il freddo a chi non ce l'ha. */
  const modi = (attributi(id).hvac_modes || []).map((m) => String(m).toLowerCase());
  const raffresca = modi.some((m) => ["cool", "dry", "fan_only", "heat_cool"].includes(m));
  const riscalda = modi.some((m) => ["heat", "heat_cool"].includes(m));
  if (modi.length && !raffresca) return "caldo";
  if (modi.length && !riscalda) return "freddo";
  /* Chi fa tutt'e due: da acceso, quello che sta facendo. */
  const s = String(stato(id)?.state || "off");
  if (s !== "off" && s !== "unavailable") return scalda(id) ? "caldo" : "freddo";
  /* Da spento non lo sa dire nessuno: «sull'aria condizionata non posso
   * scegliere il caldo». Fa la stagione — da ottobre ad aprile il caldo,
   * d'estate il freddo — e l'altra parte resta a un tocco, nella finestra. */
  const mese = adesso.getMonth();
  return mese >= 9 || mese <= 3 ? "caldo" : "freddo";
}

/* La zona del clima in cui si e': la linguetta della pagina Clima, o fuori di
 * li' quella dell'unita'. */
function zonaDiQui(id = "") {
  const pagina = state.muro?.pagine?.[state.pagina];
  if (pagina?.modello === "clima") return zonaDellaPagina(pagina);
  return id ? zonaDellUnita(id) : "";
}

/* Il comando rapido di questa unita', se la pagina accende con quello. */
function rapidoDi(id, zona) {
  const pagina = state.muro?.pagine?.[state.pagina];
  if (pagina?.modello === "clima" && pagina.accensione === "ultima") return null;
  const r = state.fonte?.rapido || {};
  const dove = zona || zonaDiQui(id);
  const preset = quickClimatePresetOf(id, dove, r.perUnita || {}, r.globale);
  /* Un comando rapido che chiede un modo che l'unita' non ha non accende
   * niente: Home Assistant rifiuta il «cool» a un riscaldamento, e il tasto
   * sembrava morto. Si ripiega sul modo della sua parte, se ce l'ha, o sul
   * primo che ha. */
  const modi = (attributi(id).hvac_modes || []).filter((m) => m && m !== "off");
  if (!preset?.mode || !modi.length || modi.includes(preset.mode)) return preset;
  const voluto = dove === "caldo" ? "heat" : "cool";
  return { ...preset, mode: modi.includes(voluto) ? voluto : modi[0] };
}

/* La pastiglia del comando rapido (#muro): «fai qualcosa più bello». Il
 * riquadro resta quello di sempre; al posto del solo ⏻ c'e' una pastiglia
 * che dice cosa fara' — i gradi e la ventola di quella stanza — e col tasto
 * in fondo. Da spento accende cosi', da acceso spegne. */
function pastigliaRapida(id, preset, on) {
  const ventola = PAROLE_DELLA_VENTOLA()[clean(preset.fan).toLowerCase()] || clean(preset.fan);
  const pezzi = [
    `<span class="mu-rap-val">${disegnoDelCatalogo(preset.mode === "heat" ? "flame" : "wind", 18)}${esc(
      preset.temperature == null
        ? PAROLE_DEL_CLIMA()[preset.mode] || preset.mode
        : `${decimale(preset.temperature)}°`,
    )}</span>`,
    ventola
      ? `<span class="mu-rap-val">${disegnoDelCatalogo("spiral", 18)}${esc(ventola)}</span>`
      : "",
  ].filter(Boolean);
  return `<button type="button" class="mu-rapido ${on ? "acceso" : ""}" data-mu-fa="clima-acceso" data-mu-entita="${esc(id)}" aria-pressed="${on}" aria-label="${esc(
    on ? t("Spegni", "Turn off") : t("Comando rapido", "Quick command"),
  )}"><span class="mu-rap-lampo" aria-hidden="true">⚡</span>${pezzi.join('<i aria-hidden="true"></i>')}<span class="mu-rap-tasto" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 3v9M18.4 6.6a9 9 0 1 1-12.8 0"/></svg></span></button>`;
}

function cardClima(c, i, zonaDellaLinguetta = "") {
  const id = c.entita;
  /* Il termostato a coppia ha la sua card dovunque stia — nella linguetta
   * Termostato, ma anche in una pagina Personale o in quella di una stanza:
   * i due numeri vanno insieme, ognuno coi suoi tasti. */
  if (aCoppia(id)) return cardTermostato(c, i);
  const zona = zonaDellaLinguetta || zonaDellUnita(id);
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
  const gradi = gradiVoluti(id, zona);
  /* Con l'immagine: l'accensione in vetro in alto a destra, e sul velo il
   * nome, quello che fa con la temperatura della stanza, e la fila dei
   * comandi — il modo (che apre la finestra coi modi), il meno, i gradi voluti
   * grandi, il piu'. Il tocco fuori dai tasti apre la finestra del clima. */
  const conImmagine = cardConImmagine(c, i, {
    nome: nomeDi(id, c.nome),
    stato: [azione, `${t("ora", "now")} ${decimale(a.current_temperature)}°`]
      .filter(Boolean)
      .join(" · "),
    acceso: on,
    accento: faccia.accento,
    destra: accensioneDiVetro(id, on),
    dati: `data-mu-entita="${esc(id)}" data-mu-lato="${faccia.chiave}"`,
    classi: "mu-clima-rq",
    comandi: `${on ? `<button type="button" class="dm-rq-dt dm-rq-modo" data-mu-fa="modo" data-mu-entita="${esc(id)}">${esc(PAROLE_DEL_CLIMA()[s] || s)}</button>` : ""}${menoGradiPiu(id, gradi)}`,
  });
  if (conImmagine) return conImmagine;
  /* Sul pannello piccolo il meno e il piu' restano sul riquadro: «il clima
   * comodo sul 4 pollici». La temperatura voluta in alto, grande, accanto
   * al disegno; il resto — i modi, l'accensione — nella finestra, col tocco.
   * Due righe sole: il disegno, il nome e i gradi voluti sulla prima, il meno
   * e il piu' sotto. Con il nome su una riga sua in mezzo, nella griglia tre
   * per tre sotto le linguette il meno e il piu' finivano fuori dal riquadro. */
  if (state.muro?.cartaClima === "plancia")
    return cardClimaComeLaPlancia({ c, i, id, a, s, on, azione, faccia, zona, rapido: rapidoDi(id, zona) });
  if (state.compatto)
    return `<div class="mu-carta mu-card mu-clima-mini ${on ? "mu-accesa" : ""}" style="--acc:${faccia.accento}" data-mu-card="${i}" data-mu-entita="${esc(id)}" data-mu-lato="${faccia.chiave}">
    <div class="mu-mini-alto"><span class="mu-chip mu-acc" style="--c:40px">${disegno(faccia.chiave, 24, `clima-${i}`)}</span><div class="mu-nome"><div class="mu-n">${esc(nomeDi(id, c.nome))}</div><div class="mu-sotto">${esc(t("ora", "now"))} ${decimale(a.current_temperature)}°</div></div><span class="mu-mini-t">${gradi}</span></div>
    <div class="mu-mini-tasti"><button type="button" class="mu-tondo" data-mu-fa="meno" data-mu-entita="${esc(id)}" aria-label="−">−</button><button type="button" class="mu-tondo" data-mu-fa="piu" data-mu-entita="${esc(id)}" aria-label="+">+</button></div></div>`;
  const rapido = rapidoDi(id, zona);
  return `<div class="mu-carta mu-card ${on ? "mu-accesa" : ""}${rapido ? " mu-col-rapido" : ""}" style="--acc:${faccia.accento}" data-mu-card="${i}" data-mu-entita="${esc(id)}" data-mu-lato="${faccia.chiave}">
    <div class="mu-riga1"><span class="mu-chip mu-acc" style="--c:46px">${disegno(faccia.chiave, 26, `clima-${i}`)}</span>
      <div class="mu-nome"><div class="mu-n">${esc(nomeDi(id, c.nome))}</div><div class="mu-sotto">${esc(t("ora", "now"))} ${decimale(a.current_temperature)}°</div></div>
      ${azione ? `<span class="mu-pasti">${esc(azione)}</span>` : ""}<span class="mu-t-alto" aria-hidden="true">${gradi}</span></div>
    <div class="mu-target"><span class="mu-grande">${gradi}</span><span class="mu-et">Target</span></div>
    <div class="mu-comandi">
      ${on ? `<button type="button" class="mu-pasti mu-modo" data-mu-fa="modo" data-mu-entita="${esc(id)}">${esc(PAROLE_DEL_CLIMA()[s] || s)}</button>` : ""}
      <span class="mu-spazio"></span>
      <button type="button" class="mu-tondo" data-mu-fa="meno" data-mu-entita="${esc(id)}" aria-label="−">−</button>
      <button type="button" class="mu-tondo" data-mu-fa="piu" data-mu-entita="${esc(id)}" aria-label="+">+</button>
      ${
        rapido
          ? pastigliaRapida(id, rapido, on)
          : `<button type="button" class="mu-tondo ${on ? "pieno" : ""}" data-mu-fa="clima-acceso" data-mu-entita="${esc(id)}" aria-pressed="${on}" aria-label="${esc(t("Acceso", "Power"))}"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 3v9M18.4 6.6a9 9 0 1 1-12.8 0"/></svg></button>`
      }
    </div></div>`;
}

/* La card del clima come nella plancia principale.
 *
 * «Perche' nel clima del muro non vedo la stessa cosa? Intendo la linea della
 * temperatura e i numeri in quel modo: non e' piu' bello?» Si sceglie in
 * «Altre impostazioni › Card del clima». In alto il nome e lo stato; grande
 * la temperatura della stanza, «Ambiente»; sotto la riga della scala del
 * clima, col segno dove sta la stanza e il pallino dove sta la voluta, i
 * due estremi ai lati e «Target» in mezzo; in fondo il modo, il meno, il piu'
 * e l'accensione. La riga si legge e basta: la voluta si cambia col meno e
 * col piu', che su un tablet appeso sono piu' sicuri di un dito che trascina.
 */
function cardClimaComeLaPlancia({ c, i, id, a, s, on, azione, faccia, zona, rapido }) {
  const voluta = obiettivo(id, zona);
  const stanza = numero(a.current_temperature);
  const basso = numero(a.min_temp) ?? 7;
  const alto = Math.max(basso + 1, numero(a.max_temp) ?? 35);
  const dove = (v) => Math.max(0, Math.min(100, ((v - basso) / (alto - basso)) * 100));
  const pallino = voluta === null ? null : dove(voluta);
  const segno = stanza === null ? null : dove(stanza);
  const stato = on ? azione || PAROLE_DEL_CLIMA()[s] || s : t("Spento", "Off");
  const numeroGrande = stanza === null ? "—" : esc(decimale(stanza));
  const scala = `<div class="mu-cp-scala" aria-hidden="true">
      <span class="mu-cp-riga"><i style="width:${pallino ?? 0}%"></i></span>
      ${segno === null ? "" : `<span class="mu-cp-segno" style="left:${segno}%"></span>`}
      ${pallino === null ? "" : `<span class="mu-cp-pallino" style="left:${pallino}%"></span>`}
    </div>`;
  const target = `<span class="mu-cp-target">Target <b>${voluta === null ? "—" : `${esc(decimale(voluta))}°`}</b></span>`;
  /* Sul pannello piccolo lo stesso disegno, stretto: il nome e lo stato, il
   * numero della stanza col meno e il piu' accanto, la riga e la voluta. Il
   * modo e l'accensione stanno nella finestra, col tocco, come nella card
   * piccola di sempre. */
  if (state.compatto)
    return `<div class="mu-carta mu-card mu-cp mu-cp-mini ${on ? "mu-accesa" : ""}" style="--acc:${faccia.accento}" data-mu-card="${i}" data-mu-entita="${esc(id)}" data-mu-lato="${faccia.chiave}">
    <div class="mu-cp-testa"><span class="mu-cp-nome">${esc(nomeDi(id, c.nome))}</span><span class="mu-cp-stato">${esc(stato)}</span></div>
    <div class="mu-cp-ora"><span class="mu-cp-n">${numeroGrande}<sup>°</sup></span><span class="mu-spazio"></span><button type="button" class="mu-tondo" data-mu-fa="meno" data-mu-entita="${esc(id)}" aria-label="−">−</button><button type="button" class="mu-tondo" data-mu-fa="piu" data-mu-entita="${esc(id)}" aria-label="+">+</button></div>
    ${scala}
    <div class="mu-cp-sotto">${target}</div></div>`;
  return `<div class="mu-carta mu-card mu-cp ${on ? "mu-accesa" : ""}" style="--acc:${faccia.accento}" data-mu-card="${i}" data-mu-entita="${esc(id)}" data-mu-lato="${faccia.chiave}">
    <div class="mu-riga1"><span class="mu-chip mu-acc" style="--c:46px">${disegno(faccia.chiave, 26, `clima-${i}`)}</span>
      <div class="mu-nome"><div class="mu-n mu-cp-nome">${esc(nomeDi(id, c.nome))}</div></div>
      <span class="mu-pasti mu-cp-stato">${esc(stato)}</span></div>
    <div class="mu-cp-ora"><span class="mu-cp-n">${numeroGrande}<sup>°</sup></span><span class="mu-et">${esc(t("Ambiente", "Room"))}</span></div>
    ${scala}
    <div class="mu-cp-sotto"><span>${esc(decimale(basso, 0))}°</span>${target}<span>${esc(decimale(alto, 0))}°</span></div>
    <div class="mu-comandi">
      <button type="button" class="mu-pasti mu-modo mu-cp-modo" data-mu-fa="modo" data-mu-entita="${esc(id)}">${esc(t("Modalità", "Mode"))}</button>
      <span class="mu-spazio"></span>
      <button type="button" class="mu-tondo" data-mu-fa="meno" data-mu-entita="${esc(id)}" aria-label="−">−</button>
      <button type="button" class="mu-tondo" data-mu-fa="piu" data-mu-entita="${esc(id)}" aria-label="+">+</button>
      ${
        rapido
          ? pastigliaRapida(id, rapido, on)
          : `<button type="button" class="mu-tondo ${on ? "pieno" : ""}" data-mu-fa="clima-acceso" data-mu-entita="${esc(id)}" aria-pressed="${on}" aria-label="${esc(t("Acceso", "Power"))}"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 3v9M18.4 6.6a9 9 0 1 1-12.8 0"/></svg></button>`
      }
    </div></div>`;
}

/* Un cancello o una porta del garage non e' una tapparella: «sembra una
 * tapparella e c'e' scritto Chiusa». Lo dice il tipo che Home Assistant gli
 * da' (`device_class`). Il suo disegno, «Aperto» o «Chiuso», e un tasto solo
 * e grande: apre se e' chiuso, chiude se e' aperto, ferma se si sta movendo. */
const DISEGNO_DEL_VARCO = Object.freeze({ gate: "gate", garage: "garage-door" });
export function eUnVarco(attributiDellaCover = {}) {
  return Boolean(DISEGNO_DEL_VARCO[String(attributiDellaCover?.device_class || "")]);
}

function cardVarco(c, i) {
  const id = c.entita;
  const s = String(stato(id)?.state || "");
  const muove = s === "opening" || s === "closing";
  const aperto = s === "open";
  const parola =
    {
      open: t("Aperto", "Open"),
      closed: t("Chiuso", "Closed"),
      opening: t("Si apre…", "Opening…"),
      closing: t("Si chiude…", "Closing…"),
    }[s] ||
    s ||
    "—";
  const [fa, tasto] = muove
    ? ["ferma", t("Ferma", "Stop")]
    : aperto
      ? ["giu", t("Chiudi", "Close")]
      : ["su", t("Apri", "Open")];
  const acc = "#22c55e";
  /* Con l'immagine: il tasto in vetro al posto dell'interruttore. */
  const conImmagine = cardConImmagine(c, i, {
    nome: nomeDi(id, c.nome),
    stato: parola,
    acceso: aperto || muove,
    accento: acc,
    destra: `<button type="button" class="dm-rq-tasto" data-mu-fa="${fa}" data-mu-entita="${esc(id)}"><b aria-hidden="true"></b>${esc(tasto)}</button>`,
    dati: `data-mu-entita="${esc(id)}"`,
  });
  if (conImmagine) return conImmagine;
  /* Nella forma della famiglia: il disegno e «Aperto»/«Chiuso» in alto, il
   * tasto in alto a destra dove gli altri hanno l'interruttore, il nome
   * grande in fondo. Il tasto largo in fondo, sotto il nome, su un pannello
   * piccolo tagliava il nome a meta'. */
  return `<div class="mu-carta mu-card mu-fam mu-varco ${aperto || muove ? "mu-accesa" : ""}" style="--acc:${acc}" data-mu-card="${i}" data-mu-entita="${esc(id)}">
    <div class="mu-riga1"><span class="mu-chip" style="--c:54px">${disegnoDelCatalogo(DISEGNO_DEL_VARCO[attributi(id).device_class], 32)}</span><span class="mu-stato ${aperto || muove ? "" : "spento"}">${esc(parola)}</span>
      <button type="button" class="mu-btn ${muove ? "" : "pieno"} mu-varco-tasto" style="--acc:${acc}" data-mu-fa="${fa}" data-mu-entita="${esc(id)}">${esc(tasto)}</button></div>
    <div class="mu-osw mu-fam-nome">${esc(nomeDi(id, c.nome))}</div></div>`;
}

function cardTapparella(c, i) {
  const id = c.entita;
  if (eUnVarco(attributi(id))) return cardVarco(c, i);
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
  /* Nella forma della famiglia: il disegno e lo stato in alto, il nome
   * grande, poi la barra e i tasti.
   *
   * «Sulla personalizzata la modifica che hai fatto del clima serve anche
   * sulle tapparelle: i pulsanti diretti, senza entrarci dentro.» Prima i tre
   * tasti erano la prima cosa a sparire quando la casella era bassa — nella
   * griglia di otto e di dodici, e su tutto il pannello piccolo, non c'erano
   * mai — e per muovere una serranda bisognava aprirne la finestra. Ora sono
   * l'ultima: se lo spazio manca se ne vanno prima la barra della posizione,
   * poi il disegno, poi la riga in alto (e la parola dello stato scende,
   * piccola, accanto al nome: `mu-tap-stato`, dove «Aperta · 22%» diventa
   * «22%»), e il nome si stringe; i tasti
   * restano, alti almeno quanto un dito (vedi gli stili della famiglia). Sono
   * quelli che la cover sa fare (`tastiDellaTapparella`): una tenda che
   * apre e chiude soltanto ha ▲ e ▼, senza ■. Il tocco fuori dai tasti apre
   * la finestra, come sempre. La parola accanto al segno («Su», «Stop»,
   * «Giu'») si vede solo dove la casella e' larga. */
  const tasti = tastiDellaTapparella(a);
  const TASTI = {
    su: ["▲", t("Su", "Up")],
    ferma: ["■", t("Stop", "Stop")],
    giu: ["▼", t("Giù", "Down")],
  };
  /* Con l'immagine: gli stessi tasti, in vetro in alto a destra; la parola
   * dello stato sul velo. Il tocco fuori dai tasti apre la finestra, come
   * sempre (la card porta `data-mu-entita`). */
  const conImmagine = cardConImmagine(c, i, {
    nome: nomeDi(id, c.nome),
    stato: parola,
    acceso: Boolean(s && s !== "closed"),
    accento: ACCENTI.tapparella,
    destra: tasti.length
      ? `<div class="dm-rq-due">${tasti
          .map((k) =>
            tastoDiVetro({
              classi: `dm-rq-dt-${k}`,
              dati: `data-mu-fa="${k}" data-mu-entita="${esc(id)}"`,
              scritta: TASTI[k][0],
              etichetta: TASTI[k][1],
            }),
          )
          .join("")}</div>`
      : "",
    dati: `data-mu-entita="${esc(id)}"`,
    classi: "mu-tapparella",
  });
  if (conImmagine) return conImmagine;
  return `<div class="mu-carta mu-card mu-fam mu-tapparella ${s && s !== "closed" ? "mu-accesa" : ""}" style="--acc:${ACCENTI.tapparella}" data-mu-card="${i}" data-mu-entita="${esc(id)}">
    <div class="mu-riga1"><span class="mu-chip" style="--c:54px">${disegno("tapparelle", 32, `tapp-${i}`)}</span><span class="mu-stato">${esc(parola)}</span></div>
    <div class="mu-fam-fondo"><div class="mu-osw mu-fam-nome">${esc(nomeDi(id, c.nome))}</div><span class="mu-tap-stato" aria-hidden="true">${esc(s === "open" && pos !== null && pos < 100 ? `${pos}%` : parola)}</span></div>
    ${pos !== null ? `<div class="mu-bar"><i style="width:${pos}%"></i></div>` : ""}
    ${
      tasti.length
        ? `<div class="mu-seg mu-tap-tasti">${tasti
            .map(
              (k) =>
                `<button type="button" data-mu-fa="${k}" data-mu-entita="${esc(id)}" aria-label="${esc(TASTI[k][1])}"><b aria-hidden="true">${TASTI[k][0]}</b><span>${esc(TASTI[k][1])}</span></button>`,
            )
            .join("")}</div>`
        : ""
    }</div>`;
}

/* La tessera: il disegno in alto a sinistra con la parola piccola accanto, il
 * nome grande in fondo, sotto la riga scelta. «Forse meglio la seconda,
 * soprattutto quando lo schermo diventa piccolo»: e' la forma di tutta la
 * famiglia dei posti (`mu-fam`) — le scene, i sensori, gli interruttori, le
 * luci, i cancelli. Chi ha un comando suo lo mette in alto a destra
 * (`destra`: l'interruttore, la parola del gesto), al posto della pastiglia
 * «attiva»; il tocco resta su tutto il riquadro. */
function tessera({
  chiave,
  accento,
  etichetta,
  titolo,
  sotto,
  attiva,
  grande,
  dati = "",
  dove,
  classi = "",
  destra = "",
  conStato = false,
  statoAcceso = false,
  immagine = null,
  vetro = null,
}) {
  /* Con l'immagine la tessera e' un riquadro con l'immagine: lo stesso tasto,
   * gli stessi dati per il tocco. Lo stato e la riga sotto vanno insieme sul
   * velo, «Spento · ieri 07:10». */
  if (immaginePulita(immagine))
    return vestito({
      immagine,
      nome: titolo,
      stato: [etichetta, sotto].map(clean).filter(Boolean).join(" · "),
      acceso: Boolean(attiva),
      accento,
      destra: segnoDiVetro(vetro),
      tag: "button",
      classi: `mu-card mu-rq mu-tessera ${classi} ${grande ? "grande" : ""}`,
      attributi: dati,
    });
  /* Chi dice uno stato (acceso, aperto) lo scrive come le luci, col colore
   * quando e' acceso; una scena o un gesto hanno la loro etichetta grigia. */
  const parola =
    destra || conStato
      ? `<span class="mu-stato ${statoAcceso ? "" : "spento"}">${esc(etichetta)}</span>`
      : `<span class="mu-et">${esc(etichetta)}</span>`;
  const pastiglia =
    !destra && !conStato && attiva
      ? `<span class="mu-pasti">${esc(t("attiva", "active"))}</span>`
      : "";
  return `<button type="button" class="mu-carta mu-card mu-fam mu-tessera ${classi} ${attiva ? "mu-accesa" : ""} ${grande ? "grande" : ""}" style="--acc:${accento}" ${dati}>
    <div class="mu-riga1"><span class="mu-chip" style="--c:${grande ? 84 : 54}px">${disegno(chiave, grande ? 50 : 32, dove)}</span>${parola}${pastiglia}${destra}</div>
    <div class="mu-osw mu-fam-nome">${esc(titolo)}</div><div class="mu-sotto">${esc(sotto)}</div></button>`;
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
    immagine: c.immagine,
  });
}

/* I domini che si accendono e si spengono: nella griglia mostrano
 * l'interruttore, come le luci. */
const INTERRUTTORI = Object.freeze(["switch", "input_boolean", "fan", "siren", "humidifier"]);

/* La card di un'entita' qualunque: il suo disegno, il nome, lo stato; il
 * tocco fa il gesto del dominio. Nelle Scene e' una tessera grande. */
function cardEntita(c, i, grande = false) {
  const id = c.entita;
  const s = stato(id);
  /* «Se inserisco un select mi apre la tendina delle scelte disponibili?
   * Come lo fa su telefono.» Il riquadro dice la voce di adesso, e il tocco
   * apre le voci. */
  if (MENU.has(dominio(id)))
    return tessera({
      chiave: clean(c.disegno) || disegnoDellEntita(id),
      accento: ACCENTI.azione,
      etichetta: grande ? "" : statoInParole(id),
      titolo: nomeDi(id, c.nome),
      sotto: clean(c.sotto) || (grande ? statoInParole(id) : ""),
      grande,
      classi: grande ? "" : "mu-comando",
      destra: grande ? "" : `<span class="mu-verbo" aria-hidden="true">${esc(t("Scegli", "Choose"))}</span>`,
      dati: `data-mu-fa="scelte" data-mu-entita="${esc(id)}"`,
      dove: `en-${i}-${grande ? "g" : "p"}`,
      immagine: c.immagine,
      vetro: grande ? undefined : { tipo: "tasto", testo: t("Scegli", "Choose") },
    });
  const servizio = servizioDellEntita(id, String(s?.state || ""));
  if (!servizio && !grande) {
    const dato = cardDato(c, i, s);
    if (dato) return dato;
  }
  const on = acceso(id) || ["unlocked", "playing", "cleaning"].includes(String(s?.state));
  const parole = statoInParole(id);
  /* «Posti tutti uguali»: in una griglia un interruttore o un pulsante ha la
   * stessa forma di un sensore e di una luce — «come vedi la grafica dei due
   * sensori e' diversa, con il nome grande sotto: forse meglio la seconda».
   * Il disegno e lo stato in alto, il nome grande in fondo e sotto la riga
   * scelta; in alto a destra l'interruttore, o la parola del gesto («Apri»,
   * «Avvia») per chi non si accende e non si spegne. Prima il nome stava
   * piccolo in alto accanto al disegno, e la riga scelta prendeva il posto
   * dello stato: nella stessa pagina «Garage 1» era una riga piccola sopra
   * un riquadro vuoto accanto al «Garage 1» grande del sensore. Il tocco
   * resta quello di sempre, su tutto il riquadro. Le tessere grandi delle
   * Scene restano tessere. */
  if (servizio && !grande) {
    const dom = dominio(id);
    const interruttore = INTERRUTTORI.includes(dom);
    const verbo =
      dom === "lock"
        ? String(s?.state) === "unlocked"
          ? t("Chiudi", "Lock")
          : t("Apri", "Unlock")
        : dom === "script" || dom === "scene" || dom === "automation"
          ? t("Avvia", "Run")
          : t("Premi", "Press");
    return tessera({
      chiave: clean(c.disegno) || disegnoDellEntita(id),
      accento: on ? ACCENTI.luce : ACCENTI.azione,
      etichetta: parole,
      titolo: nomeDi(id, c.nome),
      sotto: clean(c.sotto),
      attiva: on,
      statoAcceso: on,
      classi: "mu-comando",
      destra: interruttore
        ? `<span class="mu-inter ${on ? "on" : ""}" aria-hidden="true"><i></i></span>`
        : `<span class="mu-verbo" aria-hidden="true">${esc(verbo)}</span>`,
      dati: `data-mu-fa="entita" data-mu-entita="${esc(id)}"`,
      dove: `en-${i}-p`,
      immagine: c.immagine,
      vetro: interruttore ? { tipo: "int", on } : { tipo: "tasto", testo: verbo },
    });
  }
  return tessera({
    chiave: clean(c.disegno) || disegnoDellEntita(id),
    accento: on ? ACCENTI.luce : ACCENTI.azione,
    /* Piccola: lo stato in alto. Grande: lo stato va sotto il nome, a meno
     * che sotto non ci sia gia' la riga scelta. */
    etichetta: !grande || clean(c.sotto) ? parole : "",
    titolo: nomeDi(id, c.nome),
    sotto: clean(c.sotto) || (grande ? parole : ""),
    attiva: on,
    conStato: !grande,
    statoAcceso: on,
    grande,
    dati: servizio
      ? `data-mu-fa="entita" data-mu-entita="${esc(id)}"`
      : `data-mu-entita="${esc(id)}" aria-disabled="true"`,
    dove: `en-${i}-${grande ? "g" : "p"}`,
    immagine: c.immagine,
  });
}

/* La tessera di una lettura: il nome piccolo in alto, il numero grande.
 *
 * «Sulla personalizzata i numeri sono molto piccoli e le scritte grandi.» La
 * tessera di un'entita' e' fatta per le scene, dove il nome e' il contenuto e
 * lo stato una didascalia; per un sensore e' il contrario. Un sensore che non
 * si comanda e dice un numero ha la sua forma: niente disco grande, il nome in
 * una riga, il valore che cresce con la casella. */
function cardDato(c, i, s) {
  const v = String(s?.state ?? "").trim();
  const n = numero(v);
  if (n === null || v === "") return "";
  const id = c.entita;
  const unita = clean(s.attributes?.unit_of_measurement);
  const valore = decimale(n, Number.isInteger(n) ? 0 : 1);
  /* «Qui e' inserita... ma non ci va nel riquadro»: la lettura con
   * l'immagine. Il numero sul velo, grande e col suo segno («76 %»), al posto
   * dell'«acceso» che un sensore non ha; l'immagine resta a colori
   * (`dm-rq-lettura`): spento non vuol dire niente per una batteria. */
  if (immaginePulita(c.immagine))
    return vestito({
      immagine: c.immagine,
      nome: nomeDi(id, c.nome),
      stato: [unita ? `${valore} ${unita}` : valore, clean(c.sotto)].filter(Boolean).join(" · "),
      acceso: false,
      accento: ACCENTI.azione,
      classi: "mu-card mu-rq mu-dato-rq dm-rq-lettura",
      attributi: `data-mu-entita="${esc(id)}" aria-disabled="true"`,
    });
  return `<div class="mu-carta mu-card mu-dato" style="--acc:${ACCENTI.azione}" data-mu-entita="${esc(id)}" aria-disabled="true">
    <div class="mu-dato-testa">${disegno(clean(c.disegno) || disegnoDellEntita(id), 22, `da-${i}`)}<span class="mu-dato-n">${esc(nomeDi(id, c.nome))}</span></div>
    <div class="mu-dato-v">${esc(valore)}${unita ? `<small>${esc(unita)}</small>` : ""}</div>
    ${clean(c.sotto) ? `<div class="mu-dato-s">${esc(clean(c.sotto))}</div>` : ""}
  </div>`;
}

const vuoto = (i, perche = "") =>
  `<div class="mu-carta mu-card mu-vuoto" data-mu-card="${i}"><span class="mu-et">${esc(perche || t("Posto libero", "Empty slot"))}</span></div>`;

/* La card di un posto, secondo il suo tipo. Le Scene hanno le tessere
 * grandi (`scena`). */
function cardDelPosto(c, i, zona = "", { scena = false } = {}) {
  if (!c || c.tipo === "vuoto") return vuoto(i);
  if (scena) return c.entita ? cardEntita(c, i, true) : cardAzione(c, i, true);
  if (c.tipo === "luce") return cardLuce(c, i);
  if (c.tipo === "clima") return cardClima(c, i, zona);
  if (c.tipo === "tapparella") return cardTapparella(c, i);
  if (c.tipo === "entita") return cardEntita(c, i);
  if (c.tipo === "duetasti") return cardDueTasti(c, i);
  return cardAzione(c, i);
}

/**
 * Quello che il riquadro con l'immagine di questo posto direbbe adesso: lo
 * stato, l'accento, il comando in alto a destra, la fila sul velo. Serve
 * all'anteprima del blocco «Immagine» dell'editor, che cosi' mostra lo stesso
 * riquadro del tablet — anche prima che un'immagine sia scelta (se ne mette
 * una qualunque del catalogo, solo per far parlare la card). `null` per un
 * posto vuoto.
 */
export function facciaDelPosto(c, { scena = false, fonte = state.fonte } = {}) {
  if (!c || c.tipo === "vuoto") return null;
  const prima = { fonte: state.fonte, compatto: state.compatto };
  const raccoltaPrima = raccolta;
  raccolta = null;
  facciaPresa = {};
  try {
    state.fonte = fonte || state.fonte || {};
    state.compatto = false;
    const immagine = immaginePulita(c.immagine) || {
      src: `disegno:${DISEGNI_DA_RIQUADRO[0].chiave}`,
    };
    cardDelPosto({ ...c, immagine }, 0, "", { scena });
    const presa = facciaPresa.presa;
    if (!presa) return null;
    return {
      stato: presa.stato || "",
      acceso: Boolean(presa.acceso),
      accento: presa.accento || "",
      destra: presa.destra || "",
      comandi: presa.comandi || "",
      classi: String(presa.classi || "")
        .split(/\s+/)
        .filter((k) => k.startsWith("dm-rq-"))
        .join(" "),
    };
  } finally {
    facciaPresa = null;
    raccolta = raccoltaPrima;
    Object.assign(state, prima);
  }
}

function paginaStanza(pagina) {
  const zona = pagina.modello === "clima" ? zonaDellaPagina(pagina) : "";
  const comandi = comandiDellaPagina(pagina, state.fonte, zona, { aCoppia });
  const elenco = MODELLI_ELENCO.includes(pagina.modello);
  /* La pagina Clima: le linguette in cima, come nella sezione Clima — Freddo,
   * Caldo e, se in casa c'e' un termostato a coppia, Termostato. */
  const linguette =
    pagina.modello === "clima"
      ? `<div class="mu-zone" role="tablist">${[
          ["freddo", "clima", t("Freddo", "Cooling"), "#0ea5e9"],
          ["caldo", "caldo", t("Caldo", "Heating"), "#f97316"],
          ...(ciSonoTermostati()
            ? [["termostato", "temperatura", t("Termostato", "Thermostat"), ACCENTO_DEL_TERMOSTATO]]
            : []),
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
  const carte = Array.from({ length: quante }, (_, i) => cardDelPosto(comandi[i], i, zona));
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
    return cardDelPosto(c, i, "", { scena: true });
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
    /* Nella forma della famiglia: il disegno e le luci in alto, in fondo il
     * nome grande e accanto, a destra, la temperatura. Prima la temperatura
     * stava su una riga sua sotto il nome, e sul pannello piccolo restava
     * tagliata a meta' («22.0°» visto per meta'). */
    /* Con l'immagine della stanza: la temperatura e le luci sul velo. */
    if (immaginePulita(stanza.immagine))
      return vestito({
        immagine: stanza.immagine,
        nome: stanza.name,
        stato: [
          temp === null ? "" : `${decimale(temp)}°`,
          umid === null ? "" : `${decimale(umid, 0)}%`,
          luci.length
            ? accese
              ? `${accese} ${accese === 1 ? t("luce accesa", "light on") : t("luci accese", "lights on")}`
              : t("Luci spente", "Lights off")
            : "",
        ]
          .filter(Boolean)
          .join(" · "),
        acceso: accese > 0,
        accento,
        classi: "mu-card mu-rq mu-ambiente",
        attributi: `data-mu-card="${i}"`,
      });
    return `<div class="mu-carta mu-card mu-fam mu-ambiente ${accese ? "mu-accesa" : ""}" style="--acc:${accento}" data-mu-card="${i}">
      <div class="mu-riga1"><span class="mu-chip mu-acc" style="--c:46px">${disegno("stanze", 26, `amb-${i}`)}</span>${luci.length ? `<span class="mu-stato ${accese ? "" : "spento"}">${esc(accese ? `${accese} ${accese === 1 ? t("luce accesa", "light on") : t("luci accese", "lights on")}` : t("Luci spente", "Lights off"))}</span>` : ""}</div>
      <div class="mu-fam-fondo"><div class="mu-osw mu-fam-nome">${esc(stanza.name)}</div><div class="mu-target">${
        stanza.temp
          ? `<span class="mu-grande">${temp === null ? "—" : `${decimale(temp)}°`}</span>`
          : luci.length
            ? `<span class="mu-grande">${accese}/${luci.length}</span><span class="mu-et">${esc(t("luci", "lights"))}</span>`
            : ""
      }${umid === null ? "" : `<span class="mu-et mu-umido">${decimale(umid, 0)}% ${esc(t("umidità", "humidity"))}</span>`}</div></div></div>`;
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
      `<button type="button" class="mu-carta mu-card mu-cam" data-mu-fa="finestra-telecamera" data-mu-entita="${esc(k.entita)}" data-mu-card="${i}"><div class="mu-video${classeDelFondo(k.immagine)}">${fondoMarkup(k.immagine)}${anteprimaInCorso ? "" : `<img data-mu-telecamera="${esc(k.entita)}" alt="">`}<span class="mu-live">${esc(clean(k.nome) || nomeDi(k.entita))}</span></div></button>`,
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
/* La voce del lettore scritta nella sezione Musica: i suoi «Altri comandi»,
 * le «Altre letture», il «Telecomando». La pagina Musica a muro li mostra
 * come la plancia; prima leggeva solo il lettore, e quello che si aggiungeva
 * accanto — un sensore, un telecomando — nel config c'era e qui no. */
const voceDellaMusica = (entity) =>
  (state.fonte?.lettori || []).find((l) => l.entity === entity) || {};

function lettoreOra(voce) {
  segna(voce.entita);
  const scritta = voceDellaMusica(voce.entita);
  const lettura = letturaDelLettore(
    { ...scritta, entity: voce.entita, nome: voce.nome },
    allStates() || {},
    (v) => v,
    piattaformeConosciute(),
  );
  for (const c of lettura.comandi || []) segna(c.entita || c.entity);
  for (const l of lettura.letture || []) segna(l.entity);
  if (scritta.telecomando) segna(scritta.telecomando);
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
  return `<div class="mu-carta mu-mp ${l.suona ? "mu-accesa" : ""}${classeDellaTessera(`lettore:${l.entity}`)}" style="--acc:#ec4899" data-mu-mp="${esc(l.entity)}">${fondoDellaTessera(`lettore:${l.entity}`)}
    ${l.copertina ? `<img class="mu-mp-fondo" data-mu-copertina="${esc(l.copertina)}" src="${esc(l.copertina)}" alt="" aria-hidden="true">` : ""}
    <div class="mu-mp-testa">
      ${l.copertina ? `<img class="mu-mp-arte" data-mu-copertina="${esc(l.copertina)}" src="${esc(l.copertina)}" alt="">` : `<span class="mu-mp-arte mu-mp-arte-vuota">${disegno("media", 64, `mp-${l.entity}`)}</span>`}
      <div class="mu-mp-dici">
        <span class="mu-et">${esc(l.nome)} · ${esc(parolaDelLettore(l))}</span>
        <div class="mu-osw mu-mp-titolo">${esc(titolo)}</div>
        ${sotto ? `<div class="mu-sotto">${esc(sotto)}</div>` : ""}
      </div>
      ${bottoneDaScegliere(l)}
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
    ${comandiDelLettore(l)}
    ${lettureDelLettore(l)}
    ${telecomandoDelLettoreMuro(l)}
  </div>`;
}

/* Gli «altri comandi» del lettore, quelli scelti nella sezione Musica: le
 * stesse pastiglie della plancia, col loro stato, e il tocco che fa il gesto
 * del loro dominio. Un telecomando si accende e si spegne, o manda il comando
 * scritto accanto (`remote.sala:volume_up`). */
function comandiDelLettore(l) {
  const comandi = (l?.comandi || []).filter((c) => c.comando || stato(c.entita || c.entity));
  if (!comandi.length) return "";
  return `<div class="mu-mp-sorgenti mu-mp-comandi">${comandi
    .map((c) => {
      const id = c.entita || c.entity;
      if (dominio(id) === "remote") {
        const premuto = c.comando ? "" : ` aria-pressed="${acceso(id)}"`;
        const parole = c.comando ? "" : statoInParole(id);
        return `<button type="button" class="${!c.comando && acceso(id) ? "si" : ""}" data-mu-fa="mp-accanto" data-mu-entita="${esc(l.entity)}" data-mu-voce="${esc(c.entity)}"${premuto}${c.available ? "" : " disabled"}>${esc(c.comando ? `${nomeDi(id)} · ${c.comando}` : nomeDi(id))}${parole ? ` <small>${esc(parole)}</small>` : ""}</button>`;
      }
      const s = stato(id);
      const servizio = servizioDellEntita(id, String(s?.state || ""));
      const parole = statoInParole(id);
      return `<button type="button" class="${acceso(id) ? "si" : ""}" ${servizio ? `data-mu-fa="entita" data-mu-entita="${esc(id)}"` : `data-mu-entita="${esc(id)}" aria-disabled="true"`}>${esc(nomeDi(id))}${parole ? ` <small>${esc(parole)}</small>` : ""}</button>`;
    })
    .join("")}</div>`;
}

/* Le «altre letture»: si guardano e basta — il nome e il numero con la sua
 * unita', come sulla plancia. */
function lettureDelLettore(l) {
  const letture = l?.letture || [];
  if (!letture.length) return "";
  return `<div class="mu-mp-sorgenti mu-mp-letture">${letture
    .map(
      (x) =>
        `<span class="mu-mp-lettura" data-mu-mp-lettura="${esc(x.entity)}">${esc(nomeDi(x.entity))} <b>${esc(x.testo)}</b></span>`,
    )
    .join("")}</div>`;
}

/* Le frecce del telecomando di una TV che la plancia conosce: le stesse
 * della scheda Musica, in una fila. */
const SEGNI_DEL_TELECOMANDO = Object.freeze({
  su: "▲",
  giu: "▼",
  sinistra: "◀",
  destra: "▶",
  ok: "OK",
  indietro: "↩",
  home: "⌂",
  menu: "☰",
  canale_meno: "CH−",
  canale_piu: "CH+",
});
function telecomandoDelLettoreMuro(l) {
  const tasti = tastiDelTelecomando(l?.telecomando);
  if (!tasti.length) return "";
  return `<div class="mu-mp-sorgenti mu-mp-tele">${tasti
    .map(
      (tasto) =>
        `<button type="button" data-mu-fa="mp-tele" data-mu-tasto="${esc(tasto)}" data-mu-entita="${esc(l.entity)}">${esc(SEGNI_DEL_TELECOMANDO[tasto] || tasto)}</button>`,
    )
    .join("")}</div>`;
}

/* I lettori della pagina che sanno mettersi in gruppo, letti adesso. */
let lettoriDiQui = [];
/* «Scegli cosa suonare»: la stessa finestra della scheda Musica — i preferiti
 * di Sonos con le playlist di Deezer, le cartelle della libreria, la ricerca
 * di Music Assistant — aperta sopra il pannello. Dal muro prima si poteva
 * solo comandare quello che qualcuno aveva fatto partire da un'altra parte. */
function bottoneDaScegliere(l) {
  if (!l.puo.sfoglia || l.muto) return "";
  return `<button type="button" class="mu-mp-gruppo mu-mp-scegli" data-mu-fa="mp-scegli-musica" data-mu-entita="${esc(l.entity)}" aria-label="${esc(t("Scegli cosa suonare", "Choose what to play"))}"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.4 6.6h11.2M4.4 11h11.2M4.4 15.4h6.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19.4 8.6v7.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="17.5" cy="16.4" r="2" fill="currentColor"/></svg><span>${esc(t("Scegli", "Choose"))}</span></button>`;
}

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
  return `<div class="mu-carta mu-mp-riga${l.entity === scelto ? " si" : ""}${l.suona ? " mu-accesa" : ""}${classeDellaTessera(`lettore:${l.entity}`)}" style="--acc:#ec4899" data-mu-fa="mp-scegli" data-mu-entita="${esc(l.entity)}" role="button" tabindex="0">${fondoDellaTessera(`lettore:${l.entity}`)}
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

const potenzaScritta = (watt) =>
  Math.abs(watt) >= 1000
    ? `${decimale(Math.abs(watt) / 1000, 1)} kW`
    : `${decimale(Math.abs(watt), 0)} W`;

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
      "",
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
      "",
    ]);
  }
  /* La rete e la batteria col loro verso (`potenzaConIlSegno`): con un
   * sensore col segno, o con due sensori sempre positivi. */
  const watt = (id) => potenza(id).valore;
  const scambio = potenzaConIlSegno(
    { segno: e.rete, positivo: e.prelievo, negativo: e.immissione, girata: e.reteGirata },
    watt,
  );
  if (e.rete || e.prelievo || e.immissione) {
    const cede = scambio !== null && scambio < 0;
    const parola =
      scambio === null
        ? t("Rete", "Grid")
        : cede
          ? t("Cede alla rete", "To the grid")
          : t("Preleva dalla rete", "From the grid");
    tessere.push([
      "rete",
      "energia",
      cede ? "#10b981" : "#8b5cf6",
      parola,
      scambio === null ? "—" : potenzaScritta(Math.abs(scambio)),
      nomeDi((cede ? e.immissione : e.prelievo) || e.rete || e.prelievo || e.immissione),
      "",
    ]);
  }
  const flusso = potenzaConIlSegno(
    { segno: e.potenzaBatteria, positivo: e.scarica, negativo: e.carica, girata: e.batteriaGirata },
    watt,
  );
  /* Sotto i 30 W la batteria e' ferma: l'inverter che la tiene in pari non
   * e' una carica. */
  const cosaFa =
    flusso === null || Math.abs(flusso) < 30
      ? flusso === null
        ? null
        : { testo: t("Ferma", "Idle"), colore: "#94a3b8" }
      : flusso > 0
        ? {
            testo: `${t("In scarica", "Discharging")} · ${potenzaScritta(flusso)}`,
            colore: "#f97316",
          }
        : {
            testo: `${t("In carica", "Charging")} · ${potenzaScritta(-flusso)}`,
            colore: "#10b981",
          };
  if (e.batteria) {
    const v = numero(stato(e.batteria)?.state);
    tessere.push([
      "batteria",
      "batterie",
      cosaFa?.colore === "#f97316" ? "#f97316" : "#10b981",
      t("Batteria", "Battery"),
      v === null ? "—" : `${decimale(v, 0)}%`,
      nomeDi(e.batteria),
      cosaFa
        ? `<div class="mu-cosa-fa" style="color:${cosaFa.colore}">${esc(cosaFa.testo)}</div>`
        : "",
    ]);
  } else if (cosaFa) {
    /* Senza la carica in % resta la potenza: la tessera dice cosa fa. */
    tessere.push([
      "batteria",
      "batterie",
      cosaFa.colore,
      t("Batteria", "Battery"),
      flusso !== null && Math.abs(flusso) >= 30 ? potenzaScritta(Math.abs(flusso)) : cosaFa.testo,
      nomeDi(e.potenzaBatteria || e.scarica || e.carica),
      flusso !== null && Math.abs(flusso) >= 30
        ? `<div class="mu-cosa-fa" style="color:${cosaFa.colore}">${esc(flusso > 0 ? t("In scarica", "Discharging") : t("In carica", "Charging"))}</div>`
        : "",
    ]);
  }
  /* Le misure in più: il nome dell'entità sopra, il valore grande. Una
   * potenza si scrive come le altre (W o kW); il resto col suo numero e la
   * sua unità. */
  altreMisureDellaPagina(pagina).forEach((id, n) => {
    const s = stato(id);
    const unita = clean(s?.attributes?.unit_of_measurement);
    const v = numero(s?.state);
    const valore = /^k?w$/i.test(unita)
      ? potenza(id).testo
      : v === null
        ? clean(s?.state) || "—"
        : `${decimale(v, Math.abs(v) < 10 && v % 1 ? 1 : 0)}${unita ? ` ${unita}` : ""}`;
    tessere.push([`altra-${n}`, "energia", "#64748b", nomeDi(id), valore, "", ""]);
  });
  if (!tessere.length)
    return griglia(pagina, [
      vuoto(0, t("Scegli le misure nel config", "Choose the readings in the config")),
    ]);
  const carte = tessere.map(
    ([k, d, acc, etichetta, valore, sotto, extra], i) =>
      `<div class="mu-carta mu-card mu-accesa mu-energia${classeDellaTessera(k)}" style="--acc:${acc}" data-mu-card="${i}" data-mu-misura="${k}">${fondoDellaTessera(k)}
      <div class="mu-riga1"><span class="mu-chip mu-acc" style="--c:54px">${disegno(d, 32, `en-${k}`)}</span><span class="mu-et">${esc(etichetta)}</span></div>
      <div class="mu-grande">${esc(valore)}</div>${extra || ""}<div class="mu-sotto">${esc(sotto)}</div></div>`,
  );
  /* Le tessere stanno tutte nella griglia: con le misure in più si allarga
   * da sola (6, 8, 12), senza scorrere. */
  return griglia(
    { ...pagina, griglia: Math.max(grigliaPer(carte.length), carte.length <= 4 ? 4 : 0) },
    carte,
  );
}

/* ── la pagina Meteo ──────────────────────────────────────────────────────
 *
 * «La sezione meteo della plancia principale su un tablet grande e' bella:
 * la vorrei a muro come pagina intera.» Com'e' adesso in grande — il segno
 * del tempo, i gradi, la condizione, la percepita, l'umidita', il vento e la
 * pressione — poi le prossime ore in una striscia e i prossimi giorni con la
 * loro forbice. Il meteo e' lo stesso che il tablet mostra in alto e sul
 * riposo (`entitaDelMeteo`), e le previsioni le chiede la pagina Meteo della
 * plancia (`previsioniDelMeteo`): la stessa domanda, la stessa mezz'ora.
 *
 * La striscia delle ore non scorre: sul tablet il dito che scorre di lato
 * cambia pagina. Ci stanno dodici ore sul tablet grande e otto sul piccolo,
 * e le altre se ne vanno (CSS). */
const SIGLE_DEL_VENTO = () => [
  t("N", "N"),
  t("NE", "NE"),
  t("E", "E"),
  t("SE", "SE"),
  t("S", "S"),
  t("SO", "SW"),
  t("O", "W"),
  t("NO", "NW"),
];

function oraDelMeteo(quando) {
  try {
    return new Date(quando).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
  } catch (_errore) {
    return "";
  }
}

function giornoDelMeteo(voce) {
  if (voce.oggi) return t("Oggi", "Today");
  try {
    const nome = new Intl.DateTimeFormat(locale(), { weekday: "short", day: "numeric" })
      .format(new Date(voce.quando))
      .replace(/\./g, "");
    return nome.charAt(0).toLocaleUpperCase(locale()) + nome.slice(1);
  } catch (_errore) {
    return "";
  }
}

/* La frase sulle prossime ore, corta: sul muro si legge da lontano. */
function fraseDelMuro(frase) {
  if (!frase) return null;
  const ora = oraDelMeteo(frase.quando);
  const probabile = Number.isFinite(frase.probabilita) ? Math.round(frase.probabilita) : null;
  if (frase.tipo === "arriva")
    return {
      stato: "pioggia",
      segno: frase.neve ? "❄️" : "☔",
      testo: frase.neve
        ? t(`Neve verso le ${ora}`, `Snow around ${ora}`)
        : t(`Pioggia verso le ${ora}`, `Rain around ${ora}`),
      sotto: probabile === null ? "" : t(`${probabile}% di probabilità`, `${probabile}% chance`),
    };
  if (frase.tipo === "smette")
    return {
      stato: "pioggia",
      segno: "🌦️",
      testo: t(`Smette verso le ${ora}`, `Stops around ${ora}`),
      sotto: "",
    };
  if (frase.tipo === "continua")
    return {
      stato: "pioggia",
      segno: "🌧️",
      testo: t("Pioggia per tutte le prossime ore", "Rain for all the coming hours"),
      sotto: "",
    };
  return {
    stato: "asciutto",
    segno: "🌤️",
    testo: t("Niente pioggia nelle prossime 24 ore", "No rain in the next 24 hours"),
    sotto: "",
  };
}

export const EVENTO_PREVISIONI = "dashboardmodern:muro-previsioni";
function previsioniArrivate() {
  disegna();
  try {
    root.dispatchEvent?.(new CustomEvent(EVENTO_PREVISIONI));
  } catch (_errore) {}
}

function meteoVuoto(acc) {
  return `<div class="mu-carta mu-mt-vuoto" style="--acc:${acc}" data-mu-meteo-vuoto>
    <span class="mu-chip mu-acc" style="--c:96px">${disegno("meteo", 60, "meteo-vuoto")}</span>
    <b>${esc(t("Nessun meteo da mostrare", "No weather to show"))}</b>
    <span>${esc(
      t(
        "Scegli l'entità meteo in ⚙️ Config › A muro › Altre impostazioni › Meteo, oppure aggiungi un'integrazione meteo in Home Assistant.",
        "Choose the weather entity in ⚙️ Config › On the wall › More settings › Weather, or add a weather integration in Home Assistant.",
      ),
    )}</span>
  </div>`;
}

function paginaMeteo(pagina) {
  const acc = accentoDi(pagina);
  const id = entitaDelMeteo();
  if (!id) return `<div class="mu-mt mu-mt-solo">${meteoVuoto(acc)}</div>`;
  /* Arrivate le previsioni si ridisegna il tablet, e l'anteprima del config
   * se e' aperta (`EVENTO_PREVISIONI`). */
  const previsioni = previsioniDelMeteo(id, previsioniArrivate);
  /* L'adesso al minuto: le linee delle ultime 24 ore si ricampionano
   * sull'adesso, e al millisecondo cambierebbero a ogni battito, rifacendo il
   * tablet intero ogni quindici secondi per un pixel. */
  const minuto = Math.floor(Date.now() / 60_000) * 60_000;
  /* La stazione e' quella della pagina Meteo della plancia, con la sua
   * configurazione: niente da scegliere qui. I suoi sensori non si segnano fra
   * quelli che ridisegnano subito: un anemometro che scrive ogni pochi
   * secondi rifarebbe il tablet altrettanto spesso, e il battito dei quindici
   * secondi li legge comunque. */
  const vista = vistaDelMeteo(allStates() || {}, minuto, { entita: id, prefisso: "muro-" });
  const v = meteoDelMuro(stato(id), { ...previsioni, stazione: vista?.stazione, adesso: minuto });
  if (!v) return `<div class="mu-mt mu-mt-solo">${meteoVuoto(acc)}</div>`;
  if (vista?.tessere?.length) {
    /* La cronologia la chiede la pagina Meteo della plancia, con la sua cache
     * e i suoi cinque minuti: qui la si ricorda soltanto a ogni ridisegno. */
    storiaDellaStazione(vista.sensori, previsioniArrivate);
    segna("sun.sun");
  }
  const m = v.misure;
  const gradi = (n) => (Number.isFinite(n) ? `${Math.round(n)}°` : "—");
  const forbice = [
    v.oggi?.bassa != null ? `${esc(t("Min", "Min"))} <b>${gradi(v.oggi.bassa)}</b>` : "",
    v.oggi?.alta != null ? `${esc(t("Max", "Max"))} <b>${gradi(v.oggi.alta)}</b>` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const misura = (chiave, disegnoDi, etichetta, valore, sotto = "") =>
    `<div class="mu-mt-misura" data-mu-meteo-misura="${chiave}"><span class="mu-mt-misura-testa">${disegno(disegnoDi, 22, `mt-${chiave}`)}<span class="mu-et">${esc(etichetta)}</span></span><b>${valore}</b>${sotto ? `<small>${esc(sotto)}</small>` : ""}</div>`;
  const misure = [];
  if (m.percepita)
    misure.push(
      misura("percepita", "temperatura", t("Percepita", "Feels like"), `${decimale(m.percepita.valore, 0)}°`),
    );
  if (m.umidita)
    misure.push(
      misura("umidita", "umidita", t("Umidità", "Humidity"), `${decimale(m.umidita.valore, 0)}<i>%</i>`),
    );
  if (m.vento) {
    const sigla = v.spicchio === null ? "" : SIGLE_DEL_VENTO()[v.spicchio];
    const raffica = m.raffica ? `${t("raffiche", "gusts")} ${decimale(m.raffica.valore, 0)}` : "";
    misure.push(
      misura(
        "vento",
        "aria",
        t("Vento", "Wind"),
        `${decimale(m.vento.valore, 0)}<i>${esc(m.vento.unita)}</i>${sigla ? `<em>${esc(sigla)}</em>` : ""}`,
        raffica,
      ),
    );
  }
  if (m.pressione)
    misure.push(
      misura(
        "pressione",
        "contatori",
        t("Pressione", "Pressure"),
        /* Senza il punto delle migliaia: «1.014 hPa» si legge «un ettopascal». */
        `${esc(Math.round(m.pressione.valore).toString())}<i>${esc(m.pressione.unita)}</i>`,
      ),
    );
  const frase = fraseDelMuro(v.frase);
  const temperatura = m.temperatura ? decimale(m.temperatura.valore, 0) : "—";
  const adesso = `<div class="mu-carta mu-accesa mu-mt-adesso${classeDellaTessera("adesso")}" style="--acc:${acc}" data-mu-meteo-blocco="adesso">${fondoDellaTessera("adesso")}
    <div class="mu-mt-cielo">
      <span class="mu-mt-segno" aria-hidden="true">${segnoDelTempo(v.condizione)}</span>
      <div class="mu-mt-gradi">
        <b data-mu-meteo-gradi>${esc(temperatura)}<i>°</i></b>
        <span class="mu-mt-cond">${esc(v.disponibile ? parolaDellaCondizione(v.condizione) : t("Non disponibile", "Unavailable"))}</span>
        ${forbice ? `<small class="mu-mt-forbice">${forbice}</small>` : ""}
      </div>
    </div>
    ${frase ? `<div class="mu-mt-frase" data-stato="${frase.stato}"><span aria-hidden="true">${frase.segno}</span><b>${esc(frase.testo)}</b>${frase.sotto ? `<small>${esc(frase.sotto)}</small>` : ""}</div>` : ""}
    ${misure.length ? `<div class="mu-mt-misure" style="--n:${misure.length}">${misure.join("")}</div>` : ""}
  </div>`;
  const inArrivo = previsioni.pronte
    ? t("Questo meteo non dà previsioni", "This weather gives no forecast")
    : t("Previsioni in arrivo…", "Forecast on its way…");
  const titoletto = (testo) => `<div class="mu-et mu-mt-titolo">${esc(testo)}</div>`;
  const ore = v.ore.length
    ? `<div class="mu-mt-fila" style="--n:${v.ore.length}">${v.ore
        .map((voce, i) => {
          const p = Number.isFinite(voce.probabilita) ? Math.round(voce.probabilita) : null;
          return `<div class="mu-mt-ora${i === 0 ? " ora" : ""}" data-mu-meteo-ora="${voce.quando}">
          <span class="mu-mt-ora-h">${esc(i === 0 ? t("Ora", "Now") : oraDelMeteo(voce.quando))}</span>
          <span class="mu-mt-ora-segno" aria-hidden="true">${segnoDelTempo(voce.condizione)}</span>
          <b>${gradi(voce.temperatura)}</b>
          <span class="mu-mt-goccia${p ? "" : " zero"}" style="--p:${p ?? 0}%"><i></i></span>
          <small>${p === null ? "" : `${p}%`}</small>
        </div>`;
        })
        .join("")}</div>`
    : `<div class="mu-mt-attesa">${esc(inArrivo)}</div>`;
  const giorni = v.giorni;
  const bassi = giorni.map((g) => g.bassa ?? g.temperatura).filter(Number.isFinite);
  const alti = giorni.map((g) => g.temperatura ?? g.bassa).filter(Number.isFinite);
  const fondo = Math.min(...bassi, ...alti);
  const cima = Math.max(...bassi, ...alti);
  const posto = (n) => ((n - fondo) / (cima - fondo || 1)) * 100;
  const righe = giorni.length
    ? `<div class="mu-mt-giorni" style="--n:${giorni.length}">${giorni
        .map((g) => {
          const min = g.bassa ?? g.temperatura;
          const max = g.temperatura ?? g.bassa;
          const p = Number.isFinite(g.probabilita) && g.probabilita > 0 ? Math.round(g.probabilita) : null;
          const da = Number.isFinite(min) ? posto(min) : 0;
          const a = Number.isFinite(max) ? posto(max) : 100;
          return `<div class="mu-mt-giorno${g.oggi ? " oggi" : ""}" data-mu-meteo-giorno="${g.quando}">
          <span class="mu-mt-giorno-n">${esc(giornoDelMeteo(g))}</span>
          <span class="mu-mt-giorno-segno" aria-hidden="true">${segnoDelTempo(g.condizione)}</span>
          <span class="mu-mt-giorno-p">${p === null ? "" : `💧 ${p}%`}</span>
          <b class="mu-mt-min">${gradi(min)}</b>
          <span class="mu-mt-barra"><i style="left:${da.toFixed(1)}%;right:${(100 - a).toFixed(1)}%"></i></span>
          <b class="mu-mt-max">${gradi(max)}</b>
        </div>`;
        })
        .join("")}</div>`
    : `<div class="mu-mt-attesa">${esc(inArrivo)}</div>`;
  const blocchiDelleOre = `<div class="mu-carta mu-mt-scheda mu-mt-prossimi" data-mu-meteo-blocco="giorni">${titoletto(t("Prossimi giorni", "Next days"))}${righe}</div>
    <div class="mu-carta mu-mt-scheda mu-mt-ore" data-mu-meteo-blocco="ore">${titoletto(t("Ora per ora", "Hour by hour"))}${ore}</div>`;
  /* Con la stazione la pagina e' quella della plancia: «Adesso» con le sue
   * pastiglie e la riga della provenienza, «La mia stazione» con le tessere e
   * le ultime 24 ore, disegnati dalla sezione Meteo stessa; accanto i giorni e
   * le ore del muro. */
  if (vista?.tessere?.length)
    return `<div class="mu-mt mu-mt-stazione" data-mu-meteo="${esc(id)}" data-mu-meteo-tessere="${vista.tessere.length}" style="--acc:${acc}">
    <div class="mu-mt-pl mu-mt-pl-adesso">${adessoDelMeteo(vista)}</div>
    <div class="mu-mt-pl mu-mt-pl-stazione">${stazioneDelMeteo(vista)}</div>
    ${blocchiDelleOre}
  </div>`;
  return `<div class="mu-mt" data-mu-meteo="${esc(id)}">
    ${adesso}
    <div class="mu-carta mu-mt-scheda mu-mt-prossimi" data-mu-meteo-blocco="giorni">${titoletto(t("Prossimi giorni", "Next days"))}${righe}</div>
    <div class="mu-carta mu-mt-scheda mu-mt-ore" data-mu-meteo-blocco="ore">${titoletto(t("Ora per ora", "Hour by hour"))}${ore}</div>
  </div>`;
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
  /* Con piu' aree contano gli ingressi di tutte quelle della pagina. */
  const dichiarati = [
    ...new Set(
      areeDellaPagina(state.muro?.pagine?.[state.pagina]).flatMap(
        (a) => fonte.antifurto?.ingressi?.[a.entita] || [],
      ),
    ),
  ];
  const quali = dichiarati.length ? ingressiDellaCentrale(righe, { ingressi: dichiarati }) : righe;
  return quali.filter((riga) => riga.stato === "aperto").map((riga) => riga.name);
}

/* ── le «Altre letture» e gli «Altri comandi» dell'ingresso ───────────────
 *
 * «Dentro la pagina dell'antifurto ci metterei la possibilita' di riprendere
 * altri dati, tipo se ci sono finestre aperte. Magari allo stesso modo come
 * sull'audio.» Le stesse pastiglie della Musica: le letture col loro valore,
 * le porte e le finestre in un conto solo, i comandi col loro stato. Ogni
 * lettura si tocca e dice di piu'. */

/* Come si chiama il conto delle aperture. */
const parolaDelGruppo = (tipo) =>
  ({
    finestre: t("Finestre aperte", "Open windows"),
    porte: t("Porte aperte", "Open doors"),
  })[tipo] || t("Aperture aperte", "Open doors and windows");
const parolaDelGruppoChiuso = (tipo) =>
  ({
    finestre: t("Finestre chiuse", "Windows closed"),
    porte: t("Porte chiuse", "Doors closed"),
  })[tipo] || t("Tutto chiuso", "All closed");

const CLASSI_CHE_SI_APRONO = new Set(["window", "door", "garage_door", "opening"]);

/* Il valore di una lettura in parole: una finestra e' aperta o chiusa, non
 * accesa; un movimento c'e' o no. Il resto come lo dice il tablet. */
function parolaDellaLettura(id) {
  const s = stato(id);
  if (!s) return t("Non trovata", "Not found");
  const v = String(s.state);
  if (dominio(id) === "binary_sensor" && (v === "on" || v === "off")) {
    const classe = String(s.attributes?.device_class || "");
    const on = v === "on";
    if (CLASSI_CHE_SI_APRONO.has(classe)) return on ? t("Aperta", "Open") : t("Chiusa", "Closed");
    if (["motion", "occupancy", "presence"].includes(classe))
      return on ? t("Movimento", "Motion") : t("Nessuno", "Clear");
    if (classe === "moisture") return on ? t("Acqua!", "Water!") : t("Asciutto", "Dry");
    if (["smoke", "gas", "carbon_monoxide", "safety", "problem"].includes(classe))
      return on ? t("Attenzione", "Alert") : t("Tutto bene", "All clear");
  }
  if (dominio(id) === "cover") {
    const pos = numero(s.attributes?.current_position);
    if (v === "open" && pos !== null && pos > 0 && pos < 100) return `${pos}%`;
  }
  return statoInParole(id);
}

/* Una lettura da guardare con attenzione: una porta aperta, una serratura
 * aperta, un sensore che dice «attenzione». */
function letturaDaGuardare(id) {
  const s = stato(id);
  const v = String(s?.state || "");
  if (dominio(id) === "binary_sensor") {
    const classe = String(s?.attributes?.device_class || "");
    return (
      v === "on" &&
      (CLASSI_CHE_SI_APRONO.has(classe) ||
        ["moisture", "smoke", "gas", "carbon_monoxide", "safety", "problem"].includes(classe))
    );
  }
  if (dominio(id) === "lock") return v === "unlocked" || v === "open";
  return false;
}

/* Le letture dell'ingresso: il conto delle aperture e le altre una per una. */
function lettureDellIngressoMarkup(ing) {
  const { gruppo, singole: tutte } = lettureDellIngresso(ing?.letture || [], allStates() || {});
  /* Una serratura scelta sia da leggere sia da toccare e' un tasto solo,
   * che dice anche com'e'. */
  const comandi = new Set((ing?.comandi || []).map((v) => partiDelComando(v).entity));
  const singole = tutte.filter((id) => !comandi.has(id));
  if (!gruppo && !singole.length) return "";
  const pastiglie = [];
  if (gruppo) {
    gruppo.tutte.forEach(segna);
    const n = gruppo.aperte.length;
    pastiglie.push(
      `<button type="button" class="mu-ing-lettura mu-ing-conto${n ? " guarda" : " tutto-bene"}" data-mu-fa="ing-lettura" data-mu-gruppo="1">${disegno(gruppo.tipo === "porte" ? "aperture" : "finestra", 22, "ing-conto")}${
        n
          ? `${esc(parolaDelGruppo(gruppo.tipo))}: <b>${n}</b>`
          : `${esc(parolaDelGruppoChiuso(gruppo.tipo))} <b>${gruppo.tutte.length}/${gruppo.tutte.length}</b>`
      }</button>`,
    );
  }
  for (const id of singole)
    pastiglie.push(
      `<button type="button" class="mu-ing-lettura${letturaDaGuardare(id) ? " guarda" : ""}" data-mu-fa="ing-lettura" data-mu-entita="${esc(id)}">${esc(nomeDi(id))} <b>${esc(parolaDellaLettura(id))}</b></button>`,
    );
  return `<div class="mu-ing-letture">${pastiglie.join("")}</div>`;
}

/* Il servizio di un comando dell'ingresso: un telecomando manda il suo
 * comando, una serratura si chiude o si apre, una tapparella va su o giu',
 * il resto come i comandi accanto al lettore della Musica. */
export function servizioDelComandoDIngresso(voce, statoAttuale = "") {
  const { entity: id, comando } = partiDelComando(voce);
  if (!id) return null;
  if (comando)
    return { domain: "remote", service: "send_command", data: { entity_id: id, command: comando } };
  if (genereDelComando(id) && genereDelComando(id) !== "tendina")
    return comandoDelDispositivo({ entity: id });
  const servizio = servizioDellEntita(id, statoAttuale);
  return servizio ? { ...servizio, data: { entity_id: id } } : null;
}

const SI_PREMONO = new Set(["button", "input_button", "script", "scene", "automation"]);

/* I comandi dell'ingresso: le pastiglie della Musica, col loro stato. */
function comandiDellIngressoMarkup(ing) {
  const comandi = ing?.comandi || [];
  if (!comandi.length) return "";
  return `<div class="mu-ing-comandi">${comandi
    .map((voce) => {
      const { entity: id, comando } = partiDelComando(voce);
      const s = stato(id);
      const premuto = !comando && !SI_PREMONO.has(dominio(id));
      const parole = premuto ? parolaDellaLettura(id) : "";
      const si =
        premuto && (dominio(id) === "lock" ? letturaDaGuardare(id) : acceso(id)) ? " si" : "";
      return `<button type="button" class="mu-ing-comando${si}" data-mu-fa="ing-comando" data-mu-voce="${esc(voce)}"${s || comando ? "" : " disabled"}>${esc(comando ? `${nomeDi(id)} · ${comando}` : nomeDi(id))}${parole ? ` <small>${esc(parole)}</small>` : ""}</button>`;
    })
    .join("")}</div>`;
}

/* Le letture e i comandi sotto l'antifurto, se ce ne sono. */
function altroDellIngresso(ing, { conLeLetture = false } = {}) {
  const dentro = `${conLeLetture ? lettureDellIngressoMarkup(ing) : ""}${comandiDellIngressoMarkup(ing)}`;
  return dentro ? `<div class="mu-ing-altro">${dentro}</div>` : "";
}

/* La finestra di una lettura: il conto delle aperture, una per riga, o una
 * lettura sola col suo valore grande; per una serratura o una tapparella
 * anche il suo tasto. */
function finestraDellaLettura(f) {
  const pagina = state.muro?.pagine?.[f.pagina ?? state.pagina];
  const ing = pagina?.ingresso || {};
  const { gruppo } = lettureDellIngresso(ing.letture || [], allStates() || {});
  const ids = f.gruppo ? gruppo?.tutte || [] : [f.entita];
  const titolo = f.gruppo
    ? gruppo?.aperte.length
      ? `${parolaDelGruppo(gruppo.tipo)}: ${gruppo.aperte.length}`
      : parolaDelGruppoChiuso(gruppo?.tipo)
    : nomeDi(f.entita);
  const quando = (id) => {
    const cambio = Date.parse(stato(id)?.last_changed || "");
    if (!Number.isFinite(cambio)) return "";
    const ora = orologio(new Date(cambio)).ora;
    return t(`dalle ${ora}`, `since ${ora}`);
  };
  /* Prima quelle da guardare: in cima quello che e' rimasto aperto. */
  const ordinate = [...ids].sort((a, b) => letturaDaGuardare(b) - letturaDaGuardare(a));
  const righe = ordinate
    .map((id) => {
      const tocca = ["lock", "cover"].includes(dominio(id));
      const verbo =
        dominio(id) === "lock"
          ? String(stato(id)?.state) === "locked"
            ? t("Apri", "Unlock")
            : t("Chiudi", "Lock")
          : String(stato(id)?.state) === "closed"
            ? t("Apri", "Open")
            : t("Chiudi", "Close");
      return `<div class="mu-ing-riga${letturaDaGuardare(id) ? " guarda" : ""}" data-mu-lettura="${esc(id)}"><i></i><div class="mu-nome"><div class="mu-n">${esc(nomeDi(id))}</div>${quando(id) ? `<div class="mu-sotto">${esc(quando(id))}</div>` : ""}</div><b>${esc(parolaDellaLettura(id))}</b>${tocca ? `<button type="button" class="mu-btn" data-mu-fa="ing-comando" data-mu-voce="${esc(id)}">${esc(verbo)}</button>` : ""}</div>`;
    })
    .join("");
  return `<div class="mu-fin-clima">
      <div class="mu-riga1"><span class="mu-chip mu-acc" style="--c:52px">${disegno(f.gruppo ? "finestra" : disegnoDellEntita(f.entita), 30, "fin-lettura")}</span><div class="mu-nome"><div class="mu-n" style="font-size:24px">${esc(titolo)}</div></div><button type="button" class="mu-tondo" data-mu-fa="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
      <div class="mu-ing-righe">${righe || `<div class="mu-sotto">${esc(t("Niente da mostrare qui", "Nothing to show here"))}</div>`}</div></div>`;
}

/* L'ingresso su un pannello piccolo: sei tessere, ognuna un gesto. Lo stato
 * dell'antifurto e il citofono aprono la loro finestra; «apri» apre. */
function paginaIngressoCompatta(pagina) {
  const ing = pagina.ingresso;
  const aree = areeDellaPagina(pagina);
  const centrale = centraleDelMuro(pagina);
  const s = aree.length > 1 ? null : stato(centrale);
  const riassunto = aree.length > 1 ? riassuntoDelleAree(aree) : null;
  const valore = riassunto ? riassunto.valore : String(s?.state || "");
  const spento = valore === "disarmed";
  const letture = lettureDellIngresso(ing.letture, allStates() || {});
  const uscita = azioneDi(spento ? ing.esco : ing.rientro || ing.esco);
  const persone = personeInCasa();
  const tessere = [
    s || riassunto
      ? tessera({
          chiave: "sicurezza",
          accento: valore === "triggered" ? ACCENTI.allarme : spento ? "#10b981" : "#6366f1",
          etichetta: riassunto ? quanteAree(aree.length) : t("Antifurto", "Alarm"),
          titolo: riassunto ? riassunto.testo : statoDellaCentrale(s),
          sotto: "",
          attiva: true,
          dati: `data-mu-fa="finestra-antifurto"`,
          dove: "c-allarme",
          immagine: immagineDellaTessera("allarme"),
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
          immagine: immagineDellaTessera("citofono"),
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
          immagine: immagineDellaTessera("apri"),
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
          immagine: immagineDellaTessera("apri2"),
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
          immagine: immagineDellaTessera("uscita"),
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
          immagine: immagineDellaTessera("persone"),
        })
      : "",
    /* Le porte e le finestre scelte fra le «Altre letture»: il loro conto,
     * e il tocco le elenca. */
    letture.gruppo
      ? tessera({
          chiave: "finestra",
          accento: letture.gruppo.aperte.length ? "#f59e0b" : "#10b981",
          etichetta: parolaDelGruppo(letture.gruppo.tipo),
          titolo: String(letture.gruppo.aperte.length),
          sotto: "",
          dati: `data-mu-fa="ing-lettura" data-mu-gruppo="1"`,
          dove: "c-letture",
          immagine: immagineDellaTessera("letture"),
        })
      : "",
  ]
    .filter(Boolean)
    .slice(0, 6);
  return `<div class="mu-g6">${tessere.join("")}</div>`;
}

function paginaIngresso(pagina) {
  if (state.compatto) return paginaIngressoCompatta(pagina);
  const ing = pagina.ingresso;
  const aree = areeDellaPagina(pagina);
  /* Chi ha scelto le sue porte e finestre fra le letture le vede nel loro
   * conto, sotto: l'avviso di sempre lo ripeterebbe. */
  const contoProprio = Boolean(lettureDellIngresso(ing.letture, allStates() || {}).gruppo);
  const aperte = ing.finestre && !contoProprio ? finestreAperte() : [];
  const avvisoFinestre = aperte.length
    ? `<div class="mu-sotto mu-avviso-finestre">${disegno("finestra", 22, "fin")}${esc(t("Aperte", "Open"))}: <b>${esc(aperte.slice(0, 3).join(", "))}${aperte.length > 3 ? ` +${aperte.length - 3}` : ""}</b></div>`
    : "";
  /* Piu' aree: una riga per area, ognuna coi suoi tasti; in cima le aree
   * tutte insieme in una parola. Una sola: la card di sempre. */
  if (aree.length > 1) {
    const riassunto = riassuntoDelleAree(aree);
    const carta = `<div class="mu-carta mu-accesa mu-allarme mu-allarme-aree${classeDellaTessera("allarme")}" style="--acc:${accentoDellAllarme(riassunto.valore)}">${fondoDellaTessera("allarme")}
      <div class="mu-riga1"><span class="mu-chip" style="--c:72px">${disegno("sicurezza", 44, "allarme")}</span>
        <div class="mu-allarme-dice"><span class="mu-et">${esc(quanteAree(aree.length))}</span><div class="mu-osw mu-stato-allarme">${esc(riassunto.testo)}${riassunto.suona.length ? ` · ${esc(riassunto.suona.map((a) => nomeDellArea(a, aree.indexOf(a))).join(", "))}` : ""}</div>
        ${avvisoFinestre}</div></div>
      ${areeMarkup(aree)}
      ${lettureNellAntifurto(ing)}
    </div>`;
    return restoDellIngresso(pagina, carta, riassunto.valore === "disarmed");
  }
  const centrale = centraleDelMuro(pagina);
  const s = stato(centrale);
  const valore = String(s?.state || "");
  /* Lo scattato su misura (l'interruttore che lo dice) vale quanto il
   * `triggered` di una centrale: la card diventa rossa e dice «ALLARME». */
  const suMisura = state.fonte?.antifurto?.scattato;
  const suonaSuMisura = Boolean(suMisura) && eScattatoAdesso(suMisura, allStates() || {});
  const scattato = valore === "triggered" || suonaSuMisura;
  const spento = valore === "disarmed";
  const accento = scattato ? ACCENTI.allarme : spento ? "#10b981" : "#6366f1";
  const modi = tastiDellAntifurto(s);
  const acceso = tastoAcceso(s, modi);
  const carta = `<div class="mu-carta mu-accesa mu-allarme${classeDellaTessera("allarme")}" style="--acc:${accento}">${fondoDellaTessera("allarme")}
      <div class="mu-riga1"><span class="mu-chip" style="--c:96px">${disegno("sicurezza", 60, "allarme")}</span>
        <div><span class="mu-et">${esc(t("Antifurto", "Alarm"))}</span><div class="mu-osw mu-stato-allarme">${esc(suonaSuMisura ? STATI_DELL_ALLARME().triggered : s ? statoDellaCentrale(s) : modi.find((m) => m.mode === acceso)?.label || (modi.length ? t("Disattivo", "Disarmed") : t("Nessuna centrale", "No alarm panel")))}</div>
        ${avvisoFinestre}</div></div>
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
      ${lettureNellAntifurto(ing)}
    </div>`;
  return restoDellIngresso(pagina, carta, spento);
}

/* Le porte e le finestre scelte fra le letture, dentro la card
 * dell'antifurto: «ricordati di mettere le finestre sul riquadro
 * antifurto». Stavano in una striscia in fondo alla pagina, mentre sotto le
 * aree restava mezza card vuota; li' si leggono accanto a quello che
 * proteggono. */
function lettureNellAntifurto(ing) {
  const letture = lettureDellIngressoMarkup(ing);
  return letture ? `<div class="mu-allarme-letture">${letture}</div>` : "";
}

/* Il citofono, l'uscita e chi c'e': uguali con un'area o con tante. */
function restoDellIngresso(pagina, carta, spento) {
  const ing = pagina.ingresso;
  const persone = personeInCasa();
  const uscita = spento ? ing.esco : ing.rientro || ing.esco;
  const azioneUscita = azioneDi(uscita);
  const telecamera = clean(ing.telecamera);
  /* Le altre letture e gli altri comandi: una striscia sotto l'antifurto e
   * il citofono, larga quanto la pagina. */
  const altro = altroDellIngresso(ing);
  return `<div class="mu-ingresso${altro ? " mu-con-striscia" : ""}">
    ${carta}
    <div class="mu-carta mu-citofono${classeDellaTessera("citofono")}">${fondoDellaTessera("citofono")}
      <div class="mu-video">${telecamera ? `<img data-mu-telecamera="${esc(telecamera)}" alt="">` : `<div class="mu-video-vuoto">${disegno("telecamere", 80, "tele-vuota")}</div>`}<span class="mu-live">${esc(telecamera ? nomeDi(telecamera) : t("Nessuna telecamera", "No camera"))}</span></div>
      ${
        ing.apri || ing.apri2
          ? `<div class="mu-due">${ing.apri ? `<button type="button" class="mu-btn pieno" data-mu-fa="apri" data-mu-entita="${esc(ing.apri)}">${disegno("varchi", 26, "apri1")}${esc(nomeDi(ing.apri, ing.nomeApri))}</button>` : ""}${ing.apri2 ? `<button type="button" class="mu-btn" data-mu-fa="apri" data-mu-entita="${esc(ing.apri2)}">${disegno("aperture", 26, "apri2")}${esc(nomeDi(ing.apri2, ing.nomeApri2))}</button>` : ""}</div>`
          : ""
      }
    </div>
    ${altro ? `<div class="mu-carta mu-ing-striscia${classeDellaTessera("letture")}">${fondoDellaTessera("letture")}${altro}</div>` : ""}
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
              immagine: immagineDellaTessera("uscita"),
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
              immagine: immagineDellaTessera("persone"),
            })
          : ""
      }
    </div>
  </div>`;
}

/* ── la regia: mixer, telecamera, comandi ──────────────────────────────────
 *
 * «Cerca di creare una cosa del genere per wall»: le tre pagine di un
 * pannello da regia. Le regole — cosa vuol dire un canale, quale servizio
 * manda un tasto — stanno nel nucleo (`core/plancia-a-muro.js`); qui c'e' il
 * disegno e il dito. */

/* Il canale come lo si vede: quello che dice Home Assistant, con sopra il
 * cursore appena lasciato e il muto appena toccato, finche' non arriva la
 * conferma. */
function canaleOra(canale) {
  segna(canale.entita);
  if (canale.muto) segna(canale.muto);
  if (canale.letto) segna(canale.letto);
  const lettura = letturaDelCanale(canale, allStates() || {});
  const attesa = state.inAttesa[canale.entita] || {};
  if (attesa.posizione !== undefined && lettura.muove) {
    lettura.posizione = attesa.posizione;
    lettura.valore = valoreDallaPosizione(attesa.posizione, lettura);
  }
  const muto = canale.muto ? state.inAttesa[canale.muto]?.acceso : attesa.mutato;
  if (lettura.mutoSaDire && typeof muto === "boolean") lettura.mutato = muto;
  return lettura;
}

/* Il numero di un sensore di livello: «-18,5 dB», «42 %». */
function testoDellaMisura(m) {
  if (!m) return "—";
  const cifre = Number.isInteger(m.valore) || Math.abs(m.valore) >= 100 ? 0 : 1;
  return `${decimale(m.valore, cifre)}${m.unita ? ` ${m.unita}` : ""}`;
}

/* Il numero sopra il cursore: «62%» per un lettore, «-12,5 dB» per un numero,
 * coi decimali che il suo passo chiede. Un sensore dice il suo numero; un
 * telecomando quello del sensore che lo legge, o niente: non ha un livello. */
function testoDelCanale(lettura, posizione = lettura.posizione) {
  if (lettura.tipo === "telecomando")
    return lettura.misura && lettura.disponibile ? testoDellaMisura(lettura.misura) : "";
  if (!lettura.disponibile || lettura.valore === null) return "—";
  if (lettura.tipo === "misura") return testoDellaMisura(lettura);
  const valore = valoreDallaPosizione(posizione, lettura);
  if (lettura.tipo === "volume") return `${Math.round(valore * 100)}%`;
  const cifre = lettura.passo >= 1 ? 0 : lettura.passo >= 0.1 ? 1 : 2;
  return `${decimale(valore, cifre)}${lettura.unita ? ` ${lettura.unita}` : ""}`;
}

/* Il livello letto da un sensore accanto al cursore: una striscia sottile
 * che si riempie, verde, gialla in cima, rossa in fondo alla scala. */
const strisciaLetta = (m) =>
  m
    ? `<span class="mu-fad-letto" style="--l:${m.posizione.toFixed(4)}" title="${esc(testoDellaMisura(m))}"><i></i></span>`
    : "";

/* Il cursore: una traccia che si riempie del colore del gruppo, e la manopola
 * sopra. In piedi per i canali, sdraiato per il volume totale. */
function fader(canale, lettura, { sdraiato = false } = {}) {
  return `<div class="mu-fader${sdraiato ? " sdraiato" : ""}${lettura.muove ? "" : " fermo"}" data-mu-cursore="fader" data-mu-entita="${esc(canale.entita)}" style="--p:${lettura.posizione.toFixed(4)}" role="slider" aria-label="${esc(nomeDi(canale.entita, canale.nome))}" aria-valuetext="${esc(testoDelCanale(lettura))}"><span class="mu-fad-traccia"><i></i></span>${strisciaLetta(lettura.misura)}<u></u></div>`;
}

/* Lo strumento: lo stesso cursore, senza manopola e senza dito — un VU che
 * si riempie fin dove dice il sensore. */
function metro(canale, posizione, testo, { sdraiato = false } = {}) {
  return `<div class="mu-fader mu-metro${sdraiato ? " sdraiato" : ""}" data-mu-metro="${esc(canale.entita)}" style="--p:${posizione.toFixed(4)}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(posizione * 100)}" aria-label="${esc(nomeDi(canale.entita, canale.nome))}" aria-valuetext="${esc(testo)}"><span class="mu-fad-traccia"><i></i></span></div>`;
}

/* I tasti ▲ / ▼ di un telecomando; in mezzo lo strumento, se un sensore
 * legge il livello. Sdraiati, ▼ a sinistra e ▲ a destra. */
function passi(canale, lettura, { sdraiato = false } = {}) {
  const nome = nomeDi(canale.entita, canale.nome);
  /* Sdraiato e' il volume totale: lo stesso telecomando puo' stare anche fra
   * i canali, coi suoi comandi. */
  const tasto = (verso, segno, etichetta) =>
    `<button type="button" class="mu-passo" data-mu-fa="passo" data-mu-verso="${verso}" data-mu-entita="${esc(canale.entita)}"${sdraiato ? ' data-mu-master="1"' : ""} aria-label="${esc(etichetta)} ${esc(nome)}"${lettura.disponibile ? "" : " disabled"}>${segno}</button>`;
  const su = tasto("su", "▲", t("Alza", "Volume up"));
  const giu = tasto("giu", "▼", t("Abbassa", "Volume down"));
  const mezzo = lettura.misura
    ? metro(canale, lettura.misura.posizione, testoDellaMisura(lettura.misura), { sdraiato })
    : '<span class="mu-passi-spazio"></span>';
  return `<div class="mu-passi${sdraiato ? " sdraiato" : ""}">${sdraiato ? `${giu}${mezzo}${su}` : `${su}${mezzo}${giu}`}</div>`;
}

/* Il pezzo in mezzo a un canale: il cursore, lo strumento o i tasti. */
function comandoDelCanale(canale, l, opzioni = {}) {
  if (l.tipo === "misura") return metro(canale, l.posizione, testoDelCanale(l), opzioni);
  if (l.tipo === "telecomando") return passi(canale, l, opzioni);
  return fader(canale, l, opzioni);
}

function tastoMuto(canale, lettura, master = false) {
  if (!lettura.puoMuto) return `<span class="mu-can-muto vuoto" aria-hidden="true"></span>`;
  /* Un muto che non dice com'e' (un comando, un tasto) e' un tasto e basta. */
  const premuto = lettura.mutoSaDire ? ` aria-pressed="${lettura.mutato}"` : "";
  return `<button type="button" class="mu-can-muto${lettura.mutato ? " si" : ""}" data-mu-fa="muto" data-mu-entita="${esc(canale.entita)}" data-mu-muto="${esc(canale.muto)}"${master ? ' data-mu-master="1"' : ""}${premuto} aria-label="${esc(t("Muto", "Mute"))} ${esc(nomeDi(canale.entita, canale.nome))}">${glifo(lettura.mutato ? "muto" : "voce", 24)}</button>`;
}

/* Sotto il numero di un canale che si muove, quello che legge il sensore. */
const lettoSotto = (l) =>
  l.misura && l.tipo !== "telecomando"
    ? `<small class="mu-can-l" data-mu-letto>${esc(testoDellaMisura(l.misura))}</small>`
    : "";

function canaleDelMixer(canale) {
  const l = canaleOra(canale);
  return `<div class="mu-canale${l.mutato ? " mu-muto" : ""}${l.disponibile ? "" : " mu-spento"} mu-can-${l.tipo}${classeDelFondo(canale.immagine)}" data-mu-canale="${esc(canale.entita)}">${fondoMarkup(canale.immagine)}
    <b class="mu-can-v" data-mu-fader-testo>${esc(testoDelCanale(l))}</b>${lettoSotto(l)}
    ${comandoDelCanale(canale, l)}
    <span class="mu-can-n">${esc(nomeDi(canale.entita, canale.nome))}</span>
    ${tastoMuto(canale, l)}</div>`;
}

function paginaMixer(pagina) {
  const gruppi = gruppiDelMixer(pagina);
  const master = pagina.mixer?.master;
  if (!gruppi.length && !master?.entita)
    return griglia({ ...pagina, griglia: 4 }, [
      vuoto(0, t("Scegli i canali nel config", "Choose the channels in the config")),
    ]);
  const quanti = gruppi.map((g) => `minmax(0,${g.canali.length}fr)`).join(" ");
  const banchi = gruppi.length
    ? `<div class="mu-mix-gruppi" style="grid-template-columns:${quanti}">${gruppi
        .map(
          (g) =>
            `<div class="mu-carta mu-mix-gruppo" style="--acc:${g.colore}"><div class="mu-mix-tit">${esc(g.nome || t("Canali", "Channels"))}</div><div class="mu-mix-canali">${g.canali.map(canaleDelMixer).join("")}</div></div>`,
        )
        .join("")}</div>`
    : "";
  let totale = "";
  if (master?.entita) {
    const l = canaleOra(master);
    totale = `<div class="mu-carta mu-mix-master${l.mutato ? " mu-muto" : ""} mu-can-${l.tipo}${classeDelFondo(master.immagine)}" style="--acc:#22c55e" data-mu-canale="${esc(master.entita)}">${fondoMarkup(master.immagine)}
      <span class="mu-mix-tit">${esc(master.nome || t("Volume totale", "Master volume"))}</span>
      ${tastoMuto(master, l, true)}
      ${comandoDelCanale(master, l, { sdraiato: true })}
      <b class="mu-can-v" data-mu-fader-testo>${esc(testoDelCanale(l))}</b></div>`;
  }
  return `<div class="mu-mixer${banchi ? "" : " solo-totale"}">${banchi}${totale}</div>`;
}

/* Il canale scritto nel config, coi suoi comandi: quello della pagina aperta
 * con questa entita' (un gruppo o il volume totale). */
function canaleDellaPagina(id, muto = "", master = false) {
  const mixer = state.muro?.pagine?.[state.pagina]?.mixer;
  if (master && mixer?.master?.entita === id) return mixer.master;
  const tutti = [...(mixer?.gruppi || []).flatMap((g) => g.canali || []), mixer?.master];
  return tutti.find((c) => c?.entita === id && (!muto || c.muto === muto)) || { entita: id, muto };
}

/* Le frecce della telecamera: i segni dentro i tasti del pad. */
const FRECCE = Object.freeze({
  su: '<path d="M6 15l6-6 6 6"/>',
  giu: '<path d="M6 9l6 6 6-6"/>',
  sinistra: '<path d="M15 6l-6 6 6 6"/>',
  destra: '<path d="M9 6l6 6-6 6"/>',
});
const freccia = (verso) =>
  `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FRECCE[verso]}</svg>`;

function tastoPtz(tc, tasto, dentro, etichetta, classe = "") {
  const id = tc[tasto];
  return `<button type="button" class="mu-ptz-t ${classe}" data-mu-fa="ptz" data-mu-tasto="${tasto}" aria-label="${esc(etichetta)}"${id ? "" : " disabled"}>${dentro}</button>`;
}

function paginaTelecamera(pagina) {
  const tc = pagina.telecamera || {};
  const nome = tc.entita ? nomeDi(tc.entita) : t("Nessuna telecamera", "No camera");
  const pad = `<div class="mu-ptz-pad">
    <span></span>${tastoPtz(tc, "su", freccia("su"), t("Su", "Up"))}<span></span>
    ${tastoPtz(tc, "sinistra", freccia("sinistra"), t("Sinistra", "Left"))}${tastoPtz(tc, "stop", `<b>${esc(t("Stop", "Stop"))}</b>`, t("Stop", "Stop"), "mu-ptz-stop")}${tastoPtz(tc, "destra", freccia("destra"), t("Destra", "Right"))}
    <span></span>${tastoPtz(tc, "giu", freccia("giu"), t("Giù", "Down"))}<span></span></div>`;
  /* Lo zoom: un cursore se e' un numero, i due tasti se sono tasti, le due
   * cose insieme se ci sono tutte e due. */
  const conZoom = tc.zoom || tc.zoomPiu || tc.zoomMeno;
  let zoom = "";
  if (conZoom) {
    const l = tc.zoom ? canaleOra({ entita: tc.zoom }) : null;
    zoom = `<div class="mu-ptz-zoom"><span class="mu-et">${esc(t("Zoom", "Zoom"))}</span>
      ${tc.zoomPiu ? tastoPtz(tc, "zoomPiu", "+", t("Zoom avanti", "Zoom in"), "mu-ptz-pm") : ""}
      ${l ? fader({ entita: tc.zoom, nome: t("Zoom", "Zoom") }, l) : '<span class="mu-spazio"></span>'}
      ${tc.zoomMeno ? tastoPtz(tc, "zoomMeno", "−", t("Zoom indietro", "Zoom out"), "mu-ptz-pm") : ""}</div>`;
  }
  const preset = (tc.preset || [])
    .map(
      (p, k) =>
        `<button type="button" class="mu-carta mu-ptz-preset-t${classeDellaTessera(`preset:${k}`)}" data-mu-fa="preset" data-mu-indice="${k}">${fondoDellaTessera(`preset:${k}`)}<span>${esc(p.nome || nomeDi(p.entita))}</span></button>`,
    )
    .join("");
  return `<div class="mu-ptz${preset ? "" : " senza-preset"}">
    <div class="mu-carta mu-ptz-video"><div class="mu-video${classeDelFondo(tc.immagine)}">${fondoMarkup(tc.immagine)}${
      tc.entita && !anteprimaInCorso
        ? `<img data-mu-telecamera="${esc(tc.entita)}" alt="">`
        : immaginePulita(tc.immagine)
          ? ""
          : `<div class="mu-video-vuoto">${disegno("telecamere", 80, "ptz-vuota")}</div>`
    }<span class="mu-live">${esc(nome)}</span></div></div>
    <div class="mu-carta mu-ptz-comandi${conZoom ? "" : " senza-zoom"}">${zoom}${pad}</div>
    ${preset ? `<div class="mu-ptz-preset">${preset}</div>` : ""}
  </div>`;
}

/* Il segno dei tasti dei comandi: l'accensione, il play, lo stop. */
const SEGNI_DEI_COMANDI = Object.freeze({
  accendi: '<path d="M12 3v9M18.4 6.6a9 9 0 1 1-12.8 0"/>',
  avvia: '<path d="M8 5v14l11-7z" fill="currentColor"/>',
  ferma: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
});
const segno = (nome, misura = 30) =>
  `<svg width="${misura}" height="${misura}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SEGNI_DEI_COMANDI[nome]}</svg>`;

/* Acceso come lo si vede: il tocco cambia il tasto subito. */
function comandoAcceso(p) {
  const id = p.stato || p.avvio;
  if (id) segna(id);
  const atteso = state.inAttesa[id]?.acceso;
  return typeof atteso === "boolean" ? atteso : pulsanteAcceso(p, allStates() || {});
}
/* Chi sa dire se e' acceso: l'entita' di stato scelta, o un avvio che si
 * accende e si spegne. Uno script d'avvio finisce in un attimo, e «Spento»
 * sotto «Spegnimento» direbbe solo una cosa strana. */
const diceLoStato = pulsanteDiceLoStato;

function paginaComandi(pagina) {
  const tutti = pulsantiDellaPagina(pagina).map((p, k) => ({ p, k }));
  if (!tutti.length)
    return griglia({ ...pagina, griglia: 4 }, [
      vuoto(0, t("Scegli i comandi nel config", "Choose the commands in the config")),
    ]);
  const parola = (p, on) =>
    diceLoStato(p)
      ? `<span class="mu-stato ${on ? "" : "spento"}">${esc(on ? t("Acceso", "On") : t("Spento", "Off"))}</span>`
      : "";
  const icona = (p, k, misura) =>
    clean(p.disegno)
      ? disegno(p.disegno, misura, `reg-${misura}-${k}`)
      : segno("accendi", Math.round(misura * 0.7));
  /* Un tasto solo: una tessera grande, «AVVIO», «SPEGNIMENTO». */
  const grandi = tutti
    .filter(({ p }) => !p.stop)
    .map(({ p, k }) => {
      const on = comandoAcceso(p);
      /* Con l'immagine: lo stesso tasto grande, il nome e lo stato sul velo. */
      if (immaginePulita(p.immagine))
        return vestito({
          immagine: p.immagine,
          nome: p.nome || nomeDi(p.avvio),
          stato: diceLoStato(p) ? (on ? t("Acceso", "On") : t("Spento", "Off")) : "",
          acceso: on,
          accento: p.colore || "#22c55e",
          tag: "button",
          classi: "mu-reg-tasto mu-rq",
          attributi: `data-mu-fa="pulsante" data-mu-indice="${k}" data-mu-verso="avvio" aria-pressed="${on}"`,
        });
      return `<button type="button" class="mu-carta mu-reg-tasto${on ? " mu-accesa" : ""}" style="--acc:${p.colore || "#22c55e"}" data-mu-fa="pulsante" data-mu-indice="${k}" data-mu-verso="avvio" aria-pressed="${on}"><span class="mu-reg-icona">${icona(p, k, 56)}</span><span class="mu-osw mu-reg-nome">${esc(p.nome || nomeDi(p.avvio))}</span>${parola(p, on)}</button>`;
    });
  /* Avvio e stop: una colonna per comando, il nome in cima e i due tasti. */
  const coppie = tutti
    .filter(({ p }) => p.stop)
    .map(({ p, k }) => {
      const on = comandoAcceso(p);
      return `<div class="mu-carta mu-reg-coppia${on ? " mu-accesa" : ""}${classeDelFondo(p.immagine)}" style="--acc:${p.colore || "#22c55e"}">${fondoMarkup(p.immagine)}<div class="mu-reg-testa"><span class="mu-reg-icona">${icona(p, k, 34)}</span><span class="mu-reg-nome">${esc(p.nome || nomeDi(p.avvio || p.stop))}</span>${parola(p, on)}</div>
        ${p.avvio ? `<button type="button" class="mu-reg-avvio${on ? " si" : ""}" data-mu-fa="pulsante" data-mu-indice="${k}" data-mu-verso="avvio">${segno("avvia", 34)}<span>${esc(t("Avvio", "Start"))}</span></button>` : ""}
        <button type="button" class="mu-reg-stop" data-mu-fa="pulsante" data-mu-indice="${k}" data-mu-verso="stop">${segno("ferma", 30)}<span>${esc(t("Stop", "Stop"))}</span></button></div>`;
    });
  const colonne = (n) => `grid-template-columns:repeat(${Math.min(n, 4)},minmax(0,1fr))`;
  const ferma = pagina.fermaTutto?.attivo
    ? `<button type="button" class="mu-carta mu-reg-ferma" data-mu-fa="ferma-tutto">${segno("ferma", 26)}<span>${esc(t("Ferma tutto", "Stop all"))}</span></button>`
    : "";
  const righe = [
    grandi.length ? "minmax(0,1fr)" : "",
    coppie.length ? "minmax(0,1fr)" : "",
    ferma ? "auto" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `<div class="mu-regia" style="grid-template-rows:${righe}">
    ${grandi.length ? `<div class="mu-reg-grandi" style="${colonne(grandi.length)}">${grandi.join("")}</div>` : ""}
    ${coppie.length ? `<div class="mu-reg-coppie" style="grid-template-columns:repeat(${coppie.length},minmax(0,1fr))">${coppie.join("")}</div>` : ""}
    ${ferma}</div>`;
}

function corpoDellaPagina(pagina) {
  if (pagina.modello === "scene") return paginaScene(pagina);
  if (pagina.modello === "ingresso") return paginaIngresso(pagina);
  if (pagina.modello === "ambienti") return paginaAmbienti(pagina);
  if (pagina.modello === "telecamere") return paginaTelecamere(pagina);
  if (pagina.modello === "energia") return paginaEnergia(pagina);
  if (pagina.modello === "musica") return paginaMusica(pagina);
  if (pagina.modello === "meteo") return paginaMeteo(pagina);
  if (pagina.modello === "mixer") return paginaMixer(pagina);
  if (pagina.modello === "telecamera") return paginaTelecamera(pagina);
  if (pagina.modello === "comandi") return paginaComandi(pagina);
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
    return paginaIntera(pagina, muro);
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
      ${
        aCoppia(id)
          ? `<div class="mu-ter-righe mu-fin-ter">${righeDelTermostato(id)}</div>`
          : `<div class="mu-fin-temp"><button type="button" class="mu-tondo grande" data-mu-fa="meno" data-mu-entita="${esc(id)}">−</button><span class="mu-grande" style="font-size:96px">${obiettivo(id, f.zona) === null ? "—" : `${decimale(obiettivo(id, f.zona))}°`}</span><button type="button" class="mu-tondo grande" data-mu-fa="piu" data-mu-entita="${esc(id)}">+</button></div>`
      }
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
      <div class="mu-seg mu-seg-alto">${tastiDellaTapparella(attributi(id))
        .map(
          (k) =>
            `<button type="button" data-mu-fa="${k}" data-mu-entita="${esc(id)}">${{ su: `▲ ${esc(t("Su", "Up"))}`, ferma: `■ ${esc(t("Stop", "Stop"))}`, giu: `▼ ${esc(t("Giù", "Down"))}` }[k]}</button>`,
        )
        .join("")}</div></div>`;
  } else if (
    f.tipo === "antifurto" &&
    areeDellaPagina(state.muro?.pagine?.[state.pagina]).length > 1
  ) {
    /* Piu' aree: nella finestra ci stanno tutte, coi loro tasti, e sotto
     * le letture e i comandi dell'ingresso. */
    const pagina = state.muro?.pagine?.[state.pagina];
    const aree = areeDellaPagina(pagina);
    const riassunto = riassuntoDelleAree(aree);
    dentro = `<div class="mu-fin-clima mu-fin-aree" style="--acc:${accentoDellAllarme(riassunto.valore)}">
      <div class="mu-riga1"><span class="mu-chip mu-acc" style="--c:52px">${disegno("sicurezza", 30, "fin-allarme")}</span><div class="mu-nome"><div class="mu-n" style="font-size:24px">${esc(riassunto.testo)}</div></div><button type="button" class="mu-tondo" data-mu-fa="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
      ${areeMarkup(aree)}${altroDellIngresso(pagina?.ingresso, { conLeLetture: true })}</div>`;
  } else if (f.tipo === "lettura") {
    dentro = finestraDellaLettura(f);
  } else if (f.tipo === "antifurto") {
    const pagina = state.muro?.pagine?.[state.pagina];
    const centrale = centraleDelMuro(pagina);
    const s = stato(centrale);
    const valore = String(s?.state || "");
    const modi = tastiDellAntifurto(s);
    const acceso = tastoAcceso(s, modi);
    const aperte = pagina?.ingresso?.finestre ? finestreAperte() : [];
    dentro = `<div class="mu-fin-clima" style="--acc:${valore === "disarmed" ? "#10b981" : "#6366f1"}">
      <div class="mu-riga1"><span class="mu-chip mu-acc" style="--c:52px">${disegno("sicurezza", 30, "fin-allarme")}</span><div class="mu-nome"><div class="mu-n" style="font-size:24px">${esc(statoDellaCentrale(s))}</div>${aperte.length ? `<div class="mu-sotto">${esc(t("Aperte", "Open"))}: ${esc(aperte.slice(0, 2).join(", "))}</div>` : ""}</div><button type="button" class="mu-tondo" data-mu-fa="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
      <div class="mu-seg mu-seg-alto mu-modi">${modi.map((m) => `<button type="button" class="${m.mode === acceso ? "si" : ""}" data-mu-fa="allarme" data-mu-modo="${esc(m.mode)}">${esc(m.label)}</button>`).join("")}</div>${altroDellIngresso(pagina?.ingresso, { conLeLetture: true })}</div>`;
  } else if (f.tipo === "citofono" && f.suonato) {
    /* Aperta dal campanello: non una finestra, una chiamata (#citofono). */
    return squilloMarkup(f);
  } else if (f.tipo === "citofono") {
    const ing = state.muro?.pagine?.[f.pagina ?? state.pagina]?.ingresso || {};
    /* Aperta dal campanello: lo dice in cima, con l'ora dello squillo. */
    const squillo = f.suonato
      ? `<span class="mu-chip mu-acc" style="--c:52px">${disegnoDelCatalogo("bell", 30)}</span><div class="mu-nome"><div class="mu-n" style="font-size:24px">${esc(t("Suonano alla porta", "Someone at the door"))}</div><div class="mu-sotto">${esc(orologio(new Date(f.suonato)).ora)}${ing.telecamera ? ` · ${esc(nomeDi(ing.telecamera))}` : ""}</div></div>`
      : `<div class="mu-nome"><div class="mu-n" style="font-size:22px">${esc(nomeDi(ing.telecamera))}</div></div>`;
    dentro = `<div class="mu-fin-clima">
      <div class="mu-riga1">${squillo}<button type="button" class="mu-tondo" data-mu-fa="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
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
  } else if (f.tipo === "scelte") {
    /* Le voci di un menu a tendina: quella di adesso segnata, il tocco la
     * mette. */
    const id = f.entita;
    const adesso = String(stato(id)?.state || "");
    const voci = (attributi(id).options || []).map((v) => String(v)).filter(Boolean);
    dentro = `<div class="mu-fin-clima mu-fin-scelte">
      <div class="mu-riga1"><span class="mu-chip mu-acc" style="--c:52px">${disegno(disegnoDellEntita(id), 30, "fin-scelte")}</span><div class="mu-nome"><div class="mu-n" style="font-size:24px">${esc(f.azione || nomeDi(id))}</div><div class="mu-stato">${esc(adesso)}</div></div><button type="button" class="mu-tondo" data-mu-fa="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
      <div class="mu-seg mu-seg-alto mu-voci">${
        voci.length
          ? voci
              .map(
                (v) =>
                  `<button type="button" class="${v === adesso ? "si" : ""}" data-mu-fa="voce" data-mu-entita="${esc(id)}" data-mu-voce="${esc(v)}">${esc(v)}</button>`,
              )
              .join("")
          : `<span class="mu-sotto">${esc(t("Nessuna voce da scegliere", "No options to choose"))}</span>`
      }</div></div>`;
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
      lettura: "#f59e0b",
      citofono: "#2563eb",
      telecamera: "#2563eb",
      gruppo: "#ec4899",
      scelte: ACCENTI.azione,
    }[f.tipo] || ACCENTI.luce;
  return `<div class="mu-velo" data-mu-fa="fuori"><div class="mu-carta mu-accesa mu-finestra" style="--acc:${accento}">${dentro}</div></div>`;
}

function apriFinestra(f) {
  state.finestra = { ...f, aperta: Date.now() };
  disegna();
}
function chiudiFinestra() {
  if (!state.finestra) return;
  if (state.finestra.tipo === "citofono") smettiDiSquillare();
  state.finestra = null;
  disegna();
}

/* ── il riposo ───────────────────────────────────────────────────────────── */

function riposo(muro) {
  const o = orologio();
  /* Con la luminosita' accesa la notte la dice lei, e il nero e' il suo 0%:
   * al 3% l'orologio resta, e il buio lo fa la retroilluminazione. */
  const notte = muro.luce?.attiva ? Boolean(luce.notte && muro.luce.notte === 0) : eNotte(muro);
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
  /* Di notte il riposo e' nero: lo schermo si spegne. Con un campanello che
   * tiene lo schermo acceso (al minimo) il riposo resta quello di giorno,
   * fioco: un nero acceso tutta la notte sembra un tablet rotto. */
  if (notte && !schermoSempreAcceso(muro))
    return `<div class="mu-riposo notte" data-mu-fa="sveglia">${chip ? `<div class="mu-deriva" ${deriva}><div class="mu-avvisi">${chip}</div></div>` : ""}</div>`;
  const m = meteo();
  const centrale = centraleDelMuro(pagina);
  /* Con piu' aree l'antifurto va su una riga sua, al centro, e dice quali
   * sono inserite: «Antifurto · Spento» non diceva niente a chi ha la
   * perimetrale accesa e la zona notte no. */
  const aree = state.fonte?.aree?.length > 1 ? state.fonte.aree : null;
  const allarme = !aree && centrale && stato(centrale) ? statoDellaCentrale(stato(centrale)) : "";
  const rigaDelleAree = aree ? areeSulRiposo(aree) : "";
  const { testo: dentro, fuori } = temperaturaInCasa(muro);
  /* Con «Temperatura mostrata: da un sensore in casa» il meteo resta come
   * disegno e parola, senza i gradi di fuori: la temperatura e' quella di
   * casa, una volta sola, accanto. E se il sensore e' di fuori (una stanza
   * all'aperto) i gradi del meteo se ne vanno lo stesso: due temperature di
   * fuori, una accanto all'altra, che non dicono lo stesso numero, confondono
   * — resta quella del sensore, che e' di casa. */
  const soloCasa = (muro.temperatura === "casa" || fuori) && Boolean(dentro);
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
  return `<div class="mu-riposo${notte && !muro.luce?.attiva ? " fioco" : ""}" data-mu-fa="sveglia"><div class="mu-deriva" ${deriva}>
    ${chip ? `<div class="mu-avvisi">${chip}</div>` : ""}
    <div class="mu-osw mu-orologione">${esc(o.ora)}</div>
    <div class="mu-et mu-data">${esc(o.lungo)}${pilaDelRiposo(muro)}</div>
    <div class="mu-riposo-riga">
      ${
        m && soloCasa && PAROLE_DEL_METEO()[m.condizione]
          ? `<span data-mu-riposo="meteo">${disegno("meteo", 34, "rip-meteo")}${esc(PAROLE_DEL_METEO()[m.condizione])}</span>`
          : m && !soloCasa && numero(m.temperatura) !== null
            ? `<span data-mu-riposo="meteo">${disegno("meteo", 34, "rip-meteo")}${decimale(m.temperatura, 0)}° ${esc(PAROLE_DEL_METEO()[m.condizione] || "")}</span>`
            : ""
      }
      ${dentro ? `<span data-mu-riposo="temperatura">${disegno("temperatura", 30, "rip-temp")}${dentro} ${esc(doveDellaTemperatura(fuori))}</span>` : ""}
      ${persone.tutte ? `<span data-mu-riposo="persone">${disegno("persone", 30, "rip-persone")}${esc(chi)}</span>` : ""}
      ${aperte ? `<span data-mu-riposo="aperte" class="mu-attenzione">${disegno("aperture", 30, "rip-aperture")}${aperte} ${esc(aperte === 1 ? t("finestra aperta", "window open") : t("finestre aperte", "windows open"))}</span>` : ""}
      ${allarme ? `<span>${disegno("sicurezza", 30, "rip-allarme")}${esc(t("Antifurto", "Alarm"))} · ${esc(allarme)}</span>` : ""}
    </div>
    ${rigaDelleAree}
    ${consiglioSulRiposo()}
    <div class="mu-et mu-tocca">${esc(t("Tocca per i comandi", "Tap for controls"))}</div></div></div>`;
}

/* ── l'assistente di casa, sul riposo ───────────────────────────────────── */

/* Il tablet a muro e' quello che si guarda passando: la cosa piu' importante
 * che l'assistente di casa ha da dire (#175) sta qui, in una riga, col punto
 * del suo colore. Il calcolo e' dell'assistente, che gira da solo ogni minuto
 * anche col riposo davanti; qui si legge e basta, a ogni giro del riposo. */
function consiglioSulRiposo() {
  let primo = null;
  try {
    primo = consiglioInCima();
  } catch (_errore) {
    primo = null;
  }
  if (!primo?.titolo) return "";
  return `<div class="mu-riposo-consiglio" data-mu-riposo="assistente" data-urgenza="${esc(primo.urgenza)}"><i aria-hidden="true"></i><span>${esc(primo.titolo)}</span></div>`;
}

/* ── la batteria del tablet, sul riposo ─────────────────────────────────── */

/* Il browser la dice una volta sola per pagina: si chiede alla prima volta
 * che serve, e poi si ascolta. Il riposo si ridisegna quando cambia. */
let pilaChiesta = false;
function ascoltaLaBatteria() {
  if (pilaChiesta) return;
  const chiedi = root.navigator?.getBattery;
  if (typeof chiedi !== "function") return;
  pilaChiesta = true;
  Promise.resolve()
    .then(() => chiedi.call(root.navigator))
    .then((manager) => {
      const leggi = () => {
        state.batteria = batteriaDalBrowser(manager);
        if (state.riposo && state.muro?.batteria?.attiva) disegna();
      };
      for (const evento of ["levelchange", "chargingchange"])
        manager?.addEventListener?.(evento, leggi);
      leggi();
    })
    .catch(() => {});
}

/* Una pila disegnata: il guscio, il pieno fino a dove arriva, e il fulmine
 * sopra quando e' attaccata alla corrente. */
function pila(b) {
  const pieno = Math.max(b.livello > 0 ? 1.5 : 0, (b.livello / 100) * 17);
  return `<svg class="mu-pila-g" width="34" height="18" viewBox="0 0 26 14" aria-hidden="true"><rect x="1" y="1" width="21" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="23.2" y="4.5" width="2" height="5" rx="1" fill="currentColor"/><rect class="mu-pila-pieno" x="3" y="3" width="${pieno.toFixed(1)}" height="8" rx="1.5"/>${b.inCarica ? '<path class="mu-pila-fulmine" d="M12.8 1.6 8.4 7.6h3.2l-1.2 4.8 4.6-6.2h-3.2z"/>' : ""}</svg>`;
}

function pilaDelRiposo(muro) {
  if (!muro?.batteria?.attiva) return "";
  if (muro.batteria.livello) segna(muro.batteria.livello);
  if (muro.batteria.carica) segna(muro.batteria.carica);
  ascoltaLaBatteria();
  const b = batteriaDelTablet(muro, allStates() || {}, state.batteria);
  if (!b) return "";
  const parole = `${t("Batteria", "Battery")} ${b.livello}%${b.inCarica ? ` · ${t("in carica", "charging")}` : ""}`;
  return `<span class="mu-pila${b.inCarica ? " carica" : ""}${b.bassa ? " bassa" : ""}" data-mu-riposo="batteria" title="${esc(parole)}" aria-label="${esc(parole)}">${pila(b)}<b>${b.livello}%</b></span>`;
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
    /* Chiuso con la sua ✕ dopo averlo aperto dal menu dell'app: l'app lo
     * deve sapere, se no il menu resta su «Configurazione». */
    if (state.configDaFuori) {
      state.configDaFuori = false;
      diciAllApp("home");
    }
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
/* Home Assistant largo: la barra laterale sta di lato, non sopra.
 *
 * «Su Z Fold aperto premo l'hamburger del pannello a muro e non va.» Aperto,
 * lo schermo passa gli 870 pixel e Home Assistant non apre piu' un cassetto
 * sopra la pagina: la sua barra laterale sta sempre a sinistra, e il comando
 * del menu la allarga o la stringe. Il pannello pero' copre tutto lo schermo,
 * barra compresa, e il comando arrivava senza che si vedesse niente.
 *
 * Qui la barra si apre (allargata, coi nomi) e il pannello si scosta della sua
 * larghezza: la barra si vede accanto, si tocca, e un tocco sul pannello lo
 * rimette a tutto schermo. */
function homeAssistantLargo() {
  try {
    const casa = root.documentoDiHomeAssistant?.();
    const vista = casa?.defaultView;
    if (!casa || !vista?.matchMedia) return null;
    return vista.matchMedia("(max-width: 870px)").matches ? null : casa;
  } catch (_errore) {
    return null;
  }
}

function laBarraDiHomeAssistant(casa) {
  try {
    const ha = casa.querySelector("home-assistant");
    const main = ha?.shadowRoot?.querySelector("home-assistant-main");
    return { main, barra: main?.shadowRoot?.querySelector("ha-sidebar") || null };
  } catch (_errore) {
    return { main: null, barra: null };
  }
}

export function apriLaBarraAccanto(casa) {
  const tela = doc?.getElementById?.(ID);
  const { main, barra } = laBarraDiHomeAssistant(casa);
  if (!tela || !main) return false;
  const vista = casa.defaultView || root;
  try {
    const Evento = vista.CustomEvent || CustomEvent;
    main.dispatchEvent(
      new Evento("hass-toggle-menu", { bubbles: true, composed: true, detail: { open: true } }),
    );
  } catch (_errore) {
    return false;
  }
  const scosta = () => {
    const destra = Math.round(barra?.getBoundingClientRect?.().right || 0);
    state.accanto = destra > 0 ? destra : 256;
    tela.style.setProperty("left", `${state.accanto}px`, "important");
    misura(tela, state.muro);
  };
  tela.dataset.muAccantoAlMenu = "true";
  scosta();
  /* La barra si allarga con un'animazione: si rimisura quando ha finito. */
  root.setTimeout?.(scosta, 320);
  const aperto = Date.now();
  const rimetti = (evento) => {
    if (Date.now() - aperto < 300) return;
    if (evento?.target?.closest?.('[data-mu-fa="menu"]')) return;
    /* Solo un tocco sul pannello lo rimette: un tocco sulla barra e' la scelta
     * di una voce, e il pannello che le torna sopra se la mangerebbe. */
    const strada = evento?.composedPath?.() || [evento?.target];
    if (!strada.includes(tela)) return;
    doc.removeEventListener("pointerdown", rimetti, true);
    delete tela.dataset.muAccantoAlMenu;
    state.accanto = 0;
    tela.style.removeProperty("left");
    misura(tela, state.muro);
  };
  doc.addEventListener("pointerdown", rimetti, true);
  return true;
}

export function apriIlMenu() {
  const largo = root.gdahomeDice?.postMessage ? null : homeAssistantLargo();
  if (largo && apriLaBarraAccanto(largo)) return true;
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

/* ── il config chiesto da fuori: dall'app (#bug del tablet a muro) ─────────
 *
 * «Sul tablet, dal menu dell'app tocco Configurazione e torno al pannello: il
 * config del muro non si apre.» L'app apre la Configurazione con tre porte —
 * la funzione `gdahomeApriLaConfig` che il suo servitore mette nella pagina
 * (il telefono la chiama dal WebView), il messaggio `apri-la-config` (il
 * browser, da fuori del riquadro), e `#gdahome-config` nell'indirizzo (la
 * pagina appena nata) — e tutte e tre toccano la linguetta «config» della
 * plancia. Che c'e', ma sta sotto il pannello a tutto schermo: la Config si
 * apriva dove nessuno la vede, e il pannello restava li'.
 *
 * Mentre il pannello e' in scena le tre porte le prende lui: si apre il config
 * del muro, lo stesso della pressione lunga, con «Tutto il config» per chi
 * vuole il resto; e «Plancia» dal menu lo chiude e torna al pannello. Le prende
 * dalla pagina e non dall'app, cosi' vale anche per le app gia' installate.
 * E all'app si dice dove si e', come fa la sua maniglia: il menu segna
 * «Configurazione» mentre il config e' aperto, e torna alla plancia dopo. */
function muroInScena() {
  const muro = state.muro;
  return Boolean(muro?.attiva && muro.pagine?.length && state.premium === true && !state.uscito);
}

/* Dove si e', detto all'app: sul telefono il canale del WebView, nel browser
 * chi ospita il riquadro. Le stesse due strade della sua maniglia. */
function diciAllApp(quale) {
  try {
    if (root.gdahomeDice?.postMessage) root.gdahomeDice.postMessage(quale);
  } catch (_errore) {}
  try {
    if (root.parent && root.parent !== root)
      root.parent.postMessage({ gdahome: "pagina", dove: quale }, "*");
  } catch (_errore) {}
}

function linguetta(quale) {
  return [...(doc?.querySelectorAll?.(".tab") || [])].find(
    (voce) => voce.getAttribute("data-tab") === quale,
  );
}

export function apriIlConfigDaFuori() {
  state.configDaFuori = true;
  /* Una porta vecchia puo' aver gia' aperto la Config della plancia sotto il
   * pannello (l'indirizzo lo legge la pagina prima di questa sezione): la
   * plancia sotto torna alla sua Home, che e' quella da cui il pannello
   * riparte. */
  if (doc.getElementById("page-config")?.classList?.contains("active")) {
    try {
      linguetta("home")?.click();
    } catch (_errore) {}
  }
  if (!editorAperto()) apriIlConfigDelMuro();
  /* Dopo il giro: chi guarda le linguette per conto dell'app dice la sua
   * col giro dopo un tocco, e l'ultima parola deve essere questa. */
  diciAllApp("config");
  root.setTimeout?.(() => {
    if (state.configDaFuori) diciAllApp("config");
  }, 0);
  return true;
}

export function tornaDalConfigDaFuori() {
  state.configDaFuori = false;
  state.tornatoIl = Date.now();
  if (editorAperto()) {
    const chiudi = doc.querySelector("#editor-modal .ed-head-close");
    if (chiudi) chiudi.click();
    doc.getElementById("editor-modal")?.remove();
  }
  doc?.documentElement?.classList?.remove(SOLO_MURO);
  /* Se una porta vecchia ha fatto in tempo ad aprire la Config della plancia
   * sotto il pannello, la plancia sotto torna alla sua Home: se no all'app
   * si direbbe «config» anche a pannello tornato. */
  if (doc.getElementById("page-config")?.classList?.contains("active")) {
    try {
      linguetta("home")?.click();
    } catch (_errore) {}
  }
  doc.body?.classList?.remove("gdahome-in-config");
  state.uscito = false;
  state.riposo = false;
  tocco();
  disegna();
  const attiva = doc.querySelector(".tab.active")?.getAttribute("data-tab") || "home";
  diciAllApp(attiva === "config" ? "home" : attiva);
  return true;
}

/* Le due maniglie dell'app: si tengono quelle che il servitore ha messo (o
 * mettera': il suo script puo' arrivare dopo), e davanti si mette la nostra,
 * che decide solo se il pannello e' in scena. */
function prendiLaManiglia(nome, nostra) {
  const descritta = Object.getOwnPropertyDescriptor(root, nome);
  if (descritta?.get?.__dmMuro) return;
  let loro = descritta?.value;
  const leggi = () =>
    function () {
      if (muroInScena()) return nostra();
      return typeof loro === "function" ? loro.apply(this, arguments) : undefined;
    };
  leggi.__dmMuro = true;
  try {
    Object.defineProperty(root, nome, {
      configurable: true,
      enumerable: true,
      get: leggi,
      set: (valore) => {
        loro = valore;
      },
    });
  } catch (_errore) {}
}

function prendiLePorteDelConfig() {
  prendiLaManiglia("gdahomeApriLaConfig", apriIlConfigDaFuori);
  prendiLaManiglia("gdahomeTornaDallaConfig", tornaDalConfigDaFuori);
  /* Il messaggio: lo stesso ascolto della pagina servita, ma prima di lui
   * (in cattura) e solo a pannello in scena. Si accetta solo da chi ospita. */
  root.addEventListener?.(
    "message",
    (evento) => {
      const detto = evento?.data;
      if (!detto || typeof detto !== "object" || !muroInScena()) return;
      if (evento.source !== root.parent) return;
      if (detto.gdahome !== "apri-la-config" && detto.gdahome !== "torna-dalla-config") return;
      evento.stopImmediatePropagation?.();
      if (detto.gdahome === "apri-la-config") apriIlConfigDaFuori();
      else tornaDalConfigDaFuori();
    },
    true,
  );
  /* E la linguetta: chi la tocca a pannello in scena non e' un dito — il
   * pannello la copre — ma una porta dell'app, anche una che non conosciamo.
   * La Config della plancia sotto il pannello non serve a nessuno: si apre
   * quella del muro. */
  doc.addEventListener(
    "click",
    (evento) => {
      if (!muroInScena()) return;
      const voce = evento.target?.closest?.(".tab");
      if (!voce || voce.getAttribute("data-tab") !== "config") return;
      evento.preventDefault();
      evento.stopImmediatePropagation();
      /* La porta dell'app riprova per qualche secondo finche' non vede la
       * Config della plancia — che qui non vedra' mai. I suoi tocchi dopo il
       * primo, e quelli arrivati appena tornati al pannello, sono l'eco della
       * stessa richiesta: si fermano e basta. */
      if (editorAperto() || Date.now() - (state.tornatoIl || 0) < 8000) return;
      apriIlConfigDaFuori();
    },
    true,
  );
  /* `#gdahome-config`: lo script del servitore lo legge e lo cancella prima
   * che questa sezione nasca, ma la richiesta con cui la pagina e' stata
   * aperta resta scritta nella sua navigazione. Si esegue quando il pannello
   * entra in scena, una volta. */
  try {
    const nata = root.performance?.getEntriesByType?.("navigation")?.[0]?.name || "";
    if (/#gdahome-config\b/.test(nata)) state.configAllAvvio = true;
  } catch (_errore) {}
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
const detto = { muro: "", spento: "", acceso: "" };
function diciAlloSchermo(chiave, si) {
  const canale = root.gdahomeSchermo;
  const valore = si ? "si" : "no";
  if (!canale?.postMessage || detto[chiave] === valore) return;
  detto[chiave] = valore;
  try {
    canale.postMessage(`${chiave}:${valore}`);
  } catch (_errore) {}
}

/* «Accendi lo schermo quando suona»: la luce torna piena e, nell'app, lo
 * schermo spento si riaccende sopra il blocco (`lo_schermo.dart`). Non si
 * tiene a mente come gli altri: ogni squillo lo ridice. */
function svegliaLoSchermo() {
  diciAlloSchermo("spento", false);
  try {
    root.gdahomeSchermo?.postMessage?.("sveglia");
  } catch (_errore) {}
}

/* ── la luminosita' dello schermo (#224) ────────────────────────────────────
 *
 * «Piena quando qualcuno si avvicina, bassa a riposo, quasi spenta di notte.»
 * La decide il pannello e la applica l'app: le si manda `luce:<0-100>`
 * quando cambia, e `luce:no` quando torna del sistema. La dissolvenza la fa
 * l'app — sale in fretta, scende piano — perche' una pagina che manda cento
 * numeri al secondo su un tablet economico si sente.
 *
 * «Qualcuno vicino» lo dice una fonte qualunque: un tocco, il sensore di
 * presenza di casa (il «Si sveglia da solo» di prima), il sensore di
 * prossimita' del tablet. I due sensori del tablet li legge l'app, solo
 * mentre il pannello e' acceso e solo quelli che servono (`sensori:…`), e
 * alla pagina arriva soltanto «c'e' / non c'e'» e «buio / penombra / chiaro»
 * (`gdahome:schermo`, e `window.__GDAHOME_SCHERMO__` per chi arriva dopo). */
const SCHERMO_DELL_APP = "__GDAHOME_SCHERMO__";
const luce = {
  /* L'ultimo livello detto all'app: `null` se lo schermo e' del sistema. */
  detta: null,
  /* I sensori chiesti all'app, come gliel'abbiamo detto. */
  sensori: "no",
  /* Chi era vicino al giro prima: "" vuol dire nessuno, schermo abbassato. */
  fonte: "",
  notte: false,
  pillolaFino: 0,
  pillolaDi: "",
  timer: 0,
};

function quelloCheDiceIlTablet() {
  const detto = root[SCHERMO_DELL_APP];
  return detto && typeof detto === "object" ? detto : {};
}

function mandaAlloSchermo(messaggio) {
  try {
    root.gdahomeSchermo?.postMessage?.(messaggio);
  } catch (_errore) {}
}

/* I sensori del tablet che servono adesso: la luce solo per «Giorno e notte
 * da: Luce della stanza», la prossimita' solo se e' accesa fra le fonti. Tutti
 * e due sono Premium; senza, l'app non ne accende nessuno. */
function sensoriVoluti(muro) {
  if (state.premium !== true) return "no";
  const voluti = [];
  if (muro.luce?.attiva && muro.luce.giorno === "stanza") voluti.push("luce");
  if (muro.luce?.prossimita) voluti.push("prossimita");
  return voluti.length ? voluti.join("+") : "no";
}

/** Decide la luce di adesso, e la dice all'app se e' cambiata. */
function regolaLaLuce() {
  const muro = state.muro;
  if (!muro?.luce || !muroInScena() || editorAperto()) return;
  const adesso = Date.now();
  const premium = state.premium === true;
  const tablet = quelloCheDiceIlTablet();
  const voluti = sensoriVoluti(muro);
  if (voluti !== luce.sensori) {
    luce.sensori = voluti;
    mandaAlloSchermo(`sensori:${voluti}`);
  }
  const sensore = muro.risveglio?.attivo ? muro.risveglio.entita : "";
  const presenza = Boolean(sensore) && String(allStates()?.[sensore]?.state) === "on";
  const fonte = chiCeVicino(muro, {
    presenza,
    prossimita: tablet.prossimita === "si",
    toccato: state.toccato,
    premium,
    adesso,
  });
  const daUnSensore = fonte === "presenza" || fonte === "prossimita";
  /* Chi arriva sveglia il pannello — il sensore di presenza lo faceva gia'
   * (`svegliaSeServe`), la prossimita' del tablet si aggiunge qui — e con la
   * luminosita' accesa la pillola dice per due secondi chi e' stato. */
  if (daUnSensore && (luce.fonte === "" || state.riposo)) {
    if (state.riposo) {
      state.riposo = false;
      state.toccato = adesso;
    }
    if (muro.luce.attiva) {
      luce.pillolaFino = adesso + 2000;
      luce.pillolaDi = fonte;
      root.setTimeout?.(() => disegna(), 2050);
    }
  }
  /* Finche' qualcuno resta vicino vale come un tocco: lo schermo non si
   * abbassa e il riposo non arriva. Solo con la luminosita' accesa: senza, il
   * sensore sveglia e basta, come e' sempre stato. */
  if (muro.luce.attiva && daUnSensore) state.toccato = adesso;
  luce.fonte = fonte;
  luce.notte = eNotteDellaLuce(muro, {
    sole: allStates()?.["sun.sun"] || null,
    stanza: tablet.luce || "",
    premium,
    adesso: new Date(adesso),
  });
  /* Di notte lo 0% e' lo schermo nero: passato il tempo, il riposo nero. */
  if (
    muro.luce.attiva &&
    luce.notte &&
    muro.luce.notte === 0 &&
    !fonte &&
    !state.riposo &&
    !state.finestra &&
    !state.trascina
  ) {
    state.riposo = true;
    if (muro.riposo.torna !== false) state.pagina = 0;
  }
  const livello = livelloDellaLuce(muro, { vicino: Boolean(fonte), notte: luce.notte });
  const detta = livello === null ? null : String(livello);
  if (detta !== luce.detta) {
    mandaAlloSchermo(`luce:${detta ?? "no"}`);
    luce.detta = detta;
  }
  /* Il prossimo giro: quando il tocco smette di valere. */
  root.clearTimeout?.(luce.timer);
  luce.timer = 0;
  if (muro.luce.attiva && fonte === "tocco")
    luce.timer =
      root.setTimeout?.(
        () => disegna(),
        Math.max(250, state.toccato + muro.luce.dopo * 1000 - adesso + 50),
      ) || 0;
}

/* La pillola verde in basso, per due secondi: «Qualcuno vicino · Presenza
 * ingresso · 90%». Dice chi ha acceso lo schermo, che una luce che sale da
 * sola senza un perche' sembra un guasto. */
function pillolaDellaLuce(muro) {
  if (!muro.luce?.attiva || Date.now() >= luce.pillolaFino) return "";
  const sensore = muro.risveglio?.entita || "";
  const chi =
    luce.pillolaDi === "prossimita"
      ? t("prossimità del tablet", "tablet proximity")
      : clean(allStates()?.[sensore]?.attributes?.friendly_name) ||
        t("sensore di presenza", "presence sensor");
  const sopra = luce.sopra ? ` style="top:${luce.sopra}px"` : "";
  return `<div class="mu-luce-pillola" role="status"${sopra}><i aria-hidden="true"></i><span>${esc(t("Qualcuno vicino", "Someone nearby"))} · ${esc(chi)} · ${muro.luce.vicino}%</span></div>`;
}

/* La pillola sta in alto al centro, appena sotto la testa: in basso copriva
 * il nome di una card. La testa cambia altezza col tablet (compatta,
 * verticale, menu di lato), quindi la si misura dopo ogni disegno; la misura
 * vale dal disegno dopo, e per quello in corso si mette a mano. */
function mettiLaPillola(nodo) {
  const tela = nodo.firstElementChild;
  const testa = tela?.querySelector?.(".mu-testa");
  let sopra = 16;
  if (testa) {
    let dove = 0;
    for (let n = testa; n && n !== tela; n = n.offsetParent) dove += n.offsetTop;
    sopra = Math.round(dove + testa.offsetHeight + 12);
  }
  luce.sopra = sopra;
  const pillola = tela?.querySelector?.(".mu-luce-pillola");
  if (pillola && pillola.style.top !== `${sopra}px`) pillola.style.top = `${sopra}px`;
}

/* Spento il pannello lo schermo torna del sistema, e i sensori si fermano. */
function restituisciLoSchermo() {
  root.clearTimeout?.(luce.timer);
  luce.timer = 0;
  luce.fonte = "";
  luce.pillolaFino = 0;
  if (luce.detta !== null) mandaAlloSchermo("luce:no");
  luce.detta = null;
  if (luce.sensori !== "no") mandaAlloSchermo("sensori:no");
  luce.sensori = "no";
}

function togliLaTela() {
  smettiDiSquillare();
  restituisciLoSchermo();
  diciAlloSchermo("acceso", false);
  diciAlloSchermo("spento", false);
  diciAlloSchermo("muro", false);
  fermaIlBattito();
  doc?.getElementById(ID)?.remove();
  doc?.documentElement?.classList?.remove("dm-muro-acceso");
}

function misura(nodo, muro) {
  /* Con la barra di Home Assistant accanto, il pannello ha la larghezza che
   * resta, non quella dello schermo. */
  const larghezza = Math.max(320, (root.innerWidth || 1280) - (state.accanto || 0));
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

/* Le linguette delle pagine, col nome scritto fin dove si puo'.
 *
 * «Sfrutta al massimo lo spazio che c'e' a sinistra: da un 4 pollici a un 15
 * gli spazi aumentano di tanto. Mantieni il nome scritto fin dove possibile,
 * poi diventano icone.» Tre gradini, dal piu' largo: tutti i nomi; il nome
 * solo della pagina aperta (`mu-molte`); solo i disegni (`mu-icone`). Si
 * prova dal primo e ci si ferma al primo che ci sta: la fila si stringe nello
 * spazio fra il titolo e l'ora, e se il contenuto e' piu' largo di lei non ci
 * sta. */
const GRADINI_DELLE_LINGUETTE = ["", "mu-molte", "mu-icone"];
function adattaLeLinguette(nodo) {
  const fila = nodo.querySelector(".mu-testa .mu-pagine");
  if (!fila) return;
  const testa = fila.parentElement;
  /* Il titolo cede la riga sotto («LUCI · CLIMA · TAPPARE…») prima che le
   * linguette perdano i nomi; il nome della pagina invece resta intero. */
  const titolo = testa.querySelector(".mu-titolo");
  const nome = titolo?.querySelector(".mu-tit");
  if (nome) {
    const massimo = Number.parseFloat(getComputedStyle(nome).maxWidth);
    const pieno = Number.isFinite(massimo) ? Math.min(nome.scrollWidth, massimo) : nome.scrollWidth;
    titolo.style.setProperty("--mu-tit-min", `${Math.ceil(pieno)}px`);
  }
  for (const gradino of GRADINI_DELLE_LINGUETTE) {
    fila.classList.remove(...GRADINI_DELLE_LINGUETTE.filter(Boolean));
    if (gradino) fila.classList.add(gradino);
    if (testa.scrollWidth <= testa.clientWidth + 1) return;
  }
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
  if (state.configAllAvvio) {
    state.configAllAvvio = false;
    apriIlConfigDaFuori();
    return;
  }
  ricordaICampanelli();
  const nodo = tela();
  lasciaIlVelo();
  avviaIlBattito();
  doc.documentElement.classList.add("dm-muro-acceso");
  const temaPlancia = doc.documentElement.getAttribute("data-theme") || "dark";
  nodo.dataset.tema = temaDelMomento(muro, new Date(), temaPlancia);
  misura(nodo, muro);
  /* La luce prima del disegno: puo' togliere il riposo (qualcuno e' arrivato)
   * o metterlo (lo 0% di notte). L'app la ascolta solo col pannello acceso,
   * che quindi si dice prima. */
  diciAlloSchermo("muro", true);
  regolaLaLuce();
  if (state.pagina >= muro.pagine.length) state.pagina = 0;
  const pagina = muro.pagine[state.pagina];
  raccolta = { ids: new Set(), domini: new Set() };
  let corpo = "";
  try {
    corpo = state.riposo ? riposo(muro) : `${paginaIntera(pagina, muro)}${finestra()}`;
    corpo += avvisoGrande();
    corpo += pillolaDellaLuce(muro);
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
  adattaLeLinguette(nodo);
  mettiLaPillola(nodo);
  battitoDellaMusica();
  rimettiLaVoce(nodo);
  if (state.riposo) posizionaIlRiposo(nodo);
  /* «Tieni lo schermo acceso»: con un campanello che puo' suonare, lo schermo
   * non si spegne da solo — di notte resta al minimo. */
  diciAlloSchermo("acceso", schermoSempreAcceso(muro));
  /* Con la luminosita' accesa la notte la fa `luce:`: due voci che comandano
   * la stessa luce si darebbero torto a vicenda. */
  diciAlloSchermo("spento", Boolean(!muro.luce?.attiva && state.riposo && eNotte(muro)));
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
  /* Il tocco di un dito, e non di un sensore: e' questo che tiene aperta una
   * finestra (`finestraDaChiudere`). */
  state.toccatoDalDito = state.toccato;
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
const ATTESE = [
  "acceso",
  "luminosita",
  "temperatura",
  "coppia",
  "volume",
  "suona",
  "gruppo",
  "posizione",
  "mutato",
];
export function attesaConfermata(cosa, atteso, reale) {
  if (cosa === "acceso") return reale.acceso === atteso;
  if (cosa === "suona") return reale.suona === atteso;
  if (cosa === "gruppo")
    return reale.gruppo === (Array.isArray(atteso) ? atteso : []).slice(1).sort().join(",");
  if (cosa === "volume") return reale.volume !== null && Math.abs(reale.volume - atteso) <= 1;
  if (cosa === "posizione")
    return reale.posizione !== null && Math.abs(reale.posizione - atteso) <= 0.015;
  if (cosa === "mutato") return reale.mutato === atteso;
  if (cosa === "luminosita")
    return reale.luminosita !== null && Math.abs(reale.luminosita - atteso) <= 2;
  if (cosa === "temperatura")
    return reale.temperatura !== null && Math.abs(reale.temperatura - atteso) < 0.05;
  if (cosa === "coppia")
    return (
      reale.coppia?.basso != null &&
      reale.coppia?.alto != null &&
      Math.abs(reale.coppia.basso - atteso.target_temp_low) < 0.05 &&
      Math.abs(reale.coppia.alto - atteso.target_temp_high) < 0.05
    );
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
      coppia: coppiaDelTermostato(attributi(id)),
      volume:
        numero(attributi(id).volume_level) === null
          ? null
          : Math.round(numero(attributi(id).volume_level) * 100),
      suona: ["playing", "buffering"].includes(String(stato(id)?.state)),
      posizione: posizioneDelCanale(id),
      mutato: attributi(id).is_volume_muted === true,
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

/* Dove sta il cursore di un canale per Home Assistant, o `null`. */
function posizioneDelCanale(id) {
  if (!["media_player", "number", "input_number"].includes(dominio(id))) return null;
  const l = letturaDelCanale({ entita: id }, allStates() || {});
  return l.valore === null ? null : l.posizione;
}

let timerClima = null;
function cambiaTemperatura(id, verso, estremo = "") {
  const a = attributi(id);
  /* La coppia parte intera: Home Assistant, a chi lavora con i due numeri,
   * rifiuta `temperature` da solo e rifiuta un estremo solo. Il passo e la
   * scala sono quelli dell'unita', e il basso non scavalca l'alto. Il tasto
   * della card del termostato dice quale dei due muove; chi non lo dice
   * muove quello della modalita', o della linguetta. */
  const coppiaVista = estremo === "basso" || estremo === "alto" ? coppiaDelMuro(id) : null;
  const lettura = coppiaVista || obiettiviDelMuro(id);
  if (lettura.doppio) {
    const quale = coppiaVista ? estremo : estremoDelMuro(id, lettura);
    const passo = numero(a.target_temp_step) || 0.5;
    const scala = [numero(a.min_temp) ?? 7, numero(a.max_temp) ?? 35];
    const coppia = quale ? coppiaSpostata(lettura, quale, verso, { passo, scala }) : null;
    if (!coppia) return;
    attendi(id, "coppia", coppia);
    disegna();
    root.clearTimeout?.(timerClima);
    timerClima = root.setTimeout?.(
      () => comanda("climate", "set_temperature", { entity_id: id, ...coppia }),
      700,
    );
    return;
  }
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

function allarme(modo, codice = "", area = "") {
  const pagina = state.muro?.pagine?.[state.pagina];
  /* Con piu' aree il tasto dice la sua; un'area che la pagina non mostra
   * non si comanda da qui. */
  const sue = areeDellaPagina(pagina).map((a) => a.entita);
  const centrale = area && sue.includes(area) ? area : centraleDelMuro(pagina);
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
    apriFinestra({ tipo: "codice", scopo: "allarme", modo, area: centrale, scritto: "" });
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
    } else allarme(f.modo, f.scritto, f.area || "");
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
      apriFinestra({ tipo: "clima", entita, zona: zonaDiQui(entita) });
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
    case "citofono-silenzia":
      silenzia();
      return;
    case "citofono-parla":
      parla().catch(() => {});
      return;
    case "interruttore":
      /* Nella card della luce puo' esserci anche una presa: ognuno col suo
       * dominio, `light.toggle` su uno `switch` non fa niente. */
      alterna(id, dominio(id) || "light", "toggle");
      return;
    case "duetasti":
      /* Un tasto del riquadro ON e OFF: il suo comando e basta, niente
       * finestra (il tocco si ferma qui, prima della card). */
      premiIlTasto(bersaglio);
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
      cambiaTemperatura(id, -1, bersaglio.dataset.muEstremo || "");
      return;
    case "piu":
      cambiaTemperatura(id, 1, bersaglio.dataset.muEstremo || "");
      return;
    case "clima-acceso": {
      const s = String(stato(id)?.state || "off");
      const rapido = rapidoDi(id, zonaDiQui(id));
      if (s !== "off") alterna(id, "climate", "turn_off");
      else if (rapido) {
        /* I passi del comando rapido, distanziati come nella plancia: la
         * temperatura mandata a un condizionatore ancora spento cade nel
         * vuoto. */
        attendi(id, "acceso", true);
        quickClimateSteps(rapido, attributi(id), { zona: zonaDiQui(id) }).forEach(
          (passo, indice) => {
            const manda = () => comanda("climate", passo.service, { entity_id: id, ...passo.data });
            if (indice === 0) manda();
            else root.setTimeout?.(manda, indice * 700);
          },
        );
        disegna();
      } else {
        const modi = (attributi(id).hvac_modes || []).filter((m) => m !== "off");
        if (modi.length)
          alterna(id, "climate", "set_hvac_mode", { entity_id: id, hvac_mode: modi[0] });
        else alterna(id, "climate", "turn_on");
      }
      return;
    }
    case "modo":
      apriFinestra({ tipo: "clima", entita: id, zona: zonaDiQui(id) });
      return;
    case "finestra-antifurto":
      apriFinestra({ tipo: "antifurto" });
      return;
    case "avviso-visto":
      (state.avvisiVisti ||= new Set()).add(bersaglio.dataset.muAvviso);
      disegna();
      return;
    case "avviso-antifurto":
      (state.avvisiVisti ||= new Set()).add(bersaglio.dataset.muAvviso);
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
    case "mp-scegli-musica":
      apriLoSfoglio(id);
      return;
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
    case "scelte":
      apriFinestra({ tipo: "scelte", entita: id });
      return;
    case "voce": {
      const voce = bersaglio.dataset.muVoce || "";
      const chi = state.finestra?.azione ? azioneDi(state.finestra.azione) : null;
      chiudiFinestra();
      if (!voce || !MENU.has(dominio(id))) return;
      /* Scegliere la voce e' gia' la conferma: e' un tocco voluto, su una
       * finestra aperta apposta. */
      comanda(dominio(id), "select_option", { entity_id: id, option: voce });
      if (chi) state.attiva = chi.name;
      disegna();
      return;
    }
    case "azione":
      if (bersaglio.dataset.muConfermata) {
        const nome = bersaglio.dataset.muAzione;
        const servizio = servizioDellAzione(azioneDi(nome));
        chiudiFinestra();
        if (servizio?.domain) comanda(servizio.domain, servizio.service, servizio.data);
        state.attiva = nome;
        disegna();
      } else
        eseguiAzione(bersaglio.dataset.muAzione, {
          conferma: Boolean(bersaglio.dataset.muConferma),
        });
      return;
    case "allarme":
      allarme(bersaglio.dataset.muModo, "", bersaglio.dataset.muArea || "");
      return;
    case "ing-lettura":
      apriFinestra({
        tipo: "lettura",
        pagina: state.pagina,
        gruppo: Boolean(bersaglio.dataset.muGruppo),
        entita: bersaglio.dataset.muEntita || "",
      });
      return;
    case "ing-comando": {
      const voce = bersaglio.dataset.muVoce || "";
      const { entity: chi } = partiDelComando(voce);
      const servizio = servizioDelComandoDIngresso(voce, String(stato(chi)?.state || ""));
      if (!servizio) return;
      if (servizio.service === "toggle") alterna(chi, servizio.domain, "toggle", servizio.data);
      else comanda(servizio.domain, servizio.service, servizio.data);
      if (state.finestra?.tipo === "lettura") disegna();
      return;
    }
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
      /* Aprire e' rispondere: il campanello smette di suonare. */
      if (state.finestra?.tipo === "citofono" && state.finestra.suonato) silenzia();
      return;
    }
    case "cifra":
      cifra(bersaglio.dataset.muCifra);
      return;
    case "mp-accanto": {
      /* Un comando accanto al lettore che e' un telecomando: si accende e si
       * spegne, o manda il suo comando. */
      const l = lettoreOra({ entita: id, nome: "" });
      const voce = (l.comandi || []).find((c) => c.entity === bersaglio.dataset.muVoce);
      const servizio = voce ? comandoDelDispositivo(voce) : null;
      if (!servizio) return;
      if (servizio.service === "toggle") alterna(voce.entita, "remote", "toggle");
      else comanda(servizio.domain, servizio.service, servizio.data);
      return;
    }
    case "mp-tele": {
      const l = lettoreOra({ entita: id, nome: "" });
      const servizio = comandoDelTelecomando(l.telecomando, bersaglio.dataset.muTasto);
      if (servizio) comanda(servizio.domain, servizio.service, servizio.data);
      return;
    }
    case "muto": {
      /* Il muto di un canale: l'interruttore scelto, il comando del
       * telecomando, il tasto da premere o il muto del lettore. Quello che
       * sa dire com'e' si vede subito, e la risposta vera lo conferma. */
      const muto = bersaglio.dataset.muMuto || "";
      const canale = canaleDellaPagina(id, muto, Boolean(bersaglio.dataset.muMaster));
      const lettura = canaleOra(canale);
      const servizio = servizioDelMuto(canale, lettura);
      if (!servizio) return;
      if (lettura.mutoSaDire) {
        if (muto) attendi(muto, "acceso", !lettura.mutato);
        else attendi(id, "mutato", !lettura.mutato);
      }
      comanda(servizio.domain, servizio.service, servizio.data);
      disegna();
      return;
    }
    case "passo": {
      /* ▲ / ▼ di un telecomando: il suo comando, una volta per tocco. */
      const canale = canaleDellaPagina(id, "", Boolean(bersaglio.dataset.muMaster));
      const servizio = servizioDelPasso(canale, bersaglio.dataset.muVerso);
      if (servizio) comanda(servizio.domain, servizio.service, servizio.data);
      return;
    }
    case "ptz": {
      const pagina = state.muro?.pagine?.[state.pagina];
      const servizio = servizioDellaTelecamera(pagina?.telecamera, bersaglio.dataset.muTasto);
      if (servizio) comanda(servizio.domain, servizio.service, servizio.data);
      return;
    }
    case "preset": {
      const pagina = state.muro?.pagine?.[state.pagina];
      const voce = pagina?.telecamera?.preset?.[Number(bersaglio.dataset.muIndice)];
      const servizio = voce
        ? servizioDellaTelecamera(voce, "entita", pagina.telecamera.dispositivo)
        : null;
      if (servizio) comanda(servizio.domain, servizio.service, servizio.data);
      return;
    }
    case "pulsante": {
      const pagina = state.muro?.pagine?.[state.pagina];
      const p = pulsantiDellaPagina(pagina)[Number(bersaglio.dataset.muIndice)];
      if (!p) return;
      const verso = bersaglio.dataset.muVerso === "stop" ? "stop" : "avvio";
      const servizio = servizioDelPulsante(p, verso, allStates() || {});
      if (!servizio) return;
      /* Chi dice il suo stato lo cambia subito: acceso dopo l'avvio, spento
       * dopo lo stop, e il tasto solo di un interruttore si alterna. */
      if (diceLoStato(p))
        attendi(
          p.stato || p.avvio,
          "acceso",
          verso === "stop" ? false : servizio.service === "turn_off" ? false : true,
        );
      comanda(servizio.domain, servizio.service, servizio.data);
      disegna();
      return;
    }
    case "ferma-tutto": {
      const pagina = state.muro?.pagine?.[state.pagina];
      for (const servizio of chiamateDelFermaTutto(pagina, allStates() || {}))
        if (servizio) comanda(servizio.domain, servizio.service, servizio.data);
      for (const p of pulsantiDellaPagina(pagina))
        if (diceLoStato(p) && (p.stop || p.stato)) attendi(p.stato || p.avvio, "acceso", false);
      disegna();
      return;
    }
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
  /* Un tocco vale come «qualcuno vicino»: la luce sale subito, al dito, non
   * al disegno che segue. */
  if (state.muro?.luce?.attiva) regolaLaLuce();
  /* Un dito nuovo comincia da capo. La pressione lunga su una luce apre la
   * finestra e lascia il segno, perché il tocco che segue non la spenga; ma
   * il dito si alza sulla finestra, non sulla card, e quel tocco non arriva
   * mai: il segno restava, e mangiava il primo tocco dopo — il clima o la
   * tapparella non si aprivano. */
  state.tenuto = false;
  const barra = event.target?.closest?.("[data-mu-cursore]");
  if (barra?.dataset.muCursore === "fader") {
    /* Il cursore di un canale: si trascina tutto, e intanto il comando parte
     * al massimo quattro volte al secondo — chi alza un microfono vuole
     * sentirlo salire, non solo dove l'ha lasciato. */
    if (barra.classList.contains("fermo")) return;
    const id = barra.dataset.muEntita;
    state.trascina = {
      barra,
      id,
      fader: true,
      sdraiato: barra.classList.contains("sdraiato"),
      lettura: letturaDelCanale({ entita: id }, allStates() || {}),
      ultimo: 0,
      mandato: null,
    };
    barra.setPointerCapture?.(event.pointerId);
    onPointerMove(event);
    return;
  }
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
      ingoiaIlRilascio();
      if (state.muro?.blocco?.attivo)
        apriFinestra({ tipo: "codice", scopo: "uscita", scritto: "" });
      else apriIlConfigDelMuro();
    }, 2000);
  }
}

/* Il dito che si alza dopo i due secondi sull'orologio non e' un tocco.
 *
 * «Con questo formato se clicco su ora non si attiva il config.» Si attivava:
 * dopo due secondi il config si apriva, e il dito, alzandosi, lo richiudeva.
 * Sul telefono il config prende tutto lo schermo e la sua ✕ sta in alto a
 * destra — proprio sotto l'ora del pannello, dov'era il dito. Il pannello se
 * n'e' gia' andato, il rilascio finisce su quello che c'e' adesso, e il clic
 * che ne nasce preme la ✕: il config si chiudeva in un lampo, e il pannello
 * tornava. Sul tablet la ✕ sta lontano dall'ora, e non succedeva.
 *
 * E' lo stesso inciampo della luce tenuta (`state.tenuto`), ma qui il clic
 * non arriva al pannello: arriva al config, o al tastierino del PIN. Lo si
 * ferma prima di tutti, sul documento: il primo clic dopo che il dito si e'
 * alzato, e solo quello, e solo subito dopo. */
function ingoiaIlRilascio() {
  if (!doc?.addEventListener) return;
  const togli = () => {
    doc.removeEventListener("pointerup", alzati, true);
    doc.removeEventListener("pointerdown", togli, true);
    doc.removeEventListener("click", ingoia, true);
  };
  /* Il clic del rilascio arriva subito dopo il dito alzato: passato un
   * attimo, se non e' arrivato non arriva piu', e il tocco dopo e' vero. */
  const alzati = () => {
    doc.removeEventListener("pointerup", alzati, true);
    root.setTimeout?.(togli, 600);
  };
  const ingoia = (event) => {
    togli();
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  doc.addEventListener("pointerup", alzati, true);
  doc.addEventListener("click", ingoia, true);
  /* Un dito nuovo che si posa e' un tocco vero: il rilascio e' passato. */
  doc.addEventListener("pointerdown", togli, true);
  /* E se il dito resta giu' a lungo, la guardia non resta li' per sempre. */
  root.setTimeout?.(togli, 30_000);
}

/* Da 0 a 1, dove sta il dito lungo la traccia del cursore. */
export function posizioneDalDito(punto, riquadro, sdraiato = false) {
  const p = sdraiato
    ? (punto.x - riquadro.left) / (riquadro.width || 1)
    : 1 - (punto.y - riquadro.top) / (riquadro.height || 1);
  return Math.max(0, Math.min(1, p));
}
const FADER_OGNI = 250;

function mandaIlFader(t, posizione) {
  const servizio = servizioDelFader({ entita: t.id }, posizione, t.lettura);
  if (!servizio) return;
  const valore = servizio.data.volume_level ?? servizio.data.value;
  if (valore === t.mandato) return;
  t.mandato = valore;
  t.ultimo = Date.now();
  comanda(servizio.domain, servizio.service, servizio.data);
}

function muoviIlFader(t, event) {
  const traccia = t.barra.querySelector(".mu-fad-traccia") || t.barra;
  const r = traccia.getBoundingClientRect();
  /* Sul passo del canale: la manopola scatta dove il valore vero puo' stare. */
  const grezza = posizioneDalDito({ x: event.clientX, y: event.clientY }, r, t.sdraiato);
  const valore = valoreDallaPosizione(grezza, t.lettura);
  const p =
    t.lettura.tipo === "volume"
      ? valore
      : (valore - t.lettura.min) / (t.lettura.max - t.lettura.min || 1);
  t.valore = p;
  t.barra.style.setProperty("--p", p.toFixed(4));
  const scritta = t.barra.closest("[data-mu-canale]")?.querySelector("[data-mu-fader-testo]");
  if (scritta) scritta.textContent = testoDelCanale(t.lettura, p);
  if (Date.now() - t.ultimo >= FADER_OGNI) mandaIlFader(t, p);
}

function onPointerMove(event) {
  const t = state.trascina;
  if (!t) return;
  if (t.fader) {
    muoviIlFader(t, event);
    return;
  }
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
  if (t?.fader) {
    state.trascina = null;
    if (t.valore !== undefined) {
      mandaIlFader(t, t.valore);
      attendi(t.id, "posizione", t.valore);
    }
    disegna();
    return;
  }
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
  /* Una finestra che nessuno tocca da cinque minuti si chiude da sola: il
   * citofono dopo lo squillo, ma anche le altre. Da li' il riposo e il
   * ritorno alla Home tornano a valere. */
  if (state.finestra && !state.trascina && finestraDaChiudere(state.finestra, state.toccatoDalDito, Date.now()))
    chiudiFinestra();
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

/* ── il campanello ─────────────────────────────────────────────────────────
 *
 * «Quando suona il campanello il pannello si sveglia e mostra la telecamera
 * col tasto Apri.» Ogni pagina Ingresso puo' avere il suo campanello: un
 * sensore che si accende, o un evento di Home Assistant (il citofono di
 * molte marche e' un `event.*`, che a ogni squillo cambia la sua ora). Il
 * primo sguardo non suona: si ricorda com'era e basta, o ogni riavvio del
 * tablet aprirebbe il citofono. Le regole — quali entita', quando e' uno
 * squillo — stanno in `core/il-campanello-a-muro.js`. */
export const campanelloSuona = squilloDelCampanello;

function campanelliDelMuro(muro = state.muro) {
  const visti = new Set();
  const fuori = [];
  (muro?.pagine || []).forEach((pagina, indice) => {
    const id = pagina.modello === "ingresso" ? clean(pagina.ingresso?.campanello) : "";
    if (!id || visti.has(id)) return;
    visti.add(id);
    fuori.push({ indice, id });
  });
  return fuori;
}

/* I campanelli si guardano sempre, come le aree dell'antifurto: non si
 * disegnano da nessuna parte, e senza questa domanda il cancello degli stati
 * (`state-event-gate.js`) buttava il loro squillo come chiacchiere della casa
 * — il campanello sta nella configurazione del muro, non fra le entita' delle
 * sezioni. */
const eUnCampanello = (id) => campanelliDelMuro().some((c) => c.id === id);

/* Si ricorda com'era ogni campanello, ma solo quando lo stato c'e' davvero:
 * prima che arrivino gli stati di Home Assistant non si sa niente, e
 * ricordarsi «niente» farebbe suonare il primo stato vero — che e' solo il
 * vecchio squillo. `except` sono quelli appena cambiati: il loro valore e'
 * gia' quello nuovo, e ricordarlo vorrebbe dire non sentirlo. */
function ricordaICampanelli(except = []) {
  const visti = (state.campanelli ||= {});
  for (const { id } of campanelliDelMuro()) {
    if (id in visti || except.includes(id)) continue;
    const letto = allStates()?.[id];
    if (letto) visti[id] = ricordoDelCampanello(undefined, letto.state);
  }
}

function suonaIlCampanello(event) {
  if (!state.muro?.attiva) return;
  const ids =
    event?.detail?.entity_ids || (event?.detail?.entity_id ? [event.detail.entity_id] : []);
  ricordaICampanelli(ids);
  /* Senza Premium il pannello non c'e', e nemmeno lo squillo: ma il ricordo
   * si aggiorna lo stesso, o la licenza che arriva dopo farebbe suonare un
   * campanello vecchio. */
  const suona = state.premium === true;
  const visti = (state.campanelli ||= {});
  for (const { indice, id } of campanelliDelMuro()) {
    if (ids.length && !ids.includes(id)) continue;
    const letto = allStates()?.[id];
    if (!letto) continue;
    const ora = String(letto.state ?? "");
    const prima = visti[id];
    visti[id] = ricordoDelCampanello(prima, ora);
    if (!suona || !campanelloSuona(id, prima, ora)) continue;
    state.riposo = false;
    state.pagina = indice;
    tocco();
    squilla(indice, id);
    return;
  }
}

/* ── lo squillo, come una chiamata ────────────────────────────────────────
 *
 * «Col Ring il tablet a muro deve fare come un videocitofono: si accende,
 * suona, e mi fa vedere chi c'e' a tutto schermo come una chiamata.» Lo
 * squillo prende tutto lo schermo — la telecamera grande, «Apri», «Silenzia»,
 * «Chiudi», e «Parla» per chi l'ha acceso — e suona finche' qualcuno non
 * risponde o finche' non passano trenta secondi. Poi la stessa finestra dice
 * quando ha suonato, e gli ultimi squilli con la loro istantanea.
 *
 * Le regole — le fasi, i tempi, la storia — stanno in
 * `core/il-campanello-a-muro.js`; il suono in `il-suono-del-campanello.js`. */

/* Gli ultimi squilli restano su questo tablet: sono quello che ha visto lui,
 * e un'istantanea pesa troppo per viaggiare con la configurazione. */
const CHIAVE_SQUILLI = "cd_campanello_squilli";

function squilliRicordati() {
  return storiaPulita(readJson(CHIAVE_SQUILLI, []));
}

function ricordaGliSquilli(storia) {
  writeJsonIfChanged(CHIAVE_SQUILLI, storiaPulita(storia), { sync: false });
}

function ingressoDi(indice) {
  return state.muro?.pagine?.[indice]?.ingresso || {};
}

/* L'istantanea di adesso, come indirizzo: quella che il campanello porta con
 * se' (un evento che dichiara la sua immagine) o la foto della telecamera. Il
 * proxy di Home Assistant da' sempre l'ultima foto, quindi appena il video
 * c'e' se ne fa una copia piccola (`fotografaLoSquillo`), che resta quella. */
function fotoDiAdesso(campanello, telecamera, quando) {
  const foto =
    clean(stato(campanello)?.attributes?.entity_picture) ||
    clean(stato(telecamera)?.attributes?.entity_picture);
  if (!foto) return "";
  return `${foto}${foto.includes("?") ? "&" : "?"}squillo=${quando}`;
}

function squilla(indice, campanello) {
  const quando = Date.now();
  const ing = ingressoDi(indice);
  const opzioni = opzioniDelCampanello(ing);
  smettiDiSquillare();
  ricordaGliSquilli(
    conLoSquillo(squilliRicordati(), {
      quando,
      entita: campanello,
      pagina: indice,
      immagine: fotoDiAdesso(campanello, ing.telecamera, quando),
    }),
  );
  if (opzioni.accendiSchermo) svegliaLoSchermo();
  apriFinestra({ tipo: "citofono", pagina: indice, suonato: quando, silenziato: false });
  if (opzioni.suono !== "nessuno") suonaIlSuono(opzioni.suono, opzioni.volume);
  state.sveglia = root.setInterval?.(scandisciLoSquillo, 1000) || 0;
  state.scatto = root.setTimeout?.(() => fotografaLoSquillo(quando), 2500) || 0;
}

/* Una volta al secondo: il conto «Squilla da 0:08» e «30 s fa» si riscrivono
 * nel loro posto, senza ridisegnare il video; al cambio di fase si ridisegna. */
function scandisciLoSquillo() {
  const f = state.finestra;
  if (f?.tipo !== "citofono" || !f.suonato) {
    smettiDiSquillare();
    return;
  }
  const { fase, trascorsi } = faseDelloSquillo(
    { quando: f.suonato, silenziato: f.silenziato },
    Date.now(),
  );
  if (fase !== state.faseDelloSquillo) {
    if (fase === "dopo") fermaIlCampanello();
    disegna();
    return;
  }
  const nodo = doc?.getElementById(ID);
  for (const tempo of nodo?.querySelectorAll?.("[data-mu-squillo-tempo]") || [])
    tempo.textContent = tempoDelloSquillo(fase, trascorsi);
}

function tempoDelloSquillo(fase, trascorsi) {
  if (fase === "squilla") return `${t("Squilla da", "Ringing for")} ${durataScritta(trascorsi)}`;
  return quantoFaScritto(trascorsi);
}

function quantoFaScritto(ms) {
  const { numero, unita } = quantoFa(ms);
  const misura =
    unita === "giorni"
      ? t("giorni", "days")
      : unita === "h"
        ? t("h", "h")
        : unita === "min"
          ? t("min", "min")
          : "s";
  return `${numero} ${misura} ${t("fa", "ago")}`;
}

function silenzia() {
  fermaIlCampanello();
  const f = state.finestra;
  if (f?.tipo === "citofono" && f.suonato && !f.silenziato) {
    f.silenziato = true;
    disegna();
  }
}

function smettiDiSquillare() {
  fermaIlCampanello();
  if (state.sveglia) root.clearInterval?.(state.sveglia);
  if (state.scatto) root.clearTimeout?.(state.scatto);
  state.sveglia = 0;
  state.scatto = 0;
  smettiDiParlare();
}

/* La copia piccola del fotogramma di quel momento. Se il browser non la lascia
 * fare — una telecamera servita da un'altra origine — resta l'indirizzo. */
function fotografaLoSquillo(quando) {
  state.scatto = 0;
  const img = doc?.querySelector?.(`#${ID} .mu-sq-video img[data-mu-telecamera]`);
  const video = doc?.querySelector?.(`#${ID} .mu-sq-video video`);
  const sorgente =
    video?.videoWidth > 0 ? video : img?.complete && img.naturalWidth > 0 ? img : null;
  if (!sorgente) return;
  try {
    const tela = doc.createElement("canvas");
    tela.width = 192;
    tela.height = 120;
    tela.getContext("2d").drawImage(sorgente, 0, 0, tela.width, tela.height);
    const foto = tela.toDataURL("image/jpeg", 0.7);
    ricordaGliSquilli(conLaFoto(squilliRicordati(), quando, foto));
  } catch (_errore) {
    /* Un'immagine di un'altra origine: resta l'indirizzo. */
  }
}

/* «Parla»: il microfono del tablet va al citofono, sulla stessa strada WebRTC
 * del video, con l'audio nei due versi. Il tasto c'e' solo per chi l'ha
 * acceso nella scheda: dallo stato di Home Assistant non si sa chi l'audio di
 * ritorno ce l'ha. Un secondo tocco chiude. */
async function parla() {
  if (state.parla) {
    smettiDiParlare();
    disegna();
    return;
  }
  const f = state.finestra;
  const telecamera = clean(ingressoDi(f?.pagina ?? state.pagina).telecamera);
  if (!telecamera || !root.navigator?.mediaDevices?.getUserMedia) {
    state.parlaErrore = true;
    disegna();
    return;
  }
  fermaIlCampanello();
  if (f && !f.silenziato) f.silenziato = true;
  const video = doc.createElement("video");
  video.className = "mu-sq-voce";
  video.autoplay = true;
  video.playsInline = true;
  state.parla = { video, chiudi: null, microfono: null };
  state.parlaErrore = false;
  disegna();
  try {
    const microfono = await root.navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    if (!state.parla) {
      for (const traccia of microfono.getTracks()) traccia.stop();
      return;
    }
    state.parla.microfono = microfono;
    const sessione = await avviaWebRtcNativo(telecamera, video, {
      conAudio: true,
      microfono,
      quandoSiPuoChiudere: (chiudi) => {
        if (state.parla) state.parla.chiudi = chiudi;
      },
    });
    if (state.parla) state.parla.chiudi = sessione.chiudi;
    else sessione.chiudi();
  } catch (_errore) {
    smettiDiParlare();
    state.parlaErrore = true;
    disegna();
  }
}

function smettiDiParlare() {
  const voce = state.parla;
  state.parla = null;
  if (!voce) return;
  try {
    voce.chiudi?.();
  } catch (_errore) {}
  for (const traccia of voce.microfono?.getTracks?.() || []) traccia.stop();
  voce.video?.remove();
}

/* Il video della conversazione non e' scritto nel disegno: un ridisegno lo
 * toglierebbe, e la voce cadrebbe. Si rimette al suo posto dopo ogni giro. */
function rimettiLaVoce(nodo) {
  const video = state.parla?.video;
  const posto = nodo.querySelector(".mu-sq-video");
  if (video && posto && video.parentElement !== posto) posto.append(video);
}

const ICONE_DELLO_SQUILLO = Object.freeze({
  apri: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 7.6-1.7"/><circle cx="12" cy="16" r="1.4" fill="currentColor"/></svg>`,
  parla: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg>`,
  muto: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 9.5-4.9M18 11v5l1.5 2H8.5M10 21h4M3 3l18 18"/></svg>`,
  chiudi: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
});

function squilloMarkup(f) {
  const indice = f.pagina ?? state.pagina;
  const pagina = state.muro?.pagine?.[indice] || {};
  const ing = pagina.ingresso || {};
  const opzioni = opzioniDelCampanello(ing);
  const { fase, trascorsi } = faseDelloSquillo(
    { quando: f.suonato, silenziato: f.silenziato },
    Date.now(),
  );
  state.faseDelloSquillo = fase;
  const squilla = fase === "squilla";
  const nomePagina = titoloDi(pagina) || t("Ingresso", "Entrance");
  const ora = orologio(new Date(f.suonato)).ora;
  const accento = squilla ? "#16a34a" : "#2563eb";
  const campana = `<span class="mu-chip mu-acc mu-sq-campana">${squilla ? `<i class="onda o2"></i><i class="onda o1"></i>` : ""}${disegnoDelCatalogo("bell", 36)}</span>`;
  const testa = squilla
    ? `<div class="mu-nome"><div class="mu-n">${esc(t("Suona il campanello", "The doorbell is ringing"))}</div><div class="mu-sotto">${esc(nomePagina)}${ing.telecamera ? ` · ${esc(nomeDi(ing.telecamera))}` : ""}</div></div>`
    : `<div class="mu-nome"><div class="mu-n">${esc(t("Ha suonato alle", "It rang at"))} ${esc(ora)}</div><div class="mu-sotto"><span data-mu-squillo-tempo>${esc(quantoFaScritto(trascorsi))}</span> · ${esc(nomePagina)}</div></div>`;
  const destra = squilla
    ? `<div class="mu-sq-ora"><div class="mu-osw">${esc(ora)}</div><span class="mu-stato" data-mu-squillo-tempo>${esc(tempoDelloSquillo(fase, trascorsi))}</span></div>`
    : `<div class="mu-sq-ora finito"><div class="mu-osw">${esc(ora)}</div><span class="mu-stato">${esc(t("Squillo finito", "Ring over"))}</span></div>`;
  const storia = squilliRicordati().slice(0, 3);
  const mini = (voce) =>
    voce.immagine
      ? `<img src="${esc(voce.immagine)}" alt="" loading="lazy">`
      : `<span class="mu-sq-senza">${disegno("telecamere", 28, `sq-${voce.quando}`)}</span>`;
  const quandoEra = (voce) => {
    const giorno = new Date(voce.quando).toDateString() === new Date().toDateString();
    return giorno
      ? voce.quando === f.suonato
        ? `${t("Oggi", "Today")} · ${quantoFaScritto(Date.now() - voce.quando)}`
        : t("Oggi", "Today")
      : orologio(new Date(voce.quando)).giorno;
  };
  const video = ing.telecamera
    ? `<img data-mu-telecamera="${esc(ing.telecamera)}" alt="">`
    : `<div class="mu-video-vuoto">${disegno("telecamere", 80, "sq-vuota")}</div>`;
  const apri = (grande) =>
    [
      ing.apri
        ? `<button type="button" class="mu-btn pieno${grande ? " grande" : ""}" style="--acc:#16a34a" data-mu-fa="apri" data-mu-entita="${esc(ing.apri)}">${ICONE_DELLO_SQUILLO.apri}${esc(nomeDi(ing.apri, ing.nomeApri))}</button>`
        : "",
      ing.apri2
        ? `<button type="button" class="mu-btn" data-mu-fa="apri" data-mu-entita="${esc(ing.apri2)}">${ICONE_DELLO_SQUILLO.apri}${esc(nomeDi(ing.apri2, ing.nomeApri2))}</button>`
        : "",
    ].join("");
  const chiudi = `<button type="button" class="mu-btn rosso" data-mu-fa="chiudi">${ICONE_DELLO_SQUILLO.chiudi}${esc(t("Chiudi", "Close"))}</button>`;
  const parlaTasto =
    opzioni.parla && ing.telecamera
      ? `<button type="button" class="mu-btn mu-sq-parla${state.parla ? " si" : ""}" data-mu-fa="citofono-parla" aria-pressed="${Boolean(state.parla)}">${ICONE_DELLO_SQUILLO.parla}${esc(state.parla ? t("In linea", "Talking") : t("Parla", "Talk"))}${state.parlaErrore ? `<small>${esc(t("Il citofono non accetta la voce", "The intercom does not take audio"))}</small>` : ""}</button>`
      : "";
  const tasti = squilla
    ? `<div class="mu-sq-tasti">${apri(true)}${parlaTasto}<button type="button" class="mu-btn" data-mu-fa="citofono-silenzia">${ICONE_DELLO_SQUILLO.muto}${esc(t("Silenzia", "Silence"))}</button>${chiudi}</div>`
    : `<div class="mu-sq-tasti dopo"><div class="mu-sq-due">${apri(false)}${state.parla ? parlaTasto : ""}${chiudi}</div>
      ${storia.length ? `<div class="mu-carta mu-sq-storia"><span class="mu-stato">${esc(t("Ultimi squilli", "Last rings"))}</span><div class="mu-sq-righe">${storia.map((voce) => `<div class="mu-sq-squillo${voce.quando === f.suonato ? " ora" : ""}">${mini(voce)}<div><b>${esc(orologio(new Date(voce.quando)).ora)}</b><small>${esc(quandoEra(voce))}</small></div></div>`).join("")}</div></div>` : ""}</div>`;
  const avviso =
    squilla && suonoBloccato() && opzioni.suono !== "nessuno"
      ? `<div class="mu-sq-avviso">${esc(t("Tocca lo schermo una volta: il browser fa suonare il campanello solo dopo un tocco", "Tap the screen once: the browser plays the doorbell only after a tap"))}</div>`
      : "";
  return `<div class="mu-squillo${squilla ? " squilla" : ""}" style="--acc:${accento}" role="alertdialog" aria-label="${esc(squilla ? t("Suona il campanello", "The doorbell is ringing") : `${t("Ha suonato alle", "It rang at")} ${ora}`)}">
    <div class="mu-carta${squilla ? " mu-accesa" : ""} mu-sq-testa" style="--acc:${accento}">${campana}${testa}${destra}</div>
    <div class="mu-video mu-sq-video">${video}<span class="mu-live"><i></i>${esc(nomePagina)} · ${esc(t("dal vivo", "live"))}</span>${
      !squilla && storia.length
        ? `<div class="mu-sq-mini">${storia.map((voce) => `<span>${mini(voce)}${esc(orologio(new Date(voce.quando)).ora)}</span>`).join("")}</div>`
        : ""
    }${avviso}</div>
    ${tasti}
  </div>`;
}

/* ── gli avvisi a tutto schermo ───────────────────────────────────────────
 *
 * «Allagamento, fumo, allarme o finestra aperta con la pioggia, a tutto
 * schermo con un tasto Ho visto.» Gli avvisi sono quelli della plancia di
 * origine (gli avvisi personalizzati) e l'antifurto che suona. Uno nuovo
 * sveglia il pannello e resta davanti a tutto finche' qualcuno tocca «Ho
 * visto»; quando si spegne, la volta dopo torna a farsi vedere. */
function avvisiDaMostrare() {
  const muro = state.muro;
  if (!muro?.avvisiGrandi || !state.fonte) return [];
  const accesi = avvisiAccesi(state.fonte, allStates() || {}, centraleDelMuro(muro.pagine[0]));
  const visti = (state.avvisiVisti ||= new Set());
  const ancora = new Set(accesi.map((a) => a.chiave));
  for (const chiave of [...visti]) if (!ancora.has(chiave)) visti.delete(chiave);
  return accesi.filter((a) => !visti.has(a.chiave));
}

function guardaGliAvvisi() {
  if (!state.riposo || !state.premium) return;
  if (avvisiDaMostrare().length) {
    state.riposo = false;
    tocco();
  }
}

function avvisoGrande() {
  const muro = state.muro;
  if (!muro?.avvisiGrandi) return "";
  for (const a of state.fonte?.avvisi || []) a.entita.forEach(segna);
  for (const id of state.fonte?.centrali || []) segna(id);
  const [a] = avvisiDaMostrare();
  if (!a) return "";
  const disegnoDellAvviso = a.grave
    ? disegnoDelCatalogo("allarme", 84) || disegno("sicurezza", 84, "grande-allarme")
    : disegnoDelCatalogo(a.icon, 84) || disegno("avvisi", 84, `grande-${esc(a.chiave)}`);
  const titolo = a.grave ? t("Allarme in corso", "Alarm going off") : a.testo;
  const tasti = a.grave
    ? `<button type="button" class="mu-avg-tasto pieno" data-mu-fa="avviso-antifurto" data-mu-avviso="${esc(a.chiave)}">${esc(t("Antifurto", "Alarm"))}</button>`
    : "";
  return `<div class="mu-avviso-grande ${a.grave ? "grave" : ""}" role="alertdialog" aria-label="${esc(titolo)}">
    <div class="mu-avg-disco">${disegnoDellAvviso}</div>
    <div class="mu-avg-et">${esc(t("Attenzione", "Warning"))}</div>
    <div class="mu-avg-tit">${esc(titolo)}</div>
    <div class="mu-avg-tasti">${tasti}<button type="button" class="mu-avg-tasto" data-mu-fa="avviso-visto" data-mu-avviso="${esc(a.chiave)}">${esc(t("Ho visto", "Got it"))}</button></div>
  </div>`;
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
    centrali.some((id) => tocca(id) && String(stato(id)?.state) === "triggered") ||
    (state.fonte?.antifurto?.scattato &&
      tocca(state.fonte.antifurto.scattato.entita) &&
      eScattatoAdesso(state.fonte.antifurto.scattato, allStates() || {}))
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
/* Sul pannello a muro la barra della plancia non c'e', mai. «Su wall quando
 * premo l'hamburger da telefono aperto si alza la navbar, che sul pannello a
 * muro non deve esserci.» Per far passare il menu sopra, il pannello scende a
 * z-index 4 — e la barra di sotto, che sta piu' in alto, gli passava davanti.
 * Finche' il pannello e' acceso la barra e la sua maniglia non si disegnano. */
html.dm-muro-acceso nav.tabs.bottom-nav-bar,html.dm-muro-acceso .bottom-nav-handle{display:none!important}
#dm-muro{position:fixed;inset:0;z-index:2147482000}
${MURO}{overflow:hidden;color:var(--text);font-family:Inter,system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;-webkit-user-select:none;user-select:none;touch-action:manipulation;
  background:radial-gradient(120% 80% at 50% -10%,color-mix(in srgb,var(--card-bg) 70%,transparent),transparent 60%),var(--bg-sculpted)}
${MURO}[data-tema="dark"]{${tokens("dark")}}
${MURO}[data-tema="light"]{${tokens("light")}}
${MURO} *{box-sizing:border-box}
${MURO} button{font:inherit;color:inherit;border:0;background:none;cursor:pointer;text-align:inherit;-webkit-tap-highlight-color:transparent}
/* I comandi in vetro dei riquadri con l'immagine (\`riquadri-con-immagine-section.js\`):
   la regola qui sopra spoglia ogni tasto del pannello, e il vetro sopra la foto
   e' proprio il fondo del tasto. */
${MURO} .dm-rq button.dm-rq-int,${MURO} .dm-rq button.dm-rq-tasto{background:rgba(15,23,42,.42);color:#fff}
${MURO} .dm-rq button.dm-rq-int.on{background:var(--acc)}
${MURO} .dm-rq button.dm-rq-tasto{font-size:clamp(10.5px,5.6cqi,15px);font-weight:800}
${MURO} .dm-rq button.dm-rq-dt{background:rgba(15,23,42,.46);color:#fff;display:inline-grid;place-items:center;text-align:center;font-weight:900}
${MURO} .dm-rq button.dm-rq-dt.si,${MURO} .dm-rq button.dm-rq-dt-on.si{background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1f2937}
${MURO} .dm-rq button.dm-rq-dt-off.si{background:rgba(255,255,255,.34);color:#fff}
${MURO} .dm-rq button.dm-rq-dt.dm-rq-acceso.si{background:var(--acc);color:#fff}
${MURO} .dm-rq .dm-rq-barra{--acc:#fbbf24}
${MURO} .dm-rq-fondo>.dm-rq-img,${MURO} .dm-rq-fondo>.dm-rq-velo{position:absolute}
${MURO} .mu-carta.dm-rq-fondo::before{content:none}
${MURO} .dm-rq-fondo .mu-et,${MURO} .dm-rq-fondo .mu-can-n,${MURO} .dm-rq-fondo .mu-can-v,${MURO} .dm-rq-fondo .mu-reg-nome{color:#fff}
${MURO} .dm-rq [data-mu-cursore].mu-bar::before{background:rgba(255,255,255,.28)}
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
${MURO} .mu-pagine{display:flex;flex:none;gap:6px;padding:5px;border-radius:16px;margin-left:auto;background:color-mix(in srgb,var(--text) 5%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 9%,transparent)}
${MURO} .mu-pagine button{display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:12px;font-weight:800;font-size:15px;color:var(--text-dim)}
${MURO} .mu-pagine button.si{background:color-mix(in srgb,var(--acc) 18%,var(--card-bg));color:color-mix(in srgb,var(--acc) 85%,var(--text));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 45%,transparent)}
${MURO} .mu-ora{margin-left:auto;display:flex;align-items:center;gap:22px;text-align:right}
/* Il dito tenuto sull'orologio e' un gesto del pannello, e il telefono non se
   lo deve prendere: niente scorrimento o tirata per ricaricare che lo
   interrompa a meta', niente menu del tocco lungo. */
${MURO} .mu-ora{touch-action:none;-webkit-touch-callout:none}
${MURO} .mu-pagine+.mu-ora{margin-left:24px}
${MURO} .mu-testa>.mu-titolo{flex:0 1 auto;min-width:var(--mu-tit-min,0)}
${MURO} .mu-testa>.mu-titolo .mu-sot{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-h{font-family:Oswald,Inter,sans-serif;font-weight:500;font-size:58px;line-height:.9}
${MURO} .mu-d{font-size:12px;font-weight:900;letter-spacing:.11em;color:var(--text-dim);margin-top:6px}
${MURO} .mu-sep{width:1px;align-self:stretch;background:color-mix(in srgb,var(--text) 12%,transparent)}
${MURO} .mu-ora{min-width:0;flex-shrink:.2}
${MURO} .mu-meteo{display:flex;flex-direction:column;align-items:flex-end;min-width:0;max-width:240px}
${MURO} .mu-meteo-su{display:flex;align-items:center;gap:8px}
${MURO} .mu-meteo-su>*{flex:0 0 auto}
${MURO} .mu-meteo b{font-family:Oswald,Inter,sans-serif;font-weight:500;font-size:34px;line-height:1.1}
${MURO} .mu-meteo .mu-et{font-size:10px;letter-spacing:.08em;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-pillole{display:flex;gap:26px;padding:14px 22px;align-items:center;flex-wrap:wrap;row-gap:12px}
${MURO} .mu-pill{display:flex;align-items:center;gap:12px}
${MURO} .mu-pill .mu-chip{--c:38px}
${MURO} .mu-pill b{font-size:20px;font-weight:800;display:block;line-height:1}
${MURO} .mu-pill .mu-et{font-size:10.5px}
${MURO} .mu-g6{--mu-col:3;--mu-righe:2;--mu-gap:16px;--mu-alto:150px;display:grid;grid-template-columns:repeat(var(--mu-col),minmax(0,1fr));grid-template-rows:repeat(var(--mu-righe),minmax(0,1fr));gap:var(--mu-gap);min-height:0}
${MURO} .mu-g6.mu-scorre{grid-template-rows:none;grid-auto-rows:calc((100% - var(--mu-gap) * (var(--mu-righe) - 1)) / var(--mu-righe));overflow-y:auto;scroll-snap-type:y proximity;overscroll-behavior:contain;scrollbar-width:none}
${MURO} .mu-pagine.mu-molte button:not(.si) span,${MURO} .mu-pagine.mu-icone button span{display:none}
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
${MURO} .mu-mp-scegli{color:#fff;background:#a238ff;box-shadow:0 10px 24px -12px #a238ff}
${MURO}[data-compatto="1"] .mu-mp-scegli>span{display:none}
${MURO}[data-compatto="1"] .mu-mp-scegli{padding:0 16px}
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
${MURO} .mu-mp-comandi button small{margin-left:4px;font-weight:700;opacity:.75}
${MURO} .mu-mp-lettura{padding:8px 14px;border-radius:999px;font-weight:700;font-size:14px;color:var(--text-dim);background:color-mix(in srgb,var(--text) 3%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 8%,transparent)}
${MURO} .mu-mp-lettura b{margin-left:4px;font-weight:900;color:var(--text);font-variant-numeric:tabular-nums}
${MURO} .mu-mp-tele button{min-width:52px;text-align:center}
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
${MURO} .mu-dato{display:flex;flex-direction:column;justify-content:space-between;gap:6px;padding:16px 18px;cursor:default;min-width:0}
${MURO} .mu-dato-testa{display:flex;align-items:center;gap:8px;min-width:0}
${MURO} .mu-dato-testa svg{flex:none;width:22px;height:22px}
${MURO} .mu-dato-n{font-size:14px;font-weight:800;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-dato-v{font-family:Oswald,Inter,sans-serif;font-weight:500;line-height:.95;font-variant-numeric:tabular-nums;
  font-size:clamp(28px,min(calc(100vh / var(--mu-righe,3) * .3),calc(100vw / var(--mu-col,4) * .22)),96px);color:var(--text);white-space:nowrap}
${MURO} .mu-dato-v small{font-size:.38em;margin-left:5px;font-weight:600;color:var(--text-dim)}
${MURO} .mu-dato-s{font-size:12px;font-weight:700;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
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
${MURO} .mu-energia .mu-cosa-fa{font-size:22px;font-weight:600;margin-top:4px}
/* La pagina Meteo: adesso a sinistra, i prossimi giorni a destra, le ore
   sotto per tutta la larghezza. Sul pannello piccolo le ore salgono a destra
   sotto i giorni; in verticale tutto in colonna. */
${MURO} .mu-pag-meteo{grid-template-rows:auto 1fr}
${MURO} .mu-mt{--mt-pioggia:#0369a1;display:grid;grid-template-columns:minmax(0,1.12fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto;grid-template-areas:"adesso giorni" "ore ore";gap:16px;min-height:0;min-width:0}
${MURO}[data-tema="dark"] .mu-mt{--mt-pioggia:#7dd3fc}
${MURO} .mu-mt.mu-mt-solo{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr);grid-template-areas:"adesso"}
${MURO} .mu-mt-adesso{grid-area:adesso;display:flex;flex-direction:column;gap:16px;padding:24px 26px;min-height:0;min-width:0}
${MURO} .mu-mt-cielo{flex:1 1 auto;display:flex;align-items:center;gap:24px;min-width:0;min-height:0}
${MURO} .mu-mt-segno{flex:none;font-size:116px;line-height:1;filter:drop-shadow(0 12px 18px rgba(15,23,42,.2))}
${MURO} .mu-mt-gradi{display:flex;flex-direction:column;gap:8px;min-width:0}
${MURO} .mu-mt-gradi>b{font-family:Oswald,Inter,sans-serif;font-weight:500;font-size:118px;line-height:.86;letter-spacing:-.02em;color:var(--text);font-variant-numeric:tabular-nums;white-space:nowrap}
${MURO} .mu-mt-gradi>b i{font-style:normal;font-size:.48em;vertical-align:top;margin-left:2px;color:var(--text-dim)}
${MURO} .mu-mt-cond{font-size:24px;font-weight:800;line-height:1.15;color:color-mix(in srgb,var(--acc) 70%,var(--text));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-mt-forbice{font-size:17px;font-weight:700;color:var(--text-dim);white-space:nowrap}
${MURO} .mu-mt-forbice b{color:var(--text);font-weight:800}
${MURO} .mu-mt-frase{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:16px;min-width:0;
  background:color-mix(in srgb,#0284c7 11%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,#0284c7 30%,transparent)}
${MURO} .mu-mt-frase[data-stato="asciutto"]{background:color-mix(in srgb,#16a34a 10%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,#16a34a 28%,transparent)}
${MURO} .mu-mt-frase>span{flex:none;font-size:24px;line-height:1}
${MURO} .mu-mt-frase>b{font-size:17px;font-weight:800;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-mt-frase>small{margin-left:auto;flex:none;font-size:14px;font-weight:700;color:var(--text-dim)}
${MURO} .mu-mt-misure{margin-top:auto;display:grid;grid-template-columns:repeat(var(--n,4),minmax(0,1fr));gap:10px}
${MURO} .mu-mt-misura{display:flex;flex-direction:column;gap:7px;padding:12px 14px;border-radius:16px;min-width:0;
  background:color-mix(in srgb,var(--text) 4%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 8%,transparent)}
${MURO} .mu-mt-misura-testa{display:flex;align-items:center;gap:6px;min-width:0}
${MURO} .mu-mt-misura-testa .dm-oggetto{flex:none}
${MURO} .mu-mt-misura-testa .mu-et{font-size:10.5px;letter-spacing:.08em;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-mt-misura>b{font-family:Oswald,Inter,sans-serif;font-weight:500;font-size:30px;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
${MURO} .mu-mt-misura>b i,${MURO} .mu-mt-misura>b em{font-style:normal;font-family:Inter,system-ui,sans-serif;font-size:13px;font-weight:700;margin-left:4px;color:var(--text-dim)}
${MURO} .mu-mt-misura>b em{font-weight:900;color:color-mix(in srgb,var(--acc) 75%,var(--text))}
${MURO} .mu-mt-misura>small{font-size:11.5px;font-weight:700;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-mt-scheda{display:flex;flex-direction:column;gap:10px;padding:18px 20px;min-height:0;min-width:0}
${MURO} .mu-mt-titolo{flex:none}
${MURO} .mu-mt-prossimi{grid-area:giorni}
${MURO} .mu-mt-ore{grid-area:ore}
${MURO} .mu-mt-fila{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:6px;min-width:0}
${MURO} .mu-mt-ora{display:flex;flex-direction:column;align-items:center;gap:7px;padding:10px 2px;border-radius:16px;min-width:0}
${MURO} .mu-mt-ora.ora{background:color-mix(in srgb,var(--acc) 13%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 34%,transparent)}
${MURO} .mu-mt-ora-h{font-size:13px;font-weight:800;color:var(--text-dim);font-variant-numeric:tabular-nums;white-space:nowrap}
${MURO} .mu-mt-ora.ora .mu-mt-ora-h{color:color-mix(in srgb,var(--acc) 70%,var(--text))}
${MURO} .mu-mt-ora-segno{font-size:30px;line-height:1}
${MURO} .mu-mt-ora>b{font-family:Oswald,Inter,sans-serif;font-weight:500;font-size:25px;line-height:1;font-variant-numeric:tabular-nums}
${MURO} .mu-mt-goccia{position:relative;width:min(36px,80%);height:5px;border-radius:999px;overflow:hidden;background:color-mix(in srgb,#0284c7 16%,transparent)}
${MURO} .mu-mt-goccia i{position:absolute;inset:0 auto 0 0;width:var(--p);border-radius:inherit;background:#0ea5e9}
${MURO} .mu-mt-ora>small{min-height:14px;font-size:12px;font-weight:800;line-height:1.15;color:var(--mt-pioggia)}
${MURO} .mu-mt-giorni{flex:1;display:grid;grid-auto-rows:minmax(0,1fr);min-height:0}
${MURO} .mu-mt-giorno{display:grid;grid-template-columns:minmax(64px,1fr) 34px minmax(54px,.75fr) 40px minmax(56px,1.3fr) 40px;align-items:center;gap:10px;min-height:0;border-top:1px solid color-mix(in srgb,var(--text) 8%,transparent)}
${MURO} .mu-mt-giorno:first-child{border-top:0}
${MURO} .mu-mt-giorno-n{font-size:17px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-mt-giorno.oggi .mu-mt-giorno-n{color:color-mix(in srgb,var(--acc) 70%,var(--text))}
${MURO} .mu-mt-giorno-segno{font-size:27px;line-height:1;text-align:center}
${MURO} .mu-mt-giorno-p{font-size:13px;font-weight:800;color:var(--mt-pioggia);white-space:nowrap;overflow:hidden}
${MURO} .mu-mt-min,${MURO} .mu-mt-max{font-family:Oswald,Inter,sans-serif;font-weight:500;font-size:23px;line-height:1;font-variant-numeric:tabular-nums}
${MURO} .mu-mt-min{text-align:right;color:var(--text-dim)}
${MURO} .mu-mt-barra{position:relative;height:8px;border-radius:999px;background:color-mix(in srgb,var(--text) 9%,transparent)}
${MURO} .mu-mt-barra i{position:absolute;top:0;bottom:0;min-width:8px;border-radius:inherit;background:linear-gradient(90deg,#38bdf8,#f59e0b 60%,#ef4444)}
${MURO} .mu-mt-attesa{flex:1;display:grid;place-items:center;padding:12px;font-size:16px;font-weight:700;color:var(--text-dim);text-align:center}
${MURO} .mu-mt-vuoto{grid-area:adesso;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:40px;text-align:center}
${MURO} .mu-mt-vuoto>b{font-size:30px;font-weight:800}
${MURO} .mu-mt-vuoto>span:last-child{max-width:640px;font-size:18px;font-weight:600;line-height:1.45;color:var(--text-dim)}
${MURO}[data-verso="verticale"] .mu-mt{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr);grid-template-areas:"adesso" "ore" "giorni"}
${MURO}[data-compatto="1"] .mu-mt{gap:10px;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);grid-template-rows:minmax(0,1fr) auto;grid-template-areas:"adesso giorni" "adesso ore"}
${MURO}[data-compatto="1"][data-verso="verticale"] .mu-mt{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr);grid-template-areas:"adesso" "ore" "giorni"}
${MURO}[data-compatto="1"] .mu-mt-adesso{padding:14px 16px;gap:10px}
${MURO}[data-compatto="1"] .mu-mt-cielo{gap:12px}
${MURO}[data-compatto="1"] .mu-mt-segno{font-size:60px}
${MURO}[data-compatto="1"] .mu-mt-gradi{gap:5px}
${MURO}[data-compatto="1"] .mu-mt-gradi>b{font-size:64px}
${MURO}[data-compatto="1"] .mu-mt-cond{font-size:16px}
${MURO}[data-compatto="1"] .mu-mt-forbice{font-size:12.5px}
${MURO}[data-compatto="1"] .mu-mt-frase{padding:7px 10px;gap:8px;border-radius:12px}
${MURO}[data-compatto="1"] .mu-mt-frase>span{font-size:17px}
${MURO}[data-compatto="1"] .mu-mt-frase>b{font-size:13px}
${MURO}[data-compatto="1"] .mu-mt-frase>small{display:none}
${MURO}[data-compatto="1"] .mu-mt-misure{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
${MURO}[data-compatto="1"] .mu-mt-misura{padding:6px 10px;gap:3px;border-radius:12px}
${MURO}[data-compatto="1"] .mu-mt-misura-testa .dm-oggetto{width:16px!important;height:16px!important}
${MURO}[data-compatto="1"] .mu-mt-misura-testa .mu-et{font-size:9px}
${MURO}[data-compatto="1"] .mu-mt-misura>b{font-size:20px}
${MURO}[data-compatto="1"] .mu-mt-misura>b i,${MURO}[data-compatto="1"] .mu-mt-misura>b em{font-size:10.5px;margin-left:3px}
${MURO}[data-compatto="1"] .mu-mt-misura>small{display:none}
${MURO}[data-compatto="1"] .mu-mt-scheda{padding:10px 12px;gap:6px;border-radius:18px}
${MURO}[data-compatto="1"] .mu-mt-titolo{font-size:10px}
${MURO}[data-compatto="1"] .mu-mt-fila{gap:3px}
${MURO}[data-compatto="1"] .mu-mt-ora{gap:4px;padding:5px 1px;border-radius:12px}
${MURO}[data-compatto="1"] .mu-mt-ora:nth-child(n+7){display:none}
${MURO}[data-compatto="1"][data-verso="verticale"] .mu-mt-ora:nth-child(n+7){display:flex}
${MURO}[data-compatto="1"][data-verso="verticale"] .mu-mt-ora:nth-child(n+9){display:none}
${MURO}[data-compatto="1"] .mu-mt-ora-h{font-size:11px}
${MURO}[data-compatto="1"] .mu-mt-ora-segno{font-size:20px}
${MURO}[data-compatto="1"] .mu-mt-ora>b{font-size:17px}
${MURO}[data-compatto="1"] .mu-mt-ora>small{font-size:10px;min-height:11px}
${MURO}[data-compatto="1"] .mu-mt-goccia{height:4px}
${MURO}[data-compatto="1"] .mu-mt-giorno{grid-template-columns:minmax(46px,1fr) 22px 30px minmax(28px,1fr) 30px;gap:6px}
${MURO}[data-compatto="1"] .mu-mt-giorno:nth-child(n+6){display:none}
${MURO}[data-compatto="1"] .mu-mt-giorno-p{display:none}
${MURO}[data-compatto="1"] .mu-mt-giorno-n{font-size:13px}
${MURO}[data-compatto="1"] .mu-mt-giorno-segno{font-size:18px}
${MURO}[data-compatto="1"] .mu-mt-min,${MURO}[data-compatto="1"] .mu-mt-max{font-size:16px}
${MURO}[data-compatto="1"] .mu-mt-barra{height:6px}
${MURO}[data-compatto="1"] .mu-mt-vuoto{padding:18px;gap:10px}
${MURO}[data-compatto="1"] .mu-mt-vuoto>b{font-size:20px}
${MURO}[data-compatto="1"] .mu-mt-vuoto>span:last-child{font-size:13px}
${MURO}[data-compatto="1"] .mu-mt-vuoto .mu-chip{--c:64px!important}
/* La pagina Meteo con la stazione: quella della plancia, adattata al muro.
   «Adesso» per tutta la larghezza come in plancia; sotto, a sinistra, «La mia
   stazione» con le tessere su quattro colonne e due file (il vento largo
   due), a destra i prossimi giorni e le prossime ore. I pezzi della plancia
   portano il loro foglio (foglioDelMeteo); qui le carte prendono la carta
   del muro, e il tema del muro (non quello della plancia sotto). */
${foglioDelMeteo(`${MURO} .mu-mt-stazione`, { media: false })}
${MURO} .mu-mt.mu-mt-stazione{--card-border:color-mix(in srgb,var(--text) 10%,transparent);--surface-2:color-mix(in srgb,var(--text) 5%,var(--card-bg));--dm-meteo-gap:12px;
  grid-template-columns:minmax(0,1fr) minmax(0,368px);grid-template-rows:auto minmax(0,1fr) auto;grid-template-areas:"adesso adesso" "stazione giorni" "stazione ore";gap:14px}
${MURO} .mu-mt-pl{min-width:0;min-height:0;display:flex;flex-direction:column}
${MURO} .mu-mt-pl-adesso{grid-area:adesso}
${MURO} .mu-mt-pl-stazione{grid-area:stazione}
${MURO} .mu-mt-pl>.dm-meteo-blocco{flex:1 1 auto;display:flex;flex-direction:column;min-height:0}
${MURO} .mu-mt-stazione :is(.dm-meteo-adesso,.dm-meteo-tessera){border:0;border-radius:22px;background:${FONDO_DELLA_CARTA};box-shadow:${OMBRA_DELLA_CARTA}}
${MURO} .mu-mt-stazione .dm-meteo-adesso{padding:18px 24px;gap:24px;background:radial-gradient(120% 160% at 0% 0%,rgba(14,165,233,.14),transparent 55%),${FONDO_DELLA_CARTA}}
${MURO} .mu-mt-stazione .dm-meteo-adesso-ic{font-size:84px}
${MURO} .mu-mt-stazione .dm-meteo-adesso-gradi>b{font-size:72px}
${MURO} .mu-mt-stazione .dm-meteo-adesso-cond{font-size:14px}
${MURO} .mu-mt-stazione .dm-meteo-adesso-gradi small{font-size:14px}
${MURO} .mu-mt-stazione .dm-meteo-adesso-dx{gap:10px}
${MURO} .mu-mt-stazione .dm-meteo-frase{padding:10px 14px}
${MURO} .mu-mt-stazione .dm-meteo-frase strong{font-size:16px}
${MURO} .mu-mt-stazione .dm-meteo-pill{font-size:13px;padding:6px 12px}
${MURO} .mu-mt-stazione .dm-meteo-fonte{font-size:11.5px}
${MURO} .mu-mt-stazione .dm-meteo-titolo{margin:0 0 8px 4px;flex:none}
${MURO} .mu-mt-stazione .dm-meteo-tessere{flex:1 1 auto;min-height:0;grid-template-rows:repeat(2,minmax(0,1fr));grid-auto-rows:minmax(0,1fr)}
${MURO} .mu-mt-stazione .dm-meteo-tessera{grid-template-rows:auto auto auto minmax(0,1fr);gap:5px;padding:14px 16px 10px;min-height:0}
${MURO} .mu-mt-stazione .dm-meteo-larga>.dm-meteo-bussola{grid-row:1/span 4}
/* La testa della tessera: il nome va a capo invece di finire nei puntini, e
   lo stato («in aumento», «asciutto») scende sotto il nome, che sul muro le
   tessere sono strette e la pastiglia accanto lascerebbe al nome tre lettere. */
${MURO} .mu-mt-stazione .dm-meteo-tessera-testa{display:grid;grid-template-columns:auto minmax(0,1fr);grid-auto-rows:auto;align-content:center;column-gap:10px;row-gap:3px;min-height:38px}
${MURO} .mu-mt-stazione .dm-meteo-tessera-testa>.dm-meteo-ic{grid-row:1/span 2}
${MURO} .mu-mt-stazione .dm-meteo-nome{grid-column:2;align-self:end;font-size:11px;letter-spacing:.7px;line-height:1.2;white-space:normal;text-overflow:clip;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}
${MURO} .mu-mt-stazione .dm-meteo-tessera-testa>.dm-meteo-nome:last-child{grid-row:1/span 2;align-self:center}
${MURO} .mu-mt-stazione .dm-meteo-stato{grid-column:2;justify-self:start;align-self:start;margin-left:0;padding:2px 8px;font-size:9.5px}
${MURO} .mu-mt-stazione .dm-meteo-valore{margin-top:2px}
${MURO} .mu-mt-stazione .dm-meteo-valore b{font-size:38px}
${MURO} .mu-mt-stazione .dm-meteo-valore i{font-size:14px}
${MURO} .mu-mt-stazione .dm-meteo-sotto{font-size:12px;min-height:0}
${MURO} .mu-mt-stazione .dm-meteo-grafico{align-self:end;height:44px;margin-top:12px}
${MURO} .mu-mt-stazione .dm-meteo-spark{height:44px}
${MURO} .mu-mt-stazione .dm-meteo-uv{align-self:end}
${MURO} .mu-mt-stazione .mu-mt-scheda{padding:14px 18px}
${MURO} .mu-mt-stazione .mu-mt-giorno{grid-template-columns:minmax(60px,1fr) 30px minmax(40px,.7fr) 34px minmax(44px,1.1fr) 34px;gap:8px}
${MURO} .mu-mt-stazione .mu-mt-giorno-n{font-size:15px}
${MURO} .mu-mt-stazione .mu-mt-giorno-segno{font-size:23px}
${MURO} .mu-mt-stazione .mu-mt-min,${MURO} .mu-mt-stazione .mu-mt-max{font-size:20px}
${MURO} .mu-mt-stazione .mu-mt-giorno-p{font-size:12px}
${MURO} .mu-mt-stazione .mu-mt-ore .mu-mt-ora:nth-child(n+7){display:none}
${MURO} .mu-mt-stazione .mu-mt-ora{padding:8px 2px;gap:6px}
${MURO} .mu-mt-stazione .mu-mt-ora-segno{font-size:26px}
${MURO} .mu-mt-stazione .mu-mt-ora>b{font-size:22px}
/* In verticale: in colonna come in plancia, «Adesso» e poi la stazione; in
   fondo le ore e i giorni affiancati, le stesse due carte della colonna di
   destra del tablet orizzontale. */
${MURO}[data-verso="verticale"] .mu-mt.mu-mt-stazione{grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto;grid-template-areas:"adesso adesso" "stazione stazione" "ore giorni"}
${MURO}[data-verso="verticale"] .mu-mt-stazione .mu-mt-ore .mu-mt-fila{flex:1;align-items:center}
/* Il pannello piccolo: «Adesso» in colonna accanto a quattro tessere, le ore
   sotto. Restano la linea delle 24 ore e il numero; la riga sotto, la
   bussola e i giorni se ne vanno (i giorni li dice la minima e la massima di
   oggi, e la frase sulla pioggia). */
${MURO}[data-compatto="1"] .mu-mt.mu-mt-stazione{gap:8px;--dm-meteo-gap:6px;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);grid-template-rows:minmax(0,1fr) auto;grid-template-areas:"adesso stazione" "ore ore"}
${MURO}[data-compatto="1"][data-verso="verticale"] .mu-mt.mu-mt-stazione{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto;grid-template-areas:"adesso" "stazione" "ore"}
${MURO}[data-compatto="1"] .mu-mt-stazione .mu-mt-prossimi{display:none}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-adesso{grid-template-columns:minmax(0,1fr);gap:8px;padding:10px 12px;border-radius:16px;align-content:center}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-adesso-sx{gap:10px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-adesso-ic{font-size:40px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-adesso-gradi{gap:2px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-adesso-gradi>b{font-size:40px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-adesso-gradi>b i{font-size:24px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-adesso-cond{font-size:11px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-adesso-gradi small{font-size:10.5px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-adesso-dx{gap:6px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-frase{padding:6px 9px;gap:8px;border-radius:12px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-frase>span{font-size:16px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-frase strong{font-size:11.5px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-frase small{display:none}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-pills{gap:3px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-pill{font-size:9.5px;padding:2px 7px;gap:3px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-fonte{display:none}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-titolo{margin:0 0 4px 2px;font-size:10px;letter-spacing:1px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-titolo svg{width:15px;height:15px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-titolo small{display:none}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-tessere{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr))}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-tessera:nth-child(n+5){display:none}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-tessera{grid-template-rows:auto auto minmax(0,1fr);gap:1px;padding:6px 9px 4px;border-radius:14px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-larga{grid-column:auto;grid-template-columns:minmax(0,1fr)}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-larga>*{grid-column:1}
${MURO}[data-compatto="1"] .mu-mt-stazione :is(.dm-meteo-bussola,.dm-meteo-sotto,.dm-meteo-stato,.dm-meteo-24){display:none}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-ic{width:20px;height:20px;border-radius:7px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-ic svg{width:15px;height:15px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-tessera-testa{column-gap:6px;min-height:20px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-nome{font-size:9px;letter-spacing:.5px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-valore{margin-top:0;gap:4px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-valore b{font-size:22px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-valore i{font-size:10px}
${MURO}[data-compatto="1"] .mu-mt-stazione :is(.dm-meteo-grafico,.dm-meteo-spark){height:20px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-grafico{margin-top:2px}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-uv{padding:4px 0 0}
${MURO}[data-compatto="1"] .mu-mt-stazione .dm-meteo-uv-tacche{font-size:8px;margin-top:3px}
${MURO}[data-compatto="1"] .mu-mt-stazione .mu-mt-scheda{padding:8px 10px}
${MURO}[data-compatto="1"] .mu-mt-stazione .mu-mt-ore .mu-mt-ora:nth-child(n+7){display:flex}
${MURO}[data-compatto="1"] .mu-mt-stazione .mu-mt-ore .mu-mt-ora:nth-child(n+9){display:none}
${MURO}[data-compatto="1"] .mu-mt-stazione .mu-mt-ora{padding:4px 1px;gap:3px}
${MURO}[data-compatto="1"] .mu-mt-stazione .mu-mt-ora-segno{font-size:18px}
${MURO}[data-compatto="1"] .mu-mt-stazione .mu-mt-ora>b{font-size:16px}
${MURO}[data-compatto="1"] .mu-mt-stazione .mu-mt-ora>small{display:none}
${MURO}[data-compatto="1"] .mu-mt-stazione .mu-mt-scheda{gap:4px}
${MURO} .mu-anteprima{position:relative;width:1280px;height:800px;border-radius:18px;pointer-events:none;background:radial-gradient(120% 80% at 50% -10%,color-mix(in srgb,var(--card-bg) 70%,transparent),transparent 60%),var(--bg-sculpted)}
${MURO}.mu-anteprima[data-verso="verticale"]{width:800px;height:1280px}
${MURO}.mu-anteprima .mu-pagina{height:100%}
${MURO} .mu-g6.mu-scorre>*{scroll-snap-align:start}
/* Sul telefono i riquadri non si allungano a riempire lo schermo: «li trovo
   troppo grandi». Hanno un'altezza loro, e la pagina scorre se servono. */
${MURO}[data-compatto="1"][data-verso="verticale"] .mu-g6{grid-template-rows:none!important;grid-auto-rows:var(--mu-alto,150px)!important;align-content:start;overflow-y:auto;scrollbar-width:none}
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
/* La pastiglia del comando rapido: dice cosa fara', e col tasto in fondo. */
${MURO} .mu-col-rapido .mu-comandi{gap:8px}
/* Con la pastiglia la riga e' «− + pastiglia»: la modalita' la dice gia' la
 * pastiglia, e il suo tasto stretto fra i tondi la lasciava senza parole. */
${MURO} .mu-col-rapido .mu-modo,${MURO} .mu-col-rapido .mu-spazio{display:none}
${MURO} .mu-col-rapido .mu-comandi .mu-tondo{flex:0 0 auto}
${MURO} .mu-rapido{flex:1;min-width:0;height:52px;display:flex;align-items:center;gap:6px;padding:0 6px 0 12px;border-radius:999px;cursor:pointer;
  font:inherit;font-weight:800;font-size:14px;color:color-mix(in srgb,var(--acc) 70%,#0f172a);overflow:hidden;
  background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 7%,#fff),color-mix(in srgb,var(--acc) 15%,#fff));border:1px solid color-mix(in srgb,var(--acc) 35%,transparent)}
${MURO} .mu-rapido .mu-rap-lampo{flex:0 0 auto;font-size:15px}
${MURO} .mu-rapido .mu-rap-val{display:inline-flex;align-items:center;gap:3px;white-space:nowrap;min-width:0}
${MURO} .mu-rapido>i{flex:0 0 4px;width:4px;height:4px;border-radius:50%;background:color-mix(in srgb,var(--acc) 50%,transparent)}
${MURO} .mu-rapido .mu-rap-tasto{margin-left:auto;flex:0 0 40px;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;
  background:var(--acc);color:#fff;box-shadow:0 4px 10px -2px var(--acc)}
${MURO} .mu-rapido.acceso{background:linear-gradient(90deg,var(--acc),color-mix(in srgb,var(--acc) 75%,#0f172a));color:#fff;border-color:transparent}
${MURO} .mu-rapido.acceso>i{background:rgba(255,255,255,.6)}
${MURO} .mu-rapido.acceso .mu-rap-tasto{background:#fff;color:var(--acc)}
${MURO} .mu-col-rapido.mu-accesa{box-shadow:0 14px 32px -10px color-mix(in srgb,var(--acc) 45%,transparent),inset 0 0 0 2px color-mix(in srgb,var(--acc) 70%,transparent)}
${MURO} .mu-seg{display:flex;padding:6px;gap:6px;border-radius:20px;margin-top:auto;background:color-mix(in srgb,var(--text) 4%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 8%,transparent)}
${MURO} .mu-seg>button{flex:1;height:64px;border-radius:15px;display:flex;align-items:center;justify-content:center;gap:10px;font-weight:800;font-size:17px;color:var(--text-dim);text-align:center}
${MURO} .mu-seg>button.si{background:color-mix(in srgb,var(--acc) 16%,var(--card-bg));color:color-mix(in srgb,var(--acc) 80%,var(--text));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 45%,transparent),0 8px 18px -10px var(--acc)}
${MURO} .mu-btn{height:72px;border-radius:20px;display:flex;align-items:center;justify-content:center;gap:12px;font-weight:800;font-size:19px;background:color-mix(in srgb,var(--text) 5%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 10%,transparent)}
${MURO} .mu-varco,${MURO} .mu-comando,${MURO} .mu-clima-mini{display:flex;flex-direction:column;text-align:left}
${MURO} .mu-varco-tasto.pieno{color:#052e16}
${MURO} .mu-comando .mu-inter{margin-left:auto;pointer-events:none}
${MURO} .mu-mini-alto{display:flex;align-items:center;justify-content:space-between;gap:6px}
/* Il termostato a coppia: in cima il nome, la modalita' e l'interruttore;
 * sotto due righe, il caldo arancio e il freddo azzurro, ognuna col nome, il
 * numero e il suo meno e piu'. Le righe si dividono l'altezza che resta, e
 * dentro la griglia ogni misura segue la casella (vedi piu' giu'): sul 4
 * pollici i tasti calano, non escono. */
${MURO} .mu-card.mu-termostato{display:flex;flex-direction:column;text-align:left}
${MURO} .mu-ter-alto{display:flex;align-items:center;gap:10px;min-width:0;flex:none}
${MURO} .mu-ter-alto>.mu-nome{flex:1 1 auto;min-width:0}
${MURO} .mu-card.mu-termostato .mu-ter-alto .mu-n{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-card.mu-termostato .mu-ter-alto .mu-sotto{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-ter-alto>.mu-pasti{flex:none}
${MURO} .mu-ter-alto>.mu-ter-acceso{width:48px;height:48px;flex:none}
${MURO} .mu-ter-alto>.mu-ter-acceso svg{width:52%;height:52%}
${MURO} .mu-ter-righe{flex:1 1 auto;min-height:0;display:grid;grid-template-rows:repeat(2,minmax(0,1fr));gap:8px}
${MURO} .mu-est{display:flex;align-items:center;gap:10px;min-width:0;min-height:0;padding:4px 6px 4px 12px;border-radius:16px;
  background:color-mix(in srgb,var(--est) 10%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--est) 32%,transparent)}
${MURO} .mu-est-n{display:inline-flex;align-items:center;gap:6px;min-width:0;overflow:hidden;white-space:nowrap;color:var(--est);font-weight:800;font-size:13px;letter-spacing:.06em;text-transform:uppercase}
${MURO} .mu-est-s{width:18px;height:18px;flex:none}
${MURO} .mu-est-v{margin-left:auto;font-family:Oswald,Inter,sans-serif;font-weight:700;font-size:34px;line-height:1;color:var(--est);white-space:nowrap}
${MURO} .mu-est>.mu-est-t{width:48px;height:48px;font-size:24px;flex:none;color:var(--est)}
${MURO} .mu-est>.mu-est-t:disabled{opacity:.35;cursor:default}
/* Nella finestra le stesse due righe, grandi: si toccano col dito da lontano. */
${MURO} .mu-fin-ter{gap:14px}
${MURO} .mu-fin-ter .mu-est{height:92px;padding:0 12px 0 20px;border-radius:22px}
${MURO} .mu-fin-ter .mu-est-n{font-size:16px}
${MURO} .mu-fin-ter .mu-est-s{width:24px;height:24px}
${MURO} .mu-fin-ter .mu-est-v{font-size:60px}
${MURO} .mu-fin-ter .mu-est>.mu-est-t{width:68px;height:68px;font-size:30px}
${MURO}[data-compatto="1"] .mu-fin-ter .mu-est{height:64px}
${MURO}[data-compatto="1"] .mu-fin-ter .mu-est-v{font-size:40px}
${MURO}[data-compatto="1"] .mu-fin-ter .mu-est>.mu-est-t{width:52px;height:52px;font-size:24px}
${MURO} .mu-mini-t{font-family:Oswald,Inter,sans-serif;font-weight:700;font-size:30px;line-height:1;color:var(--acc);white-space:nowrap}
${MURO} .mu-mini-tasti{display:flex;gap:8px;margin-top:auto}
${MURO} .mu-mini-tasti .mu-tondo{flex:1;width:auto;height:40px;border-radius:12px;font-size:22px}
${MURO}[data-compatto="1"] .mu-varco-tasto{height:44px;font-size:16px;border-radius:14px}
${MURO}[data-compatto="1"] .mu-mini-t{font-size:26px}
${MURO}[data-compatto="1"] .mu-mini-tasti .mu-tondo{height:34px;font-size:20px}
${MURO}[data-compatto="1"] .mu-clima-mini{gap:6px}
${MURO} .mu-avviso-grande{position:absolute;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px;text-align:center;color:#fff;background:radial-gradient(circle at 50% 35%,#0e7490,#062a33 72%)}
${MURO} .mu-avviso-grande.grave{background:radial-gradient(circle at 50% 35%,#7f1d1d,#2a0a0a 72%)}
${MURO} .mu-avg-disco{width:150px;height:150px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.08);box-shadow:0 0 0 18px rgba(255,255,255,.08),0 0 60px rgba(255,255,255,.18);animation:muAvgBatte 1.6s ease-in-out infinite}
${MURO} .mu-avviso-grande.grave .mu-avg-disco{box-shadow:0 0 0 18px rgba(239,68,68,.25),0 0 60px rgba(239,68,68,.6)}
${MURO} .mu-avg-disco .dm-oggetto,${MURO} .mu-avg-disco svg{width:84px!important;height:84px!important}
${MURO} .mu-avg-et{font:700 16px Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;opacity:.8}
${MURO} .mu-avg-tit{font:700 56px/1.05 Oswald,Inter,sans-serif;max-width:90%}
${MURO} .mu-avg-tasti{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin-top:8px}
${MURO} .mu-avg-tasto{padding:18px 34px;border-radius:18px;border:1px solid rgba(255,255,255,.55);background:transparent;color:#fff;font:700 22px Inter,sans-serif}
${MURO} .mu-avg-tasto.pieno{background:#fff;color:#7f1d1d;border-color:#fff}
@keyframes muAvgBatte{50%{transform:scale(1.06)}}
/* ── lo squillo del campanello, come una chiamata ─────────────────────────
 * A tutto schermo sopra la pagina: in alto chi suona e da quanto, a sinistra
 * il video grande, a destra i tasti uno sopra l'altro. Sul pannello piccolo
 * il video sta in mezzo e i tasti in fila sotto. */
${MURO} .mu-squillo{position:absolute;inset:0;z-index:55;display:grid;grid-template-columns:minmax(0,1fr) 300px;grid-template-rows:auto minmax(0,1fr);gap:18px;padding:22px;
  background:radial-gradient(90% 70% at 30% 0%,color-mix(in srgb,var(--acc) 16%,transparent),transparent 70%),var(--bg-sculpted)}
${MURO} .mu-sq-testa{grid-column:1/-1;display:flex;align-items:center;gap:26px;padding:16px 22px 16px 34px;overflow:visible}
${MURO} .mu-sq-campana{position:relative;--c:64px}
${MURO} .mu-sq-campana svg,${MURO} .mu-sq-campana .dm-oggetto{width:36px!important;height:36px!important}
${MURO} .mu-sq-campana .onda{position:absolute;inset:0;border-radius:inherit;border:3px solid var(--acc);pointer-events:none;animation:muSqOnda 1.4s ease-out infinite}
${MURO} .mu-sq-campana .onda.o1{inset:-10px;border-radius:30px;opacity:.55}
${MURO} .mu-sq-campana .onda.o2{inset:-22px;border-radius:38px;opacity:.25;animation-delay:.35s}
@keyframes muSqOnda{0%{transform:scale(.92)}60%{transform:scale(1.04)}100%{transform:scale(.92)}}
${MURO} .mu-squillo.squilla .mu-sq-campana>svg,${MURO} .mu-squillo.squilla .mu-sq-campana>.dm-oggetto{animation:muSqDondola 1.2s ease-in-out infinite;transform-origin:50% 15%}
@keyframes muSqDondola{0%,100%{transform:rotate(0)}20%{transform:rotate(14deg)}40%{transform:rotate(-12deg)}60%{transform:rotate(7deg)}80%{transform:rotate(-4deg)}}
${MURO} .mu-sq-testa .mu-n{font-size:30px}
${MURO} .mu-sq-testa .mu-sotto{font-size:17px;margin-top:2px}
${MURO} .mu-sq-ora{margin-left:auto;text-align:right;flex:none}
${MURO} .mu-sq-ora .mu-osw{font-size:44px}
${MURO} .mu-sq-ora .mu-stato{display:block;margin-top:4px}
${MURO} .mu-sq-ora.finito .mu-osw,${MURO} .mu-sq-ora.finito .mu-stato{color:var(--text-dim)}
${MURO} .mu-sq-video{min-height:0;height:100%;border-radius:24px}
${MURO} .mu-sq-video .mu-live{display:flex;align-items:center;gap:7px;z-index:1}
${MURO} .mu-sq-video .mu-live i{width:9px;height:9px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 4px #ef444455}
${MURO} .mu-sq-video video.mu-sq-voce{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
${MURO} .mu-sq-avviso{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:2;max-width:90%;padding:10px 16px;border-radius:14px;background:#000b;color:#fff;font-size:14px;font-weight:800;text-align:center}
${MURO} .mu-sq-tasti{display:flex;flex-direction:column;gap:14px;min-height:0}
${MURO} .mu-sq-tasti .mu-btn{height:auto;flex:1 1 0;min-height:0;flex-direction:column;gap:6px;font-size:21px;border-radius:22px;text-align:center}
${MURO} .mu-sq-tasti .mu-btn svg{width:30px;height:30px;flex:none}
${MURO} .mu-sq-tasti .mu-btn small{font-size:12px;font-weight:700;opacity:.75}
${MURO} .mu-sq-tasti .mu-btn.grande{flex:1.6 1 0;font-size:26px}
${MURO} .mu-sq-tasti .mu-btn.grande svg{width:40px;height:40px}
${MURO} .mu-sq-tasti .mu-btn.rosso{color:#dc2626}
${MURO}[data-tema="dark"] .mu-sq-tasti .mu-btn.rosso{color:#f87171}
${MURO} .mu-sq-tasti .mu-sq-parla.si{--acc:#16a34a;color:#fff;background:linear-gradient(180deg,color-mix(in srgb,var(--acc) 90%,#fff),var(--acc))}
${MURO} .mu-sq-due{display:grid;grid-template-columns:1fr 1fr;gap:14px;flex:0 0 auto}
${MURO} .mu-sq-due .mu-btn{height:190px;flex:none;font-size:24px}
${MURO} .mu-sq-due .mu-btn svg{width:36px;height:36px}
${MURO} .mu-sq-due>:last-child:nth-child(odd){grid-column:1/-1}
${MURO} .mu-sq-due:has(>:nth-child(3)) .mu-btn{height:120px}
${MURO} .mu-sq-storia{flex:1 1 auto;min-height:0;padding:16px;display:flex;flex-direction:column;gap:10px}
${MURO} .mu-sq-storia>.mu-stato{color:var(--text-dim)}
${MURO} .mu-sq-righe{flex:1;display:flex;flex-direction:column;justify-content:space-around;gap:10px;min-height:0}
${MURO} .mu-sq-squillo{display:flex;align-items:center;gap:12px;min-width:0}
${MURO} .mu-sq-squillo>img,${MURO} .mu-sq-squillo>.mu-sq-senza{width:120px;height:72px;border-radius:10px;object-fit:cover;flex:none;box-shadow:0 0 0 1px color-mix(in srgb,var(--text) 14%,transparent)}
${MURO} .mu-sq-senza{display:grid;place-items:center;background:color-mix(in srgb,var(--text) 6%,var(--card-bg))}
${MURO} .mu-sq-squillo b{display:block;font-size:18px;font-weight:800;font-variant-numeric:tabular-nums}
${MURO} .mu-sq-squillo small{display:block;font-size:13px;font-weight:700;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-sq-squillo.ora b{color:#2563eb}
${MURO}[data-tema="dark"] .mu-sq-squillo.ora b{color:#60a5fa}
${MURO}:not([data-compatto="1"]) .mu-sq-mini{display:none}
${MURO}[data-compatto="1"] .mu-squillo{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr) auto;gap:10px;padding:12px}
${MURO}[data-compatto="1"] .mu-sq-testa{padding:10px 12px 10px 24px;gap:20px;border-radius:18px}
${MURO}[data-compatto="1"] .mu-sq-campana{--c:44px}
${MURO}[data-compatto="1"] .mu-sq-campana svg,${MURO}[data-compatto="1"] .mu-sq-campana .dm-oggetto{width:26px!important;height:26px!important}
${MURO}[data-compatto="1"] .mu-sq-campana .onda.o1{inset:-6px;border-radius:22px}
${MURO}[data-compatto="1"] .mu-sq-campana .onda.o2{inset:-12px;border-radius:26px}
${MURO}[data-compatto="1"] .mu-sq-testa .mu-n{font-size:19px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO}[data-compatto="1"] .mu-sq-testa .mu-sotto{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO}[data-compatto="1"] .mu-sq-ora .mu-osw{font-size:26px}
${MURO}[data-compatto="1"] .mu-sq-ora .mu-stato{display:none}
${MURO}[data-compatto="1"] .mu-sq-video{border-radius:16px}
${MURO}[data-compatto="1"] .mu-sq-tasti{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:8px}
${MURO}[data-compatto="1"] .mu-sq-tasti .mu-btn{height:76px;font-size:14px;gap:4px;border-radius:16px;padding:0 4px}
${MURO}[data-compatto="1"] .mu-sq-tasti .mu-btn svg,${MURO}[data-compatto="1"] .mu-sq-tasti .mu-btn.grande svg{width:24px;height:24px}
${MURO}[data-compatto="1"] .mu-sq-tasti .mu-btn small{display:none}
${MURO}[data-compatto="1"] .mu-sq-tasti .mu-btn.grande{font-size:15px}
${MURO}[data-compatto="1"] .mu-sq-tasti.dopo{display:block}
${MURO}[data-compatto="1"] .mu-sq-tasti.dopo .mu-sq-due{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);grid-template-columns:none;gap:8px}
${MURO}[data-compatto="1"] .mu-sq-tasti.dopo .mu-btn{height:64px;flex-direction:row;font-size:17px;gap:8px}
${MURO}[data-compatto="1"] .mu-sq-due>:last-child:nth-child(odd){grid-column:auto}
${MURO}[data-compatto="1"] .mu-sq-tasti.dopo .mu-sq-storia{display:none}
${MURO}[data-compatto="1"] .mu-sq-mini{position:absolute;right:8px;bottom:8px;display:flex;gap:6px;z-index:1}
${MURO}[data-compatto="1"] .mu-sq-mini span{display:grid;justify-items:center;gap:2px;padding:3px;border-radius:9px;background:#000a;color:#fff;font:800 10px Inter,sans-serif}
${MURO}[data-compatto="1"] .mu-sq-mini img,${MURO}[data-compatto="1"] .mu-sq-mini .mu-sq-senza{position:static;width:52px;height:32px;border-radius:6px;object-fit:cover}
@media (prefers-reduced-motion:reduce){${MURO} .mu-sq-campana .onda,${MURO} .mu-squillo.squilla .mu-sq-campana>svg{animation:none}}
${MURO}[data-compatto="1"] .mu-avviso-grande{gap:10px;padding:14px}
/* La pillola di chi ha acceso lo schermo: due secondi, in alto al centro
 * sotto la testa (mettiLaPillola), sopra le card ma sotto gli avvisi
 * grandi. */
${MURO} .mu-luce-pillola{position:absolute;left:50%;top:16px;z-index:40;transform:translateX(-50%);display:flex;align-items:center;gap:10px;max-width:calc(100% - 32px);padding:9px 18px;border-radius:999px;font-weight:700;font-size:16px;color:#bbf7d0;background:rgba(5,46,26,.94);box-shadow:inset 0 0 0 1px rgba(34,197,94,.45),0 10px 30px rgba(0,0,0,.28),0 2px 8px rgba(0,0,0,.18);pointer-events:none;animation:muLucePillola .25s ease-out}
${MURO} .mu-luce-pillola span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${MURO} .mu-luce-pillola i{flex:none;width:9px;height:9px;border-radius:50%;background:#22c55e}
${MURO}[data-compatto="1"] .mu-luce-pillola{font-size:13px;padding:7px 12px}
@keyframes muLucePillola{from{opacity:0;transform:translate(-50%,-8px)}}
${MURO}[data-compatto="1"] .mu-avg-disco{width:92px;height:92px;box-shadow:0 0 0 10px rgba(255,255,255,.08)}
${MURO}[data-compatto="1"] .mu-avg-disco .dm-oggetto,${MURO}[data-compatto="1"] .mu-avg-disco svg{width:54px!important;height:54px!important}
${MURO}[data-compatto="1"] .mu-avg-tit{font-size:30px}
${MURO}[data-compatto="1"] .mu-avg-et{font-size:13px}
${MURO}[data-compatto="1"] .mu-avg-tasto{padding:12px 20px;font-size:16px;border-radius:14px}
${MURO} .mu-btn.pieno{--acc:#0ea5e9;background:linear-gradient(180deg,color-mix(in srgb,var(--acc) 90%,#fff),var(--acc));color:#fff;box-shadow:0 12px 26px -10px var(--acc),inset 0 1px 0 rgba(255,255,255,.3)}
${MURO} .mu-due{display:grid;grid-template-columns:1fr 1fr;gap:12px}
${MURO} .mu-ingresso{display:grid;grid-template-columns:1fr 1.1fr;grid-template-rows:1fr auto;gap:16px;min-height:0}
${MURO} .mu-allarme{padding:24px;display:flex;flex-direction:column;gap:18px}
${MURO} .mu-allarme-letture{margin-top:auto;min-height:0;overflow:auto;scrollbar-width:none}
${MURO} .mu-allarme-letture .mu-ing-letture{display:flex;flex-wrap:wrap;gap:8px}
${MURO} .mu-allarme-letture .mu-ing-lettura{white-space:nowrap}
${MURO} .mu-ing-striscia .mu-ing-comandi:first-child{margin-left:0;padding-left:0;border-left:0}
${MURO} .mu-stato-allarme{font-size:52px;color:var(--acc);margin-top:6px}
${MURO} .mu-avviso-finestre{display:flex;align-items:center;gap:8px;margin-top:8px}
${MURO} .mu-modi{--acc:#e11d48}
${MURO} .mu-nota{font-size:10.5px;text-align:center}
/* Piu' aree: la card dell'antifurto si fa elenco. In cima le aree tutte
 * insieme, sotto una riga per area — il nome e lo stato a sinistra, i tasti a
 * destra — e le righe si dividono l'altezza che c'e'. Da una a quattro ci
 * stanno senza scorrere; oltre, l'elenco scorre. */
${MURO} .mu-allarme-aree{padding:18px 20px;gap:12px;min-height:0}
${MURO} .mu-allarme-aree .mu-riga1{gap:14px}
${MURO} .mu-allarme-aree .mu-stato-allarme{font-size:34px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-allarme-dice{min-width:0;flex:1}
${MURO} .mu-allarme-aree .mu-avviso-finestre{margin-top:4px}
${MURO} .mu-aree{display:flex;flex-direction:column;gap:8px;min-height:0;flex:1 1 auto;overflow-y:auto;scrollbar-width:none}
${MURO} .mu-area{display:flex;align-items:center;gap:12px;padding:8px 8px 8px 16px;border-radius:18px;flex:0 0 auto;
  background:color-mix(in srgb,var(--acc) 7%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 26%,transparent)}
${MURO} .mu-area.grave{background:color-mix(in srgb,var(--acc) 18%,var(--card-bg));box-shadow:inset 0 0 0 2px var(--acc),0 0 24px -8px var(--acc)}
${MURO} .mu-area-dice{display:flex;flex-direction:column;gap:3px;min-width:0;flex:0 1 30%}
${MURO} .mu-area-nome{font-size:18px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-area-stato{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:color-mix(in srgb,var(--acc) 85%,var(--text));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-area-stato i{flex:0 0 9px;width:9px;height:9px;border-radius:50%;background:var(--acc);box-shadow:0 0 0 3px color-mix(in srgb,var(--acc) 22%,transparent)}
${MURO} .mu-area.grave .mu-area-stato i{animation:mu-batti 1s ease-in-out infinite}
@keyframes mu-batti{50%{transform:scale(1.5);opacity:.6}}
${MURO} .mu-modi-area{flex:1 1 auto;margin:0;padding:4px;gap:4px;border-radius:14px;min-width:0}
${MURO} .mu-modi-area>button{height:46px;border-radius:11px;font-size:15px;padding:0 6px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-modi-miei{flex:0 0 auto}
${MURO} .mu-aree[data-quante="2"] .mu-area{padding-top:12px;padding-bottom:12px}
${MURO} .mu-aree[data-quante="2"] .mu-modi-area>button{height:56px;font-size:16px}
${MURO} .mu-aree[data-quante="4"]{gap:6px}
${MURO} .mu-aree[data-quante="4"] .mu-area{padding-top:5px;padding-bottom:5px}
${MURO} .mu-aree[data-quante="4"] .mu-modi-area>button{height:40px;font-size:14px}
${MURO} .mu-aree[data-quante="4"] .mu-area-nome{font-size:16px}
/* Le letture e i comandi dell'ingresso: le pastiglie della Musica. */
${MURO} .mu-ing-altro{display:flex;flex-direction:column;gap:8px;flex:0 0 auto;min-width:0}
${MURO} .mu-ing-letture,${MURO} .mu-ing-comandi{display:flex;flex-wrap:wrap;gap:8px}
${MURO} .mu-ingresso.mu-con-striscia{grid-template-rows:minmax(0,1fr) auto auto}
${MURO} .mu-ing-striscia{grid-column:1/-1;padding:10px 12px;min-width:0}
${MURO} .mu-ing-striscia .mu-ing-altro{flex-direction:row;align-items:center;gap:8px;overflow-x:auto;scrollbar-width:none}
${MURO} .mu-ing-striscia .mu-ing-letture,${MURO} .mu-ing-striscia .mu-ing-comandi{flex-wrap:nowrap;flex:0 0 auto}
${MURO} .mu-ing-striscia .mu-ing-comandi{margin-left:auto;padding-left:12px;border-left:1px solid color-mix(in srgb,var(--text) 10%,transparent)}
${MURO} .mu-ing-striscia .mu-ing-lettura,${MURO} .mu-ing-striscia .mu-ing-comando{white-space:nowrap}
${MURO} .mu-con-striscia .mu-piede .mu-card{padding:12px 20px}
${MURO} .mu-con-striscia .mu-piede .mu-tessera .mu-osw{font-size:34px}
${MURO} .mu-con-striscia .mu-piede .mu-chip{--c:44px!important}
${MURO} .mu-ing-lettura{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:999px;font-weight:700;font-size:14px;color:var(--text-dim);background:color-mix(in srgb,var(--text) 4%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 9%,transparent)}
${MURO} .mu-ing-lettura b{margin-left:2px;font-weight:900;color:var(--text);font-variant-numeric:tabular-nums}
${MURO} .mu-ing-lettura .dm-oggetto{margin:-4px 0}
${MURO} .mu-ing-lettura.guarda{color:color-mix(in srgb,#f59e0b 80%,var(--text));background:color-mix(in srgb,#f59e0b 13%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,#f59e0b 50%,transparent)}
${MURO} .mu-ing-lettura.guarda b{color:inherit}
${MURO} .mu-ing-lettura.tutto-bene b{color:#10b981}
${MURO} .mu-ing-comando{padding:10px 16px;border-radius:999px;font-weight:800;font-size:14px;color:var(--text-dim);background:color-mix(in srgb,var(--text) 6%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 11%,transparent)}
${MURO} .mu-ing-comando small{margin-left:4px;font-weight:700;opacity:.75}
${MURO} .mu-ing-comando.si{--acc:#0ea5e9;color:color-mix(in srgb,var(--acc) 85%,var(--text));background:color-mix(in srgb,var(--acc) 16%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 45%,transparent)}
${MURO} .mu-ing-comando:disabled{opacity:.45}
${MURO} .mu-ing-righe{display:flex;flex-direction:column;gap:8px;max-height:52vh;overflow-y:auto}
${MURO} .mu-ing-riga{--acc:#10b981;display:flex;align-items:center;gap:14px;padding:12px 14px;border-radius:16px;background:color-mix(in srgb,var(--text) 4%,var(--card-bg))}
${MURO} .mu-ing-riga.guarda{--acc:#f59e0b;background:color-mix(in srgb,var(--acc) 12%,var(--card-bg))}
${MURO} .mu-ing-riga>i{flex:0 0 12px;width:12px;height:12px;border-radius:50%;background:var(--acc)}
${MURO} .mu-ing-riga>b{font-size:17px;font-weight:900;color:color-mix(in srgb,var(--acc) 80%,var(--text))}
${MURO} .mu-ing-riga .mu-btn{height:48px;padding:0 18px;font-size:16px;border-radius:14px}
${MURO} .mu-fin-aree .mu-aree{overflow:visible}
${MURO} .mu-finestra{max-height:94%;overflow-y:auto;scrollbar-width:none}
${MURO} .mu-fin-aree{display:flex;flex-direction:column;gap:12px}
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
${MURO} .mu-voci{flex-wrap:wrap}
${MURO} .mu-cp{display:flex;flex-direction:column;gap:10px}
${MURO} .mu-cp-nome{text-transform:uppercase;letter-spacing:.02em}
${MURO} .mu-cp-stato{margin-left:auto}
${MURO} .mu-cp-ora{display:flex;align-items:baseline;gap:14px;margin-top:4px}
${MURO} .mu-cp-n{font-size:clamp(44px,5.4vw,72px);font-weight:800;line-height:1;letter-spacing:-.03em;color:color-mix(in srgb,var(--text) 70%,var(--acc))}
${MURO} .mu-accesa .mu-cp-n{color:var(--acc)}
${MURO} .mu-cp-n sup{font-size:.45em;vertical-align:top;margin-left:2px}
${MURO} .mu-cp-ora .mu-et{font-size:13px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:var(--text-dim,#64748b)}
${MURO} .mu-cp-scala{position:relative;height:28px;margin:4px 12px 0}
${MURO} .mu-cp-riga{position:absolute;left:0;right:0;top:50%;height:10px;margin-top:-5px;border-radius:99px;background:color-mix(in srgb,var(--text) 10%,transparent);overflow:hidden}
${MURO} .mu-cp-riga i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 30%,transparent),var(--acc))}
${MURO} :not(.mu-accesa).mu-cp .mu-cp-riga i{background:linear-gradient(90deg,color-mix(in srgb,var(--text) 18%,transparent),color-mix(in srgb,var(--text) 45%,transparent))}
${MURO} .mu-cp-segno{position:absolute;top:2px;bottom:2px;width:4px;margin-left:-2px;border-radius:2px;background:var(--text)}
${MURO} .mu-cp-pallino{position:absolute;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:var(--card-bg,#fff);border:4px solid color-mix(in srgb,var(--text) 45%,transparent);box-shadow:0 2px 8px rgba(0,0,0,.18)}
${MURO} .mu-accesa .mu-cp-pallino{border-color:var(--acc)}
${MURO} .mu-cp-sotto{display:flex;justify-content:space-between;align-items:baseline;font-size:14px;font-weight:800;color:var(--text-dim,#64748b)}
${MURO} .mu-cp-target{font-size:17px;font-weight:700}
${MURO} .mu-cp-target b{color:var(--text);font-weight:900}
${MURO} .mu-cp .mu-comandi{margin-top:auto}
${MURO} .mu-cp-modo{text-transform:uppercase;letter-spacing:.04em}
${MURO} .mu-card.mu-cp .mu-rapido{flex:0 0 auto;width:auto;padding:0 4px;gap:0}
${MURO} .mu-cp .mu-rap-val,${MURO} .mu-cp .mu-rap-lampo,${MURO} .mu-cp .mu-rapido>i{display:none}
${MURO} .mu-cp-mini{gap:4px;padding:10px 12px}
${MURO} .mu-cp-testa{display:flex;align-items:center;gap:6px;min-width:0}
${MURO} .mu-cp-mini .mu-cp-nome{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:900}
${MURO} .mu-cp-mini .mu-cp-stato{flex:0 0 auto;font-size:10px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:var(--acc)}
${MURO} :not(.mu-accesa).mu-cp-mini .mu-cp-stato{color:var(--text-dim,#64748b)}
${MURO} .mu-cp-mini .mu-cp-ora{margin:0;gap:6px;align-items:center}
${MURO} .mu-cp-mini .mu-cp-n{font-size:30px}
${MURO} .mu-card.mu-cp-mini .mu-cp-ora .mu-tondo{flex:0 0 auto;width:34px;height:34px;min-width:0;min-height:0;font-size:18px}
${MURO} .mu-cp-mini .mu-cp-scala{height:20px;margin:0 9px}
${MURO} .mu-cp-mini .mu-cp-riga{height:7px;margin-top:-3.5px}
${MURO} .mu-cp-mini .mu-cp-pallino{width:18px;height:18px;margin:-9px 0 0 -9px;border-width:3px}
${MURO} .mu-cp-mini .mu-cp-sotto{justify-content:center}
${MURO} .mu-cp-mini .mu-cp-target{font-size:13px}
${MURO} .mu-voci>button{flex:1 1 140px}
${MURO} .mu-fin-temp{display:flex;align-items:center;justify-content:center;gap:40px}
${MURO} .mu-fin-conferma{text-align:center;align-items:center}
${MURO} .mu-fin-conferma .mu-due{width:100%}
${MURO} .mu-puntini{font-size:30px;letter-spacing:.3em;margin-top:6px;min-height:36px}
${MURO} .mu-tasti{display:grid;grid-template-columns:repeat(3,96px);gap:16px;justify-content:center}
${MURO} .mu-tasti .mu-tondo{width:96px;height:96px;font-size:32px;font-weight:700}
${MURO} .mu-riposo{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#05080f;color:#dbe4f3}
${MURO} .mu-riposo.notte{background:#000}
/* Di notte, con lo schermo tenuto acceso dal campanello: lo stesso riposo,
 * fioco. La luce dello schermo la abbassa l'app; questo vale anche fuori. */
${MURO} .mu-riposo.fioco{background:#000}
${MURO} .mu-riposo.fioco>*{filter:brightness(.55)}
${MURO} .mu-deriva{position:absolute;left:50%;top:50%;transform:translate(calc(-50% + var(--sx,0px)),calc(-50% + var(--sy,0px)));display:flex;flex-direction:column;align-items:center;gap:14px;width:max-content;max-width:96%;animation:mu-appari 1.8s ease both}
@keyframes mu-appari{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){${MURO} .mu-deriva{animation:none}}
${MURO} .mu-deriva .mu-avvisi{position:static;padding:0;margin-bottom:10px}
${MURO} .mu-deriva .mu-tocca{position:static;margin-top:14px}
${MURO} .mu-riposo-riga .mu-attenzione{color:#fbbf24}
${MURO} .mu-orologione{font-size:240px;line-height:.9}
${MURO} .mu-data{font-size:18px;letter-spacing:.2em;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px 18px}
${MURO} .mu-pila{display:inline-flex;align-items:center;gap:7px;letter-spacing:.04em;color:#92a4c2;font-variant-numeric:tabular-nums}
${MURO} .mu-pila b{font-weight:800}
${MURO} .mu-pila-g{flex:none;display:block}
${MURO} .mu-pila-pieno{fill:currentColor;opacity:.85}
${MURO} .mu-pila-fulmine{fill:#fde68a;stroke:#05080f;stroke-width:.9;stroke-linejoin:round}
${MURO} .mu-pila.carica{color:#6ee7b7}
${MURO} .mu-pila.bassa{color:#fbbf24}
${MURO} .mu-riposo-riga{display:flex;flex-wrap:wrap;justify-content:center;gap:16px 40px;margin-top:22px;color:#92a4c2;font-weight:700;font-size:20px}
${MURO} .mu-riposo-riga span{display:flex;align-items:center;gap:10px}
${MURO} .mu-tocca{position:absolute;bottom:28px;opacity:.6}
${MURO} .mu-riposo-aree{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;max-width:90%;margin-top:14px;color:#92a4c2;font-weight:700;font-size:20px;text-align:center}
${MURO} .mu-riposo-aree b{color:#dbe4f3;font-weight:800}
${MURO} .mu-riposo-aree .grave,${MURO} .mu-riposo-aree .grave b{color:#fda4af}
${MURO} .mu-riposo-aree i{font-style:normal;opacity:.6}
${MURO} .mu-riposo-consiglio{display:flex;align-items:center;gap:12px;max-width:min(860px,90%);margin-top:18px;padding:10px 20px;border-radius:999px;
  background:rgba(139,92,246,.14);border:1px solid rgba(167,139,250,.32);color:#e4dcff;font-weight:750;font-size:20px;line-height:1.3}
${MURO} .mu-riposo-consiglio span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${MURO} .mu-riposo-consiglio i{flex:none;width:11px;height:11px;border-radius:50%;background:#60a5fa;box-shadow:0 0 0 4px rgba(96,165,250,.22)}
${MURO} .mu-riposo-consiglio[data-urgenza="oggi"] i{background:#fbbf24;box-shadow:0 0 0 4px rgba(251,191,36,.22)}
${MURO} .mu-riposo-consiglio[data-urgenza="urgente"]{background:rgba(220,38,38,.18);border-color:rgba(248,113,113,.45);color:#fecaca}
${MURO} .mu-riposo-consiglio[data-urgenza="urgente"] i{background:#f87171;box-shadow:0 0 0 4px rgba(248,113,113,.25)}
${MURO}[data-compatto="1"] .mu-riposo-consiglio{font-size:15px;padding:7px 14px;margin-top:12px}
${MURO}[data-compatto="1"] .mu-riposo-aree{font-size:15px;gap:6px}
${MURO} .mu-avvisi{position:absolute;top:28px;left:0;right:0;display:flex;justify-content:center;gap:12px;flex-wrap:wrap;padding:0 20px}
${MURO} .mu-avviso{display:flex;align-items:center;gap:12px;padding:12px 20px 12px 12px;border-radius:999px;font-size:16px}
${MURO} .mu-avviso.grave b{color:#fda4af}
${MURO}[data-compatto="1"] .mu-pagina{padding:10px;gap:10px;grid-template-rows:auto 1fr}
${MURO}[data-compatto="1"] .mu-pag-clima{grid-template-rows:auto auto 1fr}
${MURO}[data-compatto="1"] .mu-zone{padding:3px;gap:4px;border-radius:14px}
${MURO}[data-compatto="1"] .mu-zone button{padding:5px 12px;font-size:14px;gap:8px;border-radius:11px}
${MURO}[data-compatto="1"] .mu-zone .dm-oggetto{width:18px!important;height:18px!important}
${MURO}[data-compatto="1"] .mu-testa{padding:10px 14px;gap:10px;flex-wrap:nowrap}
${MURO}[data-compatto="1"] .mu-tit{font-size:26px;max-width:150px}
${MURO}[data-compatto="1"] .mu-tit.mu-tit-l{font-size:21px;max-width:190px}
${MURO}[data-compatto="1"] .mu-tit.mu-tit-xl{font-size:17px;max-width:200px}
${MURO}[data-compatto="1"] .mu-sot,${MURO}[data-compatto="1"] .mu-meteo,${MURO}[data-compatto="1"] .mu-sep,${MURO}[data-compatto="1"] .mu-pillole,${MURO}[data-compatto="1"] .mu-d{display:none}
${MURO}[data-compatto="1"] .mu-h{font-size:32px}
${MURO}[data-compatto="1"] .mu-pagine{order:0;width:auto;margin:0 0 0 auto;padding:3px;gap:3px}
${MURO}[data-compatto="1"] .mu-pagine button{padding:8px;flex:none}
${MURO}[data-compatto="1"] .mu-ora{margin-left:10px}
/* L'ora sul telefono: l'uscita dal pannello e' il dito tenuto sull'orologio,
   ma qui dell'orologio restano solo le cifre — il meteo, la data e la riga
   accanto sono nascosti — e le cifre sono una striscia alta una trentina di
   pixel. Sul tablet il dito trova l'ora col meteo e la data: un bersaglio
   grande. Sul telefono il dito si posa quasi sempre un poco sotto quello che
   guarda, finiva sul bordo della testa, e due secondi tenuti li' non aprivano
   niente: «se clicco su ora non si attiva il config». Il bersaglio si allarga
   tutto intorno alle cifre, senza spostarle: un velo trasparente che
   appartiene all'orologio, e che a sinistra si ferma prima delle linguette. */
${MURO}[data-compatto="1"] .mu-ora{position:relative}
${MURO}[data-compatto="1"] .mu-ora::after{content:"";position:absolute;inset:-12px -14px -14px -8px}
${MURO}[data-compatto="1"][data-verso="verticale"] .mu-ora::after{left:-28px}
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
${MURO}[data-compatto="1"] .mu-pila-g{width:28px;height:15px}
${MURO}[data-compatto="1"] .mu-riposo-riga{flex-direction:column;gap:10px;align-items:center;font-size:15px}
${MURO}[data-compatto="1"] .mu-avviso{font-size:13px}
${MURO}[data-verso="verticale"] .mu-testa{flex-wrap:wrap}
${MURO}[data-verso="verticale"] .mu-pagine{order:3;width:100%;margin:6px 0 4px}
${MURO}[data-verso="verticale"] .mu-pagine button{flex:1;justify-content:center}
${MURO}[data-verso="verticale"] .mu-meteo,${MURO}[data-verso="verticale"] .mu-sep{display:none}
${MURO}[data-verso="verticale"] .mu-ora{margin-left:auto}
${MURO}[data-verso="verticale"] .mu-ingresso{grid-template-columns:1fr;grid-template-rows:auto 1fr auto}
${MURO}[data-verso="verticale"] .mu-ingresso.mu-con-striscia{grid-template-rows:auto minmax(0,1fr) auto auto}
${MURO}[data-verso="verticale"] .mu-piede{grid-template-columns:1fr 1fr}
${MURO}[data-verso="verticale"] .mu-fin-luce{grid-template-columns:1fr}
${MURO}[data-verso="verticale"] .mu-colonna{height:300px}
${MURO}[data-verso="verticale"] .mu-orologione{font-size:180px}
${MURO}[data-verso="verticale"] .mu-riposo-riga{flex-direction:column;gap:14px;align-items:center}
/* ── La famiglia dei posti, e i posti che si misurano da soli ─────────────
 *
 * «Schermi piccoli e griglia 3x3: le scritte sotto sono tagliate», «anche
 * quando resta in 4x3 in questo widget la parte sotto e' tagliata». Le misure
 * delle card erano scritte per il tablet da 1280x800 con la griglia di sei:
 * nella griglia di dodici, o di nove sul pannello piccolo (dove l'altezza
 * vera e' 420 pixel, la testa compresa), la casella e' alta meno della somma
 * di disegno, nome, stato e tasti, e l'ultima riga finiva sotto il bordo.
 *
 * Ora ogni posto della griglia e' un contenitore (\`container-type:size\`): la
 * sua altezza e la sua larghezza le decide la griglia, e quello che c'e'
 * dentro si misura su di loro (\`cqh\`, \`cqw\`, \`@container\`). Il disegno e il
 * nome crescono e calano con la casella, fino alle misure di prima; quando lo
 * spazio non basta se ne vanno prima le righe di contorno — la riga scelta
 * sotto il nome, l'umidita', la barra della luminosita', i tasti delle
 * tapparelle (che restano nella finestra, col tocco) — e mai il nome o lo
 * stato. Nel pannello verticale piccolo le righe hanno un'altezza fissa
 * (\`--mu-alto\`), cosi' anche li' il posto non dipende da quello che contiene.
 *
 * La famiglia (\`mu-fam\`): la forma della tessera — «il nome grande sotto».
 * Il disegno in alto a sinistra con lo stato piccolo accanto, il comando in
 * alto a destra (l'interruttore, la parola del gesto, il tasto del
 * cancello), il nome grande in fondo, sotto la sua riga se c'e'. */
${MURO} .mu-g6>.mu-card{container-type:size}
${MURO} .mu-card.mu-fam{display:flex;flex-direction:column;gap:0;text-align:left}
${MURO} .mu-card.mu-fam .mu-riga1{flex-wrap:nowrap;align-items:center;gap:12px;width:100%;min-width:0}
${MURO} .mu-card.mu-fam .mu-riga1>.mu-stato,${MURO} .mu-card.mu-fam .mu-riga1>.mu-et{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${MURO} .mu-card.mu-fam .mu-riga1>.mu-inter,${MURO} .mu-card.mu-fam .mu-riga1>.mu-verbo,${MURO} .mu-card.mu-fam .mu-riga1>.mu-varco-tasto,${MURO} .mu-card.mu-fam .mu-riga1>.mu-pasti{margin-left:auto;flex:none}
${MURO} .mu-card.mu-fam .mu-riga1>.mu-inter{display:block}
${MURO} .mu-card.mu-fam .mu-fam-nome.mu-osw{margin-top:auto;padding-top:8px;min-width:0;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.15;display:block;-webkit-line-clamp:unset;font-weight:500}
${MURO} .mu-card.mu-fam>.mu-sotto{margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
${MURO} .mu-card.mu-fam>.mu-sotto:empty{display:none}
${MURO} .mu-card.mu-fam>.mu-giu{margin-top:12px}
${MURO} .mu-card.mu-fam>.mu-giu .mu-giu-et{margin-bottom:4px;align-items:center}
${MURO} .mu-card.mu-fam>.mu-bar{margin-top:12px;flex:none}
${MURO} .mu-card.mu-fam>.mu-seg{margin-top:12px}
${MURO} .mu-verbo{display:inline-flex;align-items:center;height:40px;padding:0 16px;border-radius:999px;font-weight:800;font-size:15px;white-space:nowrap;
  background:color-mix(in srgb,var(--text) 5%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 12%,transparent)}
${MURO} .mu-card.mu-fam .mu-riga1>.mu-varco-tasto{width:auto;height:48px;padding:0 22px;border-radius:16px;font-size:17px}
${MURO} .mu-fam-fondo{margin-top:auto;display:flex;align-items:flex-end;gap:10px;min-width:0}
${MURO} .mu-fam-fondo>.mu-fam-nome.mu-osw{margin-top:0;flex:1 1 auto}
${MURO} .mu-card.mu-fam .mu-fam-fondo>.mu-target{margin-top:0;flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-wrap:nowrap}
${MURO} .mu-fam-fondo .mu-grande{white-space:nowrap}
${MURO} .mu-t-alto{display:none;margin-left:auto;flex:none;font-family:Oswald,Inter,sans-serif;font-weight:700;line-height:1;color:var(--acc);white-space:nowrap}
${MURO} .mu-clima-mini .mu-mini-alto{justify-content:flex-start;gap:8px;min-width:0}
${MURO} .mu-clima-mini .mu-mini-alto>.mu-nome{flex:1 1 auto;min-width:0}
${MURO} .mu-card.mu-clima-mini .mu-mini-alto .mu-n{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-clima-mini .mu-sotto{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Le misure che seguono la casella: solo dentro la griglia, dove la casella
 * ha un'altezza sua. */
${MURO} .mu-g6>.mu-card.mu-fam .mu-riga1{gap:clamp(6px,4cqw,14px)}
${MURO} .mu-g6>.mu-card.mu-fam .mu-riga1>.mu-chip,${MURO} .mu-g6>.mu-card.mu-fam .mu-riga1>.mu-disco{--fam-c:clamp(28px,min(32cqh,24cqw),var(--c,70px));width:var(--fam-c);height:var(--fam-c);border-radius:calc(var(--fam-c)*.36)}
${MURO} .mu-g6>.mu-card.mu-fam .mu-riga1>.mu-disco{border-radius:50%}
${MURO} .mu-g6>.mu-card.mu-fam .mu-riga1>.mu-chip>*,${MURO} .mu-g6>.mu-card.mu-fam .mu-riga1>.mu-disco>svg{width:58%!important;height:58%!important}
${MURO} .mu-g6>.mu-card.mu-fam .mu-riga1>.mu-chip>span{display:block}
${MURO} .mu-g6>.mu-card.mu-fam .mu-riga1>.mu-chip>span>svg{display:block;width:100%;height:100%}
${MURO} .mu-g6>.mu-card.mu-fam .mu-fam-nome.mu-osw{--fam-n:38px;font-size:clamp(16px,min(26cqh,12cqw),var(--fam-n))}
${MURO} .mu-g6>.mu-card.mu-tessera.grande .mu-fam-nome.mu-osw{--fam-n:46px}
${MURO} .mu-g6>.mu-card.mu-fam .mu-fam-fondo .mu-grande{font-size:clamp(18px,min(26cqh,13cqw),66px)}
${MURO} .mu-g6>.mu-card.mu-fam .mu-riga1>.mu-varco-tasto,${MURO} .mu-g6>.mu-card.mu-fam .mu-riga1>.mu-verbo{height:clamp(30px,min(30cqh,48px),48px);font-size:clamp(13px,8cqh,17px);padding:0 clamp(10px,5cqw,22px)}
${MURO} .mu-g6>.mu-card.mu-fam>.mu-seg>button{height:clamp(40px,22cqh,64px)}
${MURO} .mu-g6>.mu-dato .mu-dato-v{font-size:clamp(20px,min(40cqh,22cqw),96px)}
${MURO} .mu-g6>.mu-card .mu-comandi .mu-tondo{width:clamp(34px,min(26cqh,18cqw),68px);height:clamp(34px,min(26cqh,18cqw),68px);font-size:clamp(18px,13cqh,30px)}
${MURO} .mu-g6>.mu-card .mu-comandi .mu-tondo svg{width:60%;height:60%}
${MURO} .mu-g6>.mu-card .mu-rapido{height:clamp(34px,24cqh,52px)}
${MURO} .mu-g6>.mu-card .mu-rapido .mu-rap-tasto{width:clamp(26px,19cqh,40px);height:clamp(26px,19cqh,40px);flex-basis:clamp(26px,19cqh,40px)}
${MURO} .mu-g6>.mu-card .mu-t-alto{font-size:clamp(20px,18cqh,40px)}
${MURO} .mu-g6>.mu-clima-mini .mu-mini-alto>.mu-chip{--c:clamp(26px,26cqh,40px)!important}
${MURO} .mu-g6>.mu-clima-mini .mu-mini-t{font-size:clamp(18px,24cqh,30px)}
${MURO} .mu-g6>.mu-clima-mini .mu-mini-tasti .mu-tondo{height:clamp(26px,28cqh,40px);font-size:clamp(16px,16cqh,22px)}
${MURO} .mu-g6>.mu-card.mu-termostato{gap:clamp(4px,4cqh,12px)}
${MURO} .mu-g6>.mu-card.mu-termostato .mu-ter-alto>.mu-chip{--c:clamp(26px,22cqh,40px)!important}
${MURO} .mu-g6>.mu-card.mu-termostato .mu-ter-alto>.mu-ter-acceso{width:clamp(28px,min(22cqh,16cqw),48px);height:clamp(28px,min(22cqh,16cqw),48px)}
${MURO} .mu-g6>.mu-card.mu-termostato .mu-ter-righe{gap:clamp(3px,3cqh,8px)}
${MURO} .mu-g6>.mu-card.mu-termostato .mu-est{gap:clamp(4px,3cqw,10px);padding:2px clamp(3px,2cqw,6px) 2px clamp(6px,4cqw,12px);border-radius:clamp(10px,8cqh,16px)}
${MURO} .mu-g6>.mu-card.mu-termostato .mu-est-v{font-size:clamp(15px,min(17cqh,12cqw),38px)}
${MURO} .mu-g6>.mu-card.mu-termostato .mu-est>.mu-est-t{width:clamp(22px,min(19cqh,15cqw),52px);height:clamp(22px,min(19cqh,15cqw),52px);font-size:clamp(14px,10cqh,24px)}
/* Le righe di contorno se ne vanno prima del nome. */
@container (max-height:129px){
  ${MURO} .mu-card.mu-fam>.mu-sotto,${MURO} .mu-dato-s,${MURO} .mu-umido{display:none}
  ${MURO} .mu-card.mu-fam .mu-fam-nome.mu-osw{padding-top:4px}
}
@container (max-height:219px){
  ${MURO} .mu-card.mu-fam>.mu-giu{display:none}
  ${MURO} .mu-card.mu-clima-mini .mu-sotto{display:none}
}
@container (max-height:129px){
  ${MURO} .mu-card.mu-fam>.mu-bar{display:none}
}
/* La tapparella coi tasti sempre sulla card.
 *
 * «Anche se attivo una stanza riprendendo le stanze della plancia principale,
 * anche qui va fatto quello che hai fatto sul clima.» Le priorita' si
 * rovesciano rispetto a prima: i tasti ▲ ■ ▼ restano in ogni casella, su
 * ogni schermo, e a far posto sono gli altri. In quest'ordine, man mano che
 * la casella si abbassa: la barra della posizione (la percentuale resta nella
 * parola dello stato, e la barra nella finestra), il disegno (la riga in alto
 * diventa la sola parola, piccola), e nelle caselle piu' basse anche la
 * parola: restano il nome, che si stringe ma non sparisce, e i tasti. Il
 * disegno se ne va prima della parola perche' e' lui a fare alta la riga: la
 * parola da sola costa un terzo, e dice se la serranda e' aperta.
 *
 * I tasti crescono con la casella, fra 40 e 64 pixel del disegno (il pannello
 * piu' rimpicciolito, a 0,75, li porta a 30 pixel veri: mai meno). In una
 * casella stretta resta il segno senza la parola; il segno ha il colore della
 * tapparella. Sul pannello piccolo (\`data-compatto\`) le righe di contorno
 * delle card sono spente tutte, i tasti delle tapparelle no. */
${MURO} .mu-g6>.mu-card.mu-tapparella>.mu-tap-tasti{display:flex;flex:none;margin-top:clamp(6px,5cqh,12px);padding:clamp(3px,2cqh,6px);gap:clamp(4px,2cqw,6px);border-radius:clamp(12px,9cqh,20px)}
${MURO} .mu-g6>.mu-card.mu-tapparella>.mu-tap-tasti>button{height:clamp(40px,28cqh,64px);min-width:0;padding:0 4px;gap:8px;font-size:clamp(14px,9cqh,17px);border-radius:clamp(10px,7cqh,15px);color:var(--text);background:color-mix(in srgb,var(--text) 6%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 8%,transparent)}
${MURO} .mu-g6>.mu-card.mu-tapparella>.mu-tap-tasti>button:active{background:color-mix(in srgb,var(--acc) 22%,var(--card-bg))}
${MURO} .mu-tap-tasti>button>b{font-size:1.2em;line-height:1;color:var(--acc);font-weight:800}
${MURO} .mu-tap-tasti>button>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
${MURO} .mu-g6>.mu-card.mu-tapparella .mu-fam-nome.mu-osw{font-size:clamp(15px,min(19cqh,11cqw),38px)}
@container (max-width:359px){
  ${MURO} .mu-card.mu-tapparella .mu-tap-tasti>button>span{display:none}
}
@container (max-height:229px){
  ${MURO} .mu-card.mu-tapparella>.mu-bar{display:none}
}
${MURO} .mu-card.mu-tapparella .mu-tap-stato{display:none;flex:none;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-bottom:.3em;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--acc)}
${MURO} .mu-card.mu-tapparella:not(.mu-accesa) .mu-tap-stato{color:var(--text-dim)}
/* Le soglie sono sull'altezza dentro la casella, senza il suo bordo. */
@container (max-height:134px){
  ${MURO} .mu-card.mu-tapparella .mu-riga1>.mu-chip{display:none}
  ${MURO} .mu-card.mu-tapparella .mu-riga1>.mu-stato{font-size:11px}
  ${MURO} .mu-card.mu-tapparella .mu-fam-nome.mu-osw{padding-top:2px}
}
@container (max-height:99px){
  ${MURO} .mu-card.mu-tapparella>.mu-riga1{display:none}
  ${MURO} .mu-card.mu-tapparella .mu-tap-stato{display:block}
}
/* Il clima basso: i gradi voluti salgono accanto al nome, al posto della
 * pastiglia di quello che sta facendo, e la riga «− + ⏻» resta intera. */
@container (max-height:239px){
  ${MURO} .mu-card .mu-riga1>.mu-t-alto{display:block}
  ${MURO} .mu-card .mu-riga1:has(>.mu-t-alto)>.mu-pasti,${MURO} .mu-card:has(.mu-t-alto)>.mu-target{display:none}
  ${MURO} .mu-card:has(.mu-t-alto)>.mu-comandi{margin-top:auto}
}
@container (max-height:109px){
  ${MURO} .mu-clima-mini .mu-mini-alto>.mu-chip{display:none}
}
/* Il termostato a coppia nelle celle piccole: se ne vanno, in quest'ordine,
 * la riga sotto il nome, il disegno e la modalita' (che restano nella
 * finestra), l'interruttore, la parola accanto all'icona e infine la riga del
 * nome. Le due righe coi loro tasti restano sempre. */
@container (max-height:219px){
  ${MURO} .mu-card.mu-termostato .mu-ter-alto .mu-sotto{display:none}
}
@container (max-height:169px){
  ${MURO} .mu-card.mu-termostato .mu-ter-alto>.mu-chip,${MURO} .mu-card.mu-termostato .mu-ter-alto>.mu-pasti{display:none}
  ${MURO} .mu-card.mu-termostato .mu-ter-alto .mu-n{font-size:15px}
}
@container (max-height:109px){
  ${MURO} .mu-card.mu-termostato .mu-ter-alto{display:none}
}
@container (max-width:319px){
  ${MURO} .mu-card.mu-termostato .mu-ter-alto>.mu-pasti{display:none}
}
@container (max-width:239px){
  ${MURO} .mu-card.mu-termostato .mu-est-p{display:none}
}
@container (max-width:149px){
  ${MURO} .mu-card.mu-termostato .mu-est-n{display:none}
}
/* Stretto: la pastiglia del comando rapido tiene i gradi e il tasto, e lascia
 * la ventola alla finestra, invece di mostrarla tagliata a meta'. */
@container (max-width:339px){
  ${MURO} .mu-rapido>i,${MURO} .mu-rapido>.mu-rap-val~.mu-rap-val,${MURO} .mu-rapido>.mu-rap-lampo{display:none}
  ${MURO} .mu-rapido{padding-left:10px;justify-content:space-between}
}
@container (max-width:179px){
  ${MURO} .mu-card.mu-fam .mu-riga1>.mu-stato{display:none}
}
/* Il riquadro dei due tasti (\`cardDueTasti\`): al posto dell'interruttore, ON
 * e OFF affiancati, ognuno grande come il disco. ON acceso e' pieno d'ambra
 * come l'interruttore acceso della luce; OFF quando la cosa e' spenta si
 * schiarisce appena, perche' spento e' lo stato di riposo e non deve gridare.
 * Nelle caselle strette i tasti si stringono con la casella, e a far posto
 * se ne vanno, in quest'ordine, la parola dello stato e il disco: i due tasti
 * e il nome restano sempre. Sul pannello piccolo la riga in alto non va a
 * capo come nelle altre card: i tasti sotto il disco spingevano il nome fuori. */
${MURO} .mu-card.mu-fam .mu-riga1>.mu-due{margin-left:auto;flex:0 1 auto;display:grid;grid-template-columns:1fr 1fr;gap:10px;min-width:0;width:min(62%,260px)}
${MURO} .mu-tasto{height:62px;min-width:0;padding:0 6px;border-radius:18px;display:flex;align-items:center;justify-content:center;text-align:center;white-space:nowrap;overflow:hidden;
  font-weight:900;font-size:16px;letter-spacing:.1em;color:var(--text);background:color-mix(in srgb,var(--text) 9%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 12%,transparent);transition:background .15s ease,box-shadow .15s ease,transform .1s ease}
${MURO} .mu-tasto:active{transform:scale(.96)}
${MURO} .mu-tasto-on.si{background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1f2937;box-shadow:0 0 22px -4px #f59e0bcc}
${MURO} .mu-tasto-off.si{background:color-mix(in srgb,var(--text) 18%,var(--card-bg));color:var(--text)}
${MURO} .mu-tasto.premuto{outline:3px solid color-mix(in srgb,var(--text) 50%,transparent);outline-offset:2px}
${MURO} .mu-stato.mu-inviato{color:#34d399}
${MURO} .mu-g6>.mu-card.mu-duetasti .mu-riga1>.mu-due{gap:clamp(6px,3cqw,10px);width:clamp(96px,50cqw,250px)}
${MURO} .mu-g6>.mu-card.mu-duetasti .mu-tasto{height:clamp(30px,min(32cqh,24cqw),62px);font-size:clamp(12px,min(8cqh,5cqw),16px);border-radius:clamp(10px,9cqh,18px);letter-spacing:clamp(.02em,.6cqw,.1em)}
${MURO}[data-compatto="1"] .mu-card.mu-duetasti .mu-riga1{flex-wrap:nowrap}
@container (max-width:259px){
  ${MURO} .mu-card.mu-duetasti .mu-riga1>.mu-stato{display:none}
}
@container (max-width:199px){
  ${MURO} .mu-card.mu-duetasti .mu-riga1>.mu-disco{display:none}
  ${MURO} .mu-g6>.mu-card.mu-duetasti .mu-riga1>.mu-due{width:100%}
}
/* ── Il menu di lato ─────────────────────────────────────────────────────
 *
 * «Come sui pannelli di regia»: una colonna di tasti grandi a sinistra, il
 * disegno sopra e il nome sotto, quello aperto acceso nel suo colore. La
 * testa perde il ☰ e le linguette, e si fa piu' bassa. */
${MURO} .mu-pagina.mu-con-lato{grid-template-columns:116px minmax(0,1fr);column-gap:18px}
${MURO} .mu-con-lato>.mu-lato{grid-column:1;grid-row:1/-1}
${MURO} .mu-con-lato>:not(.mu-lato){grid-column:2;min-width:0}
${MURO} .mu-lato{display:flex;flex-direction:column;gap:12px;min-height:0;overflow:hidden}
${MURO} .mu-lato>.mu-menu{width:100%;height:58px;flex:none;border-radius:20px}
${MURO} .mu-lato-tasto{flex:1 1 0;min-height:0;max-height:112px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:8px 6px;border-radius:24px;text-align:center;
  color:var(--text-dim);font-size:12px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;
  background:${FONDO_DELLA_CARTA};box-shadow:${OMBRA_DELLA_CARTA}}
${MURO} .mu-lato-tasto>span{display:block;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-lato-tasto .dm-oggetto{flex:none}
${MURO} .mu-lato-tasto.si{color:var(--text);background:linear-gradient(160deg,color-mix(in srgb,var(--acc) 30%,var(--card-bg)),color-mix(in srgb,var(--acc) 12%,var(--card-bg)));
  box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--acc) 85%,transparent),0 12px 28px -12px var(--acc)}
${MURO} .mu-testa-lato{padding:12px 24px}
${MURO} .mu-testa-lato .mu-tit{font-size:34px}
${MURO} .mu-testa-lato .mu-h{font-size:48px}
/* ── La regia: il mixer ──────────────────────────────────────────────────
 *
 * Ogni gruppo una carta col suo colore; dentro, i canali in piedi: il numero
 * in cima, il cursore lungo quanto si puo', il nome e il muto in fondo. Sotto,
 * largo, il volume totale. Il cursore e' una traccia che si accende del
 * colore del gruppo e una manopola da banco. */
${MURO} .mu-pag-mixer,${MURO} .mu-pag-telecamera,${MURO} .mu-pag-comandi{grid-template-rows:auto 1fr}
${MURO} .mu-mixer{display:grid;grid-template-rows:minmax(0,1fr) auto;gap:16px;min-height:0}
${MURO} .mu-mixer.solo-totale{grid-template-rows:auto;align-content:center}
${MURO} .mu-mix-gruppi{display:grid;gap:16px;min-height:0}
${MURO} .mu-mix-gruppo{display:flex;flex-direction:column;gap:12px;padding:14px 12px 12px;min-height:0;min-width:0;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 30%,transparent),${OMBRA_DELLA_CARTA}}
${MURO} .mu-mix-tit{font-size:14px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:var(--acc);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-mix-canali{flex:1;min-height:0;display:flex;gap:10px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
${MURO} .mu-canale{flex:1 1 0;min-width:76px;min-height:0;display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 6px;border-radius:18px;
  background:color-mix(in srgb,var(--text) 4%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 7%,transparent)}
${MURO} .mu-can-v{font-family:Oswald,Inter,sans-serif;font-weight:500;font-size:22px;line-height:1;color:var(--acc);white-space:nowrap;font-variant-numeric:tabular-nums}
${MURO} .mu-can-n{max-width:100%;font-size:14px;font-weight:800;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-can-muto{flex:none;width:100%;max-width:72px;height:48px;border-radius:14px;display:grid;place-items:center;color:var(--text-dim);
  background:color-mix(in srgb,var(--text) 6%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 12%,transparent)}
${MURO} .mu-can-muto.vuoto{visibility:hidden}
${MURO} .mu-can-muto.si{color:#fff;background:linear-gradient(180deg,#f43f5e,#be123c);box-shadow:0 0 18px -2px #f43f5ecc,inset 0 1px 0 rgba(255,255,255,.25)}
${MURO} .mu-fader{--p:0;position:relative;flex:1 1 auto;min-height:90px;width:100%;touch-action:none;cursor:pointer}
${MURO} .mu-fader::before{content:"";position:absolute;top:24px;bottom:24px;left:calc(50% + 16px);width:9px;opacity:.55;
  background:repeating-linear-gradient(180deg,color-mix(in srgb,var(--text) 45%,transparent) 0 1px,transparent 1px 10%)}
${MURO} .mu-fad-traccia{position:absolute;top:24px;bottom:24px;left:50%;width:12px;margin-left:-6px;border-radius:6px;background:color-mix(in srgb,var(--text) 10%,#000 20%);box-shadow:inset 0 1px 3px rgba(0,0,0,.45)}
${MURO} .mu-fad-traccia i{position:absolute;left:0;right:0;bottom:0;height:calc(var(--p) * 100%);border-radius:6px;
  background:linear-gradient(0deg,color-mix(in srgb,var(--acc) 45%,transparent),var(--acc));box-shadow:0 0 16px color-mix(in srgb,var(--acc) 75%,transparent)}
${MURO} .mu-fader u{position:absolute;left:50%;bottom:calc(24px + var(--p) * (100% - 48px));width:min(60px,86%);height:40px;transform:translate(-50%,50%);border-radius:11px;
  background:linear-gradient(180deg,#f8fafc,#cbd5e1 55%,#94a3b8);box-shadow:0 6px 12px rgba(0,0,0,.5),inset 0 1px 0 #fff}
${MURO} .mu-fader u::after{content:"";position:absolute;left:16%;right:16%;top:50%;height:4px;margin-top:-2px;border-radius:2px;background:var(--acc);box-shadow:0 0 8px var(--acc)}
${MURO} .mu-fader.sdraiato{flex:1 1 auto;min-height:0;height:64px}
${MURO} .mu-fader.sdraiato::before{top:auto;bottom:4px;left:30px;right:30px;width:auto;height:8px;background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--text) 45%,transparent) 0 1px,transparent 1px 5%)}
${MURO} .mu-fader.sdraiato .mu-fad-traccia{top:50%;bottom:auto;left:30px;right:30px;width:auto;height:12px;margin:-6px 0 0}
${MURO} .mu-fader.sdraiato .mu-fad-traccia i{top:0;bottom:0;height:auto;width:calc(var(--p) * 100%);background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 45%,transparent),var(--acc))}
${MURO} .mu-fader.sdraiato u{bottom:auto;top:50%;left:calc(30px + var(--p) * (100% - 60px));width:40px;height:56px;transform:translate(-50%,-50%)}
${MURO} .mu-fader.sdraiato u::after{left:50%;right:auto;top:16%;bottom:16%;width:4px;height:auto;margin:0 0 0 -2px}
${MURO} .mu-fader.fermo{cursor:default;opacity:.4}
${MURO} .mu-muto .mu-fad-traccia i{filter:grayscale(1);opacity:.3;box-shadow:none}
${MURO} .mu-muto .mu-can-v{color:var(--text-dim);text-decoration:line-through}
${MURO} .mu-spento{opacity:.5}
${MURO} .mu-can-v{min-height:1em}
${MURO} .mu-can-l{margin-top:-4px;font-size:12px;font-weight:700;color:var(--text-dim);white-space:nowrap;font-variant-numeric:tabular-nums}
${MURO} .mu-fad-letto{position:absolute;top:24px;bottom:24px;left:calc(50% - 22px);width:6px;border-radius:3px;background:color-mix(in srgb,var(--text) 8%,#000 18%);overflow:hidden}
${MURO} .mu-fad-letto i{position:absolute;left:0;right:0;bottom:0;height:calc(var(--l) * 100%);background:linear-gradient(0deg,#22c55e 0 60%,#eab308 60% 85%,#ef4444 85%);background-size:100% calc(100% / max(var(--l),.001));background-position:bottom}
${MURO} .mu-metro{cursor:default}
${MURO} .mu-metro .mu-fad-traccia{width:18px;margin-left:-9px;border-radius:5px}
${MURO} .mu-metro .mu-fad-traccia i{border-radius:4px;box-shadow:none;background:linear-gradient(0deg,#22c55e 0 60%,#eab308 60% 85%,#ef4444 85%);background-size:100% calc(100% / max(var(--p),.001));background-position:bottom;
  -webkit-mask:repeating-linear-gradient(0deg,#000 0 5px,transparent 5px 7px);mask:repeating-linear-gradient(0deg,#000 0 5px,transparent 5px 7px)}
${MURO} .mu-metro.sdraiato .mu-fad-traccia{height:18px;margin:-9px 0 0}
${MURO} .mu-metro.sdraiato .mu-fad-traccia i{background:linear-gradient(90deg,#22c55e 0 60%,#eab308 60% 85%,#ef4444 85%);background-size:calc(100% / max(var(--p),.001)) 100%;background-position:left;
  -webkit-mask:repeating-linear-gradient(90deg,#000 0 5px,transparent 5px 7px);mask:repeating-linear-gradient(90deg,#000 0 5px,transparent 5px 7px)}
${MURO} .mu-passi{flex:1 1 auto;min-height:90px;width:100%;display:flex;flex-direction:column;align-items:center;gap:8px}
${MURO} .mu-passi>.mu-metro{flex:1 1 auto;min-height:40px}
${MURO} .mu-passi>.mu-metro .mu-fad-traccia{top:6px;bottom:6px}
${MURO} .mu-passi-spazio{flex:1 1 auto}
${MURO} .mu-passo{flex:none;width:100%;max-width:72px;height:64px;border-radius:16px;display:grid;place-items:center;font-size:24px;color:var(--acc);
  background:color-mix(in srgb,var(--text) 6%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 35%,transparent),0 6px 14px -8px rgba(0,0,0,.6)}
${MURO} .mu-passo:active:not(:disabled){background:color-mix(in srgb,var(--acc) 30%,var(--card-bg))}
${MURO} .mu-passo:disabled{opacity:.4}
${MURO} .mu-passi.sdraiato{flex-direction:row;min-height:0;height:64px}
${MURO} .mu-passi.sdraiato>.mu-metro{height:100%;min-height:0}
${MURO} .mu-passi.sdraiato>.mu-metro .mu-fad-traccia{left:10px;right:10px}
${MURO} .mu-passi.sdraiato .mu-passo{width:72px;height:56px}
${MURO} .mu-mix-master{display:flex;align-items:center;gap:18px;padding:12px 22px;min-width:0}
${MURO} .mu-mix-master>.mu-mix-tit{flex:none;max-width:220px;text-align:left;font-size:15px}
${MURO} .mu-mix-master>.mu-can-muto{width:64px;max-width:none;height:56px}
${MURO} .mu-mix-master>.mu-can-v{flex:none;min-width:84px;text-align:right;font-size:30px}
/* ── La regia: la telecamera ─────────────────────────────────────────── */
${MURO} .mu-ptz{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(min(340px,100%),1fr);grid-template-rows:minmax(0,1fr) auto;gap:16px;min-height:0}
${MURO} .mu-ptz.senza-preset{grid-template-rows:minmax(0,1fr)}
${MURO} .mu-ptz-video{padding:10px;display:flex;min-height:0}
${MURO} .mu-ptz-video .mu-video{flex:1;min-height:0}
${MURO} .mu-ptz-comandi{display:flex;align-items:center;gap:18px;padding:20px;min-height:0}
${MURO} .mu-ptz-zoom{align-self:stretch;flex:none;width:68px;display:flex;flex-direction:column;align-items:center;gap:10px;min-height:0;--acc:#0ea5e9}
${MURO} .mu-ptz-zoom .mu-fader{min-height:60px}
${MURO} .mu-ptz-pad{flex:1 1 auto;width:100%;min-width:0;max-width:440px;max-height:100%;aspect-ratio:1;margin:auto;display:grid;grid-template:repeat(3,minmax(0,1fr))/repeat(3,minmax(0,1fr));gap:10px}
${MURO} .mu-ptz-t{display:grid;place-items:center;border-radius:20px;color:var(--text);font-weight:900;font-size:30px;
  background:color-mix(in srgb,var(--text) 6%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 12%,transparent),0 6px 14px -8px rgba(0,0,0,.6)}
${MURO} .mu-ptz-t:active:not(:disabled){background:color-mix(in srgb,#0ea5e9 30%,var(--card-bg))}
${MURO} .mu-ptz-t:disabled{opacity:.3;cursor:default}
${MURO} .mu-ptz-stop{color:#fff;font-size:15px;letter-spacing:.08em;text-transform:uppercase;background:linear-gradient(180deg,#f43f5e,#be123c);box-shadow:0 0 18px -4px #f43f5ecc}
${MURO} .mu-ptz-pm{flex:none;width:64px;height:56px;font-size:32px}
${MURO} .mu-ptz-preset{grid-column:1/-1;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:12px}
${MURO} .mu-ptz-preset-t{height:72px;display:flex;align-items:center;justify-content:center;gap:10px;padding:0 10px;font-weight:800;font-size:16px;min-width:0}
${MURO} .mu-ptz-preset-t>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-ptz-preset-t:active{box-shadow:inset 0 0 0 2px #0ea5e9}
/* ── La regia: i comandi ─────────────────────────────────────────────── */
${MURO} .mu-regia{display:grid;gap:16px;min-height:0}
${MURO} .mu-reg-grandi{display:grid;grid-auto-rows:minmax(0,1fr);gap:16px;min-height:0}
${MURO} .mu-reg-tasto{container-type:size;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(6px,4cqh,22px);padding:18px;min-height:0;min-width:0;text-align:center;
  box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--acc) 65%,transparent),${OMBRA_DELLA_CARTA}}
${MURO} .mu-reg-icona{flex:none;display:grid;place-items:center;color:var(--text-dim)}
${MURO} .mu-reg-tasto:not(.mu-accesa) .mu-reg-icona{color:color-mix(in srgb,var(--acc) 55%,var(--text-dim))}
${MURO} .mu-reg-tasto .mu-reg-icona{--ic:clamp(48px,min(36cqh,34cqw),168px);width:var(--ic);height:var(--ic);border-radius:calc(var(--ic) * .3);background:color-mix(in srgb,var(--text) 6%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--text) 10%,transparent)}
${MURO} .mu-accesa .mu-reg-icona{color:var(--acc)}
${MURO} .mu-reg-tasto.mu-accesa .mu-reg-icona{background:color-mix(in srgb,var(--acc) 22%,var(--card-bg));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 60%,transparent),0 0 30px -6px var(--acc)}
${MURO} .mu-reg-nome{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${MURO} .mu-reg-tasto .mu-reg-icona>*{width:56%!important;height:56%!important}
${MURO} .mu-reg-tasto .mu-reg-nome{font-size:clamp(18px,min(12cqh,9cqw),60px);text-transform:uppercase;letter-spacing:.04em}
${MURO} .mu-reg-tasto .mu-stato{font-size:clamp(11px,4cqh,16px)}
${MURO} .mu-reg-tasto:active{transform:scale(.985)}
${MURO} .mu-reg-coppie{display:grid;gap:14px;min-height:0}
${MURO} .mu-reg-coppia{display:flex;flex-direction:column;gap:10px;padding:14px;min-height:0;min-width:0}
${MURO} .mu-reg-testa{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;text-align:center}
${MURO} .mu-reg-testa .mu-reg-nome{font-size:19px;font-weight:800}
${MURO} .mu-reg-coppia .mu-reg-icona{width:52px;height:52px;border-radius:16px;background:color-mix(in srgb,var(--text) 6%,var(--card-bg))}
${MURO} .mu-reg-coppia.mu-accesa .mu-reg-icona{background:color-mix(in srgb,var(--acc) 22%,var(--card-bg));box-shadow:0 0 22px -6px var(--acc)}
${MURO} .mu-reg-avvio,${MURO} .mu-reg-stop{flex:1 1 0;min-height:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border-radius:18px;font-weight:900;font-size:13px;letter-spacing:.1em;text-transform:uppercase}
${MURO} .mu-reg-avvio{color:#22c55e;background:color-mix(in srgb,#22c55e 8%,var(--card-bg));box-shadow:inset 0 0 0 2px color-mix(in srgb,#22c55e 60%,transparent)}
${MURO} .mu-reg-avvio.si{color:#052e16;background:linear-gradient(180deg,#4ade80,#16a34a);box-shadow:0 0 22px -4px #22c55ecc}
${MURO} .mu-reg-stop{color:#f43f5e;background:color-mix(in srgb,#f43f5e 8%,var(--card-bg));box-shadow:inset 0 0 0 2px color-mix(in srgb,#f43f5e 60%,transparent)}
${MURO} .mu-reg-avvio:active,${MURO} .mu-reg-stop:active{transform:scale(.97)}
${MURO} .mu-reg-ferma{height:72px;display:flex;align-items:center;justify-content:center;gap:14px;color:#fff;font-weight:900;font-size:18px;letter-spacing:.12em;text-transform:uppercase;
  background:linear-gradient(180deg,#e11d48,#9f1239);box-shadow:0 14px 30px -14px #f43f5e,inset 0 1px 0 rgba(255,255,255,.2)}
/* Sul pannello piccolo tutto si stringe: i canali, la telecamera in colonna,
 * i tasti piu' bassi. */
${MURO}[data-compatto="1"] .mu-mixer,${MURO}[data-compatto="1"] .mu-mix-gruppi,${MURO}[data-compatto="1"] .mu-regia,${MURO}[data-compatto="1"] .mu-reg-grandi,${MURO}[data-compatto="1"] .mu-reg-coppie{gap:8px}
${MURO}[data-compatto="1"] .mu-mix-gruppo{padding:8px 6px 6px;gap:6px;border-radius:18px}
${MURO}[data-compatto="1"] .mu-mix-tit{font-size:11px;letter-spacing:.1em}
${MURO}[data-compatto="1"] .mu-mix-canali{gap:6px}
${MURO}[data-compatto="1"] .mu-canale{min-width:54px;padding:6px 3px;gap:4px;border-radius:14px}
${MURO}[data-compatto="1"] .mu-can-v{font-size:15px}
${MURO}[data-compatto="1"] .mu-can-n{font-size:11px}
${MURO}[data-compatto="1"] .mu-can-muto{height:34px;border-radius:10px}
${MURO}[data-compatto="1"] .mu-can-muto svg{width:18px;height:18px}
${MURO}[data-compatto="1"] .mu-fader{min-height:60px}
${MURO}[data-compatto="1"] .mu-fader::before,${MURO}[data-compatto="1"] .mu-fad-traccia{top:16px;bottom:16px}
${MURO}[data-compatto="1"] .mu-fader u{bottom:calc(16px + var(--p) * (100% - 32px));height:30px;width:min(44px,86%);border-radius:9px}
${MURO}[data-compatto="1"] .mu-fader.sdraiato{height:44px;min-height:0}
${MURO}[data-compatto="1"] .mu-fader.sdraiato .mu-fad-traccia{top:50%;bottom:auto;left:20px;right:20px}
${MURO}[data-compatto="1"] .mu-fader.sdraiato::before{top:auto;bottom:2px;left:20px;right:20px}
${MURO}[data-compatto="1"] .mu-fader.sdraiato u{bottom:auto;left:calc(20px + var(--p) * (100% - 40px));width:30px;height:40px}
${MURO}[data-compatto="1"] .mu-passo{height:40px;font-size:16px;border-radius:10px}
${MURO}[data-compatto="1"] .mu-passi{min-height:60px;gap:4px}
${MURO}[data-compatto="1"] .mu-passi.sdraiato{height:44px}
${MURO}[data-compatto="1"] .mu-passi.sdraiato .mu-passo{width:44px;height:40px}
${MURO}[data-compatto="1"] .mu-fad-letto{top:16px;bottom:16px}
${MURO}[data-compatto="1"] .mu-mix-master{padding:6px 12px;gap:10px;border-radius:18px}
${MURO}[data-compatto="1"] .mu-mix-master>.mu-mix-tit{max-width:110px;font-size:11px}
${MURO}[data-compatto="1"] .mu-mix-master>.mu-can-muto{width:44px;height:38px}
${MURO}[data-compatto="1"] .mu-mix-master>.mu-can-v{min-width:56px;font-size:20px}
${MURO}[data-compatto="1"] .mu-ptz{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:8px}
${MURO}[data-compatto="1"] .mu-ptz-comandi{padding:10px;gap:8px}
${MURO}[data-compatto="1"] .mu-ptz-zoom{width:56px;gap:6px}
${MURO}[data-compatto="1"] .mu-ptz-pad{gap:6px}
${MURO}[data-compatto="1"] .mu-ptz-t{border-radius:14px;font-size:22px}
${MURO}[data-compatto="1"] .mu-ptz-t svg{width:28px;height:28px}
${MURO}[data-compatto="1"] .mu-ptz-stop{font-size:11px}
${MURO}[data-compatto="1"] .mu-ptz-pm{width:46px;height:40px;font-size:24px}
${MURO}[data-compatto="1"] .mu-ptz-preset{gap:6px}
${MURO}[data-compatto="1"] .mu-ptz-preset-t{height:46px;font-size:13px;border-radius:14px;gap:6px}
${MURO}[data-compatto="1"] .mu-reg-tasto{gap:8px;padding:10px;border-radius:18px}
${MURO}[data-compatto="1"] .mu-reg-coppia{padding:8px;gap:6px;border-radius:16px}
${MURO}[data-compatto="1"] .mu-reg-coppia .mu-reg-icona{display:none}
${MURO}[data-compatto="1"] .mu-reg-testa .mu-reg-nome{font-size:13px}
${MURO}[data-compatto="1"] .mu-reg-avvio,${MURO}[data-compatto="1"] .mu-reg-stop{min-height:34px;border-radius:12px;font-size:10px;gap:2px}
${MURO}[data-compatto="1"] .mu-reg-avvio svg,${MURO}[data-compatto="1"] .mu-reg-stop svg{width:18px;height:18px}
${MURO}[data-compatto="1"] .mu-reg-ferma{height:46px;font-size:14px;border-radius:16px}
/* In verticale la telecamera sta sopra e i comandi sotto. */
${MURO}[data-verso="verticale"] .mu-ptz{grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:minmax(0,1.2fr) minmax(0,1fr) auto}
${MURO}[data-verso="verticale"] .mu-ptz-video{grid-column:1/-1}
${MURO}[data-verso="verticale"] .mu-ptz-comandi{grid-column:1/-1;justify-content:center}
${MURO}[data-verso="verticale"] .mu-ptz.senza-preset{grid-template-rows:minmax(0,1.2fr) minmax(0,1fr)}
${MURO}[data-verso="verticale"] .mu-reg-coppie{grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr))!important;grid-auto-rows:minmax(0,1fr)}
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
  /* Il suono del campanello, in un browser, parte solo dopo un tocco: il
   * primo tocco sul pannello lo sblocca per sempre. */
  ascoltaIlPrimoTocco();
  trattieniIlVelo();
  agganciaIlConfig();
  prendiLePorteDelConfig();
  const ancora = () => rileggi().catch(() => {});
  root.addEventListener?.("dashboardmodern:legacy-ready", agganciaIlConfig);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:muro",
  ])
    root.addEventListener?.(evento, ancora);
  root.addEventListener?.("dashboardmodern:states-ready", () => {
    /* Gli stati di Home Assistant ci sono: e' il momento di ricordarsi com'e'
     * ogni campanello, anche se il pannello non si e' ancora disegnato. */
    ricordaICampanelli();
    disegna();
  });
  root[IN_VISTA_KEY] = eInVista;
  root.addEventListener?.("dashboardmodern:state-changed", (event) => {
    controllaLOrecchio();
    suonaIlCampanello(event);
    guardaGliAvvisi(event);
    svegliaSeServe(event);
    confermaLeAttese(event);
    /* Un mazzetto che non tocca niente di quello che si vede non ridisegna:
     * su un tablet economico la casa che parla di continuo si sente. */
    const ids = event?.detail?.entity_ids || [];
    if (ids.length && !ids.some(eInVista)) return;
    disegna();
  });
  root.addEventListener?.("resize", () => disegna());
  /* Quello che dicono i sensori del tablet, dall'app (`lo_schermo.dart`):
   * qualcuno vicino allo schermo, o la stanza che si fa buia. */
  root.addEventListener?.("gdahome:schermo", (event) => {
    const detto = event?.detail || {};
    if ("prossimita" in detto || "luce" in detto) disegna();
  });
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
    luce: () => ({ ...luce }),
  };
  ancora();
  return true;
}

senzaCadere(installPlanciaAMuro);
