/* Le licenze: chi e' Premium, da quando, fino a quando, e perche'.
 *
 * Il contratto sta in `docs/LICENZE.md`, e chi tocca questo file lo legge
 * prima. Qui si tengono quattro cose, in un archivio solo:
 *
 *  - le **licenze**: una riga per ogni «questa casa (o questo telefono) e'
 *    Premium», con da dove viene — il negozio, un regalo del gestore, il
 *    pacchetto di un installatore — e quando finisce;
 *  - i **codici regalo**, `GDA-XXXX-XXXX-XXXX`, che diventano una licenza la
 *    volta che qualcuno li riscatta, e poi non valgono piu';
 *  - i **soggetti**: la prima volta che una `casa_…` o un `tel_…` si
 *    presenta, qui resta l'impronta del suo segreto, e da li' in poi entra
 *    solo quel segreto. E' la stessa regola del centralino: nessuno si
 *    iscrive, e nessuno puo' farsi passare per un altro dopo;
 *  - i **pacchetti** degli installatori: quante licenze gdahome e quante
 *    gdanav il gestore gli ha dato da regalare, e di che durata.
 *
 * ─── Il gettone ──────────────────────────────────────────────────────────
 *
 * Il quadro firma, tutti gli altri verificano con la pubblica scritta nel
 * loro codice. La privata sta **solo** qui, in `QUADRO_LICENZE_CHIAVE`: il `d`
 * di una JWK Ed25519, trentadue byte in base64url. Senza, questo file non
 * firma niente e le vie delle licenze rispondono 503: meglio un no chiaro che
 * un gettone che nessuno sa verificare.
 *
 * Un gettone vale al massimo **otto giorni** dalla firma, e mai oltre la
 * scadenza della licenza. La casa lo rinnova ogni sei ore: una licenza tolta
 * smette di valere entro otto giorni anche su una casa che non risponde, e una
 * casa senza internet resta Premium per otto giorni.
 *
 * ─── Il pacchetto ────────────────────────────────────────────────────────
 *
 * Come la soglia delle case: e' il server che dice di no. Una licenza data a
 * una casa e un codice generato e non ancora riscattato **consumano** un posto
 * del pacchetto; un codice riscattato diventa una licenza e continua a
 * consumare lo stesso posto, non due. Togliere una licenza, o annullare un
 * codice non ancora usato, lo rimette nel pacchetto.
 *
 * Una licenza a tempo che scade **resta** contata: il posto e' stato usato. Se
 * l'installatore la toglie torna nel pacchetto, ed e' una scelta sua.
 *
 * La durata la decide il gestore, non l'installatore: il pacchetto e', app per
 * app, un conto per ogni durata — `{gdahome: {"1": 10, "12": 5}, gdanav:
 * {"sempre": 2}}`, mesi scritti come stringa oppure "sempre". Ogni «mucchio»
 * (app + durata) si consuma e si riempie da se': la licenza e il codice
 * tengono il loro in `taglio`, e togliendoli il posto torna in quello. La
 * durata comincia quando la licenza si da', o quando il codice si riscatta.
 *
 * Un pacchetto scritto come prima, un numero per app (`gdahome: 5`), si legge
 * come cinque licenze di dodici mesi; una licenza o un codice di un
 * installatore senza `taglio` si conta nei dodici mesi anche lui (il codice,
 * se ha i suoi `mesi`, in quelli).
 *
 * ─── I rinnovi ───────────────────────────────────────────────────────────
 *
 * Una licenza del negozio scade quando finisce il periodo pagato (o la prova
 * gratuita), e un abbonamento si rinnova da se' senza che l'app lo dica a
 * nessuno. Percio' il quadro richiede al negozio (`rinnova`) le licenze che
 * stanno per scadere o sono scadute da poco: quando la casa o il telefono
 * chiedono i gettoni, e ogni ora per tutte. Una volta l'ora al massimo per
 * licenza; se il negozio non risponde si tiene quello che si sapeva, e se dice
 * che e' finito (scaduto, rimborsato) la licenza scade da se'.
 */

import { createHash, createPrivateKey, createPublicKey, randomBytes, randomInt, sign, verify } from "node:crypto";
import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { impronta, stessoSegreto } from "./segreti.js";

/** Le due app che si pagano. */
export const APP = ["gdahome", "gdanav"];

/** Le tre strade da cui arriva una licenza. */
export const ORIGINI = ["negozio", "regalo", "installatore"];

export const CASA = /^casa_[0-9a-f]{32}$/;
export const TELEFONO = /^tel_[0-9a-f]{32}$/;
export const LICENZA = /^lic_[0-9a-f]{16}$/;
export const CODICE = /^GDA-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;

