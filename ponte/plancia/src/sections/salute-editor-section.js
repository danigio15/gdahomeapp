/* La scheda Salute del Config (#227).
 *
 * La pagina Salute si accende da sola coi sensori del corpo e con Strava:
 * qui si dice il resto. L'interruttore per nasconderla; l'obiettivo dei
 * passi, che l'anello della pagina conta; i nomi delle persone — i sensori
 * dicono «Pixel 8», la casa dice Marco —; e, misura per misura, quale
 * sensore usare: quello trovato da solo, un altro, o nessuno. Tutto in
 * `cd_salute`, che viaggia con la casa.
 */
import { vistaDiStrava } from "../core/strava.js";
import {
  CHIAVE_SALUTE,
  MISURE_SALUTE,
  candidatiSalute,
  configurazioneSalute,
  personeDellaSalute,
} from "../core/salute.js";
import { SALUTE_TAB } from "./salute-section.js";
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
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

export const SALUTE_EDITOR_TAB = SALUTE_TAB;

const KEY = "__DASHBOARDMODERN_SALUTE_EDITOR__";
const state = (root[KEY] ||= { installed: false });

const NOMI_MISURE = () => ({
  passi: t("Passi", "Steps"),
  battito: t("Battito", "Heart rate"),
  battitoRiposo: t("Battito a riposo", "Resting heart rate"),
  peso: t("Peso", "Weight"),
  grasso: t("Massa grassa", "Body fat"),
  sistolica: t("Pressione massima", "Systolic pressure"),
  diastolica: t("Pressione minima", "Diastolic pressure"),
  ossigeno: t("Ossigeno", "Blood oxygen"),
  sonno: t("Sonno", "Sleep"),
  calorie: t("Calorie", "Calories"),
});

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function configurazione() {
  return configurazioneSalute(readJson(CHIAVE_SALUTE, {}));
}

function salva(config) {
  writeJsonIfChanged(CHIAVE_SALUTE, configurazioneSalute(config));
  root.dispatchEvent?.(new CustomEvent("dashboardmodern:state-changed", { detail: { salute: true } }));
}

function gruppoMarkup(chiave, segno, titolo, corpo) {
  return `<article class="ed-row dm-todo-ed-row dm-allerte-ed-fonte dm-salute-ed-gruppo" data-open="true" data-dm-salute-gruppo="${chiave}">
      <div class="dm-allerte-ed-testa"><span class="dm-salute-ed-ic" aria-hidden="true">${segno}</span><strong>${esc(titolo)}</strong></div>
      <div class="dm-todo-ed-body">${corpo}</div>
    </article>`;
}

function fasciaMarkup() {
  try {
    return root.cdSecToggleHtml?.("salute") || "";
  } catch (_errore) {
    return "";
  }
}

function obiettivoMarkup(config) {
  return `<label class="dm-salute-ed-campo">
      <span class="ed-label">${esc(t("Passi al giorno", "Steps per day"))}</span>
      <input class="ed-input" type="number" inputmode="numeric" min="1000" max="100000" step="500"
        value="${config.obiettivoPassi}" data-dm-salute-obiettivo>
    </label>
    <p class="dm-salute-ed-nota">${esc(
      t("L'anello della pagina si chiude a questo numero.", "The page's ring closes at this number."),
    )}</p>`;
}

function personeMarkup(states, config) {
  const persone = personeDellaSalute(states, { ...config, nomi: {} });
  if (!persone.length)
    return `<p class="dm-salute-ed-nota">${esc(
      t(
        "Nessuna misura del corpo per ora. La strada più semplice: nell'app GdAHome sul telefono, menu › Salute, si accende e porta qui le misure dell'orologio (Apple Watch, Galaxy Watch, Fitbit, Amazfit…). Arrivano anche da Withings, Garmin o dall'app Home Assistant.",
        "No body readings yet. The easiest way: in the GdAHome app on the phone, menu › Health, turn it on and it brings your watch readings here (Apple Watch, Galaxy Watch, Fitbit, Amazfit…). They also come from Withings, Garmin or the Home Assistant app.",
      ),
    )}</p>`;
  return `<div class="dm-salute-ed-voci">${persone
    .map(
      (p) => `<label class="dm-salute-ed-campo">
        <span class="ed-label">${esc(t(`Come chiamare «${p.chi}»`, `What to call “${p.chi}”`))}</span>
        <input class="ed-input" type="text" maxlength="40" value="${esc(config.nomi[p.chi] || "")}"
          placeholder="${esc(p.chi)}" data-dm-salute-nome="${esc(p.chi)}">
      </label>`,
    )
    .join("")}</div>`;
}

