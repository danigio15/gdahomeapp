/// Le prove della caldaia e delle cose che scaldano.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/plancia/caldo.dart';

void main() {
  group('la caldaia', () {
    test('ha dieci caselle, mandata e ritorno per prime fra i gradi', () {
      expect(caselleDellaCaldaia.length, 10);
      final gradi = [
        for (final (campo, _, tipo, _) in caselleDellaCaldaia)
          if (tipo == 'gradi') campo,
      ];
      expect(gradi.first, 'mandata');
      expect(gradi[1], 'ritorno');
    });

    test('l\'uscita di serie sono i radiatori', () {
      expect(leggiUnaCaldaia(const {})['uscita'], 'radiatori');
      expect(leggiUnaCaldaia({'uscita': 'boiler'})['uscita'], 'boiler');
      /* Una parola che non e' un'uscita non e' una scelta: e' un errore, e si
       * torna a quella di serie. */
      expect(leggiUnaCaldaia({'uscita': 'chissa'})['uscita'], 'radiatori');
    });

    test('un oggetto solo vale come elenco di uno', () {
      final letto = leggiLeCaldaie({'mandata': 'sensor.m'});
      expect(letto.length, 1);
      expect(letto.single['id'], 'caldaia-1');
      expect(letto.single['mandata'], 'sensor.m');
    });

    test('l\'id scritto resta il suo', () {
      final letto = leggiLeCaldaie([
        {'id': 'la-mia', 'mandata': 'sensor.m'},
      ]);
      expect(letto.single['id'], 'la-mia');
    });

    test('le caselle vuote non si scrivono', () {
      final scritto = caldaieDaScrivere([
        {'id': 'a', 'name': 'Caldaia', 'mandata': 'sensor.m', 'ritorno': ''},
      ]);
      expect(scritto.single.containsKey('ritorno'), isFalse);
      expect(scritto.single['mandata'], 'sensor.m');
    });
  });

  group('le cose che scaldano', () {
    test('senza nome o senza entita\' non sono una voce', () {
      expect(leggiUnaVoceDelCaldo({'name': 'Camino'}), isNull);
      expect(leggiUnaVoceDelCaldo({'entity': 'switch.camino'}), isNull);
      expect(
        leggiUnaVoceDelCaldo({'name': 'Camino', 'entity': 'senzapunto'}),
        isNull,
      );
    });

    test('il disegno di serie e\' la fiamma', () {
      final voce = leggiUnaVoceDelCaldo({
        'name': 'Termocamino',
        'entity': 'switch.termocamino',
      });
      expect(voce!['icon'], '🔥');
    });

    test('quello che non e\' un elenco non e\' una configurazione', () {
      /* Mai scritto vuol dire un'altra cosa da «svuotato apposta»: qui esce
       * vuoto, e a seminare le voci storiche pensa la plancia. */
      expect(leggiIlTermicoCaldo(null), isEmpty);
      expect(leggiIlTermicoCaldo(const {}), isEmpty);
      expect(leggiIlTermicoCaldo(const []), isEmpty);
    });
  });
}