/* L'alfabeto dei codici regalo, quello del contratto: niente 0/O, niente
 * 1/I/L. Un codice si legge da un biglietto e si batte su un telefono. */
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Quanto vale un gettone, al massimo, da quando e' firmato. */
export const OTTO_GIORNI = 8 * 24 * 60 * 60 * 1000;

/** Quanti codici si fanno in una volta, al massimo. */
export const CODICI_AL_MASSIMO = 200;

/** Da quanto prima della scadenza una licenza del negozio si richiede al negozio. */
export const PRIMA_DI_SCADERE = 24 * 60 * 60 * 1000;

/** Fino a quanto dopo la scadenza la si richiede ancora: poi e' finita. */
export const DOPO_SCADUTA = 35 * 24 * 60 * 60 * 1000;

/** Una licenza si richiede al negozio al massimo una volta in questo tempo. */
export const UNA_VOLTA_OGNI = 60 * 60 * 1000;

/** Quanto si aspetta il negozio mentre qualcuno aspetta i suoi gettoni. */
export const ATTESA_DEL_NEGOZIO = 5000;

/** Quanti mesi al massimo per un regalo a tempo: dieci anni. Oltre, «per sempre». */
export const MESI_AL_MASSIMO = 120;

/* I due pezzi fissi che trasformano i trentadue byte grezzi in una chiave che
 * Node sa leggere: l'intestazione DER di una PKCS8 Ed25519 (per la privata) e
 * quella di una SPKI (per la pubblica). Dopo, ci vanno i byte e basta. */
const TESTA_PRIVATA = Buffer.from("302e020100300506032b657004220420", "hex");
const TESTA_PUBBLICA = Buffer.from("302a300506032b6570032100", "hex");

export const base64url = (byte) => Buffer.from(byte).toString("base64url");

/** Un errore con dentro lo stato HTTP e la parola che il contratto dice. */
export class NoLicenza extends Error {
  constructor(stato, errore) {
    super(errore);
    this.stato = stato;
    this.errore = errore;
  }
}

/**
 * La privata dai suoi trentadue byte in base64url, o `null` se non c'e' o non
 * e' buona. Non solleva: un quadro con una chiave storta si accende lo stesso,
 * e dice nel registro che le licenze sono spente.
 */
export function chiavePrivataDa(d) {
  const grezza = Buffer.from(String(d ?? "").trim(), "base64url");
  if (grezza.length !== 32) return null;
  try {
    return createPrivateKey({
      key: Buffer.concat([TESTA_PRIVATA, grezza]),
      format: "der",
      type: "pkcs8",
    });
  } catch (_errore) {
    return null;
  }
}

/** La pubblica grezza (l'`x`) di una privata, in base64url. */
export function laPubblicaDi(privata) {
  const der = createPublicKey(privata).export({ type: "spki", format: "der" });
  return base64url(der.subarray(der.length - 32));
}

/** La pubblica dai suoi trentadue byte, per verificare. */
export function chiavePubblicaDa(x) {
  const grezza = Buffer.from(String(x ?? "").trim(), "base64url");
  if (grezza.length !== 32) return null;
  return createPublicKey({
    key: Buffer.concat([TESTA_PUBBLICA, grezza]),
    format: "der",
    type: "spki",
  });
}

/**
 * Firma un gettone, esattamente come dice il contratto:
 * base64url(payload JSON) + "." + base64url(firma Ed25519 dei byte ASCII del
 * primo pezzo).
 */
export function firmaIlGettone(privata, payload) {
  const primo = base64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const firma = sign(null, Buffer.from(primo, "ascii"), privata);
  return `${primo}.${base64url(firma)}`;
}

/**
 * La verifica, con le regole del contratto: le stesse del ponte, del
 * centralino e delle app. Qui serve alle prove, e a chi volesse controllare un
 * gettone dal terminale. Torna il payload se vale, `null` se no.
 */
export function verificaIlGettone(gettone, pubblicaX, { sog, adesso = Date.now() } = {}) {
  try {
    const [primo, seconda, avanzo] = String(gettone ?? "").split(".");
    if (!primo || !seconda || avanzo !== undefined) return null;
    const pubblica = chiavePubblicaDa(pubblicaX);
    if (!pubblica) return null;
    if (!verify(null, Buffer.from(primo, "ascii"), pubblica, Buffer.from(seconda, "base64url")))
      return null;
    const detto = JSON.parse(Buffer.from(primo, "base64url").toString("utf8"));
    if (detto?.v !== 1) return null;
    if (sog !== undefined && detto.sog !== sog) return null;
    if (!(Number(detto.fino) > adesso)) return null;
    if (!(detto.scade === null || Number(detto.scade) > adesso)) return null;
    return detto;
  } catch (_errore) {
    return null;
  }
}

