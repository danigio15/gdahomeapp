/* La Salute (#227): il corpo di chi abita la casa, e Strava (#344).
 *
 * «Una sezione salute che importa i dati da una app della persona: peso,
 * passi, frequenza cardiaca, pressione, sonno.» In Home Assistant questi dati
 * arrivano gia' da soli, da chi li misura:
 *
 * - l'app Home Assistant sul telefono Android, da Health Connect: «Steps»,
 *   «Heart rate», «Resting heart rate», «Weight», «Blood pressure systolic»,
 *   «Sleep duration», «Oxygen saturation»…;
 * - l'app sull'iPhone, dal contapassi: «Steps»;
 * - Withings (bilancia, misuratore di pressione, tappetino del sonno): «Weight»,
 *   «Fat ratio», «Heart pulse», «Systolic blood pressure», «Total sleep time»…;
 * - Garmin Connect e Fitbit (HACS): «Total steps», «Resting heart rate»,
 *   «Sleep duration»…
 *
 * Le misure si riconoscono dal nome e dall'unita' — «bpm», «mmHg», «kg» —
 * senza che nessuno le scelga; chi vuole un sensore diverso, o nessuno, lo
 * dice nella scheda Salute del Config (`cd_salute`). Le misure si raccolgono
 * per persona: «Pixel 8 Steps» e «Pixel 8 Heart rate» sono dello stesso
 * telefono, «Mario Weight» e' della bilancia di Mario.
 *
 * I sensori di Strava (`core/strava.js`) non sono il corpo: il battito di
 * una corsa e' della corsa. Restano fuori, e Strava ha la sua linguetta.
 *
 * Qui solo la lettura: da `states` alla forma che la pagina disegna.
 */
import { eDiStrava } from "./strava.js";

export const CHIAVE_SALUTE = "cd_salute";
export const OBIETTIVO_PASSI = 10_000;

const clean = (v) => String(v ?? "").trim();
const numero = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* Le misure, nell'ordine in cui la pagina le mostra. Il battito a riposo
 * viene prima del battito: le sue parole contengono anche quelle dell'altro,
 * e chi arriva prima si prende il sensore. */
const MISURE = Object.freeze([
  {
    chiave: "passi",
    parole: /\b(steps?|passi|step count)\b/,
    unita: /^(steps?|passi|)$/,
    escludi: /goal|obiettiv|cadence|cadenza|floors|piani|length|lunghezza/,
  },
  {
    chiave: "battitoRiposo",
    parole: /resting heart|heart rate resting|resting hr|a riposo|riposo/,
    unita: /^bpm$/,
  },
  {
    chiave: "battito",
    parole: /heart ?rate|heart pulse|battito|\bpulse\b|frequenza cardiaca|\bhr\b/,
    unita: /^bpm$/,
    escludi: /\bmax|\bmin|average|\bavg|media|resting|riposo|variab|hrv/,
  },
  {
    chiave: "peso",
    parole: /\b(weight|peso|body mass)\b/,
    unita: /^(kg|lb|lbs|st)$/,
    escludi:
      /goal|obiettiv|bone|ossa|muscle|muscol|water|acqua|lean|magra|fat|grass|target|pellet|hive|arnia|tank|serbatoio|cisterna|bin|bidone|silo|scale load|carico|gas|bombola/,
  },
  {
    chiave: "grasso",
    parole: /fat ratio|body fat|fat percentage|massa grassa|grasso/,
    unita: /^%$/,
  },
  { chiave: "sistolica", parole: /systolic|sistolica|massima/, unita: /^mmhg$/ },
  { chiave: "diastolica", parole: /diastolic|diastolica|minima/, unita: /^mmhg$/ },
  {
    chiave: "ossigeno",
    parole: /spo2|oxygen saturation|blood oxygen|ossigeno|saturazione/,
    unita: /^%$/,
  },
  {
    chiave: "sonno",
    parole: /sleep|sonno|dormito/,
    unita: /^(h|hr|hrs|hours?|ore|min|mins|minutes?|minuti|s|sec|seconds?)$/,
    escludi: /deep|profondo|light|leggero|\brem\b|awake|sveglio|score|punteggio|goal|obiettiv|latency|wake|start|end|inizio|fine/,
  },
  {
    chiave: "calorie",
    parole: /calorie|calories|kcal|energy burned|energia bruciata/,
    unita: /^(kcal|cal)$/,
    escludi: /goal|obiettiv|bmr|basal|basale|intake/,
  },
]);

