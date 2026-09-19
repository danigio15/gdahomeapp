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

/* La barra di Home Assistant sopra la plancia, e perche' va via.
 *
 * Finche' la plancia la portava l'integrazione era un **pannello**: una voce
 * nella barra laterale che si prende tutta la pagina e non ha niente sopra.
 * Adesso la porta l'add-on, e una Plancia di Home Assistant e' una dashboard
 * Lovelace — e una dashboard ha *sempre* la sua barra: il titolo, la lente,
 * il piu', la matita. Nessuno l'ha aggiunta: e' comparsa perche' la plancia ha
 * cambiato casa, e sopra la plancia non ci va.
 *
 * Il modo chiosco la copre, ma si accende da solo soltanto su uno schermo
 * stretto comandato da un dito: su un tablet appeso al muro e su un computer
 * bisognava saperlo — l'interruttore in ⚙️ Impostazioni, il dito tenuto
 * premuto sull'hamburger, `?kiosk=1` nell'indirizzo. Tre modi per una cosa
 * che non si doveva chiedere.
 *
 * Quindi la toglie chi la ha davanti: questo file gira **dentro** la pagina di
 * Home Assistant, e la barra e' due porte sopra di lui. Si nasconde con un
 * foglio di stile messo nella radice ombra di `hui-root`, e si azzera lo
 * spazio che quella barra si teneva — `--header-height`, che e' la variabile
 * con cui Home Assistant stesso lo misura.
 *
 * **Un foglio, e non gli stili in linea degli elementi.** La barra Home
 * Assistant la ridisegna quando cambia vista o quando entra in modifica: uno
 * `style.display` scritto sull'elemento se ne andrebbe con l'elemento, e un
 * selettore no. E per rimetterla basta buttare il foglio: non c'e' niente da
 * ricordare di com'era prima.
 */
const FOGLIO = "gdahome-senza-barra";

const SENZA_BARRA = `
  /* La barra. E' un \`div.header\` fissato in cima dentro l'ombra di
     \`hui-root\`: nasconderlo non tocca niente altro. */
  .header { display: none !important; }
  /* E lo spazio che si teneva. Non si azzera il riempimento del contenuto: si
     azzera la **misura** con cui Home Assistant lo calcola, che e' la stessa
     da anni — \`padding-top: calc(var(--header-height) +
     var(--safe-area-inset-top) + ...)\`. Cosi' va via l'altezza della barra e
     resta lo spazio del notch, che serve ancora. */
  :host { --header-height: 0px !important; }
`;

/* Chi sta sopra un nodo, anche quando sopra c'e' il confine di un'ombra.
 *
 * `parentNode` dentro una radice ombra torna `null` all'ultimo passo: da li' si
 * sale con `host`, che e' l'elemento che quell'ombra ce l'ha. Senza questo
 * passaggio la salita si fermerebbe alla prima ombra — e fra la tessera e la
 * barra ce ne sono tre. */
function sopra(nodo) {
  if (!nodo) return null;
  return nodo.parentNode || nodo.host || null;
}

/* Dove sta questa tessera: sotto quale barra, e se e' sola nella sua vista.
 *
 * `hui-root` e' chi disegna la barra di una dashboard. `hui-panel-view` e' la
 * vista che tiene una tessera sola e la manda a tutto schermo — quella che
 * gdahome si fabbrica.
 *
 * La barra si toglie **solo** da una vista cosi'. In una vista a griglia la
 * stessa barra porta le linguette per cambiare pagina, e togliere quelle a chi
 * si e' messo la tessera in mezzo alle sue sarebbe un danno, non una cura. */
function doveSiamo(da, quanti = 60) {
  let nodo = sopra(da);
  let pannello = false;
  for (let passi = 0; nodo && passi < quanti; passi += 1) {
    const chi = String(nodo.localName || "").toLowerCase();
    if (chi === "hui-panel-view") pannello = true;
    if (chi === "hui-root") return { tetto: nodo, pannello };
    nodo = sopra(nodo);
  }
  return { tetto: null, pannello };
}