/** Un codice regalo nuovo, nella forma del contratto. */
export function codiceRegaloNuovo() {
  const gruppo = () => {
    let fuori = "";
    for (let i = 0; i < 4; i += 1) fuori += ALFABETO[randomInt(ALFABETO.length)];
    return fuori;
  };
  return `GDA-${gruppo()}-${gruppo()}-${gruppo()}`;
}

/**
 * Un codice come l'ha battuto qualcuno — minuscolo, con gli spazi, senza
 * trattini, col «GDA» o senza — nella forma in cui e' scritto qui.
 * Una O battuta al posto di uno zero non c'e': lo zero nell'alfabeto non c'e'.
 */
export function codiceRegaloPulito(scritto) {
  let tutto = String(scritto ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
  if (tutto.length === 15 && tutto.startsWith("GDA")) tutto = tutto.slice(3);
  if (tutto.length !== 12) return "";
  const fatto = `GDA-${tutto.slice(0, 4)}-${tutto.slice(4, 8)}-${tutto.slice(8, 12)}`;
  return CODICE.test(fatto) ? fatto : "";
}

/**
 * Quanti mesi, come li ha detti chi chiede: un intero da 1 a 120, oppure
 * `null` — per sempre. Tutto il resto e' un no.
 */
export function iMesi(detti) {
  if (detti === null || detti === undefined || detti === "" || detti === "sempre") return null;
  const n = Number(detti);
  if (!Number.isInteger(n) || n < 1 || n > MESI_AL_MASSIMO) throw new NoLicenza(400, "mesi-non-validi");
  return n;
}

/** Tanti mesi dopo `da`, nel calendario e non a trenta giorni l'uno. */
export function mesiDopo(da, mesi) {
  if (mesi === null) return null;
  const data = new Date(da);
  const giorno = data.getUTCDate();
  data.setUTCDate(1);
  data.setUTCMonth(data.getUTCMonth() + mesi);
  /* Il trentuno gennaio piu' un mese e' il ventotto febbraio, non il tre marzo. */
  const ultimo = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 1, 0)).getUTCDate();
  data.setUTCDate(Math.min(giorno, ultimo));
  return data.getTime();
}

const unaApp = (app) => {
  if (!APP.includes(app)) throw new NoLicenza(400, "app-non-valida");
  return app;
};

