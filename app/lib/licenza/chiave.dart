/// La chiave pubblica delle licenze: con questa si controlla un gettone.
///
/// E' la `CHIAVE_PUBBLICA_LICENZE` di `docs/LICENZE.md`: la chiave pubblica
/// Ed25519 grezza (32 byte) in base64url, la stessa scritta nel ponte, nel
/// centralino, nella nuvola e in gdanav.
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
