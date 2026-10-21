/* I fornitori di energia, collegati dal ponte.
 *
 * «Userei le integrazioni in essere su Home Assistant tramite HACS,
 * inglobandole nella nostra.» Quelle di E.ON Energia Italia e di ENGIE Italia
 * sono MIT, e il loro modo di parlare col fornitore sta qui accanto, portato in
 * JavaScript (`fornitori/eon.js`, `fornitori/engie.js`, licenze in
 * `fornitori/LICENZE.md`). Quello che c'e' in questo file e' nostro: chi e'
 * collegato, dove stanno i gettoni, e come una bolletta diventa un sensore di
 * Home Assistant che la linguetta Bollette della plancia sa leggere.
 *
 * **Le regole, e stanno tutte su questo confine.**
 *
 *   - La password di E.ON serve una volta, per entrare, e non si scrive da
 *     nessuna parte: restano i gettoni del fornitore, in
 *     `/data/fornitori.json`, leggibile solo dal ponte (0600). Quella di ENGIE
 *     non passa nemmeno di qui: si entra dal sito di ENGIE, nel browser.
 *   - Gli otto comandi `dashboardmodern/fornitori/*` li fa solo chi
 *     amministra la casa (`SOLO_CHI_AMMINISTRA` in `commissioni.js`): un
 *     utente di Home Assistant entrato, amministratore. Gli altri vedono le
 *     bollette come sensori, e basta.
 *   - Nel ponte non si vede nulla: nessuna pagina, nessuna console, e nel
 *     registro solo il nome del fornitore e il tipo dell'errore — mai una
 *     risposta del fornitore, un'email, un gettone.
 *   - Alla plancia arriva il nome del fornitore, la fornitura con le cifre di
 *     mezzo coperte e com'e' andato l'ultimo giro. Mai un segreto.
 *
 * **I sensori.** Il ponte li scrive in Home Assistant dall'API REST
 * (`POST /api/states/sensor.eon_unpaid_invoices`), coi nomi delle integrazioni
 * originali: cosi' la linguetta Bollette li trova da sola, e chi scrive
 * un'automazione li riconosce. Uno stato scritto cosi' Home Assistant non lo
 * tiene dopo un suo riavvio: il ponte lo riscrive ogni dieci minuti dall'ultima
 * lettura, e chiede al fornitore ogni sei ore.
 */

import { randomBytes } from "node:crypto";
import { join } from "node:path";

import { Archivio } from "./archivio.js";
import * as eon from "./fornitori/eon.js";
import * as engie from "./fornitori/engie.js";

export const PREFISSO = "dashboardmodern/fornitori/";
const UN_GIORNO = 86_400_000;
/* Le bollette arrivano una volta al mese, i consumi con due giorni di
 * ritardo: sei ore bastano e avanzano. */
const OGNI = 6 * 3_600_000;
/* E gli stati si riscrivono spesso, perche' Home Assistant li perde quando
 * riparte. */
const SPECCHIO = 10 * 60_000;
const VITA_DEL_PASSO = 600_000;

export const CATALOGO = Object.freeze([
  { id: "eon", nome: "E.ON Energia", modo: "password", cosa: "luce", pronto: true },
  { id: "engie", nome: "ENGIE", modo: "link", cosa: "luce-gas", pronto: true },
  {
    id: "enel",
    nome: "Enel Energia",
    modo: "password",
    pronto: false,
    perche: "nessuna-integrazione",
  },
  { id: "octopus", nome: "Octopus Energy", modo: "password", pronto: false, perche: "presto" },
]);
const NOMI = Object.fromEntries(CATALOGO.map((f) => [f.id, f.nome]));
const PRONTI = new Set(CATALOGO.filter((f) => f.pronto).map((f) => f.id));

/* Le voci della bolletta: il nome del sensore (quello delle integrazioni
 * originali), come si chiama in italiano, e come si presenta. */
