/* «Dispositivi» dell'app (Premium): i dispositivi della casa e le
 * integrazioni di Home Assistant.
 *
 * «Io rivedrei anche la sezione dispositivi e lì eventualmente inserirei le
 * integrazioni. Quella sezione dispositivi così com'è non ha senso»: era un
 * elenco di entita' per tipo. Adesso e' una pagina a schermo pieno con due
 * linguette, e la stessa faccia delle Automazioni (testata, tre tessere,
 * filtri, gruppi compatti, il foglio che sale dal basso):
 *
 *  - **Dispositivi**: quelli veri di Home Assistant, stanza per stanza (o
 *    per integrazione). Una riga per dispositivo, con marca e modello, il
 *    valore o l'interruttore della sua entita' principale; il foglio porta
 *    tutte le sue entita', comandabili, e «Ricarica l'integrazione».
 *  - **Integrazioni**: quelle installate, coi dispositivi e le entita' che
 *    portano e lo stato; «↻» le ricarica dall'elenco, il foglio le ricarica,
 *    ne apre le opzioni, le disattiva e le elimina (con la conferma). In cima
 *    quelle trovate in rete da aggiungere e quelle da riparare; «＋ Aggiungi»
 *    cerca fra tutte quelle che Home Assistant sa aggiungere e apre la sua
 *    procedura guidata (`procedura-guidata-section.js`).
 *
 * ── Chi puo' cosa ─────────────────────────────────────────────────────────
 *
 * Solo nell'app (il menu laterale la apre con `gdahomeApriIDispositivi`),
 * solo per chi amministra Home Assistant, solo con GdAHome Premium: lo
 * decide il ponte (`ponte/src/integrazioni.js`), che risponde «no» al resto,
 * e qui il no si racconta. Senza Premium la pagina e' velata come le
 * Automazioni. I valori e i comandi delle entita' sono quelli che la plancia
 * ha gia' (gli stati e i servizi di Home Assistant).
 */
