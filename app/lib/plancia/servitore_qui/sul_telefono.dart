/// Il servitore sul telefono: si accende una volta e si tiene.
library;

import 'dart:io';

import 'package:path_provider/path_provider.dart';

import '../../ponte/filo.dart';
import '../pannello.dart';
import '../servitore.dart';

/// Quello che alla schermata serve sapere di un servitore.
abstract interface class ServitoreDiQuestoSistema {
  /// La pagina da aprire per questo pannello, in questa casa: [casa] e'
  /// l'identificativo della casa nell'app, e vuoto vuol dire «senza». Con la
  /// casa la pagina tiene le sue cose a parte, casa per casa
  /// (`premesse.dart`).
  Uri paginaDi(PannelloDellaPlancia pannello, {String casa = ''});

  /// L'indirizzo di una pagina qualunque servita da qui: serve al ritratto di
  /// una persona, che e' una pagina nostra messa di fianco ai file della
  /// plancia.
  Uri indirizzoDi(String percorso, {Map<String, String> domande});

  Future<void> spegni();

  /// La plancia leggera: vale dalla pagina dopo.
  set leggera(bool valore);

  /// Quanto prendono le barre del telefono: vale dalla pagina dopo, e
  /// intanto la cambia da fuori chi mostra il riquadro.
  set margini(({double alto, double basso}) quanto);
}

class _SulTelefono implements ServitoreDiQuestoSistema {
  _SulTelefono(this._servitore);
  final Servitore _servitore;

  @override
  Uri paginaDi(PannelloDellaPlancia pannello, {String casa = ''}) =>
      _servitore.paginaDi(pannello, casa: casa);

  @override
  Uri indirizzoDi(String percorso, {Map<String, String> domande = const {}}) =>
      _servitore.indirizzoDi(percorso, domande: domande);

  @override
  Future<void> spegni() => _servitore.spegni();

  @override
  set leggera(bool valore) => _servitore.leggera = valore;

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
  final cartella = Directory('${supporto.path}/plancia');
  /* Il deposito di prima era uno solo per tutte le case, e stava qui in
   * cima: adesso ogni casa ha il suo, sotto `case/` (vedi [Servitore]).
   * Quello vecchio non lo legge piu' nessuno, e si toglie. */
  for (final vecchia in const ['dashboardmodern_static', 'local']) {
    try {
      await Directory('${cartella.path}/$vecchia').delete(recursive: true);
    } catch (_) {
      /* Non c'era, o non si lascia togliere: non la legge comunque nessuno. */
    }
  }
  final servitore = Servitore(filo: filo, cartella: cartella, lingua: lingua);
  /* La porta e' quella di casa: cosi' la plancia si ritrova la sua
   * configurazione anche quando riapre l'app senza rete. Vedi [portaDiCasa]. */
  await servitore.alza(porta: portaDiCasa);
  return _SulTelefono(servitore);
}
