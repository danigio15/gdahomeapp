/* Le segnalazioni scritte dalla plancia, in Home Assistant.
 *
 * Fino a ieri il ponte a quei bottoni rispondeva una frase: «Le segnalazioni
 * stanno nell'app, non nella plancia». Si vedeva cosi' — la finestra si apriva,
 * il modulo c'era, e sopra una riga rossa e un «l'invio non e' configurato su
 * questa plancia». Chi sta davanti a Home Assistant e trova un difetto e' nel
 * momento esatto in cui vuole dirlo, e gli si rispondeva «scaricati l'app».
 *
 * Adesso passano, e passano **dalla stessa strada dell'app**: il ponte, il
 * centralino, la issue. Nessun account da collegare, nessuna credenziale da
 * mettere da nessuna parte — che e' l'unica differenza vera con come lo faceva
 * l'integrazione di DashboardModern, e non e' una differenza da poco: li'
 * bisognava autorizzare il proprio GitHub col codice a sei cifre prima di poter
 * scrivere una riga.
 *
 * ─── Cosa fa questo file, e cosa non fa ────────────────────────────────────
 *
 * Traduce. La finestra della plancia parla la lingua dell'integrazione —
 * `bug`, `feature`, `assistenza`, gli stati `bozza`/`inviato`/`in-carico`, i
 * campi `ticket_type`, `created_at`, `remote_id` — e il centralino di gdahome
 * parla la sua: `problema`, `idea`, `domanda`, `aperta`/`in-carico`/`chiusa`,
 * `numero`, `titolo`, `aperta_il`. Sono due vocabolari per le stesse cose, e
 * riscrivere la finestra per cambiarle il vocabolario vorrebbe dire toccare
 * duemilaseicento righe tradotte in due lingue. Si traduce qui, in un file
 * solo, dove la corrispondenza si legge tutta su una pagina.
 *
 * **Da dove arriva, lo stampa il ponte.** Le due strade sono due comandi
 * diversi — dal telefono `ponte/segnalazioni/crea`, da qui
 * `dashboardmodern/tickets/create` — e quale dei due sia arrivato lo sa solo
 * lui. Percio' `da: "plancia"`, e sulla issue l'etichetta diventa
 * `da-home-assistant` invece di `da-app` (`centralino/src/segnalazioni.js`).
 * Un telefono non puo' sbagliarla, e nemmeno fingerla.
 *
 * **Tre comandi restano fuori**, e sono quelli di chi risponde: la coda di
 * tutte le case, prendersi una segnalazione, rispondere come manutentore.
 * Quelli stanno nella console dell'app, dove sono gia', e rispondere «si» qui
 * vorrebbe dire dei bottoni che si accendono e non funzionano.
 */

/* I tipi. La finestra ne mostra tre — «Non funziona», «Vorrei che facesse»,
 * «Non ci riesco» — e sotto hanno i nomi dell'integrazione. */
export const TIPI = Object.freeze({
  bug: "problema",
  feature: "idea",
  assistenza: "domanda",
});

const TIPI_ALLINCONTRARIO = Object.freeze({
  problema: "bug",
  idea: "feature",
  domanda: "assistenza",
});

/* Gli stati. Tre da una parte, cinque dall'altra, e non e' un disordine: la
 * finestra raggruppa i suoi cinque in tre colonne — «Da lavorare», «In
 * lavorazione», «Chiuse» — e quello che conta e' che ognuno dei nostri finisca
 * nella colonna giusta.
 *
 * `bozza` non ci arriva mai, e va detto: da questa parte una segnalazione o
 * parte o non e' stata scritta. La finestra promette «resta qui e partira' da
 * sola», ma quella promessa era dell'integrazione, che la teneva sul disco di
 * casa; il ponte non tiene bozze, e quando il centralino non risponde lo dice
 * invece di far credere che sia al sicuro. */
export const STATI = Object.freeze({
  aperta: "inviato",
  "in-carico": "in-carico",
  chiusa: "chiuso",
});