import { creaLaMemoriaDeiLoghi } from "../core/loghi-degli-aggiornamenti.js";
import { oggettoWidget } from "../core/oggetti-widget.js";
import { DOVE_SI_COMPRA, scopriPremium, statoDelleAutomazioni } from "./automazioni-section.js";
import { vestiLeCarte } from "./automazioni-casa-section.js";
import { apriLaProcedura, proceduraAperta } from "./procedura-guidata-section.js";
import {
  activeLocale,
  allStates,
  chiamaServizio,
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  installStyle,
  root,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_DISPOSITIVI_APP__";
const state = (root[KEY] ||= {
  installed: false,
  inApp: false,
  linguetta: "dispositivi",
  premium: null,
  vietato: "",
  errore: "",
  casa: null,
  integr: null,
  catalogo: null,
  chiedendo: false,
  per: "stanza",
  cerca: "",
  cercaCat: "",
  chiusi: [],
  /* Le integrazioni aperte: partono chiuse, come le schede di Home
   * Assistant, e si apre quella che interessa. */
  aperte: [],
  foglio: null,
  avviso: "",
  inCorso: {},
});

export const ID_DEI_DISPOSITIVI = "page-dispositivi";
const ID_DEL_FOGLIO = "dv-foglio";
const VIOLA = "#7c3aed";
const ASPETTA = 30_000;

/* ── la pagina a schermo pieno dell'app (anche per gli Aiutanti) ─────────── */

const PAGINE_DELL_APP = ["page-automazioni", ID_DEI_DISPOSITIVI, "page-aiutanti"];
const doveEra = {};

export function diciAllApp(quale) {
  try {
    if (root.gdahomeDice?.postMessage) root.gdahomeDice.postMessage(quale);
  } catch (_errore) {}
  try {
    if (root.parent && root.parent !== root)
      root.parent.postMessage({ gdahome: "pagina", dove: quale }, "*");
  } catch (_errore) {}
}

const linguetta = (quale) =>
  [...(doc?.querySelectorAll?.(".tab") || [])].find((v) => v.getAttribute("data-tab") === quale);

/** Apre una pagina a schermo pieno dell'app, come le Automazioni: le altre
 * pagine si spengono, e un'altra pagina dell'app aperta si chiude. */
export function apriAPienoSchermo(id, quale) {
  if (!doc?.body) return null;
  doc.getElementById("editor-modal")?.querySelector?.(".ed-head-close")?.click?.();
  if (doc.getElementById("page-automazioni")) root.gdahomeTornaDalleAutomazioni?.();
  for (const altra of PAGINE_DELL_APP)
    if (altra !== id && altra !== "page-automazioni") doc.getElementById(altra)?.remove();
  const attiva = doc.querySelector(".tab.active")?.getAttribute("data-tab") || "";
  if (!doc.getElementById(id)) doveEra[id] = attiva && attiva !== "config" ? attiva : "home";
  doc.querySelectorAll(".page.active").forEach((p) => p.classList.remove("active"));
  doc.querySelectorAll(".tab.active").forEach((p) => p.classList.remove("active"));
  doc.body.classList.remove("gdahome-in-config");
  let pagina = doc.getElementById(id);
  if (!pagina) {
    pagina = doc.createElement("section");
    pagina.id = id;
    pagina.className = "page";
    const config = doc.getElementById("page-config");
    const casa = doc.getElementById("page-home");
    if (config) config.before(pagina);
    else if (casa?.parentElement) casa.parentElement.append(pagina);
    else doc.body.append(pagina);
  }
  pagina.classList.add("active");
  vestiLeCarte();
  root.scrollTo?.(0, 0);
  diciAllApp(quale);
  return pagina;
}

/** Torna alla plancia, dov'era. */
export function tornaDaPienoSchermo(id) {
  if (!doc?.getElementById?.(id)) return false;
  doc.getElementById(id).remove();
  const dove = linguetta(doveEra[id] || "home") || linguetta("home");
  try {
    dove?.click?.();
  } catch (_errore) {}
  if (!doc.querySelector(".page.active")) doc.getElementById("page-home")?.classList?.add("active");
  diciAllApp(doc.querySelector(".tab.active")?.getAttribute("data-tab") || "home");
  return true;
}

/** La testata delle pagine dell'app: quella delle Automazioni. */
export function testataDellApp(titolo, sotto) {
  const scuro = doc?.documentElement?.dataset?.theme === "dark";
  return `<header class="dm-page-mast" style="--dm-mast-a:${scuro ? "167,139,250" : "124,58,237"};--dm-mast-b:99,102,241"><button type="button" class="back-home-btn dm-mast-back" onclick="document.querySelector('[data-tab=&quot;home&quot;]').click(); if(navigator.vibrate)navigator.vibrate(5);"><span class="bh-icon">←</span><span>${esc(
    t("Home", "Home"),
  )}</span></button><h2 class="dm-page-mast-title">${esc(titolo)}</h2><div class="dm-page-mast-sub">${esc(sotto)}</div></header>`;
}

/** Il velo di Premium, sopra il contenuto sfocato: quello delle Automazioni. */
export function veloPremium({ sotto, disegno, titolo, frase, punti, attributo }) {
  return `<div class="ad-chiusa"><div class="sotto" aria-hidden="true" inert>${sotto}</div><div class="velo"><div class="carta"><div class="ill">${oggettoWidget(
    disegno,
    "",
    `${attributo}-velo`,
  )}<span aria-hidden="true">✨</span></div><span class="tag">${esc(t("PREMIUM · IN ARRIVO", "PREMIUM · COMING SOON"))}</span><h3>${esc(titolo)}</h3><p>${esc(frase)}</p><ul>${punti
    .map((p) => `<li>${esc(p)}</li>`)
    .join(
      "",
    )}</ul><button type="button" ${attributo}-scopri>${esc(t("Scopri Premium", "Discover Premium"))}</button><small>${esc(DOVE_SI_COMPRA())}</small></div></div></div>`;
}

/** Il no del ponte, in parole: Premium, chi amministra, o un'altra cosa. */
export function capisciIlNo(errore) {
  const m = clean(errore?.message);
  if (/premium/i.test(m)) return { premium: false };
  if (/amministra|dall'app|chi e' entrato/i.test(m)) return { vietato: m };
  if (/non conosco|unknown/i.test(m))
    return {
      errore: t(
        "Serve l'add-on GdAHome aggiornato: questa pagina passa da lì.",
        "This page needs the up-to-date GdAHome add-on.",
      ),
    };
  return {
    errore:
      m === "timeout"
        ? t("Home Assistant non ha risposto in tempo.", "Home Assistant did not answer in time.")
        : m || t("Non ha funzionato.", "That did not work."),
  };
}

export function vietatoHtml() {
  return `<div class="ad-vuoto"><div class="ill">${oggettoWidget("sicurezza", "", "dv-vietato")}<span aria-hidden="true">🔒</span></div><h3>${esc(
    t("Solo per chi amministra", "Admins only"),
  )}</h3><p>${esc(
    t(
      "Questa pagina cambia Home Assistant: la usa chi lo amministra. Chiedi a chi ha installato la casa di darti i permessi, o di farlo per te.",
      "This page changes Home Assistant: it's for its administrators. Ask whoever set up the home to grant you access, or to do it for you.",
    ),
  )}</p></div>`;
}

/* ── cosa c'e' in casa ───────────────────────────────────────────────────── */

const lingua = () => clean(activeLocale()) || "it";
const stati = () => {
  try {
    return allStates() || {};
  } catch (_errore) {
    return {};
  }
};
const dominio = (id) => clean(id).split(".")[0];

async function chiediTutto() {
  if (state.chiedendo) return;
  state.chiedendo = true;
  try {
    const [casa, integr] = await Promise.all([
      chiediAHomeAssistant({ type: "ponte/dispositivi/elenco", lingua: lingua() }, ASPETTA),
      chiediAHomeAssistant({ type: "ponte/integrazioni/elenco", lingua: lingua() }, ASPETTA),
    ]);
    Object.assign(state, { casa, integr, premium: true, vietato: "", errore: "" });
  } catch (errore) {
    Object.assign(state, capisciIlNo(errore));
  } finally {
    state.chiedendo = false;
    ridisegna();
  }
}

/* Il disegno e il colore di un'entita', dal dominio e dalla classe. */
const DISEGNI = {
  light: ["luci", "#f59e0b"],
  switch: ["prese", "#0ea5e9"],
  climate: ["clima", "#ef4444"],
  water_heater: ["scaldabagno", "#f97316"],
  cover: ["tapparelle", "#6366f1"],
  camera: ["telecamere", "#334155"],
  lock: ["sicurezza", "#dc2626"],
  alarm_control_panel: ["sicurezza", "#dc2626"],
  media_player: ["media", "#8b5cf6"],
  vacuum: ["robot", "#14b8a6"],
  fan: ["aria", "#0ea5e9"],
  humidifier: ["umidita", "#0ea5e9"],
  update: ["aggiornamenti", "#64748b"],
  person: ["presenza", "#10b981"],
  device_tracker: ["presenza", "#10b981"],
};
const PER_CLASSE = {
  temperature: ["temperatura", "#f97316"],
  humidity: ["umidita", "#0ea5e9"],
  battery: ["batterie", "#16a34a"],
  power: ["energia", "#f59e0b"],
  energy: ["energia", "#f59e0b"],
  door: ["aperture", "#14b8a6"],
  window: ["finestra", "#14b8a6"],
  opening: ["aperture", "#14b8a6"],
  motion: ["presenza", "#10b981"],
  occupancy: ["presenza", "#10b981"],
  moisture: ["allagamenti", "#0284c7"],
  smoke: ["fumo", "#dc2626"],
};
function disegnoDi(entity) {
  const s = stati()[entity];
  const classe = clean(s?.attributes?.device_class);
  return PER_CLASSE[classe] || DISEGNI[dominio(entity)] || ["widget", VIOLA];
}

const COMANDABILI = ["light", "switch", "fan", "input_boolean", "siren", "humidifier"];
const PRIMA = [
  "light",
  "switch",
  "climate",
  "cover",
  "fan",
  "lock",
  "media_player",
  "vacuum",
  "water_heater",
  "humidifier",
  "camera",
  "sensor",
  "binary_sensor",
];

function principaleDi(d) {
  const buone = d.entita.filter((e) => !e.diagnostica);
  const elenco = buone.length ? buone : d.entita;
  for (const dom of PRIMA) {
    const e = elenco.find((x) => dominio(x.id) === dom && !(dom === "sensor" && x.batteria));
    if (e) return e.id;
  }
  return elenco[0]?.id || "";
}

const SPENTI = new Set(["unavailable", "unknown"]);
const nonRisponde = (d) =>
  d.entita.length > 0 &&
  d.entita.every((e) => !stati()[e.id] || SPENTI.has(clean(stati()[e.id]?.state)));

function valoreDi(entity) {
  const s = stati()[entity];
  if (!s) return "—";
  const v = clean(s.state);
  if (v === "unavailable") return t("Non risponde", "Not answering");
  if (v === "unknown") return "—";
  const apribile = ["door", "window", "opening", "garage_door"].includes(
    clean(s.attributes?.device_class),
  );
  if (dominio(entity) === "binary_sensor" && apribile)
    return v === "on" ? t("Aperta", "Open") : t("Chiusa", "Shut");
  if (v === "on") return t("Acceso", "On");
  if (v === "off") return t("Spento", "Off");
  if (dominio(entity) === "cover")
    return v === "open" ? t("Aperta", "Open") : v === "closed" ? t("Chiusa", "Shut") : v;
  if (dominio(entity) === "climate") {
    const temp = s.attributes?.current_temperature;
    return temp !== undefined && temp !== null ? `${String(temp).replace(".", ",")}°` : v;
  }
  const unita = clean(s.attributes?.unit_of_measurement);
  const n = Number(v);
  const numero =
    Number.isFinite(n) && v !== "" ? String(Math.round(n * 10) / 10).replace(".", ",") : v;
  return unita ? `${numero} ${unita}` : numero;
}

function nomeDellEntita(e, d) {
  const s = stati()[e.id];
  let nome = clean(e.nome) || clean(s?.attributes?.friendly_name) || e.id;
  if (d?.nome && nome.toLowerCase().startsWith(`${d.nome.toLowerCase()} `))
    nome = nome.slice(d.nome.length + 1);
  return nome || clean(d?.nome) || e.id;
}

/* ── i gruppi ────────────────────────────────────────────────────────────── */

const cerca = (testo, parole) =>
  !clean(parole) || clean(testo).toLowerCase().includes(clean(parole).toLowerCase());

function gruppoHtml({
  chiave,
  titolo,
  disegno,
  colore,
  righe,
  conta,
  chiuso = null,
  segno = "",
  sotto = "",
}) {
  const eChiuso = chiuso ?? state.chiusi.includes(chiave);
  return `<section class="aug${eChiuso ? " chiuso" : ""}${segno ? " dv-int" : ""}" style="--c:${colore}" data-aug="${esc(chiave)}"><button type="button" class="aug-testa" data-dv-gruppo="${esc(
    chiave,
  )}" aria-expanded="${!eChiuso}"><span class="aug-freccia" aria-hidden="true">${eChiuso ? "▸" : "▾"}</span>${
    segno || `<span class="aug-ico">${oggettoWidget(disegno, "", `dv-g-${chiave}`)}</span>`
  }<span class="aug-titolo">${esc(titolo)}${sotto ? `<small>${esc(sotto)}</small>` : ""}</span><span class="aug-conta" data-on="true">${conta}</span></button><div class="aug-righe">${righe.join("")}</div></section>`;
}

let disegni = 0;
const disegno = (chiave) => oggettoWidget(chiave, "", `dv-${chiave}-${disegni++ % 200}`);

function interruttore(entity, nome) {
  const acceso = clean(stati()[entity]?.state) === "on";
  return `<button type="button" class="aug-int" role="switch" aria-checked="${acceso}" data-dv-int="${esc(entity)}" aria-label="${esc(
    t(`Accendi o spegni ${nome}`, `Turn ${nome} on or off`),
  )}"></button>`;
}

function rigaDelDispositivo(d) {
  const p = principaleDi(d);
  const [chiave, colore] = disegnoDi(p);
  const muto = nonRisponde(d);
  const marca = [d.marca, d.modello].filter(Boolean).join(" ");
  const quante =
    d.entita.length === 1
      ? t("1 entità", "1 entity")
      : t(`${d.entita.length} entità`, `${d.entita.length} entities`);
  const destra =
    !muto && COMANDABILI.includes(dominio(p))
      ? interruttore(p, d.nome)
      : `<span class="aug-quando dv-val${muto ? " muto" : ""}">${esc(muto ? t("Non risponde", "Not answering") : valoreDi(p))}</span>`;
  return `<div class="aug-riga${muto ? " spenta" : ""}" style="--c:${colore}" data-dv-disp="${esc(d.id)}" role="button" tabindex="0"><span class="aug-orb">${disegno(
    chiave,
  )}</span><span class="aug-testo"><b class="aug-nome"><span>${esc(d.nome)}</span></b><small class="aug-fr">${esc([marca, quante].filter(Boolean).join(" · "))}</small></span>${destra}</div>`;
}

function dispositiviHtml() {
  const casa = state.casa || { stanze: [], dispositivi: [] };
  const tutti = casa.dispositivi || [];
  const stanze = new Map((casa.stanze || []).map((s) => [s.id, s.nome]));
  const visti = tutti.filter((d) =>
    cerca(
      [d.nome, d.marca, d.modello, d.integrazione, stanze.get(d.stanza)].join(" "),
      state.cerca,
    ),
  );
  const muti = tutti.filter(nonRisponde).length;
  const entita = tutti.reduce((n, d) => n + d.entita.length, 0);
  const comandi = tutti.reduce(
    (n, d) =>
      n +
      d.entita.filter((e) => !e.diagnostica && !["sensor", "binary_sensor"].includes(dominio(e.id)))
        .length,
    0,
  );
  const kpi = `<div class="ad-kpi"><div class="dm-lucip-kpi on"><span>${esc(t("Dispositivi", "Devices"))}</span><b>${tutti.length}</b><small>${esc(
    stanze.size === 1
      ? t("in 1 stanza", "in 1 room")
      : t(`in ${stanze.size} stanze`, `in ${stanze.size} rooms`),
  )}</small></div><div class="dm-lucip-kpi"><span>${esc(t("Entità", "Entities"))}</span><b>${entita}</b><small>${esc(
    t(`${comandi} comandabili`, `${comandi} controllable`),
  )}</small></div><div class="dm-lucip-kpi${muti ? " rosso" : ""}"><span>${esc(t("Non rispondono", "Unreachable"))}</span><b>${muti}</b><small>${esc(
    muti ? t("da guardare", "to check") : t("tutti in linea", "all online"),
  )}</small></div></div>`;
  const filtri = `<div class="ad-filtri"><span class="ad-seg-riga"><span class="ad-seg">${[
    ["stanza", t("Per stanza", "By room")],
    ["integrazione", t("Per integrazione", "By integration")],
  ]
    .map(
      ([k, n]) =>
        `<button type="button" data-dv-per="${k}"${state.per === k ? ' class="si"' : ""}>${esc(n)}</button>`,
    )
    .join(
      "",
    )}</span></span><span class="ad-cerca-riga"><label class="ad-cerca"><span aria-hidden="true">🔍</span><input type="search" data-dv-cerca value="${esc(
    state.cerca,
  )}" placeholder="${esc(t("Cerca un dispositivo…", "Search a device…"))}"></label></span></div>`;
  const gruppi = new Map();
  for (const d of visti) {
    const chiave = state.per === "stanza" ? `s:${d.stanza || "-"}` : `i:${d.dominio || "-"}`;
    const titolo =
      state.per === "stanza"
        ? stanze.get(d.stanza) || t("Senza stanza", "No room")
        : d.integrazione || t("Altro", "Other");
    if (!gruppi.has(chiave)) gruppi.set(chiave, { chiave, titolo, voci: [] });
    gruppi.get(chiave).voci.push(d);
  }
  const ordinati = [...gruppi.values()].sort((a, b) =>
    a.chiave.endsWith(":-") ? 1 : b.chiave.endsWith(":-") ? -1 : a.titolo.localeCompare(b.titolo),
  );
  const corpo = ordinati.length
    ? `<div class="aug-griglia">${ordinati
        .map((g) =>
          gruppoHtml({
            chiave: g.chiave,
            titolo: g.titolo,
            disegno: state.per === "stanza" ? "stanze" : "widget",
            colore: VIOLA,
            conta: g.voci.length,
            righe: g.voci.map(rigaDelDispositivo),
          }),
        )
        .join("")}</div>`
    : `<p class="ad-nessuna">${esc(tutti.length ? t("Nessun dispositivo con queste parole.", "No device matches these words.") : t("Nessun dispositivo in Home Assistant.", "No devices in Home Assistant."))}</p>`;
  return `${kpi}${filtri}<div data-dv-gruppi>${corpo}</div>`;
}

/* ── le integrazioni ─────────────────────────────────────────────────────── */

const COLORI = [
  "#7c3aed",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#6366f1",
  "#14b8a6",
  "#e11d48",
  "#0f766e",
  "#2563eb",
  "#ea580c",
  "#64748b",
];
/* I loghi delle integrazioni, quelli di Home Assistant: li scarica il ponte
 * (`ponte/integrazioni/logo`), e il telefono non chiede niente fuori. Finche'
 * non c'e', o se l'integrazione non ce l'ha, la lettera. */
const LOGHI = creaLaMemoriaDeiLoghi({
  chiedi: (dominio) => chiediAHomeAssistant({ type: "ponte/integrazioni/logo", dominio }, ASPETTA),
  arrivato: () => piuTardi(),
  riprova: (_dominio, fra) => root.setTimeout?.(() => piuTardi(), fra + 50),
  colPonte: () => true,
});

function logo(nome, dominioV) {
  let h = 0;
  for (const c of clean(dominioV || nome)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const url = /^[a-z0-9_]+$/.test(clean(dominioV)) ? LOGHI.logo(clean(dominioV)) : "";
  if (url)
    return `<span class="dv-logo img" aria-hidden="true"><img src="${esc(url)}" alt="" decoding="async"></span>`;
  const lettera = clean(nome).replace(/[^\p{L}\p{N}]/gu, "")[0] || "?";
  return `<span class="dv-logo" style="--l:${COLORI[h % COLORI.length]}" aria-hidden="true">${esc(lettera.toUpperCase())}</span>`;
}

const STATI = () => ({
  ok: [t("ok", "ok"), "v"],
  errore: [t("errore", "error"), "r"],
  "in-avvio": [t("in avvio", "starting"), "a"],
  disattivata: [t("disattivata", "disabled"), "g"],
});

function contoDi(v) {
  const pezzi = [];
  if (v.integrazione && v.integrazione !== v.titolo) pezzi.push(v.integrazione);
  if (v.dispositivi)
    pezzi.push(
      v.dispositivi === 1
        ? t("1 dispositivo", "1 device")
        : t(`${v.dispositivi} dispositivi`, `${v.dispositivi} devices`),
    );
  if (v.entita)
    pezzi.push(
      v.entita === 1 ? t("1 entità", "1 entity") : t(`${v.entita} entità`, `${v.entita} entities`),
    );
  if (!pezzi.length) pezzi.push(t("nessun dispositivo", "no devices"));
  return pezzi.join(" · ");
}

function rigaDellIntegrazione(v, riparazione = null) {
  const [parola, tono] = STATI()[v.stato] || STATI().errore;
  const inCorso = state.inCorso[v.id];
  const destra = riparazione
    ? `<button type="button" class="dv-tasto pieno" data-dv-ripara="${esc(riparazione.flow_id)}">${esc(t("Ripara", "Repair"))}</button>`
    : v.ricaricabile && !v.disattivata
      ? `<button type="button" class="dv-ric${inCorso ? " gira" : ""}" data-dv-ricarica="${esc(v.id)}" aria-label="${esc(
          t(`Ricarica ${v.titolo}`, `Reload ${v.titolo}`),
        )}" title="${esc(t("Ricarica", "Reload"))}">↻</button>`
      : "";
  const perche = v.stato === "errore" && v.perche ? v.perche : "";
  return `<div class="aug-riga${v.disattivata ? " spenta" : ""}" style="--c:${VIOLA}" data-dv-int-voce="${esc(v.id)}" role="button" tabindex="0">${logo(
    v.titolo,
    v.dominio,
  )}<span class="aug-testo"><b class="aug-nome"><span>${esc(v.titolo)}</span>${
    v.stato === "ok" ? "" : `<em class="dv-pill ${tono}">${esc(parola)}</em>`
  }</b><small class="aug-fr">${esc(riparazione ? t("L'accesso va rifatto", "Sign-in needs to be redone") : perche || contoDi(v))}</small></span>${destra}</div>`;
}

function integrazioniHtml() {
  const integr = state.integr || { voci: [], trovate: [], riparazioni: [] };
  const voci = integr.voci || [];
  const visti = voci.filter((v) =>
    cerca([v.titolo, v.integrazione, v.dominio].join(" "), state.cerca),
  );
  const errori = voci.filter((v) => v.stato === "errore" || v.stato === "in-avvio");
  const riparazioni = (integr.riparazioni || []).filter((r) => voci.some((v) => v.id === r.voce));
  const trovate = integr.trovate || [];
  /* Una voce in errore che ha gia' la sua riparazione si conta una volta. */
  const daSistemare =
    riparazioni.length + errori.filter((v) => !riparazioni.some((r) => r.voce === v.id)).length;
  const daGuardare = daSistemare + trovate.length;
  const dispositivi = voci.reduce((n, v) => n + (v.dispositivi || 0), 0);
  const entita = voci.reduce((n, v) => n + (v.entita || 0), 0);
  const sotto = [
    daSistemare ? t(`${daSistemare} da sistemare`, `${daSistemare} to fix`) : "",
    trovate.length === 1
      ? t("1 nuova", "1 new")
      : trovate.length
        ? t(`${trovate.length} nuove`, `${trovate.length} new`)
        : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const quanteIntegrazioni = new Set(voci.map((v) => v.dominio)).size;
  const kpi = `<div class="ad-kpi"><div class="dm-lucip-kpi on"><span>${esc(t("Installate", "Installed"))}</span><b>${quanteIntegrazioni}</b><small>${esc(
    voci.length === 1 ? t("1 voce", "1 entry") : t(`${voci.length} voci`, `${voci.length} entries`),
  )}</small></div><div class="dm-lucip-kpi"><span>${esc(t("Dispositivi", "Devices"))}</span><b>${dispositivi}</b><small>${esc(
    t(`${entita} entità`, `${entita} entities`),
  )}</small></div><div class="dm-lucip-kpi${daGuardare ? " rosso" : ""}"><span>${esc(t("Da guardare", "To check"))}</span><b>${daGuardare}</b><small>${esc(
    sotto || t("tutto a posto", "all good"),
  )}</small></div></div>`;
  const filtri = `<div class="ad-filtri"><span class="ad-cerca-riga"><label class="ad-cerca"><span aria-hidden="true">🔍</span><input type="search" data-dv-cerca value="${esc(
    state.cerca,
  )}" placeholder="${esc(t("Cerca un'integrazione…", "Search an integration…"))}"></label><button type="button" class="ad-nuova" data-dv-aggiungi>＋ ${esc(
    t("Aggiungi", "Add"),
  )}</button></span></div>`;
  const strisce = trovate
    .map((f) => {
      const nome = f.titolo || f.integrazione;
      return `<button type="button" class="ad-pro dv-trovata" data-dv-trovata="${esc(f.flow_id)}"><span class="st" aria-hidden="true">📡</span><div>${esc(
        t(`Trovata in rete: ${nome}`, `Found on the network: ${nome}`),
      )}<small>${esc(f.integrazione && f.integrazione !== f.titolo ? `${f.integrazione} · ${t("pronta da aggiungere", "ready to add")}` : t("Pronta da aggiungere", "Ready to add"))}</small></div><em>${esc(
        t("Aggiungi ›", "Add ›"),
      )}</em></button>`;
    })
    .join("");
  const gruppi = [];
  const guardare = [
    ...riparazioni.map((r) =>
      rigaDellIntegrazione(
        voci.find((v) => v.id === r.voce),
        r,
      ),
    ),
    ...errori
      .filter((v) => visti.includes(v) && !riparazioni.some((r) => r.voce === v.id))
      .map((v) => rigaDellIntegrazione(v)),
  ];
  if (guardare.length)
    gruppi.push(
      gruppoHtml({
        chiave: "i-guardare",
        titolo: t("Da guardare", "To check"),
        disegno: "allerte",
        colore: "#dc2626",
        conta: guardare.length,
        righe: guardare,
      }),
    );
  /* Una scheda per integrazione, come in Home Assistant: il suo logo, il
   * nome, e dentro i suoi dispositivi; le voci senza dispositivi (un
   * template, un sensore giornaliero) stanno come righe loro. In fondo
   * «Gestisci», con le voci una per una. */
  const perDominio = new Map();
  for (const v of voci) {
    if (!perDominio.has(v.dominio)) perDominio.set(v.dominio, []);
    perDominio.get(v.dominio).push(v);
  }
  const casa = state.casa?.dispositivi || [];
  const schede = [...perDominio.entries()]
    .map(([dominio, sue]) => {
      const nome = sue[0].integrazione || dominio;
      const ids = new Set(sue.map((v) => v.id));
      const suoi = casa.filter((d) => ids.has(d.voce));
      const trovata = cerca(
        [nome, dominio, ...sue.map((v) => v.titolo), ...suoi.map((d) => d.nome)].join(" "),
        state.cerca,
      );
      return { dominio, nome, sue, suoi, trovata };
    })
    .filter((x) => x.trovata)
    .sort((a, b) => a.nome.localeCompare(b.nome));
  for (const x of schede) {
    const chiave = `int:${x.dominio}`;
    const senza = x.sue.filter((v) => !x.suoi.some((d) => d.voce === v.id));
    const righe = [
      ...x.suoi.map(rigaDelDispositivo),
      ...senza.map((v) => rigaDellIntegrazione(v)),
      `<div class="dv-gestisci-riga"><button type="button" class="dv-gestisci" data-dv-dominio="${esc(x.dominio)}"><span>${esc(
        x.sue.length === 1
          ? t("1 voce · Gestisci", "1 entry · Manage")
          : t(`${x.sue.length} voci · Gestisci`, `${x.sue.length} entries · Manage`),
      )}</span><i aria-hidden="true">›</i></button>${
        x.sue.some((v) => v.ricaricabile && !v.disattivata)
          ? `<button type="button" class="dv-ric${x.sue.some((v) => state.inCorso[v.id]) ? " gira" : ""}" data-dv-ricarica-tutte="${esc(x.dominio)}" aria-label="${esc(
              t(`Ricarica ${x.nome}`, `Reload ${x.nome}`),
            )}" title="${esc(t("Ricarica", "Reload"))}">↻</button>`
          : ""
      }</div>`,
    ];
    const guasta = x.sue.some((v) => v.stato === "errore" || v.stato === "in-avvio");
    const spenta = x.sue.every((v) => v.disattivata);
    const quanti = x.suoi.length;
    gruppi.push(
      gruppoHtml({
        chiave,
        titolo: x.nome,
        sotto: [
          quanti === 1
            ? t("1 dispositivo", "1 device")
            : quanti
              ? t(`${quanti} dispositivi`, `${quanti} devices`)
              : "",
          x.sue.length > 1 ? t(`${x.sue.length} voci`, `${x.sue.length} entries`) : "",
          guasta ? t("da guardare", "to check") : spenta ? t("disattivata", "disabled") : "",
        ]
          .filter(Boolean)
          .join(" · "),
        colore: guasta ? "#dc2626" : VIOLA,
        conta: quanti || x.sue.length,
        righe,
        chiuso: !clean(state.cerca) && !state.aperte.includes(chiave),
        segno: logo(x.nome, x.dominio),
      }),
    );
  }
  const corpo = gruppi.length
    ? `<div class="aug-griglia">${gruppi.join("")}</div>`
    : `<p class="ad-nessuna">${esc(voci.length ? t("Nessuna integrazione con queste parole.", "No integration matches these words.") : t("Nessuna integrazione in Home Assistant.", "No integrations in Home Assistant."))}</p>`;
  return `${kpi}${filtri}${strisce}<div data-dv-gruppi>${corpo}</div>`;
}

/* ── la pagina ───────────────────────────────────────────────────────────── */

function linguetteHtml() {
  return `<div class="ad-seg dv-linguette" role="tablist">${[
    ["dispositivi", t("Dispositivi", "Devices")],
    ["integrazioni", t("Integrazioni", "Integrations")],
  ]
    .map(
      ([k, n]) =>
        `<button type="button" role="tab" aria-selected="${state.linguetta === k}" data-dv-linguetta="${k}"${state.linguetta === k ? ' class="si"' : ""}>${esc(n)}</button>`,
    )
    .join("")}</div>`;
}

function avvisoHtml() {
  return state.avviso ? `<p class="dv-avviso">${esc(state.avviso)}</p>` : "";
}

/* Quello che si vede sotto il velo, senza Premium: una casa d'esempio. */
const ESEMPIO = () => ({
  stanze: [
    { id: "s", nome: t("Soggiorno", "Living room") },
    { id: "c", nome: t("Cucina", "Kitchen") },
  ],
  dispositivi: [
    {
      id: "1",
      nome: t("Lampada divano", "Sofa lamp"),
      stanza: "s",
      marca: "Philips",
      modello: "Hue",
      entita: [{ id: "light.esempio_1" }],
    },
    {
      id: "2",
      nome: t("Termostato", "Thermostat"),
      stanza: "s",
      marca: "Netatmo",
      modello: "",
      entita: [{ id: "climate.esempio_2" }],
    },
    {
      id: "3",
      nome: t("Presa forno", "Oven plug"),
      stanza: "c",
      marca: "Shelly",
      modello: "Plus 1PM",
      entita: [{ id: "switch.esempio_3" }],
    },
    {
      id: "4",
      nome: t("Sensore porta", "Door sensor"),
      stanza: "c",
      marca: "Aqara",
      modello: "",
      entita: [{ id: "binary_sensor.esempio_4" }],
    },
  ],
});

function corpo() {
  if (state.vietato) return vietatoHtml();
  if (state.errore && !state.casa) return `<p class="ad-avviso">${esc(state.errore)}</p>`;
  if (!state.casa && state.premium !== false)
    return `<p class="ad-avviso">${esc(t("Leggo i dispositivi di casa…", "Reading the home's devices…"))}</p>`;
  return `${avvisoHtml()}${state.linguetta === "integrazioni" ? integrazioniHtml() : dispositiviHtml()}`;
}

function htmlDellaPagina() {
  const premium = state.premium !== false && statoDelleAutomazioni().premium !== false;
  const testa = testataDellApp(
    t("Dispositivi", "Devices"),
    t("Stanza per stanza · e le integrazioni", "Room by room · and the integrations"),
  );
  if (premium) return `${testa}${linguetteHtml()}${corpo()}`;
  const prima = state.casa;
  state.casa = ESEMPIO();
  const sotto = `${linguetteHtml()}${dispositiviHtml()}`;
  state.casa = prima;
  return `${testa}${veloPremium({
    sotto,
    disegno: "widget",
    titolo: t("Dispositivi", "Devices"),
    frase: t(
      "Tutti i dispositivi della casa stanza per stanza, e le integrazioni di Home Assistant da qui.",
      "All the home's devices room by room, and Home Assistant's integrations from here.",
    ),
    punti: [
      t(
        "I dispositivi veri, con tutte le loro entità",
        "The real devices, with all their entities",
      ),
      t("Le integrazioni: ricarica, opzioni, disattiva", "Integrations: reload, options, disable"),
      t(
        "Aggiungi un'integrazione con la procedura guidata",
        "Add an integration with the guided setup",
      ),
      t(
        "Quelle trovate in rete e quelle da riparare",
        "Those found on the network and those to repair",
      ),
    ],
    attributo: "data-dv",
  })}`;
}

function ridisegna() {
  if (!state.inApp) return false;
  const pagina = doc?.getElementById?.(ID_DEI_DISPOSITIVI);
  if (!pagina) return false;
  let wrap = pagina.querySelector("[data-dv-pagina]");
  if (!wrap) {
    pagina.innerHTML = '<div class="dm-lucip-wrap auc auc-app dv" data-dv-pagina></div>';
    wrap = pagina.querySelector("[data-dv-pagina]");
  }
  const html = htmlDellaPagina();
  if (wrap.dataset.dvScritto !== html) {
    const attivo = doc.activeElement;
    const cercava = attivo?.matches?.("[data-dv-cerca]");
    const cursore = cercava ? attivo.selectionStart : null;
    wrap.innerHTML = html;
    wrap.dataset.dvScritto = html;
    if (cercava) {
      const campo = wrap.querySelector("[data-dv-cerca]");
      campo?.focus?.();
      try {
        campo?.setSelectionRange?.(cursore, cursore);
      } catch (_errore) {}
    }
  }
  if (state.foglio) disegnaIlFoglio();
  return true;
}

/** Apre la pagina: la maniglia dell'app. `linguetta` sceglie da dove. */
export function apriIDispositivi(quale = "dispositivi") {
  if (!apriAPienoSchermo(ID_DEI_DISPOSITIVI, "dispositivi")) return false;
  state.inApp = true;
  state.linguetta = quale === "integrazioni" ? "integrazioni" : "dispositivi";
  state.foglio = null;
  state.avviso = "";
  ridisegna();
  void chiediTutto();
  return true;
}

export function tornaDaiDispositivi() {
  if (!state.inApp) return false;
  chiudiIlFoglio();
  state.inApp = false;
  return tornaDaPienoSchermo(ID_DEI_DISPOSITIVI);
}

/* ── i fogli ─────────────────────────────────────────────────────────────── */

const dispositivoDi = (id) => (state.casa?.dispositivi || []).find((d) => d.id === id) || null;
const voceDi = (id) => (state.integr?.voci || []).find((v) => v.id === id) || null;

function foglioDelDispositivo(d) {
  const p = principaleDi(d);
  const [chiave, colore] = disegnoDi(p);
  const stanza =
    (state.casa?.stanze || []).find((s) => s.id === d.stanza)?.nome || t("Senza stanza", "No room");
  const riga = (e) => {
    const nome = nomeDellEntita(e, d);
    const [ch, col] = disegnoDi(e.id);
    const muto = SPENTI.has(clean(stati()[e.id]?.state)) || !stati()[e.id];
    const destra =
      !muto && COMANDABILI.includes(dominio(e.id))
        ? interruttore(e.id, nome)
        : `<span class="dv-val${muto ? " muto" : ""}">${esc(valoreDi(e.id))}</span>`;
    return `<div class="dv-ent" style="--c:${col}"><span class="aug-orb">${disegno(ch)}</span><span class="aug-testo"><b class="aug-nome"><span>${esc(nome)}</span></b><small class="aug-fr">${esc(e.id)}</small></span>${destra}</div>`;
  };
  const principali = d.entita.filter((e) => !e.diagnostica);
  const diagnostica = d.entita.filter((e) => e.diagnostica);
  const info = [
    [t("Marca e modello", "Make and model"), [d.marca, d.modello].filter(Boolean).join(" ")],
    [t("Versione", "Version"), d.versione],
    [t("Integrazione", "Integration"), d.integrazione],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<div class="riga q"><span>${esc(k)}</span><div>${esc(v)}</div></div>`)
    .join("");
  return `<div class="ad-foglio dv-f" role="dialog" aria-modal="true" aria-label="${esc(d.nome)}" style="--c:${colore}"><div class="man"></div>
<div class="su"><span class="orb">${disegno(chiave)}</span><div><h4>${esc(d.nome)}</h4><div class="dove">${esc([stanza, d.integrazione].filter(Boolean).join(" · "))}</div></div></div>
<div class="blk">${info}</div>
<div class="dv-lista">${principali.map(riga).join("")}</div>${
    diagnostica.length
      ? `<div class="dv-et">${esc(t("Diagnostica", "Diagnostic"))}</div><div class="dv-lista">${diagnostica.map(riga).join("")}</div>`
      : ""
  }
${d.voce ? `<div class="tasti"><button type="button" class="esegui" data-dv-ricarica="${esc(d.voce)}">↻ ${esc(t("Ricarica l'integrazione", "Reload the integration"))}</button></div>` : ""}</div>`;
}

function foglioDellIntegrazione(v) {
  const [parola, tono] = STATI()[v.stato] || STATI().errore;
  const suoi = (state.casa?.dispositivi || []).filter((d) => d.voce === v.id);
  const nomi = suoi.slice(0, 6).map((d) => d.nome);
  const resto = suoi.length - nomi.length;
  const inCorso = state.inCorso[v.id];
  const opzioni =
    v.opzioni && !v.disattivata
      ? `<button type="button" class="modifica" data-dv-opzioni>⚙️ ${esc(t("Opzioni", "Options"))}</button>`
      : "";
  const ricarica =
    v.ricaricabile && !v.disattivata
      ? `<button type="button" class="esegui" data-dv-ricarica="${esc(v.id)}"${inCorso ? " disabled" : ""}>↻ ${esc(inCorso ? t("Ricarico…", "Reloading…") : t("Ricarica", "Reload"))}</button>`
      : "";
  return `<div class="ad-foglio dv-f" role="dialog" aria-modal="true" aria-label="${esc(v.titolo)}" style="--c:${VIOLA}"><div class="man"></div>
<div class="su">${logo(v.titolo, v.dominio).replace("dv-logo", "dv-logo grande")}<div><h4>${esc(v.titolo)}</h4><div class="dove">${esc(v.integrazione)}</div></div><em class="dv-pill ${tono}">${esc(parola)}</em></div>
<div class="blk">${v.perche ? `<div class="riga s"><span>${esc(t("Perché", "Why"))}</span><div>${esc(v.perche)}</div></div>` : ""}<div class="riga q"><span>${esc(t("Porta", "Brings"))}</span><div>${esc(contoDi({ ...v, integrazione: "" }))}</div></div>${
    nomi.length
      ? `<div class="riga a"><span>${esc(t("Dispositivi", "Devices"))}</span><div>${esc(nomi.join(", "))}${resto > 0 ? esc(t(` e altri ${resto}`, ` and ${resto} more`)) : ""}</div></div>`
      : ""
  }</div>
${ricarica || opzioni ? `<div class="tasti">${ricarica}${opzioni}</div>` : ""}<div class="op-mod"><button type="button" data-dv-disattiva>${esc(
    v.disattivata ? t("Riattiva", "Enable") : t("Disattiva", "Disable"),
  )}</button><button type="button" class="r" data-dv-elimina>${esc(t("Elimina", "Delete"))}</button></div></div>`;
}

/* Le voci di un'integrazione: Shelly ne ha una per dispositivo, il Template
 * una per sensore. Ognuna si apre nel suo foglio; da qui si ricaricano e se
 * ne aggiunge un'altra. */
function foglioDelDominio(dominio) {
  const sue = (state.integr?.voci || []).filter((v) => v.dominio === dominio);
  if (!sue.length) return "";
  const nome = sue[0].integrazione || dominio;
  return `<div class="ad-foglio dv-f" role="dialog" aria-modal="true" aria-label="${esc(nome)}" style="--c:${VIOLA}"><div class="man"></div>
<div class="su">${logo(nome, dominio).replace("dv-logo", "dv-logo grande")}<div><h4>${esc(nome)}</h4><div class="dove">${esc(
    sue.length === 1 ? t("1 voce", "1 entry") : t(`${sue.length} voci`, `${sue.length} entries`),
  )}</div></div></div>
<div class="dv-lista dv-voci">${sue.map((v) => rigaDellIntegrazione(v)).join("")}</div>
<div class="tasti"><button type="button" class="esegui" data-dv-ricarica-tutte="${esc(dominio)}">↻ ${esc(t("Ricarica tutte", "Reload all"))}</button><button type="button" class="modifica" data-dv-nuova="${esc(
    dominio,
  )}">＋ ${esc(t("Aggiungi un'altra", "Add another"))}</button></div></div>`;
}

function foglioDellaConferma(v) {
  return `<div class="ad-foglio dv-f" role="dialog" aria-modal="true" style="--c:#dc2626"><div class="man"></div>
<div class="su">${logo(v.titolo, v.dominio).replace("dv-logo", "dv-logo grande")}<div><h4>${esc(t(`Eliminare «${v.titolo}»?`, `Delete «${v.titolo}»?`))}</h4><div class="dove">${esc(v.integrazione)}</div></div></div>
<p class="dv-testo">${esc(
    t(
      `Home Assistant toglie l'integrazione con ${v.dispositivi} dispositivi e ${v.entita} entità. Le automazioni che li usano smettono di funzionare. Non si torna indietro.`,
      `Home Assistant removes the integration with ${v.dispositivi} devices and ${v.entita} entities. Automations using them stop working. This can't be undone.`,
    ),
  )}</p><div class="tasti"><button type="button" class="esegui" data-dv-chiudi>${esc(t("Annulla", "Cancel"))}</button><button type="button" class="modifica rosso" data-dv-elimina-si>${esc(
    t("Sì, elimina", "Yes, delete"),
  )}</button></div></div>`;
}

function foglioDellAggiungi() {
  const cat = state.catalogo?.integrazioni;
  const parole = clean(state.cercaCat).toLowerCase();
  const visti = (cat || [])
    .filter((i) => !parole || i.nome.toLowerCase().includes(parole) || i.dominio.includes(parole))
    .slice(0, 60);
  const elenco = !cat
    ? `<p class="dv-testo">${esc(t("Chiedo a Home Assistant cosa sa aggiungere…", "Asking Home Assistant what it can add…"))}</p>`
    : visti.length
      ? visti
          .map((i) => {
            const nota = [
              i.installata ? t("già installata", "already installed") : "",
              i.cloud ? t("nel cloud", "cloud") : "",
              i.personalizzata ? t("personalizzata", "custom") : "",
            ]
              .filter(Boolean)
              .join(" · ");
            return `<button type="button" class="dv-cat" data-dv-nuova="${esc(i.dominio)}">${logo(i.nome, i.dominio)}<span><b>${esc(i.nome)}</b>${nota ? `<small>${esc(nota)}</small>` : ""}</span><i aria-hidden="true">›</i></button>`;
          })
          .join("")
      : `<p class="dv-testo">${esc(t("Nessuna integrazione con queste parole.", "No integration matches these words."))}</p>`;
  return `<div class="ad-foglio dv-f dv-agg" role="dialog" aria-modal="true" style="--c:${VIOLA}"><div class="man"></div>
