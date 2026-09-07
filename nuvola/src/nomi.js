/* Le forme che hanno gli identificativi, in un posto solo.
 *
 * Stanno qui e non sparsi perche' sono la prima difesa dell'indirizzo: quello
 * che non ha questa forma non diventa mai il nome di un oggetto. */

/** `casa_` piu' trentadue lettere esadecimali. */
export const CASA_VALIDA = /^casa_[0-9a-f]{32}$/;

/** Un'impronta SHA-256 in esadecimale minuscolo. */
export const IMPRONTA_VALIDA = /^[0-9a-f]{64}$/;
