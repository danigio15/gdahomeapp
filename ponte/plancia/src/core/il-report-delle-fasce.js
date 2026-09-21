/* Il report diviso per fascia oraria (#72).
 *
 * «Fai un report fatto bene, suddiviso sulle 3 fasce, che mostra andamento e
 * costi.»
 *
 * Quando le fasce sono nate qui si e' scritto che sul periodo potevano dare
 * solo una stima, perche' «la plancia sa quanti kWh sono passati, non in che
 * ore». Era una limitazione di chi scriveva, non una limitazione vera: il
 * Report chiede gia' a Home Assistant le statistiche ORA PER ORA — e' cosi'
 * che disegna l'andamento giornaliero — e se i kilowattora arrivano gia'
 * divisi per ora, ogni ora si mette nella sua fascia e il conto e' esatto.
 *
 * Esatto per le ore che ci sono. Il Recorder tiene il passo orario per un
 * pugno di giorni (`purge_keep_days`), e piu' indietro restano i totali del
 * giorno: quei kilowattora esistono nel totale del periodo ma non si sa in
 * che ora siano passati, e per quelli — e solo per quelli — si torna alla
 * media pesata sulle ore che ogni fascia copre. Il report dice quanta parte
 * e' l'una e quanta l'altra, invece di spacciare tutto per un conto.
 *
 * Qui non si legge niente: entrano le righe del Recorder, la configurazione
 * delle fasce e il totale del periodo; esce il report. Il giro alla rete lo fa
 * la sezione, come sempre.
 */

import {
  fasciaDelleOre,
  fasciaInVigore,
  leFasceValgono,
  normalizzaLeFasce,
  prezzoMedioDelleFasce,
} from "./fasce-della-tariffa.js";

const numero = (valore) => {
  const dato = Number(valore);
  return Number.isFinite(dato) ? dato : null;
};

/* Il momento di una riga, come lo scrive Home Assistant: `start` e' l'inizio
 * del secchiello, ed e' quello che dice in che fascia cade quell'ora. */
function quandoDellaRiga(riga) {
  const grezzo = riga?.start ?? riga?.end ?? riga?.last_updated ?? riga?.timestamp ?? null;
  const valore = typeof grezzo === "number" ? grezzo : Date.parse(grezzo);
  return Number.isFinite(valore) ? valore : null;
}

/**
 * I kilowattora di ogni ora.
 *
 * Le righe arrivano in due forme, e la differenza conta.
 *
 * Quando le chiede `statisticsWithGrowth` — ed e' la strada che prende la
 * sezione — ogni riga porta gia' `change`, cioe' i kilowattora di QUEL
 * secchiello: li ha contati `recorderBucketConsumptions`, che sa distinguere
 * una limatura del Recorder da un contatore ripartito da zero. Quel conto e'
 * migliore di qualunque sottrazione fatta qui, e la prima riga non si butta
 * perche' il suo riferimento e' l'ora prima del periodo, chiesta apposta.
 *
 * Quando invece arrivano crude dal Recorder portano solo `sum`, un totale che
 * sale: i kilowattora di un'ora sono la differenza con l'ora prima, e la PRIMA
 * riga e' il paletto da cui si comincia a misurare, non un'ora persa. Una
 * differenza negativa si butta — contatore azzerato o sostituito — perche'
 * contarla in negativo toglierebbe kilowattora a una fascia che invece li ha
 * consumati.
 *
 * La forma si riconosce dalle righe, non da un parametro: se `change` ce
 * l'hanno tutte, sono gia' contate.
 */
export function kwhPerOra(righe) {
  const tutte = (Array.isArray(righe) ? righe : [])
    .map((riga) => ({
      quando: quandoDellaRiga(riga),
      cresciuto: numero(riga?.change),
      somma: numero(riga?.sum),
    }))
    .filter((riga) => riga.quando !== null)
    .sort((una, altra) => una.quando - altra.quando);

  if (tutte.length && tutte.every((riga) => riga.cresciuto !== null))
    return tutte
      .filter((riga) => riga.cresciuto > 0)
      .map((riga) => ({ quando: riga.quando, kwh: riga.cresciuto }));

  const ordinate = tutte.filter((riga) => riga.somma !== null);
  const fuori = [];
  for (let indice = 1; indice < ordinate.length; indice += 1) {
    const kwh = ordinate[indice].somma - ordinate[indice - 1].somma;
    if (!(kwh > 0)) continue;
    fuori.push({ quando: ordinate[indice].quando, kwh });
  }
  return fuori;
}

/** Il giorno di un istante, come chiave: «2026-09-14», nell'ora della casa. */
export function giornoDi(quando) {
  const istante = new Date(quando);
  if (Number.isNaN(istante.getTime())) return "";
  const mese = String(istante.getMonth() + 1).padStart(2, "0");
  const giorno = String(istante.getDate()).padStart(2, "0");
  return `${istante.getFullYear()}-${mese}-${giorno}`;
}

function vuoto(quante) {
  return Array.from({ length: quante }, () => 0);
}

/**
 * Il report di un periodo, fascia per fascia.
 *
 * `righe` sono le statistiche orarie del contatore che conta i kilowattora
 * presi dalla rete; `totale` e' quanti ne sono passati in tutto il periodo,
 * che la sezione sa per un'altra strada. Quando le ore coprono tutto il
 * periodo i due numeri coincidono e il conto e' esatto; quando le ore sono
 * meno — il Recorder le ha buttate — la differenza si paga alla media pesata,
 * e il report la dichiara.
 *
 * `prezzoUnico` e' la tariffa di sempre: serve come ripiego per una fascia
 * senza prezzo, per la parte stimata, e per il confronto «quanto avrei speso
 * senza fasce», che e' la domanda vera dietro tutta questa storia.
 */
