/// Dove le impostazioni restano da una volta all'altra.
///
/// Sul telefono un file nella cartella di supporto dell'app; nel browser, e
/// nelle prove, la memoria. Chi le usa non lo sa: riceve una [Dispensa].
library;

import 'dart:async';

export 'in_memoria.dart'
    if (dart.library.io) 'su_disco.dart'
    show dispensaDiQuestoSistema;

/// Un posto dove tenere un testo. Uno solo: le impostazioni sono un JSON.
abstract interface class Dispensa {
  Future<String?> leggi();
  Future<void> scrivi(String testo);
}

/// La dispensa che non ricorda niente da una volta all'altra: per il
/// browser e per le prove.
class DispensaInMemoria implements Dispensa {
  DispensaInMemoria([this._testo]);
  String? _testo;

  @override
  Future<String?> leggi() async => _testo;

  @override
  Future<void> scrivi(String testo) async => _testo = testo;
}
