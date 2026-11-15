/* L'avviso del Marketplace, accettato anche per GdAHome: da una persona.
 *
 * «Dall'app non mi fa installare Power Flow Card Plus.» Da Home Assistant
 * 2026.11 le integrazioni e le schede scaricate le installa il Marketplace, e
 * `update.install` guarda che l'avviso l'abbia accettato **l'utente che
 * chiama** (`homeassistant/components/marketplace/update.py`,
 * `warning_accepted(self._context.user_id)`). Dall'app chi chiama e' il ponte,
 * col segno del Supervisor: un utente che l'avviso non l'ha mai letto, e
 * quindi ogni installazione dall'app tornava indietro
 * (`il-no-del-marketplace.js`).
 *
 * Home Assistant l'accettazione la salva per utente, con un comando solo:
 *
 *   `marketplace/info`            → `{ …, warning_accepted }` per chi chiede
 *   `marketplace/warning/accept`  → salva l'id di chi chiede (solo admin)
 *
 * (`homeassistant/components/marketplace/websocket/__init__.py`, 2026.11.0;
 * l'utente del Supervisor e' un amministratore, quindi `require_admin` passa.)
 *
 * Chiamarlo da soli sarebbe una riga, ed e' proprio quello che **non** si fa:
 * l'avviso e' un consenso, e Home Assistant lo chiede apposta. Qui il comando
 * parte solo quando una persona che amministra la casa l'ha letto e ha premuto
 * «Ho letto: accetto anche per GdAHome» — il messaggio deve dirlo
 * (`ho_letto: true`), la dogana non lo lascia passare per nessun'altra strada
 * (`dogana.js`, `marketplace/`), e il registro dell'add-on si segna chi e
 * quando.
 *
 * ─── Il testo dell'avviso ──────────────────────────────────────────────────
 *
 * Home Assistant non lo da' per API: sta nel frontend
 * (`src/translations/en.json`, `ui.panel.marketplace.warning`, e il componente
 * `ha-marketplace-warning`), che il core non serve. Qui c'e' quel testo: in
 * inglese parola per parola, in italiano tradotto fedelmente, piu' la pagina
 * ufficiale dell'integrazione (il `documentation` del suo `manifest.json`).
 * Se Home Assistant cambia l'avviso, alza `WARNING_VERSION` e chiede di
 * riaccettarlo: e' il segno che va riletto anche questo.
 */

export const AVVISO_STATO = "ponte/marketplace/avviso";
export const AVVISO_ACCETTA = "ponte/marketplace/accetta";

/* La pagina ufficiale: `documentation` di
 * `homeassistant/components/marketplace/manifest.json`. */
export const LA_PAGINA_UFFICIALE = "https://www.home-assistant.io/integrations/marketplace";

/* L'avviso di Home Assistant 2026.11, `ui.panel.marketplace.warning`. */
const IN_INGLESE = Object.freeze({
  titolo: "Before you install from the Marketplace",
  intro:
    "Marketplace items are made by community contributors and are not reviewed by the Home Assistant project. Treat them like plugins for any other software.",
  rischiTitolo: "Anything you install can",
  rischi: Object.freeze([
    "Access and control everything in Home Assistant",
    "Connect to the internet",
    "Share your data with others",
    "Slow down or crash Home Assistant",
  ]),
  attenzioneTitolo: "So be mindful",
  attenzione: Object.freeze([
    "Read the documentation and understand what the item changes.",
    "Keep an eye on your system after installing.",
    "If something goes wrong, uninstall it right away.",
  ]),
  accetta: "I understand the risks and agree",
});

const IN_ITALIANO = Object.freeze({
  titolo: "Prima di installare dal Marketplace",
  intro:
    "Gli elementi del Marketplace sono fatti da persone della comunità e non sono controllati dal progetto Home Assistant. Trattali come i plugin di qualunque altro programma.",
  rischiTitolo: "Qualunque cosa installi può",
  rischi: Object.freeze([
    "Vedere e comandare tutto quello che c'è in Home Assistant",
    "Collegarsi a internet",
    "Condividere i tuoi dati con altri",
    "Rallentare Home Assistant o farlo bloccare",
  ]),
  attenzioneTitolo: "Quindi fai attenzione",
  attenzione: Object.freeze([
    "Leggi la documentazione e capisci che cosa cambia quello che installi.",
    "Tieni d'occhio la casa dopo l'installazione.",
    "Se qualcosa va storto, disinstallalo subito.",
  ]),
  accetta: "Ho capito i rischi e accetto",
});

/** L'avviso nella lingua chiesta: italiano per «it…», l'originale se no. */
export function ilTestoDellAvviso(lingua = "it") {
  return String(lingua || "")
    .toLowerCase()
    .startsWith("it")
    ? IN_ITALIANO
    : IN_INGLESE;
}

/* Un no che il ponte sa spiegare, col suo codice. */
export class AvvisoNo extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/* «Non c'e' il Marketplace»: Home Assistant prima della 2026.11, o la voce
 * non caricata. Non e' `unknown_command`: nell'app quello vuol dire
 * «aggiorna l'add-on», e qui l'add-on non c'entra. */
function senzaMarketplace(errore) {
  const codice = String(errore?.code || "");
  return codice === "unknown_command" || codice === "not_loaded";
}

export class AvvisoDelMarketplace {
  constructor({ casa, registro = null, adesso = () => Date.now() } = {}) {
    this.casa = casa;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
  }

  /**
   * Se l'utente di GdAHome ha accettato l'avviso, e l'avviso da leggere.
   * Una lettura: non cambia niente in Home Assistant.
   */
  async stato({ lingua = "it" } = {}) {
    const testo = ilTestoDellAvviso(lingua);
    let info;
    try {
      info = await this.casa.chiedi({ type: "marketplace/info" });
    } catch (errore) {
      if (senzaMarketplace(errore))
        return { disponibile: false, accettato: false, testo, pagina: LA_PAGINA_UFFICIALE };
      throw errore;
    }
    return {
      disponibile: true,
      accettato: info?.warning_accepted === true,
      testo,
      pagina: LA_PAGINA_UFFICIALE,
    };
  }

  /**
   * Accetta l'avviso per l'utente di GdAHome. Solo con `hoLetto === true`:
   * e' la persona che l'ha letto a dirlo, e senza non parte niente.
   *
   * `chi` e `nome` sono la persona che accetta, per il registro.
   */
  async accetta({ hoLetto = false, chi = "", nome = "", da = "app" } = {}) {
    if (hoLetto !== true)
      throw new AvvisoNo(
        "serve_il_consenso",
        "l'avviso del Marketplace si accetta solo dopo averlo letto, premendo il tasto apposta",
      );
    try {
      await this.casa.chiedi({ type: "marketplace/warning/accept" });
    } catch (errore) {
      if (senzaMarketplace(errore))
        throw new AvvisoNo(
          "marketplace_assente",
          "in questa casa il Marketplace di Home Assistant non c'e' o non e' caricato",
        );
      throw errore;
    }
    /* Si riguarda: e' Home Assistant a dire se adesso risulta accettato. */
    const dopo = await this.stato();
    const quando = new Date(this.adesso()).toISOString();
    const persona = nome ? `${nome} (${chi || "utente sconosciuto"})` : chi || "utente sconosciuto";
    this.registro.info(
      `avviso del Marketplace accettato per l'utente di GdAHome da ${persona}, ${da === "plancia" ? "dalla plancia" : "dall'app"}, il ${quando}`,
    );
    return { accettato: dopo.accettato, quando };
  }
}
