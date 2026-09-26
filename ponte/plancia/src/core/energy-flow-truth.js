/* Dove va davvero l'energia, dai quattro numeri che la plancia ha.
 *
 * La mappa dei flussi accendeva le linee guardando un numero alla volta:
 * «c'e' solare? allora solare → casa», «la batteria si carica? allora
 * solare → batteria». Ma i quattro numeri parlano INSIEME: di notte la rete
 * puo' alimentare casa E caricare la batteria — e la linea rete → batteria
 * non esisteva proprio — mentre di giorno il solare puo' finire tutto nella
 * batteria senza toccare casa, e la linea solare → casa restava accesa lo
 * stesso. Segnalato con i video alla mano: «il disegno mi indica che rete e
 * batteria stanno alimentando casa; in realta' rete alimenta casa e ricarica
 * batteria», «il solare mi carica la batteria, perche' vedo che va in casa?».
 *
 * Qui i tre numeri sorgente si spartiscono a cascata, con le convenzioni che
 * il runtime ha sempre usato: rete positiva = prelievo, batteria positiva =
 * scarica. Il solare copre prima la carica della batteria, poi l'immissione
 * dichiarata dal segno della rete, e cio' che resta e' suo verso casa; la
 * carica non coperta dal solare arriva dalla rete; la scarica va a casa, e
 * solo l'eventuale immissione non coperta dal solare esce dalla batteria
 * verso la rete. Nessun DOM: solo aritmetica, provabile a tavolino.
 */

/* Da che parte scrive il sensore (#434, #435).
 *
 * Qui sotto la convenzione e' una sola e non puo' che essere una: positivo =
 * scarica per la batteria, positivo = prelievo per la rete. Quella dei sensori
 * no. Un solo numero col segno lo pubblicano tutti — Huawei, SolarEdge,
 * Victron, Sofar, i template fatti in casa — e meta' lo scrivono positivo
 * quando la batteria si CARICA. Non c'e' modo di indovinarlo da un valore
 * solo: 800 W vuol dire «sta caricando» o «sta scaricando» a seconda di chi
 * l'ha scritto, e chi guarda vede le frecce all'incontrario.
 *
 * Quindi lo dice la casa, una volta sola, nella scheda Energia: «I valori
 * positivi sono». Il verso si applica dove l'entita' si risolve — in
 * `core/signed-energy.js` — e da li' in poi TUTTI leggono il numero gia'
 * girato: questa pagina, la tessera della Home e il guscio storico, che le
 * stesse linee le disegna leggendo lo stesso alias. Applicarlo qui sarebbe
 * stata una seconda mano sullo stesso segno, e una che il guscio non ha.
 *
 * Chi non tocca niente resta com'era: la convenzione di serie e' quella che la
 * plancia ha sempre usato.
 */

const positivo = (value) => (Number.isFinite(value) && value > 0 ? value : 0);

/**
 * I flussi per arco, in watt.
 *
 * @param {{solar?: number, grid?: number, battery?: number}} input
 *   `solar` ≥ 0; `grid` col segno (positivo = prelievo dalla rete);
 *   `battery` col segno (positivo = scarica verso casa).
 */
export function allocateSourceFlows({ solar = 0, grid = 0, battery = 0 } = {}) {
  const sole = positivo(Number(solar));
  const prelievo = positivo(Number(grid));
  const immissione = positivo(-Number(grid));
  const scarica = positivo(Number(battery));
  const carica = positivo(-Number(battery));

  const solarToBattery = Math.min(sole, carica);
  const resto = sole - solarToBattery;
  const solarToGrid = Math.min(resto, immissione);
  const solarToHome = resto - solarToGrid;
  const gridToBattery = Math.min(prelievo, carica - solarToBattery);
  const gridToHome = prelievo - gridToBattery;
  const batteryToGrid = Math.min(scarica, immissione - solarToGrid);
  const batteryToHome = scarica - batteryToGrid;

  return {
    solarToHome,
    solarToBattery,
    solarToGrid,
    gridToHome,
    gridToBattery,
    batteryToHome,
    batteryToGrid,
  };
}

