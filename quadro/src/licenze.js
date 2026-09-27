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
 *    gdanav il gestore gli ha dato da regalare.
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
      licenze: sue.map((una) => ({ lic: una.lic, app: una.app, origine: una.origine, scade: una.scade })),
    };
  }

  /** Il gettone di una licenza, firmato adesso. */
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
  regala({ app, casa, mesi = null, nota = "", installatore = null }) {
    unaApp(app);
    if (!CASA.test(String(casa ?? ""))) throw new NoLicenza(400, "casa-non-valida");
    const quanti = iMesi(mesi);
    if (installatore) this._cePosto(installatore, app);
    const una = this._nuova({
      app,
      sog: casa,
      origine: installatore ? "installatore" : "regalo",
      installatore,
      scade: mesiDopo(this.adesso(), quanti),
      nota,
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
  generaCodici({ app, quanti = 1, mesi = null, nota = "", installatore = null }) {
    unaApp(app);
    const mesiBuoni = iMesi(mesi);
    const n = Math.floor(Number(quanti));
    if (!Number.isInteger(n) || n < 1 || n > CODICI_AL_MASSIMO) throw new NoLicenza(400, "quanti-non-valido");
    if (installatore) this._cePosto(installatore, app, n);
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
        ...(installatore ? { installatore } : {}),
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
   */
  dalNegozio({ app, sog, scade, acquisto, prima = null, piattaforma, prodotto }) {
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
        negozio: { chiave, piattaforma, prodotto },
      });
    } else {
      una.sog = sog;
      una.app = app;
      una.scade = scade;
      una.negozio = { chiave, piattaforma, prodotto };
      una.visto = this.adesso();
    }
    this.archivio.salva();
    return una;
  }

  /* ─── Il pacchetto degli installatori ───────────────────────────────── */

  /** I totali dati a un installatore: `{gdahome, gdanav}`. */
  pacchettoDato(chi) {
    const suo = this.archivio.dati.pacchetti[chi] || {};
    return { gdahome: numeroNelPacchetto(suo.gdahome), gdanav: numeroNelPacchetto(suo.gdanav) };
  }

  /** Cambia i totali. Quello che non si dice resta com'era. */
  mettiIlPacchetto(chi, detto = {}) {
    const prima = this.pacchettoDato(chi);
    this.archivio.dati.pacchetti[chi] = {
      gdahome: detto?.gdahome === undefined ? prima.gdahome : numeroNelPacchetto(detto.gdahome),
      gdanav: detto?.gdanav === undefined ? prima.gdanav : numeroNelPacchetto(detto.gdanav),
    };
    this.archivio.salva();
    return this.pacchetto(chi);
  }

  /** Quanti posti ha preso, app per app: licenze non tolte e codici in giro. */
  usate(chi, app) {
    const licenze = this.licenze.filter(
      (una) => una.installatore === chi && una.app === app && !una.revocata,
    ).length;
    const codici = this.codici.filter(
      (uno) => uno.installatore === chi && uno.app === app && !uno.usatoDa && !uno.annullato,
    ).length;
    return licenze + codici;
  }

  /** Il pacchetto nella forma del contratto: `{gdahome: {totali, usate}, gdanav: …}`. */
  pacchetto(chi) {
    const dato = this.pacchettoDato(chi);
    return Object.fromEntries(APP.map((app) => [app, { totali: dato[app], usate: this.usate(chi, app) }]));
  }

  _cePosto(chi, app, quanti = 1) {
    const { totali, usate } = this.pacchetto(chi)[app];
    if (usate + quanti > totali) throw new NoLicenza(409, "pacchetto-esaurito");
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
