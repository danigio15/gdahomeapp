/* Le plance dentro Home Assistant, una voce per ognuna.
 *
 * Nella dashboard questo lo faceva l'integrazione: registrava un pannello per
 * istanza, e ogni pannello si portava dietro una Plancia di Home Assistant
 * (`panel.js` → `ensureCompanionDashboard`). L'integrazione va dismessa, e
 * allora lo fa il ponte, con gli stessi comandi — quelli che il frontend di
 * Home Assistant usa per le Plance: `lovelace/dashboards/*`,
 * `lovelace/config/save`.
 *
 * **Due pezzi, e nessuna risorsa di Lovelace.**
 *
 *  1. La **pagina d'apertura**: `ponte/carta/apri.html`, scritta in
 *     `www/gdahome/` con dentro `ponte/carta/accompagna.js`. Deve stare li' e
 *     non dentro l'add-on, perche' l'ingress vuole una sessione e per
 *     chiederla serve una pagina che giri **sullo stesso indirizzo** di Home
 *     Assistant. E' il motivo per cui questo add-on chiede di poter scrivere
 *     nella cartella di Home Assistant, ed e' l'unico posto dove scrive:
 *     `www/gdahome/`, e niente altro.
 *
 *  2. Una **Plancia** per plancia: una vista sola, a pagina intera, con dentro
 *     la tessera «pagina web» di Home Assistant (`iframe`) che apre quella
 *     pagina. La barra laterale la mostra col suo titolo.
 *
 * **Perche' niente risorsa, e perche' prima c'era.** La Plancia aveva dentro
 * una tessera nostra, `custom:gdahome-plancia`, e una tessera nostra esiste
 * solo se il suo file e' dichiarato a Lovelace come risorsa. Ma l'elenco delle
 * risorse il frontend di Home Assistant lo legge **una volta sola**, quando la
 * pagina parte: una risorsa dichiarata dopo — alla prima installazione, o a
 * ogni aggiornamento finche' l'indirizzo portava la versione — una pagina gia'
 * aperta non la vede. Nella Plancia, che e' una sola per tutti i dispositivi,
 * finiva il foglietto «Manca un passaggio solo… ricarica questa pagina», e
 * nell'app di Home Assistant sul telefono — dove il frontend resta aperto per
 * giorni e F5 non c'e' — chi ci abita restava li'.
 *
 * Una tessera di Home Assistant invece c'e' sempre, in ogni pagina, da
 * sempre. E una configurazione di Plancia cambiata Home Assistant la manda da
 * se' a tutte le pagine aperte (`lovelace_updated`), che si ridisegnano: la
 * migrazione, gli aggiornamenti e la prima installazione arrivano a schermo
 * **senza che nessuno ricarichi niente**.
 *
 * **La cartina resta, per chi la usa.** `ponte/carta/plancia.js` porta anche
 * `gdahome-riquadro`, la tessera delle voci «Gestione» di chi installa
 * (`voci-nella-barra.js`), e qualcuno la tessera della plancia se l'e' messa in
 * una dashboard sua. Per loro la risorsa resta — una sola, all'indirizzo fisso
 * del caricatore (`ponte/carta/caricatore.js`) — e si dichiara solo se
 * qualcuno la usa davvero (`chiUsaLeTessere`). Dove non la usa nessuno, la
 * nostra risorsa si toglie: quelle degli altri non si toccano.
 *
 * **Cosa non fa.** Non tocca le Plance di nessun altro: scrive solo quelle il
 * cui indirizzo comincia per `gdahome-`, e sono quelle che ha fatto lui. Una
 * Plancia scritta a mano da chi ci abita non e' roba sua — la legge soltanto,
 * per sapere se dentro c'e' una nostra tessera.
 */

import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { NON_SONO_PLANCE } from "./voci-nella-barra.js";

/* Dove finisce quello che scriviamo, dentro la `www` di Home Assistant. Una
 * cartella nostra e con il nostro nome: quello che c'e' intorno e' di chi ci
 * abita. */
export const CARTELLA = "gdahome";
export const NOME_DELLA_CARTA = "plancia.js";

/* La pagina d'apertura: quella che la tessera «pagina web» della Plancia
 * apre, e che apre a sua volta la plancia. Il perche' sta in testa a
 * `ponte/carta/accompagna.js`. */
export const NOME_DELL_APERTURA = "apri.html";

/* Il segno dentro `apri.html` con cui si riconosce che Home Assistant serve
 * proprio lei, e non la sua pagina che risponde «va tutto bene» a qualunque
 * indirizzo. */
export const SEGNO_DELL_APERTURA = '<meta name="gdahome" content="apri" />';

/* Dove, dentro `apri.html`, va cucito l'accompagnatore. */
const POSTO_DELL_ACCOMPAGNATORE = "/*@accompagna@*/";

/* Il caricatore: il file che Lovelace conosce davvero quando una risorsa
 * serve (solo a chi usa le tessere, vedi in testa), e il foglietto con la
 * versione che lui legge. Tutti e due in `www/gdahome/`, accanto alla
 * cartina: il permesso di scrittura e' quello, e non ne chiediamo un altro. */
export const NOME_DEL_CARICATORE = "caricatore.js";
export const NOME_DELLA_VERSIONE = "versione.json";

/* Il giro del caricatore, e **non** la versione dell'add-on.
 *
 * Questo numero sta nell'indirizzo della risorsa, e l'indirizzo della risorsa
 * non deve cambiare: ogni volta che cambia, ogni pagina di Home Assistant gia'
 * aperta — e nell'app sul telefono restano aperte per giorni — non ha piu' le
 * tessere di chi le usa finche' non riparte. Si cambia **solo** se cambia il
 * contenuto di `ponte/carta/caricatore.js`, che e' scritto apposta per non
 * dover cambiare mai. Gli aggiornamenti dell'add-on non lo toccano. */
export const GIRO_DEL_CARICATORE = "1";

/* Come si chiama la tessera che la cartina registra. Nelle Plance di gdahome
 * non c'e' piu': serve a riconoscerla nelle dashboard di chi se l'e' messa da
 * se', e nelle Plance di prima che si riscrivono. */
export const TESSERA = "gdahome-plancia";

/* Come cominciano i nomi delle nostre tessere, tutte e due: `gdahome-plancia`
 * e `gdahome-riquadro`. E' quello che si cerca nelle dashboard per sapere se
 * la risorsa serve ancora a qualcuno. */
const LE_NOSTRE_TESSERE = "custom:gdahome-";

/* Le parole del riavvio, in un posto solo.
 *
 * Quando Home Assistant va riavviato — la cartella `www` non c'era quando e'
 * partito, e finche' non riparte `/local/` non lo serve — lo si dice in tre
 * posti: nella Plancia al posto della plancia, nella campanella di Home
 * Assistant, e nella Panoramica della pagina dell'add-on. Tre posti che
 * devono dire **la stessa cosa con le stesse parole**: chi legge «riavvia»
 * da una parte e «ricarica» dall'altra pensa a due problemi, e ne cerca due.
 * La console non puo' importare questo file — e' un copione nel browser —
 * e le sue due righe una prova le tiene uguali a queste.
 *
 * I passi sono quelli dell'app sul telefono e del browser, che in Home
 * Assistant sono gli stessi: il tasto ⏻ in alto a destra in «Sistema». */
export const IL_RIAVVIO = Object.freeze({
  titolo: "Serve riavviare Home Assistant una volta",
  passi:
    "Impostazioni \u2192 Sistema \u2192 Riavvia (in alto a destra \u23fb) \u2192 Riavvia Home Assistant",
  title: "Home Assistant needs one restart",
  steps: "Settings \u2192 System \u2192 Restart (top right \u23fb) \u2192 Restart Home Assistant",
});

