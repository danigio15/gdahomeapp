/// La finestra dell'app, vista dal sistema: se e' riservata o no.
///
/// Con il lucchetto acceso, su Android la finestra si dichiara **riservata**:
/// il sistema non la mostra nell'elenco delle app recenti — li' si vede un
/// riquadro vuoto invece della plancia di casa — e non la lascia fotografare.
/// E' il solo modo sicuro: l'istantanea delle app recenti la fa il sistema
/// nell'attimo in cui l'app se ne va, e un velo disegnato da Flutter in
/// quell'attimo non sempre arriva in tempo.
///
/// Sull'iPhone non si puo' vietare la fotografia dello schermo, ma
/// l'istantanea delle app recenti si': la copre la scena con un velo nativo
/// (`ios/Runner/SceneDelegate.swift`), oltre a quello che mette l'app. Nel
/// browser questo canale non c'e': li' basta il velo di `main.dart`.
library;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Il canale, scritto anche in `android/…/MainActivity.kt`.
const canaleDellaFinestra = MethodChannel('gdahome/finestra');

/// Riservata o no. Non solleva mai: un telefono che non sa farlo resta
/// com'era, e il velo c'e' lo stesso.
Future<void> finestraRiservata(bool riservata) async {
  if (kIsWeb) return;
  if (defaultTargetPlatform != TargetPlatform.android &&
      defaultTargetPlatform != TargetPlatform.iOS) {
    return;
  }
  try {
    await canaleDellaFinestra.invokeMethod<void>('riservata', riservata);
  } catch (_) {
    /* Un pacchetto di prima, o un sistema che dice no: resta il velo. */
  }
}

/// Il permesso del microfono, chiesto al sistema: lo vuole «Parla» del
/// citofono sul tablet a muro, quando la pagina chiede la voce. Torna `false`
/// se il sistema dice no o non sa rispondere — la pagina lo dice da se'.
Future<bool> permessoDelMicrofono() async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return false;
  try {
    return await canaleDellaFinestra.invokeMethod<bool>('microfono') ?? false;
  } catch (_) {
    return false;
  }
}

/// Se l'app sta davanti a qualcuno, o e' partita da sola senza schermo — la
/// sveglia di Salute (`salute/ad_app_chiusa.dart`). Sull'iPhone lo dice il
/// sistema: una scena del telefono in primo piano (`AppDelegate`, non basta
/// `applicationState`, che con CarPlay e' «attiva» col telefono in tasca);
/// dove non si sa — Android, il browser, le prove — si risponde «davanti»,
/// cioe' come prima. Su Android chi deve saperlo guarda lo stato di Flutter
/// (`statoDavanti` in `main.dart`).
Future<bool> siStaDavanti() async {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.iOS) return true;
  try {
    return await canaleDellaFinestra.invokeMethod<bool>('davanti') ?? true;
  } catch (_) {
    return true;
  }
}
