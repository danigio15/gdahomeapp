import {
  flowPeriodEntity,
  flowRecorderEntity,
  flowStageModel,
  fonteDiRipiego,
} from "../core/energy-flow-topology.js";
import {
  allocateSourceFlows,
  batteryReadout,
  laQuadraturaNonTorna,
} from "../core/energy-flow-truth.js";
import { specchioDeiCerchi } from "../core/energy-loads-config.js";
import { cerchiDelleStanze } from "../core/i-cerchi-delle-stanze.js";
import {
  domandaDeiKwhDallaPotenza,
  domandaDellaStoria,
  inizioDelPeriodo,
  kwhDallaPotenza,
  kwhDallaStoriaDelContatore,
  kwhDallaStoriaDellaPotenza,
} from "../core/kwh-dalla-potenza.js";
import { applySignedSources, wattsFromState } from "../core/signed-energy.js";
import { vehicleBatteryEntity } from "./ev-section.js";
import {
  IMPIANTO_SCELTO_KEY,
  cerchiDalleStanzeAccesi,
  elettrodomesticiDellImpianto,
  pianiNelFlusso,
  plantAt,
  plantList,
  plantLoads,
  plantModel,
} from "../core/energy-plants.js";
import {
  allStates,
  clean,
  dashboardStore,
  doc,
  installStyle,
  locale,
  readJson,
  root,
  scriviTestoSeCambia,
  section,
  t,
  wrapFunction,
  writeIconGlyph,
  senzaCadere,
} from "./shared.js";

root.__DM_20260817A__ = true;
const KEY = "__DASHBOARDMODERN_ENERGY_FLOW_SECTION__";
const state = (root[KEY] ||= { installed: false, frame: 0, attesaMisura: 0 });

const COLORS = Object.freeze({
  solar: "#ff9f0a",
  grid: "#2563eb",
  battery: "#14b8a6",
  home: "#2563eb",
});

/* Beta 30 owns every load bubble below Home. The five hand-authored circles in
 * the legacy stage stay in the document — other owners still address them — but
 * they are hidden and replaced by one computed bubble per configured Load. */
const FLOW_VIEWS = Object.freeze([
  { period: "instant", id: "view-ist", suffix: "" },
  { period: "day", id: "view-day", suffix: "-day" },
  { period: "month", id: "view-month", suffix: "-month" },
]);

const LEGACY_LOAD_SELECTOR = ".node.n-load,[id^='line-home-'],[id^='m-line-home-']";
const SVG_NS = "http://www.w3.org/2000/svg";

function stateNumber(states, entity) {
  const value = states?.[entity]?.state ?? states?.[entity];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/* Lo stato di carica della batteria ha un padrone solo, ed e' questo.
 *
 * Ne aveva quattro. Il guscio scriveva `75 %` col suo formattatore; questo
 * modulo scriveva `75%`; `beta22-load-slots-hotfix` scriveva `SOC 75%`; e
 * `beta24-energy-recovery` teneva un MutationObserver sul nodo che rimetteva
 * il prefisso «SOC» addosso a quello che scrivevano gli altri. Quattro mani
 * sullo stesso numero, con tre forme diverse: quello che si vedeva era il
 * numero che cambiava faccia a ogni cambio di stato — «▼ 1796 W / SOC 75%» e
 * poi «-1796 W / 75 %», avanti e indietro. Era lo sfarfallio della sezione
 * Energia, e non era un difetto di disegno: erano due testi che si
 * alternavano.
 *
 * Adesso scrive solo questo. Il prefisso «SOC» che avevano scelto gli altri
 * due se n'e' andato su richiesta: sotto la freccia e i watt della batteria
 * la percentuale si spiega da sola, e la sigla la sporcava. Passa dal
 * delegato, che lascia il cartello `data-dm-padrone`: e' quel cartello che
 * ferma la mano del guscio.
 */
export function renderBatterySoc(targetDocument, energy = {}, states = {}) {
  const node = nodoDelSoc(targetDocument);
  if (!node) return "—";
  const entity = clean(
    energy?.battery?.soc || energy?.battery?.battery_soc_entity || energy?.battery?.battery_soc,
  );
  /* Senza entita' configurata la casella non si mostra vuota: si toglie.
   * Il comportamento arriva da beta22, che qui dentro non c'e' piu'. */
  if (!entity) {
    node.hidden = true;
    scriviTestoSeCambia(node, "");
    node.removeAttribute("data-entity");
    return "—";
  }
  const value = stateNumber(states, entity);
  const text = value === null ? "—" : `${Math.round(value)}%`;
  node.hidden = false;
  scriviTestoSeCambia(node, text);
  if (node.dataset.entity !== entity) node.dataset.entity = entity;
  return text;
}

/* La casella nasce qui se il guscio non l'ha disegnata: prima la creava
 * beta22, ed e' l'unica ragione per cui quel modulo toccava questo nodo. */
function nodoDelSoc(targetDocument) {
  const gia = targetDocument?.getElementById?.("v-battery-soc");
  if (gia) return gia;
  const bolla = targetDocument?.querySelector?.("#view-ist #n-battery,#n-battery");
  if (!bolla) return null;
  const nuovo = targetDocument.createElement("small");
  nuovo.id = "v-battery-soc";
  nuovo.className = "dm-battery-soc";
  bolla.append(nuovo);
  return nuovo;
}

function parseNumber(node) {
  const source = String(node?.textContent || "").trim();
  const match = source.match(/-?\d[\d.,]*/);
  if (!match) return 0;
  let token = match[0];
  const comma = token.lastIndexOf(",");
  const dot = token.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    if (comma > dot) token = token.replaceAll(".", "").replace(",", ".");
    else token = token.replaceAll(",", "");
  } else if (comma >= 0) token = token.replace(",", ".");
  const value = Number(token);
  return Number.isFinite(value) ? value : 0;
}

function numberFrom(node) {
  return Math.abs(parseNumber(node));
}

/* Writing a style property that already holds that value is not free: it is a
 * mutation record for every observer on the page and a style invalidation for
 * the engine. This stage rewrites a dozen properties per line on every pass,
 * several passes a second, and almost all of them are unchanged. */
function setStyleProperty(node, name, value, priority = "") {
  if (!node?.style) return;
  if (
    node.style.getPropertyValue(name) === value &&
    node.style.getPropertyPriority(name) === priority
  )
    return;
  node.style.setProperty(name, value, priority);
}

/* Lo stesso, per i dati.
 *
 * Un `data-` riscritto col valore che ha gia' e' comunque una scrittura
 * sull'attributo: sveglia ogni osservatore della pagina e invalida lo stile
 * del nodo. La scena lo faceva per ogni bolla e per ogni linea, a ogni
 * passata, e le passate sono piu' d'una al secondo: **millesettecento
 * scritture in quattro secondi con gli stati fermi**. Dietro un popup aperto,
 * dove il velo ha una sfocatura che rilegge lo sfondo, ognuna di quelle e' una
 * sfocatura da rifare. */
function scriviDatoSeCambia(node, chiave, valore) {
  if (!node?.dataset) return;
  if (node.dataset[chiave] === valore) return;
  node.dataset[chiave] = valore;
}

/* Is this node on screen?
 *
 * The answer costs a style resolution, and the stage asks it for every value
 * node and every span inside it, on every pass — around two hundred times a
 * second on an idle dashboard, which is the single busiest thing the plancia
 * does when nothing is happening. Within one pass the answer cannot change, so
 * it is asked once per node and remembered until the next pass. */
const visibility = { token: 0, cache: new WeakMap() };

function beginVisibilityPass() {
  visibility.token += 1;
}

function nodeVisible(node) {
  if (!node || node.hidden) return false;
  const cached = visibility.cache.get(node);
  if (cached && cached.token === visibility.token) return cached.value;
  const style = root.getComputedStyle?.(node);
  const value = !(
    style &&
    (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0)
  );
  visibility.cache.set(node, { token: visibility.token, value });
  return value;
}

/* Saved per-slot flow-node customization (Beta 26/27). Only the values the user
 * actually stored are read: the normalized editor model would otherwise hand
 * back legacy defaults and rename the canonical Load. */
function flowNodeOverrides() {
  /* Con piu' di un impianto questo specchio non sa di chi parla.
   *
   * Le sue caselle sono posizionali — «boiler», «wb», «clima»… — una per
   * cerchio, e i cerchi del secondo impianto occupano le stesse: salvando
   * l'uno si riscrivevano le caselle dell'altro. Il risultato, dal campo:
   * «nel primo prende il nome del secondo, ma il valore di watt e' quello
   * originale» — il nome usciva da qui, i watt dal carico vero, ed erano di
   * due case diverse. Con piu' impianti si guarda solo il carico, che il suo
   * impianto ce l'ha scritto sopra. */
  const impianti = plantList(section("energy", {}) || {});
  return specchioDeiCerchi(readJson("cd_flow_nodes", null), impianti.length);
}

/* The hosted dashboard can render before the store exists; the legacy mirror in
 * localStorage is the same document. */
function tuttiICarichi() {
  const value = section("loads", null);
  if (Array.isArray(value)) return value;
  const stored = readJson("cd_loads", []);
  return Array.isArray(stored) ? stored : [];
}

/* I cerchi sotto Casa sono quelli dell'impianto scelto.
 *
 * Chi ha due contatori — «casa Persona 1» e «casa Persona 5» — sceglie l'impianto
 * dalle linguette in cima alla sezione, e da li' in giu' tutto parla di
 * quello: il misuratore, il fotovoltaico, la batteria. I carichi restavano
 * fuori dal patto, ed erano gli unici a comparire in tutti e due i flussi —
 * la lavatrice dell'altra casa in mezzo alla propria.
 *
 * Con un impianto solo non cambia niente: un carico senza impianto scritto
 * appartiene al primo, che e' il caso di chiunque non abbia mai chiesto il
 * secondo. */
function configuredLoads() {
  const carichi = tuttiICarichi();
  const scelto = clean(root.localStorage?.getItem(IMPIANTO_SCELTO_KEY));
  const { plant, index } = plantAt(section("energy", {}) || {}, scelto);
  return plant ? plantLoads(carichi, plant, index) : carichi;
}

/* The Recorder bundle is keyed by the meter entity, not by load id. Resolve it
 * once here so the pure model keeps taking a plain id -> value map. Day and
 * month are both available: a load metered only by its lifetime counter gets a
 * real figure for today, not just for the month. */
function bundleValuesFor(loads, period) {
  const bundle = period === "day" ? state.bundle?.deviceDay : state.bundle?.deviceMonth;
  const devices = bundle?.devices || [];
  const values = bundle?.values;
  const resolved = {};
  if (!values?.get) return resolved;
  for (const load of loads) {
    const device = devices.find(
      (item) =>
        clean(item.id) === clean(load.id) ||
        clean(item.key) === clean(load.id) ||
        clean(item.name) === clean(load.name),
    );
    const source =
      clean(device?.history || device?.entity) ||
      flowRecorderEntity(load) ||
      flowPeriodEntity(load, period);
    const value = Number(values.get(source));
    if (Number.isFinite(value)) resolved[chiaveDellaVoce(load)] = value;
  }
  return resolved;
}

const chiaveDellaVoce = (voce) => clean(voce?.id) || clean(voce?.name);

/* I numeri del periodo di ogni voce, e quali sono ancora in viaggio.
 *
 * Prima il paniere del Recorder; poi, per chi ha solo la potenza, i suoi
 * kilowattora ricavati (la sua voce vince: il paniere per lui non ha un
 * contatore — nel mese leggerebbe lo stato dei watt come se fossero
 * kilowattora). E per chi resta senza numero — il giornaliero «unavailable»
 * all'avvio, il totale senza statistiche, la casella dei modelli vecchi — la
 * fonte di ripiego (`fonteDiRipiego`): la crescita del contatore o i watt,
 * dalla storia. Era la strada che mancava, e il cerchio restava a «—». */
