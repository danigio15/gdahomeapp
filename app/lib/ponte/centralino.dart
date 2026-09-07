/// Il centralino di difetto: quello a cui l'app va a cercare le case.
///
/// Sta qui e non nelle mani dell'utente, ed e' una decisione: un centralino da
/// battere a mano sarebbe una cosa in piu' da capire, da copiare e da
/// sbagliare, e l'unica ragione per cui questo progetto esiste e' che non ce
/// ne siano.
///
/// Si mette al momento della compilazione:
///
///     flutter build apk --dart-define=CENTRALINO=wss://centralino.esempio.it
///
/// **Vuoto vuol dire: nessuno.** Non un indirizzo finto, non un dominio che un
/// giorno forse — vuoto. Un'app che punta a un centralino che non c'e'
/// aspetterebbe che scada una richiesta a ogni abbinamento e direbbe «non
/// trovo la casa», che e' il modo peggiore di dire «quel pezzo non l'abbiamo
/// ancora acceso». Finche' e' vuoto, l'abbinamento chiede l'indirizzo di casa
/// — una riga, una volta sola, stando sul divano — e il resto lo impara da
/// li': il ponte, nella risposta, dice a quale centralino chiama lui.
///
/// Ed e' il motivo per cui questa costante conta meno di quanto sembri: una
/// casa abbinata in casa impara da sola come farsi trovare da fuori.
library;

import 'indirizzo.dart';

const String _scritto = String.fromEnvironment('CENTRALINO');

/// `null` quando non ce n'e' uno.
final IndirizzoDelCentralino? centralinoDiDifetto =
    IndirizzoDelCentralino.leggi(_scritto);

/// `true` quando l'app puo' abbinare col solo codice, senza chiedere indirizzi.
bool get siAbbinaColSoloCodice => centralinoDiDifetto != null;
