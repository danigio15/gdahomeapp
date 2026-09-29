/* La chiave pubblica delle licenze: chi la usa e perche' sta qui.
 *
 * Il quadro firma i gettoni delle licenze con la sua chiave privata; questo
 * pezzo li verifica da se' con la pubblica, senza chiedere a nessuno «e'
 * vero?» a ogni apertura. Il contratto intero — com'e' fatto un gettone, le
 * regole di verifica, chi lo manda a chi — sta in `docs/LICENZE.md`, e chi
 * tocca questa riga lo legge prima.
 *
 * ─── Vuota di serie, e vuol dire «licenze spente» ─────────────────────────
 *
 * Con la stringa vuota nessun gettone vale, e nessuno lo guarda: l'add-on e
 * il centralino si comportano esattamente come prima che le licenze
 * esistessero. Si accendono in due passi, con la stessa chiave
 * (`docs/ACCENDERE-GLI-ACQUISTI.md`): `strumenti/chiave-licenze.mjs` scrive
 * **questa stessa riga**, uguale, in `ponte/src/chiave-licenze.js`,
 * `centralino/src/chiave-licenze.js` e nelle due app. La privata non passa mai
 * di qui: sta solo sulla macchina del quadro.
 *
 * Il formato e' la chiave Ed25519 grezza, 32 byte, in base64url senza `=`.
 * La coppia **di prova** del contratto non va mai scritta qui: le prove se la
 * passano da se'.
 */
export const CHIAVE_PUBBLICA_LICENZE = "";