function lettureDelPeriodo(loads, period) {
  const valori = bundleValuesFor(loads, period);
  const attese = new Set();
  if (period !== "day" && period !== "month") return { valori, attese };
  const states = allStates();
  const richieste = [];
  const perVoce = [];
  for (const voce of loads) {
    const chiave = chiaveDellaVoce(voce);
    if (!chiave) continue;
    const potenza = soloPotenza(voce);
    if (potenza) {
      perVoce.push([chiave, { kind: "potenza", entity: potenza }]);
      continue;
    }
    if (Number.isFinite(valori[chiave])) continue;
    const diretta = flowPeriodEntity(voce, period, states);
    if (diretta && Number.isFinite(Number(states?.[diretta]?.state))) continue;
    const fonte = fonteDiRipiego(voce, period, states);
    if (!fonte) continue;
    const entity = resolvedEntity(fonte.entity);
    /* Un totale di vita lo legge il paniere del Recorder: finche' il primo
     * paniere non e' arrivato si aspetta lui, invece di chiedere la storia di
     * tutti i contatori all'avvio. */
    if (
      fonte.kind === "contatore" &&
      !state.bundle &&
      Date.now() - (state.installatoAlle || 0) < 60_000
    ) {
      attese.add(chiave);
      continue;
    }
    perVoce.push([chiave, { kind: fonte.kind, entity }]);
  }
  for (const [, richiesta] of perVoce) richieste.push(richiesta);
  chiediIKwh(period, richieste);
  const memoria = state.kwhRicavati?.[period];
  for (const [chiave, { kind, entity }] of perVoce) {
    const id = `${kind}:${entity}`;
    if (memoria?.valori.has(id)) valori[chiave] = memoria.valori.get(id);
    else if (memoria?.inCorso.has(id)) attese.add(chiave);
  }
  return { valori, attese };
}

function recorderValuesFor(loads, period) {
  const { valori } = lettureDelPeriodo(loads, period);
  return Object.keys(valori).length ? valori : null;
}

/* ── i kilowattora di chi non ha un contatore che risponde ───────────────
 *
 * Giornaliera e Mensile leggono un contatore: il suo stato del giorno o del
 * mese, o la crescita del contatore di vita nel Recorder. Un elettrodomestico
 * con la sola presa che misura i watt non ha niente di tutto questo, e nel
 * cerchio della sua stanza contava zero. I suoi kilowattora si ricavano dalle
 * medie orarie della potenza (`core/kwh-dalla-potenza.js`) e, quando il
 * sensore le medie non le ha — niente `state_class` — dalla storia dei suoi
 * stati. Si chiedono una volta ogni dieci minuti per periodo, e arrivati si
 * ridisegna. */
const ATTESA_DEI_KWH = 10 * 60 * 1000;
const CAMPI_DEI_CONTATORI = Object.freeze([
  "daily_energy_entity",
  "daily",
  "monthly_energy_entity",
  "monthly",
  "total_energy_entity",
  "history_entity",
  "energy_entity",
]);

function soloPotenza(voce) {
  if (!clean(voce?.power_entity) && !clean(voce?.power)) return "";
  if (CAMPI_DEI_CONTATORI.some((campo) => clean(voce?.[campo]))) return "";
  return resolvedEntity(clean(voce.power_entity) || clean(voce.power));
}

/* Di quale giorno, o di quale mese, sono i numeri tenuti: a mezzanotte quelli
 * di ieri non valgono piu'. */
function chiaveDelPeriodo(periodo, adesso = Date.now()) {
  const data = new Date(adesso);
  return periodo === "month" ? `${data.getFullYear()}-${data.getMonth() + 1}` : data.toDateString();
}

/* La memoria e' per entita', non per elenco. Era una sola voce per periodo,
 * firmata dall'elenco di chi l'aveva chiesta: il flusso chiede tutti i
 * carichi, la finestra di una stanza solo i suoi figli, e ogni elenco diverso
 * buttava via i valori dell'altro. Il cerchio del boiler restava senza numero
 * — «—» — finche' il giro dopo non lo richiedeva. Adesso ogni entita' tiene il
 * suo valore e la sua ora: si chiede solo chi manca o e' vecchio, e quello
 * che arriva si aggiunge a quello che c'era. */
function memoriaDei(periodo) {
  const memorie = (state.kwhRicavati ||= {});
  const chiave = chiaveDelPeriodo(periodo);
  if (memorie[periodo]?.chiave !== chiave)
    memorie[periodo] = {
      chiave,
      valori: new Map(),
      quando: new Map(),
      inCorso: new Set(),
    };
  return memorie[periodo];
}

function chiediIKwh(periodo, richieste) {
  const broker = root.DashboardModernEnergyService?.broker;
  if (!broker?.request || !richieste.length) return;
  const voce = memoriaDei(periodo);
  const adesso = Date.now();
  const daChiedere = [];
  const viste = new Set();
  for (const richiesta of richieste) {
    const id = `${richiesta.kind}:${richiesta.entity}`;
    if (viste.has(id)) continue;
    viste.add(id);
    if (voce.inCorso.has(id)) continue;
    if (adesso - (voce.quando.get(id) ?? -Infinity) < ATTESA_DEI_KWH) continue;
    daChiedere.push({ ...richiesta, id });
  }
  if (!daChiedere.length) return;
  for (const { id } of daChiedere) voce.inCorso.add(id);
  const chiudi = () => {
    for (const { id } of daChiedere) {
      voce.inCorso.delete(id);
      voce.quando.set(id, Date.now());
    }
  };
  ricavaIKwh(broker, periodo, daChiedere, adesso)
    .then((trovati) => {
      /* Il giorno puo' essere cambiato mentre la domanda viaggiava. */
      if (memoriaDei(periodo) !== voce) return;
      for (const [id, kwh] of trovati) voce.valori.set(id, kwh);
    })
    /* Niente Recorder, o la domanda e' scaduta: si riprova dopo l'attesa, e
     * intanto il cerchio tiene il numero che aveva. */
    .catch(() => {})
    .finally(() => {
      chiudi();
      refreshEnergyFlows();
    });
}

/* Prima le medie orarie per le potenze — leggere — poi la storia degli stati
 * per chi le medie non le ha, e per i contatori. */
async function ricavaIKwh(broker, periodo, daChiedere, adesso) {
  const stati = allStates();
  const unita = (entity) => stati[entity]?.attributes?.unit_of_measurement;
  const trovati = new Map();
  const potenze = daChiedere.filter((richiesta) => richiesta.kind === "potenza");
  if (potenze.length) {
    try {
      const medie = await broker.request(
        domandaDeiKwhDallaPotenza(
          potenze.map((richiesta) => richiesta.entity),
          periodo,
          adesso,
        ),
        15000,
      );
      for (const { id, entity } of potenze) {
        const kwh = kwhDallaPotenza(medie, entity, unita(entity) || "W");
        if (kwh !== null) trovati.set(id, kwh);
      }
    } catch (_errore) {
      /* Le medie non sono arrivate: si prova con la storia. */
    }
  }
  const dallaStoria = daChiedere.filter((richiesta) => !trovati.has(richiesta.id));
  if (!dallaStoria.length) return trovati;
  /* La storia che non arriva non butta via le medie gia' arrivate. */
  let storia;
  try {
    storia = await broker.request(
      domandaDellaStoria(
        dallaStoria.map((richiesta) => richiesta.entity),
        periodo,
        adesso,
      ),
      30000,
    );
  } catch (_errore) {
    return trovati;
  }
  const inizio = inizioDelPeriodo(periodo, adesso).getTime();
  for (const { id, kind, entity } of dallaStoria) {
    const kwh =
      kind === "potenza"
        ? kwhDallaStoriaDellaPotenza(storia, entity, unita(entity) || "W", inizio, adesso)
        : kwhDallaStoriaDelContatore(storia, entity, unita(entity) || "kWh");
    if (kwh !== null) trovati.set(id, kwh);
  }
  return trovati;
}

/** I kilowattora del periodo per chi ha solo la potenza, per id della voce. */
export function kwhDallaPotenzaPer(voci, periodo) {
  if (periodo !== "day" && periodo !== "month") return {};
  const perVoce = [];
  for (const voce of voci || []) {
    const entita = soloPotenza(voce);
    if (entita) perVoce.push([chiaveDellaVoce(voce), entita]);
  }
  chiediIKwh(
    periodo,
    perVoce.map(([, entity]) => ({ kind: "potenza", entity })),
  );
  const valori = state.kwhRicavati?.[periodo]?.valori;
  const fuori = {};
  if (!valori) return fuori;
  for (const [chiave, entita] of perVoce)
    if (valori.has(`potenza:${entita}`)) fuori[chiave] = valori.get(`potenza:${entita}`);
  return fuori;
}

/**
 * I kilowattora del periodo per ogni voce, come li conta il cerchio: il
 * paniere del Recorder, per chi ha solo la potenza le sue medie orarie, e per
 * chi ha un contatore che tace la sua storia. La finestra di un cerchio li usa
 * per dire gli stessi numeri del cerchio.
 */
export function kwhDelPeriodo(voci, periodo) {
  return recorderValuesFor(voci || [], periodo) || {};
}

/* ── l'ultimo numero letto resta ──────────────────────────────────────────
 *
 * Un cerchio che oggi ha gia' detto «1,1 kWh» non torna a «—» perche' al
 * riavvio di Home Assistant il suo sensore e' per un attimo «unavailable», o
 * perche' la pagina si e' appena aperta e il Recorder non ha ancora risposto.
 * Il numero si tiene per cerchio, per giorno (o mese) e per impianto, anche
 * fra un'apertura e l'altra della plancia; un numero nuovo lo sostituisce. */
const ULTIMI_NUMERI_KEY = "dm_flusso_ultimi_numeri";

function chiaveDeiRicordati(periodo) {
  const impianto = clean(root.localStorage?.getItem(IMPIANTO_SCELTO_KEY));
  return `${chiaveDelPeriodo(periodo)}|${impianto}`;
}

function ultimiNumeri(periodo) {
  const memorie = (state.ultimiNumeri ||= {});
  const chiave = chiaveDeiRicordati(periodo);
  if (memorie[periodo]?.chiave === chiave) return memorie[periodo];
  let salvati = null;
  try {
    salvati = JSON.parse(root.localStorage?.getItem(ULTIMI_NUMERI_KEY) || "null")?.[periodo];
  } catch (_errore) {
    salvati = null;
  }
  memorie[periodo] = {
    chiave,
    valori: salvati?.chiave === chiave && salvati.valori ? { ...salvati.valori } : {},
  };
  return memorie[periodo];
}

function ricordaINumeri(periodo, model) {
  if (periodo !== "day" && periodo !== "month") return;
  const memoria = ultimiNumeri(periodo);
  let cambiato = false;
  for (const nodo of model.nodes) {
    if (!Number.isFinite(nodo.value) || memoria.valori[nodo.id] === nodo.value) continue;
    memoria.valori[nodo.id] = nodo.value;
    cambiato = true;
  }
  if (!cambiato) return;
  try {
    const tutti = JSON.parse(root.localStorage?.getItem(ULTIMI_NUMERI_KEY) || "{}") || {};
    tutti[periodo] = { chiave: memoria.chiave, valori: memoria.valori };
    root.localStorage?.setItem(ULTIMI_NUMERI_KEY, JSON.stringify(tutti));
  } catch (_errore) {
    /* Senza memoria del browser il numero resta per questa apertura. */
  }
}

function configuredAppliances() {
  const value = section("appliances", null);
  if (Array.isArray(value)) return value;
  const stored = readJson("cd_appliances", []);
  return Array.isArray(stored) ? stored : [];
}

function stanzeDiCasa() {
  const stanze = section("rooms", null);
  return Array.isArray(stanze) ? stanze : readJson("cd_stanze", []);
}

/* Gli elettrodomestici dell'impianto scelto.
 *
 * Non piu' la regola dei carichi — «senza impianto vuol dire il primo» — ma la
 * loro: scritto, dedotto dal carico con la stessa potenza, dedotto dal piano
 * (`impiantoDellElettrodomestico`). Con due contatori un elettrodomestico che
 * non si sa dove sta non va da nessuna parte: e' quello che metteva la
 * lavatrice della zona notte nel «Bagno» della zona giorno. Con un impianto
 * solo sono tutti suoi, come sempre. */
function appliancesOfThePlant(plant = impiantoScelto().plant) {
  const apparecchi = configuredAppliances();
  if (!plant) return apparecchi;
  return elettrodomesticiDellImpianto(apparecchi, plant, {
    impianti: plantList(section("energy", {}) || {}),
    carichi: tuttiICarichi(),
    stanze: stanzeDiCasa(),
  });
}

function impiantoScelto() {
  const scelto = clean(root.localStorage?.getItem(IMPIANTO_SCELTO_KEY));
  return plantAt(section("energy", {}) || {}, scelto);
}

