/* La scheda Meteo nel Config (#206): Clima e acqua › Meteo.
 *
 * Quattro gruppi, come quelli delle Allerte, e in ognuno solo quello che
 * serve alla pagina:
 *
 *   · Previsioni: l'entità weather. È la stessa casella del meteo nella
 *     testata della Home (`dm.home_meteo`): cambiarla qui la cambia anche lì,
 *     perché un meteo per la testata e un altro per la pagina sarebbero due
 *     risposte diverse alla stessa domanda;
 *   · La mia stazione: un sensore per misura, tutti facoltativi. Cinque sono
 *     le caselle «Usa entità proprie» della testata, due quelle della pioggia
 *     che legge già l'irrigazione: si scelgono una volta e valgono ovunque. Il
 *     tasto «Trova i sensori della stazione» li cerca dal `device_class` e
 *     dall'unità che dichiarano, e riempie solo le caselle vuote;
 *   · Radar pioggia: la scheda che stava sotto il meteo nella scheda Home,
 *     spostata qui — la configurazione è la stessa, `cd_radar_meteo`;
 *   · La pagina: l'ordine dei blocchi e quali si vedono.
 *
 * Sotto, la fascia «Sezione visibile» e «Salva sezione», come in ogni scheda.
 */
import {
  BLOCCHI,
  CHIAVE_METEO,
  MISURE_DELLA_STAZIONE,
  normalizzaMeteo,
  spostaIlBlocco,
  trovaLaStazione,
} from "../core/la-pagina-meteo.js";
import { disegnoDelCatalogo } from "../core/catalogo-disegni.js";
import { METEO_TAB, renderMeteo } from "./meteo-section.js";
import { editorDelRadarMarkup, preparaLEditorDelRadar } from "./radar-meteo-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  lexicalGlobal,
  onEditorRedraw,
  readJson,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
  senzaCadere,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_METEO_EDITOR__";
const state = (root[KEY] ||= { installed: false });

export const METEO_EDITOR_TAB = METEO_TAB;

/* La casella del meteo della testata: e' una sola, e qui si scrive quella. */
const CASELLA_DEL_METEO = "dm.home_meteo";
const CHIAVE_BARRA = "cd_barra_casa";

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

/* ── le parole di ogni casella ────────────────────────────────────────── */

function nomeDellaMisura(chiave) {
  return (
    {
      temperatura: t("Temperatura esterna", "Outdoor temperature"),
      umidita: t("Umidità", "Humidity"),
      percepita: t("Temperatura percepita", "Feels-like temperature"),
      pressione: t("Pressione", "Pressure"),
      vento: t("Velocità del vento", "Wind speed"),
      raffica: t("Raffica", "Wind gust"),
      direzione: t("Direzione del vento", "Wind direction"),
      pioggiaOggi: t("Pioggia di oggi", "Rain today"),
      intensita: t("Intensità della pioggia", "Rain rate"),
      uv: t("Indice UV", "UV index"),
      radiazione: t("Radiazione solare", "Solar radiation"),
      luminosita: t("Luminosità", "Illuminance"),
    }[chiave] || chiave
  );
}

const ESEMPI = Object.freeze({
  temperatura: "sensor.outdoor_temperature",
  umidita: "sensor.outdoor_humidity",
  percepita: "sensor.feels_like",
  pressione: "sensor.relative_pressure",
  vento: "sensor.wind_speed",
  raffica: "sensor.wind_gust",
  direzione: "sensor.wind_direction",
  pioggiaOggi: "sensor.daily_rain",
  intensita: "sensor.rain_rate",
  uv: "sensor.uv_index",
  radiazione: "sensor.solar_radiation",
  luminosita: "sensor.illuminance",
});

function nomeDelBlocco(blocco) {
  return (
    {
      adesso: [t("Adesso", "Now"), t("condizioni, percepita, minima e massima", "conditions, feels like, low and high")],
      stazione: [t("La mia stazione", "My station"), t("le misure di casa con le ultime 24 ore", "your home's readings with the last 24 hours")],
      ore: [t("Prossime 24 ore", "Next 24 hours"), t("ora per ora, dalle previsioni", "hour by hour, from the forecast")],
      giorni: [t("Prossimi giorni", "Next days"), t("fino a 7 giorni", "up to 7 days")],
      radar: [t("Radar pioggia", "Rain radar"), t("la fonte si sceglie qui sopra", "the source is chosen above")],
    }[blocco] || [blocco, ""]
  );
}