/** Le chiavi delle misure, nell'ordine della pagina. */
export const MISURE_SALUTE = Object.freeze(MISURE.map((m) => m.chiave));

/* Le parole che dicono la misura, o da dove viene: tolte dal nome, resta chi.
 * «Pixel 8 Resting heart rate» → «Pixel 8»; «Withings Mario Weight» → «Mario». */
const PAROLE_DELLE_MISURE =
  /\b(health connect|withings|garmin connect|garmin|fitbit|resting heart rate|heart rate|heart pulse|resting|blood pressure|systolic|diastolic|blood oxygen|oxygen saturation|spo2|body fat|fat ratio|fat percentage|total sleep time|sleep duration|sleep time|sleep|total steps|daily steps|steps today|steps|step count|weight|body mass|calories burned|active calories|total calories|calories|energy burned|today|daily|oggi|giornalieri|passi|peso|battito cardiaco|battito|frequenza cardiaca|pressione|sistolica|diastolica|sonno|ossigeno|saturazione|calorie|massa grassa|grasso|burned|bruciate|active|attive|sensor)\b/gi;

function chiDalNome(nome) {
  return clean(String(nome).replace(PAROLE_DELLE_MISURE, " ").replace(/[_·:()-]+/g, " ").replace(/\s+/g, " "));
}

function testo(entity, nome) {
  return `${clean(entity).replace(/^sensor\./, "").replace(/_/g, " ")} ${clean(nome)}`.toLowerCase();
}

/** La misura di un sensore, o "" se non e' del corpo. */
export function misuraDelSensore(entity, stato) {
  if (!/^sensor\./.test(clean(entity))) return "";
  if (eDiStrava(stato)) return "";
  const a = stato?.attributes || {};
  const nome = clean(a.friendly_name) || clean(entity);
  if (/strava/i.test(nome)) return "";
  const parole = testo(entity, nome);
  const unita = clean(a.unit_of_measurement).toLowerCase();
  for (const m of MISURE) {
    if (!m.parole.test(parole)) continue;
    if (m.escludi?.test(parole)) continue;
    if (!m.unita.test(unita)) continue;
    return m.chiave;
  }
  return "";
}

/** La configurazione della Salute, sempre intera. */
export function configurazioneSalute(grezza) {
  const c = grezza && typeof grezza === "object" ? grezza : {};
  const obiettivo = Math.round(numero(c.obiettivoPassi) ?? OBIETTIVO_PASSI);
  const scelte = {};
  for (const chiave of MISURE_SALUTE) {
    const v = clean(c.scelte?.[chiave]);
    if (v === "-" || /^sensor\.[a-z0-9_]+$/.test(v)) scelte[chiave] = v;
  }
  /* I nomi delle persone: «Pixel 8» e' il telefono, la persona e' Marco. */
  const nomi = {};
  for (const [chi, nome] of Object.entries(c.nomi && typeof c.nomi === "object" ? c.nomi : {})) {
    const n = clean(nome).slice(0, 40);
    if (clean(chi) && n) nomi[clean(chi)] = n;
  }
  return {
    obiettivoPassi: obiettivo >= 1000 && obiettivo <= 100_000 ? obiettivo : OBIETTIVO_PASSI,
    scelte,
    nomi,
  };
}

/** I sensori che potrebbero essere ogni misura: per le scelte del Config. */
export function candidatiSalute(states = {}) {
  const fuori = Object.fromEntries(MISURE_SALUTE.map((k) => [k, []]));
  for (const [entity, stato] of Object.entries(states || {})) {
    const chiave = misuraDelSensore(entity, stato);
    if (!chiave) continue;
    fuori[chiave].push({
      entity,
      nome: clean(stato?.attributes?.friendly_name) || entity,
    });
  }
  for (const k of MISURE_SALUTE) fuori[k].sort((a, b) => a.nome.localeCompare(b.nome));
  return fuori;
}

function letturaDi(entity, stato, chiave) {
  const a = stato?.attributes || {};
  const s = clean(stato?.state);
  const valore = numero(s);
  if (valore === null) return null;
  let unita = clean(a.unit_of_measurement);
  let v = valore;
  /* Il sonno si legge in minuti, da qualunque unita' arrivi. */
  if (chiave === "sonno") {
    const u = unita.toLowerCase();
    if (/^(h|hr|hrs|hours?|ore)$/.test(u)) v = valore * 60;
    else if (/^(s|sec|seconds?)$/.test(u)) v = valore / 60;
    unita = "min";
  }
  return {
    entity,
    nome: clean(a.friendly_name) || entity,
    valore: v,
    unita,
    /* I sensori che scrive il ponte dal telefono (`il-corpo-dal-telefono.js`)
     * dicono quando la misura e' stata presa: vale piu' di quando e' arrivata. */
    quando: clean(a.misurato_il || stato?.last_updated || stato?.last_changed),
    statistiche: Boolean(a.state_class),
    classe: clean(a.state_class),
  };
}

