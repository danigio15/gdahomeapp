/// Le prove degli altri orari di irrigazione (#325), il porto di
/// `core/irrigazione-orari.js`.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/plancia/orari.dart';

void main() {
  group('gli orari', () {
    test('un\'ora e\' un\'ora solo scritta come HH:MM', () {
      expect(minutiDelGiorno('06:30'), 390);
      expect(minutiDelGiorno('00:00'), 0);
      expect(minutiDelGiorno('23:59'), 23 * 60 + 59);
      expect(minutiDelGiorno('24:00'), isNull);
      expect(minutiDelGiorno('6:30'), isNull);
      expect(minutiDelGiorno(''), isNull);
      expect(minutiDelGiorno(null), isNull);
    });

    test('si leggono come li scrive la plancia, e anche coi nomi vecchi', () {
      final letti = leggiGliOrari([
        {'ora': '20:30', 'minuti': 10, 'seSottoA': 40},
        {'time': '05:30', 'mins': '15', 'soilBelow': 55.4},
        '12:00',
        {'ora': ''},
        7,
      ]);
      expect(letti.length, 4);
      expect(letti[0].ora, '20:30');
      expect(letti[0].minuti, 10);
      expect(letti[0].seSottoA, 40);
      expect(letti[1].ora, '05:30');
      expect(letti[1].minuti, 15);
      expect(letti[1].seSottoA, 55);
      expect(letti[2].ora, '12:00');
      expect(letti[2].minuti, isNull);
      expect(letti[3].ora, '');
      expect(letti[3].valido, isFalse);
      expect(leggiGliOrari(null), isEmpty);
      expect(leggiGliOrari('20:30'), isEmpty);
    });

    test('si scrivono ripuliti come fa scriviGliOrari', () {
      final scritti = orariDaScrivere([
        const OrarioDellIrrigazione(ora: '20:30', minuti: 900, seSottoA: 140),
        const OrarioDellIrrigazione(ora: '05:30', minuti: 0, seSottoA: -3),
        const OrarioDellIrrigazione(ora: ' 12:00 '),
      ]);
      expect(scritti, [
        {'ora': '20:30', 'minuti': 480, 'seSottoA': 100},
        {'ora': '05:30', 'minuti': 1, 'seSottoA': 0},
        {'ora': '12:00'},
      ]);
    });

    test('con e senza tengono il resto della riga', () {
      const riga = OrarioDellIrrigazione(
        ora: '20:30',
        minuti: 10,
        seSottoA: 40,
      );
      expect(riga.con(ora: '21:00').minuti, 10);
      expect(riga.senza(minuti: true).seSottoA, 40);
      expect(riga.senza(minuti: true).minuti, isNull);
      expect(riga.senza(seSottoA: true).minuti, 10);
    });

    test(
      'le ore del programma: la prima davanti, in ordine, senza doppioni',
      () {
        expect(
          oreDelProgramma({
            'time': '06:30',
            'orari': [
              {'ora': '20:30'},
              {'ora': '05:30'},
              {'ora': '06:30'},
              {'ora': 'boh'},
            ],
          }),
          ['05:30', '06:30', '20:30'],
        );
        /* Senza un'ora buona vale quella di sempre. */
        expect(oreDelProgramma({}), [orarioPredefinito]);
        expect(oreDelProgramma({'time': '9:00'}), [orarioPredefinito]);
      },
    );
  });
}
