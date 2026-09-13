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
    /* Com'e' andata l'ultima volta. `null` vuol dire che non si e' ancora
     * provato: e' diverso da «e' andata male», e la console lo dice
     * diversamente. */
    this.esito = null;
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

    try {
      await this.laRisorsa();
    } catch (errore) {
      guai.push(`la cartina non si e' dichiarata a Lovelace (${errore?.message || errore})`);
    }

    const quali = this.plance.elenco();
    let fatte = 0;
    for (const una of quali) {
      try {
        await this.unaPlancia(una, io);
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

    if (guai.length) {
      const perche = guai.join("; ");
      this.registro.attenzione(`le plance in Home Assistant, a meta': ${perche}`);
      return this._esito({ fatto: false, quante: fatte, tolte: via, perche });
    }
    this.registro.info(
      `le plance in Home Assistant sono a posto: ${fatte} ${fatte === 1 ? "voce" : "voci"}` +
        `${via ? `, ${via} tolte` : ""}${copiata ? ", cartina aggiornata" : ""}`,
    );
    return this._esito({ fatto: true, quante: fatte, tolte: via });
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
   * se e' cambiato, e le si riscrive la vista.
   *
   * `require_admin` a no: la plancia la guarda anche chi abita la casa, non
   * solo chi la amministra. Quello che serve alla cartina — la sessione
   * dell'ingress — Home Assistant lo da' anche a loro; se un giorno non fosse
   * piu' vero, la cartina lo dice a schermo invece di restare bianca. */
  async unaPlancia(quale, io = null) {
    const dove = indirizzoDi(quale);
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
        require_admin: false,
      });
    } else if (String(sua.title || "") !== quale.titolo) {
      await this.casa.chiedi({
        type: "lovelace/dashboards/update",
        dashboard_id: sua.id,
        title: quale.titolo,
      });
    }
    await this.laVista(dove, this.vista(quale, io));
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
   * sarebbe illeggibile. */
  vista(quale, io = null) {
    return {
      views: [
        {
          title: quale.titolo,
          panel: true,
          cards: [
            {
              type: "custom:gdahome-plancia",
              /* Quale plancia aprire. La prima non ha bisogno di dirlo. */
              profilo: quale.primaria ? "" : quale.profilo,
              /* Chi chiedere al Supervisor. La cartina prova a chiederglielo
               * da se'; questo e' il ripiego. */
              addon: io?.slug || "",
              ingresso: io?.ingresso || "",
            },
          ],
        },
      ],
    };
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
