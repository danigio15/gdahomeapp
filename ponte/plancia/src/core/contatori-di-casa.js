/* I contatori di casa: l'acqua e il gas (#115, #135, #137).
 *
 * «Manca una sezione per monitorare portata e pressione dell'impianto idrico di
 * casa, magari anche l'addolcitore per vedere il livello del sale.» «Si
 * potrebbero mettere sezioni come consumi e contatore acqua e energia gas.»
 * «Potresti creare una sezione consumo gas.» Tre persone, la stessa cosa: un
 * contatore col trattamento che l'Energia dà alla corrente — oggi, ieri, il
 * mese, quanto costa.
 *
 * Più il mestiere che un elenco di numeri non ha:
 *
 *  - la PORTATA che resta sopra zero per ore vuol dire una perdita — ed è
 *    l'unica ragione per avere un sensore di portata in casa;
 *  - la PRESSIONE ha una forcella in cui sta bene, e un numero nudo non la dice;
 *  - il SALE dell'addolcitore si vuole in giorni, perché quello che uno vuole
 *    sapere è quando ricomprarlo;
 *  - il GAS si paga a metri cubi ma si confronta in kilowattora: col
 *    coefficiente della bolletta i due si sommano con la corrente.
 *
 * È puro: entrano numeri, stati e righe della storia; escono numeri e giudizi.
 * Le parole le mette chi disegna. Niente rete, niente DOM, niente orologio —
 * l'adesso lo passa chi chiama.
 */
import { conLaRiga, conLeRighe, righeDichiarate, senzaLaRiga } from "./elenco-dichiarato.js";
import { avvioDallaStoria } from "./quando-e-partito.js";

const pulito = (valore) => String(valore ?? "").trim();

