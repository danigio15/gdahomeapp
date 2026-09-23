/// La finestra dell'app, vista dal sistema: se e' riservata o no.
///
/// Con il lucchetto acceso, su Android la finestra si dichiara **riservata**:
/// il sistema non la mostra nell'elenco delle app recenti — li' si vede un
/// riquadro vuoto invece della plancia di casa — e non la lascia fotografare.
/// E' il solo modo sicuro: l'istantanea delle app recenti la fa il sistema
/// nell'attimo in cui l'app se ne va, e un velo disegnato da Flutter in
/// quell'attimo non sempre arriva in tempo.
///
/// Sull'iPhone e nel browser questo canale non c'e': li' basta il velo che
/// l'app mette quando smette di essere davanti (`main.dart`).
library;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Il canale, scritto anche in `android/…/MainActivity.kt`.
const canaleDellaFinestra = MethodChannel('gdahome/finestra');

/// Riservata o no. Non solleva mai: un telefono che non sa farlo resta
/// com'era, e il velo c'e' lo stesso.
Future<void> finestraRiservata(bool riservata) async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
  try {
    await canaleDellaFinestra.invokeMethod<void>('riservata', riservata);
  } catch (_) {
    /* Un pacchetto di prima, o un sistema che dice no: resta il velo. */
  }
}