/* Come si chiama, nella riga «Collegato come …» della finestra.
 *
 * Li' l'integrazione scriveva il nome GitHub di chi aveva autorizzato. Qui
 * nessuno autorizza niente — la issue la apre il centralino, e la casa si
 * riconosce da un marcatore — quindi ci va il nome di quello che sta davvero
 * in mezzo. E' l'unica parola di questa finestra che gdahome cambia di senso,
 * ed e' meglio di una vuota: chi legge deve poter sapere per mano di chi passa
 * quello che scrive. */
export const CHI_FIRMA = "gdahome";

const quandoInMillesimi = (quando) => {
  const letto = Date.parse(String(quando || ""));
  return Number.isFinite(letto) ? letto : 0;
};

/**
 * Una segnalazione, nella forma che la finestra della plancia sa disegnare.
 *
 * `body` resta vuoto nell'elenco, ed e' voluto: il centralino nell'elenco manda
 * i titoli e non i testi — sono una chiamata sola per tutte — e il testo arriva
 * quando si apre il filo. Riempirlo con qualcosa vorrebbe dire far vedere una
 * versione della segnalazione che non e' quella vera.
 */
export function unTicket(una, { corpo = "" } = {}) {
  const numero = Number(una?.numero) || 0;
  return {
    id: String(numero),
    opened_by: "",
    type: TIPI_ALLINCONTRARIO[String(una?.tipo || "")] || "bug",
    title: String(una?.titolo || ""),
    body: String(corpo || ""),
    state: STATI[String(una?.stato || "")] || "inviato",
    created_at: quandoInMillesimi(una?.aperta_il),
    updated_at: quandoInMillesimi(una?.aggiornata_il || una?.aperta_il),
    remote_id: String(numero),
    reply: "",
    issue_url: String(una?.url || ""),
    delivery_error: "",
    diagnostics: {},
  };
}

/**
 * Il filo, nella forma che la finestra disegna: il testo, e i commenti sotto.
 *
 * Il primo messaggio e' la segnalazione stessa — dalla parte del centralino
 * sta dentro `messaggi` come tutti gli altri — e i commenti sono quelli dopo.
 * `maintainer` decide da che lato dello schermo si disegna la nuvoletta, e lo
 * dice il `da` che ha messo il centralino leggendo il marcatore della casa.
 */
export function unFilo(intero) {
  const messaggi = Array.isArray(intero?.messaggi) ? intero.messaggi : [];
  const [primo, ...dopo] = messaggi;
  return {
    number: Number(intero?.numero) || 0,
    title: String(intero?.titolo || ""),
    body: String(primo?.testo || ""),
    state: STATI[String(intero?.stato || "")] || "inviato",
    issue_url: String(intero?.url || ""),
    diagnostics: {},
    attachments: [],
    comments: dopo.map((uno) => ({
      author: uno?.da === "casa" ? "casa" : "manutentore",
      maintainer: uno?.da !== "casa",
      at: quandoInMillesimi(uno?.il),
      body: String(uno?.testo || ""),
      attachments: [],
    })),
  };
}

/**
 * Chi risponde ai comandi della finestra.
 *
 * Non tiene niente di suo: gira tutto a `Segnalazioni`, che e' lo stesso
 * oggetto che serve l'app. Due strade, un archivio — se no una segnalazione
 * scritta da Home Assistant nell'app non si vedrebbe, e sarebbe la stessa casa
 * che racconta due storie.
 */
export class SegnalazioniDellaPlancia {
  constructor({ segnalazioni = null, registro } = {}) {
    this.segnalazioni = segnalazioni;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
  }

  /* Se da qui si possono scrivere. Senza centralino no, e la finestra lo dice
   * con la sua frase — quella del 💤 — che a quel punto e' vera. */
  get spedibili() {
    return Boolean(this.segnalazioni?.spedibili);
  }

  /* La firma, per la riga «Collegato come …». Quando non si puo' spedire non
   * si e' collegati a niente, e dirlo tiene la finestra coerente: niente
   * campo per rispondere sotto una segnalazione che non puo' partire. */
  laFirma() {
    if (!this.spedibili) return { connected: false, login: "", maintainer: false };
    return { connected: true, login: CHI_FIRMA, maintainer: false };
  }

