/* La scheda dei contatori in configurazione (#115, #135, #137).
 *
 * È la scheda dichiarata di tutte le altre — `scheda-dichiarata-section.js` —
 * e qui c'è solo quello che dei contatori è davvero proprio: cosa misura ogni
 * riga, e i numeri che servono a quel genere e a nessun altro.
 *
 *   · il contatore dell'acqua e quello del gas hanno il prezzo al metro cubo,
 *     che trasforma il mese in euro; il gas anche il coefficiente della
 *     bolletta, che trasforma i metri cubi in kilowattora;
 *   · la pressione ha la sua forcella;
 *   · il sale ha la soglia sotto cui va ricomprato.
 *
 * Stanno dentro la riga, e non in cima alla scheda come la soglia delle
 * Batterie, perché non valgono per tutte: il prezzo del gas in cima direbbe
 * che vale anche per l'acqua, e a chi ha solo un sensore di pressione
 * metterebbe davanti tre caselle che non lo riguardano.
 */
import {
  CAMPI_IN_PIU,
  CHIAVE_CONTATORI,
  FORCELLA_DELLA_PRESSIONE,
  GENERI,
  KWH_PER_METRO_CUBO,
  SALE_DA_RICOMPRARE,
  conLaRiga,
  contatoriDaImportare,
  contatoriDiCasa,
  disegnoDelGenere,
  genereDelSensore,
  genereValido,
  righeDichiarate,
} from "../core/contatori-di-casa.js";
import { CONTATORI_TAB, renderContatori } from "./contatori-section.js";
import { costruisciSchedaDichiarata } from "./scheda-dichiarata-section.js";
import { allStates, clean, esc, formatNumber, t } from "./shared.js";
import { nomeDaHomeAssistant } from "./editor-slots-section.js";

export const CONTATORI_EDITOR_TAB = CONTATORI_TAB;

/* I disegni che la scheda mette davanti: i tre dei contatori, poi quello che
 * in casa ha a che fare con l'acqua. */
export const DISEGNI_DEL_CONTATORE = Object.freeze([
  "meter",
  "water",
  "flame",
  "gauge",
  "softener",
  "pump",
  "irrigation",
  "room-garden",
  "room-bathroom",
  "home",
]);

/* I numeri di ogni genere: quelli che la riga tiene, gli altri se ne vanno
 * quando il genere cambia. */
const CAMPI_DEL_GENERE = Object.freeze({
  acqua: ["prezzo"],
  gas: ["prezzo", "coefficiente"],
  pressione: ["minimo", "massimo"],
  portata: [],
  sale: ["soglia"],
});

const NUMERI = Object.freeze(["prezzo", "coefficiente", "minimo", "massimo", "soglia"]);

function nomiDeiGeneri() {
  return {
    acqua: t("Contatore acqua", "Water meter"),
    gas: t("Contatore gas", "Gas meter"),
    pressione: t("Pressione acqua", "Water pressure"),
    portata: t("Portata acqua", "Water flow"),
    sale: t("Sale dell'addolcitore", "Softener salt"),
  };
}

/* Il genere di una riga: quello scritto, o quello che dice il sensore. */
function genereDellaRiga(riga, states = allStates()) {
  return (
    genereValido(riga?.genere) || genereDelSensore(riga?.entity, states?.[riga?.entity]) || "acqua"
  );
}

/* ── i campi della riga ───────────────────────────────────────────────── */

function campoNumerico(nome, indice, riga, etichetta, esempio, aiuto = "") {
  return `<label class="ed-slot dm-dich-campo"><span class="ed-slot-lbl">${esc(etichetta)}</span>
    <span class="ed-form-row"><input class="ed-input mono" data-dm-dich-campo="${esc(nome)}"
      data-dm-dich-riga="${indice}" value="${esc(clean(riga[nome]))}" placeholder="${esc(esempio)}"
      inputmode="decimal" autocomplete="off" spellcheck="false"></span>
    ${aiuto ? `<small>${esc(aiuto)}</small>` : ""}</label>`;
}

