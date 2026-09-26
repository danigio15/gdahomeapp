/* Di che dispositivo e' ogni entita' — anche al caricamento dopo.
 *
 * «Non devi mettere le entita' ma i dispositivi non connessi, cosi' come li
 * mostri nel cruscotto installatore.»
 *
 * Il cruscotto quei dispositivi li sa perche' glieli manda il ponte, che i
 * registri di Home Assistant ce li ha in mano. La plancia no: chi disegna i
 * registri non li ha, e chiederli si e' gia' provato — e' costata la #553,
 * perche' `config/entity_registry/list` e' la risposta piu' pesante che Home
 * Assistant sappia dare e rifarla a ogni giro buttava giu' la linea.
 *
 * Quindi si fa come per le stanze, nel file qui accanto: non si chiede, si
 * ricorda. Chi i registri ce li ha gia' — il pannello che ospita la plancia,
 * il rilevamento automatico, la procedura iniziale — ne ricava due mappe
 * piatte e le lascia qui. Chi disegna le legge, e basta.
 *
 * Due mappe e non una sola con dentro tutto: un dispositivo ha molte entita',
 * e ripetere il suo nome accanto a ognuna vorrebbe dire scrivere «Leapmotor
 * B10» quaranta volte. `di` dice a chi appartiene un'entita', `nomi` come si
 * chiama quel qualcuno.
 *
 * Qui dentro non c'e' nessuna presa di rete, e non deve entrarcene: e' la
 * stessa porta che la #553 ha chiuso.
 */

/** Dove le mappe restano fra un caricamento e l'altro. */
export const CHIAVE_DEI_DISPOSITIVI = "dm_dispositivi_di_home_assistant";

/* Ogni quanto ci si degna di rileggere il disco: la stessa cadenza delle
 * stanze, e per la stessa ragione — chi scrive sta in un altro programma. */
const FRESCHEZZA = 1500;

const pulito = (valore) => (typeof valore === "string" ? valore.trim() : "");

/* I registri arrivano in due forme: a elenco da chi li chiede al socket, a
 * dizionario da chi li riceve gia' pronti dal pannello. Sono gli stessi. */
function elenco(valore) {
  if (Array.isArray(valore)) return valore;
  if (valore && typeof valore === "object") return Object.values(valore);
  return [];
}

/** Le due mappe sono vuote, o non ci sono proprio. */
export function nonSiSaNiente(mappe) {
  return !mappe || !mappe.di || !Object.keys(mappe.di).length;
}

/* Le due mappe, dai registri.
 *
 * Un'entita' senza dispositivo non finisce nella mappa, e non e' una
 * dimenticanza: «non lo so» deve restare vuoto, perche' chi legge possa
 * trattarla per conto suo invece di riceverla appiccicata a un dispositivo
 * inventato. Ce ne sono, e sono normali — un `input_boolean`, un template, il
 * meteo. */
export function dispositiviDaiRegistri({ dispositivi, entita } = {}) {
  const nomi = {};
  for (const dispositivo of elenco(dispositivi)) {
    const id = pulito(dispositivo?.id) || pulito(dispositivo?.device_id);
    if (!id) continue;
    /* Il nome che gli ha messo chi abita vince su quello di fabbrica: e' la
     * stessa regola di Home Assistant, ed e' il nome che uno riconosce. */
    const nome = pulito(dispositivo?.name_by_user) || pulito(dispositivo?.name);
    if (nome) nomi[id] = nome;
  }
  const di = {};
  for (const voce of elenco(entita)) {
    const id = pulito(voce?.entity_id);
    const suo = pulito(voce?.device_id);
    if (id && suo) di[id] = suo;
  }
  return { di, nomi };
}

/* E dalla forma compatta del guscio storico, che i registri se li tiene in
 * `WIZ` quando la procedura iniziale li ha caricati. Li' il nome del
 * dispositivo puo' non esserci: senza, resta il raggruppamento — che e' la
 * parte che conta — e il nome lo mette chi disegna, dal piu' comune fra i
 * nomi delle entita'. */
