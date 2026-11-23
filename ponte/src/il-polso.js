/* Il polso: un orologio che si e' abbinato da se', e che chiede due cose.
 *
 * L'Apple Watch e Wear OS la casa non la toccano: chiedono tutto all'app sul
 * telefono, che ha le chiavi (`IlTramiteDellOrologio.kt`, `LOrologio.swift`).
 * Un Amazfit non puo': la sua parte sul telefono gira dentro l'app Zepp, e
 * dall'app Zepp all'app GdAHome non c'e' nessuna porta. Allora si abbina come
 * un telefono in piu' — lo stesso codice di «Abbina un telefono», la stessa
 * stretta di mano (`portiere.js`), una chiave del filo solo sua — e la casa
 * lo segna come orologio (`dispositivi.js`, `polso`).
 *
 * Da li' in poi il portiere non lo consegna al ponte, che parla il protocollo
 * di Home Assistant: lo consegna qui, dove si capiscono due domande sole.
 *
 *     orologio → casa   {n, t:"foto"}
 *     orologio → casa   {n, t:"comando", id, cosa:"gira"|"luminosita"|"azione", valore?}
 *     casa → orologio   {n, ok:true, foto}
 *     casa → orologio   {n, ok, testo, foto?}
 *
 * Con la chiave di un orologio non si legge nient'altro della casa e non si
 * chiama nient'altro: niente `get_states`, niente servizi a scelta, niente
 * plancia. La fotografia e' la stessa ridotta che il telefono porta agli
 * altri orologi (`IlTramiteDellOrologio.kt`), con le stesse regole — le scrive
 * la plancia in `la-foto-per-lauto.js`, e qui si usano quelle, non una copia —
 * piu' la luminosita' delle luci che la sanno dire. I comandi sono le ricette
 * di quella stessa fotografia, rifatte a ogni comando sulla configurazione di
 * adesso: un tasto che non c'e' piu' non parte. Serrature e antifurto mai,
 * come nelle ricette dell'orologio (`app/lib/auto/la_foto.dart`,
 * `dominiMaiDaUnaRicetta`).
 *
 * Fuori casa con gdahome Base l'orologio resta fuori come un telefono: lo
 * decide il portiere alla prima parola, prima ancora di arrivare qui.
 */

import {
  iDispositiviPerLAuto,
  laFotoPerLAuto,
  leRicettePerLAuto,
} from "../plancia/src/core/la-foto-per-lauto.js";
import { normalizeSecurityDoors } from "../plancia/src/core/security-door-model.js";
import { preseConfigurate } from "../plancia/src/core/prese-model.js";
import { PROFILO_PRINCIPALE } from "./configurazione.js";
import { laVede } from "./plance.js";

/* Quello che dal polso non parte mai, ne' come dispositivo ne' come azione:
 * la stessa regola delle ricette dell'orologio e dell'auto. */
export const DOMINI_MAI_DAL_POLSO = Object.freeze(new Set(["lock", "alarm_control_panel"]));

/* Quante domande puo' fare un orologio in una finestra: guarda ogni venti
 * secondi e preme qualche tasto. Una raffica e' un orologio guasto, o
 * qualcuno che non e' un orologio. */
const DOMANDE_NELLA_FINESTRA = 20;
const FINESTRA_DELLE_DOMANDE = 10_000;

/* Quanto si aspetta, dopo un comando, prima di guardare la casa: una luce ci
 * mette un attimo a dire il suo stato nuovo, e la fotografia che torna col
 * «Fatto» deve gia' dirlo (`IlTramiteDellOrologio.kt`, `conLaFoto`). */
const ATTESA_DOPO_IL_COMANDO = 700;

/* Per quanto si tiene il nome della casa chiesto a Home Assistant. */
const NOME_DELLA_CASA_VALE = 10 * 60 * 1000;

const CHIUSA_PER_REGOLA = 1008;

const pulito = (valore) => String(valore ?? "").trim();

const json = (valore, ripiego) => {
  if (valore && typeof valore === "object") return valore;
  try {
    return JSON.parse(String(valore ?? "")) ?? ripiego;
  } catch (_errore) {
    return ripiego;
  }
};

