/* La cartolina: quello che questa casa dice di se' al quadro di chi l'ha
 * installata.
 *
 * Un installatore mette gdahome in quaranta case e poi non ci torna piu'. Il
 * Wi-Fi che cambia, la presa Zigbee che sparisce, Home Assistant fermo a sei
 * mesi fa, il backup che non gira dal giorno dell'installazione: se ne accorge
 * quando squilla il telefono, cioe' quando il cliente e' gia' arrabbiato. La
 * cartolina e' poche righe di numeri che partono da sole, e gli fanno sapere
 * prima.
 *
 * **E' spenta.** Senza un codice nelle opzioni dell'add-on qui non parte
 * niente e non si apre nessuna connessione: questo file, in una casa
 * qualunque, e' codice che non gira.
 *
 * ─── Cosa c'e' dentro, e cosa non ci deve andare ─────────────────────────
 *
 * Numeri, versioni e nomi di processi. La regola si dice cosi': **cosa c'e'
 * nella scatola, non chi ci abita.** «Mosquitto broker» ed `eth0` sono nomi di
 * prodotti e di schede e non dicono niente di nessuno; il nome di un'entita'
 * — `binary_sensor.camera_di_marco_finestra` — dice chi abita in questa casa e
 * in quale stanza dorme, e quello non esce (per questo ci sono le impronte, in
 * `salute.js`).
 *
 * Fuori restano, e vanno lasciati fuori: nomi di entita', nomi di stanze, nomi
 * di persone, stati di sensori, l'SSID del Wi-Fi, l'indirizzo pubblico, la
 * posizione, le foto, la configurazione della plancia, il contenuto delle
 * segnalazioni.
 *
 * L'indirizzo **sulla rete di casa** invece c'e': `192.168.1.50` non
 * identifica nessuno, e a chi ripara queste macchine serve tutti i giorni —
 * «la scatola ha cambiato indirizzo» e' meta' delle telefonate.
 *
 * ─── Il verso ────────────────────────────────────────────────────────────
 *
 * La casa chiama il quadro, sempre. Il quadro non bussa mai e non potrebbe:
 * una casa di gdahome un indirizzo pubblico non ce l'ha, ed e' tutto il punto
 * del ponte. Nessuna porta da aprire, nessun servizio in ascolto: la stessa
 * forma che ha gia' il filo verso il centralino.
 *
 * ─── Dove non passa ──────────────────────────────────────────────────────
 *
 * Non passa dal centralino di gdahome. Quello instrada e non capisce, e c'e'
 * una prova che controlla che non ci sia niente di leggibile in quello che lo
 * attraversa: farci passare un cruscotto renderebbe falsa quella riga, e
 * farebbe di chi mantiene l'app il custode dei dati di case di altri.
 */

import { gliAddon, gliApparati, laMacchina, laRete } from "./ferro.js";
import { ilBackup, leBatterie, leEntita } from "./salute.js";

/* Il nome e il numero, come nell'invito del QR code (`invito.js`): quell'uno
 * e' l'unica cosa che permetta a un quadro vecchio di dire «questo codice
 * viene da un ponte piu' nuovo di me» invece di leggere per meta' qualcosa che
 * non e' piu' quello che crede. */
const NOME = "quadro";
const VERSIONE = 1;
const SEPARATORE = "|";

/** Ogni quanto parte una cartolina, in minuti, quando non si dice altro. */
export const OGNI_DI_SERIE = 15;

/* Sotto questo non si scende: una casa che parla ogni mezzo minuto e' una
 * casa che scalda una macchina per niente, e quaranta case cosi' sono un
 * quadro che non sta in piedi. */
const OGNI_AL_MINIMO = 5;
const OGNI_AL_MASSIMO = 24 * 60;

/** Quanto si aspetta il quadro prima di lasciar perdere. */
const ATTESA = 10_000;

/* Quanto si aspetta prima della prima cartolina. Non zero: all'accensione
 * dell'add-on Home Assistant sta spesso ancora partendo, e una cartolina
 * spedita adesso direbbe che in questa casa non c'e' niente. */
