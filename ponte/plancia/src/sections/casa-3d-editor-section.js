/* La scheda «Casa 3D» nel Config.
 *
 * Solo nelle plance Casa 3D (mai nella principale). Chi amministra la crea
 * dalle foto (planimetria e stanze) e vede, dispositivo per dispositivo, a quale
 * entita' di Home Assistant risponde: quelli senza entita' si collegano qui,
 * scegliendo dall'elenco gia' filtrato o scrivendola a mano.
 *
 * Come «Colpo d'occhio», e' Premium: con Base la scheda si vede chiusa, e il
 * config resta scritto per il giorno dopo.
 */
import {
  CHIAVE_CASA3D,
  DISPOSITIVI_3D,
  casa3dPulita,
  contaCollegati,
  entita,
  entitaCandidate,
} from "../core/casa-3d.js";
import { premiumDellaCasa } from "./plancia-a-muro-section.js";
import { puoConfigurare } from "./la-config-e-di-chi-la-amministra-section.js";
import { currentProfile } from "./config-persistence-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  senzaCadere,
  stanzaDiHomeAssistant,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_CASA3D_EDITOR__";
const state = (root[KEY] ||= { installed: false, premium: null, chiedendo: false });

export const CASA3D_TAB = "casa3d";

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function casa() {
  return casa3dPulita(readJson(CHIAVE_CASA3D, null));
}

function salva(nuova) {
  writeJsonIfChanged(CHIAVE_CASA3D, casa3dPulita(nuova));
  root.__DM_CASA3D_RIDISEGNA__?.();
}

function chiediLaLicenza() {
  if (state.chiedendo) return;
  state.chiedendo = true;
  premiumDellaCasa()
    .then((premium) => {
      state.premium = premium === true;
      ridisegna();
    })
    .catch(() => {})
    .finally(() => {
      state.chiedendo = false;
    });
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function dispositivoMarkup(c, p, i, d, states) {
  const D = DISPOSITIVI_3D[d.k];
  const stanza = p.stanze.find((s) => s.id === d.stanza);
  const usate = [];
  for (const q of c.piani) for (const e of q.dispositivi) if (e !== d && e.entity) usate.push(e.entity);
  const candidate = entitaCandidate(d.k, { stanza: stanza?.nome || "", area: stanza?.area || "", states, usate }).slice(0, 40);
  const ha = d.entity && !candidate.some((x) => x.entity === d.entity);
  const voci = [
    `<option value="">${esc(t("— nessuna per ora —", "— none yet —"))}</option>`,
    ...(ha ? [`<option value="${esc(d.entity)}" selected>${esc(d.entity)}</option>`] : []),
    ...candidate.map((x) => `<option value="${esc(x.entity)}"${x.entity === d.entity ? " selected" : ""}>${esc(x.nome)} · ${esc(x.entity)}</option>`),
  ].join("");
  return `<div class="dm-c3-ed-disp${d.entity ? "" : " manca"}">
    <span class="dm-c3-ed-ic">${D.icona}</span>
    <div class="dm-c3-ed-dc"><strong>${esc(d.nome || t(...D.nome))}</strong><small>${esc(p.nome)} · ${esc(stanza?.nome || t("stanza ?", "room ?"))}${d.da === "foto" ? ` · ${esc(t("dalla foto", "from photo"))}` : ""}</small></div>
    <select class="ed-input" data-dm-c3-entita="${esc(p.k)}:${i}">${voci}</select>
    <input class="ed-input mono" data-dm-c3-mano="${esc(p.k)}:${i}" placeholder="${esc(t("o scrivila a mano", "or type it"))}" value="${ha ? esc(d.entity) : ""}" spellcheck="false" autocomplete="off">
  </div>`;
}

function corpoMarkup() {
  const c = casa(), states = allStates() || {}, conti = contaCollegati(c);
  if (state.premium === false)
    return `<div class="dm-c3-ed dm-c3-ed-chiuso"><span>🔒</span><b>${esc(t("Casa 3D", "3D Home"))}</b><p>${esc(
      t("La casa in tre dimensioni è una funzione Premium. La configurazione resta salvata.", "The 3D home is a Premium feature. Its configuration stays saved."),
    )}</p></div>`;
  const piani = c.piani.length
    ? c.piani
        .map((p) => `<span class="dm-c3-ed-piano">${esc(p.nome)} · ${p.stanze.length} ${esc(t("stanze", "rooms"))} · ${p.dispositivi.length} ${esc(t("dispositivi", "devices"))}</span>`)
        .join("")
    : `<p class="dm-c3-ed-nota">${esc(t("Ancora nessuna casa: creala dalla planimetria e dalle foto delle stanze.", "No home yet: create it from the floor plan and room photos."))}</p>`;
  const elenco = c.piani.flatMap((p) => p.dispositivi.map((d, i) => dispositivoMarkup(c, p, i, d, states))).join("");
  return `<div class="dm-c3-ed">
    <article class="ed-row dm-c3-ed-gruppo">
      <div class="dm-c3-ed-testa"><span>🏠</span><strong>${esc(t("Casa 3D", "3D Home"))}</strong><span class="dm-c3-ed-premium">PREMIUM</span></div>
      <div class="dm-c3-ed-piani">${piani}</div>
      <div class="dm-c3-ed-tasti"><button type="button" class="ed-btn-add" data-dm-c3-crea>🏗️ ${esc(
        c.piani.length ? t("Aggiungi o rifai un piano", "Add or redo a floor") : t("Crea la tua casa", "Create your home"),
      )}</button></div>
      <p class="dm-c3-ed-nota">${esc(
        t("Le foto restano sul dispositivo da cui le carichi: si salvano solo muri, stanze, arredi, colori e dispositivi.", "Photos stay on the device you upload them from: only walls, rooms, furniture, colours and devices are saved."),
      )}</p>
    </article>
    ${elenco ? `<article class="ed-row dm-c3-ed-gruppo"><div class="dm-c3-ed-testa"><span>🔗</span><strong>${esc(t("Dispositivi e entità", "Devices and entities"))}</strong><span class="dm-c3-ed-conto${conti.mancano ? " manca" : ""}">${conti.collegati}/${conti.tutti}</span></div>
      <p class="dm-c3-ed-nota">${esc(t("Ogni luce, telecamera, finestra o sensore della casa risponde a un'entità: sceglila dall'elenco (già filtrato per tipo e stanza) o scrivila a mano.", "Each light, camera, window or sensor answers to an entity: pick it from the list (already filtered by type and room) or type it."))}</p>
      <div class="dm-c3-ed-elenco">${elenco}</div></article>` : ""}
  </div>`;
}

/* La scheda c'e' solo nelle plance Casa 3D — come il «Colpo d'occhio» — e
 * mai sulla principale: la Casa 3D e' una plancia a se', svincolata da lei.
 * Una plancia Casa 3D nasce dalla console gia' accesa (plancia-nuova.js). */
function serve() {
  try {
    return puoConfigurare() && casa().attiva === true && currentProfile() !== "primary";
  } catch (_errore) {
    return false;
  }
}

export function ensureCasa3DEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== CASA3D_TAB) return false;
  if (state.premium === null) chiediLaLicenza();
  const firma = `${state.premium}:${JSON.stringify(casa())}:${Object.keys(allStates() || {}).length}`;
  if (body.dataset.dmCasa3dEditor === firma && body.querySelector(".dm-c3-ed")) return true;
  if (body.querySelector(".dm-c3-ed") && body.contains(doc.activeElement) && doc.activeElement?.dataset?.dmC3Mano !== undefined) return true;
  body.dataset.dmCasa3dEditor = firma;
  body.innerHTML = corpoMarkup();
  body.dataset.renderer = "casa3d";
  return true;
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmCasa3dEditor;
  ensureCasa3DEditor();
}

