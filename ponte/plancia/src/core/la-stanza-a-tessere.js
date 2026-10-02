/* La stanza come una tavola di comandi (#160).
 *
 * «Non trovo utile questa sezione così com'è… è l'unica parte che uso ancora
 * della mia plancia vecchia.»
 *
 * La pagina di una stanza era un elenco: un titolo per ogni tipo di cosa, e
 * sotto le righe. Si leggeva bene e si comandava male — la luce aveva la sua
 * levetta, ma la tapparella e il condizionatore erano una riga che portava da
 * un'altra parte, e per alzare di un grado bisognava uscire dalla stanza. La
 * plancia vecchia faceva il contrario: una stanza era una tavola di tessere,
 * ognuna col suo comando addosso, e la si usava per quello.
 *
 * Qui stanno le decisioni della tavola, quelle che non hanno bisogno di un
 * documento: in che ordine vengono le tessere, quali sono larghe il doppio, che
 * cosa dice di se' il clima della stanza nella sua testata, a che punto e' una
 * tapparella, e quale delle due viste ha scelto chi guarda. Le parole e il
 * disegno li mette la sezione; qui si decide soltanto.
 */

import { posizioneSecondoVerso, statoSecondoVerso } from "./verso-aperture.js";

const clean = (value) => String(value ?? "").trim();

/* La scelta fra le due viste sta in una casella sua.
 *
 * E' una preferenza della casa e non del vetro: chi si e' tenuto le righe le
 * vuole sul telefono come sul tablet appeso in cucina, e una vista che cambia
 * a seconda di dove la si guarda sembrerebbe un errore. */
export const CHIAVE_VISTA_STANZA = "cd_stanze_vista";
export const VISTA_TESSERE = "tessere";
export const VISTA_RIGHE = "righe";

/**
 * La vista scelta, comunque sia scritta la casella.
 *
 * Le tessere sono la vista di serie: una casella vuota, sporca o scritta da
 * una versione che non la conosceva vuol dire tessere. Le righe si hanno solo
 * chiedendole.
 */
export function vistaDellaStanza(valore) {
  return clean(valore).toLowerCase() === VISTA_RIGHE ? VISTA_RIGHE : VISTA_TESSERE;
}

/* L'ordine delle tessere non e' quello delle righe.
 *
 * Le righe si leggono dall'alto in basso, e cominciano dal clima perche' e' la
 * prima cosa che si sente entrando. Una tavola si guarda tutta insieme, e
 * comincia da quello che si tocca di piu': le luci, poi la finestra, poi il
 * clima — che e' largo il doppio e chiude la riga — e dietro il resto. Quello
 * che non ha un comando suo sta in fondo, dove una tavola tiene le cose da
 * leggere. */
export const ORDINE_DELLE_TESSERE = Object.freeze([
  "luci",
  "coperture",
  "clima",
  "prese",
  "media",
  "elettrodomestici",
  "carichi",
  "robot",
  "irrigazione",
  "telecamere",
  "altro",
]);

/* Il clima e la musica hanno bisogno di spazio: il numero grande coi suoi tre
 * tasti, i tasti del lettore col brano sopra. In una colonna sola si
 * schiaccerebbero, e prendono due posti. */
export const TESSERE_LARGHE = Object.freeze(["clima", "media"]);

/** Se una tessera di quel blocco occupa due colonne. */
export function tesseraLarga(chiave) {
  return TESSERE_LARGHE.includes(clean(chiave));
}

/**
 * I blocchi della stanza nell'ordine della tavola, senza quelli vuoti.
 *
 * Un blocco che la tabella non conosce non si butta: va in coda, nell'ordine
 * in cui e' arrivato. Una cosa nuova che la stanza impara a contenere deve
 * comparire anche prima che qualcuno si ricordi di dirle dove.
 */
