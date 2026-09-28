/* Le piante di casa: la terra, e quando innaffiare (#159).
 *
 * «Servirebbe a monitorare i sensori umidità e temperatura suolo (nel mio caso
 * Ecowitt WH51 e WH52, ma anche sensori Tuya). Impostando una soglia minima ti
 * avverte quando è ora di innaffiare, oppure anche se è ora di innaffiare ma è
 * prevista pioggia a breve eviti di farlo. Tutto questo ovviamente per chi non
 * ha sistema di irrigazione automatico.»
 *
 * Tre cose che un elenco di percentuali non sa:
 *
 *  - la SOGLIA: sotto il minimo la terra è asciutta, e quella pianta è da
 *    innaffiare — è l'unica notizia che la pagina deve dare subito;
 *  - la PIOGGIA: una pianta all'aperto con la terra asciutta e la pioggia in
 *    arrivo non si innaffia, si aspetta. Una in salotto no: la pioggia non la
 *    raggiunge, ed è il motivo per cui «all'aperto» si dichiara per pianta;
 *  - il TEMPO: un'innaffiata è un salto dell'umidità in poche ore, e dopo la
 *    terra si asciuga a un passo suo. Da lì si sa quando è stata innaffiata
 *    l'ultima volta, e fra quanti giorni toccherà di nuovo.
 *
 * È puro: entrano stati, righe, serie e previsioni; escono letture e giudizi.
 * Niente rete, niente DOM, niente orologio — l'adesso lo passa chi chiama.
 */
import { conLaRiga, conLeRighe, righeDichiarate, senzaLaRiga } from "./elenco-dichiarato.js";
import { giorniAllaSoglia } from "./giorni-alla-soglia.js";
import { PIOGGIA_CHE_BASTA_MM, inMillimetri } from "./pioggia-caduta.js";

const pulito = (valore) => String(valore ?? "").trim();

