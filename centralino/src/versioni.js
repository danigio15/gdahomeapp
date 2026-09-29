/* Le versioni: da quale numero in su un'app si puo' ancora usare.
 *
 *   GET /versioni   →   {"gdahome": {"minima": 1070000}}
 *
 * E' l'interruttore del giorno dei pagamenti (`docs/LICENZE.md`, «Il giorno
 * dei pagamenti: le app vecchie si fermano»). Le app della prova hanno tutto
 * aperto: il giorno che esce la versione pubblica, con i pagamenti, quelle
 * vanno fermate, se no chi le ha non paghera' mai. Il numero e' quello di
 * costruzione (`app/lib/versione.dart`, `costruzioneDiQuestApp`): un'app con
 * un numero piu' piccolo si ferma e chiede di essere aggiornata.
 *
 * **Di serie e' zero**, e zero non ferma niente.
 *
 * Il numero lo leggono due: l'app, che si copre da se' con la pagina
 * «aggiornala», e l'add-on, che rifiuta i telefoni che dichiarano un numero
 * piu' piccolo (o nessuno, come le app di oggi) con `aggiorna-l-app`.
 *
 * Non e' un segreto e non fa entrare nessuno: e' pubblico, lo puo' leggere
 * anche l'app nel browser da un'altra origine, e resta in memoria cinque
 * minuti — abbastanza da non far pagare una richiesta a ogni apertura, poco
 * abbastanza perche' il giorno che si cambia si veda subito.
 */

/* Quello che si legge dalla configurazione: un intero da zero in su. Tutto il
 * resto — vuoto, una parola, un numero negativo o con la virgola — vale zero,
 * cioe' «non si ferma nessuno»: sbagliare a scrivere questa riga non deve
 * spegnere le app di tutti. */
export function versioneMinimaDa(scritto) {
  const testo = String(scritto ?? "").trim();
  if (!/^\d{1,10}$/.test(testo)) return 0;
  const numero = Number(testo);
  return Number.isSafeInteger(numero) ? numero : 0;
}

/* Il corpo della risposta. Un oggetto per app, perche' un giorno potrebbe
 * servire anche a un'altra — gdanav — senza cambiare la forma. */
export function leVersioni(minima) {
  return { gdahome: { minima: versioneMinimaDa(minima) } };
}

/* Cinque minuti, per tutti: chi sta in mezzo lo puo' tenere, e nessuna
 * origine e' esclusa (l'app web lo legge da dove e' servita). */
export const INTESTAZIONI_DELLE_VERSIONI = Object.freeze({
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=300",
  "access-control-allow-origin": "*",
});
