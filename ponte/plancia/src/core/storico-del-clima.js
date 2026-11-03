/* Lo storico del clima: il report anche sui mesi che Home Assistant ha gia'
 * dimenticato.
 *
 * «Recupera anche dati storici altrimenti non ha senso.» Il report del clima
 * (`report-del-clima.js`) conta il tempo dalla storia di Home Assistant, e la
 * storia di Home Assistant di solito dura dieci giorni (`purge_keep_days` del
 * Recorder): il luglio scorso, a novembre, era «Nessun dato in questo
 * periodo». I dati c'erano stati; nessuno li aveva messi da parte.
 *
 * Adesso le fonti sono tre, e si prendono in quest'ordine, giorno per giorno:
 *
 *  1. **l'archivio del ponte** — ogni notte il ponte riassume il giorno prima
 *     dalla storia, finche' la storia c'e', e lo tiene in `/data`: tre anni di
 *     giorni, sessanta di ore (`ponte/src/storico-del-clima.js`). E' lo stesso
 *     conto del report, fatto quel giorno: dice quello che il report avrebbe
 *     detto allora;
 *  2. **la storia** di Home Assistant, per i giorni che ha ancora;
 *  3. **le statistiche a lungo termine**, che Home Assistant tiene per sempre
 *     ma solo per i sensori numerici, e solo come medie, minimi e massimi
 *     d'ora. Li' ci sono la temperatura delle stanze (dal sensore della
 *     stanza), l'apertura delle valvole, i watt dei climatizzatori sotto una
 *     presa e i numeri della caldaia. Non c'e' `hvac_action`: le ore di
 *     richiesta si **stimano** — dalla valvola aperta, o dai watt — e il
 *     report lo scrive. Dove non c'e' niente da cui stimare non si inventa:
 *     resta «—».
 *
 * Il giorno e' l'unita' di tutto: ogni fonte ne fa un riassunto della stessa
 * forma (`riassuntoDelGiorno`, `riassuntoDalleStatistiche`), e il report di un
 * periodo li somma (`reportDaiGiorni`). I numeri dentro il riassunto sono in
 * minuti e le medie portano il loro peso: un mese e' la somma dei suoi
 * giorni, non la media delle medie.
 *
 * Tutto puro: entrano righe e numeri, escono numeri. Lo usano la plancia e il
 * ponte.
 */
import {
  COPERTURA_MINIMA,
  SOGLIA_WATT_DEL_GENERATORE,
  accensioni,
  comfortDegliObiettivi,
  durata,
  durataNeiSecchielli,
  generatoriNelPeriodo,
  periodoDelReport,
  stanzaNelPeriodo,
  unisci,
  unitaDellImpianto,
} from "./report-del-clima.js";
import { canonicalClimateType } from "./device-model.js";
import { eUnTermostatoACoppia } from "./i-due-obiettivi-del-clima.js";

const pulito = (valore) => String(valore ?? "").trim();
const MINUTO = 60_000;
const ORA = 3_600_000;

/* Quanto si tiene: tre anni di giorni e sessanta giorni di ore. Un giorno
 * senza le sue ore pesa un decimo, e dopo due mesi il grafico ora per ora di
 * un giorno lontano non lo chiede quasi nessuno. */
export const GIORNI_CONSERVATI = 3 * 366;
export const GIORNI_CON_LE_ORE = 60;

/* Sotto questa apertura media una valvola e' chiusa: il rumore di una testina
 * che si riassesta non e' una stanza che chiede calore. */
export const SOGLIA_VALVOLA = 5;

/* I mesi in cui una pompa di calore, a sapere solo i watt, si conta come
 * raffrescamento: da maggio a settembre. E' una stima e il report lo dice. */
export const MESI_DEL_FRESCO = Object.freeze([4, 5, 6, 7, 8]);

/* ── i giorni ─────────────────────────────────────────────────────────── */

const due = (n) => String(n).padStart(2, "0");

/** «2026-07-14»: il giorno locale di un istante. */
export function chiaveDelGiorno(istante) {
  const d = new Date(istante);
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
}

/** La mezzanotte locale di una chiave, o `null` se non e' una chiave. */
export function inizioDellaChiave(chiave) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(pulito(chiave));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

/**
 * I giorni di un periodo che hanno gia' cominciato: `{ chiave, inizio, fine }`.
 *
 * `fine` e' la mezzanotte dopo, o l'adesso per il giorno in corso. Un giorno
 * e' chiuso quando la sua fine e' la mezzanotte dopo.
 */
export function giorniDelPeriodo(periodo) {
  const giorni = [];
  const d = new Date(periodo.inizio);
  while (d.getTime() < periodo.fine) {
    const inizio = d.getTime();
    d.setDate(d.getDate() + 1);
    giorni.push({
      chiave: chiaveDelGiorno(inizio),
      inizio,
      fine: Math.min(d.getTime(), periodo.fine),
      chiuso: d.getTime() <= periodo.fine,
    });
  }
  return giorni;
}

/* ── le unita', anche dove la pagina non c'e' ─────────────────────────── */

