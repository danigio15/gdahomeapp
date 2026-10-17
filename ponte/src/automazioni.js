/* Le automazioni della casa, dal lato dell'add-on.
 *
 * Le automazioni le esegue **Home Assistant**: la plancia le scrive come
 * automazioni vere, che si ritrovano in Impostazioni → Automazioni con il
 * segno «gdahome», e da li' partono anche ad add-on spento. Fino a ieri le
 * eseguiva questo file, con un motore suo che guardava l'orologio ogni venti
 * secondi: due posti dove la casa fa le cose da sola erano un posto di
 * troppo, e chi apriva Home Assistant non le vedeva. Il motore non c'e' piu';
 * l'add-on resta leggero e fa solo quello che la plancia non puo' fare da se':
 *
 *  - **leggere l'elenco**: tutte le automazioni di Home Assistant, dagli stati
 *    `automation.*` dello specchio della sentinella (ognuna col suo `id`),
 *    ognuna con la sua configurazione (`GET /api/config/automation/config/
 *    <id>`), la sua stanza dai registri, e quando e' partita l'ultima volta
 *    (`last_triggered`). La traduzione nella forma della plancia — e se ci
 *    sta, o e' «complessa» — la fa `plancia/src/core/automazioni-ha.js`;
 *  - **scriverle**: salvare, togliere, rinominare, cambiare stanza,
 *    duplicare, con l'API di Home Assistant e il segno dell'add-on
 *    (`casa.api`). Chi salva manda la forma della plancia, mai una
 *    configurazione scritta da lui: la configurazione la scrive il
 *    traduttore, coi servizi che sceglie lui (`servizioPermesso`). E una
 *    complessa non si sovrascrive mai con l'editor della plancia;
 *  - **avvisare i telefoni**: l'azione «avvisa sul telefono» scrive l'evento
 *    `gdahome_avvisa`, e qui lo si ascolta e lo si consegna con la busta
 *    delle notifiche di sempre. Home Assistant non sa niente dei telefoni;
 *  - **le proposte** («Suggerite per la tua casa ✨»), come prima.
 *
 * Accendere, spegnere ed eseguire un'automazione non passa di qui: sono
 * servizi di Home Assistant (`automation.turn_on`, `automation.trigger`), e
 * la plancia li chiama come chiama una luce.
 *
 * ── Chi puo' cosa ─────────────────────────────────────────────────────────
 *
 * Tutti i comandi rispondono solo a chi sul filo ha un utente (`unauthorized`
 * agli altri). Scrivere vuole in piu' **chi amministra Home Assistant** — e'
 * la stessa regola di Home Assistant per la sua pagina delle automazioni: il
 * segno dell'add-on puo' tutto, e non deve diventare la porta di servizio di
 * chi in Home Assistant quella pagina non la vede — e gdahome Premium (o le
 * licenze spente, come nei ponti di prova). La configurazione intera di
 * un'automazione arriva solo a chi amministra; agli altri arriva il racconto.
 * Niente esce di casa: si parla solo con Home Assistant.
 *
 * ── Le proposte ───────────────────────────────────────────────────────────
 *
 * Le regole stanno in `plancia/src/core/automazioni-proposte.js`; qui si
 * raccoglie quello che serve per applicarle, e niente esce di casa:
 *
 *  - le entita' dallo specchio della sentinella, con la stanza dai registri
 *    di Home Assistant (`registri.js`, gia' tenuti da parte per il rapporto,
 *    e `config/area_registry/list`), senza le interne, le nascoste e le
 *    spente;
 *  - la storia delle ultime tre settimane dal Recorder
 *    (`history/history_during_period`), per al piu' quaranta luci, prese e
 *    tapparelle, **una volta al giorno** e solo quando qualcuno apre le
 *    Automazioni: si tiene su disco quello che se ne e' capito, non la storia;
 *  - le luci rimaste accese con la casa vuota, che l'assistente delle
 *    notifiche conta gia' (`capire-la-casa.js`).
 *
 * Uno scarto («No, grazie») vale per la casa, non per il telefono, e si
 * ricorda in `/data/automazioni.json`. Una proposta non scrive niente da
 * sola: «Crea» apre l'editor della plancia, e si salva da li'.
 */

