// DM-FIX-20260812B
import { entitaConfigurate } from "./entita-configurate.js";

const STATE_EVENT = "dashboardmodern:state-changed";
const SERVICE_KEY = "DashboardModernEnergyService";
/* Le caselle di configurazione che questo cancello guarda.
 *
 * Non le sa da se': gliele passa chi lo installa, e sono quelle vere —
 * `CONFIG_KEYS`, l'elenco che dice cosa e' configurazione della casa. Qui ce
 * n'era una copia scritta a mano, e una copia a mano di un elenco che cresce
 * e' un elenco che resta indietro: era rimasta a ventun chiavi mentre le vere
 * erano diventate ottanta, e le entita' che stavano solo in quelle mancanti —
 * le prese, i lettori, gli animali, i varchi, le macchine del server, la
 * ventilazione — non passavano piu' di qui. Le loro tessere restavano ferme
 * sull'ultimo valore finche' non si muoveva qualcos'altro.
 */
function chiaviDate(chiavi) {
  const elenco = Array.isArray(chiavi) ? chiavi : [];
  return [...new Set(elenco.map((chiave) => String(chiave || "").trim()).filter(Boolean))];
}

function makeEvent(root, detail) {
  if (typeof root.CustomEvent === "function") return new root.CustomEvent(STATE_EVENT, { detail });
  return { type: STATE_EVENT, detail };
}

/* Quando la configurazione cambia, e non «ogni tanto».
 *
 * L'elenco delle entita' configurate si rifaceva a tempo: ogni cinque secondi,
 * finche' gli eventi scorrevano, si rileggevano venti chiavi dal deposito, si
 * facevano venti JSON.parse e si ricamminava tutto lo stato del negozio. Su una
 * casa che parla di continuo era un lavoro fisso che non scopriva quasi mai
 * niente di nuovo — la configurazione cambia quando qualcuno la cambia.
 *
 * Adesso l'elenco si calcola la prima volta e poi resta, finche' non arriva
 * qualcosa che davvero lo smuove. Le cose che lo smuovono sono due:
 *
 *  - gli avvisi del negozio — un salvataggio dell'utente, un ripristino da
 *    Home Assistant, un azzeramento — che sono i cambi annunciati;
 *  - la scrittura di una chiave di configurazione, che e' l'unica porta per
 *    quelli che non annunciano niente (i gruppi di continuita', le allerte, i
 *    rifiuti, e il guscio storico che scrive per conto suo).
 *
 * Non sono due strade per lo stesso passaggio: sono i due modi in cui una
 * configurazione cambia in questa plancia, e tutti e due finiscono nella stessa
 * riga — dimenticare l'elenco. Rifarlo costa quanto costava, ma una volta per
 * modifica invece che dodici volte al minuto per sempre.
 */
const EVENTI_DI_CONFIGURAZIONE = Object.freeze([
  "dashboardmodern:store-user-write",
  "dashboardmodern:persistence-restored",
  "dashboardmodern:config-reset",
]);

function osservaLaConfigurazione(root, dimentica, osservate) {
  for (const evento of EVENTI_DI_CONFIGURAZIONE) root.addEventListener?.(evento, dimentica);

  const storage = root.localStorage;
  if (!storage || storage.__dmStateEventGateWatch) return;
  /* Si avvolge una volta sola per deposito, e si chiama sempre quello che
   * c'era prima: il negozio avvolge lo stesso metodo per i fatti suoi, e i due
   * involucri devono poter convivere in qualunque ordine si installino. */
  const scrivi = storage.setItem?.bind(storage);
  const cancella = storage.removeItem?.bind(storage);
  if (!scrivi) return;
  storage.setItem = function setItemOsservato(key, value) {
    const esito = scrivi(key, value);
    if (osservate.has(key)) dimentica();
    return esito;
  };
  if (cancella) {
    storage.removeItem = function removeItemOsservato(key) {
      const esito = cancella(key);
      if (osservate.has(key)) dimentica();
      return esito;
    };
  }
  storage.__dmStateEventGateWatch = true;
}

/* Le entita' che qualcuno sta guardando adesso, anche se la configurazione di
 * questa plancia non le nomina.
 *
 * «Se clicco per spegnere la luce in casa si spegne istantaneamente, ma sulla
 * wall il cambio stato non e' immediato.» La plancia a muro prende le luci, il
 * clima e le tapparelle da un'altra plancia — di solito la principale — e nella
 * configurazione sua quelle entita' non ci sono: il cancello le buttava come
 * chiacchiere della casa, e il tablet si ridisegnava solo al suo battito, ogni
 * quindici secondi.
 *
 * Chi mostra entita' prese altrove mette qui una domanda, `(id) => risposta`:
 * `false` per «non mi interessa», qualunque altra cosa per «la sto mostrando».
 * Quelle mostrate passano, e non aspettano il mezzo secondo del mazzetto: chi
 * le guarda e' un pannello a muro, e li' il ritardo si vede. */
export const IN_VISTA_KEY = "__DM_ENTITA_IN_VISTA__";
const SUBITO_MS = 40;