const numero = (valore) => {
  if (valore === "" || valore == null) return null;
  const n = Number(String(valore).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const H = 3600000;
const GIORNO_MS = 24 * H;

/* ── la configurazione ───────────────────────────────────────────────────── */

/** Dove si scrive la configurazione dei contatori. */
export const CHIAVE_CONTATORI = "cd_contatori";

/* Le cinque cose che una riga può misurare, nell'ordine in cui le legge la
 * pagina: prima quello che si paga, poi quello che dice come sta l'impianto. */
export const GENERI = Object.freeze(["acqua", "gas", "pressione", "portata", "sale"]);

/* I campi in più di una riga. Passano per nome dall'elenco dichiarato, come la
 * famiglia delle Macchine e l'esclusione dei Varchi: un elenco esplicito è
 * l'unica forma che dice cosa si salva.
 *
 *  - `genere`: cosa misura, fra i cinque qui sopra;
 *  - `prezzo`: euro al metro cubo, per l'acqua e per il gas;
 *  - `coefficiente`: i kilowattora di un metro cubo di gas;
 *  - `minimo` e `massimo`: la forcella della pressione, in bar;
 *  - `soglia`: sotto quanto il sale va ricomprato. */
export const CAMPI_IN_PIU = Object.freeze([
  "genere",
  "prezzo",
  "coefficiente",
  "minimo",
  "massimo",
  "soglia",
]);

/* Il disegno di serie di ogni genere: il punto di partenza, che chi configura
 * la riga cambia dalla striscia dei disegni. */
const DISEGNI = Object.freeze({
  acqua: "meter",
  gas: "flame",
  pressione: "gauge",
  portata: "water",
  sale: "softener",
});

/** Il disegno di serie di un genere. */
export function disegnoDelGenere(genere) {
  return DISEGNI[pulito(genere)] || "meter";
}

/** Un genere fra i cinque, o «». */
export function genereValido(genere) {
  const scritto = pulito(genere);
  return GENERI.includes(scritto) ? scritto : "";
}

/* ── i volumi ────────────────────────────────────────────────────────────── */

/* Quanti litri fa un'unità di volume, per le unità che Home Assistant accetta
 * sui contatori d'acqua e di gas. Il metro cubo si scrive in due modi — con
 * l'esponente e senza — e tutti e due arrivano davvero dalle integrazioni. */
const LITRI_PER_UNITA = Object.freeze({
  "m³": 1000,
  m3: 1000,
  l: 1,
  L: 1,
  gal: 3.785411784,
  "ft³": 28.316846592,
  ft3: 28.316846592,
  ccf: 2831.6846592,
  CCF: 2831.6846592,
});

/** Quanti litri fa una unità, o `null` se non è un volume. */
export function litriPerUnita(unita) {
  const u = pulito(unita);
  return LITRI_PER_UNITA[u] ?? LITRI_PER_UNITA[u.toLowerCase()] ?? null;
}

/** Un volume in litri, o `null` se il valore o l'unità non si leggono. */
export function inLitri(valore, unita) {
  const n = numero(valore);
  const fattore = litriPerUnita(unita);
  return n === null || fattore === null ? null : n * fattore;
}

/**
 * Come si dice un volume: in litri finché è meno di un metro cubo — è la
 * misura con cui si pensa una giornata d'acqua, «214 litri» — e in metri cubi
 * da lì in su, che è la misura della bolletta. Torna il numero già nella sua
 * unità e quanti decimali merita; il modo di scriverlo lo decide chi disegna.
 */
export function comeSiDiceIlVolume(litri) {
  const n = numero(litri);
  if (n === null) return null;
  if (Math.abs(n) < 1000) return { valore: Math.round(n), unita: "L", decimali: 0 };
  const metri = n / 1000;
  return { valore: metri, unita: "m³", decimali: Math.abs(metri) < 100 ? 1 : 0 };
}

/* ── la portata e la pressione ───────────────────────────────────────────── */

/* Quanti litri al minuto fa un'unità di portata. Il litro al minuto è la
 * misura di un rubinetto — «6 litri al minuto» lo capisce chiunque — e le
 * altre ci si riportano. */
const LITRI_AL_MINUTO = Object.freeze({
  "L/min": 1,
  "l/min": 1,
  "L/h": 1 / 60,
  "l/h": 1 / 60,
  "L/s": 60,
  "l/s": 60,
  "mL/s": 0.06,
  "m³/h": 1000 / 60,
  "m3/h": 1000 / 60,
  "m³/min": 1000,
  "m³/s": 60000,
  "gal/min": 3.785411784,
  "ft³/min": 28.316846592,
});

/** Quanti litri al minuto fa un'unità di portata, o `null`. */
export function litriAlMinutoPerUnita(unita) {
  return LITRI_AL_MINUTO[pulito(unita)] ?? null;
}

/** Una portata in litri al minuto, o `null`. */
export function inLitriAlMinuto(valore, unita) {
  const n = numero(valore);
  const fattore = litriAlMinutoPerUnita(unita);
  return n === null || fattore === null ? null : n * fattore;
}

/* Quanti bar fa un'unità di pressione.
 *
 * Il millibar e l'ettopascal NON ci sono, ed è voluto: sono le unità del
 * barometro, e l'impianto dell'acqua non le usa mai. Tenerle fuori è il modo
 * di non scambiare la pressione dell'aria di oggi — mille ettopascal, cioè un
 * bar — per quella dei tubi di casa. */
const BAR_PER_UNITA = Object.freeze({
  bar: 1,
  psi: 0.0689475729,
  kPa: 0.01,
  MPa: 10,
});

/** Quanti bar fa un'unità di pressione dell'acqua, o `null`. */
export function barPerUnita(unita) {
  return BAR_PER_UNITA[pulito(unita)] ?? null;
}

/** Una pressione in bar, o `null`. */
export function inBar(valore, unita) {
  const n = numero(valore);
  const fattore = barPerUnita(unita);
  return n === null || fattore === null ? null : n * fattore;
}

/* La forcella di serie: fra due e quattro bar sta quasi ogni casa. Sotto, la
 * doccia del piano di sopra si affloscia; sopra, le guarnizioni soffrono e i
 * rubinetti battono. Chi ha un'autoclave tarata altrove la riscrive. */
export const FORCELLA_DELLA_PRESSIONE = Object.freeze({ minimo: 2, massimo: 4 });

/**
 * Com'è una pressione rispetto alla sua forcella: «low», «ok», «high», o «»
 * quando non si legge. Sono le parole della barra a forcella della Piscina,
 * che è il disegno con cui la si mostra.
 */
export function giudizioDellaPressione(bar, { minimo, massimo } = {}) {
  const valore = numero(bar);
  if (valore === null) return "";
  const basso = numero(minimo) ?? FORCELLA_DELLA_PRESSIONE.minimo;
  const alto = numero(massimo) ?? FORCELLA_DELLA_PRESSIONE.massimo;
  if (valore < basso) return "low";
  if (valore > alto) return "high";
  return "ok";
}

/* ── il gas ──────────────────────────────────────────────────────────────── */

/* Quanti kilowattora fa un metro cubo di metano, quando la bolletta non dice
 * altro. La bolletta italiana scrive il potere calorifico superiore del gas
 * della propria zona — intorno ai 38 megajoule per standard metro cubo, cioè
 * 10,5–10,7 kWh — e chi lo vuole esatto lo copia da lì. */
export const KWH_PER_METRO_CUBO = 10.7;

/** I kilowattora di un volume di gas, in metri cubi. */
export function kwhDelGas(metriCubi, coefficiente = KWH_PER_METRO_CUBO) {
  const m = numero(metriCubi);
  const c = numero(coefficiente);
  if (m === null) return null;
  return m * (c !== null && c > 0 ? c : KWH_PER_METRO_CUBO);
}

/** Quanto costa un volume, a prezzo per metro cubo; `null` senza prezzo. */
export function quantoCosta(metriCubi, prezzoAlMetroCubo) {
  const m = numero(metriCubi);
  const p = numero(prezzoAlMetroCubo);
  if (m === null || p === null || p <= 0) return null;
  return m * p;
}

/* ── cosa misura un sensore ──────────────────────────────────────────────── */

/* Le parole con cui un nome dice di cosa parla. Servono dove Home Assistant
 * non lo dice: un contatore d'acqua a impulsi fatto in casa ha i metri cubi e
 * nessuna classe, e il suo nome è l'unica cosa che lo distingue dal gas. */
const PAROLE_DEL_SALE = /(^|[^a-z])(sale|salt|salz|sel)([^a-z]|$)|addolcitor|softener/i;
const PAROLE_DEL_GAS = /gas|metano|methane/i;
const PAROLE_DELL_ACQUA = /acqua|water|idric|autoclave|acquedott/i;
/* La pressione della caldaia è acqua anche lei, ma è il circuito del
 * riscaldamento: sta nella Gestione termica, e qui farebbe una seconda
 * forcella sbagliata — un bar e mezzo che per la caldaia va benissimo e per il
 * rubinetto è poco. */
const PAROLE_DEL_RISCALDAMENTO = /caldaia|boiler|riscald|heating|termic|radiator|pavimento/i;

const UNITA_IN_GIORNI = /^(d|day|days|giorni|giorno|gg)$/i;

/** Se il sale si legge già in giorni: allora il numero è la risposta. */
export function saleInGiorni(unita) {
  return UNITA_IN_GIORNI.test(pulito(unita));
}

/**
 * Cosa misura un sensore, da come Home Assistant lo descrive: «acqua», «gas»,
 * «portata», «pressione», «sale», o «» quando non si capisce.
 *
 * Prima la classe, che è la dichiarazione dell'integrazione; poi l'unità;
 * per ultime le parole del nome, che servono solo a distinguere quello che
 * classe e unità lasciano uguale — un metro cubo d'acqua da uno di gas.
 */
export function genereDelSensore(entity, stato) {
  const attributi = stato?.attributes || {};
  const classe = pulito(attributi.device_class).toLowerCase();
  const unita = pulito(attributi.unit_of_measurement);
  const testo = `${pulito(entity)} ${pulito(attributi.friendly_name)}`;
  if (classe === "water") return "acqua";
  if (classe === "gas") return "gas";
  if (classe === "volume_flow_rate" || litriAlMinutoPerUnita(unita) !== null) return "portata";
  if (PAROLE_DEL_SALE.test(testo)) return "sale";
  if (barPerUnita(unita) !== null) return "pressione";
  if (litriPerUnita(unita) !== null) return PAROLE_DEL_GAS.test(testo) ? "gas" : "acqua";
  return "";
}

/**
 * Se questa entità è un contatore di casa da proporre, e di che genere.
 *
 * È più stretto di `genereDelSensore`, perché qui si propone senza chiedere:
 * un contatore deve contare — `total` o `total_increasing` — e senza la
 * classe deve dirlo il nome; una pressione deve essere dell'acqua, e mai
 * quella della caldaia. Il rilevamento propone e basta: quello che non
 * c'entra si elimina, e non torna.
 */
export function contatoreDaProporre(entity, stato) {
  const id = pulito(entity);
  if (!id.startsWith("sensor.")) return "";
  const genere = genereDelSensore(id, stato);
  if (!genere) return "";
  const attributi = stato?.attributes || {};
  const classe = pulito(attributi.device_class).toLowerCase();
  const testo = `${id} ${pulito(attributi.friendly_name)}`;
  if (PAROLE_DEL_RISCALDAMENTO.test(testo)) return "";
  if (genere === "acqua" || genere === "gas") {
    const conta = /^(total|total_increasing)$/.test(pulito(attributi.state_class));
    if (!conta) return "";
    if (classe === "water" || classe === "gas") return genere;
    return PAROLE_DELL_ACQUA.test(testo) || PAROLE_DEL_GAS.test(testo) ? genere : "";
  }
  if (genere === "pressione") return PAROLE_DELL_ACQUA.test(testo) ? genere : "";
  return genere;
}

/* ── l'elenco dichiarato (#74) ───────────────────────────────────────────── */

/* La regola è quella di tutte le schede dichiarate: una riga la metti tu, e
 * quando la elimini è eliminata. Qui si riespone com'è. */
export { conLaRiga, conLeRighe, righeDichiarate, senzaLaRiga };

/** Le righe dichiarate con la loro entità: quelle che la pagina mostra. */
export function righeDeiContatori(config) {
  return (righeDichiarate(config, CAMPI_IN_PIU) || []).filter((riga) => riga.entity);
}

/**
 * Se c'è qualcosa da mostrare.
 *
 * Solo le righe dichiarate contano: questa sezione nasce vuota, e un metro
 * cubo trovato in casa non basta a metterla nella barra — la accende chi la
 * configura.
 */
export function contatoriConfigurati(config) {
  return righeDeiContatori(config).length > 0;
}

/**
 * Le righe che il rilevamento proporrebbe adesso: il tasto «Prendi quelli che
 * Home Assistant ha trovato», e la prima apertura della scheda.
 */
export function contatoriDaImportare(states = {}, config, nomeDi = (entity) => entity) {
  const gia = new Set(righeDeiContatori(config).map((riga) => riga.entity));
  const righe = [];
  for (const [entity, stato] of Object.entries(states || {})) {
    if (gia.has(entity)) continue;
    const genere = contatoreDaProporre(entity, stato);
    if (!genere) continue;
    righe.push({
      entity,
      name: pulito(nomeDi(entity)) || entity,
      icon: disegnoDelGenere(genere),
      genere,
    });
  }
  const posto = (riga) => GENERI.indexOf(riga.genere);
  return righe.sort((a, b) => posto(a) - posto(b) || a.name.localeCompare(b.name));
}

const MUTI = new Set(["", "unknown", "unavailable", "none"]);

/* Quando questo stato è cambiato l'ultima volta: è l'inizio dell'ultimo tratto
 * della portata, che la storia chiesta qualche minuto fa può non avere ancora. */
function istanteDelCambio(stato) {
  const quando = Date.parse(pulito(stato?.last_changed) || pulito(stato?.last_updated) || "");
  return Number.isFinite(quando) ? quando : null;
}

/**
 * Una riga, letta: il genere, il valore in un'unità che si confronta, e i
 * numeri che la riga si porta dietro.
 *
 * Il genere scritto nella riga vince; quando manca — una riga aggiunta a mano
 * senza sceglierlo — lo dice il sensore, e se neanche lui lo dice è un
 * contatore d'acqua, che è il caso più comune.
 */
export function letturaDelContatore(riga, stato, nomeDi = (entity) => entity) {
  const entity = pulito(riga?.entity);
  const genere = genereValido(riga?.genere) || genereDelSensore(entity, stato) || "acqua";
  const unita = pulito(stato?.attributes?.unit_of_measurement);
  const grezzo = MUTI.has(pulito(stato?.state).toLowerCase()) ? null : numero(stato?.state);
  return Object.freeze({
    entity,
    name: pulito(riga?.name) || pulito(nomeDi(entity)) || entity,
    icon: pulito(riga?.icon) || disegnoDelGenere(genere),
    genere,
    unita,
    valore: grezzo,
    muto: grezzo === null,
    bar: genere === "pressione" ? inBar(grezzo, unita) : null,
    litriAlMinuto: genere === "portata" ? inLitriAlMinuto(grezzo, unita) : null,
    da: istanteDelCambio(stato),
    prezzo: numero(riga?.prezzo),
    coefficiente: numero(riga?.coefficiente),
    minimo: numero(riga?.minimo),
    massimo: numero(riga?.massimo),
    soglia: numero(riga?.soglia),
  });
}

/** Le righe dichiarate, lette, nell'ordine dei generi e poi come le si è scritte. */
export function contatoriDiCasa(states = {}, config, nomeDi = (entity) => entity) {
  const lette = righeDeiContatori(config).map((riga) =>
    letturaDelContatore(riga, states?.[riga.entity], nomeDi),
  );
  const posto = (lettura) => GENERI.indexOf(lettura.genere);
  return lette
    .map((lettura, indice) => ({ lettura, indice }))
    .sort((a, b) => posto(a.lettura) - posto(b.lettura) || a.indice - b.indice)
    .map((voce) => voce.lettura);
}

/* ── le domande al Recorder ──────────────────────────────────────────────── */

/* Le domande sono `recorder/statistics_during_period`, al plurale, ed è una
 * scelta: la sorella al singolare darebbe «oggi» un po' più fresco, ma il ponte
 * e il pannello lasciano passare questa sola, e allargare quell'elenco per
 * qualche minuto di freschezza vorrebbe dire aprire una porta in più in due
 * posti. Un secchiello al giorno arriva fino all'ultima ora compilata. */

function mezzanotte(ms) {
  const giorno = new Date(ms);
  giorno.setHours(0, 0, 0, 0);
  return giorno.getTime();
}

function primoDelMese(ms, spostamento = 0) {
  const giorno = new Date(ms);
  return new Date(giorno.getFullYear(), giorno.getMonth() + spostamento, 1).getTime();
}

const chiaveDelGiorno = (ms) => {
  const giorno = new Date(ms);
  return `${giorno.getFullYear()}-${giorno.getMonth() + 1}-${giorno.getDate()}`;
};

const chiaveDelMese = (ms) => {
  const giorno = new Date(ms);
  return `${giorno.getFullYear()}-${giorno.getMonth() + 1}`;
};

/** La domanda dei consumi: un secchiello al giorno, dal primo del mese scorso. */
export function domandaDeiConsumi(entita, adesso) {
  return {
    type: "recorder/statistics_during_period",
    start_time: new Date(primoDelMese(adesso, -1)).toISOString(),
    end_time: new Date(adesso).toISOString(),
    statistic_ids: [...new Set((entita || []).map(pulito).filter(Boolean))],
    period: "day",
    types: ["change"],
  };
}

/* L'inizio di un secchiello: in millisecondi dalle versioni del 2023, in una
 * data scritta in quelle prima. */
function inizioDelSecchiello(voce) {
  const inizio = voce?.start;
  if (typeof inizio === "number") return inizio;
  const letto = Date.parse(pulito(inizio));
  return Number.isFinite(letto) ? letto : null;
}

function secchielli(risposta, entity) {
  const elenco = risposta?.[pulito(entity)];
  return (Array.isArray(elenco) ? elenco : [])
    .map((voce) => ({ quando: inizioDelSecchiello(voce), voce }))
    .filter((voce) => voce.quando !== null)
    .sort((a, b) => a.quando - b.quando);
}

/**
 * Oggi, ieri, il mese e il mese scorso di un contatore, nella sua unità.
 *
 * Un secchiello si conta nel giorno in cui cade la sua metà, non il suo
 * inizio: il giorno lo taglia Home Assistant col suo fuso, e se quello della
 * casa e quello del telefono non sono lo stesso l'inizio cade la sera prima —
 * la metà no.
 *
 * `null` dove non c'è nessun secchiello. Oggi è zero, e non `null`, quando c'è
 * ieri e oggi ancora no: è la prima ora dopo la mezzanotte, che il Recorder
 * non ha ancora compilato.
 */
export function consumiDallaRisposta(risposta, entity, adesso) {
  const elenco = secchielli(risposta, entity);
  if (!elenco.length) return { oggi: null, ieri: null, mese: null, meseScorso: null };
  const oggi = chiaveDelGiorno(adesso);
  const ieri = chiaveDelGiorno(mezzanotte(adesso) - GIORNO_MS / 2);
  const mese = chiaveDelMese(adesso);
  const meseScorso = chiaveDelMese(primoDelMese(adesso) - GIORNO_MS / 2);
  const somme = { oggi: null, ieri: null, mese: null, meseScorso: null };
  const aggiungi = (dove, valore) => {
    somme[dove] = (somme[dove] ?? 0) + valore;
  };
  for (const { quando, voce } of elenco) {
    const cambio = numero(voce.change);
    if (cambio === null) continue;
    const meta = quando + GIORNO_MS / 2;
    const giorno = chiaveDelGiorno(meta);
    const delMese = chiaveDelMese(meta);
    if (giorno === oggi) aggiungi("oggi", cambio);
    if (giorno === ieri) aggiungi("ieri", cambio);
    if (delMese === mese) aggiungi("mese", cambio);
    if (delMese === meseScorso) aggiungi("meseScorso", cambio);
  }
  if (somme.oggi === null && somme.ieri !== null) somme.oggi = 0;
  if (somme.mese === null && somme.oggi !== null) somme.mese = somme.oggi;
  return somme;
}

/** La domanda delle ore: quanto è passato in ognuna delle ultime ventiquattro. */
export function domandaDelleOre(entita, adesso) {
  const inizio = new Date(adesso - 25 * H);
  inizio.setMinutes(0, 0, 0);
  return {
    type: "recorder/statistics_during_period",
    start_time: inizio.toISOString(),
    end_time: new Date(adesso).toISOString(),
    statistic_ids: [...new Set((entita || []).map(pulito).filter(Boolean))],
    period: "hour",
    types: ["change"],
  };
}

/** I consumi ora per ora, dal più vecchio al più recente. */
export function oreDallaRisposta(risposta, entity) {
  return secchielli(risposta, entity).map(({ voce }) => numero(voce.change));
}

/** La domanda del sale: la media di ogni giorno dell'ultimo mese. */
export function domandaDelSale(entita, adesso) {
  return {
    type: "recorder/statistics_during_period",
    start_time: new Date(mezzanotte(adesso) - 30 * GIORNO_MS).toISOString(),
    end_time: new Date(adesso).toISOString(),
    statistic_ids: [...new Set((entita || []).map(pulito).filter(Boolean))],
    period: "day",
    types: ["mean"],
  };
}

/** Le medie di ogni giorno, nella forma di `giorniDiSale`. */
export function serieDalleStatistiche(risposta, entity) {
  return secchielli(risposta, entity)
    .map(({ quando, voce }) => ({ quando: quando + GIORNO_MS / 2, valore: numero(voce.mean) }))
    .filter((punto) => punto.valore !== null);
}

/**
 * Dalla storia grezza, l'ultima lettura di ogni giorno: serve al sale che non
 * ha statistiche — un sensore senza `state_class` il Recorder non lo riassume.
 */
export function serieDallaStoria(righe) {
  const perGiorno = new Map();
  for (const riga of Array.isArray(righe) ? righe : []) {
    const valore = numero(riga?.stato);
    if (valore === null || !Number.isFinite(riga?.quando)) continue;
    const chiave = chiaveDelGiorno(riga.quando);
    const prima = perGiorno.get(chiave);
    if (!prima || prima.quando <= riga.quando)
      perGiorno.set(chiave, { quando: riga.quando, valore });
  }
  return [...perGiorno.values()].sort((a, b) => a.quando - b.quando);
}

/* ── la perdita ──────────────────────────────────────────────────────────── */

/* Dopo quante ore di acqua che scorre senza fermarsi si parla di perdita.
 *
 * Una casa usa l'acqua a colpi: la doccia, la lavatrice che carica, lo
 * sciacquone — e fra un colpo e l'altro la portata torna a zero. Una perdita
 * no: non torna mai a zero. Tre ore tengono fuori anche un'irrigazione lunga,
 * che è l'unico uso vero che scorre di fila per più di un'ora. */
export const ORE_PRIMA_DELLA_PERDITA = 3;

/* Un sensore di portata che fa uno zero di un minuto dentro un flusso continuo
 * non ha visto la casa chiudere il rubinetto: ha perso una lettura. */
const PAUSA_CHE_NON_FERMA_MS = 60 * 1000;

/**
 * Da quando l'acqua scorre senza fermarsi, dalla storia della portata.
 *
 * `righe` sono quelle di `righeDellaStoria` (`{ stato, quando }`), `da` è
 * l'inizio della finestra chiesta. Torna `{ quando, certo }` — `certo` falso
 * quando scorreva già all'inizio della finestra — oppure `null` se adesso non
 * scorre. È la stessa domanda dell'avvio di un elettrodomestico (#143), con la
 * portata al posto dei watt: si chiede a quella.
 */
export function scorreDa(righe, { adesso, da = -Infinity, soglia = 0 } = {}) {
  const limite = numero(soglia) ?? 0;
  return avvioDallaStoria(righe, {
    inFunzione: (stato) => {
      const n = numero(stato);
      return n !== null && n > limite;
    },
    adesso,
    da,
    pausaMs: PAUSA_CHE_NON_FERMA_MS,
  });
}

/**
 * Se l'acqua che scorre è una perdita: `{ perdita, ore }`.
 *
 * `scorre` è quello di `scorreDa`. Oltre la soglia di ore è una perdita; sotto
 * è acqua che si sta usando, e non si dice niente.
 */
export function giudizioDellaPerdita(scorre, { adesso, ore = ORE_PRIMA_DELLA_PERDITA } = {}) {
  if (!scorre || !Number.isFinite(scorre.quando)) return { perdita: false, ore: 0 };
  const durata = Math.max(0, (Number(adesso) - scorre.quando) / 3600000);
  const soglia = numero(ore) ?? ORE_PRIMA_DELLA_PERDITA;
  return { perdita: durata >= soglia, ore: durata, certo: scorre.certo !== false };
}

/**
 * Senza sensore di portata: se in un giorno intero non c'è stata un'ora ferma.
 *
 * Il contatore da solo non vede i colpi dentro l'ora — vede solo quanto è
 * passato in ognuna. Di giorno un'ora senza acqua non c'è quasi mai, ma di
 * notte sì: una casa che per ventiquattro ore di fila non ha mai un'ora a zero
 * ha qualcosa che scorre anche quando dormono tutti. `ore` sono i consumi
 * orari delle ultime ventiquattro ore, in qualunque unità.
 */
export function nessunaOraFerma(ore) {
  const elenco = (Array.isArray(ore) ? ore : []).map(numero);
  if (elenco.length < 24) return false;
  return elenco.slice(-24).every((consumo) => consumo !== null && consumo > 0);
}

/* ── il sale dell'addolcitore ────────────────────────────────────────────── */

/* Sotto quale livello il sale va ricomprato: un addolcitore che arriva a zero
 * rigenera con l'acqua dura, e il giorno giusto per accorgersene è prima. */
export const SALE_DA_RICOMPRARE = 10;

/**
 * Fra quanti giorni il sale arriva alla soglia, dal suo andamento.
 *
 * `serie` sono le letture di ogni giorno — `{ quando, valore }`, in percento o
 * in chili, purché della stessa unità della soglia — e la risposta è la retta
 * che ci passa meglio: quanto scende al giorno, e quanti giorni restano a quel
 * passo. Senza almeno tre giorni, o se il sale non sta scendendo (è appena
 * stato caricato), non c'è una risposta onesta: `null`.
 */
export function giorniDiSale(serie, { soglia = SALE_DA_RICOMPRARE } = {}) {
  const punti = (Array.isArray(serie) ? serie : [])
    .map((voce) => ({ x: Number(voce?.quando) / 86400000, y: numero(voce?.valore) }))
    .filter((p) => Number.isFinite(p.x) && p.y !== null)
    .sort((a, b) => a.x - b.x);
  /* Un carico di sale fa risalire il livello: la retta si prende solo da lì
   * in poi, altrimenti il carico di ieri la farebbe salire. */
  let inizio = 0;
  for (let i = 1; i < punti.length; i += 1) if (punti[i].y > punti[i - 1].y + 1) inizio = i;
  const usati = punti.slice(inizio);
  if (usati.length < 3) return null;
  const mediaX = usati.reduce((s, p) => s + p.x, 0) / usati.length;
  const mediaY = usati.reduce((s, p) => s + p.y, 0) / usati.length;
  let sopra = 0;
  let sotto = 0;
  for (const p of usati) {
    sopra += (p.x - mediaX) * (p.y - mediaY);
    sotto += (p.x - mediaX) ** 2;
  }
  if (!sotto) return null;
  const alGiorno = sopra / sotto;
  if (!(alGiorno < 0)) return null;
  const ultimo = usati[usati.length - 1].y;
  const limite = numero(soglia) ?? SALE_DA_RICOMPRARE;
  return Math.max(0, Math.floor((ultimo - limite) / -alGiorno));
}

/**
 * Come sta il sale: quanti giorni restano, a che livello è, e se è da
 * ricomprare.
 *
 * Tre sensori diversi, tre letture: chi dice già i giorni (le centraline che
 * lo calcolano da sé) ha la risposta nel numero; chi dice la percentuale ha il
 * livello, e i giorni si contano dall'andamento; chi dice i chili ha il livello
 * rispetto al più alto visto nell'ultimo mese — cioè all'ultimo carico.
 */
export function comeStaIlSale(lettura, serie = []) {
  const soglia = lettura?.soglia ?? SALE_DA_RICOMPRARE;
  const valore = lettura?.valore ?? null;
  if (valore === null) return { giorni: null, livello: null, basso: false };
  if (saleInGiorni(lettura.unita))
    return { giorni: Math.max(0, Math.floor(valore)), livello: null, basso: valore <= soglia };
  /* Le medie del Recorder arrivano fino a ieri: la lettura di adesso è il
   * punto più fresco, e ci va in fondo quando è più recente dell'ultima. */
  const punti = [...(Array.isArray(serie) ? serie : [])];
  const ultimo = punti.reduce((a, b) => Math.max(a, Number(b?.quando) || -Infinity), -Infinity);
  if (Number.isFinite(lettura.da) && lettura.da > ultimo)
    punti.push({ quando: lettura.da, valore });
  const giorni = giorniDiSale(punti, { soglia });
  let livello = null;
  if (pulito(lettura.unita) === "%") livello = valore;
  else {
    const massimo = Math.max(valore, ...punti.map((p) => numero(p?.valore) ?? 0));
    livello = massimo > 0 ? (valore / massimo) * 100 : null;
  }
  return {
    giorni,
    livello: livello === null ? null : Math.max(0, Math.min(100, livello)),
    basso: valore <= soglia,
  };
}

/* ── come stanno, tutti insieme ──────────────────────────────────────────── */

const somma = (valori) => {
  const letti = valori.filter((valore) => valore !== null && valore !== undefined);
  return letti.length ? letti.reduce((a, b) => a + b, 0) : null;
};

/* I consumi di un genere, sommati sui suoi contatori: l'acqua in litri, il gas
 * in metri cubi. Due contatori d'acqua — la casa e il giardino — sono l'acqua
 * di casa, e la bolletta li somma allo stesso modo. */
function consumiDelGenere(letture, consumi, genere) {
  const suoi = letture.filter((lettura) => lettura.genere === genere);
  if (!suoi.length) return null;
  const perUnita = genere === "gas" ? 1000 : 1;
  const voci = suoi
    .map((lettura) => {
      const dati = consumi?.[lettura.entity];
      const litriPer = litriPerUnita(lettura.unita);
      if (!dati || litriPer === null) return null;
      const converti = (valore) => (valore === null ? null : (valore * litriPer) / perUnita);
      const oggi = converti(dati.oggi);
      const mese = converti(dati.mese);
      const metriCubiOggi = oggi === null ? null : (oggi * perUnita) / 1000;
      const metriCubiMese = mese === null ? null : (mese * perUnita) / 1000;
      return {
        entity: lettura.entity,
        oggi,
        ieri: converti(dati.ieri),
        mese,
        meseScorso: converti(dati.meseScorso),
        costoOggi: quantoCosta(metriCubiOggi, lettura.prezzo),
        costoMese: quantoCosta(metriCubiMese, lettura.prezzo),
        kwhOggi: genere === "gas" ? kwhDelGas(metriCubiOggi, lettura.coefficiente) : null,
        kwhMese: genere === "gas" ? kwhDelGas(metriCubiMese, lettura.coefficiente) : null,
      };
    })
    .filter(Boolean);
  const campo = (nome) => somma(voci.map((voce) => voce[nome]));
  return {
    letture: suoi,
    /* Ogni contatore anche da solo: il semaforo ha una riga per contatore, e
     * scriverci il totale di tutti vorrebbe dire lo stesso numero due volte. */
    perContatore: Object.fromEntries(voci.map((voce) => [voce.entity, voce])),
    letto: voci.length > 0,
    oggi: campo("oggi"),
    ieri: campo("ieri"),
    mese: campo("mese"),
    meseScorso: campo("meseScorso"),
    costoOggi: campo("costoOggi"),
    costoMese: campo("costoMese"),
    kwhOggi: campo("kwhOggi"),
    kwhMese: campo("kwhMese"),
  };
}

/* Le righe della storia della portata, con in fondo lo stato di adesso.
 *
 * La storia è di qualche minuto fa; lo stato di adesso è di adesso. Se nel
 * frattempo la portata è cambiata, l'ultimo tratto comincia quando è cambiata,
 * e senza questa riga la storia direbbe ferma un'acqua che scorre da due
 * minuti — o peggio, che scorre ancora quella che si è appena fermata. */
function storiaConAdesso(storia, lettura) {
  const righe = Array.isArray(storia?.righe) ? [...storia.righe] : [];
  if (lettura.valore !== null) {
    const ultima = righe.reduce((a, b) => (b.quando > (a?.quando ?? -Infinity) ? b : a), null);
    const quando = Number.isFinite(lettura.da) ? lettura.da : (ultima?.quando ?? -Infinity);
    if (!ultima || quando >= ultima.quando) righe.push({ stato: String(lettura.valore), quando });
    else if (numero(ultima.stato) !== lettura.valore)
      righe.push({ stato: String(lettura.valore), quando: ultima.quando });
  }
  return righe;
}

/**
 * Come stanno i contatori di casa, tutti insieme: è quello che leggono la
 * pagina e la tessera in Home, e lo leggono dallo stesso posto perché una
 * perdita detta in rosso da una e taciuta dall'altra sarebbe peggio di
 * nessuna delle due.
 *
 * `dati` è quello che si è chiesto al Recorder — `consumi`, `ore`, `portata`,
 * `sale`, per entità — e può mancare in tutto o in parte: quello che non è
 * ancora arrivato resta `null`, e chi disegna lo dice come «—».
 */
export function comeStannoIContatori(
  letture = [],
  dati = {},
  { adesso = 0, qualcunoInCasa = null } = {},
) {
  const elenco = Array.isArray(letture) ? letture : [];
  const acqua = consumiDelGenere(elenco, dati?.consumi, "acqua");
  const gas = consumiDelGenere(elenco, dati?.consumi, "gas");

  const pressioni = elenco
    .filter((lettura) => lettura.genere === "pressione")
    .map((lettura) => {
      const minimo = lettura.minimo ?? FORCELLA_DELLA_PRESSIONE.minimo;
      const massimo = lettura.massimo ?? FORCELLA_DELLA_PRESSIONE.massimo;
      return {
        lettura,
        bar: lettura.bar,
        minimo,
        massimo,
        verdetto: giudizioDellaPressione(lettura.bar, { minimo, massimo }),
      };
    });

  const portate = elenco
    .filter((lettura) => lettura.genere === "portata")
    .map((lettura) => {
      const storia = dati?.portata?.[lettura.entity];
      /* Senza storia non si giudica: la portata di adesso dice se scorre, non
       * da quanto — e «da quanto» è tutta la differenza fra una doccia e una
       * perdita. */
      if (!storia || lettura.muto) return { lettura, scorre: undefined, perdita: null };
      const scorre = scorreDa(storiaConAdesso(storia, lettura), { adesso, da: storia.da });
      return { lettura, scorre, perdita: giudizioDellaPerdita(scorre, { adesso }) };
    });

  const sali = elenco
    .filter((lettura) => lettura.genere === "sale")
    .map((lettura) => ({ lettura, ...comeStaIlSale(lettura, dati?.sale?.[lettura.entity]) }));

  /* La perdita: dalla portata, quando c'è un sensore di portata. Senza, dal
   * contatore — un giorno intero senza un'ora ferma — che vede meno ma vede. */
  let perdita = null;
  const dallaPortata = portate.find((voce) => voce.perdita?.perdita);
  if (dallaPortata)
    perdita = {
      tipo: "portata",
      lettura: dallaPortata.lettura,
      ore: dallaPortata.perdita.ore,
      certo: dallaPortata.perdita.certo,
    };
  else if (!portate.length) {
    const dalContatore = (acqua?.letture || []).find((lettura) =>
      nessunaOraFerma(dati?.ore?.[lettura.entity]),
    );
    if (dalContatore) perdita = { tipo: "contatore", lettura: dalContatore, ore: 24, certo: false };
  }

  const fuori = pressioni.find((voce) => voce.verdetto === "low" || voce.verdetto === "high");
  return {
    acqua,
    gas,
    pressioni,
    portate,
    sali,
    perdita,
    pressioneFuori: fuori || null,
    saleBasso: sali.some((voce) => voce.basso),
    nessunoInCasa: qualcunoInCasa === false,
    stato: perdita ? "perdita" : fuori ? "pressione" : "normale",
  };
}
