/* Il ciclo di un elettrodomestico: quando lavora, e quando ha finito davvero.
 *
 * «La lavatrice mi fa tanti mini cicli durante un lavaggio solo.» La
 * configurazione era: soglia in funzione 0,1 W, soglia standby 0,1 W, ritardo
 * di fine ciclo 5 minuti. Tre numeri, e tutti e tre giocavano contro:
 *
 * - una lavatrice a meta' programma sta ferma davvero — l'ammollo, il carico
 *   dell'acqua, la pausa prima della centrifuga — e la presa smart quei minuti
 *   li vede come zero watt. Cinque minuti di ritardo sono meno di quelle
 *   pause: la card diceva «finito» a meta' bucato, e al risveglio un ciclo
 *   nuovo;
 * - la card e il contatore dei cicli avevano due regole diverse — cinque
 *   minuti la prima, venti il secondo — e raccontavano due bucati diversi;
 * - 0,1 W in funzione e 0,1 W in standby non lasciano spazio allo standby: un
 *   display acceso basta a dire «in funzione».
 *
 * Qui la regola sta UNA volta, per la card, per il contatore dei cicli e per
 * chi cerca l'avvio nella storia: la sosta che non chiude un ciclo, i valori
 * consigliati per le macchine a ciclo, e i valori che si usano quando una
 * casella e' rimasta vuota. Un numero scritto da chi configura non si tocca
 * mai: si avvisa, e si propone.
 *
 * Il modulo e' puro.
 */
import { applianceVisualKey } from "./device-model.js";
import { PAUSA_DENTRO_UN_CICLO_MS } from "./quando-e-partito.js";

/* La sosta che non chiude un ciclo: scritta una volta, in `quando-e-partito`,
 * che e' il modulo senza dipendenze dei tre che la leggono. */
export { PAUSA_DENTRO_UN_CICLO_MS };

const MINUTO = 60 * 1000;

/* I valori di serie di chi non e' una macchina a ciclo: quelli di sempre. */
export const SOGLIA_IN_FUNZIONE_DI_SERIE = 5;
export const SOGLIA_STANDBY_DI_SERIE = 1;

/* Le macchine a ciclo e i loro numeri consigliati.
 *
 * 10 W in funzione: sopra qualunque display, sotto qualunque motore o
 * resistenza. 2 W di standby: il display acceso e la scheda in attesa. Il
 * ritardo e' la pausa piu' lunga che quel programma fa a zero watt: la
 * lavastoviglie e la lavasciuga asciugano senza consumare, l'asciugatrice si
 * ferma poco. */
export const VALORI_CONSIGLIATI = Object.freeze({
  lavatrice: Object.freeze({ inFunzione: 10, standby: 2, ritardo: 20 }),
  lavastoviglie: Object.freeze({ inFunzione: 10, standby: 2, ritardo: 30 }),
  asciugatrice: Object.freeze({ inFunzione: 10, standby: 2, ritardo: 15 }),
  lavasciuga: Object.freeze({ inFunzione: 10, standby: 2, ritardo: 30 }),
});

/* Sotto questa soglia la potenza «in funzione» non distingue un ciclo da un
 * display acceso. */
export const SOGLIA_IN_FUNZIONE_MINIMA = 1;

const pulito = (valore) => String(valore ?? "").trim();