/* ── leggere e scrivere ───────────────────────────────────────────────── */

function mappature() {
  const scritte = readJson("cd_entity_overrides", {}) || {};
  const vive = lexicalGlobal("ENTITY_OVERRIDES");
  return {
    ...(scritte && typeof scritte === "object" ? scritte : {}),
    ...(vive && typeof vive === "object" ? vive : {}),
  };
}

/** Cosa c'e' scritto adesso, casella per casella: `{ meteo, misure: {…}, pagina }`. */
export function configurazioneDelMeteo() {
  const caselle = mappature();
  const barra = readJson(CHIAVE_BARRA, {}) || {};
  const pagina = normalizzaMeteo(readJson(CHIAVE_METEO, {}));
  const misure = {};
  for (const misura of MISURE_DELLA_STAZIONE) {
    const scritta = clean(
      misura.casella
        ? caselle[misura.casella]
        : misura.barra
          ? barra?.[misura.barra]
          : pagina[misura.pagina],
    );
    misure[misura.chiave] = scritta === misura.casella ? "" : scritta;
  }
  const meteo = clean(caselle[CASELLA_DEL_METEO]);
  return { meteo: meteo === CASELLA_DEL_METEO ? "" : meteo, misure, pagina };
}

/* Le caselle della testata si scrivono come le scrive il guscio: nelle
 * mappature salvate, e nella copia che il guscio tiene in memoria — e' quella
 * che il proxy degli stati consulta a ogni lettura. Una casella vuota si
 * toglie: «nessun sensore» e «non l'ho detto» sono la stessa cosa. */
function scriviLeCaselle(voci) {
  const dati = { ...(readJson("cd_entity_overrides", {}) || {}) };
  const vive = lexicalGlobal("ENTITY_OVERRIDES");
  const tutte = { ...(vive && typeof vive === "object" ? vive : {}), ...dati };
  for (const [ref, valore] of Object.entries(voci)) {
    const entita = clean(valore);
    if (entita && entita.includes(".") && entita !== ref) {
      dati[ref] = entita;
      tutte[ref] = entita;
    } else {
      delete dati[ref];
      delete tutte[ref];
    }
  }
  writeJsonIfChanged("cd_entity_overrides", dati);
  try {
    root.cdApplyCanonicalOverrides?.(tutte);
  } catch (_errore) {}
}

export function salvaIlMeteo(config) {
  const caselle = { [CASELLA_DEL_METEO]: config.meteo };
  const barra = { ...(readJson(CHIAVE_BARRA, {}) || {}) };
  const pagina = { ...normalizzaMeteo(readJson(CHIAVE_METEO, {})), ...(config.pagina || {}) };
  for (const misura of MISURE_DELLA_STAZIONE) {
    const entita = clean(config.misure?.[misura.chiave]);
    if (misura.casella) caselle[misura.casella] = entita;
    else if (misura.barra) barra[misura.barra] = entita;
    else pagina[misura.pagina] = entita;
  }
  scriviLeCaselle(caselle);
  writeJsonIfChanged(CHIAVE_BARRA, barra);
  writeJsonIfChanged(CHIAVE_METEO, normalizzaMeteo(pagina));
  try {
    root.render?.();
  } catch (_errore) {}
  try {
    renderMeteo();
  } catch (_errore) {}
}