export const VOCI = Object.freeze({
  unpaid_invoices: {
    nome: "Bollette da pagare",
    unita: "EUR",
    classe: "monetary",
    icona: "mdi:cash-clock",
  },
  payment_status: {
    nome: "Stato del pagamento",
    classe: "enum",
    opzioni: ["paid", "unpaid"],
    icona: "mdi:receipt-text-check",
  },
  latest_invoice: {
    nome: "Ultima bolletta",
    unita: "EUR",
    classe: "monetary",
    icona: "mdi:receipt-text",
  },
  total_invoiced: {
    nome: "Totale fatturato (12 mesi)",
    unita: "EUR",
    classe: "monetary",
    icona: "mdi:cash-multiple",
  },
  contracted_power: {
    nome: "Potenza impegnata",
    unita: "kW",
    classe: "power",
    icona: "mdi:flash",
  },
  offer_end: { nome: "Scadenza dell'offerta", classe: "date", icona: "mdi:calendar-end" },
  daily_consumption: {
    nome: "Consumo giornaliero",
    unita: "kWh",
    classe: "energy",
    icona: "mdi:lightning-bolt",
  },
});
const VOCI_DI = {
  eon: Object.keys(VOCI),
  engie: Object.keys(VOCI).filter((v) => v !== "daily_consumption"),
};

/* Una parola sola, che la plancia traduce: `credenziali`, `codice`,
 * `captcha`, `link`, `scaduto`, `fornitore`. Il testo del fornitore non
 * arriva fin la'. */
export class ErroreDelFornitore extends Error {}

export function copri(fornitura) {
  const testo = String(fornitura || "");
  return testo.length <= 8 ? testo : `${testo.slice(0, 6)}••••${testo.slice(-4)}`;
}

const due = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : null);
const giornoDi = (ms) => new Date(ms).toISOString().slice(0, 10);

/* ─── dalle fatture alle voci ────────────────────────────────────────────── */

export function bolletteEon(fatture, adesso) {
  const voci = {};
  let daPagare = 0;
  const aperte = [];
  for (const f of fatture) {
    const resta = f.residuo ?? 0;
    if (resta > 0) {
      daPagare += resta;
      aperte.push({ scadenza: f.scadenza, importo: due(resta) });
    }
  }
  voci.unpaid_invoices = {
    stato: due(daPagare),
    attributi: { quante: aperte.length, aperte: aperte.slice(0, 12) },
  };
  const datate = fatture.filter((f) => f.emessa).sort((a, b) => (a.emessa < b.emessa ? 1 : -1));
  if (datate.length) {
    const ultima = datate[0];
    voci.latest_invoice = {
      stato: due(ultima.importo),
      attributi: {
        emessa: ultima.emessa,
        scadenza: ultima.scadenza,
        dal: ultima.dal,
        al: ultima.al,
      },
    };
    voci.payment_status = { stato: ultima.pagata ? "paid" : "unpaid" };
    const dal = giornoDi(adesso - 365 * UN_GIORNO);
    voci.total_invoiced = {
      stato: due(datate.filter((f) => f.emessa >= dal).reduce((s, f) => s + (f.importo ?? 0), 0)),
      attributi: { dal },
    };
  } else if (!fatture.length) {
    voci.payment_status = { stato: "paid" };
  }
  return voci;
}

export function bolletteEngie(fatture, adesso) {
  const voci = {};
  const aperta = fatture.map(engie.eAperta);
  /* ENGIE dice «non si sa» quando i suoi conti non tornano: li' il sensore
   * resta senza valore, invece di dire che e' tutto pagato. */
  if (!aperta.includes(null)) {
    const aperte = fatture.filter((_, i) => aperta[i]);
    if (!aperte.some((f) => f.residuo === null)) {
      voci.unpaid_invoices = {
        stato: due(aperte.reduce((s, f) => s + f.residuo, 0)),
        attributi: {
          quante: aperte.length,
          aperte: aperte
            .slice(0, 12)
            .map((f) => ({ scadenza: f.scadenza, importo: due(f.residuo) })),
        },
      };
    }
    voci.payment_status = { stato: aperte.length ? "unpaid" : "paid" };
  }
  if (fatture.length && fatture.every((f) => f.emessa)) {
    const ultima = [...fatture].sort((a, b) => (a.emessa < b.emessa ? 1 : -1))[0];
    voci.latest_invoice = {
      stato: due(ultima.importo),
      attributi: { emessa: ultima.emessa, scadenza: ultima.scadenza },
    };
  }
  const dal = giornoDi(adesso - 365 * UN_GIORNO);
  const anno = fatture.filter((f) => f.emessa && f.emessa >= dal);
  if (anno.length)
    voci.total_invoiced = {
      stato: due(anno.reduce((s, f) => s + (f.importo ?? 0), 0)),
      attributi: { dal },
    };
  return voci;
}

