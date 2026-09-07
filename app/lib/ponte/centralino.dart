/// Il centralino dell'app: quello che accende chi la distribuisce.
///
/// Sta qui e non nelle mani di chi usa l'app, ed e' una decisione: un
/// centralino da battere a mano sarebbe una cosa in piu' da capire, da copiare
/// e da sbagliare, e l'unica ragione per cui questo progetto esiste e' che non
/// ce ne siano.
///
/// **Ce n'e' uno solo per tutta l'app**, non uno per casa. Le case ci si
/// collegano tutte e non si vedono fra loro: ognuna e' una stanza sua, e il
/// centralino non puo' leggere niente di quello che ci passa dentro.
///
/// **Deve essere identico a `CENTRALINO_DI_DIFETTO` in
/// `ponte/src/opzioni.js`.** Se divergessero, i telefoni andrebbero a cercare
/// le case in un posto e le case starebbero ad aspettare in un altro, e non lo
/// direbbe nessuno: da fuori casa l'app direbbe soltanto «non trovo la casa».
/// Li tiene insieme `ponte/test/centralino-di-difetto.test.js`, e si cambiano
/// tutti e due insieme con:
///
///     node strumenti/centralino.mjs wss://centralino.esempio.workers.dev
///
/// Per una compilazione sola se ne puo' mettere un altro senza toccare niente:
///
///     flutter build apk --dart-define=CENTRALINO=wss://…
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

/// Cambiato da `strumenti/centralino.mjs`: la riga qui sotto e' quella che
/// legge, e va lasciata su una riga sola.
const String centralinoDiDifettoScritto = "";

const String _daRiga = String.fromEnvironment(
  'CENTRALINO',
  defaultValue: centralinoDiDifettoScritto,
);

/// `null` quando non ce n'e' uno.
final IndirizzoDelCentralino? centralinoDiDifetto =
    IndirizzoDelCentralino.leggi(_daRiga);

/// `true` quando l'app puo' abbinare col solo codice, senza chiedere indirizzi.
bool get siAbbinaColSoloCodice => centralinoDiDifetto != null;