const numero = (valore) => {
  if (valore === "" || valore == null) return null;
  const n = Number(String(valore).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const H = 3600000;

/* ── la configurazione ───────────────────────────────────────────────────── */

/** Dove si scrive la configurazione delle piante. */
export const CHIAVE_PIANTE = "cd_piante";

/* I campi in più di una riga, per nome come in ogni scheda dichiarata:
 *
 *  - `temperatura`: il sensore della temperatura della terra, quando c'è — il
 *    WH52 la misura, il WH51 no;
 *  - `minimo` e `massimo`: la forcella dell'umidità, in percento;
 *  - `fuori`: se la pianta sta all'aperto, cioè se la pioggia la raggiunge. */
export const CAMPI_IN_PIU = Object.freeze(["temperatura", "minimo", "massimo", "fuori"]);

/* La forcella di serie. Sotto il venticinque per cento quasi ogni terra da vaso
 * è asciutta; sopra il settanta è zuppa. Sono numeri di partenza: una sabbia e
 * un terriccio non si leggono allo stesso modo, e chi ha il sensore nel suo
 * vaso li riscrive. */
export const TERRA_ASCIUTTA = 25;
export const TERRA_ZUPPA = 70;

/* La temperatura della terra, per la forcella: sotto dieci gradi le radici si
 * fermano, sopra trenta soffrono. Si guarda e basta: non decide niente. */
export const TERRA_FREDDA = 10;
export const TERRA_CALDA = 30;

/* Dopo quante ore di pioggia prevista si aspetta invece di innaffiare: mezza
 * giornata. Più in là la previsione è una speranza, e una pianta asciutta non
 * aspetta una speranza. */
export const ORE_DI_PIOGGIA = 12;

/* Di quanti punti deve salire l'umidità, in poche ore, per essere
 * un'innaffiata. Un sensore da terra balla di qualche punto da solo — il
 * caldo del giorno, il freddo della notte — e un'innaffiata vera ne fa salire
 * dieci o venti in un'ora. */
export const SALTO_DELL_ACQUA = 8;

/* ── cosa è un sensore della terra ───────────────────────────────────────── */

const PAROLE_DELLA_TERRA = /soil|suolo|terra|terreno|pianta|plant|vaso|orto|moisture/i;
const PAROLE_DELL_ARIA = /aria|air|room|stanza|ambiente|interna|esterna/i;
const PAROLE_DEL_MOISTURE = /moisture|umidit[aà]|humidity|umid/gi;
const PAROLE_DELLA_TEMPERATURA = /temperature|temperatura|temp/gi;

/**
 * Se questa entità è un sensore di umidità della terra da proporre.
 *
 * Home Assistant ha una classe apposta — `moisture` — ed è quella che usano
 * Ecowitt e i sensori da vaso. Qualche integrazione Tuya scrive `humidity`, la
 * classe dell'aria: lì deve dirlo il nome, perché l'umidità di una stanza non
 * è la terra di una pianta. Sempre in percento, e sempre `sensor.*`: un
 * `binary_sensor` con la classe `moisture` è una sonda di allagamento, o il
 * sensore della pioggia.
 */
export function eUnaPianta(entity, stato) {
  const id = pulito(entity);
  if (!id.startsWith("sensor.")) return false;
  const attributi = stato?.attributes || {};
  if (pulito(attributi.unit_of_measurement) !== "%") return false;
  const classe = pulito(attributi.device_class).toLowerCase();
  const testo = `${id} ${pulito(attributi.friendly_name)}`;
  if (classe === "moisture") return true;
  if (classe === "humidity" || !classe)
    return PAROLE_DELLA_TERRA.test(testo) && !PAROLE_DELL_ARIA.test(testo);
  return false;
}

/* Il nome di un sensore senza le parole che dicono cosa misura: quello che resta
 * è il posto, e due sensori dello stesso posto sono della stessa pianta. */
function radice(entity, parole) {
  return pulito(entity)
    .replace(/^sensor\./, "")
    .replace(parole, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Il sensore della temperatura che sta accanto a quello dell'umidità.
 *
 * Il WH52 e i sensori da vaso ne pubblicano due con lo stesso nome e una
 * parola diversa — `soil_moisture_1` e `soil_temperature_1` — e togliendo la
 * parola resta lo stesso posto. È una proposta: chi configura la corregge.
 */
export function temperaturaAccanto(entity, states = {}) {
  const posto = radice(entity, PAROLE_DEL_MOISTURE);
  if (!posto) return "";
  for (const [id, stato] of Object.entries(states || {})) {
    if (!id.startsWith("sensor.")) continue;
    if (pulito(stato?.attributes?.device_class).toLowerCase() !== "temperature") continue;
    if (radice(id, PAROLE_DELLA_TEMPERATURA) === posto) return id;
  }
  return "";
}

/* ── l'elenco dichiarato (#74) ───────────────────────────────────────────── */

export { conLaRiga, conLeRighe, righeDichiarate, senzaLaRiga };

/* La pioggia che basta è quella dell'irrigazione: cinque millimetri sono un
 * giro d'acqua già fatto dal cielo. Una regola sola per il giardino e per il
 * vaso sul balcone. */
export { PIOGGIA_CHE_BASTA_MM };

/** Le righe dichiarate con la loro entità: quelle che la pagina mostra. */
export function righeDellePiante(config) {
  return (righeDichiarate(config, CAMPI_IN_PIU) || []).filter((riga) => riga.entity);
}

/**
 * Se c'è qualcosa da mostrare. Solo le righe dichiarate contano: la sezione
 * nasce vuota, e la accende chi la configura.
 */
export function pianteConfigurate(config) {
  return righeDellePiante(config).length > 0;
}

/** Le righe che il rilevamento proporrebbe adesso, con la temperatura accanto. */
export function pianteDaImportare(states = {}, config, nomeDi = (entity) => entity) {
  const gia = new Set(righeDellePiante(config).map((riga) => riga.entity));
  const righe = [];
  for (const [entity, stato] of Object.entries(states || {})) {
    if (gia.has(entity) || !eUnaPianta(entity, stato)) continue;
    righe.push({
      entity,
      name: pulito(nomeDi(entity)) || entity,
      icon: "plant",
      temperatura: temperaturaAccanto(entity, states),
    });
  }
  return righe.sort((a, b) => a.name.localeCompare(b.name));
}

const MUTI = new Set(["", "unknown", "unavailable", "none"]);

function lettura(stato) {
  return MUTI.has(pulito(stato?.state).toLowerCase()) ? null : numero(stato?.state);
}

function istanteDelCambio(stato) {
  const quando = Date.parse(pulito(stato?.last_changed) || pulito(stato?.last_updated) || "");
  return Number.isFinite(quando) ? quando : null;
}

/* Una casella di spunta salvata come si salva: vero, «true», «on», «1». */
function vero(valore) {
  return valore === true || /^(true|on|1|si|sì|yes)$/i.test(pulito(valore));
}

/** Una riga, letta: l'umidità, la temperatura, la forcella, se sta fuori. */
export function letturaDellaPianta(riga, states = {}, nomeDi = (entity) => entity) {
  const entity = pulito(riga?.entity);
  const stato = states?.[entity];
  const umidita = lettura(stato);
  const temperatura = pulito(riga?.temperatura);
  const minimo = numero(riga?.minimo) ?? TERRA_ASCIUTTA;
  const massimo = numero(riga?.massimo) ?? TERRA_ZUPPA;
  return Object.freeze({
    entity,
    name: pulito(riga?.name) || pulito(nomeDi(entity)) || entity,
    icon: pulito(riga?.icon) || "plant",
    umidita,
    muta: umidita === null,
    da: istanteDelCambio(stato),
    temperatura,
    gradi: temperatura ? lettura(states?.[temperatura]) : null,
    minimo,
    massimo: massimo > minimo ? massimo : Math.max(minimo + 1, TERRA_ZUPPA),
    fuori: vero(riga?.fuori),
  });
}

/** Le piante dichiarate, lette, nell'ordine in cui le si è scritte. */
export function pianteDiCasa(states = {}, config, nomeDi = (entity) => entity) {
  return righeDellePiante(config).map((riga) => letturaDellaPianta(riga, states, nomeDi));
}

/* ── le domande a Home Assistant ─────────────────────────────────────────── */

/**
 * La domanda della terra: la media di ogni ora degli ultimi dieci giorni. Da
 * lì si vedono le innaffiate — un salto in poche ore — e il passo con cui la
 * terra si asciuga. `recorder/statistics_during_period`, al plurale: è quella
 * che il ponte lascia passare.
 */
export function domandaDellaTerra(entita, adesso) {
  const inizio = new Date(Number(adesso) - 10 * 24 * H);
  inizio.setMinutes(0, 0, 0);
  return {
    type: "recorder/statistics_during_period",
    start_time: inizio.toISOString(),
    end_time: new Date(Number(adesso)).toISOString(),
    statistic_ids: [...new Set((entita || []).map(pulito).filter(Boolean))],
    period: "hour",
    types: ["mean"],
  };
}

function inizioDelSecchiello(voce) {
  const inizio = voce?.start;
  if (typeof inizio === "number") return inizio;
  const letto = Date.parse(pulito(inizio));
  return Number.isFinite(letto) ? letto : null;
}

/** Le medie di ogni ora, `{ quando, valore }`, dalla più vecchia. */
export function serieDellaTerra(risposta, entity) {
  const elenco = risposta?.[pulito(entity)];
  return (Array.isArray(elenco) ? elenco : [])
    .map((voce) => ({ quando: inizioDelSecchiello(voce), valore: numero(voce?.mean) }))
    .filter((punto) => punto.quando !== null && punto.valore !== null)
    .map((punto) => ({ quando: punto.quando + H / 2, valore: punto.valore }))
    .sort((a, b) => a.quando - b.quando);
}

/**
 * La domanda delle previsioni, come la fa la card del meteo: il servizio
 * `weather.get_forecasts` con la risposta indietro. Prima quelle per ora, che
 * dicono FRA QUANTO piove; chi non le ha risponde con quelle del giorno.
 */
export function domandaDellePrevisioni(entita, tipo = "hourly") {
  return {
    type: "call_service",
    domain: "weather",
    service: "get_forecasts",
    service_data: { type: tipo },
    target: { entity_id: pulito(entita) },
    return_response: true,
  };
}

/** Le previsioni dalla risposta del servizio, o `[]`. */
export function previsioniDallaRisposta(risposta, entita) {
  const elenco = risposta?.response?.[pulito(entita)]?.forecast;
  return Array.isArray(elenco) ? elenco : [];
}

/* Quanto è probabile, perché una goccia conti. Sotto il quaranta per cento la
 * pioggia prevista è un'ipotesi, e aspettare un'ipotesi con la terra asciutta
 * vuol dire lasciare una pianta a secco. */
const PROBABILITA_CHE_CONTA = 40;

/**
 * La pioggia in arrivo nelle prossime ore: `{ mm, fra, giornaliera }`, oppure
 * `null` se non ne arriva.
 *
 * Con le previsioni per ora si sommano i millimetri delle prossime `ore`, e
 * `fra` dice fra quante ore comincia. Con quelle per giorno si sa solo quanta
 * ne arriva oggi: `fra` resta `null` e `giornaliera` lo dice. `unita` è quella
 * del meteo (`precipitation_unit`): chi ha scelto i pollici li ha anche qui.
 */
export function pioggiaInArrivo(previsioni, { adesso, ore = ORE_DI_PIOGGIA, unita = "mm" } = {}) {
  const ora = Number(adesso);
  const voci = (Array.isArray(previsioni) ? previsioni : [])
    .map((voce) => ({
      quando: Date.parse(pulito(voce?.datetime)),
      mm: inMillimetri(voce?.precipitation, unita),
      probabilita: numero(voce?.precipitation_probability),
    }))
    .filter((voce) => Number.isFinite(voce.quando))
    .sort((a, b) => a.quando - b.quando);
  if (!voci.length) return null;
  const conta = (voce) =>
    voce.mm !== null &&
    voce.mm > 0 &&
    (voce.probabilita === null || voce.probabilita >= PROBABILITA_CHE_CONTA);
  const passo = voci.length > 1 ? voci[1].quando - voci[0].quando : 24 * H;
  if (passo >= 20 * H) {
    /* Per giorno: conta oggi, cioè la voce il cui giorno è quello di adesso. */
    const oggi = new Date(ora).toDateString();
    const sua = voci.find((voce) => new Date(voce.quando).toDateString() === oggi);
    if (!sua || !conta(sua)) return null;
    return { mm: sua.mm, fra: null, giornaliera: true };
  }
  const dentro = voci.filter((voce) => voce.quando >= ora - H && voce.quando <= ora + ore * H);
  const piovose = dentro.filter(conta);
  if (!piovose.length) return null;
  const mm = piovose.reduce((somma, voce) => somma + voce.mm, 0);
  if (mm < 0.1) return null;
  return {
    mm,
    fra: Math.max(0, Math.round((piovose[0].quando - ora) / H)),
    giornaliera: false,
  };
}

/* ── l'acqua data ────────────────────────────────────────────────────────── */

/**
 * Quando è stata innaffiata l'ultima volta, dalle medie di ogni ora: l'ultima
 * salita di almeno `salto` sui due punti prima. Due e non uno, perché
 * un'innaffiata lenta — un sottovaso che si svuota nella terra — sale in due
 * ore invece che in una. `null` se in dieci giorni non ce n'è una.
 *
 * Della salita conta il primo punto. L'ora dopo l'innaffiata guarda anche lei
 * due punti indietro, e uno dei due è ancora la terra asciutta di prima: da
 * sola direbbe che l'acqua è arrivata un'ora più tardi.
 *
 * Una pioggia forte, per una pianta all'aperto, è un'innaffiata anche lei: la
 * terra non sa chi l'ha bagnata, e nemmeno la pianta.
 */
export function ultimaAcqua(serie, { salto = SALTO_DELL_ACQUA } = {}) {
  const punti = Array.isArray(serie) ? serie : [];
  const sale = (i) =>
    i >= 1 &&
    punti[i].valore - Math.min(punti[i - 1].valore, i >= 2 ? punti[i - 2].valore : Infinity) >=
      salto;
  for (let i = punti.length - 1; i >= 1; i -= 1) {
    if (!sale(i)) continue;
    while (sale(i - 1)) i -= 1;
    return punti[i].quando;
  }
  return null;
}

/**
 * Fra quanti giorni la terra arriva al minimo, al passo con cui si sta
 * asciugando dall'ultima innaffiata. È la retta del sale, con un salto più
 * grande e almeno un giorno di punti: nelle prime ore dopo l'acqua la terra
 * scende in fretta mentre si scola, e una retta fatta lì direbbe domani.
 */
export function giorniAllaSete(serie, lettura) {
  const punti = [...(Array.isArray(serie) ? serie : [])];
  const ultimo = punti.reduce((a, b) => Math.max(a, Number(b?.quando) || -Infinity), -Infinity);
  if (lettura?.umidita !== null && lettura?.umidita !== undefined) {
    const quando = Number.isFinite(lettura.da) && lettura.da > ultimo ? lettura.da : null;
    if (quando !== null) punti.push({ quando, valore: lettura.umidita });
  }
  return giorniAllaSoglia(punti, {
    soglia: lettura?.minimo ?? TERRA_ASCIUTTA,
    salto: SALTO_DELL_ACQUA,
    punti: 12,
    giorni: 1,
  });
}

/* ── come sta una pianta, e tutte insieme ────────────────────────────────── */

/** Com'è un numero rispetto alla sua forcella: «low», «ok», «high», o «». */
export function nellaForcella(valore, minimo, massimo) {
  const n = numero(valore);
  if (n === null) return "";
  if (n < minimo) return "low";
  if (n > massimo) return "high";
  return "ok";
}

/**
 * Come sta una pianta: `muta`, `asciutta`, `aspetta` (asciutta, ma all'aperto
 * e con la pioggia in arrivo) o `bene`.
 */
export function comeStaLaPianta(lettura, { pioggia = null, serie = [] } = {}) {
  const terra = nellaForcella(lettura?.umidita, lettura?.minimo, lettura?.massimo);
  const caldo = nellaForcella(lettura?.gradi, TERRA_FREDDA, TERRA_CALDA);
  const acqua = ultimaAcqua(serie);
  const giorni = lettura?.muta ? null : giorniAllaSete(serie, lettura);
  let stato = "bene";
  if (lettura?.muta) stato = "muta";
  else if (terra === "low")
    stato = lettura.fuori && pioggia && pioggia.mm >= PIOGGIA_CHE_BASTA_MM ? "aspetta" : "asciutta";
  return {
    stato,
    terra,
    caldo,
    ultimaAcqua: acqua,
    giorni: stato === "bene" ? giorni : null,
    pioggia: stato === "aspetta" ? pioggia : null,
  };
}

/**
 * Come stanno le piante di casa, tutte insieme: è quello che leggono la pagina
 * e la tessera in Home, dallo stesso posto.
 *
 * `dati` è quello che si è chiesto a Home Assistant — `serie` per entità, e la
 * `pioggia` in arrivo — e può mancare: senza serie non si sa quando è stata
 * innaffiata, senza previsioni una pianta asciutta resta asciutta. Sbagliare
 * nell'altro verso — aspettare una pioggia di cui non si sa niente — vorrebbe
 * dire lasciarla a secco.
 */
export function comeStannoLePiante(letture = [], dati = {}) {
  const piante = (Array.isArray(letture) ? letture : []).map((lettura) => ({
    lettura,
    ...comeStaLaPianta(lettura, {
      pioggia: dati?.pioggia || null,
      serie: dati?.serie?.[lettura.entity] || [],
    }),
  }));
  const peso = { asciutta: 0, aspetta: 1, muta: 2, bene: 3 };
  const inFila = piante
    .map((pianta, indice) => ({ pianta, indice }))
    .sort((a, b) => peso[a.pianta.stato] - peso[b.pianta.stato] || a.indice - b.indice)
    .map((voce) => voce.pianta);
  const quali = (stato) => inFila.filter((pianta) => pianta.stato === stato);
  const daInnaffiare = quali("asciutta");
  const aspettano = quali("aspetta");
  const bene = quali("bene");
  const mute = quali("muta");
  /* La prossima da innaffiare, fra quelle che stanno bene: è la risposta a
   * «quando innaffio» quando la risposta non è «adesso». */
  const prossima =
    bene.filter((pianta) => pianta.giorni !== null).sort((a, b) => a.giorni - b.giorni)[0] || null;
  return {
    piante: inFila,
    daInnaffiare,
    aspettano,
    bene,
    mute,
    prossima,
    pioggia: dati?.pioggia || null,
    stato: daInnaffiare.length
      ? "sete"
      : aspettano.length
        ? "pioggia"
        : bene.length
          ? "bene"
          : mute.length
            ? "mute"
            : "vuoto",
  };
}