const PRIMA_ASPETTA = 30_000;

/* Quando il quadro non risponde si rallenta invece di insistere: un quadro
 * spento per un giorno non deve prendersi una richiesta ogni quindici minuti
 * da quaranta case. Si raddoppia fino a un tetto, e al primo «va bene» si
 * torna al passo normale. */
const RALLENTA_FINO_A = 8;

export class CodiceIllegibile extends Error {}
export class CodiceTroppoNuovo extends Error {}

/**
 * Il codice del quadro, come si incolla nella scheda dell'add-on.
 *
 *     quadro|1|https://quadro.impiantirossi.it|K7M2-9XQF-3BHT-R4VN
 *
 * Una riga sola e leggibile, non un blocco di base64: quando qualcosa non va,
 * la prima domanda e' «cosa ci hai incollato?», e a quella si deve poter
 * rispondere leggendo. Dentro ci stanno tutt'e due le cose che servono —
 * **dove** chiamare e **con che** presentarsi — perche' due caselle da
 * riempire giuste sono due caselle da sbagliare.
 *
 * Non e' un indirizzo web apposta, come per l'invito del QR code: un
 * `https://…` incollato dove non deve promette qualcosa che non puo'
 * mantenere.
 */
export function leggiIlCodice(scritto) {
  const testo = String(scritto ?? "").trim();
  if (!testo) return null;

  const pezzi = testo.split(SEPARATORE);
  if (pezzi[0] !== NOME) {
    throw new CodiceIllegibile("questo non e' un codice del quadro");
  }
  const numero = Number(pezzi[1]);
  if (!Number.isInteger(numero) || numero < 1) {
    throw new CodiceIllegibile("questo non e' un codice del quadro");
  }
  if (numero > VERSIONE) {
    throw new CodiceTroppoNuovo("questo codice viene da un quadro piu' nuovo di questo ponte");
  }

  const dove = (pezzi[2] ?? "").trim().replace(/\/+$/, "");
  const chiave = (pezzi[3] ?? "").trim();
  if (!/^https:\/\/[^\s/]+/.test(dove)) {
    /* Solo `https`. Non e' pignoleria: dentro la cartolina c'e' come sta la
     * casa di qualcuno, e su `http` la legge chiunque stia in mezzo. */
    throw new CodiceIllegibile("l'indirizzo del quadro deve cominciare per https://");
  }
  if (chiave.length < 8) {
    throw new CodiceIllegibile("in questo codice manca la chiave");
  }
  return { dove, chiave };
}

/** Ogni quanto, tenuto dentro i limiti. */
export function ogniQuanto(detto, difetto = OGNI_DI_SERIE) {
  const quanti = Number(detto);
  if (!Number.isFinite(quanti)) return difetto;
  return Math.min(OGNI_AL_MASSIMO, Math.max(OGNI_AL_MINIMO, Math.round(quanti)));
}

/**
 * Il foglio, da quello che il ponte sa gia'.
 *
 * Nessuna rete qui dentro, e nessun orologio che non sia quello che gli si
 * passa: si prova tutto senza Home Assistant, senza Supervisor e senza nessun
 * quadro acceso, che e' il motivo per cui questa funzione sta da sola.
 *
 * Quello che arriva `null` o mancante resta fuori dal foglio invece di
 * diventare uno zero: **zero e' un'informazione, e dirla quando non si sa e'
 * una bugia.** Una casa senza System Monitor non ha la CPU allo zero per
 * cento; non ce l'ha, e il quadro lo dice con quelle parole.
 */