/* Quello che sta nelle caselle adesso, sopra quello che c'e' scritto. */
function raccogli(body) {
  const config = configurazioneDelMeteo();
  const modulo = body || doc?.getElementById("ed-body");
  if (!modulo) return config;
  const meteo = modulo.querySelector('[data-dm-meteo-campo="meteo"]');
  if (meteo) config.meteo = clean(meteo.value);
  for (const campo of modulo.querySelectorAll("[data-dm-meteo-misura]"))
    config.misure[clean(campo.dataset.dmMeteoMisura)] = clean(campo.value);
  return config;
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function casellaMarkup({ id, attributo, valore, etichetta, esempio, aiuto = "" }) {
  return `<label class="ed-slot dm-todo-ed-field"><span class="ed-slot-lbl">${esc(etichetta)}</span>
      <span class="ed-form-row"><input id="${id}" class="ed-input mono" ${attributo}
        value="${esc(valore)}" placeholder="${esc(esempio)}" autocomplete="off" spellcheck="false"><button
        type="button" class="dm-entity-picker" data-dm-meteo-pick="${id}"
        aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>${
          aiuto ? `<small>${esc(aiuto)}</small>` : ""
        }</label>`;
}

function gruppoMarkup(chiave, disegno, titolo, corpo, accanto = "") {
  return `<article class="ed-row dm-todo-ed-row dm-allerte-ed-fonte dm-meteo-ed-gruppo" data-open="true" data-dm-meteo-gruppo="${chiave}">
      <div class="dm-allerte-ed-testa"><span aria-hidden="true">${disegnoDelCatalogo(disegno, 26)}</span><strong>${esc(titolo)}</strong>${accanto}</div>
      <div class="dm-todo-ed-body">${corpo}</div>
    </article>`;
}

function previsioniMarkup(config) {
  return gruppoMarkup(
    "previsioni",
    "sun",
    t("Previsioni", "Forecast"),
    casellaMarkup({
      id: "dm-meteo-entita",
      attributo: 'data-dm-meteo-campo="meteo"',
      valore: config.meteo,
      etichetta: t("Entità meteo (weather)", "Weather entity (weather)"),
      esempio: "weather.home",
      aiuto: t(
        "È la stessa del meteo nella testata della Home: cambiarla qui la cambia anche lì. Le previsioni ora per ora e dei giorni si chiedono a lei (weather.get_forecasts), ogni mezz'ora.",
        "It is the same as the weather in the Home header: changing it here changes it there too. The hourly and daily forecasts are asked of it (weather.get_forecasts), every half hour.",
      ),
    }),
  );
}

function stazioneMarkup(config) {
  const scelte = Object.values(config.misure).filter(Boolean).length;
  const caselle = MISURE_DELLA_STAZIONE.map((misura) =>
    casellaMarkup({
      id: `dm-meteo-${misura.chiave}`,
      attributo: `data-dm-meteo-misura="${misura.chiave}"`,
      valore: config.misure[misura.chiave],
      etichetta: nomeDellaMisura(misura.chiave),
      esempio: ESEMPI[misura.chiave],
    }),
  ).join("");
  return gruppoMarkup(
    "stazione",
    "thermometer",
    t("La mia stazione", "My station"),
    `<button type="button" class="ed-btn-add dm-meteo-ed-trova" data-dm-meteo-trova>🪄 ${esc(
      t("Trova i sensori della stazione", "Find the station's sensors"),
    )}</button>
      <div class="dm-meteo-ed-griglia">${caselle}</div>
      <div class="dm-meteo-ed-nota">${esc(
        t(
          "Tutti facoltativi, uno per tipo. Temperatura, umidità, percepita e vento sono gli stessi campi della testata della Home; pioggia e intensità sono quelli che usa già l'Irrigazione. Si scelgono una volta sola e valgono ovunque.",
          "All optional, one per type. Temperature, humidity, feels-like and wind are the same fields as the Home header; rain and rate are the ones Irrigation already uses. They are chosen once and apply everywhere.",
        ),
      )}</div>`,
    `<span class="dm-meteo-ed-conto" data-dm-meteo-conto>${scelte} ${esc(t("su", "of"))} ${MISURE_DELLA_STAZIONE.length}</span>`,
  );
}

function radarMarkup() {
  return gruppoMarkup("radar", "radar", t("Radar pioggia", "Rain radar"), editorDelRadarMarkup());
}

function paginaMarkup(config) {
  const { ordine, spenti } = config.pagina;
  const righe = ordine
    .map((blocco, indice) => {
      const [nome, sotto] = nomeDelBlocco(blocco);
      const acceso = !spenti.includes(blocco);
      return `<div class="dm-meteo-ed-blocco" data-dm-meteo-blocco-ed="${blocco}" data-spento="${String(!acceso)}">
        <div class="dm-meteo-ed-frecce">
          <button type="button" class="ed-del" data-dm-meteo-su="${blocco}" ${indice === 0 ? "disabled" : ""}
            aria-label="${esc(t("Sposta su", "Move up"))}">▲</button>
          <button type="button" class="ed-del" data-dm-meteo-giu="${blocco}" ${indice === ordine.length - 1 ? "disabled" : ""}
            aria-label="${esc(t("Sposta giù", "Move down"))}">▼</button>
        </div>
        <div><strong>${esc(nome)}</strong><small>${esc(sotto)}</small></div>
        <button type="button" class="dm-meteo-ed-int" role="switch" aria-checked="${String(acceso)}"
          data-dm-meteo-int="${blocco}" aria-label="${esc(nome)}"></button>
      </div>`;
    })
    .join("");
  return gruppoMarkup("pagina", "sliders", t("La pagina", "The page"), `<div class="dm-meteo-ed-blocchi">${righe}</div>`);
}

function fasciaMarkup() {
  try {
    return root.cdSecToggleHtml?.("meteo") || "";
  } catch (_errore) {
    return "";
  }
}

function corpoMarkup() {
  const config = configurazioneDelMeteo();
  return `${fasciaMarkup()}<div class="dm-meteo-ed">
    <div class="ed-intro">${esc(
      t(
        "La pagina Meteo: com'è il tempo adesso, le misure della tua stazione con le ultime 24 ore, le previsioni ora per ora e dei prossimi giorni, e il radar della pioggia. Basta l'entità meteo: il resto è facoltativo, e un blocco senza dati non compare.",
        "The Weather page: what the weather is like now, your station's readings with the last 24 hours, the hourly and daily forecast, and the rain radar. The weather entity is enough: the rest is optional, and a block with no data does not show.",
      ),
    )}</div>
    <div class="ed-list dm-todo-ed-list">
      ${previsioniMarkup(config)}
      ${stazioneMarkup(config)}
      ${radarMarkup()}
      ${paginaMarkup(config)}
      <button type="button" class="ed-save-btn" data-dm-meteo-save>💾 ${esc(t("Salva meteo", "Save weather"))}</button>
    </div></div>`;
}

function sezioneNascosta() {
  try {
    return root.cdCfg?.("cd_sections")?.meteo === false;
  } catch (_errore) {
    return false;
  }
}

export function ensureMeteoEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== METEO_EDITOR_TAB) return false;
  /* Il radar non entra nella firma: la sua scheda si scrive a ogni tasto e si
   * ridisegna da se', e rifare tutta la scheda a ogni lettera battuta nelle
   * sue caselle toglierebbe il cursore di mano. */
  const firma = `${JSON.stringify(configurazioneDelMeteo())}|${sezioneNascosta()}`;
  if (body.dataset.dmMeteoEditor === firma && body.querySelector(".dm-meteo-ed")) return true;
  body.dataset.dmMeteoEditor = firma;
  body.innerHTML = corpoMarkup();
  body.dataset.renderer = "meteo";
  preparaLEditorDelRadar(body.querySelector("[data-dm-radar-ed]"));
  return true;
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmMeteoEditor;
  ensureMeteoEditor();
}