<div class="su"><span class="orb">${disegno("widget")}</span><div><h4>${esc(t("Aggiungi un'integrazione", "Add an integration"))}</h4><div class="dove">${esc(
    cat
      ? t(
          `${cat.length} che Home Assistant sa aggiungere`,
          `${cat.length} that Home Assistant can add`,
        )
      : "",
  )}</div></div></div>
<label class="ad-cerca dv-cerca-cat"><span aria-hidden="true">🔍</span><input type="search" data-dv-cercacat value="${esc(state.cercaCat)}" placeholder="${esc(
    t("Cerca: Shelly, Hue, Sonos…", "Search: Shelly, Hue, Sonos…"),
  )}"></label><div class="dv-catalogo" data-dv-catalogo>${elenco}</div></div>`;
}

function htmlDelFoglio() {
  const f = state.foglio;
  if (!f) return "";
  if (f.tipo === "dispositivo") {
    const d = dispositivoDi(f.id);
    return d ? foglioDelDispositivo(d) : "";
  }
  if (f.tipo === "aggiungi") return foglioDellAggiungi();
  if (f.tipo === "dominio") return foglioDelDominio(f.id);
  const v = voceDi(f.id);
  if (!v) return "";
  return f.tipo === "elimina" ? foglioDellaConferma(v) : foglioDellIntegrazione(v);
}

