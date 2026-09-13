/* La cartina che apre la plancia dentro una Plancia di Home Assistant.
 *
 * E' il pezzo piu' piccolo di tutto il progetto e il piu' scomodo da
 * spiegare, quindi vale la pena scriverlo per bene.
 *
 * **Il problema.** La plancia la serve il ponte, e il ponte da un browser si
 * raggiunge solo attraverso l'**ingress** di Home Assistant: e' quello che fa
 * l'autenticazione al posto nostro, ed e' anche il motivo per cui il ponte non
 * ha bisogno di nessun segno suo. L'ingress vuole un biscotto di sessione, e
 * quel biscotto lo fabbrica Home Assistant chiedendolo al Supervisor. Un
 * `iframe` messo in una Plancia con l'indirizzo dell'ingress non ce l'ha, e si
 * becca un «401» — cioe' un riquadro bianco, senza niente da leggere.
 *
 * **La soluzione.** Questo file gira **dentro** la pagina di Home Assistant,
 * dove c'e' `hass`: chiede lui la sessione — la stessa chiamata che fa il
 * frontend di Home Assistant quando apri la scheda di un add-on — mette il
 * biscotto, e solo dopo apre il riquadro. E la rinfresca finche' sta a
 * schermo, perche' quella sessione scade.
 *
 * **Perche' non e' una plancia rifatta.** Qui dentro non c'e' una riga di
 * plancia: c'e' un riquadro e il modo di aprirlo. La plancia e' quella, servita
 * dal ponte, con la sua configurazione e i suoi file.
 */

const NOME = "gdahome-plancia";

/* Ogni quanto si rinfresca la sessione dell'ingress. Il Supervisor la tiene
 * viva un quarto d'ora e la rinnova a ogni controllo: mezzo minuto e' quello
 * che fa il frontend di Home Assistant, ed e' abbondante. */
const OGNI_QUANTO = 30000;

