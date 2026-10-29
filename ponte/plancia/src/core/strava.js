/* Strava (#344): le attivita' e le statistiche di chi corre, pedala, nuota.
 *
 * «Un widget con relativa pagina dedicata con grafici e storico per Strava.»
 * Home Assistant Strava non lo ha di serie: c'e' l'integrazione «Strava Home
 * Assistant» di HACS (`ha_strava`). Le sue entita' si riconoscono da sole,
 * senza che nessuno le scelga:
 *
 * - l'ultima attivita' di ogni sport e le piu' recenti: un sensore il cui
 *   stato e' il titolo, con `activity_url` (strava.com/activities/…) e
 *   `sport_type`; accanto, un sensore per ogni misura — `<lui>_distance`,
 *   `<lui>_moving_time`… — con lo stesso `activity_id`;
 * - le statistiche: «Weekly Run Distance», «Ytd Ride Count», «All Swim
 *   Moving Time»… (settimana, ultime 4 settimane, anno, sempre; corsa, bici,
 *   nuoto; distanza, quante, tempo, dislivello).
 *
 * Qui solo la lettura: da `states` alla forma che la pagina e la tessera
 * disegnano. Niente rete.
 */

const clean = (v) => String(v ?? "").trim();
const numero = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Gli sport delle statistiche, e i periodi, nell'ordine in cui si leggono. */
export const SPORT_STRAVA = Object.freeze(["run", "ride", "swim"]);
export const PERIODI_STRAVA = Object.freeze(["weekly", "recent", "ytd", "all"]);
const MISURE_STATISTICHE = Object.freeze({
  distance: "distanza",
  count: "quante",
  "moving time": "tempo",
  "elevation gain": "dislivello",
});

const URL_ATTIVITA = /^https:\/\/www\.strava\.com\/activities\/\d{1,20}$/;
const STATISTICA =
  /\b(weekly|recent|ytd|all) (run|ride|swim) (distance|count|moving time|elevation gain)$/i;

/* Le misure di un'attivita': il pezzo dell'id dopo quello del sensore
 * principale, e il nome con cui la pagina le legge. */
const MISURE_ATTIVITA = Object.freeze({
  distance: "distanza",
  moving_time: "tempo",
  elapsed_time: "durata",
  elevation_gain: "dislivello",
  calories: "calorie",
  kcal: "calorie",
  pace: "passo",
  speed: "velocita",
  average_heartrate: "battito",
  max_heartrate: "battitoMax",
  average_cadence: "cadenza",
  power: "potenza",
  achievements: "trofei",
  trophies: "trofei",
  pr_count: "record",
  kudos: "kudos",
  date: "data",
});

/** Lo sport delle statistiche di un `sport_type` di Strava, o "". */
export function famigliaDelloSport(tipo) {
  const t = clean(tipo).toLowerCase();
  if (/swim/.test(t)) return "swim";
  if (/ride|bike|cycl|velomobile|handcycle/.test(t)) return "ride";
  if (/run|walk|hike/.test(t)) return "run";
  return "";
}

/** Un'entita' di Strava? Lo dicono i suoi attributi. */
export function eDiStrava(stato) {
  const a = stato?.attributes || {};
  return (
    URL_ATTIVITA.test(clean(a.activity_url)) ||
    Boolean(a.activity_id) ||
    STATISTICA.test(clean(a.friendly_name))
  );
}

/* La misura di un sensore: dalla coda del suo id (`sensor.run_moving_time`),
 * o del suo nome se l'id e' stato cambiato (« Moving Time»). La coda piu'
 * lunga vince: `max_heartrate` non e' `heartrate`. */
const CODE_MISURE = Object.keys(MISURE_ATTIVITA).sort((a, b) => b.length - a.length);
function chiaveDellaMisura(entity, nome) {
  const id = clean(entity).toLowerCase();
  const daNome = clean(nome)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  const coda = CODE_MISURE.find(
    (c) => id.endsWith(`_${c}`) || daNome.endsWith(`_${c}`) || daNome === c,
  );
  return coda ? MISURE_ATTIVITA[coda] : "";
}

/* Le misure di un'attivita': i sensori che portano lo stesso `activity_id`
 * senza essere quello principale (che ha l'indirizzo). La stessa misura
 * arriva due volte — dall'ultima del suo sport e dalle recenti — ed e' la
 * stessa: basta la prima. */
function leMisure(activityId, states) {
  const misure = {};
  for (const [id, stato] of Object.entries(states || {})) {
    const a = stato?.attributes || {};
    if (clean(a.activity_id) !== activityId || a.activity_url) continue;
    const chiave = chiaveDellaMisura(id, a.friendly_name);
    if (!chiave || misure[chiave]) continue;
    const s = clean(stato?.state);
    if (!s || s === "unknown" || s === "unavailable") continue;
    misure[chiave] =
      chiave === "data"
        ? s
        : {
            valore: numero(s),
            unita: clean(a.unit_of_measurement),
            testo: clean(a.formatted_time || a.formatted_pace),
          };
  }
  return misure;
}

/**
 * Le attivita': l'ultima di ogni sport e le piu' recenti, una volta sola,
 * dalla piu' nuova. `[{id, entity, titolo, tipo, famiglia, url, luogo,
 * data, misure}]`.
 */
