/* L'inventario di casa, senza i dati.
 *
 * Per configurare una plancia da lontano l'editor deve sapere **cosa c'e'**
 * in casa: quali entita', come si chiamano, di che tipo sono, in quale stanza
 * stanno, a quale dispositivo appartengono. E' quello che l'editor chiede a
 * Home Assistant quando gira in casa — `get_states` e i tre registri — e
 * quello che il quadro non ha, perche' in casa non entra.
 *
 * Quello che l'editor **non** deve sapere e' cosa quelle entita' stanno
 * facendo: se la porta e' aperta, chi c'e' in casa, quanti gradi ci sono,
 * l'immagine della telecamera. Un inventario e' l'elenco di cosa c'e', non un
 * rapporto su cosa succede — ed e' la riga che tiene in piedi il permesso di
 * configurare da lontano (`quadro_configurazione`).
 *
 * Quindi qui si passa al setaccio, per nome: di ogni entita' resta l'id, un
 * nome e le **capacita'** — la classe, l'unita', quali modi sa fare, quanti
 * colori — e lo stato esce come `unknown`, che e' il modo in cui Home
 * Assistant dice «non lo so». Dei registri restano i nomi, le stanze, i
 * collegamenti fra entita' e dispositivi, e chi li porta: non i seriali, non
 * gli indirizzi di rete, non le versioni del firmware, non un indirizzo di
 * immagine. Quello che non e' in questi elenchi non parte, qualunque sia.
 *
 * Il setaccio e' scritto qui, e il quadro ne tiene una copia identica
 * (`quadro/src/inventario.js`): quello che arriva da una casa ripassa dallo
 * stesso setaccio prima di essere tenuto, cosi' una casa con un add-on
 * modificato non fa arrivare all'installatore piu' di quello che questo file
 * dice.
 */

/* Lo stato di ogni entita', per come esce: «non lo so». */
export const STATO_CIECO = "unknown";

/* Gli attributi di uno stato che sono una capacita' e non un dato. La lista
 * e' chiusa: quello che non c'e' non passa, e aggiungere una riga e'
 * aggiungere qualcosa che esce da casa. */
export const ATTRIBUTI_CHE_VIAGGIANO = Object.freeze([
  "friendly_name",
  "icon",
  "device_class",
  "state_class",
  "unit_of_measurement",
  "supported_features",
  "assumed_state",
  "entity_category",
  /* Clima, scaldabagno, deumidificatore: i modi che sanno fare e i limiti. */
  "hvac_modes",
  "preset_modes",
  "fan_modes",
  "swing_modes",
  "min_temp",
  "max_temp",
  "target_temp_step",
  "temperature_unit",
  "operation_list",
  "available_modes",
  "min_humidity",
  "max_humidity",
  /* Luci: che colori sanno fare. */
  "supported_color_modes",
  "effect_list",
  "min_mireds",
  "max_mireds",
  "min_color_temp_kelvin",
  "max_color_temp_kelvin",
  /* Numeri, selezioni, date. */
  "min",
  "max",
  "step",
  "mode",
  "options",
  "has_date",
  "has_time",
  /* Lettori multimediali e robot: da dove sanno leggere, quanto forte. */
  "source_list",
  "sound_mode_list",
  "fan_speed_list",
  /* Telecamere: **come** sanno trasmettere, non da dove. */
  "frontend_stream_type",
  "brand",
  "model_name",
]);

/* I campi del registro delle entita' che sono struttura, non dati. */
const REGISTRO_ENTITA = Object.freeze([
  "id",
  "entity_id",
  "device_id",
  "area_id",
  "name",
  "original_name",
  "platform",
  "disabled_by",
  "hidden_by",
  "entity_category",
  "icon",
  "original_icon",
  "device_class",
  "original_device_class",
  "unit_of_measurement",
  "translation_key",
  "has_entity_name",
  "labels",
]);

/* Del registro dei dispositivi: chi e', dove sta, chi lo porta. Non i
 * seriali (`identifiers`), non gli indirizzi di rete (`connections`), non
 * le versioni. */
const REGISTRO_DISPOSITIVI = Object.freeze([
  "id",
  "name",
  "name_by_user",
  "area_id",
  "manufacturer",
  "model",
  "model_id",
  "via_device_id",
  "disabled_by",
  "entry_type",
  "config_entries",
  "primary_config_entry",
  "labels",
]);