function campiDelContatore(riga, indice) {
  const genere = genereDellaRiga(riga);
  const nomi = nomiDeiGeneri();
  const scelta = `<label class="ed-slot dm-dich-campo"><span class="ed-slot-lbl">${esc(t("Cosa misura", "What it measures"))}</span>
    <span class="ed-form-row"><select class="ed-input" data-dm-cont-genere="${indice}">${GENERI.map(
      (voce) =>
        `<option value="${esc(voce)}"${voce === genere ? " selected" : ""}>${esc(nomi[voce])}</option>`,
    ).join("")}</select></span>
    <small>${esc(
      t(
        "I contatori danno oggi, ieri e il mese. La portata sopra zero per tre ore senza fermarsi è una perdita, e la pagina lo dice in rosso. La pressione ha la sua forcella, e il sale dell'addolcitore si conta in giorni.",
        "Meters give today, yesterday and the month. Flow above zero for three hours without stopping is a leak, and the page says so in red. Pressure has its ideal range, and the softener salt is counted in days.",
      ),
    )}</small></label>`;
  let piu = "";
  if (genere === "acqua" || genere === "gas")
    piu += campoNumerico(
      "prezzo",
      indice,
      riga,
      t("Prezzo al m³ (€)", "Price per m³ (€)"),
      formatNumber(genere === "gas" ? 0.95 : 1.9, 2),
      t(
        "Quello della bolletta: trasforma il mese in euro. Lascialo vuoto e la pagina dice solo i metri cubi.",
        "The one on the bill: it turns the month into euros. Leave it empty and the page shows only cubic metres.",
      ),
    );
  if (genere === "gas")
    piu += campoNumerico(
      "coefficiente",
      indice,
      riga,
      t("kWh per m³ (dalla bolletta)", "kWh per m³ (from the bill)"),
      formatNumber(KWH_PER_METRO_CUBO, 1),
      t(
        "In bolletta è il coefficiente di conversione: circa 10,7 per il metano. Serve a confrontare il gas e la corrente nella stessa unità.",
        "On the bill it is the conversion coefficient: about 10.7 for methane. It lets gas and electricity be compared in the same unit.",
      ),
    );
  if (genere === "pressione")
    piu +=
      campoNumerico(
        "minimo",
        indice,
        riga,
        t("Ideale da (bar)", "Ideal from (bar)"),
        formatNumber(FORCELLA_DELLA_PRESSIONE.minimo, 0),
      ) +
      campoNumerico(
        "massimo",
        indice,
        riga,
        t("Ideale fino a (bar)", "Ideal up to (bar)"),
        formatNumber(FORCELLA_DELLA_PRESSIONE.massimo, 0),
        t(
          "La forcella in cui l'acqua di casa deve stare: da 2 a 4 bar per quasi tutte. Fuori, la pagina si colora d'ambra.",
          "The range a home's water should stay in: 2 to 4 bar for almost all of them. Outside it, the page turns amber.",
        ),
      );
  if (genere === "sale")
    piu += campoNumerico(
      "soglia",
      indice,
      riga,
      t("Da ricomprare sotto", "Buy more below"),
      formatNumber(SALE_DA_RICOMPRARE, 0),
      t(
        "Nella stessa unità del sensore: percento o chili. La pagina conta i giorni che restano, al passo degli ultimi giorni.",
        "In the same unit as the sensor: percent or kilograms. The page counts the days left, at the pace of the last few days.",
      ),
    );
  return scelta + piu;
}

/* Quello che la riga aperta ha nelle sue caselle adesso: il genere dalla
 * tendina, i numeri di quel genere, e nient'altro. */
