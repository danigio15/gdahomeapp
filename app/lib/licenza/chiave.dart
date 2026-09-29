/// La chiave pubblica delle licenze: con questa si controlla un gettone.
///
/// E' la `CHIAVE_PUBBLICA_LICENZE` di `docs/LICENZE.md`: la chiave pubblica
/// Ed25519 grezza (32 byte) in base64url, la stessa scritta nel ponte, nel
/// centralino e in gdanav.
///
/// **Di serie e' vuota**, e vuota vuol dire che i controlli sono spenti: ogni
/// casa vale come Premium e l'app fa quello che ha sempre fatto. Non la si
/// scrive a mano: prima del rilascio si lancia una volta
///
///     node strumenti/chiave-licenze.mjs [--gdanav ../gdanav]
///
/// che fabbrica la coppia e scrive la pubblica qui e negli altri file. La riga
/// qui sotto la riscrive lo strumento: resti una riga sola, cosi'.
library;

const chiavePubblicaLicenze = '';

/// Prima l'iPhone: con `true` le licenze contano solo nell'app per iPhone.
///
/// E' la prima app che esce nel negozio col Premium da comprare. Li' ci sono
/// i lucchetti e l'App Store; su Android e nel browser, anche con la chiave
/// scritta, resta tutto aperto come oggi. La casa fa la sua parte — tiene i
/// gettoni e gira le ricevute — senza limitare niente
/// (`LICENZE_SOLO_SULL_IPHONE` in `ponte/src/chiave-licenze.js`).
///
/// La scrive `node strumenti/chiave-licenze.mjs --solo-iphone`, insieme alla
/// chiave; il giorno che si accende per tutti torna `false`.
const licenzeSoloSullIPhone = false;
