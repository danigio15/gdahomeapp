/// Le due lingue: quale si sceglie, e come si scrive una frase.
///
/// La prova che conta piu' di tutte non e' qui: e' il compilatore. `inLingua`
/// vuole tutte le lingue, quindi una frase senza la sua traduzione non
/// compila. Qui si prova quello che il compilatore non puo' sapere: **quale**
/// lingua tocca a un telefono, e che una frase esca davvero in quella.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/parole.dart';

void main() {
  /* Le prove girano in italiano, come l'app su un telefono italiano: quella
   * che si rimette a posto e' la lingua di prima, se una prova la cambia. */
  setUp(() => laLingua = Lingua.italiano);
  tearDown(() => laLingua = Lingua.italiano);

  group('quale lingua, per un telefono', () {
    test('italiano se il telefono lo chiede', () {
      expect(linguaPer(['it']), Lingua.italiano);
      expect(linguaPer(['it']), Lingua.italiano);
    });

    test('inglese se chiede inglese', () {
      expect(linguaPer(['en']), Lingua.inglese);
      expect(linguaPer(['en']), Lingua.inglese);
    });

    test(
      'chi ha messo l\'italiano dopo un\'altra lingua vuole l\'italiano',
      () {
        /* Una lingua che non parliamo non e' una risposta: si guarda la
       * prossima, che e' la seconda scelta di chi ha il telefono in mano. */
        expect(linguaPer(['es', 'it']), Lingua.italiano);
      },
    );

    test('nessuna delle nostre: inglese, come fa la plancia', () {
      expect(linguaPer(['es']), Lingua.inglese);
      expect(linguaPer(['de', 'fr']), Lingua.inglese);
      expect(linguaPer([]), Lingua.inglese);
    });
  });

  group('la frase giusta', () {
    test('esce nella lingua di adesso', () {
      laLingua = Lingua.italiano;
      expect(inLingua(it: 'Abbina', en: 'Pair'), 'Abbina');
      laLingua = Lingua.inglese;
      expect(inLingua(it: 'Abbina', en: 'Pair'), 'Pair');
    });

    test('e le lingue che l\'app parla sono due', () {
      expect(Lingua.values.map((una) => una.codice), ['it', 'en']);
    });
  });

  group('le parole che cambiano col numero', () {
    test('una volta e\' una, e le altre sono volte', () {
      expect(volte(1), '1 volta');
      expect(volte(0), '0 volte');
      expect(volte(2), '2 volte');
      expect(volte(31), '31 volte');
    });

    test('e in inglese uguale', () {
      laLingua = Lingua.inglese;
      expect(volte(1), '1 time');
      expect(volte(0), '0 times');
      expect(volte(2), '2 times');
    });
  });
}
