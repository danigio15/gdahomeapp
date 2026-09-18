/* Le stanze in plancia (#493).
 *
 * «Have the option to display a block on the home screen — like a widget or a
 * quick action — showing the rooms or areas of the house (such as the garden,
 * garage, etc.). It should also be possible to choose which rooms or areas
 * appear on the home screen.»
 *
 * Le stanze la plancia le ha già tutte: la loro pagina, le loro entità, la
 * loro icona. Quello che non aveva è il pezzo di casa da cui si guarda senza
 * aprire niente — una fila di stanze in plancia, con dentro la temperatura e
 * quante luci sono accese, e il tocco che porta nella stanza.
 *
 * Quali si vedono lo sceglie chi ha la casa, ed è la seconda metà della
 * richiesta: una casa di dodici stanze non le vuole tutte in plancia, ne vuole
 * tre — il giardino, il garage, la camera dei bambini.
 *
 * Questo modulo decide chi entra e cosa dice; niente DOM e niente Home
 * Assistant, così si prova senza un browser davanti.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** La casella del magazzino: l'elenco degli id delle stanze da mostrare. */
export const CHIAVE_STANZE_IN_PLANCIA = "cd_home_stanze";

/* Quante ce ne stanno: tutte quelle che si spuntano (#12).
 *
 * «Remove the limit of 8 room views on the home page, it must be unlimited.»
 *
 * Il tetto c'era per non far diventare la Home un elenco — e un elenco c'è
 * già, ed è la pagina delle Stanze. Ma proteggeva da una cosa che nessuno fa
 * per sbaglio: le stanze in plancia si scelgono una spunta per volta, quindi
 * per averne venti bisogna spuntarne venti, sapendo cosa si sta facendo. Un
 * limite che scatta solo quando qualcuno insiste non protegge nessuno: dice
 * di no a chi ha appena detto di sì, e — com'era prima — lo diceva in
 * silenzio, con la spunta che tornava indietro da sola.
 *
 * Chi ne mette molte se ne accorge da sé, perché le vede: la fila scorre, e la
 * plancia ha la sua diagnostica dei fotogrammi per chi vuole guardare il
 * prezzo. */

/** L'id con cui una stanza si riconosce, uguale a quello della sua pagina. */
export function idDellaStanza(stanza) {
  return pulito(stanza?.id) || pulito(stanza?.name);
}

/**
 * Le stanze scelte, nell'ordine in cui stanno nella configurazione delle
 * stanze — non in quello in cui sono state spuntate.
 *
 * È l'ordine che chi ha la casa ha già deciso una volta, e ritrovarlo diverso
 * in plancia vorrebbe dire due ordini da tenere a mente per la stessa cosa.
 * Un id che non esiste più — una stanza cancellata — sparisce da sé: non lo si
 * va a togliere dal magazzino, perché un elenco che si ripulisce da solo
 * mentre nessuno guarda è il modo in cui si perdono le configurazioni.
 */
export function stanzeInPlancia(scelte, stanze) {
  const volute = new Set(
    (Array.isArray(scelte) ? scelte : []).map((voce) => pulito(voce)).filter(Boolean),
  );
  if (!volute.size) return [];
  return (Array.isArray(stanze) ? stanze : [])
    .filter((stanza) => stanza && typeof stanza === "object")
    .filter((stanza) => volute.has(idDellaStanza(stanza)));
}

/** Se questa stanza è fra quelle scelte. */
export function laStanzaSiVede(scelte, stanza) {
  const id = idDellaStanza(stanza);
  if (!id) return false;
  return (Array.isArray(scelte) ? scelte : []).map((voce) => pulito(voce)).includes(id);
}

/**
 * L'elenco con una stanza accesa o spenta.
 *
 * Torna sempre un elenco nuovo: chi chiama lo scrive nel magazzino, e scrivere
 * l'oggetto che si è appena letto vuol dire non accorgersi del cambiamento.
 *
 * Le stanze di casa sono l'ultimo pezzo e si possono non passare: servivano a
 * contare il tetto su quelle vere, e il tetto non c'è più (#12). Il parametro
 * resta perché chi chiama lo passa ancora, e toglierlo sarebbe un cambio di
 * forma per niente.
 *
 * Gli id orfani restano scritti — ripulirli qui vorrebbe dire cancellare una
 * configurazione mentre nessuno guarda, che è la regola di `stanzeInPlancia` e
 * vale anche qui.
 */
export function conLaStanza(scelte, stanza, accesa, _stanze = null) {
  const id = idDellaStanza(stanza);
  const fila = (Array.isArray(scelte) ? scelte : []).map((voce) => pulito(voce)).filter(Boolean);
  if (!id) return fila;
  const senza = fila.filter((voce) => voce !== id);
  return accesa ? [...senza, id] : senza;
}
