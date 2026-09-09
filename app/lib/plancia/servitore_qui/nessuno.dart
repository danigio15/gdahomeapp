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
}
