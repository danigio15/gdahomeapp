/* «Aiutanti» dell'app (Premium): le variabili e i sensori fatti in casa.
 *
 * «Implementiamo ultima cosa che sono gli aiutanti», tutti quelli di Home
 * Assistant, con la faccia delle Automazioni: la testata, tre tessere, i
 * filtri, i gruppi compatti per tipo, il foglio che sale dal basso.
 *
 *  - **I semplici** (interruttore, numero, elenco, testo, data e ora,
 *    pulsante, timer, contatore, programma): la riga porta il valore di
 *    adesso (o l'interruttore), il foglio lo cambia coi servizi di Home
 *    Assistant, e «✏️ Modifica» ne cambia i campi; «＋ Nuovo» ne crea uno
 *    col modulo del suo tipo (`core/aiutanti-di-home-assistant.js`).
 *  - **I calcolati** (gruppo, soglia, template, contatore di consumi,
 *    min/max…): nascono e si cambiano con la procedura guidata di Home
 *    Assistant (`procedura-guidata-section.js`).
 *
 * Solo nell'app (il menu laterale la apre con `gdahomeApriGliAiutanti`), solo
 * per chi amministra Home Assistant, solo con GdAHome Premium: lo decide il
 * ponte (`ponte/src/aiutanti.js`), e qui il no si racconta.
 */
import { scriviTenendoIlCampo } from "../core/scrivi-tenendo-il-campo.js";
import {
  SPIEGAZIONI_DEGLI_AIUTANTI,
  TIPI_DEGLI_AIUTANTI,
  campiDelTipo,
  campiPerIlPonte,
  riassuntoDellAiutante,
  valoriDellAiutante,
} from "../core/aiutanti-di-home-assistant.js";
import { datiDelModulo } from "../core/flussi-di-home-assistant.js";
import { oggettoWidget } from "../core/oggetti-widget.js";
import { statoDelleAutomazioni, scopriPremium } from "./automazioni-section.js";
import {
  apriAPienoSchermo,
  capisciIlNo,
  testataDellApp,
  tornaDaPienoSchermo,
  veloPremium,
  vietatoHtml,
} from "./dispositivi-app-section.js";
import {
  apriLaProcedura,
  campiHtml,
  leggiICampi,
  proceduraAperta,
} from "./procedura-guidata-section.js";
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

const KEY = "__DASHBOARDMODERN_AIUTANTI_APP__";
const state = (root[KEY] ||= {
  installed: false,
  inApp: false,
  premium: null,
  vietato: "",
  errore: "",
  elenco: null,
  chiedendo: false,
  per: "tipo",
  cerca: "",
  chiusi: [],
  foglio: null,
  modulo: null,
  avviso: "",
});

export const ID_DEGLI_AIUTANTI = "page-aiutanti";
const ID_DEL_FOGLIO = "ai-foglio";
const VIOLA = "#7c3aed";
const ASPETTA = 30_000;

const lingua = () => clean(activeLocale()) || "it";
const scegli = (c) => t(c.it, c.en);
const stati = () => {
  try {
    return allStates() || {};
  } catch (_errore) {
    return {};
  }
};
const dominio = (id) => clean(id).split(".")[0];

async function chiedi() {
  if (state.chiedendo) return;
  state.chiedendo = true;
  try {
    state.elenco = await chiediAHomeAssistant(
      { type: "ponte/aiutanti/elenco", lingua: lingua() },
      ASPETTA,
    );
    Object.assign(state, { premium: true, vietato: "", errore: "" });
  } catch (errore) {
    Object.assign(state, capisciIlNo(errore));
  } finally {
    state.chiedendo = false;
    ridisegna();
  }
}

/* ── i valori di adesso ──────────────────────────────────────────────────── */

const SPENTI = new Set(["unavailable", "unknown"]);

function valoreDi(entity) {
  const s = stati()[entity];
  if (!s) return "—";
  const v = clean(s.state);
  if (v === "unavailable") return t("Non risponde", "Not answering");
  if (v === "unknown" || v === "") return "—";
  if (v === "on") return t("Acceso", "On");
  if (v === "off") return t("Spento", "Off");
  const d = dominio(entity);
  if (d === "timer") {
    const resta = clean(s.attributes?.remaining);
    if (v === "active") return t(`in corso ${resta}`, `running ${resta}`).trim();
    if (v === "paused") return t("in pausa", "paused");
    return t("fermo", "idle");
  }
  if (d === "input_button") return t("Premi", "Press");
  const unita = clean(s.attributes?.unit_of_measurement);
  const n = Number(v);
  const numero =
    Number.isFinite(n) && /^-?\d/.test(v) ? String(Math.round(n * 100) / 100).replace(".", ",") : v;
  return unita ? `${numero} ${unita}` : numero;
}

/* ── i gruppi ────────────────────────────────────────────────────────────── */

const cerca = (testo, parole) =>
  !clean(parole) || clean(testo).toLowerCase().includes(clean(parole).toLowerCase());
let disegni = 0;
const disegno = (chiave) => oggettoWidget(chiave, "", `ai-${chiave}-${disegni++ % 200}`);
const tipoDi = (tipo) =>
  TIPI_DEGLI_AIUTANTI.find((x) => x.tipo === tipo) || {
    disegno: "mie",
    colore: VIOLA,
    it: tipo,
    en: tipo,
  };

