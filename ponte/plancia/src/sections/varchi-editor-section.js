/* La scheda dei varchi in configurazione (#367, #377, #74).
 *
 * «Sezione varchi attuale non ha alcuna possibilità di inserire icone.
 *  Inoltre è differente dalle altre sezioni in quanto si autocompila, cosa che
 *  avevo detto già di eliminare, e sotto compaiono ancora quelle che ho
 *  eliminato da sopra.»
 *
 * Tre difetti, e sono lo stesso difetto: questa scheda non era una scheda, era
 * un RILEVAMENTO con delle correzioni sopra. L'elenco lo faceva Home Assistant
 * — tutto quello che si chiamava «door» o «window» — il cestino non cancellava
 * ma ESCLUDEVA, e l'escluso restava scritto sotto in «Tolti dai conti». Di
 * suo, chi abita la casa poteva solo cambiare il nome.
 *
 * Adesso è come Porte e cancelli, come i Carichi, come tutte le altre: una
 * riga per varco, e dentro la riga le tre cose che un varco ha — l'entità, il
 * nome, il disegno. La metti tu, e quando la elimini è eliminata.
 *
 * ── Quello che c'era non si perde ─────────────────────────────────────────
 *
 * Alla prima apertura la scheda scrive come righe esattamente quello che la
 * pagina mostrava fino a un attimo prima: i nomi che uno aveva già dato, senza
 * quelli che aveva già tolto, col disegno che viene dalla classe. Chi apre la
 * scheda dopo l'aggiornamento ritrova la sua casa, non un foglio bianco.
 *
 * ── E quello che arriva dopo ──────────────────────────────────────────────
 *
 * Una finestra nuova in casa non entra più da sola — è il punto di tutto — ma
 * nemmeno si deve cercare a mano: il tasto in fondo dice quanti contatti Home
 * Assistant ha trovato che qui dentro non ci sono, e li mette come righe. Una
 * volta sola, e poi sono tue.
 */
import { CHIAVE_VERSI, insiemeInvertiti } from "../core/verso-aperture.js";
import {
  CHIAVE_VARCHI,
  conLaRiga,
  righeDichiarate,
  senzaLaRiga,
  varchiConLeFinestre,
  varchiDaImportare,
  varchiDiCasa,
} from "../core/varchi-di-casa.js";
import { VARCHI_TAB, renderVarchi } from "./varchi-section.js";
import {
  allStates,
  clean,
  disegnoDiCasa,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
  writeJsonIfChanged,
} from "./shared.js";
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

const KEY = "__DASHBOARDMODERN_VARCHI_EDITOR__";
const state = (root[KEY] ||= { installed: false, aperto: -1 });

export const VARCHI_EDITOR_TAB = VARCHI_TAB;

/* I disegni che la scheda mette davanti, in ordine di quanto sono comuni in
 * una casa. Sono tredici: tutto quello che in una casa si apre. */
export const DISEGNI_DEL_VARCO = Object.freeze([
  "door",
  "front-door",
  "window",
  "french-window",
  "sliding-door",
  "gate",
  "garage-door",
  "barrier",
  "shutters",
  "skylight",
  "hatch",
  "doorway",
  "lift",
]);

function righeDelleFinestre() {
  return root.getTapparelle?.() || readJson("cd_tapparelle", []);
}

function configurazione() {
  return readJson(CHIAVE_VARCHI, {}) || {};
}

/** Le righe scritte, oppure `null` se questa casa non ha ancora dichiarato. */
function righe() {
  return righeDichiarate(configurazione());
}

function salva(prossima) {
  writeJsonIfChanged(CHIAVE_VARCHI, prossima);
  renderVarchi();
}

function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmVarchiEditor;
  ensureVarchiEditor();
}

/* ── quello che il rilevamento proporrebbe ───────────────────────────────── */

/* I contatti che Home Assistant dichiara varchi e che qui dentro non ci sono.
 *
 * Sono la proposta del tasto in fondo, e — la prima volta — sono la
 * migrazione: la' dentro c'e' tutto quello che la pagina mostrava, coi nomi
 * gia' scritti e senza gli esclusi. */
