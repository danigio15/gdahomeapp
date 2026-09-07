/// Dove sta il segno, fra un'accensione e l'altra.
///
/// Nel portachiavi del sistema — Keychain sull'iPhone, Keystore su Android —
/// e non nelle preferenze: quelle su Android sono un file XML che si legge da
/// fuori con un telefono sbloccato, e un segno che apre casa non ci sta.
///
/// L'interfaccia esiste perche' il portachiavi vero non c'e' dentro una prova:
/// le prove usano [CustodiaInMemoria], il telefono usa [CustodiaDelSistema].
library;

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'indirizzo.dart';

abstract interface class Custodia {
  Future<String?> leggiIlSegno();
  Future<void> scriviIlSegno(String segno);
  Future<IndirizzoDelPonte?> leggiLIndirizzo();
  Future<void> scriviLIndirizzo(IndirizzoDelPonte dove);

  /// Dimentica tutto: e' quello che succede quando il telefono viene staccato
  /// dalla console, o quando l'utente vuole ricominciare.
  Future<void> dimentica();
}

class CustodiaDelSistema implements Custodia {
  const CustodiaDelSistema([
    this._dentro = const FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
      iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
    ),
  ]);

  final FlutterSecureStorage _dentro;

  static const _chiaveDelSegno = 'segno_del_ponte';
  static const _chiaveDellIndirizzo = 'indirizzo_del_ponte';

  @override
  Future<String?> leggiIlSegno() => _dentro.read(key: _chiaveDelSegno);

  @override
  Future<void> scriviIlSegno(String segno) =>
      _dentro.write(key: _chiaveDelSegno, value: segno);

  @override
  Future<IndirizzoDelPonte?> leggiLIndirizzo() async {
    final scritto = await _dentro.read(key: _chiaveDellIndirizzo);
    return scritto == null ? null : IndirizzoDelPonte.leggi(scritto);
  }

  @override
  Future<void> scriviLIndirizzo(IndirizzoDelPonte dove) =>
      _dentro.write(key: _chiaveDellIndirizzo, value: dove.toString());

  @override
  Future<void> dimentica() async {
    await _dentro.delete(key: _chiaveDelSegno);
    await _dentro.delete(key: _chiaveDellIndirizzo);
  }
}

/// Il portachiavi delle prove: sta in memoria e sparisce con il processo.
class CustodiaInMemoria implements Custodia {
  String? _segno;
  IndirizzoDelPonte? _dove;

  @override
  Future<String?> leggiIlSegno() async => _segno;

  @override
  Future<void> scriviIlSegno(String segno) async => _segno = segno;

  @override
  Future<IndirizzoDelPonte?> leggiLIndirizzo() async => _dove;

  @override
  Future<void> scriviLIndirizzo(IndirizzoDelPonte dove) async => _dove = dove;

  @override
  Future<void> dimentica() async {
    _segno = null;
    _dove = null;
  }
}
