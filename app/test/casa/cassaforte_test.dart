/// Le prove della cassaforte: le regole del portachiavi, e il trasloco dei
/// segni salvati con le regole di prima.
library;

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/cassaforte.dart';

/// Un portachiavi in memoria, che conta quante volte gli si scrive.
class _PortachiaviFinto extends FlutterSecureStorage {
  _PortachiaviFinto();

  final dentro = <String, String>{};
  int scritture = 0;

  @override
  Future<String?> read({
    required String key,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async => dentro[key];

  @override
  Future<void> write({
    required String key,
    required String? value,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    scritture += 1;
    if (value == null) {
      dentro.remove(key);
    } else {
      dentro[key] = value;
    }
  }

  @override
  Future<void> delete({
    required String key,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async => dentro.remove(key);
}

void main() {
  setUp(CassaforteDelSistema.scordaLeRiscritte);

  test(
    'sull\'iPhone il segno resta sul telefono, e si legge a schermo spento',
    () {
      /* `first_unlock` da solo lo mandava nelle copie di iCloud, e da li' su
     * un altro iPhone: il segno che apre casa non deve uscire dal telefono a
     * cui e' stato dato. */
      expect(
        CassaforteDelSistema.portachiavi.iOptions.toMap()['accessibility'],
        'first_unlock_this_device',
      );
      expect(
        CassaforteDelSistema.portachiavi.aOptions
            .toMap()['encryptedSharedPreferences'],
        'true',
      );
    },
  );

  test(
    'un segno salvato con le regole di prima si riscrive, una volta',
    () async {
      final finto = _PortachiaviFinto()..dentro['case'] = '[1]';
      final cassaforte = CassaforteDelSistema(
        dentro: finto,
        riscriviLeVecchie: true,
      );

      expect(await cassaforte.leggi('case'), '[1]');
      expect(finto.scritture, 1, reason: 'riscritto con le regole nuove');
      expect(finto.dentro['case'], '[1]');

      /* Una volta basta: le letture dopo non scrivono piu'. */
      expect(await cassaforte.leggi('case'), '[1]');
      expect(finto.scritture, 1);

      /* E quello che non c'e' non si scrive. */
      expect(await cassaforte.leggi('manca'), isNull);
      expect(finto.scritture, 1);
    },
  );

  test('fuori dall\'iPhone non si riscrive niente', () async {
    final finto = _PortachiaviFinto()..dentro['case'] = '[1]';
    final cassaforte = CassaforteDelSistema(
      dentro: finto,
      riscriviLeVecchie: false,
    );
    expect(await cassaforte.leggi('case'), '[1]');
    expect(finto.scritture, 0);
  });
}