function disegnaIlFoglio() {
  const html = htmlDelFoglio();
  if (!html) {
    chiudiIlFoglio();
    return;
  }
  let velo = doc.getElementById(ID_DEL_FOGLIO);
  if (!velo) {
    velo = doc.createElement("div");
    velo.id = ID_DEL_FOGLIO;
    velo.className = "ad-velo";
    doc.body.append(velo);
  }
  if (velo.dataset.dvScritto === html) return;
  const cercava = doc.activeElement?.matches?.("[data-dv-cercacat]");
  velo.innerHTML = html;
  velo.dataset.dvScritto = html;
  if (cercava) velo.querySelector("[data-dv-cercacat]")?.focus?.();
}

function apriIlFoglio(foglio) {
  state.foglio = foglio;
  disegnaIlFoglio();
}

function chiudiIlFoglio() {
  state.foglio = null;
  doc?.getElementById?.(ID_DEL_FOGLIO)?.remove();
}

/* ── le cose che si fanno ────────────────────────────────────────────────── */

function dillo(testo) {
  state.avviso = testo;
  ridisegna();
  root.clearTimeout?.(state.avvisoTimer);
  state.avvisoTimer = root.setTimeout?.(() => {
    state.avviso = "";
    ridisegna();
  }, 6000);
}

