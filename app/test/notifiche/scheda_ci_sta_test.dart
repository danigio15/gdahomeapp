/// Nessun testo delle schede resta tagliato: ne' coi numeri di tutti i
/// giorni, ne' coi piu' lunghi («12,34 kWh», «10,25 €», un nome lungo).
///
/// La scheda misura ogni scritta col TextPainter e, se non ci sta, la
/// rimpicciolisce; quelle che nemmeno cosi' ci stanno finiscono in
/// [testiTagliati]. Qui quell'elenco deve restare vuoto, coi caratteri veri
/// dell'app.
library;

import 'dart:io';

import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/notifiche/scheda.dart';

import 'schede_di_prova.dart';

Future<void> _iCaratteri() async {
  const famiglie = {
    'Inter': ['400', '500', '600', '700', '800', '900'],
    'Oswald': ['200', '400', '700'],
  };
  for (final famiglia in famiglie.entries) {
    final carica = FontLoader(famiglia.key);
    for (final peso in famiglia.value) {
      carica.addFont(
        File('assets/carattere/${famiglia.key}-$peso.ttf')
            .readAsBytes()
            .then((byte) => byte.buffer.asByteData()),
      );
    }
    await carica.load();
  }
}

void main() {
  setUpAll(_iCaratteri);

  for (final (gruppo, schede) in [
    ('di tutti i giorni', schedeDiProva),
    ('coi numeri lunghi', schedeLunghe),
  ]) {
    testWidgets('le schede $gruppo ci stanno intere', (tester) async {
      for (final MapEntry(key: nome, value: scheda) in schede.entries) {
        testiTagliati.clear();
        final disegno = (await tester.runAsync(
          () => disegnaLaNotifica(
            scheda: scheda,
            foto: nome == 'movimento' ? fotoDiProva() : null,
            attesa: const Duration(seconds: 30),
          ),
        ))!;
        expect(disegno.grande, isNotNull, reason: nome);
        expect(testiTagliati, isEmpty, reason: 'nella scheda $nome');
      }
    });
  }

  testWidgets('e la misura se ne accorge, quando proprio non ci sta', (
    tester,
  ) async {
    testiTagliati.clear();
    await tester.runAsync(
      () => disegnaLaNotifica(
        scheda: {...schedeDiProva['ciclo']!, 'n': 'Lavatrice ' * 20},
        attesa: const Duration(seconds: 30),
      ),
    );
    expect(testiTagliati, isNotEmpty);
    testiTagliati.clear();
  });
}
