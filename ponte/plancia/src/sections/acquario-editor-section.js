/* La scheda dell'acquario in configurazione (#127).
 *
 * È la scheda dichiarata di tutte le altre — `scheda-dichiarata-section.js` —
 * e qui c'è solo quello che dell'acquario è davvero proprio:
 *
 *   · in cima la vasca, che vale per tutte le righe: come si chiama, quanti
 *     litri, ogni quanti giorni si cambia l'acqua e quando è stata cambiata
 *     l'ultima volta — come la soglia delle Batterie, che vale per tutte;
 *   · in ogni riga cosa è, come nell'Acqua e gas: una misura con la sua
 *     forcella, il livello con la soglia del rabbocco, o un comando — e dentro
 *     la riga solo le caselle di quel genere.
 */
import {
  CAMBIO_OGNI_GIORNI,
  CAMPI_IN_PIU,
  CHIAVE_ACQUARIO,
  GENERI,
  MISURE,
  acquarioDiCasa,
  comeStaLAcquario,
  conIlCambio,
  conLaRiga,
  disegnoDelGenere,
  forcellaDiSerie,
  genereDelSensore,
  genereValido,
  righeDaImportare,
  righeDichiarate,
} from "../core/l-acquario-di-casa.js";
import { ACQUARIO_TAB, renderAcquario } from "./acquario-section.js";
import { costruisciSchedaDichiarata } from "./scheda-dichiarata-section.js";
import { allStates, clean, esc, formatNumber, readJson, t, writeJsonIfChanged } from "./shared.js";
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

export const ACQUARIO_EDITOR_TAB = ACQUARIO_TAB;

/* I disegni: la vasca per prima, poi quelli di ogni genere. */
export const DISEGNI_DELL_ACQUARIO = Object.freeze([
  "aquarium",
  "thermometer",
  "gauge",
  "water",
  "lights",
  "pump",
  "flame",
  "toggle",
]);

/* I numeri di ogni genere: quelli che la riga tiene, gli altri se ne vanno
 * quando il genere cambia. */
const CAMPI_DEL_GENERE = Object.freeze({
  temperatura: ["minimo", "massimo"],
  ph: ["minimo", "massimo"],
  misura: ["minimo", "massimo"],
  livello: ["soglia"],
  luci: [],
  filtro: [],
  riscaldatore: [],
  comando: [],
});

const NUMERI = Object.freeze(["minimo", "massimo", "soglia"]);

function nomiDeiGeneri() {
  return {
    temperatura: t("Temperatura dell'acqua", "Water temperature"),
    ph: "pH",
    misura: t("Altro valore dell'acqua", "Other water reading"),
    livello: t("Livello dell'acqua", "Water level"),
    luci: t("Luci", "Lights"),
    filtro: t("Filtro o pompa", "Filter or pump"),
    riscaldatore: t("Riscaldatore", "Heater"),
    comando: t("Altro comando", "Other switch"),
  };
}

/* Il genere di una riga: quello scritto, o quello che dice l'entità. */
function genereDellaRiga(riga, states = allStates()) {
  return (
    genereValido(riga?.genere) ||
    genereDelSensore(riga?.entity, states?.[riga?.entity]) ||
    "temperatura"
  );
}

/* ── la vasca, in cima ────────────────────────────────────────────────── */

function configurazione() {
  return readJson(CHIAVE_ACQUARIO, {}) || {};
}

/* La data del cambio, per la casella del calendario: il giorno di casa, non
 * quello di Greenwich. */
function giornoDelCambio(config) {
  const quando = Date.parse(clean(config?.cambio));
  if (!Number.isFinite(quando)) return "";
  const giorno = new Date(quando);
  const due = (n) => String(n).padStart(2, "0");
  return `${giorno.getFullYear()}-${due(giorno.getMonth() + 1)}-${due(giorno.getDate())}`;
}

function salvaLaVasca(campo, valore) {
  const prima = configurazione();
  if (campo === "cambio") {
    /* A mezzogiorno del giorno scelto: lontano dalla mezzanotte, così nessun
     * fuso orario lo sposta a ieri. */
    const [anno, mese, giorno] = clean(valore).split("-").map(Number);
    const quando =
      anno && mese && giorno ? new Date(anno, mese - 1, giorno, 12, 0, 0).getTime() : "";
    writeJsonIfChanged(CHIAVE_ACQUARIO, conIlCambio(prima, quando));
  } else writeJsonIfChanged(CHIAVE_ACQUARIO, { ...prima, [campo]: clean(valore) });
  renderAcquario();
}

