/* La plancia configurata da lontano: le regole che valgono da tutt'e due le
 * parti.
 *
 * Dalla 1.5.9.13 chi installa puo' rimettere mano alla plancia di una casa dal
 * suo cruscotto — se quella casa gliel'ha permesso con la casella
 * `quadro_configurazione`, che e' un terzo interruttore e non sta dentro la
 * manutenzione. La strada e' quella dei due verbi di `lavori.js`: la casa
 * bussa, e nella risposta trova cosa fare. Solo che qui la cosa da fare e'
 * grossa — una configurazione puo' pesare megabyte, e un rapporto ne porta
 * 256 KiB — quindi viaggia su una porta sua, sempre a iniziativa della casa:
 * `POST /plancia` per mandare com'e' fatta adesso, `GET /plancia/<profilo>`
 * per ritirare quella che l'installatore ha scritto.
 *
 * ─── Configurare, non guardare ───────────────────────────────────────────
 *
 * E' la regola che tiene in piedi il permesso. Una plancia configurata e'
 * fatta di sezioni, stanze, entita' e disposizione: quello viaggia. Quello
 * che **non** viaggia mai sono le immagini — i flussi delle telecamere, le
 * istantanee, i gettoni con cui si aprono — e non per una promessa: perche'
 * la configurazione salvata non li contiene (i `cameraUrls` della pagina
 * sono indirizzi temporanei del browser, e non si salvano), e perche' qui
 * sotto c'e' il setaccio che li toglierebbe comunque.
 *
 * Il setaccio lavora in tutt'e due i versi. In uscita — `senzaFlussi` — una
 * stringa che sembra un indirizzo di flusso o porta un gettone esce vuota:
 * l'installatore vede che il campo c'e', non cosa dice. In entrata —
 * `haFlussi` — una configurazione che ne contiene uno si **rifiuta**, e il
 * rapporto del minuto dopo dice perche': da lontano si sceglie quale
 * telecamera va in quale stanza, non dove sta il suo flusso.
 */

import { Configurazione } from "./configurazione.js";

/** Quante plance puo' avere una casa: le stesse di `plance.js`. */
export const PROFILI_AL_MASSIMO = 8;

/** Quanto puo' pesare una configurazione, in byte: come `configurazione.js`. */
export const PLANCIA_MASSIMA = 8 * 1024 * 1024;

/* Un indirizzo di flusso e' riconoscibile dal protocollo; un gettone, dal
 * nome che ha nella coda di un indirizzo. Solo sui **valori** che sono
 * stringhe: una chiave che si chiama «stream» non e' un flusso, e' un nome. */
const FLUSSO = /^\s*(?:rtsps?|rtmps?|srt|webrtc|mjpe?g):\/\//i;
const GETTONE = /(?:^|[?&#;])(?:access_token|auth_sig|authsig|auth|token|signature)=/i;

/** Se questo valore e' un indirizzo di flusso, o porta un gettone. */
export function eUnFlusso(valore) {
  if (typeof valore !== "string") return false;
  return FLUSSO.test(valore) || GETTONE.test(valore);
}

/** Se dentro questi valori, a qualunque profondita', c'e' un flusso. */
export function haFlussi(valori) {
  if (eUnFlusso(valori)) return true;
  if (Array.isArray(valori)) return valori.some((uno) => haFlussi(uno));
  if (valori && typeof valori === "object")
    return Object.values(valori).some((uno) => haFlussi(uno));
  return false;
}

/**
 * Una copia dei valori con i flussi tolti: la stringa resta, vuota, cosi' chi
 * legge vede che il campo esiste e non cosa c'era scritto.
 */
export function senzaFlussi(valori) {
  if (eUnFlusso(valori)) return "";
  if (Array.isArray(valori)) return valori.map((uno) => senzaFlussi(uno));
  if (valori && typeof valori === "object") {
    return Object.fromEntries(
      Object.entries(valori).map(([chiave, uno]) => [chiave, senzaFlussi(uno)]),
    );
  }
  return valori;
}

/** Il nome di un profilo, com'e' scritto in `configurazione.js`. */
export const profiloBuono = (profilo) => Configurazione.profiloBuono(profilo);

/** Quanto pesano questi valori una volta scritti: e' il numero che si confronta col tetto. */
export const quantoPesa = (valori) => Buffer.byteLength(JSON.stringify(valori ?? null), "utf8");
