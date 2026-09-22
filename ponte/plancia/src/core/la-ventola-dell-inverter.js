/* Il tasto della ventola dell'inverter manda un ordine vero (#112).
 *
 * «Ventola inverter indica il sensore di potenza ma manca proprio la
 * possibilità di inserire entità switch.»
 *
 * La casella c'e', e da un pezzo: nella scheda «🌡️ Temperature e
 * raffreddamento» dell'Energia, con tanto di segnaposto `switch.ventola_
 * inverter`. E la potenza si legge bene. Quello che non c'e' mai stato e'
 * l'ordine: premendo la card, il guscio manda a Home Assistant
 *
 *     switch.toggle  →  entity_id: "dm.energy_interruttore_ventola_inverter"
 *
 * cioe' il NOME DELLA CASELLA al posto dell'entita' che ci hanno messo
 * dentro. `dm.energy_interruttore_ventola_inverter` non e' un'entita' e non
 * esiste in nessuna casa: Home Assistant non trova niente da accendere e non
 * succede niente. La lettura invece passa da `getRawState`, che il
 * riferimento lo risolve — ed e' per questo che la potenza si vede e
 * l'interruttore no. Da fuori sembra che la casella dello switch non ci sia.
 *
 * Fallire in silenzio era il suo modo di fallire, come per il tasto del
 * clima: «impostando correttamente le entita' non si accendono».
 *
 * ── Perche' `homeassistant.toggle` e non `switch.toggle` ─────────────────
 *
 * Perche' la casella non dice «switch»: dice «interruttore della ventola», e
 * chi ce l'ha su un `fan.`, su un `input_boolean.` o su una `light.` ha
 * ragione quanto chi ce l'ha su uno `switch.`. Il segnaposto e' un esempio,
 * non una regola.
 *
 * `homeassistant.toggle` e' il servizio che Home Assistant gira al dominio
 * giusto da solo: una regola sola invece di una tabella di domini da tenere
 * aggiornata, e nessuna casa esclusa perche' qualcuno non aveva previsto il
 * suo caso.
 *
 * Quello che NON si comanda lo si dice, invece di provarci: un `sensor.` non
 * si accende, e un tasto che ci prova e tace lascia la persona a chiedersi se
 * sia rotta la ventola o la plancia.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** Dove la plancia tiene l'interruttore della ventola. */
export const RIFERIMENTO_DELLA_VENTOLA = "dm.energy_interruttore_ventola_inverter";

/* I domini che si leggono e basta.
 *
 * Non e' l'elenco di quello che si comanda — quello cambia a ogni versione di
 * Home Assistant, e tenerlo aggiornato vorrebbe dire escludere il dominio
 * nuovo di domani. E' l'elenco corto di quello che di sicuro NON si comanda,
 * e tutto il resto passa. */
export const DOMINI_DI_SOLA_LETTURA = Object.freeze([
  "sensor",
  "binary_sensor",
  "device_tracker",
  "person",
  "sun",
  "weather",
  "zone",
  "update",
]);

const soloLettura = new Set(DOMINI_DI_SOLA_LETTURA);

/**
 * Cosa si deve mandare a Home Assistant per accendere o spegnere la ventola.
 *
 * Entra l'entita' gia' risolta — il riferimento `dm.*` lo scioglie chi ha il
 * documento — ed esce la chiamata, oppure il motivo per cui non si fa. Non
 * tocca niente: e' la meta' che si prova senza una casa.
 */
export function ilComandoDellaVentola(entita) {
  const id = pulito(entita);
  if (!id) return { si: false, perche: "non-mappata" };
  /* Un riferimento non sciolto non e' un'entita': mandarlo a Home Assistant e'
   * esattamente il guasto da cui si viene, e qui si riconosce dal prefisso. */
  if (id.startsWith("dm.")) return { si: false, perche: "non-mappata" };
  const punto = id.indexOf(".");
  const dominio = punto > 0 ? id.slice(0, punto).toLowerCase() : "";
  if (!dominio || punto === id.length - 1) return { si: false, perche: "non-un-entita", entita: id };
  if (soloLettura.has(dominio)) return { si: false, perche: "non-si-comanda", entita: id };
  return {
    si: true,
    entita: id,
    chiamata: { domain: "homeassistant", service: "toggle", entity_id: id },
  };
}
