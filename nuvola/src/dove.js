/* Come si trova l'oggetto giusto.
 *
 * Due righe, e stanno in un file loro per non far girare in tondo gli import:
 * la casa ha bisogno di trovare un codice, e l'indirizzo ha bisogno di trovare
 * tutti e due. Con questi qui in mezzo nessuno dei tre si aspetta.
 */

export const quellaCasa = (env, id) => env.CASE.get(env.CASE.idFromName(`casa:${id}`));

export const quelCodice = (env, impronta) =>
  env.CODICI.get(env.CODICI.idFromName(`codice:${impronta}`));

/* Il freno e' uno solo per tutto il centralino: conta quello che da dentro
 * una casa non si vede — quante case nuove, quante scritture, in tutto. */
export const quelFreno = (env) => env.FRENO.get(env.FRENO.idFromName("freno"));
