/* Le automazioni, fatte dalla casa.
 *
 * «Quando c'e' movimento in corridoio, di notte, accendi la luce al 20% e
 * dopo due minuti spegnila.» Chi la scrive ha la plancia sul telefono e il
 * telefono in tasca: alle due di notte nessuna pagina e' aperta, e una regola
 * che vivesse nella pagina non scatterebbe mai. Per questo sta qui, nel
 * ponte, che gira finche' gira Home Assistant — come la ricarica di notte
 * (`ricarica-di-notte.js`), da cui prende il modo di stare al mondo.
 *
 * Le regole non stanno in questo file: stanno in
 * `plancia/src/core/automazioni.js`, che la plancia importa per scriverle e
 * raccontarle e il ponte per eseguirle — una regola sola, due lettori. Qui ci
 * sono le cose che la plancia non puo' fare:
 *
 *  - **sentire la casa**: ogni cambio di stato che arriva alla sentinella delle
 *    notifiche passa anche di qui (`quandoCambia`), senza chiedere niente a
 *    Home Assistant — lo specchio degli stati c'e' gia', e `get_states` a
 *    raffica vorrebbe dire scaricare tutta la casa a ogni giro;
 *  - **guardare l'orologio** ogni venti secondi: gli orari, l'alba, il «da
 *    dieci minuti», la lavatrice che ha finito, il cronotermostato;
 *  - **chiamare i servizi** che il nucleo ha scelto, e solo quelli;
 *  - **ricordarsi** su disco (`/data/automazioni.json`) quello che deve
 *    sopravvivere a un riavvio: l'«aspetta due minuti» a meta', la lavatrice
 *    che gira, il valore gia' sopra soglia, l'ultima volta di ognuna.
 *
 * Non solo le cose che la plancia conosce: un QUANDO puo' guardare qualunque
 * entita' di Home Assistant, un suo attributo, o un evento del bus (il tasto
 * Zigbee che manda `zha_event`): a quegli eventi, e solo a quelli che servono
 * alle automazioni accese, ci si abbona qui (`_sincronizzaGliEventi`). E ogni
 * automazione dice cosa fare se riscatta mentre e' ancora in corso
 * (ricomincia, ignora, in coda), una pausa minima fra due volte, e una data
 * in cui si accende o si spegne da sola.
 *
 * ── Premium ───────────────────────────────────────────────────────────────
 *
 * Le automazioni sono di gdahome Premium. Senza, restano salvate nella
 * plancia ma qui non parte niente — nessun orario, nessun servizio — e il
 * giorno che la casa torna Premium ripartono da sole. Con le licenze spente
 * (la chiave vuota, come nei ponti di prova) e' tutto aperto, come per il
 * pianificatore dei viaggi (`viaggi.js`).
 *
 * ── Chi le scrive, chi le legge ───────────────────────────────────────────
 *
 * Le automazioni si scrivono nella configurazione della plancia principale
 * (`cd_automazioni`) e solo da chi ha un utente: un salvataggio senza nome
 * non le tocca (`commissioni.js`, `conservaLeAutomazioni`). Qui non c'e'
 * nessun comando per scriverle — una porta in meno da difendere. Alla plancia
 * si risponde con un comando solo, in sola lettura, `ponte/automazioni/stato`
 * — cosa viene dopo, le ultime eseguite, l'ultima volta di ognuna — e solo a
 * chi sul filo ha un nome.
 */

import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { PROFILO_PRINCIPALE } from "./configurazione.js";
import {
  CHIAVE_AUTOMAZIONI,
  MINUTO,
  automazioniPulite,
  cronoDecide,
  eAttivaAdesso,
  entitaDelQuando,
  passiDellAllora,
  prossimiEventi,
  soloSeVale,
  valutaIlQuando,
} from "../plancia/src/core/automazioni.js";

/* Ogni quanto si guarda l'orologio. Un orario comincia a un minuto preciso, e
 * venti secondi di ritardo su una tapparella non si vedono. */
const BATTITO = 20_000;

/* Le ultime eseguite che si tengono per la plancia. */
const STORIA = 12;