const riavvio = (r) =>
  r?.riavvio ? ` ${t("Serve riavviare Home Assistant.", "Home Assistant needs a restart.")}` : "";

async function comando(tipo, campi, fatto) {
  try {
    const r = await chiediAHomeAssistant({ type: tipo, ...campi }, ASPETTA);
    dillo(`${fatto}${riavvio(r)}`);
    return r;
  } catch (errore) {
    const no = capisciIlNo(errore);
    if (no.premium === false || no.vietato) Object.assign(state, no);
    dillo(no.errore || no.vietato || t("Non ha funzionato.", "That did not work."));
    return null;
  }
}

async function ricarica(id) {
  const v = voceDi(id);
  if (!v || state.inCorso[id]) return;
  state.inCorso = { ...state.inCorso, [id]: true };
  ridisegna();
  await comando(
    "ponte/integrazioni/ricarica",
    { voce: id },
    t(`Ricaricata: ${v.titolo} ✓`, `Reloaded: ${v.titolo} ✓`),
  );
  const { [id]: _via, ...resto } = state.inCorso;
  state.inCorso = resto;
  await chiediTutto();
}

async function disattiva(v) {
  chiudiIlFoglio();
  const spegni = !v.disattivata;
  await comando(
    "ponte/integrazioni/disattiva",
    { voce: v.id, disattiva: spegni },
    spegni
      ? t(`Disattivata: ${v.titolo}`, `Disabled: ${v.titolo}`)
      : t(`Riattivata: ${v.titolo} ✓`, `Enabled: ${v.titolo} ✓`),
  );
  await chiediTutto();
}