/* Il nome dell'avviso che si mette in Home Assistant quando la plancia non si
 * puo' aprire. Uno solo, sempre quello: cosi' non se ne accumulano uno per
 * avvio, e quando la cosa si sistema si sa quale levare. */
export const AVVISO = "gdahome_riavvia_home_assistant";

/* E l'avviso dell'altra cosa che fa uscire «Errore di configurazione», e che
 * un riavvio non aggiusta **mai**: una Plancia rimasta in casa
 * dall'integrazione di prima. */
export const AVVISO_DI_PRIMA = "gdahome_plancia_dell_integrazione";

/* Come si chiamava la plancia quando la portava l'integrazione.
 *
 * Serve a riconoscere le sue Plance rimaste in casa. Una casa che ha avuto
 * DashboardModern installato da HACS se le ritrova nella barra laterale, con
 * dentro una tessera che serviva l'integrazione: se l'integrazione non c'e'
 * piu', quella voce apre con «Errore di configurazione» **per sempre**, e chi
 * ci prova riavvia tre volte per niente — e' successo davvero.
 *
 * Il riconoscimento e' volutamente **stretto**: solo un nome che dice
 * DashboardModern. Le altre Plance di quella casa — «Casa 3.0», quella che si
 * e' fatta chi ci abita — non sono roba nostra e dire «questa non e' mia,
 * levala» su una plancia che uno si e' costruito sarebbe peggio di tacere. */
const NOME_DI_PRIMA = /dashboard\s*modern/i;

/**
 * Le Plance di questa casa che sono dell'integrazione di prima.
 *
 * Fuori dalla classe perche' e' una regola e si prova come tale: quali nomi
 * si riconoscono, e soprattutto quali **no**.
 */
export function lePlanceDiPrima(altre) {
  return (Array.isArray(altre) ? altre : []).filter(
    (una) =>
      una &&
      una.nostra !== true &&
      (NOME_DI_PRIMA.test(String(una.titolo || "")) || NOME_DI_PRIMA.test(String(una.dove || ""))),
  );
}

/* Come cominciano gli indirizzi delle Plance che fa il ponte. Serve a
 * riconoscere le proprie quando si fa pulizia: le altre non si toccano.
 *
 * Il trattino non e' estetica: Home Assistant vuole che l'indirizzo di una
 * Plancia ne abbia uno, per non confonderla coi suoi pannelli. */
export const DAVANTI = "gdahome-";

const CARTA_QUI = fileURLToPath(new URL("../carta/plancia.js", import.meta.url));
const CARICATORE_QUI = fileURLToPath(new URL("../carta/caricatore.js", import.meta.url));
const APERTURA_QUI = fileURLToPath(new URL("../carta/apri.html", import.meta.url));
const ACCOMPAGNATORE_QUI = fileURLToPath(new URL("../carta/accompagna.js", import.meta.url));

export function indirizzoDi(quale) {
  return `${DAVANTI}${quale.profilo}`;
}

export class PlanceInCasa {
  constructor({
    casa,
    plance,
    www = process.env.PONTE_WWW_CASA || "/homeassistant/www",
    carta = CARTA_QUI,
    caricatore = CARICATORE_QUI,
    apertura = APERTURA_QUI,
    accompagnatore = ACCOMPAGNATORE_QUI,
    /* Se le voci di chi installa sono accese (`voci-nella-barra.js`): quelle
     * hanno dentro `custom:gdahome-riquadro`, e finche' ci sono la risorsa
     * serve. Lo dice `index.js`, che le accende: all'avvio la voce e questo
     * giro partono insieme, e guardare soltanto le dashboard vorrebbe dire
     * arrivare prima che la voce ci sia. */
    tessere = false,
    versione = "",
    supervisor = process.env.PONTE_SUPERVISOR || "http://supervisor",
    segno = process.env.SUPERVISOR_TOKEN || "",
    fetch: prendi = globalThis.fetch,
    registro,
  } = {}) {
    this.casa = casa;
    this.plance = plance;
    this.www = String(www || "");
    this.carta = carta;
    this.caricatore = caricatore;
    this.apertura = apertura;
    this.accompagnatore = accompagnatore;
    this.tessere = tessere === true;
    this.versione = String(versione || "");
    this.supervisor = String(supervisor).replace(/\/+$/, "");
    this.segno = String(segno || "");
    this.prendi = prendi;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this._io = null;
    /* Se la cartella `www` di Home Assistant l'abbiamo fatta noi.
     *
     * Home Assistant apre `/local/` **all'avvio**: guarda se esiste la cartella
     * `www` nella configurazione, e se c'e' la mette a disposizione del
     * browser. Se non c'era e la fa qualcun altro dopo — noi, al primo avvio
     * dell'add-on in una casa che non l'aveva mai usata — quei file restano sul
     * disco e da fuori non si scaricano: `/local/gdahome/plancia.js` risponde
     * «non c'e'» finche' Home Assistant non riparte.
     *
     * E' il difetto peggiore di tutti, perche' non somiglia a un difetto: la
     * voce nella barra laterale c'e', la Plancia c'e', la cartina e' dichiarata
     * — e la pagina esce con «Errore di configurazione» e niente altro, perche'
     * quel messaggio Home Assistant lo mostra senza il motivo (il motivo lo
     * scrive solo dentro l'editor delle tessere). Quindi qui ce lo ricordiamo, e
     * la console lo dice. */
    this.riavvia = false;
    /* Com'e' andata l'ultima volta. `null` vuol dire che non si e' ancora
     * provato: e' diverso da «e' andata male», e la console lo dice
     * diversamente. */
    this.esito = null;
    /* Se l'avviso in Home Assistant l'abbiamo messo noi. Serve a levarlo:
     * un avviso che resta appeso dopo che la cosa si e' sistemata e' un
     * avviso che la prossima volta nessuno legge. */
    this._avvisato = false;
    /* Se l'avviso del riavvio si e' gia' tolto una volta da quando l'add-on e'
     * partito (vedi `loDiceAChiCiAbita`). */
    this._pulitoAllAvvio = false;
    /* La guardia che ricontrolla finche' la cartina non si scarica. */
    this._guardia = null;
    /* E se l'avviso della Plancia di prima l'abbiamo messo noi. */
    this._avvisatoDiPrima = false;
    /* Il giro in corso, se ce n'e' uno: `sistema` si mette in fila dietro.
     *
     * Le chiamate arrivano da tre parti — l'accensione, la guardia, una
     * plancia cambiata — e all'avvio due si possono pestare i piedi: tutt'e
     * due leggono l'elenco delle risorse, tutt'e due non ci trovano la nostra,
     * tutt'e due la dichiarano. Due risorse uguali non rompono niente, ma
     * «dichiarata una volta sola» deve essere vero sempre, non quasi. */
    this._fila = Promise.resolve();
    /* La pagina d'apertura com'e' scritta sul disco, accompagnatore dentro:
     * si compone una volta, e la sua impronta va nell'indirizzo. */
    this._apertura = null;
  }

  /* C'e' una cartella di Home Assistant dove scrivere?
   *
   * Si guarda la cartella **sopra** — quella della configurazione, che
   * l'add-on monta e che esiste sempre — e non `www`, che su una casa appena
   * installata non c'e' ancora e la fa il ponte.
   *
   * Dove non c'e' non si fa niente, e non e' un guasto: vuol dire che questo
   * ponte non gira dentro un add-on — un banco di prova, un computer di chi
   * lo sviluppa — e non c'e' nessuna Home Assistant a cui aggiungere delle
   * Plance. Senza questa riga si fabbricherebbero cartelle a caso nella
   * radice di un sistema che non e' il nostro. */
  get cE() {
    return Boolean(this.www) && existsSync(dirname(this.www));
  }