/**
 * Le persone e le loro misure: `[{chi, nome, misure: {passi, battito, …}}]` —
 * `chi` e' come lo dicono i sensori, `nome` come lo chiama la casa —, ogni
 * misura `{entity, nome, valore, unita, quando, statistiche, classe}`. Chi ha
 * piu' misure viene prima. Le scelte del Config vincono sul riconoscimento:
 * un sensore scelto entra anche se il nome non lo direbbe, «-» toglie la
 * misura a tutti.
 */
export function personeDellaSalute(states = {}, config = {}) {
  const { scelte, nomi } = configurazioneSalute(config);
  const persone = new Map();
  const metti = (entity, stato, chiave) => {
    const lettura = letturaDi(entity, stato, chiave);
    if (!lettura) return;
    /* Dal telefono, con GdAHome: la persona la dice il sensore. */
    const chi = clean(stato?.attributes?.gdahome_persona) || chiDalNome(lettura.nome);
    const persona = persone.get(chi) || { chi, misure: {} };
    /* Due sensori della stessa misura per la stessa persona: vince quello
     * scritto piu' di recente. */
    const gia = persona.misure[chiave];
    if (!gia || (Date.parse(lettura.quando) || 0) > (Date.parse(gia.quando) || 0)) persona.misure[chiave] = lettura;
    persone.set(chi, persona);
  };
  for (const [entity, stato] of Object.entries(states || {})) {
    const chiave = misuraDelSensore(entity, stato);
    if (!chiave || scelte[chiave]) continue;
    metti(entity, stato, chiave);
  }
  for (const [chiave, entity] of Object.entries(scelte)) {
    if (entity === "-" || !states?.[entity]) continue;
    metti(entity, states[entity], chiave);
  }
  return [...persone.values()]
    .map((p) => ({ ...p, nome: nomi[p.chi] || p.chi }))
    .filter((p) => Object.keys(p.misure).length)
    .sort((a, b) => Object.keys(b.misure).length - Object.keys(a.misure).length || a.chi.localeCompare(b.chi));
}

/** «7 h 32» da minuti. */
export function durataSonno(minuti) {
  const m = numero(minuti);
  if (m === null || m < 0) return "";
  const ore = Math.floor(m / 60);
  const resto = Math.round(m % 60);
  return ore ? `${ore} h ${String(resto).padStart(2, "0")}` : `${resto} min`;
}

/** Come sta la pressione, dalle linee guida europee (ESC/ESH 2018). */
export function fasciaPressione(sistolica, diastolica) {
  const s = numero(sistolica);
  const d = numero(diastolica);
  if (s === null || d === null) return "";
  if (s >= 140 || d >= 90) return "alta";
  if (s >= 130 || d >= 85) return "normale-alta";
  if (s < 90 || d < 60) return "bassa";
  return "ottimale";
}

/* Un istante delle statistiche: millisecondi, secondi o una data ISO. */
function istante(v) {
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
  const t = Date.parse(String(v ?? ""));
  return Number.isFinite(t) ? t : null;
}

/**
 * I giorni dalle statistiche a lungo termine: `[{inizio, valore}]` dal piu'
 * vecchio. Un contatore che cresce sempre (`total_increasing`) vale quanto e'
 * cresciuto quel giorno; uno che riparte da zero ogni mattina vale il suo
 * massimo; una misura (il peso) vale la sua media.
 */
export function giorniDalleStatistiche(righe = [], classe = "") {
  const somma = /^total/.test(clean(classe));
  return (Array.isArray(righe) ? righe : [])
    .map((r) => {
      const inizio = istante(r?.start);
      if (inizio === null) return null;
      const cambio = numero(r?.change);
      const massimo = numero(r?.max) ?? numero(r?.state);
      const media = numero(r?.mean);
      let valore;
      if (somma) valore = cambio !== null && cambio >= 0 && cambio <= (massimo ?? Infinity) ? cambio : massimo;
      else valore = media ?? massimo;
      return valore === null ? null : { inizio, valore };
    })
    .filter(Boolean)
    .sort((a, b) => a.inizio - b.inizio);
}
