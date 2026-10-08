/// Il biglietto che dice all'auto se la casa è Premium.
///
/// È la porta della casa in auto: chi ha pagato la deve trovare aperta, chi
/// non ha pagato chiusa, e un biglietto che manca, storto o scaduto vale
/// «chiusa». Le stesse regole stanno in `LaLicenzaInAuto.kt` e in
/// `LaCasaInCarPlay.swift`.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/auto/la_licenza.dart';

void main() {
  final adesso = DateTime.utc(2026, 10, 8, 9).millisecondsSinceEpoch;

  test('Premium con un gettone che vale ancora: aperta', () {
    final scritto = laLicenzaScritta(
      premium: true,
      fino: DateTime.utc(2026, 10, 12),
    );
    expect(laLicenzaVale(scritto, adesso: adesso), isTrue);
  });

  test(
    'Premium col gettone scaduto: chiusa, anche se l\'app non si riapre',
    () {
      final scritto = laLicenzaScritta(
        premium: true,
        fino: DateTime.utc(2026, 10, 8, 8, 59),
      );
      expect(laLicenzaVale(scritto, adesso: adesso), isFalse);
    },
  );

  test('Premium senza scadenza (licenze spente in questa app): aperta', () {
    expect(
      laLicenzaVale(laLicenzaScritta(premium: true), adesso: adesso),
      isTrue,
    );
  });

  test('Base: chiusa, e la scadenza non si scrive nemmeno', () {
    final scritto = laLicenzaScritta(premium: false, fino: DateTime.utc(2030));
    expect(scritto, contains('"fino":null'));
    expect(laLicenzaVale(scritto, adesso: adesso), isFalse);
  });

  test('un biglietto che manca, storto o strano vale «chiusa»', () {
    for (final storto in <String?>[
      null,
      '',
      '{',
      '[]',
      '{"premium":"true"}',
      '{"premium":1}',
      '{"premium":true,"fino":"domani"}',
      '{"fino":99999999999999}',
    ]) {
      expect(laLicenzaVale(storto, adesso: adesso), isFalse, reason: '$storto');
    }
  });
}