/* Il foglio che toglie la barra, messo dove va.
 *
 * Sta fuori da tutt'e due le tessere che la usano — la plancia e il riquadro —
 * perche' copiarla sarebbe due posti dove vive la stessa regola, e il giorno
 * che Home Assistant cambia il nome di `hui-root` uno dei due resterebbe
 * indietro senza che nessuno se ne accorga.
 *
 * Torna due cose e non una: `messa` dice se la barra adesso non c'e' — vero
 * anche quando il foglio ce l'aveva gia' messo qualcun altro — e `foglio` solo
 * quello che abbiamo appeso **noi**. E' la distinzione che conta quando si
 * riattacca: si toglie il proprio, non quello di un altro, se no due tessere
 * nella stessa pagina si spengono la barra a vicenda. */
function senzaLaBarra(da, config = {}) {
  if (config?.barra === true) return { messa: false, foglio: null };
  const { tetto, pannello } = doveSiamo(da);
  if (!tetto?.shadowRoot || !pannello || inModifica(tetto)) return { messa: false, foglio: null };
  if (tetto.shadowRoot.getElementById?.(FOGLIO)) return { messa: true, foglio: null };
  const foglio = document.createElement("style");
  foglio.id = FOGLIO;
  foglio.textContent = SENZA_BARRA;
  tetto.shadowRoot.appendChild(foglio);
  return { messa: true, foglio };
}

/* Se Home Assistant e' in modifica, la barra resta.
 *
 * In modifica quella barra e' l'unico modo di uscirne — «Fatto» sta li'. Con la
 * matita nascosta in modifica non ci si entra piu' per sbaglio; chi ci entra
 * di proposito, dall'indirizzo, la barra ce la trova.
 *
 * Passando da una all'altra Home Assistant rifa' le tessere: questa si stacca e
 * si riattacca, e la domanda si rifa' da se' senza stare a guardare niente. */