/* Un «aspetta» rimasto a meta' per un riavvio si riprende se la casa torna
 * presto. Mezz'ora dopo no: la luce del corridoio che si spegne un'ora dopo il
 * riavvio va bene, quella che si accende no — e il passo dopo un'attesa
 * potrebbe essere un'accensione. */
const RIPRESA_POSSIBILE = 30 * MINUTO;

export const COMANDO_DELLO_STATO = "ponte/automazioni/stato";

function leggiJson(valore) {
  if (typeof valore !== "string") return valore ?? null;
  try {
    return JSON.parse(valore);
  } catch (_errore) {
    return null;
  }
}

/* Lo specchio della sentinella e' una `Map`; il nucleo legge un oggetto. Un
 * oggetto finto che guarda nella mappa costa niente e non copia la casa a
 * ogni cambio di un sensore di potenza. */
function comeOggetto(mappa) {
  if (!mappa || typeof mappa.get !== "function")
    return mappa && typeof mappa === "object" ? mappa : {};
  return new Proxy(
    {},
    {
      get: (_bersaglio, chiave) => (typeof chiave === "string" ? mappa.get(chiave) : undefined),
      has: (_bersaglio, chiave) => mappa.has(chiave),
      ownKeys: () => [...mappa.keys()],
      getOwnPropertyDescriptor: (_bersaglio, chiave) =>
        mappa.has(chiave)
          ? { enumerable: true, configurable: true, value: mappa.get(chiave) }
          : undefined,
    },
  );
}

const memoriaVuota = () => ({ tracce: {}, ultime: {}, storia: [], corse: [], giro: 0 });

function memoriaPulita(dato) {
  const d = dato && typeof dato === "object" ? dato : {};
  const oggetto = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  return {
    tracce: oggetto(d.tracce),
    ultime: oggetto(d.ultime),
    storia: Array.isArray(d.storia) ? d.storia.slice(0, STORIA) : [],
    corse: Array.isArray(d.corse) ? d.corse.filter((c) => c && typeof c.id === "string") : [],
    giro: Number(d.giro) || 0,
  };
}

export class Automazioni {
  constructor({
    cartella = "",
    casa = null,
    configurazione = null,
    /* Tutti gli stati della casa, dallo specchio della sentinella: una `Map`
     * `id → {state, attributes, dal}`. */
    stati = () => null,
    notifiche = null,
    licenze = null,
    registro = null,
    adesso = () => Date.now(),
    ogni = (quanto, cosa) => setInterval(cosa, quanto),
    smetti = (segno) => clearInterval(segno),
  } = {}) {
    this._suDisco = Boolean(cartella);
    this.archivio = new Archivio(
      cartella ? join(cartella, "automazioni.json") : "",
      memoriaVuota(),
    );
    this.memoria = memoriaPulita(this.archivio.dati);
    this.casa = casa;
    this.configurazione = configurazione;
    this._stati = stati;
    this.notifiche = notifiche;
    this.licenze = licenze;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this._ogni = ogni;
    this._smetti = smetti;
    this._battito = null;
    this._inCorso = false;
    /* Le corse vive: id dell'automazione → la corsa. Una corsa nuova della
     * stessa automazione prende il posto di quella vecchia (il movimento che
     * torna rimette da capo i due minuti della luce). */
    this._vive = new Map();
    this._sporca = false;
  }

  /* Se le automazioni possono girare: gdahome Premium, o le licenze spente. */
  get sbloccato() {
    try {
      if (!this.licenze?.attive) return true;
      return this.licenze.premium === true;
    } catch (_errore) {
      return false;
    }
  }

  _valori() {
    try {
      return this.configurazione?.leggi?.(PROFILO_PRINCIPALE)?.snapshot?.values || {};
    } catch (_errore) {
      return {};
    }
  }

  /** Le automazioni salvate nella plancia principale, ripulite. */
  elenco() {
    /* Si chiede a ogni cambio di stato della casa — un sensore di potenza ne
     * manda uno al secondo — e si ripulisce solo quando la casella cambia. */
    const crudo = this._valori()[CHIAVE_AUTOMAZIONI];
    if (crudo !== this._crudo || !this._pulite) {
      this._crudo = crudo;
      this._pulite = automazioniPulite(crudo);
    }
    return this._pulite;
  }

