/* La scheda delle batterie in configurazione (#398, #74).
 *
 * Aveva lo stesso difetto dei Varchi e della Presenza: l'elenco lo faceva il
 * guscio — tutto quello che Home Assistant chiama «Battery» — il cestino
 * escludeva invece di cancellare, e l'escluso restava scritto sotto.
 *
 * Adesso è una scheda dichiarata come le altre. La scheda è letteralmente la
 * stessa, `scheda-dichiarata-section.js`; qui c'è quello che delle batterie è
 * davvero proprio, e sono due cose in più delle altre tre:
 *
 *   · la soglia di casa, che vale per tutte e sta in cima;
 *   · le due soglie di ricarica, per quello che si ricarica invece di
 *     cambiarsi — il tablet a muro, un accumulatore.
 */
import {
  CHIAVE_BATTERIE,
  batterieDichiarate,
  sogliaDelleBatterie,
} from "../core/batterie-di-casa.js";
import {
  CHIAVE_RICARICA,
  eSogliaDiRicarica,
  normalizzaRicariche,
  ricaricaDellaBatteria,
} from "../core/ricarica-a-soglie.js";
import {
  BATTERIE_TAB,
  batterieInPlancia,
  renderBatterie,
} from "./batterie-section.js";
import { batterieSorvegliate, nomeDellaBatteria } from "./batterie-elenco-section.js";
import { costruisciSchedaDichiarata } from "./scheda-dichiarata-section.js";
import { allStates, clean, doc, esc, readJson, t, writeJsonIfChanged } from "./shared.js";

export const BATTERIE_EDITOR_TAB = BATTERIE_TAB;

/* I disegni: quello che in casa va a pile. La batteria resta il primo, ma di
 * una batteria interessa DOVE sta, non che sia una batteria — e infatti sotto
 * ci sono le cose che le pile le hanno dentro. */
export const DISEGNI_DELLA_BATTERIA = Object.freeze([
  "battery",
  "door",
  "window",
  "motion",
  "radar",
  "lock",
  "smoke",
  "thermometer",
  "camera",
  "bell",
  "person",
  "pet",
  "tools",
  "computer",
]);

/* ── la soglia di casa ────────────────────────────────────────────────── */

function soglia() {
  return sogliaDelleBatterie(readJson(CHIAVE_BATTERIE, {}));
}

function salvaSoglia(valore) {
  const quanto = sogliaDelleBatterie({ soglia: valore });
  writeJsonIfChanged(CHIAVE_BATTERIE, { ...(readJson(CHIAVE_BATTERIE, {}) || {}), soglia: quanto });
  renderBatterie();
}

/* ── le due soglie di ricarica ────────────────────────────────────────── */

/* Stanno nel loro elenco, `cd_batterie_ricarica`, e non dentro la riga: e'
 * quello che legge la pagina per disegnare il comando, e spostarlo qui dentro
 * avrebbe voluto dire toccare la pagina per una casella. La riga sparisce da
 * se' quando restano vuote tutte e due — una riga senza soglie non e' una riga
 * a meta', e' una batteria come tutte le altre. */
function salvaSogliaDiRicarica(battery, quale, valore) {
  const id = clean(battery);
  if (!id || (quale !== "bassa" && quale !== "alta")) return false;
  const scritte = readJson(CHIAVE_RICARICA, []);
  const righe = Array.isArray(scritte) ? scritte.filter(Boolean) : [];
  const posizione = righe.findIndex((riga) => clean(riga?.battery) === id);
  const prima = posizione >= 0 ? righe[posizione] : { id: `ricarica-${id}`, battery: id };
  const scelta = clean(valore);
  /* Un'entita' che non sa cambiare un numero non diventa una soglia a meta':
   * o e' `number.*`/`input_number.*`, o la casella si svuota. */
  const dopo = { ...prima, [quale]: eSogliaDiRicarica(scelta) ? scelta : "" };
  const restano = clean(dopo.bassa) || clean(dopo.alta);
  const prossime = righe.filter((_riga, indice) => indice !== posizione);
  if (restano) prossime.push(dopo);
  writeJsonIfChanged(CHIAVE_RICARICA, prossime);
  renderBatterie();
  return true;
}

