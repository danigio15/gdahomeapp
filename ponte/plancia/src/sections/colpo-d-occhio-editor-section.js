/* La scheda «Colpo d'occhio» nel Config.
 *
 * Si vede solo nelle plance nate a colpo d'occhio (o che lo sono diventate):
 * le altre non hanno niente da farci. Dentro, in quest'ordine, quello che la
 * pagina mostra:
 *
 *   · la testata: accesa o no, il nome della casa, la riga sotto, il meteo;
 *   · i riquadri: quali, in che ordine, con che nome e che colore; per il
 *     cancello anche cosa apre e se chiede prima;
 *   · il fotovoltaico: le misure di adesso, di oggi e del mese;
 *   · le telecamere, coi nomi e — per il video WebRTC — lo stream di go2rtc;
 *   · l'antifurto: i modi fatti di interruttori, o una centrale vera.
 *
 * Ogni campo si salva quando lo si lascia; aggiungere, togliere e spostare
 * ridisegnano la scheda. Le entita' si scrivono o si scelgono dall'elenco di
 * quelle di casa, gia' filtrate per il loro dominio.
 */
import {
  CHIAVE_OCCHIO,
  MODI_AL_MASSIMO,
  RIQUADRI_AL_MASSIMO,
  TELECAMERE_AL_MASSIMO,
  TIPI_DI_RIQUADRO,
  nuovoRiquadro,
  occhioPulito,
} from "../core/colpo-d-occhio.js";
import { disegnoDelCatalogo } from "../core/catalogo-disegni.js";
import { premiumDellaCasa } from "./plancia-a-muro-section.js";
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

const KEY = "__DASHBOARDMODERN_COLPO_D_OCCHIO_EDITOR__";
const state = (root[KEY] ||= { installed: false, premium: null, chiedendo: false });

export const OCCHIO_TAB = "occhio";

/* Le entita' di casa per un campo, dai domini che quel campo accetta. */
const DOMINI = {
  meteo: ["weather"],
  potenza: ["sensor"],
  energia: ["sensor"],
  camera: ["camera"],
  centrale: ["alarm_control_panel"],
  modo: ["input_boolean", "switch", "script", "button", "input_button", "automation"],
  apri: ["switch", "button", "input_button", "lock", "cover", "script", "input_boolean"],
};

/* I disegni da cui scegliere per un modo dell'antifurto. */
const DISEGNI_DEI_MODI = ["moon", "sun", "home", "security", "lock", "plane", "person", "star"];

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function grezzo() {
  return readJson(CHIAVE_OCCHIO, null);
}

function occhio() {
  return occhioPulito(grezzo());
}

function salva(config) {
  writeJsonIfChanged(CHIAVE_OCCHIO, occhioPulito(config));
  try {
    root.render?.();
  } catch (_errore) {}
}

/* ── i pezzi ──────────────────────────────────────────────────────────── */

function elencoDi(chi) {
  const domini = DOMINI[chi] || [];
  return Object.keys(allStates() || {})
    .filter((id) => domini.includes(id.split(".")[0]))
    .sort();
}

let numeroDelCampo = 0;
/* Un campo come quelli delle altre schede: l'etichetta sopra, e per le
 * entita' il tasto 🔍 che apre il cercatore della plancia. */
function campo(etichetta, percorso, valore, { elenco = "", segnaposto = "", tipo = "text" } = {}) {
  const id = `dm-oc-ed-${(numeroDelCampo += 1)}`;
  return `<label class="dm-oc-ed-campo${elenco ? " dm-oc-ed-entita" : ""}"><span class="dm-oc-ed-lbl">${esc(etichetta)}</span>
    <span class="ed-form-row"><input id="${id}" class="ed-input${elenco ? " mono" : ""}" type="${tipo}" data-dm-oc-campo="${esc(percorso)}"
      value="${esc(valore)}" placeholder="${esc(segnaposto || (elenco ? `${DOMINI[elenco][0]}.…` : ""))}" spellcheck="false" autocomplete="off">${
        elenco
          ? `<button type="button" class="dm-oc-ed-cerca" data-dm-oc-cerca="${id}" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button>`
          : ""
      }</span>
  </label>`;
}

