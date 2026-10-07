/// La chiave pubblica delle licenze: con questa si controlla un gettone.
///
/// E' la `CHIAVE_PUBBLICA_LICENZE` di `docs/LICENZE.md`: la chiave pubblica
/// Ed25519 grezza (32 byte) in base64url, la stessa scritta nel ponte, nel
/// centralino e in gdanav.
///
/// **Di serie e' vuota**, e vuota vuol dire che i controlli sono spenti: ogni
/// casa vale come Premium e l'app fa quello che ha sempre fatto. Scritta, i
/// lucchetti di Base valgono dappertutto — nell'app per iPhone, in quella per
/// Android e nel browser — e Premium si compra dall'app, sull'iPhone e su
/// Android.
///
/// Non la si scrive a mano. La coppia nasce sulla macchina del quadro, che
/// stampa solo la pubblica, e la pubblica si scrive qui e negli altri file con
///
///     node strumenti/chiave-licenze.mjs --senza-centralino --pubblica <x>
///
/// (`docs/ACCENDERE-GLI-ACQUISTI.md`). La riga qui sotto la riscrive lo
/// strumento: resti una riga sola, cosi'.
library;

const chiavePubblicaLicenze = '';
