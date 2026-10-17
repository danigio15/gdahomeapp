/// Sul telefono: cos'e' lo dice il sistema, come si chiama lo chiede a lui.
library;

import 'dart:io' show Platform;

import 'package:device_info_plus/device_info_plus.dart';
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
  /* Sull'iPhone il nome della macchina puo' essere quello che gli ha dato il
   * suo padrone («L'iPhone di …»): non si legge. Basta «iPhone», e il modello
   * lo dice [leggiIlModello]. */
  if (sistema != 'ios') {
    try {
      detto = Platform.localHostname;
    } catch (_) {
      /* Non lo dice: ci pensa `nomeDelTelefono`. */
    }
  }
  return QuestoDispositivo(
    nome: nomeDelTelefono(detto: detto, sistema: sistema),
    sistema: sistema,
  );
}

/// Marca, modello e versione del sistema. `null` se il telefono non lo dice:
/// si va avanti col nome di prima, un abbinamento non si ferma per questo.
Future<IlModello?> leggiIlModello() async {
  final info = DeviceInfoPlugin();
  try {
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        final android = await info.androidInfo;
        return modelloDaAndroid(
          produttore: android.manufacturer.isNotEmpty
              ? android.manufacturer
              : android.brand,
          modello: android.model,
          versione: android.version.release,
        );
      case TargetPlatform.iOS:
        final ios = await info.iosInfo;
        return modelloDaIos(
          codice: ios.utsname.machine,
          versione: ios.systemVersion,
        );
      default:
        return null;
    }
  } catch (_) {
    return null;
  }
}
