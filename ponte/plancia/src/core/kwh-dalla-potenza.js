/* I kilowattora di oggi e del mese, ricavati dalla potenza.
 *
 * «Giornaliera e Mensile hanno bisogno dei kWh: per un elettrodomestico che ha
 * solo la potenza, calcolali dalla storia.» Home Assistant tiene, per ogni
 * sensore di potenza, la media di ogni ora: un'ora a 1000 W di media sono 1
 * kWh. La somma delle medie dall'inizio del giorno — o del mese — e' l'energia
 * di quel periodo.
 *
 * Le ore che il Recorder non ha ancora chiuso non ci sono: il numero e' quello
 * fino all'ultima ora intera, e cresce ogni ora. Meglio un numero un poco
 * indietro che un trattino.
 *
 * E' puro: entrano le entita', il periodo e l'adesso, esce la domanda; entra
 * la risposta, escono i kilowattora.
 */

const pulito = (valore) => String(valore ?? "").trim();

const numero = (valore) => {
  if (valore === "" || valore == null) return null;
  const n = Number(String(valore).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** L'inizio del periodo, nell'ora di casa: mezzanotte di oggi, o il primo del mese. */
export function inizioDelPeriodo(periodo, adesso) {
  const inizio = new Date(Number(adesso));
  inizio.setHours(0, 0, 0, 0);
  if (periodo === "month") inizio.setDate(1);
  return inizio;
}

/** La domanda al Recorder: la media di ogni ora, dall'inizio del periodo ad adesso. */
export function domandaDeiKwhDallaPotenza(entita, periodo, adesso) {
  return {
    type: "recorder/statistics_during_period",
    start_time: inizioDelPeriodo(periodo, adesso).toISOString(),
    end_time: new Date(Number(adesso)).toISOString(),
    statistic_ids: [...new Set((entita || []).map(pulito).filter(Boolean))],
    period: "hour",
    types: ["mean"],
  };
}

/* Quanti watt vale un'unita' della potenza. */
function wattPerUnita(unita) {
  const scritta = pulito(unita).toLowerCase();
  if (scritta === "kw") return 1000;
  if (scritta === "mw") return 1000000;
  return 1;
}

/**
 * I kilowattora di un'entita' di potenza nel periodo della risposta: la somma
 * delle medie orarie. `null` se il Recorder non ha niente da dire su di lei.
 */
export function kwhDallaPotenza(risposta, entity, unita = "W") {
  const elenco = risposta?.[pulito(entity)];
  if (!Array.isArray(elenco) || !elenco.length) return null;
  const fattore = wattPerUnita(unita);
  let wattora = 0;
  let ore = 0;
  for (const voce of elenco) {
    const media = numero(voce?.mean);
    if (media === null) continue;
    /* Una potenza negativa e' un contatore montato al contrario o
     * un'immissione: in un consumo non entra. */
    wattora += Math.max(0, media) * fattore;
    ore += 1;
  }
  return ore ? wattora / 1000 : null;
}
