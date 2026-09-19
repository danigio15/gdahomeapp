/* Le voci di gdahome nella barra laterale di Home Assistant.
 *
 * Sono due, e vanno a due persone diverse:
 *
 *  - **Cruscotto installatore**, per chi gdahome lo monta in quaranta case: da
 *    li' arriva ai suoi impianti senza aprire un altro posto;
 *  - **Gestione installatori**, per chi il quadro lo tiene — una casa sola al
 *    mondo: da li' aggiunge gli installatori e mette i limiti.
 *
 * Su un Home Assistant qualunque non c'e' nessuna delle due: una porta che non
 * si apre e' peggio di una porta che non c'e'.
 *
 * ─── Cosa le fa comparire ─────────────────────────────────────────────────
 *
 * La chiave, e solo la chiave. Chi decide e' `opzioni.js`, e qui arriva gia'
 * deciso in `acceso`:
 *
 *  - il **Cruscotto** vuole l'interruttore `installatore` acceso **e** il
 *    codice del cruscotto scritto nella scheda. L'interruttore da solo non
 *    apre niente;
 *  - la **Gestione** non ha nessun interruttore: c'e' la sua chiave o non c'e'
 *    la voce.
 *
 * Prima bastavano gli interruttori, e le chiavi le chiedeva la pagina: non
 * finivano sul disco di nessuno, ed era il pregio. Il difetto era che chi
 * accendeva per curiosita' — o in casa di un cliente — si trovava comunque una
 * voce nella barra laterale, e una porta che si vede e' una domanda a cui
 * qualcuno deve rispondere. Il prezzo di questa scelta e' che le chiavi adesso
 * stanno nelle opzioni dell'add-on, cioe' su disco in chiaro e nei backup: va
 * scritta la propria, sul proprio Home Assistant.
 *
 * ─── Perche' la fa il ponte, e non l'integrazione ─────────────────────────
 *
 * Una stesura di questo pezzo la faceva registrare all'integrazione, con un
 * comando WebSocket suo: sembrava il posto giusto, perche' i pannelli della
 * barra laterale li registrano le integrazioni. Era sbagliato, e il motivo non
 * era tecnico: **l'integrazione non arriva piu' nelle case**. La repository da
 * cui si installava non esiste piu', la plancia arriva dall'add-on, e quello
 * che la plancia chiedeva all'integrazione lo fa il ponte. Quel codice non
 * faceva danno — era inerte — e non lo vedeva nessuno.
 *
 * Il ponte invece nella barra laterale ci scrive gia': le Plance le mette li'
 * lui, con `lovelace/dashboards/create`. Una plancia di Lovelace **e'** una
 * voce nella barra laterale, e dentro ci si mette quello che si vuole. Qui ci
 * va una tessera `iframe` col cruscotto vero.
 *
 * ─── Perche' non una copia del cruscotto ──────────────────────────────────
 *
 * Perche' sarebbe un terzo posto dove vivono le stesse regole — cos'e' un
 * impianto muto, quando una casa e' da guardare — e tre posti che dicono la
 * stessa cosa prima o poi ne dicono tre diverse. Qui si mostra quello che
 * esiste gia'.
 *
 * ─── E perche' si riprova ─────────────────────────────────────────────────
 *
 * All'accensione dell'add-on Home Assistant sta spesso ancora partendo, e i
 * comandi di Lovelace arrivano a nessuno. Aspettare qui vorrebbe dire tenere
 * giu' il ponte per una voce di menu; non riprovare vorrebbe dire una voce che
 * compare solo al riavvio dopo, cioe' un installatore che accende
 * l'interruttore, non vede niente e pensa che sia rotto. E' lo stesso motivo,
 * e la stessa cura, delle Plance in `plance-in-casa.js`.
 */

/* La tessera che disegna la pagina dentro la voce.
 *
 * Il nome deve essere lo stesso che `ponte/carta/plancia.js` registra con
 * `customElements.define`: sono due file e un nome, e se si scollano Home
 * Assistant disegna «Custom element doesn't exist» dentro un riquadro che
 * nessuno sa piu' da dove viene. Una prova li tiene insieme. */
export const RIQUADRO = "gdahome-riquadro";

/* Le due voci. `dove` e' l'indirizzo dentro Home Assistant — vuole un trattino
 * dentro — e `pagina` quella del quadro che ci si apre. */
export const IL_CRUSCOTTO = Object.freeze({
  dove: "gdahome-cruscotto",
  titolo: "Cruscotto installatore",
  segno: "mdi:gauge",
  pagina: "console",
});

