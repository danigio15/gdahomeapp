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
  comeSta,
  integrazioniDaScegliere,
  lettureDellaRiga,
  lettureProposteDellaMacchina,
  macchineDaImportare,
  macchineERete,
  normalizzaMacchine,
  paroleDiPartenza,
  regolaDelloStato,
  regolaScritta,
  valoreDelloStato,
} from "../core/macchine-e-rete.js";
import { ESITI_ELENCO, conLaVoce, tettoDellElenco } from "../core/robot-model.js";
import { nomeAccantoAlDispositivo } from "../core/nome-accanto-al-dispositivo.js";
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
import { conLaRiga } from "../core/elenco-dichiarato.js";
import { allStates, clean, doc, esc, readJson, root, t, writeJsonIfChanged, senzaCadere } from "./shared.js";
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

/* ── da dove viene lo stato, il terzo campo in più (#177) ──────────────── */

/* «Lo stato me lo dà un sensore del mio sistema di ping: online, offline.»
 *
 * Quasi sempre basta l'automatico, che capisce anche le parole di un sensore
 * qualunque. Quando non basta si sceglie a mano: cosa guardare — lo stato o
 * un attributo —, quali parole vogliono dire «in linea», e cosa vuol dire il
 * resto. Sotto, la prova dal vivo: quello che il sensore dice adesso, e come
 * lo legge la regola appena scritta. Una regola che si vede funzionare prima
 * di salvarla non ha bisogno di un manuale.
 *
 * La regola sta in una casella nascosta, come l'icona e le letture: ogni
 * gesto la riscrive, salva la riga con quello che c'è nelle altre caselle e
 * ridisegna, e la riga resta aperta. */
const NON_ATTRIBUTI = new Set(["friendly_name", "icon", "entity_picture"]);

/* La regola scritta nella casella nascosta. Una casella vuota, o scritta male,
 * e' l'automatico: e' quello che una riga senza regola e' sempre stata. */
function leggiLaRegola(testo) {
  try {
    return clean(testo) ? JSON.parse(testo) : null;
  } catch {
    return null;
  }
}

function attributiDaGuardare(entity, states, scelto) {
  const attributi = Object.keys(states?.[entity]?.attributes || {}).filter(
    (nome) => !NON_ATTRIBUTI.has(nome),
  );
  if (scelto && !attributi.includes(scelto)) attributi.unshift(scelto);
  return attributi;
}

function scelteMarkup(via, indice, valore, voci) {
  return `<span class="dm-macchina-ed-seg" role="group">${voci
    .map(
      ([v, testo]) =>
        `<button type="button" class="${v === valore ? "si" : ""}" aria-pressed="${v === valore}" data-dm-macchina-stato-${via}="${esc(v)}" data-dm-macchina-stato-riga="${indice}">${esc(testo)}</button>`,
    )
    .join("")}</span>`;
}

/* La prova dal vivo: cosa dice adesso il sensore, e cosa ne capisce la riga. */
function provaDelloStato(riga, states) {
  const entity = clean(riga.entity);
  if (!entity) return "";
  const regola = regolaDelloStato(riga.stato);
  const letto = valoreDelloStato(states?.[entity], regola);
  const esito = comeSta(states?.[entity], regola);
  const parola =
    esito === "su"
      ? t("In linea", "Online")
      : esito === "giu"
        ? t("Assente", "Down")
        : t("Non risponde", "Not answering");
  const codice = (testo) => `<code>${esc(testo)}</code>`;
  const detto = !letto
    ? `${codice(entity)} ${esc(t("non c'è in Home Assistant", "is not in Home Assistant"))}`
    : regola.modo === "mio" && regola.attributo && !letto.muto
      ? `${esc(t("Adesso l'attributo", "Now the attribute"))} ${codice(regola.attributo)} ${esc(t("vale", "is"))} ${codice(letto.valore || "—")}`
      : `${esc(t("Adesso", "Now"))} ${codice(entity)} ${esc(t("vale", "is"))} ${codice(letto.valore || "—")}`;
  return `<div class="dm-macchina-ed-prova" data-dm-macchina-stato-prova="${esc(esito || "muto")}" role="status">
      <span>${detto}</span><b>${esc(parola)}</b>
    </div>
    <small>${esc(
      t(
        "«unavailable» e «unknown» restano sempre «Non risponde»: se è Home Assistant a non sapere, la plancia non dice che l'apparecchio è giù.",
        "“unavailable” and “unknown” always stay “Not answering”: when it is Home Assistant that does not know, the dashboard does not say the device is down.",
      ),
    )}</small>`;
}

