/// La cassaforte: dove si scrive quello che non deve leggere nessun altro.
///
/// Il portachiavi del sistema — Keychain sull'iPhone, Keystore su Android — e
/// non le preferenze: quelle su Android sono un file XML che si legge da fuori
/// con un telefono sbloccato, e li' dentro ci finiscono i segni che aprono
/// casa.
///
/// L'interfaccia esiste perche' il portachiavi vero dentro una prova non c'e'.
library;

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract interface class Cassaforte {
  Future<String?> leggi(String chiave);
  Future<void> scrivi(String chiave, String valore);
  Future<void> cancella(String chiave);
}

class CassaforteDelSistema implements Cassaforte {
  const CassaforteDelSistema([
    this._dentro = const FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
      /* `first_unlock` e non `unlocked`: l'app si deve poter ricollegare anche
       * a schermo spento — per una notifica, o per un riquadro nella schermata
       * iniziale — e con `unlocked` il segno non si leggerebbe. */
      iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
    ),
  ]);

  final FlutterSecureStorage _dentro;

  @override
  Future<String?> leggi(String chiave) => _dentro.read(key: chiave);

  @override
  Future<void> scrivi(String chiave, String valore) =>
      _dentro.write(key: chiave, value: valore);

  @override
  Future<void> cancella(String chiave) => _dentro.delete(key: chiave);
}

/// La cassaforte delle prove: sta in memoria e sparisce col processo.
class CassaforteInMemoria implements Cassaforte {
  final _dentro = <String, String>{};

  /// Quante volte si e' scritto. Serve a provare che non si scriva a vuoto.
  int scritture = 0;

  @override
  Future<String?> leggi(String chiave) async => _dentro[chiave];

  @override
  Future<void> scrivi(String chiave, String valore) async {
    scritture += 1;
    _dentro[chiave] = valore;
  }

  @override
  Future<void> cancella(String chiave) async => _dentro.remove(chiave);
}
