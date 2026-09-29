/* Le azioni rapide, in gruppi (#139).
 *
 * «Utilizzando la plancia per tutto questo periodo ho notato la necessità di
 * poter avere una divisione delle azioni rapide in gruppi (tapparelle luci
 * clima…).»
 *
 * Il gruppo è una parola scritta accanto all'azione, non una struttura nuova:
 * chi non ne scrive nessuna resta com'è oggi — una fila sola, senza titoli. I
 * gruppi escono nell'ordine in cui compare la loro prima azione, e «Luci» e
 * «luci» sono lo stesso gruppo: il nome che si legge è quello scritto per primo.
 *
 * I tasti restano nell'ordine delle azioni. Tre moduli li riconoscono dalla
 * posizione — la tinta del vassoio, il motore delle icone, le copertine dei
 * lettori — e spostarli vorrebbe dire dare la copertina del Sonos al tasto
 * delle tapparelle. Quello che cambia è l'ordine in cui si vedono: un numero
 * per tasto e per titolo, che la griglia legge con `order`.
 *
 * Il modulo è puro: niente DOM, niente Home Assistant.
 */

const pulito = (valore) =>
  String(valore ?? "")
    .replace(/\s+/g, " ")
    .trim();

/** Quanto può essere lungo il nome di un gruppo: è un titolo, non una frase. */
export const LUNGHEZZA_DEL_GRUPPO = 24;

/** Il gruppo di un'azione, pulito; "" se non ne ha. */
export function gruppoDellAzione(azione) {
  return pulito(azione?.gruppo).slice(0, LUNGHEZZA_DEL_GRUPPO);
}

/** La chiave di un gruppo: lo stesso nome con le maiuscole o senza è lo stesso gruppo. */
export const chiaveDelGruppo = (nome) => pulito(nome).toLocaleLowerCase("it");

/**
 * Come si dividono le azioni.
 *
 * `acceso(azione, indice)` dice se un'azione è accesa — `true`, `false` o
 * `null` per chi uno stato non ce l'ha — e serve al conto nel titolo. Torna:
 *
 *  · `gruppi` — `[{ chiave, nome, indici, accese }]`, nell'ordine in cui
 *    compare la loro prima azione;
 *  · `senzaGruppo` — gli indici delle azioni senza gruppo;
 *  · `ordine` — `tasti[indice]` è il posto in cui si vede ogni azione,
 *    `titoli[chiave]` quello del titolo di ogni gruppo.
 *
 * Senza nessun gruppo `gruppi` è vuoto, e chi disegna non tocca niente.
 */
export function gruppiDelleAzioni(azioni = [], acceso = () => null) {
  const elenco = Array.isArray(azioni) ? azioni : [];
  const perChiave = new Map();
  const senzaGruppo = [];
  elenco.forEach((azione, indice) => {
    const nome = gruppoDellAzione(azione);
    if (!nome) {
      senzaGruppo.push(indice);
      return;
    }
    const chiave = chiaveDelGruppo(nome);
    if (!perChiave.has(chiave)) perChiave.set(chiave, { chiave, nome, indici: [], accese: 0 });
    const gruppo = perChiave.get(chiave);
    gruppo.indici.push(indice);
    if (acceso(azione, indice) === true) gruppo.accese += 1;
  });
  const gruppi = [...perChiave.values()];
  /* L'ordine a vista: prima le azioni senza gruppo, come stavano — sono la
   * fila di oggi —, poi ogni gruppo col suo titolo davanti. */
  const tasti = elenco.map((_azione, indice) => indice);
  const titoli = {};
  let posto = 0;
  for (const indice of senzaGruppo) tasti[indice] = posto++;
  for (const gruppo of gruppi) {
    titoli[gruppo.chiave] = posto++;
    for (const indice of gruppo.indici) tasti[indice] = posto++;
  }
  return { gruppi, senzaGruppo, ordine: { tasti, titoli } };
}

/** I nomi dei gruppi già usati, uno per gruppo, per proporli nella casella. */
export function nomiDeiGruppi(azioni = []) {
  return gruppiDelleAzioni(azioni).gruppi.map((gruppo) => gruppo.nome);
}

/** L'azione col gruppo cambiato. Vuoto vuol dire nessun gruppo, e il campo se ne va. */
export function conIlGruppo(azione, nome) {
  const prossima = { ...(azione && typeof azione === "object" ? azione : {}) };
  const scritto = pulito(nome).slice(0, LUNGHEZZA_DEL_GRUPPO);
  if (scritto) prossima.gruppo = scritto;
  else delete prossima.gruppo;
  return prossima;
}

/**
 * I gruppi chiusi, fra quelli che ci sono adesso.
 *
 * Chiudere un gruppo è una cosa di chi guarda, non della casa: sta sul
 * telefono che l'ha chiuso. E una chiave di un gruppo che non c'è più non
 * chiude niente — se domani «Luci» torna, torna aperto.
 */
export function gruppiChiusi(salvati, gruppi = []) {
  const presenti = new Set((gruppi || []).map((gruppo) => gruppo.chiave));
  const elenco = Array.isArray(salvati) ? salvati : [];
  return new Set(elenco.map(chiaveDelGruppo).filter((chiave) => presenti.has(chiave)));
}

/** Il gruppo chiuso diventa aperto e viceversa: l'elenco nuovo da ricordare. */
export function inverti(salvati, chiave) {
  const elenco = (Array.isArray(salvati) ? salvati : []).map(chiaveDelGruppo).filter(Boolean);
  const questa = chiaveDelGruppo(chiave);
  if (!questa) return elenco;
  return elenco.includes(questa) ? elenco.filter((voce) => voce !== questa) : [...elenco, questa];
}
