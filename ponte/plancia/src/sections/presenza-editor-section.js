/* La scheda della presenza in configurazione (#432, #74).
 *
 * Aveva lo stesso difetto dei Varchi, ed era la stessa scheda: l'elenco lo
 * faceva Home Assistant — tutto quello che si chiamava «motion» o
 * «occupancy» — il cestino escludeva invece di cancellare, e l'escluso restava
 * scritto sotto in «Tolti dai conti».
 *
 * Adesso è una scheda dichiarata come le altre. La scheda è letteralmente la
 * stessa, `scheda-dichiarata-section.js`; qui c'è solo quello che dei
 * rilevatori è davvero proprio.
 */
import {
  CHIAVE_PRESENZA,
  presenzaDiCasa,
  rilevatoriDaImportare,
} from "../core/presenza-in-casa.js";
import { PRESENZA_TAB, renderPresenza } from "./presenza-section.js";
import { costruisciSchedaDichiarata } from "./scheda-dichiarata-section.js";
import { allStates, stanzaDiHomeAssistant, t } from "./shared.js";
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

export const PRESENZA_EDITOR_TAB = PRESENZA_TAB;

/* I disegni: i due modi di rilevare, chi si rileva, e le stanze piu' comuni —
 * perche' un rilevatore uno lo chiama col nome della stanza, non del sensore. */
export const DISEGNI_DEL_RILEVATORE = Object.freeze([
  "motion",
  "radar",
  "person",
  "pet",
  "room-living",
  "room-bedroom",
  "room-kids",
  "room-bathroom",
  "room-hallway",
  "room-entrance",
  "room-kitchen",
  "room-office",
  "room-garage",
  "room-cellar",
  "room-garden",
]);

const scheda = costruisciSchedaDichiarata({
  nome: "presenza",
  chiave: CHIAVE_PRESENZA,
  tab: PRESENZA_EDITOR_TAB,
  disegni: DISEGNI_DEL_RILEVATORE,
  ripiego: "motion",
  ridisegnaPagina: renderPresenza,

  parole: {
    linguetta: `👁️ ${t("Presenza", "Presence")}`,
    intro: t(
      "I rilevatori di presenza. Ogni riga è un rilevatore — l'entità, il nome che vuoi tu, il disegno — e la pagina Presenza mostra queste: in cima quante stanze hanno qualcuno dentro, sotto una card per rilevatore con da quanto è così.",
      "The presence detectors. Each row is a detector — the entity, the name you want, the drawing — and the Presence page shows these: how many rooms have someone in them on top, and one card per detector below with how long it has been that way.",
    ),
    vuoto: t("Nessun rilevatore configurato", "No detector configured"),
    aggiungi: t("Aggiungi rilevatore", "Add detector"),
    nuovo: t("Rilevatore nuovo", "New detector"),
    senzaNome: t("Rilevatore senza nome", "Unnamed detector"),
    salva: t("Salva rilevatore", "Save detector"),
    salvato: `👁️ ${t("Rilevatore salvato", "Detector saved")}`,
    etichettaEntita: t("Entità del rilevatore", "Detector entity"),
    segnaposto: "binary_sensor.movimento_corridoio",
    aiutoEntita: t(
      "Il sensore che dice se c'è qualcuno: binary_sensor.* di classe motion, occupancy o presence.",
      "The sensor that says whether someone is there: a binary_sensor.* of class motion, occupancy or presence.",
    ),
    segnapostoNome: t("Corridoio", "Hallway"),
    aiutoNome: t("«Motion 3C» non dice quale stanza è.", "“Motion 3C” does not say which room it is."),
    muta: t(
      "Finché non scegli l'entità questo rilevatore non si vede: né nella pagina, né nel conto delle stanze occupate.",
      "Until you pick the entity this detector is nowhere: not on the page, not in the count of occupied rooms.",
    ),
    importa: (quanti) =>
      t(
        `Prendi gli ${quanti} rilevatori che Home Assistant ha trovato`,
        `Take the ${quanti} detectors Home Assistant found`,
      ),
    presi: (quanti) =>
      t(`👁️ ${quanti} rilevatori aggiunti`, `👁️ ${quanti} detectors added`),
    notaImporta: t(
      "Li mette qui come righe, una volta sola: da lì in poi sono tuoi — li rinomini, gli dai il disegno, e quelli che elimini non tornano più.",
      "It puts them here as rows, once: from then on they are yours — rename them, give them a drawing, and the ones you remove do not come back.",
    ),
  },

  leggi(elenco) {
    const states = allStates();
    return new Map(
      presenzaDiCasa(
        states,
        { righe: elenco },
        (entity) => nomeDaHomeAssistant(entity, states),
        stanzaDiHomeAssistant,
      ).map((riga) => [riga.entity, riga]),
    );
  },

  daImportare(config) {
    const states = allStates();
    return rilevatoriDaImportare(states, config, (entity) => nomeDaHomeAssistant(entity, states));
  },

  statoDellaRiga: (letta) =>
    letta?.stato === "attivo" ? "attiva" : letta?.stato === "libero" ? "bene" : "muta",
  didascalia: (letta) =>
    letta?.stato === "attivo"
      ? t("occupato", "occupied")
      : letta?.stato === "libero"
        ? t("libero", "free")
        : "",
});

/* I tre nomi con cui il resto della plancia chiama questa scheda. Sono
 * funzioni dichiarate, non scorciatoie a una costante: il pacchetto si prova
 * cercando `function install...`, ed e' giusto che si possa. */
export function ensurePresenzaEditor() {
  return scheda.disegnaScheda();
}
export function ensurePresenzaEditorTab() {
  return scheda.disegnaLinguetta();
}
export function installPresenzaEditor() {
  return scheda.installa();
}

installPresenzaEditor();