function riassunto(a) {
  const r = riassuntoDellAiutante(a, scegli);
  if (r && typeof r === "object") {
    if ("passo" in r) return t(`passo ${r.passo}`, `step ${r.passo}`);
    if ("giorni" in r) return t(`${r.giorni} giorni con fasce`, `${r.giorni} days with slots`);
  }
  return r;
}

function gruppoHtml({ chiave, titolo, disegnoG, colore, righe }) {
  const chiuso = state.chiusi.includes(chiave);
  return `<section class="aug${chiuso ? " chiuso" : ""}" style="--c:${colore}" data-aug="${esc(chiave)}"><button type="button" class="aug-testa" data-ai-gruppo="${esc(
    chiave,
  )}" aria-expanded="${!chiuso}"><span class="aug-freccia" aria-hidden="true">${chiuso ? "▸" : "▾"}</span><span class="aug-ico">${oggettoWidget(
    disegnoG,
    "",
    `ai-g-${chiave}`,
  )}</span><span class="aug-titolo">${esc(titolo)}</span><span class="aug-conta" data-on="true">${righe.length}</span></button><div class="aug-righe">${righe.join("")}</div></section>`;
}

function destraDellaRiga(entity, tipo, nome) {
  const s = stati()[entity];
  /* Un pulsante mai premuto e' «unknown» per Home Assistant: si preme lo
   * stesso. */
  if (tipo === "input_button" && s && clean(s.state) !== "unavailable")
    return `<button type="button" class="dv-tasto pieno" data-ai-premi="${esc(entity)}">${esc(t("Premi", "Press"))}</button>`;
  if (!s || SPENTI.has(clean(s.state)))
    return `<span class="aug-quando dv-val muto">${esc(valoreDi(entity))}</span>`;
  if (tipo === "input_boolean" || (dominio(entity) === "switch" && tipo === "calcolato"))
    return `<button type="button" class="aug-int" role="switch" aria-checked="${clean(s.state) === "on"}" data-ai-int="${esc(entity)}" aria-label="${esc(
      t(`Accendi o spegni ${nome}`, `Turn ${nome} on or off`),
    )}"></button>`;
  const v = valoreDi(entity);
  if (tipo === "timer" && clean(s.state) === "active")
    return `<em class="dv-pill a">${esc(v)}</em>`;
  if (tipo === "schedule")
    return `<em class="dv-pill ${clean(s.state) === "on" ? "v" : "g"}">${esc(clean(s.state) === "on" ? t("attiva", "active") : t("fuori fascia", "off slot"))}</em>`;
  return `<span class="aug-quando dv-val">${esc(v)}</span>`;
}

function rigaSemplice(a) {
  const tp = tipoDi(a.tipo);
  return `<div class="aug-riga" style="--c:${tp.colore}" data-ai-semplice="${esc(a.entity_id)}" role="button" tabindex="0"><span class="aug-orb">${disegno(
    tp.disegno,
  )}</span><span class="aug-testo"><b class="aug-nome"><span>${esc(a.nome || a.entity_id)}</span></b><small class="aug-fr">${esc(
    riassunto(a) || a.entity_id,
  )}</small></span>${destraDellaRiga(a.entity_id, a.tipo, a.nome)}</div>`;
}

function rigaCalcolata(c) {
  const prima = c.entita[0] || "";
  return `<div class="aug-riga" style="--c:${VIOLA}" data-ai-calcolato="${esc(c.voce)}" role="button" tabindex="0"><span class="aug-orb">${disegno(
    "mie",
  )}</span><span class="aug-testo"><b class="aug-nome"><span>${esc(c.nome)}</span></b><small class="aug-fr">${esc(c.tipoNome)}</small></span>${
    prima ? destraDellaRiga(prima, "calcolato", c.nome) : ""
  }</div>`;
}

