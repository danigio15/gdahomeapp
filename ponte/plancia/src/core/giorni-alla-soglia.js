/* Fra quanti giorni un livello che scende arriva alla sua soglia.
 *
 * Due cose di casa scendono piano e poi risalgono di colpo: il sale
 * dell'addolcitore, che cala a ogni rigenerazione e torna su quando lo si
 * carica (#115), e la terra di una pianta, che si asciuga un po' ogni giorno e
 * torna bagnata quando la si innaffia (#159). La domanda è la stessa — quando
 * tocca di nuovo — e la risposta pure: la retta che passa meglio per i punti
 * dall'ultima risalita in poi, e quanti giorni restano a quel passo.
 *
 * Sta qui, da sola, perché è una regola sola: due copie della stessa retta
 * sono due rette che fra sei mesi non dicono più la stessa cosa.
 *
 * È puro: entrano i punti, esce un numero di giorni o `null`.
 */

const numero = (valore) => {
  if (valore === "" || valore == null) return null;
  const n = Number(String(valore).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const GIORNO_MS = 86400000;

/**
 * Fra quanti giorni il livello arriva alla soglia, dal suo andamento.
 *
 * `serie` sono le letture — `{ quando, valore }`, nella stessa unità della
 * soglia. `salto` è di quanto deve risalire un punto sul precedente per
 * contare come un carico: il sale letto una volta al giorno sale solo quando
 * lo si carica, e basta un punto; la terra letta ogni ora balla di qualche
 * punto da sola, e un'innaffiata è un salto vero. Dal salto in poi si prende
 * la retta: prima c'era un altro giro.
 *
 * Senza abbastanza punti, senza abbastanza giorni fra il primo e l'ultimo, o
 * se il livello non sta scendendo, non c'è una risposta onesta: `null`.
 */
export function giorniAllaSoglia(
  serie,
  { soglia, salto = 1, punti: minimoDiPunti = 3, giorni: minimoDiGiorni = 0 } = {},
) {
  const limite = numero(soglia);
  if (limite === null) return null;
  const punti = (Array.isArray(serie) ? serie : [])
    .map((voce) => ({ x: Number(voce?.quando) / GIORNO_MS, y: numero(voce?.valore) }))
    .filter((p) => Number.isFinite(p.x) && p.y !== null)
    .sort((a, b) => a.x - b.x);
  let inizio = 0;
  for (let i = 1; i < punti.length; i += 1) if (punti[i].y > punti[i - 1].y + salto) inizio = i;
  const usati = punti.slice(inizio);
  if (usati.length < minimoDiPunti) return null;
  if (usati[usati.length - 1].x - usati[0].x < minimoDiGiorni) return null;
  const mediaX = usati.reduce((s, p) => s + p.x, 0) / usati.length;
  const mediaY = usati.reduce((s, p) => s + p.y, 0) / usati.length;
  let sopra = 0;
  let sotto = 0;
  for (const p of usati) {
    sopra += (p.x - mediaX) * (p.y - mediaY);
    sotto += (p.x - mediaX) ** 2;
  }
  if (!sotto) return null;
  const alGiorno = sopra / sotto;
  if (!(alGiorno < 0)) return null;
  const ultimo = usati[usati.length - 1].y;
  return Math.max(0, Math.floor((ultimo - limite) / -alGiorno));
}
