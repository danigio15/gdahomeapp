/* La pagina Meteo, la parte che si prova a tavolino (#206).
 *
 * «Una pagina tutta per il meteo: com'è adesso, cosa misura la mia stazione,
 * e cosa arriva.» La pagina mette insieme tre cose che in plancia c'erano già
 * sparse — l'entità weather della testata, i sensori della stazione che la
 * testata e l'irrigazione leggono già, il radar della finestra delle
 * previsioni — e ci aggiunge quello che una striscia non poteva dire: le
 * ultime ventiquattro ore di ogni misura, e le prossime ventiquattro.
 *
 * Qui stanno le decisioni che non hanno bisogno di un documento né di una
 * presa con Home Assistant:
 *
 *  - quali sensori sono di una stazione meteo, riconosciuti dal `device_class`
 *    e dall'unità che dichiarano, e non dal nome soltanto;
 *  - la tendenza della pressione nelle ultime tre ore, che è la previsione
 *    più vecchia che ci sia e funziona ancora;
 *  - il punto di rugiada, dalla temperatura e dall'umidità;
 *  - la frase sulle prossime ore: quando arriva la pioggia, o quando smette;
 *  - i blocchi che si vedono, nell'ordine scelto;
 *  - le letture con la loro unità, convertita dove serve a giudicare.
 *
 * È puro: entrano stati, serie e previsioni, escono numeri e chiavi. Le parole
 * le mette la sezione, nella lingua di chi guarda; l'adesso lo passa chi
 * chiama.
 */
import { inMillimetri } from "./pioggia-caduta.js";

const pulito = (valore) => String(valore ?? "").trim();