/* ─── i collegamenti ─────────────────────────────────────────────────────── */

export class Fornitori {
  constructor({
    cartella = "/data",
    casa = null,
    registro = null,
    prendi = globalThis.fetch,
    adesso = () => Date.now(),
    acaso = () => randomBytes(6).toString("hex"),
  } = {}) {
    this.archivio = new Archivio(
      join(cartella, "fornitori.json"),
      { collegati: {} },
      { modo: 0o600 },
    );
    this.casa = casa;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.prendi = prendi;
    this.adesso = adesso;
    this.acaso = acaso;
    this.configurazioneEon = new eon.ConfigurazioneEon({ prendi, adesso });
    this.accessoEon = new eon.AccessoEon({ prendi, configurazione: this.configurazioneEon });
    /* Gli accessi a meta', uno per utente: solo in memoria. */
    this.passi = new Map();
    this.timer = [];
    this._inFila = Promise.resolve();
  }

  get collegati() {
    const tutti = this.archivio.dati.collegati;
    return tutti && typeof tutti === "object" ? tutti : (this.archivio.dati.collegati = {});
  }

  _salva() {
    try {
      this.archivio.salva();
    } catch (errore) {
      this.registro.errore(`fornitori: non riesco a scrivere (${errore?.code || "?"})`);
    }
  }

  /* ─── i giri ── */

  avvia() {
    this.ferma();
    const specchio = setInterval(() => this.rimettiGliStati().catch(() => {}), SPECCHIO);
    const giro = setInterval(() => this.leggiTutti().catch(() => {}), OGNI);
    specchio.unref?.();
    giro.unref?.();
    this.timer = [specchio, giro];
    /* Alla partenza: subito quello che si sa, poi si chiede al fornitore. */
    const primo = setTimeout(() => {
      this.rimettiGliStati()
        .then(() => this.leggiTutti())
        .catch(() => {});
    }, 30_000);
    primo.unref?.();
    this.timer.push(primo);
  }

  ferma() {
    for (const t of this.timer) clearInterval(t);
    this.timer = [];
  }

  async leggiTutti() {
    for (const chiave of Object.keys(this.collegati)) await this.leggi(chiave);
  }

  _client(voce) {
    const rinnovati = async (gettoni) => {
      voce.segreti = { ...voce.segreti, gettoni };
      this._salva();
    };
    if (voce.fornitore === "eon")
      return new eon.ClientEon({
        gettoni: voce.segreti?.gettoni,
        rinnovati,
        prendi: this.prendi,
        configurazione: this.configurazioneEon,
        adesso: this.adesso,
      });
    return new engie.ClientEngie({
      gettoni: voce.segreti?.gettoni,
      rinnovati,
      prendi: this.prendi,
      adesso: this.adesso,
    });
  }

  async _leggiEon(client, voce) {
    const adesso = this.adesso();
    const voci = bolletteEon(await client.fatture(voce.pod), adesso);
    /* Il contratto e i consumi sono un di piu': se non rispondono, le
     * bollette restano buone. Un gettone rifiutato invece vale per tutti. */
    try {
      const fornitura = await client.fornitura(voce.pod);
      if (fornitura.potenza !== null) voci.contracted_power = { stato: fornitura.potenza };
      if (fornitura.fineOfferta) voci.offer_end = { stato: fornitura.fineOfferta };
    } catch (errore) {
      if (errore instanceof eon.AccessoNegato) throw errore;
    }
    try {
      const giorni = (
        await client.consumi(voce.pod, { dal: adesso - 7 * UN_GIORNO, al: adesso - 2 * UN_GIORNO })
      ).filter((g) => g.giorno);
      if (giorni.length) {
        const ultimo = giorni.sort((a, b) => (a.giorno < b.giorno ? 1 : -1))[0];
        voci.daily_consumption = { stato: ultimo.totale, attributi: { giorno: ultimo.giorno } };
      }
    } catch (errore) {
      if (errore instanceof eon.AccessoNegato) throw errore;
    }
    return voci;
  }

