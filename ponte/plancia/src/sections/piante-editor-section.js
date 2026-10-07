/* La scheda delle piante in configurazione (#159).
 *
 * È la scheda dichiarata di tutte le altre — `scheda-dichiarata-section.js` —
 * e qui c'è solo quello che delle piante è proprio: la riga è il sensore
 * dell'umidità della terra, e dentro ci stanno la sua temperatura, la
 * forcella in cui la terra sta bene, e se la pianta sta all'aperto.
 *
 * «All'aperto» è una spunta per pianta e non una regola della casa: il basilico
 * sul balcone e il ficus in salotto stanno nella stessa casa, e la pioggia ne
 * bagna uno solo. È spenta di serie, perché aspettare una pioggia che non
 * arriva mai in salotto vorrebbe dire lasciare il ficus a secco.
 */
import {
  CAMPI_IN_PIU,
  CHIAVE_PIANTE,
  TERRA_ASCIUTTA,
  TERRA_ZUPPA,
  pianteDaImportare,
  pianteDiCasa,
  temperaturaAccanto,
} from "../core/le-piante-di-casa.js";
import { PIANTE_TAB, renderPiante } from "./piante-section.js";
import { costruisciSchedaDichiarata } from "./scheda-dichiarata-section.js";
import { allStates, clean, esc, t, senzaCadere } from "./shared.js";
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

export const PIANTE_EDITOR_TAB = PIANTE_TAB;

/* I disegni: la pianta in vaso per prima, poi i posti dove una pianta sta. */
export const DISEGNI_DELLA_PIANTA = Object.freeze([
  "plant",
  "flower",
  "room-garden",
  "room-balcony",
  "room-terrace",
  "irrigation",
  "room-living",
  "home",
]);

function campoNumerico(nome, indice, riga, etichetta, esempio, aiuto = "") {
  return `<label class="ed-slot dm-dich-campo"><span class="ed-slot-lbl">${esc(etichetta)}</span>
    <span class="ed-form-row"><input class="ed-input mono" data-dm-dich-campo="${esc(nome)}"
      data-dm-dich-riga="${indice}" value="${esc(clean(riga[nome]))}" placeholder="${esc(esempio)}"
      inputmode="decimal" autocomplete="off" spellcheck="false"></span>
    ${aiuto ? `<small>${esc(aiuto)}</small>` : ""}</label>`;
}

function campiDellaPianta(riga, indice) {
  const id = `dm-pian-temperatura-${indice}`;
  const proposta = riga.entity ? temperaturaAccanto(riga.entity, allStates()) : "";
  const fuori = riga.fuori === true || /^(true|on|1)$/i.test(clean(riga.fuori));
  return `<label class="ed-slot dm-dich-campo"><span class="ed-slot-lbl">${esc(
    t("Temperatura della terra", "Soil temperature"),
  )}</span>
      <span class="ed-form-row"><input id="${esc(id)}" class="ed-input mono"
        data-dm-dich-campo="temperatura" data-dm-dich-riga="${indice}"
        value="${esc(clean(riga.temperatura))}" placeholder="${esc(proposta || "sensor.soil_temperature_1")}"
        autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker"
        data-dm-dich-pick="${esc(id)}" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>
      <small>${esc(
        t(
          "Facoltativa: il sensore della temperatura che sta nello stesso vaso. Lasciala vuota se il tuo misura solo l'umidità.",
          "Optional: the temperature sensor in the same pot. Leave it empty if yours only measures moisture.",
        ),
      )}</small></label>
    ${campoNumerico(
      "minimo",
      indice,
      riga,
      t("Da innaffiare sotto il (%)", "Needs water below (%)"),
      String(TERRA_ASCIUTTA),
      t(
        "Sotto questa umidità la terra è asciutta e la pianta entra fra quelle da innaffiare.",
        "Below this moisture the soil is dry and the plant joins those that need water.",
      ),
    )}
    ${campoNumerico(
      "massimo",
      indice,
      riga,
      t("Troppa acqua sopra il (%)", "Too wet above (%)"),
      String(TERRA_ZUPPA),
    )}
    <label class="ed-slot dm-pian-fuori"><span class="ed-slot-lbl">${esc(
      t("All'aperto: se sta per piovere, aspetta", "Outdoors: if rain is coming, wait"),
    )}</span>
      <span class="ed-form-row dm-solo-lettura-riga"><input type="checkbox" data-dm-dich-campo="fuori"
        data-dm-dich-riga="${indice}"${fuori ? " checked" : ""}><small>${esc(
          t(
            "Quando la terra è asciutta ma il meteo di casa prevede pioggia nelle prossime ore, la pianta aspetta invece di chiedere acqua. Solo per chi la pioggia la prende davvero.",
            "When the soil is dry but the home weather forecasts rain in the next hours, the plant waits instead of asking for water. Only for those the rain really reaches.",
          ),
        )}</small></span></label>`;
}