/* «Il config deve aprire quello 3D, non quello della plancia classica»: sulla
 * plancia Casa 3D il Config e' solo la sua scheda — da ⚙, dal menu dell'app,
 * da dovunque lo si apra. Le altre schede, l'albero e la ricerca non si
 * vedono, come nel Config «solo muro» del pannello a muro. */
const SOLO_CASA3D = "dm-solo-casa3d";

export function ensureCasa3DEditorTab() {
  const solo = serve();
  doc?.documentElement?.classList?.toggle?.(SOLO_CASA3D, solo);
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette) return false;
  const presente = linguette.querySelector(`.ed-tab[data-tab="${CASA3D_TAB}"]`);
  if (!solo) {
    presente?.remove();
    return false;
  }
  if (!presente) {
    const linguetta = doc.createElement("button");
    linguetta.className = "ed-tab";
    linguetta.dataset.tab = CASA3D_TAB;
    linguetta.textContent = `🏠 ${t("Casa 3D", "3D Home")}`;
    linguetta.addEventListener("click", () => root.editorSwitch?.(CASA3D_TAB));
    linguette.appendChild(linguetta);
  }
  if (schedaAttiva() !== CASA3D_TAB) root.editorSwitch?.(CASA3D_TAB);
  return !presente;
}

/* ── i gesti ──────────────────────────────────────────────────────────── */

function nelCorpo(event) {
  return Boolean(event.target?.closest?.("#ed-body .dm-c3-ed"));
}

function dispositivo(c, chi) {
  const [k, i] = clean(chi).split(":");
  const p = c.piani.find((x) => x.k === k);
  return p?.dispositivi?.[Number(i)] || null;
}

function onClick(event) {
  if (!nelCorpo(event)) return;
  if (event.target.closest("[data-dm-c3-crea]")) {
    event.preventDefault();
    root.__DM_CASA3D_CREA__?.();
    return;
  }
}