function corpoHtml() {
  const e = state.elenco || { semplici: [], calcolati: [], tipiCalcolati: [] };
  const semplici = e.semplici.filter((a) =>
    cerca([a.nome, a.entity_id, scegli(tipoDi(a.tipo))].join(" "), state.cerca),
  );
  const calcolati = e.calcolati.filter((c) =>
    cerca([c.nome, c.tipoNome, c.dominio].join(" "), state.cerca),
  );
  const tutti = e.semplici.length + e.calcolati.length;
  const tipi = new Set([...e.semplici.map((a) => a.tipo), ...e.calcolati.map((c) => c.dominio)])
    .size;
  const kpi = `<div class="ad-kpi"><div class="dm-lucip-kpi on"><span>${esc(t("Aiutanti", "Helpers"))}</span><b>${tutti}</b><small>${esc(
    t("in casa", "at home"),
  )}</small></div><div class="dm-lucip-kpi"><span>${esc(t("Calcolati", "Computed"))}</span><b>${e.calcolati.length}</b><small>${esc(
    t("sensori fatti in casa", "home-made sensors"),
  )}</small></div><div class="dm-lucip-kpi"><span>${esc(t("Tipi", "Types"))}</span><b>${tipi}</b><small>${esc(t("diversi", "different"))}</small></div></div>`;
  const filtri = `<div class="ad-filtri"><span class="ad-seg-riga"><span class="ad-seg">${[
    ["tipo", t("Per tipo", "By type")],
    ["tutti", t("Tutti", "All of them")],
  ]
    .map(
      ([k, n]) =>
        `<button type="button" data-ai-per="${k}"${state.per === k ? ' class="si"' : ""}>${esc(n)}</button>`,
    )
    .join(
      "",
    )}</span></span><span class="ad-cerca-riga"><label class="ad-cerca"><span aria-hidden="true">🔍</span><input type="search" data-ai-cerca value="${esc(
    state.cerca,
  )}" placeholder="${esc(t("Cerca un aiutante…", "Search a helper…"))}"></label><button type="button" class="ad-nuova" data-ai-nuovo>＋ ${esc(t("Nuovo", "New helper"))}</button></span></div>`;
  if (!tutti)
    return `${kpi}${filtri}<div class="ad-vuoto"><div class="ill">${disegno("mie")}<span aria-hidden="true">✨</span></div><h3>${esc(
      t("Nessun aiutante, per ora", "No helpers, for now"),
    )}</h3><p>${esc(
      t(
        "Gli aiutanti sono interruttori, numeri, elenchi e timer che usi nelle automazioni: «Modalità vacanza», «Temperatura comfort», «Timer lavatrice».",
        "Helpers are toggles, numbers, dropdowns and timers you use in automations: «Vacation mode», «Comfort temperature», «Washer timer».",
      ),
    )}</p><button type="button" data-ai-nuovo>＋ ${esc(t("Crea il primo", "Create the first helper"))}</button></div>`;
  let gruppi = [];
  if (state.per === "tipo") {
    for (const tp of TIPI_DEGLI_AIUTANTI) {
      const suoi = semplici.filter((a) => a.tipo === tp.tipo);
      if (suoi.length)
        gruppi.push(
          gruppoHtml({
            chiave: tp.tipo,
            titolo: scegli(tp),
            disegnoG: tp.disegno,
            colore: tp.colore,
            righe: suoi.map(rigaSemplice),
          }),
        );
    }
    if (calcolati.length)
      gruppi.push(
        gruppoHtml({
          chiave: "calcolati",
          titolo: t("Sensori calcolati", "Computed sensors"),
          disegnoG: "mie",
          colore: VIOLA,
          righe: calcolati.map(rigaCalcolata),
        }),
      );
  } else {
    const righe = [
      ...semplici.map((a) => [a.nome, rigaSemplice(a)]),
      ...calcolati.map((c) => [c.nome, rigaCalcolata(c)]),
    ].sort((x, y) => x[0].localeCompare(y[0]));
    if (righe.length)
      gruppi = [
        gruppoHtml({
          chiave: "tutti",
          titolo: t("Tutti gli aiutanti", "All helpers"),
          disegnoG: "mie",
          colore: VIOLA,
          righe: righe.map((r) => r[1]),
        }),
      ];
  }
  const corpo = gruppi.length
    ? `<div class="aug-griglia">${gruppi.join("")}</div>`
    : `<p class="ad-nessuna">${esc(t("Nessun aiutante con queste parole.", "No helper matches these words."))}</p>`;
  return `${kpi}${filtri}<div data-ai-gruppi>${corpo}</div>`;
}

const ESEMPIO = () => ({
  semplici: [
    {
      tipo: "input_boolean",
      id: "v",
      entity_id: "input_boolean.esempio_vacanza",
      nome: t("Modalità vacanza", "Vacation mode"),
      config: {},
    },
    {
      tipo: "input_number",
      id: "c",
      entity_id: "input_number.esempio_comfort",
      nome: t("Temperatura comfort", "Comfort temperature"),
      config: { min: 16, max: 26, unit_of_measurement: "°C" },
    },
    {
      tipo: "timer",
      id: "l",
      entity_id: "timer.esempio_lavatrice",
      nome: t("Timer lavatrice", "Washer timer"),
      config: { duration: "1:30:00" },
    },
  ],
  calcolati: [
    {
      voce: "x",
      dominio: "group",
      tipoNome: t("Gruppo", "Group"),
      nome: t("Tutte le luci giorno", "All day lights"),
      entita: [],
    },
  ],
  tipiCalcolati: [],
});

function htmlDellaPagina() {
  const premium = state.premium !== false && statoDelleAutomazioni().premium !== false;
  const testa = testataDellApp(
    t("Aiutanti", "Helpers"),
    t("Le variabili e i sensori fatti in casa", "Home-made variables and sensors"),
  );
  if (state.vietato) return testa + vietatoHtml();
  if (premium) {
    if (state.errore && !state.elenco)
      return `${testa}<p class="ad-avviso">${esc(state.errore)}</p>`;
    if (!state.elenco)
      return `${testa}<p class="ad-avviso">${esc(t("Leggo gli aiutanti di casa…", "Reading the home's helpers…"))}</p>`;
    return `${testa}${state.avviso ? `<p class="dv-avviso">${esc(state.avviso)}</p>` : ""}${corpoHtml()}`;
  }
  const prima = state.elenco;
  state.elenco = ESEMPIO();
  const sotto = corpoHtml();
  state.elenco = prima;
  return `${testa}${veloPremium({
    sotto,
    disegno: "mie",
    titolo: t("Aiutanti", "Helpers"),
    frase: t(
      "Interruttori, numeri, elenchi, timer e sensori calcolati: le variabili della casa, da usare nelle automazioni.",
      "Toggles, numbers, dropdowns, timers and computed sensors: the home's variables, to use in automations.",
    ),
    punti: [
      t("Tutti i tipi di aiutanti di Home Assistant", "All of Home Assistant's helper types"),
      t("Li crei e li modifichi da qui", "Create and edit them from here"),
      t("Il valore di adesso, da cambiare con un tocco", "The current value, changed with a tap"),
      t("Gruppi, soglie e contatori di consumi", "Groups, thresholds and utility meters"),
    ],
    attributo: "data-ai",
  })}`;
}