  _come(tickets) {
    return {
      tickets,
      delivery: this.spedibili,
      account: this.laFirma(),
      /* Mai `true`: la coda di chi risponde sta nella console dell'app, e
       * accendere qui dei bottoni che questo file non serve vorrebbe dire una
       * finestra che promette e non fa. */
      console: false,
    };
  }

  async _iTicket({ aggiorna = false } = {}) {
    if (!this.segnalazioni) return [];
    const { segnalazioni } = await this.segnalazioni.elenco({ aggiorna });
    return (Array.isArray(segnalazioni) ? segnalazioni : []).map((una) => unTicket(una));
  }

  /** `dashboardmodern/tickets/list` */
  async elenco() {
    return this._come(await this._iTicket());
  }

  /** `dashboardmodern/tickets/sync`: si rilegge dal centralino, adesso. */
  async sincronizza() {
    const tickets = await this._iTicket({ aggiorna: true });
    return { ...this._come(tickets), delivered: 0, changed: tickets.length };
  }

  /**
   * `dashboardmodern/tickets/create`.
   *
   * `delivered` e' vero perche' da qui o parte o si solleva: il centralino
   * risponde, e se non risponde chi ha scritto lo sa subito invece di credere
   * che sia al sicuro. E' l'unica promessa della finestra che gdahome non
   * mantiene — non ci sono bozze — e valeva di piu' dirla giusta.
   */
  async crea(detto) {
    if (!this.segnalazioni) throw new Error("le segnalazioni non sono accese su questo ponte");
    const intero = await this.segnalazioni.crea({
      tipo: TIPI[String(detto?.ticket_type || "")] || "problema",
      titolo: String(detto?.title || ""),
      corpo: String(detto?.body || ""),
      diagnostica: detto?.diagnostics || {},
      /* Qui, e solo qui. */
      da: "plancia",
    });
    return {
      ticket: unTicket(intero, { corpo: String(detto?.body || "") }),
      delivered: true,
    };
  }

  /** `dashboardmodern/tickets/thread` */
  async filo(numero) {
    if (!this.segnalazioni) throw new Error("le segnalazioni non sono accese su questo ponte");
    return unFilo(await this.segnalazioni.leggi(Number(numero)));
  }

  /** `dashboardmodern/tickets/reply` */
  async rispondi(numero, testo) {
    if (!this.segnalazioni) throw new Error("le segnalazioni non sono accese su questo ponte");
    return unFilo(await this.segnalazioni.rispondi(Number(numero), String(testo || "")));
  }

  /**
   * `dashboardmodern/tickets/unread`: i pallini.
   *
   * Non letto vuol dire: c'e' una risposta del manutentore piu' nuova
   * dell'ultima volta che quel filo si e' aperto. Quel «ultima volta» da questa
   * parte non si tiene ancora, quindi non si inventa: si risponde un elenco
   * vuoto, e nessun pallino compare. Un pallino che non c'e' e' meno peggio di
   * un pallino che dice una cosa falsa — e la finestra, se questa chiamata
   * cade, fa esattamente cosi' da se'.
   */
  async nonLetti() {
    return { messages: [] };
  }

  /**
   * `dashboardmodern/tickets/auth/*`: qui non c'e' niente da autorizzare.
   *
   * Nell'integrazione questi tre comandi erano il ballo del codice a sei cifre
   * su github.com/login/device. In gdahome la issue la apre il centralino, e
   * chi scrive non ha nessun account da collegare: e' il motivo per cui questa
   * finestra, da qui, si usa e basta.
   *
   * Si risponde comunque — e non «comando sconosciuto» — perche' la finestra
   * li chiama da se' e un rifiuto le farebbe disegnare un errore rosso per una
   * cosa che non serve a nessuno.
   */
  laFirmaNonSiCollega() {
    return {
      ...this.laFirma(),
      niente_da_collegare: true,
      perche: "Da Home Assistant le segnalazioni passano da gdahome: non serve collegare niente.",
    };
  }
}