/**
 * I carichi e gli elettrodomestici come li legge il flusso: per stanza, con la
 * Wallbox a se' (`core/i-cerchi-delle-stanze.js`). Li legge anche la finestra
 * che si apre toccando un cerchio, cosi' il cerchio e la sua finestra parlano
 * della stessa stanza.
 */
export function carichiDelFlusso() {
  const { plant } = impiantoScelto();
  const loads = configuredLoads();
  const appliances = appliancesOfThePlant(plant);
  /* L'impianto puo' dire di no ai cerchi automatici: allora il flusso e'
   * quello dei carichi scritti a mano, e gli elettrodomestici restano dove li
   * mettono i carichi (dentro un cerchio, se qualcuno ce li ha messi). */
  if (plant && !cerchiDalleStanzeAccesi(plant)) return { loads, appliances, perStanza: false };
  return cerchiDelleStanze({
    loads,
    appliances,
    rooms: stanzeDiCasa(),
    entitaDellaWallbox: WALLBOX_REFS.map(resolvedEntity).filter(Boolean),
    altro: t("Altro", "Other"),
    perPiano: Boolean(plant && pianiNelFlusso(plant)),
  });
}

/* L'entita' vera dietro un riferimento della configurazione. */
function resolvedEntity(reference) {
  const id = clean(reference);
  if (!id) return "";
  try {
    return clean(root.resolveEntity?.(id)) || id;
  } catch (_error) {
    return id;
  }
}

/* C'e' un'auto da aprire?
 *
 * Il cerchio della Wallbox porta al popup dell'auto solo se un'auto c'e'
 * davvero: serve la batteria del veicolo mappata su un'entita' che Home
 * Assistant conosce, e serve il popup nel documento. Senza queste due cose il
 * cerchio resta com'era, con il suo storico — meglio un grafico che una
 * finestra vuota.
 *
 * Le entita' che tornano indietro sono quelle che la sezione Auto legge dalla
 * wallbox: un carico che punta a una di quelle e' la wallbox, comunque si
 * chiami. */
const WALLBOX_REFS = Object.freeze([
  "dm.ev_potenza_wallbox",
  "dm.ev_charge_power",
  "dm.ev_energia_wallbox_oggi",
  "dm.ev_energia_wallbox_mese",
]);

function vehiclePopupTarget() {
  if (typeof root.apriPopup !== "function") return null;
  if (!doc?.getElementById?.("ev-popup")) return null;
  const states = allStates();
  // La carica dell'auto sta scritta in cinque posti accettati, non in uno:
  // chi decide quale vale e' la sezione Auto, e la risposta arriva da li'.
  const battery = resolvedEntity(vehicleBatteryEntity());
  if (!battery || !states[battery]) return null;
  const entities = [];
  for (const reference of WALLBOX_REFS) {
    const entity = resolvedEntity(reference);
    if (entity && entity !== reference) entities.push(entity);
  }
  return { entities };
}

function stageModel(period) {
  const { loads, appliances, perStanza } = carichiDelFlusso();
  const model = flowStageModel({
    loads,
    appliances,
    /* I ritocchi dei cerchi vecchi — nome, icona, colore per posto — valgono
     * per i carichi scritti a mano: sui cerchi delle stanze il primo posto non
     * e' piu' il «boiler» di una volta. */
    flowNodes: perStanza ? null : flowNodeOverrides(),
    states: allStates(),
    period,
    /* Anche gli apparecchi, non solo i carichi: quando il cerchio di gruppo
     * somma quello che ha dentro, i figli sono apparecchi — e cercarli in un
     * paniere che contiene i soli carichi vuol dire una somma che non trova
     * niente. Il paniere del Recorder e' l'unico posto dove un apparecchio
     * misurato dal solo contatore di vita ha un numero per oggi. */
    ...letturePerLaScena([...loads, ...appliances], period),
    locale: locale(),
    wallbox: vehiclePopupTarget(),
  });
  ricordaINumeri(period, model);
  return model;
}

function letturePerLaScena(voci, period) {
  if (period === "instant") return { recorderValues: null };
  const { valori, attese } = lettureDelPeriodo(voci, period);
  return {
    recorderValues: Object.keys(valori).length ? valori : null,
    inAttesa: attese,
    ricordati: ultimiNumeri(period).valori,
  };
}

function rememberConnectorVisibility(node) {
  if (!node || node.dataset.dmFlowVisibilityCaptured === "true") return;
  node.dataset.dmFlowVisibilityCaptured = "true";
  node.dataset.dmFlowWasHidden = node.hidden ? "true" : "false";
  node.dataset.dmFlowDisplay = node.style.getPropertyValue("display") || "";
  node.dataset.dmFlowDisplayPriority = node.style.getPropertyPriority("display") || "";
  node.dataset.dmFlowVisibility = node.style.getPropertyValue("visibility") || "";
  node.dataset.dmFlowVisibilityPriority = node.style.getPropertyPriority("visibility") || "";
}

function restoreConnectorVisibility(node) {
  if (!node || node.dataset.dmFlowVisibilityCaptured !== "true") return;
  node.hidden = node.dataset.dmFlowWasHidden === "true";
  const display = node.dataset.dmFlowDisplay || "";
  const displayPriority = node.dataset.dmFlowDisplayPriority || "";
  const visibility = node.dataset.dmFlowVisibility || "";
  const visibilityPriority = node.dataset.dmFlowVisibilityPriority || "";
  if (display) setStyleProperty(node, "display", display, displayPriority);
  else node.style.removeProperty("display");
  if (visibility) setStyleProperty(node, "visibility", visibility, visibilityPriority);
  else node.style.removeProperty("visibility");
  for (const key of [
    "dmFlowVisibilityCaptured",
    "dmFlowWasHidden",
    "dmFlowDisplay",
    "dmFlowDisplayPriority",
    "dmFlowVisibility",
    "dmFlowVisibilityPriority",
  ])
    delete node.dataset[key];
}

function exposeConnector(node, active) {
  if (!node) return;
  if (active) {
    if (node.dataset.dmFlowForcedVisible !== "true") rememberConnectorVisibility(node);
    if (node.hidden) node.hidden = false;
    setStyleProperty(node, "display", "inline", "important");
    setStyleProperty(node, "visibility", "visible", "important");
    scriviDatoSeCambia(node, "dmFlowForcedVisible", "true");
  } else if (node.dataset.dmFlowForcedVisible === "true") {
    restoreConnectorVisibility(node);
    scriviDatoSeCambia(node, "dmFlowForcedVisible", "false");
  }
}

/* Il binario sotto la linea.
 *
 * La linea accesa adesso e' fatta di puntini che scorrono: belli, ma da soli
 * non dicono dove vanno — fra un puntino e l'altro c'e' il vuoto. Sotto ci va
 * il suo binario, la stessa strada in tinta tenue e continua: si vede il
 * percorso intero, e i puntini ci corrono sopra. E' una copia della linea —
 * stessa forma, stesso colore — che sta un gradino sotto di lei e non si
 * tocca. Si rifa' la forma solo se la linea l'ha cambiata. */
const FORME = ["d", "x1", "y1", "x2", "y2", "points"];

function binario(node, color, active) {
  const madre = node.parentNode;
  if (!madre || !/^(path|line|polyline)$/i.test(node.tagName)) return;
  let sotto = node.__dmBinario;
  if (!sotto || sotto.parentNode !== madre) {
    sotto = doc.createElementNS(SVG_NS, node.tagName.toLowerCase());
    sotto.classList.add("dm-flow-binario");
    sotto.setAttribute("aria-hidden", "true");
    madre.insertBefore(sotto, node);
    node.__dmBinario = sotto;
  }
  /* La scia di luce si misura in centesimi del percorso, qualunque sia la sua
   * lunghezza: una linea corta e una lunga hanno la stessa cometa. */
  if (node.getAttribute("pathLength") !== "100") node.setAttribute("pathLength", "100");
  for (const nome of FORME) {
    const valore = node.getAttribute(nome);
    if (valore === null) continue;
    if (sotto.getAttribute(nome) !== valore) sotto.setAttribute(nome, valore);
  }
  setStyleProperty(sotto, "--dm-flow-color", color);
  const larghezza = node.style?.getPropertyValue?.("--dm-flow-width");
  if (larghezza) setStyleProperty(sotto, "--dm-flow-width", larghezza);
  scriviDatoSeCambia(sotto, "acceso", active ? "true" : "false");
}

function colorNode(node, color, active) {
  if (!node) return;
  exposeConnector(node, active);
  binario(node, color, active);
  node.classList.toggle("active", active);
  node.classList.toggle("dm-energy-flow-active", active);
  node.classList.toggle("dm-energy-flow-idle", !active);
  setStyleProperty(node, "--dm-flow-color", color);
  // Every write here is an attribute write, and an attribute written with the
  // value it already holds still wakes every observer on the page. The stage
  // does this for each connector a few times a second.
  const animated = active ? "true" : "false";
  if (node.dataset.dmFlowAnimated !== animated) node.dataset.dmFlowAnimated = animated;
  if (/^(path|line|polyline|circle)$/i.test(node.tagName)) {
    /* Il colore riletto dallo stile non e' quello scritto — «#0ea5e9» torna
     * «rgb(14, 165, 233)» — e il confronto diretto riscriveva ogni volta. Il
     * segno di cosa si e' scritto sta a parte. */
    const stroke = active ? color : "var(--divider-color,#dbe4ee)";
    if (node.dataset.dmFlowStroke !== stroke) {
      node.dataset.dmFlowStroke = stroke;
      node.style.stroke = stroke;
    }
    if (node.getAttribute("fill") && node.getAttribute("fill") !== "none") {
      const fill = active ? color : "var(--divider-color,#dbe4ee)";
      if (node.dataset.dmFlowFill !== fill) {
        node.dataset.dmFlowFill = fill;
        node.style.fill = fill;
      }
    }
  }
}

function scopeFor(period) {
  if (period === "day") return doc?.getElementById("view-day");
  if (period === "month") return doc?.getElementById("view-month");
  return doc?.getElementById("view-ist");
}

/* Escaping an id for a CSS attribute selector: ids come from persisted config
 * and are not guaranteed to be identifier-safe. */
const cssEscape = (value) => String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');

/* Le bolle vecchie si spengono con un foglio, non nodo per nodo a ogni giro.
 *
 * Misurato: seicentotrenta scritture di `hidden = true` in quaranta passate, su
 * nodi che erano gia' nascosti. Due difetti in uno. Il primo e' lo spreco: ogni
 * scrittura e' una modifica al documento e un ricalcolo di stile, per non
 * cambiare niente. Il secondo e' peggio, ed e' quello che si vede: fra il
 * momento in cui il guscio ridisegna una di quelle bolle e il fotogramma in cui
 * questo modulo la rinasconde c'e' una finestra in cui la bolla e' visibile —
 * un cerchio vuoto che compare e sparisce in fondo al flusso.
 *
 * Una regola di stile non ha quella finestra: vale dall'istante in cui il nodo
 * esiste, senza aspettare nessun giro di disegno. Il marchio sul nodo resta
 * perche' e' lui che dice «questa l'ha sostituita il flusso nuovo», e la
 * regola lo legge. */
/* La regola vale su tutte e tre le viste — Istantaneo, Giorno, Mese — perche'
 * le bolle a posto fisso stanno in tutte e tre, e in tutte e tre c'e' qualcun
 * altro che decide di mostrarle: la scheda dei nodi, e il completatore degli
 * slot che riaccende la linea del Wallbox quando in casa c'e' un'auto. Scritta
 * per la sola vista Istantanea, la difesa copriva un terzo del problema. */