/**
 * Le zone di un'unita': la stessa regola della pagina Clima.
 *
 * Il termostato a coppia sta nella sua; il termosifone nel Caldo, il
 * condizionatore nel Freddo, la pompa di calore in tutti e due.
 */
export function zoneDellUnita(unit, attributi = null) {
  if (attributi && eUnTermostatoACoppia(attributi)) return ["termostato"];
  const tipo = canonicalClimateType(unit?.type);
  if (tipo === "termo") return ["caldo"];
  if (tipo === "pompa") return ["freddo", "caldo"];
  return ["freddo"];
}

function leggiJson(valore) {
  if (typeof valore !== "string") return valore ?? null;
  try {
    return JSON.parse(valore);
  } catch (_errore) {
    return null;
  }
}

/**
 * Le unita' del clima dalla configurazione salvata, una per zona.
 *
 * Il ponte non ha la pagina: legge `cd_clima_units` (o, nelle configurazioni
 * nuove, le sezioni del deposito) e traduce le entita' con le stesse caselle
 * di casa. `attributiDi` dice gli attributi di adesso, per riconoscere il
 * termostato a coppia.
 */
export function unitaDallaConfigurazione(
  valori = {},
  { risolvi = (x) => x, attributiDi = () => null } = {},
) {
  let elenco = leggiJson(valori?.cd_clima_units);
  if (!Array.isArray(elenco) || !elenco.length) {
    const stato = leggiJson(valori?.dm_dashboard_state);
    elenco = Array.isArray(stato?.sections?.climate) ? stato.sections.climate : [];
  }
  const vera = (entity) => pulito(risolvi(pulito(entity))) || pulito(entity);
  return elenco.flatMap((unit) => {
    const grezza = pulito(unit?.entity || unit?.entity_id || unit?.entities?.[0]);
    if (!grezza || grezza.startsWith("humidifier.")) return [];
    const entity = vera(grezza);
    const valvola = pulito(unit?.valvola) ? vera(unit.valvola) : "";
    /* La presa scritta nella scheda (#490), e i watt oltre i quali e' accesa:
     * per gli split che non dicono `hvac_action` sono loro a dire le ore. */
    const consumo = pulito(unit?.consumo) ? vera(unit.consumo) : "";
    const soglia = unit?.soglia_consumo;
    return zoneDellUnita(unit, attributiDi(entity)).map((zone) => ({
      entity,
      name: pulito(unit?.name) || entity,
      valvola,
      ...(consumo ? { consumo } : {}),
      ...(soglia !== null && soglia !== undefined && pulito(soglia) !== ""
        ? { soglia_consumo: soglia }
        : {}),
      zone,
    }));
  });
}

/* Le caselle di una caldaia che dicono se lavora, nell'ordine in cui il
 * report le guarda: la prima che c'e' per la storia, tutte per le
 * statistiche (un binary_sensor non ne ha, una modulazione si'). */
const CASELLE_CHE_LAVORANO = Object.freeze(["stato", "fiamma", "modulazione", "interruttore"]);

/** Le caldaie dalla configurazione salvata: `{ nome, entity, statistiche }`. */
export function caldaieDallaConfigurazione(valori = {}, { risolvi = (x) => x } = {}) {
  const grezze = leggiJson(valori?.cd_caldaia);
  const righe = Array.isArray(grezze)
    ? grezze
    : grezze && typeof grezze === "object"
      ? [grezze]
      : [];
  const vera = (entity) => pulito(risolvi(pulito(entity))) || pulito(entity);
  const viste = new Set();
  return righe.flatMap((riga) => {
    const caselle = CASELLE_CHE_LAVORANO.map((campo) => pulito(riga?.[campo]))
      .filter(Boolean)
      .map(vera);
    if (!caselle.length || viste.has(caselle[0])) return [];
    viste.add(caselle[0]);
    return [{ nome: pulito(riga?.name), entity: caselle[0], statistiche: [...new Set(caselle)] }];
  });
}

export { CASELLE_CHE_LAVORANO };

/* ── il riassunto di un giorno, dalla storia ──────────────────────────── */

const minuti = (ms) => Math.round(Math.max(0, Number(ms) || 0) / MINUTO);
const centesimi = (n) => Math.round(n * 100) / 100;
const media = (valore, pesoMs) =>
  valore === null || valore === undefined || !pesoMs ? null : [centesimi(valore), minuti(pesoMs)];
const ore = (secchielli) => secchielli.map((ms) => minuti(ms));

/**
 * Il riassunto di un giorno di un impianto, dalla storia: `null` se quel
 * giorno la storia non dice niente.
 *
 * `giorno` e' `{ inizio, fine }`; `storie` le righe gia' normalizzate, che
 * possono andare oltre il giorno (si tagliano qui). Le stanze senza un minuto
 * di storia quel giorno non ci sono: «non so» non e' «spenta».
 */
