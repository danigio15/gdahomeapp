/* I due obiettivi del termostato: il caldo e il freddo.
 *
 * «Il termostato di Home Assistant mi vede le due mezze lune, da una parte
 * caldo e dall'altra freddo. Se lo inserisco nel clima tuo, invece, mi legge
 * solo la temperatura attuale, ma non mi gestisce il target.» Dal campo, con
 * le foto: dei termostati Zigbee che Home Assistant mostra con DUE numeri —
 * 22 e 40, la soglia sotto cui scaldare e quella sopra cui raffrescare — e che
 * nella card del Clima diventavano «--°», una barra senza pomello e un meno e
 * un piu' che non facevano niente.
 *
 * Il difetto era una supposizione: che un termostato abbia UN obiettivo, e che
 * stia in `temperature`. E' vero per quasi tutti, ma Home Assistant ne conosce
 * un secondo tipo. Chi dichiara il bit TARGET_TEMPERATURE_RANGE pubblica
 * `target_temp_low` e `target_temp_high` — e spesso `temperature` vuoto — e
 * accetta `climate.set_temperature` soltanto con TUTTI E DUE i numeri: mandargli
 * `temperature` da solo e' un errore, e mandargli un estremo solo pure.
 *
 * Qui c'e' la regola, scritta una volta per tutte le facce del clima — la card
 * della pagina, la sua finestra, la tessera della Home — e senza DOM ne'
 * servizi, cosi' si prova a tavolino:
 *
 * - quale dei due tipi e': chi ha un `temperature` vero e' a obiettivo singolo
 *   e resta esattamente com'era. Chi ha la coppia e non il singolo e' doppio.
 *   Chi ha tutti e tre — alcune integrazioni li pubblicano insieme — e'
 *   doppio solo in automatico (`heat_cool`, `auto`), dove i due estremi sono
 *   quelli che contano; in caldo o in freddo vale il singolo;
 * - quale si mostra: in caldo l'estremo basso, quello sotto cui scalda; in
 *   freddo l'alto; in automatico tutti e due — e da spento pure, come fa Home
 *   Assistant, perche' sono i numeri con cui ripartira';
 * - di quanto si muove: col passo dell'unita', dentro i suoi estremi, e senza
 *   mai far scavalcare un estremo dall'altro — il basso non sale sopra l'alto,
 *   che e' l'altra cosa che Home Assistant rifiuta.
 */

/* Il bit con cui Home Assistant dichiara la coppia
 * (`ClimateEntityFeature.TARGET_TEMPERATURE_RANGE`). Si espone per chi lo
 * vuole leggere; la scelta pero' la fanno i numeri presenti, non il bit: un
 * termostato che dichiara la coppia e la lascia vuota non ha niente da
 * mostrare, e uno che la pubblica senza dichiararla la comanda lo stesso. */
/** Il bit TARGET_TEMPERATURE: un obiettivo solo, in `temperature`. */
export const CLIMA_CON_UN_OBIETTIVO = 1;
export const CLIMA_CON_DUE_OBIETTIVI = 2;

/* Le modalita' in cui la coppia e' la verita' anche quando c'e' il singolo. */
const AUTOMATICHE = new Set(["heat_cool", "auto"]);

const pulito = (valore) =>
  String(valore ?? "")
    .trim()
    .toLowerCase();

/* `Number(null)` fa zero: un estremo che non c'e' non deve diventare zero
 * gradi, che sulla barra e' il pomello incollato al fondo. */
const numero = (valore) => {
  if (valore === null || valore === undefined || valore === "") return null;
  const dato = Number(valore);
  return Number.isFinite(dato) ? dato : null;
};

/* Gli errori dei numeri in virgola mobile si vedono: 21 + 0.1 + 0.2 finisce
 * scritto sulla card come 21.300000000000001. */
const arrotonda = (valore) => Math.round(valore * 1000) / 1000;