async function elimina(v) {
  chiudiIlFoglio();
  await comando(
    "ponte/integrazioni/elimina",
    { voce: v.id, conferma: true },
    t(`Eliminata: ${v.titolo}`, `Deleted: ${v.titolo}`),
  );
  await chiediTutto();
}

async function apriLAggiungi() {
  state.cercaCat = "";
  apriIlFoglio({ tipo: "aggiungi" });
  if (state.catalogo) return;
  try {
    state.catalogo = await chiediAHomeAssistant(
      { type: "ponte/integrazioni/catalogo", lingua: lingua() },
      ASPETTA,
    );
  } catch (errore) {
    chiudiIlFoglio();
    dillo(capisciIlNo(errore).errore || t("Non ha funzionato.", "That did not work."));
    return;
  }
  if (state.foglio?.tipo === "aggiungi") disegnaIlFoglio();
}

function procedura(opzioni) {
  chiudiIlFoglio();
  apriLaProcedura({
    ...opzioni,
    quandoFinisce: () => {
      state.catalogo = null;
      void chiediTutto();
    },
  });
}

/* ── i tocchi ────────────────────────────────────────────────────────────── */

const dentroDiNoi = (el) => el?.closest?.(`#${ID_DEI_DISPOSITIVI}, #${ID_DEL_FOGLIO}`);