const numero = (valore) => {
  if (valore === "" || valore == null) return null;
  const n = Number(String(valore).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const H = 3600000;

/* ── la configurazione ───────────────────────────────────────────────────── */

/** Dove si scrive quello che della pagina è solo suo. */
export const CHIAVE_METEO = "cd_meteo";

/* I blocchi della pagina, nell'ordine di serie: prima com'è adesso, poi cosa
 * misura casa, poi cosa arriva — prima le ore, poi i giorni — e il radar, che
 * dice dove piove. */
export const BLOCCHI = Object.freeze(["adesso", "stazione", "ore", "giorni", "radar"]);

/* Le misure della stazione, e dove ognuna è già scritta.
 *
 * Cinque sono le caselle della testata («Usa entità proprie»), due sono quelle
 * della pioggia che legge l'irrigazione e la riga «Come sta la casa»: si
 * scelgono una volta sola e valgono ovunque. Le cinque nuove — pressione,
 * raffica, indice UV, radiazione e luminosità — non le leggeva nessuno, e
 * stanno nella chiave della pagina. */
export const MISURE_DELLA_STAZIONE = Object.freeze([
  Object.freeze({ chiave: "temperatura", casella: "dm.home_meteo_temperatura" }),
  Object.freeze({ chiave: "umidita", casella: "dm.home_meteo_umidita" }),
  Object.freeze({ chiave: "percepita", casella: "dm.home_meteo_percepita" }),
  Object.freeze({ chiave: "pressione", pagina: "pressione" }),
  Object.freeze({ chiave: "vento", casella: "dm.home_meteo_vento" }),
  Object.freeze({ chiave: "raffica", pagina: "raffica" }),
  Object.freeze({ chiave: "direzione", casella: "dm.home_meteo_vento_direzione" }),
  Object.freeze({ chiave: "pioggiaOggi", barra: "pioggiaOggi" }),
  Object.freeze({ chiave: "intensita", barra: "pioggia" }),
  Object.freeze({ chiave: "uv", pagina: "uv" }),
  Object.freeze({ chiave: "radiazione", pagina: "radiazione" }),
  Object.freeze({ chiave: "luminosita", pagina: "luminosita" }),
]);

/* Le cinque che stanno nella chiave della pagina. */
const DELLA_PAGINA = MISURE_DELLA_STAZIONE.filter((misura) => misura.pagina).map(
  (misura) => misura.pagina,
);

const entitaScritta = (valore) => {
  const testo = pulito(valore);
  return testo.includes(".") ? testo : "";
};

/**
 * La configurazione della pagina, ripulita.
 *
 * L'ordine tiene tutti e cinque i blocchi una volta sola: uno che manca va in
 * fondo, uno che non si conosce se ne va. I blocchi spenti sono quelli scritti
 * spenti: di serie si vede tutto, e un blocco che non ha dati non compare
 * comunque.
 */
export function normalizzaMeteo(salvato) {
  const dato = salvato && typeof salvato === "object" && !Array.isArray(salvato) ? salvato : {};
  const fuori = {};
  for (const chiave of DELLA_PAGINA) fuori[chiave] = entitaScritta(dato[chiave]);
  const scritto = Array.isArray(dato.ordine) ? dato.ordine.map(pulito) : [];
  const ordine = [];
  for (const blocco of [...scritto, ...BLOCCHI])
    if (BLOCCHI.includes(blocco) && !ordine.includes(blocco)) ordine.push(blocco);
  fuori.ordine = ordine;
  fuori.spenti = (Array.isArray(dato.spenti) ? dato.spenti.map(pulito) : []).filter(
    (blocco, indice, tutti) => BLOCCHI.includes(blocco) && tutti.indexOf(blocco) === indice,
  );
  return fuori;
}

/** Un blocco spostato di un posto, su o giù. Ai bordi resta dov'è. */
export function spostaIlBlocco(ordine, blocco, verso) {
  const fila = [...ordine];
  const da = fila.indexOf(blocco);
  const a = da + (verso < 0 ? -1 : 1);
  if (da < 0 || a < 0 || a >= fila.length) return fila;
  [fila[da], fila[a]] = [fila[a], fila[da]];
  return fila;
}

/**
 * I blocchi che la pagina mostra adesso, nell'ordine scelto.
 *
 * `ci` dice quali hanno qualcosa da dire: un blocco senza dati non compare,
 * nemmeno vuoto. La stazione è l'eccezione: senza sensori, a chi può
 * configurare la plancia si mostra l'invito («Hai una stazione meteo?») al
 * suo posto; agli altri niente, perché un invito che non si può raccogliere è
 * solo una scritta in più.
 */
export function blocchiDellaPagina(config, ci = {}) {
  const scelta = normalizzaMeteo(config);
  const fuori = [];
  for (const blocco of scelta.ordine) {
    if (scelta.spenti.includes(blocco)) continue;
    if (blocco === "stazione") {
      if (ci.stazione) fuori.push("stazione");
      else if (ci.invito) fuori.push("invito");
      continue;
    }
    if (ci[blocco]) fuori.push(blocco);
  }
  return fuori;
}

/* ── i sensori della stazione, riconosciuti ──────────────────────────────── */

/* Le parole di chi una stazione meteo ce l'ha: il nome del posto, le marche
 * più diffuse, i nomi dei loro ricevitori. */
const DELLA_STAZIONE =
  /(stazion|station|meteo|weather|outdoor|outside|esterno|esterna|external|ecowitt|netatmo|davis|tempest|ambient|froggit|bresser|\bwh\d|\bgw\d|\bws\d|\bhp\d)/;

/* E quelle di un sensore che sta in casa: una temperatura del soggiorno non è
 * la temperatura esterna, anche se dichiara gli stessi gradi. */
const DI_CASA =
  /(indoor|inside|interno|interna|soggiorno|salotto|camera|cucina|bagno|studio|living|bedroom|kitchen|bath|office|cantina|garage)/;

const ventoUnita = /^(km\/h|m\/s|mph|kn|kt|knots|ft\/s|bft)$/i;
const pressioneUnita = /^(hpa|mbar|mb|kpa|pa|inhg|mmhg|psi)$/i;

/* Cosa NON è mai la misura di quel tipo, anche quando ne ha le carte. */
const NON_ARIA =
  /(soil|terra|suolo|water|acqua|pool|piscina|cpu|battery|batteria|inverter|boiler|frigo|fridge|freezer|probe|sonda|dew|rugiada|chill|heat_?index|indice)/;

function testo(entity, stato) {
  return `${entity} ${pulito(stato?.attributes?.friendly_name)}`.toLowerCase();
}

/* I riconoscitori: per ogni misura, quanto un sensore le somiglia. Zero vuol
 * dire «non è lei»; `debole` vuol dire che il tipo da solo non basta — una
 * temperatura qualsiasi non è quella esterna — e serve una parola della
 * stazione o la stessa famiglia degli altri sensori trovati. */
const RICONOSCITORI = Object.freeze({
  temperatura: {
    debole: true,
    punti: (classe, unita, nome) =>
      (classe === "temperature" || /^°[cf]$/i.test(unita)) &&
      !NON_ARIA.test(nome) &&
      !/(feel|percepit|apparent|wind)/.test(nome)
        ? 1
        : 0,
  },
  umidita: {
    debole: true,
    punti: (classe, unita, nome) =>
      (classe === "humidity" || (unita === "%" && /(humid|umid)/.test(nome))) &&
      !NON_ARIA.test(nome) &&
      !/moisture/.test(nome)
        ? 1
        : 0,
  },
  percepita: {
    debole: true,
    punti: (classe, unita, nome) =>
      (classe === "temperature" || /^°[cf]$/i.test(unita)) && /(feel|percepit|apparent)/.test(nome)
        ? 2
        : 0,
  },
  pressione: {
    punti: (classe, unita, nome) => {
      if (classe === "atmospheric_pressure") return /(abs|assolut)/.test(nome) ? 2 : 3;
      if ((classe === "pressure" || !classe) && pressioneUnita.test(unita) && !NON_ARIA.test(nome))
        return /(rel|sea|mare|baro|slp)/.test(nome) ? 2 : /(abs|assolut)/.test(nome) ? 1 : 1.5;
      return 0;
    },
  },
  vento: {
    punti: (classe, unita, nome) =>
      (classe === "wind_speed" || (ventoUnita.test(unita) && /(wind|vento)/.test(nome))) &&
      !/(gust|raffic|max)/.test(nome)
        ? 2
        : 0,
  },
  raffica: {
    punti: (classe, unita, nome) =>
      (classe === "wind_speed" || ventoUnita.test(unita)) && /(gust|raffic)/.test(nome) ? 2 : 0,
  },
  direzione: {
    punti: (classe, unita, nome) =>
      classe === "wind_direction" ||
      (/^(°|deg)$/i.test(unita) && /(direz|direction|bearing|dir\b|_dir)/.test(nome))
        ? 2
        : 0,
  },
  pioggiaOggi: {
    punti: (classe, unita, nome) => {
      const pioggia =
        classe === "precipitation" ||
        (/^(mm|in)$/i.test(unita) && /(rain|piogg|precip)/.test(nome));
      if (
        !pioggia ||
        /(rate|intens|event|hour|ora\b|week|settim|month|mese|year|anno|total|totale)/.test(nome)
      )
        return 0;
      return /(daily|day|oggi|today|giorn)/.test(nome) ? 3 : 0;
    },
  },
  intensita: {
    punti: (classe, unita, nome) =>
      classe === "precipitation_intensity" ||
      (/^(mm\/h|in\/h)$/i.test(unita) && /(rain|piogg|precip)/.test(nome))
        ? 2
        : 0,
  },
  uv: {
    punti: (classe, unita, nome) =>
      /(\buv\b|uv_|_uv|uvi\b|ultraviolet|ultraviolett)/.test(nome) &&
      !/(lamp|lampada|light)/.test(nome) &&
      (!unita || /index|indice|uv/i.test(unita))
        ? 2
        : 0,
  },
  radiazione: {
    punti: (classe, unita) => (classe === "irradiance" || /^w\/m(²|2)$/i.test(unita) ? 2 : 0),
  },
  luminosita: {
    debole: true,
    punti: (classe, unita, nome) =>
      (classe === "illuminance" || /^k?lx$/i.test(unita)) && !NON_ARIA.test(nome) ? 1 : 0,
  },
});

/* La famiglia di un sensore: la prima parola dopo il dominio. I sensori di
 * una stessa stazione si chiamano quasi sempre allo stesso modo —
 * `sensor.gw1100a_…`, `sensor.stazione_…` — ed è la cosa più sicura che si
 * sappia di loro. */
function famigliaDi(entity) {
  return pulito(entity).split(".")[1]?.split("_")[0] || "";
}

/**
 * I sensori di una stazione meteo, fra gli stati di Home Assistant.
 *
 * Torna `{ misura: entità }` solo per le misure ancora vuote in `scelte`: chi
 * ha già scelto un sensore lo tiene, e un'entità già scelta per una misura non
 * viene proposta per un'altra. Prima si trovano le misure che una stazione ha
 * per forza — vento, pioggia, radiazione, pressione atmosferica — e da quelle
 * si capisce come si chiama la stazione; poi le misure che hanno anche le
 * stanze di casa — temperatura, umidità, luminosità — si prendono solo se sono
 * della stessa famiglia o lo dicono nel nome. Una temperatura del soggiorno
 * proposta come esterna sarebbe peggio di nessuna proposta.
 */
export function trovaLaStazione(states, scelte = {}) {
  const sensori = Object.entries(states && typeof states === "object" ? states : {})
    .filter(([entity]) => entity.startsWith("sensor."))
    .map(([entity, stato]) => ({
      entity,
      classe: pulito(stato?.attributes?.device_class).toLowerCase(),
      unita: pulito(stato?.attributes?.unit_of_measurement),
      nome: testo(entity, stato),
    }));
  const prese = new Set(
    Object.values(scelte || {})
      .map(pulito)
      .filter(Boolean),
  );
  const trovate = {};
  const migliore = (chiave, ammessa) => {
    const regola = RICONOSCITORI[chiave];
    let vincente = null;
    let meglio = 0;
    for (const sensore of sensori) {
      if (prese.has(sensore.entity)) continue;
      let punti = regola.punti(sensore.classe, sensore.unita, sensore.nome);
      if (!punti) continue;
      if (DELLA_STAZIONE.test(sensore.nome)) punti += 2;
      if (DI_CASA.test(sensore.nome)) punti -= 3;
      if (ammessa && !ammessa(sensore)) continue;
      if (punti > meglio || (punti === meglio && vincente && sensore.entity < vincente.entity)) {
        meglio = punti;
        vincente = sensore;
      }
    }
    return meglio > 0 ? vincente : null;
  };
  const prendi = (chiave, ammessa) => {
    if (pulito(scelte?.[chiave])) return;
    const vincente = migliore(chiave, ammessa);
    if (!vincente) return;
    trovate[chiave] = vincente.entity;
    prese.add(vincente.entity);
  };
  for (const chiave of Object.keys(RICONOSCITORI))
    if (!RICONOSCITORI[chiave].debole) prendi(chiave);
  /* La famiglia che ricorre di più fra quelle trovate, o fra quelle già scelte. */
  const conto = new Map();
  for (const entity of [...Object.values(trovate), ...Object.values(scelte || {})]) {
    const famiglia = famigliaDi(entity);
    if (famiglia) conto.set(famiglia, (conto.get(famiglia) || 0) + 1);
  }
  const famiglia = [...conto].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const ammessa = (sensore) =>
    (famiglia && famigliaDi(sensore.entity) === famiglia) ||
    (DELLA_STAZIONE.test(sensore.nome) && !DI_CASA.test(sensore.nome));
  for (const chiave of Object.keys(RICONOSCITORI))
    if (RICONOSCITORI[chiave].debole) prendi(chiave, ammessa);
  return trovate;
}

/* ── le letture ──────────────────────────────────────────────────────────── */

/**
 * Uno stato come lettura: `{ valore, unita, quando }`, oppure `null`.
 *
 * Una misura che non si sa non è una misura a zero: `unavailable` torna
 * `null`, e la tessera non compare.
 */
export function letturaDi(stato) {
  const valore = numero(stato?.state);
  if (valore === null) return null;
  const quando = Date.parse(pulito(stato?.last_updated || stato?.last_changed));
  return {
    valore,
    unita: pulito(stato?.attributes?.unit_of_measurement),
    quando: Number.isFinite(quando) ? quando : null,
  };
}

/** Una pressione in ettopascal, qualunque unità dichiari. */
export function inEttopascal(valore, unita = "hPa") {
  const n = numero(valore);
  if (n === null) return null;
  const misura = pulito(unita).toLowerCase();
  if (misura === "kpa") return n * 10;
  if (misura === "pa") return n / 100;
  if (misura === "inhg") return n * 33.8639;
  if (misura === "mmhg") return n * 1.33322;
  if (misura === "psi") return n * 68.9476;
  return n;
}

/** Una temperatura in gradi Celsius. */
export function inCelsius(valore, unita = "°C") {
  const n = numero(valore);
  if (n === null) return null;
  return /f$/i.test(pulito(unita)) ? ((n - 32) * 5) / 9 : n;
}

/**
 * Il punto di rugiada, con la formula di Magnus: la temperatura a cui l'aria
 * di adesso comincerebbe a bagnare. Torna nell'unità della temperatura data.
 */
export function puntoDiRugiada(temperatura, umidita, unita = "°C") {
  const gradi = inCelsius(temperatura, unita);
  const relativa = numero(umidita);
  if (gradi === null || relativa === null || relativa <= 0 || relativa > 100) return null;
  const a = 17.62;
  const b = 243.12;
  const gamma = Math.log(relativa / 100) + (a * gradi) / (b + gradi);
  const rugiada = (b * gamma) / (a - gamma);
  return /f$/i.test(pulito(unita)) ? (rugiada * 9) / 5 + 32 : rugiada;
}

/* La soglia sotto la quale tre ore di pressione si dicono «stabile»: un
 * ettopascal è il rumore di un barometro di casa. Tre sono il gradino che i
 * meteorologi chiamano un cambiamento vero. */
const PRESSIONE_STABILE = 1;
const PRESSIONE_FORTE = 3;

/**
 * Com'è andata la pressione nelle ultime tre ore.
 *
 * `{ differenza, differenzaHpa, verso, forte }`: `verso` è «calo», «aumento»
 * o «stabile», `forte` dice se il cambio è di quelli che portano tempo
 * diverso. `null` se la serie non arriva a tre ore fa: una tendenza su
 * mezz'ora sarebbe inventata.
 */
export function tendenzaDellaPressione(
  serie,
  { adesso = Date.now(), unita = "hPa", ore = 3 } = {},
) {
  const punti = ordinata(serie);
  if (punti.length < 2) return null;
  const inizio = adesso - ore * H;
  /* Il valore di tre ore fa è l'ultimo letto prima di allora; se la serie
   * comincia dopo, vale il primo, ma solo se è di poco dopo. */
  let prima = null;
  for (const punto of punti) {
    if (punto.quando <= inizio) prima = punto;
    else break;
  }
  if (!prima && punti[0].quando - inizio <= H / 2) prima = punti[0];
  if (!prima) return null;
  const ultimo = punti[punti.length - 1];
  const differenza = ultimo.valore - prima.valore;
  const differenzaHpa =
    (inEttopascal(ultimo.valore, unita) ?? 0) - (inEttopascal(prima.valore, unita) ?? 0);
  const verso =
    Math.abs(differenzaHpa) < PRESSIONE_STABILE
      ? "stabile"
      : differenzaHpa < 0
        ? "calo"
        : "aumento";
  return { differenza, differenzaHpa, verso, forte: Math.abs(differenzaHpa) >= PRESSIONE_FORTE };
}

/* ── le serie delle ultime ventiquattro ore ──────────────────────────────── */

function ordinata(serie) {
  return (Array.isArray(serie) ? serie : [])
    .map((punto) => ({ quando: Number(punto?.quando), valore: numero(punto?.valore) }))
    .filter((punto) => Number.isFinite(punto.quando) && punto.valore !== null)
    .sort((a, b) => a.quando - b.quando);
}

/* Un istante della storia di Home Assistant: in secondi nella risposta
 * corta (`lu`), in testo nella lunga. */
function istante(riga) {
  const grezzo = riga?.lu ?? riga?.lc ?? riga?.last_updated ?? riga?.last_changed;
  if (typeof grezzo === "number") return grezzo < 1e12 ? grezzo * 1000 : grezzo;
  const letto = Date.parse(pulito(grezzo));
  return Number.isFinite(letto) ? letto : NaN;
}

/** La domanda della storia di ventiquattro ore, per tutte le entità insieme. */
export function domandaDelleUltimeOre(entita, adesso, ore = 24) {
  return {
    type: "history/history_during_period",
    start_time: new Date(adesso - ore * H).toISOString(),
    end_time: new Date(adesso).toISOString(),
    entity_ids: [...new Set((Array.isArray(entita) ? entita : []).map(pulito).filter(Boolean))],
    include_start_time_state: true,
    significant_changes_only: false,
    minimal_response: true,
    no_attributes: true,
  };
}

/**
 * La serie di un'entità dalla risposta della storia: `[{ quando, valore }]`,
 * dalla più vecchia. Il primo punto, che Home Assistant data prima
 * dell'inizio chiesto, si porta all'inizio.
 */
export function serieDallaStoria(risposta, entity, { inizio = -Infinity } = {}) {
  const righe = Array.isArray(risposta?.[entity]) ? risposta[entity] : [];
  return ordinata(
    righe.map((riga) => ({
      quando: Math.max(istante(riga), inizio),
      valore: riga?.s ?? riga?.state,
    })),
  );
}

/**
 * La serie a passo fisso, per disegnarla: `punti` valori dall'inizio alla
 * fine, ognuno l'ultimo letto fino a quel momento. Una storia è fatta di cambi
 * e non di intervalli regolari: spalmati a distanza uguale, tre ore ferme e un
 * minuto di discesa diventerebbero una discesa lenta che non c'è mai stata.
 */
export function serieAPassoFisso(serie, { inizio, fine, punti = 97 } = {}) {
  const ordinati = ordinata(serie);
  if (!ordinati.length || !(fine > inizio) || punti < 2) return [];
  const fuori = [];
  let indice = 0;
  let ultimo = null;
  for (let passo = 0; passo < punti; passo += 1) {
    const quando = inizio + ((fine - inizio) * passo) / (punti - 1);
    while (indice < ordinati.length && ordinati[indice].quando <= quando) {
      ultimo = ordinati[indice].valore;
      indice += 1;
    }
    fuori.push(ultimo);
  }
  /* Prima del primo punto non si sa niente: si parte dal primo valore. */
  const primo = fuori.find((valore) => valore !== null);
  return primo === undefined ? [] : fuori.map((valore) => (valore === null ? primo : valore));
}

/** Il minimo e il massimo di una serie, ognuno col suo momento. */
export function minimoEMassimo(serie, { da = -Infinity } = {}) {
  const punti = ordinata(serie).filter((punto) => punto.quando >= da);
  if (!punti.length) return null;
  let minimo = punti[0];
  let massimo = punti[0];
  for (const punto of punti) {
    if (punto.valore < minimo.valore) minimo = punto;
    if (punto.valore > massimo.valore) massimo = punto;
  }
  return { minimo, massimo };
}

/**
 * La pioggia ora per ora, da un contatore che si azzera a mezzanotte.
 *
 * Ogni ora vale la somma di quello che il contatore è salito dentro di lei.
 * Quando scende — l'azzeramento — il nuovo valore è pioggia caduta dopo lo
 * zero. Torna `ore` caselle `{ quando, mm }`, l'ultima è l'ora di adesso.
 */
export function pioggiaOraPerOra(serie, { adesso = Date.now(), ore = 24, unita = "mm" } = {}) {
  const inizioOra = Math.floor(adesso / H) * H;
  const primaOra = inizioOra - (ore - 1) * H;
  const caselle = Array.from({ length: ore }, (_, indice) => ({
    quando: primaOra + indice * H,
    mm: 0,
  }));
  const punti = ordinata(serie);
  for (let indice = 1; indice < punti.length; indice += 1) {
    const prima = inMillimetri(punti[indice - 1].valore, unita) ?? 0;
    const adessoMm = inMillimetri(punti[indice].valore, unita) ?? 0;
    let salita = adessoMm - prima;
    if (salita < 0) salita = adessoMm;
    if (salita <= 0) continue;
    const posto = Math.floor((punti[indice].quando - primaOra) / H);
    if (posto >= 0 && posto < ore) caselle[posto].mm += salita;
  }
  return caselle;
}

/* ── le parole che la sezione traduce ────────────────────────────────────── */

/** La fascia dell'indice UV, come la scala dell'OMS. */
export function fasciaUV(indice) {
  const n = numero(indice);
  if (n === null) return "";
  if (n < 3) return "basso";
  if (n < 6) return "moderato";
  if (n < 8) return "alto";
  if (n < 11) return "molto-alto";
  return "estremo";
}

/**
 * Da dove soffia il vento, in otto spicchi: 0 è nord, 2 est, 4 sud, 6 ovest.
 * I gradi sono quelli della meteorologia — la direzione DA CUI arriva — e
 * possono arrivare come numero o come sigla («SW», «SO»).
 */
export function spicchioDelVento(direzione) {
  const n = numero(direzione);
  if (n !== null) return ((Math.round(n / 45) % 8) + 8) % 8;
  const sigla = pulito(direzione).toUpperCase();
  const sigle = [["N"], ["NE"], ["E"], ["SE"], ["S"], ["SW", "SO"], ["W", "O"], ["NW", "NO"]];
  const indice = sigle.findIndex((voci) => voci.includes(sigla));
  return indice < 0 ? null : indice;
}

/** I gradi di una direzione, anche quando arriva come sigla. */
export function gradiDelVento(direzione) {
  const n = numero(direzione);
  if (n !== null) return ((n % 360) + 360) % 360;
  const spicchio = spicchioDelVento(direzione);
  return spicchio === null ? null : spicchio * 45;
}

/* ── le previsioni ───────────────────────────────────────────────────────── */

/* Le condizioni che bagnano. La neve bagna anche lei, e la frase lo dice. */
const BAGNATE = new Set(["rainy", "pouring", "lightning-rainy", "snowy-rainy", "hail", "snowy"]);

/* Quanto deve essere probabile perché un'ora si dica di pioggia. Sotto la
 * metà è un forse, e «pioggia in arrivo» detto a un forse insegna a non
 * fidarsi della frase. */
const PROBABILE = 50;

/** Una voce delle previsioni, ripulita: i nomi di Home Assistant diventano i nostri. */
function voceDellePrevisioni(previsione, unita) {
  const quando = Date.parse(pulito(previsione?.datetime));
  if (!Number.isFinite(quando)) return null;
  return {
    quando,
    condizione: pulito(previsione?.condition),
    temperatura: numero(previsione?.temperature),
    bassa: numero(previsione?.templow),
    probabilita: numero(previsione?.precipitation_probability),
    mm: inMillimetri(previsione?.precipitation, unita),
  };
}

function previsioniOrdinate(previsioni, unita) {
  return (Array.isArray(previsioni) ? previsioni : [])
    .map((voce) => voceDellePrevisioni(voce, unita))
    .filter(Boolean)
    .sort((a, b) => a.quando - b.quando);
}

/** Le prossime ore, a partire da quella in corso. */
export function prossimeOre(previsioni, { adesso = Date.now(), ore = 24, unita = "mm" } = {}) {
  const inizio = Math.floor(adesso / H) * H;
  return previsioniOrdinate(previsioni, unita)
    .filter((voce) => voce.quando >= inizio)
    .slice(0, Math.max(0, ore));
}

const stessoGiorno = (uno, due) => {
  const a = new Date(uno);
  const b = new Date(due);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

/** I prossimi giorni, oggi compreso quando le previsioni lo portano. */
export function prossimiGiorni(previsioni, { adesso = Date.now(), giorni = 7, unita = "mm" } = {}) {
  const mezzanotte = new Date(adesso);
  mezzanotte.setHours(0, 0, 0, 0);
  return previsioniOrdinate(previsioni, unita)
    .filter((voce) => voce.quando >= mezzanotte.getTime() || stessoGiorno(voce.quando, adesso))
    .slice(0, Math.max(0, giorni))
    .map((voce) => ({ ...voce, oggi: stessoGiorno(voce.quando, adesso) }));
}

const bagnata = (voce) =>
  BAGNATE.has(voce.condizione) || (voce.probabilita ?? 0) >= PROBABILE || (voce.mm ?? 0) >= 0.5;

/**
 * Cosa dicono le prossime ore della pioggia, in una frase sola.
 *
 * `{ tipo, quando, probabilita, mm, neve }`:
 *  - «arriva»: adesso è asciutto, e alle `quando` comincia;
 *  - «smette»: adesso piove, e alle `quando` smette;
 *  - «continua»: piove adesso e per tutte le ore che si sanno;
 *  - «asciutto»: niente pioggia nelle prossime ore.
 * `mm` è quanta ne arriva in tutte le ore guardate. `null` senza previsioni.
 */
export function fraseDelleProssimeOre(
  previsioni,
  { adesso = Date.now(), ore = 24, unita = "mm" } = {},
) {
  const fila = prossimeOre(previsioni, { adesso, ore, unita });
  if (!fila.length) return null;
  const mm = fila.reduce((somma, voce) => somma + (voce.mm ?? 0), 0);
  const neve = (voce) => /^snowy$/.test(voce?.condizione || "");
  if (bagnata(fila[0])) {
    const asciutta = fila.find((voce) => !bagnata(voce));
    if (!asciutta)
      return {
        tipo: "continua",
        quando: null,
        probabilita: fila[0].probabilita,
        mm,
        neve: neve(fila[0]),
      };
    return {
      tipo: "smette",
      quando: asciutta.quando,
      probabilita: fila[0].probabilita,
      mm,
      neve: neve(fila[0]),
    };
  }
  const prima = fila.find(bagnata);
  if (prima)
    return {
      tipo: "arriva",
      quando: prima.quando,
      probabilita: prima.probabilita,
      mm,
      neve: neve(prima),
    };
  const massima = Math.max(0, ...fila.map((voce) => voce.probabilita ?? 0));
  return { tipo: "asciutto", quando: null, probabilita: massima || null, mm, neve: false };
}

/* ── le misure di adesso ─────────────────────────────────────────────────── */

/* Dove l'entità weather tiene ogni misura, e l'attributo della sua unità. */
const DAL_METEO = Object.freeze({
  temperatura: ["temperature", "temperature_unit", "°C"],
  percepita: ["apparent_temperature", "temperature_unit", "°C"],
  umidita: ["humidity", "", "%"],
  pressione: ["pressure", "pressure_unit", "hPa"],
  vento: ["wind_speed", "wind_speed_unit", "km/h"],
  raffica: ["wind_gust_speed", "wind_speed_unit", "km/h"],
  direzione: ["wind_bearing", "", "°"],
  uv: ["uv_index", "", ""],
});

/**
 * Le misure di adesso: dalla stazione quando c'è, dall'entità weather quando
 * no. Ognuna dice da dove arriva, perché la pagina scrive «Misure: la tua
 * stazione» solo se è vero.
 */
export function misureDiAdesso({ stazione = {}, meteo = null } = {}) {
  const attributi = meteo?.attributes || {};
  const fuori = {};
  for (const [chiave, [attributo, unitaDi, unitaDiSerie]] of Object.entries(DAL_METEO)) {
    const mia = stazione?.[chiave];
    if (mia && mia.valore !== null && mia.valore !== undefined) {
      fuori[chiave] = { valore: mia.valore, unita: mia.unita, fonte: "stazione" };
      continue;
    }
    const grezzo = attributi[attributo];
    const valore = chiave === "direzione" ? gradiDelVento(grezzo) : numero(grezzo);
    if (valore === null) continue;
    fuori[chiave] = {
      valore,
      unita: pulito(unitaDi ? attributi[unitaDi] : "") || unitaDiSerie,
      fonte: "meteo",
    };
  }
  return fuori;
}

/* ── la vista: quello che le due pagine Meteo disegnano ─────────────────── */

/**
 * Le letture della stazione adesso: `{ misura: { valore, unita, quando,
 * entity } }`, solo per i sensori scelti che hanno un numero. `sensori` e'
 * `{ misura: entità }`, come lo legge la sezione dalla configurazione.
 */
export function letturaDellaStazione(sensori = {}, states = {}) {
  const fuori = {};
  for (const [chiave, entity] of Object.entries(sensori || {})) {
    const lettura = letturaDi(states?.[entity]);
    if (lettura) fuori[chiave] = { ...lettura, entity };
  }
  return fuori;
}

/**
 * Le tessere di «La mia stazione», nell'ordine in cui si vedono: una per
 * misura che la stazione legge adesso, nessuna per quelle che mancano. La
 * pioggia si mostra col totale di oggi o con l'intensità, il sole con la
 * radiazione o con la luminosità; la raffica, la direzione e la percepita
 * non hanno una tessera loro (stanno dentro il vento e dentro «Adesso»).
 */
export const TESSERE_DELLA_STAZIONE = Object.freeze([
  "temperatura",
  "umidita",
  "pressione",
  "pioggia",
  "vento",
  "uv",
  "sole",
]);
const LETTURE_DELLA_TESSERA = Object.freeze({
  temperatura: ["temperatura"],
  umidita: ["umidita"],
  pressione: ["pressione"],
  pioggia: ["pioggiaOggi", "intensita"],
  vento: ["vento"],
  uv: ["uv"],
  sole: ["radiazione", "luminosita"],
});
export function tessereDellaStazione(stazione = {}) {
  return TESSERE_DELLA_STAZIONE.filter((tessera) =>
    LETTURE_DELLA_TESSERA[tessera].some((chiave) => stazione?.[chiave]),
  );
}

/**
 * Tutto quello che una pagina Meteo disegna, letto una volta: la pagina della
 * plancia e quella del muro partono da qui, perché due pagine meteo che
 * leggessero diverso direbbero due tempi (il muro diceva i 18° dell'entità
 * weather mentre la stazione misurava 19,6°).
 *
 * - `misure`: com'è adesso, dalla stazione quando c'è, dall'entità weather
 *   quando no (`misureDiAdesso`);
 * - `tessere`: le tessere di «La mia stazione», vuote senza stazione;
 * - `ore`, `giorni`, `oggi`, `frase`: dalle previsioni;
 * - `sole`: com'è arrivato (`{ alba, tramonto }` già scritti), o `null`.
 *
 * `null` senza entità weather.
 */
export function vistaDelMeteoDa({
  entita = "",
  meteo = null,
  stazione = {},
  orarie = [],
  giornaliere = [],
  sole = null,
  adesso = Date.now(),
  ore = 24,
  giorni = 7,
} = {}) {
  if (!pulito(entita) && !meteo) return null;
  const letture = stazione && typeof stazione === "object" ? stazione : {};
  const unita = pulito(meteo?.attributes?.precipitation_unit) || "mm";
  const misure = misureDiAdesso({ stazione: letture, meteo });
  const fila = prossimeOre(orarie, { adesso, ore, unita }).filter((voce) =>
    Number.isFinite(voce.temperatura),
  );
  const elencoDeiGiorni = prossimiGiorni(giornaliere, { adesso, giorni, unita });
  const oggi = elencoDeiGiorni.find((voce) => voce.oggi);
  return {
    adesso,
    entita: pulito(entita),
    meteo,
    stazione: letture,
    tessere: tessereDellaStazione(letture),
    misure,
    ore: fila,
    giorni: elencoDeiGiorni,
    oggi: oggi ? { alta: oggi.temperatura, bassa: oggi.bassa } : null,
    frase: fraseDelleProssimeOre(orarie, { adesso, ore: 24, unita }),
    sole: sole || null,
  };
}