export function reportDelleFasce(righe, fasceSalvate, { prezzoUnico = 0, totale = null } = {}) {
  const config = normalizzaLeFasce(fasceSalvate);
  const quante = config.voci.length;
  const unico = Math.max(0, numero(prezzoUnico) || 0);
  if (!quante || !leFasceValgono(config)) return null;

  const prezzoDi = (indice) => {
    const suo = config.voci[indice]?.prezzo;
    return suo === null || suo === undefined ? unico : suo;
  };

  const ore = kwhPerOra(righe);
  const kwhPerFascia = vuoto(quante);
  const perGiorno = new Map();
  /* E il profilo della giornata: quanti kilowattora, e quanti euro, in ognuna
   * delle ventiquattro ore sommando tutte le volte che quell'ora e' passata
   * nel periodo. Risponde a «a che ora compro», che e' l'altra domanda dietro
   * le fasce: quella del costo si legge in bolletta, questa no. */
  const perOra = Array.from({ length: 24 }, () => ({ kwh: 0, euro: 0 }));
  let spiegati = 0;
  for (const ora of ore) {
    const quando = new Date(ora.quando);
    const quale = fasciaInVigore(config, quando);
    if (quale < 0) continue;
    kwhPerFascia[quale] += ora.kwh;
    spiegati += ora.kwh;
    const giorno = giornoDi(ora.quando);
    if (!perGiorno.has(giorno)) perGiorno.set(giorno, vuoto(quante));
    perGiorno.get(giorno)[quale] += ora.kwh;
    /* L'ora del giorno prende il prezzo della fascia in cui quell'ora e'
     * passata DAVVERO, weekend compreso: la colonna delle 15 di un mese con
     * quattro sabati costa quanto e' costata, non quanto sarebbe costata se
     * fossero stati tutti mercoledi'. */
    const casella = perOra[quando.getHours()];
    if (!casella) continue;
    casella.kwh += ora.kwh;
    casella.euro += ora.kwh * prezzoDi(quale);
  }

  /* I kilowattora che il periodo ha ma le ore non spiegano.
   *
   * Non e' un errore: e' il Recorder che ha buttato il passo orario e tiene
   * solo i totali del giorno. Si pagano alla media pesata sulle ore, che e' la
   * stima che non favorisce nessuna ipotesi, e restano CONTATI A PARTE: chi
   * legge deve sapere quanta parte del numero e' misurata. */
  const tutti = numero(totale);
  const scoperti = tutti === null ? 0 : Math.max(0, tutti - spiegati);
  const mediaPesata = prezzoMedioDelleFasce(config, unico);

  const euroSpiegati = kwhPerFascia.reduce(
    (somma, kwh, indice) => somma + kwh * prezzoDi(indice),
    0,
  );
  const euroScoperti = scoperti * mediaPesata;
  const kwh = spiegati + scoperti;
  const euro = euroSpiegati + euroScoperti;

  const giorni = [...perGiorno.entries()]
    .sort((uno, due) => (uno[0] < due[0] ? -1 : 1))
    .map(([giorno, per]) => ({ giorno, per, kwh: per.reduce((a, b) => a + b, 0) }));

  return {
    fasce: config.voci.map((voce, indice) => ({
      indice,
      dalle: voce.dalle,
      prezzo: prezzoDi(indice),
      /* Se il prezzo e' suo o e' il ripiego: una fascia senza numero non deve
       * sembrare una fascia che costa come tutte le altre per scelta. */
      suo: voce.prezzo !== null,
      kwh: kwhPerFascia[indice],
      euro: kwhPerFascia[indice] * prezzoDi(indice),
      quota: spiegati > 0 ? (kwhPerFascia[indice] / spiegati) * 100 : 0,
    })),
    giorni,
    /* Le ventiquattro ore, sempre tutte e ventiquattro e sempre in ordine:
     * chi disegna il profilo non deve rimettere a posto i buchi. La fascia e'
     * quella FERIALE di quell'ora — una colonna ha un colore solo, e il sabato
     * non puo' tingerla a meta' — mentre i kilowattora e gli euro sono quelli
     * veri, weekend compreso. */
    ore: perOra.map((casella, ora) => ({
      ora,
      kwh: casella.kwh,
      euro: casella.euro,
      fascia: fasciaDelleOre(config, ora * 60),
    })),
    kwh,
    euro,
    /* Il confronto che risponde alla domanda vera: le fasce mi convengono?
     * Si misura sugli stessi kilowattora, col prezzo unico che hai scritto
     * nella stessa scheda. Senza quel prezzo non c'e' confronto da fare —
     * `null`, e chi disegna non scrive la riga. */
    unico: unico > 0 ? { prezzo: unico, euro: kwh * unico } : null,
    risparmio: unico > 0 ? kwh * unico - euro : null,
    /* Quanta parte e' misurata ora per ora e quanta e' stimata. */
    misurato: { kwh: spiegati, euro: euroSpiegati },
    stimato: { kwh: scoperti, euro: euroScoperti, prezzo: mediaPesata },
    tuttoMisurato: scoperti <= 0.0005,
  };
}
