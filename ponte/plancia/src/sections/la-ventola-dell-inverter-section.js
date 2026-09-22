/* Il tasto della ventola dell'inverter (#112).
 *
 * «Ventola inverter indica il sensore di potenza ma manca proprio la
 * possibilità di inserire entità switch.»
 *
 * La casella c'e', nella scheda «🌡️ Temperature e raffreddamento»
 * dell'Energia, col segnaposto `switch.ventola_inverter`. Quello che non c'e'
 * mai stato e' l'ORDINE: il guscio manda a Home Assistant il nome della
 * casella al posto dell'entita' che ci hanno messo dentro, e Home Assistant
 * non trova niente da accendere.
 *
 * La lettura invece funziona — passa da `getRawState`, che il riferimento lo
 * scioglie — ed e' per questo che da fuori sembra che la casella dello switch
 * non ci sia: la potenza si vede, l'interruttore no.
 *
 * Qui il tasto cambia padrone. Il conto di cosa mandare sta nel nucleo
 * (`core/la-ventola-dell-inverter.js`), che non tocca niente e si prova senza
 * una casa; qui c'e' il documento, la presa verso Home Assistant e le parole
 * per quando non si puo'.
 *
 * ── Non si fallisce in silenzio ──────────────────────────────────────────
 *
 * E' la meta' che mancava piu' dell'altra. Un tasto che non fa niente e non
 * dice niente lascia chi lo preme a chiedersi se sia rotta la ventola, il
 * telefono o la plancia — e la risposta vera («non hai messo nessuna entita'
 * in quella casella») e' a due schermate di distanza e nessuno la indovina.
 * Adesso il tasto dice cos'e' che manca.
 */

import {
  RIFERIMENTO_DELLA_VENTOLA,
  ilComandoDellaVentola,
} from "../core/la-ventola-dell-inverter.js";
import { clean, doc, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_VENTOLA_INVERTER__";
const state = (root[KEY] ||= { installed: false, frame: 0 });

/** L'entita' che qualcuno ha messo nella casella, sciolta dal riferimento. */
export function entitaDellaVentola(resolver = root.resolveEntity) {
  try {
    return clean(resolver?.(RIFERIMENTO_DELLA_VENTOLA) || "");
  } catch (_errore) {
    return "";
  }
}

/* La presa con cui la plancia parla a Home Assistant.
 *
 * E' la stessa del clima, delle luci e delle tapparelle: `dmCallHaService`,
 * che il runtime definisce e che manda il servizio sul WebSocket. Le altre
 * tre strade sono le stesse di li', e per la stessa ragione — in un pannello
 * di Home Assistant esiste `hass`, altrove no.
 *
 * Torna true solo se qualcuno ha davvero preso la chiamata: chi la usa deve
 * poter distinguere «fatto» da «non c'era nessuno». */
function chiama({ domain, service, entity_id: entita }) {
  const carico = { entity_id: entita };
  try {
    if (typeof root.dmCallHaService === "function") {
      root.dmCallHaService(domain, service, carico)?.catch?.((errore) => {
        root.console?.warn?.("[dashboardmodern] ventola inverter", errore);
      });
      return true;
    }
    if (typeof root.cdCallServiceJson === "function") {
      root.cdCallServiceJson(domain, service, JSON.stringify(carico));
      return true;
    }
    if (typeof root.callService === "function") {
      root.callService(domain, service, carico);
      return true;
    }
    const hass = root.hass || root._hass;
    if (typeof hass?.callService === "function") {
      hass.callService(domain, service, carico);
      return true;
    }
  } catch (errore) {
    root.console?.warn?.("[dashboardmodern] ventola inverter", errore);
  }
  return false;
}

/** Lo dice, invece di non fare niente. */
function avvisa(parola) {
  try {
    if (typeof root.edToast === "function") root.edToast(parola);
    else root.alert?.(parola);
  } catch (_errore) {}
}

function perche(motivo, entita) {
  if (motivo === "non-mappata")
    return t(
      "Nessuna entità per l'interruttore della ventola: mettila in Energia → Temperature e raffreddamento.",
      "No entity for the fan switch: set it in Energy → Temperatures and cooling.",
    );
  if (motivo === "non-si-comanda")
    return `${entita}: ${t(
      "questa entità si legge soltanto, non si accende. Per l'interruttore serve uno switch, una presa o un fan.",
      "this entity is read-only, it can't be switched on. The switch needs a switch, a socket or a fan.",
    )}`;
  return `${entita}: ${t(
    "non è un'entità di Home Assistant. Si scrive dominio.nome, per esempio switch.ventola_inverter.",
    "this isn't a Home Assistant entity. It's written domain.name, for example switch.ventola_inverter.",
  )}`;
}

/**
 * Accende o spegne la ventola. Torna true solo se l'ordine e' partito.
 *
 * E' questa che prende il posto del tasto del guscio.
 */
export function accendiOSpegniLaVentola() {
  const detto = ilComandoDellaVentola(entitaDellaVentola());
  if (!detto.si) {
    avvisa(perche(detto.perche, detto.entita));
    return false;
  }
  if (chiama(detto.chiamata)) return true;
  avvisa(
    t(
      "Home Assistant non ha preso il comando della ventola: riprova fra un momento.",
      "Home Assistant did not take the fan command: try again in a moment.",
    ),
  );
  return false;
}

/* Il tasto cambia padrone, e resta cambiato.
 *
 * Il guscio ridefinisce `toggleVentola` quando si ricarica, quindi non basta
 * metterlo una volta: si rimette a ogni giro, e il segno dice che quello
 * buono c'e' gia' — cosi' non si incatenano venti copie della stessa
 * funzione. E' la stessa mano con cui «Salva costi» ha preso il suo padrone. */
export function installaIlPadroneDellaVentola() {
  const ora = root.toggleVentola;
  if (typeof ora === "function" && ora.__dmVentolaInverter) return true;
  function toggleVentola() {
    return accendiOSpegniLaVentola();
  }
  toggleVentola.__dmVentolaInverter = true;
  toggleVentola.__dmPrecedente = ora;
  root.toggleVentola = toggleVentola;
  return true;
}

function rimetti() {
  if (state.frame) return;
  state.frame =
    root.requestAnimationFrame?.(() => {
      state.frame = 0;
      installaIlPadroneDellaVentola();
    }) ||
    root.setTimeout?.(() => {
      state.frame = 0;
      installaIlPadroneDellaVentola();
    }, 0);
}

export function installLaVentolaDellInverter() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installaIlPadroneDellaVentola();
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:state-changed",
  ])
    root.addEventListener?.(evento, rimetti);
  return true;
}

installLaVentolaDellInverter();
