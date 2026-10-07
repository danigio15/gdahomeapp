/* La scheda delle batterie di accumulo in configurazione (#117).
 *
 * È la scheda dichiarata di tutte le altre — `scheda-dichiarata-section.js` —
 * con una differenza di misura: una riga qui non è un'entità, è un PACCO. La
 * sua entità è lo stato di carica, che è la cosa senza cui un pacco non si
 * racconta; dentro la riga aperta ci sono le altre, una casella per entità:
 * salute, tensione, corrente, potenza, le due temperature, i cicli, la
 * capacità, l'energia residua, il delta se il BMS lo pubblica, le celle — e la
 * soglia oltre cui il pacco è da bilanciare.
 *
 * Le celle sono tante, ventiquattro su un JK grande, e sceglierle una alla
 * volta dalla lente sarebbe il modo di non sceglierle mai. Stanno in una
 * casella sola, una per riga, e si possono incollare tutte insieme; il tasto
 * «Trova le celle» le prende da Home Assistant col prefisso delle altre
 * entità del pacco.
 *
 * Alla prima apertura la scheda si riempie da sola dei pacchi che il
 * rilevamento riconosce — JK, JBD, Daly, raggruppati per prefisso — e da lì
 * in poi sono righe come le altre: si rinominano, si correggono, si tolgono.
 */
import {
  CAMPI_DEL_PACCO,
  CAMPI_IN_PIU,
  CHIAVE_ACCUMULO,
  SOGLIA_DELTA_MV,
  TIPI,
  accumuloDiCasa,
  celleDaTesto,
  celleDelPacco,
  celleDellaRiga,
  pacchiDaImportare,
  tipoValido,
} from "../core/l-accumulo-di-casa.js";
import { ACCUMULO_TAB, tipoInParole } from "./accumulo-section.js";
import { renderAccumulo } from "./accumulo-in-energia-section.js";
import { costruisciSchedaDichiarata } from "./scheda-dichiarata-section.js";
import { allStates, clean, esc, formatNumber, root, t, senzaCadere } from "./shared.js";
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

export const ACCUMULO_EDITOR_TAB = ACCUMULO_TAB;

/* I disegni: la batteria per prima, poi quelli dell'energia. */
export const DISEGNI_DELL_ACCUMULO = Object.freeze(["battery", "power", "solar", "gauge"]);

/* Le caselle delle entità del pacco, nell'ordine in cui si leggono le
 * caselle della pagina. */
function nomiDeiCampi() {
  return {
    soh: [t("Stato di salute (SoH)", "State of health (SoH)"), "sensor.jk_bms_state_of_health"],
    tensione: [t("Tensione", "Voltage"), "sensor.jk_bms_total_voltage"],
    corrente: [t("Corrente", "Current"), "sensor.jk_bms_current"],
    potenza: [t("Potenza", "Power"), "sensor.jk_bms_power"],
    temperatura: [t("Temperatura", "Temperature"), "sensor.jk_bms_temperature_sensor_1"],
    mos: [t("Temperatura MOS", "MOS temperature"), "sensor.jk_bms_power_tube_temperature"],
    cicli: [t("Cicli", "Cycles"), "sensor.jk_bms_charging_cycles"],
    capacita: [t("Capacità", "Capacity"), "sensor.jk_bms_total_battery_capacity_setting"],
    energia: [t("Energia residua", "Remaining energy"), "sensor.jk_bms_capacity_remaining"],
    delta: [t("Delta fra le celle", "Cell voltage delta"), "sensor.jk_bms_delta_cell_voltage"],
  };
}

function aiutoDelCampo(campo) {
  if (campo === "capacita")
    return t(
      "Un'entità, o il numero scritto sull'etichetta del pacco con la sua unità. Con la capacità di ogni pacco la carica di tutto l'accumulo si pesa sull'energia, e la pagina dice fra quanto è piena o vuota.",
      "An entity, or the number printed on the pack label with its unit. With every pack's capacity the overall charge is weighted by energy, and the page says when it will be full or empty.",
    );
  if (campo === "energia")
    return t(
      "In Ah, Wh o kWh. Vuota, si ricava dalla carica e dalla capacità.",
      "In Ah, Wh or kWh. Left empty, it is worked out from the charge and the capacity.",
    );
  if (campo === "delta")
    return t(
      "Facoltativo: se il BMS non lo pubblica, lo squilibrio si calcola dalle celle.",
      "Optional: if the BMS does not publish it, the imbalance is worked out from the cells.",
    );
  if (campo === "corrente" || campo === "potenza")
    return t(
      "Positiva in carica e negativa in scarica, come la scrivono JK, JBD e Daly.",
      "Positive when charging and negative when discharging, as JK, JBD and Daly write it.",
    );
  return "";
}