function campoDellaSoglia(riga, quale, etichetta, esempio) {
  const id = `dm-batt-soglia-${quale}-${clean(riga.entity).replace(/[^a-z0-9]+/gi, "-")}`;
  const valore = clean(ricaricaDellaBatteria(riga.entity, normalizzaRicariche(readJson(CHIAVE_RICARICA, [])))?.[quale]);
  return `<label class="ed-slot dm-dich-campo"><span class="ed-slot-lbl">${esc(etichetta)}</span>
    <span class="ed-form-row"><input id="${esc(id)}" class="ed-input mono" value="${esc(valore)}"
      placeholder="${esc(esempio)}" autocomplete="off" spellcheck="false"
      data-dm-batt-ricarica="${esc(riga.entity)}" data-dm-batt-quale="${esc(quale)}"><button type="button"
      class="dm-entity-picker" data-dm-dich-pick="${esc(id)}"
      aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span></label>`;
}

/* ── la scheda ────────────────────────────────────────────────────────── */

const scheda = costruisciSchedaDichiarata({
  nome: "batterie",
  chiave: CHIAVE_BATTERIE,
  tab: BATTERIE_EDITOR_TAB,
  disegni: DISEGNI_DELLA_BATTERIA,
  ripiego: "battery",
  ridisegnaPagina: renderBatterie,

  parole: {
    linguetta: `🔋 ${t("Batterie", "Batteries")}`,
    intro: t(
      "Le batterie che vuoi tenere d'occhio. Ogni riga è una batteria — l'entità in percentuale, il nome che vuoi tu, il disegno — e la pagina Batterie le mostra dalla più scarica alla più piena, con in cima quante sono da cambiare.",
      "The batteries you want to keep an eye on. Each row is a battery — the entity in percent, the name you want, the drawing — and the Batteries page shows them from the flattest to the fullest, with how many need replacing on top.",
    ),
    vuoto: t("Nessuna batteria configurata", "No battery configured"),
    aggiungi: t("Aggiungi batteria", "Add battery"),
    nuovo: t("Batteria nuova", "New battery"),
    senzaNome: t("Batteria senza nome", "Unnamed battery"),
    salva: t("Salva batteria", "Save battery"),
    salvato: `🔋 ${t("Batteria salvata", "Battery saved")}`,
    etichettaEntita: t("Entità della batteria", "Battery entity"),
    segnaposto: "sensor.porta_camera_battery",
    aiutoEntita: t(
      "Il sensore in percentuale. Quello che Home Assistant chiama «Battery».",
      "The sensor in percent. The one Home Assistant calls “Battery”.",
    ),
    segnapostoNome: t("Porta camera", "Bedroom door"),
    aiutoNome: t(
      "«Sensore Porta/finestra Camera Batteria» non lo capisce nessuno: qui gli dai il nome vero.",
      "“Door/window sensor Bedroom Battery” means nothing to anyone: here you give it its real name.",
    ),
    muta: t(
      "Finché non scegli l'entità questa batteria non si vede: né nella pagina, né nel conto di quante sono da cambiare.",
      "Until you pick the entity this battery is nowhere: not on the page, not in the count of how many need replacing.",
    ),
    importa: (quanti) =>
      t(
        `Prendi le ${quanti} batterie che Home Assistant ha trovato`,
        `Take the ${quanti} batteries Home Assistant found`,
      ),
    presi: (quanti) => t(`🔋 ${quanti} batterie aggiunte`, `🔋 ${quanti} batteries added`),
    notaImporta: t(
      "Le mette qui come righe, una volta sola: da lì in poi sono tue — le rinomini, gli dai il disegno, e quelle che elimini non tornano più.",
      "It puts them here as rows, once: from then on they are yours — rename them, give them a drawing, and the ones you remove do not come back.",
    ),
  },

  /* La soglia di casa sta in cima, perche' vale per tutte le righe: dentro una
   * riga direbbe che e' di quella batteria, e non lo e'. */
  inTesta() {
    return `<label class="ed-slot dm-dich-campo"><span class="ed-slot-lbl">${esc(t("Da cambiare sotto il (%)", "To replace below (%)"))}</span>
      <span class="ed-form-row"><input class="ed-input mono" data-dm-batt-soglia value="${esc(String(soglia()))}"
        inputmode="numeric" autocomplete="off"></span>
      <small>${esc(
        t(
          "Vale per tutte: sotto questa percentuale la batteria entra nel conto di quelle da cambiare.",
          "It applies to all of them: below this percentage a battery joins the count of those to replace.",
        ),
      )}</small></label>`;
  },

  campiInPiu(riga) {
    if (!riga.entity) return "";
    const ricarica = ricaricaDellaBatteria(
      riga.entity,
      normalizzaRicariche(readJson(CHIAVE_RICARICA, [])),
    );
    return `<details class="dm-dich-piu"${ricarica ? " open" : ""}>
      <summary>⚡ ${esc(t("Soglie di ricarica", "Charge thresholds"))}</summary>
      <small>${esc(
        t(
          "Per quello che si ricarica e non si cambia: il tablet a muro, un accumulatore. Le due entità sono number.* o input_number.*, quelle che il dispositivo espone per dire sotto quanto riparte e sopra quanto si ferma. Lasciale vuote e questa resta una batteria come le altre.",
          "For what recharges instead of being replaced: the wall tablet, a power bank. The two entities are number.* or input_number.*, the ones the device exposes to say where it starts again and where it stops. Leave them empty and this stays a battery like the others.",
        ),
      )}</small>
      ${campoDellaSoglia(riga, "bassa", t("Riparte sotto il", "Starts again below"), "number.tablet_soglia_bassa")}
      ${campoDellaSoglia(riga, "alta", t("Si ferma sopra il", "Stops above"), "number.tablet_soglia_alta")}
    </details>`;
  },

  leggi(elenco) {
    /* Le righe lette dalla pagina, cosi' la scheda e la pagina dicono la
     * stessa cosa: il livello accanto al nome e' quello di la'. */
    const dentro = new Set(elenco.map((riga) => riga.entity).filter(Boolean));
    return new Map(
      batterieInPlancia()
        .filter((riga) => dentro.has(riga.entity))
        .map((riga) => [riga.entity, riga]),
    );
  },

  /* Quello che il guscio sorveglia e qui dentro non c'e'. */
  daImportare(config) {
    const states = allStates();
    const gia = new Set((batterieDichiarate(config) || []).map((riga) => riga.entity));
    return batterieSorvegliate()
      .filter((entity) => !gia.has(entity))
      .map((entity) => ({
        entity,
        name: nomeDellaBatteria(entity, states),
        icon: "battery",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  statoDellaRiga: (letta) => (letta?.muta ? "muta" : letta?.scarica ? "male" : "bene"),
  didascalia: () => "",
  accanto: (letta) => (letta ? (letta.muta ? "—" : `${Math.round(letta.level)}%`) : ""),

  /* Le due caselle che non stanno nella riga si salvano da se', mentre si
   * scrivono: sono di un altro elenco, e aspettare il 💾 della riga vorrebbe
   * dire un tasto che salva meta' di quello che ha davanti. */
  inPiuAllInstallazione(documento, { ridisegna }) {
    documento.addEventListener("change", (evento) => {
      const casella = evento.target?.closest?.("[data-dm-batt-ricarica]");
      if (casella) {
        salvaSogliaDiRicarica(
          casella.dataset.dmBattRicarica,
          clean(casella.dataset.dmBattQuale),
          casella.value,
        );
        return;
      }
      const sogliaDiCasa = evento.target?.closest?.("[data-dm-batt-soglia]");
      if (sogliaDiCasa) {
        salvaSoglia(sogliaDiCasa.value);
        ridisegna();
      }
    });
  },
});

export function ensureBatterieEditor() {
  return scheda.disegnaScheda();
}
export function ensureBatterieEditorTab() {
  return scheda.disegnaLinguetta();
}
export function installBatterieEditor() {
  return scheda.installa();
}

installBatterieEditor();