function regolaDelleBolleVecchie() {
  return `${FLOW_VIEWS.flatMap(({ id }) =>
    LEGACY_LOAD_SELECTOR.split(",").map(
      (pezzo) => `#${id} ${pezzo.trim()}:not([data-dm-flow-node]):not([data-dm-flow-arc])`,
    ),
  ).join(",")}{display:none!important}`;
}

function hideLegacyLoadTopology(stage) {
  stage?.querySelectorAll?.(LEGACY_LOAD_SELECTOR).forEach((node) => {
    if (node.dataset.dmFlowNode || node.dataset.dmFlowArc) return;
    /* Gia' fatto: non si riscrive. Il marchio e' il ricordo. */
    if (node.dataset.dmLegacyEnergyLoad === "replaced") return;
    node.hidden = true;
    setStyleProperty(node, "display", "none", "important");
    node.dataset.dmLegacyEnergyLoad = "replaced";
  });
}

function writeIcon(target, icon) {
  if (!target || target.dataset.dmFlowIcon === icon) return;
  target.dataset.dmFlowIcon = icon;
  writeIconGlyph(target, icon, { size: 28, kind: "load" });
}

function bindNodeClick(element, node, period) {
  const click = node.click;
  const signature = click ? `${click.kind}:${click.target || click.entity || ""}` : "";
  if (element.dataset.dmFlowClick === signature) return;
  element.dataset.dmFlowClick = signature;
  element.classList.toggle("hist-clickable", Boolean(click));
  element.onclick = click
    ? (event) => {
        if (click.kind === "ev") root.apriPopup?.();
        else if (click.kind === "subloads") root.apriSubLoads?.(click.target);
        else root.apriStorico?.(event, click.entity, click.title);
      }
    : null;
  if (click) element.dataset.dmFlowClickPeriod = period;
}

/* Il nome dentro il cerchio: «il testo non entra, deve essere adattato».
 * In cima un cerchio e' piu' stretto che al centro, e «LOCALE TECNICO» usciva
 * dai bordi anche coi puntini. Il nome va su due righe se serve, e la scritta
 * scende di mezzo pixel alla volta finche' non entra — non sotto i 6 px. Si
 * rifa' solo quando cambiano il nome o la misura del cerchio. */
const NOME_PIU_PICCOLO = 8;

function adattaIlNome(cerchio, nome) {
  const largo = cerchio?.clientWidth || 0;
  if (!nome || !largo) return;
  const chiave = `${nome.textContent}|${largo}`;
  if (nome.dataset.dmAdattato === chiave) return;
  nome.style.removeProperty("font-size");
  delete nome.dataset.dmNomeLungo;
  const stile = doc.defaultView?.getComputedStyle?.(nome);
  let misura = Number.parseFloat(stile?.fontSize) || 0;
  const troppo = () =>
    nome.scrollWidth > nome.clientWidth + 1 || nome.scrollHeight > misura * 1.1 * 2 + 1;
  while (misura > NOME_PIU_PICCOLO && troppo()) {
    misura -= 0.5;
    nome.style.setProperty("font-size", `${misura}px`, "important");
  }
  /* Una parola sola che non entra nemmeno cosi': una riga, coi puntini. */
  if (troppo()) nome.dataset.dmNomeLungo = "true";
  nome.dataset.dmAdattato = chiave;
}

function ensureBubble(stage, node, period, scale) {
  let element = stage.querySelector(`[data-dm-flow-node="${cssEscape(node.id)}"]`);
  if (!element) {
    element = doc.createElement("div");
    element.className = "node n-load dm-flow-node";
    element.dataset.dmFlowNode = node.id;
    for (const [tag, className] of [
      ["div", "node-label"],
      ["div", "node-icon"],
      ["span", "dm-flow-value"],
    ]) {
      const child = doc.createElement(tag);
      child.className = className;
      element.append(child);
    }
    stage.append(element);
  }
  setStyleProperty(element, "left", `${node.desktop.left}%`);
  setStyleProperty(element, "top", `${node.desktop.top}%`);
  setStyleProperty(element, "--n-color", node.color);
  setStyleProperty(element, "--dm-flow-color", node.color);
  setStyleProperty(element, "--dm-flow-scale", String(scale));
  setStyleProperty(element, "--dm-flow-mobile-left", `${node.mobile.left}%`);
  setStyleProperty(element, "--dm-flow-mobile-top", `${node.mobile.top}%`);
  const label = element.querySelector(".node-label");
  scriviTestoSeCambia(label, node.name);
  adattaIlNome(element, label);
  writeIcon(element.querySelector(".node-icon"), node.icon);
  const value = element.querySelector(".dm-flow-value");
  scriviTestoSeCambia(value, node.text);
  scriviDatoSeCambia(element, "dmCanonicalLoad", node.id);
  scriviDatoSeCambia(element, "dmFlowPeriod", period);
  scriviDatoSeCambia(element, "dmFlowActive", node.active ? "true" : "false");
  /* «…» e' un numero in viaggio; «—» senza sensore e' un cerchio a cui manca
   * la configurazione, e passandoci sopra lo dice. */
  scriviDatoSeCambia(element, "dmFlowWaiting", node.waiting ? "true" : "false");
  scriviDatoSeCambia(element, "dmFlowSensore", node.sensore === false ? "false" : "true");
  const suggerimento =
    node.sensore === false
      ? t("Nessun sensore collegato.", "No sensor linked.")
      : node.waiting
        ? t("Sto leggendo i consumi da Home Assistant…", "Reading consumption from Home Assistant…")
        : "";
  if ((element.title || "") !== suggerimento) element.title = suggerimento;
  bindNodeClick(element, node, period);
  return element;
}

function ensureArc(svg, node, variant) {
  if (!svg) return null;
  let path = svg.querySelector(`[data-dm-flow-arc="${cssEscape(node.id)}"]`);
  if (!path) {
    path = doc.createElementNS(SVG_NS, "path");
    path.dataset.dmFlowArc = node.id;
    path.classList.add("flow-line", "dm-flow-arc");
    svg.append(path);
  }
  const geometry = variant === "mobile" ? node.mobile : node.desktop;
  if (path.getAttribute("d") !== geometry.path) path.setAttribute("d", geometry.path);
  setStyleProperty(path, "--line-color", node.color);
  setStyleProperty(path, "--dm-flow-width", `${node.intensity.width}px`);
  setStyleProperty(path, "--dm-flow-duration", `${node.intensity.duration}s`);
  scriviDatoSeCambia(path, "dmFlowValue", String(node.value ?? ""));
  colorNode(path, node.color, node.active);
  return path;
}

function pruneStale(stage, keep) {
  stage.querySelectorAll("[data-dm-flow-node],[data-dm-flow-arc]").forEach((node) => {
    const id = node.dataset.dmFlowNode || node.dataset.dmFlowArc;
    if (!keep.has(id)) node.remove();
  });
}

/* Quanto si puo' stringere per starci davvero, oltre a quanto dice il modello.
 *
 * Il modello sa QUANTE bolle ci sono e le stringe di conseguenza — otto
 * scendono a 0,8 — ma non sa quanto e' largo il palco, e non puo' saperlo: e'
 * una domanda al documento, e quel modulo e' puro. Finche' la riga stretta
 * copriva i palchi sotto gli 820 la cosa non si vedeva; adesso che la soglia
 * e' una sola — quella del guscio, 768 — un palco da settecentoventicinque
 * punti puo' ritrovarsi otto bolle su una riga sola, e otto bolle da
 * novantadue ne chiedono settecentotrentasei: si sovrappongono di dodici.
 *
 * Le bolle stanno a centri equidistanti — `width*(i+1)/(n+1)` — quindi il
 * passo fra due centri e' la larghezza divisa per quante piu' una, e dentro
 * quel passo ci deve stare una bolla piu' un dito d'aria. Qui si guarda la
 * larghezza vera e si stringe quel tanto che basta. Non si ingrandisce mai:
 * il conto del modello resta il tetto. */
const ARIA_FRA_BOLLE = 16;
const QUANTO_STRETTE_AL_MASSIMO = 0.55;

/* Com'e' messa la scena adesso: quanto misura una bolla a riposo e se le bolle
 * stanno su una riga o su due.
 *
 * Sono due cose che decide il foglio di stile, e la stessa domanda si puo'
 * fare da qui con le stesse identiche parole. Farla in un altro modo —
 * guardare la larghezza del palco invece di quella della finestra, o scrivere
 * una terza soglia — vorrebbe dire due risposte alla stessa domanda, che e'
 * il difetto che questa passata e' venuta a togliere. */
const SOGLIE = Object.freeze([
  { quando: "(max-width: 480px)", bolla: 96, stretto: true },
  { quando: "(max-width: 768px)", bolla: 104, stretto: true },
]);

function comeSiamoMessi() {
  for (const soglia of SOGLIE) {
    try {
      if (root.matchMedia?.(soglia.quando)?.matches) return soglia;
    } catch (_errore) {}
  }
  return { bolla: 130, stretto: false };
}

/* Quante bolle stanno nella fila piu' affollata. Sul largo e' una riga sola;
 * sullo stretto sono due, e trattarle come una vorrebbe dire stringerle alla
 * meta' di quello che serve — otto bolle da cinquantuno punti al posto di
 * sessantotto, con la scritta dentro che non si legge piu'. */
function quanteInFila(nodes, stretto) {
  const perFila = new Map();
  for (const nodo of nodes) {
    const dove = stretto ? nodo.mobile?.top : nodo.desktop?.top;
    perFila.set(dove, (perFila.get(dove) || 0) + 1);
  }
  return perFila.size ? Math.max(...perFila.values()) : 1;
}

/* Il passo piu' stretto fra due bolle della stessa fila, in centesimi del
 * palco: lo dice il disegno, che sul telefono spartisce la larghezza in un
 * modo e sul largo in un altro. Chiederlo a lui invece di rifare il conto qui
 * vuol dire una regola sola. */
function passoPiuStretto(nodes, stretto) {
  const perFila = new Map();
  for (const nodo of nodes) {
    const dove = stretto ? nodo.mobile : nodo.desktop;
    if (!dove) continue;
    const fila = perFila.get(dove.top) || [];
    fila.push(Number(dove.left));
    perFila.set(dove.top, fila);
  }
  let passo = 0;
  for (const fila of perFila.values()) {
    fila.sort((a, b) => a - b);
    for (let i = 1; i < fila.length; i += 1) {
      const qui = fila[i] - fila[i - 1];
      if (qui > 0 && (!passo || qui < passo)) passo = qui;
    }
  }
  return passo;
}

function quantoCiStaNelPalco(stage, model, scala) {
  const largo = stage?.getBoundingClientRect?.().width || 0;
  const { bolla, stretto } = comeSiamoMessi();
  const inFila = quanteInFila(model.nodes, stretto);
  if (!largo || inFila <= 1) return scala;
  const passo = (largo * passoPiuStretto(model.nodes, stretto)) / 100 || largo / (inFila + 1);
  const ciSta = Math.max(0, passo - ARIA_FRA_BOLLE) / bolla;
  /* Sul telefono comanda solo lo spazio vero: il rimpicciolimento del modello
   * per «tante bolle» e' pensato per una fila sola, e su due file lo si
   * pagava due volte. */
  const tetto = stretto ? 1 : scala;
  return Math.max(QUANTO_STRETTE_AL_MASSIMO, Math.min(tetto, Number(ciSta.toFixed(3))));
}

/* Recovered from the Beta 22 dynamic renderer and adapted: it now replaces the
 * fixed topology instead of doubling it, covers the month view as well, and
 * draws its connectors in both the desktop and the mobile viewBox. */
export function renderDynamicFlowLoads(period, model = stageModel(period)) {
  const view = FLOW_VIEWS.find((entry) => entry.period === period);
  const scope = view ? doc?.getElementById(view.id) : null;
  const stage = scope?.querySelector?.(".flow-stage");
  if (!stage) return 0;
  hideLegacyLoadTopology(stage);
  const desktopSvg = stage.querySelector("svg.desktop-svg") || stage.querySelector("svg");
  const mobileSvg = stage.querySelector("svg.mobile-svg");
  const keep = new Set();
  const scala = quantoCiStaNelPalco(stage, model, model.scale);
  for (const node of model.nodes) {
    keep.add(node.id);
    ensureBubble(stage, node, period, scala);
    ensureArc(desktopSvg, node, "desktop");
    ensureArc(mobileSvg, node, "mobile");
  }
  pruneStale(stage, keep);
  scriviDatoSeCambia(stage, "dmFlowLoads", String(model.count));
  // Beta 5's secondary-flow completer stands down on a stage that already has a
  // canonical owner; keep publishing the count it looks for.
  scriviDatoSeCambia(scope, "dmCanonicalLoadCount", String(model.count));
  scriviDatoSeCambia(scope, "dmFlowOwner", "beta30");
  return model.count;
}

/* ── L'istantanea dice dove va davvero l'energia ─────────────────────────
 *
 * Le linee dell'istantanea si accendevano guardando un numero alla volta:
 * qualunque solare accendeva «solare → casa» anche quando finiva tutto in
 * batteria, la carica era sempre del solare anche di notte, e l'arco
 * «rete → batteria» non esisteva. Segnalato coi video: «il disegno mi indica
 * che rete e batteria stanno alimentando casa; in realta' rete alimenta casa
 * e ricarica batteria». I tre numeri si spartiscono con `allocateSourceFlows`
 * — letti dagli STATI, non dai testi delle bolle, che da qui in poi possono
 * dire grandezza e verso senza mandare in confusione nessun lettore. */

/* L'Energia dell'impianto scelto: il primo livello dell'oggetto salvato E' il
 * primo impianto, e chi legge senza scegliere legge sempre casa sua. */
function energiaDellImpianto() {
  const scelto = clean(root.localStorage?.getItem(IMPIANTO_SCELTO_KEY));
  return plantModel(section("energy", {}), scelto);
}

function potenzaViva(reference) {
  // `null` — non zero — quando lo stato vivo non c'e': «spento» e «non
  // configurato» sono due risposte diverse, e chi chiama deve poterle
  // distinguere per cedere il passo alla lettura dei testi.
  const entity = resolvedEntity(reference);
  const states = allStates();
  const nodo = states[entity] || states[clean(reference)];
  if (!nodo || nodo.state === undefined) return null;
  const raw = String(nodo.state);
  if (raw === "unknown" || raw === "unavailable") return null;
  /* I watt li conta chi sa contarli: qui si guardava solo il kW, e un
   * contatore in MW passava per un contatore in watt. */
  return wattsFromState(nodo);
}

/* Le tre sorgenti istantanee, ciascuna col suo alias.
 *
 * Positivo = prelievo per la rete, positivo = scarica per la batteria: e' la
 * convenzione di qui, e i sensori che la scrivono al contrario si girano una
 * volta sola, dove l'entita' si risolve — il verso dichiarato nella scheda
 * Energia fa scendere da `dm.energy_potenza_batteria` la lettura gia' negata.
 * Qui quindi non si gira piu' niente: girarlo anche in questa pagina vorrebbe
 * dire due mani sullo stesso segno, e il guscio storico — che disegna le
 * stesse linee leggendo lo stesso alias — di questa seconda mano non saprebbe
 * niente. */
const SORGENTI_ISTANTANEE = Object.freeze({
  solar: "dm.energy_potenza_fotovoltaico",
  grid: "dm.energy_potenza_scambio_rete",
  battery: "dm.energy_potenza_batteria",
  home: "dm.energy_potenza_consumo_casa",
});

function instantSourceFlows() {
  const fonti = [
    SORGENTI_ISTANTANEE.solar,
    SORGENTI_ISTANTANEE.grid,
    SORGENTI_ISTANTANEE.battery,
  ].map((ref) => ({
    configurata: resolvedEntity(ref) !== clean(ref),
    valore: potenzaViva(ref),
  }));
  const [sole, rete, batteria] = fonti;
  /* Senza nemmeno una sorgente viva non c'e' niente da spartire: si cede il
   * passo alla lettura dei testi, come prima. E una sorgente CONFIGURATA ma
   * muta — il sensore in `unavailable` per un attimo — non vale zero:
   * spartire le altre due inventerebbe percorsi falsi (la carica sparirebbe
   * e tutto il prelievo finirebbe «verso casa»); anche li' parla il testo.
   * Solo una sorgente davvero non configurata vale zero, che per una casa
   * senza batteria e' la verita'. */
  if (fonti.every((fonte) => fonte.valore === null)) return null;
  if (fonti.some((fonte) => fonte.configurata && fonte.valore === null)) return null;
  return allocateSourceFlows({
    solar: sole.valore ?? 0,
    grid: rete.valore ?? 0,
    battery: batteria.valore ?? 0,
  });
}

/* Il controllo di quadratura, e perche' parla solo alla seconda lettura (#134).
 *
 * «Vedo tutto ma il flusso verso casa non va.» Il giudizio sta nel nucleo —
 * `laQuadraturaNonTorna`, che e' aritmetica e si prova a tavolino — e qui si
 * fa l'unica cosa che il nucleo non puo' fare: guardare due volte.
 *
 * Una lavatrice che parte fa saltare il consumo di casa prima che il contatore
 * della rete se ne accorga, e per un istante i conti non tornano davvero. Un
 * avviso che grida su quell'istante manda a cercare un guasto che non c'e', ed
 * e' lo stesso sbaglio che l'avviso delle statistiche ha gia' fatto una volta:
 * li' si e' imparato che una lettura sola non distingue un difetto da un
 * respiro, e la cura e' la stessa — si parla di quello che c'e' ancora al giro
 * dopo.
 *
 * Le altre tre guardie stanno nel nucleo, dove si possono provare.
 */
function loSbilancioDaDire() {
  const detto = laQuadraturaNonTorna({
    solar: potenzaViva(SORGENTI_ISTANTANEE.solar),
    grid: potenzaViva(SORGENTI_ISTANTANEE.grid),
    battery: potenzaViva(SORGENTI_ISTANTANEE.battery),
    home: potenzaViva(SORGENTI_ISTANTANEE.home),
  });
  const cera = state.sbilancioDiPrima;
  state.sbilancioDiPrima = Boolean(detto);
  return cera && detto ? detto : null;
}

/* Chi e' il sospettato lo dice il DISEGNO, non una frase.
 *
 * Il nucleo sa distinguere la batteria dalla rete, e una frase per ognuna —
 * piu' quella per quando non si sa — sarebbe tre frasi intere in tredici
 * lingue per dire una cosa che un cerchio segnato dice meglio e senza parole.
 * Cosi' la nota resta una sola e vale per tutti i casi, e il cerchio da
 * guardare si illumina da se'.
 */
const BOLLE_SOSPETTABILI = Object.freeze([
  ["battery", "n-battery"],
  ["grid", "n-grid"],
]);

function disegnaLoSbilancio() {
  const scope = scopeFor("");
  if (!scope) return false;
  const detto = loSbilancioDaDire();
  for (const [quale, id] of BOLLE_SOSPETTABILI) {
    const bolla = scope.querySelector(`#${id}`);
    if (!bolla) continue;
    const suo = Boolean(detto) && detto.chi === quale;
    if (bolla.hasAttribute("data-dm-sbilancio") !== suo)
      bolla.toggleAttribute("data-dm-sbilancio", suo);
  }
  let nota = scope.querySelector("[data-dm-flow-sbilancio]");
  if (!detto) {
    nota?.remove();
    return false;
  }
  if (!nota) {
    nota = doc.createElement("div");
    nota.setAttribute("data-dm-flow-sbilancio", "");
    nota.className = "dm-flow-sbilancio";
    scope.append(nota);
  }
  /* I numeri stanno FUORI dalle frasi: «entrano X e ne escono Y» si smonta in
   * tredici lingue, due frasi intere con due numeri accanto no. E' la stessa
   * regola del riquadro delle fasce, scritta li' per esteso. */
  scriviTestoSeCambia(
    nota,
    `⚠️ ${t("I conti non tornano", "The numbers do not add up")} · ${Math.round(
      detto.entra,
    )} W → ${Math.round(detto.esce)} W. ${t(
      "Esce più corrente di quanta ne entra: di solito è il verso di un sensore al contrario.",
      "More power is going out than coming in: usually a sensor's direction is reversed.",
    )}`,
  );
  return true;
}