function daPrendere() {
  const states = allStates();
  const vecchia = varchiConLeFinestre(configurazione(), righeDelleFinestre());
  const gia = new Set((righe() || []).map((riga) => riga.entity).filter(Boolean));
  return varchiDaImportare(states, vecchia, (entity) => nomeDaHomeAssistant(entity, states)).filter(
    (riga) => !gia.has(riga.entity),
  );
}

/* ── il disegno della scheda ──────────────────────────────────────────────── */

function strisciaMarkup(indice, scelto) {
  return `<label class="ed-slot dm-varco-ed-campo"><span class="ed-slot-lbl">${esc(t("Icona", "Icon"))}</span>
    <div class="dm-varco-ed-icone">${DISEGNI_DEL_VARCO.map(
      (chiave) =>
        `<button type="button" class="dm-varco-ed-ico${chiave === scelto ? " dm-on" : ""}"
          data-dm-varco-icona="${esc(chiave)}" data-dm-varco-riga="${indice}"
          aria-pressed="${chiave === scelto}" aria-label="${esc(chiave)}">${disegnoDiCasa(chiave, { misura: 34 })}</button>`,
    ).join("")}</div>
    <small>${esc(
      t(
        "Il disegno che esce nella pagina e nella tessera. Sono quelli del catalogo di gdahome: uguali su ogni telefono.",
        "The drawing that shows on the page and on the tile. They are gdahome's own: the same on every phone.",
      ),
    )}</small></label>`;
}

function corpoMarkup(riga, indice) {
  const id = `dm-varco-${indice}`;
  return `<div class="dm-varco-ed-corpo">
    <label class="ed-slot dm-varco-ed-campo"><span class="ed-slot-lbl">${esc(t("Entità del contatto", "Contact entity"))}</span>
      <span class="ed-form-row"><input id="${id}-entity" class="ed-input mono" data-dm-varco-campo="entity"
        data-dm-varco-riga="${indice}" value="${esc(riga.entity)}" placeholder="binary_sensor.finestra_cucina"
        autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker"
        data-dm-varco-pick="${id}-entity" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>
      <small>${esc(
        t(
          "Il sensore che dice aperto o chiuso: binary_sensor.*, oppure un cover.* se l'infisso è motorizzato.",
          "The sensor that says open or closed: binary_sensor.*, or a cover.* if it is motorised.",
        ),
      )}</small></label>
    <label class="ed-slot dm-varco-ed-campo"><span class="ed-slot-lbl">${esc(t("Nome", "Name"))}</span>
      <span class="ed-form-row"><input id="${id}-name" class="ed-input" data-dm-varco-campo="name"
        data-dm-varco-riga="${indice}" value="${esc(riga.name)}" placeholder="${esc(t("Finestra cucina", "Kitchen window"))}"></span>
      <small>${esc(
        t(
          "Come si chiama per te. È questo che si legge nella pagina, non «Contact 4B».",
          "What you call it. This is what the page reads, not “Contact 4B”.",
        ),
      )}</small></label>
    ${strisciaMarkup(indice, riga.icon || "door")}
    <button type="button" class="ed-save-btn" data-dm-varco-salva="${indice}">💾 ${esc(t("Salva varco", "Save opening"))}</button>
  </div>`;
}

function rigaMarkup(riga, indice, letta) {
  const aperta = state.aperto === indice;
  const stato = letta?.stato || "";
  const sotto = riga.entity
    ? `${riga.entity}${stato ? ` · ${stato === "aperto" ? t("aperto", "open") : t("chiuso", "closed")}` : ""}`
    : t("nessuna entità", "no entity");
  return `<article class="ed-row dm-varco-ed-riga" data-varco="${esc(riga.entity ? stato || "muto" : "muto")}"
    data-dm-varco-indice="${indice}" data-open="${aperta}">
    <div class="dm-varco-ed-testa">
      <span class="dm-varco-ed-ic" aria-hidden="true">${disegnoDiCasa(riga.icon, { misura: 34, ripiego: "door" })}</span>
      <span class="ed-row-main dm-varco-ed-testo">
        <strong class="ed-row-new">${esc(riga.name || t("Varco senza nome", "Unnamed opening"))}</strong>
        <small class="ed-row-old mono">${esc(sotto)}</small>
        ${
          riga.entity
            ? ""
            : `<small class="dm-varco-ed-muta">${esc(
                t(
                  "Finché non scegli l'entità questo varco non si vede: né nella pagina, né nel conto di quanti sono aperti adesso.",
                  "Until you pick the entity this opening is nowhere: not on the page, not in the count of how many are open right now.",
                ),
              )}</small>`
        }
      </span>
      <button type="button" class="ed-del dm-varco-ed-edit" data-dm-varco-apri="${indice}"
        aria-label="${esc(t("Modifica", "Edit"))}">✏️</button>
      <button type="button" class="ed-del" data-dm-varco-elimina="${indice}"
        aria-label="${esc(t("Elimina", "Remove"))}">🗑️</button>
    </div>
    ${aperta ? corpoMarkup(riga, indice) : ""}
  </article>`;
}

