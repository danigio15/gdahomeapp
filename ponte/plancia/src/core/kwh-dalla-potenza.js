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

/* ── quando le medie orarie non ci sono ──────────────────────────────────
 *
 * «Continua a dare problema, esce ancora il —»: il cerchio del Locale tecnico
 * restava col trattino mentre i suoi vicini contavano. Dentro c'era un
 * apparecchio con la sola potenza, ma un sensore di potenza fatto a mano — un
 * template, la presa del server — spesso non dichiara `state_class:
 * measurement`, e senza quella Home Assistant le medie orarie non le compila:
 * la domanda tornava vuota e il cerchio restava senza numero per sempre.
 *
 * La storia degli stati invece c'e' per qualunque sensore che il Recorder
 * registra. Da li' i kilowattora si contano lo stesso: la potenza tenuta fra
 * un cambio e l'altro, per il tempo che e' durata. E per un contatore di
 * energia — un totale senza statistiche, un giornaliero che all'avvio e'
 * «unavailable» — la crescita dall'inizio del periodo. */

/** La domanda della storia: tutti i cambi dall'inizio del periodo ad adesso. */
export function domandaDellaStoria(entita, periodo, adesso) {
  return {
    type: "history/history_during_period",
    start_time: inizioDelPeriodo(periodo, adesso).toISOString(),
    end_time: new Date(Number(adesso)).toISOString(),
    entity_ids: [...new Set((entita || []).map(pulito).filter(Boolean))],
    include_start_time_state: true,
    significant_changes_only: false,
    minimal_response: true,
    no_attributes: true,
  };
}

/* Un istante della storia in millisecondi: Home Assistant scrive i secondi
 * (`lu`, `lc`) nella forma compatta, e le date ISO in quella lunga. */
function istante(valore) {
  if (typeof valore === "number") return valore < 1e12 ? valore * 1000 : valore;
  const letto = Date.parse(pulito(valore));
  return Number.isFinite(letto) ? letto : null;
}

/** Le righe della storia di un'entita', in ordine: `{ quando, valore }`. */
export function righeDellaStoria(risposta, entity) {
  const elenco = risposta?.[pulito(entity)];
  if (!Array.isArray(elenco)) return [];
  return elenco
    .map((voce) => ({
      quando: istante(voce?.lc ?? voce?.lu ?? voce?.last_changed ?? voce?.last_updated),
      valore: numero(voce?.s ?? voce?.state),
    }))
    .filter((riga) => riga.quando !== null)
    .sort((a, b) => a.quando - b.quando);
}

/**
 * I kilowattora di una potenza dalla sua storia: ogni valore vale fino al
 * cambio dopo (l'ultimo fino ad adesso). Un tratto senza numero —
 * «unavailable» — non conta. `null` se nella storia non c'e' nemmeno un
 * numero: li' non si sa, e non e' zero.
 */
export function kwhDallaStoriaDellaPotenza(risposta, entity, unita = "W", inizio, adesso) {
  const righe = righeDellaStoria(risposta, entity);
  if (!righe.some((riga) => riga.valore !== null)) return null;
  const fattore = wattPerUnita(unita);
  const da = Number(inizio);
  const a = Number(adesso);
  let wattora = 0;
  righe.forEach((riga, indice) => {
    if (riga.valore === null) return;
    const partenza = Number.isFinite(da) ? Math.max(riga.quando, da) : riga.quando;
    const fine = indice + 1 < righe.length ? righe[indice + 1].quando : a;
    if (!Number.isFinite(fine) || fine <= partenza) return;
    wattora += Math.max(0, riga.valore) * fattore * ((fine - partenza) / 3600000);
  });
  return wattora / 1000;
}

/* Quanti kilowattora vale un'unita' di energia. Senza unita' si assume il
 * kilowattora, come fa il resto della plancia. */
function kwhPerUnita(unita) {
  const scritta = pulito(unita).toLowerCase();
  if (scritta === "wh") return 0.001;
  if (scritta === "mwh") return 1000;
  return 1;
}

/**
 * I kilowattora di un contatore di energia dalla sua storia: la somma di
 * quanto e' cresciuto dall'inizio del periodo. Vale per un totale di vita e
 * per un giornaliero che si azzera a mezzanotte. Un calo forte — sotto un
 * decimo di dove era — e' un azzeramento, e quello che segna dopo e' consumo;
 * un calo piccolo e' un ritocco del sensore e non conta. Un contatore fermo
 * tutto il giorno ha consumato zero, ed e' un numero vero.
 */
export function kwhDallaStoriaDelContatore(risposta, entity, unita = "kWh") {
  const numeri = righeDellaStoria(risposta, entity)
    .map((riga) => riga.valore)
    .filter((valore) => valore !== null);
  if (!numeri.length) return null;
  let crescita = 0;
  let prima = numeri[0];
  for (const dopo of numeri.slice(1)) {
    /* Il ritocco all'indietro non sposta il punto di partenza: altrimenti la
     * risalita al numero di prima si conterebbe due volte. */
    const ritocco = dopo < prima && dopo > prima * 0.1;
    if (ritocco) continue;
    crescita += dopo >= prima ? dopo - prima : Math.max(0, dopo);
    prima = dopo;
  }
  return crescita * kwhPerUnita(unita);
}