export function riassuntoDelGiorno({
  impianto = "caldo",
  unita = [],
  storie = {},
  generatori = [],
  giorno,
  adesso = Date.now(),
}) {
  const periodo = { ...periodoDelReport("giorno", new Date(giorno.inizio), adesso) };
  periodo.fine = Math.min(periodo.fine, giorno.fine ?? periodo.fine);
  const stanze = {};
  const intervalli = [];
  for (const u of unitaDellImpianto(impianto, unita)) {
    const s = stanzaNelPeriodo(impianto, u, storie, periodo);
    if (!s.msNoti) continue;
    intervalli.push(...s.intervalli);
    stanze[u.entity] = {
      r: minuti(s.msRichiesta),
      a: minuti(s.msAccesa),
      n: minuti(s.msNoti),
      o: ore(s.perSecchiello),
      t: media(s.ambiente, s.pesi.ambiente),
      /* Il comfort si decide sul periodo intero: qui le ore accese per
       * obiettivo, con la temperatura di quelle ore (`comfortDegliObiettivi`). */
      ob: s.obiettivi.map(([obiettivo, ms, somma, peso]) => [
        obiettivo,
        minuti(ms),
        peso ? centesimi(somma / peso) : null,
        minuti(peso),
      ]),
      v: media(s.valvola, s.pesi.valvola),
      vd: s.valvolaDa,
      s: s.richiestaStimata,
      /* Quando la richiesta l'hanno detta i watt: da dove, e quanto hanno
       * consumato. Senza, i campi non ci sono (archivi di prima uguali). */
      ...(s.richiestaDa ? { sv: s.richiestaDa } : {}),
      ...(s.kwh !== null && s.kwh !== undefined ? { kwh: s.kwh } : {}),
    };
  }
  const caldaie = {};
  /* Le caldaie stanno col Riscaldamento: col Raffrescamento non ci sono. */
  const diQuesto = impianto === "freddo" ? [] : generatori;
  for (const g of generatoriNelPeriodo(impianto, diQuesto, storie, periodo)) {
    if (!g.msNoti) continue;
    caldaie[g.entity] = {
      ms: minuti(g.ms),
      acc: g.accensioni,
      o: ore(g.perSecchiello),
      n: minuti(g.msNoti),
    };
  }
  if (!Object.keys(stanze).length && !Object.keys(caldaie).length) return null;
  const unione = unisci(intervalli);
  return {
    fonte: "storia",
    stanze,
    generatori: caldaie,
    stima: {
      ms: minuti(durata(unione)),
      acc: accensioni(unione, periodo.inizio),
      o: ore(durataNeiSecchielli(unione, periodo.secchielli)),
    },
  };
}

/* ── le statistiche a lungo termine ───────────────────────────────────── */

/** La domanda: un'ora alla volta, per tutte le entita' insieme. */
export function domandaStatisticheDelClima(ids, da, a) {
  return {
    type: "recorder/statistics_during_period",
    start_time: new Date(da).toISOString(),
    end_time: new Date(a).toISOString(),
    statistic_ids: [...new Set((ids || []).map(pulito).filter(Boolean))],
    period: "hour",
    types: ["mean", "max", "min", "change", "state"],
  };
}