function instantEdgeValue(node, flussi) {
  const id = String(node?.id || "").toLowerCase();
  if (id.includes("grid-battery")) return flussi.gridToBattery;
  if (id.includes("battery-grid")) return flussi.batteryToGrid;
  if (id.includes("solar-grid")) return flussi.solarToGrid;
  if (id.includes("solar-battery")) return flussi.solarToBattery;
  if (id.includes("grid-home")) return flussi.gridToHome;
  if (id.includes("battery-home")) return flussi.batteryToHome;
  if (id.includes("solar-home")) return flussi.solarToHome;
  return null;
}

/* L'arco che mancava: dalla bolla della rete a quella della batteria, sotto
 * il sole. Le ancore sono i percorsi disegnati a mano che gli stanno accanto;
 * la scena mobile ha il suo gemello col prefisso della sua. */
const ARCHI_RETE_BATTERIA = Object.freeze([
  { anchor: "line-grid-home", id: "line-grid-battery", d: "M 307 185 Q 500 132 693 185" },
  { anchor: "m-line-grid-home", id: "m-line-grid-battery", d: "M 200 280 Q 500 180 800 280" },
  /* Lo stesso corridoio, percorso al contrario: la batteria che immette in
   * rete. Non si accendono mai insieme — prelievo e immissione sono i due
   * segni dello stesso numero — quindi condividere l'arco non sovrappone
   * niente. Senza questo, l'immissione della batteria si appoggiava alla
   * linea del solare: un'esportazione disegnata da un pannello che non sta
   * producendo. */
  { anchor: "line-grid-home", id: "line-battery-grid", d: "M 693 185 Q 500 132 307 185" },
  { anchor: "m-line-grid-home", id: "m-line-battery-grid", d: "M 800 280 Q 500 180 200 280" },
]);

function ensureGridBatteryPaths() {
  for (const arco of ARCHI_RETE_BATTERIA) {
    if (doc.getElementById(arco.id)) continue;
    const vicino = doc.getElementById(arco.anchor);
    if (!vicino?.parentNode) continue;
    const path = doc.createElementNS(SVG_NS, "path");
    path.id = arco.id;
    path.setAttribute("class", "flow-line");
    path.setAttribute("d", arco.d);
    vicino.parentNode.insertBefore(path, vicino);
  }
}

function mainLineColor(node) {
  const id = String(node?.id || "").toLowerCase();
  if (id.includes("solar")) return COLORS.solar;
  if (id.includes("battery")) return COLORS.battery;
  if (id.includes("grid")) return COLORS.grid;
  if (id.includes("home")) return COLORS.home;
  return "var(--text-dim,#64748b)";
}

function isLoadLine(node) {
  if (node?.dataset?.dmFlowArc) return true;
  const id = String(node?.id || "");
  return /line-home-(?:boiler|wb|clima|lav|cuc)(?:-(?:day|month))?$/i.test(id);
}

function mainValueNode(kind, period) {
  const suffix = period ? `-${period}` : "";
  return doc?.getElementById(`v-${kind}${suffix}`) || null;
}

function mainKinds(node) {
  const id = String(node?.id || "").toLowerCase();
  return ["solar", "grid", "battery", "home"].filter((kind) => id.includes(kind));
}

function periodDirectionalValue(node, direction) {
  if (!nodeVisible(node)) return null;
  const parts = [...(node.querySelectorAll?.("span") || [])].filter(nodeVisible);
  const index = direction === "import" || direction === "charge" ? 0 : 1;
  const part = parts[index];
  return part ? numberFrom(part) : null;
}

function directionalEndpointValue(kind, node, period) {
  /* La bolla dice ancora se questa sorgente c'e': un impianto senza batteria
   * tiene la sua bolla nascosta, e da una bolla nascosta non parte nessuna
   * linea. Ma il NUMERO, nell'istantanea, non si legge piu' da li'. */
  const valueNode = mainValueNode(kind, period);
  if (!valueNode || !nodeVisible(valueNode)) return null;
  const id = String(node?.id || "").toLowerCase();

  if (!period) {
    /* Il verso dell'istantanea viene dagli stati, mai dal testo della bolla.
     *
     * La bolla della batteria non dice piu' il numero col segno: dice
     * grandezza e verso, «▼ 201 W». Il segno se n'e' andato nella freccia, e
     * chi leggeva quel testo per sapere da che parte andasse la linea
     * ritrovava sempre e solo un numero positivo — cioe' sempre e solo
     * «batteria → casa», qualunque cosa stesse facendo la batteria e
     * qualunque verso fosse dichiarato. E' la #435: «è sempre da batteria
     * verso casa, ho provato anche a cambiare il senso ma non cambia».
     *
     * Questa strada si percorre quando la spartizione a cascata si fa da
     * parte — una sorgente configurata ma muta — e allora si torna alla
     * regola di prima, un numero alla volta: ma il numero lo danno gli stati,
     * che il verso ce l'hanno. */
    const signed = potenzaViva(SORGENTI_ISTANTANEE[kind]);
    if (signed === null) return null;
    if (kind === "grid")
      return id.includes("solar-grid") ? Math.max(0, -signed) : Math.max(0, signed);
    if (kind === "battery")
      return id.includes("solar-battery") ? Math.max(0, -signed) : Math.max(0, signed);
    return Math.abs(signed);
  }

  if (kind === "grid")
    return periodDirectionalValue(valueNode, id.includes("solar-grid") ? "export" : "import");

  if (kind === "battery")
    return periodDirectionalValue(valueNode, id.includes("solar-battery") ? "charge" : "discharge");

  return numberFrom(valueNode);
}