import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { PROFILO_PRINCIPALE } from "./configurazione.js";
import {
  CHIAVE_AUTOMAZIONI,
  MINUTO,
  automazionePulita,
  automazioniPulite,
  eCompleta,
} from "../plancia/src/core/automazioni.js";
import {
  EVENTO_AVVISA,
  categoriaDi,
  dallaHomeAssistant,
  idBuono,
  inHomeAssistant,
  nuovoIdHA,
  origineDi,
} from "../plancia/src/core/automazioni-ha.js";
import {
  ENTITA_GUARDATE,
  GIORNI_DI_STORIA,
  proposteDaMostrare,
  proposteDaiDispositivi,
  proposteDalleAbitudini,
} from "../plancia/src/core/automazioni-proposte.js";

export const COMANDO_DELLO_STATO = "ponte/automazioni/stato";
export const COMANDO_DEL_SALVA = "ponte/automazioni/salva";
export const COMANDO_DELL_ELIMINA = "ponte/automazioni/elimina";
export const COMANDO_DEL_RINOMINA = "ponte/automazioni/rinomina";
export const COMANDO_DEL_DUPLICA = "ponte/automazioni/duplica";
export const COMANDO_DELLE_PROPOSTE = "ponte/automazioni/proposte";
export const COMANDO_DELLO_SCARTO = "ponte/automazioni/proposte/scarta";

/** Tutti i comandi delle automazioni: li riconosce `commissioni.js`. */
export const COMANDI_DELLE_AUTOMAZIONI = Object.freeze([
  COMANDO_DELLO_STATO,
  COMANDO_DEL_SALVA,
  COMANDO_DELL_ELIMINA,
  COMANDO_DEL_RINOMINA,
  COMANDO_DEL_DUPLICA,
  COMANDO_DELLE_PROPOSTE,
  COMANDO_DELLO_SCARTO,
]);
/* Quelli che scrivono in Home Assistant. */
const SCRIVONO = new Set([
  COMANDO_DEL_SALVA,
  COMANDO_DELL_ELIMINA,
  COMANDO_DEL_RINOMINA,
  COMANDO_DEL_DUPLICA,
]);

/* La storia si rilegge una volta al giorno; le stanze e le entita' ogni
 * cinque minuti, come i registri. Chi apre le Automazioni non aspetta la
 * storia piu' di qualche secondo: se tarda, le abitudini arrivano la volta
 * dopo. */
const ABITUDINI_DURANO = 24 * 60 * MINUTO;
const AREE_DURANO = 5 * MINUTO;
const ATTESA_DELLA_STORIA = 8_000;
/* I «No, grazie» che si ricordano, al piu'. */
const SCARTATE_AL_MASSIMO = 300;

/* Una configurazione letta vale mezzo minuto: la plancia chiede l'elenco
 * quando si apre e dopo ogni salvataggio, e una casa con cento automazioni
 * non deve fare cento domande ogni volta. Si leggono sei per volta. */
const CONFIG_DURA = 30_000;
const INSIEME = 6;

/* Gli avvisi da Home Assistant ai telefoni: al piu' trenta ogni dieci
 * minuti. Un'automazione scritta male che avvisa a ogni lettura di un
 * sensore non deve far vibrare un telefono ogni secondo. */
const AVVISI_AL_MASSIMO = 30;
const FINESTRA_DEGLI_AVVISI = 10 * MINUTO;
/* Ogni quanto si controlla di essere ancora in ascolto degli avvisi. */
const ASCOLTO = 60_000;

/* La storia del Recorder com'e' sul socket: `{id: [{s, lu}]}` (la forma
 * stretta, `minimal_response`) o `{id: [{state, last_changed}]}`. Torna
 * `{id: [[ms, stato], …]}` in ordine. */
