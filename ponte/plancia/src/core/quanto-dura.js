/* Quanto dura, in minuti, quello che un'entità dichiara.
 *
 * «Il mio UPS (CyberPower) mostra il tempo residuo in secondi invece dei
 *  minuti» (#9).
 *
 * La casella si chiamava «Autonomia (minuti)» e il numero si prendeva così
 * com'era: un gruppo che dichiara 1800 secondi diventava «1800 min», cioè
 * trenta ore di autonomia su una batteria che ne fa mezz'ora. Non è un numero
 * un po' sbagliato, è la risposta opposta a quella che si cercava — e la si
 * legge proprio nel momento in cui è andata via la corrente.
 *
 * L'unità però non c'è da chiederla: sta scritta nell'entità, in
 * `unit_of_measurement`, e la scrivono tutte le integrazioni che parlano di
 * tempo. Chiedere a chi configura una cosa che la casa ha già detto è il modo
 * di sbagliarla in due.
 *
 * Il vocabolario sta qui, in un posto solo, perché lo leggono in due: chi
 * scrive una durata su una scheda (`letture-accanto.js`) e chi legge
 * l'autonomia di un gruppo di continuità (`ups-model.js`). Scritto due volte,
 * il giorno che un'integrazione dice «secs» una delle due lo impara e l'altra
 * no.
 *
 * ── Perché «m» non c'è ─────────────────────────────────────────────────────
 *
 * In Home Assistant «m» sono i metri, e nella plancia lo sono dappertutto: un
 * sensore di distanza — «50 m» — finiva scritto «50 min». I minuti si
 * dichiarano «min», che è quello che scrivono le integrazioni quando parlano
 * di tempo.
 */

const pulito = (valore) => String(valore ?? "").trim();

export const ORE = Object.freeze(["h", "hr", "hrs", "ore", "hours", "hour", "ora"]);
export const MINUTI = Object.freeze(["min", "mins", "minuti", "minutes", "minute"]);
export const SECONDI = Object.freeze(["s", "sec", "secs", "secondi", "seconds", "second"]);

/**
 * Il valore riportato a minuti, o `null` se quell'unità non è un tempo.
 *
 * `null` e non «tienilo com'è»: chi chiama sa cosa farne — la scheda non
 * scrive niente, l'UPS lo prende per minuti, che è come si chiamava la sua
 * casella da sempre.
 */
export function inMinuti(valore, unita) {
  const quanto = Number(valore);
  if (!Number.isFinite(quanto)) return null;
  const misura = pulito(unita).toLowerCase();
  if (MINUTI.includes(misura)) return quanto;
  if (SECONDI.includes(misura)) return quanto / 60;
  if (ORE.includes(misura)) return quanto * 60;
  return null;
}