/* Quando i quattro numeri non possono essere veri tutti insieme (#134).
 *
 * «Vedo tutto ma il flusso verso casa non va.» Il disegno era fedele: la
 * batteria diceva di caricarsi a 684 W, e con quell'ingresso le linee giuste
 * sono proprio quelle che si vedevano — il sole e la rete che riempiono la
 * batteria, e verso casa niente. Solo che entravano 24 W e ne uscivano 1346:
 * non e' una sfumatura, e' una cosa che non esiste. La plancia aveva in mano
 * tutto per accorgersene, e ha disegnato con sicurezza un quadro impossibile
 * lasciando chi guarda davanti a una casa che non riceve corrente mentre le
 * luci sono accese.
 *
 * ── Da che parte si guarda ───────────────────────────────────────────────
 *
 * Da una sola. Le perdite dell'inverter fanno uscire MENO di quello che
 * entra — il sei per cento e' normale, il dieci pure — e una casa che consuma
 * meno di quanto le arriva non ha niente da dichiarare. Il verso che non puo'
 * capitare e' l'altro: piu' roba che esce di quanta ne entra vuol dire
 * energia presa dal niente, e allora c'e' un numero girato.
 *
 * ── Perche' e' cosi' prudente ────────────────────────────────────────────
 *
 * Perche' un falso allarme qui e' peggio del difetto: chi legge «i conti non
 * tornano» su un impianto sano va a cercare un guasto che non c'e', ed e'
 * esattamente lo sbaglio che l'avviso delle statistiche ha gia' fatto una
 * volta. Tre guardie insieme, e passano solo i casi impossibili:
 *
 *   · **tutte e quattro dichiarate.** Un sensore che la casa ha e non ha
 *     dichiarato vale zero, e un fotovoltaico da duemila watt contato zero
 *     farebbe gridare un impianto sanissimo. Senza tutti e quattro i numeri
 *     non si sa abbastanza per dire niente, e non si dice niente — anche se
 *     vuol dire tacere sulle case senza batteria, che sono poi quelle dove
 *     questo difetto non puo' nascere;
 *   · **piu' del doppio.** Non una percentuale: il doppio. Fra le perdite
 *     vere e il rumore dei sensori non ci si arriva mai;
 *   · **e almeno trecento watt di scarto.** Il solo rapporto griderebbe su
 *     una casa ferma a due watt, dove tutto e' rumore.
 *
 * La quarta guardia non sta qui: e' chi disegna, che aspetta due letture di
 * fila prima di parlare. Una lavatrice che parte fa saltare il consumo di
 * casa prima che il contatore della rete se ne accorga, e per un istante i
 * conti non tornano davvero. E' la stessa prudenza dell'avviso delle
 * statistiche, per la stessa ragione.
 *
 * ── E si dice anche chi ──────────────────────────────────────────────────
 *
 * Un avviso che dice «non tornano» e basta lascia a chi legge tutto il
 * lavoro. Qui si gira un segno alla volta: se girandone uno il conto si
 * chiude, quello e' il sospettato, e chi guarda si puo' mandare alla casella
 * giusta invece che a cercare. Se non si chiude con nessuno dei due non si
 * accusa nessuno: dire il nome sbagliato e' peggio che non dirlo.
 */

/** Quanto arriva: il sole, quello che si preleva, quello che la batteria da'. */
const entraInCasa = ({ solar = 0, grid = 0, battery = 0 }) =>
  positivo(solar) + positivo(grid) + positivo(battery);

/** E quanto se ne va: quello che si consuma, quello che si immette, quello
 * che si mette da parte nella batteria. */
const esceDaCasa = ({ grid = 0, battery = 0, home = 0 }) =>
  positivo(home) + positivo(-grid) + positivo(-battery);

/** Oltre quante volte quello che entra non e' piu' una perdita ma un errore. */
export const QUANTE_VOLTE_TROPPO = 2;

/** E sotto quanti watt di scarto non vale la pena aprire bocca. */
export const SCARTO_CHE_CONTA_W = 300;

/* Il giudizio nudo, senza cercare colpevoli: serve anche a provare i segni
 * girati senza rientrare in se' stesso. */
function loSbilancio(letto) {
  const dentro = entraInCasa(letto);
  const fuori = esceDaCasa(letto);
  const manca = fuori - dentro;
  if (manca < SCARTO_CHE_CONTA_W) return null;
  if (fuori <= dentro * QUANTE_VOLTE_TROPPO) return null;
  return { entra: dentro, esce: fuori, manca };
}

/**
 * Se i quattro numeri si contraddicono, e chi e' il sospettato.
 *
 * @param {{solar?: number, grid?: number, battery?: number, home?: number}} letture
 *   coi versi di qui: rete positiva = prelievo, batteria positiva = scarica.
 *   Un numero che manca — la sorgente non dichiarata, il sensore muto — spegne
 *   il controllo: e' la prima delle tre guardie.
 * @returns {null | {entra: number, esce: number, manca: number, chi: string}}
 *   `chi` e' `"battery"`, `"grid"` o `""` quando non si sa.
 */
export function laQuadraturaNonTorna(letture = {}) {
  const quali = ["solar", "grid", "battery", "home"];
  /* Un numero vero, non una cosa che si converte in numero.
   *
   * `Number(null)` fa **zero**, e `null` e' esattamente cio' che torna la
   * lettura di un sensore muto (`potenzaViva`). Convertendo, un sensore zitto
   * per un attimo sarebbe diventato «zero watt», e zero watt dove c'erano
   * duemila e' proprio lo sbilancio che questo controllo va a cercare: la
   * guardia avrebbe fabbricato il falso allarme che deve impedire. Lo stesso
   * vale per la stringa vuota. */
  const letto = {};
  for (const quale of quali) {
    const valore = letture?.[quale];
    if (typeof valore !== "number" || !Number.isFinite(valore)) return null;
    letto[quale] = valore;
  }
  const sbilancio = loSbilancio(letto);
  if (!sbilancio) return null;
  const chi =
    ["battery", "grid"].find((quale) => !loSbilancio({ ...letto, [quale]: -letto[quale] })) ?? "";
  return { ...sbilancio, chi };
}

/* La bolla della batteria diceva il numero grezzo, segno compreso: «-201 W»
 * mentre carica. Il segno e' una convenzione del modello, non una cosa che si
 * legge su un pannello: si mostra la grandezza e il verso, con la freccia che
 * entra nella batteria quando si carica ed esce quando alimenta. */
export function batteryReadout(battery = 0, format = (watt) => `${Math.round(watt)} W`) {
  const value = Number(battery);
  if (!Number.isFinite(value) || value === 0) return null;
  return value < 0 ? `▼ ${format(-value)}` : `▲ ${format(value)}`;
}
