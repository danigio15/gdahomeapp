/* L'invito: quello che ci sta scritto dentro il QR code.
 *
 * ─── Perche' non solo il codice ───────────────────────────────────────────
 *
 * Perche' il codice da solo non basta a **trovare** la casa. Un'app che ha il
 * codice e basta puo' cercarla in un posto solo: il centralino con cui e'
 * stata costruita. Se quella casa ne chiama un altro — perche' chi l'ha
 * installata ne ha messo uno suo nelle opzioni dell'add-on — le due meta' non
 * si incontrano, e quello che si vede e' un'app che dice «non trovo la casa»
 * senza nessun modo di capire perche'.
 *
 * Nel QR code invece ci sta tutto: il codice, **quale** centralino chiama
 * questa casa, e su quali indirizzi la si trova stando sul divano. Chi
 * inquadra non sa niente di tutto questo e non deve: mette a fuoco, e ci
 * entra.
 *
 * ─── Perche' un formato tutto suo ─────────────────────────────────────────
 *
 * Non e' un indirizzo web apposta. Un `https://…` inquadrato dalla fotocamera
 * di sistema apre il browser, e chi lo fa finisce su una pagina che non
 * esiste; un `gdahome://…` apre un vuoto se l'app non c'e'. Una riga di testo
 * invece la fotocamera la mostra e basta, e non promette niente che non possa
 * mantenere.
 *
 * ─── Il numero all'inizio ─────────────────────────────────────────────────
 *
 * `gdahome|1|…`. Quell'uno e' l'unica cosa che permetta a un'app vecchia di
 * dire «questo codice viene da un ponte piu' nuovo di me, aggiornami» invece
 * di leggere per meta' qualcosa che non e' piu' quello che crede.
 *
 * Chi legge tiene i campi che conosce e butta quelli che non conosce: cosi'
 * un campo aggiunto domani non rompe le app di oggi.
 *
 * La copia in Dart sta in `app/lib/ponte/invito.dart`, e le due sono tenute
 * insieme dagli stessi vettori scritti a mano nelle prove di tutte e due.
 */

const NOME = "gdahome";
const VERSIONE = 1;
const SEPARATORE = "|";

export class InvitoIllegibile extends Error {}

export class InvitoTroppoNuovo extends Error {}

/* Quello che si disegna nel QR code. */
export function invito({ codice, centralino = "", indirizzi = [] }) {
  const pulito = String(codice ?? "").trim();
  if (!pulito) throw new InvitoIllegibile("un invito senza codice non serve a niente");

  return [
    NOME,
    String(VERSIONE),
    pulito,
    String(centralino ?? "").trim(),
    indirizzi
      .map((uno) => String(uno).trim())
      .filter(Boolean)
      .join(","),
  ].join(SEPARATORE);
}

/* E quello che ne tira fuori chi lo inquadra. */
export function leggiLInvito(scritto) {
  const pezzi = String(scritto ?? "")
    .trim()
    .split(SEPARATORE);

  if (pezzi[0]?.trim().toLowerCase() !== NOME) {
    throw new InvitoIllegibile("questo non e' un codice di gdahome");
  }

  const quale = Number(pezzi[1]);
  if (!Number.isInteger(quale) || quale < 1) {
    throw new InvitoIllegibile("questo non e' un codice di gdahome");
  }
  if (quale > VERSIONE) {
    throw new InvitoTroppoNuovo("questo codice viene da un ponte piu' nuovo di questa app");
  }

  const codice = (pezzi[2] ?? "").trim();
  if (!codice) throw new InvitoIllegibile("questo codice e' incompleto");

  return {
    codice,
    centralino: (pezzi[3] ?? "").trim(),
    indirizzi: (pezzi[4] ?? "")
      .split(",")
      .map((uno) => uno.trim())
      .filter(Boolean),
  };
}