/* Le parole delle righe. In auto le scrive la tessera della plancia, nella
 * lingua di chi guarda; qui la plancia non gira, e si scrivono come le scrive
 * lei in italiano (`la-foto-va-in-auto-section.js`, `laParola`). */
function laParola(genere, acceso) {
  if (genere === "porta" || genere === "varco") return acceso ? "Aperto" : "Chiuso";
  return acceso ? "Accesa" : "Spenta";
}

const E_APERTO = /^(on|open|opened|opening|unlocked)$/;

/* Le luci che sanno dire quanto sono accese: tutte quelle che hanno un modo
 * di colore diverso da «acceso o spento». */
function siAbbassa(stato) {
  const modi = stato?.attributes?.supported_color_modes;
  if (!Array.isArray(modi)) return Number.isFinite(Number(stato?.attributes?.brightness));
  return modi.some((modo) => modo && modo !== "onoff");
}

/* Un numero di Home Assistant scritto per chi guarda: «3,2 kW», «86 %». */
function unaMisura(stato) {
  const numero = Number(stato?.state);
  if (!Number.isFinite(numero)) return "";
  const unita = pulito(stato?.attributes?.unit_of_measurement);
  const virgola = (n, cifre) => n.toFixed(cifre).replace(".", ",");
  if (unita === "W") {
    return Math.abs(numero) >= 1000 ? `${virgola(numero / 1000, 1)} kW` : `${Math.round(numero)} W`;
  }
  if (unita === "kW") return `${virgola(numero, 1)} kW`;
  if (unita === "%") return `${Math.round(numero)} %`;
  return unita ? `${virgola(numero, 1)} ${unita}` : virgola(numero, 1);
}

/* Le misure dell'energia scelte nella plancia (le caselle dell'Energia in
 * `cd_entity_overrides`): quante ne servono a «La casa», e nient'altro. */
const LE_MISURE = Object.freeze([
  ["Produzione", "dm.energy_potenza_fotovoltaico"],
  ["Consumo", "dm.energy_potenza_consumo_casa"],
  ["Batteria", "dm.energy_stato_carica_batteria"],
]);

/**
 * La fotografia per il polso, dai valori di una plancia e dagli stati di
 * Home Assistant. Pura: entra quello che c'e', esce la fotografia e le
 * ricette per eseguirne i tasti. Le ricette non escono mai di casa.
 */
