/// Il servitore sul telefono: si accende una volta e si tiene.
library;

import 'dart:io';

import 'package:path_provider/path_provider.dart';

import '../pannello.dart';
import '../servitore.dart';
import '../../ponte/filo.dart';

/// Quello che alla schermata serve sapere di un servitore.
abstract interface class ServitoreDiQuestoSistema {
  Uri paginaDi(PannelloDellaPlancia pannello);
  Future<void> spegni();

  /// La plancia leggera: vale dalla pagina dopo.
  set leggera(bool valore);
}

class _SulTelefono implements ServitoreDiQuestoSistema {
  _SulTelefono(this._servitore);
  final Servitore _servitore;

  @override
  Uri paginaDi(PannelloDellaPlancia pannello) => _servitore.paginaDi(pannello);

  @override
  Future<void> spegni() => _servitore.spegni();

  @override
  set leggera(bool valore) => _servitore.leggera = valore;
}

/// Accende il servitore, con i file della plancia nella cartella di supporto
/// dell'app: quella che il sistema non mostra a nessuno e non mette nei
/// backup delle foto.
Future<ServitoreDiQuestoSistema?> alzaIlServitore({
  required Filo? Function() filo,
  required String lingua,
}) async {
  final supporto = await getApplicationSupportDirectory();
  final servitore = Servitore(
    filo: filo,
    cartella: Directory('${supporto.path}/plancia'),
    lingua: lingua,
  );
  await servitore.alza();
  return _SulTelefono(servitore);
}