export function compila({
  casa,
  ogni = OGNI_DI_SERIE,
  versioni = {},
  macchina = null,
  rete = null,
  apparati = null,
  addon = null,
  aggiornamenti = null,
  plance = null,
  telefoni = null,
  fuori = null,
  entita = null,
  batterie = null,
  backup = null,
  registro = null,
  adesso = () => Date.now(),
} = {}) {
  const foglio = {
    casa: String(casa ?? ""),
    quando: new Date(adesso()).toISOString(),
    ogni: ogniQuanto(ogni),
    ponte: String(versioni.ponte ?? ""),
    plancia: String(versioni.plancia ?? ""),
    ha: String(versioni.ha ?? ""),
    supervisor: String(versioni.supervisor ?? ""),
    sistema: String(versioni.sistema ?? ""),
  };
  /* Le parti che possono mancare si aggiungono solo se ci sono. Un Supervisor
   * che non ha risposto lascia la cartolina senza `macchina`, e il quadro lo
   * sa leggere: «questa casa non lo dice» e' una risposta, `0` no. */
  const forse = {
    macchina,
    rete,
    addon,
    aggiornamenti,
    plance,
    telefoni,
    fuori,
    entita,
    batterie,
    backup,
    registro,
  };
  for (const [nome, cosa] of Object.entries(forse)) {
    if (cosa !== null && cosa !== undefined) foglio[nome] = cosa;
  }
  /* Gli apparati di rete stanno dentro `rete`, dove li cerca chi legge: sono
   * la stessa domanda — «questa casa e' collegata?» — vista da un'altra
   * parte. */
  if (foglio.rete && apparati) foglio.rete = { ...foglio.rete, sorvegliate: apparati };
  return foglio;
}

/**
 * Da dove viene ogni numero.
 *
 * E' l'unico posto che lo sa, ed e' fatto apposta: `compila` non conosce
 * nessuno, `salute.js` e `ferro.js` leggono e basta, e il postino porta senza
 * guardare dentro. Qui si mettono insieme, e se un giorno un numero cambia
 * sorgente si cambia una riga sola.
 *
 * Torna **una funzione**, non un foglio: il postino la chiama a ogni giro, e
 * cosi' ogni cartolina e' di adesso invece che di quando il ponte si e'
 * acceso.
 *
 * Quello che non risponde non ferma niente. Una casa senza Supervisor manda
 * una cartolina senza la macchina; una con Home Assistant giu' la manda senza
 * le entita'. **Mezza cartolina e' un'informazione — anzi, quel giorno e' la
 * piu' importante che ci sia.**
 */
export function fabbricaLaCartolina({
  identita,
  casa,
  ferro,
  aggiornamenti = null,
  plance = null,
  configurazione = null,
  dispositivi = null,
  chiamata = null,
  versioni = {},
  ogni = OGNI_DI_SERIE,
  apparatiScelti = () => [],
  registro,
  adesso = () => Date.now(),
}) {
  const zitto = registro ?? { debug() {}, info() {}, attenzione() {}, errore() {} };

  /* Ognuna di queste va per conto suo: una che cade lascia fuori il suo pezzo
   * e non porta via le altre. */
  const forse = async (che, cosa) => {
    try {
      return await cosa();
    } catch (errore) {
      zitto.debug(`la cartolina resta senza ${che}: ${errore?.message || errore}`);
      return null;
    }
  };

  return async () => {
    const [detto, stati, daFare] = await Promise.all([
      forse("il ferro", () => ferro.chiedi()),
      forse("le entita'", () => casa.chiedi({ type: "get_states" })),
      aggiornamenti ? forse("gli aggiornamenti", () => aggiornamenti.elenco()) : null,
    ]);
    const quelli = Array.isArray(stati) ? stati : null;

    return compila({
      casa: identita.casa,
      ogni,
      adesso,
      versioni: {
        ...versioni,
        ha: detto?.core?.version ?? versioni.ha ?? "",
        supervisor: detto?.supervisor?.version ?? "",
        sistema: detto?.os?.version
          ? `Home Assistant OS ${detto.os.version}`
          : (detto?.host?.operating_system ?? ""),
      },
      macchina: detto
        ? laMacchina({ os: detto.os, host: detto.host, stati: quelli ?? [], adesso })
        : null,
      rete: detto?.network
        ? laRete({ network: detto.network, filoSu: chiamata?.accesa === true })
        : null,
      apparati: quelli ? gliApparati(quelli, { scelte: apparatiScelti() }) : null,
      addon: detto ? gliAddon({ addons: detto.addons }) : null,
      aggiornamenti: daFare ? iConti(daFare) : null,
      plance: plance ? lePlance(plance, configurazione) : null,
      telefoni: dispositivi ? iTelefoni(dispositivi, adesso) : null,
      fuori: chiamata ? { acceso: Boolean(chiamata.dove), filo: chiamata.accesa === true } : null,
      entita: quelli ? leEntita(quelli, { sale: identita.sale }) : null,
      batterie: quelli ? leBatterie(quelli) : null,
      backup: quelli ? ilBackup(quelli, { adesso }) : null,
    });
  };
}

