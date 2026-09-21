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
 * ── Quello che questo modulo non sa, e chi lo sa ──────────────────────────
 *
 * Il prezzo di ADESSO e' esatto: si guarda che ora e', si legge la fascia. Il
 * costo di un PERIODO qui non lo e': entra un numero di kilowattora e basta,
 * e da quello si puo' solo fare la media delle fasce PESATA SULLE ORE che
 * ognuna copre — la stima che non favorisce nessuna ipotesi, e che chi la usa
 * dichiara a parole.
 *
 * Qui c'era scritto che quel costo NON POTEVA essere esatto, «perche' la
 * plancia sa quanti kWh sono passati, non in che ore». Era una limitazione di
 * chi scriveva, non una limitazione vera: il Recorder le ore le tiene, e
 * `il-report-delle-fasce.js` gliele chiede e mette ognuna nella sua fascia.
 * Dove le ore ci sono il conto e' esatto; dove il Recorder le ha buttate si
 * torna alla media pesata, e il report dice quanta parte e' l'una e quanta
 * l'altra.
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
  return fasciaDelleOre(fasce, istante.getHours() * 60 + istante.getMinutes());
}

/**
 * Quale fascia copre quel momento della GIORNATA, senza guardare che giorno e'.
 *
 * E' la meta' oraria della regola qui sopra, e serve da sola a chi parla di
 * un'ora e non di un istante — il profilo delle ventiquattro ore, che dice a
 * che ora si compra: li' «le 19» non sono ne' un mercoledi' ne' una domenica,
 * sono le 19 di tutto il mese.
 *
 * Vale l'ULTIMA fascia gia' cominciata, e prima della prima si torna indietro
 * all'ultima: la fascia della notte comincia la sera e finisce la mattina
 * dopo, e fra le due c'e' la mezzanotte.
 */
export function fasciaDelleOre(config, minuti) {
  const fasce = config && Array.isArray(config.voci) ? config : normalizzaLeFasce(config);
  if (!fasce.quante || !fasce.voci.length) return -1;
  const dentro = Number(minuti);
  if (!Number.isFinite(dentro)) return -1;
  let scelta = fasce.voci.length - 1;
  for (let indice = 0; indice < fasce.voci.length; indice += 1)
    if (fasce.voci[indice].dalle <= dentro) scelta = indice;
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

/* ── come si presenta una fascia ─────────────────────────────────────────── */

/* Le tinte, dalla piu' cara alla piu' economica.
 *
 * L'arancio e' quello di «Costo Reale» nel Report — la fascia di giorno e' la
 * spesa che quella casella racconta — e il blu cupo e' la notte. Con due fasce
 * si prendono i due estremi e non i primi due, cosi' «il blu e' quella che
 * costa meno» vale in tutti e due i casi invece di dipendere da quante sono.
 *
 * Il blu della notte e' scuro e non azzurro, ed e' una scelta e non un gusto:
 * nell'andamento giornaliero le colonne delle fasce stanno accanto alla linea
 * del consumo, che e' azzurra da sempre. Con l'azzurro chiaro la legenda
 * avrebbe avuto due pallini identici per due cose diverse — «Consumo» e «F3» —
 * ed e' il modo piu' rapido di far leggere un grafico al contrario.
 *
 * Stanno qui, con la regola che dice che ore sono, perche' una fascia si
 * riconosce dal colore prima che dal numero e la si incontra in tre posti: il
 * blocco del costo reale, le barre dell'andamento giornaliero e il profilo
 * delle ventiquattro ore. Tre tavolozze vorrebbero dire che la stessa fascia
 * cambia colore passando da una tessera all'altra della stessa schermata. */
export const TINTE_DELLE_FASCE = Object.freeze({
  2: Object.freeze(["#f97316", "#1d4ed8"]),
  3: Object.freeze(["#f97316", "#8b5cf6", "#1d4ed8"]),
});

export function tintaDellaFascia(quante, indice) {
  const scala = TINTE_DELLE_FASCE[quante] || TINTE_DELLE_FASCE[3];
  return scala[indice] || scala[scala.length - 1];
}

/** «F1», «F2», «F3» — il nome che sta scritto in bolletta. */
export function nomeDellaFascia(indice) {
  return `F${Number(indice) + 1}`;
}

/**
 * L'orario di una fascia, come si legge: «08:00–19:00».
 *
 * L'ultima arriva a quella dopo di lei, che e' la prima: e' la fascia che
 * attraversa la mezzanotte, e scriverla «23:00–24:00» sarebbe dire il falso
 * proprio sulla fascia che di solito dura di piu'.
 */
export function orarioDellaFascia(config, indice) {
  const voci = config?.voci || [];
  const suo = voci[indice];
  if (!suo) return "";
  const dopo = voci[indice + 1] || voci[0];
  return `${oraDeiMinuti(suo.dalle)}–${oraDeiMinuti(dopo.dalle)}`;
}
