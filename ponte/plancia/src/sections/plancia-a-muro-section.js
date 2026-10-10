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
import { ALARM_DISARM, ALARM_MODES, alarmCodeNeeded, alarmModes } from "../core/alarm-panel.js";
import { FONDO_DELLA_CARTA, GRANA_DELLA_CARTA, OMBRA_DELLA_CARTA } from "../core/le-vesti-della-carta.js";
import { climaScalda } from "../core/device-model.js";
import { oggettoWidget } from "../core/oggetti-widget.js";
import {
  CHIAVE_MURO,
  avvisiAccesi,
  comandiDellaPagina,
  eCompatto,
  eNotte,
  eUnaScena,
  MODELLI_ELENCO,
  fonteDaiValori,
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

const CINQUE_MINUTI = 5 * 60 * 1000;

/** Le cose della plancia di origine, gia' pronte per il tablet. */
export async function fonteDelMuro(muro, { forza = false } = {}) {
  const di = muro?.fonte || "primary";
  if (!forza && state.fonte && state.fonteDi === di && Date.now() - state.fonteLetta < CINQUE_MINUTI)
    return state.fonte;
  let fonte = null;
  if (root.__DM_MURO_FONTE__ && typeof root.__DM_MURO_FONTE__ === "object")
    fonte = fonteDaiValori(root.__DM_MURO_FONTE__);
  else if (di === currentProfile() || !root.__DASHBOARDMODERN_HOSTED__) fonte = fonteDiQui();
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
    },
  );
}

/* ── piccole letture ─────────────────────────────────────────────────────── */

const stato = (id) => allStates()?.[id] || null;
const attributi = (id) => stato(id)?.attributes || {};
const dominio = (id) => String(id || "").split(".")[0];
const acceso = (id) => ["on", "open", "opening", "heat", "cool", "heat_cool", "auto", "dry", "fan_only"].includes(String(stato(id)?.state));
const numero = (valore) => {
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};
const decimale = (valore, cifre = 1) =>
  numero(valore) === null
    ? "—"
    : Number(valore).toLocaleString(locale(), { minimumFractionDigits: 0, maximumFractionDigits: cifre });
const nomeDi = (id, scelto = "", fonte = state.fonte) => {
  if (clean(scelto)) return clean(scelto);
  const dispositivo = [...(fonte?.luci || []), ...(fonte?.clima || []), ...(fonte?.tapparelle || [])].find(
    (d) => d.entity === id,
  );
  return clean(dispositivo?.name) || clean(attributi(id).friendly_name) || id;
};
let progressivo = 0;
const disegno = (chiave, misura, dove) =>
  oggettoWidget(chiave, "", `muro-${dove || progressivo++}`).replace(
    'class="dm-oggetto"',
    `class="dm-oggetto" style="width:${misura}px;height:${misura}px"`,
  );
const azioneDi = (nome, fonte = state.fonte) => (fonte?.azioni || []).find((a) => a.name === nome) || null;

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
  if (d === "scene" || d === "script") return { domain: d, service: "turn_on", data: { entity_id: id } };
  if (d === "button" || d === "input_button") return { domain: d, service: "press", data: { entity_id: id } };
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
  if (dominio(id) === "scene" || dominio(id) === "button" || dominio(id) === "input_button") return "";
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
});
const SOTTO = () => ({
  stanza: t("Luci · Clima · Tapparelle · Scene", "Lights · Climate · Blinds · Scenes"),
  scene: t("Un tocco · tutta la casa", "One tap · the whole house"),
  ingresso: t("Antifurto · Citofono · Uscita", "Alarm · Intercom · Leaving"),
  personale: t("I comandi scelti da te", "Your own controls"),
  luci: t("Tutte le luci di casa", "Every light in the house"),
  clima: t("Caldo · Freddo", "Heating · Cooling"),
});
const DISEGNO_DEL_MODELLO = {
  stanza: "stanze",
  scene: "azioni",
  ingresso: "sicurezza",
  personale: "widget",
  luci: "luci",
  clima: "clima",
};
const ACCENTO_DEL_MODELLO = {
  stanza: "#f59e0b",
  scene: "#f59e0b",
  ingresso: "#10b981",
  personale: "#8b5cf6",
  luci: "#f59e0b",
  clima: "#0ea5e9",
};

