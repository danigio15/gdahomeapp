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

  /// L'indirizzo di una pagina qualunque servita da qui: serve al ritratto di
  /// una persona, che e' una pagina nostra messa di fianco ai file della
  /// plancia.
  Uri indirizzoDi(String percorso, {Map<String, String> domande});

  Future<void> spegni();

  /// La plancia leggera: vale dalla pagina dopo.
  set leggera(bool valore);

  /// Il tema della plancia su questo dispositivo — `auto`, `chiaro`, `scuro`
  /// — e come sta la sua barra in fondo — `scomparsa` o `fissa`. Erano nella
  /// Config della plancia; quella e' uscita, e questi sono venuti con lei.
  set tema(String quale);
  set barra(String come);

  /// La tavolozza (`cd_tavolozza`), anche lei di questo dispositivo.
  set tavolozza(String quale);

  /// Quanto prendono le barre del telefono: vale dalla pagina dopo, e
  /// intanto la cambia da fuori chi mostra il riquadro.
  set margini(({double alto, double basso}) quanto);
}

class _SulTelefono implements ServitoreDiQuestoSistema {
  _SulTelefono(this._servitore);
  final Servitore _servitore;

  @override
  Uri paginaDi(PannelloDellaPlancia pannello) => _servitore.paginaDi(pannello);

  @override
  Uri indirizzoDi(String percorso, {Map<String, String> domande = const {}}) =>
      _servitore.indirizzoDi(percorso, domande: domande);

  @override
  Future<void> spegni() => _servitore.spegni();

  @override
  set leggera(bool valore) => _servitore.leggera = valore;

  @override
  set tema(String quale) => _servitore.tema = quale;

  @override
  set barra(String come) => _servitore.barra = come;

  @override
  set tavolozza(String quale) => _servitore.tavolozza = quale;

  @override
  set margini(({double alto, double basso}) quanto) =>
      _servitore.margini = quanto;
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
  /* La porta e' quella di casa: cosi' la plancia si ritrova la sua
   * configurazione anche quando riapre l'app senza rete. Vedi [portaDiCasa]. */
  await servitore.alza(porta: portaDiCasa);
  return _SulTelefono(servitore);
}