/* Delle stanze: il nome e il piano. Non `picture`, che e' un indirizzo. */
const REGISTRO_STANZE = Object.freeze(["area_id", "name", "floor_id", "icon", "aliases", "labels"]);

const REGISTRO_PIANI = Object.freeze(["floor_id", "name", "level", "icon", "aliases"]);

/* Quante entita' e quante voci di registro si accettano: una casa vera sta
 * sotto le duemila entita', e un inventario da centomila non e' un
 * inventario. */
export const VOCI_AL_MASSIMO = 10000;

const ENTITA_BUONA = /^[a-z_]+\.[a-z0-9_]+$/;

/* Un valore di attributo che si lascia passare: un numero, un booleano, una
 * stringa corta, un elenco di stringhe o numeri corti. Un oggetto no — non
 * c'e' capacita' che sia un oggetto, e un oggetto e' il posto dove finiscono
 * le cose che non si sono guardate. */
function valoreSemplice(valore, profondita = 0) {
  if (valore === null || valore === undefined) return null;
  if (typeof valore === "boolean") return valore;
  if (typeof valore === "number") return Number.isFinite(valore) ? valore : null;
  if (typeof valore === "string") return valore.slice(0, 200);
  if (Array.isArray(valore)) {
    if (profondita > 0) return null;
    return valore
      .slice(0, 200)
      .map((uno) => valoreSemplice(uno, 1))
      .filter((uno) => uno !== null);
  }
  return null;
}

/* Le chiavi elencate, e solo quelle, con valori semplici. */
function soloQueste(voce, chiavi) {
  const fuori = {};
  if (!voce || typeof voce !== "object") return fuori;
  for (const chiave of chiavi) {
    if (!Object.hasOwn(voce, chiave)) continue;
    const valore = valoreSemplice(voce[chiave]);
    if (valore !== null) fuori[chiave] = valore;
  }
  return fuori;
}

const elenco = (valore) => (Array.isArray(valore) ? valore.slice(0, VOCI_AL_MASSIMO) : []);

/* Uno stato, cieco: l'id, le capacita', e «non lo so» al posto dello stato. */
export function statoCieco(stato) {
  const entityId = String(stato?.entity_id ?? "");
  if (!ENTITA_BUONA.test(entityId)) return null;
  return {
    entity_id: entityId,
    state: STATO_CIECO,
    attributes: soloQueste(stato?.attributes, ATTRIBUTI_CHE_VIAGGIANO),
  };
}

/**
 * L'inventario, passato al setaccio. Le cinque liste sono quelle che Home
 * Assistant risponde a `get_states`, `config/entity_registry/list`,
 * `config/device_registry/list`, `config/area_registry/list` e
 * `config/floor_registry/list`; quello che manca esce come lista vuota.
 */
export function inventarioSenzaDati({ stati, entita, dispositivi, stanze, piani } = {}) {
  return {
    stati: elenco(stati)
      .map(statoCieco)
      .filter((uno) => uno !== null),
    entita: elenco(entita)
      .filter((una) => ENTITA_BUONA.test(String(una?.entity_id ?? "")))
      .map((una) => soloQueste(una, REGISTRO_ENTITA)),
    dispositivi: elenco(dispositivi)
      .filter((uno) => typeof uno?.id === "string" && uno.id)
      .map((uno) => soloQueste(uno, REGISTRO_DISPOSITIVI)),
    stanze: elenco(stanze)
      .filter((una) => typeof una?.area_id === "string" && una.area_id)
      .map((una) => soloQueste(una, REGISTRO_STANZE)),
    piani: elenco(piani)
      .filter((uno) => typeof uno?.floor_id === "string" && uno.floor_id)
      .map((uno) => soloQueste(uno, REGISTRO_PIANI)),
  };
}

/* Se questo e' un inventario come lo fa `inventarioSenzaDati`: cinque liste.
 * Serve a chi lo riceve, per non tenere un oggetto qualunque. */
export function eUnInventario(cosa) {
  return Boolean(
    cosa &&
    typeof cosa === "object" &&
    !Array.isArray(cosa) &&
    ["stati", "entita", "dispositivi", "stanze", "piani"].every((chiave) =>
      Array.isArray(cosa[chiave]),
    ),
  );
}