/**
 * Gli obiettivi di un termostato, letti dai suoi attributi e dalla modalita'.
 *
 * Torna sempre la stessa forma:
 * - `doppio`: se il termostato lavora con la coppia;
 * - `singolo`: l'obiettivo unico, `null` per chi e' doppio;
 * - `basso` e `alto`: i due estremi, `null` per chi e' singolo;
 * - `mostra`: cosa va in faccia a chi guarda — `singolo`, `basso`, `alto`,
 *   `entrambi`, o `nessuno` se non c'e' nessun numero da mostrare.
 */
export function obiettiviDelClima(attributi, modo = "") {
  const singolo = numero(attributi?.temperature);
  const basso = numero(attributi?.target_temp_low);
  const alto = numero(attributi?.target_temp_high);
  const coppia = basso !== null && alto !== null;
  const modalita = pulito(modo);
  /* «Si preferisce quello che c'e'»: con la coppia sola e' doppio, col
   * singolo solo e' singolo, e con tutti e tre decide la modalita'. */
  const doppio = coppia && (singolo === null || AUTOMATICHE.has(modalita));
  if (!doppio)
    return Object.freeze({
      doppio: false,
      singolo,
      basso: null,
      alto: null,
      mostra: singolo === null ? "nessuno" : "singolo",
    });
  return Object.freeze({
    doppio: true,
    singolo: null,
    basso,
    alto,
    mostra: modalita === "heat" ? "basso" : modalita === "cool" ? "alto" : "entrambi",
  });
}

/**
 * E' un termostato a coppia? Cioe': va nella linguetta «Termostato», e non in
 * Caldo o in Freddo.
 *
 * «I termostati che fanno sia il caldo che il freddo, con i due numeri, non li
 * voglio dentro Caldo e Freddo: voglio una linguetta loro.» Un termostato che
 * scalda sotto i 22 e raffresca sopra i 40 non e' ne' un termosifone ne' un
 * condizionatore, e messo in una delle due linguette costringeva a scegliere
 * quale dei due numeri muovere. Nella sua linguetta i due numeri stanno
 * insieme, ognuno col suo meno e il suo piu'.
 *
 * E' a coppia chi dice di esserlo in uno di tre modi:
 * - pubblica `target_temp_low` o `target_temp_high` con un numero dentro;
 * - dichiara il bit TARGET_TEMPERATURE_RANGE in `supported_features`;
 * - fra le modalita' ha `heat_cool`, che per Home Assistant vuol dire proprio
 *   «scalda e raffresca dentro un intervallo».
 *
 * L'ultima ha due eccezioni, ed e' voluta: parecchi condizionatori elencano
 * `heat_cool` come il loro «automatico» e hanno un obiettivo solo, in
 * `temperature`. Quelli restano in Freddo e in Caldo come sono sempre stati —
 * spostarli in una linguetta coi due numeri vorrebbe dire due meno e due piu'
 * che non comandano niente. Chi ha il numero solo e nessun altro segno della
 * coppia e' a obiettivo singolo, `heat_cool` o no. E il numero solo vuoto
 * (`temperature: null`) e' un condizionatore spento, non una coppia: Home
 * Assistant `temperature` lo scrive per chi ha l'obiettivo singolo, anche
 * vuoto, e non lo scrive per chi ha solo l'intervallo.
 */
