/* Di chi e' la finestra dei dettagli.
 *
 * «Se clicco su apertura telecamera, dopo un po' compaiono le luci, ma sopra
 * c'è ancora la camera.» La finestra `#details-modal` e' una sola e la usano
 * in tanti: la telecamera, la gestione luci, gli avvisi, gli elettrodomestici,
 * i gruppi della Home. Il ridisegno delle luci partiva a ogni cambio di stato
 * di una luce e guardava soltanto che la finestra fosse aperta: con la
 * telecamera davanti, il corpo diventava l'elenco delle luci sotto il titolo
 * «📹 …», e il video restava acceso dietro.
 *
 * Adesso la finestra ha un padrone. Chi la apre se la prende dal guscio
 * (`dmFinestraDi`), che scrive sulla finestra stessa il tipo
 * (`data-dm-finestra`) e un gettone che cambia a ogni apertura vera
 * (`data-dm-gettone`). Chi ne ridisegna il corpo dopo — un cambio di stato, una
 * risposta arrivata tardi — prima chiede qui se la finestra e' ancora sua, e se
 * no lascia stare. Il gettone serve a chi aspetta qualcosa: la stessa specie di
 * contenuto riaperta per un'altra cosa (un altro elettrodomestico) non e' piu'
 * la sua.
 *
 * Qui non c'e' DOM: si legge quello che la finestra porta scritto.
 */

export const FINESTRA_TELECAMERA = "camera_view";
export const FINESTRA_LUCI = "gestione_luci";
export const FINESTRA_ELETTRODOMESTICO = "appliance_view";

function aperta(finestra) {
  try {
    return Boolean(finestra?.classList?.contains?.("show"));
  } catch (_errore) {
    return false;
  }
}

/**
 * Chi tiene la finestra adesso: `{ tipo, gettone }`, o `null` se e' chiusa o
 * nessuno l'ha presa. `ripiego` e' il tipo che il guscio tiene per se'
 * (`currentPopupType`), per una finestra aperta da un guscio che il padrone non
 * lo scrive ancora.
 */
export function padroneDellaFinestra(finestra, ripiego = null) {
  if (!aperta(finestra)) return null;
  const scritto = finestra.dataset?.dmFinestra;
  const tipo = String((scritto === undefined ? ripiego : scritto) || "").trim();
  if (!tipo) return null;
  return Object.freeze({ tipo, gettone: String(finestra.dataset?.dmGettone ?? "") });
}

/**
 * Se la finestra aperta e' ancora di `tipo`; con un `gettone`, anche se e' la
 * stessa apertura di quando lo si e' preso.
 */
export function laFinestraEDi(finestra, tipo, { gettone = null, ripiego = null } = {}) {
  const padrone = padroneDellaFinestra(finestra, ripiego);
  if (!padrone || padrone.tipo !== tipo) return false;
  return gettone == null || padrone.gettone === String(gettone);
}
