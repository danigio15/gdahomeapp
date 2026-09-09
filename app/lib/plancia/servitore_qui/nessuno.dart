/// Dove un server non si puo' aprire: il web.
library;

import '../pannello.dart';
import '../../ponte/filo.dart';

/// Sempre `null`: qui il servitore non c'e'.
Future<ServitoreDiQuestoSistema?> alzaIlServitore({
  required Filo? Function() filo,
  required String lingua,
}) async => null;

/// Quello che alla schermata serve sapere di un servitore, senza `dart:io`.
abstract interface class ServitoreDiQuestoSistema {
  Uri paginaDi(PannelloDellaPlancia pannello);
  Future<void> spegni();

  /// La plancia leggera: vale dalla pagina dopo.
  set leggera(bool valore);

  /// Il tema della plancia su questo dispositivo — `auto`, `chiaro`, `scuro`
  /// — e come sta la sua barra in fondo — `scomparsa` o `fissa`. Erano nella
  /// Config della plancia; quella e' uscita, e questi sono venuti con lei.
  set tema(String quale);
  set barra(String come);

  /// Quanto prendono le barre del telefono: vale dalla pagina dopo, e
  /// intanto la cambia da fuori chi mostra il riquadro.
  set margini(({double alto, double basso}) quanto);
}
