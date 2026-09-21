/* Quali entità ha configurato questa casa.
 *
 * La risposta la dà la configurazione: si guarda dentro tutto quello che chi
 * abita ha compilato — le sezioni del magazzino, le caselle del guscio, le
 * chiavi salvate — e si tiene quello che ha la forma di un identificativo.
 *
 * Stava dentro `state-event-gate.js`, che se ne serve per la sua domanda: se
 * uno stato che arriva riguarda qualcosa che questa casa usa, o se si può
 * buttare senza ridisegnare niente. Poi è arrivata una seconda domanda — chi,
 * fra queste, in questo momento non risponde (#33) — ed è la stessa risposta
 * vista da un'altra parte. Una copia a mano di un elenco così è un elenco che
 * resta indietro: è già successo proprio qui, e le entità che stavano solo
 * nelle chiavi dimenticate sparivano in silenzio dalle tessere.
 *
 * Quindi l'elenco è uno. Le chiavi da guardare non se le sa da sé: gliele
 * passa chi chiama, e sono quelle vere (`CONFIG_KEYS`).
 */

const ENTITY_ID = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/i;

function collectEntityIds(value, output, depth = 0) {
  if (depth > 12 || value == null) return;
  if (typeof value === "string") {
    const id = value.trim();
    if (ENTITY_ID.test(id)) output.add(id);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectEntityIds(entry, output, depth + 1));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((entry) => collectEntityIds(entry, output, depth + 1));
  }
}

function collectStoredConfig(root, ids, chiavi) {
  const storage = root.localStorage;
  if (!storage?.getItem) return;
  for (const key of chiavi) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      let value = raw;
      try {
        value = JSON.parse(raw);
      } catch (_error) {}
      collectEntityIds(value, ids);
    } catch (_error) {}
  }
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

/**
 * Gli identificativi che questa casa ha configurato, senza ripetizioni.
 */
export function entitaConfigurate(root, chiavi) {
  const ids = new Set();
  try {
    collectEntityIds(root.DashboardModernModules?.store?.getState?.()?.sections, ids);
  } catch (_error) {}
  try {
    collectEntityIds(root.CD_BAKED_CONFIG, ids);
  } catch (_error) {}
  try {
    collectEntityIds(root.ENTITY_OVERRIDES, ids);
  } catch (_error) {}
  collectStoredConfig(root, ids, chiavi);
  return ids;
}