function ridisegna() {
  if (!state.inApp) return false;
  const pagina = doc?.getElementById?.(ID_DEGLI_AIUTANTI);
  if (!pagina) return false;
  let wrap = pagina.querySelector("[data-ai-pagina]");
  if (!wrap) {
    pagina.innerHTML = '<div class="dm-lucip-wrap auc auc-app ai" data-ai-pagina></div>';
    wrap = pagina.querySelector("[data-ai-pagina]");
  }
  const html = htmlDellaPagina();
  if (wrap.dataset.aiScritto !== html) {
    const attivo = doc.activeElement;
    const cercava = attivo?.matches?.("[data-ai-cerca]");
    const cursore = cercava ? attivo.selectionStart : null;
    /* Mentre si scrive nella ricerca il campo non si riscrive: si cambia
     * solo il resto (`scrivi-tenendo-il-campo.js`). */
    const tenuto = cercava && scriviTenendoIlCampo(wrap, html, attivo);
    if (!tenuto) wrap.innerHTML = html;
    wrap.dataset.aiScritto = html;
    if (cercava && !tenuto) {
      const campo = wrap.querySelector("[data-ai-cerca]");
      campo?.focus?.();
      try {
        campo?.setSelectionRange?.(cursore, cursore);
      } catch (_errore) {}
    }
  }
  if (state.foglio && state.foglio.tipo !== "modulo") disegnaIlFoglio();
  return true;
}

export function apriGliAiutanti() {
  if (!apriAPienoSchermo(ID_DEGLI_AIUTANTI, "aiutanti")) return false;
  state.inApp = true;
  state.foglio = null;
  state.avviso = "";
  ridisegna();
  void chiedi();
  return true;
}

export function tornaDagliAiutanti() {
  if (!state.inApp) return false;
  chiudiIlFoglio();
  state.inApp = false;
  return tornaDaPienoSchermo(ID_DEGLI_AIUTANTI);
}

/* ── i fogli ─────────────────────────────────────────────────────────────── */

const sempliceDi = (entity) =>
  (state.elenco?.semplici || []).find((a) => a.entity_id === entity) || null;
const calcolatoDi = (voce) => (state.elenco?.calcolati || []).find((c) => c.voce === voce) || null;

/* I comandi del valore, nel foglio: quelli di Home Assistant per quel tipo. */
function comandiDelValore(a) {
  const id = a.entity_id;
  const s = stati()[id];
  if (!s) return "";
  const v = clean(s.state);
  const at = s.attributes || {};
  const tasto = (servizio, testo, extra = "") =>
    `<button type="button" class="esegui" data-ai-servizio="${esc(servizio)}"${extra}>${esc(testo)}</button>`;
  if (a.tipo === "input_number") {
    const passo = Number(at.step) || 1;
    return `<div class="ai-valore"><b>${esc(valoreDi(id))}</b><input type="range" data-ai-numero min="${esc(at.min ?? 0)}" max="${esc(at.max ?? 100)}" step="${esc(passo)}" value="${esc(v)}" aria-label="${esc(a.nome)}"></div>`;
  }
  if (a.tipo === "input_select")
    return `<div class="ai-valore"><select data-ai-scelta aria-label="${esc(a.nome)}">${(
      at.options || []
    )
      .map((o) => `<option${o === v ? " selected" : ""}>${esc(o)}</option>`)
      .join("")}</select></div>`;
  if (a.tipo === "input_text")
    return `<div class="ai-valore riga-campo"><input type="${at.mode === "password" ? "password" : "text"}" data-ai-testo value="${esc(v === "unknown" ? "" : v)}" maxlength="${esc(at.max ?? 255)}" aria-label="${esc(a.nome)}"><button type="button" class="ai-imposta" data-ai-imposta>${esc(t("Imposta", "Set value"))}</button></div>`;
  if (a.tipo === "input_datetime") {
    const tipoCampo = at.has_date && at.has_time ? "datetime-local" : at.has_date ? "date" : "time";
    const valore =
      tipoCampo === "datetime-local"
        ? v.replace(" ", "T").slice(0, 16)
        : tipoCampo === "time"
          ? v.slice(0, 5)
          : v;
    return `<div class="ai-valore riga-campo"><input type="${tipoCampo}" data-ai-data="${tipoCampo}" value="${esc(valore)}" aria-label="${esc(a.nome)}"><button type="button" class="ai-imposta" data-ai-imposta>${esc(t("Imposta", "Set value"))}</button></div>`;
  }
  if (a.tipo === "counter")
    return `<div class="ai-valore"><b>${esc(valoreDi(id))}</b></div><div class="tasti">${tasto("decrement", "−")}${tasto("increment", "+")}${tasto("reset", t("Azzera", "Reset to zero"))}</div>`;
  if (a.tipo === "timer")
    return `<div class="ai-valore"><b>${esc(valoreDi(id))}</b></div><div class="tasti">${
      v === "active"
        ? tasto("pause", t("Pausa", "Pause"))
        : tasto("start", t("Avvia", "Start timer"))
    }${tasto("cancel", t("Annulla", "Cancel"))}${tasto("finish", t("Finisci", "Finish"))}</div>`;
  if (a.tipo === "input_button")
    return `<div class="tasti">${tasto("press", t("Premi", "Press"))}</div>`;
  if (a.tipo === "schedule")
    return `<div class="ai-valore"><b>${esc(v === "on" ? t("Dentro una fascia", "Inside a slot") : t("Fuori dalle fasce", "Outside the slots"))}</b></div>`;
  return "";
}