function inVista(root, id) {
  try {
    const domanda = root[IN_VISTA_KEY];
    return typeof domanda === "function" ? Boolean(domanda(id)) : false;
  } catch (_errore) {
    return false;
  }
}

/**
 * Discard live updates that are not used anywhere by the dashboard, then
 * coalesce the remaining notifications into a bounded batch. State registries
 * are still updated synchronously by the original broker. The initial
 * get_states snapshot never reaches this gate: the broker ingests it with
 * `emitEvent: false`, so there is no bootstrap storm to suppress here.
 */
export function installStateEventGate(
  broker,
  root = globalThis,
  { delay = 500, chiavi = [] } = {},
) {
  if (!broker || typeof broker.ingestState !== "function" || broker.__dmStateEventGate)
    return false;

  const osservate = chiaviDate(chiavi);
  const original = broker.ingestState;
  const pendingIds = new Set();
  let lastState = null;
  let timer = 0;
  let timerSubito = false;
  let interests = null;

  const currentInterests = () => {
    if (!interests) interests = entitaConfigurate(root, osservate);
    return interests;
  };
  /* Non si ricalcola qui: si dimentica, e il primo evento che passa lo rifa'.
   * Un salvataggio ne annuncia spesso piu' d'uno di seguito — il negozio
   * scrive tutte le sue chiavi — e rifare l'elenco a ogni scrittura vorrebbe
   * dire rifarlo dieci volte per un salvataggio solo. */
  osservaLaConfigurazione(
    root,
    () => {
      interests = null;
    },
    new Set(osservate),
  );

  const flush = () => {
    timer = 0;
    timerSubito = false;
    if (!pendingIds.size) return;
    const entityIds = [...pendingIds];
    pendingIds.clear();
    const state = lastState;
    lastState = null;
    root.dispatchEvent?.(
      makeEvent(root, {
        entity_id: entityIds.at(-1) || "",
        entity_ids: entityIds,
        state,
        coalesced: true,
      }),
    );
  };

  const queue = (state) => {
    const id = String(state?.entity_id || "").trim();
    if (!id) return;
    const configured = currentInterests();
    // If neither the canonical nor legacy configuration is ready yet, remain
    // backward compatible and allow the event. Once configuration is known,
    // unrelated Home Assistant chatter is ignored.
    const visto = inVista(root, id);
    if (!visto && configured.size && !configured.has(id)) return;
    pendingIds.add(id);
    lastState = state || lastState;
    const attesa = Math.max(0, Number(delay) || 0);
    const subito = visto && attesa > SUBITO_MS;
    /* Un mazzetto gia' in partenza basta, a meno che questo stato sia in
     * vista e il mazzetto stia ancora aspettando il suo mezzo secondo: allora
     * parte prima, e si porta dietro anche gli altri. */
    if (timer && (timerSubito || !subito)) return;
    if (timer) root.clearTimeout?.(timer);
    timerSubito = subito;
    timer = root.setTimeout?.(flush, subito ? SUBITO_MS : attesa) || 0;
    if (!timer) root.queueMicrotask?.(flush);
  };

  broker.ingestState = function gatedIngestState(state, options) {
    const dispatch = root.dispatchEvent;

    if (typeof dispatch !== "function") return original.call(this, state, options);

    root.dispatchEvent = function gatedDispatch(event) {
      if (event?.type === STATE_EVENT) {
        queue(state);
        return true;
      }
      return dispatch.call(root, event);
    };

    try {
      return original.call(this, state, options);
    } finally {
      root.dispatchEvent = dispatch;
    }
  };

  Object.defineProperty(broker, "__dmStateEventGate", {
    value: Object.freeze({ flush, pendingIds, currentInterests }),
    configurable: false,
    enumerable: false,
    writable: false,
  });
  return true;
}

/**
 * Arm a setter before energy-section.js is evaluated. That makes the broker
 * gate installation synchronous with DashboardModernEnergyService assignment,
 * so there is no race with a very fast bridge/WebSocket during startup.
 */
export function armStateEventGate(root = globalThis) {
  const current = root[SERVICE_KEY];
  if (current?.broker) {
    installStateEventGate(current.broker, root);
    return true;
  }

  const descriptor = Object.getOwnPropertyDescriptor(root, SERVICE_KEY);
  if (descriptor && !descriptor.configurable) return false;
  if (descriptor?.set?.__dmStateEventGateSetter) return true;

  let value = descriptor?.value;
  const setter = function setEnergyService(next) {
    value = next;
    installStateEventGate(next?.broker, root);
  };
  Object.defineProperty(setter, "__dmStateEventGateSetter", { value: true });

  Object.defineProperty(root, SERVICE_KEY, {
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
    get() {
      return value;
    },
    set: setter,
  });
  return true;
}

(() => {
  try {
    armStateEventGate();
  } catch (errore) {
    (globalThis.__DASHBOARDMODERN_PEZZI_CADUTI__ ||= []).push({
      pezzo: "armStateEventGate",
      errore: String(errore?.message || errore),
    });
    globalThis.console?.error?.("[DashboardModern] armStateEventGate non e' partito", errore);
  }
})();