export const LA_GESTIONE = Object.freeze({
  dove: "gdahome-gestione",
  titolo: "Gestione installatori",
  segno: "mdi:account-key",
  pagina: "gestore",
});

/* Gli indirizzi che sono del ponte ma **non** sono Plance.
 *
 * `plance-in-casa.js` fa piazza pulita: tutto quello che comincia per
 * `gdahome-` e non e' una Plancia di questo giro se ne va. E' giusto — una
 * Plancia tolta deve sparire anche dalla barra laterale, se no restano voci
 * che non aprono piu' niente — ma queste due non sono Plance, e cominciano
 * per `gdahome-` come tutto il resto.
 *
 * Senza questo elenco succedeva esattamente questo, e il registro lo diceva
 * pure: «la voce e' nella barra laterale» e un secondo dopo «1 voce, 2
 * tolte». Creata e cancellata dallo stesso add-on, nello stesso avvio.
 *
 * Chi aggiunge una terza voce la aggiunge qui. */
export const NON_SONO_PLANCE = Object.freeze([IL_CRUSCOTTO.dove, LA_GESTIONE.dove]);

/** Quanto si aspetta fra un tentativo e l'altro, in millisecondi. */
export const ATTESE = [20_000, 60_000, 300_000];

/* L'attesa fra un tentativo e l'altro.
 *
 * `unref` e' voluto: un ritentativo in coda non deve tenere sveglio l'add-on
 * che si sta spegnendo. Costa pero' che sotto le prove il giro finisca prima
 * della promessa, e per questo si puo' sostituire dal di fuori invece di
 * togliere dal codice vero una cosa che al codice vero serve. */
const ASPETTA = (quanto) =>
  new Promise((ok) => {
    const giro = setTimeout(ok, quanto);
    giro.unref?.();
  });

export class VoceNellaBarra {
  /**
   * @param quale una delle due qui sopra: `IL_CRUSCOTTO` o `LA_GESTIONE`.
   * @param acceso se l'interruttore della scheda e' acceso.
   * @param quadro l'indirizzo del quadro, senza niente in fondo.
   */
  constructor({
    casa,
    quale,
    acceso = false,
    quadro = "",
    chiave = "",
    registro,
    aspetta = ASPETTA,
  } = {}) {
    this.casa = casa;
    this.quale = quale;
    this.acceso = Boolean(acceso);
    this.quadro = String(quadro || "").replace(/\/+$/, "");
    /* Il codice che apre questa pagina, quello scritto nella scheda
     * dell'add-on. Da qui finisce nella configurazione della plancia, e la
     * tessera lo passa alla pagina: cosi' si scrive **una volta sola**.
     *
     * Prima si scriveva due volte — nella scheda per far comparire la voce, e
     * nella pagina per entrarci — e la seconda volta e' quella che fa pensare
     * che la prima non abbia funzionato.
     *
     * Dove finisce, detto: nelle opzioni dell'add-on (dov'era gia') e nella
     * configurazione di questa plancia, che sta in `.storage` di Home
     * Assistant. Tutt'e due le legge chi amministra quell'Home Assistant, e
     * questa voce e' `require_admin`: non si apre a nessuno che non potesse
     * gia' leggere la prima. */
    this.chiave = String(chiave || "");
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.aspetta = aspetta;
    this._fermo = false;
  }

  /** L'indirizzo intero della pagina che questa voce apre. */
  get dove() {
    return this.quadro ? `${this.quadro}/${this.quale.pagina}/` : "";
  }

  /**
   * La pagina che sta dentro la voce: una sola, a pagina intera, col cruscotto.
   *
   * `panel: true` e non una griglia: il cruscotto e' una pagina, e dentro una
   * colonna larga quattrocento punti sarebbe illeggibile.
   *
   * E la tessera e' la **nostra**, non l'`iframe` di Home Assistant. Le due
   * aprono lo stesso indirizzo, ma sopra quella di Home Assistant resta la
   * barra della dashboard — titolo, lente, matita — che sopra una pagina a
   * tutto schermo non ci va. Toglierla vuol dire girare dentro la pagina di
   * Home Assistant e risalire fino a `hui-root`, e questo lo puo' fare solo
   * una tessera nostra: e' la stessa cosa che fa la plancia, e infatti sta
   * nello stesso file (`ponte/carta/plancia.js`).
   *
   * Quel modulo e' gia' dichiarato a Lovelace da `plance-in-casa.js`, quindi
   * qui non c'e' niente da dichiarare: se la plancia si apre, si apre anche
   * questa.
   */
  vista() {
    return {
      views: [
        {
          title: this.quale.titolo,
          panel: true,
          cards: [
            {
              type: `custom:${RIQUADRO}`,
              dove: this.dove,
              /* Vuota non si scrive: una chiave assente e una chiave vuota
               * sono la stessa cosa per chi legge, ma una riga in meno nella
               * configurazione e' una riga in meno che cambia quando non
               * cambia niente — e ogni scrittura fa lampeggiare le pagine
               * aperte. */
              ...(this.chiave ? { chiave: this.chiave } : {}),
            },
          ],
        },
      ],
    };
  }

