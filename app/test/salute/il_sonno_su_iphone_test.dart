import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/salute/il_corpo.dart';
import 'package:gdahome/salute/lettore_qui/sul_telefono.dart';
import 'package:health/health.dart';

void main() {
  group('il sonno su iPhone', () {
    test("le fasi dell'Apple Watch (essenziale, profondo, REM) si leggono", () {
      /* Da watchOS 9 il Watch non scrive piu' «addormentato» senza fase:
       * chiedendo solo SLEEP_ASLEEP una notte col Watch non arrivava. */
      final tipi = tipiDi(MisuraDelCorpo.sonno, iPhone: true);
      expect(
        tipi,
        containsAll([
          HealthDataType.SLEEP_ASLEEP,
          HealthDataType.SLEEP_LIGHT,
          HealthDataType.SLEEP_DEEP,
          HealthDataType.SLEEP_REM,
        ]),
      );
    });

    test('senza Watch resta «a letto», ma solo se di dormito non c\'è', () {
      expect(
        tipiDi(MisuraDelCorpo.sonno, iPhone: true),
        contains(HealthDataType.SLEEP_IN_BED),
      );
      expect(
        sonnoDormitoSuIPhone,
        isNot(contains(HealthDataType.SLEEP_IN_BED)),
      );
    });

    test('le fasi di una notte si sommano senza contarle due volte', () {
      final adesso = DateTime(2026, 11, 4, 8);
      DateTime h(int giorno, int ora, [int min = 0]) =>
          DateTime(2026, 11, giorno, ora, min);
      final fasi = [
        Campione(0, h(3, 23, 30), h(4, 1)), // essenziale
        Campione(0, h(4, 1), h(4, 2)), // profondo
        Campione(0, h(4, 2), h(4, 3, 30)), // REM
        Campione(0, h(4, 3, 45), h(4, 6, 45)), // essenziale, dopo un risveglio
        /* L'iPhone scrive la stessa notte come «addormentato»: sovrapposto. */
        Campione(0, h(3, 23, 30), h(4, 6, 45)),
      ];
      final sonno = ilSonnoDiStanotte(fasi, adesso)!;
      expect(sonno.valore, 7 * 60 + 15);
      expect(sonno.quando, h(4, 6, 45));
    });

    test('su Android resta la sessione di sonno', () {
      expect(tipiDi(MisuraDelCorpo.sonno, iPhone: false), [
        HealthDataType.SLEEP_SESSION,
      ]);
    });
  });
}