function misureMarkup(states, config) {
  const candidati = candidatiSalute(states);
  const nomi = NOMI_MISURE();
  return `<div class="dm-salute-ed-voci">${MISURE_SALUTE.map((chiave) => {
    const scelta = config.scelte[chiave] || "";
    const elenco = candidati[chiave];
    const trovati = elenco.length
      ? t(`Trovati da soli: ${elenco.map((c) => c.nome).join(", ")}`, `Found on their own: ${elenco.map((c) => c.nome).join(", ")}`)
      : t("Nessun sensore trovato da solo", "No sensor found on its own");
    /* Un sensore scelto che non e' fra i candidati (ha un nome che non
     * dice la misura) resta fra le scelte. */
    const extra = scelta && scelta !== "-" && !elenco.some((c) => c.entity === scelta) ? [{ entity: scelta, nome: scelta }] : [];
    const altri = Object.keys(states || {})
      /* Gli altri sensori con un numero: una bilancia che si chiama «Bagno»
       * non la trova nessuno, ma la si sceglie qui. */
      .filter(
        (id) =>
          /^sensor\./.test(id) &&
          Number.isFinite(Number(states[id]?.state)) &&
          !elenco.some((c) => c.entity === id) &&
          id !== scelta,
      )
      .sort();
    return `<label class="dm-salute-ed-campo">
      <span class="ed-label">${esc(nomi[chiave])}</span>
      <select class="ed-input" data-dm-salute-scelta="${chiave}">
        <option value=""${scelta ? "" : " selected"}>${esc(t("Automatico", "Automatic"))}</option>
        ${[...elenco, ...extra]
          .map((c) => `<option value="${esc(c.entity)}"${c.entity === scelta ? " selected" : ""}>${esc(c.nome)}</option>`)
          .join("")}
        ${altri.length ? `<optgroup label="${esc(t("Altri sensori", "Other sensors"))}">${altri.map((id) => `<option value="${esc(id)}">${esc(states[id]?.attributes?.friendly_name || id)}</option>`).join("")}</optgroup>` : ""}
        <option value="-"${scelta === "-" ? " selected" : ""}>${esc(t("Nessuno: non mostrare", "None: don't show"))}</option>
      </select>
      <small class="dm-salute-ed-nota">${esc(trovati)}</small>
    </label>`;
  }).join("")}</div>`;
}

function stravaMarkup(states) {
  const presente = Boolean(vistaDiStrava(states));
  return `<p class="dm-salute-ed-nota">${esc(
    presente
      ? t(
          "Strava c'è: nella pagina Salute ha la sua linguetta, con la settimana, le ultime dodici settimane, le statistiche e le ultime attività.",
          "Strava is here: it has its own tab on the Health page, with this week, the last twelve weeks, statistics and latest activities.",
        )
      : t(
          "Con l'integrazione Strava di HACS in Home Assistant, nella pagina Salute compare anche la linguetta Strava.",
          "With the Strava integration from HACS in Home Assistant, the Health page also gets a Strava tab.",
        ),
  )}</p>`;
}

function corpoMarkup() {
  const states = allStates() || {};
  const config = configurazione();
  return `${fasciaMarkup()}<div class="dm-salute-ed">
    <div class="ed-intro">${esc(
      t(
        "La pagina Salute: i passi, il battito, la pressione, il peso, il sonno di chi abita la casa, e Strava. Le misure le trova da sola fra i sensori di Home Assistant; qui scegli l'obiettivo, i nomi e, se serve, i sensori.",
        "The Health page: steps, heart rate, blood pressure, weight and sleep of the people at home, and Strava. It finds the readings among Home Assistant's sensors on its own; here you choose the goal, the names and, if needed, the sensors.",
      ),
    )}</div>
    <div class="ed-list dm-todo-ed-list">
      ${gruppoMarkup("obiettivo", "👟", t("Obiettivo dei passi", "Steps goal"), obiettivoMarkup(config))}
      ${gruppoMarkup("persone", "👤", t("Le persone", "People"), personeMarkup(states, config))}
      ${gruppoMarkup("misure", "🩺", t("Le misure", "Readings"), misureMarkup(states, config))}
      ${gruppoMarkup("strava", "🏃", "Strava", stravaMarkup(states))}
    </div></div>`;
}