function campoDelloStato(riga, indice) {
  const states = allStates();
  const regola = regolaDelloStato(riga.stato);
  const scritta = regolaScritta(regola);
  const etichetta = (testo) => `<span class="ed-slot-lbl">${esc(testo)}</span>`;
  const mio =
    regola.modo === "mio"
      ? `<label class="ed-slot dm-dich-campo">${etichetta(t("Cosa guardare", "What to look at"))}
      <span class="ed-form-row"><select class="ed-input" data-dm-macchina-stato-attributo="${indice}">
        <option value=""${regola.attributo ? "" : " selected"}>${esc(t("Lo stato dell'entità", "The entity state"))}</option>${attributiDaGuardare(
          riga.entity,
          states,
          regola.attributo,
        )
          .map(
            (nome) =>
              `<option value="${esc(nome)}"${nome === regola.attributo ? " selected" : ""}>${esc(t("Attributo", "Attribute"))}: ${esc(nome)}</option>`,
          )
          .join("")}</select></span></label>
    <div class="ed-slot dm-dich-campo" data-dm-macchina-stato-parole="${indice}">${etichetta(t("È in linea quando vale", "It is online when it reads"))}
      <div class="dm-macchina-ed-chips">${regola.inLinea
        .map(
          (parola) =>
            `<button type="button" class="dm-macchina-ed-chip" data-dm-macchina-stato-via="${esc(parola)}" data-dm-macchina-stato-riga="${indice}" title="${esc(t("Togli", "Remove"))}"><span>${esc(parola)}</span><i aria-hidden="true">✕</i></button>`,
        )
        .join("")}</div>
      <span class="ed-form-row"><input class="ed-input mono" data-dm-macchina-stato-nuova="${indice}" placeholder="${esc(t("raggiungibile", "reachable"))}" autocomplete="off" spellcheck="false"><button type="button" class="dm-macchina-ed-piu" data-dm-macchina-stato-aggiungi="${indice}" aria-label="${esc(t("Aggiungi", "Add"))}" title="${esc(t("Aggiungi", "Add"))}">＋</button></span>
    </div>
    <div class="ed-slot dm-dich-campo">${etichetta(t("Se vale altro", "If it reads anything else"))}
      ${scelteMarkup("altrimenti", indice, regola.altrimenti, [
        ["giu", t("Assente", "Down")],
        ["muto", t("Non risponde", "Not answering")],
      ])}
    </div>`
      : "";
  return `<div class="dm-macchina-ed-stato">
    <div class="ed-slot dm-dich-campo">${etichetta(t("Lo stato viene da", "The state comes from"))}
      <input type="hidden" data-dm-dich-campo="stato" data-dm-dich-riga="${indice}" value="${esc(scritta ? JSON.stringify(scritta) : "")}">
      ${scelteMarkup("modo", indice, regola.modo, [
        ["auto", t("Automatico", "Automatic")],
        ["mio", t("Scelgo io", "I choose")],
      ])}
      <small>${esc(
        t(
          "Automatico: acceso, connesso, online, up e simili vogliono dire «in linea» — com'è oggi, con in più online e up. Scegli tu quando il tuo sistema di controllo usa parole sue, o mette lo stato in un attributo.",
          "Automatic: on, connected, online, up and the like mean “online” — as today, plus online and up. Choose yourself when your monitoring system uses its own words, or puts the state in an attribute.",
        ),
      )}</small>
    </div>
    ${mio}
    ${provaDelloStato(riga, states)}
  </div>`;
}

/* ── le altre letture, il secondo campo in più (#177) ──────────────────── */

/* «Ho un sistema di ping esterno che per ogni apparecchio mi dà online,
 * latenza, uptime, pacchetti persi, ultima volta visto: vorrei vederli.»
 *
 * Sono le «Altre letture» di tutta la plancia — del robot, della TV, degli
 * elettrodomestici — e si scelgono allo stesso modo: la lente del selettore, la
 * casella per chi l'entità la sa a memoria, e sotto le proposte trovate accanto
 * all'entità della riga, che un tocco aggiunge. La regola di cosa può essere
 * una lettura e di quante ce ne stanno non è scritta qui: è quella di
 * `letture-accanto.js`, passata dallo stesso sportello (`conLaVoce`) perché il
 * tetto si dica invece di tacerlo. */