function campoDellaVasca(campo, etichetta, valore, esempio, { tipo = "text", aiuto = "" } = {}) {
  return `<label class="ed-slot dm-dich-campo"><span class="ed-slot-lbl">${esc(etichetta)}</span>
    <span class="ed-form-row"><input class="ed-input${tipo === "text" ? "" : " mono"}" type="${esc(tipo)}"
      data-dm-acq-vasca="${esc(campo)}" value="${esc(valore)}" placeholder="${esc(esempio)}"
      ${tipo === "text" ? "" : 'inputmode="numeric"'} autocomplete="off" spellcheck="false"></span>
    ${aiuto ? `<small>${esc(aiuto)}</small>` : ""}</label>`;
}

function vascaMarkup() {
  const config = configurazione();
  return `${campoDellaVasca("vasca", t("Nome della vasca", "Tank name"), clean(config.vasca), t("Vasca tropicale", "Tropical tank"))}
    ${campoDellaVasca("litri", t("Litri", "Litres"), clean(config.litri), "240")}
    ${campoDellaVasca(
      "ogni",
      t("Cambio d'acqua ogni (giorni)", "Water change every (days)"),
      clean(config.ogni),
      String(CAMBIO_OGNI_GIORNI),
      {
        tipo: "number",
        aiuto: t(
          "Dopo questi giorni la pagina e la tessera in Home dicono che il cambio d'acqua è da fare.",
          "After this many days the page and the Home tile say the water change is due.",
        ),
      },
    )}
    ${campoDellaVasca(
      "cambio",
      t("Ultimo cambio d'acqua", "Last water change"),
      giornoDelCambio(config),
      "",
      {
        tipo: "date",
        aiuto: t(
          "Si segna dalla pagina con «Fatto oggi»; qui si corregge.",
          "It is recorded from the page with “Done today”; here you can correct it.",
        ),
      },
    )}`;
}

/* ── i campi della riga ───────────────────────────────────────────────── */

function campoNumerico(nome, indice, riga, etichetta, esempio, aiuto = "") {
  return `<label class="ed-slot dm-dich-campo"><span class="ed-slot-lbl">${esc(etichetta)}</span>
    <span class="ed-form-row"><input class="ed-input mono" data-dm-dich-campo="${esc(nome)}"
      data-dm-dich-riga="${indice}" value="${esc(clean(riga[nome]))}" placeholder="${esc(esempio)}"
      inputmode="decimal" autocomplete="off" spellcheck="false"></span>
    ${aiuto ? `<small>${esc(aiuto)}</small>` : ""}</label>`;
}

function campiDellaRiga(riga, indice) {
  const states = allStates();
  const genere = genereDellaRiga(riga, states);
  const nomi = nomiDeiGeneri();
  const scelta = `<label class="ed-slot dm-dich-campo"><span class="ed-slot-lbl">${esc(t("Cosa è", "What it is"))}</span>
    <span class="ed-form-row"><select class="ed-input" data-dm-acq-genere="${indice}">${GENERI.map(
      (voce) =>
        `<option value="${esc(voce)}"${voce === genere ? " selected" : ""}>${esc(nomi[voce])}</option>`,
    ).join("")}</select></span>
    <small>${esc(
      t(
        "Le misure si guardano sulla loro forcella, il livello conta i giorni al rabbocco, e i comandi diventano mattonelle che si accendono e si spengono.",
        "Readings are shown on their ideal range, the level counts the days to the top-up, and switches become tiles that turn on and off.",
      ),
    )}</small></label>`;
  if (MISURE.includes(genere)) {
    const unita = clean(states?.[riga?.entity]?.attributes?.unit_of_measurement);
    const serie = forcellaDiSerie(genere, unita);
    const esempio = (quale) => (serie ? formatNumber(serie[quale], 1) : "");
    return (
      scelta +
      campoNumerico("minimo", indice, riga, t("Ideale da", "Ideal from"), esempio("minimo")) +
      campoNumerico(
        "massimo",
        indice,
        riga,
        t("Ideale fino a", "Ideal up to"),
        esempio("massimo"),
        t(
          "Nella stessa unità del sensore. Vuote, la temperatura sta fra 24 e 27 gradi e il pH fra 6,5 e 7,5: i numeri di una vasca tropicale d'acqua dolce.",
          "In the same unit as the sensor. Left empty, temperature stays between 24 and 27 degrees and pH between 6.5 and 7.5: the numbers of a tropical freshwater tank.",
        ),
      )
    );
  }
  if (genere === "livello" && !clean(riga?.entity).startsWith("binary_sensor."))
    return (
      scelta +
      campoNumerico(
        "soglia",
        indice,
        riga,
        t("Da rabboccare sotto", "Top up below"),
        "",
        t(
          "Nella stessa unità del sensore, percento o centimetri: sotto questo livello va rabboccata, e la pagina conta i giorni che mancano. Un galleggiante non ne ha bisogno.",
          "In the same unit as the sensor, percent or centimetres: below this level it needs topping up, and the page counts the days left. A float switch does not need it.",
        ),
      )
    );
  return scelta;
}