export function dispositiviDalGuscio(wiz) {
  const registro = wiz?.entReg;
  if (!registro || typeof registro !== "object") return { di: {}, nomi: {} };
  const di = {};
  for (const [entita, riga] of Object.entries(registro)) {
    const id = pulito(entita);
    const suo = pulito(riga?.d);
    if (id && suo) di[id] = suo;
  }
  const nomi = {};
  const scritti = wiz?.devNames;
  if (scritti && typeof scritti === "object")
    for (const [suo, nome] of Object.entries(scritti)) {
      const id = pulito(suo);
      const scritto = pulito(nome);
      if (id && scritto) nomi[id] = scritto;
    }
  return { di, nomi };
}

/* La copia gia' letta, e quando. */
let tenute = null;
let letteA = 0;

function adesso() {
  return Date.now();
}

/* Ricordarle per chi verra' dopo.
 *
 * Mappe vuote non si scrivono: chi ha i registri a meta' — il pannello che sta
 * ancora caricando — non deve poter cancellare quelle buone di ieri. E mappe
 * uguali a quelle che ci sono gia' non si riscrivono: a ogni caricamento
 * sarebbe una scrittura su disco per niente. Torna `true` soltanto quando
 * qualcosa e' davvero cambiato. */
export function ricordaIDispositivi(mappe, storage = globalThis.localStorage) {
  if (nonSiSaNiente(mappe)) return false;
  let scritta = "";
  try {
    scritta = JSON.stringify({ di: mappe.di, nomi: mappe.nomi || {} });
  } catch (_errore) {
    return false;
  }
  try {
    if (storage?.getItem?.(CHIAVE_DEI_DISPOSITIVI) === scritta) return false;
    storage?.setItem?.(CHIAVE_DEI_DISPOSITIVI, scritta);
  } catch (_errore) {
    /* Disco pieno o scrittura negata: chi legge ripiega sulle entita' sciolte,
     * come faceva prima che questo file esistesse. */
    return false;
  }
  tenute = { di: mappe.di, nomi: mappe.nomi || {} };
  letteA = adesso();
  return true;
}

/** Le mappe ricordate, rilette di rado. */
export function iDispositiviRicordati(storage = globalThis.localStorage) {
  if (tenute && adesso() - letteA < FRESCHEZZA) return tenute;
  let lette = { di: {}, nomi: {} };
  try {
    const scritta = storage?.getItem?.(CHIAVE_DEI_DISPOSITIVI);
    const uscita = scritta ? JSON.parse(scritta) : null;
    if (uscita && typeof uscita === "object" && !Array.isArray(uscita))
      lette = {
        di: uscita.di && typeof uscita.di === "object" ? uscita.di : {},
        nomi: uscita.nomi && typeof uscita.nomi === "object" ? uscita.nomi : {},
      };
  } catch (_errore) {
    lette = { di: {}, nomi: {} };
  }
  tenute = lette;
  letteA = adesso();
  return lette;
}

/* I registri visti l'ultima volta. */
let vistiDaHass = null;

/**
 * Le mappe da un oggetto `hass`, quando e' cambiato qualcosa.
 *
 * Il confronto e' per identita' e non per contenuto: quei registri sono
 * centinaia di kilobyte, e Home Assistant ne rifa' l'oggetto solo quando
 * cambiano davvero.
 */
export function ricordaIDispositiviDiHomeAssistant(hass, storage = globalThis.localStorage) {
  const dispositivi = hass?.devices;
  const entita = hass?.entities;
  if (vistiDaHass && vistiDaHass.dispositivi === dispositivi && vistiDaHass.entita === entita)
    return false;
  vistiDaHass = { dispositivi, entita };
  return ricordaIDispositivi(dispositiviDaiRegistri({ dispositivi, entita }), storage);
}

/** Butta la copia tenuta da parte: la prossima lettura torna sul disco. */
export function dimenticaIDispositivi() {
  tenute = null;
  letteA = 0;
  vistiDaHass = null;
}