export function blocchiDellaTavola(pagina = null) {
  const blocchi = (Array.isArray(pagina?.blocchi) ? pagina.blocchi : []).filter(
    (blocco) => Array.isArray(blocco?.voci) && blocco.voci.length,
  );
  const posto = (blocco) => {
    const indice = ORDINE_DELLE_TESSERE.indexOf(clean(blocco.key));
    return indice < 0 ? ORDINE_DELLE_TESSERE.length : indice;
  };
  return blocchi
    .map((blocco, arrivo) => ({ blocco, arrivo }))
    .sort((a, b) => posto(a.blocco) - posto(b.blocco) || a.arrivo - b.arrivo)
    .map(({ blocco }) => blocco);
}

const numero = (valore) => {
  const n = Number.parseFloat(clean(valore).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const ACCESO = /^(heat|cool|auto|dry|fan_only|heat_cool)$/i;

/**
 * Il clima della stanza, per la sua testata.
 *
 * Una stanza puo' avere un condizionatore e il termostato dei termosifoni. La
 * testata ha posto per un numero solo, e dice quello della macchina che sta
 * lavorando adesso — se ne lavora una — altrimenti quello della prima. Una
 * macchina che non risponde non dice niente: un numero vecchio in grande
 * sarebbe la bugia piu' visibile della pagina.
 */
export function climaDellaStanza(entita = [], states = {}) {
  const elenco = (Array.isArray(entita) ? entita : []).map(clean).filter(Boolean);
  const vivi = elenco.filter((entity) => {
    const stato = clean(states?.[entity]?.state).toLowerCase();
    return stato && stato !== "unavailable" && stato !== "unknown";
  });
  if (!vivi.length) return null;
  const scelta = vivi.find((entity) => ACCESO.test(clean(states?.[entity]?.state))) || vivi[0];
  const stato = clean(states?.[scelta]?.state).toLowerCase();
  const attributi = states?.[scelta]?.attributes || {};
  return {
    entity: scelta,
    modo: stato,
    acceso: ACCESO.test(stato),
    obiettivo: numero(attributi.temperature),
    ambiente: numero(attributi.current_temperature),
  };
}

/**
 * A che punto e' una tapparella, e in che verso sta andando.
 *
 * `posizione` va da 0 (chiusa) a 100 (aperta). La dice l'attributo, quando
 * c'e'; senza, «open» e «closed» bastano a dire i due estremi, e quello che sta
 * in mezzo — si sta muovendo, non risponde — non ha una posizione, e non se ne
 * inventa una.
 *
 * `invertita` e' la spunta della riga (#244, #353): la tapparella montata al
 * contrario dichiara 100 quando e' giu', e la parola che dice va girata con lo
 * stesso verso. Le due traduzioni sono quelle della pagina Tapparelle, non una
 * copia: una tessera che dicesse «aperta» dove la sua pagina dice «chiusa»
 * sarebbe peggio di nessuna tessera.
 *
 * `stato` e' una parola sola fra `aperta`, `chiusa`, `socchiusa`, `sale`,
 * `scende` e `muta`: le parole vere le mette chi disegna.
 */
export function comeStaLaCopertura(stato = null, { invertita = false } = {}) {
  const parola = statoSecondoVerso(stato?.state, invertita);
  const dichiarata = posizioneSecondoVerso(numero(stato?.attributes?.current_position), invertita);
  const posizione =
    dichiarata !== null
      ? Math.round(dichiarata)
      : parola === "open" || parola === "on"
        ? 100
        : parola === "closed" || parola === "off"
          ? 0
          : null;
  if (parola === "opening") return { posizione, stato: "sale" };
  if (parola === "closing") return { posizione, stato: "scende" };
  if (posizione === null) return { posizione, stato: "muta" };
  if (posizione >= 100) return { posizione, stato: "aperta" };
  if (posizione <= 0) return { posizione, stato: "chiusa" };
  return { posizione, stato: "socchiusa" };
}