  _contesto() {
    const azioni = leggiJson(this._valori().cd_quick_actions);
    return { azioni: Array.isArray(azioni) ? azioni : [], stati: this.stati() };
  }

  stati() {
    try {
      return comeOggetto(this._stati());
    } catch (_errore) {
      return {};
    }
  }

  _salva() {
    this._sporca = false;
    this.archivio.dati = this.memoria;
    if (!this._suDisco) return;
    try {
      this.archivio.salva();
    } catch (errore) {
      this.registro.attenzione(`automazioni non scritte: ${errore?.message || errore}`);
    }
  }

  /* ── l'orologio ───────────────────────────────────────────────────── */

  parti() {
    if (this._battito) return;
    this._riprendiLeCorse();
    this._battito = this._ogni(BATTITO, () => {
      this.battito().catch((errore) =>
        this.registro.attenzione(`automazioni: ${errore?.message || errore}`),
      );
    });
    this._battito?.unref?.();
  }

  ferma() {
    if (this._battito) this._smetti(this._battito);
    this._battito = null;
    for (const disdici of this._eventi?.values() || []) void disdici?.();
    this._eventi?.clear();
  }

  /* Dopo un riavvio: le attese rimaste a meta' tornano vive se la casa e'
   * tornata presto, e si buttano se no. */
  _riprendiLeCorse() {
    const ora = this.adesso();
    const tenute = [];
    for (const corsa of this.memoria.corse) {
      if (ora - Number(corsa.riprendi || 0) > RIPRESA_POSSIBILE) continue;
      const ferma = { ...corsa, ferma: true };
      tenute.push(ferma);
      this._vive.set(ferma.id, ferma);
    }
    if (tenute.length !== this.memoria.corse.length) {
      this.memoria.corse = tenute;
      this._salva();
    }
  }

  /** Un giro: gli orari, le durate, i cronotermostati e le attese finite. */
  async battito() {
    if (this._inCorso) return;
    this._inCorso = true;
    try {
      const ora = this.adesso();
      const giroPrima = this.memoria.giro || null;
      this.memoria.giro = ora;
      if (!this.sbloccato) return;
      const stati = this.stati();
      void this._sincronizzaGliEventi();
      for (const a of this.elenco()) {
        if (!eAttivaAdesso(a, ora)) continue;
        if (a.tipo === "crono") {
          await this._crono(a, stati);
          continue;
        }
        this._valuta(a, { stati, adesso: ora, giroPrima });
      }
      /* Solo le corse ferme a un «aspetta»: quelle appena partite stanno gia'
       * andando avanti da sole, e ripassarle le farebbe due volte. */
      for (const corsa of [...this._vive.values()])
        if (corsa.ferma && Number(corsa.riprendi || 0) <= ora) {
          corsa.ferma = false;
          delete corsa.attende;
          await this._avanza(corsa);
        }
    } finally {
      this._inCorso = false;
      this._salva();
    }
  }

  /* ── i cambi di stato ─────────────────────────────────────────────── */

  /* La sentinella chiama qui a ogni `state_changed` (`index.js`). Non solleva
   * e non aspetta: chi chiama e' il filo con Home Assistant. */
  quandoCambia(id, dopo, prima) {
    try {
      if (!this.sbloccato) return;
      const ora = this.adesso();
      this._liberaChiAttende(id, dopo);
      const elenco = this.elenco().filter((a) => eAttivaAdesso(a, ora));
      if (!elenco.length) return;
      const persona = /^(person|device_tracker)\./.test(String(id));
      let stati = null;
      for (const a of elenco) {
        if (a.tipo === "crono") {
          if (a.crono.finestre.includes(id) || a.crono.termostati.includes(id)) {
            stati ??= this.stati();
            if (a.crono.finestre.includes(id))
              this._crono(a, stati).catch((errore) =>
                this.registro.attenzione(`cronotermostato: ${errore?.message || errore}`),
              );
          }
          continue;
        }
        const riguarda =
          entitaDelQuando(a.quando).includes(id) || (persona && a.quando.tipo === "persone");
        if (!riguarda) continue;
        stati ??= this.stati();
        this._valuta(a, { stati, adesso: ora, cambio: { id, prima, dopo } });
      }
      if (this._sporca) this._salva();
    } catch (errore) {
      this.registro.attenzione(`automazioni: ${errore?.message || errore}`);
    }
  }