  async _leggiEngie(client, voce) {
    const { forniture, contratti } = await client.forniture();
    const voci = bolletteEngie(await client.fatture(contratti), this.adesso());
    const fornitura = forniture.find((f) => f.pod === voce.pod) || forniture[0];
    if (fornitura?.potenza !== null && fornitura?.potenza !== undefined)
      voci.contracted_power = { stato: fornitura.potenza };
    if (fornitura?.fineOfferta) voci.offer_end = { stato: fornitura.fineOfferta };
    return voci;
  }

  /* Un giro per un collegamento: chiedi al fornitore, scrivi i sensori. */
  async leggi(chiave) {
    const voce = this.collegati[chiave];
    if (!voce) return;
    let voci;
    try {
      const client = this._client(voce);
      voci =
        voce.fornitore === "eon"
          ? await this._leggiEon(client, voce)
          : await this._leggiEngie(client, voce);
    } catch (errore) {
      if (errore instanceof eon.AccessoNegato || errore instanceof engie.AccessoNegato) {
        voce.stato = "da-ricollegare";
        this._salva();
        this.registro.attenzione(`fornitori: ${NOMI[voce.fornitore]} chiede di ricollegarsi`);
        return;
      }
      /* Il fornitore non risponde: i sensori tengono l'ultimo valore. Nel
       * registro il nome dell'errore e basta. */
      this.registro.attenzione(
        `fornitori: ${NOMI[voce.fornitore]} non risponde (${errore?.constructor?.name || "errore"})`,
      );
      return;
    }
    voce.stato = "ok";
    voce.aggiornato = this.adesso();
    voce.valori = voci;
    this._salva();
    await this._scrivi(voce);
  }

  _entita(voce, nome) {
    return `sensor.${voce.prefisso}_${nome}`;
  }

  async _scrivi(voce) {
    if (!this.casa?.api) return;
    for (const nome of VOCI_DI[voce.fornitore] || []) {
      const aspetto = VOCI[nome];
      const letto = voce.valori?.[nome];
      const stato = letto?.stato;
      const attributi = {
        friendly_name: `${NOMI[voce.fornitore]} ${aspetto.nome}`,
        icon: aspetto.icona,
        device_class: aspetto.classe,
        attribution: `Dati di ${NOMI[voce.fornitore]}, letti da GdAHome`,
        ...(aspetto.unita ? { unit_of_measurement: aspetto.unita } : {}),
        ...(aspetto.opzioni ? { options: aspetto.opzioni } : {}),
        ...(letto?.attributi || {}),
      };
      try {
        await this.casa.api("POST", `states/${this._entita(voce, nome)}`, {
          state: stato === null || stato === undefined ? "unknown" : String(stato),
          attributes: attributi,
        });
      } catch (errore) {
        this.registro.attenzione(
          `fornitori: Home Assistant non prende i sensori (${errore?.code || "?"})`,
        );
        return;
      }
    }
  }

  async rimettiGliStati() {
    for (const voce of Object.values(this.collegati)) if (voce.valori) await this._scrivi(voce);
  }

  /* ─── quello che la plancia vede ── */

  stato() {
    return {
      collegati: Object.entries(this.collegati).map(([id, voce]) => ({
        id,
        fornitore: voce.fornitore,
        nome: NOMI[voce.fornitore] || voce.fornitore,
        pod: copri(voce.pod),
        stato: voce.stato || "ok",
        aggiornato: voce.aggiornato || 0,
      })),
      disponibili: CATALOGO.map((f) => ({ ...f })),
    };
  }

  /* ─── collegare ── */

  _prefisso(fornitore) {
    const presi = new Set(Object.values(this.collegati).map((v) => v.prefisso));
    for (let n = 1; ; n += 1) {
      const prefisso = n === 1 ? fornitore : `${fornitore}_${n}`;
      if (!presi.has(prefisso)) return prefisso;
    }
  }

  async _nuovo(fornitore, pod, gettoni, conto = "") {
    let chiave = Object.keys(this.collegati).find((k) => {
      const v = this.collegati[k];
      return v.fornitore === fornitore && (v.pod === pod || (conto && v.conto === conto));
    });
    if (!chiave) {
      chiave = this.acaso();
      this.collegati[chiave] = { fornitore, prefisso: this._prefisso(fornitore) };
    }
    Object.assign(this.collegati[chiave], {
      pod,
      conto,
      segreti: { gettoni },
      stato: "ok",
    });
    this._salva();
    await this.leggi(chiave);
    return { stato: this.stato() };
  }

