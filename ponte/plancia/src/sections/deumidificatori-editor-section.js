/* Dove si dichiarano i deumidificatori (#205).
 *
 * «Non riconosciuti con tutti i comandi del dispositivo.» Chi ha aperto la
 * segnalazione l'aveva messo fra le unita' del Clima perche' non c'era altro
 * posto; adesso ce n'e' uno, nella configurazione del Clima, sotto la
 * ventilazione e sopra il tasto che aggiunge un'unita'.
 *
 * Serve una casella sola, l'entita' `humidifier`: le altre — il serbatoio
 * pieno, l'umidita', la temperatura, la ventola, i watt — le integrazioni le
 * pubblicano accanto con lo stesso nome davanti, e salvando si riempiono da
 * sole quando sono vuote. Chi vuole una sonda diversa la scrive, e resta la
 * sua.
 */
import {
  CAMPI_DEUMIDIFICATORE,
  CHIAVE_DEUMIDIFICATORI,
  MASSIMO_DEUMIDIFICATORI,
  completaDeumidificatore,
  normalizzaDeumidificatori,
} from "../core/deumidificatori.js";
import { SENZA_TESSERA } from "../core/fuori-dai-widget.js";
import { renderClimate } from "./climate-thermal-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  roomOptionsMarkup,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_DEUMIDIFICATORI_EDITOR__";
const state = (root[KEY] ||= { installed: false, contatore: 0 });

const ANCORA = "dm-deum-ed";

function configurati() {
  return normalizzaDeumidificatori(readJson(CHIAVE_DEUMIDIFICATORI, []));
}

function salva(elenco) {
  const pulita = normalizzaDeumidificatori(elenco);
  writeJsonIfChanged(CHIAVE_DEUMIDIFICATORI, pulita);
  try {
    renderClimate({ rebuild: true });
  } catch (_error) {}
  try {
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  } catch (_error) {}
}

/* L'ancora e' la stessa della ventilazione, e per la stessa ragione: le
 * sezioni del Config stanno tutte nello stesso corpo, e solo il tasto che
 * aggiunge un'unita' del Clima dice che si sta guardando il Clima. */
function tastoAggiungiClima() {
  const body = doc?.getElementById?.("ed-body");
  return body?.querySelector?.('[onclick*="edAddClima"]') || null;
}

function nellaSchedaClima() {
  const body = doc?.getElementById?.("ed-body");
  return Boolean(body?.querySelector?.("#ed-cl-ent")) && Boolean(tastoAggiungiClima());
}

function etichetta(chiave) {
  switch (chiave) {
    case "entita":
      return t("Entità humidifier (obbligatoria)", "Humidifier entity (required)");
    case "umidita":
      return t("Sensore di umidità", "Humidity sensor");
    case "temperatura":
      return t("Sensore di temperatura", "Temperature sensor");
    case "serbatoio":
      return t("Serbatoio pieno", "Tank full");
    case "ventola":
      return t("Velocità della ventola (fan o select)", "Fan speed (fan or select)");
    default:
      return t("Consumo (W)", "Power (W)");
  }
}

function esempio(chiave) {
  const nomi = {
    entita: "humidifier.deumidificatore_sala",
    umidita: "sensor.deumidificatore_sala_humidity",
    temperatura: "sensor.deumidificatore_sala_temperature",
    serbatoio: "binary_sensor.deumidificatore_sala_tank_full",
    ventola: "fan.deumidificatore_sala_fan",
    consumo: "sensor.deumidificatore_sala_power",
  };
  return nomi[chiave] || "sensor.deumidificatore";
}

function campoMarkup(unita, indice, chiave) {
  const id = `dm-deum-${indice}-${chiave}`;
  return `<label class="ed-slot dm-deum-ed-campo"><span class="ed-slot-lbl">${esc(etichetta(chiave))}</span>
    <span class="ed-form-row"><input id="${esc(id)}" class="ed-input mono" data-dm-deum-campo="${esc(chiave)}" value="${esc(unita[chiave])}" placeholder="${esc(esempio(chiave))}" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-dm-deum-pick="${esc(id)}" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span></label>`;
}

