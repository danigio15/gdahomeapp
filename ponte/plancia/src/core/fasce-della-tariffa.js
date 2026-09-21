/* Le fasce orarie della tariffa elettrica (#72).
 *
 * «Possibilita' di inserire prezzi diversi per fasce diverse, tipo 2 fasce
 * impostabili con orario o anche 3 fasce, con la possibilita' di scegliere se
 * 2 o 3 fasce.»
 *
 * Fino a qui il kWh aveva un prezzo solo. Per chi ha un contratto a fasce —
 * in Italia quasi tutti — quel numero e' una media inventata: la lavastoviglie
 * fatta partire alle undici di sera costa un terzo in meno di quella delle
 * quattro del pomeriggio, e una plancia che dice lo stesso euro in tutte e due
 * le ore sta dicendo il falso proprio nel momento in cui uno la guarda per
 * decidere.
 *
 * Qui non si legge nessuna entita' e non si guarda nessun orologio: entrano la
 * configurazione e l'istante, esce il prezzo. Chi chiama porta il suo orologio,
 * come dappertutto nel nucleo.
 *
 * ── Quello che questo modulo NON puo' sapere ──────────────────────────────
 *
 * Il prezzo di ADESSO e' esatto: si guarda che ora e', si legge la fascia. Il
 * costo di un PERIODO — la bolletta del mese, il report della settimana — non
 * lo e', e non puo' esserlo: la plancia sa quanti kWh sono passati, non in che
 * ore sono passati. Per saperlo servirebbero i contatori per fascia, che chi
 * li ha se li e' installati e chi non li ha non li ha.
 *
 * Allora il periodo si fa con la media delle fasce PESATA SULLE ORE che
 * ognuna copre, che e' la stima onesta: chi consuma uniformemente la trova
 * giusta, chi sposta tutto di notte la trova alta, e nessuno dei due la trova
 * spacciata per un conto esatto — la scheda lo dice a parole.
 */

const pulito = (valore) => String(valore ?? "").trim();

/* Dove stanno scritte. Il nome lo dichiara il modulo che sa cosa c'e' dentro —
 * come per le altre chiavi del nucleo — e a leggerlo e a scriverlo sono le
 * sezioni, che il deposito ce l'hanno in mano. */
export const CHIAVE_FASCE = "cd_fasce_kwh";

/** Quante fasce si possono avere. Zero vuol dire «una tariffa sola, come prima». */
export const QUANTE_FASCE = Object.freeze([0, 2, 3]);

/* L'orario piu' comune in Italia, che e' anche quello che sta scritto in
 * bolletta: F1 dalle 8 alle 19 nei giorni feriali, F2 le ore intorno, F3 la
 * notte e i festivi. Non si impone a nessuno — di serie le fasce sono spente —
 * ma chi le accende trova le caselle gia' piene di qualcosa di sensato invece
 * che di zeri. */
export const ORARI_DI_SERIE = Object.freeze({
  2: Object.freeze(["08:00", "19:00"]),
  3: Object.freeze(["08:00", "19:00", "23:00"]),
});

/** Mezzanotte e' 0, le 23:30 sono 1410. Fuori misura torna `null`. */
export function minutiDellOra(valore) {
  const testo = pulito(valore);
  const pezzi = /^(\d{1,2})(?::(\d{2}))?$/.exec(testo);
  if (!pezzi) return null;
  const ore = Number(pezzi[1]);
  const minuti = pezzi[2] === undefined ? 0 : Number(pezzi[2]);
  if (!Number.isInteger(ore) || ore < 0 || ore > 23) return null;
  if (!Number.isInteger(minuti) || minuti < 0 || minuti > 59) return null;
  return ore * 60 + minuti;
}

/** Il contrario: 510 si scrive «08:30». */
export function oraDeiMinuti(minuti) {
  const tutti = Number(minuti);
  if (!Number.isFinite(tutti)) return "";
  const dentro = ((Math.round(tutti) % 1440) + 1440) % 1440;
  return `${String(Math.floor(dentro / 60)).padStart(2, "0")}:${String(dentro % 60).padStart(2, "0")}`;
}