/* ── i gesti ──────────────────────────────────────────────────────────── */

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== METEO_EDITOR_TAB || !body.contains(event.target)) return;
  const pick = event.target.closest("[data-dm-meteo-pick]");
  if (pick) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(pick.dataset.dmMeteoPick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }
  if (event.target.closest("[data-dm-meteo-trova]")) {
    event.preventDefault();
    const config = raccogli(body);
    const trovate = trovaLaStazione(allStates(), config.misure);
    const quante = Object.keys(trovate).length;
    for (const [chiave, entita] of Object.entries(trovate)) config.misure[chiave] = entita;
    /* Trovare e' gia' una scelta: si salva, e la scheda si ridisegna con le
     * caselle piene. Una proposta sbagliata si toglie con la sua matita. */
    if (quante) salvaIlMeteo(config);
    ridisegna();
    root.edToast?.(
      quante
        ? t(`🪄 ${quante} sensori trovati`, `🪄 ${quante} sensors found`)
        : t("🪄 Nessun sensore nuovo trovato", "🪄 No new sensor found"),
    );
    return;
  }
  /* L'ordine e gli interruttori dei blocchi: ogni gesto e' gia' una scelta, e
   * si salva subito insieme a quello che c'e' nelle caselle. */
  const su = event.target.closest("[data-dm-meteo-su]");
  const giu = event.target.closest("[data-dm-meteo-giu]");
  const interruttore = event.target.closest("[data-dm-meteo-int]");
  if (su || giu || interruttore) {
    event.preventDefault();
    const config = raccogli(body);
    const pagina = { ...config.pagina };
    if (su) pagina.ordine = spostaIlBlocco(pagina.ordine, clean(su.dataset.dmMeteoSu), -1);
    if (giu) pagina.ordine = spostaIlBlocco(pagina.ordine, clean(giu.dataset.dmMeteoGiu), 1);
    if (interruttore) {
      const blocco = clean(interruttore.dataset.dmMeteoInt);
      pagina.spenti = pagina.spenti.includes(blocco)
        ? pagina.spenti.filter((voce) => voce !== blocco)
        : [...pagina.spenti, blocco].filter((voce) => BLOCCHI.includes(voce));
    }
    salvaIlMeteo({ ...config, pagina });
    ridisegna();
    return;
  }
  if (event.target.closest("[data-dm-meteo-save]")) {
    event.preventDefault();
    salvaIlMeteo(raccogli(body));
    ridisegna();
    root.edToast?.(t("💾 Meteo salvato", "💾 Weather saved"));
  }
}

