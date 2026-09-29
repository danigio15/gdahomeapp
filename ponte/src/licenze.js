/* Le licenze di questa casa: gdahome Premium, e gdanav che ci sta dentro.
 *
 * Il contratto intero sta in `docs/LICENZE.md`. Qui c'e' la parte della casa:
 * chiedere al quadro i gettoni, tenerli sul disco, verificarli da se', e dire
 * a chi lo chiede se questa casa e' Premium.
 *
 * ─── Una domanda, non un rapporto ────────────────────────────────────────
 *
 * All'accensione e poi ogni sei ore la casa bussa a
 * `POST /v1/licenze/casa` con due cose, e solo quelle: chi e' (`casa_…`) e il
 * suo segreto per il quadro. Non e' il rapporto al quadro dell'installatore —
 * quello resta spento di serie, e se e' spento resta spento — e non porta
 * niente della casa: nessuno stato, nessun nome, nessun numero.
 *
 * La risposta sono dei gettoni firmati, che la casa **verifica da se'** con la
 * chiave pubblica di `chiave-licenze.js`. Il quadro non puo' dire «sei
 * Premium» con una risposta qualunque: lo dice con una firma, o non lo dice.
 *
 * ─── Senza internet ──────────────────────────────────────────────────────
 *
 * L'ultima risposta buona sta in `/data/licenze.json`. Un gettone vale al
 * massimo otto giorni dopo che e' stato emesso: una casa che resta senza rete
 * resta Premium per quegli otto giorni, e poi torna Base finche' non ribussa.
 * Un quadro che non risponde non toglie niente: resta il gettone di prima.
 *
 * ─── Con la chiave vuota ─────────────────────────────────────────────────
 *
 * Non parte niente e non cambia niente. `attive` e' falso, nessuno bussa al
 * quadro, e `limitata` e' falso: la casa fa tutto quello che faceva ieri. Le
 * licenze si accendono il giorno in cui la chiave si scrive.
 *
 * ─── Prima l'iPhone ──────────────────────────────────────────────────────
 *
 * Con `LICENZE_SOLO_SULL_IPHONE` (`chiave-licenze.js`) la chiave c'e' ma il
 * Premium si vende solo nell'app per iPhone. La casa fa meta' del lavoro:
 * bussa al quadro, tiene i gettoni, gira le ricevute — chi compra dall'iPhone
 * deve diventare Premium davvero — e non limita niente, perche' i lucchetti
 * li mette solo quell'app. `attive` e' vero, `limitata` resta falso.
 */

import { EventEmitter } from "node:events";
import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { CHIAVE_PUBBLICA_LICENZE, LICENZE_SOLO_SULL_IPHONE } from "./chiave-licenze.js";
import { leggiGettone, valeAdesso, verificaGettone } from "./gettone.js";
import { perchePreciso, QUADRO_DI_DIFETTO } from "./rapporto.js";

/* Ogni quanto si rinnova. Il gettone vale otto giorni: sei ore lasciano
 * trentuno tentativi prima che scada, che bastano a qualunque guasto
 * ragionevole della rete o del quadro. */
export const OGNI = 6 * 60 * 60 * 1000;

/* Quanto si aspetta il quadro. Non c'e' nessuno davanti a uno schermo che
 * aspetta, tranne quando si riscatta un codice: dieci secondi bastano. */
const ATTESA = 10_000;

/* Le app di cui si tengono i gettoni. */
export const APP = Object.freeze(["gdahome", "gdanav"]);

/* Un codice regalo: `GDA-XXXX-XXXX-XXXX`, con l'alfabeto senza lettere che si
 * confondono (niente I, L, O, 0, 1). Si accetta scritto come capita — in
 * minuscolo, senza trattini, con gli spazi — e si riscrive giusto. */
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODICE_BUONO = new RegExp(`^GDA([${ALFABETO}]{4})([${ALFABETO}]{4})([${ALFABETO}]{4})$`);

export function codiceRegaloPulito(scritto) {
  const tutto = String(scritto ?? "")
    .toUpperCase()
    .replace(/[\s-]+/g, "");
  const pezzi = CODICE_BUONO.exec(tutto);
  return pezzi ? `GDA-${pezzi[1]}-${pezzi[2]}-${pezzi[3]}` : "";
}

/* I prodotti e le piattaforme del negozio, come li dice il contratto. */
const PIATTAFORME = new Set(["android", "ios"]);

/** Un no del quadro, col suo codice: l'app ci fa cose diverse. */
export class LicenzaNo extends Error {
  constructor(codice, spiegazione, stato = 0) {
    super(spiegazione);
    this.codice = codice;
    this.stato = stato;
  }
}

