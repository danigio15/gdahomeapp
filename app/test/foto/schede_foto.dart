/// Le fotografie delle schede delle notifiche elaborate, disegnate dal codice
/// vero (`lib/notifiche/scheda.dart`): il ciclo, la giornata, l'UPS,
/// l'antifurto e il movimento con la foto.
///
/// Non e' una prova: e' un attrezzo per **guardare**. Si lancia a mano:
///
/// ```sh
/// cd app && GDAHOME_FOTO=/tmp/foto flutter test test/foto/schede_foto.dart
/// ```
library;

import 'dart:io';

import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/notifiche/scheda.dart';

import '../notifiche/schede_di_prova.dart';

final _cartella =
    Platform.environment['GDAHOME_FOTO'] ?? '/home/user/render/gdahome-app';

Future<void> _iCaratteri() async {
  const famiglie = {
    'Inter': ['400', '500', '600', '700', '800', '900'],
    'Oswald': ['200', '400', '700'],
  };
  for (final famiglia in famiglie.entries) {
    final carica = FontLoader(famiglia.key);
    for (final peso in famiglia.value) {
      final file = File('assets/carattere/${famiglia.key}-$peso.ttf');
      if (!file.existsSync()) continue;
      carica.addFont(
        file.readAsBytes().then((byte) => byte.buffer.asByteData()),
      );
    }
    await carica.load();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(_iCaratteri);

  for (final MapEntry(key: nome, value: scheda) in {
    ...schedeDiProva,
    for (final MapEntry(:key, :value) in schedeLunghe.entries)
      'lunga-$key': value,
    for (final MapEntry(:key, :value) in schedeDegliElettrodomestici.entries)
      'ciclo-$key': value,
  }.entries) {
    testWidgets('la scheda $nome', (tester) async {
      final disegno = (await tester.runAsync(
        () => disegnaLaNotifica(
          scheda: scheda,
          foto: nome.endsWith('movimento') ? fotoDiProva() : null,
          attesa: const Duration(seconds: 30),
        ),
      ))!;
      expect(disegno.grande, isNotNull);
      Directory(_cartella).createSync(recursive: true);
      File('$_cartella/scheda-$nome.png').writeAsBytesSync(disegno.grande!);
      if (disegno.icona != null) {
        File('$_cartella/icona-$nome.png').writeAsBytesSync(disegno.icona!);
      }
    });
  }
}