class PlanciaDiGdahome extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = {};
    this._dove = "";
    this._sessione = "";
    this._giro = 0;
    this._montata = false;
  }

  static getConfigElement() {
    return null;
  }

  static getStubConfig() {
    return { type: `custom:${NOME}` };
  }

  setConfig(config) {
    this._config = config || {};
    this._montata = false;
    this._disegna();
  }

  set hass(hass) {
    const prima = this._hass;
    this._hass = hass;
    if (!prima) this._disegna();
  }

  /* Una Plancia intera, non una tessera: e' una pagina che sta dentro un
   * riquadro, e una tessera alta trecento punti non servirebbe a niente. */
  getCardSize() {
    return 12;
  }

  connectedCallback() {
    this._disegna();
  }

  disconnectedCallback() {
    if (this._giro) {
      clearInterval(this._giro);
      this._giro = 0;
    }
  }

  /* Se questa plancia si apre a chi la sta guardando.
   *
   * L'elenco arriva dalla vista, e l'ha scritto l'add-on; `hass.user.id` e'
   * l'utente della sessione di Home Assistant. Vuoto vuol dire tutti.
   *
   * Non e' **questo** il cancello: il cancello sta nell'add-on, che guarda chi
   * bussa (`X-Remote-User-Id`, che gli arriva dall'ingress e non dalla pagina)
   * e a chi non e' abilitato non serve la plancia. Questo e' cosa si legge
   * invece di un riquadro bianco — e serve anche a non chiedere una sessione
   * dell'ingress per una pagina che non arrivera'. */
  _laVede() {
    const elenco = Array.isArray(this._config.utenti)
      ? this._config.utenti.filter(Boolean).map(String)
      : [];
    if (elenco.length > 0 && !elenco.includes(String(this._hass?.user?.id || ""))) return false;
    /* «Solo gli amministratori»: qui la risposta ce l'abbiamo in mano — e'
     * `hass.user.is_admin`, che Home Assistant mette nella sessione — e non
     * c'e' niente da chiedere a nessuno. A questa voce Home Assistant non ci
     * fa nemmeno arrivare chi non amministra (`require_admin` sulla Plancia);
     * questa riga e' per le altre strade. */
    if (this._config.solo_admin === true && this._hass?.user?.is_admin !== true) return false;
    return true;
  }

  async _disegna() {
    if (this._montata || !this._hass || !this.isConnected) return;
    if (!this._laVede()) {
      this._montata = true;
      this._nonPerTe();
      return;
    }
    this._montata = true;
    try {
      const dove = await this._doveSta();
      await this._laSessione();
      this._giro = setInterval(() => {
        this._rinfresca().catch(() => {
          /* Se il rinnovo non riesce si riprova al giro dopo: il riquadro
             sta ancora in piedi con la sessione di prima. */
        });
      }, OGNI_QUANTO);
      this._riquadro(dove);
    } catch (errore) {
      this._montata = false;
      this._male(errore);
    }
  }

  /* Dov'e' il ponte, adesso.
   *
   * L'indirizzo dell'ingress non si scrive nella configurazione della Plancia:
   * dentro c'e' un gettone che Home Assistant puo' rifare, e una Plancia
   * salvata sei mesi fa porterebbe un indirizzo che non esiste piu'. Si chiede
   * al Supervisor ogni volta, come fa il frontend di Home Assistant. */
  async _doveSta() {
    const slug = String(this._config.addon || "").trim();
    if (!slug) throw new Error("questa tessera non sa quale add-on aprire");
    const detto = await this._hass.callWS({
      type: "supervisor/api",
      endpoint: `/addons/${slug}/info`,
      method: "get",
    });
    const dove = String(detto?.data?.ingress_url || detto?.ingress_url || "");
    if (!dove) throw new Error("l'add-on del ponte non ha un ingresso");
    const profilo = String(this._config.profilo || "").trim();
    /* L'indirizzo dell'ingress finisce con una barra o no a seconda delle
       versioni: si normalizza qui invece di fidarsi. */
    const radice = dove.replace(/\/+$/, "");
    this._dove = `${radice}/plancia/${profilo ? `${profilo}/` : ""}`;
    return this._dove;
  }

  /* Il biscotto della sessione, chiesto come lo chiede Home Assistant.
   *
   * `SameSite=Strict` e il percorso ristretto all'ingress sono gli stessi che
   * mette il frontend: quel biscotto non deve viaggiare da nessun'altra parte.
   *
   * **Si chiede sul WebSocket, e prima si chiedeva con una chiamata REST.**
   * `POST /api/hassio/ingress/session` era la via di una volta, e Home
   * Assistant non la tiene piu': rispondeva con un errore che non era nemmeno
   * un errore — un oggetto senza `message` — e la tessera lo mostrava come
   * «[object Object]», cioe' come niente. Adesso si fa `supervisor/api` con
   * `/ingress/session`, che e' quello che fa il frontend di Home Assistant
   * quando apri la scheda di un add-on. La via vecchia resta come ripiego per
   * le versioni in cui quella nuova non c'e' ancora. */
  async _laSessione() {
    let guaio = null;
    try {
      const detto = await this._hass.callWS({
        type: "supervisor/api",
        endpoint: "/ingress/session",
        method: "post",
      });
      const sessione = String(detto?.session || detto?.data?.session || "");
      if (sessione) return this._metti(sessione);
      guaio = new Error("Home Assistant non ha dato una sessione per l'ingresso");
    } catch (errore) {
      guaio = errore;
    }
    try {
      const detto = await this._hass.callApi("POST", "hassio/ingress/session");
      const sessione = String(detto?.data?.session || detto?.session || "");
      if (sessione) return this._metti(sessione);
    } catch (_vecchio) {
      /* Falliscono tutte e due: si racconta la prima, che e' quella buona. */
    }
    throw guaio;
  }

  _metti(sessione) {
    this._sessione = sessione;
    const sicuro = document.location.protocol === "https:" ? ";Secure" : "";
    document.cookie = `ingress_session=${sessione};path=/api/hassio_ingress/;SameSite=Strict${sicuro}`;
  }

  /* Tenerla viva. Home Assistant non ne fabbrica una nuova ogni mezzo minuto:
   * dice al Supervisor che quella di prima e' ancora in uso, e il Supervisor
   * le allunga la vita. Se non vale piu' — l'add-on si e' riavviato, il
   * Supervisor l'ha buttata — se ne fa una nuova. */
  async _rinfresca() {
    if (!this._sessione) return this._laSessione();
    try {
      await this._hass.callWS({
        type: "supervisor/api",
        endpoint: "/ingress/validate_session",
        method: "post",
        data: { session: this._sessione },
      });
      return undefined;
    } catch (_errore) {
      this._sessione = "";
      return this._laSessione();
    }
  }

  _riquadro(dove) {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; height: 100%; }
        .tutto { position: relative; width: 100%; height: 100%; min-height: 60vh; }
        iframe { border: 0; width: 100%; height: 100%; display: block; }
      </style>
      <div class="tutto"><iframe title="DashboardModern" allow="fullscreen"></iframe></div>`;
    this.shadowRoot.querySelector("iframe").src = dove;
  }

  /* Cosa e' andato storto, **leggibile**.
   *
   * `String(errore)` su un oggetto da «[object Object]», e quella riga ha
   * nascosto il guasto vero per tre ore: la tessera si apriva, diceva di non
   * essere riuscita, e non diceva perche'. Un messaggio d'errore che non dice
   * niente e' peggio di nessun messaggio, perche' fa credere di aver guardato.
   * Quindi: il `message` se c'e', se no quello che c'e' dentro, e in ultimo il
   * JSON — che sara' brutto da leggere ma si legge. */
  _perche(errore) {
    if (typeof errore === "string" && errore) return errore;
    if (errore && typeof errore.message === "string" && errore.message) return errore.message;
    if (errore && typeof errore.body === "object" && typeof errore.body?.message === "string") {
      return errore.body.message;
    }
    if (errore && typeof errore === "object") {
      const pezzi = [];
      if (errore.code !== undefined) pezzi.push(`codice ${errore.code}`);
      if (errore.status_code !== undefined) pezzi.push(`HTTP ${errore.status_code}`);
      if (errore.error) pezzi.push(String(errore.error));
      if (pezzi.length) return pezzi.join(", ");
      try {
        const scritto = JSON.stringify(errore);
        if (scritto && scritto !== "{}") return scritto;
      } catch (_errore) {
        /* Se non si puo' nemmeno scrivere, si va avanti col ripiego. */
      }
    }
    return "non ha funzionato, e non ha detto perche'";
  }

  /* Una plancia riservata a qualcun altro. Non e' un errore, e non si scrive
   * come tale: non c'e' niente di rotto. Chi legge vuole sapere chi glielo
   * puo' aprire, e dove. */
  _nonPerTe() {
    const titolo = String(this._config.titolo || "Questa plancia");
    this.shadowRoot.innerHTML = `
      <style>
        .chiusa { display: grid; place-items: center; min-height: 60vh; padding: 24px;
          font: inherit; line-height: 1.55; text-align: center; }
        .chiusa div { max-width: 26rem; }
        .chiusa b { display: block; margin-bottom: 8px; font-size: 1.15rem; }
        .chiusa span { color: var(--secondary-text-color, #5b6471); }
      </style>
      <div class="chiusa"><div>
        <b></b>
        <span></span>
      </div></div>`;
    /* `textContent`: il titolo l'ha scritto chi ci abita. */
    this.shadowRoot.querySelector(".chiusa b").textContent = `${titolo} non e' abilitata per te`;
    const soloAdmin = this._config.solo_admin === true && this._hass?.user?.is_admin !== true;
    this.shadowRoot.querySelector(".chiusa span").textContent =
      (soloAdmin
        ? "In questa casa questa plancia la vedono solo gli amministratori."
        : "In questa casa questa plancia la vedono solo alcuni utenti.") +
      " Chi amministra la casa puo' cambiarlo dalla pagina di gdahome, alla voce \u00abLe plance\u00bb.";
  }

  _male(errore) {
    const perche = this._perche(errore);
    this.shadowRoot.innerHTML = `
      <style>
        .male { padding: 24px; font: inherit; line-height: 1.5; }
        .male b { display: block; margin-bottom: 6px; }
      </style>
      <div class="male">
        <b>La plancia non si e' aperta</b>
        <span></span>
      </div>`;
    /* `textContent`, mai `innerHTML`: quel testo arriva da un errore, e un
       errore puo' portarci dentro qualunque cosa. */
    this.shadowRoot.querySelector(".male span").textContent = perche;
  }
}

if (!customElements.get(NOME)) customElements.define(NOME, PlanciaDiGdahome);

/* Una riga nell'elenco delle tessere, cosi' chi apre l'editor la trova invece
 * di doverla scrivere a mano. */
window.customCards = window.customCards || [];
if (!window.customCards.some((una) => una.type === NOME)) {
  window.customCards.push({
    type: NOME,
    name: "gdahome",
    description: "La plancia di gdahome, servita dall'add-on.",
    preview: false,
  });
}