export class Licenze extends EventEmitter {
  constructor({
    casa = "",
    /* Il segreto della casa per il quadro. Una funzione e non una stringa: lo
     * tiene il postino del rapporto (`rapporto.js`, `segretoDellaCasa`), e il
     * perche' e' scritto li'. */
    segreto = () => "",
    cartella = "",
    chiave = CHIAVE_PUBBLICA_LICENZE,
    /* Le licenze contano solo nell'app per iPhone: vedi in cima. */
    soloSullIPhone = LICENZE_SOLO_SULL_IPHONE,
    /* Dove sta il quadro. Si sposta come si sposta quello del rapporto — con
     * `PONTE_QUADRO_DOVE` — che serve alle prove e a chi si rifa' gdahome per
     * se'. Nella scheda dell'add-on non c'e' una casella: il quadro delle
     * licenze e' uno. */
    dove = process.env.PONTE_QUADRO_DOVE || QUADRO_DI_DIFETTO,
    fetch: prendi = globalThis.fetch,
    adesso = () => Date.now(),
    ogni = OGNI,
    registro,
  } = {}) {
    super();
    this.casa = String(casa || "");
    this.segreto = typeof segreto === "function" ? segreto : () => String(segreto || "");
    this.chiave = String(chiave || "");
    this.soloSullIPhone = soloSullIPhone === true;
    this.dove = String(dove || "").replace(/\/+$/, "");
    this.prendi = prendi;
    this.adesso = adesso;
    this.ogni = ogni;
    this.registro = registro ?? { debug() {}, info() {}, attenzione() {}, errore() {} };

    this._memoria = cartella
      ? new Archivio(join(String(cartella), "licenze.json"), {})
      : { dati: {}, salva() {} };
    this._orologio = null;
    this._inCorso = null;
    /* Com'e' andata l'ultima volta che si e' bussato. In memoria e basta: e'
     * per la console, e dopo un riavvio si riempie al primo giro. */
    this._esito = null;
    /* Le firme gia' guardate, per gettone: vedi `_valido`. */
    this._firmati = new Map();
    this._premiumPrima = this.premium;
  }

  /* ─── Quello che si chiede ─────────────────────────────────────────────── */

  /** Se le licenze sono accese: c'e' una chiave con cui verificarle. */
  get attive() {
    return Boolean(this.chiave);
  }

  get gettoni() {
    const detti = this._memoria.dati?.gettoni;
    return detti && typeof detti === "object" ? detti : {};
  }

  /* Il gettone di un'app, se vale adesso. Per `gdanav` vale anche quello di
   * gdahome: e' la regola del contratto, e sta in `verificaGettone`. */
  _valido(app) {
    if (!this.attive) return null;
    const adesso = this.adesso();
    const di = (quale) => {
      const gettone = this.gettoni[quale];
      if (typeof gettone !== "string") return null;
      /* La firma si guarda una volta per gettone, e l'orologio ogni volta.
       * `limitata` la chiede ogni commissione che passa sul filo — trecento
       * file della plancia sono trecento domande — e rifare la firma a ognuna
       * sarebbe lavoro per niente: il gettone cambia ogni sei ore. */
      const chiave = `${this.chiave}|${this.casa}|${app}|${gettone}`;
      if (!this._firmati.has(chiave)) {
        if (this._firmati.size >= 8) this._firmati.clear();
        /* Con l'orologio all'inizio dei tempi restano solo le regole che non
         * dipendono dall'ora: firma, versione, soggetto, app. */
        this._firmati.set(
          chiave,
          verificaGettone(gettone, { chiave: this.chiave, sog: this.casa, app, adesso: -Infinity }),
        );
      }
      const detto = this._firmati.get(chiave);
      return detto && valeAdesso(detto, { sog: this.casa, app, adesso }) ? detto : null;
    };
    return app === "gdanav" ? di("gdanav") || di("gdahome") : di("gdahome");
  }

  /** Questa casa ha gdahome Premium, adesso. */
  get premium() {
    return Boolean(this._valido("gdahome"));
  }

  /* Se questa casa sta nei limiti di Base.
   *
   * E' la domanda che fanno le plance, il portiere e le commissioni, e non e'
   * `!premium`: con la chiave vuota le licenze sono spente, e allora non c'e'
   * nessun limite — tutto come ieri. E nemmeno quando contano solo
   * nell'iPhone: li' il lucchetto lo mette l'app, e la casa resta aperta a
   * Android, al browser e ai telefoni da fuori. */
  get limitata() {
    return this.attive && !this.soloSullIPhone && !this.premium;
  }

  /* Il gettone da dare al centralino: quello di gdahome, cosi' com'e'. Lo
   * verifica lui con la sua chiave, e un gettone scaduto lo butta lui. */
  get gettonePerIlCentralino() {
    const gettone = this.gettoni.gdahome;
    return typeof gettone === "string" ? gettone : "";
  }

