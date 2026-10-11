/// Lo schermo del tablet a muro: tutto per il pannello, e spento di notte.
///
/// «Nel 10" con GDA diretta lo spegni schermo toglie l'orologio, ma lascia
/// acceso l'Android con le icone sotto e la barra sopra col segnale e
/// l'orologio.» La plancia disegna il nero, ma le barre del sistema e la
/// luminosita' non sono sue: le comanda l'app. La plancia le chiede sul canale
/// `gdahomeSchermo` (`plancia-a-muro-section.js`) e qui si fanno:
///
/// - `muro:si` / `muro:no`: col pannello a muro acceso le barre di Android
///   spariscono (tornano col gesto dal bordo, e da sole poco dopo); spento il
///   pannello, l'app torna com'era.
/// - `spento:si` / `spento:no`: di notte la luminosita' della finestra va al
///   minimo; al risveglio torna quella del sistema.
library;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'la_finestra.dart' show canaleDellaFinestra;

/// Il nome del canale che la plancia cerca.
const canaleDelloSchermo = 'gdahomeSchermo';

bool _aMuro = false;
bool _spento = false;

/// Quello che la plancia ha detto. Non solleva mai: un telefono che non sa
/// farlo resta com'era.
Future<void> loSchermoDice(String detto) async {
  switch (detto) {
    case 'muro:si':
    case 'muro:no':
      final aMuro = detto == 'muro:si';
      if (aMuro == _aMuro) return;
      _aMuro = aMuro;
      try {
        await SystemChrome.setEnabledSystemUIMode(
          aMuro ? SystemUiMode.immersiveSticky : SystemUiMode.edgeToEdge,
        );
      } catch (_) {}
      if (!aMuro && _spento) await _luminosita(false);
    case 'spento:si':
    case 'spento:no':
      await _luminosita(detto == 'spento:si');
  }
}

Future<void> _luminosita(bool spento) async {
  if (spento == _spento) return;
  _spento = spento;
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
  try {
    /* -1 e' «quella del sistema»; 0 la piu' bassa che lo schermo fa. */
    await canaleDellaFinestra.invokeMethod<void>(
      'luminosita',
      spento ? 0.0 : -1.0,
    );
  } catch (_) {
    /* Un pacchetto di prima: resta il nero della plancia. */
  }
}
