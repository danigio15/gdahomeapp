/* In che stanza sta ogni entita' — anche al caricamento dopo.
 *
 * Home Assistant la stanza la sa gia': un'entita' porta la sua area, o la
 * eredita dal dispositivo su cui sta. Chi disegna pero' quei registri non ce
 * li ha: il guscio li tiene in `WIZ`, che nasce vuoto a ogni caricamento della
 * pagina e lo riempie soltanto chi apre la procedura iniziale. Dentro il
 * pannello non lo riempie nessuno, e il conto della presenza per stanza (#549)
 * li' non e' mai entrato in funzione: due rilevatori nello stesso salotto
 * continuavano a contare due stanze occupate, che e' esattamente la cosa che
 * la #549 chiedeva di smettere di fare.
 *
 * Chiederli da chi disegna si e' provato, ed e' costata la #553: la domanda
 * partiva una volta per entita', `config/entity_registry/list` e' la risposta
 * piu' pesante che Home Assistant sappia dare, e quando falliva si rifaceva al
 * giro dopo — cioe' a ogni cambio di stato della casa. La linea cadeva, con lei
 * le sottoscrizioni, e i dati sparivano dopo essere comparsi.
 *
 * Quindi non si chiede: si ricorda. Chi i registri li ha gia' in mano — il
 * pannello che ospita la plancia, che li riceve da Home Assistant senza
 * chiedere niente; il rilevamento automatico, che li carica per conto suo; la
 * procedura iniziale — ne ricava una mappa piatta «entita' → nome della
 * stanza» e la lascia qui. Chi disegna la legge, e basta.
 *
 * Si tiene la mappa piatta e non i tre registri interi perche' e' l'unica cosa
 * che serve: i registri sono centinaia di kilobyte di roba — capacita',
 * opzioni, traduzioni — e la stanza di un'entita' e' una riga di testo.
 *
 * Qui dentro non c'e' nessuna presa di rete, e non deve entrarcene: e' la
 * porta che la #553 ha chiuso.
 */

/** Dove la mappa resta fra un caricamento e l'altro. */
export const CHIAVE_DELLE_STANZE = "dm_stanze_di_home_assistant";

/* Ogni quanto ci si degna di rileggere il disco.
 *
 * Chi disegna chiama una volta per entita', e a ogni giro: rileggere e
 * ripassare un oggetto di centinaia di voci tutte le volte sarebbe il genere
 * di spreco che si vede sul termometro del mini PC. Chi scrive sta in un altro
 * programma — il pannello di Home Assistant, non la cornice — quindi non basta
 * fidarsi della propria copia per sempre: un secondo e mezzo e' abbastanza raro
 * da non costare niente e abbastanza fitto da accorgersi dell'arrivo. */
const FRESCHEZZA = 1500;

const pulito = (valore) => (typeof valore === "string" ? valore.trim() : "");

/* I tre registri arrivano in due forme: a elenco da chi li chiede al socket, a
 * dizionario da chi li riceve gia' pronti dal pannello. Sono gli stessi. */
function elenco(valore) {
  if (Array.isArray(valore)) return valore;
  if (valore && typeof valore === "object") return Object.values(valore);
  return [];
}

/* La mappa piatta, dai tre registri.
 *
 * L'area dichiarata sull'entita' vince su quella del dispositivo: e' la stessa
 * regola di Home Assistant, e quella del dispositivo e' il ripiego per le
 * entita' che non la dichiarano. Un'entita' senza area non finisce nella mappa:
 * «non lo so» deve restare vuoto, perche' chi legge possa ripiegare sul nome
 * invece di ricevere una stanza inventata. */
export function stanzeDaiRegistri({ aree, dispositivi, entita } = {}) {
  const nomeDellArea = new Map();
  for (const area of elenco(aree)) {
    const id = pulito(area?.area_id) || pulito(area?.id);
    const nome = pulito(area?.name);
    if (id && nome) nomeDellArea.set(id, nome);
  }
  const areaDelDispositivo = new Map();
  for (const dispositivo of elenco(dispositivi)) {
    const id = pulito(dispositivo?.id) || pulito(dispositivo?.device_id);
    const area = pulito(dispositivo?.area_id);
    if (id && area) areaDelDispositivo.set(id, area);
  }
  const mappa = {};
  for (const voce of elenco(entita)) {
    const id = pulito(voce?.entity_id);
    if (!id) continue;
    const area = pulito(voce?.area_id) || areaDelDispositivo.get(pulito(voce?.device_id)) || "";
    const nome = area ? nomeDellArea.get(area) || "" : "";
    if (nome) mappa[id] = nome;
  }
  return mappa;
}