  /* Com'e' messa questa casa, per l'app (`ponte/licenza/stato`) e per la
   * console. La forma e' quella del contratto — `{gdahome: {attiva, scade,
   * origine}, gdanav: {…}, gettoni: {…}}` — con due righe in piu' che servono a
   * chi guarda: se le licenze sono accese, e com'e' andata l'ultima domanda. */
  stato() {
    const una = (app) => {
      const valido = this._valido(app);
      return {
        attiva: Boolean(valido),
        scade: valido ? (valido.scade ?? null) : null,
        origine: valido ? String(valido.origine || "") || null : null,
        /* Fino a quando vale **questo** gettone: dopo si rinnova da se'. */
        fino: valido ? valido.fino : null,
        /* Se e' gdanav compreso in gdahome: l'app lo scrive diverso. */
        ...(app === "gdanav" && valido ? { compresa: valido.app === "gdahome" } : {}),
      };
    };
    const gettoni = {};
    for (const app of APP) {
      if (typeof this.gettoni[app] === "string") gettoni[app] = this.gettoni[app];
    }
    return {
      attive: this.attive,
      /* Se la casa si sta limitando davvero, e se le licenze contano solo
       * nell'app per iPhone: la console scrive «Base» in due modi diversi. */
      limitata: this.limitata,
      soloSullIPhone: this.attive && this.soloSullIPhone,
      casa: this.casa,
      gdahome: una("gdahome"),
      gdanav: una("gdanav"),
      gettoni,
      licenze: Array.isArray(this._memoria.dati?.licenze) ? this._memoria.dati.licenze : [],
      ultima: this._esito,
    };
  }

  /* ─── L'orologio ───────────────────────────────────────────────────────── */

  parti() {
    if (!this.attive) {
      this.registro.debug?.("licenze spente: nessuna chiave, nessuna domanda al quadro");
      return;
    }
    if (this._orologio) return;
    void this.rinnova();
    this._orologio = setInterval(() => void this.rinnova(), this.ogni);
    this._orologio.unref?.();
  }

  ferma() {
    clearInterval(this._orologio);
    this._orologio = null;
  }

  /* ─── Le tre domande al quadro ─────────────────────────────────────────── */

  /** Chiede i gettoni di questa casa. Non solleva mai: un giro andato male
   * lascia quelli che c'erano. */
  async rinnova() {
    if (!this.attive) return this.stato();
    /* Due giri insieme — l'orologio e un codice appena riscattato — sarebbero
     * due risposte che si scavalcano: si aspetta quello in corso. */
    if (this._inCorso) return this._inCorso;
    this._inCorso = (async () => {
      try {
        await this._chiedi("/v1/licenze/casa", {});
      } catch (errore) {
        this.registro.attenzione(`licenze: ${errore?.message || errore}`);
      } finally {
        this._inCorso = null;
      }
      return this.stato();
    })();
    return this._inCorso;
  }

  /** Una ricevuta del negozio, girata al quadro che la controlla. */
  async negozio({ app, piattaforma, prodotto, ricevuta } = {}) {
    this._servonoLeLicenze();
    if (!APP.includes(app)) throw new LicenzaNo("app-sconosciuta", "quale app?");
    if (!PIATTAFORME.has(piattaforma)) {
      throw new LicenzaNo("piattaforma-sconosciuta", "la piattaforma e' android o ios");
    }
    if (typeof prodotto !== "string" || !prodotto.trim() || prodotto.length > 200) {
      throw new LicenzaNo("prodotto-sconosciuto", "quale prodotto?");
    }
    if (typeof ricevuta !== "string" || !ricevuta.trim() || ricevuta.length > 64 * 1024) {
      throw new LicenzaNo("ricevuta-mancante", "manca la ricevuta del negozio");
    }
    await this._chiedi("/v1/licenze/negozio", {
      app,
      piattaforma,
      prodotto: prodotto.trim(),
      ricevuta,
    });
    return this.stato();
  }

  /** Un codice regalo, riscattato per questa casa. */
  async riscatta(scritto) {
    this._servonoLeLicenze();
    const codice = codiceRegaloPulito(scritto);
    if (!codice) {
      throw new LicenzaNo("codice-storto", "un codice regalo e' fatto cosi': GDA-XXXX-XXXX-XXXX");
    }
    await this._chiedi("/v1/licenze/riscatta", { codice });
    this.registro.info("un codice regalo e' stato riscattato per questa casa");
    return this.stato();
  }

  _servonoLeLicenze() {
    if (!this.attive) {
      throw new LicenzaNo("licenze-spente", "questa versione non ha ancora le licenze accese");
    }
  }