function onChange(event) {
  if (!nelCorpo(event)) return;
  const c = casa();
  const t0 = event.target;
  const chi = t0.dataset.dmC3Entita ?? t0.dataset.dmC3Mano;
  if (chi === undefined) return;
  const d = dispositivo(c, chi);
  if (!d) return;
  const valore = clean(t0.value);
  if (t0.dataset.dmC3Mano !== undefined && valore && !entita(valore)) {
    t0.setCustomValidity?.(t("Non è un'entità (dominio.nome)", "Not an entity (domain.name)"));
    t0.reportValidity?.();
    return;
  }
  t0.setCustomValidity?.("");
  d.entity = entita(valore);
  salva(c);
  ridisegna();
}

function installaLoStile() {
  installStyle(
    "dm-casa3d-editor-style",
    `
      #ed-body .dm-c3-ed{display:grid;gap:14px}
      #ed-body .dm-c3-ed-gruppo{display:grid;gap:10px}
      #ed-body .dm-c3-ed-testa{display:flex;align-items:center;gap:10px;font-size:15px}
      #ed-body .dm-c3-ed-testa>span:first-child{font-size:22px}
      #ed-body .dm-c3-ed-premium{margin-left:6px;font-size:9.5px;font-weight:900;letter-spacing:.08em;padding:2px 7px;border-radius:6px;color:#b45309;border:1px solid #f59e0b88;background:#f59e0b18}
      #ed-body .dm-c3-ed-conto{margin-left:auto;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:900;color:#047857;background:color-mix(in srgb,#10b981 14%,transparent)}
      #ed-body .dm-c3-ed-conto.manca{color:#b45309;background:color-mix(in srgb,#f59e0b 16%,transparent)}
      #ed-body .dm-c3-ed-piani{display:flex;flex-wrap:wrap;gap:6px}
      #ed-body .dm-c3-ed-piano{padding:6px 10px;border-radius:999px;border:1px solid var(--card-border,#e2e8f0);font-size:12px;font-weight:700}
      #ed-body .dm-c3-ed-tasti{display:flex;flex-wrap:wrap;gap:8px}
      #ed-body .dm-c3-ed-tasti .ed-btn-add{flex:1 1 180px}
      #ed-body .dm-c3-ed-nota{margin:2px;font-size:11.5px;font-weight:700;line-height:1.45;color:var(--text-dim,#64748b)}
      #ed-body .dm-c3-ed-elenco{display:grid;gap:8px}
      #ed-body .dm-c3-ed-disp{display:grid;grid-template-columns:auto minmax(120px,1fr) minmax(180px,1.4fr) minmax(140px,1fr);align-items:center;gap:10px;padding:10px;border-radius:14px;border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff)}
      #ed-body .dm-c3-ed-disp.manca{border-color:#f59e0b88}
      #ed-body .dm-c3-ed-ic{font-size:22px}
      #ed-body .dm-c3-ed-dc{display:grid;min-width:0}
      #ed-body .dm-c3-ed-dc strong{font-size:13px}
      #ed-body .dm-c3-ed-dc small{font-size:11px;color:var(--text-dim,#64748b)}
      #ed-body .dm-c3-ed-chiuso{display:grid;justify-items:center;gap:10px;padding:40px 20px;text-align:center}
      #ed-body .dm-c3-ed-chiuso>span{font-size:44px}
      html.dm-solo-casa3d #editor-modal .ed-tabs,html.dm-solo-casa3d #editor-modal #dm-alberatura-famiglie,html.dm-solo-casa3d #editor-modal .dm-cerca-config,html.dm-solo-casa3d #editor-modal .dm-alberatura-titolo-famiglia{display:none!important}
      html.dm-solo-casa3d #editor-modal .ed-body,html.dm-solo-casa3d #editor-modal #ed-body{margin-left:0!important;max-width:none!important}
      @media(max-width:760px){#ed-body .dm-c3-ed-disp{grid-template-columns:auto minmax(0,1fr)}#ed-body .dm-c3-ed-disp select,#ed-body .dm-c3-ed-disp input{grid-column:1/-1}}
    `,
  );
}

export function installCasa3DEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installaLoStile();
  doc.addEventListener("click", onClick);
  doc.addEventListener("change", onChange);
  wrapFunction("apriConfigEntita", "__dmCasa3dEditor", () => {
    ensureCasa3DEditorTab();
    ensureCasa3DEditor();
  });
  onEditorRedraw("__dmCasa3dEditor", () => {
    root.queueMicrotask?.(() => {
      ensureCasa3DEditorTab();
      ensureCasa3DEditor();
    });
  });
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensureCasa3DEditorTab();
        ensureCasa3DEditor();
      });
    });
  ensureCasa3DEditorTab();
  ensureCasa3DEditor();
  return true;
}

senzaCadere(installCasa3DEditor);
