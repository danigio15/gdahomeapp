/* I segreti: farne l'impronta, e confrontarli senza raccontare niente.
 *
 * Le stesse due regole del centralino in Node, con gli attrezzi che ci sono
 * qui: su Cloudflare non c'e' `node:crypto`, c'e' la WebCrypto del browser.
 * L'impronta deve venire **identica**, perche' e' la stessa che calcola il
 * ponte: SHA-256, esadecimale minuscolo.
 */

export async function impronta(segreto) {
  const byte = new TextEncoder().encode(String(segreto ?? ""));
  const fatta = new Uint8Array(await crypto.subtle.digest("SHA-256", byte));
  return [...fatta].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* Due impronte non si confrontano con `===`.
 *
 * Il tempo che ci mette dipende da quante lettere iniziali coincidono, e da
 * quel tempo si ricava il segreto una lettera per volta. Qui si guardano tutte
 * le lettere sempre, e si risponde alla fine. */
export function stessaImpronta(uno, due) {
  const a = String(uno ?? "");
  const b = String(due ?? "");
  /* La lunghezza non e' un segreto: sono impronte, e sono sempre lunghe uguale. */
  if (a.length !== b.length) return false;
  let differenza = 0;
  for (let i = 0; i < a.length; i += 1) differenza |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return differenza === 0;
}
