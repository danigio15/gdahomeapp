/// Sul telefono: cos'e' lo dice il sistema, come si chiama lo chiede a lui.
library;

import 'dart:io' show Platform;

import '../questo_dispositivo.dart';

QuestoDispositivo comEFatto() {
  var sistema = 'sconosciuto';
  try {
    if (Platform.isIOS) sistema = 'ios';
    if (Platform.isAndroid) sistema = 'android';
  } catch (_) {
    /* Un sistema che non si lascia chiedere: resta `sconosciuto`, e il nome
     * se lo prende dal ripiego. */
  }
  var detto = '';
  try {
    detto = Platform.localHostname;
  } catch (_) {
    /* Non lo dice: ci pensa `nomeDelTelefono`. */
  }
  return QuestoDispositivo(
    nome: nomeDelTelefono(detto: detto, sistema: sistema),
    sistema: sistema,
  );
}