export function ensureMeteoEditorTab() {
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette || linguette.querySelector(`.ed-tab[data-tab="${METEO_EDITOR_TAB}"]`)) return false;
  const linguetta = doc.createElement("button");
  linguetta.className = "ed-tab";
  linguetta.dataset.tab = METEO_EDITOR_TAB;
  linguetta.textContent = `🌦️ ${t("Meteo", "Weather")}`;
  linguetta.addEventListener("click", () => root.editorSwitch?.(METEO_EDITOR_TAB));
  const prima = linguette.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(linguetta);
  else linguette.append(linguetta);
  return true;
}

function installStyles() {
  installStyle(
    "dm-meteo-editor-style",
    `
      #ed-body .dm-meteo-ed-gruppo{display:block}
      #ed-body .dm-meteo-ed-griglia{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      @media(max-width:760px){#ed-body .dm-meteo-ed-griglia{grid-template-columns:minmax(0,1fr)}}
      #ed-body .dm-meteo-ed-nota{font-size:11.5px;font-weight:700;line-height:1.45;color:var(--text-dim,#64748b);margin:2px 2px 4px}
      #ed-body .dm-meteo-ed-trova{width:100%;margin:2px 0 10px}
      #ed-body .dm-meteo-ed-conto{font-size:10px;font-weight:900;letter-spacing:.6px;text-transform:uppercase;padding:3px 8px;border-radius:999px;
        margin-left:auto;color:#047857;background:color-mix(in srgb,#10b981 14%,transparent)}
      #ed-body .dm-meteo-ed-blocchi{display:grid;gap:8px}
      #ed-body .dm-meteo-ed-blocco{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;
        padding:10px 12px;border-radius:14px;border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff)}
      #ed-body .dm-meteo-ed-blocco strong{font-size:13px;font-weight:900;display:block;color:var(--text,#0f172a)}
      #ed-body .dm-meteo-ed-blocco small{font-size:10.5px;font-weight:700;color:var(--text-dim,#64748b)}
      #ed-body .dm-meteo-ed-blocco[data-spento="true"]{opacity:.55}
      #ed-body .dm-meteo-ed-frecce{display:flex;gap:4px}
      #ed-body .dm-meteo-ed-frecce .ed-del[disabled]{opacity:.25;cursor:default}
      #ed-body .dm-meteo-ed-int{position:relative;width:42px;height:24px;padding:0;border:0;border-radius:999px;background:#cbd5e1;flex:0 0 auto;cursor:pointer}
      #ed-body .dm-meteo-ed-int::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left .15s}
      #ed-body .dm-meteo-ed-int[aria-checked="true"]{background:#0ea5e9}
      #ed-body .dm-meteo-ed-int[aria-checked="true"]::after{left:21px}
    `,
  );
}

export function installMeteoEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  wrapFunction("apriConfigEntita", "__dmMeteoEditor", () => {
    ensureMeteoEditorTab();
    ensureMeteoEditor();
  });
  ensureMeteoEditorTab();
  onEditorRedraw("__dmMeteoEditor", () => {
    root.queueMicrotask?.(() => {
      ensureMeteoEditorTab();
      ensureMeteoEditor();
    });
  });
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensureMeteoEditorTab();
        ensureMeteoEditor();
      });
    });
  ensureMeteoEditor();
  return true;
}

senzaCadere(installMeteoEditor);
