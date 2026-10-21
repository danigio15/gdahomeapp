/* La linguetta «Bollette» dentro Energia (#295).
 *
 * «E' possibile creare una nuova scheda che riporta i dati reali delle
 * bollette arrivate.» I dati li porta l'integrazione del fornitore — l'ultima
 * bolletta, quanto resta da pagare, il totale, la potenza impegnata, la
 * scadenza dell'offerta — e qui si mettono in una linguetta loro, in fondo
 * alla fila di Energia, come le Batterie. La linguetta c'e' solo quando c'e'
 * almeno un sensore di bolletta: chi non ne ha non vede niente di nuovo.
 *
 * Quali sensori sono quali lo dice `core/le-bollette.js`, che li trova da solo
 * dai nomi; nelle impostazioni dell'Energia c'e' la scheda per sceglierli a
 * mano, e la scelta vince.
 */
import {
  CHIAVE_BOLLETTE,
  VOCI_DELLA_BOLLETTA,
  laBolletta,
  mesiAllaScadenza,
  normalizzaBollette,
  sensoriDellaBolletta,
} from "../core/le-bollette.js";
import { createEntityPickerField } from "../core/renderers.js";
import {
  allStates,
  clean,
  doc,
  esc,
  formatNumber,
  installStyle,
  locale,
  nomeDellEntita,
  onEditorRedraw,
  planciaVisibile,
  quandoSiCambiaPagina,
  readJson,
  root,
  senzaCadere,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_BOLLETTE__";
const state = (root[KEY] ||= { installed: false, frame: 0, firma: "" });

export const BOLLETTE_VIEW_ID = "view-bollette";
const LINGUETTA = "bollette";

/* Le parole delle voci, scritte per esteso: i cataloghi le trovano solo cosi'. */
function nomeDellaVoce(chiave) {
  if (chiave === "daPagare") return t("Da pagare", "To pay");
  if (chiave === "stato") return t("Stato del pagamento", "Payment status");
  if (chiave === "ultima") return t("Ultima bolletta", "Latest bill");
  if (chiave === "totale") return t("Totale fatturato", "Total billed");
  if (chiave === "potenza") return t("Potenza impegnata", "Contracted power");
  if (chiave === "scadenza") return t("Scadenza dell'offerta", "Offer expiry");
  return t("Consumo del giorno", "Daily consumption");
}

const salvate = () => normalizzaBollette(readJson(CHIAVE_BOLLETTE, {}));

/* ── la linguetta e la sua vista ──────────────────────────────────────── */

const paginaEnergia = () => doc?.getElementById?.("page-energy") || null;
const filaDelleLinguette = () =>
  paginaEnergia()?.querySelector?.(".sub-tabs-container .sub-tabs-energy") || null;
const laLinguetta = () =>
  filaDelleLinguette()?.querySelector?.(`[data-dm-energia-vista="${LINGUETTA}"]`) || null;
const laVista = () => doc?.getElementById?.(BOLLETTE_VIEW_ID) || null;

function ensureVista() {
  let vista = laVista();
  if (vista) return vista;
  const sorelle = paginaEnergia()?.querySelectorAll?.(".flow-view");
  if (!sorelle?.length) return null;
  vista = doc.createElement("div");
  vista.id = BOLLETTE_VIEW_ID;
  vista.className = "flow-view";
  vista.innerHTML = `<div class="dm-bol" id="bollette-wrap"></div>`;
  sorelle[sorelle.length - 1].after(vista);
  return vista;
}

function apriLeBollette() {
  const linguetta = ensureLinguetta();
  const vista = ensureVista();
  if (!linguetta || !vista) return false;
  for (const nodo of paginaEnergia().querySelectorAll(".sub-tabs-container .sub-tab-btn"))
    nodo.classList.remove("active");
  for (const nodo of doc.querySelectorAll(".flow-view")) nodo.classList.remove("active");
  linguetta.classList.add("active");
  vista.classList.add("active");
  linguetta.scrollIntoView?.({ inline: "center", block: "nearest", behavior: "instant" });
  state.firma = "";
  dipingi();
  return true;
}

function ensureLinguetta() {
  const fila = filaDelleLinguette();
  if (!fila) return null;
  let linguetta = laLinguetta();
  if (linguetta) return linguetta;
  linguetta = doc.createElement("button");
  linguetta.type = "button";
  linguetta.className = "sub-tab-btn";
  linguetta.dataset.dmEnergiaVista = LINGUETTA;
  linguetta.innerHTML = `🧾 ${esc(t("Bollette", "Bills"))}`;
  linguetta.addEventListener("click", () => {
    if (root.navigator?.vibrate) root.navigator.vibrate(5);
    apriLeBollette();
    root.scrollTo?.({ top: 0, behavior: "instant" });
  });
  fila.append(linguetta);
  return linguetta;
}

function accendiLaLinguetta(bolletta) {
  const linguetta = ensureLinguetta();
  const vista = ensureVista();
  if (!linguetta || !vista) return;
  if (linguetta.parentElement?.lastElementChild !== linguetta)
    linguetta.parentElement.append(linguetta);
  const serve = Boolean(bolletta);
  linguetta.hidden = !serve;
  if (serve) linguetta.style.removeProperty("display");
  else linguetta.style.setProperty("display", "none", "important");
  if (!serve && vista.classList.contains("active")) {
    vista.classList.remove("active");
    linguetta.classList.remove("active");
    doc.getElementById("view-ist")?.classList.add("active");
    [...(filaDelleLinguette()?.querySelectorAll(".sub-tab-btn") || [])]
      .find((nodo) => /'ist'/.test(nodo.getAttribute("onclick") || ""))
      ?.classList.add("active");
  }
}

/* ── il disegno ───────────────────────────────────────────────────────── */

const euro = (n) => (n === null || n === undefined ? "—" : `${formatNumber(n, 2)} €`);

function dataScritta(quando) {
  return new Date(quando).toLocaleDateString(locale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fraQuanto(mesi) {
  if (mesi === null) return "";
  if (mesi < 0) return t("scaduta", "expired");
  if (mesi < 1) return t("meno di un mese", "less than a month");
  if (mesi < 24)
    return `${t("fra", "in")} ${mesi} ${mesi === 1 ? t("mese", "month") : t("mesi", "months")}`;
  return `${t("fra", "in")} ${Math.floor(mesi / 12)} ${t("anni", "years")}`;
}

function casella(chiave, valore, sotto = "", attenzione = false) {
  return `<div class="dm-bol-dato"${attenzione ? ' data-attenzione="true"' : ""}>
      <span>${esc(nomeDellaVoce(chiave))}</span>
      <b>${valore}</b>
      ${sotto ? `<small>${esc(sotto)}</small>` : ""}
    </div>`;
}

export function paginaDelleBollette(bolletta, adesso = Date.now()) {
  if (!bolletta) return "";
  const { voci, daPagare, pagata } = bolletta;
  const pastiglia =
    pagata === true
      ? `<span class="dm-bol-stato" data-pagata="true">✓ ${esc(t("Pagata", "Paid"))}</span>`
      : pagata === false
        ? `<span class="dm-bol-stato" data-pagata="false">${esc(t("Non pagata", "Unpaid"))}</span>`
        : "";
  const grande =
    daPagare !== null
      ? `<small>${esc(t("Da pagare", "To pay"))}</small><strong>${esc(euro(daPagare))}</strong>`
      : `<small>${esc(t("Ultima bolletta", "Latest bill"))}</small><strong>${esc(euro(voci.ultima?.valore))}</strong>`;
  const sottoGrande =
    daPagare !== null && voci.ultima
      ? `<span class="dm-bol-sotto">${esc(t("Ultima bolletta", "Latest bill"))}: ${esc(euro(voci.ultima.valore))}</span>`
      : "";
  const caselle = [];
  if (voci.totale) caselle.push(casella("totale", esc(euro(voci.totale.valore))));
  if (voci.potenza)
    caselle.push(
      casella(
        "potenza",
        `${esc(voci.potenza.valore === null ? "—" : formatNumber(voci.potenza.valore, Number.isInteger(voci.potenza.valore) ? 0 : 1))} <i>${esc(voci.potenza.unita || "kW")}</i>`,
      ),
    );
  if (voci.scadenza) {
    const mesi = mesiAllaScadenza(voci.scadenza.data, adesso);
    caselle.push(
      casella(
        "scadenza",
        esc(voci.scadenza.data === null ? "—" : dataScritta(voci.scadenza.data)),
        fraQuanto(mesi),
        mesi !== null && mesi < 2,
      ),
    );
  }
  if (voci.consumoGiorno)
    caselle.push(
      casella(
        "consumoGiorno",
        `${esc(voci.consumoGiorno.valore === null ? "—" : formatNumber(voci.consumoGiorno.valore, 2))} <i>${esc(voci.consumoGiorno.unita || "kWh")}</i>`,
      ),
    );
  return `<section class="dm-bol-testa" data-pagata="${pagata === null ? "" : String(pagata)}">
      <div class="dm-bol-riga">
        <div class="dm-bol-cifra">${grande}</div>
        ${pastiglia}
      </div>
      ${sottoGrande}
    </section>
    ${caselle.length ? `<div class="dm-bol-dati">${caselle.join("")}</div>` : ""}
    <p class="dm-bol-nota">${esc(
      t(
        "I dati arrivano dall'integrazione del fornitore. I sensori si scelgono in Config → Energia → Impostazioni.",
        "The data comes from the supplier's integration. Pick the sensors in Config → Energy → Settings.",
      ),
    )}</p>`;
}

function siVede() {
  return Boolean(
    planciaVisibile() &&
    paginaEnergia()?.classList.contains("active") &&
    laVista()?.classList.contains("active"),
  );
}

function dipingi(bolletta = laBolletta(allStates() || {}, salvate())) {
  const dove = laVista()?.querySelector?.("#bollette-wrap");
  if (!dove || !siVede()) return;
  const markup = paginaDelleBollette(bolletta);
  if (state.firma === markup && dove.firstElementChild) return;
  state.firma = markup;
  dove.innerHTML = markup;
}

/* ── la scheda nelle impostazioni dell'Energia ────────────────────────── */

function ensureScheda() {
  const editor = doc?.querySelector?.(
    '#ed-body[data-editor="energy"],#editor-modal [data-editor="energy"]',
  );
  const impostazioni = editor?.querySelector?.('[data-energy-panel="settings"]');
  if (!impostazioni) return;
  let scheda = impostazioni.querySelector("#dm-energia-bollette");
  if (scheda) return;
  scheda = doc.createElement("div");
  scheda.id = "dm-energia-bollette";
  scheda.className = "ed-form dm-bol-scheda";
  const states = allStates() || {};
  const scelte = salvate().voci;
  const trovati = sensoriDellaBolletta(states, {});
  scheda.innerHTML = `<div class="ed-sec-title">🧾 ${esc(t("Bollette", "Bills"))}</div>
    <div class="ed-hint">${esc(
      t(
        "I sensori dell'integrazione del fornitore. Vuoto vuol dire che li cerca la plancia.",
        "The supplier integration's sensors. Empty means the dashboard finds them.",
      ),
    )}</div>
    <div class="dm-bol-campi"></div>
    <button type="button" class="ed-save-btn" data-dm-bol-salva>💾 ${esc(t("Salva", "Save"))}</button>`;
  const campi = scheda.querySelector(".dm-bol-campi");
  for (const voce of VOCI_DELLA_BOLLETTA) {
    const riga = doc.createElement("label");
    riga.className = "dm-bol-campo";
    riga.innerHTML = `<span>${esc(nomeDellaVoce(voce.chiave))}</span>`;
    const trovato = trovati[voce.chiave];
    const { field } = createEntityPickerField(doc, {
      id: `ed-bolletta-${voce.chiave}`,
      value: scelte[voce.chiave] || "",
      placeholder: trovato ? nomeDellEntita(trovato, "", states) : "sensor.…",
      label: nomeDellaVoce(voce.chiave),
      locale: locale(),
      onPick: (input) => root.wzPickEntity?.(input),
    });
    riga.append(field);
    campi.append(riga);
  }
  scheda.querySelector("[data-dm-bol-salva]").addEventListener("click", () => {
    const voci = {};
    for (const voce of VOCI_DELLA_BOLLETTA) {
      const scritto = clean(doc.getElementById(`ed-bolletta-${voce.chiave}`)?.value);
      if (scritto) voci[voce.chiave] = scritto;
    }
    writeJsonIfChanged(CHIAVE_BOLLETTE, normalizzaBollette({ voci }));
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
    root.edToast?.(t("Bollette salvate", "Bills saved"));
    state.firma = "";
    schedule();
  });
  impostazioni.append(scheda);
}

/* ── i giri ───────────────────────────────────────────────────────────── */

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      const bolletta = laBolletta(allStates() || {}, salvate());
      accendiLaLinguetta(bolletta);
      dipingi(bolletta);
      ensureScheda();
    } catch (errore) {
      root.console?.warn?.("[DashboardModern] bollette", errore);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

function installStyles() {
  const V = `#${BOLLETTE_VIEW_ID}`;
  installStyle(
    "dm-bollette-style",
    `
    ${V} .dm-bol{display:grid;gap:14px;padding:4px 0 24px}
    ${V} .dm-bol-testa{display:grid;gap:6px;padding:20px 22px;border-radius:22px;min-width:0;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);
      box-shadow:var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    ${V} .dm-bol-testa[data-pagata="false"]{border-color:color-mix(in srgb,#f59e0b 45%,var(--card-border,#e2e8f0))}
    ${V} .dm-bol-riga{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;min-width:0}
    ${V} .dm-bol-cifra{display:grid;gap:2px;min-width:0}
    ${V} .dm-bol-cifra small{font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim,#64748b)}
    ${V} .dm-bol-cifra strong{font-family:Oswald,Inter,sans-serif;font-size:44px;font-weight:700;line-height:1;color:var(--text,#0f172a)}
    ${V} .dm-bol-testa[data-pagata="false"] .dm-bol-cifra strong{color:#c2410c}
    ${V} .dm-bol-stato{flex:0 0 auto;padding:7px 12px;border-radius:999px;font-size:12px;font-weight:900;white-space:nowrap;
      background:rgba(245,158,11,.16);color:#b45309}
    ${V} .dm-bol-stato[data-pagata="true"]{background:rgba(22,163,74,.14);color:#15803d}
    ${V} .dm-bol-sotto{font-size:13px;font-weight:750;color:var(--text-dim,#64748b)}
    ${V} .dm-bol-dati{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
    ${V} .dm-bol-dato{display:grid;gap:3px;align-content:start;padding:14px 16px;border-radius:18px;min-width:0;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff)}
    ${V} .dm-bol-dato span{font-size:10px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;color:var(--text-dim,#64748b)}
    ${V} .dm-bol-dato b{font-family:Oswald,Inter,sans-serif;font-size:24px;font-weight:600;line-height:1.1;color:var(--text,#0f172a)}
    ${V} .dm-bol-dato b i{font-style:normal;font-size:14px;color:var(--text-dim,#64748b)}
    ${V} .dm-bol-dato small{font-size:12px;font-weight:750;color:var(--text-dim,#64748b)}
    ${V} .dm-bol-dato[data-attenzione="true"] small{color:#b45309}
    ${V} .dm-bol-nota{margin:0;font-size:12px;font-weight:650;color:var(--text-dim,#64748b)}
    html[data-theme="dark"] ${V} .dm-bol-testa[data-pagata="false"] .dm-bol-cifra strong{color:#fdba74}
    html[data-theme="dark"] ${V} .dm-bol-stato{background:rgba(245,158,11,.2);color:#fcd34d}
    html[data-theme="dark"] ${V} .dm-bol-stato[data-pagata="true"]{background:rgba(34,197,94,.18);color:#86efac}
    .dm-bol-campi{display:grid;gap:10px;margin:8px 0 12px}
    .dm-bol-campo{display:grid;gap:4px}
    .dm-bol-campo>span{font-size:12px;font-weight:800;color:var(--text-dim,#64748b)}
    @media(max-width:520px){${V} .dm-bol-cifra strong{font-size:36px}}
    `,
  );
}

export function installLaBolletta() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  for (const nome of ["render", "switchEnergyView"]) {
    const precedente = root[nome];
    if (typeof precedente !== "function" || precedente.__dmBollette) continue;
    const avvolta = function (...args) {
      const esito = precedente.apply(this, args);
      schedule();
      return esito;
    };
    avvolta.__dmBollette = true;
    avvolta.__dmPrevious = precedente;
    root[nome] = avvolta;
  }
  onEditorRedraw("__dmBolletteSection", schedule);
  for (const evento of [
    "dashboardmodern:editor-rendered",
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  doc.addEventListener?.("visibilitychange", schedule);
  quandoSiCambiaPagina(schedule);
  schedule();
  return true;
}

senzaCadere(installLaBolletta);