function directionalMainFlowValue(node, period) {
  const id = String(node?.id || "").toLowerCase();
  /* Rete ↔ batteria non si decide da un capo solo: quanta rete stia entrando
   * nella batteria lo sa soltanto la spartizione a cascata. Quando quella si
   * fa da parte questi due archi restano spenti, che e' la risposta onesta —
   * prima si accendevano su tutto il prelievo, cioe' su un fatto diverso. */
  if (id.includes("grid-battery") || id.includes("battery-grid")) return null;
  if (id.includes("solar-grid")) return directionalEndpointValue("grid", node, period);
  if (id.includes("solar-battery")) return directionalEndpointValue("battery", node, period);
  if (id.includes("grid-home")) return directionalEndpointValue("grid", node, period);
  if (id.includes("battery-home")) return directionalEndpointValue("battery", node, period);
  if (id.includes("solar-home")) return directionalEndpointValue("solar", node, period);

  const kinds = mainKinds(node);
  for (const kind of kinds) {
    if (kind === "home") continue;
    const value = directionalEndpointValue(kind, node, period);
    if (value !== null) return value;
  }
  return kinds.includes("home") ? directionalEndpointValue("home", node, period) : null;
}

function displayedMainFlow(node, period) {
  const threshold = period ? 0.0005 : 0.5;
  const value = directionalMainFlowValue(node, period);
  return value === null ? null : value > threshold;
}

function mirrorLegacyMainFlows(scope, period) {
  if (!scope) return false;
  let touched = false;
  /* L'istantanea si spartisce una volta per passata: gli archi veri valgono
   * per tutte le linee della scena, e si calcolano dagli stati. */
  const flussi = period ? null : instantSourceFlows();
  scope
    .querySelectorAll(".flow-line,path[id*='line-' i],line[id*='line-' i],polyline[id*='line-' i]")
    .forEach((node) => {
      if (!/^(path|line|polyline)$/i.test(node.tagName) || isLoadLine(node)) return;
      const legacyActive = node.classList.contains("active");
      const edge = flussi ? instantEdgeValue(node, flussi) : null;
      const displayedActive = edge === null ? displayedMainFlow(node, period) : edge > 0.5;
      const active = displayedActive === null ? legacyActive : displayedActive;
      colorNode(node, mainLineColor(node), active);
      const kinds = mainKinds(node);
      scriviDatoSeCambia(node, "dmMainFlow", kinds.join("-"));
      scriviDatoSeCambia(node, "dmFlowPeriod", period || "instant");
      const value = edge === null ? directionalMainFlowValue(node, period) : edge;
      if (value !== null) scriviDatoSeCambia(node, "dmFlowValue", String(value));
      touched = true;
    });
  return touched;
}

export function refreshEnergyFlows() {
  if (!doc) return false;
  beginVisibilityPass();
  ensureGridBatteryPaths();
  let touched = false;
  for (const view of FLOW_VIEWS) {
    const period = view.period === "instant" ? "" : view.period;
    const scope = scopeFor(period);
    if (!scope) continue;
    touched = mirrorLegacyMainFlows(scope, period) || touched;
    touched = renderDynamicFlowLoads(view.period) > 0 || touched;
    scriviDatoSeCambia(scope, "dmEnergyFlows", "directional-value-bound");
  }
  /* La bolla della batteria diceva il numero grezzo col segno («-201 W»
   * mentre carica): il segno e' una convenzione del modello, non una lettura.
   * Grandezza e verso, con la freccia — e le decisioni sulle linee, qui
   * sopra, ormai leggono gli stati e non questo testo.
   *
   * E si scrive SEMPRE. Il cartello del padrone che questa scrittura pianta
   * sulla bolla ferma la mano del guscio per sempre: tacere quando non c'e'
   * la freccia — sullo zero, o sull'impianto che una batteria non ce l'ha —
   * lasciava inciso il numero di prima, e cambiando impianto si leggeva la
   * carica dell'altra casa. «—» senza lettura, «0 W» da ferma. */
  disegnaLoSbilancio();
  const batteria = potenzaViva(SORGENTI_ISTANTANEE.battery);
  const testo = batteria === null ? "—" : (batteryReadout(batteria) ?? "0 W");
  for (const id of ["v-battery", "m-v-battery"]) {
    scriviTestoSeCambia(doc.getElementById(id), testo);
  }
  /* Lo stato di carica e' dell'impianto scelto, non del documento intero: il
   * primo livello dell'oggetto Energia E' il primo impianto, e leggerlo
   * com'e' mostrava il SOC di casa propria dentro la casa dell'altro. */
  const impianto = energiaDellImpianto();
  renderBatterySoc(doc, impianto, allStates());
  mostraBolleDellImpianto(impianto);
  /* Per ultimo, quando i numeri sono tutti scritti: prima non ci sarebbe
   * niente da misurare. */
  adattaINumeriDelleBolle(doc);
  riempiGliAnelli(doc);
  return touched;
}

/* ── L'anello intorno al cerchio ─────────────────────────────────────────
 *
 * «Voglio qualcosa di moderno, ma che ci siano i flussi.» Ogni cerchio porta
 * intorno un anello che si riempie quanto pesa il suo numero: la batteria
 * quanto e' carica, gli altri quanto valgono rispetto al piu' grosso della
 * scena. Cosi' a colpo d'occhio si vede chi tira, senza leggere un numero.
 *
 * Il numero si rilegge dal testo della bolla — quello che chi guarda vede —
 * e non dagli stati: la scena ha tre viste (istante, giorno, mese) e ognuna
 * scrive i suoi numeri a modo suo, e il testo e' il solo posto dove stanno
 * tutti nella stessa forma. */
const SCALE_DEL_NUMERO = { w: 1, kw: 1e3, mw: 1e6, wh: 1, kwh: 1e3, mwh: 1e6 };

/** Il numero di una bolla in unita' base (W o Wh); `null` se non ce n'e'. */
export function numeroDellaBolla(testo) {
  const scritto = String(testo ?? "");
  const trovato = scritto.match(/(\d[\d.,]*)\s*(mwh|kwh|wh|mw|kw|w)\b/i);
  if (!trovato) return null;
  let cifre = trovato[1];
  /* «1.234,5»: il punto separa le migliaia. «5.10» senza virgola: decimale. */
  if (cifre.includes(",")) cifre = cifre.replace(/\./g, "").replace(",", ".");
  const valore = Number.parseFloat(cifre);
  if (!Number.isFinite(valore)) return null;
  return valore * SCALE_DEL_NUMERO[trovato[2].toLowerCase()];
}

/** Quanto si riempie l'anello: da 0 a 1, con un filo visibile se c'e' qualcosa. */
export function quotaDellAnello(valore, riferimento) {
  if (!(valore > 0) || !(riferimento > 0)) return 0;
  return Math.min(1, Math.max(0.04, valore / riferimento));
}

/* Dove sta il numero di una bolla. Non «il primo span»: nei carichi l'icona
 * di una stanza o di un elettrodomestico e' anch'essa uno span, viene prima
 * del numero, e l'anello leggeva l'icona — vuoto per sempre. I carichi
 * hanno il loro posto per il numero; i quattro cerchioni lo tengono in uno
 * span figlio diretto. */
export function numeroScrittoNellaBolla(bolla) {
  return (
    bolla?.querySelector?.(".dm-flow-value") ||
    [...(bolla?.children || [])].find((figlio) => figlio.tagName === "SPAN") ||
    null
  );
}

function riempiGliAnelli(targetDocument = doc) {
  for (const palco of targetDocument?.querySelectorAll?.("#page-energy .flow-stage") || []) {
    const bolle = [...palco.querySelectorAll(".node")];
    const valori = new Map();
    let massimo = 0;
    for (const bolla of bolle) {
      const valore = numeroDellaBolla(numeroScrittoNellaBolla(bolla)?.textContent);
      valori.set(bolla, valore);
      if (valore > massimo) massimo = valore;
    }
    for (const bolla of bolle) {
      let quota = quotaDellAnello(valori.get(bolla), massimo);
      const carica = /n-battery/.test(bolla.id || "")
        ? Number.parseFloat(bolla.querySelector("#v-battery-soc,.dm-battery-soc")?.textContent)
        : Number.NaN;
      if (Number.isFinite(carica)) quota = Math.min(1, Math.max(0, carica / 100));
      setStyleProperty(bolla, "--dm-quota", String(Math.round(quota * 1000) / 1000));
    }
  }
}

/* ── Il numero della bolla sta su una riga ───────────────────────────────
 *
 * «Sistema la batteria perche' e' su due righe, adatta tutto.»
 *
 * Da quando i watt salgono di scala la bolla della batteria dice «▲ 5,10 kW»:
 * misurato in un browser vero, quel testo vuole 64 punti dove il cerchio da 88
 * ne lascia 70 scarsi al netto del bordo e del margine — e il «kW» finiva da
 * solo sotto il numero, col per cento della carica ancora sotto. Tre righe in
 * un cerchio disegnato per una.
 *
 * Alzare il cerchio o accorciare la scritta sarebbero due modi di rimandare:
 * domani arriva «1.234,5 kWh» nella vista del mese, o una casa con un
 * megawatt. Qui invece si misura e ci si adatta — quello che il foglio di
 * stile non sa fare, perche' non sa quanto e' lungo un testo.
 *
 * Il foglio dichiara che a capo non si va (`white-space:nowrap`) e che fuori
 * dal cerchio non si esce (`max-width:100%`); quelle due righe sono la
 * ragione per cui questa misura funziona: senza `nowrap` il testo andrebbe a
 * capo e risulterebbe sempre «largo abbastanza».
 *
 * Si stringe fino al 62% e non oltre: sotto, il numero non si legge piu' da un
 * metro, ed e' meglio un carattere che sborda di un carattere che non si
 * legge. E si misura solo quando il testo cambia — la firma e' il testo
 * stesso — perche' leggere `scrollWidth` costa un calcolo di impaginazione, e
 * questo giro passa su sette bolle a ogni cambio di stato.
 */
const QUANTO_AL_PIU_SI_STRINGE = 0.62;
const FIRMA_DELLA_STRETTA = "__dmStretta";

/** Tutti i numeri delle bolle: i quattro cerchioni e i carichi. */
export const I_NUMERI_DELLE_BOLLE = "#page-energy .node span, #page-energy .dm-flow-value";

/**
 * Stringe il carattere di un numero finche' sta nella sua bolla.
 *
 * Torna `true` se l'ha toccato. Esportata perche' la provano: il conto e' una
 * proporzione e si verifica con un nodo finto, senza un browser.
 */
export function stringiIlNumero(nodo, misuraDelCarattere) {
  if (!nodo) return false;
  const testo = String(nodo.textContent ?? "");
  if (nodo[FIRMA_DELLA_STRETTA] === testo) return false;
  /* Si riparte sempre dalla misura del foglio: un numero corto dopo uno lungo
   * deve tornare grande, o la bolla resterebbe rimpicciolita per sempre. */
  nodo.style?.removeProperty?.("font-size");
  const largo = Number(nodo.scrollWidth) || 0;
  const spazio = Number(nodo.clientWidth) || 0;
  /* La firma si mette solo dopo aver misurato davvero.
   *
   * Una pagina che non e' in vista non ha larghezze: tutto zero. Il primo giro
   * capita spesso li' — la plancia disegna anche le pagine chiuse — e
   * ricordarsi «questo testo l'ho gia' guardato» avrebbe voluto dire non
   * guardarlo mai piu', perche' quando la pagina si apre il testo e' lo stesso
   * di prima. La bolla della batteria restava a due righe fino al primo numero
   * nuovo. */
  if (!spazio) return false;
  nodo[FIRMA_DELLA_STRETTA] = testo;
  if (!testo.trim()) return false;
  /* Un punto di tolleranza: i mezzi pixel di un'arrotondatura non sono un
   * testo che non ci sta. */
  if (!largo || largo <= spazio + 1) return false;
  const base = Number(misuraDelCarattere?.(nodo)) || 0;
  if (!base) return false;
  const quanto = Math.max(spazio / largo, QUANTO_AL_PIU_SI_STRINGE);
  /* «important», e non e' un vezzo: il foglio la misura del carattere delle
   * bolle la scrive cosi' («#view-ist .node span { font-size: 15px !important
   * }», per non far esplodere il cerchio), e una riga in linea senza la stessa
   * forza perderebbe. Misurato: la stretta si scriveva e non si vedeva. */
  nodo.style.setProperty("font-size", `${Math.floor(base * quanto * 10) / 10}px`, "important");
  return true;
}