/* Quello che la riga aperta ha nelle sue caselle adesso: il genere dalla
 * tendina, i numeri di quel genere, e nient'altro. */
function conICampiDellaRiga(bozza, body, indice) {
  const tendina = body.querySelector(`[data-dm-acq-genere="${indice}"]`);
  const genere = genereValido(tendina?.value) || genereDellaRiga(bozza);
  const fuori = { ...bozza, genere };
  for (const nome of NUMERI) {
    const casella = body.querySelector(
      `[data-dm-dich-campo="${nome}"][data-dm-dich-riga="${indice}"]`,
    );
    if (casella) fuori[nome] = clean(casella.value);
    if (!CAMPI_DEL_GENERE[genere].includes(nome)) delete fuori[nome];
  }
  return fuori;
}

/* ── la scheda ────────────────────────────────────────────────────────── */

const scheda = costruisciSchedaDichiarata({
  nome: "acquario",
  chiave: CHIAVE_ACQUARIO,
  tab: ACQUARIO_EDITOR_TAB,
  disegni: DISEGNI_DELL_ACQUARIO,
  ripiego: "aquarium",
  ridisegnaPagina: renderAcquario,
  inPiu: CAMPI_IN_PIU,
  rigaNuova: { genere: "temperatura", icon: "thermometer" },

  campiInPiu: campiDellaRiga,
  bozzaInPiu: conICampiDellaRiga,

  parole: {
    linguetta: `🐠 ${t("Acquario", "Aquarium")}`,
    intro: t(
      "L'acquario di casa. In cima la vasca: il nome, i litri e ogni quanti giorni si cambia l'acqua. Sotto un'entità per riga: la temperatura e il pH con la loro forcella, il livello dell'acqua, le luci, il filtro e il riscaldatore.",
      "The aquarium at home. At the top, the tank: its name, the litres and how often the water is changed. Below, one entity per row: temperature and pH with their ideal range, the water level, the lights, the filter and the heater.",
    ),
    vuoto: t("Nessuna entità dell'acquario", "No aquarium entity"),
    aggiungi: t("Aggiungi entità", "Add entity"),
    nuovo: t("Entità nuova", "New entity"),
    senzaNome: t("Entità senza nome", "Unnamed entity"),
    salva: t("Salva entità", "Save entity"),
    salvato: `🐠 ${t("Entità salvata", "Entity saved")}`,
    etichettaEntita: t("Entità", "Entity"),
    segnaposto: "sensor.acquario_temperatura",
    aiutoEntita: t(
      "Il sensore o il comando dell'acquario: la temperatura, il pH, il livello, la luce, il filtro, il riscaldatore.",
      "The aquarium sensor or switch: temperature, pH, level, light, filter, heater.",
    ),
    segnapostoNome: t("Temperatura", "Temperature"),
    aiutoNome: t(
      "Come si chiama per te: è questo che si legge nella pagina.",
      "What you call it: this is what the page reads.",
    ),
    muta: t(
      "Finché non scegli l'entità questa riga non si vede: né nella pagina, né nella tessera in Home.",
      "Until you pick the entity this row is nowhere: not on the page, not on the Home tile.",
    ),
    importa: (quante) =>
      t(
        `Prendi le ${quante} entità dell'acquario che Home Assistant ha trovato`,
        `Take the ${quante} aquarium entities Home Assistant found`,
      ),
    presi: (quante) => t(`🐠 ${quante} entità aggiunte`, `🐠 ${quante} entities added`),
    notaImporta: t(
      "Li mette qui come righe, una volta sola: da lì in poi sono tue — le rinomini, gli dai il disegno, e quelle che elimini non tornano più.",
      "It puts them here as rows, once: from then on they are yours — rename them, give them a drawing, and the ones you remove do not come back.",
    ),
  },

  /* La vasca sta in cima, perché vale per tutte le righe: dentro una riga
   * direbbe che è di quella entità, e non lo è. */
  inTesta: vascaMarkup,

  /* Come stanno adesso le righe scritte: la pagina e la scheda le leggono
   * dalla stessa funzione, e il giudizio è quello della pagina. */
  leggi(elenco) {
    const states = allStates();
    const letture = acquarioDiCasa(states, { righe: elenco }, (entity) =>
      nomeDaHomeAssistant(entity, states),
    );
    const come = comeStaLAcquario(letture, { config: configurazione(), adesso: Date.now() });
    const male = new Set([
      ...come.fuori.map((voce) => voce.lettura.entity),
      ...come.bassi.map((voce) => voce.lettura.entity),
    ]);
    return new Map(
      letture.map((lettura) => [lettura.entity, { ...lettura, male: male.has(lettura.entity) }]),
    );
  },

  daImportare(config) {
    const states = allStates();
    return righeDaImportare(states, config, (entity) => nomeDaHomeAssistant(entity, states));
  },

  statoDellaRiga: (letta) => (letta?.muto ? "muta" : letta?.male ? "male" : "bene"),
  didascalia: (letta) => (letta ? nomiDeiGeneri()[letta.genere] || "" : ""),
  accanto: (letta) => {
    if (!letta || letta.muto) return "—";
    if (letta.acceso !== undefined && letta.acceso !== null)
      return letta.acceso ? t("acceso", "on") : t("spento", "off");
    if (letta.binario)
      return letta.basso ? t("da rabboccare", "to top up") : t("nella norma", "in range");
    if (letta.valore === null || letta.valore === undefined) return "—";
    return `${formatNumber(letta.valore, Math.abs(letta.valore) < 100 ? 1 : 0)}${letta.unita ? ` ${letta.unita}` : ""}`;
  },

  /* Le caselle della vasca si salvano da sé, mentre si scrivono: non sono di
   * una riga, e aspettare il 💾 di una riga vorrebbe dire un tasto che salva
   * quello che non ha davanti. Cambiare il genere di una riga cambia le sue
   * caselle: si salva e si ridisegna, come nell'Acqua e gas, e il disegno di
   * serie segue il genere se era quello di serie del genere di prima. */
  inPiuAllInstallazione(documento, { ridisegna, configurazione: config, salva }) {
    documento.addEventListener("change", (evento) => {
      const vasca = evento.target?.closest?.("[data-dm-acq-vasca]");
      if (vasca) {
        salvaLaVasca(clean(vasca.dataset.dmAcqVasca), vasca.value);
        return;
      }
      const tendina = evento.target?.closest?.("[data-dm-acq-genere]");
      if (!tendina) return;
      const body = documento.getElementById("ed-body");
      if (!body?.contains(tendina)) return;
      const indice = Number(tendina.dataset.dmAcqGenere);
      if (!Number.isInteger(indice)) return;
      const prima = (righeDichiarate(config(), CAMPI_IN_PIU) || [])[indice] || {};
      const campo = (nome) =>
        body.querySelector(`[data-dm-dich-campo="${nome}"][data-dm-dich-riga="${indice}"]`)?.value;
      const bozza = {
        ...prima,
        entity: clean(campo("entity") ?? prima.entity),
        name: clean(campo("name") ?? prima.name),
        icon: clean(campo("icon") ?? prima.icon),
      };
      const riga = conICampiDellaRiga(bozza, body, indice);
      if (!bozza.icon || bozza.icon === disegnoDelGenere(genereDellaRiga(prima)))
        riga.icon = disegnoDelGenere(riga.genere);
      salva(conLaRiga(config(), indice, riga, CAMPI_IN_PIU));
      ridisegna();
    });
  },
});

/* I tre nomi con cui il resto della plancia chiama questa scheda. Sono
 * funzioni dichiarate: il pacchetto si prova cercando `function install...`. */
export function ensureAcquarioEditor() {
  return scheda.disegnaScheda();
}
export function ensureAcquarioEditorTab() {
  return scheda.disegnaLinguetta();
}
export function installAcquarioEditor() {
  return scheda.installa();
}

installAcquarioEditor();