  /* Dove va la pagina d'apertura. Tutto quello che questa classe scrive sta
   * accanto a lei, in `www/gdahome/`, e i percorsi stanno in metodi suoi
   * perche' una prova li guarda: la cartella di Home Assistant e' quella dove
   * stanno le automazioni e i segreti di chi ci abita, e l'unica cosa che ci
   * mettiamo sono file nostri in una cartella nostra. */
  get doveVaLApertura() {
    return join(this.www, CARTELLA, NOME_DELL_APERTURA);
  }

  /* La cartina, per chi la tessera la usa ancora (vedi in testa). */
  get doveVaLaCarta() {
    return join(this.www, CARTELLA, NOME_DELLA_CARTA);
  }

  /* E gli altri due, accanto: il caricatore e il foglietto con la versione. */
  get doveVaIlCaricatore() {
    return join(this.www, CARTELLA, NOME_DEL_CARICATORE);
  }

  get doveVaLaVersione() {
    return join(this.www, CARTELLA, NOME_DELLA_VERSIONE);
  }

  /* La pagina d'apertura come va sul disco: `apri.html` con dentro
   * l'accompagnatore, cucito al posto del suo segno. Un file solo, perche'
   * un secondo file accanto sarebbe un secondo indirizzo da tenere fresco
   * nella cache del browser. */
  laPaginaDApertura() {
    if (this._apertura !== null) return this._apertura;
    const pagina = readFileSync(this.apertura, "utf8");
    const accompagna = readFileSync(this.accompagnatore, "utf8").replace(/<\/(script)/gi, "<\\/$1");
    if (!pagina.includes(POSTO_DELL_ACCOMPAGNATORE)) {
      throw new Error("la pagina d'apertura non ha il posto dell'accompagnatore");
    }
    this._apertura = pagina.replace(POSTO_DELL_ACCOMPAGNATORE, () => accompagna);
    return this._apertura;
  }

  /* Il numero in coda all'indirizzo della pagina d'apertura.
   *
   * Home Assistant i file di `/local/` li serve dicendo al browser di tenerli
   * un mese: una pagina d'apertura cambiata, allo stesso indirizzo, il
   * browser non la riprenderebbe. Quindi nell'indirizzo c'e' la versione
   * dell'add-on **e** l'impronta della pagina: cambia una delle due, cambia
   * l'indirizzo, e la Plancia riscritta lo porta a tutte le pagine aperte.
   *
   * La versione da sola non bastava: su un banco di prova, o fra due prove
   * della stessa versione, la pagina cambia e il numero no. */
  get giroDellApertura() {
    const impronta = createHash("sha256")
      .update(this.laPaginaDApertura())
      .digest("hex")
      .slice(0, 10);
    return this.versione ? `${this.versione}-${impronta}` : impronta;
  }

  /* L'indirizzo con cui la tessera «pagina web» chiede la pagina d'apertura,
   * senza le cose della singola plancia: e' quello che si prova per sapere se
   * Home Assistant la serve. La `www` di Home Assistant si affaccia su
   * `/local/`. */
  get indirizzoDellApertura() {
    return `/local/${CARTELLA}/${NOME_DELL_APERTURA}?v=${encodeURIComponent(this.giroDellApertura)}`;
  }

  /* L'indirizzo con cui il caricatore chiede la cartina di **questa**
   * versione. Serve solo a chi la tessera la usa ancora. */
  get indirizzoDellaCarta() {
    const quando = this.versione ? `?v=${encodeURIComponent(this.versione)}` : "";
    return `/local/${CARTELLA}/${NOME_DELLA_CARTA}${quando}`;
  }

  /* L'indirizzo che sta nell'elenco delle risorse, quando una risorsa serve:
   * **lo stesso per sempre**. Dentro c'e' il giro del caricatore, non la
   * versione dell'add-on. */
  get indirizzoDelCaricatore() {
    return `/local/${CARTELLA}/${NOME_DEL_CARICATORE}?giro=${GIRO_DEL_CARICATORE}`;
  }

