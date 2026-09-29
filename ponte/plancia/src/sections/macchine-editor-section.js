/* La scheda delle macchine e della rete, dentro il MiniPC (#74).
 *
 * Aveva lo stesso difetto delle altre tre: l'elenco lo facevano le
 * integrazioni spuntate, il cestino escludeva invece di cancellare, e
 * l'escluso restava scritto sotto in «Tolte a mano».
 *
 * Adesso è una scheda dichiarata come le altre — letteralmente la stessa,
 * `scheda-dichiarata-section.js` — con due cose sue:
 *
 *   · sta dentro la scheda del MiniPC, non in una linguetta tutta sua, perché
 *     è lì che uno va a cercarla;
 *   · le integrazioni spuntate restano, e continuano a fare il loro mestiere:
 *     da quali marche si adotta. Quello che cambia è che adesso decidono cosa
 *     viene PROPOSTO, non cosa si vede — perché quello che si vede è quello
 *     che uno ha scritto.
 */
import {
  CAMPI_IN_PIU,
  CHIAVE_MACCHINE,
  FAMIGLIE,
  candidateDaChiedere,
  integrazioniDaScegliere,
  macchineDaImportare,
  macchineERete,
  normalizzaMacchine,
} from "../core/macchine-e-rete.js";
import { MARCHIO_TESSERA } from "../core/fuori-dai-widget.js";
import {
  EVENTO_PIATTAFORME,
  piattaformeConosciute,
  scopriLePiattaforme,
} from "./di-chi-e-unentita-section.js";
import {
  EVENTO_CATALOGO,
  caricaCatalogo,
  nomiDelleIntegrazioni,
} from "./appliance-integration-section.js";
import {
  dispositiviDeiServerDichiarati,
  renderMacchine,
  serverPerDispositivo,
} from "./macchine-e-rete-section.js";
import { costruisciSchedaDichiarata } from "./scheda-dichiarata-section.js";
import { allStates, clean, doc, esc, readJson, root, t, writeJsonIfChanged } from "./shared.js";
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

const KEY = "__DASHBOARDMODERN_MACCHINE_EDITOR__";
const state = (root[KEY] ||= { catalogoChiesto: false });

const ANCORA = "dm-macchine-ed";

/* I disegni: quello che in una casa sta acceso e si guarda da lontano. */
export const DISEGNI_DELLA_MACCHINA = Object.freeze([
  "server",
  "computer",
  "router",
  "printer",
  "robot",
  "camera",
  "socket",
  "power",
  "toggle",
  "globe",
  "tools",
  "solar",
  "battery",
]);

function configurazione() {
  return readJson(CHIAVE_MACCHINE, {}) || {};
}

function registro() {
  return serverPerDispositivo(allStates(), normalizzaMacchine(configurazione()));
}

/* ── le integrazioni ──────────────────────────────────────────────────── */

/* Il menù delle integrazioni: una spunta per ognuna, con quanto porterebbe.
 *
 * Il conto sta scritto accanto al nome perché è quello che fa scegliere: fra
 * «Proxmox VE · 12 macchine» e «Shelly · 9 di rete» si capisce al volo quale
 * delle due è il server e quale sono le prese di casa. */
function integrazioniMarkup() {
  const states = allStates();
  const scelte = normalizzaMacchine(configurazione());
  const righe = integrazioniDaScegliere(
    states,
    piattaformeConosciute(),
    scelte,
    nomiDelleIntegrazioni(),
    dispositiviDeiServerDichiarati(),
  );
  const candidate = candidateDaChiedere(states);
  const dentro = righe.length
    ? righe
        .map(
          (riga) => `<label class="dm-macchina-ed-int">
        <input type="checkbox" data-dm-macchina-integrazione="${esc(riga.dominio)}"${riga.scelta ? " checked" : ""}>
        <span class="dm-macchina-ed-int-nome">${esc(riga.nome)}<small class="mono">${esc(riga.dominio)}</small></span>
        <span class="dm-macchina-ed-int-conto">${riga.macchine ? `${riga.macchine} ${esc(t("macchine", "machines"))}` : ""}${
          riga.macchine && riga.rete ? " · " : ""
        }${riga.rete ? `${riga.rete} ${esc(t("di rete", "network"))}` : ""}</span>
      </label>`,
        )
        .join("")
    : `<div class="ed-empty">${esc(
        candidate.length
          ? t(
              "Sto chiedendo a Home Assistant di chi sono queste entità.",
              "Asking Home Assistant which integration these entities come from.",
            )
          : t(
              "Home Assistant non dichiara nessuna macchina né pezzo di rete.",
              "Home Assistant declares no machine and no network piece.",
            ),
      )}</div>`;
  return `<div class="dm-macchina-ed-fascia">
    <span class="dm-macchina-ed-fascia-lbl">${esc(t("Da quali integrazioni", "Which integrations"))}</span>
    <small class="dm-dich-nota">${esc(
      t(
        "Da quali marche prendere, quando premi il tasto qui sotto. Non cambiano quello che si vede: quello lo decidono le righe.",
        "Which brands to take from when you press the button below. They do not change what is shown: the rows decide that.",
      ),
    )}</small>
    ${dentro}
  </div>`;
}

