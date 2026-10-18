/* Il diario della casa: la giornata oltre l'energia.
 *
 * «La tua giornata» nell'app non e' solo sole e rete: e' quanto faceva caldo
 * in ogni stanza, quanto e' stato acceso il riscaldamento, a che temperatura
 * il solare termico ha portato l'acqua, quanto ha caricato e quanto ha
 * consumato l'auto, quanta acqua e quanto gas, e le cose successe in casa.
 * Il taccuino dell'energia (`l-energia-di-casa.js`) tiene sole, rete e
 * carichi; qui si tiene tutto il resto, con la stessa regola: a ogni battito
 * della sentinella (mezzo minuto) si guarda com'e' la casa adesso, e si
 * annota.
 *
 * Le cose si trovano dove le trova la plancia, senza chiedere niente a chi
 * abita:
 *
 *  - le stanze e i loro termometri dalla configurazione della plancia
 *    (`cd_stanze`, o le stanze dello stato salvato), e se non ce ne sono i
 *    termostati di Home Assistant; fuori, la stanza «all'aperto», un
 *    termometro esterno, o il meteo;
 *  - il riscaldamento dai termostati (`climate.*`), le finestre dalla loro
 *    classe;
 *  - il solare termico dalle sue caselle (`dm.boiler_*`, `impianti-termici`);
 *  - le auto dalle caselle `dm.ev_*` di ogni vettura (`cd_ev_cars`): la
 *    batteria, la potenza di ricarica, lo stato, l'odometro. Un viaggio e'
 *    la batteria che scende mentre l'auto non carica; i chilometri li dice
 *    l'odometro se c'e', altrimenti si stimano dal consumo medio;
 *  - l'acqua e il gas dai contatori della plancia (`cd_contatori`), o da
 *    quelli che Home Assistant dichiara; l'irrigazione dalle sue zone
 *    (`cd_irrigazione`).
 *
 * Una sezione c'e' solo se in casa c'e' quello che serve: senza auto niente
 * auto, senza solare termico niente solare termico (`null`).
 *
 * ─── Cosa sta sul disco ───────────────────────────────────────────────────
 *
 * `/data/giornata-di-casa.json`: la giornata in corso (un riavvio non la
 * azzera) e due numeri di ieri, per «−35 min» e «−8% su ieri». Le chiavi
 * interne sono entita', e restano in casa: quello che esce verso il telefono
 * (`laGiornata`) ha solo nomi, numeri e orari. Nessun nome di persona: gli
 * eventi dicono «qualcuno», «Prima persona sveglia», e prima di partire
 * ogni testo passa da `senzaNomiDiPersone`.
 */

import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { giornoDi, quoteDelMomento } from "./l-energia-di-casa.js";
import { risolutoreDalla } from "./ricarica-di-notte.js";
import {
  contatoreDaProporre,
  genereDelSensore,
  inLitri,
  righeDeiContatori,
} from "../plancia/src/core/contatori-di-casa.js";
import { resolveRate } from "../plancia/src/core/energy-calculations.js";
import { normalizzaLeFasce, nomeDellaFascia } from "../plancia/src/core/fasce-della-tariffa.js";
import { accumuloDiCasa } from "../plancia/src/core/l-accumulo-di-casa.js";
import { entitaDellaRicarica, letturaDellAuto } from "../plancia/src/core/ricarica-di-notte.js";
import { wattsFromState } from "../plancia/src/core/signed-energy.js";
import { codiceDellaRicarica } from "../plancia/src/core/stato-della-ricarica.js";
import {
  CAPACITA_DI_CASA_KEY,
  CASELLA_DELLA_CAPACITA,
  MOTORE_DI_CASA_KEY,
  capacitaDellaBatteria,
  kilowattoraDalloStato,
  siRicarica,
  tipoMotore,
} from "../plancia/src/core/vehicle-model.js";
import { consumoMisurato } from "../plancia/src/core/i-viaggi.js";

const MINUTO = 60 * 1000;
const ORA = 60 * MINUTO;

/* Fra due battiti non si contano piu' di due minuti: la stessa regola del
 * taccuino dell'energia. */
const PASSO_MASSIMO = 2 * MINUTO;
/* Le cose della casa si ricercano ogni dieci minuti, non a ogni battito. */
const RICERCA_OGNI = 10 * MINUTO;

const STANZE_AL_PIU = 6;
const EVENTI_AL_PIU = 8;
const EVENTI_TENUTI = 40;
const PUNTI_DELLA_BATTERIA = 60;
const RICARICHE_AL_PIU = 6;
const VIAGGI_AL_PIU = 10;

/* Una ricarica e' finita dopo cinque minuti senza caricare; un viaggio dopo
 * venti minuti in cui la batteria non scende e l'odometro non va avanti. */
const RICARICA_FINITA_DOPO = 5 * MINUTO;
const VIAGGIO_FINITO_DOPO = 20 * MINUTO;
/* Sopra questa potenza l'auto sta caricando. */
const CARICA_DA_WATT = 100;
/* La batteria di un'auto che non l'ha dichiarata: la stessa che assume la
 * plancia. E quanto consuma un'auto elettrica media, per stimare i
 * chilometri quando l'odometro non c'e'. */
const CAPACITA_DI_SERIE = 70;
const KWH_OGNI_100_KM = 17;
/* Un viaggio sotto i 25 km/h di media e' «piu' lento»: il traffico. */
const LENTO_SOTTO_KMH = 25;

/* Senza un obiettivo del termostato, il comfort e' fra 19 e 23 gradi. */
const COMFORT_DI_SERIE = Object.freeze([19, 23]);

const ESTERNO =
  /(estern|outdoor|outside|fuori|giardin|balcon|terrazz|cortile|garden|meteo|weather)/i;
const NON_STANZA =
  /(frig|freez|congel|forno|oven|cpu|processor|nas\b|server|batter|acqua|water|boiler|caldaia|piscin|pool|auto\b|car\b|mandata|ritorno|pannell|inverter|scaldabagno|puffer|accumul|stampant|printer|router|disk|disco|motore|engine|chip|tv\b|lavatric|lavastovigl|asciugatric|acquari)/i;
/* I telefoni, gli orologi e i tablet sono di qualcuno: la loro batteria non
 * e' una cosa di casa da sistemare, e il loro nome spesso e' un nome. */
const DI_QUALCUNO = /(telefon|phone|iphone|ipad|pixel|galaxy|tablet|watch|orologio|airpods)/i;

const ENTITA = /^[a-z_]+\.[a-z0-9_]+$/;
/* Le parole che i testi di qui usano: un utente che si chiama «Casa» o
 * «Admin» non deve cambiare «Casa vuota» in «qualcuno vuota». */
const PAROLE_NOSTRE = new Set(
  "casa,home,admin,amministratore,sole,auto,acqua,porta,porte,rete,gas,antifurto,rientro,prima,persona,tapparelle,ciclo,forno,bagno,camera,cucina,soggiorno,studio,garage,giardino,ospite,utente,user,owner".split(
    ",",
  ),
);
const ACCESO = /^(on|true|1|open|opening|running|heat|heating|attiv[ao])$/i;

