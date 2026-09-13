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

  async _disegna() {
    if (this._montata || !this._hass || !this.isConnected) return;
    this._montata = true;
    try {
      const dove = await this._doveSta();
      await this._laSessione();
      this._giro = setInterval(() => {
        this._laSessione().catch(() => {
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
   */
  async _laSessione() {
    const detto = await this._hass.callApi("POST", "hassio/ingress/session");
    const sessione = String(detto?.data?.session || detto?.session || "");
    if (!sessione) throw new Error("Home Assistant non ha dato una sessione per l'ingresso");
    const sicuro = document.location.protocol === "https:" ? ";Secure" : "";
    document.cookie = `ingress_session=${sessione};path=/api/hassio_ingress/;SameSite=Strict${sicuro}`;
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

  _male(errore) {
    const perche = String(errore?.message || errore || "non ha funzionato");
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
