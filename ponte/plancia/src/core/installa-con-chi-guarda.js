/* Un aggiornamento si installa con l'utente di chi lo tocca.
 *
 * «L'ho già fatto nel Marketplace ma non mi fa installare gli aggiornamenti.»
 * Da Home Assistant 2026.11 le integrazioni e le schede scaricate (quelle che
 * prima erano di HACS) le installa il Marketplace di Home Assistant, e prima
 * di installare o aggiornare vuole che il suo avviso sia stato letto e
 * accettato. L'accettazione pero' e' **di un utente**: Home Assistant se la
 * segna col nome di chi l'ha data (`marketplace/warning/accept` salva
 * `connection.user.id`), e `update.install` guarda l'utente della chiamata
 * (`homeassistant/components/marketplace/update.py`: `warning_accepted(
 * self._context.user_id)`). Chi non ha accettato riceve «Open the Marketplace
 * and read the warning first, installing and updating work once it is
 * accepted», anche se un altro utente della stessa casa l'ha accettato.
 *
 * La plancia dentro Home Assistant pero' parla col ponte, e il ponte parla
 * con Home Assistant col segno del Supervisor: per il Marketplace chi
 * installava era l'utente «Supervisor», che l'avviso non l'ha letto e non lo
 * leggera' mai. Ogni installazione tornava indietro, e accettare col proprio
 * utente non cambiava niente. Non e' una cosa da aggirare: e' un consenso, e
 * va dato da una persona.
 *
 * Quindi, quando la plancia sta dentro Home Assistant, l'installazione la
 * chiede la connessione di Home Assistant stesso — quella dell'utente che sta
 * guardando, la stessa che usa il suo tasto «Installa» — e il Marketplace
 * guarda l'accettazione giusta. Quando Home Assistant attorno non c'e' (l'app,
 * la plancia aperta da sola) si passa dalla strada di prima, e l'errore si
 * porta dietro da quale strada e' arrivato: e' quello che permette di dire
 * cosa fare.
 *
 * Qui non si tocca il documento se non per cercare Home Assistant: la finestra
 * si passa da fuori, e le prove ne danno una finta.
 */

/* Home Assistant attorno alla plancia: nella stessa pagina (il pannello) o in
 * quella che la contiene (l'ingress, che e' dello stesso indirizzo). Un altro
 * indirizzo non si tocca, e il browser lo vieta comunque. Torna la connessione
 * di chi guarda e la finestra di Home Assistant, o `null`. */
export function homeAssistantDiChiGuarda(finestra) {
  const cerca = (vista) => {
    try {
      const hass = vista?.document?.querySelector?.("home-assistant")?.hass;
      if (typeof hass?.connection?.sendMessagePromise !== "function") return null;
      return { hass, finestra: vista };
    } catch (_errore) {
      return null;
    }
  };
  if (!finestra) return null;
  const qui = cerca(finestra);
  if (qui) return qui;
  try {
    const padre = finestra.parent;
    if (!padre || padre === finestra) return null;
    return cerca(padre);
  } catch (_errore) {
    return null;
  }
}

/* Il no, sempre come `Error`, con scritto da che strada e' arrivato. La
 * connessione di Home Assistant rifiuta con un oggetto semplice
 * (`{ code, message, translation_key }`), il ponte con un `Error`. */
function conLaStrada(errore, strada) {
  const fatto =
    errore instanceof Error
      ? errore
      : new Error(String(errore?.message ?? errore ?? "").trim() || "Home Assistant ha rifiutato");
  if (!(errore instanceof Error) && errore && typeof errore === "object") {
    for (const chiave of ["code", "translation_key", "translation_domain"])
      if (errore[chiave] !== undefined) fatto[chiave] = errore[chiave];
  }
  fatto.strada = strada;
  return fatto;
}

/**
 * Installa un aggiornamento. Con Home Assistant attorno, e chi guarda che la
 * amministra, lo chiede la sua connessione (`strada: "utente"`); se no
 * `ripiego()` (`strada: "ponte"`).
 * Torna la promessa del servizio; se rifiuta, l'errore ha `strada`.
 */
export async function installaConChiGuarda(entita, { finestra, ripiego } = {}) {
  const casa = homeAssistantDiChiGuarda(finestra);
  /* Solo per chi amministra, come la strada del ponte (`dogana.js`): chi non
   * amministra resta dove era, e il ponte gli dice di no come prima. Il
   * Marketplace del resto l'avviso lo fa accettare solo a chi amministra. */
  if (casa && casa.hass.user?.is_admin === true) {
    try {
      return await casa.hass.connection.sendMessagePromise({
        type: "call_service",
        domain: "update",
        service: "install",
        service_data: { entity_id: entita },
      });
    } catch (errore) {
      throw conLaStrada(errore, "utente");
    }
  }
  if (typeof ripiego !== "function") throw conLaStrada("Home Assistant non connesso", "ponte");
  try {
    return await ripiego();
  } catch (errore) {
    throw conLaStrada(errore, "ponte");
  }
}

/* Il Marketplace, aperto nella finestra di Home Assistant come lo apre lui:
 * cambia l'indirizzo e lo avvisa, senza ricaricare la pagina. Torna se c'e'
 * riuscito. */
export function apriIlMarketplace(finestra) {
  const casa = homeAssistantDiChiGuarda(finestra);
  if (!casa) return false;
  try {
    const vista = casa.finestra;
    vista.history.pushState(null, "", "/marketplace");
    const Evento = vista.CustomEvent || CustomEvent;
    vista.dispatchEvent(new Evento("location-changed", { detail: { replace: false } }));
    return true;
  } catch (_errore) {
    return false;
  }
}