export function fotografaPerIlPolso({
  valori = {},
  stati = [],
  casa = "",
  premium = true,
  adesso = Date.now(),
} = {}) {
  const perEntita = new Map();
  for (const stato of Array.isArray(stati) ? stati : []) {
    if (stato && typeof stato.entity_id === "string") perEntita.set(stato.entity_id, stato);
  }
  const sostituzioni = json(valori.cd_entity_overrides, {}) || {};
  const soloLettura = json(valori.cd_solo_lettura, {}) || {};
  /* Le caselle `dm.…` della plancia diventano l'entita' che c'e' scritta
   * dentro; un'entita' vera resta com'e'. */
  const vera = (scritta) => {
    const id = pulito(scritta);
    if (id.startsWith("dm.")) return pulito(sostituzioni[id]);
    return id;
  };

  /* ─── I candidati, come li raccoglie la plancia ─────────────────────── */
  const candidati = [];
  const aggiungi = (entita, nome, genere) => {
    const id = vera(entita);
    const stato = perEntita.get(id);
    /* Assente non e' spento: una riga che non si sa com'e' non si mostra. */
    if (!stato || stato.state === "unavailable" || stato.state === "unknown") return;
    const acceso = E_APERTO.test(pulito(stato.state).toLowerCase());
    candidati.push({
      entity: id,
      nome: pulito(nome) || pulito(stato.attributes?.friendly_name) || id,
      genere,
      acceso,
      stato: laParola(genere, acceso),
      /* «Si vede ma non si comanda», come nella plancia (`siComanda`). */
      comando: soloLettura[id] !== true,
    });
  };
  for (const porta of normalizeSecurityDoors(json(valori.cd_security_doors, []))) {
    aggiungi(porta.entity, porta.name, "porta");
  }
  for (const [entita, nome] of Object.entries(json(valori.cd_luci, {}) || {})) {
    if (entita.includes(".")) aggiungi(entita, typeof nome === "string" ? nome : "", "luce");
  }
  const sezioni = json(valori.dm_dashboard_state, {})?.sections || {};
  const prese =
    Array.isArray(sezioni.sockets) && sezioni.sockets.length
      ? sezioni.sockets
      : json(valori.cd_prese, []);
  for (const presa of preseConfigurate(prese)) aggiungi(presa.entity, presa.name, "presa");

  const dispositivi = iDispositiviPerLAuto(candidati, (entita) => ({
    entita: vera(entita),
  })).filter((uno) => !DOMINI_MAI_DAL_POLSO.has(uno.ricetta.dominio));

  /* ─── Le azioni rapide ───────────────────────────────────────────────── */
  const azioni = json(valori.cd_quick_actions, []);
  const risolvi = (azione) => {
    const entita = vera(azione?.entity);
    const dominio = entita.split(".")[0];
    const servizio =
      dominio === "button" || dominio === "input_button"
        ? "press"
        : dominio === "automation"
          ? "trigger"
          : "";
    const dati = pulito(azione?.option) ? { option: pulito(azione.option) } : {};
    return { entita, servizio, dati };
  };
  const ricetteDelleAzioni = leRicettePerLAuto(azioni, risolvi).filter(
    (una) => !una.entita.split(",").some((e) => DOMINI_MAI_DAL_POLSO.has(e.split(".")[0])),
  );
  const conLaRicetta = new Set(ricetteDelleAzioni.map((una) => una.id));
  const tasti = (laFotoPerLAuto({ azioni, risolvi, adesso })?.azioni || []).map((tasto) => ({
    id: tasto.id,
    nome: tasto.nome,
    /* Parte da qui solo quello che ha una ricetta, e non e' un antifurto. */
    subito: conLaRicetta.has(tasto.id),
  }));

  /* ─── Le misure ──────────────────────────────────────────────────────── */
  const misure = [];
  for (const [nome, casella] of LE_MISURE) {
    const valore = unaMisura(perEntita.get(vera(casella)));
    if (valore) misure.push({ nome, valore });
  }

  const ricette = new Map();
  for (const uno of dispositivi) ricette.set(uno.id, { ...uno.ricetta, tipo: "dispositivo" });
  for (const una of ricetteDelleAzioni) {
    const { id, ...ricetta } = una;
    ricette.set(id, { ...ricetta, tipo: "azione" });
  }

  return {
    foto: {
      v: 1,
      premium: premium === true,
      casa: pulito(casa),
      quando: adesso,
      agg: adesso,
      dispositivi: dispositivi.map(({ id, nome, genere, acceso, stato }) => {
        const riga = { id, nome, genere, acceso, stato };
        const ha = perEntita.get(id);
        if (id.startsWith("light.") && siAbbassa(ha)) {
          const grezza = Number(ha?.attributes?.brightness);
          riga.luminosita =
            acceso && Number.isFinite(grezza) ? Math.max(1, Math.round((grezza / 255) * 100)) : 0;
        }
        return riga;
      }),
      azioni: tasti,
      misure,
    },
    ricette,
  };
}

/* ─── L'orologio collegato ───────────────────────────────────────────────── */

export class IlPolso {
  constructor({
    casa,
    configurazione,
    dispositivi,
    plance = null,
    registro = null,
    /* Se la casa e' gdahome Base fuori casa (`licenze.soloDaCasa`): va
     * scritto nella fotografia, come fa il telefono per gli altri orologi. */
    soloInCasa = () => false,
    adesso = () => Date.now(),
    attesaDopoIlComando = ATTESA_DOPO_IL_COMANDO,
  }) {
    this.casa = casa;
    this.configurazione = configurazione;
    this.dispositivi = dispositivi;
    this.plance = plance;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.soloInCasa = soloInCasa;
    this.adesso = adesso;
    this.attesaDopoIlComando = attesaDopoIlComando;
    /** Gli orologi collegati adesso: la presa, e di chi e'. */
    this.collegati = new Set();
    this._nome = { quale: "", chiestoIl: 0 };
  }