/* ── la famiglia, il campo in più della riga ──────────────────────────── */

function campoDellaFamiglia(riga, indice) {
  const scelta = FAMIGLIE[riga.famiglia] ? riga.famiglia : "macchine";
  const voci = [
    ["macchine", t("Macchina o container", "Machine or container")],
    ["rete", t("Pezzo di rete", "Network piece")],
  ];
  return `<label class="ed-slot dm-dich-campo"><span class="ed-slot-lbl">${esc(t("In quale fascia", "Which band"))}</span>
    <span class="ed-form-row"><select class="ed-input" data-dm-dich-campo="famiglia" data-dm-dich-riga="${indice}">${voci
      .map(
        ([valore, parola]) =>
          `<option value="${esc(valore)}"${valore === scelta ? " selected" : ""}>${esc(parola)}</option>`,
      )
      .join("")}</select></span>
    <small>${esc(
      t(
        "La pagina MiniPC ha due fasce: le macchine e la rete. Questa riga va in quella che scegli qui.",
        "The MiniPC page has two bands: machines and network. This row goes in the one you pick here.",
      ),
    )}</small></label>`;
}

/* ── la scheda ────────────────────────────────────────────────────────── */

const scheda = costruisciSchedaDichiarata({
  nome: "macchine",
  chiave: CHIAVE_MACCHINE,
  tab: "sez6",
  ancora: ANCORA,
  attributi: { [MARCHIO_TESSERA]: "macchine" },
  inPiu: CAMPI_IN_PIU,
  rigaNuova: { famiglia: "macchine" },
  disegni: DISEGNI_DELLA_MACCHINA,
  ripiego: "server",
  ridisegnaPagina: renderMacchine,

  /* Aprendo la scheda si chiedono le due cose che servono a disegnarla e che
   * non stanno negli stati: di chi sono i candidati, e come si chiamano le
   * integrazioni. Nessuna delle due si aspetta — arrivando si annunciano, e la
   * scheda si ridisegna da sé.
   *
   * Il catalogo si chiede una volta per sessione e non a ogni ridisegno: chi
   * risponde vuoto — una casa senza integrazioni, un socket chiuso — farebbe
   * ridisegnare, e il ridisegno richiederebbe, e si girerebbe a vuoto per
   * sempre. Il nome dell'integrazione è un lusso: senza, si legge il dominio. */
  primaDiDisegnare() {
    const candidate = candidateDaChiedere(allStates());
    if (candidate.length) scopriLePiattaforme(candidate);
    if (state.catalogoChiesto) return;
    state.catalogoChiesto = true;
    caricaCatalogo().catch(() => {});
  },

  parole: {
    linguetta: "",
    intro: t(
      "Le macchine e la rete. Ogni riga è una macchina — l'entità, il nome che vuoi tu, il disegno, e in quale delle due fasce sta — e la pagina MiniPC mostra queste, accese e spente.",
      "The machines and the network. Each row is a machine — the entity, the name you want, the drawing, and which of the two bands it sits in — and the MiniPC page shows these, up and down.",
    ),
    vuoto: t("Nessuna macchina configurata", "No machine configured"),
    aggiungi: t("Aggiungi macchina", "Add machine"),
    nuovo: t("Macchina nuova", "New machine"),
    senzaNome: t("Macchina senza nome", "Unnamed machine"),
    salva: t("Salva macchina", "Save machine"),
    salvato: `🖥️ ${t("Macchina salvata", "Machine saved")}`,
    etichettaEntita: t("Entità della macchina", "Machine entity"),
    segnaposto: "binary_sensor.pve_qemu_103_running",
    aiutoEntita: t(
      "Il sensore che dice se è accesa o raggiungibile: binary_sensor.* di classe running o connectivity.",
      "The sensor that says whether it is up or reachable: a binary_sensor.* of class running or connectivity.",
    ),
    /* Un nome proprio non si traduce, e passarlo da `t()` vorrebbe dire
     * chiedere a tredici cataloghi di ripetere la stessa parola. */
    segnapostoNome: "Home Assistant",
    aiutoNome: t("«pve_qemu_103» non dice cos'è.", "“pve_qemu_103” does not say what it is."),
    muta: t(
      "Finché non scegli l'entità questa macchina non si vede: né nella pagina, né nel conto di quante sono giù.",
      "Until you pick the entity this machine is nowhere: not on the page, not in the count of how many are down.",
    ),
    importa: (quanti) =>
      t(
        `Prendi le ${quanti} che Home Assistant ha trovato`,
        `Take the ${quanti} Home Assistant found`,
      ),
    presi: (quanti) => t(`🖥️ ${quanti} righe aggiunte`, `🖥️ ${quanti} rows added`),
    notaImporta: t(
      "Le mette qui come righe, una volta sola: da lì in poi sono tue — le rinomini, gli dai il disegno, e quelle che elimini non tornano più.",
      "It puts them here as rows, once: from then on they are yours — rename them, give them a drawing, and the ones you remove do not come back.",
    ),
  },

  inTesta: integrazioniMarkup,
  campiInPiu: campoDellaFamiglia,

  /* La fascia si legge dalla tendina: e' l'unico campo in piu' che sta nel
   * documento, e la scheda condivisa non sa dove la sezione l'ha messo. */
  bozzaInPiu(bozza, body, indice) {
    const tendina = body.querySelector(
      `[data-dm-dich-campo="famiglia"][data-dm-dich-riga="${indice}"]`,
    );
    const scelta = clean(tendina?.value);
    return { ...bozza, famiglia: FAMIGLIE[scelta] ? scelta : bozza.famiglia || "macchine" };
  },

  leggi(elenco) {
    const states = allStates();
    const elenchi = macchineERete(
      states,
      { righe: elenco },
      (entity) => nomeDaHomeAssistant(entity, states),
      piattaformeConosciute(),
      registro(),
    );
    return new Map([...elenchi.macchine, ...elenchi.rete].map((riga) => [riga.entity, riga]));
  },

  daImportare(config) {
    const states = allStates();
    return macchineDaImportare(
      states,
      config,
      (entity) => nomeDaHomeAssistant(entity, states),
      piattaformeConosciute(),
      registro(),
    );
  },

  statoDellaRiga: (letta) =>
    letta?.stato === "giu" ? "male" : letta?.stato === "su" ? "bene" : "muta",
  didascalia: (letta) =>
    letta?.stato === "giu"
      ? t("giù", "down")
      : letta?.stato === "su"
        ? t("su", "up")
        : "",

  /* Le spunte delle integrazioni si salvano da sé: sono la configurazione di
   * COSA PROPORRE, non di una riga, e aspettare il 💾 di una riga vorrebbe
   * dire un tasto che salva una cosa che non ha davanti. */
  inPiuAllInstallazione(documento, { ridisegna }) {
    documento.addEventListener("click", (evento) => {
      const spunta = evento.target?.closest?.("[data-dm-macchina-integrazione]");
      if (!spunta || !doc.getElementById(ANCORA)?.contains(spunta)) return;
      const dominio = clean(spunta.dataset.dmMacchinaIntegrazione);
      if (!dominio) return;
      const scelte = normalizzaMacchine(configurazione());
      const prese = new Set(scelte.integrazioni);
      if (spunta.checked) prese.add(dominio);
      else prese.delete(dominio);
      writeJsonIfChanged(CHIAVE_MACCHINE, { ...configurazione(), integrazioni: [...prese] });
      ridisegna();
    });
    for (const evento of [EVENTO_PIATTAFORME, EVENTO_CATALOGO])
      root.addEventListener?.(evento, () => root.queueMicrotask?.(ridisegna));
  },
});

export function ensureMacchineEditor() {
  return scheda.disegnaScheda();
}
export function installMacchineEditor() {
  return scheda.installa();
}

installMacchineEditor();