const numero = (valore) => {
  if (valore === null || valore === undefined || valore === "") return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

function istanteMs(valore) {
  if (typeof valore === "number") return valore < 1_000_000_000_000 ? valore * 1000 : valore;
  const letto = Date.parse(pulito(valore));
  return Number.isFinite(letto) ? letto : null;
}

/**
 * Le ore di una statistica: `{ t, mean, max, min, change }`, in ordine.
 *
 * `start` e' l'inizio dell'ora in UTC: e' un istante, e cade nell'ora locale
 * giusta da solo — nei fusi a mezz'ora l'ora locale ne prende due mezze, e
 * qui va tutta in quella in cui comincia.
 */
export function oreDelleStatistiche(risposta, id) {
  const elenco = Array.isArray(risposta?.[id]) ? risposta[id] : [];
  return elenco
    .map((voce) => ({
      t: istanteMs(voce?.start),
      mean: numero(voce?.mean),
      max: numero(voce?.max),
      min: numero(voce?.min),
      change: numero(voce?.change),
      state: numero(voce?.state),
    }))
    .filter((voce) => voce.t !== null)
    .sort((x, y) => x.t - y.t);
}

/* In quale secchiello del giorno cade un'ora delle statistiche. */
function indiceDellOra(secchielli, t) {
  return secchielli.findIndex((s) => t >= s.inizio && t < s.fine);
}

/**
 * Quanto di un'ora ha lavorato, dalla media e dal massimo: 0..1.
 *
 * Una valvola aperta al 60% per venti minuti fa media 20 e massimo 60: un
 * terzo d'ora. Un climatizzatore a 900 W per mezz'ora, media 450 e massimo
 * 900: meta'. Sotto la soglia il massimo non conta — e' una testina che si
 * assesta, o il led del climatizzatore.
 */
export function quotaDellOra(voce, soglia) {
  if (!voce) return 0;
  const { mean, max } = voce;
  if (max !== null && max !== undefined) {
    if (max < soglia || !(max > 0) || mean === null) return 0;
    return Math.min(1, Math.max(0, mean / max));
  }
  if (mean === null) return 0;
  return mean >= soglia ? 1 : 0;
}

const UNITA_MILLE = Object.freeze({ kw: 1000 });
/* L'energia di un contatore, in kWh. */
const UNITA_IN_KWH = Object.freeze({ wh: 0.001, kwh: 1, mwh: 1000 });
/* Sotto questi wattora in un'ora il climatizzatore e' in attesa, non lavora:
 * uno split spento ne consuma pochi, uno che raffresca centinaia. */
export const SOGLIA_WH_DELL_ORA = 30;

/** Che cosa misura il numero di una caldaia, dalla sua unita'. */
export function tipoDellaMisura(unitaDiMisura) {
  const u = pulito(unitaDiMisura).toLowerCase();
  if (["h", "hours", "hour", "ore", "hrs"].includes(u)) return "ore";
  if (["w", "kw"].includes(u)) return "potenza";
  if (u === "%") return "percento";
  if (["kwh", "wh", "mwh", "m³", "m3", "l", "ft³"].includes(u)) return "energia";
  return u ? "altro" : "";
}

/**
 * Il riassunto di un giorno di un impianto, dalle statistiche: `null` se non
 * ce ne sono.
 *
 * `serie` sono le ore di ogni statistica (`oreDelleStatistiche`), `unitaDi`
 * l'unita' di misura di una statistica. Le unita' portano, oltre all'entita':
 * `valvola`, `consumo` (i watt della presa) con `soglia_consumo`, e
 * `temperatura` (il sensore della stanza). Le caldaie portano `statistiche`,
 * le loro caselle numeriche.
 *
 * Quello che esce e' segnato: `sv` dice da cosa e' stimata la richiesta
 * («valvola», «consumo», «stagione» per una pompa di calore che si conosce
 * solo dai watt), e le accensioni della caldaia non ci sono (`null`): da una
 * media d'ora non si contano.
 */
export function riassuntoDalleStatistiche({
  impianto = "caldo",
  unita = [],
  generatori = [],
  serie = {},
  unitaDi = () => "",
  giorno,
  adesso = Date.now(),
}) {
  const periodo = { ...periodoDelReport("giorno", new Date(giorno.inizio), adesso) };
  periodo.fine = Math.min(periodo.fine, giorno.fine ?? periodo.fine);
  const secchielli = periodo.secchielli.filter((s) => s.inizio < periodo.fine);
  const lunghezza = periodo.secchielli.length;
  const nelGiorno = (id) => {
    const per = new Array(lunghezza).fill(null);
    for (const voce of serie[pulito(id)] || []) {
      const i = indiceDellOra(secchielli, voce.t);
      if (i >= 0) per[i] = voce;
    }
    return per;
  };
  const durataDi = (i) => (secchielli[i] ? secchielli[i].fine - secchielli[i].inizio : 0);
  const mese = new Date(giorno.inizio).getMonth();
  const stagioneDelFresco = MESI_DEL_FRESCO.includes(mese);

  const stanze = {};
  const quoteStanze = [];
  for (const u of unitaDellImpianto(impianto, unita)) {
    const zone = unita.filter((x) => x.entity === u.entity).map((x) => x.zone);
    const doppia = zone.includes("caldo") && zone.includes("freddo");
    const temperatura = nelGiorno(u.temperatura || "");
    const climaStessa = nelGiorno(u.entity);
    const valvola = pulito(u.valvola) && impianto !== "freddo" ? nelGiorno(u.valvola) : null;
    const consumo = pulito(u.consumo) ? nelGiorno(u.consumo) : null;
    /* Potenza (W, kW) o energia (Wh, kWh): dalla potenza si sa quanto di
     * ogni ora ha lavorato, dall'energia solo se in quell'ora ha consumato. */
    const unitaDelConsumo = pulito(unitaDi(u.consumo)).toLowerCase();
    const comeEnergia = pulito(u.consumo) && tipoDellaMisura(unitaDelConsumo) === "energia";
    const scala = comeEnergia
      ? (UNITA_IN_KWH[unitaDelConsumo] ?? 1)
      : UNITA_MILLE[unitaDelConsumo] || 1;
    const soglia = numero(u.soglia_consumo) ?? SOGLIA_WATT_DEL_GENERATORE;
    const haValvola = valvola?.some(Boolean);
    const haConsumo = consumo?.some(Boolean);
    /* I watt di una pompa di calore non dicono se scaldava o raffrescava:
     * decide la stagione, e si scrive. */
    const consumoDiQuesto = haConsumo && (!doppia || stagioneDelFresco === (impianto === "freddo"));
    let somma = 0;
    let peso = 0;
    for (let i = 0; i < lunghezza; i += 1) {
      const voce = temperatura[i] || climaStessa[i];
      const valore = voce?.mean ?? voce?.state ?? null;
      if (valore === null || !durataDi(i)) continue;
      somma += valore * durataDi(i);
      peso += durataDi(i);
    }
    let valvolaSomma = 0;
    let valvolaPeso = 0;
    const perOra = new Array(lunghezza).fill(0);
    let fonte = null;
    if (haValvola) {
      fonte = "valvola";
      for (let i = 0; i < lunghezza; i += 1) {
        const voce = valvola[i];
        if (!voce || !durataDi(i)) continue;
        perOra[i] = quotaDellOra(voce, SOGLIA_VALVOLA) * durataDi(i);
        if (voce.mean !== null) {
          valvolaSomma += voce.mean * durataDi(i);
          valvolaPeso += durataDi(i);
        }
      }
    } else if (consumoDiQuesto) {
      fonte = doppia ? "stagione" : u.consumoTrovato ? "dispositivo" : "consumo";
      for (let i = 0; i < lunghezza; i += 1) {
        const voce = consumo[i];
        if (!voce || !durataDi(i)) continue;
        if (comeEnergia) {
          /* Un'ora con piu' di qualche decina di wattora e' un'ora di
           * lavoro: e' tutto quello che un contatore d'ora sa dire. */
          const wh = Math.max(0, voce.change ?? 0) * scala * 1000;
          perOra[i] = wh >= SOGLIA_WH_DELL_ORA ? durataDi(i) : 0;
          continue;
        }
        const inWatt = {
          mean: voce.mean === null ? null : voce.mean * scala,
          max: voce.max === null ? null : voce.max * scala,
        };
        perOra[i] = quotaDellOra(inWatt, soglia) * durataDi(i);
      }
    }
    let kwh = null;
    if (haConsumo && consumoDiQuesto) {
      kwh = 0;
      for (let i = 0; i < lunghezza; i += 1) {
        if (!consumo[i]) continue;
        if (comeEnergia) kwh += Math.max(0, consumo[i].change ?? 0) * scala;
        else if (consumo[i].mean !== null)
          kwh += (consumo[i].mean * scala * durataDi(i)) / ORA / 1000;
      }
      kwh = centesimi(kwh);
    }
    if (!peso && !fonte) continue;
    const richiesta = fonte ? perOra.reduce((s, x) => s + x, 0) : null;
    if (fonte) quoteStanze.push(perOra);
    stanze[u.entity] = {
      r: richiesta === null ? null : minuti(richiesta),
      /* Dai watt si sa anche quanto e' rimasta accesa; dalla valvola no. */
      a: fonte && fonte !== "valvola" ? minuti(richiesta) : null,
      n: 0,
      o: fonte ? ore(perOra) : null,
      t: peso ? [centesimi(somma / peso), minuti(peso)] : null,
      ob: null,
      v: valvolaPeso ? [centesimi(valvolaSomma / valvolaPeso), minuti(valvolaPeso)] : null,
      vd: valvolaPeso ? "entita" : null,
      s: Boolean(fonte),
      sv: fonte,
      kwh,
    };
  }

  const caldaie = {};
  if (impianto !== "freddo") {
    for (const g of generatori || []) {
      const candidate = [
        ...new Set([...(g.statistiche || []), g.entity].map(pulito).filter(Boolean)),
      ];
      for (const id of candidate) {
        const per = nelGiorno(id);
        if (!per.some(Boolean)) continue;
        const unitaDiMisura = unitaDi(id);
        const tipo = tipoDellaMisura(unitaDiMisura);
        const scala = UNITA_MILLE[pulito(unitaDiMisura).toLowerCase()] || 1;
        const perOra = new Array(lunghezza).fill(0);
        let consumo = null;
        for (let i = 0; i < lunghezza; i += 1) {
          const voce = per[i];
          if (!voce || !durataDi(i)) continue;
          if (tipo === "ore")
            perOra[i] = Math.min(durataDi(i), Math.max(0, (voce.change ?? 0) * ORA));
          else if (tipo === "energia") {
            const cambio = Math.max(0, voce.change ?? 0);
            if (cambio > 0) perOra[i] = durataDi(i);
            consumo = (consumo ?? 0) + cambio;
          } else if (tipo === "potenza") {
            perOra[i] =
              quotaDellOra(
                {
                  mean: voce.mean === null ? null : voce.mean * scala,
                  max: voce.max === null ? null : voce.max * scala,
                },
                SOGLIA_WATT_DEL_GENERATORE,
              ) * durataDi(i);
            if (voce.mean !== null)
              consumo = (consumo ?? 0) + (voce.mean * scala * durataDi(i)) / ORA / 1000;
          } else perOra[i] = quotaDellOra(voce, Number.MIN_VALUE) * durataDi(i);
        }
        caldaie[pulito(g.entity) || id] = {
          ms: minuti(perOra.reduce((s, x) => s + x, 0)),
          acc: null,
          o: ore(perOra),
          n: 0,
          da: id,
          tipo,
          consumo: consumo === null ? null : centesimi(consumo),
          unita: tipo === "potenza" ? "kWh" : tipo === "energia" ? pulito(unitaDiMisura) : "",
        };
        break;
      }
    }
  }
  if (!Object.keys(stanze).length && !Object.keys(caldaie).length) return null;
  /* L'impianto acceso, quando nessuna caldaia lo dice: almeno quanto la
   * stanza che ha chiesto di piu' in quell'ora. E' il meno che si puo' dire. */
  const stimaOre = new Array(lunghezza)
    .fill(0)
    .map((_, i) => Math.max(0, ...quoteStanze.map((q) => q[i])));
  return {
    fonte: "statistiche",
    stanze,
    generatori: caldaie,
    /* Senza nessuna stanza che sappia le sue ore la stima dell'impianto non
     * c'e': zero vorrebbe dire «spento tutto il giorno», ed e' «non so». */
    stima: quoteStanze.length
      ? { ms: minuti(stimaOre.reduce((s, x) => s + x, 0)), acc: null, o: ore(stimaOre) }
      : null,
  };
}

/* ── l'archivio ───────────────────────────────────────────────────────── */

/**
 * L'archivio potato: via i giorni piu' vecchi di tre anni, e le ore di quelli
 * piu' vecchi di sessanta giorni. Torna un archivio nuovo.
 */
export function potaLArchivio(giorni = {}, adesso = Date.now()) {
  const oggi = new Date(adesso);
  const limite = new Date(
    oggi.getFullYear(),
    oggi.getMonth(),
    oggi.getDate() - GIORNI_CONSERVATI,
  ).getTime();
  const senzaOre = new Date(
    oggi.getFullYear(),
    oggi.getMonth(),
    oggi.getDate() - GIORNI_CON_LE_ORE,
  ).getTime();
  const fuori = {};
  for (const chiave of Object.keys(giorni || {}).sort()) {
    const inizio = inizioDellaChiave(chiave);
    if (inizio === null || inizio < limite) continue;
    const giorno = giorni[chiave];
    if (!giorno || typeof giorno !== "object") continue;
    fuori[chiave] = inizio < senzaOre ? senzaLeOre(giorno) : giorno;
  }
  return fuori;
}

function senzaLeOre(giorno) {
  const togli = (record) => {
    if (!record) return record;
    const stanze = Object.fromEntries(
      Object.entries(record.stanze || {}).map(([k, v]) => [k, { ...v, o: null }]),
    );
    const generatori = Object.fromEntries(
      Object.entries(record.generatori || {}).map(([k, v]) => [k, { ...v, o: null }]),
    );
    return {
      ...record,
      stanze,
      generatori,
      stima: record.stima ? { ...record.stima, o: null } : record.stima,
    };
  };
  return Object.fromEntries(
    Object.entries(giorno).map(([impianto, record]) => [impianto, togli(record)]),
  );
}

/** I giorni dell'archivio fra due chiavi, comprese. */
export function giorniFra(giorni = {}, da = "", a = "") {
  const fuori = {};
  for (const [chiave, giorno] of Object.entries(giorni || {}))
    if ((!da || chiave >= da) && (!a || chiave <= a)) fuori[chiave] = giorno;
  return fuori;
}

/* ── il report dai giorni ─────────────────────────────────────────────── */

const unisciMedia = (accumulo, coppia) => {
  if (!Array.isArray(coppia) || coppia[0] === null || !coppia[1]) return;
  accumulo.somma += coppia[0] * coppia[1];
  accumulo.peso += coppia[1];
};
const mediaDi = (accumulo) => (accumulo.peso ? accumulo.somma / accumulo.peso : null);

/**
 * Il report di un periodo, dai riassunti dei suoi giorni.
 *
 * `giorni` e' l'elenco di `giorniDelPeriodo`, ognuno col suo `record` (o
 * `null`). Esce la stessa forma di `reportDellImpianto`, piu' le fonti: quanti
 * giorni dall'archivio, dalla storia, dalle statistiche, e quanti senza
 * niente. I numeri che non si sanno restano `null` — non zero.
 */
export function reportDaiGiorni({
  impianto = "caldo",
  unita = [],
  generatori = [],
  periodo,
  giorni = [],
}) {
  const { secchielli } = periodo;
  const perOra = periodo.vista === "giorno";
  const fonti = { archivio: 0, storia: 0, statistiche: 0, nessuna: 0 };
  for (const g of giorni) fonti[g.record ? g.record.fonte || "storia" : "nessuna"] += 1;
  const conStoria = giorni.filter((g) => g.record && g.record.fonte !== "statistiche");
  const lungoStoria = conStoria.reduce((s, g) => s + Math.max(0, g.fine - g.inizio), 0);
  /* Il secchiello di un giorno: ora per ora nel giorno, il giorno stesso
   * nella settimana e nel mese. */
  const riempi = (perSecchiello, g, indice, minutiDelGiorno, oreDelGiorno) => {
    if (perOra) {
      if (Array.isArray(oreDelGiorno))
        oreDelGiorno.forEach((m, i) => {
          if (i < perSecchiello.length) perSecchiello[i] += (m || 0) * MINUTO;
        });
    } else if (indice >= 0 && indice < perSecchiello.length)
      perSecchiello[indice] += (minutiDelGiorno || 0) * MINUTO;
  };
  const indiceDelGiorno = (g) => (perOra ? 0 : secchielli.findIndex((s) => s.inizio === g.inizio));

  const stanze = unitaDellImpianto(impianto, unita).map((u) => {
    const acc = {
      r: 0,
      rNota: false,
      rIgnoti: 0,
      a: 0,
      aNota: false,
      n: 0,
      t: { somma: 0, peso: 0 },
      ob: new Map(),
      v: { somma: 0, peso: 0 },
      vd: null,
      s: false,
      sv: new Set(),
      kwh: null,
      presente: false,
      statistiche: 0,
      oreMancanti: false,
    };
    const perSecchiello = secchielli.map(() => 0);
    for (const g of giorni) {
      const x = g.record?.stanze?.[u.entity];
      if (!x) continue;
      acc.presente = true;
      if (g.record.fonte === "statistiche") acc.statistiche += 1;
      if (x.r === null || x.r === undefined) acc.rIgnoti += 1;
      else {
        acc.r += x.r;
        acc.rNota = true;
        riempi(perSecchiello, g, indiceDelGiorno(g), x.r, x.o);
        if (perOra && !Array.isArray(x.o)) acc.oreMancanti = true;
      }
      if (x.a !== null && x.a !== undefined) {
        acc.a += x.a;
        acc.aNota = true;
      }
      acc.n += x.n || 0;
      unisciMedia(acc.t, x.t);
      if (Array.isArray(x.ob))
        for (const [obiettivo, mins, ambiente, peso] of x.ob) {
          const voce = acc.ob.get(obiettivo) || [obiettivo, 0, 0, 0];
          voce[1] += (mins || 0) * MINUTO;
          if (ambiente !== null && ambiente !== undefined && peso) {
            voce[2] += ambiente * peso * MINUTO;
            voce[3] += peso * MINUTO;
          }
          acc.ob.set(obiettivo, voce);
        }
      unisciMedia(acc.v, x.v);
      acc.vd = acc.vd || x.vd || null;
      acc.s = acc.s || Boolean(x.s);
      if (x.sv) acc.sv.add(x.sv);
      if (x.kwh !== null && x.kwh !== undefined) acc.kwh = (acc.kwh ?? 0) + x.kwh;
    }
    const valvola = mediaDi(acc.v);
    const copertura = lungoStoria ? (acc.n * MINUTO) / lungoStoria : 0;
    const comfort = comfortDegliObiettivi(impianto, [...acc.ob.values()]);
    return {
      entity: u.entity,
      nome: pulito(u.name) || u.entity,
      stanza: pulito(u.room),
      msRichiesta: acc.rNota ? acc.r * MINUTO : null,
      msAccesa: acc.aNota ? acc.a * MINUTO : null,
      perSecchiello,
      ambiente: mediaDi(acc.t),
      msComfort: comfort.ms,
      ambienteComfort: comfort.ambiente,
      obiettivoComfort: comfort.obiettivo,
      valvola,
      valvolaDa: valvola === null ? null : acc.vd,
      richiestaStimata: acc.s,
      /* La richiesta si sa per alcuni giorni e per altri no: il numero e'
       * quello dei giorni che la sanno. */
      richiestaParziale: acc.rNota && acc.rIgnoti > 0,
      stimaDa: [...acc.sv],
      kwh: acc.kwh === null ? null : centesimi(acc.kwh),
      presente: acc.presente,
      giorniStatistiche: acc.statistiche,
      oreMancanti: acc.oreMancanti,
      copertura,
      datiScarsi: lungoStoria > 0 && !acc.statistiche && copertura < COPERTURA_MINIMA,
    };
  });
  stanze.sort(
    (x, y) =>
      (y.msRichiesta ?? -1) - (x.msRichiesta ?? -1) ||
      (y.presente ? 1 : 0) - (x.presente ? 1 : 0) ||
      x.nome.localeCompare(y.nome),
  );
  /* Un'unita' che nel periodo non ha mai lavorato per questo impianto non e'
   * di questo report; una di cui non si sa niente resta, con «dati parziali»
   * o col suo «—». */
  const mute = (s) => s.presente && s.msRichiesta === 0 && !(s.msAccesa > 0);
  const nascoste = stanze.filter(mute).length;
  const visibili = stanze.filter((s) => !mute(s) && (s.presente || lungoStoria > 0));

  /* Le caldaie: quelle che hanno detto qualcosa, nei giorni in cui l'hanno
   * detto. I giorni senza caldaia non si riempiono con la stima delle stanze:
   * sarebbero ore di caldaia che la caldaia non ha mai detto. */
  const misurate = [];
  let giorniSenzaCaldaia = 0;
  for (const gen of generatori || []) {
    const entity = pulito(gen.entity);
    let ms = 0;
    let acc = 0;
    let accNote = true;
    let consumo = null;
    let unitaConsumo = "";
    let tipo = "";
    let giorniConDati = 0;
    let daStatistiche = 0;
    let oreMancanti = false;
    const perSecchiello = secchielli.map(() => 0);
    for (const g of giorni) {
      const x = g.record?.generatori?.[entity];
      if (!x) continue;
      giorniConDati += 1;
      if (g.record.fonte === "statistiche") daStatistiche += 1;
      ms += (x.ms || 0) * MINUTO;
      if (x.acc === null || x.acc === undefined) accNote = false;
      else acc += x.acc;
      if (x.consumo !== null && x.consumo !== undefined) {
        consumo = (consumo ?? 0) + x.consumo;
        unitaConsumo = x.unita || unitaConsumo;
      }
      tipo = x.tipo || tipo;
      riempi(perSecchiello, g, indiceDelGiorno(g), x.ms, x.o);
      if (perOra && !Array.isArray(x.o)) oreMancanti = true;
    }
    if (!giorniConDati) continue;
    misurate.push({
      nome: pulito(gen.nome),
      entity,
      ms,
      accensioni: accNote ? acc : null,
      perSecchiello,
      stima: false,
      daStatistiche,
      tipo,
      consumo: consumo === null ? null : centesimi(consumo),
      unitaConsumo,
      oreMancanti,
    });
  }
  if (misurate.length)
    giorniSenzaCaldaia = giorni.filter(
      (g) => g.record && !misurate.some((m) => g.record.generatori?.[m.entity]),
    ).length;

  const stimaSecchielli = secchielli.map(() => 0);
  let stimaMs = 0;
  let stimaAcc = 0;
  let stimaAccNote = true;
  let stimaNota = false;
  for (const g of giorni) {
    const x = g.record?.stima;
    if (!x) continue;
    stimaNota = true;
    stimaMs += (x.ms || 0) * MINUTO;
    if (x.acc === null || x.acc === undefined) stimaAccNote = false;
    else stimaAcc += x.acc;
    riempi(stimaSecchielli, g, indiceDelGiorno(g), x.ms, x.o);
  }
  /* Nessun giorno che sappia le ore dell'impianto: «non so», non zero. */
  const stima = {
    nome: "",
    entity: "",
    ms: stimaNota ? stimaMs : null,
    accensioni: stimaNota && stimaAccNote ? stimaAcc : null,
    perSecchiello: stimaSecchielli,
    stima: true,
  };
  const generatoriDelReport = misurate.length ? misurate : [stima];
  const perSecchiello = secchielli.map((_, i) =>
    generatoriDelReport.reduce((somma, g) => somma + g.perSecchiello[i], 0),
  );
  /* Quali colonne del grafico si sanno: zero misurato e «non so» si
   * disegnano diversi. Un giorno si sa se una caldaia l'ha detto o, senza
   * caldaie, se c'e' la stima; nel giorno ora per ora serve anche l'ora. */
  const giornoNoto = (g) =>
    misurate.length
      ? misurate.some((m) => g.record?.generatori?.[m.entity])
      : Boolean(g.record?.stima);
  const oreNote = (g) =>
    misurate.length
      ? misurate.some((m) => Array.isArray(g.record?.generatori?.[m.entity]?.o))
      : Array.isArray(g.record?.stima?.o);
  const noti = secchielli.map(() => false);
  for (const g of giorni) {
    if (!giornoNoto(g)) continue;
    if (perOra) {
      if (oreNote(g)) noti.fill(true);
    } else {
      const i = indiceDelGiorno(g);
      if (i >= 0 && i < noti.length) noti[i] = true;
    }
  }
  const mediaSemplice = (valori) => {
    const buoni = valori.filter((v) => v !== null && v !== undefined);
    return buoni.length ? buoni.reduce((s, v) => s + v, 0) / buoni.length : null;
  };
  const conDati = visibili.filter((s) => s.presente);
  const richieste = visibili.filter((s) => s.msRichiesta !== null);
  const accensioniNote = generatoriDelReport.every((g) => g.accensioni !== null);
  const consumi = misurate.filter((g) => g.consumo !== null);
  const kwhStanze = visibili.filter((s) => s.kwh !== null);
  return {
    impianto,
    periodo,
    stanze: visibili,
    nascoste,
    generatori: generatoriDelReport,
    stima: !misurate.length,
    secchielli: secchielli.map((s, i) => ({ ...s, ms: perSecchiello[i], noto: noti[i] })),
    totali: {
      msGeneratore: generatoriDelReport.some((g) => g.ms !== null)
        ? generatoriDelReport.reduce((s, g) => s + (g.ms || 0), 0)
        : null,
      accensioni: accensioniNote ? generatoriDelReport.reduce((s, g) => s + g.accensioni, 0) : null,
      msRichiesta: richieste.length ? richieste.reduce((s, x) => s + x.msRichiesta, 0) : null,
      ambiente: mediaSemplice(conDati.map((s) => s.ambiente)),
      ambienteComfort: mediaSemplice(conDati.map((s) => s.ambienteComfort)),
      obiettivoComfort: mediaSemplice(conDati.map((s) => s.obiettivoComfort)),
      valvola: mediaSemplice(conDati.map((s) => s.valvola)),
      consumo:
        consumi.length && consumi.every((g) => g.unitaConsumo === consumi[0].unitaConsumo)
          ? {
              valore: centesimi(consumi.reduce((s, g) => s + g.consumo, 0)),
              unita: consumi[0].unitaConsumo,
            }
          : null,
      kwhStanze: kwhStanze.length ? centesimi(kwhStanze.reduce((s, x) => s + x.kwh, 0)) : null,
    },
    fonti,
    giorniSenzaCaldaia,
    stimato:
      visibili.some((s) => s.giorniStatistiche > 0) || misurate.some((g) => g.daStatistiche > 0),
    oreMancanti:
      perOra && (visibili.some((s) => s.oreMancanti) || misurate.some((g) => g.oreMancanti)),
    vuoto: !giorni.some((g) => g.record),
  };
}