export function storieDallaRisposta(risposta) {
  const fuori = {};
  const crudo = risposta && typeof risposta === "object" ? risposta : {};
  for (const [id, righe] of Object.entries(crudo)) {
    if (!Array.isArray(righe)) continue;
    const storia = [];
    for (const r of righe) {
      if (!r || typeof r !== "object") continue;
      const stato = r.s ?? r.state;
      const quando =
        typeof (r.lc ?? r.lu) === "number"
          ? (r.lc ?? r.lu) * 1000
          : Date.parse(r.last_changed || r.last_updated || "");
      if (stato === undefined || !Number.isFinite(quando)) continue;
      storia.push([quando, String(stato)]);
    }
    storia.sort((a, b) => a[0] - b[0]);
    if (storia.length) fuori[id] = storia;
  }
  return fuori;
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

function leggiJson(valore) {
  if (typeof valore !== "string") return valore ?? null;
  try {
    return JSON.parse(valore);
  } catch (_errore) {
    return null;
  }
}

const memoriaVuota = () => ({ scartate: [], abitudini: null });

function memoriaPulita(dato) {
  const d = dato && typeof dato === "object" ? dato : {};
  return {
    scartate: Array.isArray(d.scartate)
      ? d.scartate.filter((x) => typeof x === "string").slice(-SCARTATE_AL_MASSIMO)
      : [],
    abitudini:
      d.abitudini && Array.isArray(d.abitudini.proposte) && Number(d.abitudini.il)
        ? { il: Number(d.abitudini.il), proposte: d.abitudini.proposte }
        : null,
  };
}

const no = (id, code, message) => ({
  id,
  type: "result",
  success: false,
  error: { code, message },
});
const si = (id, result) => ({ id, type: "result", success: true, result });

export class Automazioni {
  constructor({
    cartella = "",
    casa = null,
    configurazione = null,
    /* Tutti gli stati della casa, dallo specchio della sentinella: una `Map`
     * `id → {state, attributes}`. */
    stati = () => null,
    notifiche = null,
    licenze = null,
    /* I registri di Home Assistant (`registri.js`): le stanze. */
    registri = null,
    /* Le luci rimaste accese con la casa vuota, giorno per giorno: quello
     * che conta l'assistente delle notifiche (`capire-la-casa.js`). */
    luciConCasaVuota = () => null,
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
    this.registri = registri;
    this._luciConCasaVuota = luciConCasaVuota;
    this._aree = null;
    this._storiaInCorso = null;
    this._configurazioni = new Map();
    this._avvisiDetti = [];
    this._ascolto = null;
    this._disdici = null;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this._ogni = ogni;
    this._smetti = smetti;
  }

  /* Se si possono scrivere e avvisare: gdahome Premium, o le licenze spente. */
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

  /* Le automazioni rimaste nella configurazione della plancia, dalla
   * versione di prova che le eseguiva qui: la plancia invita a convertirle,
   * e finche' non lo si fa restano li', ferme. */
  rimasteNellaPlancia() {
    return automazioniPulite(this._valori()[CHIAVE_AUTOMAZIONI]);
  }

  _azioni() {
    const azioni = leggiJson(this._valori().cd_quick_actions);
    return Array.isArray(azioni) ? azioni : [];
  }

  stati() {
    try {
      return comeOggetto(this._stati());
    } catch (_errore) {
      return {};
    }
  }

  _salva() {
    this.archivio.dati = this.memoria;
    if (!this._suDisco) return;
    try {
      this.archivio.salva();
    } catch (errore) {
      this.registro.attenzione(`automazioni non scritte: ${errore?.message || errore}`);
    }
  }

  /* ── gli avvisi da Home Assistant ─────────────────────────────────── */

  parti() {
    if (this._ascolto) return;
    void this._ascoltaGliAvvisi();
    this._ascolto = this._ogni(ASCOLTO, () => void this._ascoltaGliAvvisi());
    this._ascolto?.unref?.();
  }

  ferma() {
    if (this._ascolto) this._smetti(this._ascolto);
    this._ascolto = null;
    const disdici = this._disdici;
    this._disdici = null;
    void disdici?.();
  }

  /* Ci si abbona a `gdahome_avvisa`, e solo a lui. Se il filo cade
   * l'abbonamento cade con lui, e il giro dopo lo rifa'. */
  async _ascoltaGliAvvisi() {
    if (this._disdici || this._abbonando || !this.casa?.ascolta) return;
    this._abbonando = true;
    try {
      this._disdici = await this.casa.ascolta(
        EVENTO_AVVISA,
        (evento) => {
          void this.avvisa(evento?.data).catch((errore) =>
            this.registro.attenzione(`avviso di un'automazione: ${errore?.message || errore}`),
          );
        },
        {
          onCaduto: () => {
            this._disdici = null;
          },
        },
      );
    } catch (errore) {
      this.registro.debug?.(
        `gli avvisi delle automazioni non si ascoltano: ${errore?.message || errore}`,
      );
    } finally {
      this._abbonando = false;
    }
  }

  /** Un avviso scritto da un'automazione: ai telefoni, con la busta di sempre. */
  async avvisa(dati) {
    if (!this.sbloccato || !this.notifiche?.consegna) return false;
    const d = dati && typeof dati === "object" ? dati : {};
    const testo = String(d.testo ?? "")
      .trim()
      .slice(0, 300);
    if (!testo) return false;
    const titolo =
      String(d.titolo ?? "")
        .trim()
        .slice(0, 80) || "gdahome";
    const ora = this.adesso();
    this._avvisiDetti = this._avvisiDetti.filter((t) => ora - t < FINESTRA_DEGLI_AVVISI);
    if (this._avvisiDetti.length >= AVVISI_AL_MASSIMO) return false;
    this._avvisiDetti.push(ora);
    await this.notifiche.consegna({
      tipo: "personalizzata",
      chiave: `automazione:${titolo}`,
      urgenza: "normale",
      parole: { it: { titolo, testo }, en: { titolo, testo } },
    });
    return true;
  }

  /* ── l'elenco di Home Assistant ───────────────────────────────────── */

  async _api(metodo, percorso, corpo) {
    if (!this.casa?.api) throw new Error("Home Assistant non si raggiunge");
    return this.casa.api(metodo, percorso, corpo);
  }

  /* La configurazione di un'automazione, o `null` se Home Assistant non la
   * da' (una scritta in un pacchetto YAML, fuori da `automations.yaml`). */
  async _configDi(id, { forza = false } = {}) {
    const ora = this.adesso();
    const tenuta = this._configurazioni.get(id);
    if (!forza && tenuta && ora - tenuta.il < CONFIG_DURA) return tenuta.config;
    let config = null;
    try {
      config = await this._api("GET", `config/automation/config/${encodeURIComponent(id)}`);
    } catch (errore) {
      if (errore?.status !== 404 && errore?.status !== 400) throw errore;
      config = null;
    }
    const buona = config && typeof config === "object" && !Array.isArray(config) ? config : null;
    this._configurazioni.set(id, { il: ora, config: buona });
    return buona;
  }

  /* Le stanze, per nome: `{area_id: nome}`. */
  async _nomiDelleAree() {
    const ora = this.adesso();
    if (this._aree && ora - this._aree.il < AREE_DURANO) return this._aree.nomi;
    const nomi = {};
    try {
      const elenco = await this.casa?.chiedi?.({ type: "config/area_registry/list" });
      for (const a of Array.isArray(elenco) ? elenco : [])
        if (a?.area_id) nomi[a.area_id] = String(a.name || a.area_id);
    } catch (errore) {
      this.registro.debug?.(`le stanze non si leggono: ${errore?.message || errore}`);
    }
    this._aree = { il: ora, nomi };
    return nomi;
  }

  async _registri() {
    try {
      return (await this.registri?.chiedi?.()) || null;
    } catch (errore) {
      this.registro.debug?.(`i registri non si leggono: ${errore?.message || errore}`);
      return null;
    }
  }

  /**
   * Tutte le automazioni di Home Assistant, pronte per la plancia. Con
   * `conConfig` ognuna porta la sua configurazione intera (per chi
   * amministra); senza, solo il racconto.
   */
  async elencoDiCasa({ conConfig = false } = {}) {
    const mappa = this._stati();
    if (!mappa || typeof mappa.entries !== "function") return [];
    const stati = comeOggetto(mappa);
    const statoDi = (id) => mappa.get(id) ?? null;
    const voci = [...mappa.entries()].filter(([id]) => String(id).startsWith("automation."));
    const ids = voci.map(([, s]) => String(s?.attributes?.id ?? "").trim()).filter(idBuono);
    const configurazioni = new Map();
    for (let i = 0; i < ids.length; i += INSIEME) {
      const giro = ids.slice(i, i + INSIEME);
      const lette = await Promise.all(
        giro.map((id) =>
          this._configDi(id).catch((errore) => {
            this.registro.debug?.(`l'automazione ${id} non si legge: ${errore?.message || errore}`);
            return null;
          }),
        ),
      );
      giro.forEach((id, j) => configurazioni.set(id, lette[j]));
    }
    const registri = await this._registri();
    const nomiDelleAree = await this._nomiDelleAree();
    const areaDelDispositivo = new Map();
    for (const d of Array.isArray(registri?.dispositivi) ? registri.dispositivi : [])
      if (d?.id) areaDelDispositivo.set(d.id, d.area_id || "");
    const voceDi = new Map();
    for (const v of Array.isArray(registri?.entita) ? registri.entita : [])
      if (v?.entity_id) voceDi.set(v.entity_id, v);
    const azioni = this._azioni();
    const fuori = [];
    for (const [entity, s] of voci) {
      const attributi = s?.attributes || {};
      const id = String(attributi.id ?? "").trim();
      const config = idBuono(id) ? (configurazioni.get(id) ?? null) : null;
      const voce = voceDi.get(entity);
      const areaId = voce?.area_id || areaDelDispositivo.get(voce?.device_id) || "";
      const attiva = String(s?.state) === "on";
      let modello = null;
      try {
        modello = config ? dallaHomeAssistant(config, { statoDi, azioni, stati }) : null;
      } catch (_errore) {
        modello = null;
      }
      const ultima = Date.parse(attributi.last_triggered || "");
      fuori.push({
        entity_id: entity,
        id: idBuono(id) ? id : "",
        nome: String(attributi.friendly_name || config?.alias || entity),
        attiva,
        ultima: Number.isFinite(ultima) ? ultima : null,
        area: areaId ? nomiDelleAree[areaId] || "" : "",
        areaId,
        categoria: config ? categoriaDi(config, statoDi) : "altre",
        origine: origineDi(config),
        modello: modello ? { ...modello, attiva } : null,
        /* Si modifica dalla plancia solo se Home Assistant ne da' la
         * configurazione: una scritta in un pacchetto YAML si guarda e basta. */
        modificabile: Boolean(config),
        config: conConfig ? config : null,
      });
    }
    return fuori.sort((a, b) => a.nome.localeCompare(b.nome));
  }

  async _modelliPerLeProposte() {
    let diCasa = [];
    try {
      diCasa = (await this.elencoDiCasa()).map((v) => v.modello).filter(Boolean);
    } catch (_errore) {
      diCasa = [];
    }
    return [...this.rimasteNellaPlancia(), ...diCasa];
  }

  async stato({ amministra = false } = {}) {
    const nomi = await this._nomiDelleAree();
    return {
      premium: this.sbloccato,
      /* Chi puo' scrivere: chi amministra Home Assistant, con Premium. */
      puoScrivere: amministra === true && this.sbloccato,
      adesso: this.adesso(),
      automazioni: await this.elencoDiCasa({ conConfig: amministra === true }),
      aree: Object.entries(nomi)
        .map(([id, nome]) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
      rimasteNellaPlancia: this.rimasteNellaPlancia().length,
    };
  }

  /* ── scrivere in Home Assistant ───────────────────────────────────── */

  _dimentica(id) {
    this._configurazioni.delete(id);
  }

  _entitaDi(id) {
    const mappa = this._stati();
    if (!mappa || typeof mappa.entries !== "function") return "";
    for (const [entity, s] of mappa.entries())
      if (String(entity).startsWith("automation.") && String(s?.attributes?.id ?? "") === id)
        return entity;
    return "";
  }

  /** Salva un'automazione della plancia come automazione di Home Assistant. */
  async salva({ automazione, id = "" } = {}) {
    const esistente = idBuono(id) ? String(id).trim() : "";
    const a = automazionePulita({
      ...(automazione && typeof automazione === "object" ? automazione : {}),
      id: esistente || nuovoIdHA(this.adesso()),
    });
    if (!a || !eCompleta(a))
      return { errore: "invalid_format", perche: "l'automazione non sta in piedi" };
    let descrizione = null;
    if (esistente) {
      const prima = await this._configDi(esistente, { forza: true });
      if (prima) {
        /* Una complessa non si sovrascrive con l'editor della plancia: ne
         * perderebbe un pezzo senza dirlo. */
        const stati = this.stati();
        if (
          !dallaHomeAssistant(prima, {
            statoDi: (x) => stati[x] ?? null,
            azioni: this._azioni(),
            stati,
          })
        )
          return {
            errore: "complessa",
            perche: "questa automazione si modifica in Home Assistant",
          };
        descrizione = typeof prima.description === "string" ? prima.description : "";
      }
    }
    const config = inHomeAssistant(a, { azioni: this._azioni(), stati: this.stati(), descrizione });
    if (!config) return { errore: "invalid_format", perche: "l'automazione non sta in piedi" };
    await this._api("POST", `config/automation/config/${encodeURIComponent(a.id)}`, config);
    this._dimentica(a.id);
    this.registro.info(`automazione «${config.alias}» salvata in Home Assistant`);
    return { id: a.id, alias: config.alias };
  }

  async elimina({ id = "" } = {}) {
    if (!idBuono(id)) return { errore: "invalid_format", perche: "quale automazione?" };
    await this._api("DELETE", `config/automation/config/${encodeURIComponent(id)}`);
    this._dimentica(id);
    return { id };
  }

  /* Il nome e la stanza: valgono anche per le complesse, perche' non
   * toccano quello che fanno. Il nome sta nella configurazione, la stanza
   * nel registro delle entita'. */
  async rinomina({ id = "", nome = undefined, area = undefined } = {}) {
    if (!idBuono(id)) return { errore: "invalid_format", perche: "quale automazione?" };
    if (typeof nome === "string") {
      const alias = nome.trim().slice(0, 100);
      if (!alias) return { errore: "invalid_format", perche: "serve un nome" };
      const config = await this._configDi(id, { forza: true });
      if (!config) return { errore: "not_found", perche: "Home Assistant non la da'" };
      await this._api("POST", `config/automation/config/${encodeURIComponent(id)}`, {
        ...config,
        alias,
      });
      this._dimentica(id);
    }
    if (typeof area === "string") {
      const entity = this._entitaDi(id);
      if (!entity) return { errore: "not_found", perche: "l'automazione non c'e'" };
      await this.casa.chiedi({
        type: "config/entity_registry/update",
        entity_id: entity,
        area_id: area.trim() || null,
      });
      this.registri?.dimentica?.();
    }
    return { id };
  }

  async duplica({ id = "" } = {}) {
    if (!idBuono(id)) return { errore: "invalid_format", perche: "quale automazione?" };
    const config = await this._configDi(id, { forza: true });
    if (!config) return { errore: "not_found", perche: "Home Assistant non la da'" };
    const nuovo = nuovoIdHA(this.adesso());
    const alias = `${String(config.alias || "").trim() || "gdahome"} (copia)`.slice(0, 100);
    await this._api("POST", `config/automation/config/${encodeURIComponent(nuovo)}`, {
      ...config,
      id: nuovo,
      alias,
    });
    return { id: nuovo, alias };
  }

  /* ── le proposte ──────────────────────────────────────────────────── */

  /* Le stanze, per nome: `{area_id: nome}`. */
  async _nomiDelleAree() {
    const ora = this.adesso();
    if (this._aree && ora - this._aree.il < AREE_DURANO) return this._aree.nomi;
    const nomi = {};
    try {
      const elenco = await this.casa?.chiedi?.({ type: "config/area_registry/list" });
      for (const a of Array.isArray(elenco) ? elenco : [])
        if (a?.area_id) nomi[a.area_id] = String(a.name || a.area_id);
    } catch (errore) {
      this.registro.debug?.(`le stanze non si leggono: ${errore?.message || errore}`);
    }
    this._aree = { il: ora, nomi };
    return nomi;
  }

  /** Le entita' della casa che contano: `[{id, nome, area, classe, unita}]`. */
  async entitaDellaCasa() {
    const stati = this._stati();
    if (!stati || typeof stati.entries !== "function") return [];
    let registri = null;
    try {
      registri = await this.registri?.chiedi?.();
    } catch (errore) {
      this.registro.debug?.(`i registri non si leggono: ${errore?.message || errore}`);
    }
    const nomiDelleAree = await this._nomiDelleAree();
    const areaDelDispositivo = new Map();
    for (const d of Array.isArray(registri?.dispositivi) ? registri.dispositivi : [])
      if (d?.id) areaDelDispositivo.set(d.id, d.area_id || "");
    const voci = new Map();
    for (const v of Array.isArray(registri?.entita) ? registri.entita : [])
      if (v?.entity_id) voci.set(v.entity_id, v);
    const fuori = [];
    for (const [id, stato] of stati.entries()) {
      const voce = voci.get(id);
      /* Le interne (diagnostica, configurazione), le nascoste e le spente
       * non si propongono: nessuno vuole un'automazione sul segnale WiFi. */
      if (voce && (voce.entity_category || voce.hidden_by || voce.disabled_by)) continue;
      const areaId = voce?.area_id || areaDelDispositivo.get(voce?.device_id) || "";
      const attributi = stato?.attributes || {};
      fuori.push({
        id,
        nome: String(attributi.friendly_name || voce?.name || voce?.original_name || ""),
        area: areaId ? nomiDelleAree[areaId] || "" : "",
        classe: String(
          attributi.device_class || voce?.device_class || voce?.original_device_class || "",
        ),
        unita: String(attributi.unit_of_measurement || ""),
      });
    }
    return fuori;
  }

  /* Le abitudini dalla storia: una volta al giorno, una lettura per volta.
   * Si tiene quello che se ne e' capito, non la storia. */
  _abitudiniDallaStoria(entita) {
    const ora = this.adesso();
    const tenute = this.memoria.abitudini;
    if (tenute && ora - tenute.il < ABITUDINI_DURANO) return Promise.resolve(tenute.proposte);
    if (this._storiaInCorso) return this._storiaInCorso;
    const ordine = { light: 0, cover: 1, switch: 2 };
    const guardate = entita
      .filter((e) => e.id.split(".")[0] in ordine)
      .sort((a, b) => ordine[a.id.split(".")[0]] - ordine[b.id.split(".")[0]])
      .slice(0, ENTITA_GUARDATE)
      .map((e) => e.id);
    this._storiaInCorso = (async () => {
      let proposte = [];
      if (guardate.length && this.casa?.chiedi) {
        const risposta = await this.casa.chiedi({
          type: "history/history_during_period",
          start_time: new Date(ora - GIORNI_DI_STORIA * 24 * 60 * MINUTO).toISOString(),
          end_time: new Date(ora).toISOString(),
          entity_ids: guardate,
          minimal_response: true,
          no_attributes: true,
          significant_changes_only: false,
        });
        const stati = this.stati();
        proposte = proposteDalleAbitudini({
          storie: storieDallaRisposta(risposta),
          entita,
          adesso: ora,
          statoDi: (id) => stati[id] || null,
        });
      }
      this.memoria.abitudini = { il: ora, proposte };
      this._salva();
      return proposte;
    })()
      .catch((errore) => {
        /* La storia che non risponde si riprova fra un'ora, non al prossimo
         * giro: il Recorder spento non deve diventare una domanda al minuto. */
        this.registro.attenzione(`proposte: la storia non si legge (${errore?.message || errore})`);
        this.memoria.abitudini = {
          il: ora - ABITUDINI_DURANO + 60 * MINUTO,
          proposte: tenute?.proposte || [],
        };
        return this.memoria.abitudini.proposte;
      })
      .finally(() => {
        this._storiaInCorso = null;
      });
    return this._storiaInCorso;
  }

  /** Le proposte da mostrare: dai dispositivi e dalle abitudini. */
  async proposte({ attesa = ATTESA_DELLA_STORIA } = {}) {
    const entita = await this.entitaDellaCasa();
    const dalla = this._abitudiniDallaStoria(entita);
    let abitudini = this.memoria.abitudini?.proposte || [];
    let pronte = true;
    let segno = null;
    const tardi = new Promise((risolvi) => {
      segno = setTimeout(() => risolvi(null), attesa);
      segno?.unref?.();
    });
    const arrivate = await Promise.race([dalla, tardi]);
    clearTimeout(segno);
    if (arrivate) abitudini = arrivate;
    else pronte = false;
    let luci = null;
    try {
      luci = this._luciConCasaVuota?.() || null;
    } catch (_errore) {
      luci = null;
    }
    const tutte = [
      ...proposteDaiDispositivi({ entita }),
      ...abitudini,
      ...proposteDalleAbitudini({ luciConCasaVuota: luci || {}, adesso: this.adesso() }),
    ];
    return {
      proposte: proposteDaMostrare(tutte, {
        automazioni: await this._modelliPerLeProposte(),
        scartate: this.memoria.scartate,
      }),
      abitudiniDel: this.memoria.abitudini?.il || null,
      abitudiniPronte: pronte,
      giorni: GIORNI_DI_STORIA,
    };
  }

  /** «No, grazie»: quella proposta non torna piu'. */
  scarta(idProposta) {
    const id = String(idProposta || "").trim();
    if (!id || id.length > 200) return false;
    if (!this.memoria.scartate.includes(id)) {
      this.memoria.scartate = [...this.memoria.scartate, id].slice(-SCARTATE_AL_MASSIMO);
      this._salva();
    }
    return true;
  }

  riconosce(tipo) {
    return COMANDI_DELLE_AUTOMAZIONI.includes(tipo);
  }

  /* `utente`: chi sta dall'altra parte, gia' riconosciuto dal ponte. Senza un
   * nome non si risponde. `amministra`: se amministra Home Assistant — lo
   * decide chi sta sul filo (`ponte.js`, `cucitura.js`), e vale solo `true`. */
  async rispondi(detto, { utente = "", amministra = false } = {}) {
    const id = detto?.id ?? null;
    if (!String(utente || "").trim())
      return no(id, "unauthorized", "le automazioni le vede chi e' entrato");
    const tipo = detto?.type;
    if (!this.riconosce(tipo)) return no(id, "unknown_command", `non conosco ${tipo}`);
    if (SCRIVONO.has(tipo)) {
      if (amministra !== true)
        return no(id, "unauthorized", "le automazioni le cambia chi amministra Home Assistant");
      if (!this.sbloccato)
        return no(id, "premium-richiesto", "le automazioni sono di gdahome Premium");
    }
    try {
      if (tipo === COMANDO_DELLE_PROPOSTE) return si(id, await this.proposte());
      if (tipo === COMANDO_DELLO_SCARTO) {
        if (!this.scarta(detto.proposta)) return no(id, "invalid_format", "quale proposta?");
        return si(id, await this.proposte({ attesa: 0 }));
      }
      if (tipo === COMANDO_DELLO_STATO) return si(id, await this.stato({ amministra }));
      const fatto =
        tipo === COMANDO_DEL_SALVA
          ? await this.salva({ automazione: detto.automazione, id: detto.automazione_id })
          : tipo === COMANDO_DELL_ELIMINA
            ? await this.elimina({ id: detto.automazione_id })
            : tipo === COMANDO_DEL_RINOMINA
              ? await this.rinomina({
                  id: detto.automazione_id,
                  nome: detto.nome,
                  area: detto.area,
                })
              : await this.duplica({ id: detto.automazione_id });
      if (fatto?.errore) return no(id, fatto.errore, fatto.perche);
      return si(id, fatto);
    } catch (errore) {
      this.registro.errore(`automazioni: ${errore?.message || errore}`);
      /* Il perche' di Home Assistant («Message malformed: …») e' la sola
       * spiegazione che chi salva puo' capire; un guasto nostro no. */
      const diHA = String(errore?.code || "").startsWith("http_");
      return no(id, "ponte_automazioni", diHA ? String(errore.message) : "non ha funzionato");
    }
  }
}