const titoloDi = (pagina) =>
  clean(pagina.titolo) || (pagina.modello === "stanza" && clean(pagina.stanza)) || MODELLI_SCRITTI()[pagina.modello];

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
  const id = Object.keys(allStates() || {}).find((k) => k.startsWith("weather."));
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
  const accento = ACCENTO_DEL_MODELLO[pagina.modello];
  const linguette =
    muro.pagine.length > 1
      ? `<div class="mu-pagine" role="tablist">${muro.pagine
          .map(
            (p, i) =>
              `<button type="button" role="tab" class="${i === state.pagina ? "si" : ""}" style="--acc:${ACCENTO_DEL_MODELLO[p.modello]}" data-mu-pagina="${i}" aria-selected="${i === state.pagina}">${disegno(clean(p.disegno) || DISEGNO_DEL_MODELLO[p.modello], 22, `ling-${p.id}`)}<span>${esc(titoloDi(p))}</span></button>`,
          )
          .join("")}</div>`
      : "";
  return `<div class="mu-carta mu-testa" style="--acc:${accento}">
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
  disarmed: t("Spento", "Off"),
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
  home: t("In casa", "Home"),
  away: t("Fuori", "Away"),
  night: t("Notte", "Night"),
  vacation: t("Vacanza", "Vacation"),
  custom: t("Parziale", "Custom"),
  disarm: t("Spegni", "Disarm"),
});

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
    voci.push(["luci", "#f59e0b", String(accese), accese === 1 ? t("luce accesa", "light on") : t("luci accese", "lights on")]);
  if (riga.clima !== false && stanza?.temp && numero(stato(stanza.temp)?.state) !== null)
    voci.push(["temperatura", "#ef4444", `${decimale(stato(stanza.temp).state)}°`, t("in stanza", "in the room")]);
  if (riga.clima !== false && stanza?.hum && numero(stato(stanza.hum)?.state) !== null)
    voci.push(["umidita", "#0ea5e9", `${decimale(stato(stanza.hum).state, 0)}%`, t("umidità", "humidity")]);
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
    if (persone.tutte) voci.push(["persone", "#2563eb", String(persone.inCasa), t("in casa", "at home")]);
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
  (attributi(id).supported_color_modes || []).some((m) => ["hs", "rgb", "rgbw", "rgbww", "xy"].includes(m));

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
  scalda(id, zona) ? { chiave: "caldo", accento: "#f97316" } : { chiave: "clima", accento: ACCENTI.clima };

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
  const on = s && s !== "off" && s !== "unavailable";
  const azione = a.hvac_action ? AZIONI_DEL_CLIMA()[a.hvac_action] : on ? PAROLE_DEL_CLIMA()[s] : t("Spento", "Off");
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
  /* Le pagine elenco non hanno tetto: sei per volta a schermo, e la griglia
   * scorre col dito. Vuote, lo dicono. */
  const quante = elenco ? Math.max(comandi.length, 1) : 6;
  if (elenco && !comandi.length)
    return `${linguette}<div class="mu-g6">${vuoto(0, t("Niente da mostrare qui", "Nothing to show here"))}</div>`;
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
  return `${riga}<div class="mu-g6${elenco && quante > 6 ? " mu-scorre" : ""}">${carte.join("")}</div>`;
}

function paginaScene(pagina) {
  const scene = pagina.scene.length ? pagina.scene : [];
  const carte = Array.from({ length: 6 }, (_, i) => {
    const c = scene[i];
    if (!c || c.tipo === "vuoto") return vuoto(i);
    return c.entita ? cardEntita(c, i, true) : cardAzione(c, i, true);
  });
  return `<div class="mu-g6">${carte.join("")}</div>`;
}

function finestreAperte() {
  return Object.entries(allStates() || {})
    .filter(
      ([id, s]) =>
        id.startsWith("binary_sensor.") &&
        ["window", "door", "garage_door", "opening"].includes(s?.attributes?.device_class) &&
        s?.state === "on",
    )
    .map(([id]) => nomeDi(id));
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
      ? tessera({ chiave: "citofono", accento: "#2563eb", etichetta: t("Citofono", "Intercom"), titolo: nomeDi(ing.telecamera), sotto: "", dati: `data-mu-fa="finestra-citofono"`, dove: "c-citofono" })
      : "",
    ing.apri
      ? tessera({ chiave: "varchi", accento: "#0ea5e9", etichetta: t("Apri", "Open"), titolo: nomeDi(ing.apri, ing.nomeApri), sotto: "", dati: `data-mu-fa="apri" data-mu-entita="${esc(ing.apri)}"`, dove: "c-apri1" })
      : "",
    ing.apri2
      ? tessera({ chiave: "aperture", accento: "#0ea5e9", etichetta: t("Apri", "Open"), titolo: nomeDi(ing.apri2, ing.nomeApri2), sotto: "", dati: `data-mu-fa="apri" data-mu-entita="${esc(ing.apri2)}"`, dove: "c-apri2" })
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
      ? tessera({ chiave: "persone", accento: "#2563eb", etichetta: t("In casa", "At home"), titolo: String(persone.inCasa), sotto: "", dove: "c-persone" })
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
  const modi = s ? alarmModes(s).filter((m) => m.mode !== "custom") : [];
  const aperte = ing.finestre ? finestreAperte() : [];
  const persone = personeInCasa();
  const uscita = spento ? ing.esco : ing.rientro || ing.esco;
  const azioneUscita = azioneDi(uscita);
  const telecamera = clean(ing.telecamera);
  return `<div class="mu-ingresso">
    <div class="mu-carta mu-accesa mu-allarme" style="--acc:${accento}">
      <div class="mu-riga1"><span class="mu-chip" style="--c:96px">${disegno("sicurezza", 60, "allarme")}</span>
        <div><span class="mu-et">${esc(t("Antifurto", "Alarm"))}</span><div class="mu-osw mu-stato-allarme">${esc(s ? STATI_DELL_ALLARME()[valore] || valore : t("Nessuna centrale", "No alarm panel"))}</div>
        ${aperte.length ? `<div class="mu-sotto mu-avviso-finestre">${disegno("finestra", 22, "fin")}${esc(t("Aperte", "Open"))}: <b>${esc(aperte.slice(0, 3).join(", "))}${aperte.length > 3 ? ` +${aperte.length - 3}` : ""}</b></div>` : ""}</div></div>
      ${
        modi.length
          ? `<div class="mu-seg mu-modi">${modi
              .map((m) => {
                const attivo =
                  (m.mode === "disarm" && spento) || ALARM_MODES.find((x) => x.mode === m.mode)?.state === valore;
                return `<button type="button" class="${attivo ? "si" : ""}" data-mu-fa="allarme" data-mu-modo="${esc(m.mode)}">${esc(PAROLE_DEI_MODI()[m.mode] || m.mode)}</button>`;
              })
              .join("")}</div><div class="mu-et mu-nota">${esc(t("Il codice si chiede prima di inserire", "The code is asked before arming"))}</div>`
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
              sotto: azioneUscita.name === (spento ? t("Esco", "Leaving") : t("Rientro", "I'm home")) ? "" : azioneUscita.name,
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
                ([c], i) => `<button type="button" style="background:${c}" data-mu-fa="colore" data-mu-colore="${i}" data-mu-entita="${esc(id)}" aria-label="${c}"></button>`,
              ).join("")}</div></div>`
            : ""
        }
        <div><span class="mu-et">${esc(t("Preferite", "Favourites"))}</span><div class="mu-seg">${[10, 60, 100]
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
    const modi = s ? alarmModes(s).filter((m) => m.mode !== "custom") : [];
    const aperte = pagina?.ingresso?.finestre ? finestreAperte() : [];
    dentro = `<div class="mu-fin-clima" style="--acc:${valore === "disarmed" ? "#10b981" : "#6366f1"}">
      <div class="mu-riga1"><span class="mu-chip mu-acc" style="--c:52px">${disegno("sicurezza", 30, "fin-allarme")}</span><div class="mu-nome"><div class="mu-n" style="font-size:24px">${esc(STATI_DELL_ALLARME()[valore] || valore)}</div>${aperte.length ? `<div class="mu-sotto">${esc(t("Aperte", "Open"))}: ${esc(aperte.slice(0, 2).join(", "))}</div>` : ""}</div><button type="button" class="mu-tondo" data-mu-fa="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
      <div class="mu-seg mu-seg-alto mu-modi">${modi.map((m) => `<button type="button" data-mu-fa="allarme" data-mu-modo="${esc(m.mode)}">${esc(PAROLE_DEI_MODI()[m.mode] || m.mode)}</button>`).join("")}</div></div>`;
  } else if (f.tipo === "citofono") {
    const ing = state.muro?.pagine?.[state.pagina]?.ingresso || {};
    dentro = `<div class="mu-fin-clima">
      <div class="mu-riga1"><div class="mu-nome"><div class="mu-n" style="font-size:22px">${esc(nomeDi(ing.telecamera))}</div></div><button type="button" class="mu-tondo" data-mu-fa="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
      <div class="mu-video mu-video-fin"><img data-mu-telecamera="${esc(ing.telecamera)}" alt=""></div>
      ${ing.apri || ing.apri2 ? `<div class="mu-due">${ing.apri ? `<button type="button" class="mu-btn pieno" data-mu-fa="apri" data-mu-entita="${esc(ing.apri)}">${esc(nomeDi(ing.apri, ing.nomeApri))}</button>` : ""}${ing.apri2 ? `<button type="button" class="mu-btn" data-mu-fa="apri" data-mu-entita="${esc(ing.apri2)}">${esc(nomeDi(ing.apri2, ing.nomeApri2))}</button>` : ""}</div>` : ""}</div>`;
  } else if (f.tipo === "conferma") {
    dentro = `<div class="mu-fin-conferma"><div class="mu-osw" style="font-size:40px">${esc(f.azione)}</div><div class="mu-sotto">${esc(t("Confermi?", "Confirm?"))}</div>
      <div class="mu-due"><button type="button" class="mu-btn" data-mu-fa="chiudi">${esc(t("Annulla", "Cancel"))}</button><button type="button" class="mu-btn pieno" data-mu-fa="azione" data-mu-azione="${esc(f.azione)}" data-mu-confermata="1">${esc(t("Sì, vai", "Yes, go"))}</button></div></div>`;
  } else if (f.tipo === "codice") {
    const titolo =
      f.scopo === "uscita" ? t("Codice per uscire", "Code to exit") : t("Codice dell'antifurto", "Alarm code");
    dentro = `<div class="mu-fin-codice"><div class="mu-riga1"><div class="mu-nome"><div class="mu-n" style="font-size:24px">${esc(titolo)}</div><div class="mu-puntini">${"●".repeat((f.scritto || "").length) || "&nbsp;"}</div>${f.errore ? `<div class="mu-stato" style="--acc:#e11d48">${esc(t("Codice sbagliato", "Wrong code"))}</div>` : ""}</div><button type="button" class="mu-tondo" data-mu-fa="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
      <div class="mu-tasti">${["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"]
        .map((k) => `<button type="button" class="mu-tondo ${k === "✓" ? "pieno" : ""}" data-mu-fa="cifra" data-mu-cifra="${k}">${k}</button>`)
        .join("")}</div></div>`;
  }
  const accento = { clima: ACCENTI.clima, codice: "#6366f1", tapparella: ACCENTI.tapparella, antifurto: "#10b981", citofono: "#2563eb" }[f.tipo] || ACCENTI.luce;
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
  const avvisi = muro.avvisi ? avvisiAccesi(state.fonte || {}, allStates() || {}, centraleDelMuro(pagina)) : [];
  const chip = avvisi
    .slice(0, 3)
    .map(
      (a) =>
        `<div class="mu-carta mu-avviso ${a.grave ? "grave" : ""}" style="--acc:${a.grave ? ACCENTI.allarme : "#06b6d4"}"><span class="mu-chip mu-acc" style="--c:40px">${a.grave ? disegno("sicurezza", 24, "av-allarme") : disegno("avvisi", 24, `av-${esc(a.chiave)}`)}</span><b>${esc(a.grave ? t("Antifurto: allarme in corso", "Alarm: triggered") : a.testo)}</b></div>`,
    )
    .join("");
  if (notte)
    return `<div class="mu-riposo notte" data-mu-fa="sveglia">${chip ? `<div class="mu-avvisi">${chip}</div>` : ""}</div>`;
  const m = meteo();
  const centrale = centraleDelMuro(pagina);
  const allarme = centrale && stato(centrale) ? STATI_DELL_ALLARME()[stato(centrale).state] : "";
  const stanza = (state.fonte?.stanze || []).find((s) => s.name === pagina?.stanza);
  const dentro = stanza?.temp && numero(stato(stanza.temp)?.state) !== null ? `${decimale(stato(stanza.temp).state)}°` : "";
  return `<div class="mu-riposo" data-mu-fa="sveglia">
    ${chip ? `<div class="mu-avvisi">${chip}</div>` : ""}
    <div class="mu-osw mu-orologione">${esc(o.ora)}</div>
    <div class="mu-et mu-data">${esc(o.lungo)}</div>
    <div class="mu-riposo-riga">
      ${m && numero(m.temperatura) !== null ? `<span>${disegno("meteo", 34, "rip-meteo")}${decimale(m.temperatura, 0)}° ${esc(PAROLE_DEL_METEO()[m.condizione] || "")}</span>` : ""}
      ${dentro ? `<span>${disegno("temperatura", 30, "rip-temp")}${dentro} ${esc(t("in casa", "inside"))}</span>` : ""}
      ${allarme ? `<span>${disegno("sicurezza", 30, "rip-allarme")}${esc(t("Antifurto", "Alarm"))} · ${esc(allarme)}</span>` : ""}
    </div>
    <div class="mu-et mu-tocca">${esc(t("Tocca per i comandi", "Tap for controls"))}</div></div>`;
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
  configAperto();
  return true;
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
 * ogni dieci minuti la fonte, cosi' una luce aggiunta nella principale arriva
 * sul tablet senza doverlo riavviare. */
