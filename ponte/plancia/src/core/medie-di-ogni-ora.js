/* Le medie di ogni ora degli ultimi giorni, dal Recorder.
 *
 * Due cose di casa si guardano così: la terra di una pianta (#159), che si
 * asciuga un po' ogni giorno e torna bagnata quando la si innaffia, e l'acqua
 * di un acquario (#127), che evapora e torna su quando la si rabbocca. Tutte e
 * due scendono piano e risalgono di colpo, e per vedere il colpo e il passo
 * servono le medie di ogni ora: una al giorno lo annega, la storia grezza è
 * troppa.
 *
 * La domanda è `recorder/statistics_during_period`, al plurale: è quella che
 * il ponte e il pannello lasciano passare. Stava scritta dentro le piante; una
 * seconda copia per l'acquario sarebbe stata una seconda domanda che fra sei
 * mesi non chiede più la stessa cosa.
 *
 * È puro: entrano le entità e l'adesso, esce la domanda; entra la risposta,
 * esce la serie.
 */

const H = 3600000;

const pulito = (valore) => String(valore ?? "").trim();

const numero = (valore) => {
  if (valore === "" || valore == null) return null;
  const n = Number(String(valore).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** La domanda: la media di ogni ora, per `giorni` giorni fino ad adesso. */
export function domandaDelleMedieDiOgniOra(entita, adesso, { giorni = 10 } = {}) {
  const inizio = new Date(Number(adesso) - giorni * 24 * H);
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

/** Le medie di un'entità, `{ quando, valore }` a metà di ogni ora, dalla più vecchia. */
export function serieDelleMedieDiOgniOra(risposta, entity) {
  const elenco = risposta?.[pulito(entity)];
  return (Array.isArray(elenco) ? elenco : [])
    .map((voce) => ({ quando: inizioDelSecchiello(voce), valore: numero(voce?.mean) }))
    .filter((punto) => punto.quando !== null && punto.valore !== null)
    .map((punto) => ({ quando: punto.quando + H / 2, valore: punto.valore }))
    .sort((a, b) => a.quando - b.quando);
}