function schedaMarkup() {
  const elenco = righe() || [];
  const states = allStates();
  const lette = new Map(
    varchiDiCasa(
      states,
      { righe: elenco },
      insiemeInvertiti(readJson(CHIAVE_VERSI, {})),
      (entity) => nomeDaHomeAssistant(entity, states),
    ).map((riga) => [riga.entity, riga]),
  );
  const mancano = daPrendere();
  return `<div class="ed-intro">${esc(
    t(
      "I varchi di casa: porte, finestre, portone, basculante. Ogni varco ha la sua riga — l'entità del contatto, il nome che vuoi tu, il disegno — e la pagina Varchi mostra queste, in quest'ordine: verde chiuso, rosso aperto, e in cima quanti sono aperti adesso.",
      "The openings at home: doors, windows, front door, garage door. Each opening has its own row — the contact entity, the name you want, the drawing — and the Openings page shows these, in this order: green closed, red open, and how many are open right now on top.",
    ),
  )}</div>
  ${
    elenco.length
      ? `<div class="ed-list dm-varco-ed-lista">${elenco
          .map((riga, indice) => rigaMarkup(riga, indice, lette.get(riga.entity)))
          .join("")}</div>`
      : `<div class="ed-empty">${esc(t("Nessun varco configurato", "No opening configured"))}</div>`
  }
  <button type="button" class="ed-btn-add" data-dm-varco-aggiungi>＋ ${esc(t("Aggiungi varco", "Add opening"))}</button>
  ${
    mancano.length
      ? `<button type="button" class="ed-btn-import" data-dm-varco-prendi>⤓ ${esc(
          t(
            `Prendi i ${mancano.length} contatti che Home Assistant ha trovato`,
            `Take the ${mancano.length} contacts Home Assistant found`,
          ),
        )}</button>
        <small class="dm-varco-ed-nota">${esc(
          t(
            "Li mette qui come righe, una volta sola: da lì in poi sono tue — le rinomini, gli dai il disegno, e quelle che elimini non tornano più.",
            "It puts them here as rows, once: from then on they are yours — rename them, give them a drawing, and the ones you remove do not come back.",
          ),
        )}</small>`
      : ""
  }`;
}

/* La prima apertura scrive quello che la pagina gia' mostrava: nessuna casa si
 * ritrova la scheda vuota per un aggiornamento. */
function migraSeServe() {
  if (righeDichiarate(configurazione()) !== null) return false;
  salva({ ...configurazione(), righe: daPrendere() });
  return true;
}

export function ensureVarchiEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== VARCHI_EDITOR_TAB) return false;
  migraSeServe();
  if (body.dataset.dmVarchiEditor === "true") return false;
  body.dataset.dmVarchiEditor = "true";
  body.innerHTML = `<div class="dm-varchi-ed">${schedaMarkup()}</div>`;
  return true;
}

export function ensureVarchiEditorTab() {
  const tabs = doc?.querySelector(".ed-tab")?.parentElement;
  if (!tabs || tabs.querySelector(`.ed-tab[data-tab="${VARCHI_EDITOR_TAB}"]`)) return false;
  const tab = doc.createElement("button");
  tab.className = "ed-tab";
  tab.dataset.tab = VARCHI_EDITOR_TAB;
  tab.textContent = `🚪 ${t("Varchi", "Openings")}`;
  tab.addEventListener("click", () => root.editorSwitch?.(VARCHI_EDITOR_TAB));
  const prima = tabs.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(tab);
  else tabs.append(tab);
  return true;
}

/* ── i gesti ──────────────────────────────────────────────────────────────── */

/* Quello che la riga aperta ha nelle sue caselle adesso, non quello che c'era
 * scritto quando e' stata disegnata: il nome si batte, l'entita' si sceglie
 * dalla lente, e il salvataggio deve prendere l'ultimo stato di tutte e due. */