function avviaIlBattito() {
  if (state.timer) return;
  let giri = 0;
  state.timer = root.setInterval?.(() => {
    giri += 1;
    battito();
    rinfrescaLeTelecamere();
    if (giri % 40 === 0) rileggi({ forza: true }).catch(() => {});
  }, 15 * 1000);
}

function fermaIlBattito() {
  if (state.timer) root.clearInterval?.(state.timer);
  state.timer = null;
}

function togliLaTela() {
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
  if (!muro?.attiva || !muro.pagine.length || state.premium !== true || state.uscito || editorAperto()) {
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
  const corpo = state.riposo
    ? riposo(muro)
    : `<div class="mu-pagina mu-pag-${pagina.modello}">${testa(pagina, muro)}${
        pagina.modello === "scene"
          ? paginaScene(pagina)
          : pagina.modello === "ingresso"
            ? paginaIngresso(pagina)
            : paginaStanza(pagina)
      }</div>${finestra()}`;
  /* Mentre il dito trascina un cursore non si ridisegna: la barra la muove il
   * dito, e un aggiornamento di Home Assistant a meta' la farebbe saltare. */
  if (state.trascina) return;
  /* La telecamera non si ricarica a ogni ridisegno: il fotogramma (o il
   * video) che c'era si rimette al suo posto, e solo una nuova si carica. */
  const vecchie = new Map(
    [...nodo.querySelectorAll("img[data-mu-telecamera]")].map((img) => [img.dataset.muTelecamera, img]),
  );
  if (scriviSeCambia(nodo.firstElementChild, corpo)) caricaLeTelecamere(nodo, vecchie);
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
    if (!img.dataset.dmCameraStream) loadCameraFrame({ entity: img.dataset.muTelecamera }, img).catch(() => {});
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
  timerClima = root.setTimeout?.(() => comanda("climate", "set_temperature", { entity_id: id, temperature: nuova }), 700);
}

function allarme(modo, codice = "") {
  const pagina = state.muro?.pagine?.[state.pagina];
  const centrale = centraleDelMuro(pagina);
  const s = stato(centrale);
  if (!s) return;
  const voce = modo === "disarm" ? ALARM_DISARM : ALARM_MODES.find((m) => m.mode === modo);
  if (!voce) return;
  if (alarmCodeNeeded(s, voce.service) && !codice) {
    apriFinestra({ tipo: "codice", scopo: "allarme", modo, scritto: "" });
    return;
  }
  chiudiFinestra();
  comanda("alarm_control_panel", voce.service, { entity_id: centrale, ...(codice ? { code: codice } : {}) });
}

function cifra(k) {
  const f = state.finestra;
  if (!f || f.tipo !== "codice") return;
  if (k === "⌫") f.scritto = (f.scritto || "").slice(0, -1);
  else if (k === "✓") {
    if (f.scopo === "uscita") {
      if (pinGiusto(state.muro, f.scritto)) {
        state.finestra = null;
        apriIlConfigDelMuro();
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
      if (state.compatto) comanda("light", "toggle", { entity_id: entita });
      else apriFinestra({ tipo: "luce", entita });
    } else if (entita && dominio(entita) === "climate")
      apriFinestra({ tipo: "clima", entita, zona: zonaDiQui() });
    else if (entita && dominio(entita) === "cover") apriFinestra({ tipo: "tapparella", entita });
    return;
  }
  event.stopPropagation();
  switch (fa) {
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
      comanda("light", "toggle", { entity_id: id });
      return;
    case "spegni":
      comanda(dominio(id) || "light", "turn_off", { entity_id: id });
      chiudiFinestra();
      return;
    case "livello":
      attendi(id, "luminosita", Number(bersaglio.dataset.muLivello));
      comanda("light", "turn_on", { entity_id: id, brightness_pct: Number(bersaglio.dataset.muLivello) });
      disegna();
      return;
    case "colore": {
      const [, rgb, kelvin] = COLORI[Number(bersaglio.dataset.muColore)] || [];
      comanda("light", "turn_on", { entity_id: id, ...(rgb ? { rgb_color: rgb } : { color_temp_kelvin: kelvin }) });
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
      if (s !== "off") comanda("climate", "turn_off", { entity_id: id });
      else {
        const modi = (attributi(id).hvac_modes || []).filter((m) => m !== "off");
        if (modi.length) comanda("climate", "set_hvac_mode", { entity_id: id, hvac_mode: modi[0] });
        else comanda("climate", "turn_on", { entity_id: id });
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
      } else eseguiAzione(bersaglio.dataset.muAzione, { conferma: Boolean(bersaglio.dataset.muConferma) });
      return;
    case "allarme":
      allarme(bersaglio.dataset.muModo);
      return;
    case "entita": {
      const servizio = servizioDellEntita(id, String(stato(id)?.state || ""));
      if (servizio) comanda(servizio.domain, servizio.service, { entity_id: id });
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
function percentualeDalDito(event, barra, verticale) {
  const r = barra.getBoundingClientRect();
  const p = verticale ? 1 - (event.clientY - r.top) / r.height : (event.clientX - r.left) / r.width;
  return Math.max(1, Math.min(100, Math.round(p * 100)));
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
    state.trascina = { barra, id: barra.dataset.muEntita, verticale };
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
      if (state.muro?.blocco?.attivo) apriFinestra({ tipo: "codice", scopo: "uscita", scritto: "" });
      else apriIlConfigDelMuro();
    }, 2000);
  }
}

function onPointerMove(event) {
  const t = state.trascina;
  if (!t) return;
  const p = percentualeDalDito(event, t.barra, t.verticale);
  t.valore = p;
  const riempi = t.barra.querySelector("i");
  if (riempi) riempi.style[t.verticale ? "height" : "width"] = `${p}%`;
  const pallino = t.barra.querySelector("u");
  if (pallino) pallino.style.left = `${p}%`;
  const scritta = t.barra.querySelector("b");
  if (scritta) scritta.textContent = `${p}%`;
}

function onPointerUp(event) {
  root.clearTimeout?.(state.pressione);
  state.pressione = null;
  const t = state.trascina;
  if (t) {
    state.trascina = null;
    if (t.valore) {
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
    state.pagina = 0;
  }
  if (!state.riposo && eNotte(muro) && fermo > 60 * 1000 && !state.finestra) {
    state.riposo = true;
    state.pagina = 0;
  }
  disegna();
}

function svegliaSeServe(event) {
  const muro = state.muro;
  if (!state.riposo || !muro) return;
  const sensore = muro.risveglio.attivo ? muro.risveglio.entita : "";
  const centrale = centraleDelMuro(muro.pagine[0]);
  const ids = event?.detail?.entity_ids || (event?.detail?.entity_id ? [event.detail.entity_id] : []);
  const tocca = (id) => !ids.length || ids.includes(id);
  if (
    (sensore && tocca(sensore) && String(stato(sensore)?.state) === "on") ||
    (centrale && tocca(centrale) && String(stato(centrale)?.state) === "triggered")
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
  if (state.premium === null && saputo.premium === true && typeof root.__GDAHOME_PREMIUM__ !== "boolean")
    state.premium = true;
  if (!state.fonte && saputo.fonte && saputo.fonteDi === (muro.fonte || "primary") && !root.__DM_MURO_FONTE__)
    state.fonte = saputo.fonte;
  if (state.premium === true && state.fonte) disegna();
  await premiumDellaCasa({ forza });
  if (state.premium === true) await fonteDelMuro(muro, { forza });
  if (state.premium === true && !kioskAttivo()) {
    try {
      setKioskMode(true);
    } catch (_errore) {}
  }
  disegna();
  lasciaIlVelo();
}

function stili() {
  const MURO = `#${ID}`;
  const tokens = (tema) =>
    tema === "dark"
      ? `--bg-sculpted:#0c1322;--card-bg:#161f36;--text:#e6edf7;--text-dim:#92a4c2;--dm-vetrino:rgba(255,255,255,.06);--dm-velo:14%;--dm-cuscino:22%;--dm-grana:.34`
      : `--bg-sculpted:#f0f4f8;--card-bg:#ffffff;--text:#0f172a;--text-dim:#64748b;--dm-vetrino:rgba(255,255,255,.72);--dm-velo:9%;--dm-cuscino:15%;--dm-grana:.5`;
  installStyle(
    "dm-muro-style",
    `
html.dm-muro-acceso,html.dm-muro-acceso body{overflow:hidden!important}
html.dm-solo-muro #editor-modal .ed-tabs,html.dm-solo-muro #editor-modal #dm-alberatura-famiglie,html.dm-solo-muro #editor-modal .dm-cerca-config,html.dm-solo-muro #editor-modal .dm-alberatura-titolo-famiglia{display:none!important}
html.dm-solo-muro #editor-modal .ed-body,html.dm-solo-muro #editor-modal #ed-body{margin-left:0!important;max-width:none!important}
${MURO}{position:fixed;inset:0;z-index:2147482000;overflow:hidden;color:var(--text);font-family:Inter,system-ui,sans-serif;
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
${MURO} .mu-g6{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:1fr 1fr;gap:16px;min-height:0}
${MURO} .mu-g6.mu-scorre{grid-template-rows:none;grid-auto-rows:calc((100% - 16px) / 2);overflow-y:auto;scroll-snap-type:y proximity;overscroll-behavior:contain;scrollbar-width:none}
${MURO} .mu-g6.mu-scorre>*{scroll-snap-align:start}
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
${MURO} .mu-orologione{font-size:240px;line-height:.9}
${MURO} .mu-data{font-size:18px;letter-spacing:.2em}
${MURO} .mu-riposo-riga{display:flex;gap:40px;margin-top:22px;color:#92a4c2;font-weight:700;font-size:20px}
${MURO} .mu-riposo-riga span{display:flex;align-items:center;gap:10px}
${MURO} .mu-tocca{position:absolute;bottom:28px;opacity:.6}
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
${MURO}[data-compatto="1"] .mu-g6{gap:10px}
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
${MURO}[data-verso="verticale"] .mu-g6{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(3,1fr)}
${MURO}[data-verso="verticale"] .mu-g6.mu-scorre{grid-template-rows:none;grid-auto-rows:calc((100% - 32px) / 3)}
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
  root.addEventListener?.("dashboardmodern:state-changed", (event) => {
    svegliaSeServe(event);
    disegna();
  });
  root.addEventListener?.("resize", () => disegna());
  root.addEventListener?.("storage", (event) => {
    if (String(event?.key || "").endsWith(CHIAVE_MURO)) ancora();
  });
  root.dmMuro = {
    rileggi: (opzioni) => rileggi(opzioni),
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