function pastigliaDellaLettura(entity, azione, segno, riga, states) {
  const nome = nomeAccantoAlDispositivo(entity, riga, states);
  return `<button type="button" class="dm-macchina-ed-chip" data-dm-macchina-lettura-${esc(azione)}="${esc(entity)}" title="${esc(entity)}"><span>${esc(nome)}</span><i aria-hidden="true">${segno}</i></button>`;
}

/* La casella resta una casella con la lente accanto, non la pastiglia che
 * l'editor mette sui campi da UN'entita' (`data-dm-entity-optional`): questa
 * non tiene un valore, ne aggiunge uno all'elenco — e scelta dalla lente la
 * lettura entra subito e la casella torna vuota. */
function campoDelleLetture(riga, indice) {
  const states = allStates();
  const scelte = lettureDellaRiga(riga);
  const tetto = tettoDellElenco("letture");
  const proposte = lettureProposteDellaMacchina(riga, states).slice(0, 12);
  const id = `dm-macchina-ed-${indice}-lettura`;
  return `<div class="ed-slot dm-dich-campo dm-macchina-ed-letture" data-dm-macchina-letture="${indice}">
    <span class="ed-slot-lbl">${esc(t("Altre letture", "Other readings"))} <b class="dm-macchina-ed-quante"${scelte.length >= tetto ? ' data-pieno="true"' : ""}>${esc(String(scelte.length))}/${esc(String(tetto))}</b></span>
    <input type="hidden" data-dm-dich-campo="letture" data-dm-dich-riga="${indice}" value="${esc(scelte.join(","))}">
    <div class="dm-macchina-ed-chips">${
      scelte.length
        ? scelte.map((entity) => pastigliaDellaLettura(entity, "via", "✕", riga, states)).join("")
        : `<small class="dm-macchina-ed-vuoto">${esc(
            t(
              "Nessuna lettura in più: la riga dice se è su o giù, e basta.",
              "No extra reading: the row says whether it is up or down, nothing else.",
            ),
          )}</small>`
    }</div>
    <span class="ed-form-row"><input id="${id}" class="ed-input mono" data-dm-macchina-lettura-nuova="${indice}" data-dm-entity-optional="true" placeholder="sensor.router_latenza" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-dm-macchina-lettura-lente="${id}" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button><button type="button" class="dm-entity-picker dm-macchina-ed-aggiungi" data-dm-macchina-lettura-aggiungi="${indice}" aria-label="${esc(t("Aggiungi", "Add"))}" title="${esc(t("Aggiungi", "Add"))}">＋</button></span>
    <small class="dm-macchina-ed-errore" data-dm-macchina-lettura-errore="${indice}" role="status"></small>
    ${
      proposte.length
        ? `<small>${esc(t("Trovate accanto all'apparecchio — un tocco le aggiunge:", "Found next to the appliance — one tap adds them:"))}</small>
    <div class="dm-macchina-ed-chips dm-macchina-ed-proposte">${proposte.map((entity) => pastigliaDellaLettura(entity, "proposta", "＋", riga, states)).join("")}</div>`
        : ""
    }
    <small>${esc(
      t(
        "I sensori che raccontano questo apparecchio oltre a «su» e «giù» — la latenza del ping, i pacchetti persi, da quanto è acceso, l'ultima volta che si è fatto vedere: entità sensor.*, binary_sensor.*, number.*. Compaiono sotto la sua riga nella pagina MiniPC, col loro nome e la loro unità.",
        "The sensors that tell more about this device than “up” and “down” — ping latency, packet loss, uptime, the last time it was seen: sensor.*, binary_sensor.*, number.* entities. They show under its row on the MiniPC page, with their own name and unit.",
      ),
    )}</small>
  </div>`;
}