  /* Il portiere consegna qui la presa cifrata di un orologio. Da qui in poi
   * ogni messaggio e' una domanda, e ogni domanda ha la sua risposta col suo
   * numero. */
  accogli(presa, { chi, da = "?", daCasa = false } = {}) {
    const collegato = { presa, chi: String(chi || ""), da, daCasa: daCasa === true, domande: [] };
    this.collegati.add(collegato);
    presa.onChiusa = () => this.collegati.delete(collegato);
    presa.onMessaggio = (testo) => {
      void this._unaDomanda(collegato, testo).catch((errore) => {
        this.registro.errore?.(`una domanda dal polso e' inciampata: ${errore?.message || errore}`);
      });
    };
    return collegato;
  }

  async _unaDomanda(collegato, testo) {
    const { presa, chi } = collegato;
    let detto;
    try {
      detto = JSON.parse(testo);
    } catch (_errore) {
      presa.chiudi(CHIUSA_PER_REGOLA, "non ho capito");
      return;
    }
    if (!detto || typeof detto !== "object") {
      presa.chiudi(CHIUSA_PER_REGOLA, "non ho capito");
      return;
    }
    const n = Number.isSafeInteger(detto.n) ? detto.n : null;
    const rispondi = (corpo) => {
      if (presa.viva !== false) presa.manda(JSON.stringify({ n, ...corpo }));
    };

    /* Un orologio staccato mentre era collegato: fuori subito. */
    if (!this.dispositivi.chiaveDi?.(chi)) {
      presa.chiudi(CHIUSA_PER_REGOLA, "staccato");
      return;
    }
    const ora = this.adesso();
    collegato.domande = collegato.domande.filter((quando) => ora - quando < FINESTRA_DELLE_DOMANDE);
    if (collegato.domande.length >= DOMANDE_NELLA_FINESTRA) {
      rispondi({ ok: false, testo: "Troppe domande insieme: aspetta un attimo" });
      return;
    }
    collegato.domande.push(ora);
    this.dispositivi.visto?.(chi);

    try {
      if (detto.t === "foto") {
        const { foto } = await this.fotografia(chi);
        rispondi({ ok: true, foto });
        return;
      }
      if (detto.t === "comando") {
        rispondi(await this.comando(chi, detto));
        return;
      }
    } catch (errore) {
      this.registro.attenzione?.(
        `il polso non ha avuto risposta dalla casa: ${errore?.message || errore}`,
      );
      rispondi({ ok: false, testo: "La casa non risponde" });
      return;
    }
    rispondi({ ok: false, testo: "Non so cosa fare" });
  }

  /* La plancia di questo orologio: la prima che si apre a chi l'ha abbinato,
   * come per un telefono. Senza elenco, quella di sempre. */
  _laPlancia(chi) {
    const utente = this.dispositivi.utenteDi?.(chi) || "";
    let elenco = [];
    try {
      elenco = this.plance?.elenco?.() || [];
    } catch (_errore) {
      elenco = [];
    }
    if (!elenco.length) return PROFILO_PRINCIPALE;
    return elenco.find((una) => laVede(una, utente, null))?.profilo || null;
  }

  async _ilNomeDellaCasa() {
    const ora = this.adesso();
    if (this._nome.quale && ora - this._nome.chiestoIl < NOME_DELLA_CASA_VALE)
      return this._nome.quale;
    try {
      const config = await this.casa.chiedi({ type: "get_config" });
      this._nome = { quale: pulito(config?.location_name).slice(0, 40), chiestoIl: ora };
    } catch (_errore) {
      /* Senza nome si dice «Casa», e si richiede la prossima volta. */
    }
    return this._nome.quale;
  }