function foglioSemplice(a) {
  const tp = tipoDi(a.tipo);
  const s = stati()[a.entity_id];
  const led =
    a.tipo === "input_boolean" && s
      ? `<button type="button" class="led" aria-pressed="${clean(s.state) === "on"}" data-ai-int="${esc(a.entity_id)}" aria-label="${esc(t("Acceso o spento", "Toggle on or off"))}"></button>`
      : "";
  return `<div class="ad-foglio ai-f" role="dialog" aria-modal="true" aria-label="${esc(a.nome)}" style="--c:${tp.colore}"><div class="man"></div>
<div class="su"><span class="orb">${disegno(tp.disegno)}</span><div><h4>${esc(a.nome || a.entity_id)}</h4><div class="dove">${esc(`${scegli(tp)} · ${a.entity_id}`)}</div></div>${led}</div>
${comandiDelValore(a)}
<div class="blk">${riassunto(a) ? `<div class="riga q"><span>${esc(t("Com'è", "Setup"))}</span><div>${esc(riassunto(a))}</div></div>` : ""}</div>
<div class="tasti"><button type="button" class="modifica" data-ai-modifica>✏️ ${esc(t("Modifica", "Edit"))}</button></div>
<div class="op-mod"><button type="button" class="r" data-ai-elimina>${esc(t("Elimina", "Delete"))}</button></div></div>`;
}

function foglioCalcolato(c) {
  const righe = c.entita
    .map((id) => {
      const nome = clean(stati()[id]?.attributes?.friendly_name) || id;
      return `<div class="dv-ent"><span class="aug-testo"><b class="aug-nome"><span>${esc(nome)}</span></b><small class="aug-fr">${esc(id)}</small></span>${destraDellaRiga(id, "calcolato", nome)}</div>`;
    })
    .join("");
  return `<div class="ad-foglio ai-f dv-f" role="dialog" aria-modal="true" aria-label="${esc(c.nome)}" style="--c:${VIOLA}"><div class="man"></div>
<div class="su"><span class="orb">${disegno("mie")}</span><div><h4>${esc(c.nome)}</h4><div class="dove">${esc(c.tipoNome)}</div></div></div>
${righe ? `<div class="dv-lista">${righe}</div>` : ""}
${c.opzioni ? `<div class="tasti"><button type="button" class="modifica" data-ai-opzioni>⚙️ ${esc(t("Opzioni", "Options"))}</button></div>` : ""}
<div class="op-mod"><button type="button" class="r" data-ai-elimina>${esc(t("Elimina", "Delete"))}</button></div></div>`;
}

function foglioNuovo() {
  const tipiCalcolati = state.elenco?.tipiCalcolati || [];
  return `<div class="ad-foglio ai-f ai-nuovo" role="dialog" aria-modal="true" style="--c:${VIOLA}"><div class="man"></div>
<div class="su"><span class="orb">${disegno("mie")}</span><div><h4>${esc(t("Nuovo aiutante", "New helper"))}</h4><div class="dove">${esc(t("Scegli il tipo", "Pick the type"))}</div></div></div>
<div class="ai-et">${esc(t("Semplici", "Simple"))}</div><div class="ai-tipi">${TIPI_DEGLI_AIUTANTI.map(
    (tp) =>
      `<button type="button" class="ai-tipo" style="--c:${tp.colore}" data-ai-crea="${tp.tipo}"><span class="aug-orb">${disegno(tp.disegno)}</span><span><b>${esc(scegli(tp))}</b><small>${esc(
        scegli(SPIEGAZIONI_DEGLI_AIUTANTI[tp.tipo]),
      )}</small></span></button>`,
  ).join("")}</div>${
    tipiCalcolati.length
      ? `<div class="ai-et">${esc(t("Calcolati, con la procedura di Home Assistant", "Computed, with Home Assistant's setup"))}</div><div class="ai-calc">${tipiCalcolati
          .map(
            (c) =>
              `<button type="button" class="dv-cat" data-ai-crea-calcolato="${esc(c.dominio)}"><span><b>${esc(c.nome)}</b></span><i aria-hidden="true">›</i></button>`,
          )
          .join("")}</div>`
      : ""
  }</div>`;
}

