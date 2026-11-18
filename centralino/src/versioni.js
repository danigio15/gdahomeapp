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

/* Le minime scritte qui, sotto le quali non si scende qualunque cosa dica
 * `VERSIONE_MINIMA_APP` sulla macchina.
 *
 * «Chi ha sia l'app vecchia sia l'add-on vecchio e passa da una sua VPN o
 * porta aperta»: con GdAHome Base li' non c'e' nessun nostro controllo. Ma
 * l'app, da settembre, chiede la minima al centralino all'avvio, tornando
 * davanti e ogni sei ore, e sotto si ferma finche' non la si aggiorna.
 *
 * Una per negozio, quella che ognuno ha gia' pubblicata per tutti: App
 * Store 1.19.0, Play Store 1.16.12. Le app di prima leggono solo `minima`,
 * uguale per tutti: e' la piu' bassa delle due, cosi' nessuno resta fermo
 * con un negozio che non ha ancora la versione da prendere. Le app dalla
 * 1.19.14 leggono quella del proprio negozio.
 *
 * Quando la 1.19.14 — che fa valere Base anche con l'add-on di prima — e'
 * nei negozi per tutti, si alzano tutte e due a 1191400. */
export const MINIME_DI_SERIE = Object.freeze({ ios: 1190000, android: 1161200 });
export const MINIMA_DI_SERIE = Math.min(MINIME_DI_SERIE.ios, MINIME_DI_SERIE.android);

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
export function leVersioni(minima, diSerie = MINIME_DI_SERIE) {
  const tutti = Math.max(
    versioneMinimaDa(minima),
    Math.min(diSerie.ios ?? 0, diSerie.android ?? 0),
  );
  return {
    gdahome: {
      minima: tutti,
      ios: Math.max(tutti, diSerie.ios ?? 0),
      android: Math.max(tutti, diSerie.android ?? 0),
    },
  };
}

/* La minima che vale davvero: quella della macchina, ma mai sotto quella
 * scritta qui ([MINIMA_DI_SERIE]). */
export function laMinimaCheVale(scritto, diSerie = MINIMA_DI_SERIE) {
  return Math.max(versioneMinimaDa(scritto), versioneMinimaDa(String(diSerie)));
}

/* Cinque minuti, per tutti: chi sta in mezzo lo puo' tenere, e nessuna
 * origine e' esclusa (l'app web lo legge da dove e' servita). */
export const INTESTAZIONI_DELLE_VERSIONI = Object.freeze({
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=300",
  "access-control-allow-origin": "*",
});
