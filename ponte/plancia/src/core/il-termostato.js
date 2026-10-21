/* Il termostato: acceso non vuol dire in funzione.
 *
 * «Con l'ultimo aggiornamento mi da' ancora il clima acceso. Ma il clima e'
 * spento.» Era un Netatmo in «auto», in antigelo a 12 gradi con 23 in casa,
 * `hvac_action: idle`: la plancia lo contava fra le «unita' accese» perche' il
 * suo stato non era «off». Un termostato sta in «heat» o in «auto» tutto
 * l'inverno, ed e' il suo mestiere: e' acceso quando scalda, non quando c'e'.
 *
 * La regola era gia' quella delle notifiche del ponte (`sentinella.js`); qui
 * sta una volta sola, e la leggono la Home, la pastiglia «unita' accese», la
 * pagina Clima e il ponte.
 */
import { canonicalClimateType } from "./device-model.js";
import { eUnTermostatoACoppia } from "./i-due-obiettivi-del-clima.js";

const SPENTO = new Set(["off", "unavailable", "unknown", "none", ""]);

/* Le modalita' di chi raffresca: chi ne ha una e' un condizionatore o una
 * pompa di calore, non un termostato del riscaldamento. */
const MODI_DEL_FREDDO = new Set(["cool", "dry", "fan_only", "heat_cool"]);

/**
 * Un termostato: la valvola del termosifone, il cronotermostato della
 * caldaia, il termostato a coppia. Si riconosce dal tipo scritto nella
 * plancia (`termo` nel Clima), dalle modalita' (scalda e basta: nessuna del
 * freddo) o dai due obiettivi del termostato a coppia.
 */
export function eUnTermostato(stato, unita = null) {
  if (unita && canonicalClimateType(unita.type) === "termo") return true;
  const attributi = stato?.attributes || {};
  if (eUnTermostatoACoppia(attributi)) return true;
  const modi = Array.isArray(attributi.hvac_modes)
    ? attributi.hvac_modes.map((m) => String(m).toLowerCase())
    : [];
  return modi.includes("heat") && !modi.some((m) => MODI_DEL_FREDDO.has(m));
}

/**
 * Se un termostato sta scaldando adesso — non se e' in «heat». Lo dice
 * `hvac_action`; chi non lo pubblica (tante valvole) scalda solo se la stanza
 * e' sotto l'obiettivo di almeno mezzo grado.
 */
export function termostatoCheScalda(stato) {
  const modo = String(stato?.state ?? "").toLowerCase();
  if (SPENTO.has(modo)) return false;
  const attributi = stato?.attributes || {};
  const azione = String(attributi.hvac_action ?? "").toLowerCase();
  if (azione) return ["heating", "preheating", "cooling"].includes(azione);
  const adesso = Number(attributi.current_temperature);
  const obiettivo = Number(attributi.temperature);
  if (!Number.isFinite(adesso) || !Number.isFinite(obiettivo)) return false;
  return adesso < obiettivo - 0.5;
}

/**
 * Se un'unita' del clima conta fra quelle accese: un termostato quando
 * scalda, tutte le altre quando non sono spente.
 */
export function climaInFunzione(stato, unita = null) {
  if (!stato) return false;
  const modo = String(stato.state ?? "").toLowerCase();
  if (SPENTO.has(modo)) return false;
  if (eUnTermostato(stato, unita)) return termostatoCheScalda(stato);
  return true;
}