/* La misura del carattere che il foglio ha dato a questo nodo. */
function misuraDalFoglio(nodo) {
  const vista = root.getComputedStyle?.(nodo);
  return vista ? Number.parseFloat(vista.fontSize) : 0;
}

/** Passa su tutti i numeri delle bolle e li fa stare dentro. */
export function adattaINumeriDelleBolle(targetDocument = doc) {
  const nodi = targetDocument?.querySelectorAll?.(I_NUMERI_DELLE_BOLLE);
  if (!nodi) return 0;
  let tocchi = 0;
  for (const nodo of nodi) if (stringiIlNumero(nodo, misuraDalFoglio)) tocchi += 1;
  return tocchi;
}

/* Le due bolle che non tutti gli impianti hanno.
 *
 * Il guscio le nasconde e le rimostra in `cdApplyFlowMinimal`, guardando le
 * entita' mappate — ma quella funzione la chiama una volta sola, su un timer
 * all'avvio. Cambiando impianto le entita' cambiano sotto i piedi e nessuno la
 * rifa': chi passa a una casa senza batteria e poi torna alla propria trovava
 * la bolla della batteria sparita, e non tornava piu' finche' la pagina non si
 * ricaricava. E' il «improvvisamente scompare tutto» segnalato, ed e' anche il
 * motivo per cui la prova che lo sorveglia cadeva un giro su quattro: non
 * aspettava un ritardo, aspettava una passata che non sarebbe mai arrivata.
 *
 * Qui la decisione la prende chi la sa, a ogni passata: l'impianto scelto dice
 * se il sole e la batteria ce li ha, e le bolle seguono.
 *
 * Due cose, pero', non si possono sbagliare.
 *
 * La prima: la potenza non e' sempre nella casella `power`. Chi ha dichiarato
 * un sensore unico col segno (`battery.signed.power`) o due sensori, uno per
 * verso (`power` e `power_discharge`), la casella di sempre ce l'ha vuota — e
 * la lettura buona la ricava `applySignedSources`. Guardare il campo grezzo
 * avrebbe nascosto la batteria a chi ce l'ha e funziona. Si guarda quindi il
 * modello risolto, che e' lo stesso che poi la disegna.
 *
 * La seconda: una bolla che se ne va si porta dietro le sue linee. Nasconderla
 * e basta lasciava i tratteggi appesi al vuoto — il guscio, che di suo ne
 * nascondeva sedici a mano, questo lo faceva. Qui non c'e' un elenco da tenere
 * aggiornato: si guarda il nome di ogni linea, e chi nomina una sorgente che
 * non c'e' se ne va con lei. Cosi' valgono anche le viste giorno e mese, che
 * nell'elenco del guscio non c'erano. */
function mostraBolleDellImpianto(impianto) {
  const risolto = applySignedSources(impianto || {});
  const assente = {
    solar: !clean(risolto?.solar?.power),
    battery: !clean(risolto?.battery?.power),
  };
  if (!assente.solar && !assente.battery) {
    for (const nodo of doc?.querySelectorAll?.("[data-dm-impianto-nasconde]") || []) {
      riportaInScena(nodo);
    }
    return;
  }
  const nomina = (id, sorgente) => id.includes(sorgente);
  for (const nodo of doc?.querySelectorAll?.(SELETTORE_DEL_FLUSSO) || []) {
    const id = String(nodo.id || "").toLowerCase();
    const via =
      (assente.solar && nomina(id, "solar")) || (assente.battery && nomina(id, "battery"));
    if (via) {
      /* Con la stessa forza di chi la mostra: `exposeConnector` scrive
       * `display:inline` con importanza sulle linee vive, e questa passata
       * viene dopo la sua. */
      setStyleProperty(nodo, "display", "none", "important");
      scriviDatoSeCambia(nodo, "dmImpiantoNasconde", "true");
    } else {
      riportaInScena(nodo);
    }
  }
}

/* Le bolle del sole e della batteria, e ogni linea del flusso che le nomini —
 * in tutte le viste, desktop e telefono, istante, giorno e mese. */
const SELETTORE_DEL_FLUSSO =
  "#page-energy [id^='n-solar'],#page-energy [id^='n-battery']," +
  "#page-energy [id^='m-n-solar'],#page-energy [id^='m-n-battery']," +
  "#page-energy [id*='line-']";

/* Si toglie solo quello che si e' messo: il `display` sulle linee vive e' di
 * `exposeConnector`, e cancellarlo quando non e' nostro gli farebbe rifare il
 * lavoro a ogni passata. */
function riportaInScena(nodo) {
  if (nodo?.dataset?.dmImpiantoNasconde !== "true") return;
  nodo.style.removeProperty("display");
  delete nodo.dataset.dmImpiantoNasconde;
}

/* La scena si disegna per chi la guarda.
 *
 * Col profilatore in mano — plancia ferma sulla Home, casa che parla a venti
 * cambi di stato al secondo — questa passata era la voce piu' grossa del
 * processore: piu' del disegno dei widget, piu' di ogni altra cosa. Il motivo
 * e' il suo mestiere: riscrive lo stile di ogni bolla e di ogni linea, e
 * subito dopo chiede al browser lo stile calcolato di quelle stesse (vedi
 * `nodeVisible`). Ogni domanda dopo una scrittura obbliga a rifare i conti
 * dell'impaginazione, e le domande sono un centinaio per passata.
 *
 * Con la pagina dell'Energia chiusa non si vedeva niente di tutto questo. Le
 * pagine restano nel documento — il guscio le nasconde, non le toglie —
 * quindi il lavoro si faceva lo stesso, per nessuno: era il calore del mini
 * PC segnalato dal campo, pagato da chi la plancia la teneva aperta sulla
 * Home. Adesso si torna subito, e al ritorno la passata si rifa': il tocco
 * su una linguetta la richiama, e chi arriva trova la scena di adesso. */
function laScenaSiVede() {
  const pagina = doc?.getElementById?.("page-energy");
  /* Senza quella pagina non c'e' niente da rimandare: la passata trova i suoi
   * ambiti vuoti e torna da sola, e tacere qui vorrebbe dire spegnere il
   * flusso su un guscio fatto in un altro modo. */
  return !pagina || pagina.classList.contains("active");
}

function schedule() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    if (!laScenaSiVede()) return;
    refreshEnergyFlows();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0);
}

function scheduleSettled() {
  schedule();
  root.setTimeout?.(schedule, 80);
}

/* Adding, renaming or removing a Load must redraw the stage immediately: the
 * topology itself changed, not just a reading. */
function bindStore() {
  if (state.storeBound) return;
  const store = dashboardStore();
  if (!store?.subscribe) return;
  state.storeBound = true;
  store.subscribe((change) => {
    if (["loads", "energy"].includes(change?.section)) scheduleSettled();
  });
}