  /* «Aspetta finche'…»: un'entita' che diventa lo stato atteso libera la
   * corsa ferma su di lei. Il tempo massimo lo guarda il battito. */
  _liberaChiAttende(id, dopo) {
    for (const corsa of [...this._vive.values()]) {
      const attende = corsa.attende;
      if (!corsa.ferma || !attende || attende.entita !== id) continue;
      if (String(dopo?.state ?? "") !== attende.stato) continue;
      corsa.ferma = false;
      delete corsa.attende;
      this._avanza(corsa).catch((errore) =>
        this.registro.attenzione(`automazione «${corsa.nome}»: ${errore?.message || errore}`),
      );
    }
  }

  /* Gli eventi del bus che servono alle automazioni accese: ci si abbona a
   * quelli, e solo a quelli, e ci si disdice da quelli che non servono piu'.
   * `state_changed` no: e' gia' lo specchio della sentinella, e un'automazione
   * che lo chiedesse riceverebbe tutta la casa. */
  async _sincronizzaGliEventi() {
    if (!this.casa?.ascolta || this._abbonando) return;
    this._eventi ??= new Map();
    const ora = this.adesso();
    const servono = new Set(
      this.sbloccato
        ? this.elenco()
            .filter((a) => eAttivaAdesso(a, ora) && a.quando?.tipo === "evento")
            .map((a) => a.quando.evento)
            .filter((tipo) => tipo && tipo !== "state_changed")
        : [],
    );
    this._abbonando = true;
    try {
      for (const [tipo, disdici] of [...this._eventi]) {
        if (servono.has(tipo)) continue;
        this._eventi.delete(tipo);
        await disdici?.();
      }
      for (const tipo of servono) {
        if (this._eventi.has(tipo)) continue;
        try {
          const disdici = await this.casa.ascolta(
            tipo,
            (evento) => this.quandoEvento(tipo, evento?.data),
            { onCaduto: () => this._eventi?.delete(tipo) },
          );
          this._eventi.set(tipo, disdici);
        } catch (errore) {
          this.registro.attenzione(
            `automazioni: l'evento «${tipo}» non si ascolta (${errore?.message || errore})`,
          );
        }
      }
    } finally {
      this._abbonando = false;
    }
  }

  /** Un evento del bus di Home Assistant, per le automazioni che lo aspettano. */
  quandoEvento(tipo, dati) {
    try {
      if (!this.sbloccato) return;
      const ora = this.adesso();
      let stati = null;
      for (const a of this.elenco()) {
        if (!eAttivaAdesso(a, ora) || a.quando?.tipo !== "evento" || a.quando.evento !== tipo)
          continue;
        stati ??= this.stati();
        this._valuta(a, { stati, adesso: ora, evento: { tipo, dati } });
      }
    } catch (errore) {
      this.registro.attenzione(`automazioni: ${errore?.message || errore}`);
    }
  }

  _valuta(a, { stati, adesso, giroPrima = null, cambio = null, evento = null }) {
    const prima = this.memoria.tracce[a.id] || {};
    const { scatta, traccia } = valutaIlQuando(a.quando, {
      evento,
      cambio,
      stati,
      adesso,
      giroPrima,
      traccia: prima,
    });
    if (JSON.stringify(traccia) !== JSON.stringify(prima)) {
      this.memoria.tracce[a.id] = traccia;
      this._sporca = true;
    }
    if (!scatta) return false;
    /* SOLO SE: guardato nel momento in cui il QUANDO scatta, non dopo. */
    if (!soloSeVale(a.soloSe, { stati, adesso }, a.tutte !== false)) return false;
    this.avvia(a).catch((errore) =>
      this.registro.attenzione(`automazione «${a.nome}»: ${errore?.message || errore}`),
    );
    return true;
  }

  /* ── eseguire ─────────────────────────────────────────────────────── */