const numero = (valore) => {
  if (valore === null || valore === undefined || valore === "" || typeof valore === "boolean")
    return null;
  const n = Number(String(valore).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const arrotonda = (valore, cifre = 1) => {
  if (valore === null || valore === undefined || !Number.isFinite(valore)) return null;
  const f = 10 ** cifre;
  return Math.round(valore * f) / f;
};

const oraDi = (istante) => {
  if (!istante) return null;
  const d = new Date(istante);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const oraDecimale = (istante) => {
  const d = new Date(istante);
  return arrotonda(d.getHours() + d.getMinutes() / 60, 2);
};

function leggiJson(valore) {
  if (typeof valore !== "string") return valore ?? null;
  try {
    return JSON.parse(valore);
  } catch (_errore) {
    return null;
  }
}

const oggetto = (valore) =>
  valore && typeof valore === "object" && !Array.isArray(valore) ? valore : {};
const dominioDi = (id) => String(id).split(".")[0];
const nomeDi = (stato, id) =>
  String(stato?.attributes?.friendly_name || id.split(".")[1]?.replace(/_/g, " ") || id)
    .trim()
    .slice(0, 40);

/* Una temperatura in gradi: di un sensore, o quella di stanza di un
 * termostato. I Fahrenheit si portano in Celsius. */
function gradiDi(id, stato) {
  if (!stato) return null;
  const grezzo =
    dominioDi(id) === "climate"
      ? numero(stato.attributes?.current_temperature)
      : dominioDi(id) === "weather"
        ? numero(stato.attributes?.temperature)
        : numero(stato.state);
  if (grezzo === null) return null;
  const unita = String(
    stato.attributes?.unit_of_measurement || stato.attributes?.temperature_unit || "",
  );
  const c = /F/.test(unita) ? ((grezzo - 32) * 5) / 9 : grezzo;
  return c > -50 && c < 120 ? c : null;
}

function umiditaDi(id, stato) {
  if (!stato) return null;
  const n =
    dominioDi(id) === "climate" ? numero(stato.attributes?.current_humidity) : numero(stato.state);
  return n !== null && n >= 0 && n <= 100 ? n : null;
}

/* Una serie di 24 ore: somme e conti, per la media di ogni ora. */
const serieNuova = () => ({
  s: Array(24).fill(0),
  n: Array(24).fill(0),
  min: null,
  max: null,
  maxIl: 0,
  tot: 0,
  conti: 0,
});

function annotaNellaSerie(serie, valore, ora) {
  if (valore === null) return;
  const h = new Date(ora).getHours();
  serie.s[h] += valore;
  serie.n[h] += 1;
  serie.tot += valore;
  serie.conti += 1;
  if (serie.min === null || valore < serie.min) serie.min = valore;
  if (serie.max === null || valore > serie.max) {
    serie.max = valore;
    serie.maxIl = ora;
  }
}

const oreDellaSerie = (serie) =>
  serie.s.map((somma, h) => (serie.n[h] ? arrotonda(somma / serie.n[h], 1) : null));

function giornataNuova(giorno) {
  return {
    d: giorno,
    /* Le stanze, per chiave (l'entita' del termometro): la serie e
     * l'umidita'. */
    stanze: {},
    fuori: null,
    riscaldamento: { acceso: 0, campioni: 0, dentro: 0, finestre: 0, spento: 0 },
    solare: null,
    auto: {},
    acqua: { litri: 0, gas: 0, irrigazione: 0, zone: [], alle: 0 },
    eventi: [],
    conti: { porte: 0, automazioni: 0, avvisi: 0 },
    sveglia: 0,
    tapparelle: 0,
    vuotaDal: 0,
  };
}

/* ─── Dove sono le cose ──────────────────────────────────────────────────── */

/* Le stanze della plancia coi loro termometri: `cd_stanze`, o le stanze
 * dello stato salvato. */
function stanzeDellaPlancia(valori) {
  const stato = oggetto(leggiJson(valori?.dm_dashboard_state));
  const dalloStato = oggetto(stato.sections).rooms;
  const elenco = Array.isArray(dalloStato)
    ? dalloStato
    : Array.isArray(leggiJson(valori?.cd_stanze))
      ? leggiJson(valori.cd_stanze)
      : [];
  return elenco
    .filter((stanza) => stanza && typeof stanza === "object")
    .map((stanza) => ({
      nome: String(stanza.name || "").trim(),
      temp: String(stanza.temp || stanza.temperature_entity || "").trim(),
      hum: String(stanza.hum || stanza.humidity_entity || "").trim(),
      fuori: stanza.outdoor === true || stanza.outdoor === "true",
    }))
    .filter((stanza) => stanza.nome && ENTITA.test(stanza.temp));
}

/* Le auto che si ricaricano, ognuna con chi traduce le sue caselle. */
function autoDellaPlancia(valori) {
  const v = oggetto(valori);
  const salvate = leggiJson(v.cd_ev_cars);
  const sezioni = oggetto(oggetto(leggiJson(v.dm_dashboard_state)).sections);
  const elenco =
    Array.isArray(salvate) && salvate.length
      ? salvate
      : Array.isArray(sezioni.ev)
        ? sezioni.ev
        : [];
  const diCasa = risolutoreDalla(v);
  if (!elenco.length) {
    if (tipoMotore(v[MOTORE_DI_CASA_KEY]) === "termica") return [];
    const kwh = numero(v[CAPACITA_DI_CASA_KEY]);
    return [{ chiave: "a0", nome: "Auto", kwh: kwh > 0 ? kwh : null, risolvi: diCasa }];
  }
  return elenco
    .map((auto, indice) => ({ auto: oggetto(auto), indice }))
    .filter(({ auto }) => siRicarica(auto))
    .map(({ auto, indice }) => {
      const sue = oggetto(auto.ov || auto.overrides);
      return {
        chiave: `a${indice}`,
        nome: String(auto.name || "").trim() || (indice ? `Auto ${indice + 1}` : "Auto"),
        kwh: capacitaDellaBatteria(auto),
        /* La prima auto e' anche quella della mappatura generale. */
        risolvi: (rif) => {
          if (typeof sue[rif] === "string" && sue[rif]) return sue[rif];
          return indice === elenco.findIndex((x) => siRicarica(oggetto(x))) ? diCasa(rif) : "";
        },
      };
    });
}

/* ─── Senza nomi ─────────────────────────────────────────────────────────── */

/**
 * Toglie i nomi delle persone da ogni testo di una risposta: al loro posto
 * «qualcuno». `nomi` sono i nomi di chi abita (le `person.*` e gli utenti di
 * Home Assistant): si toglie il nome intero e ogni sua parola di almeno tre
 * lettere. E un testo che e' un'entita' (`sensor.forno_w`, quando un carico
 * non ha nome) diventa il suo nome leggibile: le entita' non escono.
 */
export function senzaNomiDiPersone(dato, nomi = []) {
  const parole = [
    ...new Set(
      nomi
        .flatMap((nome) => [String(nome || "").trim(), ...String(nome || "").split(/\s+/)])
        .map((p) => p.trim())
        .filter((p) => p.length >= 3 && !PAROLE_NOSTRE.has(p.toLowerCase())),
    ),
  ].sort((a, b) => b.length - a.length);
  const scappa = (p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regola = parole.length
    ? new RegExp(`(^|[^\\p{L}])(${parole.map(scappa).join("|")})(?=$|[^\\p{L}])`, "giu")
    : null;
  const pulisci = (testo) => {
    let fuori = ENTITA.test(testo) ? testo.split(".")[1].replace(/_/g, " ") : testo;
    if (regola) fuori = fuori.replace(regola, (_t, prima) => `${prima}qualcuno`);
    return fuori;
  };
  const giro = (x) => {
    if (typeof x === "string") return pulisci(x);
    if (Array.isArray(x)) return x.map(giro);
    if (x && typeof x === "object")
      return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, giro(v)]));
    return x;
  };
  return giro(dato);
}

/* ─── Il diario ──────────────────────────────────────────────────────────── */

export class DiarioDellaCasa {
  constructor({ cartella = "", adesso = () => Date.now(), registro = null } = {}) {
    this._suDisco = Boolean(cartella);
    this.archivio = new Archivio(cartella ? join(cartella, "giornata-di-casa.json") : "", {
      oggi: null,
      ieri: null,
    });
    this.adesso = adesso;
    this.registro = registro;
    this._ultimo = null;
    this._scrittoIl = 0;
    this._trovate = null;
    /* Quello che resta da un giorno all'altro, per auto: l'ultima carica e
     * l'ultimo odometro visti. */
    this._auto = new Map();
    /* L'ultima lettura dei contatori, per contare solo quello che sale. */
    this._contatori = {};
    this._zoneAccese = new Set();
  }

  get oggi() {
    return this.archivio.dati.oggi;
  }

  /* La giornata di oggi, nuova se il giorno e' cambiato: di quella di ieri
   * restano i minuti di riscaldamento e i litri d'acqua. */
  _laGiornata(ora) {
    const giorno = giornoDi(ora);
    const prima = this.archivio.dati.oggi;
    if (prima?.d === giorno) return prima;
    if (prima?.d)
      this.archivio.dati.ieri = {
        d: prima.d,
        riscaldamento: Math.round((prima.riscaldamento?.acceso || 0) / MINUTO),
        litri: prima.acqua?.litri || 0,
      };
    const nuova = giornataNuova(giorno);
    this.archivio.dati.oggi = nuova;
    return nuova;
  }

  /* ─── Cosa c'e' in casa ──────────────────────────────────────────────── */

  _trova(stati, valori, ora) {
    if (this._trovate && ora - this._trovate.il < RICERCA_OGNI) return this._trovate;
    const c = (id) => stati.get(id);
    const tutte = [...stati.keys()];
    /* Le stanze: quelle della plancia, o i termostati. */
    const plancia = stanzeDellaPlancia(valori);
    let stanze = plancia
      .filter((s) => !s.fuori)
      .map((s) => ({ chiave: s.temp, nome: s.nome, temp: s.temp, hum: s.hum }));
    if (!stanze.length)
      stanze = tutte
        .filter((id) => dominioDi(id) === "climate" && gradiDi(id, c(id)) !== null)
        .map((id) => ({ chiave: id, nome: nomeDi(c(id), id), temp: id, hum: id }));
    stanze = stanze.slice(0, STANZE_AL_PIU);
    /* Fuori: la stanza all'aperto, un termometro esterno, il meteo. */
    const fuori =
      plancia.find((s) => s.fuori)?.temp ||
      tutte.find(
        (id) =>
          dominioDi(id) === "sensor" &&
          c(id)?.attributes?.device_class === "temperature" &&
          ESTERNO.test(`${id} ${nomeDi(c(id), id)}`) &&
          !NON_STANZA.test(`${id} ${nomeDi(c(id), id)}`),
      ) ||
      tutte.find((id) => dominioDi(id) === "weather" && gradiDi(id, c(id)) !== null) ||
      "";
    /* I termostati che scaldano. */
    const termostati = tutte.filter((id) => {
      if (dominioDi(id) !== "climate") return false;
      const a = c(id)?.attributes || {};
      const modi = Array.isArray(a.hvac_modes) ? a.hvac_modes : [];
      return modi.includes("heat") || modi.includes("heat_cool") || c(id)?.state === "heat";
    });
    const finestre = tutte.filter(
      (id) => dominioDi(id) === "binary_sensor" && c(id)?.attributes?.device_class === "window",
    );
    /* Il solare termico dalle sue caselle. */
    const risolvi = risolutoreDalla(valori);
    const casella = (...rif) => {
      for (const r of rif) {
        const id = String(risolvi(r) || "");
        if (ENTITA.test(id) && !id.startsWith("dm.") && stati.has(id)) return id;
      }
      return "";
    };
    const solare = {
      collettore: casella("dm.boiler_sonda_temperatura_1"),
      bollitore: casella("dm.boiler_sonda_temperatura_3", "dm.boiler_sonda_temperatura_2"),
      pompa: casella("dm.boiler_stato_pompa_solare", "dm.boiler_pompa_solare"),
      pressione: casella("dm.boiler_pressione_acqua"),
      resistenza: casella("dm.boiler_potenza_resistenza_boiler"),
    };
    /* Le auto, con le loro entita'. */
    const auto = [];
    for (const una of autoDellaPlancia(valori)) {
      const leggi = (...rif) => {
        for (const r of rif) {
          let id = "";
          try {
            id = String(una.risolvi(r) || "");
          } catch (_errore) {
            id = "";
          }
          if (ENTITA.test(id) && !id.startsWith("dm.") && stati.has(id)) return id;
        }
        return "";
      };
      const entita = entitaDellaRicarica(una.risolvi);
      if (!entita.soc.some((id) => stati.has(id))) continue;
      auto.push({
        ...una,
        entita,
        potenza: leggi("dm.ev_potenza_ricarica", "dm.ev_charge_power", "dm.ev_potenza_wallbox"),
        odometro: leggi("dm.ev_odometro"),
        /* Quello che l'auto dice di se' (GdAAuto): quanti kWh tiene, e quanto
         * consuma davvero. */
        capacitaDetta: leggi(CASELLA_DELLA_CAPACITA),
        consumoDetto: leggi("dm.ev_consumo_medio"),
      });
    }
    /* L'acqua e il gas: i contatori della plancia, o quelli dichiarati. */
    const righe = righeDeiContatori(leggiJson(valori?.cd_contatori) || {});
    const contatore = (genere) =>
      righe.find(
        (r) =>
          stati.has(r.entity) && (r.genere || genereDelSensore(r.entity, c(r.entity))) === genere,
      )?.entity ||
      (righe.length ? "" : tutte.find((id) => contatoreDaProporre(id, c(id)) === genere)) ||
      "";
    const irrigazione = oggetto(leggiJson(valori?.cd_irrigazione));
    const zone = (Array.isArray(irrigazione.zones) ? irrigazione.zones : [])
      .map((z) => String(z?.entity || "").trim())
      .filter((id) => ENTITA.test(id) && stati.has(id));
    const conClasse = (...classi) =>
      tutte.some(
        (id) =>
          dominioDi(id) === "binary_sensor" && classi.includes(c(id)?.attributes?.device_class),
      );
    this._trovate = {
      il: ora,
      stanze,
      fuori,
      termostati,
      finestre,
      solare: solare.collettore || solare.bollitore ? solare : null,
      auto,
      acqua: contatore("acqua"),
      gas: contatore("gas"),
      zone,
      porte: conClasse("door", "garage_door", "opening"),
      automazioni: tutte.some((id) => dominioDi(id) === "automation"),
      sicurezza:
        tutte.some((id) => dominioDi(id) === "alarm_control_panel") ||
        conClasse("moisture", "smoke", "gas", "carbon_monoxide"),
    };
    return this._trovate;
  }

  /* ─── A ogni battito ─────────────────────────────────────────────────── */

  /**
   * Un campione. `stati`: la mappa della sentinella; `valori`: la
   * configurazione della plancia; `energia`: le potenze di adesso (sole,
   * casa, rete, in watt) per dividere la ricarica dell'auto fra sole e rete;
   * `prezzo(istante)` → `{prezzo}`.
   */
  campiona({ stati, valori = {}, energia = null, prezzo = () => ({ prezzo: null }) } = {}) {
    if (!(stati instanceof Map)) return;
    const ora = this.adesso();
    const g = this._laGiornata(ora);
    const dt = this._ultimo === null ? 0 : Math.min(PASSO_MASSIMO, Math.max(0, ora - this._ultimo));
    this._ultimo = ora;
    const t = this._trova(stati, valori, ora);
    const c = (id) => stati.get(id);

    /* Il clima: ogni stanza, e fuori. */
    const dentroAdesso = [];
    for (const stanza of t.stanze) {
      const gradi = gradiDi(stanza.temp, c(stanza.temp));
      const umido = stanza.hum ? umiditaDi(stanza.hum, c(stanza.hum)) : null;
      if (gradi === null && umido === null) continue;
      const voce = (g.stanze[stanza.chiave] ??= {
        nome: stanza.nome,
        ...serieNuova(),
        us: 0,
        un: 0,
      });
      voce.nome = stanza.nome;
      annotaNellaSerie(voce, gradi, ora);
      if (umido !== null) {
        voce.us += umido;
        voce.un += 1;
      }
      if (gradi !== null) dentroAdesso.push(gradi);
    }
    if (t.fuori) annotaNellaSerie((g.fuori ??= serieNuova()), gradiDi(t.fuori, c(t.fuori)), ora);

    /* Il riscaldamento: acceso, nel comfort, spento con le finestre aperte. */
    if (t.termostati.length) {
      const r = g.riscaldamento;
      const scalda = t.termostati.some((id) => {
        const st = c(id);
        const azione = st?.attributes?.hvac_action;
        if (azione) return azione === "heating";
        const voluta = numero(st?.attributes?.temperature);
        const stanza = gradiDi(id, st);
        return st?.state === "heat" && voluta !== null && stanza !== null && stanza < voluta;
      });
      if (scalda) r.acceso += dt;
      const inCaldo = t.termostati.find((id) =>
        ["heat", "heat_cool", "auto"].includes(c(id)?.state),
      );
      const obiettivo = inCaldo ? numero(c(inCaldo)?.attributes?.temperature) : null;
      r.obiettivo = obiettivo;
      r.range = obiettivo !== null ? [obiettivo - 2, obiettivo + 2] : [...COMFORT_DI_SERIE];
      const media = dentroAdesso.length
        ? dentroAdesso.reduce((a, b) => a + b, 0) / dentroAdesso.length
        : null;
      if (media !== null && dt > 0) {
        r.campioni += 1;
        if (media >= r.range[0] && media <= r.range[1]) r.dentro += 1;
      }
      const aperta = t.finestre.some((id) => c(id)?.state === "on");
      if (aperta && t.termostati.every((id) => c(id)?.state === "off")) r.spento += dt;
    }

    /* Il solare termico. */
    if (t.solare) {
      const s = (g.solare ??= {
        collettore: serieNuova(),
        bollitore: serieNuova(),
        pompa: 0,
        da: 0,
        a: 0,
        resistenza: 0,
        pressione: null,
      });
      if (t.solare.collettore)
        annotaNellaSerie(s.collettore, gradiDi(t.solare.collettore, c(t.solare.collettore)), ora);
      if (t.solare.bollitore)
        annotaNellaSerie(s.bollitore, gradiDi(t.solare.bollitore, c(t.solare.bollitore)), ora);
      if (t.solare.pompa && ACCESO.test(String(c(t.solare.pompa)?.state || ""))) {
        s.pompa += dt;
        if (!s.da) s.da = ora;
        s.a = ora;
      }
      if (t.solare.resistenza && (wattsFromState(c(t.solare.resistenza)) || 0) > 15)
        s.resistenza += dt;
      if (t.solare.pressione) {
        const bar = numero(c(t.solare.pressione)?.state);
        if (bar !== null) s.pressione = bar;
      }
    }

    /* Le auto. */
    for (const una of t.auto) this._unAuto(g, una, c, { ora, dt, energia, prezzo });

    /* L'acqua, il gas e l'irrigazione. */
    const sale = (chiave, id, fattore = 1) => {
      if (!id) return 0;
      const st = c(id);
      const litri = inLitri(st?.state, st?.attributes?.unit_of_measurement || "m³");
      if (litri === null) return 0;
      const prima = this._contatori[chiave];
      this._contatori[chiave] = litri;
      if (prima === undefined || litri < prima) return 0;
      return (litri - prima) * fattore;
    };
    const litri = sale("acqua", t.acqua);
    g.acqua.litri += litri;
    g.acqua.gas += sale("gas", t.gas, 1 / 1000);
    const accese = t.zone.filter((id) => ACCESO.test(String(c(id)?.state || "")));
    for (const id of accese) {
      if (!this._zoneAccese.has(id)) {
        if (!g.acqua.zone.includes(id)) g.acqua.zone.push(id);
        g.acqua.alle = ora;
      }
    }
    this._zoneAccese = new Set(accese);
    if (accese.length) g.acqua.irrigazione += litri;

    if (ora - this._scrittoIl >= 5 * MINUTO) this.scrivi();
  }

  /* Un'auto: la ricarica (quanta, quanta col sole, quanto e' costata) e i
   * viaggi (la batteria che scende mentre non carica). */
  _unAuto(g, una, c, { ora, dt, energia, prezzo }) {
    const lettura = letturaDellAuto(una.entita, c);
    const soc = lettura.soc;
    const watt = una.potenza ? wattsFromState(c(una.potenza)) : null;
    const codice = codiceDellaRicarica({
      stato: c(una.entita.stato[0])?.state,
      collegata: lettura.collegata,
      potenza: watt,
    });
    /* La capacita' scritta; se non c'e', quella del sensore dell'auto; se no
     * i settanta di serie. */
    const capacita =
      una.kwh ||
      (una.capacitaDetta ? kilowattoraDalloStato(c(una.capacitaDetta)) : null) ||
      CAPACITA_DI_SERIE;
    /* Il consumo per stimare i chilometri senza odometro: quello misurato
     * dall'auto, se lo dice, o i 17 di un'elettrica media. */
    const consumo =
      (una.consumoDetto ? consumoMisurato(c(una.consumoDetto)) : null) ?? KWH_OGNI_100_KM;
    let odometro = una.odometro ? numero(c(una.odometro)?.state) : null;
    if (odometro !== null && /mi/i.test(String(c(una.odometro)?.attributes?.unit_of_measurement)))
      odometro *= 1.609344;
    const memoria = this._auto.get(una.chiave) || { soc: null, socIl: 0, odo: null };
    this._auto.set(una.chiave, memoria);
    const a = (g.auto[una.chiave] ??= {
      nome: una.nome,
      capacita,
      punti: [],
      ricariche: [],
      viaggi: [],
      carica: null,
      viaggio: null,
      conOdometro: Boolean(una.odometro),
    });
    a.nome = una.nome;
    a.capacita = capacita;
    a.consumo = consumo;
    a.conOdometro = Boolean(una.odometro);
    const salita = soc !== null && memoria.soc !== null ? soc - memoria.soc : 0;
    const inCarica =
      codice === "C" ||
      (watt !== null && watt > CARICA_DA_WATT) ||
      (salita >= 1 && lettura.collegata === true);
    const { prezzo: euro } = prezzo(ora) || {};
    const conPrezzo = euro !== null && euro !== undefined;
    const quote = (w, ore) => {
      const q = quoteDelMomento({
        app: w,
        sole: energia?.sole ?? null,
        casa: energia?.casa ?? null,
        rete: energia?.rete ?? null,
      });
      return { sole: q.sole * ore, rete: q.rete * ore };
    };

    /* La ricarica. */
    if (inCarica) {
      const r = (a.carica ??= {
        da: ora,
        a: ora,
        socDa: memoria.soc ?? soc,
        socA: soc,
        wh: 0,
        sole: 0,
        eur: 0,
        conPrezzo: false,
      });
      r.a = ora;
      if (soc !== null) r.socA = soc;
      let wh = 0;
      let w = null;
      if (watt !== null && dt > 0) {
        w = Math.max(0, watt);
        wh = (w * dt) / ORA;
      } else if (watt === null && salita > 0) {
        /* Senza la potenza: i kWh dalla batteria che sale, alla potenza
         * media da quando era ferma. */
        wh = (salita / 100) * capacita * 1000;
        const ore = Math.max(dt, ora - memoria.socIl) / ORA;
        w = ore > 0 ? wh / ore : null;
      }
      if (wh > 0 && w) {
        const q = quote(w, wh / w);
        r.wh += wh;
        r.sole += q.sole;
        if (conPrezzo) {
          r.eur += (q.rete / 1000) * euro;
          r.conPrezzo = true;
        }
      }
    } else if (a.carica && ora - a.carica.a >= RICARICA_FINITA_DOPO) {
      a.ricariche.push(a.carica);
      a.ricariche = a.ricariche.slice(-RICARICHE_AL_PIU);
      a.carica = null;
    }

    /* I viaggi: la batteria scende o l'odometro va avanti, senza caricare. */
    const scesa = soc !== null && memoria.soc !== null ? memoria.soc - soc : 0;
    const avanti = odometro !== null && memoria.odo !== null ? odometro - memoria.odo : 0;
    if (!inCarica && (scesa >= 1 || avanti >= 0.1)) {
      const v = (a.viaggio ??= {
        da: ora,
        a: ora,
        socDa: memoria.soc ?? soc,
        socA: soc,
        odoDa: memoria.odo,
        odoA: odometro,
      });
      v.a = ora;
      if (soc !== null && scesa >= 1) v.socA = soc;
      if (odometro !== null) v.odoA = odometro;
    } else if (a.viaggio && (inCarica || ora - a.viaggio.a >= VIAGGIO_FINITO_DOPO)) {
      a.viaggi.push(a.viaggio);
      a.viaggi = a.viaggi.slice(-VIAGGI_AL_PIU);
      a.viaggio = null;
    }

    /* La memoria si sposta solo coi cambi veri: un punto di batteria alla
     * volta, cosi' un sensore che balla di mezzo punto non fa viaggi. */
    if (soc !== null && (memoria.soc === null || Math.abs(soc - memoria.soc) >= 1)) {
      memoria.soc = soc;
      memoria.socIl = ora;
    }
    if (odometro !== null && (memoria.odo === null || odometro >= memoria.odo))
      memoria.odo = odometro;

    /* I punti per il grafico: a ogni cambio, e almeno uno all'ora. */
    if (soc !== null) {
      const ultimo = a.punti.at(-1);
      const h = oraDecimale(ora);
      if (!ultimo || Math.abs(ultimo[1] - soc) >= 1 || h - ultimo[0] >= 1) {
        a.punti.push([h, Math.round(soc)]);
        if (a.punti.length > PUNTI_DELLA_BATTERIA)
          a.punti = a.punti.filter((_p, i) => i % 2 === 0 || i === a.punti.length - 1);
      }
    }
  }

  /* ─── Quello che succede ─────────────────────────────────────────────── */

  _evento(g, ora, testo, peso = 1) {
    g.eventi.push([ora, String(testo).slice(0, 80), peso]);
    if (g.eventi.length > EVENTI_TENUTI) g.eventi.splice(0, g.eventi.length - EVENTI_TENUTI);
  }

  /**
   * Un `state_changed`, dopo che la sentinella l'ha visto: le porte aperte,
   * le automazioni eseguite, l'antifurto, la casa che si svuota e si
   * riempie, il primo movimento del mattino. `stati` e' gia' quello nuovo.
   */
  cambia(id, nuovo, vecchio, stati) {
    if (typeof id !== "string" || !nuovo || !(stati instanceof Map)) return;
    const ora = this.adesso();
    const g = this._laGiornata(ora);
    const dominio = dominioDi(id);
    const dopo = String(nuovo.state ?? "");
    const prima = vecchio ? String(vecchio.state ?? "") : null;
    const classe = nuovo.attributes?.device_class;
    const h = new Date(ora).getHours();
    const persone = [...stati].filter(([uno]) => dominioDi(uno) === "person");
    const vuota = (cambiata) =>
      persone.length
        ? persone.every(([uno, st]) => (uno === id ? cambiata : st.state) !== "home")
        : null;

    if (dominio === "binary_sensor" && dopo === "on" && prima === "off") {
      if (["door", "garage_door", "opening"].includes(classe)) g.conti.porte += 1;
      if (classe === "window") g.riscaldamento.finestre += 1;
      if (["moisture", "smoke", "gas", "carbon_monoxide"].includes(classe)) {
        g.conti.avvisi += 1;
        const cosa = {
          moisture: "Allagamento",
          smoke: "Fumo",
          gas: "Gas",
          carbon_monoxide: "Monossido",
        }[classe];
        this._evento(g, ora, `${cosa}: allarme`, 3);
      }
      if (
        ["motion", "occupancy", "presence"].includes(classe) &&
        !g.sveglia &&
        h >= 4 &&
        h < 11 &&
        vuota(stati.get(id)?.state) !== true
      ) {
        g.sveglia = ora;
        this._evento(g, ora, "Prima persona sveglia", 2);
      }
    }
    if (dominio === "cover" && dopo === "open" && prima === "closed" && !g.tapparelle && h >= 5) {
      g.tapparelle = ora;
      const sveglia = g.eventi.find((e) => e[0] === g.sveglia);
      if (sveglia && ora - g.sveglia < 30 * MINUTO) sveglia[1] += ", tapparelle aperte";
      else this._evento(g, ora, "Tapparelle aperte", 1);
    }
    if (dominio === "automation") {
      const scattata = nuovo.attributes?.last_triggered;
      if (scattata && scattata !== vecchio?.attributes?.last_triggered) g.conti.automazioni += 1;
    }
    if (dominio === "alarm_control_panel" && prima !== null && dopo !== prima) {
      const inserito = (s) => /^armed_/.test(s);
      if (dopo === "triggered") {
        g.conti.avvisi += 1;
        this._evento(g, ora, "Antifurto scattato", 3);
      } else if (inserito(dopo) && !inserito(prima)) {
        this._evento(g, ora, "Antifurto inserito", 2);
      } else if (dopo === "disarmed" && (inserito(prima) || prima === "triggered")) {
        this._evento(g, ora, "Antifurto disinserito", 2);
      }
    }
    if (dominio === "person" && prima !== null && dopo !== prima) {
      const primaVuota = vuota(prima);
      const dopoVuota = vuota(dopo);
      if (primaVuota === false && dopoVuota === true) {
        g.vuotaDal = ora;
        this._evento(g, ora, "Casa vuota", 2);
      } else if (primaVuota === true && dopoVuota === false) {
        const per = g.vuotaDal ? ora - g.vuotaDal : 0;
        const ore = Math.floor(per / ORA);
        const minuti = Math.round((per % ORA) / MINUTO);
        const quanto =
          per >= 10 * MINUTO ? ` · casa vuota ${ore ? `${ore} h ` : ""}${minuti} min` : "";
        g.vuotaDal = 0;
        this._evento(g, ora, `Rientro${quanto}`, 2);
      }
    }
    if (ora - this._scrittoIl >= 5 * MINUTO) this.scrivi();
  }

  /** Un evento della sentinella: un ciclo finito, un allarme. */
  evento(evento) {
    if (!evento || typeof evento !== "object") return;
    const ora = this.adesso();
    const g = this._laGiornata(ora);
    if (evento.tipo === "elettrodomestici") {
      const nome = String(evento.componi?.dati?.nome || "").trim() || "Elettrodomestico";
      const euro = evento.misura?.euro;
      const costo = typeof euro === "number" ? ` · ${euro.toFixed(2).replace(".", ",")} €` : "";
      this._evento(g, ora, `${nome}: ciclo finito${costo}`, 1);
    }
    if (evento.tipo === "allarmi" && evento.urgenza === "urgente") g.conti.avvisi += 1;
  }

  /* ─── La giornata, per la pagina ─────────────────────────────────────── */

  /**
   * Le sezioni della giornata per «La tua giornata». Ognuna `null` se in
   * casa manca quello che serve. Solo nomi, numeri e orari.
   */
  laGiornata({ stati = new Map(), valori = {} } = {}) {
    const ora = this.adesso();
    const g = this._laGiornata(ora);
    const t = this._trova(stati instanceof Map ? stati : new Map(), valori, ora);
    const ieri = this.archivio.dati.ieri;
    const diIeri = ieri && ieri.d < g.d ? ieri : null;

    /* Il clima. */
    const stanze = Object.values(g.stanze)
      .filter((s) => s.conti > 0)
      .slice(0, STANZE_AL_PIU)
      .map((s) => ({
        nome: s.nome,
        min: arrotonda(s.min),
        media: arrotonda(s.tot / s.conti),
        max: arrotonda(s.max),
        umidita: s.un ? Math.round(s.us / s.un) : null,
        ore: oreDellaSerie(s),
      }));
    const fuori =
      g.fuori && g.fuori.conti
        ? { min: arrotonda(g.fuori.min), max: arrotonda(g.fuori.max), ore: oreDellaSerie(g.fuori) }
        : null;
    const clima = stanze.length || fuori ? { stanze, fuori } : null;

    /* Il riscaldamento. */
    const r = g.riscaldamento;
    const riscaldamento = t.termostati.length
      ? {
          minutiAcceso: Math.round(r.acceso / MINUTO),
          comfort: r.campioni ? Math.round((100 * r.dentro) / r.campioni) : null,
          range: (r.range || COMFORT_DI_SERIE).map((x) => arrotonda(x)),
          obiettivo: arrotonda(r.obiettivo ?? null),
          finestreAperte: r.finestre,
          minutiClimaSpento: Math.round(r.spento / MINUTO),
          ieriMinuti: diIeri ? diIeri.riscaldamento : null,
        }
      : null;

    /* Il solare termico. */
    const s = g.solare;
    const sonda = (serie, c) =>
      c && serie?.conti
        ? { max: arrotonda(serie.max), maxAlle: oraDi(serie.maxIl), ore: oreDellaSerie(serie) }
        : null;
    const solareTermico =
      s && t.solare
        ? {
            collettore: sonda(s.collettore, t.solare.collettore),
            bollitore: sonda(s.bollitore, t.solare.bollitore),
            pompa: t.solare.pompa
              ? { minuti: Math.round(s.pompa / MINUTO), da: oraDi(s.da), a: oraDi(s.a) }
              : null,
            caloreKwh: null,
            euro: null,
            pressione: s.pressione !== null ? arrotonda(s.pressione) : null,
            resistenzaMinuti: t.solare.resistenza ? Math.round(s.resistenza / MINUTO) : null,
          }
        : null;

    /* Le auto. */
    const auto = Object.values(g.auto).map((a) => this._lAuto(a));
    const viste = new Set(t.auto.map((x) => x.nome));
    const delleAuto = auto.filter((a) => viste.has(a.nome));

    /* L'acqua. */
    const conAcqua = Boolean(t.acqua);
    const acqua =
      !t.acqua && !t.gas && !t.zone.length
        ? null
        : {
            litri: conAcqua ? Math.round(g.acqua.litri) : null,
            ieriPct:
              conAcqua && diIeri?.litri > 0
                ? Math.round(((g.acqua.litri - diIeri.litri) / diIeri.litri) * 100)
                : null,
            gas: t.gas ? arrotonda(g.acqua.gas, 1) : null,
            irrigazione: g.acqua.zone.length
              ? {
                  litri: conAcqua ? Math.round(g.acqua.irrigazione) : null,
                  zone: g.acqua.zone.length,
                  alle: oraDi(g.acqua.alle),
                }
              : null,
          };

    /* Gli eventi: i piu' importanti, poi in ordine di ora. */
    const eventi = g.eventi
      .map((e, i) => ({ e, i }))
      .sort((x, y) => y.e[2] - x.e[2] || x.i - y.i)
      .slice(0, EVENTI_AL_PIU)
      .sort((x, y) => x.e[0] - y.e[0] || x.i - y.i)
      .map(({ e }) => ({ ora: oraDi(e[0]), testo: e[1] }));

    const conti = {
      porte: t.porte ? g.conti.porte : null,
      automazioni: t.automazioni ? g.conti.automazioni : null,
      avvisi: t.sicurezza ? g.conti.avvisi : null,
    };

    return {
      clima,
      riscaldamento,
      solareTermico,
      auto: delleAuto.length ? delleAuto : null,
      acqua,
      eventi,
      conti: Object.values(conti).some((x) => x !== null) ? conti : null,
    };
  }

  _lAuto(a) {
    const ricariche = [...a.ricariche, ...(a.carica ? [a.carica] : [])].map((r) => {
      const kwh =
        r.wh > 0 ? r.wh / 1000 : Math.max(0, ((r.socA ?? 0) - (r.socDa ?? 0)) / 100) * a.capacita;
      return {
        da: oraDi(r.da),
        a: oraDi(r.a),
        kwh: arrotonda(kwh),
        socDa: r.socDa !== null ? Math.round(r.socDa) : null,
        socA: r.socA !== null ? Math.round(r.socA) : null,
        quotaSole: r.wh > 0 ? arrotonda(Math.min(1, r.sole / r.wh), 2) : null,
        euro: r.conPrezzo ? arrotonda(r.eur, 2) : null,
      };
    });
    let stimati = false;
    /* Un punto di batteria perso da ferma (la notte, il freddo) non e' un
     * viaggio: con l'odometro ci vuole mezzo chilometro, senza due punti. */
    const veri = [...a.viaggi, ...(a.viaggio ? [a.viaggio] : [])].filter((v) => {
      const pct = (v.socDa ?? 0) - (v.socA ?? v.socDa ?? 0);
      const conOdo =
        v.odoDa !== null && v.odoDa !== undefined && v.odoA !== null && v.odoA !== undefined;
      return conOdo ? v.odoA - v.odoDa >= 0.5 : pct >= 2;
    });
    const viaggi = veri.map((v) => {
      const pct = Math.max(0, (v.socDa ?? 0) - (v.socA ?? v.socDa ?? 0));
      let km =
        v.odoDa !== null && v.odoDa !== undefined && v.odoA !== null && v.odoA !== undefined
          ? v.odoA - v.odoDa
          : null;
      if (km === null && pct > 0) {
        km = ((pct / 100) * a.capacita * 100) / (a.consumo || KWH_OGNI_100_KM);
        stimati = true;
      }
      const ore = (v.a - v.da) / ORA;
      return {
        da: oraDi(v.da),
        a: oraDi(v.a),
        soc: Math.round(pct),
        km: km !== null ? Math.round(km) : null,
        lento: km !== null && km > 0 && ore > 0 ? km / ore < LENTO_SOTTO_KMH : false,
      };
    });
    const usatiPct = viaggi.reduce((s, v) => s + v.soc, 0);
    const usatiKwh = arrotonda((usatiPct / 100) * a.capacita);
    const conKm = viaggi.filter((v) => v.km !== null);
    const km = conKm.length ? conKm.reduce((s, v) => s + v.km, 0) : null;
    const ultimo = a.punti.at(-1);
    return {
      nome: a.nome,
      ricariche,
      viaggi,
      usatiKwh,
      usatiPct,
      km,
      /* Con i chilometri stimati il consumo e' quello assunto: non si dice. */
      kmStimati: stimati,
      kwh100: km && !stimati ? arrotonda((usatiKwh / km) * 100) : null,
      socStasera: ultimo ? ultimo[1] : null,
      soc: a.punti.slice(),
    };
  }

  scrivi() {
    this._scrittoIl = this.adesso();
    if (!this._suDisco) return;
    try {
      this.archivio.salva();
    } catch (errore) {
      this.registro?.attenzione?.(
        `il diario della casa non si scrive: ${errore?.message || errore}`,
      );
    }
  }
}

/* ─── Il mese, il confronto, le cose da sistemare, in breve ──────────────── */

/**
 * Dal primo del mese: gli euro di rete, i kWh del sole, quanti giorni. Dai
 * totali dei giorni passati del taccuino, piu' oggi. `null` senza giorni.
 */
export function ilMese(passati = [], giornata = null) {
  if (!giornata?.d) return null;
  const mese = giornata.d.slice(0, 7);
  const delMese = passati.filter((x) => x?.d?.startsWith(mese) && x.d < giornata.d);
  const euro = delMese.reduce((s, x) => s + (x.eur || 0), 0) + (giornata.euroRete || 0);
  const conSole = delMese.some((x) => x.pk > 0) || giornata.sole > 0;
  const sole = delMese.reduce((s, x) => s + (x.pk || 0), 0) + (giornata.sole || 0);
  return {
    euro: arrotonda(euro, 2),
    sole: conSole ? arrotonda(sole, 1) : null,
    giorni: delMese.length + 1,
  };
}

/**
 * Rispetto a ieri (il sole), alla settimana (la media di quello che la
 * giornata racconta) e al mese prima (gli euro di rete, sugli stessi giorni).
 * Percentuali intere, `null` dove non c'e' con cosa confrontare.
 */
export function ilConfronto({ passati = [], giornata = null, conSole = false, media = null }) {
  if (!giornata?.d) return null;
  const pct = (oggi, prima) =>
    oggi !== null && oggi !== undefined && prima > 0
      ? Math.round(((oggi - prima) / prima) * 100)
      : null;
  const ieri = passati.filter((x) => x?.d < giornata.d).at(-1);
  const ieriSolePct = conSole ? pct(giornata.sole, ieri?.pk) : null;
  const oggi = conSole ? giornata.sole : (giornata.casa ?? giornata.presi);
  const settimanaPct = pct(oggi, media);
  /* Il mese prima, fino allo stesso giorno. */
  const [anno, mese, giorno] = giornata.d.split("-").map(Number);
  const prima = new Date(anno, mese - 2, 1);
  const chiave = `${prima.getFullYear()}-${String(prima.getMonth() + 1).padStart(2, "0")}`;
  const delMesePrima = passati.filter(
    (x) => x?.d?.startsWith(chiave) && Number(x.d.slice(8, 10)) <= giorno,
  );
  const diQuesto = passati.filter(
    (x) => x?.d?.startsWith(giornata.d.slice(0, 7)) && x.d < giornata.d,
  );
  const euroPrima = delMesePrima.reduce((s, x) => s + (x.eur || 0), 0);
  const euroOra = diQuesto.reduce((s, x) => s + (x.eur || 0), 0) + (giornata.euroRete || 0);
  const meseRetePct = delMesePrima.length >= 3 ? pct(euroOra, euroPrima) : null;
  if (ieriSolePct === null && settimanaPct === null && meseRetePct === null) return null;
  return { ieriSolePct, settimanaPct, meseRetePct };
}

/** Le batterie scariche dei dispositivi di casa: senza telefoni, tablet e
 * orologi, che sono di qualcuno. */
export function batterieDiCasa(batterie = []) {
  return (Array.isArray(batterie) ? batterie : []).filter(
    (b) => b && typeof b.carica === "number" && !DI_QUALCUNO.test(String(b.nome || "")),
  );
}

/**
 * Le cose da sistemare, scritte: le batterie scariche col nome del
 * dispositivo (non quelle dei telefoni e degli orologi, che sono di
 * qualcuno), gli aggiornamenti, i dispositivi che non rispondono.
 */
export function daSistemare({ batterie = [], spenti = 0, aggiornamenti = 0 } = {}) {
  const fuori = [];
  const diCasa = batterieDiCasa(batterie);
  for (const b of diCasa.slice(0, 3))
    fuori.push({ icona: "batteria", testo: `${b.nome} al ${Math.round(b.carica)}%` });
  if (diCasa.length > 3)
    fuori.push({
      icona: "batteria",
      testo:
        diCasa.length - 3 === 1
          ? "1 altra batteria scarica"
          : `${diCasa.length - 3} altre batterie scariche`,
    });
  if (aggiornamenti)
    fuori.push({
      icona: "aggiornamento",
      testo:
        aggiornamenti === 1
          ? "1 aggiornamento disponibile"
          : `${aggiornamenti} aggiornamenti disponibili`,
    });
  if (spenti)
    fuori.push({
      icona: "offline",
      testo: spenti === 1 ? "1 dispositivo non connesso" : `${spenti} dispositivi non connessi`,
    });
  return fuori;
}

/* ─── I prezzi, la batteria di casa, il consiglio per domani ─────────────── */

/**
 * Il prezzo a cui si vende il kWh ceduto (`cd_prezzo_immissione`: un numero
 * o l'entita' che lo dice), o `null` se non e' scritto: qui non si assume il
 * prezzo di serie della plancia, perche' un guadagno inventato non si dice.
 * `stati` come oggetto (`states[id].state`).
 */
export function prezzoDiCessione(valori = {}, stati = {}) {
  return resolveRate(valori?.cd_prezzo_immissione, stati, null);
}

/**
 * Il prezzo di ogni fascia in cui oggi si e' preso dalla rete, per le
 * colonne «€/kWh» e «costo» della pagina: `{F1: 0.175, F3: 0.135}`. `null`
 * se nessuna di quelle fasce ha un prezzo.
 */
export function prezziDelleFasce(fasce, perFascia = {}) {
  const normali = normalizzaLeFasce(leggiJson(fasce) || {});
  const prezzi = {};
  for (const indice of Object.keys(perFascia || {})) {
    const prezzo = normali.voci[Number(indice)]?.prezzo;
    if (typeof prezzo === "number" && prezzo > 0) prezzi[nomeDellaFascia(indice)] = prezzo;
  }
  return Object.keys(prezzi).length ? prezzi : null;
}

/**
 * Quanti kWh tiene la batteria di casa: la somma delle capacita' dei pacchi
 * dell'accumulo (`cd_accumulo`), scritte o lette. `null` se non si sa.
 */
export function capacitaDellAccumulo(valori = {}, stati = {}) {
  try {
    const pacchi = accumuloDiCasa(stati, leggiJson(valori?.cd_accumulo) || {});
    const capacita = pacchi.reduce((s, p) => s + (p.capacitaKwh > 0 ? p.capacitaKwh : 0), 0);
    return capacita > 0 ? capacita : null;
  } catch (_errore) {
    return null;
  }
}

const NOMI_DEGLI_ELETTRODOMESTICI = Object.freeze({
  lavatrice: "lavatrice",
  lavastoviglie: "lavastoviglie",
  asciugatrice: "asciugatrice",
  lavasciuga: "lavasciuga",
});

/**
 * Il consiglio per domani, una frase in italiano: «Lavatrice e
 * lavastoviglie entro le 13: gratis col sole. Auto: ricarica dalle 10.»
 * Solo con il fotovoltaico, il sole previsto fino almeno a mezzogiorno
 * (`domani.soleFino`), e qualcosa in casa a cui dirlo: gli elettrodomestici
 * che ci sono (`elettrodomestici`, i generi) o l'auto. Altrimenti `null`.
 */
export function consiglioPerDomani({
  domani,
  conSole = false,
  elettrodomestici = [],
  conAuto = false,
}) {
  if (!conSole || !domani?.soleFino) return null;
  const fine = Number(String(domani.soleFino).slice(0, 2));
  if (!Number.isFinite(fine)) return null;
  const pezzi = [];
  const nomi = [
    ...new Set(
      (Array.isArray(elettrodomestici) ? elettrodomestici : [])
        .map((g) => NOMI_DEGLI_ELETTRODOMESTICI[g])
        .filter(Boolean),
    ),
  ].slice(0, 2);
  if (nomi.length) {
    const elenco = nomi.length === 1 ? nomi[0] : `${nomi[0]} e ${nomi[1]}`;
    const entro = Math.max(11, fine - 2);
    pezzi.push(`${elenco[0].toUpperCase()}${elenco.slice(1)} entro le ${entro}: gratis col sole.`);
  }
  if (conAuto) pezzi.push(`Auto: ricarica dalle ${Math.max(10, Number(domani.soleDa) || 10)}.`);
  return pezzi.length ? pezzi.join(" ") : null;
}

const virgola = (n, cifre = 1) =>
  n === null || n === undefined ? "" : Number(n).toFixed(cifre).replace(".", ",");

/**
 * «In breve»: tre o quattro frasi gia' scritte, in italiano, coi numeri che
 * contano in **grassetto**. Dalla risposta gia' fatta: l'energia, il clima,
 * l'acqua calda, chi ha consumato di piu', l'auto.
 */
export function inBreve(r) {
  const frasi = [];
  const g = r?.giornata;
  if (g && r.conSole && g.presi !== null && g.presi !== undefined)
    frasi.push({
      icona: "sole",
      testo:
        g.presi < 0.05
          ? "Dalla rete **niente**: tutto l'ha dato il sole."
          : `Hai preso dalla rete solo **${virgola(g.presi)} kWh${g.euroRete !== null && g.euroRete !== undefined ? ` (${virgola(g.euroRete, 2)} €)` : ""}**: il resto l'ha dato il sole.`,
    });
  else if (g?.casa)
    frasi.push({
      icona: "fulmine",
      testo: `La casa ha usato **${virgola(g.casa)} kWh**${g.euroRete ? `, ${virgola(g.euroRete, 2)} € di rete` : ""}.`,
    });
  const stanze = r?.clima?.stanze || [];
  if (stanze.length) {
    const min = Math.min(...stanze.map((s) => s.min));
    const max = Math.max(...stanze.map((s) => s.max));
    const fuori = r.clima.fuori;
    frasi.push({
      icona: "termometro",
      testo: `In casa fra **${virgola(min)}°** e **${virgola(max)}°**${fuori ? `; fuori minima ${virgola(fuori.min)}°, massima ${virgola(fuori.max)}°` : ""}.`,
    });
  }
  const st = r?.solareTermico;
  if (st?.bollitore?.max !== null && st?.bollitore?.max !== undefined)
    frasi.push({
      icona: "acqua",
      testo:
        st.resistenzaMinuti === null
          ? `Acqua calda a **${Math.round(st.bollitore.max)}°** col solare termico.`
          : st.resistenzaMinuti
            ? `Acqua calda a **${Math.round(st.bollitore.max)}°**, con la resistenza accesa ${st.resistenzaMinuti} min.`
            : `Acqua calda a **${Math.round(st.bollitore.max)}°** col solare termico, senza resistenza elettrica.`,
    });
  const piu = r?.piu?.[0];
  if (piu && frasi.length < 4)
    frasi.push({
      icona: "fulmine",
      testo: `Il più acceso: **${piu.nome}**, ${virgola(piu.kwh)} kWh${r.conSole && piu.sole ? ` (${Math.round(piu.sole * 100)}% col sole)` : ""}.`,
    });
  const auto = r?.auto?.[0];
  if (auto && frasi.length < 4 && (auto.viaggi.length || auto.ricariche.length))
    frasi.push({
      icona: "auto",
      testo: `${auto.nome}: **${virgola(auto.usatiKwh)} kWh** in ${auto.viaggi.length === 1 ? "1 viaggio" : `${auto.viaggi.length} viaggi`}${auto.socStasera !== null ? `, stasera al ${auto.socStasera}%` : ""}.`,
    });
  return frasi.slice(0, 4);
}