function spunta(etichetta, percorso, acceso) {
  return `<label class="dm-oc-ed-spunta"><input type="checkbox" data-dm-oc-campo="${esc(percorso)}" ${
    acceso ? "checked" : ""
  }><span>${esc(etichetta)}</span></label>`;
}

/* Un gruppo come quelli delle altre schede (Sport, Allerte): la testa con
 * il disegno e il titolo, e sotto il corpo con i suoi margini. */
function gruppo(chiave, disegno, titolo, corpo, accanto = "") {
  return `<article class="ed-row dm-todo-ed-row dm-allerte-ed-fonte dm-oc-ed-gruppo" data-open="true" data-dm-oc-gruppo="${esc(chiave)}">
      <div class="dm-allerte-ed-testa"><span class="dm-oc-ed-ic" aria-hidden="true">${
        disegnoDelCatalogo(disegno, 26) || ""
      }</span><strong>${esc(titolo)}</strong>${accanto}</div>
      <div class="dm-todo-ed-body dm-oc-ed-corpo">${corpo}</div>
    </article>`;
}

const NOMI_DEI_TIPI = () => ({
  energia: t("Fotovoltaico", "Solar"),
  telecamere: t("Telecamere", "Cameras"),
  antifurto: t("Antifurto", "Alarm"),
  apri: t("Cancello o porta", "Gate or door"),
});

function frecce(dove, i, quanti) {
  return `<span class="dm-oc-ed-frecce">
    <button type="button" class="ed-del" data-dm-oc-su="${dove}:${i}" ${i === 0 ? "disabled" : ""} aria-label="${esc(t("Su", "Up"))}">↑</button>
    <button type="button" class="ed-del" data-dm-oc-giu="${dove}:${i}" ${i === quanti - 1 ? "disabled" : ""} aria-label="${esc(t("Giù", "Down"))}">↓</button>
    <button type="button" class="ed-del" data-dm-oc-togli="${dove}:${i}" aria-label="${esc(t("Togli", "Remove"))}">✕</button>
  </span>`;
}

function riquadriMarkup(o) {
  const nomi = NOMI_DEI_TIPI();
  const voci = o.riquadri
    .map(
      (r, i) => `<div class="dm-oc-ed-voce">
        <span class="dm-oc-ed-colore" style="--c:${esc(r.colore)}">${disegnoDelCatalogo(r.disegno, 24) || ""}</span>
        <div class="dm-oc-ed-voce-corpo">
          <strong>${esc(nomi[r.tipo])}</strong>
          <div class="dm-oc-ed-righe">
            ${campo(t("Nome", "Name"), `riquadri.${i}.nome`, r.nome, { segnaposto: nomi[r.tipo] })}
            ${campo(t("Colore", "Color"), `riquadri.${i}.colore`, r.colore, { tipo: "color" })}
            ${
              r.tipo === "apri"
                ? `${campo(t("Cosa apre", "What it opens"), `riquadri.${i}.entita`, r.entita, { elenco: "apri", segnaposto: "switch.cancello" })}
                   ${spunta(t("Chiede conferma prima di aprire", "Asks before opening"), `riquadri.${i}.conferma`, r.conferma)}`
                : ""
            }
          </div>
        </div>
        ${frecce("riquadri", i, o.riquadri.length)}
      </div>`,
    )
    .join("");
  const pieno = o.riquadri.length >= RIQUADRI_AL_MASSIMO;
  return `${voci || `<p class="dm-oc-ed-nota">${esc(t("Nessun riquadro.", "No tiles."))}</p>`}
    <div class="dm-oc-ed-tasti">${TIPI_DI_RIQUADRO.map(
      (tipo) =>
        `<button type="button" class="ed-btn-add" data-dm-oc-aggiungi="${tipo}" ${pieno ? "disabled" : ""}>+ ${esc(nomi[tipo])}</button>`,
    ).join("")}</div>`;
}