/** Una casella vuota non e' zero: e' «non l'ho scritto». */
export function scritto(valore) {
  if (valore === null || valore === undefined || pulito(valore) === "") return null;
  const n = Number(String(valore).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/* La lavasciuga non sta nel catalogo dei disegni — si disegna come una
 * lavatrice — ma il suo ciclo e' quello di una lavatrice che poi asciuga, e
 * la si riconosce dalle parole con cui e' stata chiamata. */
const LAVASCIUGA = /lava[\s_-]*sciuga|washer[\s_-]*dryer/i;

/**
 * Che macchina a ciclo e': `lavatrice`, `lavastoviglie`, `asciugatrice`,
 * `lavasciuga`, oppure `""` se non e' una macchina a ciclo.
 */
export function tipoACiclo(device = {}) {
  const parole = [device?.visual_key, device?.device_type, device?.type, device?.icon, device?.name]
    .map(pulito)
    .join(" ");
  if (LAVASCIUGA.test(parole)) return "lavasciuga";
  let chiave = "";
  try {
    chiave = applianceVisualKey(device || {});
  } catch (_errore) {
    chiave = "";
  }
  return VALORI_CONSIGLIATI[chiave] ? chiave : "";
}

/** I valori consigliati per quel tipo, o `null` per chi non e' a ciclo. */
export function valoriConsigliati(tipo) {
  return VALORI_CONSIGLIATI[pulito(tipo)] || null;
}

/**
 * I tre numeri con cui si decide se la macchina lavora: quelli scritti, e per
 * le caselle vuote quelli consigliati per il suo tipo (o quelli di sempre).
 * `ritardo` e' in minuti, 0 se non c'e'.
 */
export function regoleDelLavoro(device = {}) {
  const consigliati = valoriConsigliati(tipoACiclo(device));
  const inFunzione =
    scritto(device?.threshold_run) ??
    scritto(device?.metadata?.threshold_run) ??
    consigliati?.inFunzione ??
    SOGLIA_IN_FUNZIONE_DI_SERIE;
  const standby =
    scritto(device?.threshold_standby) ??
    scritto(device?.metadata?.threshold_standby) ??
    consigliati?.standby ??
    SOGLIA_STANDBY_DI_SERIE;
  const ritardo = Math.max(0, scritto(device?.off_delay_minutes) ?? consigliati?.ritardo ?? 0);
  return { inFunzione, standby, ritardo, tipo: consigliati ? tipoACiclo(device) : "" };
}

/**
 * Per quanti minuti la card resta IN FUNZIONE dopo l'ultima potenza sopra
 * soglia.
 *
 * Per una macchina a ciclo letta dai watt non e' mai meno della sosta che il
 * contatore dei cicli lascia passare: se lo fosse, la card direbbe «finito» in
 * una pausa che il contatore considera ancora lo stesso bucato, e le due cose
 * racconterebbero due storie. Per tutti gli altri vale il ritardo scritto.
 */
export function trattenutaInMinuti(device = {}, { daiWatt = true } = {}) {
  const { ritardo, tipo } = regoleDelLavoro(device);
  if (tipo && daiWatt) return Math.max(ritardo, PAUSA_DENTRO_UN_CICLO_MS / MINUTO);
  return ritardo;
}

/**
 * Quanto puo' stare ferma quella macchina senza che il ciclo sia finito, in
 * millisecondi: la sosta di sempre, o il ritardo scritto se e' piu' lungo —
 * chi ha detto «la mia lavastoviglie asciuga mezz'ora» l'ha detto anche al
 * contatore.
 */
export function pausaDentroUnCiclo(device = {}) {
  const { ritardo } = regoleDelLavoro(device);
  return Math.max(PAUSA_DENTRO_UN_CICLO_MS, ritardo * MINUTO);
}

/**
 * Cosa non va nei numeri scritti nella scheda, per una macchina a ciclo.
 *
 * `valori` sono le caselle come stanno (stringhe, anche vuote). Una casella
 * vuota non e' un problema: li' si usano i consigliati. Torna l'elenco dei
 * problemi — `ritardo`, `inFunzione`, `standby` — vuoto se va tutto bene o se
 * la macchina non e' a ciclo.
 */
export function problemiDelCiclo(tipo, valori = {}) {
  const consigliati = valoriConsigliati(tipo);
  if (!consigliati) return [];
  const problemi = [];
  const ritardo = scritto(valori.off_delay_minutes);
  if (ritardo !== null && ritardo < consigliati.ritardo) problemi.push("ritardo");
  const inFunzione = scritto(valori.threshold_run);
  if (inFunzione !== null && inFunzione < SOGLIA_IN_FUNZIONE_MINIMA) problemi.push("inFunzione");
  const standby = scritto(valori.threshold_standby);
  const sogliaVera = inFunzione ?? consigliati.inFunzione;
  if (standby !== null && standby >= sogliaVera) problemi.push("standby");
  return problemi;
}