  _passo(utente, fornitore, tipo) {
    const passo = this.passi.get(utente);
    if (
      !passo ||
      passo.fornitore !== fornitore ||
      passo.tipo !== tipo ||
      this.adesso() - passo.alle > VITA_DEL_PASSO
    ) {
      this.passi.delete(utente);
      throw new ErroreDelFornitore("scaduto");
    }
    return passo;
  }

  async _eonDalBrowser(utente, perche) {
    let link;
    try {
      link = await this.accessoEon.linkDelBrowser();
    } catch (_errore) {
      throw new ErroreDelFornitore("fornitore");
    }
    this.passi.set(utente, { fornitore: "eon", tipo: "incolla", alle: this.adesso() });
    return { serve: "incolla", link, perche };
  }

  async _eonFatto(gettoni) {
    const client = new eon.ClientEon({
      gettoni,
      prendi: this.prendi,
      configurazione: this.configurazioneEon,
      adesso: this.adesso,
    });
    let forniture;
    try {
      forniture = await client.forniture();
    } catch (_errore) {
      throw new ErroreDelFornitore("fornitore");
    }
    const scelta =
      forniture.find((f) => f.pod && f.attiva && f.luce) || forniture.find((f) => f.pod);
    if (!scelta) throw new ErroreDelFornitore("fornitore");
    return this._nuovo("eon", scelta.pod, {
      access_token: client.accesso,
      refresh_token: client.rinnovo,
    });
  }

  async collega(utente, fornitore, email, password) {
    if (fornitore !== "eon") throw new ErroreDelFornitore("fornitore");
    let gettoni;
    try {
      gettoni = await this.accessoEon.entra(email, password);
    } catch (errore) {
      if (errore instanceof eon.ServeIlCodice) {
        this.passi.set(utente, {
          fornitore: "eon",
          tipo: "codice",
          sessione: errore.sessione,
          alle: this.adesso(),
        });
        return { serve: "codice" };
      }
      if (errore instanceof eon.ServeIlBrowser) return this._eonDalBrowser(utente, "captcha");
      if (errore instanceof eon.AccessoNegato) throw new ErroreDelFornitore("credenziali");
      throw new ErroreDelFornitore("fornitore");
    }
    return this._eonFatto(gettoni);
  }

  async codice(utente, fornitore, codiceSms) {
    const passo = this._passo(utente, fornitore, "codice");
    let gettoni;
    try {
      gettoni = await this.accessoEon.conIlCodice(codiceSms, passo.sessione);
    } catch (errore) {
      if (errore instanceof eon.AccessoNegato) throw new ErroreDelFornitore("codice");
      throw new ErroreDelFornitore("fornitore");
    }
    this.passi.delete(utente);
    return this._eonFatto(gettoni);
  }

  async inizia(utente, fornitore) {
    if (fornitore === "eon") return this._eonDalBrowser(utente, "");
    if (fornitore !== "engie") throw new ErroreDelFornitore("fornitore");
    const tentativo = new engie.Tentativo({ adesso: this.adesso });
    this.passi.set(utente, { fornitore, tipo: "incolla", tentativo, alle: this.adesso() });
    return { link: tentativo.link };
  }

  async incolla(utente, fornitore, indirizzo) {
    const passo = this._passo(utente, fornitore, "incolla");
    if (fornitore === "eon") {
      const codice = eon.ilCodiceDa(indirizzo);
      if (!codice) throw new ErroreDelFornitore("link");
      let gettoni;
      try {
        gettoni = await this.accessoEon.scambiaIlCodice(codice);
      } catch (errore) {
        if (errore instanceof eon.AccessoNegato) throw new ErroreDelFornitore("link");
        throw new ErroreDelFornitore("fornitore");
      }
      this.passi.delete(utente);
      return this._eonFatto(gettoni);
    }
    let fatto;
    try {
      fatto = await engie.completaLAccesso(passo.tentativo, indirizzo, { prendi: this.prendi });
    } catch (errore) {
      if (passo.tentativo.usato || passo.tentativo.scaduto) this.passi.delete(utente);
      if (errore instanceof engie.AccessoNegato) throw new ErroreDelFornitore("link");
      throw new ErroreDelFornitore("fornitore");
    }
    this.passi.delete(utente);
    let forniture;
    try {
      ({ forniture } = await new engie.ClientEngie({
        gettoni: fatto.gettoni,
        prendi: this.prendi,
        adesso: this.adesso,
        rinnovati: async (nuovi) => {
          fatto.gettoni = nuovi;
        },
      }).forniture());
    } catch (_errore) {
      throw new ErroreDelFornitore("fornitore");
    }
    const luce = forniture.find((f) => f.luce) || forniture[0];
    return this._nuovo("engie", luce?.pod || "", fatto.gettoni, fatto.conto);
  }

