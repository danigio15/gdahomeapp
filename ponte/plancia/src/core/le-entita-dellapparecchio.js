/* Tutto quello che un elettrodomestico legge, in un elenco solo (#107).
 *
 * «Lo stato della marcia funziona e cambia stato mentre quello delle porte
 * (correttamente funzionanti in home assistant) non viene rilevato.» «In
 * pratica se aggiungo due binary_sensor delle porte non rileva lo stato né
 * colora la card.»
 *
 * Non è la lettura della porta a essere rotta — quella è giusta, e la si vede
 * giusta riaprendo la pagina. È il RIDISEGNO: la sezione degli
 * elettrodomestici non si rifà a ogni respiro della casa, perché un misuratore
 * di potenza manda stati in continuazione e rifare tutte le schede a ogni
 * infornata costa. Si rifà quando cambia qualcosa che le schede mostrano, e
 * per sapere quali entità sono quel «qualcosa» c'era un elenco scritto a mano.
 *
 * Quell'elenco aveva dentro l'interruttore, lo stato, la potenza e i contatori
 * dell'energia — e basta. La porta no, la temperatura no, il tempo che manca
 * no, l'anomalia no, e nemmeno le letture, i comandi e le voci che accendono
 * la card scelti a mano. Cambiava la porta del frigo, la plancia guardava
 * l'elenco, non la trovava, e non rifaceva niente: la scheda restava quella
 * di un minuto prima. Lo stato della marcia invece nell'elenco c'era, ed è per
 * questo che «la marcia funziona e la porta no» — due comportamenti diversi
 * sulla stessa scheda, che è il difetto come si vede da fuori.
 *
 * Un elenco scritto a mano accanto ai campi che legge qualcun altro si scolla
 * sempre: ogni casella nuova va aggiunta in due posti, e il giorno che se ne
 * dimentica uno il difetto è questo, silenzioso. Quindi l'elenco sta qui, una
 * volta sola, e dice una cosa sola: quali entità questo apparecchio guarda.
 *
 * Il modulo è puro: entra un apparecchio, esce un elenco di identificativi.
 */

import { elencoComandi } from "./comandi-accanto.js";
import { elencoColorano, CAMPO_COLORANO } from "./le-voci-che-colorano.js";
import { elencoLetture } from "./letture-accanto.js";

const clean = (valore) => String(valore ?? "").trim();

/* Un campo può tenere l'identificativo nudo o l'oggetto che lo porta dentro:
 * è la stessa forma con cui viaggiano dappertutto nella configurazione. */
const identificativo = (valore) =>
  clean(typeof valore === "string" ? valore : valore?.entity || valore?.entity_id);

/**
 * Le caselle a nome fisso di un apparecchio.
 *
 * Sono tutte quelle che i modelli della scheda e della finestra vanno a
 * leggere — `appliance-view-model`, `appliance-card-view-model`,
 * `appliance-cycle-tracker`, `appliance-program` e la finestra del dettaglio.
 * Chi aggiunge una casella nuova la aggiunge qui, e il ridisegno la vede senza
 * doverci pensare.
 */
export const CASELLE_DELL_APPARECCHIO = Object.freeze([
  "entity",
  "control_entity",
  "switch_entity",
  "state_entity",
  "status_entity",
  "power_entity",
  /* I nomi vecchi delle stesse cose. `appliance-view-model` li guarda ancora —
   * `candidates(device, ["control_entity", "switch_entity", "switch", "light",
   * "fan"])` — perché configurazioni scritte prima li portano, e un
   * apparecchio che la scheda legge da `switch` e il ridisegno non guarda è lo
   * stesso difetto della porta, su un'altra casella. */
  "switch",
  "light",
  "fan",
  "power",
  "power_sensor",
  "energy",
  "energy_entity",
  "energy_today",
  "daily_energy",
  "daily_energy_entity",
  "monthly_energy_entity",
  "total_energy_entity",
  "history_entity",
  "report_entity",
  "remaining_entity",
  "cycle_duration_entity",
  /* Le due temperature: frigo e congelatore nello stesso apparecchio sono due
   * numeri, non uno, e la seconda si scordava esattamente come la porta. */
  "temperature_entity",
  "temperature_entity_2",
  "door_entity",
  "alert_entity",
  "last_start_entity",
  "last_duration_entity",
  "last_energy_entity",
  "last_cost_entity",
]);

/* Le caselle che tengono un ELENCO di entità invece di una sola. `entities` e
 * `device_entities` sono quelle che arrivano dal legame con l'integrazione;
 * `letture`, `comandi` e `colorano` quelle scelte a mano. */
const ELENCHI = Object.freeze([
  { campo: "entities", pulisci: null },
  { campo: "device_entities", pulisci: null },
  { campo: "letture", pulisci: elencoLetture },
  { campo: "comandi", pulisci: elencoComandi },
  { campo: CAMPO_COLORANO, pulisci: elencoColorano },
]);

/**
 * Le entità che questo apparecchio guarda, senza ripetizioni.
 *
 * Nell'ordine in cui sono scritte qui sopra, che non conta per chi confronta e
 * conta per chi legge un elenco stampato durante una diagnosi.
 */
export function entitaDellApparecchio(apparecchio = {}) {
  const viste = new Set();
  const elenco = [];
  const aggiungi = (valore) => {
    const id = identificativo(valore);
    /* Un identificativo di Home Assistant ha sempre il punto. Senza questa
     * riga una casella lasciata a metà — «sensor» scritto e poi ripensato —
     * diventerebbe una voce che non è di nessuno e sveglierebbe il ridisegno
     * a ogni cambio di stato della casa. */
    if (!id || !id.includes(".") || viste.has(id)) return;
    viste.add(id);
    elenco.push(id);
  };
  for (const casella of CASELLE_DELL_APPARECCHIO) aggiungi(apparecchio?.[casella]);
  for (const { campo, pulisci } of ELENCHI) {
    const scritto = apparecchio?.[campo];
    if (pulisci) {
      for (const voce of pulisci(scritto)) aggiungi(voce);
      continue;
    }
    for (const voce of Array.isArray(scritto) ? scritto : []) aggiungi(voce);
  }
  return elenco;
}

/** Le entità di tutti gli apparecchi insieme, pronte da confrontare. */
export function entitaDegliApparecchi(apparecchi = []) {
  const insieme = new Set();
  for (const apparecchio of Array.isArray(apparecchi) ? apparecchi : [])
    for (const entity of entitaDellApparecchio(apparecchio)) insieme.add(entity);
  return insieme;
}
