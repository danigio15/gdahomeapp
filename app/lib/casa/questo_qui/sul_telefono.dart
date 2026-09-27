/// Sul telefono: cos'e' lo dice il sistema, come si chiama lo chiede a lui.
library;

import 'dart:io' show Platform;

import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, TargetPlatform;

import '../questo_dispositivo.dart';

QuestoDispositivo comEFatto() {
  /* `defaultTargetPlatform` e non `Platform.isIOS`: sul telefono dicono lo
   * stesso, ma il primo si lascia cambiare nelle prove e nelle fotografie.
   * Un altro sistema resta `sconosciuto`, e il nome lo prende dal ripiego. */
  final sistema = switch (defaultTargetPlatform) {
    TargetPlatform.iOS => 'ios',
    TargetPlatform.android => 'android',
    _ => 'sconosciuto',
  };
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
