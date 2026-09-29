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
 * i centralini si comportano esattamente come prima che le licenze
 * esistessero. Si accendono tutte insieme il giorno del rilascio, quando si
 * lancia una volta
 *
 *     node strumenti/chiave-licenze.mjs [--gdanav ../gdanav]
 *
 * che fabbrica la coppia e scrive **questa stessa riga**, uguale, in
 * `ponte/src/chiave-licenze.js`, `centralino/src/chiave-licenze.js`,
 * `nuvola/src/chiave-licenze.js` e nelle due app. La privata non passa mai di
 * qui: sta solo sulla macchina del quadro.
 *
 * Il formato e' la chiave Ed25519 grezza, 32 byte, in base64url senza `=`.
 * La coppia **di prova** del contratto non va mai scritta qui: le prove se la
 * passano da se'.
 */
export const CHIAVE_PUBBLICA_LICENZE = "";

/* ─── Prima l'iPhone ───────────────────────────────────────────────────────
 *
 * `true` vuol dire che le licenze, con la chiave scritta qui sopra, contano
 * solo nell'app per iPhone: e' la prima che esce nel negozio col Premium da
 * comprare. La casa chiede lo stesso i gettoni al quadro, li tiene e gli gira
 * le ricevute — se no chi compra dall'iPhone non avrebbe niente — ma **non
 * limita niente**: le plance, i telefoni da fuori, il browser e Android
 * restano come prima. I lucchetti li mette solo l'app per iPhone.
 *
 * La scrive `strumenti/chiave-licenze.mjs --solo-iphone`, insieme alla chiave
 * qui e nell'app; il centralino e la nuvola restano senza chiave. Il giorno
 * che si accende per tutti torna `false` (`docs/ACCENDERE-GLI-ACQUISTI.md`).
 */
export const LICENZE_SOLO_SULL_IPHONE = false;