  async aggiorna(chiave) {
    if (!this.collegati[chiave]) throw new ErroreDelFornitore("scaduto");
    await this.leggi(chiave);
    return { stato: this.stato() };
  }

  async scollega(chiave) {
    const voce = this.collegati[chiave];
    if (!voce) throw new ErroreDelFornitore("scaduto");
    delete this.collegati[chiave];
    this._salva();
    for (const nome of VOCI_DI[voce.fornitore] || []) {
      try {
        await this.casa?.api?.("DELETE", `states/${this._entita(voce, nome)}`);
      } catch (_errore) {
        /* Gia' andato. */
      }
    }
    return { stato: this.stato() };
  }

  /* ─── le commissioni ── */

  riconosce(tipo) {
    return typeof tipo === "string" && tipo.startsWith(PREFISSO);
  }

  /* Gli accessi uno alla volta: due insieme dallo stesso ponte sono un modo
   * per farsi chiedere il «non sei un robot». Guardare chi e' collegato, o
   * lasciar perdere, non aspetta nessuno. */
  rispondi(detto, { chiChiede = "" } = {}) {
    const azione = String(detto?.type || "").slice(PREFISSO.length);
    if (azione === "stato" || azione === "annulla") return this._rispondi(detto, chiChiede);
    const risposta = this._inFila.then(() => this._rispondi(detto, chiChiede));
    this._inFila = risposta.catch(() => {});
    return risposta;
  }

  async _rispondi(detto, chiChiede) {
    const id = detto?.id ?? null;
    const azione = String(detto?.type || "").slice(PREFISSO.length);
    const utente = String(chiChiede || "");
    const fornitore = String(detto?.fornitore || "");
    const parola = (valore, massimo) =>
      typeof valore === "string" && valore.length > 0 && valore.length <= massimo;
    try {
      if (["inizia", "collega", "codice", "incolla"].includes(azione) && !PRONTI.has(fornitore))
        throw new ErroreDelFornitore("fornitore");
      let risultato;
      if (azione === "stato") risultato = this.stato();
      else if (azione === "inizia") risultato = await this.inizia(utente, fornitore);
      else if (azione === "collega") {
        if (!parola(detto.email, 254) || !parola(detto.password, 256))
          throw new ErroreDelFornitore("credenziali");
        risultato = await this.collega(utente, fornitore, detto.email.trim(), detto.password);
      } else if (azione === "codice") {
        if (!/^\d{4,10}$/.test(String(detto.codice || ""))) throw new ErroreDelFornitore("codice");
        risultato = await this.codice(utente, fornitore, String(detto.codice));
      } else if (azione === "incolla") {
        if (!parola(detto.indirizzo, 8192)) throw new ErroreDelFornitore("link");
        risultato = await this.incolla(utente, fornitore, detto.indirizzo);
      } else if (azione === "annulla") {
        this.passi.delete(utente);
        risultato = {};
      } else if (azione === "aggiorna" || azione === "scollega") {
        const chiave = String(detto?.collegamento || "");
        if (!/^[0-9a-f]{12}$/.test(chiave)) throw new ErroreDelFornitore("scaduto");
        risultato =
          azione === "aggiorna" ? await this.aggiorna(chiave) : await this.scollega(chiave);
      } else {
        return {
          id,
          type: "result",
          success: false,
          error: { code: "unknown_command", message: `non conosco ${detto?.type}` },
        };
      }
      return { id, type: "result", success: true, result: risultato };
    } catch (errore) {
      const perche = errore instanceof ErroreDelFornitore ? errore.message : "fornitore";
      return { id, type: "result", success: false, error: { code: "failed", message: perche } };
    }
  }
}
