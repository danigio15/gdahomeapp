/* Le plance dentro Home Assistant, una voce per ognuna.
 *
 * Nella dashboard questo lo faceva l'integrazione: registrava un pannello per
 * istanza, e ogni pannello si portava dietro una Plancia di Home Assistant
 * (`panel.js` → `ensureCompanionDashboard`). L'integrazione va dismessa, e
 * allora lo fa il ponte, con gli stessi comandi — quelli che il frontend di
 * Home Assistant usa per le Plance: `lovelace/dashboards/*`,
 * `lovelace/resources/*`, `lovelace/config/save`.
 *
 * **Tre pezzi, e servono tutti e tre.**
 *
 *  1. La **cartina**: `ponte/carta/plancia.js`, copiata in `www/gdahome/`.
 *     Deve stare li' e non dentro l'add-on, perche' quel file lo carica il
 *     browser dentro la pagina di Home Assistant, e da un add-on non lo
 *     saprebbe prendere: l'ingress vuole una sessione, e per chiederla serve
 *     del programma che gira **dentro** quella pagina. E' il motivo per cui
 *     questo add-on chiede di poter scrivere nella cartella di Home Assistant,
 *     ed e' l'unica cosa che ci scrive: `www/gdahome/`, e niente altro.
 *
 *  2. La **risorsa**: quel file dichiarato a Lovelace, se no `custom:` non
 *     esiste e la Plancia mostra una tessera rossa.
 *
 *  3. Una **Plancia** per plancia: una vista sola, a pagina intera, con dentro
 *     la cartina. La barra laterale la mostra col suo titolo.
 *
 * **Cosa non fa.** Non tocca le Plance di nessun altro: guarda solo quelle il
 * cui indirizzo comincia per `gdahome-`, e sono quelle che ha fatto lui. Una
 * Plancia scritta a mano da chi ci abita non e' roba sua.
 */

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

/* Dove finisce la cartina, dentro la `www` di Home Assistant. Una cartella
 * nostra e con il nostro nome: quello che c'e' intorno e' di chi ci abita. */
export const CARTELLA = "gdahome";
export const NOME_DELLA_CARTA = "plancia.js";

/* Come si chiama la tessera che la cartina registra. Sta qui in un posto solo
 * perche' serve in tre: per scriverla nella vista, per riconoscerla quando si
 * rilegge, e per sapere se la cartina che Home Assistant serve e' la nostra. */
export const TESSERA = "gdahome-plancia";

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

export function indirizzoDi(quale) {
  return `${DAVANTI}${quale.profilo}`;
}