  /** Fa partire un'automazione: i passi dell'ALLORA, uno dopo l'altro. */
  async avvia(a) {
    if (!this.sbloccato) return null;
    const ora = this.adesso();
    /* «Non piu' di una volta ogni X minuti»: dall'ultima partenza. */
    const ultima = this.memoria.ultime[a.id];
    if (a.pausa && ultima?.alle && ora - ultima.alle < a.pausa * MINUTO) return null;
    /* Ancora in corso: ignora, o in coda (al piu' tre), o ricomincia. */
    const viva = this._vive.get(a.id);
    if (viva && a.modo === "ignora") return null;
    if (viva && a.modo === "coda") {
      this._code ??= new Map();
      const coda = this._code.get(a.id) || 0;
      if (coda < 3) this._code.set(a.id, coda + 1);
      return null;
    }
    const passi = passiDellAllora(a.allora, this._contesto());
    const corsa = { id: a.id, nome: a.nome, passi, indice: 0, riprendi: ora, partita: ora };
    this._vive.set(a.id, corsa);
    this.memoria.ultime[a.id] = { alle: ora, esito: "in-corso" };
    this._sporca = true;
    await this._avanza(corsa);
    return corsa;
  }

  async _avanza(corsa) {
    /* Una corsa a meta' di un'automazione tolta, spenta, o di una casa che
     * non e' piu' Premium, si ferma li'. */
    const viva = this.elenco().find((a) => a.id === corsa.id);
    if (!viva || !eAttivaAdesso(viva, this.adesso()) || !this.sbloccato) {
      this._chiudi(corsa, "fermata");
      return;
    }
    for (let i = corsa.indice; i < corsa.passi.length; i += 1) {
      if (this._vive.get(corsa.id) !== corsa) return;
      const passo = corsa.passi[i];
      if (passo.aspetta) {
        corsa.indice = i + 1;
        corsa.riprendi = this.adesso() + passo.aspetta;
        corsa.ferma = true;
        this._ricordaLeCorse();
        return;
      }
      /* «Aspetta finche'…»: se e' gia' cosi' si va avanti subito, se no ci si
       * ferma fino allo stato atteso o al tempo massimo. */
      if (passo.attendi) {
        const ora = String(this.stati()[passo.attendi.entita]?.state ?? "");
        if (ora === passo.attendi.stato) continue;
        corsa.indice = i + 1;
        corsa.riprendi = this.adesso() + passo.attendi.per;
        corsa.attende = { entita: passo.attendi.entita, stato: passo.attendi.stato };
        corsa.ferma = true;
        this._ricordaLeCorse();
        return;
      }
      try {
        if (passo.servizio) await this._servizio(passo.servizio);
        else if (passo.notifica) await this._notifica(viva, passo.notifica);
      } catch (errore) {
        this.registro.attenzione(
          `automazione «${viva.nome}»: ${passo.servizio?.domain}.${passo.servizio?.service} non e' andato (${errore?.message || errore})`,
        );
        this._chiudi(corsa, "errore");
        return;
      }
    }
    if (this._vive.get(corsa.id) === corsa) this._chiudi(corsa, "ok");
    /* Chi aspettava in coda parte adesso. */
    const coda = this._code?.get(corsa.id) || 0;
    if (coda > 0) {
      this._code.set(corsa.id, coda - 1);
      await this.avvia(viva);
    }
  }

  async _servizio({ domain, service, data }) {
    await this.casa?.chiedi?.({ type: "call_service", domain, service, service_data: data });
  }

  async _notifica(a, testo) {
    if (!this.notifiche?.consegna) return;
    const titolo = a.nome || "gdahome";
    await this.notifiche.consegna({
      tipo: "personalizzata",
      chiave: `automazione:${a.id}`,
      urgenza: "normale",
      parole: { it: { titolo, testo }, en: { titolo, testo } },
    });
  }