function unitaMarkup(unita, indice) {
  const [principale, ...accanto] = CAMPI_DEUMIDIFICATORE;
  return `<article class="ed-row dm-deum-ed-unita" data-dm-deum-unita="${esc(unita.id)}">
    <div class="dm-deum-ed-testa">
      <span aria-hidden="true">💧</span>
      <input class="ed-input" data-dm-deum-campo="nome" value="${esc(unita.nome)}" placeholder="${esc(t("Nome (es. Deumidificatore sala)", "Name (e.g. Living room dehumidifier)"))}">
      <button type="button" class="ed-del" data-dm-deum-togli="${esc(unita.id)}" title="${esc(t("Togli", "Remove"))}" aria-label="${esc(t("Togli", "Remove"))}">🗑️</button>
    </div>
    <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Stanza", "Room"))}</span><span class="ed-form-row"><select class="ed-input" data-dm-deum-campo="stanza">${roomOptionsMarkup(unita.stanza, t("Nessuna stanza", "No room"))}</select></span></label>
    ${campoMarkup(unita, indice, principale)}
    <div class="dm-deum-ed-fascia">
      <span class="dm-deum-ed-fascia-lbl">${esc(t("Accanto (si compilano da sole salvando)", "Alongside (filled in automatically on save)"))}</span>
      ${accanto.map((chiave) => campoMarkup(unita, indice, chiave)).join("")}
    </div>
  </article>`;
}

function corpoMarkup() {
  const elenco = configurati();
  const pieni = elenco.length >= MASSIMO_DEUMIDIFICATORI;
  return `<div class="ed-sec-title">💧 ${esc(t("Deumidificatori", "Dehumidifiers"))}</div>
  <div class="ed-intro">${esc(
    t(
      "Un deumidificatore non è un termostato: scegli la sua entità humidifier e la pagina del Clima gli dà una card sua, con l'umidità di adesso, l'obiettivo, le modalità, la ventola e l'avviso del serbatoio pieno. Le altre caselle si riempiono da sole quando salvi.",
      "A dehumidifier is not a thermostat: pick its humidifier entity and the Climate page gives it a card of its own, with the current humidity, the target, the modes, the fan and the tank-full warning. The other fields fill themselves in when you save.",
    ),
  )}</div>
  <div class="ed-list dm-deum-ed-lista">
    ${elenco.map(unitaMarkup).join("")}
    <button type="button" class="ed-btn-add" data-dm-deum-aggiungi${pieni ? " disabled" : ""}>＋ ${esc(t("Aggiungi un deumidificatore", "Add a dehumidifier"))}</button>
    <button type="button" class="ed-save-btn" data-dm-deum-salva>💾 ${esc(t("Salva deumidificatori", "Save dehumidifiers"))}</button>
  </div>`;
}

/** La scheda, appesa sopra la ventilazione e il tasto che aggiunge un'unita'. */
export function ensureDeumidificatoriEditor() {
  const body = doc?.getElementById?.("ed-body");
  if (!body) return false;
  let scheda = doc?.getElementById?.(ANCORA);
  const aggiungi = tastoAggiungiClima();
  if (!nellaSchedaClima() || !aggiungi) {
    scheda?.remove();
    return false;
  }
  /* La ventilazione si tiene attaccata al tasto e la sua prova lo dice
   * (`la-vmc-sta-nel-clima-non-in-fondo`): questa scheda le sta sopra. Se
   * tutte e due volessero il posto accanto al tasto, ogni ridisegno le
   * scambierebbe. */
  const vmc = doc.getElementById?.("dm-vmc-ed");
  const ancora = vmc && vmc !== scheda && vmc.nextElementSibling === aggiungi ? vmc : aggiungi;
  const firma = JSON.stringify(configurati());
  if (!scheda) {
    scheda = doc.createElement("section");
    scheda.id = ANCORA;
    scheda.className = "ed-form dm-deum-ed";
    /* In Home non c'e' una tessera dei deumidificatori: senza dirlo,
     * l'interruttore «nel widget» accanto a queste caselle prenderebbe quella
     * del Clima e scriverebbe a suo nome. */
    scheda.setAttribute(SENZA_TESSERA, "");
    ancora.before(scheda);
  } else if (scheda.nextElementSibling !== ancora) {
    ancora.before(scheda);
  } else if (scheda.dataset.dmDeumFirma === firma && scheda.firstElementChild) {
    return true;
  }
  scheda.dataset.dmDeumFirma = firma;
  scheda.innerHTML = corpoMarkup();
  return true;
}