/* Il fotovoltaico: le misure di adesso, poi quelle di oggi e del mese. */
function energiaMarkup(o) {
  const e = o.energia;
  const periodo = (chi, titolo) => `<div class="dm-oc-ed-sotto">${esc(titolo)}</div>
    <div class="dm-oc-ed-righe">
      ${campo(t("Prodotta", "Produced"), `energia.${chi}.solare`, e[chi].solare, { elenco: "energia" })}
      ${campo(t("Consumata in casa", "Used at home"), `energia.${chi}.casa`, e[chi].casa, { elenco: "energia" })}
      ${campo(t("Comprata dalla rete", "Bought from grid"), `energia.${chi}.comprata`, e[chi].comprata, { elenco: "energia" })}
      ${campo(t("Venduta alla rete", "Sold to grid"), `energia.${chi}.venduta`, e[chi].venduta, { elenco: "energia" })}
      ${campo(t("Messa in batteria", "Into battery"), `energia.${chi}.carica`, e[chi].carica, { elenco: "energia" })}
      ${campo(t("Presa dalla batteria", "From battery"), `energia.${chi}.scarica`, e[chi].scarica, { elenco: "energia" })}
    </div>`;
  return `<div class="dm-oc-ed-sotto">${esc(t("Adesso", "Now"))}</div>
    <div class="dm-oc-ed-righe">
      ${campo(t("Pannelli", "Panels"), "energia.solare", e.solare, { elenco: "potenza" })}
      ${campo(t("Casa", "Home"), "energia.casa", e.casa, { elenco: "potenza" })}
      ${campo(t("Rete (positiva quando prelevi)", "Grid (positive when importing)"), "energia.rete", e.rete, { elenco: "potenza" })}
      ${campo(t("Batteria (positiva quando scarica)", "Battery (positive when discharging)"), "energia.batteria", e.batteria, { elenco: "potenza" })}
      ${campo(t("Carica della batteria (%)", "Battery charge (%)"), "energia.soc", e.soc, { elenco: "potenza" })}
    </div>
    ${spunta(t("Inverti il segno della rete", "Flip the grid sign"), "energia.reteGirata", e.reteGirata)}
    ${spunta(t("Inverti il segno della batteria", "Flip the battery sign"), "energia.batteriaGirata", e.batteriaGirata)}
    ${periodo("giorno", t("Oggi", "Today"))}
    ${periodo("mese", t("Questo mese", "This month"))}`;
}

function telecamereMarkup(o) {
  const voci = o.telecamere
    .map(
      (c, i) => `<div class="dm-oc-ed-voce dm-oc-ed-voce-corta">
        <div class="dm-oc-ed-righe">
          ${campo(t("Telecamera", "Camera"), `telecamere.${i}.entity`, c.entity, { elenco: "camera" })}
          ${campo(t("Nome", "Name"), `telecamere.${i}.nome`, c.nome)}
          ${campo(t("Stream go2rtc (facoltativo)", "go2rtc stream (optional)"), `telecamere.${i}.stream`, c.stream)}
        </div>
        ${spunta(t("Dal vivo: il flusso continuo invece delle foto ogni 4 secondi", "Live: the continuous stream instead of a photo every 4 seconds"), `telecamere.${i}.vivo`, c.vivo)}
        ${frecce("telecamere", i, o.telecamere.length)}
      </div>`,
    )
    .join("");
  const pieno = o.telecamere.length >= TELECAMERE_AL_MASSIMO;
  return `${voci}
    <div class="dm-oc-ed-tasti">
      <button type="button" class="ed-btn-add" data-dm-oc-nuova="telecamere" ${pieno ? "disabled" : ""}>+ ${esc(t("Telecamera", "Camera"))}</button>
      <button type="button" class="ed-btn-add" data-dm-oc-tutte ${pieno ? "disabled" : ""}>${esc(t("Prendi tutte quelle di casa", "Take all of the home's"))}</button>
    </div>`;
}