function idDelCampo(indice, campo) {
  return `dm-dich-accumulo-${indice}-${campo}`;
}

function campoEntita(campo, indice, riga, etichetta, esempio, aiuto = "") {
  const id = idDelCampo(indice, campo);
  return `<label class="ed-slot dm-dich-campo"><span class="ed-slot-lbl">${esc(etichetta)}</span>
    <span class="ed-form-row"><input id="${id}" class="ed-input mono" data-dm-dich-campo="${esc(campo)}"
      data-dm-dich-riga="${indice}" value="${esc(clean(riga?.[campo]))}" placeholder="${esc(esempio)}"
      autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker"
      data-dm-dich-pick="${id}" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>
    ${aiuto ? `<small>${esc(aiuto)}</small>` : ""}</label>`;
}

function campiDellaRiga(riga, indice) {
  const nomi = nomiDeiCampi();
  const tipo = tipoValido(riga?.tipo) || "altro";
  const scelta = `<label class="ed-slot dm-dich-campo"><span class="ed-slot-lbl">${esc(t("Tipo di BMS", "BMS type"))}</span>
    <span class="ed-form-row"><select class="ed-input" data-dm-dich-campo="tipo" data-dm-dich-riga="${indice}">${TIPI.map(
      (voce) =>
        `<option value="${esc(voce)}"${voce === tipo ? " selected" : ""}>${esc(voce === "altro" ? t("Altro BMS", "Other BMS") : tipoInParole(voce))}</option>`,
    ).join("")}</select></span></label>`;
  const entita = CAMPI_DEL_PACCO.map((campo) => {
    const [etichetta, esempio] = nomi[campo];
    let markup = campoEntita(campo, indice, riga, etichetta, esempio, aiutoDelCampo(campo));
    if (campo === "capacita")
      markup += `<label class="ed-slot dm-dich-campo"><span class="ed-slot-lbl">${esc(t("Unità della capacità scritta a mano", "Unit of a hand-written capacity"))}</span>
        <span class="ed-form-row"><select class="ed-input" data-dm-dich-campo="unita" data-dm-dich-riga="${indice}">${[
          "Ah",
          "kWh",
        ]
          .map(
            (unita) =>
              `<option value="${unita}"${unita === (clean(riga?.unita) || "Ah") ? " selected" : ""}>${unita}</option>`,
          )
          .join("")}</select></span></label>`;
    return markup;
  }).join("");
  const celle = celleDellaRiga(riga);
  const celleMarkup = `<label class="ed-slot dm-dich-campo"><span class="ed-slot-lbl">${esc(
    celle.length ? t(`Celle (${celle.length})`, `Cells (${celle.length})`) : t("Celle", "Cells"),
  )}</span>
    <textarea class="ed-input mono dm-accu-ed-celle" rows="${Math.min(8, Math.max(3, celle.length))}"
      data-dm-dich-campo="celle" data-dm-dich-riga="${indice}" spellcheck="false"
      placeholder="sensor.jk_bms_cell_voltage_1&#10;sensor.jk_bms_cell_voltage_2">${esc(celle.join("\n"))}</textarea>
    <span class="ed-form-row"><button type="button" class="ed-btn-import dm-accu-ed-trova" data-dm-accu-trova="${indice}">🔍 ${esc(t("Trova le celle", "Find the cells"))}</button></span>
    <small>${esc(
      t(
        "Una tensione di cella per riga, nell'ordine delle celle. Si possono incollare tutte insieme, anche separate da virgole; «Trova le celle» le prende da Home Assistant col prefisso delle altre entità del pacco.",
        "One cell voltage per line, in cell order. You can paste them all at once, commas work too; “Find the cells” takes them from Home Assistant using the prefix of the pack's other entities.",
      ),
    )}</small></label>`;
  const soglia = `<label class="ed-slot dm-dich-campo"><span class="ed-slot-lbl">${esc(t("Da bilanciare oltre (mV)", "Needs balancing above (mV)"))}</span>
    <span class="ed-form-row"><input class="ed-input mono" data-dm-dich-campo="soglia" data-dm-dich-riga="${indice}"
      value="${esc(clean(riga?.soglia))}" placeholder="${SOGLIA_DELTA_MV}" inputmode="numeric" autocomplete="off"></span>
    <small>${esc(
      t(
        "Quando la cella più alta e la più bassa sono più lontane di così, il pacco dice «Da bilanciare» e la tessera in Home chiede attenzione.",
        "When the highest and lowest cells are further apart than this, the pack says “Needs balancing” and the Home tile asks for attention.",
      ),
    )}</small></label>`;
  return scelta + entita + celleMarkup + soglia;
}

