/* La procedura guidata di Home Assistant, nel foglio della plancia.
 *
 * Aggiungere un'integrazione, rifarne l'accesso, cambiarne le opzioni, creare
 * un aiutante calcolato: Home Assistant le fa tutte con la stessa procedura,
 * una domanda alla volta. Qui si fanno nello stesso foglio delle automazioni
 * (`ad-velo` / `ad-foglio`), con le parole dell'integrazione nella lingua di
 * chi guarda: un modulo, un menu, «Apri nel browser» per chi chiede il login
 * sul sito del produttore, un'attesa, e alla fine «Fatto» o il perche' del no.
 *
 * Le domande passano dal ponte (`ponte/flussi/*`, `ponte/src/integrazioni.js`),
 * che le inoltra a Home Assistant solo dall'app, solo per chi amministra Home
 * Assistant e solo con GdAHome Premium. Quello che si scrive nei campi va a
 * Home Assistant e basta: la plancia non lo tiene da nessuna parte.
 */
import {
  campiDelPasso,
  datiDelModulo,
  erroriDelPasso,
  fraseDiUnCodice,
  paroleDelPasso,
  valoriDiPartenza,
  vociDelMenu,
} from "../core/flussi-di-home-assistant.js";
import { oggettoWidget } from "../core/oggetti-widget.js";
import {
  activeLocale,
  allStates,
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  installStyle,
  root,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_PROCEDURA__";
const state = (root[KEY] ||= {
  installed: false,
  passo: null,
  campi: [],
  valori: {},
  mancanti: [],
  nome: "",
  inVolo: false,
  errore: "",
  quandoFinisce: null,
  attesa: 0,
  finita: false,
});

const ID_DEL_FOGLIO = "pg-foglio";
const VIOLA = "#7c3aed";
const ASPETTA = 60_000;

const scegli = (coppia) => t(coppia.it, coppia.en);
const lingua = () => clean(activeLocale()) || "it";

function chiedi(tipo, campi = {}) {
  return chiediAHomeAssistant({ type: tipo, lingua: lingua(), ...campi }, ASPETTA);
}

/** Apre la procedura: una nuova (`handler`, e `genere: "opzioni"` per le
 * opzioni di una voce) o una gia' cominciata da Home Assistant (`flow_id`:
 * un dispositivo trovato in rete, un accesso da rifare). `quandoFinisce`
 * viene chiamata quando Home Assistant ha creato o cambiato la voce. */
export function apriLaProcedura({
  handler = "",
  genere = "integrazione",
  flow_id = "",
  nome = "",
  quandoFinisce = null,
} = {}) {
  if (!doc?.body) return false;
  stili();
  Object.assign(state, {
    passo: null,
    campi: [],
    valori: {},
    mancanti: [],
    nome: clean(nome),
    inVolo: true,
    errore: "",
    quandoFinisce,
    finita: false,
  });
  disegna();
  const domanda = flow_id
    ? chiedi("ponte/flussi/leggi", { flow_id })
    : chiedi("ponte/flussi/avvia", { handler, genere });
  void domanda.then(mostra, sbagliato);
  return true;
}

export const proceduraAperta = () => Boolean(doc?.getElementById?.(ID_DEL_FOGLIO));

function sbagliato(errore) {
  state.inVolo = false;
  state.errore =
    clean(errore?.message) === "timeout"
      ? t("Home Assistant non ha risposto in tempo.", "Home Assistant did not answer in time.")
      : clean(errore?.message) || t("Non ha funzionato.", "That did not work.");
  disegna();
}

function mostra(passo) {
  root.clearTimeout?.(state.attesa);
  state.inVolo = false;
  state.errore = "";
  state.mancanti = [];
  /* Lo stesso modulo che torna con un errore tiene quello che si era scritto. */
  const stesso =
    passo?.tipo === "form" &&
    state.passo?.tipo === "form" &&
    state.passo.flow_id === passo.flow_id &&
    state.passo.step_id === passo.step_id;
  const scritti = stesso ? state.valori : {};
  state.passo = passo || null;
  state.campi = passo?.tipo === "form" ? campiDelPasso(passo) : [];
  state.valori = { ...valoriDiPartenza(state.campi), ...scritti };
  if (passo?.tipo === "create_entry") {
    state.finita = true;
    try {
      state.quandoFinisce?.(passo);
    } catch (_errore) {}
  }
  /* Un'attesa (Home Assistant cerca, scarica, aspetta il dispositivo): si
   * richiede ogni due secondi finche' non passa al passo dopo. */
  if (passo?.tipo === "progress")
    state.attesa = root.setTimeout?.(() => {
      if (!proceduraAperta() || state.passo?.flow_id !== passo.flow_id) return;
      void chiedi("ponte/flussi/leggi", { flow_id: passo.flow_id }).then(mostra, sbagliato);
    }, 2000);
  disegna();
}

/* ── il disegno ──────────────────────────────────────────────────────────── */

const obbligo = (c) => (c.obbligatorio ? ' <i class="pg-obb" aria-hidden="true">*</i>' : "");

function entitaPer(c) {
  let stati = {};
  try {
    stati = allStates() || {};
  } catch (_errore) {}
  return Object.keys(stati)
    .filter((id) => !c.domini?.length || c.domini.includes(id.split(".")[0]))
    .map((id) => ({ valore: id, etichetta: clean(stati[id]?.attributes?.friendly_name) || id }))
    .sort((a, b) => a.etichetta.localeCompare(b.etichetta));
}

function opzioniHtml(voci, scelti, vuota) {
  const set = new Set([].concat(scelti ?? []).map(String));
  return `${vuota ? `<option value="">${esc(vuota)}</option>` : ""}${voci
    .map(
      (o) =>
        `<option value="${esc(o.valore)}"${set.has(String(o.valore)) ? " selected" : ""}>${esc(o.etichetta)}</option>`,
    )
    .join("")}`;
}

function campoHtml(c, errori, valori = state.valori, mancanti = state.mancanti) {
  const v = valori[c.nome];
  const errore =
    errori.campi[c.nome] ||
    (mancanti.includes(c.nome) ? t("Serve una risposta.", "An answer is needed.") : "");
  const sotto = `${c.aiuto ? `<small>${esc(c.aiuto)}</small>` : ""}${errore ? `<em>${esc(errore)}</em>` : ""}`;
  const attr = `data-pg-campo="${esc(c.nome)}"`;
  const testa = `<span class="pg-et">${esc(c.etichetta)}${obbligo(c)}</span>`;
  if (c.tipo === "si-no")
    return `<label class="pg-campo pg-si${errore ? " sbagliato" : ""}"><span class="pg-et">${esc(c.etichetta)}</span><input type="checkbox" role="switch" class="pg-int" ${attr}${v === true ? " checked" : ""}>${sotto ? `<span class="pg-sotto">${sotto}</span>` : ""}</label>`;
  if (c.tipo === "costante")
    return `<div class="pg-campo"><span class="pg-et">${esc(c.etichetta)}</span><b class="pg-cost">${esc(String(c.valore ?? ""))}</b></div>`;
  let dentro;
  if (c.tipo === "testo-lungo") dentro = `<textarea ${attr} rows="4">${esc(v ?? "")}</textarea>`;
  else if (c.tipo === "numero")
    dentro = `<span class="pg-num"><input type="number" inputmode="decimal" ${attr} value="${esc(v ?? "")}"${c.min !== undefined ? ` min="${c.min}"` : ""}${c.max !== undefined ? ` max="${c.max}"` : ""} step="${esc(c.passo ?? "any")}">${c.unita ? `<i>${esc(c.unita)}</i>` : ""}</span>`;
  else if (c.tipo === "scelta")
    dentro = `<select ${attr}>${opzioniHtml(c.opzioni || [], v, c.obbligatorio && v !== undefined ? "" : "—")}</select>`;
  else if (c.tipo === "scelte")
    dentro = `<span class="pg-scelte">${(c.opzioni || [])
      .map(
        (o) =>
          `<label><input type="checkbox" data-pg-scelta="${esc(c.nome)}" value="${esc(o.valore)}"${
            []
              .concat(v ?? [])
              .map(String)
              .includes(String(o.valore))
              ? " checked"
              : ""
          }><span>${esc(o.etichetta)}</span></label>`,
      )
      .join("")}</span>`;
  else if (c.tipo === "entita")
    dentro = `<select ${attr}${c.multiplo ? ' multiple size="5"' : ""}>${opzioniHtml(entitaPer(c), v, c.multiplo ? "" : "—")}</select>`;
  else if (c.tipo === "ora") dentro = `<input type="time" ${attr} value="${esc(v ?? "")}">`;
  else if (c.tipo === "durata")
    dentro = `<input type="text" inputmode="numeric" ${attr} value="${esc(v ?? "")}" placeholder="0:30:00">`;
  else
    dentro = `<input type="${c.tipo === "password" ? "password" : "text"}" ${attr} value="${esc(v ?? "")}" autocomplete="off" autocapitalize="off" spellcheck="false">`;
  return `<label class="pg-campo${errore ? " sbagliato" : ""}">${testa}${dentro}${sotto}</label>`;
}

/** I campi di un modulo con la faccia della procedura: li usano anche gli
 * Aiutanti, nel foglio `ad-foglio pg`. */
export function campiHtml(campi, valori = {}, { errori = {}, mancanti = [] } = {}) {
  return campi.map((c) => campoHtml(c, { base: "", campi: errori }, valori, mancanti)).join("");
}

function moduloHtml(p) {
  const errori = erroriDelPasso(p, { scegli });
  let sezione = "";
  const campi = state.campi
    .map((c) => {
      let prima = "";
      if (c.sezione && c.sezione !== sezione) {
        const step = clean(p.step_id);
        prima = `<div class="pg-sez">${esc(clean(p.parole?.[`step.${step}.sections.${c.sezione}.name`]) || c.sezione.replaceAll("_", " "))}</div>`;
      }
      sezione = c.sezione;
      return prima + campoHtml(c, errori);
    })
    .join("");
  return `${errori.base ? `<div class="pg-no">${esc(errori.base)}</div>` : ""}<form class="pg-modulo" data-pg-modulo novalidate>${campi}</form><div class="tasti"><button type="button" class="esegui" data-pg-chiudi>${esc(
    t("Annulla", "Cancel"),
  )}</button><button type="button" class="modifica" data-pg-invia${state.inVolo ? " disabled" : ""}>${esc(
    state.inVolo
      ? t("Un attimo…", "One moment…")
      : p.ultimo
        ? t("Fine", "Finish")
        : t("Avanti", "Next"),
  )}</button></div>`;
}

function corpoHtml() {
  const p = state.passo;
  if (!p && state.errore)
    return `<div class="pg-no">${esc(state.errore)}</div><div class="tasti"><button type="button" class="modifica" data-pg-chiudi>${esc(t("Chiudi", "Close"))}</button></div>`;
  if (!p)
    return `<div class="pg-attesa"><span class="pg-giro" aria-hidden="true"></span>${esc(t("Chiedo a Home Assistant…", "Asking Home Assistant…"))}</div>`;
  const errore = state.errore ? `<div class="pg-no">${esc(state.errore)}</div>` : "";
  if (p.tipo === "form") return errore + moduloHtml(p);
  if (p.tipo === "menu")
    return `${errore}<div class="pg-menu">${vociDelMenu(p)
      .map(
        (v) =>
          `<button type="button" data-pg-menu="${esc(v.valore)}"><span>${esc(v.etichetta)}</span><i aria-hidden="true">›</i></button>`,
      )
      .join(
        "",
      )}</div><div class="tasti"><button type="button" class="esegui" data-pg-chiudi>${esc(t("Annulla", "Cancel"))}</button></div>`;
  if (p.tipo === "external")
    return `${errore}<p class="pg-testo">${esc(
      t(
        "Questo passo si fa sul sito del produttore: si apre nel browser, e quando hai finito torni qui.",
        "This step is done on the manufacturer's website: it opens in the browser, and when you're done you come back here.",
      ),
    )}</p><div class="tasti"><button type="button" class="esegui" data-pg-fuori>${esc(t("Apri nel browser ↗", "Open in the browser ↗"))}</button><button type="button" class="modifica" data-pg-continua>${esc(
      t("Ho finito, continua", "Done, continue"),
    )}</button></div>`;
  if (p.tipo === "progress")
    return `<div class="pg-attesa"><span class="pg-giro" aria-hidden="true"></span>${esc(
      clean(p.parole?.[`progress.${p.azione}`]) ||
        t("Home Assistant ci sta lavorando…", "Home Assistant is working on it…"),
    )}</div><div class="tasti"><button type="button" class="esegui" data-pg-chiudi>${esc(t("Annulla", "Cancel"))}</button></div>`;
  if (p.tipo === "create_entry")
    return `<div class="pg-fatto"><span aria-hidden="true">✓</span><b>${esc(clean(p.titolo) || state.nome)}</b><small>${esc(
      t("Fatto: è in Home Assistant.", "Done: it's in Home Assistant."),
    )}</small></div><div class="tasti"><button type="button" class="modifica" data-pg-chiudi>${esc(t("Fatto", "Done"))}</button></div>`;
  if (p.tipo === "abort")
    return `<div class="pg-no">${esc(fraseDiUnCodice(p, "abort", p.perche, { scegli }))}</div><div class="tasti"><button type="button" class="modifica" data-pg-chiudi>${esc(t("Chiudi", "Close"))}</button></div>`;
  return `<div class="pg-no">${esc(t("Questo passo non si fa da qui.", "This step can't be done from here."))}</div><div class="tasti"><button type="button" class="modifica" data-pg-chiudi>${esc(t("Chiudi", "Close"))}</button></div>`;
}

function htmlDelFoglio() {
  const p = state.passo;
  const { titolo, spiegazione } = p
    ? paroleDelPasso(p, { nomeIntegrazione: state.nome })
    : { titolo: state.nome, spiegazione: "" };
  const passoN =
    p?.tipo === "form" && p.step_id
      ? `${esc(state.nome || titolo)}`
      : esc(t("Procedura guidata", "Setup"));
  return `<div class="ad-foglio pg" role="dialog" aria-modal="true" aria-label="${esc(titolo)}" style="--c:${VIOLA}"><div class="man"></div>
<div class="su"><span class="orb">${oggettoWidget("widget", "🧩", "pg-orb")}</span><div><h4>${esc(titolo || t("Procedura guidata", "Setup"))}</h4><div class="dove">${passoN}</div></div><button type="button" class="pg-x" data-pg-chiudi aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
${spiegazione && p?.tipo !== "abort" && p?.tipo !== "create_entry" ? `<p class="pg-testo">${esc(spiegazione).replaceAll("\n", "<br>")}</p>` : ""}
<div class="blk">${corpoHtml()}</div></div>`;
}

function disegna() {
  if (!doc?.body) return;
  let velo = doc.getElementById(ID_DEL_FOGLIO);
  if (!velo) {
    velo = doc.createElement("div");
    velo.id = ID_DEL_FOGLIO;
    velo.className = "ad-velo";
    doc.body.append(velo);
  }
  velo.innerHTML = htmlDelFoglio();
}

/* ── le risposte ─────────────────────────────────────────────────────────── */

function leggiIlModulo() {
  return leggiICampi(doc.getElementById(ID_DEL_FOGLIO), state.campi);
}

/** I valori scritti nei campi di `campiHtml`, dentro `velo`. */
export function leggiICampi(velo, campi) {
  const valori = {};
  if (!velo) return valori;
  for (const c of campi) {
    if (c.tipo === "scelte") {
      valori[c.nome] = [...velo.querySelectorAll("[data-pg-scelta]")]
        .filter((n) => n.dataset.pgScelta === c.nome && n.checked)
        .map((n) => n.value);
      continue;
    }
    const n = [...velo.querySelectorAll("[data-pg-campo]")].find(
      (x) => x.dataset.pgCampo === c.nome,
    );
    if (!n) continue;
    if (n.type === "checkbox") valori[c.nome] = n.checked;
    else if (n.multiple) valori[c.nome] = [...n.selectedOptions].map((o) => o.value);
    else valori[c.nome] = n.value;
  }
  return valori;
}

function rispondi(dati) {
  const p = state.passo;
  if (!p?.flow_id || state.inVolo) return;
  state.inVolo = true;
  state.errore = "";
  disegna();
  void chiedi("ponte/flussi/passo", { flow_id: p.flow_id, dati }).then(mostra, (e) => {
    state.inVolo = false;
    state.errore = clean(e?.message) || t("Non ha funzionato.", "That did not work.");
    disegna();
  });
}

function invia() {
  state.valori = leggiIlModulo();
  const { dati, mancanti } = datiDelModulo(state.campi, state.valori);
  state.mancanti = mancanti;
  if (mancanti.length) {
    disegna();
    return;
  }
  rispondi(dati);
}

export function chiudiLaProcedura() {
  root.clearTimeout?.(state.attesa);
  const p = state.passo;
  if (p?.flow_id && !state.finita && !["abort", "create_entry"].includes(p.tipo))
    void chiedi("ponte/flussi/annulla", { flow_id: p.flow_id }).catch(() => {});
  state.passo = null;
  doc?.getElementById?.(ID_DEL_FOGLIO)?.remove();
}

function onClick(event) {
  const velo = doc.getElementById(ID_DEL_FOGLIO);
  if (!velo || !velo.contains(event.target)) return;
  if (event.target === velo) {
    chiudiLaProcedura();
    return;
  }
  const tocco = event.target.closest(
    "[data-pg-chiudi],[data-pg-invia],[data-pg-menu],[data-pg-fuori],[data-pg-continua]",
  );
  if (!tocco) return;
  event.preventDefault();
  const d = tocco.dataset;
  if (d.pgChiudi !== undefined) chiudiLaProcedura();
  else if (d.pgInvia !== undefined) invia();
  else if (d.pgMenu) rispondi({ next_step_id: d.pgMenu });
  else if (d.pgContinua !== undefined) rispondi({});
  else if (d.pgFuori !== undefined) {
    const url = clean(state.passo?.url);
    if (/^https:\/\//i.test(url)) root.open?.(url, "_blank", "noopener");
  }
}

/* Si scrive in un campo segnato: il segno se ne va. */
function onInput(event) {
  const campo = event.target?.closest?.(".pg-campo.sbagliato");
  if (!campo) return;
  campo.classList.remove("sbagliato");
  campo.querySelector("em")?.remove();
}

function onKey(event) {
  if (!proceduraAperta()) return;
  if (event.key === "Escape") chiudiLaProcedura();
  else if (
    event.key === "Enter" &&
    event.target?.closest?.("[data-pg-modulo]") &&
    event.target.tagName !== "TEXTAREA"
  ) {
    event.preventDefault();
    invia();
  }
}

/* ── lo stile ────────────────────────────────────────────────────────────── */

function stili() {
  installStyle(
    "dm-procedura-style",
    `
.ad-foglio.pg .pg-x{margin-left:auto;flex:none;width:36px;height:36px;border-radius:50%;border:1px solid var(--divider-color,#dbe4ee);background:transparent;color:var(--secondary-text-color,#64748b);font:inherit;font-size:14px;font-weight:900;cursor:pointer}
.ad-foglio.pg .pg-testo{margin:12px 2px 0;font-size:13.5px;line-height:1.55;font-weight:600;color:var(--secondary-text-color,#64748b)}
.ad-foglio.pg .pg-modulo{display:grid;gap:10px}
.ad-foglio.pg .pg-campo{display:grid;gap:5px;padding:10px 13px;border-radius:16px;background:color-mix(in srgb,var(--text,#0f172a) 4%,transparent)}
.ad-foglio.pg .pg-et{font-size:10.5px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:var(--secondary-text-color,#64748b)}
.ad-foglio.pg .pg-obb{font-style:normal;color:${VIOLA}}
.ad-foglio.pg .pg-campo input:not([type=checkbox]),.ad-foglio.pg .pg-campo select,.ad-foglio.pg .pg-campo textarea{width:100%;box-sizing:border-box;border:1px solid var(--divider-color,#dbe4ee);border-radius:12px;padding:10px 12px;background:var(--card-bg,#fff);color:var(--text,#0f172a);font:inherit;font-size:15px;font-weight:700;outline:none}
.ad-foglio.pg .pg-campo :is(input,select,textarea):focus{border-color:${VIOLA};box-shadow:0 0 0 3px color-mix(in srgb,${VIOLA} 18%,transparent)}
.ad-foglio.pg .pg-campo small{font-size:12px;line-height:1.4;font-weight:600;color:var(--secondary-text-color,#64748b)}
.ad-foglio.pg .pg-campo em{font-style:normal;font-size:12px;font-weight:800;color:#dc2626}
.ad-foglio.pg .pg-campo.sbagliato{box-shadow:inset 0 0 0 1px #fca5a5}
.ad-foglio.pg .pg-num{display:flex;align-items:center;gap:8px}
.ad-foglio.pg .pg-num i{font-style:normal;font-size:13px;font-weight:800;color:var(--secondary-text-color,#64748b)}
.ad-foglio.pg .pg-si{grid-template-columns:1fr auto;align-items:center}
.ad-foglio.pg .pg-si .pg-et{font-size:14px;letter-spacing:0;text-transform:none;color:var(--text,#0f172a);font-weight:800}
.ad-foglio.pg .pg-sotto{grid-column:1/-1;display:grid;gap:3px}
.ad-foglio.pg .pg-int{appearance:none;-webkit-appearance:none;margin:0;position:relative;width:46px;height:28px;border-radius:999px;background:color-mix(in srgb,var(--text,#0f172a) 18%,transparent);cursor:pointer;transition:background .15s ease}
.ad-foglio.pg .pg-int:checked{background:${VIOLA}}
.ad-foglio.pg .pg-int::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(15,23,42,.35);transition:transform .15s ease}
.ad-foglio.pg .pg-int:checked::after{transform:translateX(18px)}
.ad-foglio.pg .pg-scelte{display:grid;gap:6px}
.ad-foglio.pg .pg-scelte label{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:700}
.ad-foglio.pg .pg-scelte input{width:18px;height:18px;accent-color:${VIOLA}}
.ad-foglio.pg .pg-cost{font-size:14px}
.ad-foglio.pg .pg-sez{margin:6px 4px 0;font-size:11px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;color:${VIOLA}}
.ad-foglio.pg .pg-no{padding:11px 14px;border-radius:14px;background:color-mix(in srgb,#dc2626 10%,transparent);color:#b91c1c;font-size:13.5px;font-weight:800;line-height:1.45}
html[data-theme="dark"] .ad-foglio.pg .pg-no{color:#fca5a5}
.ad-foglio.pg .pg-menu{display:grid;gap:8px}
.ad-foglio.pg .pg-menu button{display:flex;align-items:center;gap:10px;width:100%;padding:13px 15px;border-radius:16px;border:1px solid var(--divider-color,#dbe4ee);background:var(--card-bg,#fff);color:var(--text,#0f172a);font:inherit;font-size:14.5px;font-weight:800;text-align:left;cursor:pointer}
.ad-foglio.pg .pg-menu button span{flex:1}
.ad-foglio.pg .pg-menu i{font-style:normal;color:${VIOLA};font-size:18px}
.ad-foglio.pg .pg-attesa{display:flex;align-items:center;gap:12px;padding:18px 6px;font-size:14px;font-weight:700;color:var(--secondary-text-color,#64748b)}
.ad-foglio.pg .pg-giro{width:22px;height:22px;border-radius:50%;border:3px solid color-mix(in srgb,${VIOLA} 22%,transparent);border-top-color:${VIOLA};animation:pg-giro 0.9s linear infinite}
@keyframes pg-giro{to{transform:rotate(360deg)}}
.ad-foglio.pg .pg-fatto{display:grid;justify-items:center;gap:6px;padding:16px 0 4px;text-align:center}
.ad-foglio.pg .pg-fatto span{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;background:#16a34a;color:#fff;font-size:28px;font-weight:900;box-shadow:0 10px 24px -10px #16a34a}
.ad-foglio.pg .pg-fatto b{font-size:17px}
.ad-foglio.pg .pg-fatto small{font-size:13px;font-weight:600;color:var(--secondary-text-color,#64748b)}
.ad-foglio.pg .tasti button:disabled{opacity:.6;cursor:default}
`,
  );
}

export function installProceduraGuidataSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  stili();
  doc.addEventListener("click", onClick);
  doc.addEventListener("keydown", onKey);
  doc.addEventListener("input", onInput);
  return true;
}

/* Per le prove. */
export const _statoDellaProcedura = state;