function installStyles() {
  installStyle(
    "dm-energy-flow-section-style",
    `
    ${regolaDelleBolleVecchie()}
    /* La nota di quando i conti non tornano (#134), e il cerchio sospettato.
     *
     * La nota sta sotto la mappa e non sopra: chi apre questa pagina viene
     * per il disegno, e un cartello in cima glielo copre. L'ambra e non il
     * rosso perche' non e' un guasto — l'impianto sta funzionando benissimo,
     * e' un numero che arriva girato — e il rosso qui dentro e' gia' la
     * tinta di un'altra cosa.
     *
     * Il cerchio si segna con un anello tratteggiato dello stesso colore,
     * cosi' chi legge la nota sa dove guardare senza che la nota debba
     * nominarlo: tre frasi diverse per dire «la batteria» o «la rete»
     * sarebbero tre frasi in tredici lingue per quello che un anello dice
     * meglio. */
    .dm-flow-sbilancio{margin:10px 12px 2px!important;padding:9px 12px!important;border-radius:12px!important;background:color-mix(in srgb,#f59e0b 12%,transparent)!important;border:1px solid color-mix(in srgb,#f59e0b 42%,transparent)!important;color:var(--primary-text-color,#0f172a)!important;font-size:12px!important;line-height:1.5!important}
    [data-dm-sbilancio]{outline:2px dashed #f59e0b!important;outline-offset:3px!important;border-radius:50%!important}
    .dm-energy-flow-active{display:inline!important;visibility:visible!important;opacity:1!important;filter:drop-shadow(0 0 6px color-mix(in srgb,var(--dm-flow-color) 52%,transparent))!important;transition:stroke .18s ease,fill .18s ease,opacity .18s ease!important}
    /* Un collegamento spento non si disegna affatto.
     *
     * «Nello sfondo si vedono le linee tratteggiate che vanno da un cerchio
     * all'altro: le linee devono comparire solo quando c'e' il flow colorato
     * che va verso il cerchio.»
     *
     * Le rotaie grigie erano la mappa dell'impianto — tutti i collegamenti
     * possibili, sempre — e sopra ci scorreva il tratteggio colorato di quelli
     * vivi. Ma la scena dice una cosa sola: dove sta passando l'energia
     * adesso. Una rotaia spenta e' un collegamento che non porta niente
     * disegnato accanto a uno che porta, e a colpo d'occhio sono la stessa
     * cosa: il solare che va in rete sembrava disegnato anche a mezzanotte.
     *
     * Adesso si vede quello che scorre, e basta. La riga che il collegamento
     * occupa resta dov'e' — il tratteggio ricompare nello stesso posto appena
     * il ramo riparte, e la dissolvenza di mezzo secondo del guscio lo fa
     * entrare e uscire senza scatti. */
    .dm-energy-flow-idle{opacity:0!important;filter:none!important;transition:stroke .18s ease,fill .18s ease,opacity .18s ease!important}
    /* Anche le linee dei carichi disegnate dal guscio, che la scena non
       colora: la loro accensione e' la classe «active» di sempre.
       
       Ma solo dentro una scena che questa pagina ha gia' dipinto almeno una
       volta — da qui il segno sull'ambito, che la passata scrive a ogni giro.
       Senza quel vincolo questa riga era capace di svuotare la mappa da sola:
       una passata che non parte — un guscio fatto in un altro modo, un
       fotogramma che non arriva mai su un browser che non abbiamo qui — non
       mette nessuna classe su nessuna linea, e allora la regola le spegneva
       TUTTE, comprese quelle che il guscio aveva acceso. «Da iPad non si
       vedono i flussi» (#548) ha questa forma, e comunque vada a finire una
       nostra riga di stile non deve poter cancellare il disegno di chi c'era
       prima: se non stiamo guidando noi, si vede quello che dice il guscio. */
    [data-dm-energy-flows] .flow-line:not(.active):not(.dm-energy-flow-active){opacity:0!important}
    /* La scia di luce: una cometa per tratto, che corre sul binario tenue
       della sua strada. Il percorso e' lungo cento (\`pathLength\`, vedi
       \`binario\`): una scia di quattordici, e il vuoto per il resto. */
    .flow-line.dm-energy-flow-active,path.dm-energy-flow-active,line.dm-energy-flow-active,polyline.dm-energy-flow-active{stroke:var(--dm-flow-color)!important;stroke-dasharray:14 86!important;stroke-linecap:round!important;animation-name:dmEnergyFlowDash!important;animation-duration:1.6s!important;animation-timing-function:linear!important;animation-iteration-count:infinite!important;animation-play-state:running!important;will-change:stroke-dashoffset!important}
    @keyframes dmEnergyFlowDash{from{stroke-dashoffset:0}to{stroke-dashoffset:-100}}
    .dm-flow-binario{fill:none!important;stroke:var(--dm-flow-color)!important;stroke-opacity:.2!important;stroke-width:var(--dm-flow-width,3px)!important;stroke-linecap:round!important;stroke-dasharray:none!important;animation:none!important;filter:none!important;pointer-events:none!important;opacity:1!important}
    .dm-flow-binario[data-acceso="false"]{display:none!important}
    #page-energy .flow-line.dm-energy-flow-active,#page-energy path.dm-energy-flow-active{stroke-width:calc(var(--dm-flow-width,3px) + 1.5px)!important;filter:drop-shadow(0 0 5px var(--dm-flow-color))!important}
    .flow-stage path.dm-flow-arc.dm-energy-flow-active{animation-duration:calc(var(--dm-flow-duration,.8s) * 2)!important}
    /* I cerchi come le tessere della plancia: la stessa carta, lo stesso
       bordo sottile, la stessa ombra morbida. Il colore non sta piu' nel
       bordo pieno ma nell'anello che gira intorno e si riempie quanto pesa
       il numero (\`riempiGliAnelli\`): la batteria quanto e' carica, gli
       altri rispetto al piu' grosso della scena. */
    #page-energy .flow-stage .node{
      background:var(--card-bg,#fff)!important;
      border:1px solid var(--card-border,rgba(148,163,184,.25))!important;
      box-shadow:0 4px 14px rgba(15,23,42,.08)!important}
    #page-energy .flow-stage .node::before{content:""!important;position:absolute!important;inset:-7px!important;border-radius:50%!important;z-index:-1!important;pointer-events:none!important;
      background:conic-gradient(var(--n-color,#64748b) calc(var(--dm-quota,0) * 1turn),color-mix(in srgb,var(--n-color,#64748b) 16%,transparent) 0)!important;
      -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 5px),#000 calc(100% - 4.5px))!important;
      mask:radial-gradient(farthest-side,transparent calc(100% - 5px),#000 calc(100% - 4.5px))!important;
      transition:background .4s ease!important}
    #page-energy .flow-stage .node::after{display:none!important}
    #page-energy .flow-stage .node.active,#page-energy .flow-stage .node.dm-flow-node[data-dm-flow-active="true"]{
      box-shadow:0 4px 14px rgba(15,23,42,.08),0 0 22px color-mix(in srgb,var(--n-color,#3b82f6) 30%,transparent)!important}
    #page-energy .flow-stage .n-home{--n-color:#3b82f6!important}
    /* Nessuna eccezione per "riduci movimento": il tratteggio che scorre non e'
       una decorazione ma l'unico segnale che l'energia sta passando, e la
       plancia deve mostrare le stesse linee su ogni schermo. Quella preferenza
       e' spesso attiva su un computer e quasi mai su un telefono, quindi
       rispettarla qui rendeva il desktop immobile mentre il telefono scorreva:
       stessa plancia, due letture diverse. Le altre sezioni continuano a
       rispettarla, perche' li' il moto e' effettivamente decorativo. */
    /* An mdi icon resolved by the engine sits inside .node-icon, which already
       sizes the emoji of the hand-authored circles at every breakpoint: the
       glyph inherits it so a configured circle matches its neighbours. */
    .dm-flow-node .node-icon .dm-icon-engine-glyph{font-size:inherit!important;height:auto!important}
    /* Computed load bubbles. Width and speed of a connector follow the reading,
       so a wallbox at 7 kW is visibly heavier than a fridge at 60 W. */
    .flow-stage .node.dm-flow-node{display:flex!important;visibility:visible!important;transform:translate(-50%,-50%) scale(var(--dm-flow-scale,1))!important;transition:left .28s ease,top .28s ease,transform .28s ease!important}
    .flow-stage .node.dm-flow-node[data-dm-flow-active="false"]{opacity:.62!important}
    /* Il nome sta dentro il cerchio: largo quanto la corda in cima, al massimo
       due righe; la misura la stringe adattaIlNome. */
    .flow-stage .node.dm-flow-node .node-label{width:72%!important;white-space:normal!important;overflow:hidden!important;text-overflow:clip!important;line-height:1.1!important;max-height:2.25em;flex:0 0 auto!important;overflow-wrap:normal!important;word-break:normal!important}
    .flow-stage .node.dm-flow-node .node-label[data-dm-nome-lungo]{white-space:nowrap!important;text-overflow:ellipsis!important}
    .flow-stage path.dm-flow-arc{stroke-width:var(--dm-flow-width,3px)!important;fill:none!important}
    /* La soglia e' quella del guscio, 768, e non una nostra.
     *
     * Qui c'era 820. Sembra un dettaglio e non lo e': il guscio cambia TUTTO a
     * 768 — l'altezza del palco (da 550 a 750), la misura dei cerchi (la Casa
     * da 160 a 125, un carico da 115 a 85), l'altezza della Casa (dal 50% al
     * 46%) e quale dei due disegni si vede — mentre questa riga spostava da
     * sola le bolle sulla riga stretta. Fra 769 e 820 succedeva che la bolla
     * salisse al 68% restando grande dentro un palco rimasto alto 550: la
     * Casa arriva a 360 e la bolla comincia a 317. **Si sovrappongono di
     * quarantaquattro punti**, misurati, con la linea che spunta di sotto
     * perche' il disegno mostrato e' ancora quello largo, che porta all'83%.
     *
     * «Wallbox sta troppo attaccato a casa»: era questo, e non era attaccato,
     * era sopra. Il 68% e' giusto dove e' nato — nel palco alto 750 con i
     * cerchi piccoli lascia cinquantacinque punti di aria — e sbagliato
     * altrove. Due soglie per una stessa decisione sono due decisioni, e
     * prima o poi non vanno d'accordo. */
    @media(max-width:768px){
      .flow-stage .node.dm-flow-node{left:var(--dm-flow-mobile-left,50%)!important;top:var(--dm-flow-mobile-top,83%)!important}
    }
    /* I cerchi sotto la Casa, che si leggono.
     *
     * «I dati dentro entrano a mala pena e sono troppo piccoli, il testo
     * ancora tagliato.» Le stanze e i carichi erano i cerchi piu' piccoli del
     * palco — 75 punti sul telefono — e per farci stare il nome il guscio lo
     * portava a 7 pixel: «LOCALE TECNICO» toccava il bordo. Crescono solo
     * loro, coi loro nomi e numeri; Solare, Rete, Batteria e Casa restano come
     * sono. Le misure sono le stesse che legge \`comeSiamoMessi\`, cosi' il
     * conto di quante bolle stanno in fila resta giusto: sul telefono tre per
     * fila si prendono tutto lo spazio che c'e', e non di piu'. */
    #page-energy .n-load{width:130px!important;height:130px!important}
    /* E la Casa un poco piu' piccola: «riesci a fare un po' piu' piccolo
     * quello della casa». Resta il cerchio piu' grande, ma non schiaccia piu'
     * la fila di sotto. */
    #page-energy .n-home{width:145px!important;height:145px!important}
    #page-energy .n-load .node-label{font-size:11.5px!important;letter-spacing:0!important}
    #page-energy #view-ist .n-load span{font-size:20px!important}
    #page-energy .n-load .node-icon{font-size:26px!important}
    @media(max-width:768px){
      #page-energy .flow-stage{height:800px!important}
      #page-energy .n-home{width:110px!important;height:110px!important}
      #page-energy .n-load{width:104px!important;height:104px!important}
      #page-energy .n-load .node-label{font-size:10.5px!important;letter-spacing:0!important}
      #page-energy #view-ist .n-load span{font-size:18px!important}
      #page-energy .n-load .node-icon{font-size:23px!important}
    }
    @media(max-width:480px){
      #page-energy .flow-stage{height:720px!important}
      #page-energy .n-home{width:96px!important;height:96px!important}
      #page-energy .n-load{width:96px!important;height:96px!important}
    }
  `,
  );
}

export function installEnergyFlowSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  state.installatoAlle = Date.now();
  installStyles();
  root.dmRefreshEnergyFlows = refreshEnergyFlows;
  for (const name of [
    "renderEnergyMonth",
    "renderEnergyDay",
    "renderEnergyDashboard",
    "applyAtomicEnergyBundle",
    "switchEnergyView",
    "render",
  ])
    wrapFunction(name, `__dmEnergyFlow_${name}`, scheduleSettled);
  root.addEventListener?.("dashboardmodern:period-bundle", (event) => {
    state.bundle = event?.detail || null;
    scheduleSettled();
  });
  root.addEventListener?.("dashboardmodern:energy-bundle", scheduleSettled);
  root.addEventListener?.("dashboardmodern:energy-stable", scheduleSettled);
  /* E i cambi di stato, che sono la ragione per cui questa pagina esiste.
   *
   * La scena si ridisegnava solo agli eventi grossi: l'avvio, i pacchetti
   * dello storico, il tocco su una linguetta, un salvataggio. Le potenze
   * istantanee pero' le legge dagli stati vivi, e quelli cambiano di
   * continuo: fra un pacchetto e l'altro il disegno restava fermo a
   * com'era. Se la prima passata capitava mentre un'entita' era ancora
   * «unavailable» — un riavvio di Home Assistant, una riconnessione, un
   * integrazione lenta a partire — le linee e la bolla della batteria
   * restavano vuote finche' non passava un evento grosso, o finche' non si
   * ricaricava la pagina: «i flussi spesso scompaiono e nel mio caso la
   * batteria anche, devo ricaricare spesso la pagina».
   *
   * L'evento e' gia' raccolto a mazzetti dal filtro degli stati — mezzo
   * secondo, e solo per le entita' configurate — e il fotogramma si accoda
   * una volta sola: qui non si aggiunge nessun giro di controllo. */
  root.addEventListener?.("dashboardmodern:state-changed", schedule);
  /* E la finestra che cambia misura, che e' una cosa nuova per questa scena.
   *
   * Da quando quanto sono strette le bolle dipende dalla larghezza vera del
   * palco (vedi `quantoCiStaNelPalco`), girare il tablet cambia la risposta —
   * e senza questo la nuova risposta arrivava soltanto al cambio di stato
   * dopo, che in una casa ferma puo' essere fra minuti. Si aspetta che la
   * mano abbia finito di girare: durante il giro le misure sono di passaggio,
   * e ridisegnare a ogni passo vorrebbe dire una passata di conti a
   * fotogramma. */
  root.addEventListener?.("resize", () => {
    if (state.attesaMisura) root.clearTimeout?.(state.attesaMisura);
    state.attesaMisura = root.setTimeout?.(() => {
      state.attesaMisura = 0;
      scheduleSettled();
    }, 160);
  });
  root.addEventListener?.("dashboardmodern:states-ready", scheduleSettled);
  root.addEventListener?.("dashboardmodern:runtime-ready", scheduleSettled);
  root.addEventListener?.("dashboardmodern:legacy-ready", scheduleSettled);
  /* Le linguette: quelle dentro l'Energia — istante, giorno, mese — e quelle
   * della barra, che sono il modo in cui la pagina torna in scena. La passata
   * si salta finche' e' chiusa (vedi `laScenaSiVede`), quindi il tocco che la
   * riapre e' l'unica cosa che la rimette in moto. */
  doc.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.("[data-energy-tab],.energy-tab,.sub-tab-btn,.tab[data-tab]"))
        scheduleSettled();
    },
    true,
  );
  bindStore();
  rivendicaLeBolleDellaBatteria();
  scheduleSettled();
}

/* Le due caselle della batteria si rivendicano all'installazione, prima che
 * arrivi il primo stato.
 *
 * Il cartello `data-dm-padrone` ferma la mano del guscio, ma solo da quando
 * c'e'. Chi lo lasciava alla prima passata di disegno arrivava tardi: il
 * guscio aveva gia' scritto la sua forma — `-1796 W` — e quella si vedeva per
 * un istante prima che il modulo la coprisse con `▼ 1796 W`. Misurato: due
 * scritture su quaranta cambi di stato, cioe' un lampo solo all'avvio, ma un
 * lampo che si vede. Rivendicare subito lo toglie: il guscio quelle caselle
 * non le scrive mai, nemmeno la prima volta. */
function rivendicaLeBolleDellaBatteria() {
  for (const id of ["v-battery", "m-v-battery", "v-battery-soc"]) {
    const nodo = doc?.getElementById?.(id);
    if (nodo?.dataset && nodo.dataset.dmPadrone !== "moduli") nodo.dataset.dmPadrone = "moduli";
  }
}

if (doc?.readyState === "loading")
  doc.addEventListener("DOMContentLoaded", installEnergyFlowSection, { once: true });
else senzaCadere(installEnergyFlowSection);