export function attivitaDiStrava(states = {}) {
  const viste = new Map();
  for (const [entity, stato] of Object.entries(states || {})) {
    const a = stato?.attributes || {};
    const url = clean(a.activity_url);
    if (!URL_ATTIVITA.test(url)) continue;
    const id = clean(a.activity_id) || url.split("/").pop();
    const titolo = clean(stato?.state);
    if (!titolo || titolo === "unavailable" || titolo === "unknown") continue;
    const misure = leMisure(id, states);
    const gia = viste.get(id);
    /* La stessa attivita' arriva due volte — come ultima del suo sport e fra
     * le recenti: si tiene quella con piu' misure. */
    if (gia && Object.keys(gia.misure).length >= Object.keys(misure).length) continue;
    viste.set(id, {
      id,
      entity,
      titolo,
      tipo: clean(a.sport_type),
      famiglia: famigliaDelloSport(a.sport_type),
      url,
      luogo: clean(a.location),
      data: typeof misure.data === "string" ? misure.data : "",
      misure,
    });
  }
  return [...viste.values()].sort((x, y) => (Date.parse(y.data) || 0) - (Date.parse(x.data) || 0));
}

/**
 * Le statistiche: `{run: {weekly: {distanza, quante, tempo, dislivello}, …},
 * …}`, ognuna `{valore, unita, entity}`; e `lunghe`: il giro in bici piu'
 * lungo e la salita piu' alta, se ci sono.
 */
export function statisticheDiStrava(states = {}) {
  const fuori = {};
  const lunghe = {};
  for (const [entity, stato] of Object.entries(states || {})) {
    const a = stato?.attributes || {};
    const nome = clean(a.friendly_name);
    const valore = numero(stato?.state);
    if (valore === null) continue;
    const m = STATISTICA.exec(nome);
    if (m) {
      const [, periodo, sport, misura] = m.map((x) => clean(x).toLowerCase());
      ((fuori[sport] ||= {})[periodo] ||= {})[MISURE_STATISTICHE[misura]] = {
        valore,
        unita: clean(a.unit_of_measurement),
        entity,
      };
      continue;
    }
    /* «Biggest Ride Distance» e «Biggest Climb Elevation Gain». */
    if (/(biggest|longest) ride distance$/i.test(nome))
      lunghe.giro = { valore, unita: clean(a.unit_of_measurement), entity };
    else if (/biggest (ride )?climb elevation gain$/i.test(nome))
      lunghe.salita = { valore, unita: clean(a.unit_of_measurement), entity };
  }
  return { sport: fuori, lunghe };
}

/** Lo sport principale: quello con piu' attivita' quest'anno, poi la corsa. */
export function sportPrincipale(statistiche) {
  const conta = (s) =>
    statistiche?.sport?.[s]?.ytd?.quante?.valore ??
    statistiche?.sport?.[s]?.all?.quante?.valore ??
    0;
  const presenti = SPORT_STRAVA.filter((s) => statistiche?.sport?.[s]);
  if (!presenti.length) return "";
  return presenti.reduce((meglio, s) => (conta(s) > conta(meglio) ? s : meglio), presenti[0]);
}

/** Tutto Strava in una volta, o `null` se in casa Strava non c'e'. */
export function vistaDiStrava(states = {}) {
  const attivita = attivitaDiStrava(states);
  const statistiche = statisticheDiStrava(states);
  if (!attivita.length && !Object.keys(statistiche.sport).length) return null;
  return {
    attivita,
    statistiche,
    principale: sportPrincipale(statistiche) || attivita[0]?.famiglia || "run",
  };
}

/** «1 h 05», «42 min», «35 s» da secondi. */
export function durataStrava(secondi) {
  const s = numero(secondi);
  if (s === null || s < 0) return "";
  const ore = Math.floor(s / 3600);
  const minuti = Math.floor((s % 3600) / 60);
  if (ore) return `${ore} h ${String(minuti).padStart(2, "0")}`;
  if (minuti) return `${minuti} min`;
  return `${Math.round(s)} s`;
}

/**
 * Le settimane dalle statistiche a lungo termine del totale «di sempre»:
 * quanto e' cresciuto in ogni settimana e' quanto si e' fatto. Torna
 * `[{inizio, valore}]` dalla piu' vecchia; una settimana senza dati vale 0.
 */
export function settimaneDalleStatistiche(righe = []) {
  const ordinate = (Array.isArray(righe) ? righe : [])
    .map((r) => ({
      inizio:
        typeof r?.start === "number"
          ? r.start < 1e12
            ? r.start * 1000
            : r.start
          : Date.parse(r?.start),
      cambio: numero(r?.change),
      stato: numero(r?.state ?? r?.max),
    }))
    .filter((r) => Number.isFinite(r.inizio))
    .sort((a, b) => a.inizio - b.inizio);
  let prima = null;
  return ordinate.map((r) => {
    let valore = r.cambio;
    if (valore === null && r.stato !== null) valore = prima === null ? 0 : r.stato - prima;
    if (r.stato !== null) prima = r.stato;
    return { inizio: r.inizio, valore: Math.max(0, valore ?? 0) };
  });
}