function antifurtoMarkup(o) {
  const a = o.antifurto;
  const voci = a.modi
    .map(
      (m, i) => `<div class="dm-oc-ed-voce">
        <span class="dm-oc-ed-colore" style="--c:${esc(m.colore)}">${disegnoDelCatalogo(m.disegno, 24) || ""}</span>
        <div class="dm-oc-ed-voce-corpo"><div class="dm-oc-ed-righe">
          ${campo(t("Entità che inserisce", "Entity that arms"), `antifurto.modi.${i}.entita`, m.entita, { elenco: "modo" })}
          ${campo(t("Nome", "Name"), `antifurto.modi.${i}.nome`, m.nome)}
          <label class="dm-oc-ed-campo"><span class="dm-oc-ed-lbl">${esc(t("Disegno", "Icon"))}</span>
            <select class="ed-input" data-dm-oc-campo="antifurto.modi.${i}.disegno">${DISEGNI_DEI_MODI.map(
              (d) => `<option value="${d}" ${d === m.disegno ? "selected" : ""}>${esc(d)}</option>`,
            ).join("")}</select></label>
          ${campo(t("Colore", "Color"), `antifurto.modi.${i}.colore`, m.colore, { tipo: "color" })}
        </div></div>
        ${frecce("antifurto.modi", i, a.modi.length)}
      </div>`,
    )
    .join("");
  return `${campo(
    t("Centrale (se non usi i modi qui sotto)", "Alarm panel (if you don't use the modes below)"),
    "antifurto.centrale",
    a.centrale,
    { elenco: "centrale" },
  )}
    <p class="dm-oc-ed-sotto">${esc(t("Modi su misura: un tasto grande per ognuno", "Custom modes: one big button each"))}</p>
    ${voci}
    <div class="dm-oc-ed-tasti"><button type="button" class="ed-btn-add" data-dm-oc-nuova="antifurto.modi" ${
      a.modi.length >= MODI_AL_MASSIMO ? "disabled" : ""
    }>+ ${esc(t("Modo", "Mode"))}</button></div>`;
}

/* La licenza, chiesta al ponte come per la plancia a muro: con Base la
 * scheda si vede ma e' chiusa dal lucchetto. */
function chiediLaLicenza() {
  if (state.chiedendo) return;
  state.chiedendo = true;
  premiumDellaCasa({ forza: true })
    .then((premium) => {
      state.premium = premium === true;
    })
    .catch(() => {
      state.premium = false;
    })
    .finally(() => {
      state.chiedendo = false;
      ridisegna();
    });
}

function corpoMarkup() {
  const contenuto = contenutoMarkup();
  if (state.premium === true) return `<div class="dm-oc-ed">${contenuto}</div>`;
  if (state.premium === null)
    return `<div class="dm-oc-ed"><p class="dm-oc-ed-nota">${esc(
      t("Controllo la licenza…", "Checking the licence…"),
    )}</p>${contenuto}</div>`;
  return `<div class="dm-oc-ed dm-oc-ed-chiuso"><div class="dm-oc-ed-dietro" aria-hidden="true" inert>${contenuto}</div>
    <div class="dm-oc-ed-lucchetto"><span aria-hidden="true">🔒</span>
      <b>${esc(t("Il Colpo d'occhio è Premium", "At a glance is Premium"))}</b>
      <p>${esc(
        t(
          "Con GdAHome Base questa plancia resta una plancia normale. Con Premium diventa una pagina sola con il meteo e i riquadri grandi, e ogni riquadro apre i suoi dati in un popup. Premium si attiva dall'app GdAHome.",
          "With GdAHome Base this dashboard stays a normal dashboard. With Premium it becomes a single page with the weather and big tiles, and each tile opens its data in a popup. Premium is turned on from the GdAHome app.",
        ),
      )}</p></div></div>`;
}

function contenutoMarkup() {
  const o = occhio();
  return `
    <div class="ed-intro">${esc(
      t(
        "Colpo d'occhio: una pagina sola con il meteo e i riquadri grandi. Ogni riquadro apre i suoi dati in un popup — il flusso del fotovoltaico, le telecamere dal vivo, i tasti dell'antifurto — e il cancello si apre con un tocco.",
        "At a glance: one page with the weather and big tiles. Each tile opens its data in a popup — the solar flow, live cameras, alarm buttons — and the gate opens with one tap.",
      ),
    )} <span class="dm-oc-ed-premium">PREMIUM</span></div>
    <div class="ed-list">
      ${gruppo(
        "testata",
        "home",
        t("Pagina", "Page"),
        `${spunta(t("Accesa: questa plancia si apre a colpo d'occhio", "On: this dashboard opens at a glance"), "attiva", o.attiva)}
        <div class="dm-oc-ed-griglia">
          ${campo(t("Nome della casa", "Home name"), "titolo", o.titolo, { segnaposto: t("Casa", "Home") })}
          ${campo(t("Riga sotto", "Subtitle"), "sottotitolo", o.sottotitolo)}
          ${campo(t("Meteo", "Weather"), "meteo", o.meteo, { elenco: "meteo", segnaposto: "weather.casa" })}
        </div>`,
      )}
      ${gruppo("riquadri", "sliders", t("Riquadri", "Tiles"), riquadriMarkup(o), `<span class="dm-oc-ed-conto">${o.riquadri.length}/${RIQUADRI_AL_MASSIMO}</span>`)}
      ${gruppo("energia", "solar", t("Fotovoltaico", "Solar"), energiaMarkup(o))}
      ${gruppo("telecamere", "camera", t("Telecamere", "Cameras"), telecamereMarkup(o), `<span class="dm-oc-ed-conto">${o.telecamere.length}</span>`)}
      ${gruppo("antifurto", "security", t("Antifurto", "Alarm"), antifurtoMarkup(o))}
    </div>`;
}