/* Quello che la riga aperta ha nelle sue caselle adesso. */
function conICampiDellaRiga(bozza, body, indice) {
  const casella = (campo) =>
    body.querySelector(`[data-dm-dich-campo="${campo}"][data-dm-dich-riga="${indice}"]`);
  const fuori = { ...bozza };
  for (const campo of ["tipo", ...CAMPI_DEL_PACCO, "unita", "soglia"]) {
    const nodo = casella(campo);
    if (!nodo) continue;
    const valore = clean(nodo.value);
    if (valore) fuori[campo] = valore;
    else delete fuori[campo];
  }
  const celle = casella("celle");
  if (celle) {
    const elenco = celleDaTesto(celle.value);
    if (elenco.length) fuori.celle = elenco;
    else delete fuori.celle;
  }
  if (!tipoValido(fuori.tipo)) fuori.tipo = "altro";
  return fuori;
}

/* ── la scheda ────────────────────────────────────────────────────────── */

const scheda = costruisciSchedaDichiarata({
  nome: "accumulo",
  chiave: CHIAVE_ACCUMULO,
  tab: ACCUMULO_EDITOR_TAB,
  disegni: DISEGNI_DELL_ACCUMULO,
  ripiego: "battery",
  ridisegnaPagina: renderAccumulo,
  inPiu: CAMPI_IN_PIU,
  rigaNuova: { tipo: "jk", icon: "battery" },

  campiInPiu: campiDellaRiga,
  bozzaInPiu: conICampiDellaRiga,

  parole: {
    /* «Batteria di accumulo», e non «Batterie» come la linguetta in Energia:
     * nel Config c'era già una scheda «Batterie», quella delle pile dei
     * sensori sotto la Casa, e due schede con lo stesso nome si scambiano. */
    linguetta: t("Batteria di accumulo", "Storage battery"),
    intro: t(
      "I pacchi dell'accumulo e i loro BMS: si vedono nella linguetta Batterie di Energia e nella tessera Accumulo in Home. Un pacco per riga: la sua entità è lo stato di carica, e dentro ci sono le altre — salute, tensioni, correnti, temperature, cicli, capacità e le celle una per una.",
      "The storage packs and their BMS: they show in the Batteries tab of Energy and on the Battery storage tile in Home. One pack per row: its entity is the state of charge, and inside are the others — health, voltages, currents, temperatures, cycles, capacity and every single cell.",
    ),
    vuoto: t("Nessun pacco di batterie", "No battery pack"),
    aggiungi: t("Aggiungi pacco", "Add pack"),
    nuovo: t("Pacco nuovo", "New pack"),
    senzaNome: t("Pacco senza nome", "Unnamed pack"),
    salva: t("Salva pacco", "Save pack"),
    salvato: t("Pacco salvato", "Pack saved"),
    etichettaEntita: t("Stato di carica (SoC)", "State of charge (SoC)"),
    segnaposto: "sensor.jk_bms_state_of_charge",
    aiutoEntita: t(
      "Il percento di carica del pacco: è la riga senza cui il pacco non si vede.",
      "The pack's charge percentage: without it the pack does not show.",
    ),
    segnapostoNome: t("Pacco 1", "Pack 1"),
    aiutoNome: t(
      "Come si chiama per te: è questo che si legge nella pagina.",
      "What you call it: this is what the page reads.",
    ),
    muta: t(
      "Finché non scegli lo stato di carica questo pacco non si vede: né in Energia, né nella tessera in Home.",
      "Until you pick the state of charge this pack is nowhere: not in Energy, not on the Home tile.",
    ),
    importa: (quanti) =>
      t(
        `Prendi i ${quanti} pacchi che Home Assistant ha trovato`,
        `Take the ${quanti} packs Home Assistant found`,
      ),
    presi: (quanti) => t(`${quanti} pacchi aggiunti`, `${quanti} packs added`),
    notaImporta: t(
      "Riconosce i BMS JK, JBD e Daly dai nomi delle loro entità e li raggruppa per prefisso. Li mette qui come righe, una volta sola: da lì in poi sono tuoi.",
      "It recognises JK, JBD and Daly BMS from their entity names and groups them by prefix. It puts them here as rows, once: from then on they are yours.",
    ),
  },

  /* Come stanno adesso i pacchi scritti: la pagina e la scheda li leggono
   * dalla stessa funzione. */
  leggi(elenco) {
    const states = allStates();
    const letti = accumuloDiCasa(states, { righe: elenco }, (entity) =>
      nomeDaHomeAssistant(entity, states),
    );
    return new Map(letti.map((pacco) => [pacco.entity, pacco]));
  },

  daImportare(config) {
    const states = allStates();
    return pacchiDaImportare(states, config, (entity) => nomeDaHomeAssistant(entity, states));
  },

  statoDellaRiga: (letto) => (letto?.muto ? "muta" : letto?.sbilanciato ? "male" : "bene"),
  didascalia: (letto) =>
    letto
      ? [
          tipoInParole(letto.tipo),
          letto.celle.length ? t(`${letto.celle.length} celle`, `${letto.celle.length} cells`) : "",
          letto.delta !== null ? `Δ ${formatNumber(letto.delta, 0)} mV` : "",
        ]
          .filter(Boolean)
          .join(" · ")
      : "",
  accanto: (letto) => (!letto || letto.muto ? "—" : `${formatNumber(letto.soc, 0)}%`),

  /* «Trova le celle» riempie la casella con quello che Home Assistant ha, col
   * prefisso delle entità già scritte nella riga — anche quelle battute
   * adesso e non ancora salvate. Non salva: si vede cosa ha trovato, e si
   * salva col tasto del pacco. */
  inPiuAllInstallazione(documento) {
    documento.addEventListener("click", (evento) => {
      const tasto = evento.target?.closest?.("[data-dm-accu-trova]");
      if (!tasto) return;
      const body = documento.getElementById("ed-body");
      if (!body?.contains(tasto)) return;
      evento.preventDefault();
      const indice = Number(tasto.dataset.dmAccuTrova);
      if (!Number.isInteger(indice)) return;
      const valore = (campo) =>
        clean(
          body.querySelector(`[data-dm-dich-campo="${campo}"][data-dm-dich-riga="${indice}"]`)
            ?.value,
        );
      const bozza = { entity: valore("entity") };
      for (const campo of CAMPI_DEL_PACCO) bozza[campo] = valore(campo);
      const trovate = celleDelPacco(allStates(), bozza);
      const casella = body.querySelector(
        `[data-dm-dich-campo="celle"][data-dm-dich-riga="${indice}"]`,
      );
      if (!casella) return;
      if (!trovate.length) {
        root.edToast?.(t("Nessuna cella trovata", "No cells found"));
        return;
      }
      casella.value = trovate.join("\n");
      casella.rows = Math.min(8, Math.max(3, trovate.length));
      root.edToast?.(t(`${trovate.length} celle trovate`, `${trovate.length} cells found`));
    });
  },
});

/* I tre nomi con cui il resto della plancia chiama questa scheda. Sono
 * funzioni dichiarate: il pacchetto si prova cercando `function install...`. */
export function ensureAccumuloEditor() {
  return scheda.disegnaScheda();
}
export function ensureAccumuloEditorTab() {
  return scheda.disegnaLinguetta();
}
export function installAccumuloEditor() {
  return scheda.installa();
}

senzaCadere(installAccumuloEditor);