  /* La domanda, la risposta, e i gettoni nuovi sul disco.
   *
   * Solleva un `LicenzaNo` col codice che serve a chi ha chiesto: l'app scrive
   * «codice gia' usato» e «ricevuta non valida» in due modi diversi, e non lo
   * deve indovinare da una frase. */
  async _chiedi(via, corpo) {
    const segreto = this.segreto();
    if (!this.casa || !segreto) {
      throw new LicenzaNo("senza-identita", "questa casa non sa ancora chi e'");
    }
    let risposta;
    try {
      risposta = await this.prendi(`${this.dove}${via}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...corpo, casa: this.casa, segreto }),
        signal: AbortSignal.timeout(ATTESA),
      });
    } catch (errore) {
      const perche = perchePreciso(errore);
      this._esito = { andata: false, quando: this.adesso(), perche };
      throw new LicenzaNo("quadro-irraggiungibile", perche);
    }
    let detto = {};
    try {
      detto = await risposta.json();
    } catch (_errore) {
      detto = {};
    }
    if (!risposta.ok) {
      const codice = codiceDelNo(risposta.status, detto);
      const perche = String(detto?.errore || `il quadro ha risposto ${risposta.status}`);
      /* Un no a un codice o a una ricevuta non e' un quadro che non va: il
       * giro dei gettoni resta com'era. Si segna solo quando era lui. */
      if (via === "/v1/licenze/casa") {
        this._esito = { andata: false, quando: this.adesso(), perche };
      }
      throw new LicenzaNo(codice, perche, risposta.status);
    }
    this._prendi(detto);
    this._esito = { andata: true, quando: this.adesso() };
    return detto;
  }

  /* I gettoni arrivati: si tengono **solo** quelli fatti come gettoni e
   * intestati a questa casa. Uno con la firma sbagliata si tiene lo stesso
   * sul disco — non vale, e `premium` lo dice — ma uno di un'altra casa no:
   * non c'e' nessun motivo perche' finisca qui. */
  _prendi(detto) {
    const arrivati = detto?.gettoni && typeof detto.gettoni === "object" ? detto.gettoni : {};
    const gettoni = {};
    for (const app of APP) {
      const uno = arrivati[app];
      if (typeof uno !== "string") continue;
      if (leggiGettone(uno)?.sog !== this.casa) continue;
      gettoni[app] = uno;
    }
    const licenze = (Array.isArray(detto?.licenze) ? detto.licenze : [])
      .filter((una) => una && typeof una === "object")
      .slice(0, 50)
      .map((una) => ({
        lic: String(una.lic ?? "").slice(0, 80),
        app: String(una.app ?? "").slice(0, 20),
        origine: String(una.origine ?? "").slice(0, 20),
        scade: typeof una.scade === "number" ? una.scade : null,
      }));

    const prima = JSON.stringify(this.gettoni);
    this._memoria.dati = { gettoni, licenze, ricevutiIl: this.adesso() };
    try {
      this._memoria.salva();
    } catch (errore) {
      this.registro.attenzione(`le licenze non si scrivono: ${errore?.message || errore}`);
    }
    if (JSON.stringify(gettoni) !== prima) this._cambiato();
  }

  /* Qualcosa e' cambiato: un gettone nuovo (il rinnovo di ogni sei ore ne
   * porta uno, col suo `fino` spostato in avanti), o la casa e' passata da
   * Base a Premium o indietro. Chi ascolta — il centralino, la console — lo
   * sente qui, una volta. */
  _cambiato() {
    const premium = this.premium;
    if (premium !== this._premiumPrima) {
      this.registro.info(
        premium ? "questa casa e' gdahome Premium" : "questa casa e' tornata gdahome Base",
      );
      this._premiumPrima = premium;
    }
    this.emit("cambio", this.stato());
  }

  /* Il tempo passa anche senza nessuna risposta: un gettone che scade mentre
   * la casa e' senza rete la fa tornare Base senza che arrivi niente. Chi
   * deve saperlo — il centralino — lo sa da se', perche' verifica lui; qui
   * basta che la domanda `premium` guardi l'orologio ogni volta, e lo fa. */
}

/* Il codice di un no del quadro, dal suo stato e da quello che ha scritto. */
function codiceDelNo(stato, detto) {
  const suo = String(detto?.errore || "");
  if (stato === 404) return "codice-inesistente";
  if (stato === 409) return "codice-gia-usato";
  if (stato === 402) return "ricevuta-non-valida";
  if (stato === 503 && suo === "verifica-non-configurata") return "verifica-non-configurata";
  if (stato === 403 || stato === 401) return "non-ti-riconosco";
  if (stato === 429) return "troppe-richieste";
  return "quadro-ha-detto-no";
}
