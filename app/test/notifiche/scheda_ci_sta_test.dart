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
import 'package:gdahome/parole.dart';

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

  /* Il riepilogo della sera nella griglia nuova: la data lunga, il record,
   * il numero grande, i due numeri in fondo e la legenda, in tutte e due le
   * lingue e coi numeri piu' lunghi che possono capitare. */
  testWidgets('la giornata ci sta, in italiano e in inglese', (tester) async {
    final estreme = <String, Map<String, dynamic>>{
      'giornata': schedeDiProva['giornata']!,
      'giornata-lunga': schedeLunghe['giornata']!,
      'giornata-senza-sole': schedeDiProva['giornata-senza-sole']!,
      'giornata-senza-sole-lunga': schedeLunghe['giornata-senza-sole']!,
      'giornata-enorme': {
        ...schedeLunghe['giornata']!,
        'd': '2026-09-30',
        'pk': 1234.5,
        'casa': 1.0,
        'ris': 1234.56,
        'pkw': 99.9,
        'pora': '23:59',
        'rec': 'settembre',
      },
      'giornata-dell-anno': {
        ...schedeDiProva['giornata']!,
        'd': '2026-09-30',
        'rec': 'anno',
      },
      'giornata-senza-sole-enorme': {
        ...schedeLunghe['giornata-senza-sole']!,
        'd': '2026-09-30',
        'rk': 1234.5,
        're': 1234.56,
        'batt': 0.05,
      },
    };
    final prima = laLingua;
    addTearDown(() => laLingua = prima);
    for (final lingua in Lingua.values) {
      laLingua = lingua;
      for (final MapEntry(key: nome, value: scheda) in estreme.entries) {
        testiTagliati.clear();
        final disegno = (await tester.runAsync(
          () => disegnaLaNotifica(
            scheda: scheda,
            attesa: const Duration(seconds: 30),
          ),
        ))!;
        expect(disegno.grande, isNotNull, reason: '$nome (${lingua.codice})');
        expect(
          testiTagliati,
          isEmpty,
          reason: 'nella scheda $nome (${lingua.codice})',
        );
      }
    }
  });

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