function foglioModulo() {
  const m = state.modulo;
  const tp = tipoDi(m.tipo);
  const nome = m.valori.name;
  const tipo = scegli(tp);
  return `<div class="ad-foglio pg ai-f" role="dialog" aria-modal="true" style="--c:${tp.colore}"><div class="man"></div>
<div class="su"><span class="orb">${disegno(tp.disegno)}</span><div><h4>${esc(m.aiutante ? t(`Modifica: ${nome}`, `Edit: ${nome}`) : t(`Nuovo: ${tipo}`, `New: ${tipo}`))}</h4><div class="dove">${esc(
    scegli(SPIEGAZIONI_DEGLI_AIUTANTI[m.tipo]),
  )}</div></div></div>
${m.errore ? `<div class="pg-no">${esc(m.errore)}</div>` : ""}<div class="blk"><div class="pg-modulo" data-ai-modulo>${campiHtml(m.campi, m.valori, { errori: m.errori, mancanti: m.mancanti })}</div></div>
<div class="tasti"><button type="button" class="esegui" data-ai-chiudi>${esc(t("Annulla", "Cancel"))}</button><button type="button" class="modifica" data-ai-salva${m.inVolo ? " disabled" : ""}>${esc(
    m.inVolo ? t("Salvo…", "Saving…") : t("Salva in Home Assistant", "Save to Home Assistant"),
  )}</button></div></div>`;
}

function foglioConferma() {
  const f = state.foglio;
  const nome = (f.voce ? calcolatoDi(f.voce)?.nome : sempliceDi(f.entity)?.nome) || "";
  return `<div class="ad-foglio dv-f" role="dialog" aria-modal="true" style="--c:#dc2626"><div class="man"></div>
<div class="su"><span class="orb">${disegno("mie")}</span><div><h4>${esc(t(`Eliminare «${nome}»?`, `Delete «${nome}»?`))}</h4></div></div>
<p class="dv-testo">${esc(
    t(
      "Home Assistant lo toglie, e le automazioni che lo usano smettono di funzionare. Non si torna indietro.",
      "Home Assistant removes it, and automations using it stop working. This can't be undone.",
    ),
  )}</p><div class="tasti"><button type="button" class="esegui" data-ai-chiudi>${esc(t("Annulla", "Cancel"))}</button><button type="button" class="modifica rosso" data-ai-elimina-si>${esc(
    t("Sì, elimina", "Yes, delete"),
  )}</button></div></div>`;
}

function htmlDelFoglio() {
  const f = state.foglio;
  if (!f) return "";
  if (f.tipo === "nuovo") return foglioNuovo();
  if (f.tipo === "modulo") return state.modulo ? foglioModulo() : "";
  if (f.tipo === "elimina") return foglioConferma();
  if (f.tipo === "semplice") {
    const a = sempliceDi(f.entity);
    return a ? foglioSemplice(a) : "";
  }
  const c = calcolatoDi(f.voce);
  return c ? foglioCalcolato(c) : "";
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
  /* Mentre si tocca un comando del valore il foglio non si riscrive sotto
   * le dita. */
  if (
    velo.dataset.aiScritto === html ||
    (velo.contains(doc.activeElement) && doc.activeElement?.matches?.("input,select"))
  )
    return;
  velo.innerHTML = html;
  velo.dataset.aiScritto = html;
}

function apriIlFoglio(foglio) {
  state.foglio = foglio;
  disegnaIlFoglio();
}