  /** Quella che c'e' gia', se c'e'. */
  async quellaCheCE() {
    const dentro = await this.casa.chiedi({ type: "lovelace/dashboards/list" });
    const elenco = Array.isArray(dentro) ? dentro : [];
    return elenco.find((una) => String(una?.url_path) === this.quale.dove) ?? null;
  }

  /**
   * Lo dice una volta. Torna `{fatto, perche}`.
   *
   * Spegnere l'interruttore si dice **lo stesso**, e non e' uno spreco: e'
   * l'unico modo perche' la voce sparisca subito invece che al riavvio dopo.
   */
  async dillo() {
    if (!this.casa?.chiedi) return { fatto: false, perche: "non c'e' nessuno a cui dirlo" };
    try {
      const sua = await this.quellaCheCE();
      if (!this.acceso) {
        if (sua)
          await this.casa.chiedi({ type: "lovelace/dashboards/delete", dashboard_id: sua.id });
        return { fatto: true, perche: "" };
      }
      if (!this.dove.startsWith("https://")) {
        return { fatto: false, perche: "l'indirizzo del quadro non e' https" };
      }
      if (!sua) {
        await this.casa.chiedi({
          type: "lovelace/dashboards/create",
          url_path: this.quale.dove,
          title: this.quale.titolo,
          icon: this.quale.segno,
          show_in_sidebar: true,
          /* Solo chi amministra: questa voce porta agli impianti dei clienti
           * di qualcuno, e Home Assistant in casa lo aprono anche i
           * familiari. */
          require_admin: true,
        });
      } else if (String(sua.title || "") !== this.quale.titolo || !sua.require_admin) {
        await this.casa.chiedi({
          type: "lovelace/dashboards/update",
          dashboard_id: sua.id,
          title: this.quale.titolo,
          require_admin: true,
        });
      }
      await this.laVista();
      return { fatto: true, perche: "" };
    } catch (errore) {
      return { fatto: false, perche: errore?.message || String(errore) };
    }
  }

  /**
   * La pagina, scritta **solo se e' cambiata**.
   *
   * Non e' per risparmiare una scrittura: salvare la configurazione di una
   * plancia manda a tutte le pagine aperte di Home Assistant un
   * `lovelace_updated`, e quelle si ridisegnano. Senza questo controllo ogni
   * riavvio dell'add-on farebbe lampeggiare il cruscotto sotto gli occhi di
   * chi lo stava guardando, per riscriverci dentro la stessa cosa.
   */
  async laVista() {
    const voluta = this.vista();
    let dentro = null;
    try {
      dentro = await this.casa.chiedi({ type: "lovelace/config", url_path: this.quale.dove });
    } catch (_errore) {
      dentro = null;
    }
    if (dentro && JSON.stringify(dentro) === JSON.stringify(voluta)) return "c'era";
    await this.casa.chiedi({
      type: "lovelace/config/save",
      url_path: this.quale.dove,
      config: voluta,
    });
    return dentro ? "riscritta" : "scritta";
  }

  /**
   * Lo dice, e se non attecchisce riprova con calma.
   *
   * Non si aspetta il suo esito per accendere il ponte: una voce di menu non
   * vale il ritardo di tutto il resto.
   */
  async dilloConCalma(attese = ATTESE) {
    let esito = await this.dillo();
    if (esito.fatto) {
      this.registro.info(
        this.acceso
          ? `la voce «${this.quale.titolo}» e' nella barra laterale di Home Assistant`
          : `la voce «${this.quale.titolo}» non c'e', come chiede la scheda`,
      );
      return esito;
    }
    for (const quanto of attese) {
      if (this._fermo) return esito;
      await this.aspetta(quanto);
      if (this._fermo) return esito;
      esito = await this.dillo();
      if (esito.fatto) {
        this.registro.info(`la voce «${this.quale.titolo}» c'e', al secondo tentativo`);
        return esito;
      }
    }
    this.registro.attenzione(
      `non sono riuscito a mettere la voce «${this.quale.titolo}» nella barra laterale: ${esito.perche}`,
    );
    return esito;
  }

  ferma() {
    this._fermo = true;
  }
}