  async fotografia(chi) {
    const profilo = this._laPlancia(chi);
    const valori = profilo ? (this.configurazione.leggi(profilo)?.snapshot?.values ?? {}) : {};
    const [stati, casa] = await Promise.all([
      this.casa.chiedi({ type: "get_states" }),
      this._ilNomeDellaCasa(),
    ]);
    let premium = true;
    try {
      premium = this.soloInCasa?.() !== true;
    } catch (_errore) {
      premium = true;
    }
    return fotografaPerIlPolso({ valori, stati, casa, premium, adesso: this.adesso() });
  }

  /* Un comando dal polso. Si rifa' la fotografia di adesso e si cerca il
   * tasto li': e' l'elenco dei permessi, e non quello che dice l'orologio. */
  async comando(chi, { id, cosa, valore } = {}) {
    const no = (testo) => ({ ok: false, testo });
    const quale = pulito(id);
    if (!quale || !["gira", "luminosita", "azione"].includes(cosa)) return no("Non so cosa fare");
    const { ricette } = await this.fotografia(chi);
    const ricetta = ricette.get(quale);
    if (!ricetta) return no("Questo tasto non c'è più");
    const entita = ricetta.entita.split(",").filter(Boolean);
    if (entita.some((una) => DOMINI_MAI_DAL_POLSO.has(una.split(".")[0]))) {
      return no("Questo si fa dal telefono");
    }

    let chiamata;
    if (cosa === "azione") {
      if (ricetta.tipo !== "azione") return no("Non so cosa fare");
      chiamata = { domain: ricetta.dominio, service: ricetta.servizio, dati: ricetta.dati };
    } else if (cosa === "gira") {
      if (ricetta.tipo !== "dispositivo") return no("Non so cosa fare");
      chiamata = { domain: ricetta.dominio, service: ricetta.servizio, dati: ricetta.dati };
    } else {
      const quanto = Math.round(Number(valore));
      if (ricetta.tipo !== "dispositivo" || ricetta.dominio !== "light")
        return no("Non so cosa fare");
      if (!Number.isFinite(quanto) || quanto < 1 || quanto > 100) return no("Non so cosa fare");
      chiamata = { domain: "light", service: "turn_on", dati: { brightness_pct: quanto } };
    }

    try {
      await this.casa.chiedi({
        type: "call_service",
        domain: chiamata.domain,
        service: chiamata.service,
        service_data: { ...(chiamata.dati || {}), entity_id: entita },
      });
    } catch (_errore) {
      return no("Non è partito: la casa non ha risposto");
    }
    /* La fotografia di dopo, con la riga gia' girata: se non arriva, il
     * «Fatto» resta vero lo stesso. */
    await new Promise((avanti) => setTimeout(avanti, this.attesaDopoIlComando));
    try {
      const { foto } = await this.fotografia(chi);
      return { ok: true, testo: "Fatto", foto };
    } catch (_errore) {
      return { ok: true, testo: "Fatto" };
    }
  }

  /* ─── Per la console e per chi stacca ──────────────────────────────── */

  collegatiPerDispositivo() {
    const conto = new Map();
    for (const uno of this.collegati) conto.set(uno.chi, (conto.get(uno.chi) || 0) + 1);
    return conto;
  }

  scollega(chi, perche = "") {
    let quanti = 0;
    for (const uno of [...this.collegati]) {
      if (uno.chi !== chi) continue;
      uno.presa.chiudi(CHIUSA_PER_REGOLA, perche || "questo dispositivo e' stato staccato");
      this.collegati.delete(uno);
      quanti += 1;
    }
    return quanti;
  }

  chiudiQuelliDaFuori(codice = 4402, motivo = "premium-richiesto") {
    let quanti = 0;
    for (const uno of [...this.collegati]) {
      if (uno.daCasa) continue;
      uno.presa.chiudi(codice, motivo);
      this.collegati.delete(uno);
      quanti += 1;
    }
    return quanti;
  }

  chiudiTutto() {
    for (const uno of [...this.collegati]) uno.presa.chiudi(1001, "il ponte si spegne");
    this.collegati.clear();
  }
}
