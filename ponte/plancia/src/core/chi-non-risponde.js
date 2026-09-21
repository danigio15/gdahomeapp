/* Chi, fra le cose configurate in questa casa, in questo momento non risponde.
 *
 * «Potrebbe essere utile avere un widget che compare quando almeno una delle
 * entità mappate in gdahome diventa Non Disponibile. Ho dei comandi domotici
 * in giardino (tra cui alcuni dedicati alla piscina) che ogni tanto, causa
 * segnale wifi non sufficiente, vanno in offline: avere l'avviso mi allerta di
 * ripristinarli per evitare che la pompa ad esempio resti ferma troppo a
 * lungo» (#33).
 *
 * È il difetto più cattivo che una casa domotica abbia, perché è muto: una
 * presa che sparisce non fa rumore, la sua tessera resta lì con l'ultimo
 * valore che aveva, e uno se ne accorge quando la piscina è verde. La plancia
 * sapeva già tutto quello che serve per dirlo — quali entità sono configurate
 * e qual è il loro stato — e non lo diceva.
 *
 * ─── Cosa conta come «non risponde», e cosa no ───────────────────────────
 *
 * Solo `unavailable`. È la parola con cui Home Assistant dice «questa entità
 * esiste, e non riesco a parlarle»: è esattamente il caso della presa in
 * giardino col wifi debole, ed è un guasto.
 *
 * `unknown` NON conta, ed è voluto. Vuol dire un'altra cosa — l'entità c'è e
 * risponde, ma non ha ancora un valore da dire — ed è normalissima nei primi
 * secondi dopo un riavvio di Home Assistant, su un sensore che parla una volta
 * all'ora, su un pulsante che non è mai stato premuto. Contarla vorrebbe dire
 * una tessera rossa a ogni riavvio, cioè un avviso che si impara a ignorare:
 * e un avviso che si ignora è peggio di nessun avviso.
 *
 * Nemmeno le entità che in questa casa non ci sono proprio. Quella è una
 * configurazione da correggere — un'entità rinominata, un'integrazione tolta —
 * non una cosa che è andata offline: sono due guai diversi e vogliono due
 * risposte diverse, e mescolarli riempirebbe la tessera di rumore vecchio
 * finché quella vera non si perde in mezzo.
 *
 * Il modulo è puro: entrano gli identificativi e gli stati, esce l'elenco.
 */

const pulito = (valore) => String(valore ?? "").trim();

/** La parola con cui Home Assistant dice «non riesco a parlarle». */
export const NON_RISPONDE = "unavailable";

/** Se quello stato è un'entità che non risponde. */
export function nonRisponde(stato) {
  return pulito(stato?.state).toLowerCase() === NON_RISPONDE;
}

/**
 * Chi non risponde, fra le entità date.
 *
 * `nomeDi` serve a chiamarle come le chiama chi abita: senza, resterebbe
 * l'identificativo, e `switch.0x00158d0004a1b2c3` non dice a nessuno quale
 * presa andare a guardare. Se non c'è un nome amichevole resta
 * l'identificativo, che è comunque meglio del niente.
 *
 * In ordine alfabetico per nome: l'elenco si guarda, e un ordine che cambia a
 * ogni giro perché cambia l'ordine degli stati è un elenco che non si riesce a
 * leggere.
 */
export function chiNonRisponde(entita, states = {}, { nomeDi = null } = {}) {
  const viste = new Set();
  const fuori = [];
  for (const grezzo of entita || []) {
    const entity = pulito(grezzo);
    if (!entity || viste.has(entity)) continue;
    viste.add(entity);
    const stato = states?.[entity];
    /* Un'entità che qui dentro non c'è proprio non è «offline»: è un'altra
     * cosa, e sta scritto in cima perché non entri di soppiatto. */
    if (!stato || !nonRisponde(stato)) continue;
    let nome = "";
    try {
      nome = pulito(nomeDi?.(entity));
    } catch (_errore) {
      nome = "";
    }
    fuori.push({
      entity,
      nome: nome || pulito(stato?.attributes?.friendly_name) || entity,
      /* Da quando: è la domanda che uno si fa subito dopo «chi». Cinque
       * minuti è un riavvio, due giorni è una presa da andare a premere. */
      da: Date.parse(pulito(stato?.last_changed)) || null,
    });
  }
  return fuori.sort((una, altra) => una.nome.localeCompare(altra.nome));
}