  _chiudi(corsa, esito) {
    if (this._vive.get(corsa.id) === corsa) this._vive.delete(corsa.id);
    if (esito !== "fermata") {
      this.memoria.ultime[corsa.id] = { alle: corsa.partita, esito };
      this.memoria.storia = [
        { id: corsa.id, nome: corsa.nome || "", alle: corsa.partita, esito },
        ...this.memoria.storia.filter((s) => !(s.id === corsa.id && s.alle === corsa.partita)),
      ].slice(0, STORIA);
      if (esito === "ok") this.registro.info(`automazione «${corsa.nome}» eseguita`);
    } else if (this.memoria.ultime[corsa.id]?.esito === "in-corso") {
      this.memoria.ultime[corsa.id] = { alle: corsa.partita, esito: "fermata" };
    }
    this._ricordaLeCorse();
  }

  _ricordaLeCorse() {
    this.memoria.corse = [...this._vive.values()].map((c) => ({
      id: c.id,
      nome: c.nome,
      passi: c.passi,
      indice: c.indice,
      riprendi: c.riprendi,
      partita: c.partita,
      ...(c.attende ? { attende: c.attende } : {}),
    }));
    this._salva();
  }

  /* Il cronotermostato: comanda solo ai passaggi (`cronoDecide`), e si
   * ricorda cosa ha chiesto solo per i comandi andati. */
  async _crono(a, stati) {
    if (!this.sbloccato) return;
    const ora = this.adesso();
    const prima = this.memoria.tracce[a.id] || {};
    const { comandi } = cronoDecide(a.crono, { adesso: ora, stati, traccia: prima });
    if (!comandi.length) return;
    const voluto = { ...(prima.voluto || {}) };
    let esito = "ok";
    for (const comando of comandi) {
      try {
        for (const servizio of comando.servizi) await this._servizio(servizio);
        voluto[comando.entita] = comando.voluto;
      } catch (errore) {
        esito = "errore";
        this.registro.attenzione(
          `cronotermostato «${a.nome}»: ${comando.entita} non risponde (${errore?.message || errore})`,
        );
      }
    }
    this.memoria.tracce[a.id] = { ...prima, voluto };
    this.memoria.ultime[a.id] = { alle: ora, esito };
    this.memoria.storia = [
      { id: a.id, nome: a.nome, alle: ora, esito },
      ...this.memoria.storia,
    ].slice(0, STORIA);
    this._salva();
  }

  /* ── quello che si dice alla plancia ──────────────────────────────── */

  stato() {
    const ora = this.adesso();
    const elenco = this.elenco();
    const stati = this.stati();
    const ids = new Set(elenco.map((a) => a.id));
    return {
      premium: this.sbloccato,
      adesso: ora,
      attive: elenco.filter((a) => eAttivaAdesso(a, ora)).length,
      prossimi: this.sbloccato ? prossimiEventi(elenco, ora, (id) => stati[id] || null) : [],
      ultime: this.memoria.storia.filter((s) => ids.has(s.id)).slice(0, 6),
      perAutomazione: Object.fromEntries(
        Object.entries(this.memoria.ultime).filter(([id]) => ids.has(id)),
      ),
      inCorso: [...this._vive.values()].map((c) => ({ id: c.id, riprendi: c.riprendi })),
    };
  }

  riconosce(tipo) {
    return tipo === COMANDO_DELLO_STATO;
  }

  /* `utente`: chi sta dall'altra parte, gia' riconosciuto dal ponte. Senza un
   * nome non si risponde: e' un comando della plancia, e la plancia la apre
   * qualcuno che Home Assistant conosce. */
  rispondi(detto, { utente = "" } = {}) {
    const id = detto?.id ?? null;
    if (!String(utente || "").trim())
      return {
        id,
        type: "result",
        success: false,
        error: { code: "unauthorized", message: "le automazioni le vede chi e' entrato" },
      };
    if (detto?.type !== COMANDO_DELLO_STATO)
      return {
        id,
        type: "result",
        success: false,
        error: { code: "unknown_command", message: `non conosco ${detto?.type}` },
      };
    try {
      return { id, type: "result", success: true, result: this.stato() };
    } catch (errore) {
      this.registro.errore(`automazioni: ${errore?.message || errore}`);
      return {
        id,
        type: "result",
        success: false,
        error: { code: "ponte_automazioni", message: "non ha funzionato" },
      };
    }
  }
}