function conICampiDelContatore(bozza, body, indice) {
  const tendina = body.querySelector(`[data-dm-cont-genere="${indice}"]`);
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

/* Il valore accanto al nome, come lo dice il sensore. */
function valoreDellaRiga(letta) {
  if (!letta || letta.muto) return "—";
  const cifre = Math.abs(letta.valore) < 100 ? 1 : 0;
  return `${formatNumber(letta.valore, cifre)}${letta.unita ? ` ${letta.unita}` : ""}`;
}

/* ── la scheda ────────────────────────────────────────────────────────── */

const scheda = costruisciSchedaDichiarata({
  nome: "contatori",
  chiave: CHIAVE_CONTATORI,
  tab: CONTATORI_EDITOR_TAB,
  disegni: DISEGNI_DEL_CONTATORE,
  ripiego: "meter",
  ridisegnaPagina: renderContatori,
  inPiu: CAMPI_IN_PIU,
  rigaNuova: { genere: "acqua", icon: "meter" },

  campiInPiu: campiDelContatore,
  bozzaInPiu: conICampiDelContatore,

  parole: {
    linguetta: `${t("Acqua e gas", "Water and gas")}`,
    intro: t(
      "I contatori di casa: l'acqua, il gas, e quello che dice l'impianto. Ogni riga è un sensore — l'entità, il nome che vuoi tu, il disegno e cosa misura — e la pagina Acqua e gas mostra oggi, ieri e il mese, la pressione nella sua forcella, e l'acqua che non smette mai di scorrere.",
      "The meters of the house: water, gas, and what the plumbing says. Each row is a sensor — the entity, the name you want, the drawing and what it measures — and the Water and gas page shows today, yesterday and the month, the pressure within its range, and water that never stops flowing.",
    ),
    vuoto: t("Nessun contatore configurato", "No meter configured"),
    aggiungi: t("Aggiungi contatore", "Add meter"),
    nuovo: t("Contatore nuovo", "New meter"),
    senzaNome: t("Contatore senza nome", "Unnamed meter"),
    salva: t("Salva contatore", "Save meter"),
    salvato: `${t("Contatore salvato", "Meter saved")}`,
    etichettaEntita: t("Entità del sensore", "Sensor entity"),
    segnaposto: "sensor.contatore_acqua",
    aiutoEntita: t(
      "Il contatore che conta (total o total_increasing), oppure il sensore della pressione, della portata o del sale.",
      "The meter that counts (total or total_increasing), or the pressure, flow or salt sensor.",
    ),
    segnapostoNome: t("Contatore acqua", "Water meter"),
    aiutoNome: t(
      "Come si chiama per te: è questo che si legge nella pagina.",
      "What you call it: this is what the page reads.",
    ),
    muta: t(
      "Finché non scegli l'entità questo contatore non si vede: né nella pagina, né nella tessera in Home.",
      "Until you pick the entity this meter is nowhere: not on the page, not on the Home tile.",
    ),
    importa: (quanti) =>
      t(
        `Prendi i ${quanti} contatori che Home Assistant ha trovato`,
        `Take the ${quanti} meters Home Assistant found`,
      ),
    presi: (quanti) => t(`${quanti} contatori aggiunti`, `${quanti} meters added`),
    notaImporta: t(
      "Li mette qui come righe, una volta sola: da lì in poi sono tue — le rinomini, gli dai il disegno, e quelle che elimini non tornano più.",
      "It puts them here as rows, once: from then on they are yours — rename them, give them a drawing, and the ones you remove do not come back.",
    ),
  },

  /* Come stanno adesso le righe scritte: la pagina e la scheda le leggono
   * dalla stessa funzione. */
  leggi(elenco) {
    const states = allStates();
    return new Map(
      contatoriDiCasa(states, { righe: elenco }, (entity) =>
        nomeDaHomeAssistant(entity, states),
      ).map((letta) => [letta.entity, letta]),
    );
  },

  daImportare(config) {
    const states = allStates();
    return contatoriDaImportare(states, config, (entity) => nomeDaHomeAssistant(entity, states));
  },

  statoDellaRiga: (letta) => (letta?.muto ? "muta" : "bene"),
  didascalia: (letta) => (letta ? nomiDeiGeneri()[letta.genere] || "" : ""),
  accanto: valoreDellaRiga,

  /* Cambiare il genere cambia le caselle: il prezzo non c'è per la
   * pressione, la forcella non c'è per il gas. Si salva quello che c'è
   * scritto e si ridisegna, come quando si tocca un disegno. E il disegno di
   * serie segue il genere, se era quello di serie del genere di prima. */
  inPiuAllInstallazione(documento, { ridisegna, configurazione, salva }) {
    documento.addEventListener("change", (evento) => {
      const tendina = evento.target?.closest?.("[data-dm-cont-genere]");
      if (!tendina) return;
      const body = documento.getElementById("ed-body");
      if (!body?.contains(tendina)) return;
      const indice = Number(tendina.dataset.dmContGenere);
      if (!Number.isInteger(indice)) return;
      const prima = (righeDichiarate(configurazione(), CAMPI_IN_PIU) || [])[indice] || {};
      const campo = (nome) =>
        body.querySelector(`[data-dm-dich-campo="${nome}"][data-dm-dich-riga="${indice}"]`)?.value;
      const bozza = {
        ...prima,
        entity: clean(campo("entity") ?? prima.entity),
        name: clean(campo("name") ?? prima.name),
        icon: clean(campo("icon") ?? prima.icon),
      };
      const riga = conICampiDelContatore(bozza, body, indice);
      if (!bozza.icon || bozza.icon === disegnoDelGenere(genereDellaRiga(prima)))
        riga.icon = disegnoDelGenere(riga.genere);
      salva(conLaRiga(configurazione(), indice, riga, CAMPI_IN_PIU));
      ridisegna();
    });
  },
});

/* I tre nomi con cui il resto della plancia chiama questa scheda. Sono
 * funzioni dichiarate: il pacchetto si prova cercando `function install...`. */
export function ensureContatoriEditor() {
  return scheda.disegnaScheda();
}
export function ensureContatoriEditorTab() {
  return scheda.disegnaLinguetta();
}
export function installContatoriEditor() {
  return scheda.installa();
}

installContatoriEditor();