/* Quanti aggiornamenti aspettano, e di che razza. Le voci arrivano gia' fatte
 * da `aggiornamentiDaFare`, che e' lo stesso elenco che vede chi apre l'app:
 * chi guarda il quadro e chi guarda la casa non devono contare due numeri
 * diversi. */
function iConti(daFare) {
  const elenco = Array.isArray(daFare) ? daFare : [];
  const suo = (uno) => /home.?assistant/i.test(String(uno.nome ?? ""));
  return {
    quanti: elenco.length,
    ha: elenco.some(suo),
    gdahome: elenco.some((uno) => uno.nostra === true),
    /* Quello che non si installa da se' e' un firmware: si porta col
     * cacciavite, e vederlo contato a parte dice all'installatore se gli
     * conviene mettersi in macchina. */
    firmware: elenco.filter((uno) => uno.installabile !== true).length,
    addon: elenco.filter((uno) => uno.installabile === true && !uno.nostra && !suo(uno)).length,
    elenco: elenco.map((uno) => ({
      nome: String(uno.nome ?? ""),
      da: String(uno.da ?? ""),
      a: String(uno.a ?? ""),
      nostra: uno.nostra === true,
      installabile: uno.installabile === true,
      stacca: uno.stacca === true,
    })),
  };
}

/* Quante plance ci sono, e quante hanno qualcosa dentro. Una plancia vuota e'
 * un impianto lasciato a meta', ed e' una delle spunte del collaudo. */
function lePlance(plance, configurazione) {
  const elenco = typeof plance.elenco === "function" ? plance.elenco() : [];
  if (!configurazione) return { quante: elenco.length, configurate: 0 };
  const configurate = elenco.filter((una) => {
    try {
      const dentro = configurazione.leggi(una.profilo);
      return Boolean(dentro && Object.keys(dentro).length);
    } catch (_errore) {
      return false;
    }
  }).length;
  return { quante: elenco.length, configurate };
}

/* Quanti telefoni sono abbinati, e quanti si sono fatti vedere in una
 * settimana. Il secondo numero conta piu' del primo: e' quello che dice se
 * l'app in quella casa la usa qualcuno o se e' stata provata una volta e
 * basta. */
function iTelefoni(dispositivi, adesso) {
  const elenco = typeof dispositivi.elenco === "function" ? dispositivi.elenco() : [];
  const settimana = adesso() - 7 * 24 * 60 * 60 * 1000;
  return {
    abbinati: elenco.length,
    visti7gg: elenco.filter((uno) => Number(uno.vistoIl || 0) >= settimana).length,
  };
}

/**
 * Il postino: l'orologio, e un tentativo che se fallisce rallenta.
 *
 * Non sa cosa ci sia in una cartolina: gliela fabbrica `fabbrica`, e lui la
 * porta. Cosi' questa classe si prova con una funzione che torna `{}` e una
 * `fetch` finta, senza montare mezzo ponte.
 */