function spiegazioneDellaLettura(esito) {
  if (esito === ESITI_ELENCO.gia) return t("Questa lettura c'è già.", "That reading is already there.");
  if (esito === ESITI_ELENCO.pieno)
    return t(
      "La scheda tiene dieci letture, e ci sono tutte: togline una per farci stare questa.",
      "The card holds ten readings and they are all taken: remove one to make room.",
    );
  return t(
    "Serve un'entità sensor.*, binary_sensor.* o number.* — oppure input_number, input_text.",
    "A sensor.*, binary_sensor.* or number.* entity is required — or input_number, input_text.",
  );
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
    /* Non solo i `binary_sensor` (#177): un sensore qualunque che scrive
     * online o offline, up o down va bene uguale — l'automatico lo capisce, e
     * per le parole che non capisce c'è «Lo stato viene da». */
    aiutoEntita: t(
      "Il sensore che dice se è su o giù: un binary_sensor.* (running, connectivity) oppure un sensor.* con parole come online, offline, up, down.",
      "The sensor that says whether it is up or down: a binary_sensor.* (running, connectivity) or a sensor.* with words like online, offline, up, down.",
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
  campiInPiu: (riga, indice) =>
    `${campoDellaFamiglia(riga, indice)}${campoDelloStato(riga, indice)}${campoDelleLetture(riga, indice)}`,

  /* La fascia si legge dalla tendina, le letture e la regola dello stato dalle
   * loro caselle nascoste: sono i campi in piu' che stanno nel documento, e la
   * scheda condivisa non sa dove la sezione li ha messi. */
  bozzaInPiu(bozza, body, indice) {
    const campo = (quale) =>
      body.querySelector(`[data-dm-dich-campo="${quale}"][data-dm-dich-riga="${indice}"]`);
    const scelta = clean(campo("famiglia")?.value);
    const letture = campo("letture");
    const fuori = {
      ...bozza,
      famiglia: FAMIGLIE[scelta] ? scelta : bozza.famiglia || "macchine",
      letture: lettureDellaRiga(letture ? { letture: letture.value } : bozza),
    };
    const casella = campo("stato");
    const regola = regolaScritta(casella ? leggiLaRegola(casella.value) : bozza.stato);
    if (regola) fuori.stato = regola;
    else delete fuori.stato;
    return fuori;
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
  inPiuAllInstallazione(documento, { ridisegna, configurazione: config, salva, bozza, inPiu }) {
    /* Una lettura aggiunta o tolta si salva subito, con quello che c'e' scritto
     * nelle altre caselle della riga: e' il gesto delle pastiglie in tutta la
     * plancia, e la pagina MiniPC cambia mentre si guarda. La riga resta
     * aperta — chi aggiunge la latenza aggiunge subito dopo i pacchetti persi. */
    const cambiaLeLetture = (casella, indice, cambia) => {
      const body = doc.getElementById(ANCORA);
      if (!body || !Number.isInteger(indice)) return false;
      const prima = bozza(body, indice);
      const esito = cambia(lettureDellaRiga(prima));
      const errore = casella?.querySelector?.("[data-dm-macchina-lettura-errore]");
      if (esito.esito && esito.esito !== ESITI_ELENCO.aggiunto) {
        if (errore) errore.textContent = spiegazioneDellaLettura(esito.esito);
        return false;
      }
      salva(conLaRiga(config(), indice, { ...prima, letture: esito.elenco }, inPiu));
      ridisegna();
      return true;
    };
    const aggiungi = (casella, indice, nuova) =>
      cambiaLeLetture(casella, indice, (elenco) => conLaVoce(elenco, nuova, "letture"));

    /* La regola dello stato (#177) si salva allo stesso modo: ogni gesto la
     * cambia, la riga si salva con quello che c'e' nelle altre caselle, e la
     * prova dal vivo sotto si rifa' con la regola nuova. */
    const cambiaLaRegola = (indice, cambia) => {
      const body = doc.getElementById(ANCORA);
      if (!body || !Number.isInteger(indice) || indice < 0) return false;
      const prima = bozza(body, indice);
      const regola = cambia(regolaDelloStato(prima.stato), prima);
      salva(
        conLaRiga(config(), indice, { ...prima, stato: regolaScritta(regola) || undefined }, inPiu),
      );
      ridisegna();
      return true;
    };
    const aggiungiLaParola = (indice) => {
      const scritta = doc
        .getElementById(ANCORA)
        ?.querySelector(`[data-dm-macchina-stato-nuova="${indice}"]`);
      const parola = clean(scritta?.value).toLowerCase();
      if (!parola) return false;
      return cambiaLaRegola(indice, (regola) => ({
        ...regola,
        inLinea: [...regola.inLinea, parola],
      }));
    };

    documento.addEventListener("click", (evento) => {
      const dentro = doc.getElementById(ANCORA);
      const tasto = evento.target?.closest?.("[data-dm-macchina-stato-riga]");
      if (!tasto || !dentro?.contains(tasto)) return;
      evento.preventDefault();
      const indice = Number(tasto.dataset.dmMacchinaStatoRiga);
      const dati = tasto.dataset;
      if (dati.dmMacchinaStatoModo !== undefined)
        cambiaLaRegola(indice, (regola, riga) => ({
          ...regola,
          modo: dati.dmMacchinaStatoModo === "mio" ? "mio" : "auto",
          /* Chi passa a «Scelgo io» parte da parole che danno lo stesso
           * esito di adesso, non da un elenco vuoto. */
          inLinea:
            dati.dmMacchinaStatoModo === "mio" && !regola.inLinea.length
              ? paroleDiPartenza(allStates()[riga.entity])
              : regola.inLinea,
        }));
      else if (dati.dmMacchinaStatoAltrimenti !== undefined)
        cambiaLaRegola(indice, (regola) => ({
          ...regola,
          altrimenti: dati.dmMacchinaStatoAltrimenti,
        }));
      else if (dati.dmMacchinaStatoVia !== undefined)
        cambiaLaRegola(indice, (regola) => ({
          ...regola,
          inLinea: regola.inLinea.filter((parola) => parola !== dati.dmMacchinaStatoVia),
        }));
    });
    documento.addEventListener("click", (evento) => {
      const tasto = evento.target?.closest?.("[data-dm-macchina-stato-aggiungi]");
      if (!tasto || !doc.getElementById(ANCORA)?.contains(tasto)) return;
      evento.preventDefault();
      aggiungiLaParola(Number(tasto.dataset.dmMacchinaStatoAggiungi));
    });
    /* Invio nella casella delle parole aggiunge, come il «＋» accanto. */
    documento.addEventListener("keydown", (evento) => {
      const scritta = evento.target?.closest?.("[data-dm-macchina-stato-nuova]");
      if (evento.key !== "Enter" || !scritta || !doc.getElementById(ANCORA)?.contains(scritta))
        return;
      evento.preventDefault();
      aggiungiLaParola(Number(scritta.dataset.dmMacchinaStatoNuova));
    });
    documento.addEventListener("change", (evento) => {
      const tendina = evento.target?.closest?.("[data-dm-macchina-stato-attributo]");
      if (!tendina || !doc.getElementById(ANCORA)?.contains(tendina)) return;
      cambiaLaRegola(Number(tendina.dataset.dmMacchinaStatoAttributo), (regola) => ({
        ...regola,
        attributo: clean(tendina.value),
      }));
    });

    documento.addEventListener("click", (evento) => {
      const dentro = doc.getElementById(ANCORA);
      if (!dentro?.contains(evento.target)) return;
      const lente = evento.target?.closest?.("[data-dm-macchina-lettura-lente]");
      if (lente) {
        evento.preventDefault();
        const campo = dentro.querySelector(`#${CSS.escape(clean(lente.dataset.dmMacchinaLetturaLente))}`);
        if (campo) root.wzPickEntity?.(campo);
        return;
      }
      const casella = evento.target?.closest?.("[data-dm-macchina-letture]");
      if (!casella) return;
      const indice = Number(casella.dataset.dmMacchinaLetture);
      const via = evento.target.closest("[data-dm-macchina-lettura-via]");
      if (via) {
        evento.preventDefault();
        const togli = clean(via.dataset.dmMacchinaLetturaVia);
        cambiaLeLetture(casella, indice, (elenco) => ({
          elenco: elenco.filter((entity) => entity !== togli),
        }));
        return;
      }
      const proposta = evento.target.closest("[data-dm-macchina-lettura-proposta]");
      if (proposta) {
        evento.preventDefault();
        aggiungi(casella, indice, clean(proposta.dataset.dmMacchinaLetturaProposta));
        return;
      }
      if (evento.target.closest("[data-dm-macchina-lettura-aggiungi]")) {
        evento.preventDefault();
        const scritta = casella.querySelector("[data-dm-macchina-lettura-nuova]");
        aggiungi(casella, indice, clean(scritta?.value));
      }
    });
    /* Il selettore delle entita' scrive nella casella e annuncia il cambio:
     * scelta dalla lente, la lettura entra senza dover premere anche «＋». */
    documento.addEventListener("change", (evento) => {
      const scritta = evento.target?.closest?.("[data-dm-macchina-lettura-nuova]");
      if (!scritta || !doc.getElementById(ANCORA)?.contains(scritta)) return;
      const valore = clean(scritta.value);
      if (!valore) return;
      aggiungi(
        scritta.closest("[data-dm-macchina-letture]"),
        Number(scritta.dataset.dmMacchinaLetturaNuova),
        valore,
      );
    });
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

senzaCadere(installMacchineEditor);