function inModifica(tetto) {
  return tetto?.lovelace?.editMode === true;
}

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
    this._barra = null;
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
    this._togliLaBarra();
    this._disegna();
  }

  disconnectedCallback() {
    if (this._giro) {
      clearInterval(this._giro);
      this._giro = 0;
    }
    this._rimettiLaBarra();
  }

  /* Via la barra di Home Assistant sopra la plancia.
   *
   * Torna `true` solo se l'ha davvero tolta: chiamarla due volte non fa danno
   * — il foglio ha un nome, e il secondo giro lo ritrova.
   *
   * `barra: true` nella tessera la lascia dov'e'. Non e' una voce che serva a
   * chi apre gdahome — la sua plancia la vista se la fabbrica gdahome — e' per
   * chi si mette la tessera in una dashboard sua e quella barra la vuole. */
  _togliLaBarra() {
    const { messa, foglio } = senzaLaBarra(this, this._config);
    if (foglio) this._barra = foglio;
    return messa;
  }

  /* E rimessa, appena la plancia se ne va.
   *
   * Si guarda il foglio che abbiamo messo noi, non il posto dove stava: quando
   * questo metodo parte la tessera e' gia' staccata, e risalire ai suoi
   * antenati da li' non porta piu' da nessuna parte. */
  _rimettiLaBarra() {
    this._barra?.remove?.();
    this._barra = null;
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
      /* E una seconda volta, adesso che la pagina si e' fermata: al primo giro
         la tessera puo' essere stata attaccata prima della vista che la tiene,
         e da li' la barra non si trovava. Ha un nome, quindi non si sdoppia. */
      this._togliLaBarra();
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

/* ─── Il riquadro: una pagina del quadro, dentro Home Assistant ────────────
 *
 * Il Cruscotto e la Gestione sono due pagine servite dal quadro, e nella barra
 * laterale ci arrivano dentro una vista a pannello — come la plancia. La prima
 * stesura ci metteva la tessera `iframe` di Home Assistant, e funzionava:
 * l'indirizzo si apriva. Sopra pero' restava la barra della dashboard, col
 * titolo, la lente e la matita, che sopra una pagina a tutto schermo non ci va
 * — ed e' esattamente il difetto che la plancia aveva risolto.
 *
 * La tessera `iframe` di Home Assistant quella barra non la puo' togliere: e'
 * roba sua, e la pagina dentro e' di un altro dominio. Toglierla vuol dire
 * essere una tessera **nostra**, che gira dentro la pagina di Home Assistant e
 * risale le ombre fino a `hui-root`. Cioe' fare quello che fa la plancia.
 *
 * Quindi sta qui e non in un file suo: questo modulo Lovelace ce l'ha gia'
 * dichiarato, e un secondo file vorrebbe dire una seconda risorsa da
 * dichiarare, da versionare e da tenere allineata — per una tessera che e'
 * venti righe.
 */
const RIQUADRO = "gdahome-riquadro";

class RiquadroDiGdahome extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._barra = null;
    this._disegnata = "";
  }

  /* `dove` e basta, e deve essere `https:`.
   *
   * Il controllo e' qui e non al disegno perche' l'editor di Lovelace chiama
   * `setConfig` mentre si scrive: chi sbaglia l'indirizzo lo sa subito, invece
   * di trovarsi un riquadro bianco e nessuna spiegazione. */
  setConfig(config) {
    const dove = String(config?.dove || "");
    if (!/^https:\/\//.test(dove)) {
      throw new Error("«dove» vuole l'indirizzo della pagina, e deve essere https");
    }
    this._config = { ...config, dove };
    if (this._disegnata && this._disegnata !== dove) this._disegna();
  }

  /* Il codice, consegnato alla pagina invece che richiesto a chi guarda.
   *
   * Sta nella scheda dell'add-on — e' quello che fa esistere questa voce — e
   * senza questo passaggio la pagina dentro lo richiederebbe da capo. Due
   * volte lo stesso codice, e la seconda e' quella che fa pensare che la prima
   * non abbia funzionato.
   *
   * `postMessage` e non nell'indirizzo: un `#chiave=…` finirebbe nella barra
   * degli indirizzi, nella cronologia e in ogni schermata che qualcuno manda
   * per chiedere aiuto. Il secondo argomento e' l'origine del quadro, presa da
   * `dove`: il messaggio lo puo' leggere quella pagina e nessun'altra, anche
   * se un giorno dentro ci finisse altro.
   *
   * Si manda piu' di una volta perche' non c'e' modo di sapere **quando** la
   * pagina si mette in ascolto: `load` dice che il documento c'e', non che il
   * suo script e' arrivato in fondo. Tre colpi a distanza crescente costano
   * tre messaggi e tolgono una corsa che si perde in silenzio. */
  _consegnaLaChiave() {
    const chiave = String(this._config.chiave || "");
    if (!chiave) return;
    let origine = "";
    try {
      origine = new URL(this._config.dove).origin;
    } catch (_errore) {
      return;
    }
    const finestra = this.shadowRoot.querySelector("iframe")?.contentWindow;
    if (!finestra) return;
    for (const fra of [0, 300, 1500]) {
      const manda = () => {
        try {
          finestra.postMessage({ gdahome: "chiave", chiave }, origine);
        } catch (_errore) {
          /* La pagina se n'e' andata mentre aspettavamo: non c'e' niente da
             dire a nessuno. */
        }
      };
      if (fra === 0) manda();
      else setTimeout(manda, fra);
    }
  }

  /* Una pagina intera, come la plancia: una tessera alta trecento punti non
   * servirebbe a niente. */
  getCardSize() {
    return 12;
  }

  connectedCallback() {
    const { foglio } = senzaLaBarra(this, this._config);
    if (foglio) this._barra = foglio;
    this._disegna();
  }

  disconnectedCallback() {
    this._barra?.remove?.();
    this._barra = null;
  }

  /* Il tasto che riapre il menu di Home Assistant.
   *
   * Togliendo la barra se ne va anche l'hamburger, e con lui l'unico modo di
   * tornare indietro: la pagina dentro e' di un altro dominio e non ha nessuna
   * voce che porti fuori. Chi entrava qui restava dentro, e per uscire doveva
   * sapere di poter premere il tasto «indietro» del telefono.
   *
   * `hass-toggle-menu` e' l'evento che Home Assistant ascolta per aprire e
   * chiudere la sua barra laterale: e' lo stesso che manda il suo hamburger, e
   * non c'e' niente da imitare. `composed` perche' deve uscire dall'ombra di
   * questa tessera, `bubbles` perche' deve salire fino a chi lo ascolta.
   *
   * Sta **sopra** il riquadro e non accanto: il riquadro prende tutta la
   * pagina, e un tasto fuori vorrebbe dire una striscia vuota in cima — cioe'
   * la barra che abbiamo appena tolto. */
  _apriIlMenu() {
    this.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }));
  }

  _disegna() {
    const dove = this._config.dove || "";
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; height: 100%; }
        .tutto { position: relative; width: 100%; height: 100%; min-height: 60vh; }
        iframe { border: 0; width: 100%; height: 100%; display: block; }
        /* Il tasto del menu: dove sta l'hamburger di Home Assistant, cosi' chi
           lo cerca lo trova dove se lo aspetta. Gli env() del notch servono:
           su un telefono se lo mangerebbe la tacca. */
        .menu {
          position: absolute;
          top: calc(8px + env(safe-area-inset-top, 0px));
          /* A destra, e non a sinistra dove sta l'hamburger di Home Assistant.
             A sinistra si sedeva sopra il marchio della pagina dentro — quel
             riquadro blu che spuntava da sotto il tasto — perche' questo tasto
             galleggia su una pagina che non sa di averlo addosso e non gli fa
             spazio. Spostarlo costa che non sta dove uno se lo aspetta;
             lasciarlo li' costava coprire una cosa di qualcun altro, che e'
             peggio: un tasto fuori posto si trova, una cosa nascosta no. */
          inset-inline-end: calc(8px + env(safe-area-inset-right, 0px));
          width: 40px; height: 40px; padding: 0;
          display: grid; place-items: center;
          border: 0; border-radius: 50%; cursor: pointer;
          /* I colori di Home Assistant, non i nostri: questo tasto e' suo. */
          background: var(--card-background-color, rgba(255, 255, 255, 0.92));
          color: var(--primary-text-color, #212121);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.28);
        }
        .menu:hover { filter: brightness(0.95); }
        .menu svg { width: 22px; height: 22px; display: block; }
      </style>
      <div class="tutto">
        <iframe title="gdahome" allow="fullscreen"></iframe>
        <button type="button" class="menu" title="Il menu di Home Assistant"
                aria-label="Apri il menu di Home Assistant">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
          </svg>
        </button>
      </div>`;
    this.shadowRoot.querySelector(".menu").addEventListener("click", () => this._apriIlMenu());
    /* L'indirizzo si mette dopo, come attributo: dentro il testo del modello
       finirebbe in mezzo all'HTML, e un indirizzo in mezzo all'HTML e' un
       indirizzo che prima o poi porta dentro qualcos'altro. */
    const riquadro = this.shadowRoot.querySelector("iframe");
    riquadro.addEventListener("load", () => this._consegnaLaChiave());
    riquadro.src = dove;
    this._disegnata = dove;
  }
}

if (!customElements.get(RIQUADRO)) customElements.define(RIQUADRO, RiquadroDiGdahome);

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
