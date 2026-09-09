/// Le prove delle soglie di casa.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/plancia/soglie.dart';

void main() {
  group('la tapparella «chiusa»', () {
    test('non scritta vale zero: il comportamento di sempre', () {
      expect(sogliaDellaChiusura(null), 0);
      expect(sogliaDellaChiusura('   '), 0);
      expect(sogliaDellaChiusura('boh'), 0);
    });

    test('oltre la meta\' non si va', () {
      expect(sogliaDellaChiusura(80), sogliaChiusaMassima);
      expect(sogliaDellaChiusura(-5), 0);
      expect(sogliaDellaChiusura('12,4'), 12);
    });

    test('quella della finestra vince su quella di casa', () {
      expect(sogliaDellaTapparella({'soglia': 20}, 5), 20);
      expect(sogliaDellaTapparella(const {}, 5), 5);
      /* Zero scritto apposta vale zero: e' una scelta, non un campo vuoto. */
      expect(sogliaDellaTapparella({'soglia': 0}, 30), 0);
    });
  });

  group('l\'umidita\'', () {
    test('non scritta vale sessanta', () {
      expect(sogliaDellUmidita(null), sogliaUmiditaDiSerie);
      expect(sogliaDellUmidita(''), sogliaUmiditaDiSerie);
    });

    test('fuori scala si considera non scritta', () {
      expect(sogliaDellUmidita(0), sogliaUmiditaDiSerie);
      expect(sogliaDellUmidita(99), sogliaUmiditaDiSerie);
      expect(sogliaDellUmidita(65), 65);
    });
  });
}