/* E dalla forma compatta del guscio storico, che i tre registri se li tiene in
 * `WIZ` quando la procedura iniziale li ha caricati. */
export function stanzeDalGuscio(wiz) {
  const registro = wiz?.entReg;
  if (!registro || typeof registro !== "object") return {};
  const mappa = {};
  for (const [entita, riga] of Object.entries(registro)) {
    const id = pulito(entita);
    if (!id) continue;
    const area = pulito(riga?.a) || pulito(wiz?.devArea?.[pulito(riga?.d)]) || "";
    const nome = area ? pulito(wiz?.areaNames?.[area]) : "";
    if (nome) mappa[id] = nome;
  }
  return mappa;
}

/* La copia gia' letta, e quando. */
let tenuta = null;
let letteA = 0;

function adesso() {
  return Date.now();
}

/* Ricordare la mappa per chi verra' dopo.
 *
 * Una mappa vuota non si scrive: chi ha i registri a meta' — il pannello che
 * sta ancora caricando, il rilevamento che non ha trovato niente — non deve
 * poter cancellare quella buona di ieri. E una mappa uguale a quella che c'e'
 * gia' non si riscrive: a ogni caricamento sarebbe una scrittura su disco per
 * niente. Torna `true` soltanto quando qualcosa e' davvero cambiato. */
export function ricordaLeStanze(mappa, storage = globalThis.localStorage) {
  if (!mappa || typeof mappa !== "object" || !Object.keys(mappa).length) return false;
  let scritta = "";
  try {
    scritta = JSON.stringify(mappa);
  } catch (_errore) {
    return false;
  }
  try {
    if (storage?.getItem?.(CHIAVE_DELLE_STANZE) === scritta) return false;
    storage?.setItem?.(CHIAVE_DELLE_STANZE, scritta);
  } catch (_errore) {
    /* Disco pieno o scrittura negata: chi legge ripiega sul nome, come prima. */
    return false;
  }
  tenuta = mappa;
  letteA = adesso();
  return true;
}

/** La mappa ricordata, riletta di rado. */
export function leStanzeRicordate(storage = globalThis.localStorage) {
  if (tenuta && adesso() - letteA < FRESCHEZZA) return tenuta;
  let letta = {};
  try {
    const scritta = storage?.getItem?.(CHIAVE_DELLE_STANZE);
    const uscita = scritta ? JSON.parse(scritta) : null;
    if (uscita && typeof uscita === "object" && !Array.isArray(uscita)) letta = uscita;
  } catch (_errore) {
    letta = {};
  }
  tenuta = letta;
  letteA = adesso();
  return letta;
}

/** La stanza ricordata di un'entita', o vuoto se non se ne sa niente. */
export function stanzaRicordata(entita, storage = globalThis.localStorage) {
  const id = pulito(entita);
  if (!id) return "";
  return pulito(leStanzeRicordate(storage)[id]);
}

/* Gli oggetti dei tre registri visti l'ultima volta. */
let vistiDaHass = null;

/* Le stanze che arrivano insieme a `hass`, ricordate appena arrivano.
 *
 * Questa si chiama a ogni `hass` — cioe' a ogni cambio di stato della casa,
 * decine di volte al minuto — e deve costare quanto tre confronti. Home
 * Assistant i tre registri li sostituisce soltanto quando cambiano davvero, e
 * qui si guardano proprio gli oggetti: stessi tre oggetti, niente da fare.
 *
 * Aspettare il montaggio non basterebbe: al primo `hass` le sottoscrizioni dei
 * registri possono non aver ancora risposto, e chi monta lo fa una volta sola.
 * Cosi' invece la mappa si scrive appena i registri arrivano, e si riscrive
 * quando una stanza viene rinominata o un'entita' spostata. */
export function ricordaLeStanzeDiHomeAssistant(hass, storage = globalThis.localStorage) {
  const aree = hass?.areas;
  const dispositivi = hass?.devices;
  const entita = hass?.entities;
  if (
    vistiDaHass &&
    vistiDaHass.aree === aree &&
    vistiDaHass.dispositivi === dispositivi &&
    vistiDaHass.entita === entita
  )
    return false;
  vistiDaHass = { aree, dispositivi, entita };
  return ricordaLeStanze(stanzeDaiRegistri({ aree, dispositivi, entita }), storage);
}

/** Butta la copia tenuta da parte: la prossima lettura torna sul disco. */
export function dimenticaLeStanze() {
  tenuta = null;
  letteA = 0;
  vistiDaHass = null;
}