export function eUnTermostatoACoppia(attributi) {
  if (!attributi || typeof attributi !== "object") return false;
  if (numero(attributi.target_temp_low) !== null || numero(attributi.target_temp_high) !== null)
    return true;
  const dichiarate = Number(attributi.supported_features);
  /* Chi dichiara anche l'obiettivo singolo e ha i due numeri vuoti e' un
   * condizionatore, non una coppia. Dal campo, ancora: «non ho alcun
   * termostato configurato», e il condizionatore della camera da letto,
   * spento, finiva nella linguetta Termostato coi due numeri a «--». Tanti
   * condizionatori dichiarano tutte e due le cose; la coppia la fa chi ha i
   * due numeri davvero (qui sopra), o chi l'obiettivo singolo non ce l'ha. */
  const haIlSingolo =
    Number.isFinite(dichiarate) && (dichiarate & CLIMA_CON_UN_OBIETTIVO) === CLIMA_CON_UN_OBIETTIVO;
  if (haIlSingolo) return false;
  if (
    Number.isFinite(dichiarate) &&
    (dichiarate & CLIMA_CON_DUE_OBIETTIVI) === CLIMA_CON_DUE_OBIETTIVI
  )
    return true;
  const modi = Array.isArray(attributi.hvac_modes) ? attributi.hvac_modes.map(pulito) : [];
  /* `temperature` che c'e' ma e' vuoto non e' «nessun obiettivo singolo»: e'
   * il condizionatore spento, che il numero non lo pubblica finche' non si
   * accende. «Mi compare il termostato ma non lo tengo configurato»: un
   * condizionatore spento con `heat_cool` fra le modalita' finiva nella
   * linguetta Termostato. Conta solo chi `temperature` non ce l'ha proprio. */
  return modi.includes("heat_cool") && !("temperature" in attributi);
}

/**
 * I due numeri di un termostato a coppia, qualunque sia la modalita'.
 *
 * `obiettiviDelClima` sceglie cosa mostrare secondo la modalita' — in caldo il
 * basso soltanto — perche' serve a chi ha posto per un numero solo. La card
 * della linguetta «Termostato» ha posto per tutti e due, sempre: «Caldo 22°»
 * e «Freddo 40°», ognuno col suo meno e il suo piu'. Qui la lettura e' quella
 * della coppia intera, nella stessa forma di `obiettiviDelClima` (`doppio`
 * vero, `mostra` «entrambi»), cosi' `coppiaSpostata` e `coppiaCon` la prendono
 * cosi' com'e'.
 *
 * `null` se i due numeri non ci sono tutti e due: senza l'altro estremo non si
 * puo' mandare la coppia, e Home Assistant un estremo solo lo rifiuta.
 */
export function coppiaDelTermostato(attributi) {
  const basso = numero(attributi?.target_temp_low);
  const alto = numero(attributi?.target_temp_high);
  if (basso === null || alto === null) return null;
  return Object.freeze({ doppio: true, singolo: null, basso, alto, mostra: "entrambi" });
}

/**
 * Il numero solo, dove ce ne sta uno solo: il singolo, o l'estremo che la
 * modalita' rende quello vero. In automatico non c'e' un numero solo che sia
 * onesto, e la risposta e' `null` — chi ha posto per uno scrive la coppia con
 * `obiettiviScritti`, o niente.
 */
export function obiettivoMostrato(lettura) {
  if (!lettura) return null;
  if (lettura.mostra === "singolo") return lettura.singolo;
  if (lettura.mostra === "basso") return lettura.basso;
  if (lettura.mostra === "alto") return lettura.alto;
  return null;
}

/**
 * Gli obiettivi scritti in una riga: «22°» o «22° – 40°».
 *
 * `scrivi` trasforma il numero nel testo — chi chiama sa se vuole la virgola
 * o il punto, uno o nessun decimale. Senza numeri la riga e' vuota.
 */
export function obiettiviScritti(lettura, scrivi = (valore) => String(valore)) {
  if (!lettura) return "";
  if (lettura.mostra === "entrambi") return `${scrivi(lettura.basso)}° – ${scrivi(lettura.alto)}°`;
  const solo = obiettivoMostrato(lettura);
  return solo === null ? "" : `${scrivi(solo)}°`;
}

/**
 * Quale estremo si sceglie da se', quando nessuno l'ha scelto.
 *
 * Prima quello che il termostato sta facendo — se scalda, il basso; se
 * raffresca, l'alto — e poi la zona da cui lo si guarda: dal Caldo si pensa a
 * scaldare, dal Freddo a raffrescare.
 */
