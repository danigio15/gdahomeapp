/// Nel browser: e' un browser, e quale lo dice lui.
library;

import 'package:web/web.dart' as web;

import '../questo_dispositivo.dart';

QuestoDispositivo comEFatto() {
  var agente = '';
  try {
    agente = web.window.navigator.userAgent;
  } catch (_) {
    /* Un browser che non lo dice: resta «Browser». */
  }
  /* `web` e non `sconosciuto`: sapere che si e' abbinato un browser e non un
   * telefono e' meta' di quello che serve sapere guardando l'elenco. */
  return QuestoDispositivo(nome: nomeDalBrowser(agente), sistema: 'web');
}

/// Nel browser il modello non c'e': il nome lo dice gia' [comEFatto].
Future<IlModello?> leggiIlModello() async => null;
