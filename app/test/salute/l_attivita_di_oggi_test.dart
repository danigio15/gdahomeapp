import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/salute/il_corpo.dart';
import 'package:gdahome/salute/lettore_qui/sul_telefono.dart';
import 'package:health/health.dart';

/// «In Salute ci sono distanza, piani, esercizio, ore in piedi, calorie a
/// riposo: nella plancia niente.» Le misure dell'anello Attività, e di chi
/// le aveva scelte prima che esistessero.
void main() {
  final adesso = DateTime(2026, 11, 4, 7, 53);

  group('le misure nuove', () {
    test('sono di oggi, e accese di serie', () {
      for (final m in [
        MisuraDelCorpo.distanza,
        MisuraDelCorpo.piani,
        MisuraDelCorpo.esercizio,
        MisuraDelCorpo.inPiedi,
        MisuraDelCorpo.calorieRiposo,
      ]) {
        expect(eDiOggi(m), isTrue, reason: m.name);
        expect(finestraDellUltimo(m), isNull, reason: m.name);
        expect(misureDiSerie, contains(m), reason: m.name);
      }
      expect(eDiOggi(MisuraDelCorpo.battito), isFalse);
    });

    test("esercizio e ore in piedi sono dell'Apple Watch: su Android no", () {
      expect(siPuoLeggere(MisuraDelCorpo.esercizio, iPhone: true), isTrue);
      expect(siPuoLeggere(MisuraDelCorpo.inPiedi, iPhone: true), isTrue);
      expect(siPuoLeggere(MisuraDelCorpo.esercizio, iPhone: false), isFalse);
      expect(siPuoLeggere(MisuraDelCorpo.inPiedi, iPhone: false), isFalse);
      expect(siPuoLeggere(MisuraDelCorpo.distanza, iPhone: false), isTrue);
      expect(tipiDi(MisuraDelCorpo.esercizio, iPhone: false), isEmpty);
      expect(tipiDi(MisuraDelCorpo.inPiedi, iPhone: false), isEmpty);
    });

    test('i tipi giusti per ogni sistema', () {
      expect(tipiDi(MisuraDelCorpo.distanza, iPhone: true), [
        HealthDataType.DISTANCE_WALKING_RUNNING,
      ]);
      expect(tipiDi(MisuraDelCorpo.distanza, iPhone: false), [
        HealthDataType.DISTANCE_DELTA,
      ]);
      expect(tipiDi(MisuraDelCorpo.piani, iPhone: true), [
        HealthDataType.FLIGHTS_CLIMBED,
      ]);
      expect(tipiDi(MisuraDelCorpo.calorieRiposo, iPhone: true), [
        HealthDataType.BASAL_ENERGY_BURNED,
      ]);
      /* Su Android il metabolismo e' un ritmo: si tolgono le attive dalle
       * totali. */
      expect(tipiDi(MisuraDelCorpo.calorieRiposo, iPhone: false), [
        HealthDataType.TOTAL_CALORIES_BURNED,
        HealthDataType.ACTIVE_ENERGY_BURNED,
      ]);
      expect(tipiDi(MisuraDelCorpo.esercizio, iPhone: true), [
        HealthDataType.EXERCISE_TIME,
      ]);
      expect(tipiDi(MisuraDelCorpo.inPiedi, iPhone: true), [
        HealthDataType.APPLE_STAND_HOUR,
      ]);
    });

    test(
      'ogni misura ha i suoi tipi in Health Connect, fuori dagli anelli',
      () {
        for (final m in MisuraDelCorpo.values) {
          if (!siPuoLeggere(m, iPhone: false)) continue;
          for (final tipo in tipiDi(m, iPhone: false)) {
            expect(dataTypeKeysAndroid, contains(tipo), reason: m.name);
          }
        }
        for (final m in MisuraDelCorpo.values) {
          for (final tipo in tipiDi(m, iPhone: true)) {
            expect(dataTypeKeysIOS, contains(tipo), reason: m.name);
          }
        }
      },
    );
  });

  group('le ore in piedi', () {
    Campione ora(int h, double valore, [int min = 0]) => Campione(
      valore,
      DateTime(2026, 11, 4, h, min),
      DateTime(2026, 11, 4, h + 1),
    );

    test("si contano le ore «in piedi» (0), non quelle «fermo» (1)", () {
      final lette = leOreInPiedi([ora(6, 1), ora(7, 0)], adesso)!;
      expect(lette.valore, 1);
      expect(lette.quando, adesso);
    });

    test("un'ora scritta due volte si conta una", () {
      expect(leOreInPiedi([ora(7, 0), ora(7, 0, 30)], adesso)!.valore, 1);
    });

    test('nessun campione: niente; solo ore ferme: zero', () {
      expect(leOreInPiedi(const [], adesso), isNull);
      expect(leOreInPiedi([ora(6, 1)], adesso)!.valore, 0);
    });
  });

  test('le calorie a riposo su Android: totali meno attive', () {
    expect(caloriaRiposoDaiTotali(682, 4.6), closeTo(677.4, .01));
    expect(caloriaRiposoDaiTotali(680, null), 680);
    expect(caloriaRiposoDaiTotali(null, 10), isNull);
    expect(caloriaRiposoDaiTotali(3, 10), 0);
    expect(sommaDiOggi([120, 70.5]), 190.5);
  });

  group('chi aveva scelto prima', () {
    test('trova accese le misure nuove, e il permesso è da chiedere', () {
      final prima = jsonEncode({
        'acceso': true,
        'persona': 'Marco',
        'misure': ['passi', 'battito', 'calorie'],
      });
      final scelte = ScelteDellaSalute.daQuelloCheCEra(prima);
      expect(
        scelte.misure,
        containsAll([
          MisuraDelCorpo.passi,
          MisuraDelCorpo.battito,
          MisuraDelCorpo.calorie,
          MisuraDelCorpo.distanza,
          MisuraDelCorpo.piani,
          MisuraDelCorpo.esercizio,
          MisuraDelCorpo.inPiedi,
          MisuraDelCorpo.calorieRiposo,
        ]),
      );
      /* Quelle vecchie che aveva tolto restano tolte. */
      expect(scelte.misure, isNot(contains(MisuraDelCorpo.peso)));
      expect(scelte.misure, isNot(contains(MisuraDelCorpo.sonno)));
      expect(scelte.daChiedere, {
        MisuraDelCorpo.distanza,
        MisuraDelCorpo.piani,
        MisuraDelCorpo.esercizio,
        MisuraDelCorpo.inPiedi,
        MisuraDelCorpo.calorieRiposo,
      });
    });

    test('dopo il permesso, una misura nuova tolta resta tolta', () {
      final viste = ScelteDellaSalute.daQuelloCheCEra(
        jsonEncode({
          'acceso': true,
          'misure': ['passi'],
        }),
      ).tutteViste();
      expect(viste.daChiedere, isEmpty);
      final senzaPiani = viste.con(
        misure: viste.misure.difference({MisuraDelCorpo.piani}),
      );
      final riletta = ScelteDellaSalute.daQuelloCheCEra(
        senzaPiani.comeSiScrive,
      );
      expect(riletta.misure, isNot(contains(MisuraDelCorpo.piani)));
      expect(riletta.misure, contains(MisuraDelCorpo.distanza));
      expect(riletta.daChiedere, isEmpty);
    });

    test('chi non aveva mai scelto: quelle di serie, nulla da chiedere', () {
      final nuova = ScelteDellaSalute.daQuelloCheCEra(null);
      expect(nuova.misure, misureDiSerie);
      expect(nuova.daChiedere, isEmpty);
    });
  });
}