const pulisciNota = (nota) =>
  String(nota ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

const numeroNelPacchetto = (quante) => Math.max(0, Math.min(99999, Math.floor(Number(quante) || 0)));

/** Il taglio di chi non l'ha detto: il pacchetto di prima era di dodici mesi. */
export const TAGLIO_DI_PRIMA = "12";

/**
 * Una durata del pacchetto nella sua forma: i mesi come stringa ("12"), da 1 a
 * 120, oppure "sempre". Si accetta anche il numero, e `null` per «per
 * sempre». Tutto il resto e' un 400 `durata-non-valida`.
 */
export function unaDurata(detta) {
  if (detta === null || detta === "sempre") return "sempre";
  const n = typeof detta === "string" && detta.trim() !== "" ? Number(detta) : typeof detta === "number" ? detta : NaN;
  if (!Number.isInteger(n) || n < 1 || n > MESI_AL_MASSIMO) throw new NoLicenza(400, "durata-non-valida");
  return String(n);
}

/** I mesi di una durata: `null` per sempre. */
export const iMesiDelTaglio = (taglio) => (taglio === "sempre" ? null : Number(taglio));

/* Le durate in ordine: la piu' corta prima, «per sempre» in fondo. */
const inOrdine = (a, b) => (a === "sempre" ? Infinity : Number(a)) - (b === "sempre" ? Infinity : Number(b));

/**
 * I conti di una app come li ha scritti chi chiede, nella forma che si tiene:
 * `{"12": 5}`. Si legge un numero (la forma di prima: tanti di dodici mesi),
 * un oggetto `{durata: quante}`, o un elenco `[{durata, totali}]` (quello che
 * torna il GET, rimandato indietro). Le durate ripetute si sommano, gli zeri
 * se ne vanno.
 */
function iContiDetti(detti) {
  const fuori = {};
  const aggiungi = (durata, quante) => {
    const taglio = unaDurata(durata);
    const n = numeroNelPacchetto(quante);
    if (n) fuori[taglio] = numeroNelPacchetto((fuori[taglio] || 0) + n);
  };
  if (detti === null || detti === undefined) return fuori;
  if (typeof detti === "number" || typeof detti === "string") aggiungi(TAGLIO_DI_PRIMA, detti);
  else if (Array.isArray(detti)) for (const riga of detti) aggiungi(riga?.durata, riga?.totali ?? riga?.quante);
  else if (typeof detti === "object") for (const [durata, quante] of Object.entries(detti)) aggiungi(durata, quante);
  else throw new NoLicenza(400, "pacchetto-non-valido");
  return fuori;
}

/**
 * Un pacchetto detto dal gestore, controllato e messo in forma: solo le app
 * che nomina, ognuna con i suoi conti. Solleva 400 se qualcosa non va, prima
 * che si tocchi niente.
 */
export function ilPacchettoDetto(detto) {
  if (!detto || typeof detto !== "object" || Array.isArray(detto)) throw new NoLicenza(400, "pacchetto-non-valido");
  const fuori = {};
  for (const app of APP) if (detto[app] !== undefined) fuori[app] = iContiDetti(detto[app]);
  return fuori;
}

export class Licenze {
  /**
   * @param {object} opzioni
   * @param {string} opzioni.cartella dove sta l'archivio
   * @param {string} opzioni.chiave il `d` della privata, in base64url; vuoto spegne tutto
   */
  constructor({ cartella = "./dati", chiave = "", adesso = () => Date.now() } = {}) {
    this.adesso = adesso;
    this.privata = chiavePrivataDa(chiave);
    this.pubblica = this.privata ? laPubblicaDi(this.privata) : "";
    this.archivio = new Archivio(join(cartella, "licenze.json"), {
      licenze: [],
      codici: [],
      soggetti: {},
      pacchetti: {},
    });
  }

  /** Se questo quadro sa firmare. Senza, le vie rispondono 503. */
  get accese() {
    return Boolean(this.privata);
  }

  get licenze() {
    return this.archivio.dati.licenze;
  }

  get codici() {
    return this.archivio.dati.codici;
  }

  quella(lic) {
    return this.licenze.find((una) => una.lic === lic) ?? null;
  }

  /* ─── Chi bussa ────────────────────────────────────────────────────── */

  /**
   * La prima volta si tiene l'impronta del segreto; dopo, entra solo quel
   * segreto. Torna il soggetto, o solleva: 400 per una forma sbagliata, 403
   * per un segreto che non e' quello della prima volta.
   *
   * Il confronto si fa sempre sulle impronte e con `stessoSegreto`, mai con
   * `===`: il tempo di un confronto che si ferma alla prima lettera diversa
   * dice quante lettere erano giuste.
   */
  riconosci(sog, segreto, forma = null) {
    const chi = String(sog ?? "");
    const buona = forma ? forma.test(chi) : CASA.test(chi) || TELEFONO.test(chi);
    if (!buona) throw new NoLicenza(400, "soggetto-non-valido");
    const detto = String(segreto ?? "");
    if (detto.length < 16 || detto.length > 512) throw new NoLicenza(400, "segreto-non-valido");
    const suo = this.archivio.dati.soggetti[chi];
    const segno = impronta(detto);
    if (!suo) {
      this.archivio.dati.soggetti[chi] = { impronta: segno, da: this.adesso() };
      this.archivio.salva();
      return chi;
    }
    if (!stessoSegreto(suo.impronta, segno)) throw new NoLicenza(403, "segreto-sbagliato");
    return chi;
  }

  /* ─── Quello che si risponde a chi chiede ────────────────────────────── */

  /** Se una licenza vale adesso: non tolta, e non scaduta. */
  vale(una, ora = this.adesso()) {
    return Boolean(una) && !una.revocata && (una.scade === null || una.scade > ora);
  }

  /**
   * La risposta del contratto per un soggetto: i gettoni e le licenze che
   * valgono adesso.
   *
   * Per ogni app si firma **una** licenza, quella che dura di piu' — «per
   * sempre» batte qualunque data. Una casa con gdahome ha il gettone gdahome
   * e basta: gdanav lo capisce da se' (un gettone gdahome vale anche per
   * gdanav), e un secondo gettone uguale sarebbe una cosa in piu' da tenere
   * allineata.
   */
  perIlSoggetto(sog) {
    if (!this.accese) throw new NoLicenza(503, "licenze-non-configurate");
    const ora = this.adesso();
    const sue = this.licenze.filter((una) => una.sog === sog && this.vale(una, ora));
    const gettoni = {};
    for (const app of APP) {
      const migliore = sue
        .filter((una) => una.app === app)
        .sort((a, b) => (a.scade === null ? Infinity : a.scade) - (b.scade === null ? Infinity : b.scade))
        .at(-1);
      if (migliore) gettoni[app] = this.gettone(migliore, ora);
    }
    return {
      gettoni,
      licenze: sue.map((una) => ({
        lic: una.lic,
        app: una.app,
        origine: una.origine,
        scade: una.scade,
        prova: Boolean(una.prova),
      })),
    };
  }

  /**
   * Il gettone di una licenza, firmato adesso. `prova` c'e' solo quando e'
   * vero: chi verifica i campi che non conosce li lascia stare.
   */
  gettone(una, ora = this.adesso()) {
    const fino = una.scade === null ? ora + OTTO_GIORNI : Math.min(ora + OTTO_GIORNI, una.scade);
    return firmaIlGettone(this.privata, {
      v: 1,
      app: una.app,
      sog: una.sog,
      lic: una.lic,
      origine: una.origine,
      scade: una.scade,
      fino,
      emesso: ora,
      ...(una.prova ? { prova: true } : {}),
    });
  }

  /* ─── Fare, e togliere ──────────────────────────────────────────────── */

  _nuova({ app, sog, origine, installatore = null, scade, nota = "", ...altro }) {
    const una = {
      lic: `lic_${randomBytes(8).toString("hex")}`,
      app,
      sog,
      origine,
      ...(installatore ? { installatore } : {}),
      scade,
      creata: this.adesso(),
      revocata: null,
      nota: pulisciNota(nota),
      ...altro,
    };
    this.licenze.push(una);
    return una;
  }

  /**
   * Un regalo a una casa, dal gestore o da un installatore.
   *
   * Il pacchetto lo guarda chi chiama con `installatore`: qui dentro, perche'
   * il conto e il posto preso devono essere la stessa operazione — due
   * richieste insieme non devono passare tutte e due sull'ultimo posto.
   */
  regala({ app, casa, mesi = null, durata, nota = "", installatore = null }) {
    unaApp(app);
    if (!CASA.test(String(casa ?? ""))) throw new NoLicenza(400, "casa-non-valida");
    /* L'installatore non sceglie i mesi: sceglie una durata del suo pacchetto. */
    const taglio = installatore ? this._durataChiesta(durata) : null;
    const quanti = installatore ? iMesiDelTaglio(taglio) : iMesi(mesi);
    if (installatore) this._cePosto(installatore, app, taglio);
    const una = this._nuova({
      app,
      sog: casa,
      origine: installatore ? "installatore" : "regalo",
      installatore,
      scade: mesiDopo(this.adesso(), quanti),
      nota,
      ...(taglio ? { taglio } : {}),
    });
    this.archivio.salva();
    return una;
  }

  /**
   * Toglie una licenza. Con `installatore`, solo se e' sua: «non e' tua» e
   * «non c'e'» si dicono uguale. Se veniva da un pacchetto, il posto torna.
   */
  togli(lic, { installatore = null } = {}) {
    const una = this.quella(lic);
    if (!una || una.revocata) return null;
    if (installatore && una.installatore !== installatore) return null;
    una.revocata = this.adesso();
    this.archivio.salva();
    return una;
  }

  /* ─── I codici regalo ───────────────────────────────────────────────── */

  /** Uno o piu' codici. Con `installatore`, uno per posto libero. */
  generaCodici({ app, quanti = 1, mesi = null, durata, nota = "", installatore = null }) {
    unaApp(app);
    const taglio = installatore ? this._durataChiesta(durata) : null;
    const mesiBuoni = installatore ? iMesiDelTaglio(taglio) : iMesi(mesi);
    const n = Math.floor(Number(quanti));
    if (!Number.isInteger(n) || n < 1 || n > CODICI_AL_MASSIMO) throw new NoLicenza(400, "quanti-non-valido");
    if (installatore) this._cePosto(installatore, app, taglio, n);
    const fatti = [];
    const gia = new Set(this.codici.map((uno) => uno.codice));
    while (fatti.length < n) {
      const codice = codiceRegaloNuovo();
      if (gia.has(codice)) continue;
      gia.add(codice);
      const uno = {
        codice,
        app,
        mesi: mesiBuoni,
        origine: installatore ? "installatore" : "regalo",
        ...(installatore ? { installatore, taglio } : {}),
        nota: pulisciNota(nota),
        creato: this.adesso(),
        usatoDa: null,
        usatoIl: null,
        lic: null,
        annullato: null,
      };
      this.codici.push(uno);
      fatti.push(uno);
    }
    this.archivio.salva();
    return fatti;
  }

  /** Annulla un codice non ancora usato. Il posto, se era di un pacchetto, torna. */
  annullaCodice(codice, { installatore = null } = {}) {
    const pulito = codiceRegaloPulito(codice);
    const uno = this.codici.find((altro) => altro.codice === pulito);
    if (!uno || uno.usatoDa || uno.annullato) return null;
    if (installatore && uno.installatore !== installatore) return null;
    uno.annullato = this.adesso();
    this.archivio.salva();
    return uno;
  }

  /**
   * Riscatta un codice per un soggetto gia' riconosciuto.
   *
   * Una volta sola: 404 un codice che non c'e' (o annullato), 409 uno gia'
   * usato. Se lo ripresenta **lo stesso** soggetto che l'ha usato, pero', non
   * e' un errore: e' un'app che ha perso la risposta e riprova, e le si
   * risponde come la prima volta.
   *
   * Un codice gdahome e' della casa, un codice gdanav del telefono: dall'app
   * sbagliata si dice di no prima di bruciarlo.
   */
  riscatta(codice, sog) {
    const pulito = codiceRegaloPulito(codice);
    const uno = pulito ? this.codici.find((altro) => altro.codice === pulito) : null;
    if (!uno || uno.annullato) throw new NoLicenza(404, "codice-inesistente");
    if (uno.usatoDa) {
      if (uno.usatoDa === sog) return this.quella(uno.lic);
      throw new NoLicenza(409, "codice-gia-usato");
    }
    if (uno.app === "gdahome" && !CASA.test(sog)) throw new NoLicenza(400, "codice-per-la-casa");
    if (uno.app === "gdanav" && !TELEFONO.test(sog)) throw new NoLicenza(400, "codice-per-il-telefono");
    const una = this._nuova({
      app: uno.app,
      sog,
      origine: uno.origine,
      installatore: uno.installatore || null,
      scade: mesiDopo(this.adesso(), uno.mesi ?? null),
      nota: uno.nota,
      codice: uno.codice,
      /* Il posto preso dal codice resta quello: la licenza lo eredita. */
      ...(uno.installatore ? { taglio: this._taglioDi(uno) } : {}),
    });
    uno.usatoDa = sog;
    uno.usatoIl = this.adesso();
    uno.lic = una.lic;
    this.archivio.salva();
    return una;
  }

  /* ─── Il negozio ────────────────────────────────────────────────────── */

  /**
   * Una ricevuta controllata con Google o Apple diventa (o aggiorna) una
   * licenza.
   *
   * Un acquisto e' **una** licenza, riconosciuta dall'impronta del suo
   * identificativo (il token di Google, la transazione originale di Apple):
   * rinnovi e ripristini aggiornano la stessa riga invece di farne una
   * nuova. Se lo stesso acquisto arriva da un'altra casa, la licenza si
   * **sposta** li': un abbonamento vale per una casa alla volta, e chi cambia
   * casa se lo porta dietro.
   *
   * `prima` e' l'identificativo dell'acquisto che questo ha sostituito
   * (`linkedPurchaseToken` di Google, per un cambio di piano): la riga e'
   * quella, e passa al nuovo.
   *
   * `ricevuta` e' quello che serve per richiederlo al negozio piu' avanti
   * (`Negozi.ricontrolla`): resta in `negozio.ricevuta`.
   */
  dalNegozio({ app, sog, scade, acquisto, prima = null, piattaforma, prodotto, prova = false, ricevuta = null }) {
    unaApp(app);
    const chiave = createHash("sha256").update(`${piattaforma}:${acquisto}`).digest("hex");
    const vecchia = prima ? createHash("sha256").update(`${piattaforma}:${prima}`).digest("hex") : null;
    let una =
      this.licenze.find((altra) => altra.negozio?.chiave === chiave) ??
      (vecchia ? this.licenze.find((altra) => altra.negozio?.chiave === vecchia) : null) ??
      null;
    if (!una) {
      una = this._nuova({
        app,
        sog,
        origine: "negozio",
        scade,
        nota: `${piattaforma} · ${prodotto}`,
        negozio: { chiave, piattaforma, prodotto, ...(ricevuta ? { ricevuta } : {}) },
      });
    } else {
      una.sog = sog;
      una.app = app;
      una.scade = scade;
      una.negozio = { chiave, piattaforma, prodotto, ...(ricevuta ? { ricevuta } : {}) };
      una.visto = this.adesso();
    }
    una.prova = Boolean(prova);
    una.ricontrollata = this.adesso();
    this.archivio.salva();
    return una;
  }

  /* ─── I rinnovi ─────────────────────────────────────────────────────── */

  /**
   * Le licenze del negozio da richiedere adesso: con quello che serve per
   * chiederle, non tolte, che scadono entro un giorno o sono scadute da meno
   * di trentacinque, e non richieste nell'ultima ora. Con `sog`, solo le sue.
   */
  daRicontrollare({ sog = null, ora = this.adesso() } = {}) {
    return this.licenze.filter(
      (una) =>
        una.origine === "negozio" &&
        !una.revocata &&
        una.negozio?.ricevuta &&
        una.scade !== null &&
        (sog === null || una.sog === sog) &&
        una.scade - ora <= PRIMA_DI_SCADERE &&
        ora - una.scade < DOPO_SCADUTA &&
        !(una.ricontrollata && ora - una.ricontrollata < UNA_VOLTA_OGNI),
    );
  }

  /**
   * Richiede al negozio le licenze di `daRicontrollare`. Non solleva mai:
   * chi chiede i gettoni li riceve comunque, con quello che si sapeva.
   *
   * - una risposta buona sposta la scadenza **avanti** (mai indietro) e
   *   aggiorna la prova gratuita;
   * - `RicevutaNonValida` (scaduto, rimborsato): si lascia com'e', e scade
   *   da se';
   * - `NegozioGiu`, o piu' di `attesa` ms: si tiene quello che c'era, e si
   *   riprova fra un'ora. Una risposta che arriva dopo l'attesa vale lo
   *   stesso.
   *
   * Con `sog` le sue, tutte insieme; senza, tutte, una dopo l'altra (il giro
   * di ogni ora, che non ha fretta e non deve bussare a raffica). Torna quante
   * sono state allungate.
   */
  async rinnova(negozi, { sog = null, attesa = ATTESA_DEL_NEGOZIO, registro = null } = {}) {
    const ora = this.adesso();
    const quali = this.daRicontrollare({ sog, ora }).filter((una) =>
      negozi?.configurato?.(una.negozio.piattaforma),
    );
    if (!quali.length) return 0;
    let allungate = 0;
    const richiedi = async (una) => {
      /* Segnata prima di chiedere: due richieste insieme non bussano due volte. */
      una.ricontrollata = ora;
      const lavoro = negozi
        .ricontrolla({ piattaforma: una.negozio.piattaforma, ricevuta: una.negozio.ricevuta })
        .then((esito) => {
          if (this._dalRicontrollo(una, esito)) allungate += 1;
        })
        .catch((errore) => {
          const detto = errore?.errore || errore?.message || String(errore);
          registro?.[errore?.errore ? "info" : "attenzione"]?.(
            `il rinnovo di ${una.lic} non si e' potuto controllare: ${detto}`,
          );
        });
      let timer;
      const scaduto = new Promise((ok) => {
        timer = setTimeout(ok, attesa);
        timer.unref?.();
      });
      await Promise.race([lavoro, scaduto]);
      clearTimeout(timer);
    };
    if (sog !== null) await Promise.all(quali.map(richiedi));
    else for (const una of quali) await richiedi(una);
    this.archivio.salva();
    return allungate;
  }

  /* Quello che il negozio ha detto di una licenza gia' sua. La casa resta
   * quella: un rinnovo non sposta niente. */
  _dalRicontrollo(una, esito) {
    if (!esito || esito.app !== una.app) return false;
    una.prova = Boolean(esito.prova);
    if (esito.prodotto) una.negozio.prodotto = esito.prodotto;
    if (esito.ricevuta) una.negozio.ricevuta = esito.ricevuta;
    const allungata = Number(esito.scade) > (una.scade ?? Infinity);
    if (allungata) una.scade = Number(esito.scade);
    this.archivio.salva();
    return allungata;
  }

  /* ─── Il pacchetto degli installatori ───────────────────────────────── */

  /**
   * I conti dati a un installatore, nella forma che si tiene:
   * `{gdahome: {"12": 5}, gdanav: {}}`. Un numero (la forma di prima) si legge
   * come tante licenze di dodici mesi.
   */
  pacchettoDato(chi) {
    const suo = this.archivio.dati.pacchetti[chi] || {};
    return Object.fromEntries(
      APP.map((app) => {
        try {
          return [app, iContiDetti(suo[app])];
        } catch (_errore) {
          return [app, {}];
        }
      }),
    );
  }

  /**
   * Cambia il pacchetto. Una app che si nomina prende i conti detti **tutti
   * interi** (una durata che non c'e' piu' e' tolta); quella che non si
   * nomina resta com'era. Solleva 400 se il detto non va, senza toccare
   * niente.
   */
  mettiIlPacchetto(chi, detto = {}) {
    const nuovo = ilPacchettoDetto(detto);
    this.archivio.dati.pacchetti[chi] = { ...this.pacchettoDato(chi), ...nuovo };
    this.archivio.salva();
    return this.pacchetto(chi);
  }

  /** Il mucchio da cui viene una licenza o un codice di un installatore. */
  _taglioDi(uno) {
    if (uno.taglio) return String(uno.taglio);
    if (uno.mesi !== undefined) return uno.mesi === null ? "sempre" : String(uno.mesi);
    return TAGLIO_DI_PRIMA;
  }

  /** Le durate chieste dall'installatore: una, detta bene, e non «nessuna». */
  _durataChiesta(durata) {
    if (durata === undefined || durata === "") throw new NoLicenza(400, "durata-mancante");
    return unaDurata(durata);
  }

  /**
   * Quanti posti ha preso, per app e durata: licenze non tolte e codici in
   * giro. Torna `{gdahome: {"12": 2}, gdanav: {}}`.
   */
  usatePerTaglio(chi) {
    const fuori = Object.fromEntries(APP.map((app) => [app, {}]));
    const conta = (uno) => {
      if (!fuori[uno.app]) return;
      const taglio = this._taglioDi(uno);
      fuori[uno.app][taglio] = (fuori[uno.app][taglio] || 0) + 1;
    };
    for (const una of this.licenze) if (una.installatore === chi && !una.revocata) conta(una);
    for (const uno of this.codici) if (uno.installatore === chi && !uno.usatoDa && !uno.annullato) conta(uno);
    return fuori;
  }

  /**
   * Il pacchetto nella forma del contratto: per ogni app un elenco di mucchi,
   * dal piu' corto a «per sempre», `{gdahome: [{durata: "1", totali: 10,
   * usate: 0}, {durata: "12", totali: 5, usate: 2}], gdanav: []}`. Ci sono le
   * durate date, e anche quelle tolte dal gestore ma con licenze ancora in
   * giro (`totali: 0`): chi le ha date le vede, e sa perche'.
   */
  pacchetto(chi) {
    const dato = this.pacchettoDato(chi);
    const usate = this.usatePerTaglio(chi);
    return Object.fromEntries(
      APP.map((app) => {
        const durate = [...new Set([...Object.keys(dato[app]), ...Object.keys(usate[app])])].sort(inOrdine);
        return [app, durate.map((durata) => ({ durata, totali: dato[app][durata] || 0, usate: usate[app][durata] || 0 }))];
      }),
    );
  }

  /**
   * C'e' posto in quel mucchio? Una durata che il pacchetto non ha e' un 400
   * `durata-non-nel-pacchetto` (la richiesta e' sbagliata); una che c'e' ma
   * e' finita e' un 409 `pacchetto-esaurito`. Un installatore che non ha
   * niente per quella app e' esaurito anche lui, qualunque durata chieda.
   */
  _cePosto(chi, app, taglio, quanti = 1) {
    const mucchi = this.pacchetto(chi)[app];
    if (!mucchi.some((uno) => uno.totali > 0)) throw new NoLicenza(409, "pacchetto-esaurito");
    const mucchio = mucchi.find((uno) => uno.durata === taglio);
    if (!mucchio || !mucchio.totali) throw new NoLicenza(400, "durata-non-nel-pacchetto");
    if (mucchio.usate + quanti > mucchio.totali) throw new NoLicenza(409, "pacchetto-esaurito");
  }

  /** Un installatore eliminato: il suo pacchetto se ne va, le licenze date restano. */
  dimenticaIlPacchetto(chi) {
    if (!(chi in this.archivio.dati.pacchetti)) return;
    delete this.archivio.dati.pacchetti[chi];
    this.archivio.salva();
  }

  /* ─── Gli elenchi ───────────────────────────────────────────────────── */

  _riga(una, ora = this.adesso()) {
    return {
      lic: una.lic,
      app: una.app,
      sog: una.sog,
      origine: una.origine,
      installatore: una.installatore || null,
      scade: una.scade,
      creata: una.creata,
      revocata: una.revocata || null,
      nota: una.nota || "",
      codice: una.codice || null,
      ...(una.installatore ? { taglio: this._taglioDi(una) } : {}),
      prova: Boolean(una.prova),
      vale: this.vale(una, ora),
    };
  }

  _rigaDelCodice(uno) {
    return {
      codice: uno.codice,
      app: uno.app,
      mesi: uno.mesi ?? null,
      origine: uno.origine,
      installatore: uno.installatore || null,
      ...(uno.installatore ? { taglio: this._taglioDi(uno) } : {}),
      nota: uno.nota || "",
      creato: uno.creato,
      usatoDa: uno.usatoDa || null,
      usatoIl: uno.usatoIl || null,
      lic: uno.lic || null,
      annullato: uno.annullato || null,
    };
  }

  /** Tutto, per il gestore: le piu' nuove prima. */
  elenco() {
    const ora = this.adesso();
    return {
      accese: this.accese,
      licenze: this.licenze.map((una) => this._riga(una, ora)).sort((a, b) => b.creata - a.creata),
      codici: this.codici.map((uno) => this._rigaDelCodice(uno)).sort((a, b) => b.creato - a.creato),
    };
  }

  /** Quello di un installatore: il pacchetto, le licenze che ha dato, i suoi codici. */
  elencoDi(chi) {
    const ora = this.adesso();
    return {
      accese: this.accese,
      pacchetto: this.pacchetto(chi),
      licenze: this.licenze
        .filter((una) => una.installatore === chi && !una.revocata)
        .map((una) => this._riga(una, ora))
        .sort((a, b) => b.creata - a.creata),
      codici: this.codici
        .filter((uno) => uno.installatore === chi && !uno.usatoDa && !uno.annullato)
        .map((uno) => this._rigaDelCodice(uno))
        .sort((a, b) => b.creato - a.creato),
    };
  }
}