function bozza(body, indice, elenco) {
  const riga = elenco[indice] || { entity: "", name: "", icon: "" };
  const campo = (quale) =>
    body.querySelector(`[data-dm-varco-campo="${quale}"][data-dm-varco-riga="${indice}"]`);
  return {
    entity: clean(campo("entity")?.value ?? riga.entity),
    name: clean(campo("name")?.value ?? riga.name),
    icon: riga.icon || "door",
  };
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== VARCHI_EDITOR_TAB || !body.contains(event.target)) return;
  const elenco = righe() || [];

  const lente = event.target.closest("[data-dm-varco-pick]");
  if (lente) {
    event.preventDefault();
    const campo = body.querySelector(`#${CSS.escape(clean(lente.dataset.dmVarcoPick))}`);
    if (campo) root.wzPickEntity?.(campo);
    return;
  }

  const icona = event.target.closest("[data-dm-varco-icona]");
  if (icona) {
    event.preventDefault();
    const indice = Number(icona.dataset.dmVarcoRiga);
    if (!Number.isInteger(indice)) return;
    /* Il disegno si salva subito, insieme a quello che c'e' nelle caselle: se
     * si salvasse da solo, chi ha appena scritto il nome e poi tocca l'icona
     * si vedrebbe tornare il nome di prima al ridisegno. */
    salva(conLaRiga(configurazione(), indice, { ...bozza(body, indice, elenco), icon: clean(icona.dataset.dmVarcoIcona) }));
    ridisegna();
    return;
  }

  const apri = event.target.closest("[data-dm-varco-apri]");
  if (apri) {
    event.preventDefault();
    const indice = Number(apri.dataset.dmVarcoApri);
    /* Chiudendo una riga aperta si tiene quello che c'e' scritto dentro: chi
     * ha battuto il nome e poi tocca la matita per richiudere non ha detto
     * «butta via», ha detto «ho finito». */
    if (state.aperto === indice) {
      salva(conLaRiga(configurazione(), indice, bozza(body, indice, elenco)));
      state.aperto = -1;
    } else state.aperto = indice;
    ridisegna();
    return;
  }

  const elimina = event.target.closest("[data-dm-varco-elimina]");
  if (elimina) {
    event.preventDefault();
    const indice = Number(elimina.dataset.dmVarcoElimina);
    if (!Number.isInteger(indice)) return;
    salva(senzaLaRiga(configurazione(), indice));
    if (state.aperto === indice) state.aperto = -1;
    else if (state.aperto > indice) state.aperto -= 1;
    ridisegna();
    return;
  }

  const salvaRiga = event.target.closest("[data-dm-varco-salva]");
  if (salvaRiga) {
    event.preventDefault();
    const indice = Number(salvaRiga.dataset.dmVarcoSalva);
    if (!Number.isInteger(indice)) return;
    salva(conLaRiga(configurazione(), indice, bozza(body, indice, elenco)));
    state.aperto = -1;
    ridisegna();
    root.edToast?.(t("🚪 Varco salvato", "🚪 Opening saved"));
    return;
  }

  if (event.target.closest("[data-dm-varco-aggiungi]")) {
    event.preventDefault();
    salva(conLaRiga(configurazione(), -1, { entity: "", name: t("Varco nuovo", "New opening"), icon: "door" }));
    state.aperto = (righe() || []).length - 1;
    ridisegna();
    return;
  }

  if (event.target.closest("[data-dm-varco-prendi]")) {
    event.preventDefault();
    const mancano = daPrendere();
    if (!mancano.length) return;
    salva({ ...configurazione(), righe: [...elenco, ...mancano] });
    ridisegna();
    root.edToast?.(
      t(`🚪 ${mancano.length} varchi aggiunti`, `🚪 ${mancano.length} openings added`),
    );
  }
}