export class Postino {
  constructor({
    dove = "",
    chiave = "",
    casa = "",
    ogni = OGNI_DI_SERIE,
    fabbrica,
    fetch: prendi = globalThis.fetch,
    registro,
    adesso = () => Date.now(),
    primaAspetta = PRIMA_ASPETTA,
  } = {}) {
    this.dove = String(dove || "").replace(/\/+$/, "");
    this.chiave = String(chiave || "");
    this.casa = String(casa || "");
    this.ogni = ogniQuanto(ogni);
    this.fabbrica = fabbrica;
    this.prendi = prendi;
    this.registro = registro ?? { debug() {}, info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this.primaAspetta = primaAspetta;

    this._orologio = null;
    this._quanteVoltePerNiente = 0;
    /* L'ultima cartolina spedita, in chiaro, e com'e' andata. Sono le due cose
     * che la console dell'add-on fa leggere a chi ci abita: non «manda dei
     * dati», ma **questi** dati, parola per parola. */
    this._ultima = null;
    this._ultimoEsito = null;
  }

  /** Se questa casa manda qualcosa a qualcuno. */
  get acceso() {
    return Boolean(this.dove && this.chiave && this.casa);
  }

  get ultima() {
    return this._ultima;
  }

  get ultimoEsito() {
    return this._ultimoEsito;
  }

  parti() {
    if (!this.acceso || this._orologio) return;
    this.registro.info(`la cartolina va a ${this.dove}, ogni ${this.ogni} minuti`);
    const giro = () => {
      void this.manda();
      this._riarma();
    };
    this._orologio = setTimeout(giro, this.primaAspetta);
    this._orologio.unref?.();
  }

  ferma() {
    if (this._orologio) clearTimeout(this._orologio);
    this._orologio = null;
  }

  _riarma() {
    if (!this._orologio) return;
    const quanto =
      this.ogni * 60 * 1000 * Math.min(RALLENTA_FINO_A, 2 ** this._quanteVoltePerNiente);
    this._orologio = setTimeout(() => {
      void this.manda();
      this._riarma();
    }, quanto);
    this._orologio.unref?.();
  }

  /** Una cartolina, adesso. Torna `true` se e' arrivata. */
  async manda() {
    if (!this.acceso) return false;
    let foglio;
    try {
      foglio = await this.fabbrica();
    } catch (errore) {
      /* Una cartolina che non si riesce a compilare non e' un guasto del
       * quadro: si dice e si riprova al giro dopo, senza rallentare. */
      this._ultimoEsito = {
        andata: false,
        quando: this.adesso(),
        perche: String(errore?.message || errore),
      };
      this.registro.attenzione(
        `la cartolina non si e' potuta compilare: ${errore?.message || errore}`,
      );
      return false;
    }
    this._ultima = foglio;

    try {
      const risposta = await this.prendi(`${this.dove}/cartolina`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          /* La chiave in testa e non nel corpo: cosi' non finisce dentro
           * quello che la console fa leggere a chi ci abita. */
          authorization: `Bearer ${this.chiave}`,
          "x-casa": this.casa,
        },
        body: JSON.stringify(foglio),
        signal: AbortSignal.timeout(ATTESA),
      });
      if (!risposta.ok) {
        this._perNiente(`il quadro ha risposto ${risposta.status}`);
        return false;
      }
      if (this._quanteVoltePerNiente) {
        this.registro.info("il quadro risponde di nuovo");
        this._quanteVoltePerNiente = 0;
      }
      this._ultimoEsito = { andata: true, quando: this.adesso(), perche: "" };
      return true;
    } catch (errore) {
      this._perNiente(String(errore?.message || errore));
      return false;
    }
  }

  _perNiente(perche) {
    this._ultimoEsito = { andata: false, quando: this.adesso(), perche };
    /* Detto una volta, non a ogni giro: un quadro spento per un giorno
     * riempirebbe il registro dell'add-on di novantasei righe uguali, e un
     * registro che si ripete e' un registro che non si legge piu'. */
    if (!this._quanteVoltePerNiente) this.registro.attenzione(`la cartolina non arriva: ${perche}`);
    this._quanteVoltePerNiente += 1;
  }
}