function chiudiIlFoglio() {
  state.foglio = null;
  state.modulo = null;
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

function apriIlModulo(tipo, a = null) {
  const campi = campiDelTipo(tipo, scegli);
  state.modulo = {
    tipo,
    aiutante: a?.id || "",
    campi,
    valori: a
      ? valoriDellAiutante(tipo, a.config)
      : { cosa: "data-ora", mode: tipo === "input_number" ? "slider" : undefined },
    errori: {},
    mancanti: [],
    errore: "",
    inVolo: false,
  };
  apriIlFoglio({ tipo: "modulo" });
}

async function salva() {
  const m = state.modulo;
  if (!m || m.inVolo) return;
  m.valori = leggiICampi(doc.getElementById(ID_DEL_FOGLIO), m.campi);
  const { dati, mancanti } = datiDelModulo(m.campi, m.valori);
  m.mancanti = mancanti;
  m.errori = {};
  m.errore = "";
  if (mancanti.length) return disegnaIlFoglio();
  const fatto = campiPerIlPonte(m.tipo, dati);
  if (fatto.sbagliato) {
    m.errori = { [fatto.sbagliato]: t("Controlla questo campo.", "Check this field.") };
    return disegnaIlFoglio();
  }
  m.inVolo = true;
  disegnaIlFoglio();
  try {
    await chiediAHomeAssistant(
      m.aiutante
        ? {
            type: "ponte/aiutanti/modifica",
            tipo: m.tipo,
            aiutante: m.aiutante,
            campi: fatto.campi,
          }
        : { type: "ponte/aiutanti/crea", tipo: m.tipo, campi: fatto.campi },
      ASPETTA,
    );
  } catch (errore) {
    m.inVolo = false;
    m.errore = capisciIlNo(errore).errore || clean(errore?.message);
    return disegnaIlFoglio();
  }
  const nome = fatto.campi.name;
  chiudiIlFoglio();
  dillo(
    m.aiutante
      ? t(`Salvato: ${nome} ✓`, `Saved: ${nome} ✓`)
      : t(`Creato: ${nome} ✓`, `Created: ${nome} ✓`),
  );
  await chiedi();
}

async function elimina() {
  const f = state.foglio;
  if (f?.tipo !== "elimina") return;
  const a = f.entity ? sempliceDi(f.entity) : null;
  const c = f.voce ? calcolatoDi(f.voce) : null;
  chiudiIlFoglio();
  try {
    await chiediAHomeAssistant(
      c
        ? { type: "ponte/aiutanti/elimina", voce: c.voce, conferma: true }
        : { type: "ponte/aiutanti/elimina", tipo: a.tipo, aiutante: a.id, conferma: true },
      ASPETTA,
    );
    const nome = (c || a).nome;
    dillo(t(`Eliminato: ${nome}`, `Deleted: ${nome}`));
  } catch (errore) {
    dillo(capisciIlNo(errore).errore || t("Non ha funzionato.", "That did not work."));
  }
  await chiedi();
}

function servizio(entity, nome, data = {}) {
  chiamaServizio({ domain: dominio(entity), service: nome, data: { entity_id: entity, ...data } });
}

function impostaIlValore(a) {
  const velo = doc.getElementById(ID_DEL_FOGLIO);
  const testo = velo?.querySelector("[data-ai-testo]");
  if (testo) return servizio(a.entity_id, "set_value", { value: testo.value });
  const data = velo?.querySelector("[data-ai-data]");
  if (!data?.value) return;
  const tipo = data.dataset.aiData;
  if (tipo === "date") servizio(a.entity_id, "set_datetime", { date: data.value });
  else if (tipo === "time")
    servizio(a.entity_id, "set_datetime", {
      time: data.value.length === 5 ? `${data.value}:00` : data.value,
    });
  else servizio(a.entity_id, "set_datetime", { datetime: `${data.value.replace("T", " ")}:00` });
}

/* ── i tocchi ────────────────────────────────────────────────────────────── */

const dentroDiNoi = (el) => el?.closest?.(`#${ID_DEGLI_AIUTANTI}, #${ID_DEL_FOGLIO}`);

function onClick(event) {
  const el = event.target;
  if (!dentroDiNoi(el)) return;
  const velo = doc.getElementById(ID_DEL_FOGLIO);
  if (velo && el === velo) {
    chiudiIlFoglio();
    return;
  }
  const tocco = el.closest(
    "[data-ai-scopri],[data-ai-per],[data-ai-gruppo],[data-ai-int],[data-ai-premi],[data-ai-nuovo],[data-ai-crea],[data-ai-crea-calcolato],[data-ai-modifica],[data-ai-opzioni],[data-ai-elimina],[data-ai-elimina-si],[data-ai-chiudi],[data-ai-salva],[data-ai-servizio],[data-ai-imposta],[data-ai-semplice],[data-ai-calcolato]",
  );
  if (!tocco) return;
  const d = tocco.dataset;
  event.preventDefault();
  if (d.aiScopri !== undefined) {
    scopriPremium();
    return;
  }
  if (state.premium === false) return;
  if (d.aiPer) {
    state.per = d.aiPer === "tutti" ? "tutti" : "tipo";
    ridisegna();
    return;
  }
  if (d.aiGruppo) {
    state.chiusi = state.chiusi.includes(d.aiGruppo)
      ? state.chiusi.filter((k) => k !== d.aiGruppo)
      : [...state.chiusi, d.aiGruppo];
    ridisegna();
    return;
  }
  if (d.aiInt) {
    event.stopPropagation();
    servizio(d.aiInt, "toggle");
    return;
  }
  if (d.aiPremi) {
    event.stopPropagation();
    servizio(d.aiPremi, "press");
    return;
  }
  if (d.aiNuovo !== undefined) {
    apriIlFoglio({ tipo: "nuovo" });
    return;
  }
  if (d.aiCrea) {
    apriIlModulo(d.aiCrea);
    return;
  }
  if (d.aiCreaCalcolato) {
    const c = (state.elenco?.tipiCalcolati || []).find((x) => x.dominio === d.aiCreaCalcolato);
    chiudiIlFoglio();
    apriLaProcedura({
      handler: d.aiCreaCalcolato,
      nome: c?.nome || "",
      quandoFinisce: () => void chiedi(),
    });
    return;
  }
  if (d.aiChiudi !== undefined) {
    chiudiIlFoglio();
    return;
  }
  if (d.aiSalva !== undefined) {
    void salva();
    return;
  }
  if (d.aiEliminaSi !== undefined) {
    void elimina();
    return;
  }
  const f = state.foglio;
  const a = f?.tipo === "semplice" ? sempliceDi(f.entity) : null;
  const c = f?.tipo === "calcolato" ? calcolatoDi(f.voce) : null;
  if (d.aiModifica !== undefined && a) {
    apriIlModulo(a.tipo, a);
    return;
  }
  if (d.aiOpzioni !== undefined && c) {
    chiudiIlFoglio();
    apriLaProcedura({
      handler: c.voce,
      genere: "opzioni",
      nome: c.nome,
      quandoFinisce: () => void chiedi(),
    });
    return;
  }
  if (d.aiElimina !== undefined && (a || c)) {
    apriIlFoglio(a ? { tipo: "elimina", entity: a.entity_id } : { tipo: "elimina", voce: c.voce });
    return;
  }
  if (d.aiServizio && a) {
    servizio(a.entity_id, d.aiServizio);
    return;
  }
  if (d.aiImposta !== undefined && a) {
    impostaIlValore(a);
    return;
  }
  if (d.aiSemplice) apriIlFoglio({ tipo: "semplice", entity: d.aiSemplice });
  else if (d.aiCalcolato) apriIlFoglio({ tipo: "calcolato", voce: d.aiCalcolato });
}

function onChange(event) {
  const campo = event.target;
  if (!dentroDiNoi(campo)) return;
  const a = state.foglio?.tipo === "semplice" ? sempliceDi(state.foglio.entity) : null;
  if (!a) return;
  if (campo.matches?.("[data-ai-numero]"))
    servizio(a.entity_id, "set_value", { value: Number(campo.value) });
  else if (campo.matches?.("[data-ai-scelta]"))
    servizio(a.entity_id, "select_option", { option: campo.value });
}

function onInput(event) {
  const campo = event.target;
  if (!campo?.matches?.("[data-ai-cerca]") || !dentroDiNoi(campo)) return;
  state.cerca = campo.value;
  ridisegna();
}

function onKey(event) {
  if (event.key === "Escape" && state.foglio && !proceduraAperta()) {
    chiudiIlFoglio();
    return;
  }
  if (event.key !== "Enter" && event.key !== " ") return;
  const riga = event.target?.closest?.("[data-ai-semplice],[data-ai-calcolato]");
  if (!riga || event.target !== riga || !dentroDiNoi(riga)) return;
  event.preventDefault();
  riga.click();
}

/* ── lo stile ────────────────────────────────────────────────────────────── */

function stili() {
  installStyle(
    "dm-aiutanti-app-style",
    `
.ad-foglio.ai-f .ai-valore{margin-top:14px;display:grid;gap:10px;padding:14px;border-radius:18px;background:color-mix(in srgb,var(--c) 8%,transparent)}
.ad-foglio.ai-f .ai-valore b{font-family:Oswald,sans-serif;font-size:30px;line-height:1;color:var(--c)}
.ad-foglio.ai-f .ai-valore input[type=range]{width:100%;accent-color:var(--c)}
.ad-foglio.ai-f .ai-valore select,.ad-foglio.ai-f .ai-valore input:not([type=range]){width:100%;box-sizing:border-box;border:1px solid var(--divider-color,#dbe4ee);border-radius:12px;padding:10px 12px;background:var(--card-bg,#fff);color:var(--text,#0f172a);font:inherit;font-size:15px;font-weight:700}
.ad-foglio.ai-f .ai-valore.riga-campo{grid-template-columns:1fr auto}
.ad-foglio.ai-f .ai-imposta{border:0;border-radius:12px;padding:0 16px;background:var(--c);color:#fff;font:inherit;font-weight:900;cursor:pointer}
.ad-foglio.ai-f .ai-et{margin:16px 4px 8px;font-size:10.5px;font-weight:900;letter-spacing:1.2px;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
.ad-foglio.ai-nuovo{max-height:86vh}
.ad-foglio.ai-f .ai-tipi{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ad-foglio.ai-f .ai-tipo{display:flex;align-items:flex-start;gap:9px;padding:10px;border-radius:16px;border:1px solid var(--divider-color,#e2e8f0);background:var(--card-bg,#fff);color:var(--text,#0f172a);font:inherit;text-align:left;cursor:pointer}
.ad-foglio.ai-f .ai-tipo>span:last-child{display:grid;gap:2px;min-width:0}
.ad-foglio.ai-f .ai-tipo b{font-size:13.5px;font-weight:800}
.ad-foglio.ai-f .ai-tipo small{font-size:11px;line-height:1.3;font-weight:700;color:var(--secondary-text-color,#64748b)}
.ad-foglio.ai-f .ai-calc{display:grid;gap:6px}
.ad-foglio.ai-f .tasti button{min-width:0}
`,
  );
}

/* ── installare ──────────────────────────────────────────────────────────── */

function prendiLeManiglie() {
  root.gdahomeApriGliAiutanti = apriGliAiutanti;
  root.gdahomeTornaDagliAiutanti = tornaDagliAiutanti;
  root.addEventListener?.("message", (evento) => {
    const detto = evento?.data;
    if (!detto || typeof detto !== "object" || evento.source !== root.parent) return;
    if (detto.gdahome === "apri-gli-aiutanti") apriGliAiutanti();
    else if (detto.gdahome === "torna-dagli-aiutanti") tornaDagliAiutanti();
  });
  doc.addEventListener(
    "click",
    (evento) => {
      if (!state.inApp) return;
      const voce = evento.target?.closest?.(".tab");
      if (voce && !voce.closest(`#${ID_DEGLI_AIUTANTI}`)) {
        chiudiIlFoglio();
        state.inApp = false;
        doc.getElementById(ID_DEGLI_AIUTANTI)?.remove();
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

export function installAiutantiAppSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  stili();
  prendiLeManiglie();
  doc.addEventListener("click", onClick);
  doc.addEventListener("change", onChange);
  doc.addEventListener("input", onInput);
  doc.addEventListener("keydown", onKey);
  root.addEventListener?.("dashboardmodern:states-ready", piuTardi);
  return true;
}

/* Per le prove. */
export const _statoDegliAiutanti = state;