  /* Home Assistant la serve davvero, la pagina d'apertura?
   *
   * Sul disco c'e': ce l'abbiamo scritta noi un momento fa. Ma `/local/` Home
   * Assistant lo apre **all'avvio**, guardando se la cartella `www` c'e'; e in
   * una casa che non l'aveva quella cartella l'abbiamo fatta noi adesso.
   * Finche' Home Assistant non riparte quell'indirizzo risponde «non c'e'», e
   * la tessera «pagina web» mostrerebbe un «404» dentro la Plancia.
   *
   * E' l'unico passaggio che resta, ed e' un **riavvio di Home Assistant**,
   * non una pagina da ricaricare: lo chiede Home Assistant per la sua `www`, e
   * succede solo nelle case che quella cartella non l'avevano mai avuta.
   *
   * `/local/` non chiede nessuna chiave a nessuno — e' il motivo per cui in
   * quella cartella non si mettono segreti — quindi lo si chiede da qui. Non
   * basta che risponda: si guarda che sia la nostra pagina.
   *
   * `null` vuol dire «non lo so» — fuori da un add-on, o se non si riesce a
   * chiedere — ed e' diverso da «no»: su un «non lo so» non si cambia quello
   * che chi ci abita ha davanti. */
  async laServe() {
    if (typeof this.casa?.doveStaLaPlancia !== "function") return null;
    if (typeof this.prendi !== "function") return null;
    let dove = "";
    try {
      dove = String((await this.casa.doveStaLaPlancia()) || "").replace(/\/+$/, "");
    } catch (_errore) {
      return null;
    }
    if (!dove) return null;
    try {
      const risposta = await this.prendi(`${dove}${this.indirizzoDellApertura}`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (risposta.status === 404) return false;
      if (!risposta.ok) return null;
      return String(await risposta.text()).includes(SEGNO_DELL_APERTURA);
    } catch (_errore) {
      return null;
    }
  }

  /* Chi siamo, per il Supervisor: lo slug vero dell'add-on e da dove si
   * entra. La cartina prova a richiederlo da se' ogni volta che si apre — un
   * gettone d'ingresso Home Assistant lo puo' rifare — e questo e' il ripiego
   * per chi non ha il permesso di chiederlo. */
  async _chiSiamo() {
    if (this._io) return this._io;
    if (!this.segno) return null;
    try {
      const risposta = await this.prendi(`${this.supervisor}/addons/self/info`, {
        headers: { authorization: `Bearer ${this.segno}` },
      });
      if (!risposta.ok) return null;
      const detto = await risposta.json();
      const dati = detto?.data || detto || {};
      const slug = String(dati.slug || "");
      if (!slug) return null;
      this._io = {
        slug,
        ingresso: String(dati.ingress_entry || dati.ingress_url || "").replace(/\/+$/, ""),
      };
      return this._io;
    } catch (_errore) {
      return null;
    }
  }

  /* ─── Quello che si fa ─────────────────────────────────────────────────── */

  /* Mette a posto tutto: la pagina d'apertura, una Plancia per plancia, via
   * quelle di plance che non ci sono piu', e la risorsa della cartina solo se
   * qualcuno la usa.
   *
   * Non solleva: se Home Assistant non risponde ai comandi di Lovelace, o se
   * qualcosa non riesce, lo scrive nel registro e lascia tutto il resto in
   * piedi. L'app e la plancia dall'ingress funzionano comunque, e quella qui
   * e' una comodita' in piu', non la strada.
   *
   * Un giro alla volta: chi chiama mentre ce n'e' gia' uno aspetta che finisca,
   * e poi fa il suo (vedi `_fila`). */
  sistema() {
    const giro = this._fila.then(
      () => this._sistema(),
      () => this._sistema(),
    );
    this._fila = giro.catch(() => {});
    return giro;
  }

  async _sistema() {
    if (!this.plance) return this._esito({ fatto: false, perche: "non ci sono plance" });
    if (!this.cE) {
      return this._esito({ fatto: false, perche: "qui non c'e' nessuna Home Assistant" });
    }

    /* I pezzi, **uno per volta e ognuno per conto suo**: quello che riesce
     * riesce, e quello che non riesce si dice per nome. Un guaio con la
     * risorsa della cartina — che alla plancia non serve piu' — non deve
     * portarsi via la voce nella barra laterale. */
    const guai = [];
    let copiata = false;
    try {
      copiata = this.laCarta();
    } catch (errore) {
      guai.push(`la pagina d'apertura non si e' scritta (${errore?.message || errore})`);
    }

    const io = await this._chiSiamo();

    /* Chi usa ancora le nostre tessere — le voci di chi installa, o qualcuno
     * che se l'e' messa in una dashboard sua — e quindi se la risorsa serve.
     * La plancia non c'entra: la sua Plancia ha dentro solo tessere di Home
     * Assistant. */
    const tessere = await this.chiUsaLeTessere();

    let risorsa = "";
    let risorsaGuaio = "";
    try {
      risorsa = await this.laRisorsa(tessere.servono);
    } catch (errore) {
      risorsaGuaio = String(errore?.message || errore);
      /* E' un guaio solo per chi la tessera la usa: dove non serve, una
       * risorsa nostra rimasta in elenco carica un file che c'e', e non
       * cambia niente a nessuno. Lo si scrive e si va avanti. */
      if (tessere.servono === true) {
        guai.push(`la cartina non si e' dichiarata a Lovelace (${risorsaGuaio})`);
      } else {
        this.registro.info(`la risorsa di Lovelace non si e' toccata: ${risorsaGuaio}`);
      }
    }

    /* E adesso la domanda che decide **cosa vede** chi apre quella voce: Home
     * Assistant la pagina d'apertura la serve? Se no — la cartella `www` l'ha
     * fatta l'add-on, e Home Assistant la apre solo quando parte — la vista
     * che si scrive e' quella che dice di riavviarlo, invece di una che mostra
     * un «404». E' l'unico caso, e non chiede di ricaricare niente: dopo il
     * riavvio la guardia rimette la plancia, e Home Assistant la porta da se'
     * alle pagine aperte. */
    const servita = await this.laServe();
    const manca = servita === false ? "riavvio" : "";

    const quali = this.plance.elenco();
    let fatte = 0;
    for (const una of quali) {
      try {
        await this.unaPlancia(una, io, manca);
        fatte += 1;
      } catch (errore) {
        guai.push(`«${una.titolo}» non si e' messa fra le Plance (${errore?.message || errore})`);
      }
    }

    let via = 0;
    try {
      via = await this.pulisci(quali);
    } catch (errore) {
      guai.push(`le Plance di plance tolte non si sono levate (${errore?.message || errore})`);
    }

    /* E quello che ne dice Home Assistant, riletto da lui. Va anche nel
     * registro, e non solo nella scheda: il registro e' il posto dove si
     * guarda quando una pagina non si apre. */
    const come = await this.controlla();
    this.registro.info(
      `Home Assistant dice: nella Plancia c'e' «${come.tessera_nella_vista || "niente"}», ` +
        `risorsa nostra in elenco ${
          come.risorsa_in_elenco === null ? "non lo so" : come.risorsa_in_elenco ? "si" : "no"
        }`,
    );
    if (come.altre_plance.length) {
      this.registro.info(
        `le Plance di questa casa: ${come.altre_plance
          .map((una) => `${una.dove} «${una.titolo}»${una.nostra ? "" : " (non e' nostra)"}`)
          .join(", ")}`,
      );
    }

    const consigli = {
      ...come,
      /* Cosa ha risposto Home Assistant alla pagina d'apertura: `true`,
       * `false`, o `null` se non si e' potuto chiedere. */
      servita,
      /* Quale foglietto sta nella Plancia adesso, se ce n'e' uno: puo' essere
       * solo `riavvio`. */
      manca,
      riavvia: this.riavvia,
      /* Com'e' andata con la risorsa della cartina: `aggiunta`, `c'era` o
       * `migrata` per chi la usa; `tolta` o `nessuna` dove non la usa
       * nessuno; o niente, e allora `risorsa_guaio` dice cosa ha risposto
       * Lovelace. */
      risorsa,
      risorsa_guaio: risorsaGuaio,
      migrata: risorsa === "migrata",
      /* Chi usa ancora le nostre tessere, per nome: e' il perche' della
       * risorsa, quando c'e'. */
      tessere: tessere.servono,
      tessere_in: tessere.dove,
      /* L'indirizzo della pagina d'apertura: la console lo prova da dentro
       * una pagina di Home Assistant, sullo stesso indirizzo. */
      apertura: this.indirizzoDellApertura,
      cartina: this.indirizzoDellaCarta,
      caricatore: this.indirizzoDelCaricatore,
    };
    if (this.riavvia) {
      this.registro.attenzione(
        "la cartella www di Home Assistant non c'era e l'ho fatta io: " +
          "Home Assistant va riavviato una volta, se no i file dentro /local/ non li serve",
      );
    }
    if (risorsa === "tolta") {
      this.registro.info(
        "la risorsa di Lovelace di gdahome non serve piu' a nessuno e l'ho tolta: " +
          "la plancia si apre con una tessera di Home Assistant",
      );
    }
    if (risorsa === "migrata") {
      this.registro.info(
        `la risorsa di Lovelace adesso e' ${this.indirizzoDelCaricatore}, e non cambia piu'`,
      );
    }
    if (servita === false) {
      this.registro.attenzione(
        `Home Assistant non serve ancora ${this.indirizzoDellApertura}: ` +
          "nelle Plance c'e' il foglietto che dice di riavviarlo, non la plancia",
      );
    }
    await this.loDiceAChiCiAbita(servita, come.plance_di_prima);

    if (guai.length) {
      const perche = guai.join("; ");
      this.registro.attenzione(`le plance in Home Assistant, a meta': ${perche}`);
      return this._esito({ fatto: false, quante: fatte, tolte: via, perche, ...consigli });
    }
    this.registro.info(
      `le plance in Home Assistant sono a posto: ${fatte} ${fatte === 1 ? "voce" : "voci"}` +
        `${via ? `, ${via} tolte` : ""}${copiata ? ", pagina d'apertura aggiornata" : ""}`,
    );
    return this._esito({ fatto: true, quante: fatte, tolte: via, ...consigli });
  }

  /* L'ultimo esito, tenuto da parte perche' la console lo mostri.
   *
   * Il registro ce l'ha gia', e non basta: chi apre la scheda dell'add-on e
   * non trova la plancia fra le Plance deve poter leggere **li'** perche', non
   * andare a cercare una riga fra mille in una linguetta accanto. Un guasto
   * che si vede solo nel registro e' un guasto che nessuno vede. */
  _esito(come) {
    this.esito = { ...come, quando: new Date().toISOString() };
    return this.esito;
  }

  /* Ci si riprova, se Home Assistant non c'era.
   *
   * All'avvio dell'add-on Home Assistant sta spesso ancora partendo: il
   * saluto non torna, i comandi di Lovelace non arrivano a nessuno, e senza
   * questo la voce nella barra laterale comparirebbe solo al riavvio dopo —
   * o alla prossima plancia aggiunta, che e' un modo di dire «mai».
   *
   * Tre tentativi che si allontanano, e poi si smette: se dopo un quarto d'ora
   * Home Assistant non risponde ai comandi di Lovelace, il problema non e' che
   * stava partendo, e riprovare per sempre riempirebbe il registro senza
   * aggiustare niente. */
  async sistemaConCalma(attese = [30_000, 120_000, 600_000]) {
    const esito = await this.sistema();
    if (esito.fatto || !this.cE) return esito;
    for (const quanto of attese) {
      await new Promise((ok) => {
        const giro = setTimeout(ok, quanto);
        giro.unref?.();
      });
      this.registro.info("riprovo a mettere le plance fra le Plance di Home Assistant");
      const dinuovo = await this.sistema();
      if (dinuovo.fatto) return dinuovo;
    }
    return this.esito;
  }

  /* Lo dice a chi ci abita, dove lui guarda.
   *
   * Il registro e la scheda dell'add-on non bastano, e si e' visto: due
   * persone hanno installato l'add-on, hanno aperto la voce nella barra
   * laterale, hanno letto «Errore di configurazione» e sono andate a
   * scriverlo su Facebook. Nessuna delle due aveva motivo di aprire il
   * registro di un add-on — e avevano ragione loro.
   *
   * Gli avvisi di Home Assistant sono il posto giusto: la campanella nella
   * barra laterale, che si accende da sola e che tutti sanno cos'e'. Con un
   * `notification_id` nostro, cosi' non se ne accumulano e quando la cosa si
   * sistema quello di prima si puo' levare.
   *
   * Non solleva: se l'avviso non parte — un permesso, una Home Assistant che
   * sta ripartendo — resta tutto il resto, e questo e' il piu' in piu', non la
   * strada. */
  async loDiceAChiCiAbita(servita, diPrima = []) {
    await this._laPlanciaDiPrima(diPrima);
    if (servita === false && !this._avvisato) {
      try {
        await this.casa.chiedi({
          type: "call_service",
          domain: "persistent_notification",
          service: "create",
          service_data: {
            notification_id: AVVISO,
            title: `gdahome: s${IL_RIAVVIO.titolo.slice(1)}`,
            message:
              `**${IL_RIAVVIO.passi}**\n\n` +
              "La plancia \u00e8 pronta: dopo il riavvio compare da sola nelle Plance, " +
              "su tutti i dispositivi, e questo avviso sparisce. Serve perch\u00e9 la " +
              "cartella `www` della configurazione non c\u2019era quando Home Assistant " +
              "\u00e8 partito: l\u2019ha creata gdahome adesso.\n\n" +
              `_${IL_RIAVVIO.title}: ${IL_RIAVVIO.steps}. The dashboard then shows up ` +
              "by itself, and this notice goes away._",
          },
        });
        this._avvisato = true;
      } catch (_errore) {
        /* Senza l'avviso si vive: il foglietto nella Plancia lo dice comunque. */
      }
      return;
    }
    /* Appena Home Assistant serve la pagina, l'avviso se ne va. **Anche se non
     * l'ha messo questo giro**: l'add-on puo' essersi riavviato dopo averlo
     * messo, e un avviso rimasto appeso a cosa fatta e' un avviso che la
     * prossima volta nessuno legge. Toglierne uno che non c'e' non fa niente,
     * quindi la prima volta si toglie comunque, e poi solo se l'abbiamo messo. */
    if (servita === true && (this._avvisato || !this._pulitoAllAvvio)) {
      try {
        await this.casa.chiedi({
          type: "call_service",
          domain: "persistent_notification",
          service: "dismiss",
          service_data: { notification_id: AVVISO },
        });
        this._avvisato = false;
        this._pulitoAllAvvio = true;
      } catch (_errore) {
        /* Resta appeso: meglio di un avviso che non parte. */
      }
    }
  }

  /* La Plancia rimasta dall'integrazione, detta a chi ci abita.
   *
   * E' l'avviso che mancava, e si e' visto quanto: qualcuno ha riavviato Home
   * Assistant **tre volte** su una voce che nessun riavvio puo' aggiustare,
   * perche' quella voce non e' di questo add-on — e' di un'integrazione che in
   * quella casa non c'e' piu'. Il ponte lo sapeva (lo scriveva nel registro) e
   * non lo diceva a nessuno.
   *
   * Non la tocca e non la propone di togliere da qui: una dashboard e' di chi
   * ci abita, e un add-on che cancella voci dalla barra laterale di casa
   * d'altri non e' un add-on di cui fidarsi. Si dice **cos'e'** e **dove** si
   * leva, e decide lui. */
  async _laPlanciaDiPrima(quali) {
    const elenco = Array.isArray(quali) ? quali : [];
    if (!elenco.length) {
      if (!this._avvisatoDiPrima) return;
      try {
        await this.casa.chiedi({
          type: "call_service",
          domain: "persistent_notification",
          service: "dismiss",
          service_data: { notification_id: AVVISO_DI_PRIMA },
        });
        this._avvisatoDiPrima = false;
      } catch (_errore) {
        /* Resta appeso: meglio di un avviso che non parte. */
      }
      return;
    }
    if (this._avvisatoDiPrima) return;
    const nomi = elenco.map((una) => `«${una.titolo || una.dove}»`).join(", ");
    this.registro.attenzione(
      `nella barra laterale c'e' ancora ${nomi}, dell'integrazione di prima: ` +
        "se l'integrazione non c'e' piu', quella voce apre con «Errore di configurazione»",
    );
    try {
      await this.casa.chiedi({
        type: "call_service",
        domain: "persistent_notification",
        service: "create",
        service_data: {
          notification_id: AVVISO_DI_PRIMA,
          title: "gdahome: una plancia di prima e' rimasta nella barra laterale",
          message:
            `Nella barra laterale c'e' ancora ${nomi}: e' dell'**integrazione** ` +
            "DashboardModern, non di questo add-on. Adesso la plancia la porta " +
            "gdahome, e la sua voce e' un'altra.\n\nSe l'integrazione non c'e' " +
            "piu', quella voce si apre con **«Errore di configurazione»** e non " +
            "si aggiusta riavviando: si leva da **Impostazioni → Dashboard**, " +
            "coi tre puntini accanto al suo nome.\n\nQuesto add-on non la tocca: " +
            "una dashboard e' di chi ci abita.\n\n_(English: a dashboard left by " +
            "the old DashboardModern integration is still in your sidebar; it " +
            "opens with a configuration error and can be removed from Settings " +
            "→ Dashboards.)_",
        },
      });
      this._avvisatoDiPrima = true;
    } catch (_errore) {
      /* Senza l'avviso si vive: la console lo dice comunque. */
    }
  }

  /* Finche' Home Assistant non serve la pagina d'apertura, si ricontrolla.
   *
   * E' la riga che fa la differenza fra «spiegato» e «risolto». Quando chi ci
   * abita riavvia Home Assistant — fra un minuto, stasera, domani — l'add-on
   * **non si riavvia con lui**: nessuno riguarderebbe niente, e il foglietto
   * resterebbe al posto della plancia per sempre.
   *
   * Appena Home Assistant risponde con la pagina si riscrive la Plancia vera,
   * e Home Assistant la porta da se' a tutte le pagine aperte — il telefono
   * compreso, senza toccarlo. Un minuto e non cinque: e' il tempo che chi ha
   * appena riavviato resta a guardare il foglietto, e costa una richiesta HTTP
   * al minuto solo mentre la cosa e' rotta. Poi la guardia si spegne. */
  sorveglia(ogni = 60_000) {
    if (this._guardia) return this._guardia;
    const giro = async () => {
      if (this.esito?.manca !== "riavvio") return this.smettiDiSorvegliare();
      if ((await this.laServe()) !== true) return undefined;
      this.registro.info(
        "Home Assistant serve la pagina d'apertura: rimetto la plancia nelle Plance",
      );
      await this.sistema();
      if (!this.esito?.manca) this.smettiDiSorvegliare();
      return undefined;
    };
    this._guardia = setInterval(() => void giro(), ogni);
    this._guardia.unref?.();
    return this._guardia;
  }

  smettiDiSorvegliare() {
    if (!this._guardia) return;
    clearInterval(this._guardia);
    this._guardia = null;
  }

  /* I file nella `www`: la pagina d'apertura, e accanto la cartina col
   * caricatore e il foglietto della versione per chi la tessera la usa.
   * Torna `true` se la pagina d'apertura l'ha davvero riscritta: si scrive
   * solo quando cambia, cosi' la data del file dice qualcosa.
   *
   * La cartina si scrive **sempre**, anche dove la risorsa non c'e': pesa
   * poco, e una dashboard che la tessera la usa — o la vecchia pagina di un
   * tablet rimasto acceso da prima — trova il suo file invece di un buco.
   *
   * L'ordine conta: prima la cartina, poi il caricatore, **per ultimo** il
   * foglietto con la versione. Il caricatore importa quello che il foglietto
   * dice, e un foglietto scritto prima della cartina farebbe cercare a una
   * pagina che parte in quel momento una versione che sul disco non c'e'
   * ancora. */
  laCarta() {
    if (!this.www) throw new Error("non so dove sia la cartella di Home Assistant");
    /* Prima di scrivere: c'era? Si guarda `www` e non `www/gdahome`, perche'
     * quella che Home Assistant si guarda all'avvio e' la prima. */
    if (!existsSync(this.www)) this.riavvia = true;
    const scritta = this._scriviSeCambia(this.doveVaLApertura, this.laPaginaDApertura());
    this._copiaSeCambia(this.carta, this.doveVaLaCarta);
    this._copiaSeCambia(this.caricatore, this.doveVaIlCaricatore);
    this._scriviSeCambia(
      this.doveVaLaVersione,
      `${JSON.stringify({ versione: this.versione, cartina: NOME_DELLA_CARTA })}\n`,
    );
    if (!scritta) return false;
    /* Una riga di spiegazione accanto: chi apre quella cartella e trova dei
     * file che non ha messo lui ha il diritto di sapere chi ce li ha messi. */
    try {
      writeFileSync(
        join(dirname(this.doveVaLApertura), "LEGGIMI.txt"),
        "Questa cartella la tiene l'add-on «gdahome».\n" +
          "Dentro c'e' la pagina che apre la plancia nelle Plance di Home\n" +
          "Assistant (apri.html), e la cartina per chi usa le tessere di\n" +
          "gdahome nelle sue dashboard. Si rifa' da se' a ogni avvio dell'add-on.\n" +
          "Cancellarla non rompe niente: torna al prossimo avvio.\n",
        "utf8",
      );
    } catch (_errore) {
      /* Senza il foglietto si vive. */
    }
    return true;
  }

  /* Copia un file nostro nella `www/gdahome`, solo se e' diverso da quello che
   * c'e'. Torna `true` se l'ha scritto. */
  _copiaSeCambia(da, a) {
    let uguale = false;
    try {
      uguale = readFileSync(a, "utf8") === readFileSync(da, "utf8");
    } catch (_errore) {
      uguale = false;
    }
    if (uguale) return false;
    mkdirSync(dirname(a), { recursive: true });
    copyFileSync(da, a);
    return true;
  }

  _scriviSeCambia(a, testo) {
    let uguale = false;
    try {
      uguale = readFileSync(a, "utf8") === testo;
    } catch (_errore) {
      uguale = false;
    }
    if (uguale) return false;
    mkdirSync(dirname(a), { recursive: true });
    writeFileSync(a, testo, "utf8");
    return true;
  }

  /* Quanto pesa quello che abbiamo scritto: la console lo dice, cosi' chi si
   * chiede cosa ci sia in quella cartella ha la risposta. */
  quantoPesaLaCarta() {
    try {
      return statSync(this.doveVaLaCarta).size;
    } catch (_errore) {
      return 0;
    }
  }

  /* Chi usa ancora le nostre tessere, e quindi se la risorsa serve.
   *
   * Le Plance di gdahome no: hanno dentro la tessera «pagina web» di Home
   * Assistant. Ma `custom:gdahome-riquadro` sta nelle voci di chi installa, e
   * `custom:gdahome-plancia` qualcuno se l'e' messa in una dashboard sua —
   * la cartina lo prevede (`barra: true`). Togliere la risorsa a loro vorrebbe
   * dire «Custom element doesn't exist» al posto di una cosa che andava.
   *
   * Quindi si guarda: le voci accese lo dice `index.js` (`tessere`), le
   * dashboard di chi ci abita si leggono. Leggerle non e' toccarle. Le nostre
   * Plance si saltano — quelle di prima hanno ancora la tessera, e sono
   * proprio quelle che questo giro riscrive.
   *
   * Torna `{servono, dove}`: `servono` e' `null` quando l'elenco delle
   * dashboard non si e' potuto leggere — e allora la risorsa non si tocca, ne'
   * per metterla ne' per toglierla. */
  async chiUsaLeTessere() {
    const dove = this.tessere ? ["le voci di chi installa"] : [];
    let elenco = null;
    try {
      const dentro = await this.casa.chiedi({ type: "lovelace/dashboards/list" });
      elenco = Array.isArray(dentro) ? dentro : [];
    } catch (_errore) {
      return { servono: this.tessere ? true : null, dove };
    }
    /* `null` e' la dashboard di casa, quella senza indirizzo. */
    const daLeggere = [null];
    for (const una of elenco) {
      const indirizzo = String(una?.url_path || "");
      if (!indirizzo) continue;
      if (indirizzo.startsWith(DAVANTI) && !NON_SONO_PLANCE.includes(indirizzo)) continue;
      daLeggere.push(indirizzo);
    }
    for (const indirizzo of daLeggere) {
      let config = null;
      try {
        config = await this.casa.chiedi(
          indirizzo === null
            ? { type: "lovelace/config" }
            : { type: "lovelace/config", url_path: indirizzo },
        );
      } catch (_errore) {
        /* Una dashboard mai aperta risponde con un errore: dentro non c'e'
         * niente, e quindi nemmeno una nostra tessera. */
        continue;
      }
      let scritta = "";
      try {
        scritta = JSON.stringify(config ?? "");
      } catch (_errore) {
        scritta = "";
      }
      if (scritta.includes(LE_NOSTRE_TESSERE)) dove.push(indirizzo ?? "la dashboard di casa");
    }
    return { servono: dove.length > 0, dove };
  }

  /* La risorsa di Lovelace della cartina: **una**, all'indirizzo fisso del
   * caricatore, e solo se serve a qualcuno.
   *
   * **Dove non serve** (`servono === false`), le nostre si tolgono tutte —
   * solo le nostre, quelle che cominciano per `/local/gdahome/`: le risorse
   * di HACS e di chi ci abita non si toccano. E' il passaggio di chi aggiorna
   * da una versione che la plancia la apriva con la tessera: una pagina gia'
   * aperta il modulo ce l'ha gia' in memoria e non se ne accorge, una che
   * parte dopo non lo carica — e la Plancia, riscritta, non ne ha bisogno.
   *
   * **Dove serve**, e' quella di prima: in elenco c'e' il caricatore, a un
   * indirizzo che non porta la versione, e un aggiornamento cambia
   * `versione.json` e non l'elenco. Le case che vengono da prima hanno ancora
   * `plancia.js?v=…`: quella si riscrive **una volta** all'indirizzo del
   * caricatore (`migrata`), e i doppioni si levano. Si cambia solo se il
   * caricatore e' sul disco: dichiarare un file che non c'e' vorrebbe dire
   * una tessera rossa al posto di una che funziona.
   *
   * **Se non si sa** (`null`), non si tocca niente. */
  async laRisorsa(servono = true) {
    const dentro = await this.casa.chiedi({ type: "lovelace/resources" });
    const elenco = Array.isArray(dentro) ? dentro : [];
    const nostre = elenco.filter((una) => String(una?.url || "").startsWith(`/local/${CARTELLA}/`));
    if (servono === null) return nostre.length ? "c'era" : "nessuna";
    if (servono === false) {
      for (const una of nostre) {
        await this.casa.chiedi({ type: "lovelace/resources/delete", resource_id: una.id });
      }
      return nostre.length ? "tolta" : "nessuna";
    }
    const stabile = this.indirizzoDelCaricatore;
    if (!nostre.length) {
      await this.casa.chiedi({
        type: "lovelace/resources/create",
        res_type: "module",
        url: stabile,
      });
      return "aggiunta";
    }
    let giusta = nostre.find((una) => String(una.url) === stabile);
    let cambiata = false;
    if (!giusta) {
      if (!existsSync(this.doveVaIlCaricatore)) return "c'era";
      giusta = nostre[0];
      cambiata = true;
      await this.casa.chiedi({
        type: "lovelace/resources/update",
        resource_id: giusta.id,
        res_type: "module",
        url: stabile,
      });
    }
    const doppioni = nostre.filter((una) => una !== giusta);
    for (const una of doppioni) {
      await this.casa.chiedi({ type: "lovelace/resources/delete", resource_id: una.id });
    }
    return cambiata || doppioni.length ? "migrata" : "c'era";
  }

  /* La Plancia di una plancia: la si crea se non c'e', le si rimette il titolo
   * e il «solo amministratori» se sono cambiati, e le si riscrive la vista.
   *
   * `require_admin` di serie e' **no**: la plancia la guarda anche chi abita
   * la casa, non solo chi la amministra. Quello che serve alla pagina
   * d'apertura — la sessione dell'ingress — Home Assistant lo da' anche a loro. Chi vuole il
   * contrario lo dice dalla pagina di gdahome, e allora questa riga diventa
   * `true` e Home Assistant fa il resto: quella voce non compare nella barra
   * laterale di chi non amministra, e la sua configurazione non gliela da'.
   *
   * `update` si manda solo se qualcosa e' cambiato davvero. Non e' per
   * risparmiare una chiamata: aggiornare una Plancia manda un avviso a tutte
   * le pagine aperte di Home Assistant, e riscrivere la stessa cosa a ogni
   * accensione dell'add-on le farebbe lampeggiare per niente. */
  async unaPlancia(quale, io = null, manca = "") {
    const dove = indirizzoDi(quale);
    const soloAdmin = quale.solo_admin === true;
    const dentro = await this.casa.chiedi({ type: "lovelace/dashboards/list" });
    const elenco = Array.isArray(dentro) ? dentro : [];
    let sua = elenco.find((una) => String(una?.url_path) === dove);
    if (!sua) {
      sua = await this.casa.chiedi({
        type: "lovelace/dashboards/create",
        url_path: dove,
        title: quale.titolo,
        icon: "mdi:view-dashboard-edit",
        show_in_sidebar: true,
        require_admin: soloAdmin,
      });
    } else if (
      String(sua.title || "") !== quale.titolo ||
      Boolean(sua.require_admin) !== soloAdmin
    ) {
      await this.casa.chiedi({
        type: "lovelace/dashboards/update",
        dashboard_id: sua.id,
        title: quale.titolo,
        require_admin: soloAdmin,
      });
    }
    await this.laVista(dove, this.vista(quale, io, manca));
    return sua;
  }

  /* La vista, scritta **solo se e' cambiata**.
   *
   * Non e' per risparmiare una scrittura: salvare la configurazione di una
   * Plancia manda a tutte le pagine di Home Assistant aperte un
   * `lovelace_updated`, e quelle si ridisegnano. Senza questo controllo, ogni
   * riavvio dell'add-on farebbe lampeggiare il tablet in cucina e il telefono
   * di chi la stava guardando — per riscriverci dentro la stessa cosa.
   *
   * Una Plancia senza configurazione — appena creata — risponde con un
   * errore, e allora si scrive: e' il caso normale del primo giro. */
  async laVista(dove, voluta) {
    let dentro = null;
    try {
      dentro = await this.casa.chiedi({ type: "lovelace/config", url_path: dove });
    } catch (_errore) {
      dentro = null;
    }
    if (dentro && JSON.stringify(dentro) === JSON.stringify(voluta)) return "c'era";
    await this.casa.chiedi({
      type: "lovelace/config/save",
      url_path: dove,
      config: voluta,
    });
    return dentro ? "riscritta" : "scritta";
  }

  /* La vista: una sola, a pagina intera, con dentro la tessera «pagina web»
   * di Home Assistant che apre la pagina d'apertura.
   *
   * `panel: true` e non una griglia: la plancia e' una pagina, non una
   * tessera in mezzo ad altre, e dentro una colonna larga quattrocento punti
   * sarebbe illeggibile. In una vista a pannello la tessera `iframe` prende
   * tutta l'altezza, e la pagina d'apertura le toglie la barra e la cornice.
   *
   * **Solo tessere di Home Assistant**, ed e' tutto il punto: nessuna risorsa
   * da dichiarare, quindi nessuna pagina che debba ripartire per vederla. Quando
   * questa configurazione cambia — un aggiornamento, una plancia rinominata,
   * la prima volta — Home Assistant la manda da se' a tutte le pagine aperte.
   *
   * Nell'indirizzo, nell'ordine e sempre uguale (se no la vista sembrerebbe
   * cambiata a ogni giro, e ogni salvataggio fa ridisegnare le pagine aperte):
   *
   *  - `v`: la versione dell'add-on e l'impronta della pagina. Cambia a ogni
   *    aggiornamento, e cosi' il browser riprende la pagina invece di tenersi
   *    quella del mese scorso — e la plancia a schermo si riapre nuova;
   *  - `addon` e `ingresso`: chi chiedere al Supervisor, e il ripiego;
   *  - `profilo`: quale plancia aprire. La prima non ha bisogno di dirlo;
   *  - `utenti`, `solo_admin`, `titolo`: chi la vede e come si chiama, per
   *    dire **subito** a chi non e' abilitato che non e' per lui, invece di
   *    lasciarlo davanti a un riquadro bianco. Non e' questo il cancello —
   *    quello sta nell'add-on, che guarda chi bussa e non gli manda la pagina.
   *
   * `manca` dice se la pagina d'apertura Home Assistant non la serve ancora
   * (`riavvio`): allora si scrive la vista che lo spiega. Vuoto vuol dire «per
   * quanto ne sappiamo si apre»: su un dubbio nostro non si toglie la plancia
   * a chi ce l'ha davanti. */
  vista(quale, io = null, manca = "") {
    if (manca === "riavvio") return this.vistaCheSpiega(quale);
    return {
      views: [
        {
          title: quale.titolo,
          panel: true,
          cards: [
            {
              type: "iframe",
              url: this.indirizzoPer(quale, io),
            },
          ],
        },
      ],
    };
  }

  /* L'indirizzo che la tessera «pagina web» di una plancia apre. */
  indirizzoPer(quale, io = null) {
    const detti = new URLSearchParams();
    detti.set("v", this.giroDellApertura);
    detti.set("addon", io?.slug || "");
    if (io?.ingresso) detti.set("ingresso", io.ingresso);
    if (!quale.primaria) detti.set("profilo", quale.profilo);
    const utenti = Array.isArray(quale?.utenti) ? quale.utenti.filter(Boolean).map(String) : [];
    if (utenti.length) detti.set("utenti", utenti.join(","));
    if (quale?.solo_admin === true) detti.set("solo_admin", "1");
    if (quale?.titolo) detti.set("titolo", quale.titolo);
    return `/local/${CARTELLA}/${NOME_DELL_APERTURA}?${detti.toString()}`;
  }

  /* La vista che si legge invece di un «404», finche' Home Assistant non
   * serve la cartella `www`.
   *
   * Una tessera `markdown`, che e' di Home Assistant: si apre **sempre**,
   * anche nel momento esatto in cui la pagina d'apertura non si aprirebbe.
   *
   * Succede in un caso solo — una casa che la cartella `www` non l'aveva mai
   * avuta, e a cui l'ha fatta l'add-on adesso — e quello che manca e' un
   * **riavvio di Home Assistant**, non una pagina da ricaricare: e qui dentro
   * non c'e' scritto di ricaricare niente, da nessuna parte. Dopo il riavvio
   * l'add-on se ne accorge da se' entro un minuto (`sorveglia`), riscrive la
   * Plancia, e Home Assistant la porta a tutte le pagine aperte: il telefono
   * che stava guardando questo foglietto si ritrova la plancia senza che
   * nessuno lo tocchi.
   *
   * In cima, grosse, le parole di `IL_RIAVVIO`: le stesse della campanella e
   * della Panoramica dell'add-on, cosi' chi le legge in tre posti sa che e' una
   * cosa sola. Detto per chi lo legge dal telefono, e per chi non amministra — che il
   * riavvio non lo puo' fare, e deve sapere a chi chiederlo. In due lingue
   * perche' indovinare quella di casa per sbagliarla vorrebbe dire una pagina
   * che non si apre **e** non si capisce. */
  vistaCheSpiega(quale) {
    return {
      views: [
        {
          title: quale.titolo,
          panel: true,
          cards: [
            {
              type: "markdown",
              content: [
                `## ${IL_RIAVVIO.titolo}`,
                "",
                `**${IL_RIAVVIO.passi}**`,
                "",
                `La plancia \u00ab${quale.titolo}\u00bb \u00e8 pronta. Dopo il riavvio compare qui da sola, entro un minuto, su tutti i dispositivi. Il riavvio lo fa chi amministra la casa, anche dall\u2019app sul telefono.`,
                "",
                "---",
                "",
                `## ${IL_RIAVVIO.title}`,
                "",
                `**${IL_RIAVVIO.steps}**`,
                "",
                "The dashboard is ready. After the restart it shows up here by itself within a minute, on every device. Whoever runs the home can restart it, from the phone app too.",
                "",
                "<sub>Il file che apre questa pagina sta nella cartella `www`, che Home Assistant apre solo quando parte: in questa casa l\u2019ha creata gdahome adesso. \u00b7 The file that opens this page lives in the `www` folder, which Home Assistant only opens at startup: gdahome just created it.</sub>",
              ].join("\n"),
            },
          ],
        },
      ],
    };
  }

  /* Cosa ne pensa Home Assistant, riletto da lui.
   *
   * Tre passaggi riusciti non vogliono dire che l'abbia preso: le risposte le
   * abbiamo viste noi, e quello che conta e' cosa c'e' scritto **da lui**
   * adesso. Quindi si rilegge l'elenco delle risorse e la vista della prima
   * Plancia, e si dice cosa si e' trovato.
   *
   * Non aggiusta niente ed e' apposta: e' l'unica riga che, da qui, dice a chi
   * guarda una Plancia che non si apre dove sta il pezzo che manca. */
  async controlla() {
    const come = {
      risorsa_in_elenco: null,
      /* **Quale** indirizzo ha in elenco, se ne ha uno. Dove la tessera non
       * la usa nessuno non ce n'e', ed e' giusto cosi'; dove serve, e' quello
       * del caricatore, che non cambia. */
      cartina_in_elenco: "",
      /* Cosa c'e' nella prima Plancia: `iframe` — la tessera «pagina web» di
       * Home Assistant — o `markdown` quando c'e' il foglietto del riavvio. E
       * quale indirizzo apre, per vedere che sia la nostra pagina. */
      tessera_nella_vista: "",
      indirizzo_nella_vista: "",
      altre_plance: [],
      /* Quelle dell'integrazione di prima, separate: e' la sola cosa che la
       * console non sapeva dire, e l'unica di tutta questa diagnostica che un
       * riavvio non aggiusta. */
      plance_di_prima: [],
    };

    /* **Tutte** le Plance di questa casa, non solo le nostre.
     *
     * Perche' serve: una casa che ha avuto l'integrazione di DashboardModern
     * si ritrova le sue Plance ancora li', con dentro una tessera di un
     * pannello che non esiste piu'. Quelle si aprono con «Errore di
     * configurazione» **per sempre**, qualunque cosa faccia questo add-on — e
     * in una barra laterale dove ce n'e' una nostra che si chiama uguale, chi
     * guarda non ha modo di sapere quale ha aperto. Quindi si elencano, e si
     * dice per ognuna se e' nostra. */
    try {
      const dentro = await this.casa.chiedi({ type: "lovelace/dashboards/list" });
      for (const una of Array.isArray(dentro) ? dentro : []) {
        const dove = String(una?.url_path || "");
        if (!dove) continue;
        come.altre_plance.push({
          dove,
          titolo: String(una?.title || ""),
          nostra: dove.startsWith(DAVANTI),
        });
      }
    } catch (_errore) {
      /* Se non si puo' chiedere, l'elenco resta vuoto. */
    }
    try {
      const dentro = await this.casa.chiedi({ type: "lovelace/resources" });
      const elenco = Array.isArray(dentro) ? dentro : [];
      const nostre = elenco.filter((una) =>
        String(una?.url || "").startsWith(`/local/${CARTELLA}/`),
      );
      const nostra =
        nostre.find((una) => String(una.url) === this.indirizzoDelCaricatore) || nostre[0];
      come.risorsa_in_elenco = Boolean(nostra);
      come.cartina_in_elenco = nostra ? String(nostra.url || "") : "";
    } catch (_errore) {
      /* Se non si puo' chiedere resta `null`, che vuol dire «non lo so» ed e'
       * diverso da «no». */
    }
    come.plance_di_prima = lePlanceDiPrima(come.altre_plance);

    const prima = this.plance?.prima;
    if (prima) {
      try {
        const vista = await this.casa.chiedi({
          type: "lovelace/config",
          url_path: indirizzoDi(prima),
        });
        const tessera = vista?.views?.[0]?.cards?.[0];
        come.tessera_nella_vista = typeof tessera?.type === "string" ? tessera.type : "";
        come.indirizzo_nella_vista = typeof tessera?.url === "string" ? tessera.url : "";
      } catch (_errore) {
        /* Una Plancia senza configurazione risponde con un errore, ed e' il
         * caso normale di chi non l'ha mai aperta. */
      }
    }
    return come;
  }

  /* Via le Plance di plance che non ci sono piu'. Solo le nostre: le altre le
   * ha fatte qualcuno, e non si toccano.
   *
   * E nemmeno le voci del ponte che Plance non sono — il Cruscotto e la
   * Gestione. Cominciano per `gdahome-` come tutto il nostro, ma non stanno
   * in nessun giro di plance, quindi senza l'elenco qui sotto finivano in
   * questo cestino un secondo dopo essere state create. */
  async pulisci(quali) {
    const restano = new Set(quali.map((una) => indirizzoDi(una)));
    const dentro = await this.casa.chiedi({ type: "lovelace/dashboards/list" });
    const elenco = Array.isArray(dentro) ? dentro : [];
    let quante = 0;
    for (const una of elenco) {
      const dove = String(una?.url_path || "");
      if (!dove.startsWith(DAVANTI) || restano.has(dove) || NON_SONO_PLANCE.includes(dove))
        continue;
      await this.casa.chiedi({ type: "lovelace/dashboards/delete", dashboard_id: una.id });
      quante += 1;
    }
    return quante;
  }
}