/* La scheda c'e' solo nelle plance a colpo d'occhio. */
function serve() {
  return grezzo() !== null;
}

export function ensureOcchioEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== OCCHIO_TAB) return false;
  if (state.premium === null) chiediLaLicenza();
  const firma = `${state.premium}:${JSON.stringify(occhio())}`;
  if (body.dataset.dmOcchioEditor === firma && body.querySelector(".dm-oc-ed")) return true;
  /* Mentre si scrive in un campo non si ridisegna: si perderebbe il punto. */
  if (
    body.querySelector(".dm-oc-ed") &&
    body.contains(doc.activeElement) &&
    doc.activeElement?.dataset?.dmOcCampo
  )
    return true;
  body.dataset.dmOcchioEditor = firma;
  body.innerHTML = corpoMarkup();
  body.dataset.renderer = "occhio";
  return true;
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmOcchioEditor;
  ensureOcchioEditor();
}

/* ── i gesti ──────────────────────────────────────────────────────────── */

function nelCorpo(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== OCCHIO_TAB || !body.contains(event.target)) return null;
  /* Dietro il lucchetto non si cambia niente. */
  if (event.target.closest?.(".dm-oc-ed-dietro")) return null;
  return body;
}

/* Il valore di un percorso «riquadri.2.nome» dentro il config. */
function scrivi(config, percorso, valore) {
  const pezzi = percorso.split(".");
  let dove = config;
  for (const [i, pezzo] of pezzi.entries()) {
    if (i === pezzi.length - 1) {
      dove[pezzo] = valore;
      return;
    }
    if (dove[pezzo] == null || typeof dove[pezzo] !== "object")
      dove[pezzo] = /^\d+$/.test(pezzi[i + 1]) ? [] : {};
    dove = dove[pezzo];
  }
}

function leggiElenco(config, dove) {
  return dove.split(".").reduce((x, k) => x?.[k], config);
}

function onClick(event) {
  const body = nelCorpo(event);
  if (!body) return;
  const cerca = event.target.closest("[data-dm-oc-cerca]");
  if (cerca) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(cerca.dataset.dmOcCerca))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }
  const config = occhio();
  const bottone = event.target.closest("[data-dm-oc-su],[data-dm-oc-giu],[data-dm-oc-togli]");
  if (bottone) {
    event.preventDefault();
    const [dove, quale] = (
      bottone.dataset.dmOcSu ||
      bottone.dataset.dmOcGiu ||
      bottone.dataset.dmOcTogli
    ).split(":");
    const elenco = leggiElenco(config, dove);
    const i = Number(quale);
    if (!Array.isArray(elenco) || !elenco[i]) return;
    if (bottone.dataset.dmOcTogli !== undefined) elenco.splice(i, 1);
    else {
      const j = i + (bottone.dataset.dmOcSu !== undefined ? -1 : 1);
      if (j < 0 || j >= elenco.length) return;
      [elenco[i], elenco[j]] = [elenco[j], elenco[i]];
    }
    salva(config);
    ridisegna();
    return;
  }
  const aggiungi = event.target.closest("[data-dm-oc-aggiungi]");
  if (aggiungi) {
    event.preventDefault();
    config.riquadri.push(nuovoRiquadro(clean(aggiungi.dataset.dmOcAggiungi)));
    salva(config);
    ridisegna();
    return;
  }
  const nuova = event.target.closest("[data-dm-oc-nuova]");
  if (nuova) {
    event.preventDefault();
    const dove = clean(nuova.dataset.dmOcNuova);
    const elenco = leggiElenco(config, dove);
    /* Una riga nuova nasce con la prima entita' di casa che non c'e' ancora:
     * vuota, il config la butterebbe al primo salvataggio. */
    if (dove === "telecamere") {
      const libera = elencoDi("camera").find(
        (id) => !config.telecamere.some((c) => c.entity === id),
      );
      if (libera) elenco.push({ entity: libera, nome: "" });
    } else {
      const libera = elencoDi("modo").find(
        (id) => !config.antifurto.modi.some((m) => m.entita === id),
      );
      if (libera) elenco.push({ entita: libera, nome: "" });
    }
    salva(config);
    ridisegna();
    return;
  }
  if (event.target.closest("[data-dm-oc-tutte]")) {
    event.preventDefault();
    for (const id of elencoDi("camera"))
      if (!config.telecamere.some((c) => c.entity === id))
        config.telecamere.push({ entity: id, nome: "" });
    salva(config);
    ridisegna();
  }
}