function prezzoPulito(valore) {
  const numero = Number(String(valore ?? "").replace(",", "."));
  /* Lo zero non vince, come per la tariffa unica: il salvataggio non lo scrive
   * mai apposta, e una fascia a zero euro farebbe sembrare gratis un'ora di
   * corrente. Torna `null`, e chi chiede il prezzo riceve quello di base. */
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

/**
 * La configurazione delle fasce, ripulita.
 *
 * Le voci escono SEMPRE in ordine di ora, qualunque ordine abbiano nelle
 * caselle: chi scrive prima le 19 e poi le 8 intende lo stesso orario, e
 * ordinarle qui vuol dire che il resto del modulo puo' fidarsi.
 */
export function normalizzaLeFasce(salvato) {
  const dato = salvato && typeof salvato === "object" && !Array.isArray(salvato) ? salvato : {};
  const quante = QUANTE_FASCE.includes(Number(dato.quante)) ? Number(dato.quante) : 0;
  const salvate = Array.isArray(dato.voci) ? dato.voci : [];
  const voci = [];
  for (let indice = 0; indice < quante; indice += 1) {
    const voce = salvate[indice] && typeof salvate[indice] === "object" ? salvate[indice] : {};
    const dalle = minutiDellOra(voce.dalle);
    voci.push({
      dalle: dalle === null ? minutiDellOra(ORARI_DI_SERIE[quante]?.[indice]) || 0 : dalle,
      prezzo: prezzoPulito(voce.prezzo),
    });
  }
  voci.sort((una, altra) => una.dalle - altra.dalle);
  /* Due fasce che cominciano alla stessa ora sono una fascia sola scritta due
   * volte: la seconda non comincerebbe mai. Si spostano di un minuto invece
   * di buttarle, cosi' chi ha sbagliato una casella la ritrova e la corregge
   * invece di vederla sparire. */
  for (let indice = 1; indice < voci.length; indice += 1)
    if (voci[indice].dalle <= voci[indice - 1].dalle)
      voci[indice].dalle = Math.min(1439, voci[indice - 1].dalle + 1);
  const festivi = Number(dato.festivi);
  return {
    quante,
    voci,
    /* Quale fascia vale il sabato e la domenica, quando ce n'e' una: in Italia
     * il weekend sta tutto in F3, e senza questa riga chi ha tre fasce si
     * troverebbe il sabato pomeriggio contato come un mercoledi'. Indice a
     * partire da zero, oppure -1 per «nessuna regola». */
    festivi: Number.isInteger(festivi) && festivi >= 0 && festivi < quante ? festivi : -1,
  };
}

/** Se le fasce sono accese e hanno almeno un prezzo da dire. */
export function leFasceValgono(config) {
  return Boolean(config?.quante) && (config.voci || []).some((voce) => voce.prezzo !== null);
}

/**
 * Quale fascia e' in vigore in quell'istante: l'indice, oppure -1.
 *
 * Prima di tutto il fine settimana, quando la regola c'e': sabato e domenica
 * l'ora non conta. Poi l'ora: vale l'ULTIMA fascia gia' cominciata, e prima
 * della prima si torna indietro all'ultima — la fascia della notte comincia la
 * sera e finisce la mattina dopo, e fra le due c'e' la mezzanotte.
 */
export function fasciaInVigore(config, adesso = new Date()) {
  const fasce = config && Array.isArray(config.voci) ? config : normalizzaLeFasce(config);
  if (!fasce.quante || !fasce.voci.length) return -1;
  const istante = adesso instanceof Date && !Number.isNaN(adesso.getTime()) ? adesso : new Date();
  const giorno = istante.getDay();
  if (fasce.festivi >= 0 && (giorno === 0 || giorno === 6)) return fasce.festivi;
  const minuti = istante.getHours() * 60 + istante.getMinutes();
  let scelta = fasce.voci.length - 1;
  for (let indice = 0; indice < fasce.voci.length; indice += 1)
    if (fasce.voci[indice].dalle <= minuti) scelta = indice;
  return scelta;
}

/**
 * Il prezzo di adesso: quello della fascia in vigore, o `ripiego`.
 *
 * `ripiego` e' il prezzo unico gia' risolto da chi chiama — un numero, o la
 * lettura di un'entita' — e resta la risposta quando le fasce sono spente o
 * quando la fascia in vigore la sua casella non ce l'ha piena. Nessuno resta
 * senza prezzo per una casella vuota.
 */
export function prezzoDellaFascia(config, ripiego, adesso = new Date()) {
  const fasce = config && Array.isArray(config.voci) ? config : normalizzaLeFasce(config);
  const quale = fasciaInVigore(fasce, adesso);
  if (quale < 0) return ripiego;
  const prezzo = fasce.voci[quale]?.prezzo;
  return prezzo === null || prezzo === undefined ? ripiego : prezzo;
}

/**
 * Il prezzo medio di un periodo: le fasce pesate sulle ore che coprono.
 *
 * E' una stima e non un conto, e sta scritto anche nella scheda. La plancia sa
 * quanti kWh sono passati, non in che ore: pesare ogni fascia per le ore che
 * dura e' il modo che non favorisce nessuna ipotesi — chi consuma uniformemente
 * la trova giusta, gli altri sanno da che parte sbaglia.
 *
 * Il fine settimana entra nel conto per quello che e', due giorni su sette:
 * senza, chi ha la regola dei festivi si troverebbe una media da giorni
 * feriali spacciata per media della settimana.
 */
export function prezzoMedioDelleFasce(config, ripiego) {
  const fasce = config && Array.isArray(config.voci) ? config : normalizzaLeFasce(config);
  if (!leFasceValgono(fasce)) return ripiego;
  const prezzo = (indice) => {
    const proprio = fasce.voci[indice]?.prezzo;
    return proprio === null || proprio === undefined ? Number(ripiego) || 0 : proprio;
  };
  /* Quante ore dura ognuna, in un giorno feriale: dalla sua ora a quella dopo,
   * e l'ultima arriva a mezzanotte piu' il pezzo prima della prima. */
  const minuti = fasce.voci.map((voce, indice) => {
    const dopo = fasce.voci[indice + 1];
    if (dopo) return dopo.dalle - voce.dalle;
    return 1440 - voce.dalle + fasce.voci[0].dalle;
  });
  const feriale =
    minuti.reduce((somma, quanti, indice) => somma + quanti * prezzo(indice), 0) / 1440;
  if (fasce.festivi < 0) return feriale;
  return (feriale * 5 + prezzo(fasce.festivi) * 2) / 7;
}