function ridisegna() {
  const scheda = doc?.getElementById?.(ANCORA);
  if (scheda) delete scheda.dataset.dmDeumFirma;
  ensureDeumidificatoriEditor();
}

/** Le macchine come stanno nella scheda adesso, lette dai campi. */
function raccogli(scheda) {
  return [...scheda.querySelectorAll("[data-dm-deum-unita]")].map((nodo, indice) => {
    const unita = { id: clean(nodo.dataset.dmDeumUnita) || `deum-${indice + 1}` };
    unita.nome = clean(nodo.querySelector('[data-dm-deum-campo="nome"]')?.value);
    unita.stanza = clean(nodo.querySelector('[data-dm-deum-campo="stanza"]')?.value);
    for (const chiave of CAMPI_DEUMIDIFICATORE)
      unita[chiave] = clean(nodo.querySelector(`[data-dm-deum-campo="${chiave}"]`)?.value);
    return unita;
  });
}

function onClick(evento) {
  const scheda = doc?.getElementById?.(ANCORA);
  if (!scheda || !scheda.contains(evento.target)) return;

  const lente = evento.target.closest("[data-dm-deum-pick]");
  if (lente) {
    evento.preventDefault();
    const casella = doc.getElementById(lente.dataset.dmDeumPick);
    if (casella) root.wzPickEntity?.(casella);
    return;
  }

  const togli = evento.target.closest("[data-dm-deum-togli]");
  if (togli) {
    evento.preventDefault();
    const id = clean(togli.dataset.dmDeumTogli);
    salva(raccogli(scheda).filter((unita) => unita.id !== id));
    ridisegna();
    return;
  }

  if (evento.target.closest("[data-dm-deum-aggiungi]")) {
    evento.preventDefault();
    const elenco = raccogli(scheda);
    if (elenco.length >= MASSIMO_DEUMIDIFICATORI) return;
    /* Il contatore, e non la lunghezza: togliendo il secondo di tre e
     * aggiungendone un altro, la lunghezza darebbe un id gia' usato. */
    state.contatore += 1;
    salva([...elenco, { id: `deum-${Date.now()}-${state.contatore}`, nome: "" }]);
    ridisegna();
    return;
  }

  if (evento.target.closest("[data-dm-deum-salva]")) {
    evento.preventDefault();
    /* Le caselle vuote si riempiono con quello che l'integrazione ha messo
     * accanto all'humidifier: chi configura sceglie una cosa sola. */
    const stati = allStates();
    salva(raccogli(scheda).map((unita) => completaDeumidificatore(unita, stati)));
    try {
      root.edToast?.(t("Deumidificatori salvati", "Dehumidifiers saved"));
    } catch (_error) {}
    ridisegna();
  }
}

export function installDeumidificatoriEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyle(
    "dm-deum-editor-style",
    `
    #ed-body #${ANCORA}{margin-top:14px}
    #ed-body .dm-deum-ed-unita{display:block}
    #ed-body .dm-deum-ed-testa{display:flex;align-items:center;gap:8px;margin:0 0 8px}
    #ed-body .dm-deum-ed-testa input{flex:1 1 auto;min-width:0;margin:0}
    #ed-body .dm-deum-ed-fascia{display:grid;gap:6px;margin:8px 0 10px;padding:9px 10px;border:1px solid var(--divider-color,#dbe4ee);border-radius:13px}
    #ed-body .dm-deum-ed-fascia-lbl{font-size:10.5px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;color:var(--text-dim,#64748b)}
    #ed-body .dm-deum-ed-lista > .ed-btn-add{width:100%;margin:6px 0}
    `,
  );
  doc.addEventListener("click", onClick);
  onEditorRedraw("__dmDeumidificatoriEditor", () =>
    root.queueMicrotask?.(ensureDeumidificatoriEditor),
  );
  for (const evento of [
    "dashboardmodern:editor-rendered",
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
  ])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(ensureDeumidificatoriEditor));
  ensureDeumidificatoriEditor();
  return true;
}