function installStyles() {
  installStyle(
    "dm-varchi-editor-style",
    `
    #ed-body .dm-varchi-ed{display:grid!important;gap:12px!important}
    #ed-body .dm-varco-ed-lista{display:grid!important;gap:8px!important}
    #ed-body .dm-varco-ed-riga{
      display:block!important;padding:0!important;overflow:hidden!important;
      border-left:4px solid var(--dm-varco,#94a3b8)!important}
    #ed-body .dm-varco-ed-riga[data-varco="aperto"]{--dm-varco:#dc2626}
    #ed-body .dm-varco-ed-riga[data-varco="chiuso"]{--dm-varco:#16a34a}
    #ed-body .dm-varco-ed-riga[data-varco="muto"]{--dm-varco:#94a3b8}
    #ed-body .dm-varco-ed-riga[data-open="true"]{border-color:#7dd3fc!important}
    #ed-body .dm-varco-ed-testa{display:flex!important;align-items:center!important;gap:10px!important;padding:10px 12px!important}
    /* La riga che non si vede da nessuna parte lo dice con tre righe di testo:
       l'icona va in cima, non a meta' del discorso. */
    #ed-body .dm-varco-ed-testa:has(.dm-varco-ed-muta){align-items:flex-start!important}
    #ed-body .dm-varco-ed-ic{
      display:grid!important;place-items:center!important;flex:0 0 34px!important;
      width:34px!important;height:34px!important;line-height:0!important}
    #ed-body .dm-varco-ed-ic svg{display:block!important;width:34px!important;height:34px!important}
    #ed-body .dm-varco-ed-testo{display:grid!important;gap:3px!important;min-width:0!important}
    #ed-body .dm-varco-ed-testo .ed-row-new{line-height:1.25!important}
    #ed-body .dm-varco-ed-testo .ed-row-old{opacity:.72!important;font-size:11.5px!important;line-height:1.3!important}
    #ed-body .dm-varco-ed-muta{
      display:block!important;margin-top:3px!important;font-size:11px!important;line-height:1.35!important;
      font-weight:700!important;white-space:normal!important;color:var(--warning-color,#b45309)!important}
    #ed-body .dm-varco-ed-corpo{
      display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:8px!important;
      padding:2px 12px 12px!important;border-top:1px solid var(--card-border,#dbe4ee)!important}
    #ed-body .dm-varco-ed-campo{display:grid!important;gap:4px!important;margin:0!important}
    #ed-body .dm-varco-ed-campo .ed-form-row{display:flex!important;gap:8px!important;min-width:0!important}
    #ed-body .dm-varco-ed-campo .ed-form-row>input{flex:1 1 auto!important;min-width:0!important}
    /* La striscia dei disegni scorre: tredici non ci stanno su un telefono, e
       mandarli a capo farebbe una parete di icone alta quanto la scheda. */
    #ed-body .dm-varco-ed-icone{display:flex!important;gap:7px!important;overflow-x:auto!important;padding:3px 1px 5px!important}
    #ed-body .dm-varco-ed-ico{
      flex:0 0 auto!important;padding:4px!important;line-height:0!important;cursor:pointer!important;
      border:1px solid var(--card-border,#dbe4ee)!important;border-radius:12px!important;
      background:var(--card-bg,#fff)!important}
    #ed-body .dm-varco-ed-ico svg{display:block!important;width:34px!important;height:34px!important}
    #ed-body .dm-varco-ed-ico.dm-on{
      border-color:var(--primary-color,#0ea5e9)!important;
      box-shadow:0 0 0 2px color-mix(in srgb,var(--primary-color,#0ea5e9) 25%,transparent)!important}
    #ed-body .ed-btn-import{
      display:block!important;width:100%!important;margin-top:8px!important;padding:11px!important;
      border:1px dashed var(--card-border,#dbe4ee)!important;border-radius:12px!important;
      background:transparent!important;color:var(--text-dim,#64748b)!important;font-weight:800!important;
      font-size:11.5px!important;letter-spacing:.4px!important;text-transform:uppercase!important;
      cursor:pointer!important;font-family:inherit!important}
    #ed-body .dm-varco-ed-nota{
      display:block!important;margin-top:7px!important;font-size:11px!important;line-height:1.5!important;
      color:var(--text-dim,#64748b)!important}
    `,
  );
}

export function installVarchiEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  ensureVarchiEditorTab();
  onEditorRedraw("__dmVarchiEditor", () => {
    root.queueMicrotask?.(() => {
      ensureVarchiEditorTab();
      ensureVarchiEditor();
    });
  });
  doc.addEventListener("click", onClick);
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensureVarchiEditorTab();
        ensureVarchiEditor();
      });
    });
  return true;
}

installVarchiEditor();