export function estremoDiPartenza({ azione = "", zona = "" } = {}) {
  const fa = pulito(azione);
  if (fa === "heating") return "basso";
  if (fa === "cooling") return "alto";
  return pulito(zona) === "caldo" ? "basso" : "alto";
}

/**
 * Quale obiettivo muovono il meno e il piu'.
 *
 * Il singolo per chi e' singolo; l'estremo che la modalita' mostra, in caldo e
 * in freddo; in automatico (e da spento) quello scelto da chi guarda, e se non
 * ha scelto niente quello di partenza. `null` se non c'e' niente da muovere.
 */
export function obiettivoDaMuovere(lettura, scelta = "", partenza = "alto") {
  if (!lettura || lettura.mostra === "nessuno") return null;
  if (!lettura.doppio) return "singolo";
  if (lettura.mostra === "basso" || lettura.mostra === "alto") return lettura.mostra;
  if (scelta === "basso" || scelta === "alto") return scelta;
  return partenza === "basso" ? "basso" : "alto";
}

/**
 * La coppia con un estremo portato a `valore`: i due numeri da mandare a
 * `climate.set_temperature`, che li vuole insieme.
 *
 * `scala` sono gli estremi che l'unita' accetta (`[min, max]`, o niente se non
 * li dichiara): il numero si ferma li'. E si ferma anche contro l'altro
 * estremo — il basso non sale sopra l'alto, l'alto non scende sotto il basso —
 * invece di spingerlo: chi alza il caldo non ha chiesto di toccare il freddo.
 *
 * `null` se non cambia niente: un tasto a fine corsa non manda niente.
 */
export function coppiaCon(lettura, quale, valore, { scala = null } = {}) {
  if (!lettura?.doppio || (quale !== "basso" && quale !== "alto")) return null;
  let voluto = numero(valore);
  if (voluto === null) return null;
  const minimo = numero(Array.isArray(scala) ? scala[0] : null);
  const massimo = numero(Array.isArray(scala) ? scala[1] : null);
  if (minimo !== null) voluto = Math.max(minimo, voluto);
  if (massimo !== null) voluto = Math.min(massimo, voluto);
  voluto = quale === "basso" ? Math.min(voluto, lettura.alto) : Math.max(voluto, lettura.basso);
  voluto = arrotonda(voluto);
  if (voluto === lettura[quale]) return null;
  return {
    target_temp_low: quale === "basso" ? voluto : lettura.basso,
    target_temp_high: quale === "alto" ? voluto : lettura.alto,
  };
}

/**
 * La coppia con un estremo spostato di un passo, in su (`verso` positivo) o in
 * giu'.
 *
 * Il passo e' quello dell'unita'. La griglia parte dal minimo dichiarato,
 * come sulla barra del Clima: su una scala che comincia a 4 col mezzo grado i
 * gradi buoni sono 4, 4,5, 5 — e un estremo fermo su un valore fuori griglia
 * va al primo buono nel verso chiesto, non lo scavalca.
 */
export function coppiaSpostata(lettura, quale, verso, { passo = 1, scala = null } = {}) {
  const direzione = Math.sign(Number(verso) || 0);
  if (!direzione || !lettura?.doppio || (quale !== "basso" && quale !== "alto")) return null;
  const ora = lettura[quale];
  const salto = Number(passo) > 0 ? Number(passo) : 1;
  const origine = numero(Array.isArray(scala) ? scala[0] : null) ?? 0;
  const passi = (ora - origine) / salto;
  /* Gia' sulla griglia: un passo intero. Fuori: il primo punto buono nel
   * verso chiesto. Il margine assorbe la virgola mobile di 0,1 + 0,2. */
  const sullaGriglia = Math.abs(passi - Math.round(passi)) < 1e-6;
  const prossimo = sullaGriglia
    ? Math.round(passi) + direzione
    : direzione > 0
      ? Math.ceil(passi)
      : Math.floor(passi);
  return coppiaCon(lettura, quale, origine + prossimo * salto, { scala });
}
