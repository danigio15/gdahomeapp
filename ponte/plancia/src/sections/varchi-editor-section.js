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
 * ma ESCLUDEVA, e l'escluso restava scritto sotto in «Tolti dai conti».
 *
 * Adesso è una scheda come le altre, e non «come le altre» per modo di dire:
 * la scheda è letteralmente la stessa — `scheda-dichiarata-section.js` — e qui
 * dentro c'è solo quello che dei varchi è davvero proprio. Le parole, i
 * disegni, e cosa propone il tasto d'importazione.
 */
import {
  CHIAVE_VARCHI,
  varchiConLeFinestre,
  varchiDaImportare,
  varchiDiCasa,
} from "../core/varchi-di-casa.js";
import { CHIAVE_VERSI, insiemeInvertiti } from "../core/verso-aperture.js";
import { VARCHI_TAB, renderVarchi } from "./varchi-section.js";
import { costruisciSchedaDichiarata } from "./scheda-dichiarata-section.js";
import { allStates, readJson, root, t } from "./shared.js";
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

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

const scheda = costruisciSchedaDichiarata({
  nome: "varchi",
  chiave: CHIAVE_VARCHI,
  tab: VARCHI_EDITOR_TAB,
  disegni: DISEGNI_DEL_VARCO,
  ripiego: "door",
  ridisegnaPagina: renderVarchi,

  parole: {
    linguetta: `🚪 ${t("Varchi", "Openings")}`,
    intro: t(
      "I varchi di casa: porte, finestre, portone, basculante. Ogni varco ha la sua riga — l'entità del contatto, il nome che vuoi tu, il disegno — e la pagina Varchi mostra queste, in quest'ordine: verde chiuso, rosso aperto, e in cima quanti sono aperti adesso.",
      "The openings at home: doors, windows, front door, garage door. Each opening has its own row — the contact entity, the name you want, the drawing — and the Openings page shows these, in this order: green closed, red open, and how many are open right now on top.",
    ),
    vuoto: t("Nessun varco configurato", "No opening configured"),
    aggiungi: t("Aggiungi varco", "Add opening"),
    nuovo: t("Varco nuovo", "New opening"),
    senzaNome: t("Varco senza nome", "Unnamed opening"),
    salva: t("Salva varco", "Save opening"),
    salvato: `🚪 ${t("Varco salvato", "Opening saved")}`,
    etichettaEntita: t("Entità del contatto", "Contact entity"),
    segnaposto: "binary_sensor.finestra_cucina",
    aiutoEntita: t(
      "Il sensore che dice aperto o chiuso: binary_sensor.*, oppure un cover.* se l'infisso è motorizzato.",
      "The sensor that says open or closed: binary_sensor.*, or a cover.* if it is motorised.",
    ),
    segnapostoNome: t("Finestra cucina", "Kitchen window"),
    aiutoNome: t(
      "Come si chiama per te. È questo che si legge nella pagina, non «Contact 4B».",
      "What you call it. This is what the page reads, not “Contact 4B”.",
    ),
    muta: t(
      "Finché non scegli l'entità questo varco non si vede: né nella pagina, né nel conto di quanti sono aperti adesso.",
      "Until you pick the entity this opening is nowhere: not on the page, not in the count of how many are open right now.",
    ),
    importa: (quanti) =>
      t(
        `Prendi i ${quanti} contatti che Home Assistant ha trovato`,
        `Take the ${quanti} contacts Home Assistant found`,
      ),
    presi: (quanti) => t(`🚪 ${quanti} varchi aggiunti`, `🚪 ${quanti} openings added`),
    notaImporta: t(
      "Li mette qui come righe, una volta sola: da lì in poi sono tue — le rinomini, gli dai il disegno, e quelle che elimini non tornano più.",
      "It puts them here as rows, once: from then on they are yours — rename them, give them a drawing, and the ones you remove do not come back.",
    ),
  },

  /* Come stanno adesso i varchi dichiarati: la pagina e la scheda leggono lo
   * stesso elenco dalla stessa funzione, che e' il motivo per cui non si
   * contraddicono piu'. */
  leggi(elenco) {
    const states = allStates();
    return new Map(
      varchiDiCasa(
        states,
        { righe: elenco },
        insiemeInvertiti(readJson(CHIAVE_VERSI, {})),
        (entity) => nomeDaHomeAssistant(entity, states),
      ).map((riga) => [riga.entity, riga]),
    );
  },

  /* Quello che il rilevamento proporrebbe: i contatti che Home Assistant
   * dichiara varchi, piu' quelli dichiarati dentro le righe delle Finestre. */
  daImportare(config) {
    const states = allStates();
    return varchiDaImportare(states, varchiConLeFinestre(config, righeDelleFinestre()), (entity) =>
      nomeDaHomeAssistant(entity, states),
    );
  },

  statoDellaRiga: (letta) =>
    letta?.stato === "aperto" ? "male" : letta?.stato === "chiuso" ? "bene" : "muta",
  didascalia: (letta) =>
    letta?.stato === "aperto"
      ? t("aperto", "open")
      : letta?.stato === "chiuso"
        ? t("chiuso", "closed")
        : "",
});

/* I tre nomi con cui il resto della plancia chiama questa scheda. Sono
 * funzioni dichiarate, non scorciatoie a una costante: il pacchetto si prova
 * cercando `function install...`, ed e' giusto che si possa. */
export function ensureVarchiEditor() {
  return scheda.disegnaScheda();
}
export function ensureVarchiEditorTab() {
  return scheda.disegnaLinguetta();
}
export function installVarchiEditor() {
  return scheda.installa();
}

installVarchiEditor();