export class PlanceInCasa {
  constructor({
    casa,
    plance,
    www = process.env.PONTE_WWW_CASA || "/homeassistant/www",
    carta = CARTA_QUI,
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
    /* La guardia che ricontrolla finche' la cartina non si scarica. */
    this._guardia = null;
    /* E se l'avviso della Plancia di prima l'abbiamo messo noi. */
    this._avvisatoDiPrima = false;
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

  /* Dove va la cartina. **L'unico percorso che questa classe scrive**, e sta
   * in un metodo suo perche' una prova lo guarda: la cartella di Home
   * Assistant e' quella dove stanno le automazioni e i segreti di chi ci
   * abita, e l'unica cosa che ci mettiamo e' un file nostro in una cartella
   * nostra. */
  get doveVaLaCarta() {
    return join(this.www, CARTELLA, NOME_DELLA_CARTA);
  }

  /* L'indirizzo con cui il browser chiede quel file. La `www` di Home
   * Assistant si affaccia su `/local/`. */
  get indirizzoDellaCarta() {
    const quando = this.versione ? `?v=${encodeURIComponent(this.versione)}` : "";
    return `/local/${CARTELLA}/${NOME_DELLA_CARTA}${quando}`;
  }

  /* Home Assistant la serve davvero, quella cartina?
   *
   * Sul disco c'e': ce l'abbiamo scritta noi un momento fa. Ma `/local/` Home
   * Assistant lo apre **all'avvio**, guardando se la cartella `www` c'e'; e in
   * una casa che non l'aveva — cioe' quasi tutte — quella cartella l'abbiamo
   * fatta noi adesso. Finche' Home Assistant non riparte, quell'indirizzo
   * risponde «non c'e'», la tessera `custom:gdahome-plancia` non esiste in
   * nessuna pagina, e la Plancia esce con «Errore di configurazione» e niente
   * altro.
   *
   * Questa domanda la faceva **solo la console**, da dentro una pagina di Home
   * Assistant — cioe' solo a chi andava a cercarla. Da qui si puo' fare uguale,
   * perche' `/local/` non chiede nessuna chiave a nessuno: e' il motivo per cui
   * in quella cartella non si mettono segreti. Farla qui vuol dire poterlo
   * scrivere **nella pagina**, che e' il posto dove il difetto si vede.
   *
   * Non basta che risponda: si guarda che sia la cartina, e non la pagina di
   * Home Assistant che risponde «va tutto bene» a qualunque indirizzo.
   *
   * `null` vuol dire «non lo so» — fuori da un add-on, o se non si riesce a
   * chiedere — ed e' diverso da «no»: chi chiama le tiene separate, perche' su
   * un «non lo so» non si cambia quello che chi ci abita ha davanti.
   */
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
      const risposta = await this.prendi(`${dove}${this.indirizzoDellaCarta}`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (risposta.status === 404) return false;
      if (!risposta.ok) return null;
      return String(await risposta.text()).includes(TESSERA);
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

  /* Mette a posto tutto: la cartina, la risorsa, una Plancia per plancia, e
   * via quelle di plance che non ci sono piu'.
   *
   * Non solleva: se Home Assistant e' in modalita' YAML per Lovelace — dove le
   * Plance non si aggiungono da fuori — o se qualcosa non riesce, lo scrive
   * nel registro e lascia tutto il resto in piedi. L'app e la plancia
   * dall'ingress funzionano comunque, e quella qui e' una comodita' in piu',
   * non la strada. */
  async sistema() {
    if (!this.plance) return this._esito({ fatto: false, perche: "non ci sono plance" });
    if (!this.cE) {
      return this._esito({ fatto: false, perche: "qui non c'e' nessuna Home Assistant" });
    }

    /* I tre pezzi, **uno per volta e ognuno per conto suo**.
     *
     * Prima erano in un `try` solo, e quello era un difetto: se la risorsa non
     * si dichiarava — Lovelace in modalita' YAML, o un permesso che manca —
     * saltava anche la creazione delle Plance, cioe' la voce nella barra
     * laterale non compariva **per un motivo che non la riguardava**. Adesso
     * quello che riesce riesce, e quello che non riesce si dice per nome. */
    const guai = [];
    let copiata = false;
    try {
      copiata = this.laCarta();
    } catch (errore) {
      guai.push(`la cartina non si e' scritta (${errore?.message || errore})`);
    }

    const io = await this._chiSiamo();

    /* Cosa dice **Lovelace** della cartina, e non cosa ne pensiamo noi.
     *
     * E' la riga che mancava per smettere di indovinare. Se questa chiamata
     * non riesce, la tessera `custom:gdahome-plancia` non esiste in nessuna
     * pagina — e la plancia aperta dalle «Plance» esce con «Errore di
     * configurazione», che e' quello che si stava guardando senza sapere
     * perche'. Il motivo tipico e' uno: le dashboard tenute in YAML, dove
     * Home Assistant le risorse dallo storage non le legge per scelta sua. */
    let risorsa = "";
    let risorsaGuaio = "";
    try {
      risorsa = await this.laRisorsa();
    } catch (errore) {
      risorsaGuaio = String(errore?.message || errore);
      guai.push(`la cartina non si e' dichiarata a Lovelace (${risorsaGuaio})`);
    }

    /* E adesso la domanda che decide **cosa vede** chi apre quella voce: Home
     * Assistant quella cartina la serve? Se no, la vista che si scrive e'
     * un'altra — quella che spiega — invece di una che si apre con «Errore di
     * configurazione». */
    const servita = await this.laServe();

    /* E **quale** dei due passaggi manca, se ne manca uno. L'ordine conta: il
     * riavvio viene prima, perche' se Home Assistant non serve il file una
     * ricarica non lo fa comparire. */
    const manca = servita === false ? "riavvio" : risorsa === "aggiunta" ? "ricarica" : "";

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

    /* Due cose da dire anche quando e' andato tutto bene, e non sono dettagli:
     * senza la prima la plancia non si apre, e senza la seconda non si apre
     * finche' non si ricarica la pagina. */
    /* E quello che ne dice Home Assistant, riletto da lui. Va anche nel
     * registro, e non solo nella scheda: il registro e' il posto dove si
     * guarda quando una pagina non si apre, e una riga che sta solo dentro una
     * pagina non serve a chi quella pagina non riesce ad aprirla. */
    const come = await this.controlla();
    this.registro.info(
      `Home Assistant dice: cartina in elenco ${
        come.risorsa_in_elenco === null ? "non lo so" : come.risorsa_in_elenco ? "si" : "no"
      }, nella Plancia c'e' «${come.tessera_nella_vista || "niente"}»`,
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
      /* Cosa ha risposto Home Assistant alla cartina: `true`, `false`, o
       * `null` se non si e' potuto chiedere. La console lo mostra, e non e' un
       * dettaglio: e' la differenza fra «non so perche' non si apre» e «non si
       * apre per questo». */
      servita,
      /* Quale foglietto sta nella Plancia adesso, se ce n'e' uno: la console lo
       * dice, perche' e' quello che stanno guardando gli altri. */
      manca,
      riavvia: this.riavvia,
      ricarica: risorsa === "aggiunta",
      /* La cartina e' cambiata: l'add-on si e' aggiornato.
       *
       * Questo caso non lo diceva nessuno, e si e' visto. L'indirizzo della
       * cartina porta la versione (`?v=1.4.32.6`) proprio perche' il browser
       * non si tenga quella di ieri — ma l'elenco delle risorse Home Assistant
       * lo legge **all'avvio della pagina**: su una pagina gia' aperta continua
       * a girare la cartina di prima, e qualunque correzione ci sia dentro
       * quella nuova non arriva.
       *
       * «Continua a uscire la barra» era questo: l'add-on aggiornato, la
       * pagina no, e la console che diceva che andava tutto bene.
       *
       * Nella vista **non** si tocca niente, e non e' una dimenticanza: con la
       * cartina di prima ancora in pagina `custom:gdahome-plancia` si risolve
       * eccome, e la plancia si apre. Metterci il foglietto vorrebbe dire
       * cancellare una plancia che funziona a ogni aggiornamento. Si dice, e
       * basta. */
      aggiornata: risorsa === "aggiornata",
      /* Com'e' andata a dichiararla: `aggiunta`, `c'era`, `aggiornata`, o
       * niente e allora `risorsa_guaio` dice cosa ha risposto Lovelace. */
      risorsa,
      risorsa_guaio: risorsaGuaio,
      /* Dov'e' la cartina, per chi la puo' provare davvero.
       *
       * Da qui dentro non si sa se Home Assistant la serve: il file e' sul
       * disco, e `/local/` lo apre lui all'avvio. Ma la console gira **dentro
       * una pagina di Home Assistant**, sullo stesso indirizzo: da li' una
       * riga di programma la chiede e lo sa. Quindi glielo si dice dove sta. */
      cartina: this.indirizzoDellaCarta,
    };
    if (this.riavvia) {
      this.registro.attenzione(
        "la cartella www di Home Assistant non c'era e l'ho fatta io: " +
          "Home Assistant va riavviato una volta, se no i file dentro /local/ non li serve",
      );
    }
    if (risorsa === "aggiornata") {
      this.registro.attenzione(
        "la cartina della plancia e' passata alla " +
          (this.versione || "versione nuova") +
          ": chi ha una pagina di Home Assistant gia' aperta deve ricaricarla " +
          "(F5), se no continua a girare quella di prima",
      );
    }
    if (servita === false) {
      this.registro.attenzione(
        `Home Assistant non serve ancora ${this.indirizzoDellaCarta}: ` +
          "nelle Plance c'e' il foglietto che dice di riavviare, non la plancia",
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
        `${via ? `, ${via} tolte` : ""}${copiata ? ", cartina aggiornata" : ""}`,
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
            title: "gdahome: riavvia Home Assistant una volta",
            message:
              "La plancia \u00e8 pronta, ma il file che la disegna sta nella cartella " +
              "`www` della configurazione, e Home Assistant apre quella cartella " +
              "soltanto quando parte. In questa casa non c\u2019era: l\u2019ha fatta " +
              "gdahome adesso.\n\n**Impostazioni → Sistema → in alto a destra → " +
              "Riavvia Home Assistant.** Dopo, la plancia si apre da s\u00e9 e questo " +
              "avviso sparisce.\n\n_(English: Home Assistant needs one restart before " +
              "it will serve the file that draws the dashboard.)_",
          },
        });
        this._avvisato = true;
      } catch (_errore) {
        /* Senza l'avviso si vive: il foglietto nella Plancia lo dice comunque. */
      }
      return;
    }
    if (servita === true && this._avvisato) {
      try {
        await this.casa.chiedi({
          type: "call_service",
          domain: "persistent_notification",
          service: "dismiss",
          service_data: { notification_id: AVVISO },
        });
        this._avvisato = false;
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

  /* Finche' la cartina non si scarica, si ricontrolla.
   *
   * E' la riga che fa la differenza fra «spiegato» e «risolto». Quando chi ci
   * abita riavvia Home Assistant — fra un minuto, stasera, domani — l'add-on
   * **non si riavvia con lui**: nessuno riguarda niente, e quel foglietto
   * resterebbe al posto della plancia per sempre, con la cartina che intanto
   * si scarica benissimo.
   *
   * Costa una richiesta HTTP ogni cinque minuti, e solo mentre la cosa e'
   * rotta: appena Home Assistant risponde con la cartina si rifa' la vista
   * vera, si leva l'avviso, e la guardia si spegne e non torna piu'. */
  sorveglia(ogni = 5 * 60_000) {
    if (this._guardia) return this._guardia;
    const giro = async () => {
      /* Due motivi per stare di guardia, e si spengono in due modi diversi.
       *
       * `riavvio`: si aspetta che Home Assistant riparta e serva il file, e lo
       * si chiede a lui — una richiesta ogni cinque minuti, e appena risponde
       * si rimette la plancia.
       *
       * `ricarica`: la ricarica la fa chi guarda, nel suo browser, e da qui non
       * si puo' sapere se l'ha fatta. Quindi non si aspetta niente: si rifa la
       * vista vera al primo giro, e il foglietto resta il tempo che serve a
       * leggerlo. Se non ha ancora ricaricato, la pagina gli esce vuota per un
       * momento e la ricarica gliela chiede il browser da se'. */
      const perche = this.esito?.manca || "";
      if (!perche) return this.smettiDiSorvegliare();
      if (perche === "riavvio" && (await this.laServe()) !== true) return undefined;
      this.registro.info(
        perche === "riavvio"
          ? "Home Assistant serve la cartina: rimetto la plancia nelle Plance"
          : "la cartina e' dichiarata da un po': rimetto la plancia nelle Plance",
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

  /* La cartina nella `www`. Torna `true` se l'ha davvero riscritta: si copia
   * solo quando cambia, cosi' la data del file dice qualcosa. */
  laCarta() {
    if (!this.www) throw new Error("non so dove sia la cartella di Home Assistant");
    const dove = this.doveVaLaCarta;
    let uguale = false;
    try {
      uguale = readFileSync(dove, "utf8") === readFileSync(this.carta, "utf8");
    } catch (_errore) {
      uguale = false;
    }
    if (uguale) return false;
    /* Prima di farla: c'era? Si guarda `www` e non `www/gdahome`, perche'
     * quella che Home Assistant si guarda all'avvio e' la prima. */
    if (!existsSync(this.www)) this.riavvia = true;
    mkdirSync(dirname(dove), { recursive: true });
    copyFileSync(this.carta, dove);
    /* Una riga di spiegazione accanto: chi apre quella cartella e trova un
     * file che non ha messo lui ha il diritto di sapere chi ce l'ha messo. */
    try {
      writeFileSync(
        join(dirname(dove), "LEGGIMI.txt"),
        "Questa cartella la tiene l'add-on «gdahome».\n" +
          "Dentro c'e' una cosa sola: la cartina che apre la plancia nelle\n" +
          "Plance di Home Assistant. Si rifa' da se' a ogni avvio dell'add-on.\n" +
          "Cancellarla non rompe niente: torna al prossimo avvio.\n",
        "utf8",
      );
    } catch (_errore) {
      /* Senza il foglietto si vive. */
    }
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

  async laRisorsa() {
    const dentro = await this.casa.chiedi({ type: "lovelace/resources" });
    const elenco = Array.isArray(dentro) ? dentro : [];
    const gia = elenco.find((una) => String(una?.url || "").startsWith(`/local/${CARTELLA}/`));
    if (!gia) {
      await this.casa.chiedi({
        type: "lovelace/resources/create",
        res_type: "module",
        url: this.indirizzoDellaCarta,
      });
      return "aggiunta";
    }
    if (String(gia.url) === this.indirizzoDellaCarta) return "c'era";
    /* Cambia la versione dell'add-on: cambia l'indirizzo, e il browser va a
     * riprendere la cartina invece di tenersi quella di ieri. */
    await this.casa.chiedi({
      type: "lovelace/resources/update",
      resource_id: gia.id,
      res_type: "module",
      url: this.indirizzoDellaCarta,
    });
    return "aggiornata";
  }

  /* La Plancia di una plancia: la si crea se non c'e', le si rimette il titolo
   * e il «solo amministratori» se sono cambiati, e le si riscrive la vista.
   *
   * `require_admin` di serie e' **no**: la plancia la guarda anche chi abita
   * la casa, non solo chi la amministra. Quello che serve alla cartina — la
   * sessione dell'ingress — Home Assistant lo da' anche a loro. Chi vuole il
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

  /* La vista: una sola, a pagina intera, con dentro la cartina.
   *
   * `panel: true` e non una griglia: la plancia e' una pagina, non una
   * tessera in mezzo ad altre, e dentro una colonna larga quattrocento punti
   * sarebbe illeggibile.
   *
   * `manca` dice **quale** dei due passaggi manca, e sono due perche' i modi di
   * non vedere la plancia sono due:
   *
   *  - `riavvio`: Home Assistant non serve il file della tessera, perche' la
   *    cartella `www` l'abbiamo fatta noi e lui la apre solo all'avvio;
   *  - `ricarica`: il file lo serve, ma la risorsa Lovelace e' stata dichiarata
   *    **adesso** — la pagina aperta in questo momento quel modulo non l'ha
   *    caricato, e lo caricherebbe al giro dopo.
   *
   * Il secondo e' quello che mancava, ed e' il piu' frequente: nelle case che
   * hanno HACS la cartella `www` c'e' da sempre, quindi il riavvio non serve e
   * il primo caso non scatta — e chi apriva quella voce si prendeva «Errore di
   * configurazione» nudo, che di motivi non ne da' nessuno. E' lo stesso
   * difetto che l'integrazione si e' sentita segnalare dieci volte.
   *
   * Vuoto vuol dire «per quanto ne sappiamo si apre»: si scrive quella vera,
   * com'e' sempre stato. Su un dubbio nostro non si toglie la plancia a chi ce
   * l'ha davanti. */
  vista(quale, io = null, manca = "") {
    if (manca) return this.vistaCheSpiega(quale, manca);
    return {
      views: [
        {
          title: quale.titolo,
          panel: true,
          cards: [
            {
              type: `custom:${TESSERA}`,
              /* Quale plancia aprire. La prima non ha bisogno di dirlo. */
              profilo: quale.primaria ? "" : quale.profilo,
              /* Chi chiedere al Supervisor. La cartina prova a chiederglielo
               * da se'; questo e' il ripiego. */
              addon: io?.slug || "",
              ingresso: io?.ingresso || "",
              /* Chi la vede: gli utenti di Home Assistant abilitati, vuoto se
               * tutti. Sta qui perche' la cartina possa dirlo **subito** a chi
               * non e' abilitato, senza chiedere niente a nessuno e senza
               * mettersi a caricare una pagina che l'add-on non gli serve.
               *
               * Non e' questo il cancello — quello sta nell'add-on, che guarda
               * chi bussa e non gli manda la pagina — e' la frase che si legge
               * invece di un riquadro che resta bianco. */
              utenti: Array.isArray(quale?.utenti) ? quale.utenti : [],
              /* E se chiede di amministrare. Anche questa serve alla cartina
               * per dirlo invece di restare bianca: a questa voce Home
               * Assistant non ci fa arrivare chi non amministra, ma
               * l'indirizzo dell'ingress si apre anche per altre strade. */
              solo_admin: quale?.solo_admin === true,
              /* Come si chiama, per una frase sola: quella che legge chi non e'
               * abilitato. La vista ha gia' il titolo, ma la cartina vede solo
               * la propria configurazione. */
              titolo: quale?.titolo || "",
            },
          ],
        },
      ],
    };
  }

  /* La vista che si legge invece di «Errore di configurazione».
   *
   * Una tessera `markdown`, che e' di Home Assistant: non ha bisogno di
   * nessuna cartina, di nessuna risorsa dichiarata e di nessuna pagina
   * ricaricata. Quindi si apre **sempre** — anche nel momento esatto in cui
   * quella vera non si aprirebbe, che e' tutto il punto.
   *
   * Cosa c'e' scritto conta piu' del fatto che ci sia scritto qualcosa: c'e'
   * il passaggio da fare e dove si fa, non «si e' verificato un errore». Chi
   * apre quella voce nella barra laterale e' qualcuno che ha appena installato
   * un add-on e vuole vedere la sua casa; ha diritto a una frase che gli dica
   * cosa premere, non a un codice da cercare.
   *
   * In due lingue perche' questa e' la pagina che vede chi non ci ha mai
   * messo mano, e indovinare la lingua di casa per sbagliarla vorrebbe dire
   * una pagina che non si apre **e** non si capisce. */
  vistaCheSpiega(quale, manca = "riavvio") {
    const eIlRiavvio = manca !== "ricarica";
    return {
      views: [
        {
          title: quale.titolo,
          panel: true,
          cards: [
            {
              type: "markdown",
              content: (eIlRiavvio
                ? [
                    `## ${quale.titolo}`,
                    "",
                    "Manca un passaggio solo, e si fa una volta: **Home Assistant va riavviato.**",
                    "",
                    "Impostazioni → Sistema → in alto a destra → **Riavvia Home Assistant**.",
                    "",
                    "Il file che disegna questa pagina sta nella cartella `www` della",
                    "configurazione, e Home Assistant apre quella cartella soltanto quando",
                    "parte. In questa casa non c\u2019era: l\u2019ha fatta gdahome adesso, e",
                    "finch\u00e9 Home Assistant non riparte quel file non lo serve a nessuno.",
                    "",
                    "Dopo il riavvio questa pagina diventa la plancia da s\u00e9. Se hai gi\u00e0",
                    "riavviato e leggi ancora questo, ricarica la pagina una volta.",
                    "",
                    "---",
                    "",
                    "**One step left, once:** Home Assistant needs a restart.",
                    "Settings → System → top right → **Restart Home Assistant**.",
                    "",
                    "The file that draws this page lives in the `www` folder of your",
                    "configuration, and Home Assistant only opens that folder at startup.",
                    "This home did not have it: gdahome just created it. After the restart",
                    "this page becomes the dashboard by itself.",
                  ]
                : [
                    `## ${quale.titolo}`,
                    "",
                    "Manca un passaggio solo, e si fa una volta: **ricarica questa pagina.**",
                    "",
                    "Il tasto di ricarica del browser, o **F5**. Poi riapri questa voce.",
                    "",
                    "Il file che disegna questa pagina \u00e8 stato appena dichiarato a Home",
                    "Assistant, e una pagina gi\u00e0 aperta i file nuovi non li va a prendere:",
                    "li prende quando riparte. \u00c8 una regola dei browser, non nostra.",
                    "",
                    "Dopo la ricarica questa pagina \u00e8 la plancia. Se la riapri e leggi",
                    "ancora questo, vuol dire che la ricarica non \u00e8 andata a fondo: tieni",
                    "premuto il tasto di ricarica e scegli di svuotare la cache.",
                    "",
                    "---",
                    "",
                    "**One step left, once:** reload this page (**F5**), then open this entry",
                    "again.",
                    "",
                    "The file that draws this page has just been declared to Home Assistant,",
                    "and a page that is already open does not go and fetch new files: it picks",
                    "them up when it restarts. After the reload this page is the dashboard.",
                  ]
              ).join("\n"),
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
   * guarda «Errore di configurazione» dove sta il pezzo che manca. */
  async controlla() {
    const come = {
      risorsa_in_elenco: null,
      /* **Quale** cartina ha in elenco, non solo se ce l'ha.
       *
       * L'indirizzo porta la versione dell'add-on (`?v=1.4.32.6`), e serve
       * proprio a questo: cambia la versione, cambia l'indirizzo, e il browser
       * va a riprendere il file invece di tenersi quello di ieri. Ma l'elenco
       * delle risorse Home Assistant lo legge **all'avvio della pagina**:
       * finche' non si ricarica, la pagina continua a far girare la cartina di
       * prima anche se in elenco c'e' gia' quella nuova.
       *
       * Sapere «ce l'ha» non bastava a distinguere le due cose, e chi guardava
       * una correzione che non si vedeva non aveva modo di sapere se mancava
       * l'aggiornamento o solo un F5. Adesso c'e' scritto. */
      cartina_in_elenco: "",
      tessera_nella_vista: "",
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
      const nostra = elenco.find((una) => String(una?.url || "").startsWith(`/local/${CARTELLA}/`));
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
        const tessera = vista?.views?.[0]?.cards?.[0]?.type;
        come.tessera_nella_vista = typeof tessera === "string" ? tessera : "";
      } catch (_errore) {
        /* Una Plancia senza configurazione risponde con un errore, ed e' il
         * caso normale di chi non l'ha mai aperta. */
      }
    }
    return come;
  }

  /* Via le Plance di plance che non ci sono piu'. Solo le nostre: le altre le
   * ha fatte qualcuno, e non si toccano. */
  async pulisci(quali) {
    const restano = new Set(quali.map((una) => indirizzoDi(una)));
    const dentro = await this.casa.chiedi({ type: "lovelace/dashboards/list" });
    const elenco = Array.isArray(dentro) ? dentro : [];
    let quante = 0;
    for (const una of elenco) {
      const dove = String(una?.url_path || "");
      if (!dove.startsWith(DAVANTI) || restano.has(dove)) continue;
      await this.casa.chiedi({ type: "lovelace/dashboards/delete", dashboard_id: una.id });
      quante += 1;
    }
    return quante;
  }
}
