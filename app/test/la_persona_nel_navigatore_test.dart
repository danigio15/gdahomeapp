/// «Apri in mappa» sulla persona, dentro l'app: un messaggio senza punto non
/// accende niente.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/schermate/navigatore_qui/sul_telefono.dart';

void main() {
  test('un messaggio senza punto non apre il navigatore', () async {
    for (final detto in <String>[
      '',
      'non è json',
      '[]',
      '{"nome":"Giovanni"}',
      '{"nome":"Giovanni","lat":"40.8","lon":14.2}',
    ]) {
      expect(await portamiDallaPersona(detto), isFalse, reason: detto);
    }
  });
}