function onClick(event) {
  const el = event.target;
  if (!dentroDiNoi(el)) return;
  const velo = doc.getElementById(ID_DEL_FOGLIO);
  if (velo && el === velo) {
    chiudiIlFoglio();
    return;
  }
  const tocco = el.closest(
    "[data-dv-scopri],[data-dv-dominio],[data-dv-ricarica-tutte],[data-dv-linguetta],[data-dv-per],[data-dv-gruppo],[data-dv-int],[data-dv-ricarica],[data-dv-ripara],[data-dv-trovata],[data-dv-aggiungi],[data-dv-nuova],[data-dv-opzioni],[data-dv-disattiva],[data-dv-elimina],[data-dv-elimina-si],[data-dv-chiudi],[data-dv-disp],[data-dv-int-voce]",
  );
  if (!tocco) return;
  const d = tocco.dataset;
  event.preventDefault();
  if (d.dvScopri !== undefined) {
    scopriPremium();
    return;
  }
  if (state.premium === false) return;
  if (d.dvLinguetta) {
    state.linguetta = d.dvLinguetta === "integrazioni" ? "integrazioni" : "dispositivi";
    state.cerca = "";
    ridisegna();
    root.scrollTo?.(0, 0);
    return;
  }
  if (d.dvPer) {
    state.per = d.dvPer === "integrazione" ? "integrazione" : "stanza";
    ridisegna();
    return;
  }
  if (d.dvGruppo?.startsWith("int:")) {
    state.aperte = state.aperte.includes(d.dvGruppo)
      ? state.aperte.filter((k) => k !== d.dvGruppo)
      : [...state.aperte, d.dvGruppo];
    ridisegna();
    return;
  }
  if (d.dvDominio) {
    apriIlFoglio({ tipo: "dominio", id: d.dvDominio });
    return;
  }
  if (d.dvRicaricaTutte) {
    for (const v of (state.integr?.voci || []).filter(
      (x) => x.dominio === d.dvRicaricaTutte && x.ricaricabile && !x.disattivata,
    ))
      void ricarica(v.id);
    return;
  }
  if (d.dvGruppo) {
    state.chiusi = state.chiusi.includes(d.dvGruppo)
      ? state.chiusi.filter((k) => k !== d.dvGruppo)
      : [...state.chiusi, d.dvGruppo];
    ridisegna();
    return;
  }
  if (d.dvInt) {
    event.stopPropagation();
    chiamaServizio({ domain: dominio(d.dvInt), service: "toggle", data: { entity_id: d.dvInt } });
    return;
  }
  if (d.dvRicarica) {
    event.stopPropagation();
    void ricarica(d.dvRicarica);
    return;
  }
  if (d.dvRipara || d.dvTrovata) {
    event.stopPropagation();
    const f = [...(state.integr?.riparazioni || []), ...(state.integr?.trovate || [])].find(
      (x) => x.flow_id === (d.dvRipara || d.dvTrovata),
    );
    procedura({ flow_id: d.dvRipara || d.dvTrovata, nome: f?.titolo || f?.integrazione || "" });
    return;
  }
  if (d.dvAggiungi !== undefined) {
    void apriLAggiungi();
    return;
  }
  if (d.dvNuova) {
    const i = (state.catalogo?.integrazioni || []).find((x) => x.dominio === d.dvNuova);
    const v = (state.integr?.voci || []).find((x) => x.dominio === d.dvNuova);
    procedura({ handler: d.dvNuova, nome: i?.nome || v?.integrazione || d.dvNuova });
    return;
  }
  if (d.dvChiudi !== undefined) {
    chiudiIlFoglio();
    return;
  }
  const v = state.foglio ? voceDi(state.foglio.id) : null;
  if (d.dvOpzioni !== undefined && v) {
    procedura({ handler: v.id, genere: "opzioni", nome: v.titolo });
    return;
  }
  if (d.dvDisattiva !== undefined && v) {
    void disattiva(v);
    return;
  }
  if (d.dvElimina !== undefined && v) {
    apriIlFoglio({ tipo: "elimina", id: v.id });
    return;
  }
  if (d.dvEliminaSi !== undefined && v && state.foglio?.tipo === "elimina") {
    void elimina(v);
    return;
  }
  if (d.dvDisp) apriIlFoglio({ tipo: "dispositivo", id: d.dvDisp });
  else if (d.dvIntVoce) apriIlFoglio({ tipo: "integrazione", id: d.dvIntVoce });
}

function onInput(event) {
  const campo = event.target;
  if (!dentroDiNoi(campo)) return;
  if (campo.matches?.("[data-dv-cerca]")) {
    state.cerca = campo.value;
    ridisegna();
  } else if (campo.matches?.("[data-dv-cercacat]")) {
    state.cercaCat = campo.value;
    disegnaIlFoglio();
  }
}

function onKey(event) {
  if (event.key === "Escape" && state.foglio && !proceduraAperta()) {
    chiudiIlFoglio();
    return;
  }
  if (event.key !== "Enter" && event.key !== " ") return;
  const riga = event.target?.closest?.("[data-dv-disp],[data-dv-int-voce]");
  if (!riga || event.target !== riga || !dentroDiNoi(riga)) return;
  event.preventDefault();
  riga.click();
}

/* ── lo stile ────────────────────────────────────────────────────────────── */

export const PAGINE_COME_AUTOMAZIONI = `:is(#${ID_DEI_DISPOSITIVI},#page-aiutanti)`;