/* Quello che la riga aperta ha nelle sue caselle adesso. */
function conICampiDellaPianta(bozza, body, indice) {
  const casella = (nome) =>
    body.querySelector(`[data-dm-dich-campo="${nome}"][data-dm-dich-riga="${indice}"]`);
  const fuori = { ...bozza };
  for (const nome of ["temperatura", "minimo", "massimo"]) {
    const campo = casella(nome);
    if (campo) fuori[nome] = clean(campo.value);
  }
  const spunta = casella("fuori");
  if (spunta) fuori.fuori = Boolean(spunta.checked);
  return fuori;
}

/* ── la scheda ────────────────────────────────────────────────────────── */

const scheda = costruisciSchedaDichiarata({
  nome: "piante",
  chiave: CHIAVE_PIANTE,
  tab: PIANTE_EDITOR_TAB,
  disegni: DISEGNI_DELLA_PIANTA,
  ripiego: "plant",
  ridisegnaPagina: renderPiante,
  inPiu: CAMPI_IN_PIU,
  rigaNuova: { icon: "plant" },

  campiInPiu: campiDellaPianta,
  bozzaInPiu: conICampiDellaPianta,

  parole: {
    linguetta: `🪴 ${t("Piante", "Plant care")}`,
    intro: t(
      "Le piante di casa, una per riga: il sensore dell'umidità della terra, il nome, il disegno, e se c'è la temperatura. La pagina Piante dice quali sono da innaffiare, quali aspettano la pioggia e quando toccherà alle altre.",
      "The plants at home, one per row: the soil moisture sensor, the name, the drawing, and the temperature if there is one. The Plant care page says which need watering, which are waiting for rain and when the others will be due.",
    ),
    vuoto: t("Nessuna pianta configurata", "No plant configured"),
    aggiungi: t("Aggiungi pianta", "Add a plant"),
    nuovo: t("Pianta nuova", "New plant"),
    senzaNome: t("Pianta senza nome", "Unnamed plant"),
    salva: t("Salva pianta", "Save this plant"),
    salvato: `🪴 ${t("Pianta salvata", "Plant saved")}`,
    etichettaEntita: t("Umidità della terra", "Soil moisture"),
    segnaposto: "sensor.soil_moisture_1",
    aiutoEntita: t(
      "Il sensore piantato nella terra, in percento: Ecowitt, Tuya, Xiaomi.",
      "The sensor stuck in the soil, in percent: Ecowitt, Tuya, Xiaomi.",
    ),
    segnapostoNome: t("Ficus del salotto", "Living room ficus"),
    aiutoNome: t(
      "Come si chiama per te: è questo che si legge nella pagina.",
      "What you call it: this is what the page reads.",
    ),
    muta: t(
      "Finché non scegli l'entità questa pianta non si vede: né nella pagina, né nella tessera in Home.",
      "Until you pick the entity this plant is nowhere: not on the page, not on the Home tile.",
    ),
    importa: (quante) =>
      t(
        `Prendi i ${quante} sensori della terra che Home Assistant ha trovato`,
        `Take the ${quante} soil sensors Home Assistant found`,
      ),
    presi: (quante) => t(`🪴 ${quante} piante aggiunte`, `🪴 ${quante} plants added`),
    notaImporta: t(
      "Li mette qui come righe, una volta sola: da lì in poi sono tue — le rinomini, gli dai il disegno, e quelle che elimini non tornano più.",
      "It puts them here as rows, once: from then on they are yours — rename them, give them a drawing, and the ones you remove do not come back.",
    ),
  },

  leggi(elenco) {
    const states = allStates();
    return new Map(
      pianteDiCasa(states, { righe: elenco }, (entity) => nomeDaHomeAssistant(entity, states)).map(
        (letta) => [letta.entity, letta],
      ),
    );
  },

  daImportare(config) {
    const states = allStates();
    return pianteDaImportare(states, config, (entity) => nomeDaHomeAssistant(entity, states));
  },

  statoDellaRiga: (letta) =>
    letta?.muta ? "muta" : letta && letta.umidita < letta.minimo ? "male" : "bene",
  didascalia: (letta) => (letta?.fuori ? t("all'aperto", "outdoors") : ""),
  accanto: (letta) => (!letta || letta.muta ? "—" : `${Math.round(letta.umidita)} %`),
});

/* I tre nomi con cui il resto della plancia chiama questa scheda. Sono
 * funzioni dichiarate: il pacchetto si prova cercando `function install...`. */
export function ensurePianteEditor() {
  return scheda.disegnaScheda();
}
export function ensurePianteEditorTab() {
  return scheda.disegnaLinguetta();
}
export function installPianteEditor() {
  return scheda.installa();
}

senzaCadere(installPianteEditor);
