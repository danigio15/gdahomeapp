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
/// - `chiosco:si` / `chiosco:no`: il modo chiosco della plancia. «Il flag e'
///   abilitato, rimangono le icone in alto e in basso dell'Android»: il chiosco
///   copriva solo Home Assistant, le barre del sistema non le chiedeva a
///   nessuno. Adesso le nasconde come il pannello a muro.
/// - `spento:si` / `spento:no`: di notte la luminosita' della finestra va al
///   minimo; al risveglio torna quella del sistema.
///
/// Android rimette le barre da solo — tornando nell'app, dopo un dialogo del
/// sistema, aprendo e chiudendo un pieghevole — e [loSchermoRimetti] le
/// ritoglie: si richiama a ogni ritorno e a ogni cambio di misura.
library;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'la_finestra.dart' show canaleDellaFinestra;

/// Il nome del canale che la plancia cerca.
const canaleDelloSchermo = 'gdahomeSchermo';

bool _aMuro = false;
bool _chiosco = false;
bool _spento = false;

/// Quello che la plancia ha detto. Non solleva mai: un telefono che non sa
/// farlo resta com'era.
Future<void> loSchermoDice(String detto) async {
  switch (detto) {
    case 'muro:si':
    case 'muro:no':
      final prima = barreNascoste;
      _aMuro = detto == 'muro:si';
      if (barreNascoste != prima) await _applica();
      if (!_aMuro && _spento) await _luminosita(false);
    case 'chiosco:si':
    case 'chiosco:no':
      final prima = barreNascoste;
      _chiosco = detto == 'chiosco:si';
      if (barreNascoste != prima) await _applica();
    case 'spento:si':
    case 'spento:no':
      await _luminosita(detto == 'spento:si');
  }
}

/// Se adesso le barre del sistema devono stare nascoste.
bool get barreNascoste => _aMuro || _chiosco;

/// Rinasconde le barre, se devono stare nascoste: dopo un ritorno nell'app o
/// un cambio di misura Android puo' averle rimesse. Con le barre normali non
/// fa niente — non tocca il modo che un'altra schermata (il navigatore, un
/// video a tutto schermo) si e' scelto.
Future<void> loSchermoRimetti() async {
  if (barreNascoste) await _applica();
}

Future<void> _applica() async {
  try {
    await SystemChrome.setEnabledSystemUIMode(
      barreNascoste ? SystemUiMode.immersiveSticky : SystemUiMode.edgeToEdge,
    );
  } catch (_) {}
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