function stili() {
  const S = PAGINE_COME_AUTOMAZIONI;
  installStyle(
    "dm-dispositivi-app-style",
    `
${S} .auc-app{padding:8px 14px 150px}
${S} .ad-kpi .rosso b{color:#dc2626}
${S} :is(.dv,.ai) .ad-kpi small{white-space:normal;line-height:1.3}
${S} .dv-linguette{display:flex;width:100%;box-sizing:border-box}
${S} .dv-linguette button{flex:1;padding:10px 12px;font-size:12px}
${S} .dv-avviso{margin:0;padding:11px 14px;border-radius:14px;background:color-mix(in srgb,#16a34a 12%,var(--card-bg,#fff));border:1px solid color-mix(in srgb,#16a34a 30%,transparent);font-size:13px;font-weight:800;color:var(--text,#0f172a)}
${S} .dv-val,.ad-foglio .dv-val{flex:none;max-width:42%;font-size:13px;font-weight:800;color:var(--text,#0f172a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
${S} .aug-riga .dv-val{display:block}
${S} .dv-val.muto,.ad-foglio .dv-val.muto{color:#dc2626;font-size:11.5px}
${S} .dv-pill,.ad-foglio .dv-pill{flex:none;font-style:normal;font-size:10.5px;font-weight:900;letter-spacing:.3px;padding:2px 8px;border-radius:999px;background:#f1f5f9;color:#334155}
.dv-pill.v{background:#dcfce7;color:#047857}.dv-pill.r{background:#fee2e2;color:#b91c1c}.dv-pill.a{background:#fef3c7;color:#92400e}.dv-pill.g{background:#e2e8f0;color:#475569}
.dv-logo{flex:none;width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:var(--l);color:#fff;font-weight:900;font-size:14px;font-family:Inter,sans-serif}
.dv-logo.img{background:#fff;box-shadow:inset 0 0 0 1px var(--divider-color,#e2e8f0);overflow:hidden}
.dv-logo.img img{width:78%;height:78%;object-fit:contain}
html[data-theme="dark"] .dv-logo.img{background:#f8fafc}
.aug.dv-int .aug-testa{padding:12px 14px}
.aug.dv-int .aug-testa>.dv-logo{width:40px;height:40px;border-radius:12px}
.aug.dv-int .aug-titolo{display:grid;white-space:normal}
.aug.dv-int .aug-titolo small{font-size:12px;font-weight:700;color:var(--secondary-text-color,#64748b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dv-gestisci-riga{display:flex;align-items:center;gap:8px;padding-right:12px;border-top:1px solid var(--divider-color,#e2e8f0);background:color-mix(in srgb,#7c3aed 5%,transparent)}
.dv-gestisci{flex:1;display:flex;align-items:center;gap:8px;padding:11px 14px;border:0;background:none;color:#6d28d9;font:inherit;font-size:13px;font-weight:800;text-align:left;cursor:pointer}
html[data-theme="dark"] .dv-gestisci{color:#c4b5fd}
.dv-gestisci span{flex:1}
.dv-gestisci i{font-style:normal;font-size:18px}
.ad-foglio.dv-f .dv-voci .aug-riga{border-top:1px solid var(--divider-color,#e2e8f0)}
.ad-foglio.dv-f .dv-voci .aug-riga:first-child{border-top:0}
.dv-logo.grande{width:54px;height:54px;border-radius:16px;font-size:22px;box-shadow:0 8px 20px -10px var(--l)}
.dv-gestisci-riga .dv-ric,.ad-foglio .dv-ric,${S} .dv-ric{flex:none;width:34px;height:34px;border-radius:50%;border:1px solid var(--divider-color,#dbe4ee);background:var(--card-bg,#fff);color:${VIOLA};font-size:17px;font-weight:900;line-height:1;cursor:pointer}
${S} .dv-ric.gira,.ad-foglio .dv-ric.gira{animation:pg-giro .9s linear infinite}
${S} .dv-tasto{flex:none;border-radius:999px;padding:7px 14px;font:inherit;font-size:12px;font-weight:900;cursor:pointer;border:0}
${S} .dv-tasto.pieno{background:${VIOLA};color:#fff;box-shadow:0 8px 18px -10px ${VIOLA}}
${S} .dv-trovata{border-color:color-mix(in srgb,#0ea5e9 35%,var(--divider-color,#dbe4ee));background:linear-gradient(120deg,color-mix(in srgb,#0ea5e9 12%,var(--card-bg,#fff)),var(--card-bg,#fff) 70%)}
${S} .dv-trovata em{color:#0284c7}
.ad-foglio.dv-f .su em.dv-pill{margin-left:auto}
.ad-foglio.dv-f .dv-lista{margin-top:12px;display:grid;border:1px solid var(--divider-color,#e2e8f0);border-radius:16px;overflow:hidden}
.ad-foglio.dv-f .dv-ent{display:flex;align-items:center;gap:11px;padding:9px 12px;border-top:1px solid var(--divider-color,#e2e8f0)}
.ad-foglio.dv-f .dv-ent:first-child{border-top:0}
.ad-foglio.dv-f .dv-ent .aug-fr{font-size:11px}
.ad-foglio.dv-f .dv-et{margin:14px 4px 0;font-size:10.5px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
.ad-foglio.dv-f .dv-testo{margin:14px 2px 0;font-size:13.5px;line-height:1.55;font-weight:600;color:var(--secondary-text-color,#64748b)}
.ad-foglio.dv-f .modifica.rosso{background:#dc2626;box-shadow:0 10px 24px -10px #dc2626}
.ad-foglio.dv-f .tasti button:disabled{opacity:.6}
.ad-foglio.dv-agg{max-height:84vh;display:flex;flex-direction:column}
.ad-foglio.dv-agg .dv-cerca-cat{margin-top:14px;flex:none;display:flex;align-items:center;gap:8px;padding:0 16px;border-radius:999px;border:1px solid var(--divider-color,#dbe4ee);background:var(--card-bg,#fff)}
.ad-foglio.dv-agg .dv-cerca-cat input{flex:1;min-width:0;border:0;background:none;outline:none;padding:11px 0;font:inherit;font-size:15px;font-weight:600;color:var(--text,#0f172a)}
.ad-foglio.dv-agg .dv-catalogo{margin-top:10px;overflow-y:auto;display:grid;gap:6px;align-content:start;min-height:200px}
.dv-cat{display:flex;align-items:center;gap:12px;width:100%;padding:9px 12px;border-radius:14px;border:1px solid var(--divider-color,#e2e8f0);background:var(--card-bg,#fff);color:var(--text,#0f172a);font:inherit;text-align:left;cursor:pointer}
.dv-cat>span:not(.dv-logo){flex:1;min-width:0;display:grid}
.dv-cat b{font-size:14.5px;font-weight:800}
.dv-cat small{font-size:11.5px;font-weight:700;color:var(--secondary-text-color,#64748b)}
.dv-cat i{font-style:normal;color:${VIOLA};font-size:18px}
`,
  );
}

/* ── installare ──────────────────────────────────────────────────────────── */

function prendiLeManiglie() {
  root.gdahomeApriIDispositivi = apriIDispositivi;
  root.gdahomeTornaDaiDispositivi = tornaDaiDispositivi;
  root.addEventListener?.("message", (evento) => {
    const detto = evento?.data;
    if (!detto || typeof detto !== "object" || evento.source !== root.parent) return;
    if (detto.gdahome === "apri-i-dispositivi") apriIDispositivi(detto.linguetta);
    else if (detto.gdahome === "torna-dai-dispositivi") tornaDaiDispositivi();
  });
  /* Una linguetta della barra toccata con la pagina aperta: si va li'. */
  doc.addEventListener(
    "click",
    (evento) => {
      if (!state.inApp) return;
      const voce = evento.target?.closest?.(".tab");
      if (voce && !voce.closest(`#${ID_DEI_DISPOSITIVI}`)) {
        chiudiIlFoglio();
        state.inApp = false;
        doc.getElementById(ID_DEI_DISPOSITIVI)?.remove();
      }
    },
    true,
  );
}

let inCoda = false;
function piuTardi() {
  if (inCoda || !state.inApp) return;
  inCoda = true;
  const fai = () => {
    inCoda = false;
    ridisegna();
  };
  if (root.requestAnimationFrame) root.requestAnimationFrame(fai);
  else root.setTimeout?.(fai, 0);
}

export function installDispositiviAppSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  stili();
  prendiLeManiglie();
  doc.addEventListener("click", onClick);
  doc.addEventListener("input", onInput);
  doc.addEventListener("keydown", onKey);
  /* I valori e gli interruttori seguono gli stati della casa. */
  root.addEventListener?.("dashboardmodern:states-ready", piuTardi);
  return true;
}

/* Per le prove. */
export const _statoDeiDispositivi = state;