function sezioneNascosta() {
  try {
    return root.cdCfg?.("cd_sections")?.[SALUTE_TAB] === false;
  } catch (_errore) {
    return false;
  }
}

export function ensureSaluteEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== SALUTE_EDITOR_TAB) return false;
  const firma = `${JSON.stringify(configurazione())}|${sezioneNascosta()}|${Object.keys(allStates() || {}).length}`;
  if (body.dataset.dmSaluteEditor === firma && body.querySelector(".dm-salute-ed")) return true;
  /* Mentre si scrive un nome non si ridisegna: il cursore resterebbe a meta'. */
  if (body.querySelector(".dm-salute-ed") && body.contains(doc.activeElement) && doc.activeElement.matches?.("input")) return true;
  body.dataset.dmSaluteEditor = firma;
  body.innerHTML = corpoMarkup();
  body.dataset.renderer = "salute";
  return true;
}

function nelCorpo(event) {
  const body = doc?.getElementById("ed-body");
  return body && schedaAttiva() === SALUTE_EDITOR_TAB && body.contains(event.target) ? body : null;
}

function onChange(event) {
  if (!nelCorpo(event)) return;
  const config = configurazione();
  const obiettivo = event.target.closest("[data-dm-salute-obiettivo]");
  if (obiettivo) {
    salva({ ...config, obiettivoPassi: Number(obiettivo.value) });
    root.edToast?.(t("✅ Obiettivo salvato", "✅ Goal saved"));
    return;
  }
  const nome = event.target.closest("[data-dm-salute-nome]");
  if (nome) {
    salva({ ...config, nomi: { ...config.nomi, [nome.dataset.dmSaluteNome]: clean(nome.value) } });
    root.edToast?.(t("✅ Nome salvato", "✅ Name saved"));
    return;
  }
  const scelta = event.target.closest("[data-dm-salute-scelta]");
  if (scelta) {
    const scelte = { ...config.scelte };
    if (scelta.value) scelte[scelta.dataset.dmSaluteScelta] = scelta.value;
    else delete scelte[scelta.dataset.dmSaluteScelta];
    salva({ ...config, scelte });
    root.edToast?.(t("✅ Misura salvata", "✅ Reading saved"));
  }
}

export function ensureSaluteEditorTab() {
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette || linguette.querySelector(`.ed-tab[data-tab="${SALUTE_EDITOR_TAB}"]`)) return false;
  const linguetta = doc.createElement("button");
  linguetta.className = "ed-tab";
  linguetta.dataset.tab = SALUTE_EDITOR_TAB;
  linguetta.textContent = `❤️ ${t("Salute", "Health")}`;
  linguetta.addEventListener("click", () => root.editorSwitch?.(SALUTE_EDITOR_TAB));
  const prima = linguette.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(linguetta);
  else linguette.append(linguetta);
  return true;
}

function installStyles() {
  installStyle(
    "dm-salute-editor-style",
    `
      #ed-body .dm-salute-ed-gruppo{display:block}
      #ed-body .dm-salute-ed-ic{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:0 0 auto;font-size:20px}
      #ed-body .dm-salute-ed-voci{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
      #ed-body .dm-salute-ed-campo{display:grid;gap:4px;margin:0;min-width:0}
      #ed-body .dm-salute-ed-campo select,#ed-body .dm-salute-ed-campo input{width:100%;max-width:100%}
      #ed-body .dm-salute-ed-nota{font-size:11.5px;font-weight:700;line-height:1.45;color:var(--text-dim,#64748b);margin:2px;overflow-wrap:break-word}
    `,
  );
}

export function installSaluteEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("change", onChange);
  wrapFunction("apriConfigEntita", "__dmSaluteEditor", () => {
    ensureSaluteEditorTab();
    ensureSaluteEditor();
  });
  ensureSaluteEditorTab();
  onEditorRedraw("__dmSaluteEditor", () => {
    root.queueMicrotask?.(() => {
      ensureSaluteEditorTab();
      ensureSaluteEditor();
    });
  });
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensureSaluteEditorTab();
        ensureSaluteEditor();
      });
    });
  ensureSaluteEditor();
  return true;
}

senzaCadere(installSaluteEditor);