function onChange(event) {
  if (!nelCorpo(event)) return;
  const casella = event.target.closest("[data-dm-oc-campo]");
  if (!casella) return;
  const config = occhio();
  const valore = casella.type === "checkbox" ? casella.checked : clean(casella.value);
  scrivi(config, casella.dataset.dmOcCampo, valore);
  salva(config);
  /* Spegnere la pagina o cambiare un'entita' cambia altre cose della
   * scheda; un nome no. */
  if (casella.type === "checkbox" || casella.tagName === "SELECT" || casella.type === "color")
    ridisegna();
}

export function ensureOcchioEditorTab() {
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette) return false;
  const presente = linguette.querySelector(`.ed-tab[data-tab="${OCCHIO_TAB}"]`);
  if (!serve()) {
    presente?.remove();
    return false;
  }
  if (presente) return false;
  const linguetta = doc.createElement("button");
  linguetta.className = "ed-tab";
  linguetta.dataset.tab = OCCHIO_TAB;
  linguetta.textContent = `👁️ ${t("Colpo d'occhio", "At a glance")}`;
  linguetta.addEventListener("click", () => root.editorSwitch?.(OCCHIO_TAB));
  linguette.prepend(linguetta);
  return true;
}

function installaLoStile() {
  installStyle(
    "dm-occhio-editor-style",
    `
      #ed-body .dm-oc-ed-gruppo{display:block}
      #ed-body .dm-oc-ed-corpo{display:grid;gap:10px;padding-top:4px}
      #ed-body .dm-oc-ed-corpo>.dm-oc-ed-griglia{margin:0}
      #ed-body .dm-oc-ed-ic{display:inline-flex;width:26px;height:26px;flex:0 0 auto}
      #ed-body .dm-oc-ed-ic svg{width:26px;height:26px}
      #ed-body .dm-oc-ed-conto{margin-left:auto;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:900;letter-spacing:.6px;
        color:#047857;background:color-mix(in srgb,#10b981 14%,transparent)}
      #ed-body .dm-oc-ed-griglia{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));align-items:start;gap:10px;margin:8px 0}
      #ed-body .dm-oc-ed-campo{display:grid;align-content:start;gap:4px;margin:0;min-width:0}
      /* Un'entita' ha il nome lungo e il tasto 🔍: le serve piu' spazio. */
      #ed-body .dm-oc-ed-righe .dm-oc-ed-entita{grid-column:span 2}
      @media(max-width:760px){#ed-body .dm-oc-ed-righe .dm-oc-ed-entita{grid-column:1/-1}}
      #ed-body .dm-oc-ed-lbl{font-size:10.5px;font-weight:900;letter-spacing:.6px;text-transform:uppercase;color:var(--text-dim,#64748b)}
      #ed-body .dm-oc-ed-campo .ed-form-row{display:flex;gap:6px;min-width:0}
      #ed-body .dm-oc-ed-campo .ed-input{flex:1;min-width:0}
      #ed-body .dm-oc-ed-campo input[type=color]{height:38px;padding:2px 6px}
      #ed-body .dm-oc-ed-cerca{flex:0 0 38px;height:38px;border:none;border-radius:10px;background:linear-gradient(135deg,#0ea5e9,#0369a1);
        color:#fff;font-size:14px;cursor:pointer}
      #ed-body .dm-oc-ed-spunta{display:flex;align-items:center;gap:8px;margin:6px 0;font-size:13px;font-weight:700;color:var(--text,#0f172a)}
      #ed-body .dm-oc-ed-spunte{display:flex;flex-wrap:wrap;gap:4px 18px}
      #ed-body .dm-oc-ed-sotto{margin:14px 2px 2px;font-size:11px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:var(--text-dim,#64748b)}
      #ed-body .dm-oc-ed-voce{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:start;gap:12px;margin:8px 0;padding:12px;
        border-radius:14px;border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff)}
      #ed-body .dm-oc-ed-voce-corta{grid-template-columns:minmax(0,1fr) auto}
      #ed-body .dm-oc-ed-voce-corpo{display:grid;gap:6px;min-width:0}
      #ed-body .dm-oc-ed-voce-corpo>strong{font-size:13.5px;font-weight:900;color:var(--text,#0f172a)}
      #ed-body .dm-oc-ed-righe{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));align-items:end;gap:8px}
      #ed-body .dm-oc-ed-colore{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:var(--c)}
      #ed-body .dm-oc-ed-colore svg{width:24px;height:24px}
      #ed-body .dm-oc-ed-frecce{display:flex;gap:4px}
      #ed-body .dm-oc-ed-frecce .ed-del[disabled]{opacity:.25;cursor:default}
      #ed-body .dm-oc-ed-tasti{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
      #ed-body .dm-oc-ed-tasti .ed-btn-add{flex:1 1 160px}
      #ed-body .dm-oc-ed-tasti .ed-btn-add[disabled]{opacity:.4;cursor:default}
      #ed-body .dm-oc-ed-premium{display:inline-block;margin-left:6px;font-size:9.5px;font-weight:900;letter-spacing:.08em;padding:2px 7px;border-radius:6px;
        color:#b45309;border:1px solid #f59e0b88;background:#f59e0b18}
      #ed-body .dm-oc-ed-chiuso{position:relative;min-height:420px}
      #ed-body .dm-oc-ed-dietro{filter:blur(2px);opacity:.4;pointer-events:none;max-height:520px;overflow:hidden}
      #ed-body .dm-oc-ed-lucchetto{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;
        text-align:center;padding:24px}
      #ed-body .dm-oc-ed-lucchetto>span{font-size:44px;line-height:1}
      #ed-body .dm-oc-ed-lucchetto b{font-family:Oswald,Inter,sans-serif;font-weight:500;font-size:26px;text-transform:uppercase;color:var(--text,#0f172a)}
      #ed-body .dm-oc-ed-lucchetto p{max-width:520px;margin:0;font-size:14px;line-height:1.55;color:var(--text-dim,#64748b)}
      #ed-body .dm-oc-ed-nota{margin:4px 2px;font-size:11.5px;font-weight:700;line-height:1.45;color:var(--text-dim,#64748b)}
      @media(max-width:760px){
        /* Sul telefono le frecce salgono accanto al titolo: i campi prendono
           tutta la larghezza della scheda. */
        #ed-body .dm-oc-ed-voce,#ed-body .dm-oc-ed-voce-corta{position:relative;grid-template-columns:minmax(0,1fr)}
        #ed-body .dm-oc-ed-voce>.dm-oc-ed-colore{display:none}
        #ed-body .dm-oc-ed-voce>.dm-oc-ed-frecce{position:absolute;top:10px;right:10px}
        #ed-body .dm-oc-ed-voce-corpo>strong{padding-right:130px;min-height:34px;display:flex;align-items:center}
        #ed-body .dm-oc-ed-voce-corta>.dm-oc-ed-righe{padding-top:40px}
      }
    `,
  );
}

export function installOcchioEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installaLoStile();
  doc.addEventListener("click", onClick);
  doc.addEventListener("change", onChange);
  wrapFunction("apriConfigEntita", "__dmOcchioEditor", () => {
    ensureOcchioEditorTab();
    ensureOcchioEditor();
  });
  onEditorRedraw("__dmOcchioEditor", () => {
    root.queueMicrotask?.(() => {
      ensureOcchioEditorTab();
      ensureOcchioEditor();
    });
  });
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensureOcchioEditorTab();
        ensureOcchioEditor();
      });
    });
  ensureOcchioEditorTab();
  ensureOcchioEditor();
  return true;
}

senzaCadere(installOcchioEditor);
